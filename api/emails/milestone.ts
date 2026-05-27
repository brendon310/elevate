import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendEmail } from "./send";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const { email, name, milestone } = req.body ?? {};
  if (!email || !milestone) return res.status(400).json({ error: "email and milestone required" });

  const displayName = name || "there";
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
