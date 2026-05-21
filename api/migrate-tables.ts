// One-time migration endpoint — creates community_posts and coach_messages tables.
// Call POST /api/migrate-tables once after deploy, then this file can be removed.
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: "Missing SUPABASE env vars" });
  }

  const sql = `
    create table if not exists public.community_posts (
      id text primary key,
      user_id uuid references auth.users(id) on delete cascade not null,
      track_slug text not null,
      content text not null,
      day_number int not null default 0,
      flame_count int not null default 0,
      created_at timestamptz not null default now()
    );
    alter table public.community_posts enable row level security;
    do $$ begin
      if not exists (select 1 from pg_policies where tablename='community_posts' and policyname='cp_read') then
        create policy cp_read on public.community_posts for select using (true);
      end if;
      if not exists (select 1 from pg_policies where tablename='community_posts' and policyname='cp_insert') then
        create policy cp_insert on public.community_posts for insert with check (auth.uid() = user_id);
      end if;
      if not exists (select 1 from pg_policies where tablename='community_posts' and policyname='cp_flame') then
        create policy cp_flame on public.community_posts for update using (true) with check (true);
      end if;
    end $$;
    create index if not exists community_posts_slug on public.community_posts(track_slug, created_at desc);

    create table if not exists public.coach_messages (
      id text primary key,
      user_id uuid references auth.users(id) on delete cascade not null,
      track_slug text not null,
      role text not null check (role in ('user','assistant')),
      content text not null,
      created_at timestamptz not null default now()
    );
    alter table public.coach_messages enable row level security;
    do $$ begin
      if not exists (select 1 from pg_policies where tablename='coach_messages' and policyname='cm_own') then
        create policy cm_own on public.coach_messages for all using (auth.uid() = user_id);
      end if;
    end $$;
    create index if not exists coach_messages_user_slug on public.coach_messages(user_id, track_slug);
  `;

  const projectRef = supabaseUrl.replace("https://", "").replace(".supabase.co", "");
  const r = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  const body = await r.text();
  if (!r.ok) return res.status(500).json({ error: body });
  return res.status(200).json({ ok: true, result: body });
}
