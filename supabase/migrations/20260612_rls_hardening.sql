-- 20260612_rls_hardening.sql
-- Fixes found in the RLS audit (2026-06-12). Idempotent — safe to re-run.

-- 1) cp_flame allowed ANY authenticated/anon user to UPDATE any community post
--    (content included). Restrict UPDATE to the flame_count column only.
REVOKE UPDATE ON TABLE public.community_posts FROM anon, authenticated;
GRANT UPDATE (flame_count) ON TABLE public.community_posts TO authenticated;

-- 2) No anonymous writes to prize requests or the shared journey-template cache.
ALTER POLICY ins_prize  ON public.prize_requests    TO authenticated;
ALTER POLICY jt_insert  ON public.journey_templates TO authenticated;
ALTER POLICY jt_update  ON public.journey_templates TO authenticated;

-- 3) prize_claims: enable RLS if the table exists (insert-only for clients;
--    reads happen server-side with the service role, which bypasses RLS).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='prize_claims') THEN
    EXECUTE 'ALTER TABLE public.prize_claims ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prize_claims' AND policyname='pc_insert') THEN
      EXECUTE 'CREATE POLICY pc_insert ON public.prize_claims FOR INSERT TO authenticated WITH CHECK (true)';
    END IF;
  END IF;
END $$;
