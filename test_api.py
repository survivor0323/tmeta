import requests

api_key = "ovCs3Wr4SdXERWu6tJb63MH0nFB2"
headers = {"Authorization": f"Bearer {api_key}"}

# Testing endpoints
endpoints = [
    "https://api.scrapecreators.com/v1/facebook/ads/search?keyword=nike",
    "https://api.scrapecreators.com/v1/facebook/ad_library?q=nike",
    "https://api.scrapecreators.com/v1/meta/ads?keyword=nike"
]

for url in endpoints:
    print(f"Testing URL: {url}")
    try:
        req = requests.get(url, headers=headers)
        print(req.status_code, req.text[:200])
    except Exception as e:
        print("Error:", e)
