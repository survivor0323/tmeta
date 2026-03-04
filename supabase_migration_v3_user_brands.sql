-- Create user_brands table for Creative Studio
CREATE TABLE IF NOT EXISTS user_brands (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    url TEXT DEFAULT '',
    color1 TEXT DEFAULT '#0f172a',
    color2 TEXT DEFAULT '#3b82f6',
    logo_url TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own brands" ON user_brands
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own brands" ON user_brands
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own brands" ON user_brands
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own brands" ON user_brands
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on user_brands" ON user_brands
    FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_user_brands_user_id ON user_brands(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_brands_unique ON user_brands(user_id, name);
