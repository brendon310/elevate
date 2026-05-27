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
  const { email, name } = req.body ?? {};
  if (!email) return res.status(400).json({ error: "email required" });

  const displayName = name || "there";
  await sendEmail(
    email,
    "Welcome to Forge — your journey starts now",
    `<h2>Welcome to Forge, ${displayName}!</h2>
    <p>You just took the first step. Every great habit starts with a single decision.</p>
    <p>Open the app and pick your first track to begin:</p>
    <p><a href="https://forgeapp.io/home" style="background:#4f8ef7;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">Start your journey</a></p>
    <p style="color:#888;font-size:12px;margin-top:32px;">You can unsubscribe at any time from your account settings.</p>`
  );
  return res.status(200).json({ ok: true });
}
