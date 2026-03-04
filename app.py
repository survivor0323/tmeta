from fastapi import FastAPI, BackgroundTasks, Request, Header
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
import os
import json
import logging
from pydantic import BaseModel, validator
from typing import List, Optional
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# 로직 분리: 이전에 작성한 anti_gravity_ads_logic.py를 import합니다.
try:
    from anti_gravity_ads_logic import (
        fetch_competitor_ads_batch,
        extract_winning_creatives,
        analyze_creatives_with_ai
    )
except ImportError:
    pass

# Supabase 클라이언트 초기화
try:
    from supabase import create_client, Client
    SUPABASE_URL = os.getenv("SUPABASE_URL", "")
    SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY) if SUPABASE_URL else None
    # Service Role 키 (RLS 우회 - 백엔드 전용)
    supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) if (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY) else supabase
except Exception as e:
    logger.warning(f"Supabase 초기화 실패: {e}")
    supabase = None
    supabase_admin = None

# JWT에서 user_id 추출 헬퍼
def get_user_id_from_token(authorization: str) -> str:
    """Authorization 헤더의 Bearer 토큰에서 Supabase user_id를 추출합니다."""
    if not authorization or not supabase:
        return None
    token = authorization.replace("Bearer ", "").strip()
    if not token:
        return None
    try:
        result = supabase.auth.get_user(token)
        if result and result.user:
            return result.user.id
    except Exception as e:
        logger.warning(f"[Auth] 토큰 검증 실패: {e}")
    return None

app = FastAPI(title="Motiverse AI Ads Platform")

# 정적 파일 서빙 ('static' 폴더 하위의 html, css, js 리소스들을 루트경로에 호스팅)
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/", response_class=HTMLResponse)
async def read_dashboard():
    with open("static/index.html", "r", encoding="utf-8") as f:
        return f.read()

# [API 요청 스키마 분리]
class AnalyzeRequest(BaseModel):
    query: str
    platform: str = "meta"  # 지원: meta, tiktok, instagram, google 등
    country: Optional[str] = "KR"     # 기본 대한민국, 빈 문자열이면 None
    search_type: str = "keyword" # 기본 keyword (tiktok용: hashtag 추가)
    
    @validator('country', pre=True, always=True)
    def empty_str_to_none(cls, v):
        return v.strip() if isinstance(v, str) and v.strip() else None

class SingleAnalyzeRequest(BaseModel):
    media_url: str
    media_type: str

class HistorySaveRequest(BaseModel):
    query: str
    platform: str
    country: Optional[str] = "KR"
    ads_data: list = []

class BookmarkSaveRequest(BaseModel):
    ad_data: dict
    query: str
    platform: str


# ─── JWT에서 user_id 추출 헬퍼 ───────────────────────────
def get_user_id_from_token(authorization: str) -> Optional[str]:
    """Authorization: Bearer <token> 헤더에서 user_id를 파싱합니다."""
    if not supabase or not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.replace("Bearer ", "").strip()
    try:
        user = supabase.auth.get_user(token)
        return user.user.id if user and user.user else None
    except Exception as e:
        logger.warning(f"토큰 검증 실패: {e}")
        return None


