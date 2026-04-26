"""GUI Agent orchestration for medical-viewer."""
from __future__ import annotations

import json
import logging
import os
from dataclasses import asdict

from playwright.async_api import async_playwright

from adapters.mock_viewer import MockViewerAdapter
from services.dicom_metadata import read_first_dcm_metadata

logger = logging.getLogger(__name__)


class GUIAgent:
    def __init__(self, adapter: MockViewerAdapter):
        self.adapter = adapter

    async def process_link(
        self,
        report_url: str,
        study_id: str,
        output_dir: str,
        batch_dicom_dir: str,
        on_progress=None,
    ) -> dict:
        os.makedirs(output_dir, exist_ok=True)
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=False)
            page = await browser.new_page(viewport={"width": 1920, "height": 1080})
            try:
                if on_progress:
                    on_progress("opening_report", 3, report_url)
                await page.goto(report_url, wait_until="networkidle")

                if on_progress:
                    on_progress("extracting_report", 8, "DOM first")
                report = await self.adapter.extract_report(page)
                with open(os.path.join(output_dir, "report.json"), "w", encoding="utf-8") as f:
                    json.dump(asdict(report), f, indent=2, ensure_ascii=False)

                if on_progress:
                    on_progress("opening_viewer", 10, "查看影像")
                await self.adapter.switch_to_viewer(page)
                await self.adapter.wait_for_viewer_ready(page)

                await self.adapter.set_window(page, ww=2000, wl=0)
                total = await self.adapter.get_total_frames(page)
                for i in range(total):
                    await self.adapter.goto_frame(page, i)
                    await self.adapter.capture_frame(page, output_dir, i)
                    if on_progress:
                        on_progress("capturing", 10 + int(80 * (i + 1) / total), f"{i + 1}/{total}")

                dicom_info = read_first_dcm_metadata(batch_dicom_dir, study_id, 2000.0, 0.0)
                with open(os.path.join(output_dir, "dicom_info.json"), "w", encoding="utf-8") as f:
                    json.dump(dicom_info, f, indent=2, ensure_ascii=False)

                return {"status": "success", "frames": total, "output_dir": output_dir}
            finally:
                await browser.close()
