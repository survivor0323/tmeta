-- ================================================
-- Motiverse AI - Prompt Hub Migration (Step 1: Onboarding)
-- Supabase Dashboard > SQL Editor 에 복사/붙여넣기 후 전체 실행해주세요
-- ================================================

-- 1. 회사 목록 관리용 테이블 생성
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 활성화 (보안)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read companies" ON public.companies;
CREATE POLICY "Allow authenticated read companies" ON public.companies 
  FOR SELECT USING (auth.role() = 'authenticated');

-- 초기 3개 회사 데이터 삽입 (이미 있으면 무시)
INSERT INTO public.companies (name) VALUES 
('모티브인텔리전스'), 
('매드코퍼레이션'), 
('한국디지털광고협회')
ON CONFLICT (name) DO NOTHING;

-- 2. 기존 유저 프로필 테이블(user_profiles)에 온보딩 필수 필드 추가
ALTER TABLE public.user_profiles 
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS department TEXT;

-- 3. 유저 자신의 프로필 정보 조회 함수 (온보딩 확인용)
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS JSON AS $$
DECLARE
  res JSON;
BEGIN
  SELECT json_build_object(
    'full_name', full_name,
    'company_id', company_id,
    'department', department
  ) INTO res
  FROM public.user_profiles
  WHERE user_id = auth.uid();
  RETURN COALESCE(res, '{}'::JSON);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 유저 자신의 프로필 정보 업데이트 함수 (온보딩 완료 팝업용)
CREATE OR REPLACE FUNCTION public.update_my_profile(p_full_name TEXT, p_company_id UUID, p_department TEXT)
RETURNS JSON AS $$
BEGIN
  UPDATE public.user_profiles 
  SET full_name = p_full_name,
      company_id = p_company_id,
      department = p_department
  WHERE user_id = auth.uid();
  
  RETURN json_build_object('status', 'success');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 회사 목록 조회 함수 (드롭다운 및 관리자 페이지용)
CREATE OR REPLACE FUNCTION public.get_companies()
RETURNS JSON AS $$
DECLARE
  res JSON;
BEGIN
  SELECT COALESCE(json_agg(t), '[]'::json) INTO res FROM (
    SELECT id, name FROM public.companies ORDER BY created_at ASC
  ) t;
  RETURN res;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. 회사 등록/수정/삭제 함수 (관리자 전용)
CREATE OR REPLACE FUNCTION public.manage_companies(action TEXT, p_id UUID, p_name TEXT)
RETURNS JSON AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  SELECT is_admin INTO v_is_admin FROM public.user_profiles WHERE user_id = auth.uid();
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION '관리자 권한이 없습니다.';
  END IF;

  IF action = 'insert' THEN
    INSERT INTO public.companies(name) VALUES (p_name);
  ELSIF action = 'update' THEN
    UPDATE public.companies SET name = p_name WHERE id = p_id;
  ELSIF action = 'delete' THEN
    DELETE FROM public.companies WHERE id = p_id;
  END IF;

  RETURN json_build_object('status', 'success');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