@app.post("/api/v1/analyze")
async def trigger_analysis(req: AnalyzeRequest, authorization: str = Header(default="")):
    """
    프론트엔드에서 수신받은 자연어 쿼리(query)를 바탕으로 연관 브랜드를 추출하고,
    해당 브랜드들의 위닝 소재 및 AI 분석을 마친 결과를 반환합니다.
    """
    user_id = get_user_id_from_token(authorization)
    try:
        from anti_gravity_ads_logic import extract_brands_from_natural_language
        
        # 1. 자연어 쿼리 -> 알맞은 타겟 라이브러리 브랜드명 배열 변환
        platform = getattr(req, "platform", "meta").lower()
        
        # --- [추가] 24시간 이내 다른 사용자가 동일한 키워드로 검색한 이력 체킹 (토큰/시간 절약) ---
        if supabase:
            try:
                from datetime import datetime, timedelta, timezone
                import json
                time_threshold = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
                
                # RLS를 우회하여 캐시 데이터를 가져오는 RPC 함수 호출
                cached = supabase.rpc("get_cached_ads_data", {
                    "p_query": req.query,
                    "p_platform": platform,
                    "p_country": req.country or "KR",
                    "p_time_threshold": time_threshold
                }).execute()
                
                if cached.data:
                    cached_data = cached.data
                    if isinstance(cached_data, str):
                        try:
                            cached_data = json.loads(cached_data)
                        except:
                            cached_data = []
                    
                    if cached_data and isinstance(cached_data, list) and len(cached_data) > 0:
                        logger.info(f"DB Cache Hit: '{req.query}' on {platform}. Return {len(cached_data)} items.")
                        return {
                            "status": "success",
                            "message": f"최근 24시간 내 누군가 검색한 이력이 있어 기존 데이터({len(cached_data)}개 소재)를 즉시 불러왔습니다. (시간/API토큰 절약)",
                            "data": cached_data
                        }
            except Exception as e:
                logger.warning(f"캐시(RPC) 조회 실패: {e}")
        # -----------------------------------------------------------------------------------------

        max_attempts = 3
        attempt = 1
        current_query = req.query
        tried_queries = []
        real_responses = []
        brands = []
        
        from anti_gravity_ads_logic import extract_brands_from_natural_language, suggest_alternative_keyword
        
        while attempt <= max_attempts:
            tried_queries.append(current_query)
            brands = extract_brands_from_natural_language(current_query, country=req.country)
            logger.info(f"AI 자연어 분석으로 도출된 검색 타겟 브랜드: {brands} (Platform: {platform}, 시도: {attempt}/{max_attempts})")

            real_responses = []

            if brands:
                if platform == "tiktok":
                    brand_keyword = brands[0]
                    from anti_gravity_ads_logic import fetch_tiktok_creatives
                    tiktok_ads = fetch_tiktok_creatives(
                        keyword=brand_keyword,
                        country=req.country,
                        search_type=req.search_type
                    )
                    if tiktok_ads:
                        analyze_creatives_with_ai(tiktok_ads)
                        real_responses.extend(tiktok_ads)
                        
                elif platform == "instagram":
                    brand_keyword = brands[0]
                    from anti_gravity_ads_logic import fetch_instagram_reels
                    ig_ads = fetch_instagram_reels(keyword=brand_keyword)
                    if ig_ads:
                        analyze_creatives_with_ai(ig_ads)
                        real_responses.extend(ig_ads)
                        
                elif platform == "google":
                    from anti_gravity_ads_logic import fetch_google_ads
                    google_ads = fetch_google_ads(
                        keyword=current_query,
                        country=req.country
                    )
                    if google_ads:
                        analyze_creatives_with_ai(google_ads)
                        real_responses.extend(google_ads)
                else:
                    ads_by_brand = fetch_competitor_ads_batch(brands, country=req.country or "KR")
                    for brand, ads in ads_by_brand.items():
                        if not ads:
                            continue
                        winning_ads = extract_winning_creatives(ads, min_months_active=0)
                        if winning_ads:
                            analyze_creatives_with_ai(winning_ads)
                            real_responses.extend(winning_ads)

            if real_responses:
                break # 결과 찾았으면 루프 종료
            
            # 여기서 못 찾았다면, 다음 시도를 위한 새로운 대체 키워드 제안받기
            if attempt < max_attempts:
                logger.info(f"[{current_query}] 결과 없음. 대체 키워드 탐색 시도 ({attempt}/{max_attempts})")
                new_query = suggest_alternative_keyword(req.query, tried_queries)
                if not new_query:
                    # 대체할 단어도 못 찾으면 조기 종료
                    break
                current_query = new_query
            
            attempt += 1

        if not real_responses:
            failed_keywords_str = ", ".join([f"'{k}'" for k in tried_queries])
            return {
                "status": "error",
                "message": f"검색결과가 없어 다음 {len(tried_queries)}가지 키워드를 순차적으로 자동 전환하여 찾았으나 레퍼런스를 발견하지 못했습니다: {failed_keywords_str}. 브랜드명이나 검색어를 변경하여 다시 시도해보세요.",
                "data": []
            }

        # 토큰 사용량 추정 및 로깅
        if user_id and supabase:
            try:
                tokens_est = len(str(real_responses)) // 4
                supabase.rpc("log_api_usage", {
                    "p_user_id": user_id,
                    "p_endpoint": f"/api/v1/analyze ({platform})",
                    "p_tokens": tokens_est
                }).execute()
            except Exception as e:
                logger.warning(f"API Usage 로깅 실패: {e}")

        success_msg = f"{len(brands)}개의 브랜드에서 총 {len(real_responses)}개의 실전 위닝 소재를 추출 및 AI 분석했습니다."
        if len(tried_queries) > 1:
            success_msg = f"'{tried_queries[0]}' 결과가 없어 자동으로 '{current_query}'(으)로 변환 탐색하여 총 {len(real_responses)}개의 실전 소재를 찾았습니다."

        # P2: 검색된 광고를 아카이브에 자동 저장 (종료되어도 영구 보관)
        try:
            archive_ads(real_responses, platform, req.country or "KR")
        except Exception as archive_err:
            logger.warning(f"[Archive] 자동 저장 실패: {archive_err}")

        return {
            "status": "success",
            "message": success_msg,
            "data": real_responses
        }
    except Exception as e:
        logger.error(f"실전 데이터 분석 중 오류 발생: {e}")
        return {
            "status": "error",
            "message": f"데이터 수집/분석 중 에러가 발생했습니다: {str(e)}",
            "data": []
        }


# ─── 히스토리 API ───────────────────────────────────────
@app.post("/api/v1/history")
async def save_history(req: HistorySaveRequest, authorization: str = Header(default="")):
    """검색 결과를 supabase search_history 테이블에 저장합니다."""
    user_id = get_user_id_from_token(authorization)
    if not user_id:
        return {"status": "error", "message": "로그인이 필요합니다."}
    try:
        result = supabase.table("search_history").insert({
            "user_id": user_id,
            "query": req.query,
            "platform": req.platform,
            "country": req.country,
            "ads_data": req.ads_data,
        }).execute()
        return {"status": "success", "data": result.data[0] if result.data else {}}
    except Exception as e:
        logger.error(f"히스토리 저장 실패: {e}")
        return {"status": "error", "message": str(e)}


