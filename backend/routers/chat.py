from __future__ import annotations

import asyncio
import json
import re
from collections.abc import AsyncIterator
from typing import Any

import jwt
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from config import settings
from routers.auth import verify_token
from schemas.chat import ChatRequest
from services.conversation_store import conversation_store
from services.diagnosis_llm import generate_diagnosis
from services.task_manager import task_manager
from services.title_generator import generate_title


router = APIRouter(tags=["chat"])

LINK_RE = re.compile(r"https?://[^\s]+", re.IGNORECASE)


def _sse(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _extract_link(message: str) -> str | None:
    match = LINK_RE.search(message)
    return match.group(0) if match else None


def _model_finding_count(model_result: dict[str, Any]) -> int:
    return sum(
        len(model_result.get(key, []))
        for key in ("lung_lesions", "rib_lesions", "bone_metastasis_lesions", "lymphnode_lesions")
    )


@router.post("/chat")
async def chat(payload: ChatRequest) -> StreamingResponse:
    try:
        verify_token(payload.token)
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc

    source_url = _extract_link(payload.message)
    if payload.conversation_id:
        conversation = await conversation_store.get_conversation(payload.conversation_id)
        if conversation is None:
            raise HTTPException(status_code=404, detail="Conversation not found")
        conversation_id = payload.conversation_id
        should_generate_title = len(conversation["messages"]) == 0 or conversation["title"] == "新对话"
    else:
        conversation = await conversation_store.create_conversation()
        conversation_id = conversation["id"]
        should_generate_title = True

    await conversation_store.add_message(conversation_id, "user", payload.message, "text")
    conversation_context = await conversation_store.get_recent_context(conversation_id, max_rounds=5)
    if not source_url and conversation_context and conversation_context[-1]["role"] == "user":
        conversation_context = conversation_context[:-1]

    async def event_stream() -> AsyncIterator[str]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        diagnosis_parts: list[str] = []
        diagnosis_saved = False

        async def push(event: dict[str, Any]) -> None:
            nonlocal diagnosis_saved
            event_name = event.get("event", "progress")
            if event_name == "progress":
                await conversation_store.add_message(
                    conversation_id,
                    "system",
                    event.get("message", ""),
                    "progress",
                    {
                        "stage": event.get("stage"),
                        "percent": event.get("percent"),
                        "status": event.get("status"),
                    },
                )
            elif event_name == "report":
                await conversation_store.add_message(
                    conversation_id,
                    "ai",
                    event.get("content", ""),
                    "report",
                    {"task_id": event.get("task_id")},
                )
            elif event_name == "findings":
                model_result = event.get("data") or {}
                findings_count = _model_finding_count(model_result)
                await conversation_store.add_message(
                    conversation_id,
                    "ai",
                    f"AI模型检测到{findings_count}个病灶",
                    "findings",
                    {
                        "data": model_result,
                        "frame_base_url": event.get("frame_base_url"),
                        "total_frames": event.get("total_frames"),
                        "task_id": event.get("task_id"),
                    },
                )
                await conversation_store.update_conversation_context(
                    conversation_id,
                    model_result_json=json.dumps(model_result, ensure_ascii=False),
                )
            elif event_name == "diagnosis":
                diagnosis_parts.append(event.get("delta", ""))
            elif event_name == "done" and not diagnosis_saved:
                task = task_manager.get_task(event.get("task_id", ""))
                if task is not None:
                    await conversation_store.update_conversation_context(
                        conversation_id,
                        study_id=task.study_id or None,
                        report_json=json.dumps(task.report_data or {}, ensure_ascii=False),
                        model_result_json=json.dumps(task.model_result or {}, ensure_ascii=False),
                    )
                diagnosis_text = "".join(diagnosis_parts).strip()
                if diagnosis_text:
                    await conversation_store.add_message(conversation_id, "ai", diagnosis_text, "diagnosis")
                    diagnosis_saved = True
            await queue.put(event)

        async def update_generated_title() -> None:
            if not should_generate_title:
                return
            title = await generate_title(payload.message, settings.qwen_api_key, settings.qwen_model)
            await conversation_store.update_conversation_title(conversation_id, title)
            await queue.put({"event": "title", "conversation_id": conversation_id, "title": title})

        async def run_followup() -> None:
            nonlocal diagnosis_saved
            conversation_data = await conversation_store.get_conversation(conversation_id)
            if conversation_data is None:
                await queue.put({"event": "error", "message": "Conversation not found"})
                return
            report_data = json.loads(conversation_data.get("report_json") or "{}")
            model_result = json.loads(conversation_data.get("model_result_json") or "{}")
            if not report_data and not model_result:
                await queue.put({"event": "error", "message": "请先提交一个医学影像链接完成分析，再继续追问。"})
                return

            async for delta in generate_diagnosis(
                report_data=report_data,
                model_result=model_result,
                conversation_history=conversation_context,
                user_question=payload.message,
                api_key=settings.qwen_api_key,
                model=settings.qwen_model,
            ):
                diagnosis_parts.append(delta)
                await queue.put({"event": "diagnosis", "delta": delta})
            diagnosis_text = "".join(diagnosis_parts).strip()
            if diagnosis_text:
                await conversation_store.add_message(conversation_id, "ai", diagnosis_text, "diagnosis")
                diagnosis_saved = True
            await queue.put({"event": "done"})

        yield _sse("init", {"conversation_id": conversation_id})

        title_task = asyncio.create_task(update_generated_title())
        if source_url:
            task = task_manager.create_task(source_url)
            worker = asyncio.create_task(
                task_manager.run_real_analysis(
                    task.id,
                    callback=push,
                    conversation_history=conversation_context,
                )
            )
        else:
            worker = asyncio.create_task(run_followup())

        try:
            while True:
                event = await queue.get()
                event_name = event.get("event", "progress")
                data = {key: value for key, value in event.items() if key != "event"}
                yield _sse(event_name, data)
                if event_name in {"done", "error"}:
                    break
        finally:
            if not worker.done():
                worker.cancel()
                try:
                    await worker
                except asyncio.CancelledError:
                    pass
            if not title_task.done():
                title_task.cancel()
                try:
                    await title_task
                except asyncio.CancelledError:
                    pass

    return StreamingResponse(event_stream(), media_type="text/event-stream")
