import json
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from services.analyze import analyze_upload

router = APIRouter(prefix="/api", tags=["analyze"])


def _parse_preferences_field(raw: str | None) -> list[dict[str, Any]] | None:
    if raw is None or not raw.strip():
        return None
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="preferences 不是合法 JSON") from exc

    if not isinstance(data, list):
        raise HTTPException(status_code=400, detail="preferences 必须是数组")
    return data


def _parse_use_preferences(raw: str | None) -> bool:
    if raw is None:
        return False
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@router.post("/analyze")
async def analyze_file(
    file: UploadFile = File(...),
    use_preferences: str | None = Form(default=None),
    preferences: str | None = Form(default=None),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="未收到文件名")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="文件为空")

    use_prefs = _parse_use_preferences(use_preferences)
    prefs = _parse_preferences_field(preferences)

    try:
        result = analyze_upload(
            file.filename,
            content,
            use_preferences=use_prefs,
            preferences=prefs,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"文件解析失败: {exc}") from exc

    return result