@app.get("/api/v1/history")
async def get_history(authorization: str = Header(default="")):
    """사용자의 검색 히스토리 목록을 최신순으로 반환합니다."""
    user_id = get_user_id_from_token(authorization)
    if not user_id:
        return {"status": "error", "message": "로그인이 필요합니다.", "data": []}
    try:
        result = supabase.table("search_history")\
            .select("id, query, platform, country, created_at")\
            .eq("user_id", user_id)\
            .order("created_at", desc=True)\
            .limit(50)\
            .execute()
        return {"status": "success", "data": result.data}
    except Exception as e:
        logger.error(f"히스토리 조회 실패: {e}")
        return {"status": "error", "message": str(e), "data": []}


@app.get("/api/v1/history/{history_id}")
async def get_history_detail(history_id: str, authorization: str = Header(default="")):
    """특정 히스토리의 상세 광고 데이터를 반환합니다."""
    user_id = get_user_id_from_token(authorization)
    if not user_id:
        return {"status": "error", "message": "로그인이 필요합니다.", "data": None}
    try:
        result = supabase.table("search_history")\
            .select("*")\
            .eq("id", history_id)\
            .eq("user_id", user_id)\
            .single()\
            .execute()
        return {"status": "success", "data": result.data}
    except Exception as e:
        logger.error(f"히스토리 상세 조회 실패: {e}")
        return {"status": "error", "message": str(e), "data": None}


# ─── 북마크 API ────────────────────────────────────────
@app.post("/api/v1/bookmarks")
async def save_bookmark(req: BookmarkSaveRequest, authorization: str = Header(default="")):
    """광고 소재를 북마크에 저장합니다."""
    user_id = get_user_id_from_token(authorization)
    if not user_id:
        return {"status": "error", "message": "로그인이 필요합니다."}
    try:
        result = supabase.table("bookmarks").insert({
            "user_id": user_id,
            "ad_data": req.ad_data,
            "query": req.query,
            "platform": req.platform,
        }).execute()
        return {"status": "success", "data": result.data[0] if result.data else {}}
    except Exception as e:
        logger.error(f"북마크 저장 실패: {e}")
        return {"status": "error", "message": str(e)}


@app.get("/api/v1/bookmarks")
async def get_bookmarks(authorization: str = Header(default="")):
    """사용자의 북마크 목록을 최신순으로 반환합니다."""
    user_id = get_user_id_from_token(authorization)
    if not user_id:
        return {"status": "error", "message": "로그인이 필요합니다.", "data": []}
    try:
        result = supabase.table("bookmarks")\
            .select("*")\
            .eq("user_id", user_id)\
            .order("created_at", desc=True)\
            .limit(100)\
            .execute()
        return {"status": "success", "data": result.data}
    except Exception as e:
        logger.error(f"북마크 조회 실패: {e}")
        return {"status": "error", "message": str(e), "data": []}


@app.delete("/api/v1/bookmarks/{bookmark_id}")
async def delete_bookmark(bookmark_id: str, authorization: str = Header(default="")):
    """북마크를 삭제합니다."""
    user_id = get_user_id_from_token(authorization)
    if not user_id:
        return {"status": "error", "message": "로그인이 필요합니다."}
    try:
        supabase.table("bookmarks")\
            .delete()\
            .eq("id", bookmark_id)\
            .eq("user_id", user_id)\
            .execute()
        return {"status": "success"}
    except Exception as e:
        logger.error(f"북마크 삭제 실패: {e}")
        return {"status": "error", "message": str(e)}


@app.post("/api/v1/analyze-single")
async def trigger_single_analysis(req: SingleAnalyzeRequest):
    # 비디오 타입은 AI 분석 미지원
    if req.media_type and req.media_type.lower() == "video":
        return {
            "status": "error",
            "message": "비디오 AI 분석은 개발중입니다.",
            "data": None
        }
    try:
        from anti_gravity_ads_logic import analyze_single_creative_with_ai
        report = analyze_single_creative_with_ai(req.media_url, req.media_type)
        return {"status": "success", "message": "AI 분석 완료", "data": report}
    except Exception as e:
        logger.error(f"단일 미디어 분석 중 오류 발생: {e}")
        return {"status": "error", "message": str(e), "data": None}

class RecommendRequest(BaseModel):
    keyword: str

@app.post("/api/v1/recommend-keywords")
async def get_recommended_keywords(req: RecommendRequest):
    try:
        from anti_gravity_ads_logic import recommend_search_keywords
        keywords = recommend_search_keywords(req.keyword)
        return {"status": "success", "message": "AI 검색어 추천 완료", "data": keywords}
    except Exception as e:
        logger.error(f"검색어 추천 중 오류 발생: {e}")
        return {"status": "error", "message": str(e), "data": []}


# ═══════════════════════════════════════════════════════
# P1: 경쟁사 자동 모니터링 API
# ═══════════════════════════════════════════════════════

class MonitorRequest(BaseModel):
    brand_name: str
    platform: str = "meta"
    country: str = "KR"

