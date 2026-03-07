import os
import time
import logging
from datetime import datetime
from typing import List, Dict, Any
from dotenv import load_dotenv

try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    cv2 = None
    CV2_AVAILABLE = False
import base64
import requests
import tempfile
from openai import OpenAI

# .env 파일 명시적 로드
load_dotenv()


logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ScrapeCreatorsCreditError(Exception):
    """크레딧 고갈 시 발생하는 커스텀 에러"""
    pass

class RateLimitExceededError(Exception):
    """API 속도 제한 초과 시 발생하는 커스텀 에러"""
    pass

# --- 가상의 MCP 도구 호출 래퍼 (실제 구현체로 대체 필요) ---
def mcp_get_meta_platform_id(brand_names: str | List[str]) -> Dict[str, str]: 
    # 단일 문자열 또는 배열을 받아, 브랜드명과 page_id 매핑 딕셔너리를 반환한다고 가정
    pass

def mcp_get_meta_ads(page_ids: str | List[str]) -> Dict[str, List[Dict]]: 
    # 단일 문자열 또는 배열을 받아, 각 page_id별 광고 리스트를 반환한다고 가정
    pass

def mcp_analyze_ad_image(image_url: str, prompt: str) -> Dict: 
    pass

def analyze_video_with_chatgpt(video_url: str, prompt: str) -> Dict:
    """
    ChatGPT(gpt-4o 등) 비전 API를 활용한 비디오 분석 래퍼 함수입니다.
    (주의: 실제 환경에서는 비디오의 주요 프레임을 추출하여 base64로 변환한 뒤, 
    OpenAI API에 이미지 배열 형식으로 전달하는 전처리 로직이 필요합니다.)
    """
    # client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    # response = client.chat.completions.create(...)
    pass

def mcp_search_cached_media(query_params: Dict) -> List[Dict]: 
    pass

def mcp_get_cache_stats() -> Dict:
    pass


