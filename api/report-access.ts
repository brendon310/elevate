import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { message, trackName, date } = req.body as {
    message: string;
    trackName: string;
    date: string;
  };

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // No key configured — still return OK so the UI doesn't error
    console.warn("RESEND_API_KEY not set — report-access email not sent");
    return res.status(200).json({ ok: true, warn: "email not configured" });
  }

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        from: "Forge <onboarding@resend.dev>",
        to: "brendonhoxha14@gmail.com",
        subject: `Forge — Missed access report${trackName ? `: ${trackName}` : ""}`,
        text: [
          `Track: ${trackName || "—"}`,
          `Date: ${date || new Date().toISOString().slice(0, 10)}`,
          "",
          "Message:",
          message,
        ].join("\n"),
      }),
    });

    if (!r.ok) {
      const err = await r.text();
      console.error("Resend error:", err);
      return res.status(502).json({ error: "email_failed" });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "internal" });
  }
}
