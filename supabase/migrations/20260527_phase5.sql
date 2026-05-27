-- Phase 5 Migration: Pattern Insights, Proactive Coach, Accountability, Milestones

-- Enrich check_ins with mood/urge/trigger data
ALTER TABLE check_ins
  ADD COLUMN IF NOT EXISTS mood           smallint CHECK (mood BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS had_urge       boolean,
  ADD COLUMN IF NOT EXISTS urge_intensity smallint CHECK (urge_intensity BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS trigger_label  text,
  ADD COLUMN IF NOT EXISTS hour_of_day    smallint CHECK (hour_of_day BETWEEN 0 AND 23);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_ctx jsonb DEFAULT '{}';

CREATE TABLE IF NOT EXISTS coach_nudges (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nudge_type   text NOT NULL,
  message      text NOT NULL,
  cta_label    text,
  cta_route    text,
  created_at   timestamptz DEFAULT now() NOT NULL,
  dismissed_at timestamptz
);
ALTER TABLE coach_nudges ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='coach_nudges' AND policyname='Users manage own nudges') THEN
    CREATE POLICY "Users manage own nudges" ON coach_nudges FOR ALL USING (user_id = auth.uid());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS accountability_pairs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  partner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  partner_email   text NOT NULL,
  status          text DEFAULT 'pending',
  share_streak    boolean DEFAULT true,
  share_progress  boolean DEFAULT true,
  invite_token    text UNIQUE DEFAULT encode(gen_random_bytes(18), 'base64'),
  created_at      timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE accountability_pairs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='accountability_pairs' AND policyname='Users manage own pairs') THEN
    CREATE POLICY "Users manage own pairs" ON accountability_pairs FOR ALL USING (user_id = auth.uid() OR partner_user_id = auth.uid());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS milestones_reached (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  track_slug  text NOT NULL,
  milestone_n integer NOT NULL,
  reached_at  timestamptz DEFAULT now() NOT NULL,
  shared_at   timestamptz,
  UNIQUE(user_id, track_slug, milestone_n)
);
ALTER TABLE milestones_reached ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='milestones_reached' AND policyname='Users manage own milestones') THEN
    CREATE POLICY "Users manage own milestones" ON milestones_reached FOR ALL USING (user_id = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_checkins_trigger   ON check_ins(user_id, trigger_label) WHERE trigger_label IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_checkins_mood      ON check_ins(user_id, mood) WHERE mood IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nudges_user_unread ON coach_nudges(user_id, created_at DESC) WHERE dismissed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pairs_user         ON accountability_pairs(user_id);
CREATE INDEX IF NOT EXISTS idx_milestones_user    ON milestones_reached(user_id, track_slug);-- test
