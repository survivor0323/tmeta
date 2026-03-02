import requests
import json

headers = {"x-api-key": "ovCs3Wr4SdXERWu6tJb63MH0nFB2"}

urls = [
    "https://api.scrapecreators.com/v1/facebook/adLibrary/search/company?query=nike",
    "https://api.scrapecreators.com/v1/facebook/adLibrary/search/company?searchTerm=nike",
    "https://api.scrapecreators.com/v1/facebook/adLibrary/search/company?search_term=nike",
    "https://api.scrapecreators.com/v1/facebook/adLibrary/search/company?keyword=nike",
    "https://api.scrapecreators.com/v1/facebook/adLibrary/search/companies?query=nike",
    "https://api.scrapecreators.com/v1/facebook/adLibrary/search/companies?keyword=nike"
]

for url in urls:
    res = requests.get(url, headers=headers)
    print(f"GET {url} -> {res.status_code}")
    if res.status_code == 200:
        print(res.text[:200])
