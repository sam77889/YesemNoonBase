import asyncio
from curl_cffi import requests

async def test():
    sku = "N11426623A"
    url = f"https://www.noon.com/uae-en/{sku}/p/"
    session = requests.AsyncSession(impersonate="firefox")
    try:
        res = await session.get(url, timeout=15)
        print(f"Product page status: {res.status_code}")
        if res.status_code == 200:
            if 'sec-if-cpt-container' in res.text:
                print("Captcha!")
            else:
                print("Length:", len(res.text))
                if 'review' in res.text.lower():
                    print("Found 'review' in HTML.")
                    # Let's save it to look at it
                    with open("product_page.html", "w") as f:
                        f.write(res.text)
                else:
                    print("No review word found.")
        else:
            print("Failed to fetch.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await session.close()

if __name__ == '__main__':
    asyncio.run(test())
