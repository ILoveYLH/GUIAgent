from __future__ import annotations

import asyncio
import inspect
import json
import re
import sys
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any
from uuid import uuid4

from adapters.mock_viewer import MockViewerAdapter
from config import settings
from services.diagnosis_llm import generate_diagnosis
from services.gui_agent import GUIAgent
from services.mock_model import generate_mock_callback


class TaskStatus(str, Enum):
    RECEIVED = "RECEIVED"
    EXTRACTING_REPORT = "EXTRACTING_REPORT"
    CAPTURING_FRAMES = "CAPTURING_FRAMES"
    RECONSTRUCTING = "RECONSTRUCTING"
    MODEL_INFERENCE = "MODEL_INFERENCE"
    LLM_DIAGNOSIS = "LLM_DIAGNOSIS"
    COMPLETED = "COMPLETED"
    ERROR = "ERROR"


StatusCallback = Callable[["Task"], None | Awaitable[None]]
EventCallback = Callable[[dict[str, Any]], None | Awaitable[None]]


@dataclass
class Task:
    id: str
    source_url: str
    status: TaskStatus = TaskStatus.RECEIVED
    progress: int = 0
    message: str = "已接收分析任务"
    result: dict[str, Any] | None = None
    error: str | None = None
    report_data: dict[str, Any] | None = None
    model_result: dict[str, Any] | None = None
    output_dir: str = ""
    study_id: str = ""
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def as_event(self) -> dict[str, Any]:
        data = self.result if self.status == TaskStatus.COMPLETED else None
        if self.status == TaskStatus.ERROR:
            data = {"error": self.error}
        return {
            "task_id": self.id,
            "status": self.status.value,
            "message": self.message,
            "progress": self.progress,
            "data": data,
        }