@app.post("/api/v1/monitors")
async def add_monitor(req: MonitorRequest, authorization: str = Header(default="")):
    """모니터링할 브랜드를 등록합니다."""
    user_id = get_user_id_from_token(authorization)
    if not user_id:
        return {"status": "error", "message": "로그인이 필요합니다."}
    try:
        # 중복 체크
        existing = supabase_admin.table("monitored_brands")\
            .select("id")\
            .eq("user_id", user_id)\
            .eq("brand_name", req.brand_name)\
            .eq("platform", req.platform)\
            .execute()
        if existing.data:
            return {"status": "error", "message": f"'{req.brand_name}'은(는) 이미 모니터링 중입니다."}

        result = supabase_admin.table("monitored_brands").insert({
            "user_id": user_id,
            "brand_name": req.brand_name,
            "platform": req.platform,
            "country": req.country,
        }).execute()
        return {"status": "success", "data": result.data[0] if result.data else {}}
    except Exception as e:
        logger.error(f"모니터 등록 실패: {e}")
        return {"status": "error", "message": str(e)}

@app.get("/api/v1/monitors")
async def list_monitors(authorization: str = Header(default="")):
    """사용자의 모니터링 브랜드 목록을 반환합니다."""
    user_id = get_user_id_from_token(authorization)
    if not user_id:
        return {"status": "error", "message": "로그인이 필요합니다.", "data": []}
    try:
        result = supabase_admin.table("monitored_brands")\
            .select("*")\
            .eq("user_id", user_id)\
            .eq("is_active", True)\
            .order("created_at", desc=True)\
            .execute()
        return {"status": "success", "data": result.data}
    except Exception as e:
        return {"status": "error", "message": str(e), "data": []}

@app.delete("/api/v1/monitors/{monitor_id}")
async def delete_monitor(monitor_id: str, authorization: str = Header(default="")):
    """모니터링 브랜드를 삭제합니다."""
    user_id = get_user_id_from_token(authorization)
    if not user_id:
        return {"status": "error", "message": "로그인이 필요합니다."}
    try:
        supabase_admin.table("monitored_brands")\
            .delete().eq("id", monitor_id).eq("user_id", user_id).execute()
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/v1/monitor-alerts")
async def get_monitor_alerts(authorization: str = Header(default="")):
    """모니터링 알림 목록을 반환합니다."""
    user_id = get_user_id_from_token(authorization)
    if not user_id:
        return {"status": "error", "message": "로그인이 필요합니다.", "data": []}
    try:
        result = supabase_admin.table("monitor_alerts")\
            .select("*")\
            .eq("user_id", user_id)\
            .order("created_at", desc=True)\
            .limit(50)\
            .execute()
        return {"status": "success", "data": result.data}
    except Exception as e:
        return {"status": "error", "message": str(e), "data": []}

@app.put("/api/v1/monitor-alerts/{alert_id}/read")
async def mark_alert_read(alert_id: str, authorization: str = Header(default="")):
    """알림을 읽음 처리합니다."""
    user_id = get_user_id_from_token(authorization)
    if not user_id:
        return {"status": "error", "message": "로그인이 필요합니다."}
    try:
        supabase_admin.table("monitor_alerts")\
            .update({"is_read": True})\
            .eq("id", alert_id).eq("user_id", user_id).execute()
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/v1/monitors/check-now")
async def check_monitors_now(authorization: str = Header(default="")):
    """등록된 모니터를 즉시 체크합니다 (수동 트리거)."""
    user_id = get_user_id_from_token(authorization)
    if not user_id:
        return {"status": "error", "message": "로그인이 필요합니다."}
    try:
        monitors = supabase_admin.table("monitored_brands")\
            .select("*")\
            .eq("user_id", user_id)\
            .eq("is_active", True)\
            .execute()
        if not monitors.data:
            return {"status": "error", "message": "모니터링 중인 브랜드가 없습니다."}

        total_new = 0
        for mon in monitors.data:
            brand = mon["brand_name"]
            platform = mon.get("platform", "meta")
            country = mon.get("country", "KR")

            try:
                if platform == "meta":
                    ads_by_brand = fetch_competitor_ads_batch([brand], country=country)
                    ads = ads_by_brand.get(brand, [])
                elif platform == "tiktok":
                    from anti_gravity_ads_logic import fetch_tiktok_creatives
                    ads = fetch_tiktok_creatives(keyword=brand, country=country)
                elif platform == "instagram":
                    from anti_gravity_ads_logic import fetch_instagram_reels
                    ads = fetch_instagram_reels(keyword=brand)
                elif platform == "google":
                    from anti_gravity_ads_logic import fetch_google_ads
                    ads = fetch_google_ads(keyword=brand, country=country)
                else:
                    ads = []
            except Exception as fetch_err:
                logger.error(f"[Monitor] {brand} 수집 실패: {fetch_err}")
                ads = []

            if ads:
                # P2: 아카이브에 저장
                archive_ads(ads, platform, country)

                # 알림 생성
                slim_ads = [{"ad_id": a.get("ad_id"), "brand": a.get("brand"),
                             "media_url": a.get("media_url"), "media_type": a.get("media_type"),
                             "body": (a.get("body") or "")[:200], "direct_link": a.get("direct_link"),
                             "platform": platform} for a in ads[:20]]
                supabase_admin.table("monitor_alerts").insert({
                    "user_id": user_id,
                    "monitor_id": mon["id"],
                    "brand_name": brand,
                    "new_ads_count": len(ads),
                    "ads_data": slim_ads,
                }).execute()
                total_new += len(ads)

            # last_checked_at 갱신
            from datetime import datetime, timezone
            supabase_admin.table("monitored_brands")\
                .update({"last_checked_at": datetime.now(timezone.utc).isoformat()})\
                .eq("id", mon["id"]).execute()

        return {"status": "success", "message": f"체크 완료! 총 {total_new}개의 새 광고를 발견했습니다."}
    except Exception as e:
        logger.error(f"모니터 체크 실패: {e}")
        return {"status": "error", "message": str(e)}


