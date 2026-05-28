import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "DELETE" || (req.method === "POST" && req.body?.action === "unsubscribe")) {
    // Unsubscribe
    const { userId } = req.body ?? {};
    if (!userId) return res.status(400).json({ error: "Missing userId" });
    await supabase.from("push_subscriptions").delete().eq("user_id", userId);
    return res.status(200).json({ ok: true });
  }

  if (req.method === "POST") {
    // Subscribe
    const { userId, subscription, reminderHour = 21 } = req.body ?? {};
    if (!userId || !subscription) return res.status(400).json({ error: "Missing fields" });
    const { error } = await supabase.from("push_subscriptions").upsert(
      { user_id: userId, subscription: JSON.stringify(subscription), reminder_hour: reminderHour },
      { onConflict: "user_id" }
    );
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
