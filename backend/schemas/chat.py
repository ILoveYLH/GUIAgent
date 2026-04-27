from __future__ import annotations

from pydantic import BaseModel, Field


class VerifyInviteRequest(BaseModel):
    code: str = Field(min_length=1)


class VerifyInviteResponse(BaseModel):
    valid: bool
    token: str | None = None


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    token: str = Field(min_length=1)
    conversation_id: str | None = None


class ChatEvent(BaseModel):
    task_id: str
    status: str
    message: str
    progress: int
    data: dict | None = None
