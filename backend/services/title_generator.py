from __future__ import annotations

import asyncio
from typing import Any


def _fallback_title(first_message: str) -> str:
    compact = "".join(first_message.split())
    return (compact[:10] or "新对话").strip()


def _extract_content(response: Any) -> str:
    output = getattr(response, "output", None)
    if output is None and isinstance(response, dict):
        output = response.get("output")
    if isinstance(output, dict):
        choices = output.get("choices") or []
        if choices:
            message = choices[0].get("message") or {}
            content = message.get("content")
            if isinstance(content, str):
                return content
        text = output.get("text")
        if isinstance(text, str):
            return text
    return ""


async def generate_title(first_message: str, api_key: str, model: str = "qwen-plus") -> str:
    """
    用 Qwen 根据第一条消息自动生成对话标题（10字以内）。

    如果 API 调用失败，fallback 到截取消息前10个字。
    """
    fallback = _fallback_title(first_message)
    if not api_key:
        return fallback

    prompt = f"请为以下医学影像分析对话生成一个简短标题（10字以内，中文）：{first_message}"

    def call_dashscope() -> str:
        import dashscope

        dashscope.api_key = api_key
        response = dashscope.Generation.call(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            result_format="message",
            timeout=8,
        )
        return _extract_content(response).strip().strip("《》\"'")

    try:
        title = await asyncio.to_thread(call_dashscope)
    except Exception:
        return fallback
    return (title[:10] or fallback).strip()
