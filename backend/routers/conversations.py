from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.conversation_store import conversation_store


router = APIRouter(tags=["conversations"])


class UpdateTitleRequest(BaseModel):
    title: str = Field(min_length=1, max_length=40)


@router.get("/conversations")
async def list_conversations() -> list[dict]:
    """返回对话列表（最新的排前面）。"""
    return await conversation_store.list_conversations()


@router.post("/conversations")
async def create_conversation() -> dict:
    """创建新对话，返回 conversation_id。"""
    return await conversation_store.create_conversation()


@router.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str) -> dict:
    """获取对话详情 + 全部消息。"""
    conversation = await conversation_store.get_conversation(conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str) -> dict[str, bool]:
    """删除对话。"""
    await conversation_store.delete_conversation(conversation_id)
    return {"ok": True}


@router.put("/conversations/{conversation_id}/title")
async def update_title(conversation_id: str, payload: UpdateTitleRequest) -> dict[str, bool]:
    """手动修改对话标题。"""
    conversation = await conversation_store.get_conversation(conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await conversation_store.update_conversation_title(conversation_id, payload.title)
    return {"ok": True}
