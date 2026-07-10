#!/bin/bash
# 停止所有 NOON 后端 uvicorn 进程

echo "🛑 停止 NOON 后端 API..."

PIDS=$(pgrep -f "uvicorn app\.main:app" || true)
if [ -n "$PIDS" ]; then
    echo "$PIDS" | xargs kill 2>/dev/null || true
    sleep 2
    PIDS_LEFT=$(pgrep -f "uvicorn app\.main:app" || true)
    if [ -n "$PIDS_LEFT" ]; then
        echo "💀 强制结束残留进程: $PIDS_LEFT"
        echo "$PIDS_LEFT" | xargs kill -9 2>/dev/null || true
    fi
    echo "✅ 后端已停止"
else
    echo "ℹ️  没有运行中的后端进程"
fi
