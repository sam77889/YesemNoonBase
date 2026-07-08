#!/usr/bin/env python3
"""
NOON 数据分析系统 - 端到端全链路调试脚本
=======================================
此脚本用于验证整个数据采集管道是否正常工作：

流程:
  1. 检查系统健康状态
  2. 通过 /api/v1/tasks/search 触发真实搜索抓取
  3. 查看抓取任务结果
  4. 查询入库的商品列表
  5. 查询价格历史
  6. 查看统计概览

使用前请确保:
  - .env 中已配置 SCRAPERAPI_KEY（去 https://www.scraperapi.com/signup 免费注册）
  - FastAPI 服务已启动 (uvicorn app.main:app --reload --port 8000)

运行: python e2e_test.py
"""
import requests
import json
import sys
import time
from urllib.parse import quote

BASE_URL = "http://localhost:8000"
DIVIDER = "=" * 60


def pprint(data):
    """美观打印 JSON"""
    print(json.dumps(data, indent=2, ensure_ascii=False))


def step(n, title):
    """打印步骤标题"""
    print(f"\n{DIVIDER}")
    print(f"  步骤 {n}: {title}")
    print(DIVIDER)


def main():
    # ════════════════════════════════════════════
    #  步骤 1: 健康检查
    # ════════════════════════════════════════════
    step(1, "系统健康检查")
    try:
        resp = requests.get(f"{BASE_URL}/health", timeout=5)
        pprint(resp.json())
        assert resp.status_code == 200
        print("✅ 服务正常运行")
    except Exception as e:
        print(f"❌ 服务未启动或无法连接: {e}")
        print("   请先运行: cd noon_api && source venv/bin/activate && uvicorn app.main:app --reload --port 8000")
        sys.exit(1)

    # ════════════════════════════════════════════
    #  步骤 2: 系统信息
    # ════════════════════════════════════════════
    step(2, "系统信息")
    resp = requests.get(f"{BASE_URL}/")
    pprint(resp.json())

    # ════════════════════════════════════════════
    #  步骤 3: 触发真实搜索抓取
    # ════════════════════════════════════════════
    search_keyword = "iphone"
    step(3, f"触发搜索抓取 (关键词: {search_keyword})")
    print(f"⏳ 正在通过代理 API 抓取 noon.com 搜索结果，预计需要 30-90 秒...")
    print(f"   (ScraperAPI 会自动使用阿联酋 IP + JS 渲染绕过反爬)")

    start = time.time()
    resp = requests.post(
        f"{BASE_URL}/api/v1/tasks/search",
        json={
            "task_type": "SEARCH",
            "query": search_keyword,
            "country": "uae",
            "language": "en",
        },
        timeout=180,  # 代理渲染可能较慢
    )
    elapsed = time.time() - start

    result = resp.json()
    pprint(result)

    if result.get("status") == "SUCCESS":
        print(f"\n✅ 抓取成功！耗时 {elapsed:.1f}s")
        print(f"   📦 发现商品: {result.get('products_found', 0)} 个")
        print(f"   💾 入库商品: {result.get('products_saved', 0)} 个")
        if result.get("alerts"):
            print(f"   🚨 价格预警: {len(result['alerts'])} 个")
    else:
        print(f"\n⚠️  抓取状态: {result.get('status')}")
        print(f"   错误信息: {result.get('error')}")
        if "SCRAPERAPI_KEY" in str(result.get("error", "")):
            print("\n💡 提示: 请先去 https://www.scraperapi.com/signup 注册免费账号")
            print("   然后将 API Key 填入 .env 文件的 SCRAPERAPI_KEY 字段")
            sys.exit(1)

    # ════════════════════════════════════════════
    #  步骤 4: 查询商品列表
    # ════════════════════════════════════════════
    step(4, "查询已入库的商品列表")
    resp = requests.get(f"{BASE_URL}/api/v1/products/?limit=5")
    products = resp.json()
    if products:
        print(f"📋 前 {len(products)} 个商品:")
        for p in products:
            price_info = ""
            if p.get("price_snapshots"):
                latest = p["price_snapshots"][-1]
                price_info = f" | {latest.get('price', '?')} {latest.get('currency', 'AED')}"
            print(f"   • [{p['sku']}] {p['title'][:50]}{price_info}")
    else:
        print("⚠️  暂无商品数据")

    # ════════════════════════════════════════════
    #  步骤 5: 查询第一个商品的价格历史
    # ════════════════════════════════════════════
    if products:
        first_sku = products[0]["sku"]
        safe_sku = quote(first_sku)
        step(5, f"查询商品价格历史 (SKU: {first_sku})")
        resp = requests.get(f"{BASE_URL}/api/v1/products/{safe_sku}/prices")
        prices = resp.json()
        if prices:
            print(f"📈 价格记录 ({len(prices)} 条):")
            for p in prices:
                print(f"   • {p['scraped_at']}: {p['price']} {p['currency']}"
                      f" (原价: {p.get('original_price', 'N/A')}, 折扣: {p.get('discount_percent', 'N/A')}%)")
        else:
            print("   暂无价格记录")

    # ════════════════════════════════════════════
    #  步骤 6: 统计概览
    # ════════════════════════════════════════════
    step(6, "系统统计概览")
    resp = requests.get(f"{BASE_URL}/api/v1/products/stats")
    pprint(resp.json())

    # ════════════════════════════════════════════
    #  步骤 7: 查看任务历史
    # ════════════════════════════════════════════
    step(7, "任务执行历史")
    resp = requests.get(f"{BASE_URL}/api/v1/tasks/?limit=5")
    tasks = resp.json()
    for t in tasks:
        print(f"   • [{t['status']}] {t['task_type']}: {t['query']} "
              f"(结果: {t.get('result_count', 'N/A')} 个, job: {t.get('job_id', 'N/A')})")

    print(f"\n{'=' * 60}")
    print("  🎉 端到端全链路调试完成!")
    print(f"{'=' * 60}\n")


if __name__ == "__main__":
    main()
