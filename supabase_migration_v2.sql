-- ================================================
-- Motiverse AI - V2 마이그레이션
-- P1: 경쟁사 자동 모니터링
-- P2: 광고 아카이브 (종료 광고 보관)
-- P3: 보드/컬렉션 (북마크 개선)
-- Supabase Dashboard > SQL Editor 에서 실행하세요
-- ================================================

-- ─── P1: 모니터링 브랜드 테이블 ─────────────────────────
CREATE TABLE IF NOT EXISTS monitored_brands (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'meta',
  country TEXT DEFAULT 'KR',
  is_active BOOLEAN DEFAULT true,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE monitored_brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_monitors_select" ON monitored_brands
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_own_monitors_insert" ON monitored_brands
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_own_monitors_delete" ON monitored_brands
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "users_own_monitors_update" ON monitored_brands
  FOR UPDATE USING (auth.uid() = user_id);

-- ─── P1: 모니터링 알림/결과 테이블 ─────────────────────
CREATE TABLE IF NOT EXISTS monitor_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  monitor_id UUID REFERENCES monitored_brands(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  new_ads_count INT DEFAULT 0,
  ads_data JSONB DEFAULT '[]',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE monitor_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_alerts_select" ON monitor_alerts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_own_alerts_update" ON monitor_alerts
  FOR UPDATE USING (auth.uid() = user_id);

-- ─── P2: 광고 아카이브 (종료된 광고도 영구 보관) ──────────
CREATE TABLE IF NOT EXISTS ad_archive (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_id TEXT,
  brand TEXT,
  platform TEXT,
  country TEXT DEFAULT 'KR',
  media_url TEXT,
  media_type TEXT,
  image_url TEXT,
  body TEXT,
  direct_link TEXT,
  start_date TEXT,
  analysis_report JSONB,
  is_active BOOLEAN DEFAULT true,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ad_id, platform)
);

-- 아카이브는 RLS 없이 서버사이드 접근 (서비스 키 사용)
-- 프론트에서 읽기만 가능하도록 별도 RPC 제공

-- ─── P3: 보드/컬렉션 테이블 ─────────────────────────────
CREATE TABLE IF NOT EXISTS boards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE boards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_boards_select" ON boards
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_own_boards_insert" ON boards
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_own_boards_delete" ON boards
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "users_own_boards_update" ON boards
  FOR UPDATE USING (auth.uid() = user_id);

-- 북마크 테이블에 board_id 컬럼 추가
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS board_id UUID REFERENCES boards(id) ON DELETE SET NULL;
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
