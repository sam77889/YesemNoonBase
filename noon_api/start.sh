#!/bin/bash

# NOON 数据分析系统 - 启动脚本
# 使用方法:
#   ./start.sh          - 启动后端 API
#   ./start.sh dashboard - 启动仪表盘
#   ./start.sh all       - 启动全部服务

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# 激活虚拟环境（如果存在）
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# 检查依赖
check_deps() {
    if ! command -v uvicorn &> /dev/null; then
        print_info "安装依赖..."
        pip install -r requirements.txt
    fi
}

# 启动后端 API
start_api() {
    print_info "启动 FastAPI 后端..."
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
    API_PID=$!
    print_success "后端 API 已启动: http://localhost:8000"
    print_success "API 文档: http://localhost:8000/docs"
}

# 启动仪表盘
start_dashboard() {
    print_info "启动 Streamlit 仪表盘..."
    streamlit run dashboard.py --server.port 8501 --server.headless true &
    DASHBOARD_PID=$!
    print_success "仪表盘已启动: http://localhost:8501"
}

# 主逻辑
case "${1:-api}" in
    api)
        check_deps
        start_api
        wait $API_PID
        ;;
    dashboard)
        check_deps
        start_dashboard
        wait $DASHBOARD_PID
        ;;
    all)
        check_deps
        start_api
        start_dashboard
        print_success "所有服务已启动!"
        print_info "后端 API: http://localhost:8000"
        print_info "仪表盘: http://localhost:8501"
        wait
        ;;
    *)
        echo "用法: $0 [api|dashboard|all]"
        exit 1
        ;;
esac
