import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "Missing userId" });
  await supabase.from("push_subscriptions").delete().eq("user_id", userId);
  return res.status(200).json({ ok: true });
}
