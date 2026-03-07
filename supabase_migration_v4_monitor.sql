-- ================================================
-- Motiverse AI - V4 마이그레이션 (모니터링 & 폴더 로직 DB 연동)
-- Supabase Dashboard > SQL Editor 에서 실행하세요
-- ================================================

-- 1. 모니터링 폴더(그룹) 테이블 생성
CREATE TABLE IF NOT EXISTS monitor_folders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name)
);

ALTER TABLE monitor_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_folders_select" ON monitor_folders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_own_folders_insert" ON monitor_folders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_own_folders_update" ON monitor_folders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_own_folders_delete" ON monitor_folders FOR DELETE USING (auth.uid() = user_id);

-- 2. 기존 monitored_brands 테이블에 스키마 추가 (UI 반영을 위한 필드들)
ALTER TABLE monitored_brands ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES monitor_folders(id) ON DELETE SET NULL;
ALTER TABLE monitored_brands ADD COLUMN IF NOT EXISTS memo TEXT DEFAULT '';
ALTER TABLE monitored_brands ADD COLUMN IF NOT EXISTS ads_data JSONB DEFAULT '[]';
ALTER TABLE monitored_brands ADD COLUMN IF NOT EXISTS is_keyword BOOLEAN DEFAULT false;
