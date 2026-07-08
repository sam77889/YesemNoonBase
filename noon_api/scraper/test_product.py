import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.firefox.launch(headless=True)
        context = await browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0")
        page = await context.new_page()
        # Direct navigation to a known search URL to bypass search bar issues
        await page.goto("https://www.noon.com/uae-en/search/?q=iphone", timeout=60000)
        await page.wait_for_timeout(10000)
        
        # Save HTML for debugging
        html = await page.content()
        with open("products.html", "w") as f:
            f.write(html)
        
        await browser.close()

asyncio.run(main())
