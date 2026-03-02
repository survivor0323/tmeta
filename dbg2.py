import sys, os
sys.path.insert(0, '.')
from dotenv import load_dotenv
load_dotenv()

import logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger('anti_gravity_ads_logic')
logger.setLevel(logging.DEBUG)

# manually run pre-step
import re, openai as _openai
keyword = 'LG유플러스'
print('INPUT keyword:', keyword)

if re.search(r'[가-힣]', keyword):
    _client = _openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    _resp = _client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": f'다음 한국 브랜드/회사명의 영문 공식 이름을 JSON 문자열로만 반환하세요(설명 없이 영문명만): "{keyword}"\n예: "LG Uplus"'}],
        max_tokens=30, temperature=0
    )
    en_keyword = _resp.choices[0].message.content.strip().strip('"').strip("'")
    if en_keyword.startswith('['):
        import json as _j
        en_keyword = _j.loads(en_keyword)[0]
    print('EN keyword:', en_keyword)
    keyword = en_keyword

import requests
key = os.getenv('SCRAPECREATORS_API_KEY')
h = {'x-api-key': key}
r = requests.get('https://api.scrapecreators.com/v1/google/adLibrary/advertisers/search', headers=h, params={'query': keyword})
d = r.json()
print('advertisers:', d.get('advertisers'))
print('websites:', d.get('websites'))