# ═══════════════════════════════════════════════════════
# P2: 광고 아카이브 (종료된 광고 영구 보관)
# ═══════════════════════════════════════════════════════

def archive_ads(ads: list, platform: str, country: str = "KR"):
    """수집된 광고를 아카이브 테이블에 upsert합니다."""
    if not supabase_admin or not ads:
        return
    for ad in ads:
        ad_id = ad.get("ad_id")
        if not ad_id:
            continue
        try:
            supabase_admin.table("ad_archive").upsert({
                "ad_id": ad_id,
                "brand": ad.get("brand", ""),
                "platform": platform,
                "country": country,
                "media_url": ad.get("media_url", ""),
                "media_type": ad.get("media_type", ""),
                "image_url": ad.get("image_url", ""),
                "body": (ad.get("body") or "")[:500],
                "direct_link": ad.get("direct_link", ""),
                "start_date": ad.get("start_date", ""),
                "analysis_report": ad.get("analysis_report"),
                "is_active": True,
                "last_seen_at": "now()",
            }, on_conflict="ad_id,platform").execute()
        except Exception as e:
            logger.warning(f"[Archive] {ad_id} 저장 실패: {e}")

@app.get("/api/v1/archive")
async def search_archive(
    q: str = "",
    platform: str = "",
    brand: str = "",
    authorization: str = Header(default="")
):
    """아카이브된 광고를 검색합니다 (종료된 광고 포함)."""
    user_id = get_user_id_from_token(authorization)
    if not user_id:
        return {"status": "error", "message": "로그인이 필요합니다.", "data": []}
    try:
        query = supabase_admin.table("ad_archive").select("*")
        if brand:
            query = query.ilike("brand", f"%{brand}%")
        if platform:
            query = query.eq("platform", platform)
        if q:
            query = query.or_(f"brand.ilike.%{q}%,body.ilike.%{q}%")
        result = query.order("last_seen_at", desc=True).limit(50).execute()
        return {"status": "success", "data": result.data}
    except Exception as e:
        return {"status": "error", "message": str(e), "data": []}


# ═══════════════════════════════════════════════════════
# P3: 보드 / 컬렉션 기능 (북마크 개선)
# ═══════════════════════════════════════════════════════

class BoardRequest(BaseModel):
    name: str
    description: str = ""
    color: str = "#3b82f6"

class BookmarkMoveRequest(BaseModel):
    bookmark_ids: list
    board_id: Optional[str] = None

@app.post("/api/v1/boards")
async def create_board(req: BoardRequest, authorization: str = Header(default="")):
    """새 보드를 생성합니다."""
    user_id = get_user_id_from_token(authorization)
    if not user_id:
        return {"status": "error", "message": "로그인이 필요합니다."}
    try:
        result = supabase_admin.table("boards").insert({
            "user_id": user_id,
            "name": req.name,
            "description": req.description,
            "color": req.color,
        }).execute()
        return {"status": "success", "data": result.data[0] if result.data else {}}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/v1/boards")
async def list_boards(authorization: str = Header(default="")):
    """사용자의 보드 목록을 반환합니다."""
    user_id = get_user_id_from_token(authorization)
    if not user_id:
        return {"status": "error", "message": "로그인이 필요합니다.", "data": []}
    try:
        result = supabase_admin.table("boards")\
            .select("*")\
            .eq("user_id", user_id)\
            .order("created_at", desc=True)\
            .execute()
        return {"status": "success", "data": result.data}
    except Exception as e:
        return {"status": "error", "message": str(e), "data": []}

@app.delete("/api/v1/boards/{board_id}")
async def delete_board(board_id: str, authorization: str = Header(default="")):
    """보드를 삭제합니다 (북마크는 유지, board_id NULL 처리)."""
    user_id = get_user_id_from_token(authorization)
    if not user_id:
        return {"status": "error", "message": "로그인이 필요합니다."}
    try:
        supabase_admin.table("boards").delete().eq("id", board_id).eq("user_id", user_id).execute()
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/v1/boards/{board_id}/bookmarks")
async def get_board_bookmarks(board_id: str, authorization: str = Header(default="")):
    """특정 보드의 북마크를 반환합니다."""
    user_id = get_user_id_from_token(authorization)
    if not user_id:
        return {"status": "error", "message": "로그인이 필요합니다.", "data": []}
    try:
        result = supabase_admin.table("bookmarks")\
            .select("*")\
            .eq("user_id", user_id)\
            .eq("board_id", board_id)\
            .order("created_at", desc=True)\
            .execute()
        return {"status": "success", "data": result.data}
    except Exception as e:
        return {"status": "error", "message": str(e), "data": []}

