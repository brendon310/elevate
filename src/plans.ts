// src/plans.ts
// Centralized plan entitlement system for Forge.
// All plan checks must go through this file — never scatter logic in components.
// Ready for Stripe: swap startCheckout() implementation when Stripe is connected.

// ─── Types ────────────────────────────────────────────────────────────────────

export type Plan = 'free' | 'standard' | 'premium';

export type Feature =
  | 'multiple_tracks'      // More than 1 active track at once
  | 'full_journey'         // Access all journey days (Free: first 7 only)
  | 'coach_unlimited'      // Unlimited AI coach messages
  | 'community_post'       // Post to community feed (Free: read-only)
  | 'streak_shield'        // Streak shield protection
  | 'all_themes'           // All island themes (Free: forest only)
  | 'enriched_checkin'     // Mood + urge intensity + trigger in check-ins
  | 'weekly_letter'        // AI-generated weekly review letter
  | 'sos_button'           // SOS crisis button
  | 'savings_calculator';  // Savings calculator widget

export type LimitKey =
  | 'max_tracks'            // Max active tracks (0 = unlimited)
  | 'coach_messages_month'  // Coach messages per calendar month (0 = unlimited)
  | 'journey_days_visible'  // How many journey days are visible (0 = unlimited)
  | 'streak_shields_max';   // Max streak shields accumulated (0 = unlimited)

// ─── Plan Configuration ───────────────────────────────────────────────────────

export interface PlanConfig {
  name: Plan;
  label: string;
  price: string;
  priceId: string;
  color: string;
  badge: string;
  features: Set<Feature>;
  limits: Record<LimitKey, number>;
}

export const PLANS: Record<Plan, PlanConfig> = {
  free: {
    name: 'free',
    label: 'Free',
    price: '\u20ac0',
    priceId: 'price_free',
    color: '#6b7280',
    badge: 'Free',
    features: new Set<Feature>([]),
    limits: {
      max_tracks: 1,
      coach_messages_month: 5,
      journey_days_visible: 7,
      streak_shields_max: 0,
    },
  },

  standard: {
    name: 'standard',
    label: 'Standard',
    price: '\u20ac7.99/mo',
    priceId: 'price_standard_monthly',
    color: '#3b82f6',
    badge: 'Standard',
    features: new Set<Feature>([
      'multiple_tracks',
      'full_journey',
      'community_post',
      'streak_shield',
      'all_themes',
      'sos_button',
      'savings_calculator',
    ]),
    limits: {
      max_tracks: 5,
      coach_messages_month: 50,
      journey_days_visible: 0,
      streak_shields_max: 2,
    },
  },

  premium: {
    name: 'premium',
    label: 'Premium',
    price: '\u20ac14.99/mo',
    priceId: 'price_premium_monthly',
    color: '#8b5cf6',
    badge: 'Premium',
    features: new Set<Feature>([
      'multiple_tracks',
      'full_journey',
      'coach_unlimited',
      'community_post',
      'streak_shield',
      'all_themes',
      'enriched_checkin',
      'weekly_letter',
      'sos_button',
      'savings_calculator',
    ]),
    limits: {
      max_tracks: 0,
      coach_messages_month: 0,
      journey_days_visible: 0,
      streak_shields_max: 5,
    },
  },
};

// ─── Trial ────────────────────────────────────────────────────────────────────

export const TRIAL_DAYS = 14;

export function trialActive(accountCreatedAt: string): boolean {
  const created = new Date(accountCreatedAt).getTime();
  const elapsed = (Date.now() - created) / (1000 * 60 * 60 * 24);
  return elapsed < TRIAL_DAYS;
}

export function trialDaysRemaining(accountCreatedAt: string): number {
  const created = new Date(accountCreatedAt).getTime();
  const elapsed = (Date.now() - created) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.ceil(TRIAL_DAYS - elapsed));
}

export function trialExpired(accountCreatedAt: string): boolean {
  return !trialActive(accountCreatedAt);
}

// ─── Entitlement helpers ──────────────────────────────────────────────────────

export function hasFeature(
  plan: Plan,
  feature: Feature,
  accountCreatedAt?: string,
): boolean {
  const effective = accountCreatedAt && trialActive(accountCreatedAt) ? 'standard' : plan;
  return PLANS[effective]?.features.has(feature) ?? false;
}

export function getLimit(
  plan: Plan,
  limitKey: LimitKey,
  accountCreatedAt?: string,
): number {
  const effective = accountCreatedAt && trialActive(accountCreatedAt) ? 'standard' : plan;
  return PLANS[effective]?.limits[limitKey] ?? 1;
}

export const canAccess = hasFeature;

export function shouldShowPaywall(plan: Plan, accountCreatedAt: string): boolean {
  return plan === 'free' && trialExpired(accountCreatedAt);
}

// ─── Checkout (placeholder — wire Stripe here later) ──────────────────────────

export interface CheckoutResult {
  success: boolean;
  error?: string;
}

/**
 * Placeholder checkout handler.
 * TO CONNECT STRIPE: Replace the body with a real Stripe checkout redirect.
 * See comments below for the exact implementation pattern.
 *
 * STRIPE INTEGRATION STEPS:
 *   1. Create api/create-checkout.ts (Vercel function)
 *   2. const session = await stripe.checkout.sessions.create({ price_data... })
 *   3. Return { url: session.url }
 *   4. Replace this function body with:
 *      const res = await fetch('/api/create-checkout', {
 *        method: 'POST',
 *        headers: { Authorization: `Bearer ${token}` },
 *        body: JSON.stringify({ priceId: PLANS[plan].priceId }),
 *      });
 *      const { url } = await res.json();
 *      window.location.href = url;
 */
export async function startCheckout(plan: Plan): Promise<CheckoutResult> {
  trackEvent('checkout_started', { plan, priceId: PLANS[plan].priceId });
  console.warn('[plans] startCheckout placeholder — Stripe not connected yet. Plan:', plan);
  window.alert(
    'Stripe checkout coming soon!\n\nPlan: ' + PLANS[plan].label + '\nPrice: ' + PLANS[plan].price
  );
  return { success: false, error: 'Stripe not connected yet' };
}

// ─── Analytics (PostHog-safe) ─────────────────────────────────────────────────

export type AnalyticsEvent =
  | 'paywall_shown'
  | 'paywall_dismissed'
  | 'upgrade_cta_clicked'
  | 'checkout_started'
  | 'plan_changed'
  | 'trial_expired'
  | 'feature_blocked';

export type EventProperties = Record<string, string | number | boolean | undefined>;

export function trackEvent(event: AnalyticsEvent, properties?: EventProperties): void {
  try {
    type W = { posthog?: { capture: (e: string, p?: object) => void } };
    const ph = (window as W).posthog;
    if (ph?.capture) ph.capture(event, { ...properties, source: 'forge_plans' });
    if (import.meta.env.DEV) console.log('[analytics]', event, properties);
  } catch { /* never crash the app */ }
}
