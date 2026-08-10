# 数据分析 Agent

上传 CSV / Excel：先由 AI 规划分析重点，再生成指标与图表，最后输出报告。支持本地偏好库与基于原表的追问；AI 规划失败时回退规则可视化。

**线上体验：** https://tc-ddagent.vercel.app

**详细说明文档：** [docs/项目说明.md](./docs/项目说明.md)（架构、运行流程、API、环境变量等）

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

1. 打开 http://localhost:3000，先注册或登录
2. （可选）点击「偏好库」添加个人分析视角，上传前勾选「从偏好库视角分析」
3. 上传 `sample_data/sales_sample.csv`
4. 应看到关键指标、AI 分析报告、图表，并可在报告下方继续追问

## 环境变量

| 变量 | 位置 | 说明 |
|------|------|------|
| `DEEPSEEK_API_KEY` | `backend/.env` | DeepSeek API 密钥（必填） |
| `DEEPSEEK_MODEL` | `backend/.env` | 模型名，默认 `deepseek-chat` |
| `JWT_SECRET` | `backend/.env` | 登录 JWT 密钥（生产必改） |
| `DATABASE_URL` | `backend/.env` | 可选；默认 SQLite `backend/data/app.db` |
| `NEXT_PUBLIC_API_BASE_URL` | `frontend/.env.local` | 后端地址，默认 `http://localhost:8000` |

## 部署上线

详见 [DEPLOY.md](./DEPLOY.md)。

## 当前 API

`POST /api/inspect` — 预检文件，返回 Excel Sheet 列表与默认预览。

`POST /api/analyze`

- 请求：`multipart/form-data`
  - `file`：CSV / Excel（必填）
  - `sheet_name`：Excel 工作表（可选）
  - `use_preferences`：`true` / `false`（可选）
  - `preferences`：JSON 数组字符串，如 `[{"title":"...","content":"..."}]`（可选）
  - `chart_types`：JSON 数组，如 `["line","bar","pie","histogram"]`（可选，默认全选）
- 响应：文件概览 + 指标 + 图表 + AI 分析 + 前 5 行预览（含 `pipeline.chart_types` / 已应用变换）

`POST /api/compare` — 双文件对比（`file_a` / `file_b`，可选 `sheet_a` / `sheet_b`），返回两侧指标、差值表与 AI 差异报告。

前端支持：**单文件分析**（含 Sheet 选择）与 **双文件对比**；本地偏好分组；分析前自选图表类型（最多生成 3 张）。

分析完成后可在结果区 **导出 Markdown / Excel**（含变换说明、指标、报告、图表数据与预览）。

**登录门禁：** 打开站点需先注册/登录，之后才能使用分析与历史；偏好库会同步到服务端。退出后回到登录页。

`POST /api/chat`

- 请求：JSON，需带 `analysis_id`（分析接口返回），以及对话历史、可选偏好
- 后端会按 `analysis_id` 取回原始表格，通过查询工具再计算后回答
- 响应：AI 追问回答（`status` / `content` / `used_preferences` / `used_raw_data`）
- `analysis_id` 对应的原表会话在服务端内存中约保留 1 小时；重启后端或超时后需重新上传

偏好库保存在浏览器 `localStorage`，登录后可同步到服务端。
