import requests

api_key = "ovCs3Wr4SdXERWu6tJb63MH0nFB2"
headers = {"x-api-key": api_key}
headers_auth = {"Authorization": f"Bearer {api_key}"}

endpoints = [
    "https://api.scrapecreators.com/v1/facebook/adLibrary/ad?id=702369045530963",
    "https://api.scrapecreators.com/v1/facebook/adLibrary/search/ads?query=nike",
    "https://api.scrapecreators.com/v1/facebook/adLibrary/search/company?query=nike",
    "https://api.scrapecreators.com/v1/facebook/adLibrary/company/ads?company=nike",
    "https://api.scrapecreators.com/v1/facebook/adLibrary/search?query=nike"
]

print("--- Testing with x-api-key ---")
for url in endpoints:
    res = requests.get(url, headers=headers)
    print(f"GET {url}")
    print(f"Status: {res.status_code}")
    print(f"Text: {res.text[:100]}\n")

print("--- Testing with Authorization Bearer ---")
for url in endpoints:
    res = requests.get(url, headers=headers_auth)
    print(f"GET {url}")
    print(f"Status: {res.status_code}")
    print(f"Text: {res.text[:100]}\n")
