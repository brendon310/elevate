import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

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

  // Gather all user data
  const [profileRes, checkInsRes, journeysRes, postsRes, coachRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("check_ins").select("*").eq("user_id", userId),
    supabase.from("user_tracks").select("*").eq("user_id", userId),
    supabase.from("community_posts").select("*").eq("user_id", userId),
    supabase.from("coach_messages").select("*").eq("user_id", userId),
  ]);

  const exportData = {
    exported_at: new Date().toISOString(),
    user_id: userId,
    profile: profileRes.data ?? null,
    check_ins: checkInsRes.data ?? [],
    journeys: journeysRes.data ?? [],
    community_posts: postsRes.data ?? [],
    coach_messages: coachRes.data ?? [],
  };

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", 'attachment; filename="forge-data-export.json"');
  return res.status(200).json(exportData);
}
