"""NL2SQL APIs: schema, NL→SQL, controlled query, CSV export."""

from datetime import datetime

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from services.nl2sql_agent import generate_sql_from_question
from services.nl2sql_config import get_nl2sql_status
from services.schema_catalog import get_table_schema, list_schema_catalog
from services.sql_executor import export_analytics_csv, preview_analytics_query

router = APIRouter(prefix="/api/nl2sql", tags=["nl2sql"])


class QueryRequest(BaseModel):
    sql: str = Field(..., min_length=1)
    preview_limit: int | None = Field(default=None, ge=1, le=500)


class GenerateRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)


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


@router.post("/generate")
def nl2sql_generate(request: GenerateRequest):
    result = generate_sql_from_question(request.question)
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
