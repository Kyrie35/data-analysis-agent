from typing import Any, Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from services.agent import generate_chat_reply

router = APIRouter(prefix="/api", tags=["chat"])


class PreferencePayload(BaseModel):
    title: str = ""
    content: str = ""


class ChatHistoryItem(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str
    analysis_id: str
    context: dict[str, Any] = Field(default_factory=dict)
    history: list[ChatHistoryItem] = Field(default_factory=list)
    use_preferences: bool = False
    preferences: list[PreferencePayload] = Field(default_factory=list)


@router.post("/chat")
async def chat(request: ChatRequest):
    return generate_chat_reply(
        message=request.message,
        analysis_id=request.analysis_id,
        context=request.context,
        history=[item.model_dump() for item in request.history],
        use_preferences=request.use_preferences,
        preferences=[item.model_dump() for item in request.preferences],
    )
