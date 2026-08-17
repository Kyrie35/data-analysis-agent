import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.analyze import router as analyze_router
from routers.auth import router as auth_router
from routers.chat import router as chat_router
from routers.history import router as history_router
from routers.nl2sql import router as nl2sql_router
from routers.preferences import router as preferences_router
from services.db import init_db

load_dotenv()

app = FastAPI(title="DataPilot API", version="0.2.0")

default_origins = "http://localhost:3000,http://127.0.0.1:3000"
allowed_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", default_origins).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze_router)
app.include_router(chat_router)
app.include_router(auth_router)
app.include_router(history_router)
app.include_router(preferences_router)
app.include_router(nl2sql_router)


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/health")
def health_check():
    return {"status": "ok"}
