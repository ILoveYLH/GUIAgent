from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from routers import auth, chat, model_callback


app = FastAPI(title="GUIAgent Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(model_callback.router, prefix="/api")
app.mount(
    "/api/frames",
    StaticFiles(directory=str(Path(__file__).resolve().parent / "output")),
    name="frames",
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
