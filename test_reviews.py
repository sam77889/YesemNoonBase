from curl_cffi import requests

def test():
    sku = 'Z64D03ED575EEA4F3EFE8Z'
    url = f"https://www.noon.com/uae-en/p/{sku}/"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
    }
    
    try:
        response = requests.get(url, headers=headers, impersonate="chrome110", timeout=15)
        print(f"Status Code: {response.status_code}")
        
        if 'window.__NEXT_DATA__' in response.text:
            print("Found __NEXT_DATA__")
        else:
            print("Not found __NEXT_DATA__")
        
        if 'Access Denied' in response.text:
            print("Akamai Blocked!")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    test()
