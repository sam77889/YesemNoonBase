from curl_cffi import requests

def fetch_reviews(sku):
    session_ff = requests.Session(impersonate="firefox")
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/110.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
    }
    
    product_url = f"https://www.noon.com/uae-en/p/{sku}/"
    print(f"1. Fetching product page: {product_url}")
    
    try:
        res1 = session_ff.get(product_url, headers=headers, timeout=15)
        print(f"Product page status: {res1.status_code}")
        
        api_headers = {
            'User-Agent': headers['User-Agent'],
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.5',
            'Referer': product_url,
            'x-platform': 'web',
            'x-locale': 'en-ae',
            'x-cms': 'v2',
        }
        
        review_url = f"https://www.noon.com/_svc/reviews-api/v1/product/{sku}/reviews?limit=50&offset=0&sortBy=recent"
        print(f"2. Fetching reviews API: {review_url}")
        
        res2 = session_ff.get(review_url, headers=api_headers, timeout=15)
        print(f"Review API status: {res2.status_code}")
        
        if res2.status_code == 200:
            print("Success!")
        else:
            print("Failed.")
            print(res2.text[:200])
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    fetch_reviews('Z64D03ED575EEA4F3EFE8Z')
