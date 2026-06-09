import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser, escapeHtml } from './_auth.js';
import { rateLimit } from './_ratelimit.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const user = await verifyUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!rateLimit(`prize:${user.id}`, 5, 60_000)) return res.status(429).json({ error: 'Rate limit exceeded' });

  const { name, address, city, zip, country } = req.body ?? {};
  const esc = escapeHtml;

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
        subject: `🏆 Nuova richiesta premio 100k — ${esc(name)}`,
        html: `
          <h2 style="color:#E24B4A">🏆 Nuova richiesta badge fisico!</h2>
          <p><strong>${esc(name)}</strong> ha raggiunto 100k Momentum!</p>
          <hr/>
          <p><strong>Indirizzo di spedizione:</strong></p>
          <p>${esc(address)}<br/>${esc(city)} ${esc(zip)}<br/>${esc(country)}</p>
          <p style="color:#888;font-size:12px">Utente: ${esc(user.email ?? user.id)}</p>
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
