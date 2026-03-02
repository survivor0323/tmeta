import os, json
from dotenv import load_dotenv
load_dotenv()
from anti_gravity_ads_logic import extract_brands_from_natural_language
brands = extract_brands_from_natural_language('유플러스', country='KR')
print('BRANDS from GPT:', brands)
import requests
key = os.getenv('SCRAPECREATORS_API_KEY')
h = {'x-api-key': key}
for b in brands[:3]:
    r = requests.get('https://api.scrapecreators.com/v1/google/adLibrary/advertisers/search', headers=h, params={'query': b})
    d = r.json()
    print(f'  [{b}] advertisers={d.get("advertisers",[])} websites={d.get("websites",[])}')