# --- 0. 예외 처리 및 재시도 데코레이터 ---
def with_retry_and_error_handling(max_retries=3, base_delay=5):
    """Rate Limit 처리 및 크레딧 고갈 에러를 지능적으로 핸들링하는 데코레이터"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            retries = 0
            while retries < max_retries:
                try:
                    return func(*args, **kwargs)
                except RateLimitExceededError:
                    # Exponential Backoff 적용 (점진적으로 대기시간 증가)
                    wait_time = base_delay * (2 ** retries)  
                    logger.warning(f"Rate Limit 초과. {wait_time}초 후 재시도합니다... ({retries + 1}/{max_retries})")
                    time.sleep(wait_time)
                    retries += 1
                except ScrapeCreatorsCreditError:
                    dashboard_url = os.getenv("CREDIT_DASHBOARD_URL", "https://dashboard.scrapecreators.com/billing")
                    logger.error(f"🔴 ScrapeCreators API 크레딧이 고갈되었습니다. 대시보드에서 크레딧을 충전해주세요: {dashboard_url}")
                    # TODO: 슬랙 웹훅 등 알림 로직 연동 포인트
                    raise
            raise Exception("최대 재시도 횟수를 초과해 API 요청에 실패했습니다.")
        return wrapper
    return decorator


# --- 1. 다중 경쟁사 자동 모니터링 및 배치 처리 ---
@with_retry_and_error_handling()
def fetch_competitor_ads_batch(brand_names: List[str], country: str = "KR") -> Dict[str, List[Dict]]:
    """사용자가 입력한 검색어와 API 키를 바탕으로 ScrapeCreators API에 접속해 실제 Meta 광고를 수집합니다.
    country: 광고 타겟 국가 코드 (기본값 KR - 한국 타겟 광고만 수집)
    """
    import requests

    api_key = os.getenv("SCRAPECREATORS_API_KEY", "")
    unique_brands = list(set(brand_names))
    results = {}

    if not api_key or api_key == "your_scrapecreators_api_key_here":
        raise ValueError("API 키가 없습니다. .env 파일에 SCRAPECREATORS_API_KEY를 설정해주세요.")

    headers = {
        "x-api-key": api_key
    }

    logger.info(f"총 {len(unique_brands)}개의 고유 브랜드에 대한 실제 Meta 광고 스크래핑을 시작합니다.")

    for brand in unique_brands:
        try:
            # Step 1: 브랜드명으로 메타 page_id 검색
            url_company = f"https://api.scrapecreators.com/v1/facebook/adLibrary/search/companies?query={brand}"
            logger.info(f"[{brand}] 브랜드 식별자(page_id) 검색 중...")
            
            res_company = requests.get(url_company, headers=headers)
            
            if res_company.status_code == 401:
                raise ScrapeCreatorsCreditError("API 키 인증 실패(401 Unauthorized). 키를 점검하거나 새로 발급받아주세요.")
            elif res_company.status_code == 429:
                raise RateLimitExceededError("Meta 광고 스크래핑 한도 초과(429).")
            elif res_company.status_code != 200:
                raise Exception(f"Company 검색 서버 응답 실패 ({res_company.status_code}): {res_company.text}")
                
            company_data = res_company.json()
            search_results = company_data.get('searchResults', [])
            
            if not search_results:
                logger.warning(f"[{brand}] 일치하는 메타 페이지 정보를 찾을 수 없습니다.")
                results[brand] = []
                continue
                
            # 1. 좋아요(likes) 기준 상위 정렬
            # 2. 검색어와 정확히 일치하는(또는 매우 유사한) 이름을 가진 페이지 우선
            # 우선순위: (정확도 매치 여부, 좋아요 수)
            def score_page(p):
                name = p.get('name', p.get('page_name', '')).lower()
                q = brand.lower()
                # 쿼리와 정확히 일치하면 아주 높은 가산점
                exact_match = 1 if q == name else 0
                # 부분 일치
                partial_match = 1 if q in name else 0
                return (exact_match, partial_match, p.get('likes') or 0)
                
            search_results.sort(key=score_page, reverse=True)
            
            # 상위 4개 페이지를 순회하며 실제로 광고가 있는 페이지의 데이터가 확보되면 해당 브랜드 스크래핑 완료 처리
            top_pages = search_results[:4]
            ads_list = []
            
            for page_info in top_pages:
                page_id = page_info.get('page_id')
                if not page_id:
                    continue
                    
                # Step 2: page_id를 이용해 실제 구동 중인 광고 목록 조회
                # country 파라미터를 추가하여 해당 국가를 타겟으로 한 광고만 수집 (기본: KR)
                url_ads = "https://api.scrapecreators.com/v1/facebook/adLibrary/company/ads"
                ads_params = {"pageId": page_id, "limit": 100}
                if country:
                    ads_params["country"] = country
                
                has_next = True
                cursor = None
                pages_fetched = 0
                max_pages = 4
                
                while has_next and pages_fetched < max_pages:
                    if cursor:
                        ads_params["cursor"] = cursor
                        
                    logger.info(f"[{brand}] 실전 메타 광고 데이터 요청 중 (Page Name: {page_info.get('name', page_info.get('page_name', 'Unknown'))}, Page: {pages_fetched+1}/{max_pages})")
                    
                    res_ads = requests.get(url_ads, headers=headers, params=ads_params)
                    
                    if res_ads.status_code == 401:
                        raise ScrapeCreatorsCreditError("API 키 인증 실패(401 Unauthorized)")
                    elif res_ads.status_code == 429:
                        raise RateLimitExceededError("Meta 광고 스크래핑 한도 초과(429)")
                    elif res_ads.status_code != 200:
                        logger.error(f"Ads 서버 응답 실패 ({res_ads.status_code}): {res_ads.text}")
                        break
                        
                    ads_data = res_ads.json()
                    items = ads_data.get('results', [])
                    if not isinstance(items, list):
                        items = []
                        
                    for item in items:
                        snapshot = item.get('snapshot', {})
                        cards = snapshot.get('cards', [])
                        videos = snapshot.get('videos', [])
                        images = snapshot.get('images', [])
                        
                        video_url = ""
                        image_url = ""
                        
                        if videos:
                            video_url = videos[0].get('video_hd_url') or videos[0].get('video_sd_url') or ""
                        if not video_url and cards:
                            video_url = cards[0].get('video_hd_url') or cards[0].get('video_sd_url') or ""
                            
                        if images:
                            image_url = images[0].get('original_image_url') or images[0].get('resized_image_url') or ""
                        if not image_url and cards:
                            image_url = cards[0].get('original_image_url') or cards[0].get('resized_image_url') or ""
                            
                        body_dict = snapshot.get('body') or {}
                        body_text = body_dict.get('text', '')
                        if not body_text and snapshot.get('message'):
                            body_text = snapshot.get('message', '')
                        if not body_text and snapshot.get('title'):
                            body_text = snapshot.get('title', '')
                            
                        if not body_text and cards:
                            card = cards[0]
                            body_text = card.get('body', '')
                            if not body_text:
                                body_text = card.get('caption', card.get('title', card.get('message', '')))
                        
                        if not body_text:
                            body_text = snapshot.get('caption', '')
                            
                        start_date_string = item.get('start_date_string', '')
                        start_date = start_date_string if start_date_string else "2024-01-01"
                        
                        ad_id = item.get('id', '')

                        ad_format = {
                            "ad_id": ad_id,
                            "brand": snapshot.get('page_name', page_info.get('name', brand)),
                            "platform": "meta",
                            "media_type": "video" if video_url else "image",
                            "media_url": video_url if video_url else image_url,
                            "start_date": start_date,
                            "body": body_text,
                            "analysis_report": {
                                "hook": "해당 실제 광고 영상의 시각적 요소 분석 대기 중...",
                                "body": body_text[:150] if body_text else "수집된 실제 메타 광고 카피가 없습니다.", 
                                "cta": snapshot.get('cta_text', "사용자 행동 유도(CTA) 버튼 추적 중...")
                            }
                        }
                        ads_list.append(ad_format)
                        
                    cursor = ads_data.get("cursor")
                    if not cursor:
                        has_next = False
                        
                    pages_fetched += 1
                
                # 만약 이 페이지에서 실제 광고 데이터를 찾았다면 (보통 공식 페이지),
                # 엉뚱한 동명이인/유사 페이지를 계속 긁지 않고 바로 넘어갑니다.
                if ads_list:
                    break

                
            if ads_list:
                results[brand] = ads_list
                logger.info(f"[{brand}] {len(ads_list)}개의 진짜 온라인 광고 데이터를 성공적으로 수집했습니다.")
            else:
                logger.warning(f"[{brand}] 응답은 정상이지만 해당 검색어에 대한 광고가 메타에 없습니다.")
                results[brand] = []

        except Exception as e:
            logger.error(f"[{brand}] 요청 중 에러 발생: {str(e)}")
            raise

    return results

def fetch_tiktok_creatives(keyword: str, country: str = "KR", search_type: str = "keyword", max_pages: int = 3) -> List[Dict]:
    """ScrapeCreators TikTok API를 활용해 바이럴 영상을 가져옵니다."""
    logger.info(f"[*] TikTok API 검색 시작: {keyword} (Country: {country}, Type: {search_type})")
    api_key = os.getenv("SCRAPECREATORS_API_KEY")
    headers = {"x-api-key": api_key}
    
    if search_type == "hashtag":
        url = "https://api.scrapecreators.com/v1/tiktok/search/hashtag"
        params = {
            "hashtag": keyword.replace("#", ""), # 문서대로 hashtag 키 사용
            "sort_by": "relevance"
        }
    else:
        url = "https://api.scrapecreators.com/v1/tiktok/search/keyword"
        params = {
            "query": keyword, # keyword 검색 시엔 query 사용
            "sort_by": "relevance"
        }
        
    if country:
        params["region"] = country
    
    creatives = []
    
    try:
        cursor = 0
        for page in range(1, max_pages + 1):
            if search_type == "hashtag":
                params["cursor"] = cursor
            else:
                params["offset"] = cursor
                
            response = requests.get(url, headers=headers, params=params)
            
            if response.status_code != 200:
                logger.error(f"[!] TikTok API 오류: {response.text}")
                break
                
            data = response.json()
            
            # 해시태그 검색과 키워드 검색의 응답 구조가 다름
            if search_type == "hashtag":
                items = data.get("aweme_list", [])
            else:
                items = data.get("search_item_list", [])
                
            if not items:
                break
        
            for item in items:
                aweme = item if search_type == "hashtag" else item.get("aweme_info", {})
                if not aweme:
                    continue
                    
                desc = aweme.get("desc", "")
                create_time = aweme.get("create_time", 0)
                
                start_date = "N/A"
                if create_time:
                    start_date = datetime.fromtimestamp(create_time).strftime('%Y-%m-%d')
                    
                stats = aweme.get("statistics", {})
                likes = stats.get("digg_count", 0)
                comments = stats.get("comment_count", 0)
                
                author = aweme.get("author", {})
                page_name = author.get("nickname", "Unknown TikToker")
                page_profile_uri = ""
                if author.get("avatar_thumb") and author["avatar_thumb"].get("url_list"):
                    page_profile_uri = author["avatar_thumb"]["url_list"][0]
                
                video_info = aweme.get("video", {})
                video_url = ""
                if "download_no_watermark_addr" in video_info and video_info["download_no_watermark_addr"].get("url_list"):
                    video_url = video_info["download_no_watermark_addr"]["url_list"][0]
                elif "play_addr" in video_info and video_info["play_addr"].get("url_list"):
                    video_url = video_info["play_addr"]["url_list"][0]
                    
                cover_url = ""
                if "cover" in video_info and video_info["cover"].get("url_list"):
                    cover_url = video_info["cover"]["url_list"][0]
                    
                if not video_url and not cover_url: 
                    continue
                    
                ad_id = str(aweme.get("id", ""))
                hashtags = []
                text_extra = aweme.get("text_extra", [])
                if isinstance(text_extra, list):
                    for extra in text_extra:
                        hashtag_name = extra.get("hashtag_name")
                        if hashtag_name:
                            hashtags.append(f"#{hashtag_name}")

                creatives.append({
                    "ad_id": ad_id,
                    "brand": page_name,
                    "page_name": page_name,
                    "page_profile_uri": page_profile_uri,
                    "start_date": start_date,
                    "end_date": "Currently Active",
                    "media_type": "video",
                    "media_url": video_url,
                    "image_url": cover_url,
                    "body": desc,
                    "likes": likes,
                    "comments": comments,
                    "hashtags": hashtags,
                    "platform": "tiktok",
                    "direct_link": f"https://www.tiktok.com/@{author.get('unique_id', 'user')}/video/{ad_id}",
                    "analysis_report": {
                        "hook": "TikTok 분석 대기 중...",
                        "body": desc[:150] if desc else "본문 정보 없음",
                        "cta": "TikTok 바이럴 유도"
                    }
                })
                
            # 페이지네이션 처리
            has_more = data.get("has_more")
            if not has_more:
                break
                
            cursor = data.get("cursor", 0)
            if not cursor:
                break
                
    except Exception as e:
        logger.error(f"[!] TikTok API 요청 중 예외 발생: {e}")
        
    logger.info(f"[*] TikTok 검색 완료. 추출된 소재 수: {len(creatives)}")
    return creatives

def fetch_instagram_reels(keyword: str, max_pages: int = 3) -> List[Dict]:
    """ScrapeCreators Instagram API를 활용해 릴스 영상을 가져옵니다."""
    logger.info(f"[*] Instagram Reels API 검색 시작: {keyword}")
    api_key = os.getenv("SCRAPECREATORS_API_KEY")
    url = "https://api.scrapecreators.com/v2/instagram/reels/search"
    headers = {"x-api-key": api_key}
    
    creatives = []
    
    try:
        for page in range(1, max_pages + 1):
            params = {
                "query": keyword, # 인스타 릴스 검색어
                "page": page
            }
            logger.info(f"[*] Instagram Reels API 요청: {keyword} (Page {page}/{max_pages})")
            response = requests.get(url, headers=headers, params=params)
            
            if response.status_code != 200:
                logger.error(f"[!] Instagram API 오류: {response.text}")
                break
                
            # 응답 구조가 reels 배열을 내려줌 
            res_json = response.json()
            items = res_json.get("reels", [])
            
            if not items:
                break
            
            for item in items:
                if not isinstance(item, dict): continue
                
                # API 응답 구조를 기반으로 추출 (인스타그램 릴스 json 구조)
                ad_id = str(item.get("id", item.get("shortcode", "")))
                if not ad_id: continue
                
                owner = item.get("owner", {})
                page_name = owner.get("username", "Unknown Instagrammer")
                page_profile_uri = owner.get("profile_pic_url", "")
                
                desc = item.get("caption", "")
                
                start_date_str = str(item.get("taken_at", ""))
                start_date = "N/A"
                if start_date_str.isdigit():
                    try:
                        dt = datetime.fromtimestamp(int(start_date_str))
                        start_date = dt.strftime('%Y-%m-%d')
                    except:
                        pass
                elif len(start_date_str) > 10:
                    start_date = start_date_str[:10]
                    
                # 비디오/이미지 URL 추출
                video_url = item.get("video_url", "")
                cover_url = item.get("thumbnail_src", item.get("display_url", ""))
                    
                if not video_url and not cover_url: 
                    continue
                    
                likes = item.get("like_count", 0)
                if likes == -1: likes = 0 # 숨김 처리된 좋아요 방어
                comments = item.get("comment_count", 0)
                
                shortcode = item.get("shortcode")
                direct_link = f"https://www.instagram.com/reel/{shortcode}/" if shortcode else f"https://www.instagram.com/{page_name}/"
                
                creatives.append({
                    "ad_id": ad_id,
                    "brand": page_name,
                    "page_name": page_name,
                    "page_profile_uri": page_profile_uri,
                    "start_date": start_date,
                    "end_date": "Currently Active",
                    "media_type": "video" if video_url else "image",
                    "media_url": video_url or cover_url,
                    "image_url": cover_url,
                    "body": desc,
                    "likes": likes,
                    "comments": comments,
                    "hashtags": [],
                    "platform": "instagram",
                    "direct_link": direct_link,
                    "analysis_report": {
                        "hook": "Instagram 분석 대기 중...",
                        "body": desc[:150] if desc else "본문 정보 없음",
                        "cta": "Instagram 바이럴 유도"
                    }
                })
            
            # 다음 페이지가 없으면 루프 탈출
            if res_json.get("has_more") is False:
                break
                
    except Exception as e:
        logger.error(f"[!] Instagram API 요청 중 예외 발생: {e}")
        
    logger.info(f"[*] Instagram 검색 완료. 추출된 소재 수: {len(creatives)}")
    return creatives

def fetch_google_ads(keyword: str, country: str = None, max_ads: int = 30) -> List[Dict]:
    """ScrapeCreators Google Ad Transparency API로 Google 광고를 검색합니다.
    
    흐름: 광고주 검색(advertisers or websites.domain) -> 광고 목록 조회 -> 광고 상세 조회
    """
    logger.info(f"[*] Google Ads API 검색 시작: {keyword} (Country: {country})")
    api_key = os.getenv("SCRAPECREATORS_API_KEY")
    headers = {"x-api-key": api_key}
    creatives = []
    ads_url = "https://api.scrapecreators.com/v1/google/company/ads"
    
    try:
        # --- [Pre-step] 한글 키워드 영문 정제 ---
        # Google Advertiser Search API는 한글 검색어가 제대로 작동하지 않으므로
        # 한글이 포함된 경우 GPT를 통해 영문 회사 공식명으로 변환합니다.
        import re
        if re.search(r'[가-힣]', keyword):
            try:
                import openai as _openai
                _client = _openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))
                _resp = _client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{
                        "role": "system",
                        "content": "You are a brand name translator. Return ONLY the official English name of the brand, nothing else. No JSON, no markdown, no explanation."
                    }, {
                        "role": "user",
                        "content": f"Korean brand: {keyword}\nOfficial English name:"
                    }],
                    max_tokens=20,
                    temperature=0
                )
                en_raw = _resp.choices[0].message.content.strip()
                # 마크다운 코드블록 제거
                en_raw = re.sub(r'```[a-z]*\n?', '', en_raw).strip('`').strip()
                # 따옴표 제거
                en_keyword = en_raw.strip('"').strip("'").strip()
                # JSON 배열 형태면 첫 번째 요소만
                if en_keyword.startswith('['):
                    import json as _j
                    try:
                        en_keyword = _j.loads(en_keyword)[0]
                    except Exception:
                        en_keyword = en_keyword.strip('[]').strip('"').strip("'")
                # 영문+공백만 있는 경우만 사용 (한글이 섞이면 원본 유지)
                if en_keyword and not re.search(r'[가-힣]', en_keyword):
                    logger.info(f"[*] Google 검색어 영문 변환: '{keyword}' → '{en_keyword}'")
                    keyword = en_keyword
                else:
                    logger.warning(f"[!] 영문 변환 결과에 한글 포함, 원본 유지: '{en_keyword}'")
            except Exception as _e:
                logger.warning(f"[!] 영문 변환 실패, 원본 사용: {_e}")

        # --- Step 1: 광고주 검색 ---
        res = requests.get(
            "https://api.scrapecreators.com/v1/google/adLibrary/advertisers/search",
            headers=headers,
            params={"query": keyword}
        )
        if res.status_code != 200:
            logger.error(f"[!] Google 광고주 검색 실패: {res.text}")
            return creatives
            
        search_data = res.json()
        advertisers = search_data.get("advertisers", [])
        websites = search_data.get("websites", [])
        
        # --- 광고 목록 조회 대상 결정 ---
        # advertiser_id가 있으면 advertiser_id로, 없으면 websites.domain으로 조회
        targets = []  # List of (param_key, param_value, display_name)
        
        for adv in advertisers[:2]:
            adv_id = adv.get("advertiserId") or adv.get("id")
            adv_name = adv.get("advertiserName") or adv.get("name", keyword)
            if adv_id:
                targets.append(("advertiser_id", adv_id, adv_name))
                
        if not targets:
            # advertisers 없을 때 websites 도메인으로 폴백
            for ws in websites[:2]:
                domain = ws.get("domain", "")
                if domain:
                    targets.append(("domain", domain, keyword))
                    
        if not targets:
            logger.warning(f"[!] '{keyword}' 와 일치하는 Google 광고주/도메인 없음")
            return creatives
            
        # --- Step 2: 광고 목록 조회 ---
        for param_key, param_val, brand_name in targets:
            ads_params = {
                param_key: param_val,
                "topic": "all",
                "get_ad_details": "false"
            }
            if country:
                ads_params["region"] = country
                
            ads_res = requests.get(ads_url, headers=headers, params=ads_params)
            if ads_res.status_code != 200:
                logger.error(f"[!] Google 광고 목록 조회 실패: {ads_res.text}")
                continue
                
            ad_items = ads_res.json().get("ads", [])
            logger.info(f"[*] '{brand_name}' Google 광고 목록: {len(ad_items)}건")
            
            for ad_item in ad_items[:max_ads]:
                ad_url = ad_item.get("adUrl", "")
                advertiser_id = ad_item.get("advertiserId", "")
                creative_id = ad_item.get("creativeId", "")
                
                if not ad_url:
                    if advertiser_id and creative_id:
                        ad_url = f"https://adstransparency.google.com/advertiser/{advertiser_id}/creative/{creative_id}"
                    else:
                        continue
                
                # --- Step 3: 광고 상세 조회 ---
                detail_res = requests.get(
                    "https://api.scrapecreators.com/v1/google/ad",
                    headers=headers,
                    params={"url": ad_url}
                )
                if detail_res.status_code != 200:
                    continue
                    
                detail = detail_res.json()
                
                # format 추출: 'text', 'image', 'video' 등
                ad_format = detail.get("format", "text")
                variations = detail.get("variations", [])
                
                # 첫 번째 변형을 기준으로 정보 추출
                var = variations[0] if variations else {}
                
                headline = var.get("headline", "")
                description = var.get("description", var.get("allText", ""))
                image_url = var.get("imageUrl", "")
                video_url = var.get("videoUrl", "")
                
                # 이미지/비디오 모두 없으면 건너뜀
                if not image_url and not video_url:
                    continue
                    
                body = f"{headline} {description}".strip()
                
                start_date = detail.get("firstShown") or ad_item.get("firstShown") or "N/A"
                if start_date and start_date != "N/A" and len(start_date) > 10:
                    start_date = start_date[:10]
                    
                creatives.append({
                    "ad_id": creative_id or str(len(creatives)),
                    "brand": brand_name,
                    "page_name": brand_name,
                    "page_profile_uri": "",
                    "start_date": start_date,
                    "end_date": "Currently Active",
                    "media_type": "video" if video_url else "image",
                    "media_url": video_url or image_url,
                    "image_url": image_url,
                    "body": body,
                    "likes": 0,
                    "comments": 0,
                    "hashtags": [],
                    "platform": "google",
                    "direct_link": ad_url,
                    "analysis_report": {
                        "hook": "Google 광고 분석 대기 중...",
                        "body": body[:150] if body else "광고 카피 없음",
                        "cta": "Google 광고 클릭 유도"
                    }
                })
                
            logger.info(f"[*] 누적 Google 광고 추출 수: {len(creatives)}")
            
    except Exception as e:
        logger.error(f"[!] Google Ads API 예외 발생: {e}")
        
    logger.info(f"[*] Google Ads 검색 완료. 총 {len(creatives)}건 추출")
    return creatives

# --- 2. '게재 기간' 기반 위닝 소재 추출기 ---
def extract_winning_creatives(ads: List[Dict], min_months_active: int = 3) -> List[Dict]:
    """수집된 광고 중 N개월 이상 장기 게재된 위닝 소재를 추출합니다."""
    winning_ads = []
    current_date = datetime.now()
    min_days_active = min_months_active * 30
    
    for ad in ads:
        start_date_str = ad.get("start_date")
        if not start_date_str:
            continue
            
        try:
            # start_date 텍스트를 날짜 객체로 파싱
            if "T" in str(start_date_str):
                start_date_str = str(start_date_str).split("T")[0]
            start_date = datetime.strptime(str(start_date_str), "%Y-%m-%d")
            active_days = (current_date - start_date).days
            
            if active_days >= min_days_active:
                ad['active_days'] = active_days
                winning_ads.append(ad)
        except Exception as e:
            logger.error(f"날짜 포맷 파싱 에러: {start_date_str} - {e}")
            
    # 오래 게재된 광고일수록 위닝 소재일 확률이 높으므로 활성 일수 기준 내림차순 최상단 정렬
    winning_ads.sort(key=lambda x: x.get('active_days', 0), reverse=True)
    return winning_ads


# --- 3. AI 기반 크리에이티브 심층 분석 ---
@with_retry_and_error_handling()
def analyze_creatives_with_ai(ads: List[Dict]):
    """Gemini 및 이미지 분석 도구를 통해 위닝 소재의 Hook-Body-CTA 구조를 심층 분석합니다."""
    video_urls = []
    image_ads = []
    
    for ad in ads:
        media_type = ad.get('media_type')
        if media_type == 'video' and 'media_url' in ad:
            video_urls.append(ad['media_url'])
        elif media_type == 'image' and 'media_url' in ad:
            image_ads.append(ad)
            
    # 동영상 분석 (ChatGPT API - GPT-4o 활용)
    if video_urls:
        video_prompt = (
            "당신은 엘리트 퍼포먼스 마케터입니다. 해당 비디오 광고를 심층 분석해주세요:\n"
            "다음 프레임워크를 적용하여 분석 리포트를 작성하세요.\n"
            "1. Hook (0~3초): 시청자 이탈을 막는 시각적/청각적 트리거 요인\n"
            "2. Body (전개부): 소구점(USP)과 문제 해결 로직의 시각화 방법\n"
            "3. CTA (행동 유도): 마지막 전환을 발생시키는 디자인 및 카피 배치\n"
        )
        logger.info(f"{len(video_urls)}개의 비디오를 ChatGPT(gpt-4o) API로 분석 요청합니다.")
        
        # ChatGPT는 단일 프롬프트에 다중 비디오 URL을 묶어서 넣는 것보다 
        # 각 영상의 프레임을 개별적으로 Vision API에 던지는 것이 더 정확도가 높습니다.
        for url in video_urls:
            # TODO: 비디오 다운로드 -> 프레임 추출 -> base64 변환 -> OpenAI 호출 파이프라인 연동
            logger.info(f"ChatGPT 기반 영상 분석 진행 중... URL: {url}")
            analysis_result = analyze_video_with_chatgpt(url, video_prompt)
            # 결과 매핑 로직 추가 필요
        
    # 이미지는 개별 API를 사용해 구도 및 색상 분석 (이 역시 ChatGPT로 통합 가능)
    for img_ad in image_ads:
        img_prompt = (
            "마케팅 시각에서 이 이미지 광고를 뜯어봐 주세요. "
            "텍스트 정보, 메인 카피, 지배적인 색상(Color Theme), 시선이 머무는 구도를 중점적으로 분석하세요."
        )
        # 이미지 역시 OpenAI의 gpt-4o 로 분석하는 것으로 대체 가능합니다.
        img_analysis = mcp_analyze_ad_image(img_ad['media_url'], img_prompt)
        img_ad['analysis_report'] = img_analysis


# --- 4. 영구 아카이빙 및 캐시 최적화 시스템 ---
def search_in_archived_vault(brand: str = None, color: str = None, media_type: str = None, keyword: str = None) -> List[Dict]:
    """메타에서 광고가 비활성화되어 내려가더라도 보관소에서 유의미한 과거 소재를 다시 검색해 줍니다."""
    query = {}
    if brand: query['brand'] = brand
    if color: query['dominant_color'] = color
    if media_type: query['media_type'] = media_type
    if keyword: query['query'] = keyword
    
    logger.info(f"꺼진 광고 보관소(Cache) 검색 중... 조건: {query}")
    cached_results = mcp_search_cached_media(query)
    
    # 캐시 스탯도 함께 확인하여 최적화
    stats = mcp_get_cache_stats()
    logger.info(f"현재 보관소 상태: 총 {stats.get('total_cached')}개 미디어가 안전하게 영구 저장되어 있습니다.")
    
    return cached_results

def analyze_single_creative_with_ai(media_url: str, media_type: str, video_frames: list = None) -> dict:
    """
    브라우저 프론트엔드에서 캡처하여 전달한 video_frames (Base64)를 활용하거나,
    이미지일 경우 직접 다운로드하여 OpenAI GPT-4o Vision API에 분석을 요청합니다. (서버/OpenCV 프리)
    """
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    if not client.api_key:
        raise Exception("OpenAI API 키가 설정되지 않았습니다.")

    base64_images = []
    
    if media_type == 'video':
        if video_frames and isinstance(video_frames, list) and len(video_frames) > 0:
            # 프론트엔드에서 넘어온 base64 문자열들
            base64_images = video_frames
        else:
            raise Exception("비디오 프레임이 전송되지 않아 AI가 분석할 수 없습니다.")
    else: # media_type == 'image'
        res = requests.get(media_url)
        if res.status_code != 200:
            raise Exception("이미지 미디어를 다운로드할 수 없습니다.")
        base64_image = base64.b64encode(res.content).decode('utf-8')
        base64_images.append(base64_image)
        
    # base64_images가 비어도 텍스트 전용으로 분석 계속 (cv2 없는 이미지 URL 처리 등)

    # OpenAI GPT-4o Vision 호출
    prompt_text = """당신은 엘리트 퍼포먼스 마케터입니다.
