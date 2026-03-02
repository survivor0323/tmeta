import os, requests, json
from dotenv import load_dotenv
load_dotenv()
key = os.getenv('SCRAPECREATORS_API_KEY')
h = {'x-api-key': key}

# Get ads list
r2 = requests.get('https://api.scrapecreators.com/v1/google/company/ads', headers=h, params={'domain': 'lguplus.com', 'topic': 'all', 'get_ad_details': 'false', 'region': 'KR'})
ads = r2.json().get('ads', [])
print('ADS:', len(ads))

found = 0
for ad in ads[:10]:
    ad_url = ad.get('adUrl', '')
    if not ad_url:
        continue
    r3 = requests.get('https://api.scrapecreators.com/v1/google/ad', headers=h, params={'url': ad_url})
    d = r3.json()
    fmt = d.get('format', '')
    vars_ = d.get('variations', [])
    v = vars_[0] if vars_ else {}
    img = v.get('imageUrl', '')
    vid = v.get('videoUrl', '')
    headline = v.get('headline', '')[:50]
    print(f'format={fmt} imageUrl={bool(img)} videoUrl={bool(vid)} headline={headline}')
    if img or vid:
        found += 1
print(f'with media: {found}/10')
