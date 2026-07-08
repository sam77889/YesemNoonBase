import asyncio
from playwright.async_api import async_playwright
import pandas as pd
import json

from playwright_stealth import stealth

async def main():
    async with async_playwright() as p:
        # 启动 Firefox 浏览器，尝试绕过反爬机制 (HTTP/2 Protocol Error)
        browser = await p.firefox.launch(headless=True)
        # 伪装 User-Agent 防止被直接拦截
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0"
        )
        page = await context.new_page()
        # 注入 stealth 脚本，隐藏 Playwright 特征
        await stealth(page)

        print("正在访问 noon.com (阿联酋站)...")
        # 访问阿联酋站
        await page.goto("https://www.noon.com/uae-en/", timeout=60000)
        
        search_query = "iphone"
        print(f"正在搜索商品: {search_query}")
        
        # 等待搜索框加载 (NOON 更新了元素的 id 为 search-input)
        search_input_selector = 'input[id="search-input"]' 
        await page.wait_for_selector(search_input_selector, timeout=30000)
        # 填入搜索词并回车
        await page.fill(search_input_selector, search_query)
        await page.press(search_input_selector, "Enter")

        print("等待商品列表加载...")
        # 等待商品名称元素出现
        await page.wait_for_selector('[data-qa="product-name"]', timeout=30000)
        
        # 模拟真人滚动，加载更多商品（懒加载）
        for i in range(3):
            await page.mouse.wheel(0, 1000)
            await asyncio.sleep(1)

        print("正在提取商品数据...")
        
        # 使用 page.evaluate 在浏览器上下文中执行 JS，提取商品数据
        # 这里的选择器是根据 NOON 常见的页面结构编写的，可能需要根据实际 DOM 进行微调
        data = await page.evaluate('''() => {
            const items = [];
            // NOON 的商品卡片通常以 id="productBox-..." 的 a 标签包裹
            const productNodes = document.querySelectorAll('a[id^="productBox"]');
            productNodes.forEach(node => {
                const titleNode = node.querySelector('[data-qa="product-name"]');
                // 价格节点可能有不同的结构，通常带有 class 'amount' 或是在 currency span 后面
                const priceNode = node.querySelector('.amount') || node.querySelector('strong');
                
                const title = titleNode ? titleNode.innerText.trim() : "N/A";
                const price = priceNode ? priceNode.innerText.trim() : "N/A";
                const link = node.href;
                
                if (title !== "N/A") {
                    items.push({
                        "title": title,
                        "price": price,
                        "link": link
                    });
                }
            });
            return items;
        }''')
        
        print(f"成功提取 {len(data)} 条商品信息。")
        
        # 使用 pandas 将数据保存为 CSV
        df = pd.DataFrame(data)
        output_file = "noon_products.csv"
        df.to_csv(output_file, index=False, encoding='utf-8-sig')
        print(f"数据已保存至: {output_file}")
        
        if not df.empty:
            print("\n前5条样本数据:")
            print(df.head())
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
