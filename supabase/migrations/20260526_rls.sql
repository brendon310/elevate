-- Phase 1: Enable RLS on all user-owned tables

-- profiles (id IS the user_id)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles: owner" ON profiles;
CREATE POLICY "profiles: owner" ON profiles FOR ALL TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- user_tracks
ALTER TABLE user_tracks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_tracks: owner" ON user_tracks;
CREATE POLICY "user_tracks: owner" ON user_tracks FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- check_ins
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "check_ins: owner" ON check_ins;
CREATE POLICY "check_ins: owner" ON check_ins FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- journeys
ALTER TABLE journeys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "journeys: owner" ON journeys;
CREATE POLICY "journeys: owner" ON journeys FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- journey_days
ALTER TABLE journey_days ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "journey_days: owner" ON journey_days;
CREATE POLICY "journey_days: owner" ON journey_days FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- community_posts: all authenticated can read/update flame_count; only owner can insert/delete
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "community_posts: read" ON community_posts;
DROP POLICY IF EXISTS "community_posts: insert" ON community_posts;
DROP POLICY IF EXISTS "community_posts: update" ON community_posts;
DROP POLICY IF EXISTS "community_posts: delete" ON community_posts;
CREATE POLICY "community_posts: read" ON community_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "community_posts: insert" ON community_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "community_posts: update" ON community_posts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "community_posts: delete" ON community_posts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- coach_messages
ALTER TABLE coach_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_messages: owner" ON coach_messages;
CREATE POLICY "coach_messages: owner" ON coach_messages FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- push_subscriptions
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "push_subscriptions: owner" ON push_subscriptions;
CREATE POLICY "push_subscriptions: owner" ON push_subscriptions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- journey_templates: shared cache — all authenticated can read/write
ALTER TABLE journey_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "journey_templates: read" ON journey_templates;
DROP POLICY IF EXISTS "journey_templates: insert" ON journey_templates;
DROP POLICY IF EXISTS "journey_templates: update" ON journey_templates;
CREATE POLICY "journey_templates: read" ON journey_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "journey_templates: insert" ON journey_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "journey_templates: update" ON journey_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- tracks_catalog: public read (anon + authenticated), no user writes
ALTER TABLE tracks_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tracks_catalog: public read" ON tracks_catalog;
CREATE POLICY "tracks_catalog: public read" ON tracks_catalog FOR SELECT TO anon, authenticated USING (true);
