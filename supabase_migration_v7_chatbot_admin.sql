-- ================================================
-- Motiverse AI - V7 마이그레이션 (챗봇 및 기능 요청 업데이트)
-- Supabase Dashboard > SQL Editor 에서 실행하세요
-- ================================================

-- 답변 저장을 위한 컬럼 추가
ALTER TABLE feature_requests ADD COLUMN IF NOT EXISTS admin_reply TEXT;
ALTER TABLE feature_requests ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ;

-- 관리자 열람 권한 추가 (선택사항, RPC에서 서비스키나 define security 로 가져오므로 필수는 아님)
-- CREATE POLICY "Admins can view all feature requests" ON feature_requests FOR SELECT USING (
--    EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND is_admin = true)
-- );

-- 1. 통합 데이터 불러오는 RPC에 feature_requests 포함
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_data()
RETURNS JSON AS $$
DECLARE
  caller_admin BOOLEAN := FALSE;
  res JSON;
BEGIN
  -- 현재 요청자가 관리자인지 확인
  SELECT is_admin INTO caller_admin FROM public.user_profiles WHERE user_id = auth.uid();
  IF caller_admin IS NOT TRUE THEN
    RAISE EXCEPTION '관리자 권한이 없습니다.';
  END IF;

  SELECT json_build_object(
    'users', (SELECT COALESCE(json_agg(t), '[]'::json) FROM (
       SELECT user_id, email, is_admin, created_at, last_login 
       FROM public.user_profiles ORDER BY last_login DESC
    ) t),
    'history', (SELECT COALESCE(json_agg(h), '[]'::json) FROM (
       SELECT h.id, h.user_id, p.email, h.query, h.platform, h.country, h.created_at 
       FROM public.search_history h
       LEFT JOIN public.user_profiles p ON p.user_id = h.user_id
       ORDER BY h.created_at DESC LIMIT 500
    ) h),
    'api_usage', (SELECT COALESCE(json_agg(u), '[]'::json) FROM (
       SELECT u.user_id, p.email, u.endpoint, u.tokens_used, u.created_at 
       FROM public.api_usage_logs u
       LEFT JOIN public.user_profiles p ON p.user_id = u.user_id
       ORDER BY u.created_at DESC LIMIT 500
    ) u),
    'bookmarks', (SELECT COALESCE(json_agg(b), '[]'::json) FROM (
       SELECT b.id, b.user_id, p.email, b.query, b.platform, b.created_at, b.ad_data 
       FROM public.bookmarks b
       LEFT JOIN public.user_profiles p ON p.user_id = b.user_id
       ORDER BY b.created_at DESC LIMIT 500
    ) b),
    'feature_requests', (SELECT COALESCE(json_agg(f), '[]'::json) FROM (
       SELECT f.id, f.user_id, p.email, f.request_text, f.status, f.admin_reply, f.replied_at, f.created_at 
       FROM public.feature_requests f
       LEFT JOIN public.user_profiles p ON p.user_id = f.user_id
       ORDER BY f.created_at DESC LIMIT 500
    ) f)
  ) INTO res;

  RETURN res;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. 관리자가 답변을 업데이트하는 RPC
CREATE OR REPLACE FUNCTION public.update_feature_request_reply(p_request_id UUID, p_reply_text TEXT, p_status TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  caller_admin BOOLEAN := FALSE;
BEGIN
  SELECT is_admin INTO caller_admin FROM public.user_profiles WHERE user_id = auth.uid();
  IF caller_admin IS NOT TRUE THEN
    RAISE EXCEPTION '관리자 권한이 없습니다.';
  END IF;

  UPDATE public.feature_requests 
  SET admin_reply = p_reply_text,
      status = p_status,
      replied_at = NOW()
  WHERE id = p_request_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. 유저가 자신의 문의 내역(및 답변)을 가져오는 RPC (챗봇에 알림 띄워주기 위해)
CREATE OR REPLACE FUNCTION public.get_user_feature_requests()
RETURNS JSON AS $$
DECLARE
  res JSON;
BEGIN
  SELECT COALESCE(json_agg(f), '[]'::json)
  INTO res
  FROM (
      SELECT id, request_text, status, admin_reply, replied_at, created_at 
      FROM public.feature_requests
      WHERE user_id = auth.uid()
      ORDER BY created_at DESC
  ) f;
  
  RETURN res;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
