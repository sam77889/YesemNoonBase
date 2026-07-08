import asyncio
from playwright.async_api import async_playwright
from playwright_stealth import Stealth

async def test_stealth(sku):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={'width': 1280, 'height': 800},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        )
        page = await context.new_page()
        
        # Apply stealth!
        await Stealth().apply_stealth_async(page)
        
        url = f"https://www.noon.com/uae-en/p/{sku}/"
        print(f"Fetching {url}")
        res = await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        print(f"Product page status: {res.status}")
        
        await asyncio.sleep(5) # let Akamai sensor run
        
        # Now try to hit API
        api_endpoint = f"https://www.noon.com/_svc/reviews-api/v1/product/{sku}/reviews?limit=50&offset=0&sortBy=recent"
        
        fetch_result = await page.evaluate(f"""
            async () => {{
                try {{
                    const res = await fetch("{api_endpoint}", {{
                        headers: {{
                            'Accept': 'application/json, text/plain, */*',
                            'x-platform': 'web',
                            'x-locale': 'en-ae',
                            'x-cms': 'v2'
                        }}
                    }});
                    if (res.status === 200) {{
                        const data = await res.json();
                        return {{ status: 200, data: data }};
                    }}
                    return {{ status: res.status, text: await res.text() }};
                }} catch (e) {{
                    return {{ error: e.toString() }};
                }}
            }}
        """)
        
        print("API Result:", fetch_result)
        await browser.close()

if __name__ == '__main__':
    asyncio.run(test_stealth('Z64D03ED575EEA4F3EFE8Z'))