이 광고 미디어(이미지 또는 비디오 프레임들)를 심층 분석하여 다음 세 가지 항목의 내용을 작성해주세요. (각 항목은 2-3문장으로 간결하게 분석할 것)

1. Hook: 시청자 이탈을 막는 초기 0~3초의 시각적/문구적 특징
2. Body: 핵심 전달 소구점(USP)과 문제 해결 로직 전개
3. CTA: 마지막 전환을 발생시키는 디자인 및 행동 유도 텍스트

출력 형식은 반드시 아래 JSON 포맷을 유지해야 합니다:
{
    "hook": "...",
    "body": "...",
    "cta": "..."
}"""

    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt_text}
            ]
        }
    ]
    
    # 추출한 프레임 이미지들을 메시지에 멀티모달로 추가
    for b64_img in base64_images:
        messages[0]["content"].append({
            "type": "image_url",
            "image_url": {
                "url": f"data:image/jpeg;base64,{b64_img}",
                "detail": "low"
            }
        })

    logger.info(f"OpenAI GPT-4o Vision API에 {len(base64_images)}장의 이미지를 포함한 심층 분석을 요청합니다...")
    
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        max_tokens=600,
        response_format={"type": "json_object"}
    )
    
    result_text = response.choices[0].message.content
    try:
        import json
        result_json = json.loads(result_text)
        return {
            "hook": result_json.get("hook", "추출 실패"),
            "body": result_json.get("body", "추출 실패"),
            "cta": result_json.get("cta", "추출 실패")
        }
    except json.JSONDecodeError as e:
        logger.error(f"OpenAI 응답 파싱 에러: {e}")
        return {
            "hook": "AI 결과 파싱 에러",
            "body": result_text,
            "cta": ""
        }

# --- 5. AI 기반 검색어 추천 기능 ---
@with_retry_and_error_handling()
def recommend_search_keywords(user_keyword: str) -> List[str]:
    """사용자 검색어(브랜드, 스타일 등)를 기반으로 확장/파생할 수 있는 연관 레퍼런스 키워드 5가지를 추천합니다."""
    import openai
    import json
    
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        logger.warning("OpenAI API Key가 없어 추천 검색어 기본값을 반환합니다.")
        return ["Nike", "Adidas", "감성적인 인테리어", "미니멀 화이트", "B2B SaaS 광고"]
        
    client = openai.OpenAI(api_key=api_key)
    
    prompt = f"""
