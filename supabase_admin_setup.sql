-- ================================================
-- Motiverse AI - Admin Dashboard Migration
-- Supabase Dashboard > SQL Editor 에 복사/붙여넣기 후 전체 실행해주세요
-- ================================================

-- 1. 유저 프로필 테이블 생성 (이메일 및 관리자 권한 저장)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ DEFAULT NOW()
);

-- 2. API 사용량 로그 테이블 (토큰 사용량 추정용)
CREATE TABLE IF NOT EXISTS public.api_usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 활성화 (보안)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;

-- 3. 핵심 함수 (RPC) - 관리자 확인 및 프로필 갱신
-- 첫 로그인 시 자동 프로필 생성 및 초기 관리자 3인 자동 권한 부여
CREATE OR REPLACE FUNCTION public.upsert_profile_and_check_admin(p_user_id UUID, p_email TEXT)
RETURNS JSON AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_initial_admin BOOLEAN;
BEGIN
  -- 대상이 기본 관리자인가?
  v_initial_admin := p_email IN ('jayyang@motiv-i.com', 'vibeyangjm@gmail.com', 'survivor@motiv-i.com');
  
  -- UPSERT 수행
  INSERT INTO public.user_profiles (user_id, email, is_admin, last_login)
  VALUES (p_user_id, p_email, v_initial_admin, NOW())
  ON CONFLICT (user_id) DO UPDATE 
  SET last_login = NOW(), email = EXCLUDED.email
  RETURNING is_admin INTO v_is_admin;
  
  -- 기본 관리자 목록에 있는데 권한이 없는 경우(기존 생성된 계정 소급적용)
  IF v_initial_admin AND NOT v_is_admin THEN
    UPDATE public.user_profiles SET is_admin = true WHERE user_id = p_user_id;
    v_is_admin := true;
  END IF;

  RETURN json_build_object('is_admin', v_is_admin);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 핵심 함수 (RPC) - 통합 관리자 대시보드 데이터 조회
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

  -- 접속자 목록, 검색 기록, API 사용량 집계
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
    ) u)
  ) INTO res;

  RETURN res;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 핵심 함수 (RPC) - 관리자 권한 토글 (부여/제거)
CREATE OR REPLACE FUNCTION public.toggle_admin_status(target_email TEXT, assign_admin BOOLEAN)
RETURNS BOOLEAN AS $$
DECLARE
  caller_admin BOOLEAN := FALSE;
BEGIN
  SELECT is_admin INTO caller_admin FROM public.user_profiles WHERE user_id = auth.uid();
  IF caller_admin IS NOT TRUE THEN
    RAISE EXCEPTION '관리자 권한이 없습니다.';
  END IF;

  UPDATE public.user_profiles SET is_admin = assign_admin WHERE email = target_email;
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. 핵심 함수 (RPC) - API 사용량(토큰) 로깅
CREATE OR REPLACE FUNCTION public.log_api_usage(p_user_id UUID, p_endpoint TEXT, p_tokens INTEGER)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.api_usage_logs(user_id, endpoint, tokens_used)
  VALUES (p_user_id, p_endpoint, p_tokens);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
