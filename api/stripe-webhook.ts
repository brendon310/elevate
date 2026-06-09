import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.SUPABASE_URL || "https://placeholder.invalid",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"
);

function verifyStripeSignature(rawBody: string, sigHeader: string, secret: string): boolean {
  const parts = sigHeader.split(",");
  const tPart = parts.find((p) => p.startsWith("t="));
  const sPart = parts.find((p) => p.startsWith("v1="));
  if (!tPart || !sPart) return false;
  const expected = crypto.createHmac("sha256", secret)
    .update(tPart.slice(2) + "." + rawBody, "utf8").digest("hex");
  try { return crypto.timingSafeEqual(Buffer.from(expected,"hex"), Buffer.from(sPart.slice(3),"hex")); }
  catch { return false; }
}

function readRawBody(req: VercelRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => { data += chunk; });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function mapStatus(eventType: string, stripeStatus: string): string | null {
  switch (eventType) {
    case "customer.subscription.deleted": return "cancelled";
    case "customer.subscription.paused": return "paused";
    case "customer.subscription.resumed": return "active";
    case "customer.subscription.created":
    case "customer.subscription.updated":
      if (stripeStatus === "paused") return "paused";
      if (stripeStatus === "active" || stripeStatus === "trialing") return "active";
      if (stripeStatus === "canceled" || stripeStatus === "unpaid") return "cancelled";
      return "active";
    default: return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return res.status(500).json({ error: "Webhook secret not configured" });
  const rawBody = await readRawBody(req);
  const sigHeader = req.headers["stripe-signature"] as string;
  if (!sigHeader) return res.status(400).json({ error: "Missing Stripe-Signature header" });
  if (!verifyStripeSignature(rawBody, sigHeader, webhookSecret))
    return res.status(400).json({ error: "Invalid signature" });
  let event: any;
  try { event = JSON.parse(rawBody); } catch { return res.status(400).json({ error: "Invalid JSON" }); }
  const sub = event.data?.object;
  const newStatus = mapStatus(event.type, sub?.status ?? "");
  if (!newStatus) return res.status(200).json({ received: true });
  const userId = sub.metadata?.supabase_user_id;
  if (userId) {
    await supabase.from("profiles").update({ subscription_status: newStatus }).eq("id", userId);
    return res.status(200).json({ ok: true });
  }
  if (sub.customer) {
    await supabase.from("profiles").update({ subscription_status: newStatus }).eq("stripe_customer_id", sub.customer);
  }
  return res.status(200).json({ ok: true });
}