다음은 메타 및 기타 플랫폼에서 광고 디자인(레퍼런스)을 찾기 위해 사용자가 입력한 검색어입니다.
검색어: "{user_keyword}"

이 검색어와 연관된 브랜드, 경쟁사 이름, 또는 디자인 스타일/분위기를 설명하는 구체적인 키워드를 딱 5가지만 추천해주세요.
반드시 아래 JSON 포맷으로 배열만 반환해야 합니다. 코드블록 마크다운 기호 없이 순수 JSON 문자열만 출력하세요.
["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"]
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "광고 기획자로서 입력받은 키워드와 연관성이 높은 레퍼런스 검색어를 추천해 주는 어시스턴트입니다."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=200,
            temperature=0.7
        )
        
        result_content = response.choices[0].message.content.strip()
        
        if result_content.startswith("```json"):
            result_content = result_content[7:]
        if result_content.endswith("```"):
            result_content = result_content[:-3]
            
        result_content = result_content.strip()
        keywords = json.loads(result_content)
        
        if isinstance(keywords, list) and len(keywords) > 0:
            return keywords[:5]
        return [user_keyword, "경쟁사 광고", "디자인 레퍼런스", "감성 광고", "세일즈 프로모션"]

    except Exception as e:
        logger.error(f"추천 검색어 분석 중 에러 발생: {e}")
        return [user_keyword, "퍼포먼스 마케팅", "UGC 소재", "숏폼 광고", "위닝 소재"]

