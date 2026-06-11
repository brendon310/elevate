// api/user.ts — consolidated GDPR endpoints (saves Vercel Hobby function slots).
//   GET    /api/user  → full data export (was /api/user/export)
//   DELETE /api/user  → delete account + all data (was /api/user/delete)
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _admin: SupabaseClient | null = null;
function adminClient(): SupabaseClient {
  if (!_admin) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase service-role env not configured");
    _admin = createClient(url, key);
  }
  return _admin;
}

async function authenticate(req: VercelRequest): Promise<{ userId: string; userEmail?: string } | null> {
  try {
    const auth = req.headers.authorization ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return null;
    const { data, error } = await adminClient().auth.getUser(token);
    if (error || !data.user) return null;
    return { userId: data.user.id, userEmail: data.user.email ?? undefined };
  } catch {
    return null;
  }
}

async function handleExport(res: VercelResponse, userId: string, userEmail?: string) {
  const supabase = adminClient();
  const [
    profileRes, tracksRes, checkInsRes, journeysRes, journeyDaysRes,
    postsRes, coachRes, nudgesRes, milestonesRes, pairsRes, pushRes,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("user_tracks").select("*").eq("user_id", userId),
    supabase.from("check_ins").select("*").eq("user_id", userId),
    supabase.from("journeys").select("*").eq("user_id", userId),
    supabase.from("journey_days").select("*").eq("user_id", userId),
    supabase.from("community_posts").select("*").eq("user_id", userId),
    supabase.from("coach_messages").select("*").eq("user_id", userId),
    supabase.from("coach_nudges").select("*").eq("user_id", userId),
    supabase.from("milestones_reached").select("*").eq("user_id", userId),
    supabase.from("accountability_pairs").select("*").or(`requester_id.eq.${userId},partner_id.eq.${userId}`),
    supabase.from("push_subscriptions").select("*").eq("user_id", userId),
  ]);

  // prize_claims is keyed by email (no user_id column)
  const prizeClaims = userEmail
    ? (await supabase.from("prize_claims").select("*").eq("email", userEmail)).data ?? []
    : [];

  const exportData = {
    exported_at: new Date().toISOString(),
    user_id: userId,
    profile: profileRes.data ?? null,
    user_tracks: tracksRes.data ?? [],
    check_ins: checkInsRes.data ?? [],
    journeys: journeysRes.data ?? [],
    journey_days: journeyDaysRes.data ?? [],
    community_posts: postsRes.data ?? [],
    coach_messages: coachRes.data ?? [],
    coach_nudges: nudgesRes.data ?? [],
    milestones_reached: milestonesRes.data ?? [],
    accountability_pairs: pairsRes.data ?? [],
    push_subscriptions: pushRes.data ?? [],
    prize_claims: prizeClaims,
  };

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", 'attachment; filename="forge-data-export.json"');
  return res.status(200).json(exportData);
}

async function handleDelete(res: VercelResponse, userId: string, userEmail?: string) {
  const supabase = adminClient();
  // Delete all user-owned rows (child tables first), best-effort.
  // NOTE: journey_templates is a SHARED cache keyed by slug (no user_id) and is
  // intentionally NOT deleted here.
  const userIdTables = [
    "coach_messages",
    "coach_nudges",
    "community_posts",
    "milestones_reached",
    "check_ins",
    "journey_days",
    "journeys",
    "push_subscriptions",
    "user_tracks",
  ];

  for (const table of userIdTables) {
    const { error } = await supabase.from(table).delete().eq("user_id", userId);
    if (error) console.error(`[delete] Failed to delete from ${table}:`, error.message);
  }

  // accountability_pairs has no user_id column (requester_id / partner_id)
  {
    const { error } = await supabase
      .from("accountability_pairs")
      .delete()
      .or(`requester_id.eq.${userId},partner_id.eq.${userId}`);
    if (error) console.error("[delete] Failed to delete from accountability_pairs:", error.message);
  }

  // prize_claims is keyed by the user's email (no user_id column)
  if (userEmail) {
    const { error } = await supabase.from("prize_claims").delete().eq("email", userEmail);
    if (error) console.error("[delete] Failed to delete from prize_claims:", error.message);
  }

  // profiles last (parent row)
  {
    const { error } = await supabase.from("profiles").delete().eq("id", userId);
    if (error) console.error("[delete] Failed to delete from profiles:", error.message);
  }

  // Delete auth user (admin)
  const { error: authError } = await supabase.auth.admin.deleteUser(userId);
  if (authError) {
    console.error("[delete] Failed to delete auth user:", authError.message);
    return res.status(500).json({ error: "Failed to delete account" });
  }

  return res.status(200).json({ ok: true, message: "Account and all data deleted" });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authed = await authenticate(req);
  if (!authed) return res.status(401).json({ error: "Unauthorized" });

  try {
    if (req.method === "GET") return await handleExport(res, authed.userId, authed.userEmail);
    return await handleDelete(res, authed.userId, authed.userEmail);
  } catch (e) {
    console.error("[user] error:", e);
    return res.status(500).json({ error: "Internal error" });
  }
}
