import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.firefox.launch(headless=True)
        context = await browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0")
        page = await context.new_page()
        await page.goto("https://www.noon.com/uae-en/", timeout=60000)
        await page.wait_for_timeout(5000) # Wait 5s for react to render
        inputs = await page.evaluate('''() => {
            return Array.from(document.querySelectorAll('input')).map(i => ({id: i.id, type: i.type, placeholder: i.placeholder, class: i.className}))
        }''')
        print(inputs)
        await browser.close()

asyncio.run(main())
