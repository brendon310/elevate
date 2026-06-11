// api/billing.ts — Stripe checkout + customer portal in ONE function (Hobby slot-friendly).
// Uses Stripe's REST API directly (no SDK dependency).
//   POST /api/billing  { action: "checkout", plan: "standard" | "premium" }  → { url }
//   POST /api/billing  { action: "portal" }                                  → { url }
// Required env: STRIPE_SECRET_KEY, STRIPE_PRICE_STANDARD, STRIPE_PRICE_PREMIUM
// Optional env: APP_URL (defaults to request origin)
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { verifyUser } from "./_auth.js";
import { rateLimit } from "./_ratelimit.js";

let _admin: SupabaseClient | null = null;
function adminClient(): SupabaseClient {
  if (!_admin) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase service-role env not configured");
    _admin = createClient(url, key);
  }
  return _admin;
}

/** Minimal Stripe REST call (form-encoded, as Stripe requires). */
async function stripe(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
  });
  const json = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const err = json?.error as { message?: string } | undefined;
    throw new Error(`Stripe ${path}: ${err?.message ?? res.status}`);
  }
  return json;
}

function priceFor(plan: string, interval: string): string | undefined {
  if (interval === "year") {
    if (plan === "standard") return process.env.STRIPE_PRICE_STANDARD_YEAR;
    if (plan === "premium") return process.env.STRIPE_PRICE_PREMIUM_YEAR;
    return undefined;
  }
  if (plan === "standard") return process.env.STRIPE_PRICE_STANDARD;
  if (plan === "premium") return process.env.STRIPE_PRICE_PREMIUM;
  return undefined;
}

function appUrl(req: VercelRequest): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const origin = req.headers.origin;
  if (typeof origin === "string" && origin.startsWith("https://")) return origin;
  return `https://${req.headers.host ?? "elevate-sooty-xi.vercel.app"}`;
}

/** Get (or lazily create) the Stripe customer for this user. */
async function ensureCustomer(userId: string, email?: string): Promise<string> {
  const supabase = adminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .single();
  if (profile?.stripe_customer_id) return profile.stripe_customer_id as string;

  const customer = await stripe("customers", {
    ...(email ? { email } : {}),
    "metadata[supabase_user_id]": userId,
  });
  const customerId = customer.id as string;
  await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", userId);
  return customerId;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = await verifyUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (!rateLimit(`billing:${user.id}`, 10, 60_000)) return res.status(429).json({ error: "Rate limit exceeded" });

  const { action, plan, interval } = (req.body ?? {}) as { action?: string; plan?: string; interval?: string };
  const base = appUrl(req);

  try {
    if (action === "checkout") {
      const priceId = plan ? priceFor(plan, interval === "year" ? "year" : "month") : undefined;
      if (!priceId) return res.status(400).json({ error: "Unknown plan or price not configured" });

      const customerId = await ensureCustomer(user.id, user.email);
      const session = await stripe("checkout/sessions", {
        mode: "subscription",
        customer: customerId,
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        success_url: `${base}/?checkout=success`,
        cancel_url: `${base}/?checkout=cancelled`,
        allow_promotion_codes: "true",
        "metadata[supabase_user_id]": user.id,
        "metadata[plan]": plan as string,
        "subscription_data[metadata][supabase_user_id]": user.id,
        "subscription_data[metadata][plan]": plan as string,
      });
      return res.json({ url: session.url });
    }

    if (action === "portal") {
      const customerId = await ensureCustomer(user.id, user.email);
      const session = await stripe("billing_portal/sessions", {
        customer: customerId,
        return_url: `${base}/`,
      });
      return res.json({ url: session.url });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    console.error("[billing] error:", e);
    return res.status(500).json({ error: "Billing error" });
  }
}
