import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

webpush.setVapidDetails(
  "mailto:brendonhoxha14@gmail.com",
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const hour = new Date().getUTCHours();

  const { data: subs, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("user_id, subscription")
    .eq("reminder_hour", hour);

  if (subsError) {
    console.error("Error fetching subscriptions:", subsError);
    return res.status(500).json({ error: subsError.message });
  }

  if (!subs || subs.length === 0) {
    return res.status(200).json({ sent: 0, message: "No subscribers for this hour" });
  }

  const today = new Date().toISOString().split("T")[0];

  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      const { data: checkins } = await supabase
        .from("check_ins")
        .select("id")
        .eq("user_id", sub.user_id)
        .eq("log_date", today)
        .limit(1);

      if (checkins && checkins.length > 0) return { skipped: true };

      const payload = JSON.stringify({
        title: "Forge",
        body: "You haven't checked in today. Your streak is waiting.",
      });

      await webpush.sendNotification(sub.subscription, payload);
      return { sent: true };
    })
  );

  const sent = results.filter(
    (r) => r.status === "fulfilled" && (r.value as { sent?: boolean }).sent
  ).length;
  const skipped = results.filter(
    (r) => r.status === "fulfilled" && (r.value as { skipped?: boolean }).skipped
  ).length;

  return res.status(200).json({ sent, skipped, total: subs.length });
}
