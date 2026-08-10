import json
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from services.analyze import analyze_upload
from services.chart_types import normalize_chart_types
from services.compare import compare_uploads
from services.parser import inspect_upload

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


def _parse_chart_types(raw: str | None) -> list[str]:
    if raw is None or not raw.strip():
        return normalize_chart_types(None)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="chart_types 不是合法 JSON") from exc
    return normalize_chart_types(data)


def _clean_sheet_name(raw: str | None) -> str | None:
    if raw is None:
        return None
    value = raw.strip()
    return value or None


@router.post("/inspect")
async def inspect_file(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="未收到文件名")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="文件为空")
    try:
        return inspect_upload(file.filename, content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"文件检查失败: {exc}") from exc


@router.post("/analyze")
async def analyze_file(
    file: UploadFile = File(...),
    use_preferences: str | None = Form(default=None),
    preferences: str | None = Form(default=None),
    chart_types: str | None = Form(default=None),
    sheet_name: str | None = Form(default=None),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="未收到文件名")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="文件为空")

    use_prefs = _parse_use_preferences(use_preferences)
    prefs = _parse_preferences_field(preferences)
    allowed_charts = _parse_chart_types(chart_types)
    sheet = _clean_sheet_name(sheet_name)

    try:
        result = analyze_upload(
            file.filename,
            content,
            use_preferences=use_prefs,
            preferences=prefs,
            chart_types=allowed_charts,
            sheet_name=sheet,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"文件解析失败: {exc}") from exc

    return result


@router.post("/compare")
async def compare_files(
    file_a: UploadFile = File(...),
    file_b: UploadFile = File(...),
    sheet_a: str | None = Form(default=None),
    sheet_b: str | None = Form(default=None),
    use_preferences: str | None = Form(default=None),
    preferences: str | None = Form(default=None),
    chart_types: str | None = Form(default=None),
):
    if not file_a.filename or not file_b.filename:
        raise HTTPException(status_code=400, detail="请上传两个文件")

    content_a = await file_a.read()
    content_b = await file_b.read()
    if not content_a or not content_b:
        raise HTTPException(status_code=400, detail="文件不能为空")

    try:
        return compare_uploads(
            file_a.filename,
            content_a,
            file_b.filename,
            content_b,
            left_sheet=_clean_sheet_name(sheet_a),
            right_sheet=_clean_sheet_name(sheet_b),
            use_preferences=_parse_use_preferences(use_preferences),
            preferences=_parse_preferences_field(preferences),
            chart_types=_parse_chart_types(chart_types),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"对比分析失败: {exc}") from exc
