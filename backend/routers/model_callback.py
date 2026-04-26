from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter

from schemas.model import YisaoCallbackRequest
from services.task_manager import task_manager


router = APIRouter(tags=["model-callback"])


@router.post("/yisao-duocha/callback")
async def yisao_callback(payload: YisaoCallbackRequest) -> dict:
    task = task_manager.get_task(payload.task_id)
    study_id = (
        task.study_id
        if task and task.study_id
        else payload.study_uid or payload.case_id or payload.task_id
    )

    backend_dir = Path(__file__).resolve().parents[1]
    output_dir = backend_dir / "output" / study_id
    output_dir.mkdir(parents=True, exist_ok=True)

    raw_data = payload.model_dump(mode="json")
    (output_dir / "model_result.json").write_text(
        json.dumps(raw_data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    await task_manager.set_model_result(payload.task_id, raw_data)

    return {"code": 0, "message": "success", "task_id": payload.task_id}