# --- 6. 자연어 기반 검색 쿼리로 수집용 타겟 브랜드명 추출 ---
@with_retry_and_error_handling()
def extract_brands_from_natural_language(query: str, country: str = None) -> List[str]:
    """
    사용자가 입력한 자연어(예: '미니멀한 화이트톤 화장품 광고')를 기반으로
    가장 잘 어울리며 실제 메타 광고 라이브러리에서 검색 확률이 높은
    리딩 브랜드명 3~5가지를 도출합니다.
    """
    import openai
    import json
    
    # 국가 코드 -> 일반 이름 매핑
    COUNTRY_NAMES = {"KR": "대한민국 (한국)", "US": "미국", "JP": "일본", "CN": "중국"}
    country_name = COUNTRY_NAMES.get(country, None) if country else None
    country_hint = (
        f"\n* 특중요한 국가 필터\ud55c 컨쪽로 과당하게 어기지 세요: 사용자가 현재 '{country_name}' 시장만 보고 있습니다. 다른 나라의 브랜드를 삽입하면 절대 안 된다. 만드시 {country_name}에서 실제로 활콠지 집행하는 페이스북 광고 브랜드만 \ucd94쳐주세요."
        if country_name else ""
    )

    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        logger.warning("OpenAI API Key가 없으므로 검색어를 단순 분할하여 반환합니다.")
        return [q.strip() for q in query.split(",")]
        
    client = openai.OpenAI(api_key=api_key)
    
    prompt = f"""
당신은 최고의 글로벌 퍼포먼스 마케터이자 브랜드 기획자입니다.
다음은 사용자가 레퍼런스가 될 '위닝 소재(광고)'를 찾기 위해 입력한 자연어 검색 쿼리(분위기, 특색, 특정 스타일 등)입니다.

사용자 쿼리: "{query}"
사용자 선택 국가/시장: {country_name or '글로벌'}{country_hint}

이 쿼리를 보고 가장 잘 어울리며, 실제 페이스북/인스타그램 광고를 활발히 집행하고 있을 법한 대표적인 타겟 브랜드 이름 최대 5가지를 뽑아주세요.
* 아주 중요🔥: 만약 사용자의 쿼리가 단 1개의 '특정 브랜드명(예: 디올, 샤넬, 나이키)'만 명확하게 지칭하고 있다면, 마음대로 경쟁사를 섞지 말고 **오직 해당 브랜드 1개**의 공식 명칭만 배열에 담아 반환하세요.
* 단, 쿼리가 '디올 같은 느낌의 화장품', '20대 여성 스트릿 패션'처럼 기획/레퍼런스 의도가 있다면, 가장 잘 어울리는 리딩 브랜드 3~5개를 자유롭게 반환하세요.
* 중요: 'KT'나 'Uplus'를 '케이티'나 'LG유플러스'로 도출하는 것처럼, 짧은 범용어나 약어 대신 실제 페이스북 페이지명이나 기업 공식 고유명사 풀네임을 적어주세요. 그래야 엉뚱한 이름이 스크래핑되는 것을 막을 수 있습니다.
* 반드시 아래의 순수 JSON 배열 형태로만 반환하세요. (다른 말 제외)
["브랜드명1", "브랜드명2", "브랜드명3"]
"""

    logger.info(f"자연어 분석 중... 쿼리: [{query}]")
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "너는 광고 레퍼런스 및 브랜드 도출에 특화된 AI 서포터야."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=150,
            temperature=0.5
        )
        
        result_content = response.choices[0].message.content.strip()
        
        if result_content.startswith("```json"):
            result_content = result_content[7:]
        if result_content.endswith("```"):
            result_content = result_content[:-3]
            
        result_content = result_content.strip()
        brand_list = json.loads(result_content)
        
        if isinstance(brand_list, list) and len(brand_list) > 0:
            logger.info(f"자연어 AI 분석을 통한 타겟 브랜드 결정: {brand_list}")
            return brand_list[:5] # 최대 5개 제한
            
        # 파싱 실패 혹은 리스트가 아니면 단순 분할
        return [q.strip() for q in query.split(",")]

    except Exception as e:
        logger.error(f"자연어 타겟 브랜드 도출 중 에러 발생: {e}")
        # 실패 시 콤마 베이스 폴백
        return [q.strip() for q in query.split(",")]


