-- ================================================
-- Motiverse AI - V11 마이그레이션 (프롬프트 카테고리 명칭 정규화)
-- ================================================

-- 기존 프롬프트 허브 데이터에서 영어 접미사 '(' 이후 제거
UPDATE public.hub_prompts
SET category = TRIM(split_part(category, '(', 1))
WHERE category LIKE '%(%';

-- RPC 함수 교체 (부분 매칭 대응 추가)
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
    WHERE (p_category IS NULL OR p_category = '' OR hp.category ILIKE p_category || '%')
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
