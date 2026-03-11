from fastapi import FastAPI, BackgroundTasks, Request, Header
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, Response
import os
import json
import logging
from pydantic import BaseModel, validator
from typing import List, Optional, Dict
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

from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 정적 파일 서빙 ('static' 폴더 하위의 html, css, js 리소스들을 루트경로에 호스팅)
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/", response_class=HTMLResponse)
async def read_dashboard():
    with open("static/index.html", "r", encoding="utf-8") as f:
        return f.read()

@app.get("/admin/errors", response_class=HTMLResponse)
async def read_admin_errors():
    with open("static/admin_errors.html", "r", encoding="utf-8") as f:
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
    video_frames: Optional[List[str]] = None

class HistorySaveRequest(BaseModel):
    query: str
    platform: str
    country: Optional[str] = "KR"
    ads_data: list = []

class BookmarkSaveRequest(BaseModel):
    ad_data: dict
    query: str
    platform: str

class GenerateInsightRequest(BaseModel):
    ads_data: list
    platform: str
    query: str

class ChatRequest(BaseModel):
    message: str

class RefineReplyRequest(BaseModel):
    draft_reply: str
    user_request: str

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

        # 캐시 재사용을 위해 search_history에 자동으로 현재 쿼리 및 결과 저장
        if supabase_admin:
            try:
                import json
                history_data = {
                    "query": req.query,
                    "platform": platform,
                    "country": req.country or "KR",
                    "ads_data": json.loads(json.dumps(real_responses, default=str)) # 파싱 에러 방지용 안전 직렬화
                }
                if user_id:
                    history_data["user_id"] = user_id
                
                # RLS 이슈를 우회하기 위해 admin 클라이언트 사용 (타 브랜드를 검색할 때 로그인 안 한 사용자의 데이터도 캐시로 사용 목적)
                supabase_admin.table("search_history").insert(history_data).execute()
                logger.info(f"검색 데이터 자동 캐시 저장 완료: '{req.query}' ({platform})")
            except Exception as hist_err:
                logger.warning(f"[History] 자동 캐시 저장 실패: {hist_err}")

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
async def analyze_single_creative(req: SingleAnalyzeRequest):
    """
    단일 이미지나 단일 비디오(프레임별 base64)를 입력받아 AI가 hook, body, cta를 분석
    """
    if req.media_type and req.media_type.lower() == "video" and not getattr(req, "video_frames", None):
        return {
            "status": "error",
            "message": "영상의 원본 링크 구성으로 인해 브라우저에서 주요 장면을 추출할 수 없습니다. (CORS 보안 정책 등)",
            "data": None
        }
    try:
        from anti_gravity_ads_logic import analyze_single_creative_with_ai
        report = analyze_single_creative_with_ai(req.media_url, req.media_type, getattr(req, "video_frames", None))
        return {"status": "success", "data": report}
    except Exception as e:
        logger.error(f"Error in single analysis: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}

class GenerateInsightRequest(BaseModel):
    ads_data: List[Dict]
    query: str
    platform: str

@app.post("/api/v1/generate-insights")
async def generate_insights(req: GenerateInsightRequest, authorization: str = Header(default="")):
    """
    수집된 특정 브랜드/키워드의 광고 목록을 통째로 OpenAI에 던져
    종합 AI 인사이트 시트를 반환받습니다.
    """
    user_id = get_user_id_from_token(authorization)
    try:
        from anti_gravity_ads_logic import generate_ai_insight_report
        if not req.ads_data:
            return {"status": "error", "message": "분석할 소재 데이터가 부족합니다."}
            
        report = generate_ai_insight_report(req.ads_data, req.query, req.platform)
        
        # Save to Supabase DB
        client = supabase_admin if supabase_admin else supabase
        if user_id and client: 
            try:
                client.table("ai_insights").insert({
                    "user_id": user_id,
                    "brand_name": req.query,
                    "platform": req.platform,
                    "report_content": report
                }).execute()
            except Exception as e:
                logger.error(f"Failed to save AI insight to DB: {e}")

        return {"status": "success", "data": report}
    except Exception as e:
        logger.error(f"[AI Insights Error]: {e}", exc_info=True)
        return {"status": "error", "message": str(e), "data": None}

@app.get("/api/v1/ai-insights")
async def get_ai_insights(brand: str, platform: str, authorization: str = Header(default="")):
    """지정된 브랜드와 플랫폼의 이전 AI 인사이트 리포트를 DB에서 가져옵니다."""
    user_id = get_user_id_from_token(authorization)
    if not user_id:
        return {"status": "error", "message": "로그인이 필요합니다."}
        
    client = supabase_admin if supabase_admin else supabase
    if not client:
        return {"status": "error", "message": "Supabase 클라이언트가 초기화되지 않았습니다."}
    
    try:
        response = client.table("ai_insights").select("*").eq("user_id", user_id).eq("brand_name", brand).eq("platform", platform).order("created_at", desc=True).limit(10).execute()
        return {"status": "success", "data": response.data}
    except Exception as e:
        logger.error(f"AI insights fetch error: {e}")
        return {"status": "error", "message": str(e)}

class RecommendRequest(BaseModel):
    keyword: str
    platform: str

@app.post("/api/v1/chat")
async def chat_with_bot(req: ChatRequest, authorization: str = Header(default="")):
    """
    챗봇 기능. 단순 질문 답변 또는 새로운 기능 요청을 처리하며,
    새로운 기능 요청일 경우 관리자 대시보드(DB) 테이블에 저장합니다.
    """
    user_id = get_user_id_from_token(authorization)
    try:
        from openai import OpenAI
        import os
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        if not client.api_key:
            return {"status": "error", "message": "API Key not configured."}
            
        system_prompt = """당신은 Motiverse 서비스의 너무나 친절하고 똑똑한 어시스턴트(AI 챗봇)입니다.
현재 시스템은 다음과 같은 기능들을 제공하고 있습니다:
1. 레퍼런스 검색: 여러 플랫폼(메타, 인스타그램, 구글, 틱톡)의 광고들을 키워드 혹은 해시태그로 검색해주는 기능.
2. 경쟁사 모니터링: 특정 브랜드를 등록하면 서버에서 매일 자동으로 최신 광고 데이터를 수집해주며, 14일 이상 등 기간별, 참여도별로 확인할 수 있고 AI 리포트를 생성할 수 있는 기능.
3. 브랜드 폴더 & 저장(북마크): 즐겨찾기, 레퍼런스들을 폴더별로 카테고리라이징하여 저장 및 모아보는 기능.
4. AI 크리에이티브 인사이트: 수집된 소재들의 Hook, Messaging, Visual 전략을 AI가 해체해주는 기능.

# 업무 규칙:
- 사용자의 메시지를 보고 [질문/사용법 문의] 라면 현재 제공되는 기능 내에서 친절하게 답변해주세요. (마크다운 포맷팅 사용)
- 사용자의 메시지가 [새로운 기능 요청] 이라면, 
   1) 현재 기능으로 이미 할 수 있는 건지 확인하고, 가능하다면 어떻게 쓰면 되는지 알려주세요.
   2) 현재 없는 기능이라면, 건의사항으로 잘 접수했다고 답변해주세요.
- 그리고 무조건 답변의 가장 마지막에 아래의 형태를 지키는 JSON 블록을 반환해주세요 (이 블록 외에 다른 텍스트는 자유롭게 작성하세요).

```json
{
  "is_feature_request": boolean (진짜로 서비스에 추가해달라는 신규 개발 요청일 경우 true, 단순 질문이거나 이미 있는 기능이면 false),
  "request_summary": "신규 개발 요청일 경우, 관리자가 알아보기 쉽게 요약. 아니면 빈 문자열"
}
```
"""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": req.message}
            ],
            temperature=0.7,
        )
        
        reply_text = response.choices[0].message.content
        import re, json
        
        # 파싱
        json_str = ""
        is_request = False
        request_summary = ""
        clean_reply = reply_text
        
        json_match = re.search(r'```json\n(.*?)\n```', reply_text, re.DOTALL)
        if json_match:
            try:
                data = json.loads(json_match.group(1))
                is_request = data.get("is_feature_request", False)
                request_summary = data.get("request_summary", "")
                clean_reply = reply_text.replace(json_match.group(0), "").strip()
            except:
                pass

        if is_request and request_summary and user_id:
            # DB에 저장
            db_client = supabase_admin if supabase_admin else supabase
            if db_client:
                db_client.table("feature_requests").insert({
                    "user_id": user_id,
                    "request_text": request_summary
                }).execute()
                
        return {"status": "success", "data": {"reply": clean_reply}}

    except Exception as e:
        logger.error(f"Chatbot error: {e}")
        return {"status": "error", "message": "채팅 서버에 문제가 발생했습니다."}

