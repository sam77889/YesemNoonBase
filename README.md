# YesemNoonBase

这是一个集成的数据抓取与分析平台，主要用于提取与分析产品评论数据。

## 目录结构

*   **noon_api/**: 基于 FastAPI 的后端服务，负责处理抓取任务、数据存储、调用代理池（Oxylabs 等）以及深度数据分析与情感判断。
*   **noon_dashboard/**: 基于 React + Vite 的前端仪表盘，提供实时的数据分析展示、系统运行日志监控与交互界面。
*   **noon_proxy/**: 代理服务器及相关环境配置，用于处理一些跨域请求和登录鉴权。
*   **noon_scraper/**: 核心爬虫模块，包含使用 Playwright 和 curl_cffi 进行的反爬虫对抗与数据采集脚本。

## 快速启动

### 1. 后端 (noon_api)
```bash
cd noon_api
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
./start.sh
```
*API 默认运行在 `http://127.0.0.1:8000`*

### 2. 前端 (noon_dashboard)
```bash
cd noon_dashboard
npm install
npm run dev
```
*前端默认运行在 `http://localhost:5173`*

## 注意事项
*   本项目采用了复杂的反爬机制来对抗 Akamai Bot Manager，包括使用 `curl_cffi` 伪造 TLS 指纹和 Playwright 隐身模式 (`playwright-stealth`)。
*   相关的敏感配置（如数据库、代理 API Key 等）需要通过相应的 `.env` 文件进行配置，切勿将其提交到公共代码库中。
