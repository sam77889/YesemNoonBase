#!/bin/bash
# NOON 数据分析系统 - 前端一键构建并重启代理脚本
# 解决：改了源码但没跑 npm run build，生产代理仍托管旧 JS bundle 的问题
#
# 用途：每次修改 noon_dashboard/src 下源码后，执行本脚本
#       ① TypeScript 编译检查  ② Vite 生产构建  ③ 重启 noon-proxy 让新 dist 生效
# 用法：./build_frontend.sh
# 用法：./build_frontend.sh --no-restart   # 只构建，不重启代理

set -e

# 用绝对路径定位仓库根（脚本中途会 cd 进子目录，依赖 $0 会失效）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RESTART_PROXY=1
if [ "$1" = "--no-restart" ]; then
    RESTART_PROXY=0
fi

DASH_DIR="noon_dashboard"
DIST_DIR="$DASH_DIR/dist"

echo "📦 NOON 前端构建脚本"
echo "───────────────────────────────────────────────────────────"

# ── 0. 前置检查 ──
if [ ! -d "$DASH_DIR" ]; then
    echo "❌ 未找到前端目录 $DASH_DIR，请在仓库根目录运行本脚本"
    exit 1
fi

if [ ! -f "$DASH_DIR/package.json" ]; then
    echo "❌ $DASH_DIR/package.json 不存在"
    exit 1
fi

# ── 1. 进入前端目录 ──
cd "$DASH_DIR"

# 确保 node_modules 存在
if [ ! -d "node_modules" ]; then
    echo "📥 安装依赖 (首次运行)..."
    npm install
fi

# ── 2. TypeScript 编译检查（build 脚本内含 tsc -b，失败则中止）──
echo ""
echo "🔨 执行生产构建 (tsc -b && vite build)..."
BUILD_START=$(date +%s)
if ! npm run build; then
    echo ""
    echo "❌ 构建失败，请修复上述错误后重试"
    echo "   提示：可单独运行 'npx tsc -b --noEmit' 定位类型错误"
    exit 1
fi
BUILD_END=$(date +%s)
echo "✅ 构建成功（耗时 $((BUILD_END - BUILD_START))s）"

# ── 3. 校验 dist 产物 ──
echo ""
echo "🔍 校验 dist 产物..."
if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
    echo "❌ dist 目录或 index.html 缺失"
    exit 1
fi

# 提取新 JS bundle hash（取最新生成的 index-*.js）
NEW_JS=$(ls -t dist/assets/index-*.js 2>/dev/null | head -1)
if [ -z "$NEW_JS" ]; then
    echo "⚠️  未找到 dist/assets/index-*.js，请检查 vite 配置"
else
    NEW_JS_BASE=$(basename "$NEW_JS")
    echo "   新 bundle: $NEW_JS_BASE"
fi

# ── 4. 重启 noon-proxy 让新 dist 生效（可选）──
# 回到仓库根（脚本中途 cd 进了 noon_dashboard）
cd "$SCRIPT_DIR"

if [ "$RESTART_PROXY" = "1" ]; then
    echo ""
    echo "🔄 重启 noon-proxy.service (加载新 dist)..."
    if systemctl --user restart noon-proxy.service 2>/dev/null; then
        sleep 1
        PROXY_STATUS=$(systemctl --user is-active noon-proxy.service 2>/dev/null || echo "unknown")
        if [ "$PROXY_STATUS" = "active" ]; then
            echo "✅ noon-proxy 已重启 (active)"
        else
            echo "⚠️  noon-proxy 状态异常: $PROXY_STATUS"
            echo "   请手动检查: systemctl --user status noon-proxy.service"
        fi
    else
        echo "⚠️  systemctl --user 重启失败（可能是系统级服务或非 systemd 环境）"
        echo "   可手动重启代理进程，或用 ./noon_api/restart_backend.sh"
    fi
else
    echo ""
    echo "ℹ️  --no-restart 模式：跳过代理重启"
fi

# ── 5. 输出摘要 ──
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ 前端构建完成"
echo ""
echo "  构建产物:  $DIST_DIR/"
[ -n "${NEW_JS_BASE:-}" ] && echo "  新 bundle: $NEW_JS_BASE"
STATIC_VAL=$(grep -iE '^STATIC_DIR=' noon_proxy/.env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r')
echo "  代理目录:  ${STATIC_VAL:-(未配置 STATIC_DIR)}"
echo ""
echo "  ⚠️  浏览器请硬刷新 (Ctrl+Shift+R / Cmd+Shift+R) 以加载新 JS"
echo "═══════════════════════════════════════════════════════════"
