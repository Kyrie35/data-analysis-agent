# 阶段 4：部署上线指南

## 架构

- **前端** → [Vercel](https://vercel.com)（免费）
- **后端** → [Railway](https://railway.app)（有免费额度）

---

## 第一步：代码推到 GitHub

```bash
cd /Users/tongchong/Documents/Cursor/0-3
git init
git add .
git commit -m "Initial commit: data analysis agent"
gh repo create data-analysis-agent --public --source=. --remote=origin --push
```

如果 `gh` 未登录，先运行：`gh auth login`

---

## 第二步：部署后端（Railway）

1. 打开 https://railway.app 并登录（可用 GitHub 登录）
2. **New Project** → **Deploy from GitHub repo**
3. 选择 `Kyrie35/data-analysis-agent`
4. **重要：Root Directory 留空（使用仓库根目录）**
   - 项目根目录已有 `Dockerfile` 和 `railway.toml`，会自动构建 `backend/`
   - 如果你之前设过 Root Directory 为 `backend` 且失败，请改回 **空** 或 `/`
5. 在 **Variables** 添加环境变量：

| 变量名 | 值 |
|--------|-----|
| `DEEPSEEK_API_KEY` | 你的 DeepSeek Key |
| `DEEPSEEK_MODEL` | `deepseek-chat` |
| `ALLOWED_ORIGINS` | 先填 `http://localhost:3000`（部署前端后再更新） |

6. 部署完成后，在 **Settings → Networking → Generate Domain** 生成公网域名
7. 记下后端 URL，例如：`https://data-analysis-agent-production.up.railway.app`
8. 测试：访问 `https://你的域名/health` 应返回 `{"status":"ok"}`

---

## 第三步：部署前端（Vercel）

1. 打开 https://vercel.com 并登录（可用 GitHub 登录）
2. **Add New Project** → 导入 `Kyrie35/data-analysis-agent`
3. 在 **Root Directory** 填 `frontend`，Framework 选 **Next.js**
   - 不要在仓库里放带 `rootDirectory` 的 `vercel.json`（Vercel 新版不支持）
4. 在 **Environment Variables** 添加：

| 变量名 | 值 |
|--------|-----|
| `NEXT_PUBLIC_API_BASE_URL` | Railway 后端 URL（第二步第 7 步） |

5. 点击 **Deploy**，等待完成
6. 获得前端链接，例如：`https://data-analysis-agent.vercel.app`

---

## 第四步：更新 CORS（重要）

回到 **Railway** 后端环境变量，更新 `ALLOWED_ORIGINS`：

```
https://你的-vercel-域名.vercel.app,http://localhost:3000
```

保存后 Railway 会自动重新部署。

---

## 第五步：端到端测试

1. 打开 Vercel 前端链接
2. 上传 `sample_data/sales_sample.csv`
3. 确认指标、图表、AI 报告都正常

---

## 常见问题

| 问题 | 解决 |
|------|------|
| 前端报「分析请求失败」 | 检查 `NEXT_PUBLIC_API_BASE_URL` 是否正确 |
| CORS 错误 | 更新 Railway 的 `ALLOWED_ORIGINS` 包含 Vercel 域名 |
| AI 报告 skipped | 检查 Railway 是否配置了 `DEEPSEEK_API_KEY` |
| Railway 部署失败 / railpack 报错 | Root Directory 留空，确保使用根目录 Dockerfile；然后 Redeploy |
| Railway 用了错误构建方式 | Settings → Build → Builder 选 **Dockerfile** |
