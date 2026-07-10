#!/bin/bash
# NOON 数据分析系统 - 一键重启脚本（systemd 版）
#
# 本脚本基于 systemd 用户级服务管理后端与代理，避免手动 nohup 进程占端口
# 导致 systemd 服务 bind 失败循环重启（曾引发线上 502）。
#
# 核心修复（2026-07-09 排障固化）：
#   1. 清理系统级同名服务 noon-api / noon-proxy（与用户级冲突，占 8001/3000）
#   2. 清理残留的手动 nohup uvicorn / streamlit 进程（占端口）
#   3. DB 完整性检查：noon_data.db 若为空库且存在 ~Stashed changes 真实库则自动恢复
#   4. 停 → 修 -> 启 的顺序，确保端口释放后再 start
#   5. 可选前端重建：避免「改了前端代码却忘 npm run build」导致线上仍跑旧 bundle
#   6. 启动后 overview 数据自检：用真实类目 value 请求 /products/stats/overview，
#      断言返回非空价格段，防止类目 label/value 传参错误等回归（曾致大盘图表空白）
#
# 用法:
#   ./restart_noon.sh                       # 默认：重启 noon-api + noon-proxy
#   ./restart_noon.sh --no-proxy            # 只重启后端
#   ./restart_noon.sh --check               # 仅检查不重启
#   NOON_BUILD_FRONTEND=1 ./restart_noon.sh # 重启前先重建前端 dist
#   ./restart_noon.sh --build               # 等价：重启前先重建前端 dist

set -e

cd "$(dirname "$0")"
SCRIPT_DIR="$(pwd)"
API_DIR="$SCRIPT_DIR/noon_api"
DB_FILE="$API_DIR/noon_data.db"
DB_STASHED="$API_DIR/noon_data.db~Stashed changes"

# 颜色
R='\033[0;31m'; G='\033[0;32m'; Y='\033[1;33m'; B='\033[0;34m'; N='\033[0m'
ok()   { echo -e "${G}✅ $1${N}"; }
warn() { echo -e "${Y}⚠️  $1${N}"; }
err()  { echo -e "${R}❌ $1${N}"; }
info() { echo -e "${B}ℹ️  $1${N}"; }

# 重建前端 dist（确保最新前端代码已部署；防「改了前端忘 build」）
# 对应教训：前端改动后必须 npm run build，否则代理托管仍是旧 bundle。
build_frontend() {
    local fd="$SCRIPT_DIR/noon_dashboard"
    [ -d "$fd" ] || { warn "noon_dashboard 不存在，跳过前端构建"; return; }
    info "重建前端 dist（npm run build）..."
    ( cd "$fd" && npm run build ) || { err "前端构建失败，请查看上方错误"; return 1; }
    # 校验 dist 产物
    if [ -f "$fd/dist/index.html" ]; then
        ok "前端已重建：$(grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' "$fd/dist/index.html" | head -1)"
    else
        err "前端构建后未找到 dist/index.html"
        return 1
    fi
}

# 启动后 overview 数据自检：用真实类目 value 请求聚合接口，断言返回非空价格段。
# 防止类目 label/value 传参错误等回归（曾致大盘图表空白）。走本地 8001 直连，无需认证。
self_check_overview() {
    local api="http://127.0.0.1:8001/api/v1"
    local cats ov val tp pd
    cats=$(curl -s --max-time 5 "$api/products/stats/categories" 2>/dev/null)
    [ -z "$cats" ] && { warn "无法获取类目列表，跳过 overview 自检"; return; }
    val=$(printf '%s' "$cats" | python3 -c "
import sys,json
try:
    for c in json.load(sys.stdin):
        v=c.get('value') or ''
        if v and v!='__UNCATEGORIZED__':
            print(v); break
except Exception:
    pass
" 2>/dev/null)
    [ -z "$val" ] && { warn "无可用类目 value，跳过 overview 自检"; return; }
    ov=$(curl -s --max-time 8 "$api/products/stats/overview?category=$val" 2>/dev/null)
    tp=$(printf '%s' "$ov" | python3 -c "import sys,json;print(json.load(sys.stdin).get('summary',{}).get('total_products',0))" 2>/dev/null)
    pd=$(printf '%s' "$ov" | python3 -c "import sys,json;print(len(json.load(sys.stdin).get('price_distribution',[])))" 2>/dev/null)
    tp=${tp:-0}; pd=${pd:-0}
    if [ "$tp" -gt 0 ] && [ "$pd" -gt 0 ]; then
        ok "Overview 自检通过（类目 value=$val → 商品 $tp，价格段 $pd 桶）"
    else
        warn "Overview 自检异常：类目 value=$val 返回 商品=$tp / 价格段桶=$pd（疑似类目 label/value 传参错误回归）"
    fi
}

RESTART_PROXY=1
CHECK_ONLY=0
BUILD_FRONTEND=${NOON_BUILD_FRONTEND:-0}
for arg in "$@"; do
    case "$arg" in
        --no-proxy) RESTART_PROXY=0 ;;
        --check)    CHECK_ONLY=1; RESTART_PROXY=0 ;;
        --build)    BUILD_FRONTEND=1 ;;
        -h|--help)
            sed -n '2,23p' "$0"; exit 0 ;;
        *) warn "未知参数: $arg（忽略）" ;;
    esac
