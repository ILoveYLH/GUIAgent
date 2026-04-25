"""
全局配置 — 从环境变量读取，支持 .env 文件。
"""
from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """应用配置，所有字段均可通过同名环境变量覆盖。"""

    # ---------- 邀请码 ----------
    invite_codes: list[str] = ["test-001", "test-002", "demo-2026"]

    # ---------- JWT ----------
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24  # 24h

    # ---------- Viewer ----------
    viewer_base_url: str = "http://localhost:3001"

    # ---------- Adapter ----------
    # "mock"  → 使用 medical-viewer (localhost:3001)
    # "real"  → 使用真实临床系统 (后续实现)
    adapter_type: str = "mock"

    # ---------- DICOM ----------
    # True  → 测试阶段直接使用 batch_dicom_data/ 原始 DICOM
    # False → 从 Agent 截图重建 DICOM
    use_direct_dicom: bool = True
    batch_dicom_dir: str = "../medical-viewer/batch_dicom_data"

    # ---------- 一扫多查模型 ----------
    scan_model_url: str = ""  # 课题组模型 API 地址
    scan_model_timeout: int = 120  # 秒

    # ---------- Qwen LLM ----------
    qwen_api_key: str = ""
    qwen_model: str = "qwen-plus"

    # ---------- Server ----------
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = True

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
