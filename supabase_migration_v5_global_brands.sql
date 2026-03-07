-- ==========================================
-- Migration v5: 분야별 추천 경쟁사(Discover) 기능
-- ==========================================

-- 1. 글로벌 브랜드 카테고리 테이블 생성
-- 백엔드(AI)가 모니터링 추가 시점에 자동으로 이 테이블에 브랜드명과 카테고리를 저장합니다.
CREATE TABLE IF NOT EXISTS global_brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_name TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS 정책 설정 (읽기 전용 가능, 쓰기는 서비스 롤만)
ALTER TABLE global_brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users on global_brands" ON global_brands
    FOR SELECT USING (true);

-- 2. 추천 경쟁사를 통계내기 위한 RPC 함수
-- monitored_brands에서 많이 추가된 브랜드를 뽑은 후, global_brands 테이블에서 카테고리와 매칭하여 돌려줍니다.
CREATE OR REPLACE FUNCTION get_recommended_competitors()
RETURNS TABLE (
    brand_name TEXT,
    category TEXT,
    platform TEXT,
    monitor_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mb.brand_name,
        COALESCE(gb.category, '기타') AS category,
        MAX(mb.platform) AS platform,  -- 대표 플랫폼 1개
        COUNT(*) AS monitor_count
    FROM monitored_brands mb
    LEFT JOIN global_brands gb ON mb.brand_name = gb.brand_name
    GROUP BY mb.brand_name, gb.category
    ORDER BY monitor_count DESC, mb.brand_name ASC
    LIMIT 200;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