done

echo "🚀 NOON 数据分析系统重启（systemd 模式）"
echo ""

# ────────────────────────────────────────────────────────
# 步骤 1：清理系统级同名服务（根因之一：占端口致用户级 bind 失败）
# ────────────────────────────────────────────────────────
echo "── 步骤 1/5：清理系统级同名服务 ──"
SYS_CLEANED=0
for svc in noon-api.service noon-proxy.service; do
    if systemctl is-active --quiet "$svc" 2>/dev/null; then
        info "系统级 $svc 仍在运行，停用中（需 sudo）..."
        sudo systemctl stop "$svc" 2>/dev/null || warn "stop $svc 失败（可能已停）"
        SYS_CLEANED=1
    fi
    if systemctl is-enabled --quiet "$svc" 2>/dev/null; then
        info "禁用系统级 $svc 自启..."
        sudo systemctl disable "$svc" 2>/dev/null || warn "disable $svc 失败"
        SYS_CLEANED=1
    fi
done
if [ "$SYS_CLEANED" = "0" ]; then
    ok "无系统级同名服务残留"
fi

# ────────────────────────────────────────────────────────
# 步骤 2：清理手动 nohup 进程（根因之二：脱离 systemd 占端口）
# 只清 cgroup 不在 systemd 服务内的残留进程，不动 systemd 管理的进程
# ────────────────────────────────────────────────────────
echo ""
echo "── 步骤 2/5：清理手动残留进程 ──"
clean_manual_pids() {
    local pattern="$1" name="$2"
    local pids left
    pids=$(pgrep -f "$pattern" 2>/dev/null || true)
    [ -z "$pids" ] && { ok "无手动 $name 残留"; return; }
    for pid in $pids; do
        # cgroup 在 *.service 内的是 systemd 管理的，跳过
        local cg="/proc/$pid/cgroup"
        if [ -r "$cg" ] && grep -qE '\.service$' "$cg" 2>/dev/null; then
            info "PID $pid ($name) 由 systemd 管理，跳过"
            continue
        fi
        warn "清理手动 $name PID $pid"
        kill "$pid" 2>/dev/null || true
    done
    sleep 1
    left=$(pgrep -f "$pattern" 2>/dev/null || true)
    if [ -n "$left" ]; then
        for pid in $left; do
            local cg="/proc/$pid/cgroup"
            { [ -r "$cg" ] && grep -qE '\.service$' "$cg" 2>/dev/null; } && continue
            warn "强杀 $name PID $pid"
            kill -9 "$pid" 2>/dev/null || true
        done
    fi
}
clean_manual_pids "uvicorn app\.main:app" "uvicorn"
clean_manual_pids "streamlit run dashboard\.py" "streamlit"

# ────────────────────────────────────────────────────────
# 步骤 3：DB 完整性检查（根因之三：git stash 残留覆盖运行库）
# ────────────────────────────────────────────────────────
echo ""
echo "── 步骤 3/5：数据库完整性检查 ──"
db_count() {
    # 返回 tracked_products 行数，失败返回 -1
    "$API_DIR/venv/bin/python3" - "$1" <<'PY' 2>/dev/null
import sqlite3, sys
try:
    c = sqlite3.connect(sys.argv[1]); cur = c.cursor()
    cur.execute("SELECT COUNT(*) FROM tracked_products"); print(cur.fetchone()[0]); c.close()
except Exception:
    print(-1)
PY
}

# 先停后端，确保 DB 无人持有
systemctl --user stop noon-api.service 2>/dev/null || true
sleep 1

if [ ! -f "$DB_FILE" ]; then
    err "DB 不存在: $DB_FILE"
    if [ -f "$DB_STASHED" ]; then
        warn "发现 ~Stashed changes，恢复中..."
        cp "$DB_STASHED" "$DB_FILE"
        ok "已恢复 DB"
    fi
else
    CUR_COUNT=$(db_count "$DB_FILE")
    info "当前 noon_data.db 商品数: ${CUR_COUNT}"
    if [ "$CUR_COUNT" = "0" ] && [ -f "$DB_STASHED" ]; then
        STASH_COUNT=$(db_count "$DB_STASHED")
        info "~Stashed changes 商品数: ${STASH_COUNT}"
        if [ "$STASH_COUNT" != "-1" ] && [ "$STASH_COUNT" -gt 0 ]; then
            warn "当前库为空但 stash 库有 ${STASH_COUNT} 商品，备份后恢复"
            TS=$(date +%Y%m%d_%H%M%S)
            cp "$DB_FILE" "$DB_FILE.empty_$TS"
            info "空库已备份: noon_data.db.empty_$TS"
            cp "$DB_STASHED" "$DB_FILE"
            ok "已从 stash 恢复 DB（${STASH_COUNT} 商品）"
        fi
    elif [ "$CUR_COUNT" = "-1" ]; then
        err "当前 DB 无法读取，可能损坏"
        if [ -f "$DB_STASHED" ]; then
            warn "尝试从 ~Stashed changes 恢复..."
            cp "$DB_STASHED" "$DB_FILE"
            ok "已恢复 DB"
        fi
    else
        ok "DB 数据正常（${CUR_COUNT} 商品）"
    fi