@app.post("/api/v1/admin/refine-reply")
async def admin_refine_reply(req: RefineReplyRequest, authorization: str = Header(default="")):
    """관리자가 작성한 챗봇 답변 초안을 AI로 친절하고 전문적으로 다듬어 반환합니다."""
    user_id = get_user_id_from_token(authorization)
    # 간단한 권한 검사 (서비스 단에서 실제 is_admin 체크가 권장되지만, 데모/편의상 넘어갈 수 있음)
    if not user_id:
        return {"status": "error", "message": "인증 정보가 없습니다."}

    try:
        from openai import OpenAI
        import os
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        
        system_prompt = "당신은 IT 서비스의 전문적이고 다정한 고객 지원 팀(운영진)입니다. 사용자의 '서비스 개선/기능 도입 요청'에 대해, 서비스 담당자로서 검토 결과를 공식 답변하는 상황입니다.\n작성된 답변 '초안'의 의도를 파악하여 직관적이고 친절한 최종 답변 텍스트로 다듬어주세요.\n[수정 가이드라인]\n1. '기능을 제안해 주셔서 감사하다'는 인사를 가볍게 포함하세요.\n2. 말투는 정중하면서도 친근한 해요체/하십시오체를 사용하세요.\n3. 너무 과하지 않게 적절한 이모지를 사용하여 따뜻한 느낌을 주세요.\n4. 반드시 서비스 제공자(운영진)의 입장에서 답변해야 합니다. 사용자가 답변하는 것처럼 보이지 않게 하세요.\n5. 인사말과 맺음말을 포함해 주세요.\n6. 불필요한 서론 없이 답변 내용만 바로 출력하세요."
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"[사용자 요청 내용]\n{req.user_request}\n\n[운영진 답변 초안]\n{req.draft_reply}"}
            ],
            temperature=0.7,
        )
        refined_text = response.choices[0].message.content.strip()
        return {"status": "success", "data": {"refined": refined_text}}
    except Exception as e:
        logger.error(f"AI 답변 교정 중 오류: {e}")
        return {"status": "error", "message": "AI 교정에 실패했습니다."}

