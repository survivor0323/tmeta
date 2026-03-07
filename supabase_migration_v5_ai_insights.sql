-- ================================================
-- Motiverse AI - V5 마이그레이션 (AI 인사이트 DB 저장)
-- Supabase Dashboard > SQL Editor 에서 실행하세요
-- ================================================

CREATE TABLE IF NOT EXISTS ai_insights (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    brand_name TEXT NOT NULL,
    platform TEXT NOT NULL,
    report_content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 정책 추가
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_insights_select" ON ai_insights FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_own_insights_insert" ON ai_insights FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_own_insights_delete" ON ai_insights FOR DELETE USING (auth.uid() = user_id);
