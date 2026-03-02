import requests

api_key = "ovCs3Wr4SdXERWu6tJb63MH0nFB2"
headers = {"Authorization": f"Bearer {api_key}"}

url = "https://api.scrapecreators.com/v1/facebook/adLibrary/search/ads?query=nike"
print(f"Testing URL: {url}")
try:
    req = requests.get(url, headers=headers)
    print(req.status_code, req.text[:500])
except Exception as e:
    print("Error:", e)
