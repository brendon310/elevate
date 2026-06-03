import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "DELETE") return res.status(405).json({ error: "Method not allowed" });

  // Verify JWT
  const auth = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  let userId: string;
  let userEmail: string | undefined;
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) throw new Error("Invalid token");
    userId = data.user.id;
    userEmail = data.user.email ?? undefined;
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }

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
