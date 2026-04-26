"""Run GUI Agent against one local medical-viewer report link.

Usage:
    python run_agent.py --link "http://localhost:3001/report/xxx"
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from adapters.mock_viewer import MockViewerAdapter
from config import settings
from services.gui_agent import GUIAgent
from services.vlm_fallback import VLMFallback

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger(__name__)


def extract_study_id(link: str) -> str:
    parsed = urlparse(link)
    parts = [p for p in parsed.path.split("/") if p]
    if "report" in parts:
        idx = parts.index("report")
        if idx + 1 < len(parts):
            return parts[idx + 1]
    qs = parse_qs(parsed.query)
    for key in ("study", "studyId", "study_id"):
        if qs.get(key):
            return qs[key][0]
    raise ValueError(f"Cannot extract studyId from link: {link}")


def _progress(stage: str, progress: int, message: str) -> None:
    logger.info("[%s] %d%% %s", stage, progress, message)


async def _run(args: argparse.Namespace) -> dict:
    study_id = args.study_id or extract_study_id(args.link)
    backend_dir = Path(__file__).resolve().parent
    output_dir = Path(args.output_dir) if args.output_dir else backend_dir / "output" / study_id
    batch_dicom_dir = args.batch_dicom_dir or settings.batch_dicom_dir

    api_key = os.environ.get("QWEN_API_KEY") or settings.qwen_api_key
    vlm = VLMFallback(api_key=api_key, model=args.qwen_model) if api_key else None
    if not vlm:
        logger.info("Qwen API key not configured; VLM fallback disabled")

    adapter = MockViewerAdapter(base_url=settings.viewer_base_url, vlm=vlm)
    agent = GUIAgent(adapter)
    result = await agent.process_link(
        args.link,
        study_id,
        str(output_dir),
        batch_dicom_dir,
        on_progress=_progress,
    )

    cmd = [
        sys.executable,
        str(backend_dir / "rebuild_dicom.py"),
        "--series-dir",
        str(output_dir),
        "--window-width",
        "2000",
        "--window-center",
        "0",
    ]
    logger.info("Running rebuild: %s", " ".join(cmd))
    subprocess.run(cmd, check=True)
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Run GUI Agent on a medical-viewer report link")
    parser.add_argument("--link", required=True, help="Report URL, e.g. http://localhost:3001/report/<studyId>")
    parser.add_argument("--study-id", default="", help="Override studyId parsed from link")
    parser.add_argument("--output-dir", default="", help="Output directory, defaults to backend/output/<studyId>")
    parser.add_argument("--batch-dicom-dir", default="", help="Source batch_dicom_data directory")
    parser.add_argument("--qwen-model", default="qwen-vl-max", help="Qwen-VL model name")
    args = parser.parse_args()

    result = asyncio.run(_run(args))
    logger.info("Done: %s", result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
