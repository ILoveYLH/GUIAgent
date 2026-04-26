"""Adapter for the local medical-viewer app."""
from __future__ import annotations

import logging
import os
from pathlib import Path

from PIL import Image

from adapters.base import FrameMetadata, MedicalReport, ViewerAdapter
from services.vlm_fallback import VLMFallback

logger = logging.getLogger(__name__)


class MockViewerAdapter(ViewerAdapter):
    def __init__(self, base_url: str = "http://localhost:3001", vlm: VLMFallback | None = None):
        self.base_url = base_url
        self.vlm = vlm

    async def extract_report(self, page) -> MedicalReport:
        """Extract report data, using DOM first and VLM only as fallback."""
        try:
            findings_h = page.locator('h4:has-text("检查所见")')
            findings = ""
            if await findings_h.count() > 0:
                findings = await findings_h.first.locator("+ div").text_content() or ""

            impression_h = page.locator('h4:has-text("检查提示")')
            impression = ""
            if await impression_h.count() > 0:
                impression = await impression_h.first.locator("+ div").text_content() or ""

            patient = ""
            h1 = page.locator("h1").first
            if await h1.count() > 0:
                patient = await h1.text_content() or ""

            if findings or impression:
                return MedicalReport(
                    patient_name=patient.strip(),
                    findings=findings.strip(),
                    diagnosis=impression.strip(),
                )
        except Exception as e:
            logger.warning("DOM 提取报告失败: %s", e)

        if self.vlm:
            logger.info("使用 VLM 兜底提取报告")
            tmp = "/tmp/report_screenshot.png"
            await page.screenshot(path=tmp, full_page=True)
            data = await self.vlm.extract_report(tmp)
            return MedicalReport(
                patient_name=data.get("patient_name", ""),
                findings=data.get("findings", ""),
                diagnosis=data.get("impression", ""),
                institution=data.get("hospital", ""),
                raw=data,
            )
        raise RuntimeError("报告提取失败，且 VLM 未启用")

    async def switch_to_viewer(self, page) -> None:
        """Click the viewer link, using DOM first and VLM coordinates as fallback."""
        try:
            link = page.locator('a:has-text("查看影像")')
            if await link.count() > 0:
                await link.first.click()
                await page.wait_for_url("**/hd**", timeout=10000)
                return
        except Exception as e:
            logger.warning("DOM 点击查看影像失败: %s", e)

        if self.vlm:
            logger.info("使用 VLM 兜底定位查看影像按钮")
            tmp = "/tmp/find_btn.png"
            await page.screenshot(path=tmp, full_page=True)
            pos = await self.vlm.find_button(tmp, "查看影像")
            if pos.get("found"):
                await page.mouse.click(pos["x"], pos["y"])
                await page.wait_for_url("**/hd**", timeout=10000)
                return
        raise RuntimeError("无法找到查看影像按钮")

    async def wait_for_viewer_ready(self, page) -> None:
        """Wait until Cornerstone has rendered a visible canvas and overlay."""
        await page.wait_for_selector("canvas", state="visible", timeout=30000)
        try:
            await page.wait_for_function(
                r"""() => document.body.innerText.match(/Ins Num:\d+\/\d+/)""",
                timeout=15000,
            )
        except Exception:
            if self.vlm:
                tmp = "/tmp/wait_ready.png"
                await page.screenshot(path=tmp)
                info = await self.vlm.read_frame_info(tmp)
                if info.get("total", 0) > 0:
                    return
            await page.wait_for_timeout(3000)

    async def set_window(self, page, ww: int = 2000, wl: int = 0) -> None:
        """Set WW/WL through the viewer's DOM controls."""
        try:
            await page.locator('[data-tool="quick-window"]').click(timeout=5000)
            inputs = page.locator('form input[type="number"]')
            await inputs.nth(0).fill(str(ww))
            await inputs.nth(1).fill(str(wl))
            await page.locator('form button[type="submit"]').click()
            await page.wait_for_timeout(500)
        except Exception as e:
            logger.warning("DOM 设置窗宽窗位失败: %s", e)
            raise

        try:
            ok = await page.evaluate(
                f"""
                () => {{
                    const t = document.body.innerText;
                    const m = t.match(/WW:([-\\d]+)/);
                    return m && Math.abs(parseInt(m[1]) - {ww}) < 10;
                }}
                """
            )
            if ok:
                return
        except Exception:
            pass

        if self.vlm:
            tmp = "/tmp/verify_ww.png"
            await page.screenshot(path=tmp)
            vals = await self.vlm.read_window_values(tmp)
            if abs(vals.get("ww", 0) - ww) < 10:
                return
            logger.warning("VLM 读到的窗值: WW=%s, WL=%s", vals.get("ww"), vals.get("wl"))
        raise RuntimeError(f"窗宽窗位设置验证失败，目标 WW={ww}, WL={wl}")

    async def get_total_frames(self, page) -> int:
        """Read total frame count, using DOM first and VLM as fallback."""
        try:
            result = await page.evaluate(
                r"""
                () => {
                    const t = document.body.innerText;
                    const m = t.match(/Ins Num:(\d+)\/(\d+)/);
                    return m ? parseInt(m[2]) : null;
                }
                """
            )
            if result:
                return int(result)
        except Exception:
            pass
        if self.vlm:
            tmp = "/tmp/frame_info.png"
            await page.screenshot(path=tmp)
            info = await self.vlm.read_frame_info(tmp)
            return int(info.get("total", 1))
        return 1

    async def goto_frame(self, page, index: int) -> None:
        """Jump to a 0-indexed frame using the active StackScroll wheel binding."""
        current = await self._get_current_frame_index(page)
        diff = index - current
        if diff == 0:
            return

        canvas = page.locator("canvas").first
        box = await canvas.bounding_box()
        if not box:
            raise RuntimeError("无法定位 canvas 用于翻帧")
        await page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)

        step = 1 if diff > 0 else -1
        for _ in range(abs(diff)):
            await page.mouse.wheel(0, 120 * step)
            await page.wait_for_timeout(40)

        await page.wait_for_function(
            f"""
            () => {{
                const m = document.body.innerText.match(/Ins Num:(\\d+)\\/(\\d+)/);
                return m && parseInt(m[1]) === {index + 1};
            }}
            """,
            timeout=5000,
        )

    async def _get_current_frame_index(self, page) -> int:
        result = await page.evaluate(
            r"""
            () => {
                const m = document.body.innerText.match(/Ins Num:(\d+)\/(\d+)/);
                return m ? parseInt(m[1]) - 1 : 0;
            }
            """
        )
        return int(result or 0)

    async def get_frame_metadata(self, page) -> FrameMetadata:
        """Read lightweight frame metadata from the visible overlay."""
        data = await page.evaluate(
            r"""
            () => {
                const t = document.body.innerText;
                const ins = t.match(/Ins Num:(\d+)\/(\d+)/);
                const wl = t.match(/WL:([-\d]+)/);
                const ww = t.match(/WW:([-\d]+)/);
                const rowsCols = t.match(/Rows:(\d+)\s+Cols:(\d+)/);
                return {
                    index: ins ? parseInt(ins[1]) : 0,
                    total: ins ? parseInt(ins[2]) : 1,
                    wl: wl ? parseFloat(wl[1]) : 0,
                    ww: ww ? parseFloat(ww[1]) : 2000,
                    rows: rowsCols ? parseInt(rowsCols[1]) : 512,
                    columns: rowsCols ? parseInt(rowsCols[2]) : 512,
                };
            }
            """
        )
        return FrameMetadata(
            index=max(0, int(data["index"]) - 1),
            total_frames=int(data["total"]),
            window_center=float(data["wl"]),
            window_width=float(data["ww"]),
            rows=int(data["rows"]),
            columns=int(data["columns"]),
        )

    async def capture_frame(self, page, output_dir: str, index: int) -> str:
        """Screenshot the first visible canvas and keep only its center square."""
        os.makedirs(output_dir, exist_ok=True)
        canvas = page.locator("canvas").first
        path = Path(output_dir).resolve() / f"frame_{index:04d}.png"
        await canvas.screenshot(path=str(path))
        self._crop_center_square(path)
        return str(path)

    @staticmethod
    def _crop_center_square(path: Path) -> None:
        with Image.open(path) as img:
            width, height = img.size
            side = min(width, height)
            left = (width - side) // 2
            top = (height - side) // 2
            cropped = img.crop((left, top, left + side, top + side))
            cropped.save(path)
