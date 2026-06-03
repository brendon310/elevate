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
  let userEmail: string | undefined;
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) throw new Error("Invalid token");
    userId = data.user.id;
    userEmail = data.user.email ?? undefined;
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Gather all user-owned data (supabase-js resolves with {data,error}; a
  // missing table yields [] rather than throwing).
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
