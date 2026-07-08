import undetected_chromedriver as uc
import time
import json

def test_uc(sku):
    options = uc.ChromeOptions()
    # options.headless = True # NO HEADLESS
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--window-size=1280,800')
    
    driver = uc.Chrome(options=options)
    
    url = f"https://www.noon.com/uae-en/p/{sku}/"
    print(f"Fetching {url} using undetected-chromedriver with xvfb")
    
    driver.get(url)
    time.sleep(5)
    
    # Get reviews using execute_script fetch
    api_endpoint = f"https://www.noon.com/_svc/reviews-api/v1/product/{sku}/reviews?limit=50&offset=0&sortBy=recent"
    
    fetch_result = driver.execute_async_script(f"""
        var callback = arguments[arguments.length - 1];
        fetch("{api_endpoint}", {{
            headers: {{
                'Accept': 'application/json, text/plain, */*',
                'x-platform': 'web',
                'x-locale': 'en-ae',
                'x-cms': 'v2'
            }}
        }}).then(res => {{
            if(res.status === 200) return res.json().then(data => callback({{status: 200, data: data}}));
            return res.text().then(text => callback({{status: res.status, text: text}}));
        }}).catch(e => callback({{error: e.toString()}}));
    """)
    
    print("API Result:", str(fetch_result)[:500])
    driver.quit()

if __name__ == '__main__':
    test_uc('N11426623A')
