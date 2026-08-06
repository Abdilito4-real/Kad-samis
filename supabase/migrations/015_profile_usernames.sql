-- 015_profile_usernames.sql
-- Adds a username to profiles, used in place of email specifically for
-- super_admin and operational_manager accounts throughout the UI (their
-- email stays the actual Supabase Auth login credential — this is purely a
-- display-layer addition, not a change to how anyone signs in).

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT;

-- Unique when set, but allows any number of NULLs (existing accounts that
-- haven't had a username assigned yet).
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_unique
  ON profiles(username)
  WHERE username IS NOT NULL;
