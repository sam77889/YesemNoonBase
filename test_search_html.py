import asyncio
from noon_scraper.fetcher import AsyncNoonScraper
import json

async def test():
    scraper = AsyncNoonScraper(impersonate="firefox")
    try:
        session = await scraper._get_session()
        url = "https://www.noon.com/uae-en/search?q=Z64D03ED575EEA4F3EFE8Z&limit=1"
        print(f"Fetching search url: {url}")
        res = await session.get(url, timeout=15)
        print(f"Search status: {res.status_code}")
        
        if '__TSR__ = ' in res.text:
            tsr_text = res.text.split('__TSR__ = ')[1].split('</script>')[0].strip().rstrip(';')
            data = json.loads(tsr_text)
            hits = data.get('props', {}).get('pageProps', {}).get('catalog', {}).get('hits', [])
            if hits:
                p_url = hits[0].get('url')
                full_url = f"https://www.noon.com/uae-en/{p_url}"
                print(f"Product URL: {full_url}")
                
                # Fetch product page
                res2 = await session.get(full_url, timeout=15)
                print(f"Product page status: {res2.status_code}")
                if 'sec-if-cpt-container' in res2.text:
                    print("Captcha in product page!")
                else:
                    print("No captcha in product page. SUCCESS.")
                    
                # Now try API
                api_headers = {
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': full_url,
                    'x-platform': 'web',
                    'x-locale': 'en-ae',
                    'x-cms': 'v2',
                }
                review_url = f"https://www.noon.com/_svc/reviews-api/v1/product/Z64D03ED575EEA4F3EFE8Z/reviews?limit=50&offset=0&sortBy=recent"
                res3 = await session.get(review_url, headers=api_headers, timeout=15)
                print(f"API status: {res3.status_code}")
                if res3.status_code == 200:
                    print("SUCCESS!")
                else:
                    print(res3.text[:100])
            else:
                print("No hits found in TSR.")
        else:
            print("No TSR found in search.")
            print(res.text[:300])
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await scraper.close()

if __name__ == '__main__':
    asyncio.run(test())
