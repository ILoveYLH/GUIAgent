from __future__ import annotations

import asyncio
import json
import re
from collections.abc import AsyncIterator
from typing import Any

import jwt
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from routers.auth import verify_token
from schemas.chat import ChatRequest
from services.task_manager import task_manager


router = APIRouter(tags=["chat"])

LINK_RE = re.compile(r"https?://[^\s]+", re.IGNORECASE)


def _sse(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _extract_link(message: str) -> str | None:
    match = LINK_RE.search(message)
    return match.group(0) if match else None


@router.post("/chat")
async def chat(payload: ChatRequest) -> StreamingResponse:
    try:
        verify_token(payload.token)
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc

    source_url = _extract_link(payload.message)

    async def event_stream() -> AsyncIterator[str]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()

        async def push(event: dict[str, Any]) -> None:
            await queue.put(event)

        if source_url:
            task = task_manager.create_task(source_url)
            worker = asyncio.create_task(
                task_manager.run_real_analysis(
                    task.id,
                    callback=push,
                    conversation_history=payload.history,
                )
            )
        else:
            worker = asyncio.create_task(
                task_manager.answer_followup(
                    message=payload.message,
                    conversation_history=payload.history,
                    callback=push,
                )
            )

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

    return StreamingResponse(event_stream(), media_type="text/event-stream")
