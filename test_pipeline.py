import requests
import json

headers = {"x-api-key": "ovCs3Wr4SdXERWu6tJb63MH0nFB2"}

try:
    print("Fetching company...")
    req = requests.get("https://api.scrapecreators.com/v1/facebook/adLibrary/search/companies?query=nike", headers=headers)
    data = req.json()
    page_id = data['searchResults'][0]['page_id']
    print("Page ID:", page_id)

    print(f"Fetching ads for {page_id}...")
    req2 = requests.get(f"https://api.scrapecreators.com/v1/facebook/adLibrary/company/ads?pageId={page_id}", headers=headers)
    ads = req2.json()
    
    # Save the huge json to a file to format it and see the schema
    with open("ads_sample.json", "w", encoding="utf-8") as f:
        json.dump(ads, f, indent=2, ensure_ascii=False)
    
    print("Ads snippet:", str(ads)[:500])
except Exception as e:
    print("Error:", e)
