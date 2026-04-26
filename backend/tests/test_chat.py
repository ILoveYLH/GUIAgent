from __future__ import annotations

import sys
from pathlib import Path

from fastapi.testclient import TestClient


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from main import app  # noqa: E402
from config import settings  # noqa: E402


client = TestClient(app)


def test_verify_invite_accepts_valid_code() -> None:
    response = client.post("/api/verify-invite", json={"code": "test-001"})

    assert response.status_code == 200
    body = response.json()
    assert body["valid"] is True
    assert isinstance(body["token"], str)
    assert body["token"]


def test_verify_invite_rejects_invalid_code() -> None:
    response = client.post("/api/verify-invite", json={"code": "wrong-code"})

    assert response.status_code == 200
    assert response.json() == {"valid": False, "token": None}


def test_chat_streams_mock_progress_and_result() -> None:
    settings.qwen_api_key = ""
    token = client.post("/api/verify-invite", json={"code": "test-001"}).json()["token"]
    study_id = "1.3.6.1.4.1.14519.5.2.1.4320.7007.226952804465088850041383585906"

    with client.stream(
        "POST",
        "/api/chat",
        json={"message": f"请分析 http://localhost:3001/report/{study_id}", "token": token},
    ) as response:
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        stream_text = "".join(response.iter_text())

    assert "event: progress" in stream_text
    assert "event: report" in stream_text
    assert "event: findings" in stream_text
    assert "event: diagnosis" in stream_text
    assert "event: done" in stream_text
    assert "lung_lesions" in stream_text


def test_model_callback_accepts_documented_payload() -> None:
    response = client.post(
        "/api/yisao-duocha/callback",
        json={
            "task_id": "task_test_callback",
            "case_id": "case_001",
            "study_uid": "study_test_callback",
            "series_uid": "series_001",
            "status": "success",
            "message": "calculation completed",
            "report": {
                "title": "一扫多查分析报告",
                "summary": "双肺可见小结节。",
                "detail": "右肺上叶前段见实性结节，约7x5mm。",
            },
            "lung_lesions": [
                {
                    "findingUid": "lesion_001",
                    "dangerStr": "低危",
                    "boundingBox": [{"x": 153, "y": 220}, {"x": 204, "y": 276}],
                    "sliceIndex": 10,
                    "size": [24, 21],
                    "originalSize": [24.1, 20.6],
                    "hu": 82.1,
                    "volume": 4450.0,
                    "type": "实性",
                    "location": "右肺上叶前段",
                    "symbol": "分叶、胸膜凹陷",
                    "filePath": "/data/FileServer/test.dcm",
                    "likelihoodLevel": 1,
                    "Probality": 0.65,
                    "Width": 21.2,
                    "Height": 21.7,
                    "Depth": 19.4,
                    "CenterPointX": -42.4,
                    "CenterPointY": -194.0,
                    "CenterPointZ": 1405.4,
                }
            ],
            "rib_lesions": [],
            "bone_metastasis_lesions": [],
            "lymphnode_lesions": [],
            "callback_time": "2026-04-22T16:30:00",
        },
    )

    assert response.status_code == 200
    assert response.json() == {"code": 0, "message": "success", "task_id": "task_test_callback"}


def test_chat_rejects_invalid_token() -> None:
    response = client.post(
        "/api/chat",
        json={"message": "http://localhost:3001/report/mock-study", "token": "bad-token"},
    )

    assert response.status_code == 401
