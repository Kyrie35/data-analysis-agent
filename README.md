# 数据分析 Agent

上传 CSV / Excel，自动解析数据、计算指标、生成图表，并由 DeepSeek 输出 AI 分析总结。当前为 **阶段 3**。

## 项目结构

```
data-analysis-agent/
├── frontend/     # Next.js 前端
├── backend/      # FastAPI 后端
└── sample_data/  # 示例数据
```

## 环境要求

- Node.js 18+
- Python 3.10+
- DeepSeek API Key

## 第一次启动

### 0. 配置 DeepSeek API Key

```bash
cd backend
cp .env.example .env
# 编辑 .env，填入你的 DEEPSEEK_API_KEY
```

`.env` 示例：

```bash
DEEPSEEK_API_KEY=sk-xxxxxxxx
DEEPSEEK_MODEL=deepseek-chat
```

### 1. 启动后端

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

后端地址：http://localhost:8000  
健康检查：http://localhost:8000/health  
API 文档：http://localhost:8000/docs

### 2. 启动前端

新开一个终端：

```bash
cd frontend
npm install
npm run dev
```

前端地址：http://localhost:3000

### 3. 测试

1. 打开 http://localhost:3000
2. 上传 `sample_data/sales_sample.csv`
3. 应看到关键指标、AI 分析报告、图表

## 环境变量

| 变量 | 位置 | 说明 |
|------|------|------|
| `DEEPSEEK_API_KEY` | `backend/.env` | DeepSeek API 密钥（必填） |
| `DEEPSEEK_MODEL` | `backend/.env` | 模型名，默认 `deepseek-chat` |
| `NEXT_PUBLIC_API_BASE_URL` | `frontend/.env.local` | 后端地址，默认 `http://localhost:8000` |

## 部署上线

详见 [DEPLOY.md](./DEPLOY.md)。

## 当前 API

`POST /api/analyze`

- 请求：`multipart/form-data`，字段名 `file`
- 响应：文件概览 + 指标 + 图表 + AI 分析 + 前 5 行预览
