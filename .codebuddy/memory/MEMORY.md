# NOON Base 项目长期记忆

## 生产部署链路（端口与进程）
- `cloudflared tunnel run openclaw-tunnel` → `noon_proxy/server.js` (127.0.0.1:3000, Express 认证代理) → `uvicorn app.main:app` (127.0.0.1:8001, FastAPI)
- 域名 `noonbase.chen9527.top` → cloudflared ingress → proxy:3000。配置文件：`/home/san/.cloudflared/config.yml`（含 noonbase/shell/ssh 三个 hostname）。
- **cloudflared 也有双套服务问题**：系统级 `/etc/cloudflared/config.yml`（只有 ssh，无 noonbase）+ 用户级 `/home/san/.cloudflared/config.yml`（完整）。两个连同一 tunnel 会负载均衡，命中系统级的 noonbase 请求返回 404。修复：`sudo systemctl stop cloudflared.service && sudo systemctl disable cloudflared.service`，只留用户级（已 enabled）。
- 代理托管 `noon_dashboard/dist` 静态文件 + 反代 `/api/*` 与 WebSocket 到 8001。
- 另有一个历史进程：端口 8000 跑的是 `/home/san/AiAgentsWorkSpace/noon_api/`（旧工作区，非 noon_base），勿混淆。
- 端口 7682 被 `/home/san/webterm-auth` 的 node server.js 占用，与本项目无关。

## 服务管理（极重要，曾因误操作导致 502）
- **后端和代理都由 systemd 管理，且存在用户级和系统级两套同名服务**：
  - 用户级（实际提供服务）：`~/.config/systemd/user/noon-api.service`、`~/.config/systemd/user/noon-proxy.service`
  - 系统级（多余，因端口被用户级占用而 EADDRINUSE restart 循环）：`/etc/systemd/system/noon-api.service` 等
- **改后端 Python 代码后**：`systemctl --user restart noon-api.service`（无需 sudo）
- **改代理 server.js 后**：`systemctl --user restart noon-proxy.service`
- **改前端后**：`cd noon_dashboard && npm run build`（代理托管 dist，无需重启）
- **绝对不要手动 kill 进程或 nohup 启动 uvicorn/代理**：会破坏 systemd 服务管理，导致用户级服务 restart 失败（端口被手动进程占），cloudflared 连不上 → Cloudflare 502。
- 建议清理多余系统级服务（需 sudo）：`sudo systemctl disable --now noon-api.service noon-proxy.service`
- 代理 `SECURE_COOKIE=true` + `app.set('trust proxy',1)`：只在 HTTPS（X-Forwarded-Proto: https，即经 Cloudflare）下设置 session cookie；HTTP 直连 127.0.0.1:3000 无法登录是正常的。

## 抓取 provider 体系
- 三 provider：`fetcher`（本地 curl_cffi firefox 指纹，免费，绕 Akamai）/ `scraperapi`（默认）/ `oxylabs`。
- 前端按请求传 `provider`；后端 `run_search_scrape(provider=...)`，None 回退 env `SCRAPER_PROVIDER`。
- 任务归属靠 `job_id` 前缀区分：`fetcher-` / `scraperapi-` / `oxylabs-`。前端 fetcher 页面只显示 `fetcher-` 任务，scraper 页面显示其余。
- fetcher 抓详情页（逐个并发，concurrency=5），比 scraperapi 单页 TSR 解析慢但数据更全。
