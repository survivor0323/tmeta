-- ================================================
-- Motiverse AI - V13 마이그레이션 (프롬프트 공개설정)
-- ================================================

ALTER TABLE public.hub_prompts
ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public',
ADD COLUMN IF NOT EXISTS shared_with JSONB DEFAULT '{}'::jsonb;

-- RPC 함수 교체 (공개설정 및 작성자 정보 확장)
CREATE OR REPLACE FUNCTION public.get_hub_prompts(
  p_category TEXT DEFAULT NULL,
  p_search_keyword TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  res JSON;
  v_user_email TEXT := auth.jwt() ->> 'email';
  v_user_dept TEXT;
BEGIN
  SELECT department INTO v_user_dept FROM public.user_profiles WHERE user_id = auth.uid();

  SELECT COALESCE(json_agg(t), '[]'::json) INTO res FROM (
    SELECT 
      hp.*,
      up.full_name AS author_name,
      up.department AS author_dept,
      c.name AS author_company,
      au.email AS author_email
    FROM public.hub_prompts hp
    LEFT JOIN public.user_profiles up ON hp.user_id = up.user_id
    LEFT JOIN public.companies c ON up.company_id = c.id
    LEFT JOIN auth.users au ON hp.user_id = au.id
    WHERE (p_category IS NULL OR p_category = '' OR hp.category ILIKE p_category || '%')
      AND (
        p_search_keyword IS NULL OR p_search_keyword = '' 
        OR hp.title ILIKE '%' || p_search_keyword || '%'
        OR hp.prompt_text ILIKE '%' || p_search_keyword || '%'
        OR hp.tags::text ILIKE '%' || p_search_keyword || '%'
      )
      AND (
        hp.visibility = 'public' 
        OR hp.visibility IS NULL 
        OR hp.user_id = auth.uid()
        OR (hp.visibility = 'shared_users' AND (hp.shared_with->'users')::jsonb ? v_user_email)
        OR (hp.visibility = 'shared_team' AND (hp.shared_with->'teams')::jsonb ? v_user_dept)
      )
    ORDER BY hp.created_at DESC
  ) t;
  
  RETURN res;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