class TaskManager:
    """In-memory task state machine. Can be swapped with Redis later."""

    def __init__(self) -> None:
        self._tasks: dict[str, Task] = {}
        self._latest_task_id: str | None = None

    def create_task(self, source_url: str) -> Task:
        task = Task(id=str(uuid4()), source_url=source_url)
        self._tasks[task.id] = task
        return task

    def get_task(self, task_id: str) -> Task | None:
        return self._tasks.get(task_id)

    def latest_context_task(self) -> Task | None:
        if self._latest_task_id:
            task = self._tasks.get(self._latest_task_id)
            if task and task.report_data and task.model_result:
                return task
        for task in reversed(list(self._tasks.values())):
            if task.report_data and task.model_result:
                return task
        return None

    async def _emit(self, callback: EventCallback | None, event: dict[str, Any]) -> None:
        if callback is None:
            return
        maybe_awaitable = callback(event)
        if inspect.isawaitable(maybe_awaitable):
            await maybe_awaitable

    async def transition(
        self,
        task_id: str,
        status: TaskStatus,
        *,
        message: str,
        progress: int,
        callback: StatusCallback | None = None,
        result: dict[str, Any] | None = None,
        error: str | None = None,
    ) -> Task:
        task = self._tasks[task_id]
        task.status = status
        task.message = message
        task.progress = progress
        task.result = result
        task.error = error
        task.updated_at = datetime.now(timezone.utc)
        if callback is not None:
            maybe_awaitable = callback(task)
            if inspect.isawaitable(maybe_awaitable):
                await maybe_awaitable
        return task

    async def set_model_result(self, task_id: str, model_result: dict[str, Any]) -> Task | None:
        task = self._tasks.get(task_id)
        if task is None:
            return None
        task.model_result = model_result
        task.updated_at = datetime.now(timezone.utc)
        if task.status == TaskStatus.MODEL_INFERENCE:
            task.message = "已收到一扫多查模型回调"
            task.progress = max(task.progress, 75)
        return task

    async def run_mock_analysis(
        self,
        task_id: str,
        *,
        callback: StatusCallback | None = None,
        delay_seconds: float = 0.05,
    ) -> None:
        steps = [
            (TaskStatus.EXTRACTING_REPORT, "正在提取报告信息", 15),
            (TaskStatus.CAPTURING_FRAMES, "正在采集影像关键帧", 35),
            (TaskStatus.RECONSTRUCTING, "正在重建 DICOM 序列", 55),
            (TaskStatus.MODEL_INFERENCE, "正在调用一扫多查模型", 75),
            (TaskStatus.LLM_DIAGNOSIS, "正在生成诊断建议", 90),
        ]
        try:
            for status, message, progress in steps:
                await asyncio.sleep(delay_seconds)
                await self.transition(
                    task_id,
                    status,
                    message=message,
                    progress=progress,
                    callback=callback,
                )

            await asyncio.sleep(delay_seconds)
            await self.transition(
                task_id,
                TaskStatus.COMPLETED,
                message="分析完成",
                progress=100,
                callback=callback,
                result={
                    "diagnosis": "Mock 诊断结果：未见明确急性异常，请结合临床资料复核。",
                    "findings": [
                        "已模拟完成报告提取",
                        "已模拟完成影像帧采集",
                        "已模拟完成模型推理",
                    ],
                    "viewer_url": self._tasks[task_id].source_url,
                    "confidence": 0.82,
                },
            )
        except Exception as exc:
            await self.transition(
                task_id,
                TaskStatus.ERROR,
                message="分析失败",
                progress=self._tasks[task_id].progress,
                callback=callback,
                error=str(exc),
            )

    async def run_real_analysis(
        self,
        task_id: str,
        *,
        callback: EventCallback | None = None,
        conversation_history: list[dict[str, Any]] | None = None,
    ) -> None:
        task = self._tasks[task_id]
        backend_dir = Path(__file__).resolve().parents[1]
        study_id = _extract_study_id(task.source_url)
        output_dir = backend_dir / "output" / study_id
        task.study_id = study_id
        task.output_dir = str(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        try:
            await self._set_status_event(task, TaskStatus.EXTRACTING_REPORT, "正在提取报告信息", 5, "report", callback)
            report_path = output_dir / "report.json"
            frames = sorted(output_dir.glob("frame_*.png"))

            if not report_path.exists() or not frames:
                await self._run_gui_agent(task, output_dir, callback)
            else:
                await self._set_status_event(task, TaskStatus.CAPTURING_FRAMES, "已发现缓存影像帧，复用本地产物", 35, "capture", callback)

            task.report_data = _read_json(report_path)
            await self._emit(
                callback,
                {
                    "event": "report",
                    "content": _format_report(task.report_data or {}),
                    "task_id": task.id,
                },
            )

            await self._set_status_event(task, TaskStatus.RECONSTRUCTING, "正在重建 DICOM 序列", 40, "dicom", callback)
            await self._rebuild_dicom(backend_dir, output_dir, callback, task)

            await self._set_status_event(task, TaskStatus.MODEL_INFERENCE, "正在调用一扫多查模型", 60, "model", callback)
            model_result = generate_mock_callback(task.id, study_id, str(output_dir))
            model_result_path = output_dir / "model_result.json"
            model_result_path.write_text(json.dumps(model_result, ensure_ascii=False, indent=2), encoding="utf-8")
            await self.set_model_result(task.id, model_result)
            await self._emit(
                callback,
                {
                    "event": "findings",
                    "data": model_result,
                    "frame_base_url": f"/api/frames/{study_id}",
                    "total_frames": _count_frames(output_dir),
                    "task_id": task.id,
                },
            )

            await self._set_status_event(task, TaskStatus.LLM_DIAGNOSIS, "正在生成诊断建议", 78, "diagnosis", callback)
            diagnosis_text = ""
            async for delta in generate_diagnosis(
                task.report_data or {},
                task.model_result or {},
                conversation_history or [],
                settings.qwen_api_key,
                settings.qwen_model,
            ):
                diagnosis_text += delta
                await self._emit(callback, {"event": "diagnosis", "delta": delta, "task_id": task.id})

            task.result = {
                "diagnosis": diagnosis_text,
                "report": task.report_data,
                "model_result": task.model_result,
                "viewer_url": task.source_url,
            }
            await self._set_status_event(task, TaskStatus.COMPLETED, "分析完成", 100, "diagnosis", callback)
            self._latest_task_id = task.id
            await self._emit(callback, {"event": "done", "task_id": task.id})
        except Exception as exc:
            task.status = TaskStatus.ERROR
            task.error = str(exc)
            task.message = "分析失败"
            task.updated_at = datetime.now(timezone.utc)
            await self._emit(callback, {"event": "error", "message": str(exc), "task_id": task.id})

    async def answer_followup(
        self,
        *,
        message: str,
        conversation_history: list[dict[str, Any]],
        callback: EventCallback | None = None,
    ) -> None:
        task = self.latest_context_task()
        if task is None:
            await self._emit(callback, {"event": "error", "message": "请先提交一个医学影像链接完成分析，再继续追问。"})
            return

        await self._emit(callback, {"event": "progress", "stage": "diagnosis", "percent": 80, "message": "正在结合历史上下文生成回答"})
        async for delta in generate_diagnosis(
            task.report_data or {},
            task.model_result or {},
            conversation_history,
            settings.qwen_api_key,
            settings.qwen_model,
            user_question=message,
        ):
            await self._emit(callback, {"event": "diagnosis", "delta": delta, "task_id": task.id})
        await self._emit(callback, {"event": "done", "task_id": task.id})

    async def _set_status_event(
        self,
        task: Task,
        status: TaskStatus,
        message: str,
        progress: int,
        stage: str,
        callback: EventCallback | None,
    ) -> None:
        task.status = status
        task.message = message
        task.progress = progress
        task.updated_at = datetime.now(timezone.utc)
        await self._emit(
            callback,
            {
                "event": "progress",
                "stage": stage,
                "percent": progress,
                "message": message,
                "task_id": task.id,
                "status": status.value,
            },
        )

    async def _run_gui_agent(self, task: Task, output_dir: Path, callback: EventCallback | None) -> None:
        loop = asyncio.get_running_loop()

        def on_progress(stage: str, progress: int, message: str) -> None:
            if stage == "capturing":
                percent = 15 + int(progress * 0.22)
                event_stage = "capture"
            else:
                percent = min(20, 5 + int(progress * 0.8))
                event_stage = "report"
            loop.create_task(
                self._emit(
                    callback,
                    {
                        "event": "progress",
                        "stage": event_stage,
                        "percent": min(percent, 35),
                        "message": str(message),
                        "task_id": task.id,
                    },
                )
            )

        adapter = MockViewerAdapter(base_url=settings.viewer_base_url)
        agent = GUIAgent(adapter)
        await agent.process_link(
            task.source_url,
            task.study_id,
            str(output_dir),
            settings.batch_dicom_dir,
            on_progress=on_progress,
        )
        await self._set_status_event(task, TaskStatus.CAPTURING_FRAMES, "报告和影像帧采集完成", 35, "capture", callback)

    async def _rebuild_dicom(
        self,
        backend_dir: Path,
        output_dir: Path,
        callback: EventCallback | None,
        task: Task,
    ) -> None:
        reconstructed = output_dir / "reconstructed_dicom"
        if reconstructed.exists() and list(reconstructed.glob("*.dcm")):
            await self._set_status_event(task, TaskStatus.RECONSTRUCTING, "已发现缓存 DICOM 重建结果", 55, "dicom", callback)
            return
        if not (output_dir / "dicom_info.json").exists():
            await self._set_status_event(task, TaskStatus.RECONSTRUCTING, "缺少 DICOM 元数据，跳过本次重建", 55, "dicom", callback)
            return

        process = await asyncio.create_subprocess_exec(
            sys.executable,
            str(backend_dir / "rebuild_dicom.py"),
            "--series-dir",
            str(output_dir),
            "--window-width",
            "2000",
            "--window-center",
            "0",
            cwd=str(backend_dir),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate()
        if process.returncode != 0:
            raise RuntimeError((stderr or stdout).decode("utf-8", errors="ignore") or "DICOM 重建失败")
        await self._set_status_event(task, TaskStatus.RECONSTRUCTING, "DICOM 序列重建完成", 55, "dicom", callback)


def _extract_study_id(link: str) -> str:
    match = re.search(r"/report/([^/?#]+)", link)
    if match:
        return match.group(1)
    match = re.search(r"[?&](?:study|studyId|study_id)=([^&#]+)", link)
    if match:
        return match.group(1)
    return uuid4().hex


def _read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def _format_report(report_data: dict[str, Any]) -> str:
    findings = report_data.get("findings") or report_data.get("finding") or report_data.get("检查所见") or ""
    diagnosis = report_data.get("diagnosis") or report_data.get("impression") or report_data.get("诊断意见") or ""
    parts = []
    if findings:
        parts.append(f"**检查所见**\n{findings}")
    if diagnosis:
        parts.append(f"**诊断意见**\n{diagnosis}")
    return "\n\n".join(parts) or json.dumps(report_data, ensure_ascii=False, indent=2)


def _count_frames(output_dir: Path) -> int:
    return len(list(output_dir.glob("frame_*.png")))


task_manager = TaskManager()
