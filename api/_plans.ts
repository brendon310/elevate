// api/_plans.ts — server-side plan entitlements (underscore prefix: NOT an endpoint).
// Mirrors src/plans.ts limits. Client gating is cosmetic; THIS is the enforcement.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type ServerPlan = "free" | "standard" | "premium";

export const PLAN_LIMITS: Record<ServerPlan, { coachMessagesMonth: number; maxTracks: number }> = {
  free: { coachMessagesMonth: 5, maxTracks: 1 },
  standard: { coachMessagesMonth: 50, maxTracks: 2 },
  premium: { coachMessagesMonth: 0, maxTracks: 3 }, // 0 = unlimited coach messages
};

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

/**
 * Resolve the user's effective plan from profiles.
 * A paid plan with a non-active subscription counts as free.
 * Never throws; defaults to 'free'.
 */
export async function getUserPlan(userId: string): Promise<ServerPlan> {
  try {
    const { data } = await adminClient()
      .from("profiles")
      .select("plan, subscription_status")
      .eq("id", userId)
      .single();
    const raw = (data?.plan ?? "free") as string;
    const status = data?.subscription_status as string | null | undefined;
    if (raw !== "free" && status && status !== "active") return "free";
    return raw === "standard" || raw === "premium" ? raw : "free";
  } catch {
    return "free";
  }
}

/** Count the user's coach messages (role=user) in the current calendar month. */
export async function countCoachMessagesThisMonth(userId: string): Promise<number> {
  try {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const { count } = await adminClient()
      .from("coach_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("role", "user")
      .gte("created_at", monthStart.toISOString());
    return count ?? 0;
  } catch {
    return 0; // fail-open: never block on a counting error
  }
}

/**
 * Count the user's journeys (active tracks with a generated journey).
 * excludeSlug: don't count the track being (re)generated — regenerating or
 * restarting an EXISTING journey must never hit the plan limit.
 */
export async function countJourneys(userId: string, excludeSlug?: string): Promise<number> {
  try {
    let q = adminClient()
      .from("journeys")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if (excludeSlug) q = q.neq("track_slug", excludeSlug);
    const { count } = await q;
    return count ?? 0;
  } catch {
    return 0; // fail-open
  }
}
