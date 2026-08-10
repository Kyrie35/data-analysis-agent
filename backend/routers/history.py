from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select

from services.auth import CurrentUser, DbSession
from services.models import AnalysisHistory

router = APIRouter(prefix="/api/history", tags=["history"])


class SaveHistoryRequest(BaseModel):
    title: str | None = None
    result: dict[str, Any]


class HistoryListItem(BaseModel):
    id: int
    title: str
    filename: str
    summary: str
    created_at: str


class HistoryDetail(HistoryListItem):
    result: dict[str, Any]


def _summary_from_result(result: dict[str, Any]) -> str:
    if result.get("mode") == "compare":
        deltas = result.get("metric_deltas") or []
        parts = ["双文件对比", f"差异{len(deltas)}项"]
        transforms = result.get("transforms") or []
        if transforms:
            parts.append(
                "变换:" + "、".join(t.get("label", "") for t in transforms[:3])
            )
        return " · ".join(parts)[:500]

    pipeline = result.get("pipeline") or {}
    transforms = pipeline.get("applied_transforms") or []
    mode = pipeline.get("mode") or ""
    parts = []
    if mode:
        parts.append("AI计划" if mode == "ai_plan" else "规则回退")
    if transforms:
        parts.append("变换:" + "、".join(t.get("label", "") for t in transforms[:3]))
    metrics = result.get("metrics") or []
    if metrics:
        parts.append(f"指标{len(metrics)}项")
    return " · ".join(parts)[:500]


def _filename_from_result(result: dict[str, Any]) -> str:
    if result.get("mode") == "compare":
        left = ((result.get("left") or {}).get("overview") or {}).get("filename")
        right = ((result.get("right") or {}).get("overview") or {}).get("filename")
        if left and right:
            return f"{left} vs {right}"
        return str(left or right or "对比结果")
    overview = result.get("overview") or {}
    return str(overview.get("filename") or "未命名文件")


@router.get("", response_model=list[HistoryListItem])
def list_history(user: CurrentUser, db: DbSession):
    rows = db.scalars(
        select(AnalysisHistory)
        .where(AnalysisHistory.user_id == user.id)
        .order_by(AnalysisHistory.created_at.desc())
        .limit(100)
    ).all()
    return [
        HistoryListItem(
            id=row.id,
            title=row.title,
            filename=row.filename,
            summary=row.summary,
            created_at=row.created_at.isoformat() if row.created_at else "",
        )
        for row in rows
    ]


@router.get("/{history_id}", response_model=HistoryDetail)
def get_history(history_id: int, user: CurrentUser, db: DbSession):
    row = db.get(AnalysisHistory, history_id)
    if row is None or row.user_id != user.id:
        raise HTTPException(status_code=404, detail="历史记录不存在")
    try:
        result = json.loads(row.result_json)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail="历史数据损坏") from exc
    return HistoryDetail(
        id=row.id,
        title=row.title,
        filename=row.filename,
        summary=row.summary,
        created_at=row.created_at.isoformat() if row.created_at else "",
        result=result,
    )


@router.post("", response_model=HistoryListItem)
def save_history(body: SaveHistoryRequest, user: CurrentUser, db: DbSession):
    result = body.result
    filename = _filename_from_result(result)
    title = (body.title or filename).strip()[:200] or filename
    row = AnalysisHistory(
        user_id=user.id,
        title=title,
        filename=filename[:255],
        summary=_summary_from_result(result),
        result_json=json.dumps(result, ensure_ascii=False),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return HistoryListItem(
        id=row.id,
        title=row.title,
        filename=row.filename,
        summary=row.summary,
        created_at=row.created_at.isoformat() if row.created_at else "",
    )


@router.delete("/{history_id}")
def delete_history(history_id: int, user: CurrentUser, db: DbSession):
    row = db.get(AnalysisHistory, history_id)
    if row is None or row.user_id != user.id:
        raise HTTPException(status_code=404, detail="历史记录不存在")
    db.delete(row)
    db.commit()
    return {"ok": True}
