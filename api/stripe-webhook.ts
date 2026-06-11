// api/stripe-webhook.ts — receives Stripe events and syncs plan + status to profiles.
// bodyParser MUST be disabled: signature verification needs the exact raw body.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const config = { api: { bodyParser: false } };

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

/** Map a Stripe price ID back to a Forge plan name. */
function planForPrice(priceId: string | undefined): string | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_STANDARD || priceId === process.env.STRIPE_PRICE_STANDARD_YEAR) return "standard";
  if (priceId === process.env.STRIPE_PRICE_PREMIUM || priceId === process.env.STRIPE_PRICE_PREMIUM_YEAR) return "premium";
  return null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
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

  const obj = event.data?.object;

  // Checkout completed → activate plan immediately (subscription events may lag).
  if (event.type === "checkout.session.completed") {
    const userId = obj?.metadata?.supabase_user_id;
    const plan = obj?.metadata?.plan;
    if (userId) {
      const update: Record<string, unknown> = {
        subscription_status: "active",
        ...(plan === "standard" || plan === "premium" ? { plan } : {}),
        ...(obj.customer ? { stripe_customer_id: obj.customer } : {}),
        ...(obj.subscription ? { stripe_subscription_id: obj.subscription } : {}),
      };
      await supabase.from("profiles").update(update).eq("id", userId);
    }
    return res.status(200).json({ ok: true });
  }

  // Subscription lifecycle → keep plan + status in sync.
  const newStatus = mapStatus(event.type, obj?.status ?? "");
  if (!newStatus) return res.status(200).json({ received: true });

  const priceId: string | undefined = obj?.items?.data?.[0]?.price?.id;
  const planFromPrice = planForPrice(priceId);
  const update: Record<string, unknown> = { subscription_status: newStatus };
  if (newStatus === "cancelled") {
    update.plan = "free"; // downgrade on cancellation
  } else if (planFromPrice) {
    update.plan = planFromPrice; // upgrade/downgrade between paid tiers
  }
  if (obj?.id && event.type.startsWith("customer.subscription")) {
    update.stripe_subscription_id = obj.id;
  }

  const userId = obj?.metadata?.supabase_user_id;
  if (userId) {
    await supabase.from("profiles").update(update).eq("id", userId);
    return res.status(200).json({ ok: true });
  }
  if (obj?.customer) {
    await supabase.from("profiles").update(update).eq("stripe_customer_id", obj.customer);
  }
  return res.status(200).json({ ok: true });
}
