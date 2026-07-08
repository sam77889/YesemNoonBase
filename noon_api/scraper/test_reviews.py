import asyncio
from playwright.async_api import async_playwright
from playwright_stealth import Stealth
import json

async def main():
    async with async_playwright() as p:
        browser = await p.firefox.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:115.0) Gecko/20100101 Firefox/115.0"
        )
        page = await context.new_page()
        stealth = Stealth()
        await stealth.apply_stealth_async(page)
        
        reviews_data = []
        url = "https://www.noon.com/uae-en/iphone-14-pro-max/N53346840A/p/"
        print(f"Navigating to {url}...")
        await page.goto(url, wait_until="networkidle", timeout=60000)
        
        next_data = await page.evaluate("() => window.__NEXT_DATA__")
        if next_data:
            with open("test_next_data.json", "w") as f:
                json.dump(next_data, f, indent=2)
            print("Saved __NEXT_DATA__ to test_next_data.json")
        else:
            print("No __NEXT_DATA__ found")
        
        # scroll down to trigger reviews load
        for _ in range(5):
            await page.mouse.wheel(0, 1000)
            await asyncio.sleep(1)
            
        print(f"Captured {len(reviews_data)} review responses.")
        if reviews_data:
            with open("test_reviews_output.json", "w") as f:
                json.dump(reviews_data, f, indent=2)
            print("Saved to test_reviews_output.json")
            
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
