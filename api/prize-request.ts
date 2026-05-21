import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { name, address, city, zip, country } = req.body ?? {};

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    // No email key configured — just acknowledge (data already in Supabase)
    return res.status(200).json({ ok: true, emailSent: false });
  }

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Forge <noreply@resend.dev>',
        to: ['brendonhoxha14@gmail.com'],
        subject: `🏆 Nuova richiesta premio 100k — ${name}`,
        html: `
          <h2 style="color:#E24B4A">🏆 Nuova richiesta badge fisico!</h2>
          <p><strong>${name}</strong> ha raggiunto 100k Momentum!</p>
          <hr/>
          <p><strong>Indirizzo di spedizione:</strong></p>
          <p>${address}<br/>${city} ${zip}<br/>${country}</p>
          <hr/>
          <p style="color:#888;font-size:12px">Forge App — richiesta automatica</p>
        `,
      }),
    });
    return res.status(200).json({ ok: true, emailSent: true });
  } catch (err) {
    console.error('Email error:', err);
    return res.status(200).json({ ok: true, emailSent: false });
  }
}
