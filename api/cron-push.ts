import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

webpush.setVapidDetails(
  "mailto:noreply@forgeapp.io",
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

function localHour(tz: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      hour12: false,
    }).formatToParts(new Date());
    const h = parts.find((p) => p.type === "hour");
    return h ? parseInt(h.value, 10) : new Date().getUTCHours();
  } catch {
    return new Date().getUTCHours();
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers["x-cron-secret"] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const today = new Date().toISOString().slice(0, 10);

  // Fetch subscriptions joined with profile timezone + reminder_hour
  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select(`
      endpoint, p256dh, auth, user_id,
      profiles!inner(reminder_hour, timezone)
    `);

  if (error || !subs) {
    return res.status(500).json({ error: error?.message ?? "No data" });
  }

  let sent = 0;
  let skipped = 0;

  for (const sub of subs) {
    const profile = Array.isArray(sub.profiles) ? sub.profiles[0] : sub.profiles as any;
    const reminderHour: number = profile?.reminder_hour ?? 9;
    const tz: string = profile?.timezone ?? "UTC";
    const userLocalHour = localHour(tz);

    // Only send if current local hour matches the user's chosen reminder hour
    if (userLocalHour !== reminderHour) {
      skipped++;
      continue;
    }

    // Skip if user already checked in today
    const { data: checkin } = await supabase
      .from("check_ins")
      .select("id")
      .eq("user_id", sub.user_id)
      .eq("log_date", today)
      .maybeSingle();

    if (checkin) {
      skipped++;
      continue;
    }

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title: "Forge", body: "Time for your daily check-in!", url: "/home" })
      );
      sent++;
    } catch (e) {
      console.error("Push failed for", sub.user_id, e);
    }
  }

  return res.status(200).json({ sent, skipped });
}