class ExtensionErrorRequest(BaseModel):
    platform: str
    url: str
    error_message: str = ""
    stack_trace: str = ""

@app.post("/api/v1/log-extension-error")
async def log_extension_error(req: ExtensionErrorRequest, authorization: str = Header(default="")):
    """크롬 익스텐션에서 화면 파싱에 실패했을 때 무음으로 서버에 로그를 남깁니다."""
    user_id = get_user_id_from_token(authorization) # Optional, can be None
    
    try:
        db_client = supabase_admin if supabase_admin else supabase
        if db_client:
            db_client.table("extension_error_logs").insert({
                "user_id": user_id,
                "platform": req.platform,
                "url": req.url,
                "error_message": req.error_message,
                "stack_trace": req.stack_trace
            }).execute()
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Failed to log extension error: {e}")
        return {"status": "error", "message": str(e)}

@app.get("/api/v1/admin/errors")
async def get_admin_errors(authorization: str = Header(default="")):
    """관리자용: 익스텐션 등에서 발생한 화면 파싱 오류 내역을 조회합니다."""
    # 간단한 권한 검증: 현재는 인증된 모든 사용자 볼수 있게 (필요시 admin체크)
    user_id = get_user_id_from_token(authorization)
    if not user_id:
        return {"status": "error", "message": "인증 정보가 없습니다."}
    
    try:
        db_client = supabase_admin if supabase_admin else supabase
        response = db_client.table("extension_error_logs").select("*").order("created_at", desc=True).limit(100).execute()
        return {"status": "success", "data": response.data}
    except Exception as e:
        logger.error(f"Failed to get extension errors: {e}")
        return {"status": "error", "message": str(e)}

