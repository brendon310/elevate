import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { verifyUser } from "./_auth.js";
import { rateLimit } from "./_ratelimit.js";

const supabase = createClient(
  process.env.SUPABASE_URL || "https://placeholder.invalid",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authed = await verifyUser(req);
  if (!authed) return res.status(401).json({ error: "Unauthorized" });
  if (!rateLimit(`push:${authed.id}`, 20, 60_000)) return res.status(429).json({ error: "Rate limit exceeded" });
  const userId = authed.id;

  if (req.method === "DELETE" || (req.method === "POST" && req.body?.action === "unsubscribe")) {
    // Unsubscribe (userId derived from verified token)
    await supabase.from("push_subscriptions").delete().eq("user_id", userId);
    return res.status(200).json({ ok: true });
  }

  if (req.method === "POST") {
    // Subscribe
    const { subscription, reminderHour = 21 } = req.body ?? {};
    if (!subscription) return res.status(400).json({ error: "Missing fields" });
    const { error } = await supabase.from("push_subscriptions").upsert(
      { user_id: userId, subscription: JSON.stringify(subscription), reminder_hour: reminderHour },
      { onConflict: "user_id" }
    );
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
