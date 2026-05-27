import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "./send";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers["x-cron-secret"] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().slice(0, 10);

  const { data: users } = await supabase
    .from("profiles")
    .select("id, display_name, email")
    .not("email", "is", null);

  if (!users?.length) return res.status(200).json({ sent: 0 });

  let sent = 0;
  for (const user of users) {
    if (!user.email) continue;

    const { data: checkins } = await supabase
      .from("check_ins")
      .select("log_date, mood, urge_intensity")
      .eq("user_id", user.id)
      .gte("log_date", weekAgoStr)
      .order("log_date", { ascending: true });

    if (!checkins?.length) continue;

    const days = checkins.length;
    const avgMood = checkins.reduce((s, c) => s + (c.mood ?? 3), 0) / days;
    const avgUrge = checkins.reduce((s, c) => s + (c.urge_intensity ?? 5), 0) / days;
    const name = user.display_name || "there";

    await sendEmail(
      user.email,
      "Your weekly Forge progress",
      `<h2>Your week in review, ${name}</h2>
      <p>Here's how your past 7 days looked:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px;border-bottom:1px solid #333;">Check-ins completed</td><td style="padding:8px;border-bottom:1px solid #333;font-weight:700;">${days} / 7 days</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #333;">Average mood</td><td style="padding:8px;border-bottom:1px solid #333;font-weight:700;">${avgMood.toFixed(1)} / 5</td></tr>
        <tr><td style="padding:8px;">Average urge intensity</td><td style="padding:8px;font-weight:700;">${avgUrge.toFixed(1)} / 10</td></tr>
      </table>
      ${days >= 5 ? '<p>Strong week — you showed up consistently.</p>' : '<p>Every check-in counts. Come back stronger this week.</p>'}
      <p><a href="https://forgeapp.io/stats" style="background:#4f8ef7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">View full stats</a></p>
      <p style="color:#888;font-size:12px;margin-top:32px;">Unsubscribe in account settings.</p>`
    );
    sent++;
  }
  return res.status(200).json({ sent });
}