class PromptTitleRequest(BaseModel):
    prompt_text: str
    result_text: str = ""

@app.post("/api/v1/generate-prompt-title")
async def generate_prompt_title(req: PromptTitleRequest, authorization: str = Header(default="")):
    """프롬프트와 결과를 바탕으로 AI가 적절한 제목을 생성합니다."""
    # CORS/Auth check
    user_id = get_user_id_from_token(authorization)
    if not user_id:
        return {"status": "error", "message": "인증 정보가 없습니다."}

    try:
        from openai import OpenAI
        import os
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        
        system_prompt = """주어진 프롬프트와 결과 텍스트를 분석하여, 이 프롬프트의 '제목'과 '카테고리'를 분류하세요.
단순히 프롬프트 내용의 앞부분을 복사해 자르지 말고, 프롬프트가 의도하는 핵심 목적(예: '블로그 포스팅 초안 작성', '유튜브 스크립트 기획', '20대 여성 이미지 생성')을 파악하여 15자 내외의 명확하고 간결한 제목을 만들어주세요.

특히 프롬프트 내용이 이미지나 영상을 그려 달라는 요청이라면 반드시 'OO 이미지 생성' 과 같이 그 의도가 분명하게 드러나도록 제목을 기획해 주세요. 프롬프트 원문을 제목으로 그대로 쓰지 마세요.

다음 카테고리 중 하나를 정확히 선택하세요:
["시장 조사 및 전략", "카피라이팅 및 텍스트", "소셜 미디어 및 콘텐츠", "시각적 크리에이티브", "영상 기획 및 스토리보드", "캠페인 및 프로모션", "검색 최적화 및 광고 관리", "클라이언트 관리 및 보고", "브랜드 아이덴티티 및 정립", "운영 및 행정", "개발 및 프로그래밍", "기타", "일반"]

반드시 아래 JSON 포맷으로만 응답하세요. 다른 내용은 절대 추가하지 마세요:
```json
{
  "title": "분석된 핵심 목적 중심의 제목 (15자 이내)",
  "category": "분류된 카테고리 문자열"
}
```"""
        user_content = f"[프롬프트]\n{req.prompt_text}\n\n[결과 텍스트]\n{req.result_text}"
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            temperature=0.3,
            response_format={ "type": "json_object" }
        )
        import json
        result_content = response.choices[0].message.content.strip()
        try:
            parsed = json.loads(result_content)
            title = parsed.get("title", "").strip()
            category = parsed.get("category", "")
        except:
            title = result_content[:15] + "..."
            category = ""
        
        # 제공된 카테고리에 속하지 않거나 파싱 실패시 기타 문구 설정
        valid_categories = ["시장 조사 및 전략", "카피라이팅 및 텍스트", "소셜 미디어 및 콘텐츠", "시각적 크리에이티브", "영상 기획 및 스토리보드", "캠페인 및 프로모션", "검색 최적화 및 광고 관리", "클라이언트 관리 및 보고", "브랜드 아이덴티티 및 정립", "운영 및 행정", "개발 및 프로그래밍", "기타", "일반"]
        
        is_valid = False
        for valid_cat in valid_categories:
            if valid_cat in category or category in valid_cat:
                category = valid_cat
                is_valid = True
                break
                
        if not is_valid or not category:
            category = "기타"
            
        # 불필요한 따옴표 제거 (혹시 모를 예외 처리)
        if title.startswith('"') and title.endswith('"'):
             title = title[1:-1]
        
        return {"status": "success", "data": {"title": title, "category": category}}
    except Exception as e:
        logger.error(f"프롬프트 제목/카테고리 생성 중 오류: {e}")
        return {"status": "error", "message": "제목/카테고리 생성에 실패했습니다."}

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

