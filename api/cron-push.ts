import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

webpush.setVapidDetails(
  "mailto:brendonhoxha14@gmail.com",
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
  // Allow both cron invocations and manual POST
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).end();

  const today = new Date().toISOString().slice(0, 10);
  const currentHour = new Date().getUTCHours();

  // Get all subscriptions
  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("user_id, subscription, reminder_hour");

  if (error || !subs) return res.status(500).json({ error: "DB error" });

  let sent = 0;
  let skipped = 0;

  for (const sub of subs) {
    // Only send if it's the user's reminder hour (±1 hour window)
    if (Math.abs(sub.reminder_hour - currentHour) > 1) { skipped++; continue; }

    // Check if user already checked in today
    const { data: logs } = await supabase
      .from("check_ins")
      .select("id")
      .eq("user_id", sub.user_id)
      .gte("logged_at", today)
      .limit(1);

    if (logs && logs.length > 0) { skipped++; continue; }

    // Send push
    try {
      const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
      await webpush.sendNotification(
        JSON.parse(sub.subscription),
        JSON.stringify({ title: "Forge", body: msg })
      );
      sent++;
    } catch (e: unknown) {
      // Subscription expired — remove it
      if ((e as { statusCode?: number }).statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("user_id", sub.user_id);
      }
    }
  }

  return res.status(200).json({ sent, skipped });
}
