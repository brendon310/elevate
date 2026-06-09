import type { VercelRequest } from "@vercel/node";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Lazily create the service-role client so a missing env var never crashes the
// whole function at module load (which surfaces as FUNCTION_INVOCATION_FAILED).
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

export interface AuthedUser {
  id: string;
  email?: string;
}

/**
 * Verifies the Supabase access token from the Authorization header.
 * Returns the authenticated user, or null if missing/invalid/misconfigured.
 * Never throws.
 */
export async function verifyUser(req: VercelRequest): Promise<AuthedUser | null> {
  try {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return null;
    const { data, error } = await adminClient().auth.getUser(token);
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? undefined };
  } catch {
    return null;
  }
}

/** Minimal HTML escaping for user-supplied values injected into emails. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
