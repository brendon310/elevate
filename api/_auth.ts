import type { VercelRequest } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

// Service-role client used only to validate the caller's JWT.
const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface AuthedUser {
  id: string;
  email?: string;
}

/**
 * Verifies the Supabase access token from the Authorization header.
 * Returns the authenticated user, or null if missing/invalid.
 */
export async function verifyUser(req: VercelRequest): Promise<AuthedUser | null> {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? undefined };
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