def classify_brand_category_bg(brand_name: str):
    """
    브랜드가 모니터링에 추가될 때 비동기로 실행되어, 
    해당 브랜드가 어느 분야(카테고리)에 속하는지 AI로 분류한 뒤 global_brands에 저장합니다.
    """
    try:
        # 백그라운드이므로 이미 등록되어 있는지 체크
        existing_global = supabase_admin.table("global_brands").select("id").eq("brand_name", brand_name).execute()
        if existing_global.data:
            return

        from openai import OpenAI
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        prompt = (
            f"당신은 브랜드 마케팅 전문가입니다. 검색된 브랜드명 '{brand_name}'이(가) "
            "다음 14가지 분야 중 어디에 속하는지 가장 알맞은 단수형 카테고리 1개만 정확하게 한국어로 말해주세요.\n\n"
            "[카테고리 목록]\n"
            "뷰티, 패션, 식품, 홈·생활, 가전·디지털, 취미·반려동물, 이커머스·쇼핑, 금융·핀테크, 교육, 헬스·건강, IT 솔루션·SaaS, 라이프스타일 서비스, 콘텐츠·미디어, 기타\n\n"
            "[응답 예시]\n뷰티\n\n(부가 설명이나 마침표 없이 카테고리 이름만 답할 것)"
        )
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=20,
            temperature=0.0
        )
        category = response.choices[0].message.content.strip().replace('.', '')
        
        # 목록에 없는 값이 나왔을 경우 fallback
        valid_categories = ["뷰티", "패션", "식품", "홈·생활", "가전·디지털", "취미·반려동물", "이커머스·쇼핑", "금융·핀테크", "교육", "헬스·건강", "IT 솔루션·SaaS", "라이프스타일 서비스", "콘텐츠·미디어", "기타"]
        if category not in valid_categories:
            category = "기타"

        # global_brands 테이블에 저장 (UPSERT)
        supabase_admin.table("global_brands").upsert({
            "brand_name": brand_name,
            "category": category
        }).execute()
        logger.info(f"[Category AI] '{brand_name}' -> {category} 분류 완료 및 global_brands 추가")
    except Exception as e:
        logger.error(f"[Category AI] '{brand_name}' 분류 실패: {e}")

@app.post("/api/v1/monitors")
async def add_monitor(req: MonitorRequest, background_tasks: BackgroundTasks, authorization: str = Header(default="")):
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
        
        # 백그라운드 태스크로 AI 카테고리 분류 트리거
        background_tasks.add_task(classify_brand_category_bg, req.brand_name)
        
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

