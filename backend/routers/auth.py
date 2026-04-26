from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter

from config import INVITE_CODES, settings
from schemas.chat import VerifyInviteRequest, VerifyInviteResponse


router = APIRouter(tags=["auth"])


def create_token(code: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": "invite",
        "code": code,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.jwt_expire_minutes)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def verify_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])


@router.post("/verify-invite", response_model=VerifyInviteResponse)
async def verify_invite(payload: VerifyInviteRequest) -> VerifyInviteResponse:
    if payload.code not in INVITE_CODES:
        return VerifyInviteResponse(valid=False)
    return VerifyInviteResponse(valid=True, token=create_token(payload.code))
