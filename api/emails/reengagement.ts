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

  // Find users who haven't checked in for 3+ days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 3);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const { data: users } = await supabase
    .from("profiles")
    .select("id, display_name, email")
    .not("email", "is", null);

  if (!users?.length) return res.status(200).json({ sent: 0 });

  let sent = 0;
  for (const user of users) {
    if (!user.email) continue;
    const { data: recent } = await supabase
      .from("check_ins")
      .select("log_date")
      .eq("user_id", user.id)
      .gte("log_date", cutoffStr)
      .limit(1)
      .maybeSingle();

    if (recent) continue; // already active

    const name = user.display_name || "there";
    await sendEmail(
      user.email,
      "We miss you — come back to Forge",
      `<h2>Hey ${name}, your streak is waiting</h2>
      <p>It's been a few days. Your journey doesn't end unless you let it.</p>
      <p>One check-in today is all it takes to get back on track.</p>
      <p><a href="https://forgeapp.io/home" style="background:#4f8ef7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">Check in now</a></p>
      <p style="color:#888;font-size:12px;margin-top:32px;">Unsubscribe in account settings.</p>`
    );
    sent++;
  }
  return res.status(200).json({ sent });
}
