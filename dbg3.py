import sys, os, re, logging
sys.path.insert(0, '.')
from dotenv import load_dotenv
load_dotenv()
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')

import requests, openai

keyword = '유플러스'
api_key = os.getenv('SCRAPECREATORS_API_KEY')
headers = {'x-api-key': api_key}

print('=== STEP PRE: 한글→영문 변환 ===')
if re.search(r'[가-힣]', keyword):
    client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
    resp = client.chat.completions.create(
        model='gpt-4o-mini',
        messages=[{'role': 'user', 'content': f'다음 한국 브랜드/회사명의 영문 공식 이름을 JSON 문자열로만 반환하세요(설명 없이 영문명만): "{keyword}"\n예: "LG Uplus"'}],
        max_tokens=30, temperature=0
    )
    en_keyword = resp.choices[0].message.content.strip().strip('"').strip("'")
    if en_keyword.startswith('['):
        import json as _j
        en_keyword = _j.loads(en_keyword)[0]
    print(f'GPT 영문 변환: "{keyword}" → "{en_keyword}"')
    keyword = en_keyword

print(f'\n=== STEP 1: Advertiser Search [{keyword}] ===')
r = requests.get('https://api.scrapecreators.com/v1/google/adLibrary/advertisers/search', headers=headers, params={'query': keyword})
d = r.json()
advertisers = d.get('advertisers', [])
websites = d.get('websites', [])
print(f'advertisers: {advertisers}')
print(f'websites: {websites}')

# Build targets
targets = []
for adv in advertisers[:2]:
    adv_id = adv.get('advertiserId') or adv.get('id')
    adv_name = adv.get('advertiserName') or adv.get('name', keyword)
    if adv_id:
        targets.append(('advertiser_id', adv_id, adv_name))
if not targets:
    for ws in websites[:2]:
        domain = ws.get('domain', '')
        if domain:
            targets.append(('domain', domain, keyword))
print(f'targets: {targets}')

if not targets:
    print('NO TARGETS - EARLY EXIT')
else:
    param_key, param_val, brand_name = targets[0]
    print(f'\n=== STEP 2: Company Ads [{param_key}={param_val}] ===')
    r2 = requests.get('https://api.scrapecreators.com/v1/google/company/ads', headers=headers, params={param_key: param_val, 'topic': 'all', 'get_ad_details': 'false', 'region': 'KR'})
    ads = r2.json().get('ads', [])
    print(f'ads count: {len(ads)}')
    if ads:
        print('first ad:', list(ads[0].keys()))