@app.put("/api/v1/bookmarks/move")
async def move_bookmarks_to_board(req: BookmarkMoveRequest, authorization: str = Header(default="")):
    """북마크를 특정 보드로 이동합니다."""
    user_id = get_user_id_from_token(authorization)
    if not user_id:
        return {"status": "error", "message": "로그인이 필요합니다."}
    try:
        for bm_id in req.bookmark_ids:
            supabase_admin.table("bookmarks")\
                .update({"board_id": req.board_id})\
                .eq("id", bm_id)\
                .eq("user_id", user_id)\
                .execute()
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ═══════════════════════════════════════════════════════
# P4: 랜딩페이지 분석
# ═══════════════════════════════════════════════════════

class LandingPageRequest(BaseModel):
    url: str

@app.post("/api/v1/analyze-landing")
async def analyze_landing_page(req: LandingPageRequest):
    """광고 랜딩페이지의 OG 메타데이터와 구조를 분석합니다."""
    import requests as req_lib
    from urllib.parse import urlparse

    url = req.url.strip()
    if not url:
        return {"status": "error", "message": "URL이 필요합니다.", "data": None}

    try:
        parsed = urlparse(url)
        domain = parsed.netloc or parsed.path

        # SNS 플랫폼: 봇 요청을 메인페이지로 리다이렉트시키므로 따라가지 않음
        sns_domains = ['tiktok.com', 'instagram.com', 'facebook.com', 'twitter.com', 'x.com', 'threads.net']
        is_sns = any(d in domain for d in sns_domains)

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        resp = req_lib.get(url, headers=headers, timeout=10, allow_redirects=not is_sns)
        
        # SNS에서 리다이렉트가 감지되면 원본 URL을 최종 URL로 사용
        if is_sns and resp.status_code in (301, 302, 303, 307, 308):
            # Location 헤더에서 실제 랜딩 URL 추출 (메인페이지가 아닌 경우만)
            redirect_target = resp.headers.get("Location", "")
            generic_pages = ['/foryou', '/login', '/accounts/login', '/?lang=']
            if any(gp in redirect_target for gp in generic_pages) or not redirect_target:
                # 봇 차단 리다이렉트 → 원본 URL 기준으로 분석
                resp = req_lib.get(url, headers=headers, timeout=10, allow_redirects=False)

        html = resp.text[:50000]  # 최대 50KB만 파싱

        # OG 태그 추출
        import re
        og_data = {}
        og_patterns = {
            "title": r'<meta\s+(?:property|name)=["\']og:title["\']\s+content=["\']([^"\']*)["\']',
            "description": r'<meta\s+(?:property|name)=["\']og:description["\']\s+content=["\']([^"\']*)["\']',
            "image": r'<meta\s+(?:property|name)=["\']og:image["\']\s+content=["\']([^"\']*)["\']',
            "site_name": r'<meta\s+(?:property|name)=["\']og:site_name["\']\s+content=["\']([^"\']*)["\']',
            "type": r'<meta\s+(?:property|name)=["\']og:type["\']\s+content=["\']([^"\']*)["\']',
        }
        for key, pattern in og_patterns.items():
            match = re.search(pattern, html, re.IGNORECASE)
            if match:
                og_data[key] = match.group(1).strip()

        # Fallback: <title> 태그
        if "title" not in og_data:
            title_match = re.search(r'<title[^>]*>([^<]*)</title>', html, re.IGNORECASE)
            if title_match:
                og_data["title"] = title_match.group(1).strip()

        # meta description fallback
        if "description" not in og_data:
            desc_match = re.search(r'<meta\s+name=["\']description["\']\s+content=["\']([^"\']*)["\']', html, re.IGNORECASE)
            if desc_match:
                og_data["description"] = desc_match.group(1).strip()

        # CTA 버튼 텍스트 추출 (흔한 패턴들)
        cta_patterns = [
            r'<(?:a|button)[^>]*class=["\'][^"\']*(?:cta|btn|button|purchase|buy|shop)[^"\']*["\'][^>]*>([^<]+)<',
            r'<(?:a|button)[^>]*>([^<]*(구매|신청|가입|다운로드|시작|체험|주문|예약|상담)[^<]*)<',
        ]
        cta_texts = []
        for pattern in cta_patterns:
            matches = re.findall(pattern, html, re.IGNORECASE)
            for m in matches:
                text = m[0].strip() if isinstance(m, tuple) else m.strip()
                if text and len(text) < 50:
                    cta_texts.append(text)
        cta_texts = list(dict.fromkeys(cta_texts))[:5]  # 중복 제거, 최대 5개

        # 리디렉션 체인 분석
        if is_sns:
            # SNS 봇 차단: 원본 URL을 최종 URL로 보여줌
            final_url = url
            redirect_chain_list = []
            redirect_count = 0
        else:
            redirect_chain = [r.url for r in resp.history] + [resp.url]
            final_url = str(resp.url)
            redirect_chain_list = [str(u) for u in redirect_chain] if len(resp.history) > 0 else []
            redirect_count = len(resp.history)

        result = {
            "domain": domain,
            "final_url": final_url,
            "status_code": resp.status_code,
            "redirect_count": redirect_count,
            "redirect_chain": redirect_chain_list,
            "og_data": og_data,
            "cta_buttons": cta_texts,
            "is_sns": is_sns,
        }

        return {"status": "success", "data": result}

    except req_lib.exceptions.Timeout:
        return {"status": "error", "message": "랜딩페이지 응답 시간 초과 (10초)", "data": None}
    except Exception as e:
        logger.error(f"랜딩페이지 분석 실패: {e}")
        return {"status": "error", "message": str(e), "data": None}


