import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

webpush.setVapidDetails(
  "mailto:support@forge-app.com",
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MESSAGES = [
  "Your streak is waiting. 30 seconds to keep it alive.",
  "One check-in. That's all it takes today.",
  "The version of you that showed up yesterday is counting on today's version.",
  "Small rep. Big identity. Open Forge.",
  "Your future self will thank today's version for not skipping.",
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).end();

  // Protect cron endpoint — require CRON_SECRET bearer token
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.authorization ?? "";
    if (auth !== `Bearer ${secret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  // Send to all opted-in users who have not checked in today
  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("user_id, subscription");

  if (error || !subs) return res.status(500).json({ error: "DB error" });

  let sent = 0;
  let skipped = 0;

  for (const sub of subs) {
    // Use correct column name: log_date (not logged_at)
    const { data: logs } = await supabase
      .from("check_ins")
      .select("id")
      .eq("user_id", sub.user_id)
      .eq("log_date", today)
      .limit(1);

    if (logs && logs.length > 0) { skipped++; continue; }

    try {
      const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
      await webpush.sendNotification(
        JSON.parse(sub.subscription),
        JSON.stringify({ title: "Forge", body: msg })
      );
      sent++;
    } catch (e: unknown) {
      if ((e as { statusCode?: number }).statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("user_id", sub.user_id);
      }
    }
  }

  return res.status(200).json({ sent, skipped, date: today });
}
