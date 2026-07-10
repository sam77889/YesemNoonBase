#!/bin/bash
# 停止 NOON 数据分析系统所有服务（systemd 版）
#
# 停止顺序：systemd 用户级服务 → 系统级同名服务 → 手动残留进程
# 不再粗暴 pgrep kill 所有 uvicorn（会误杀 systemd 管理的进程）

echo "🛑 停止 NOON 数据分析系统..."

# 1. 停 systemd 用户级服务
echo "  停止用户级 systemd 服务..."
systemctl --user stop noon-api.service 2>/dev/null && echo "    noon-api.service 已停" || true
systemctl --user stop noon-proxy.service 2>/dev/null && echo "    noon-proxy.service 已停" || true

# 2. 停系统级同名服务（若仍存在）
for svc in noon-api.service noon-proxy.service; do
    if systemctl is-active --quiet "$svc" 2>/dev/null; then
        echo "  停止系统级 $svc（需 sudo）..."
        sudo systemctl stop "$svc" 2>/dev/null || true
    fi
done

# 3. 清理手动残留进程（只清非 systemd 管理的）
clean_manual() {
    local pattern="$1" name="$2"
    local pids left
    pids=$(pgrep -f "$pattern" 2>/dev/null || true)
    [ -z "$pids" ] && return
    for pid in $pids; do
        local cg="/proc/$pid/cgroup"
        { [ -r "$cg" ] && grep -qE '\.service$' "$cg" 2>/dev/null; } && continue
        echo "  清理手动 $name PID $pid"
        kill "$pid" 2>/dev/null || true
    done
    sleep 1
    left=$(pgrep -f "$pattern" 2>/dev/null || true)
    [ -n "$left" ] && echo "$left" | xargs kill -9 2>/dev/null || true
}
clean_manual "uvicorn app\.main:app" "uvicorn"
clean_manual "streamlit run dashboard\.py" "streamlit"

echo "✅ 已停止"