# ═══════════════════════════════════════════════════════
# Creative Studio APIs
# ═══════════════════════════════════════════════════════

class ScanBrandRequest(BaseModel):
    url: str

class GenerateStrategyRequest(BaseModel):
    brand_name: str = ""
    brand_color1: str = "#0f172a"
    brand_color2: str = "#3b82f6"
    reference_ads: list = []  # [{media_url, brand, body, platform}, ...]

class BrandSaveRequest(BaseModel):
    name: str
    url: str = ""
    color1: str = "#0f172a"
    color2: str = "#3b82f6"
    logo_url: str = ""


@app.post("/api/v1/scan-brand")
async def scan_brand(req: ScanBrandRequest):
    """웹사이트를 스캔하여 브랜드 정보(이름, 컬러, 로고)를 추출합니다."""
    import requests as req_lib
    import re
    from urllib.parse import urlparse, urljoin

    url = req.url.strip()
    if not url:
        return {"status": "error", "message": "URL이 필요합니다."}
    if not url.startswith("http"):
        url = "https://" + url

    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        resp = req_lib.get(url, headers=headers, timeout=10, allow_redirects=True)
        html = resp.text[:80000]
        parsed = urlparse(str(resp.url))
        domain = parsed.netloc.replace("www.", "")
        base_url = f"{parsed.scheme}://{parsed.netloc}"

        # 1. 브랜드명 추출 (og:site_name → <title> → domain)
        brand_name = ""
        site_name_match = re.search(r'<meta\s+(?:property|name)=["\']og:site_name["\']\s+content=["\']([^"\']*)["\']', html, re.IGNORECASE)
        if site_name_match:
            brand_name = site_name_match.group(1).strip()
        if not brand_name:
            title_match = re.search(r'<title[^>]*>([^<]*)</title>', html, re.IGNORECASE)
            if title_match:
                brand_name = title_match.group(1).strip().split(" - ")[0].split(" | ")[0].strip()
        if not brand_name:
            brand_name = domain.split(".")[0].capitalize()

        # 2. 로고 추출
        logo_url = ""
        logo_patterns = [
            r'<link[^>]+rel=["\'](?:icon|shortcut icon|apple-touch-icon)["\'][^>]+href=["\']([^"\']+)["\']',
            r'<img[^>]+(?:class|id)=["\'][^"\']*logo[^"\']*["\'][^>]+src=["\']([^"\']+)["\']',
            r'<img[^>]+src=["\']([^"\']+)["\'][^>]+(?:class|id)=["\'][^"\']*logo[^"\']*["\']',
        ]
        for pattern in logo_patterns:
            match = re.search(pattern, html, re.IGNORECASE)
            if match:
                logo_url = match.group(1).strip()
                if not logo_url.startswith("http"):
                    logo_url = urljoin(base_url, logo_url)
                break

        # 3. 주요 컬러 추출 (CSS 변수, theme-color 등)
        colors = []
        theme_match = re.search(r'<meta\s+name=["\']theme-color["\']\s+content=["\']([^"\']+)["\']', html, re.IGNORECASE)
        if theme_match:
            colors.append(theme_match.group(1).strip())
        
        # CSS에서 자주 쓰이는 primary 컬러 패턴
        css_color_matches = re.findall(r'(?:--primary|--brand|--main)[^:]*:\s*(#[0-9a-fA-F]{3,8})', html)
        colors.extend(css_color_matches[:3])

        # 링크/버튼 배경색
        bg_matches = re.findall(r'background(?:-color)?:\s*(#[0-9a-fA-F]{3,8})', html)
        unique_bgs = list(dict.fromkeys(bg_matches))
        # 흰/검 제외
        filtered = [c for c in unique_bgs if c.lower() not in ('#fff', '#ffffff', '#000', '#000000', '#f8f8f8', '#f5f5f5', '#fafafa', '#eee', '#eeeeee')]
        colors.extend(filtered[:2])

        color1 = colors[0] if len(colors) > 0 else "#0f172a"
        color2 = colors[1] if len(colors) > 1 else "#3b82f6"

        return {
            "status": "success",
            "data": {
                "brand_name": brand_name,
                "logo_url": logo_url,
                "color1": color1,
                "color2": color2,
                "domain": domain,
                "final_url": str(resp.url),
            }
        }
    except Exception as e:
        logger.error(f"브랜드 스캔 실패: {e}")
        return {"status": "error", "message": f"스캔 실패: {str(e)}"}


