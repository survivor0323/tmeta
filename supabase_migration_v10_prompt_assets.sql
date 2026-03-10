-- ================================================
-- Motiverse AI - Prompt Hub Migration (Multimodal Assets)
-- Supabase Dashboard > SQL Editor 에 복사/붙여넣기 후 전체 실행해주세요
-- ================================================

-- 1. 다양한 결과물 형태(이미지, 비디오, 캔버스 등)를 배열로 담기 위한 JSONB 컬럼 추가
ALTER TABLE public.hub_prompts 
ADD COLUMN IF NOT EXISTS result_assets JSONB DEFAULT '[]'::jsonb;

-- 2. 이미지/비디오 파일 저장을 위한 Supabase Storage Bucket 생성 ('prompt-assets')
INSERT INTO storage.buckets (id, name, public) 
VALUES ('prompt-assets', 'prompt-assets', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage 버킷 보안 정책 (RLS) 설정
-- 누구나 조회 가능
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'prompt-assets' );

-- 인증된 사용자만 업로드(저장) 가능
DROP POLICY IF EXISTS "Authenticated Users Can Upload" ON storage.objects;
CREATE POLICY "Authenticated Users Can Upload" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'prompt-assets' AND auth.role() = 'authenticated' );

-- 본인이 올린 파일만 삭제/수정 가능
DROP POLICY IF EXISTS "Users Can Update Their Own Assets" ON storage.objects;
CREATE POLICY "Users Can Update Their Own Assets"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'prompt-assets' AND auth.uid() = owner );

DROP POLICY IF EXISTS "Users Can Delete Their Own Assets" ON storage.objects;
CREATE POLICY "Users Can Delete Their Own Assets"
ON storage.objects FOR DELETE
USING ( bucket_id = 'prompt-assets' AND auth.uid() = owner );
