"""NL2SQL APIs: schema, NL→SQL, query, CSV export, history."""

from datetime import datetime

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from services.auth import CurrentUser, DbSession
from services.nl2sql_agent import generate_sql_from_question
from services.nl2sql_config import get_nl2sql_status
from services.nl2sql_history import (
    delete_nl2sql_history,
    get_nl2sql_history,
    history_to_detail,
    history_to_list_item,
    list_nl2sql_history,
    save_nl2sql_history,
)
from services.schema_catalog import get_table_schema, list_schema_catalog
from services.sql_executor import export_analytics_csv, preview_analytics_query

router = APIRouter(prefix="/api/nl2sql", tags=["nl2sql"])


class QueryRequest(BaseModel):
    sql: str = Field(..., min_length=1)
    preview_limit: int | None = Field(default=None, ge=1, le=500)


class GenerateRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    use_preferences: bool = False
    preferences: list[dict] = Field(default_factory=list)


class SaveHistoryRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    sql: str = Field(..., min_length=1)
    explanation: str = ""
    row_count: int = 0
    truncated: bool = False
    exported: bool = False


@router.get("/status")
def nl2sql_status():
    return get_nl2sql_status()


@router.get("/schema")
def nl2sql_schema():
    try:
        return list_schema_catalog()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/schema/{table_name}")
def nl2sql_table_schema(table_name: str):
    try:
        return get_table_schema(table_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/history")
def nl2sql_history_list(user: CurrentUser, db: DbSession):
    rows = list_nl2sql_history(db, user)
    return [history_to_list_item(row) for row in rows]


@router.get("/history/{history_id}")
def nl2sql_history_detail(history_id: int, user: CurrentUser, db: DbSession):
    row = get_nl2sql_history(db, user, history_id)
    if row is None:
        raise HTTPException(status_code=404, detail="查询记录不存在")
    return history_to_detail(row)


@router.post("/history")
def nl2sql_history_save(
    body: SaveHistoryRequest, user: CurrentUser, db: DbSession
):
    if not body.sql.strip():
        raise HTTPException(status_code=400, detail="SQL 不能为空")
    row = save_nl2sql_history(
        db,
        user,
        question=body.question,
        sql_text=body.sql,
        explanation=body.explanation,
        row_count=body.row_count,
        truncated=body.truncated,
        exported=body.exported,
    )
    return history_to_list_item(row)


@router.delete("/history/{history_id}")
def nl2sql_history_delete(history_id: int, user: CurrentUser, db: DbSession):
    ok = delete_nl2sql_history(db, user, history_id)
    if not ok:
        raise HTTPException(status_code=404, detail="查询记录不存在")
    return {"ok": True}


@router.post("/generate")
def nl2sql_generate(request: GenerateRequest):
    prefs = request.preferences if request.use_preferences else []
    result = generate_sql_from_question(request.question, preferences=prefs)
    if result.get("status") == "error" and "未配置 DEEPSEEK_API_KEY" in (
        result.get("explanation") or ""
    ):
        raise HTTPException(status_code=503, detail=result["explanation"])
    if result.get("status") == "error" and "业务库" in (result.get("explanation") or ""):
        raise HTTPException(status_code=503, detail=result["explanation"])
    return result


@router.post("/query")
def nl2sql_query(request: QueryRequest):
    try:
        return preview_analytics_query(request.sql, request.preview_limit)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/export.csv")
def nl2sql_export_csv(request: QueryRequest):
    try:
        csv_text, meta = export_analytics_csv(request.sql)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"nl2sql_export_{stamp}.csv"
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "X-NL2SQL-Row-Count": str(meta["row_count"]),
        "X-NL2SQL-Truncated": "1" if meta["truncated"] else "0",
    }
    return Response(
        content=csv_text.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers=headers,
    )
