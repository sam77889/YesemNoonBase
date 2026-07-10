#!/bin/bash
# NOON 数据分析系统 - 后端一键重启脚本
# 同时启动开发端口 8000 与代理端口 8001 两个 uvicorn 实例

set -e

cd "$(dirname "$0")"

echo "🚀 重启 NOON 后端 API..."
echo ""

# 激活虚拟环境
source venv/bin/activate

# 仅杀掉属于本项目 app.main:app 的 uvicorn 进程
echo "🛑 查找并停止现有 uvicorn 进程..."
PIDS=$(pgrep -f "uvicorn app\.main:app" || true)
if [ -n "$PIDS" ]; then
    echo "$PIDS" | xargs kill 2>/dev/null || true
    sleep 2
    # 强制清理残留
    PIDS_LEFT=$(pgrep -f "uvicorn app\.main:app" || true)
    if [ -n "$PIDS_LEFT" ]; then
        echo "$PIDS_LEFT" | xargs kill -9 2>/dev/null || true
    fi
fi

# 创建日志目录
mkdir -p logs

echo "📡 启动代理后端 (127.0.0.1:8001)..."
nohup uvicorn app.main:app --host 127.0.0.1 --port 8001 > logs/api_8001.log 2>&1 &
PROXY_API_PID=$!

echo "📊 启动开发后端 (0.0.0.0:8000)..."
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > logs/api_8000.log 2>&1 &
DEV_API_PID=$!

sleep 3

# 简单健康检查
HEALTH_8000=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/health || echo "000")
HEALTH_8001=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8001/health || echo "000")

echo ""
echo "═══════════════════════════════════════════════════════════════"
if [ "$HEALTH_8000" = "200" ] && [ "$HEALTH_8001" = "200" ]; then
    echo "  ✅ 后端重启成功"
else
    echo "  ⚠️  后端启动中，健康检查未立即返回 200"
fi
echo ""
echo "  开发后端:    http://localhost:8000  (PID: $DEV_API_PID)"
echo "  代理后端:    http://localhost:8001  (PID: $PROXY_API_PID)"
echo "  API 文档:    http://localhost:8000/docs"
echo "  日志目录:    $(pwd)/logs"
echo ""
echo "  停止命令:    ./stop_backend.sh"
echo "═══════════════════════════════════════════════════════════════"
echo ""
