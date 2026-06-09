// Zero-dependency health probe. If THIS returns 500 FUNCTION_INVOCATION_FAILED,
// the failure is at the Vercel functions runtime/config level, not in app code.
export default function handler(_req: unknown, res: { status: (n: number) => { json: (b: unknown) => void } }) {
  res.status(200).json({ ok: true, ts: Date.now(), node: process.version });
}
