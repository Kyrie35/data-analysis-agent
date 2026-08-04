#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "Starting backend on http://localhost:8000"
cd "$ROOT_DIR/backend"
source .venv/bin/activate
uvicorn main:app --reload --port 8000
