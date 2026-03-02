import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("SCRAPECREATORS_API_KEY")
headers = {"x-api-key": api_key}

for q in ["KT", "uplus"]:
    url = f"https://api.scrapecreators.com/v1/facebook/adLibrary/search/companies?query={q}"
    res = requests.get(url, headers=headers).json()
    
    with open(f"tmp_search_{q}.json", "w", encoding="utf-8") as f:
        json.dump(res.get("searchResults", [])[:5], f, ensure_ascii=False, indent=2)
    print(f"Saved {q} results")
