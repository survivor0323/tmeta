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
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY) if SUPABASE_URL else None
except Exception as e:
    logger.warning(f"Supabase 초기화 실패: {e}")
    supabase = None

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

        brands = extract_brands_from_natural_language(req.query, country=req.country)
        logger.info(f"AI 자연어 분석으로 도출된 검색 타겟 브랜드: {brands} (Platform: {platform})")

        if not brands:
            return {
                "status": "error",
                "message": "AI가 해당 쿼리와 연관된 브랜드를 찾지 못했습니다. 쿼리를 변경해 보세요.",
                "data": []
            }
            
        real_responses = []
        
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
                keyword=req.query,
                country=req.country
            )
            if google_ads:
                analyze_creatives_with_ai(google_ads)
                real_responses.extend(google_ads)
        else:
            ads_by_brand = fetch_competitor_ads_batch(brands)
            for brand, ads in ads_by_brand.items():
                if not ads:
                    logger.info(f"[{brand}] 수집된 광고가 없습니다.")
                    continue
                winning_ads = extract_winning_creatives(ads, min_months_active=0)
                if winning_ads:
                    analyze_creatives_with_ai(winning_ads)
                    real_responses.extend(winning_ads)
                
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

        return {
            "status": "success",
            "message": f"{len(brands)}개의 브랜드에서 총 {len(real_responses)}개의 실전 위닝 소재를 추출 및 AI 분석했습니다.",
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
