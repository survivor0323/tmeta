import requests
import json

headers = {"x-api-key": "ovCs3Wr4SdXERWu6tJb63MH0nFB2"}

urls = [
    "https://api.scrapecreators.com/v1/facebook/adLibrary/search/companies?query=nike",
    "https://api.scrapecreators.com/v1/facebook/adLibrary/company/ads?pageId=nike"
]

with open("api_res_json.txt", "w", encoding="utf-8") as f:
    for url in urls:
        res = requests.get(url, headers=headers)
        f.write(f"GET {url} -> {res.status_code}\n")
        f.write(f"{res.text[:500]}\n\n")