fi

# 仅检查模式：到此为止
if [ "$CHECK_ONLY" = "1" ]; then
    echo ""
    echo "── 仅检查模式，不重启服务 ──"
    exit 0
fi

# ────────────────────────────────────────────────────────
# 步骤 4：启动服务（systemd 用户级，统一接管）
# ────────────────────────────────────────────────────────
echo ""
echo "── 步骤 4/5：启动服务 ──"

# 确保端口已释放
sleep 1
for port in 8001 3000; do
    if ss -tlnp 2>/dev/null | grep -q ":$port "; then
        warn "端口 $port 仍被占用，等待 3s..."
        sleep 3
    fi
done

# 确保 lingering 开启（用户级服务开机自启前提）
if [ "$(loginctl show-user "$USER" -p Linger 2>/dev/null | cut -d= -f2)" != "yes" ]; then
    warn "Linger 未开启，用户级服务不会开机自启，尝试开启（需 sudo）..."
    sudo loginctl enable-linger "$USER" 2>/dev/null || warn "enable-linger 失败"
fi

# 可选：重建前端（确保最新前端代码已部署，防「改了前端忘 build」）
# 必须早于启动 noon-proxy，使代理托管到新 dist
if [ "$BUILD_FRONTEND" = "1" ]; then
    build_frontend || warn "前端构建失败，代理将继续托管旧 dist"
else
    info "跳过前端重建（如需: NOON_BUILD_FRONTEND=1 ./restart_noon.sh 或 --build）"
fi

info "启动 noon-api.service（127.0.0.1:8001）..."
systemctl --user restart noon-api.service
ok "noon-api 已 restart"

if [ "$RESTART_PROXY" = "1" ]; then
    info "启动 noon-proxy.service（127.0.0.1:3000）..."
    systemctl --user restart noon-proxy.service
    ok "noon-proxy 已 restart"
fi

# Streamlit 备用仪表盘（可选，非 systemd 管理，按需启动）
if [ "${NOON_START_STREAMLIT:-0}" = "1" ]; then
    info "启动 Streamlit 备用仪表盘（8501）..."
    cd "$API_DIR"
    source venv/bin/activate 2>/dev/null
    mkdir -p logs
    nohup streamlit run dashboard.py --server.port 8501 --server.headless true > logs/streamlit.log 2>&1 &
    disown
    ok "Streamlit PID $!"
    cd "$SCRIPT_DIR"
else
    info "Streamlit 未启动（如需启动: NOON_START_STREAMLIT=1 ./restart_noon.sh）"
fi

# 等待服务就绪
sleep 4

# ────────────────────────────────────────────────────────
# 步骤 5：健康检查
# ────────────────────────────────────────────────────────
echo ""
echo "── 步骤 5/5：健康检查 ──"
HEALTH_API=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8001/docs || echo "000")
STATS=$(curl -s http://127.0.0.1:8001/api/v1/products/stats 2>/dev/null || echo "{}")
PRODUCTS=$(echo "$STATS" | "$API_DIR/venv/bin/python3" -c "import sys,json; d=json.load(sys.stdin); print(d.get('total_products','?'))" 2>/dev/null || echo "?")

API_OK="✅"; PROXY_OK="✅"
[ "$HEALTH_API" != "200" ] && API_OK="❌"

PROXY_HEALTH="---"
if [ "$RESTART_PROXY" = "1" ]; then
    PROXY_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/login || echo "000")
    [ "$PROXY_HEALTH" != "200" ] && [ "$PROXY_HEALTH" != "302" ] && PROXY_OK="❌"
fi

# overview 数据自检（防类目 label/value 传参错误等回归 → 大盘图表空白）
self_check_overview

echo ""
echo "═══════════════════════════════════════════════════════════════"
if [ "$API_OK" = "✅" ] && { [ "$RESTART_PROXY" = "0" ] || [ "$PROXY_OK" = "✅" ]; }; then
    echo -e "  ${G}✅ NOON 数据分析系统重启成功${N}"
else
    echo -e "  ${R}⚠️  部分服务异常，请查看日志${N}"
fi
echo ""
echo "  后端 API (8001):   $API_OK  HTTP $HEALTH_API  | 商品数: $PRODUCTS"
echo "  代理 (3000):       $PROXY_OK  HTTP $PROXY_HEALTH  (SECURE_COOKIE 仅 HTTPS 可登录)"
echo ""
echo "  服务状态:"
echo "    systemctl --user status noon-api.service"
echo "    systemctl --user status noon-proxy.service"
echo "  实时日志:"
echo "    journalctl --user -u noon-api.service -f"
echo "    journalctl --user -u noon-proxy.service -f"
echo "  停止: ./stop_noon.sh"
echo "═══════════════════════════════════════════════════════════════"
echo ""
