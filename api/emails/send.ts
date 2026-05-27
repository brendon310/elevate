import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM ?? "Forge <noreply@forgeapp.io>";

export async function sendEmail(to: string, subject: string, html: string) {
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    console.error("[sendEmail] failed:", err);
  }
}

export default async function handler(_req: any, res: any) {
  return res.status(404).json({ error: "Not a public endpoint" });
}
