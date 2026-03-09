-- ================================================
-- Motiverse AI - Prompt Hub Migration (Step 2: Prompts Table)
-- Supabase Dashboard > SQL Editor 에 복사/붙여넣기 후 전체 실행해주세요
-- ================================================

-- 1. 프롬프트 마켓플레이스 데이터 테이블
CREATE TABLE IF NOT EXISTS public.hub_prompts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  
  -- 출처 정보 (Source)
  source_name TEXT, -- e.g., "Motiverse Cappy GPTs", "Midjourney"
  source_url TEXT, -- e.g., "https://chatgpt.com/g/g-xxx"
  source_model TEXT, -- e.g., "GPT-4o", "Claude 3.5 Sonnet", "DALL-E 3"
  
  -- 핵심 도구 (Prompt)
  prompt_text TEXT NOT NULL,
  
  -- 결과물 (Assets)
  result_text TEXT,
  result_image_url TEXT,
  
  -- 메타데이터 (Meta)
  category TEXT DEFAULT '일반',
  tags JSONB DEFAULT '[]'::jsonb,
  usage_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 활성화 (보안)
ALTER TABLE public.hub_prompts ENABLE ROW LEVEL SECURITY;

-- 누구나 읽을 수 있음 (사내 공개)
DROP POLICY IF EXISTS "Allow authenticated read hub_prompts" ON public.hub_prompts;
CREATE POLICY "Allow authenticated read hub_prompts" ON public.hub_prompts 
  FOR SELECT USING (auth.role() = 'authenticated');

-- 본인만 생성 가능
DROP POLICY IF EXISTS "Allow authenticated insert hub_prompts" ON public.hub_prompts;
CREATE POLICY "Allow authenticated insert hub_prompts" ON public.hub_prompts 
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- 본인만 수정/삭제 가능
DROP POLICY IF EXISTS "Allow owner update hub_prompts" ON public.hub_prompts;
CREATE POLICY "Allow owner update hub_prompts" ON public.hub_prompts 
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Allow owner delete hub_prompts" ON public.hub_prompts;
CREATE POLICY "Allow owner delete hub_prompts" ON public.hub_prompts 
  FOR DELETE USING (user_id = auth.uid());


-- 2. 사용 횟수 증가 함수
CREATE OR REPLACE FUNCTION public.increment_prompt_usage(p_prompt_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.hub_prompts
  SET usage_count = usage_count + 1
  WHERE id = p_prompt_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 프롬프트 목록 조회 함수 (작성자 소속 포함)
CREATE OR REPLACE FUNCTION public.get_hub_prompts(
  p_category TEXT DEFAULT NULL,
  p_search_keyword TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  res JSON;
BEGIN
  SELECT COALESCE(json_agg(t), '[]'::json) INTO res FROM (
    SELECT 
      hp.*,
      up.full_name AS author_name,
      up.department AS author_dept,
      c.name AS author_company
    FROM public.hub_prompts hp
    LEFT JOIN public.user_profiles up ON hp.user_id = up.user_id
    LEFT JOIN public.companies c ON up.company_id = c.id
    WHERE (p_category IS NULL OR p_category = '' OR hp.category = p_category)
      AND (
        p_search_keyword IS NULL OR p_search_keyword = '' 
        OR hp.title ILIKE '%' || p_search_keyword || '%'
        OR hp.prompt_text ILIKE '%' || p_search_keyword || '%'
        OR hp.tags::text ILIKE '%' || p_search_keyword || '%'
      )
    ORDER BY hp.created_at DESC
  ) t;
  
  RETURN res;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. 내 즐겨찾기 테이블 (크롬 익스텐션에서 빨리 접근하기 위함)
CREATE TABLE IF NOT EXISTS public.hub_prompt_bookmarks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES public.hub_prompts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, prompt_id)
);

ALTER TABLE public.hub_prompt_bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow owner manage bookmarks" ON public.hub_prompt_bookmarks;
CREATE POLICY "Allow owner manage bookmarks" ON public.hub_prompt_bookmarks
  FOR ALL USING (user_id = auth.uid());
