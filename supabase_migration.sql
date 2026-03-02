-- ================================================
-- Motiverse AI - Supabase DB 마이그레이션
-- Supabase Dashboard > SQL Editor 에서 실행하세요
-- ================================================

-- 1. 검색 히스토리 테이블
CREATE TABLE IF NOT EXISTS search_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  platform TEXT NOT NULL,
  country TEXT,
  ads_data JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_history_select" ON search_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_own_history_insert" ON search_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_own_history_delete" ON search_history
  FOR DELETE USING (auth.uid() = user_id);

-- 2. 북마크 테이블
CREATE TABLE IF NOT EXISTS bookmarks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ad_data JSONB NOT NULL,
  query TEXT,
  platform TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_bookmarks_select" ON bookmarks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_own_bookmarks_insert" ON bookmarks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_own_bookmarks_delete" ON bookmarks
  FOR DELETE USING (auth.uid() = user_id);