@app.get("/api/v1/recommendations")
async def get_recommendations():
    """다른 마케터들이 추가한 분야별 추천 경쟁사를 가져옵니다."""
    try:
        # get_recommended_competitors RPC를 호출하여 집계 데이터를 가져옵니다.
        # RLS 상관없이 데이터를 읽기 위해 supabase_admin 사용 또는 public 가능.
        result = supabase_admin.rpc("get_recommended_competitors").execute()
        brands = result.data or []
        
        try:
            mb_result = supabase_admin.table("monitored_brands").select("brand_name, ads_data").execute()
            ads_count_map = {}
            for row in (mb_result.data or []):
                b_name = row.get("brand_name")
                ads_len = len(row.get("ads_data") or [])
                if b_name not in ads_count_map or ads_len > ads_count_map[b_name]:
                    ads_count_map[b_name] = ads_len
                    
            for b in brands:
                b["ads_count"] = ads_count_map.get(b.get("brand_name"), 0)
        except Exception as inner_e:
            logger.error(f"ads_count 조회 실패: {inner_e}")
            for b in brands:
                b["ads_count"] = 0

        return {"status": "success", "data": brands}
    except Exception as e:
        logger.error(f"추천 경쟁사 로드 에러: {e}")
        return {"status": "error", "message": str(e), "data": []}

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
                             "platform": platform,
                             "start_date": a.get("start_date", "2024-01-01"),
                             "active_days": a.get("active_days"),
                             "likes": a.get("likes", 0),
                             "comments": a.get("comments", 0),
                             "views": a.get("views", 0),
                             "hashtags": a.get("hashtags", []),
                             "analysis_report": a.get("analysis_report")} for a in ads[:20]]
                supabase_admin.table("monitor_alerts").insert({
                    "user_id": user_id,
                    "monitor_id": mon["id"],
                    "brand_name": brand,
                    "new_ads_count": len(ads),
                    "ads_data": slim_ads,
                }).execute()
                total_new += len(ads)

            # last_checked_at 및 ads_data 갱신
            from datetime import datetime, timezone
            update_data = {"last_checked_at": datetime.now(timezone.utc).isoformat()}
            if ads:
                update_data["ads_data"] = ads[:50]
                
            supabase_admin.table("monitored_brands")\
                .update(update_data)\
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
        logger.error(f"브랜드 스캔 실패(접속 차단/타임아웃 등): {e}")
        # 일부 보안이 강한 사이트(예: 통신사, 은행 등)나 타임아웃 시에도 사용자가 다음 스텝으로 넘어갈 수 있도록 기본 정보 반환
        from urllib.parse import urlparse
        parsed = urlparse(url)
        domain = parsed.netloc.replace("www.", "")
        brand_name = domain.split(".")[0].capitalize()
        
        return {
            "status": "success",
            "message": f"웹사이트에서 상세 정보를 가져오지 못했습니다(보안 차단 또는 응답 지연). 기본 정보를 표시합니다. (사유: {str(e)})",
            "data": {
                "brand_name": brand_name,
                "logo_url": "",
                "color1": "#0f172a",
                "color2": "#3b82f6",
                "domain": domain,
                "final_url": url,
            }
        }


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

        prompt = f"""[Persona 설정]
"너는 칸 라이언즈(Cannes Lions)와 스파이크스 아시아에서 다수의 수상 경력을 가진 15년 차 시니어 광고 기획자(AE)이자 크리에이티브 디렉터(CD)야. 데이터 뒤에 숨겨진 소비자의 결핍(Unmet Needs)을 찾아내고, 경쟁사의 크리에이티브 전략을 해부하는 데 탁월한 통찰력을 가지고 있어."

[Task 1: 경쟁사 및 크리에이티브 심층 분석]
아래 제공된 [경쟁사/레퍼런스]의 최근 광고 캠페인을 분석해줘.
- 경쟁사 분석: 타겟팅하는 핵심 페르소나와 소구점(USP)은 무엇인가?
- 크리에이티브 디코딩: 비주얼 문법(색감, 구도, 폰트)과 톤앤매너로 심어주려는 '브랜드 이미지'는?
- Gap 분석: 경쟁사가 놓치고 있는 시장의 빈틈이나 소비자의 피로도는 어디에 있는가?

[Task 2: 자사 브랜드('{req.brand_name or '우리 브랜드'}') 광고 전략 및 컨셉 도출]
- Big Idea: 앞선 분석을 바탕으로, 경쟁사를 압도할 수 있는 파괴적인 크리에이티브 컨셉 제안.
- 메시지 설계: 소비자의 감정을 자극할 수 있는 '한 줄의 메인 카피(Slogan)'와 '서브 카피', 그리고 그 이유(Rationale).
- 비주얼 가이드: 브랜드를 시각적으로 상징화할 수 있는 아트워크 방향성 제시.

[Task 3: AI 이미지 생성을 위한 고해상도 프롬프트 작성]
위에서 도출된 최적의 컨셉을 바탕으로, Imagen 모델이 완벽한 광고 이미지를 생성할 수 있도록 전문가 수준의 "영문 이미지 생성 프롬프트"를 작성해줘.
반드시 아래 디테일을 포함해야 함:
- Lighting: (예: 시네마틱 조명, 골든 아워의 자연광 등)
- Composition: (예: 황금비율, 로우 앵글, 클로즈업 등)
- Texture & Style: (예: 프리미엄 질감, 하이퍼 리얼리즘, 8k 해상도, 최상급 렌즈 사용 등)
- Mood: (예: 신뢰감 있는, 파격적인, 미니멀한 등)

== 입력 데이터 ==
- 자사 브랜드: {req.brand_name or '미입력'}
- 브랜드 메인컬러: {req.brand_color1} / 서브컬러: {req.brand_color2}
- 레퍼런스 광고 요약:
{ref_summary if ref_summary else '없음 (브랜드 정보만으로 유추하여 혁신적인 제안을 할 것)'}

== 출력 형식 (JSON) ==
아래 JSON 형식의 키 값들을 정확히 지켜서 평문 텍스트 없이 JSON만 반환해:
{{
  "strategy_summary": "[1단계 분석] 경쟁사 Gap과 이를 파고들 Big Idea 요약",
  "target_audience": "도출된 핵심 타겟 오디언스",
  "tone_and_manner": "톤앤매너 키워드 3~5개",
  "main_headline": "메인 헤드라인 카피 (15자 내외, 시선 강탈)",
  "sub_copy": "서브 카피 (25자 내외, 설득력 있는 부연 설명)",
  "cta_text": "CTA 버튼 텍스트 (예: 지금 바로 알아보기)",
  "alternative_headlines": ["대안 메인 카피1", "대안 메인 카피2", "대안 메인 카피3"],
  "visual_guide": "비주얼 가이드 및 레이아웃 제안 (한국어)",
  "ai_image_prompt": "Imagen 3 모델에 넣을 고퀄리티 영문 이미지 프롬프트 (Lighting, Composition, Texture, Mood 포함)"
}}"""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.8,
            max_tokens=1500,
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


