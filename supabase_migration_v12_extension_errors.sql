-- ================================================
-- Motiverse AI - V12 마이그레이션 (익스텐션 에러 로깅 테이블)
-- ================================================

CREATE TABLE IF NOT EXISTS public.extension_error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- optional
    platform TEXT NOT NULL,
    url TEXT NOT NULL,
    error_message TEXT,
    stack_trace TEXT,
    resolved BOOLEAN DEFAULT FALSE
);

-- RLS 설정
ALTER TABLE public.extension_error_logs ENABLE ROW LEVEL SECURITY;

-- 관리자나 본인만 조회 가능하게 하거나, 일단 모든 사용자가 에러 로그 추가 가능하게 허용
CREATE POLICY "Allow authenticated users to insert error logs"
    ON public.extension_error_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Allow reading error logs for authenticated"
    ON public.extension_error_logs FOR SELECT
    USING (auth.role() = 'authenticated');
