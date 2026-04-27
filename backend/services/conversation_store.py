"""
对话 CRUD 操作。
"""
from __future__ import annotations

import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from collections.abc import AsyncIterator
from typing import Any
from uuid import uuid4

import aiosqlite

from database import DB_PATH


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _decode_json(value: str | None) -> Any:
    if not value:
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return None


def _row_to_message(row: aiosqlite.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "conversation_id": row["conversation_id"],
        "role": row["role"],
        "content": row["content"],
        "message_type": row["message_type"],
        "metadata": _decode_json(row["metadata_json"]) or {},
        "created_at": row["created_at"],
    }


def _truncate(value: str, limit: int = 500) -> str:
    return value if len(value) <= limit else f"{value[:limit]}..."


class ConversationStore:
    @asynccontextmanager
    async def _connect(self) -> AsyncIterator[aiosqlite.Connection]:
        db = await aiosqlite.connect(str(DB_PATH))
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA foreign_keys = ON")
        try:
            yield db
        finally:
            await db.close()

    async def create_conversation(self, user_id: str = "default", title: str = "新对话") -> dict[str, Any]:
        """创建新对话，返回 {id, title, created_at, updated_at}。"""
        conversation_id = str(uuid4())
        created_at = _now()
        async with self._connect() as db:
            await db.execute(
                """
                INSERT INTO conversations (id, user_id, title, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (conversation_id, user_id, title, created_at, created_at),
            )
            await db.commit()
        return {"id": conversation_id, "title": title, "created_at": created_at, "updated_at": created_at}

    async def list_conversations(self, user_id: str = "default", limit: int = 50) -> list[dict[str, Any]]:
        """
        按 updated_at 降序列出对话列表。
        返回: [{id, title, updated_at, message_count, last_message_preview}]
        """
        async with self._connect() as db:
            rows = await db.execute_fetchall(
                """
                SELECT
                    c.id,
                    c.title,
                    c.created_at,
                    c.updated_at,
                    COUNT(m.id) AS message_count,
                    (
                        SELECT m2.content
                        FROM messages m2
                        WHERE m2.conversation_id = c.id
                          AND m2.message_type != 'progress'
                        ORDER BY m2.created_at DESC
                        LIMIT 1
                    ) AS last_message_preview,
                    (
                        SELECT m3.created_at
                        FROM messages m3
                        WHERE m3.conversation_id = c.id
                        ORDER BY m3.created_at DESC
                        LIMIT 1
                    ) AS last_message_at
                FROM conversations c
                LEFT JOIN messages m ON m.conversation_id = c.id
                WHERE c.user_id = ?
                GROUP BY c.id
                ORDER BY c.updated_at DESC
                LIMIT ?
                """,
                (user_id, limit),
            )
        return [
            {
                "id": row["id"],
                "title": row["title"],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
                "message_count": row["message_count"],
                "last_message_preview": _truncate(row["last_message_preview"] or "", 80),
                "last_message_at": row["last_message_at"],
            }
            for row in rows
        ]

    async def get_conversation(self, conversation_id: str) -> dict[str, Any] | None:
        """获取单个对话详情 + 所有消息。"""
        async with self._connect() as db:
            cursor = await db.execute("SELECT * FROM conversations WHERE id = ?", (conversation_id,))
            conv = await cursor.fetchone()
            if conv is None:
                return None
            message_rows = await db.execute_fetchall(
                """
                SELECT * FROM messages
                WHERE conversation_id = ?
                ORDER BY created_at ASC
                """,
                (conversation_id,),
            )
        return {
            "id": conv["id"],
            "user_id": conv["user_id"],
            "title": conv["title"],
            "created_at": conv["created_at"],
            "updated_at": conv["updated_at"],
            "study_id": conv["study_id"],
            "report_json": conv["report_json"],
            "model_result_json": conv["model_result_json"],
            "report": _decode_json(conv["report_json"]) or {},
            "model_result": _decode_json(conv["model_result_json"]) or {},
            "messages": [_row_to_message(row) for row in message_rows],
        }

    async def add_message(
        self,
        conversation_id: str,
        role: str,
        content: str,
        message_type: str = "text",
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """添加一条消息，同时更新对话的 updated_at。"""
        message_id = str(uuid4())
        created_at = _now()
        metadata_json = json.dumps(metadata, ensure_ascii=False) if metadata else None
        async with self._connect() as db:
            await db.execute(
                """
                INSERT INTO messages (id, conversation_id, role, content, message_type, metadata_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (message_id, conversation_id, role, content, message_type, metadata_json, created_at),
            )
            await db.execute(
                "UPDATE conversations SET updated_at = ? WHERE id = ?",
                (created_at, conversation_id),
            )
            await db.commit()
        return {
            "id": message_id,
            "conversation_id": conversation_id,
            "role": role,
            "content": content,
            "message_type": message_type,
            "metadata": metadata or {},
            "created_at": created_at,
        }

    async def get_messages(self, conversation_id: str, limit: int | None = None) -> list[dict[str, Any]]:
        """获取对话的所有消息（按时间升序）。"""
        async with self._connect() as db:
            if limit is None:
                rows = await db.execute_fetchall(
                    "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
                    (conversation_id,),
                )
            else:
                rows = await db.execute_fetchall(
                    """
                    SELECT * FROM (
                        SELECT * FROM messages
                        WHERE conversation_id = ?
                        ORDER BY created_at DESC
                        LIMIT ?
                    ) ORDER BY created_at ASC
                    """,
                    (conversation_id, limit),
                )
        return [_row_to_message(row) for row in rows]

    async def get_recent_context(self, conversation_id: str, max_rounds: int = 5) -> list[dict[str, str]]:
        """
        获取最近 N 轮对话用于 LLM 上下文。

        上下文压缩规则:
        1. 只取最近 max_rounds 轮（1轮 = 1条 user + 1条 ai）
        2. 每条消息内容截断到 500 字
        3. findings 类型消息 → 压缩为 "AI模型检测到X个病灶" 摘要
        4. progress 类型消息 → 跳过（不送入 LLM）
        """
        messages = await self.get_messages(conversation_id)
        selected: list[dict[str, Any]] = []
        user_count = 0
        for message in reversed(messages):
            if message["message_type"] == "progress":
                continue
            if message["role"] not in {"user", "ai"}:
                continue
            if message["role"] == "user":
                if user_count >= max_rounds:
                    break
                user_count += 1
            selected.append(message)

        context: list[dict[str, str]] = []
        for message in reversed(selected):
            content = message["content"]
            if message["message_type"] == "findings":
                metadata = message.get("metadata") or {}
                findings = metadata.get("findings")
                if isinstance(findings, list):
                    count = len(findings)
                else:
                    data = metadata.get("data") or {}
                    count = sum(len(data.get(key, [])) for key in (
                        "lung_lesions",
                        "rib_lesions",
                        "bone_metastasis_lesions",
                        "lymphnode_lesions",
                    ))
                content = f"AI模型检测到{count}个病灶"
            context.append({"role": message["role"], "content": _truncate(content, 500)})
        return context

    async def update_conversation_title(self, conversation_id: str, title: str) -> None:
        """更新对话标题。"""
        title = title.strip()[:40] or "新对话"
        async with self._connect() as db:
            await db.execute(
                "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
                (title, _now(), conversation_id),
            )
            await db.commit()

    async def update_conversation_context(
        self,
        conversation_id: str,
        study_id: str | None = None,
        report_json: str | None = None,
        model_result_json: str | None = None,
    ) -> None:
        """存储对话关联的 study 数据（供后续追问时重建上下文）。"""
        fields: list[str] = []
        values: list[Any] = []
        if study_id is not None:
            fields.append("study_id = ?")
            values.append(study_id)
        if report_json is not None:
            fields.append("report_json = ?")
            values.append(report_json)
        if model_result_json is not None:
            fields.append("model_result_json = ?")
            values.append(model_result_json)
        if not fields:
            return
        fields.append("updated_at = ?")
        values.append(_now())
        values.append(conversation_id)
        async with self._connect() as db:
            await db.execute(
                f"UPDATE conversations SET {', '.join(fields)} WHERE id = ?",
                values,
            )
            await db.commit()

    async def delete_conversation(self, conversation_id: str) -> None:
        """删除对话及其所有消息。"""
        async with self._connect() as db:
            await db.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))
            await db.commit()


conversation_store = ConversationStore()
