from fastapi import APIRouter, File, HTTPException, UploadFile

from services.analyze import analyze_upload

router = APIRouter(prefix="/api", tags=["analyze"])


@router.post("/analyze")
async def analyze_file(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="未收到文件名")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="文件为空")

    try:
        result = analyze_upload(file.filename, content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"文件解析失败: {exc}") from exc

    return result
