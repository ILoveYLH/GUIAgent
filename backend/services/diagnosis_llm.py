from __future__ import annotations

import asyncio
import json
import queue
import threading
from collections.abc import AsyncGenerator
from typing import Any


SYSTEM_PROMPT = """你是一位经验丰富的放射科主治医师。你将收到两份信息：
1.「原始报告」— 来自医学影像系统的检查所见和诊断意见
2.「AI 模型检测结果」— 一扫多查 AI 系统对同一组影像的结构化分析，包含具体病灶的位置、大小、类型和置信度
请完成以下任务：
- 逐一分析每个 AI 检测到的病灶，结合原始报告判断其临床意义
- 如果 AI 结果与原始报告有不一致（漏检或多检），明确指出并分析可能原因
- 给出每个病灶的处置建议（随访/进一步检查/活检等）
- 最后给出整体评估和下一步建议
- 使用 markdown 格式输出，每个病灶用 ### 标题
注意：你的回答仅供临床参考，不能作为最终诊断依据。"""


def _short_text(value: Any, limit: int = 500) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        text = value
    else:
        text = json.dumps(value, ensure_ascii=False)
    return text[:limit]


def _compress_report(report_data: dict) -> str:
    if not report_data:
        return "无原始报告数据。"
    parts = []
    for key in ("findings", "finding", "检查所见", "diagnosis", "impression", "诊断意见"):
        if key in report_data and report_data[key]:
            parts.append(f"{key}: {_short_text(report_data[key], 260)}")
    if not parts:
        for key, value in report_data.items():
            if isinstance(value, (str, int, float)):
                parts.append(f"{key}: {value}")
    return _short_text("\n".join(parts) or report_data, 500)


def _probability(item: dict) -> str:
    value = item.get("Probality", item.get("Probability", ""))
    if isinstance(value, (int, float)):
        return f"{value:.2f}"
    return str(value)


def _compress_model_result(model_result: dict) -> str:
    if not model_result:
        return "无 AI 模型结构化结果。"

    lines: list[str] = []
    for item in model_result.get("lung_lesions", []):
        size = item.get("size") or [item.get("Width"), item.get("Height")]
        size_text = "x".join(str(round(v, 1)) for v in size if isinstance(v, (int, float)))
        lines.append(
            f"肺结节|{item.get('location', '未知位置')}|{size_text}mm|{_probability(item)}|{item.get('dangerStr', '')}|{item.get('type', '')}"
        )
    for item in model_result.get("rib_lesions", []):
        lines.append(f"肋骨骨折|第{item.get('RibLabel', '?')}肋|{item.get('Width', '')}mm|{_probability(item)}|")
    for item in model_result.get("bone_metastasis_lesions", []):
        lines.append(f"骨转移可疑灶|LocationFirst={item.get('LocationFirst')}|{item.get('Width', '')}mm|{_probability(item)}|")
    for item in model_result.get("lymphnode_lesions", []):
        lines.append(
            f"淋巴结|Slice={item.get('Slice', '?')}|{item.get('Long_axis_mm', '')}x{item.get('Short_axis_mm', '')}mm|{_probability(item)}|"
        )
    return "\n".join(lines) or "AI 模型未检出明确病灶。"


def _recent_history(conversation_history: list[dict]) -> list[dict]:
    cleaned = []
    for item in conversation_history[-10:]:
        role = item.get("role")
        content = _short_text(item.get("content", ""), 800)
        if role in {"user", "assistant", "ai"} and content:
            cleaned.append({"role": "assistant" if role == "ai" else role, "content": content})
    return cleaned[-10:]


def _extract_delta(chunk: Any) -> str:
    output = getattr(chunk, "output", None)
    if output is None and isinstance(chunk, dict):
        output = chunk.get("output")
    if isinstance(output, dict):
        choices = output.get("choices") or []
        if choices:
            message = choices[0].get("message") or {}
            content = message.get("content")
            if isinstance(content, str):
                return content
            if isinstance(content, list):
                return "".join(part.get("text", "") for part in content if isinstance(part, dict))
        text = output.get("text")
        if isinstance(text, str):
            return text
    return ""


async def _fallback_diagnosis(report_data: dict, model_result: dict) -> AsyncGenerator[str, None]:
    summary = model_result.get("report", {}).get("summary", "模型结果已生成")
    detail = model_result.get("report", {}).get("detail", "")
    lung_count = len(model_result.get("lung_lesions", []))
    text = (
        "## AI 诊断建议\n\n"
        f"### 总体评估\n{summary}。原始报告提示：{_compress_report(report_data)[:180]}\n\n"
        f"### 肺部病灶\n本次 AI 共检出 {lung_count} 个肺部结节。{detail}\n\n"
        "### 下一步建议\n建议结合薄层 CT、既往影像变化和临床危险因素评估；高危或增长性病灶可考虑增强 CT、PET-CT 或专科会诊。\n\n"
        "> 以上内容为本地降级生成，Qwen API 未配置或调用不可用，不能作为最终诊断依据。"
    )
    for char in text:
        await asyncio.sleep(0.004)
        yield char


async def generate_diagnosis(
    report_data: dict,
    model_result: dict,
    conversation_history: list[dict],
    api_key: str,
    model: str = "qwen-plus",
) -> AsyncGenerator[str, None]:
    """
    流式调用 dashscope Generation API。
    """
    if not api_key:
        async for delta in _fallback_diagnosis(report_data, model_result):
            yield delta
        return

    user_context = (
        f"「原始报告」\n{_compress_report(report_data)}\n\n"
        f"「AI 模型检测结果」\n{_compress_model_result(model_result)}"
    )
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_context},
        *_recent_history(conversation_history),
    ]

    try:
        async for delta in _stream_dashscope(messages, api_key, model):
            yield delta
    except Exception:
        async for delta in _fallback_diagnosis(report_data, model_result):
            yield delta


async def _stream_dashscope(messages: list[dict], api_key: str, model: str) -> AsyncGenerator[str, None]:
    chunks: queue.Queue[str | Exception | None] = queue.Queue()

    def worker() -> None:
        try:
            import dashscope

            dashscope.api_key = api_key
            responses = dashscope.Generation.call(
                model=model,
                messages=messages,
                result_format="message",
                stream=True,
                incremental_output=True,
                timeout=20,
            )
            for chunk in responses:
                delta = _extract_delta(chunk)
                if delta:
                    chunks.put(delta)
        except Exception as exc:
            chunks.put(exc)
        finally:
            chunks.put(None)

    threading.Thread(target=worker, daemon=True).start()

    first_item = await asyncio.to_thread(_queue_get, chunks, 8)
    if first_item is _TIMEOUT:
        raise TimeoutError("DashScope first token timeout")
    if isinstance(first_item, Exception):
        raise first_item
    if first_item is None:
        return
    yield first_item

    while True:
        item = await asyncio.to_thread(_queue_get, chunks, 45)
        if item is _TIMEOUT:
            raise TimeoutError("DashScope stream timeout")
        if isinstance(item, Exception):
            raise item
        if item is None:
            break
        yield item


_TIMEOUT = object()


def _queue_get(chunks: queue.Queue, timeout: int) -> str | Exception | None | object:
    try:
        return chunks.get(timeout=timeout)
    except queue.Empty:
        return _TIMEOUT
