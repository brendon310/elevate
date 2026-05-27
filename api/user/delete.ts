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
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) throw new Error("Invalid token");
    userId = data.user.id;
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Delete all user data in dependency order
  const tables = [
    "coach_messages",
    "community_posts",
    "check_ins",
    "push_subscriptions",
    "journey_templates",
    "user_tracks",
    "profiles",
  ];

  for (const table of tables) {
    const col = table === "profiles" ? "id" : "user_id";
    const { error } = await supabase.from(table).delete().eq(col, userId);
    if (error) {
      console.error(`[delete] Failed to delete from ${table}:`, error.message);
      // Continue — best effort cleanup
    }
  }

  // Delete auth user (admin)
  const { error: authError } = await supabase.auth.admin.deleteUser(userId);
  if (authError) {
    console.error("[delete] Failed to delete auth user:", authError.message);
    return res.status(500).json({ error: "Failed to delete account" });
  }

  return res.status(200).json({ ok: true, message: "Account and all data deleted" });
}
