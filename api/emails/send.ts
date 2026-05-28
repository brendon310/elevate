import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM ?? "Forge <noreply@forgeapp.io>";

async function sendEmail(to: string, subject: string, html: string) {
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    console.error("[sendEmail] failed:", err);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const { type, email, name, milestone } = req.body ?? {};
  if (!email || !type) return res.status(400).json({ error: "email and type required" });
  const displayName = name || "there";

  if (type === "welcome") {
    await sendEmail(
      email,
      "Welcome to Forge — your journey starts now",
      `<h2>Welcome to Forge, ${displayName}!</h2><p>You just took the first step.</p><p><a href="https://forgeapp.io/home" style="background:#4f8ef7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">Start your journey</a></p><p style="color:#888;font-size:12px;margin-top:32px;">Unsubscribe anytime in settings.</p>`
    );
    return res.status(200).json({ ok: true });
  }

  if (type === "milestone") {
    if (!milestone) return res.status(400).json({ error: "milestone required" });
    await sendEmail(
      email,
      "You just hit a milestone on Forge!",
      `<h2>Nice work, ${displayName}!</h2>
      <p>You just reached a milestone: <strong>${milestone}</strong></p>
      <p>Every day you show up is a day that counts. Keep the streak alive.</p>
      <p><a href="https://forgeapp.io/home" style="background:#4f8ef7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">See your progress</a></p>
      <p style="color:#888;font-size:12px;margin-top:32px;">You can manage email preferences in your account settings.</p>`
    );
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: "Unknown type" });
}
