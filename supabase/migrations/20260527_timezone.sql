-- Add timezone and language columns to profiles table
-- Run this in Supabase SQL editor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS language  TEXT DEFAULT 'en';

-- Update existing rows to sensible defaults
UPDATE profiles
SET
  timezone = COALESCE(timezone, 'UTC'),
  language  = COALESCE(language,  'en')
WHERE timezone IS NULL OR language IS NULL;

COMMENT ON COLUMN profiles.timezone IS 'IANA timezone string, e.g. Europe/Rome';
COMMENT ON COLUMN profiles.language  IS 'ISO 639-1 language code, e.g. en or it';