@app.get("/api/v1/image-proxy")
async def image_proxy(url: str):
    """Bypasses CORS and 403 hotlinking restrictions for Meta/Google ad images."""
    if not url:
        return Response(status_code=400)
    import httpx
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", "Referer": "https://www.facebook.com/"})
            return Response(content=resp.content, media_type=resp.headers.get("Content-Type", "image/jpeg"))
    except Exception as e:
        logger.error(f"Image proxy error for {url}: {e}")
        return Response(status_code=400)


class GenerateImageRequest(BaseModel):
    prompt: str
    aspect_ratio: Optional[str] = "16:9"

@app.post("/api/v1/generate-creative-image")
async def generate_creative_image(req: GenerateImageRequest, authorization: str = Header(default="")):
    """Gemini API (imagen-4.0-generate-001)를 사용하여 기획 데이터를 바탕으로 소재 이미지를 생성합니다."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return {"status": "error", "message": "GEMINI_API_KEY가 설정되지 않았습니다."}
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key={api_key}"
    payload = {
        "instances": [{"prompt": req.prompt}],
        "parameters": {
            "sampleCount": 1,
            "aspectRatio": req.aspect_ratio  # 1:1, 3:4, 4:3, 9:16, 16:9 지원
        }
    }
    
    try:
        import httpx
        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(url, json=payload)
            res_json = resp.json()
            
            if resp.status_code == 200 and 'predictions' in res_json:
                b64_img = res_json['predictions'][0].get('bytesBase64Encoded', '')
                if b64_img:
                    return {"status": "success", "data": {"image_b64": f"data:image/jpeg;base64,{b64_img}"}}
            
            # 실패 시 상세 메시지 전달
            error_details = res_json.get("error", {}).get("message", str(res_json))
            return {"status": "error", "message": f"API 상태({resp.status_code}): {error_details}"}
    except Exception as e:
        logger.error(f"이미지 생성 에러: {e}")
        return {"status": "error", "message": f"서버 예외 발생: {str(e)}"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)

