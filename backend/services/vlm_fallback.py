"""
Qwen-VL visual fallback.

Only called when DOM selectors fail. It sends a screenshot plus a focused prompt
to Qwen-VL and expects a JSON or text answer back.
"""
from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Any

from dashscope import MultiModalConversation

logger = logging.getLogger(__name__)


class VLMFallback:
    def __init__(self, api_key: str, model: str = "qwen-vl-max"):
        self.api_key = api_key
        self.model = model

    async def _ask(self, screenshot_path: str, prompt: str) -> str:
        """Send screenshot + prompt to Qwen-VL and return the text answer."""
        if not self.api_key:
            raise RuntimeError("Qwen API key is empty")

        image_path = Path(screenshot_path).expanduser().resolve()
        if not image_path.exists():
            raise FileNotFoundError(f"Screenshot not found: {image_path}")

        response = MultiModalConversation.call(
            api_key=self.api_key,
            model=self.model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"image": f"file://{image_path}"},
                        {"text": prompt},
                    ],
                }
            ],
        )
        content = response.output.choices[0].message.content
        return self._content_to_text(content)

    @staticmethod
    def _content_to_text(content: Any) -> str:
        if isinstance(content, str):
            return content.strip()
        if isinstance(content, list):
            parts: list[str] = []
            for item in content:
                if isinstance(item, dict):
                    text = item.get("text")
                    if text:
                        parts.append(str(text))
                elif item is not None:
                    parts.append(str(item))
            return "\n".join(parts).strip()
        return str(content).strip()

    @staticmethod
    def _loads_json(text: str) -> dict:
        text = text.strip()
        fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.S)
        if fenced:
            text = fenced.group(1)
        elif "{" in text and "}" in text:
            text = text[text.find("{") : text.rfind("}") + 1]
        return json.loads(text)

    async def extract_report(self, screenshot_path: str) -> dict:
        """Extract structured data from a report page screenshot."""
        prompt = """这是一个医学影像报告页面的截图。请提取以下信息，以 JSON 格式返回：
{
    "patient_name": "患者姓名",
    "patient_info": "性别/年龄等",
    "findings": "检查所见的完整文本",
    "impression": "检查提示/诊断意见的完整文本",
    "hospital": "医院名称",
    "exam_title": "检查项目名称"
}
只返回 JSON，不要其他文字。"""
        result = await self._ask(screenshot_path, prompt)
        return self._loads_json(result)

    async def find_button(self, screenshot_path: str, description: str) -> dict:
        """Find a button or link position in the screenshot."""
        prompt = f"""这是一个医学影像系统的截图。
请找到文字为"{description}"的按钮或链接，并返回它的可点击区域中心点。
不要返回按钮左上角、文字起点或图标位置。
返回 JSON：{{"found": true/false, "x": 中心点像素x坐标, "y": 中心点像素y坐标}}
坐标是相对于图片左上角的。只返回 JSON。"""
        result = await self._ask(screenshot_path, prompt)
        return self._loads_json(result)

    async def read_frame_info(self, screenshot_path: str) -> dict:
        """Read frame information from a viewer screenshot."""
        prompt = """这是一个医学影像查看器的截图。
请找到当前帧号和总帧数信息（通常显示为 "Ins Num:x/y" 或 "层 x / y" 等格式）。
返回 JSON：{"current": 当前帧号, "total": 总帧数}
只返回 JSON。"""
        result = await self._ask(screenshot_path, prompt)
        return self._loads_json(result)

    async def read_window_values(self, screenshot_path: str) -> dict:
        """Read WW/WL values from a viewer screenshot."""
        prompt = """这是一个医学影像查看器的截图。
请找到当前的窗宽(WW)和窗位(WL)数值（通常显示为 "WL:xxx" "WW:xxx"）。
返回 JSON：{"wl": 窗位数值, "ww": 窗宽数值}
只返回 JSON。"""
        result = await self._ask(screenshot_path, prompt)
        return self._loads_json(result)
