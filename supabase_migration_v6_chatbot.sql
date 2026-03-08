-- ================================================
-- Motiverse AI - V6 마이그레이션 (챗봇 및 기능 요청 DB)
-- Supabase Dashboard > SQL Editor 에서 실행하세요
-- ================================================

CREATE TABLE IF NOT EXISTS feature_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    request_text TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 활성화
ALTER TABLE feature_requests ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 요청만 조회 및 추가 가능
CREATE POLICY "users_own_requests_select" ON feature_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_own_requests_insert" ON feature_requests FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 서비스 역할(관리자)은 모두 가능
CREATE POLICY "service_role_requests_all" ON feature_requests USING (true);
