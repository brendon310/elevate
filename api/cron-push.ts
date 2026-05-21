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
  "You built momentum yesterday. Keep it alive.",
  "One check-in. That’s all it takes today.",
  "The version of you that showed up yesterday is counting on today’s version.",
  "Small rep. Big identity. Open Forge.",
  "Your future self will thank today’s version for not skipping.",
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).end();

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const currentHour = now.getUTCHours();

  // Only send to users whose reminder_hour matches the current UTC hour
  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("user_id, subscription, reminder_hour")
    .eq("reminder_hour", currentHour);

  if (error || !subs) return res.status(500).json({ error: "DB error" });

  let sent = 0;
  let skipped = 0;
  const toDelete: string[] = [];

  for (const sub of subs) {
    // Skip users who already checked in today
    const { count } = await supabase
      .from("checkins")
      .select("*", { count: "exact", head: true })
      .eq("user_id", sub.user_id)
      .eq("date", today);

    if ((count ?? 0) > 0) { skipped++; continue; }

    const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
    try {
      await webpush.sendNotification(
        JSON.parse(sub.subscription),
        JSON.stringify({ title: "Forge", body: msg, url: "/home" })
      );
      sent++;
    } catch (e: any) {
      if (e.statusCode === 410) toDelete.push(sub.user_id);
    }
  }

  // Clean up expired subscriptions
  for (const uid of toDelete) {
    await supabase.from("push_subscriptions").delete().eq("user_id", uid);
  }

  return res.status(200).json({ sent, skipped, date: today, hour: currentHour });
}