@app.post("/api/v1/generate-strategy")
async def generate_strategy(req: GenerateStrategyRequest, authorization: str = Header(default="")):
    """선택한 레퍼런스와 브랜드 정보를 기반으로 AI 광고 전략 및 카피를 생성합니다."""
    try:
        import openai
        client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

        # 레퍼런스 광고 요약
        ref_summary = ""
        if req.reference_ads:
            ref_items = []
            for i, ad in enumerate(req.reference_ads[:5], 1):
                parts = [f"레퍼런스 {i}:"]
                if ad.get("brand"): parts.append(f"브랜드: {ad['brand']}")
                if ad.get("body"): parts.append(f"카피: {ad['body'][:150]}")
                if ad.get("platform"): parts.append(f"플랫폼: {ad['platform']}")
                ref_items.append(" | ".join(parts))
            ref_summary = "\n".join(ref_items)

        prompt = f"""당신은 대한민국 최고의 퍼포먼스 마케팅 전략가입니다.

아래 브랜드 정보와 경쟁사 레퍼런스 광고를 분석하여, 이 브랜드를 위한 광고 크리에이티브 전략과 카피를 생성하세요.

== 브랜드 정보 ==
- 브랜드명: {req.brand_name or '미입력'}
- 메인컬러: {req.brand_color1}
- 보조컬러: {req.brand_color2}

== 경쟁사 레퍼런스 광고 ==
{ref_summary if ref_summary else '없음 (브랜드 정보만으로 생성)'}

== 출력 형식 (JSON) ==
아래 JSON 형식으로만 답변하세요. 마크다운이나 코드블록 없이 순수 JSON만 반환하세요:
{{
  "strategy_summary": "2-3줄의 전략 요약",
  "target_audience": "타겟 오디언스 설명",
  "tone_and_manner": "톤앤매너 키워드 3-5개",
  "main_headline": "메인 헤드라인 카피 (15자 내외, 한국어)",
  "sub_copy": "서브 카피 (25자 내외, 한국어)",
  "cta_text": "CTA 버튼 텍스트 (5자 내외, 한국어)",
  "alternative_headlines": ["대안 헤드라인1", "대안 헤드라인2", "대안 헤드라인3"],
  "layout_recommendation": "레이아웃 추천 (예: 상단 헤드라인 + 중앙 제품 + 하단 CTA)",
  "color_strategy": "컬러 활용 전략"
}}"""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.8,
            max_tokens=1000,
        )

        result_text = response.choices[0].message.content.strip()

        # JSON 파싱 시도
        import json as json_lib
        # 마크다운 코드블록 제거
        if result_text.startswith("```"):
            result_text = result_text.split("\n", 1)[1] if "\n" in result_text else result_text[3:]
            if result_text.endswith("```"):
                result_text = result_text[:-3]
            result_text = result_text.strip()

        try:
            strategy = json_lib.loads(result_text)
        except json_lib.JSONDecodeError:
            # JSON 부분만 추출 시도
            json_match = re.search(r'\{[\s\S]*\}', result_text)
            if json_match:
                strategy = json_lib.loads(json_match.group())
            else:
                strategy = {"raw_response": result_text}

        return {"status": "success", "data": strategy}

    except Exception as e:
        logger.error(f"AI 전략 생성 실패: {e}")
        return {"status": "error", "message": f"AI 전략 생성 중 오류: {str(e)}"}


# ─── 브랜드 CRUD API ───────────────────────────────────
@app.post("/api/v1/brands")
async def save_brand(req: BrandSaveRequest, authorization: str = Header(default="")):
    """브랜드 정보를 저장합니다."""
    user_id = get_user_id_from_token(authorization)
    if not user_id:
        return {"status": "error", "message": "로그인이 필요합니다."}
    try:
        # 같은 이름 브랜드가 있으면 업데이트
        existing = supabase_admin.table("user_brands")\
            .select("id")\
            .eq("user_id", user_id)\
            .eq("name", req.name)\
            .execute()

        brand_data = {
            "user_id": user_id,
            "name": req.name,
            "url": req.url,
            "color1": req.color1,
            "color2": req.color2,
            "logo_url": req.logo_url,
        }

        if existing.data:
            result = supabase_admin.table("user_brands")\
                .update(brand_data)\
                .eq("id", existing.data[0]["id"])\
                .execute()
        else:
            result = supabase_admin.table("user_brands")\
                .insert(brand_data)\
                .execute()

        return {"status": "success", "data": result.data[0] if result.data else {}}
    except Exception as e:
        logger.error(f"브랜드 저장 실패: {e}")
        return {"status": "error", "message": str(e)}


@app.get("/api/v1/brands")
async def list_brands(authorization: str = Header(default="")):
    """사용자의 저장된 브랜드 목록을 반환합니다."""
    user_id = get_user_id_from_token(authorization)
    if not user_id:
        return {"status": "error", "message": "로그인이 필요합니다.", "data": []}
    try:
        result = supabase_admin.table("user_brands")\
            .select("*")\
            .eq("user_id", user_id)\
            .order("created_at", desc=True)\
            .execute()
        return {"status": "success", "data": result.data}
    except Exception as e:
        return {"status": "error", "message": str(e), "data": []}


@app.delete("/api/v1/brands/{brand_id}")
async def delete_brand(brand_id: str, authorization: str = Header(default="")):
    """저장된 브랜드를 삭제합니다."""
    user_id = get_user_id_from_token(authorization)
    if not user_id:
        return {"status": "error", "message": "로그인이 필요합니다."}
    try:
        supabase_admin.table("user_brands")\
            .delete().eq("id", brand_id).eq("user_id", user_id).execute()
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)

