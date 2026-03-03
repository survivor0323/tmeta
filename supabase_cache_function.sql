-- 캐시 가져오기를 위한 보안 우회(SECURITY DEFINER) 함수
CREATE OR REPLACE FUNCTION get_cached_ads_data(p_query TEXT, p_platform TEXT, p_country TEXT, p_time_threshold TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS 
DECLARE
    result JSONB;
BEGIN
    SELECT ads_data
    INTO result
    FROM search_history
    WHERE platform = p_platform
      AND query ILIKE p_query
      AND country = COALESCE(p_country, 'KR')
      AND created_at >= p_time_threshold
    ORDER BY created_at DESC
    LIMIT 1;

    RETURN result;
END;
;
