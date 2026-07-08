import asyncio
from noon_scraper.fetcher import AsyncNoonScraper
from bs4 import BeautifulSoup

async def test():
    scraper = AsyncNoonScraper(impersonate="firefox")
    try:
        session = await scraper._get_session()
        
        # Test 1: Fetch Search Page to get correct URL
        url = "https://www.noon.com/uae-en/search?q=Z64D03ED575EEA4F3EFE8Z&limit=50"
        res = await session.get(url, timeout=15)
        print(f"Search status: {res.status_code}")
        
        soup = BeautifulSoup(res.text, "lxml")
        links = []
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if "/p/" in href and "/N" in href:
                links.append(href if href.startswith("http") else "https://www.noon.com" + href)
                
        if links:
            p_url = links[0]
            print(f"Product URL: {p_url}")
            
            # Fetch product page
            res2 = await session.get(p_url, timeout=15)
            print(f"Product page status: {res2.status_code}")
            if 'sec-if-cpt-container' in res2.text:
                print("Captcha in product page!")
            else:
                print("No captcha! Length:", len(res2.text))
                
                # Check for reviews inside product page HTML
                if 'review' in res2.text.lower():
                    print("Found 'review' in HTML.")
                
                # We can also try the review API here since we hit the exact product page!
                api_headers = {
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': p_url,
                    'x-platform': 'web',
                    'x-locale': 'en-ae',
                    'x-cms': 'v2',
                }
                sku = p_url.split('/N')[1].split('/')[0]
                review_url = f"https://www.noon.com/_svc/reviews-api/v1/product/N{sku}/reviews?limit=50&offset=0&sortBy=recent"
                print(f"Review API URL: {review_url}")
                res3 = await session.get(review_url, headers=api_headers, timeout=15)
                print(f"API status: {res3.status_code}")
        else:
            print("No links found.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await scraper.close()

if __name__ == '__main__':
    asyncio.run(test())