def suggest_alternative_keyword(original_query: str, tried_keywords: List[str]) -> str:
    """
    검색결과가 없을 때 원래 쿼리와 검색 실패한 키워드 목록을 바탕으로
    영문 변환, 유사어, 공식 명칭 등 새로운 1개의 대체 키워드를 추천합니다.
    """
    import openai
    import json
    
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        return ""
    
    client = openai.OpenAI(api_key=api_key)
    prompt = f"""
우리는 글로벌 광고 라이브러리(메타/틱톡/구글 등)에서 광고 레퍼런스를 검색하고 있습니다. 
사용자가 처음에 '{original_query}'(으)로 검색했지만 결과가 아예 없었습니다.
지금까지 시스템이 시도해본 키워드 목록(결과 없음): {tried_keywords}

광고 플랫폼 검색엔진의 특성상, 데이터가 없다면 다음 전략 중 하나로 변환해서 다시 검색해야 합니다:
1. 영문/한글 표기 상호 변환 (예: 케이티 -> KT, 엘지 -> LG, 넷플릭스 -> Netflix, 애플 -> Apple)
2. 가장 널리 쓰이는 일반적인 공식 브랜드명 / 법인명 (예: 제일 기획 -> 제일기획, 유플러스 -> LG유플러스)
3. 띄어쓰기 제거나 철자 보정 (예: 삼성 전자 -> 삼성전자)

위의 시도해본 키워드들과 절대 겹치지 않으면서, 라이브러리에 광고가 등록되어 있을 확률이 가장 높은 "단 1개의 가장 강력한 대체 키워드"를 추천해주세요.
반드시 아래와 같이 순수 JSON 형식으로만 반환하세요.
{{"keyword": "새로운추천키워드"}}
"""
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=50,
            temperature=0.3
        )
        content = response.choices[0].message.content.strip()
        if content.startswith("```json"):
            content = content[7:]
        if content.endswith("```"):
            content = content[:-3]
        data = json.loads(content.strip())
        new_keyword = data.get("keyword", "")
        logger.info(f"AI 대체 키워드 제안: {new_keyword} (시도된 목록: {tried_keywords})")
        return new_keyword
    except Exception as e:
        logger.error(f"대체 키워드 제안 중 에러 발생: {e}")
        return ""
