#!/bin/bash
# NOON 数据分析系统 - 一键启动脚本
# 同时启动后端 API 和 Streamlit 仪表盘

cd "$(dirname "$0")"

echo "🚀 NOON 数据分析系统启动中..."
echo ""

# 激活虚拟环境
source venv/bin/activate

# 安装缺失依赖
pip install -q streamlit plotly beautifulsoup4 2>/dev/null

echo "📊 启动后端 API (端口 8000)..."
uvicorn app.main:app --host 0.0.0.0 --port 8000 &
API_PID=$!
sleep 2

echo "📈 启动 Streamlit 仪表盘 (端口 8501)..."
streamlit run dashboard.py --server.port 8501 --server.headless true &
DASHBOARD_PID=$!
sleep 2

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✅ 所有服务已启动!"
echo ""
echo "  📊 后端 API:      http://localhost:8000"
echo "  📖 API 文档:      http://localhost:8000/docs"
echo "  📈 仪表盘:        http://localhost:8501"
echo ""
echo "  按 Ctrl+C 停止所有服务"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# 等待用户中断
wait $API_PID $DASHBOARD_PID
