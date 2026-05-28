// src/components/PaywallModal.tsx
// Paywall modal shown when the 14-day trial ends and plan === 'free'.
// Appears every session until user upgrades.
// Placeholder checkout: wire startCheckout() in plans.ts to Stripe later.

import { useTranslation } from 'react-i18next';
import React, { useEffect } from 'react';
import {
  Plan, PlanConfig, PLANS, Feature,
  startCheckout, trackEvent,
} from '../plans';

interface FeatureRow { label: string; free: string; standard: string; premium: string; }

const FEATURE_ROWS: FeatureRow[] = [
  { label: 'Active tracks',       free: '1',           standard: 'Up to 5',     premium: 'Unlimited' },
  { label: 'Journey length',      free: '7 days',      standard: 'Full access', premium: 'Full access' },
  { label: 'AI Coach messages',   free: '5 / month',   standard: '50 / month',  premium: 'Unlimited' },
  { label: 'Community',           free: 'Read only',   standard: 'Full',        premium: 'Full' },
  { label: 'Streak shields',      free: 'None',        standard: '2 max',       premium: '5 max' },
  { label: 'Island themes',       free: 'Forest only', standard: 'All 3',       premium: 'All 3' },
  { label: 'Enriched check-ins',  free: '\u2014',     standard: '\u2014',     premium: 'Yes' },
  { label: 'Weekly letter',       free: '\u2014',     standard: '\u2014',     premium: 'Yes' },
  { label: 'SOS crisis button',   free: '\u2014',     standard: 'Yes',         premium: 'Yes' },
  { label: 'Savings calculator',  free: '\u2014',     standard: 'Yes',         premium: 'Yes' },
];

export interface PaywallModalProps {
  currentPlan: Plan;
  accountCreatedAt: string;
  onDismiss?: () => void;
  onPlanChange?: (plan: Plan) => void;
}

export function PaywallModal({ currentPlan, accountCreatedAt, onDismiss, onPlanChange }: PaywallModalProps) {
  const { t } = useTranslation();
  useEffect(() => { trackEvent('paywall_shown', { plan: currentPlan }); }, []);

  async function handleUpgrade(plan: Exclude<Plan, 'free'>) {
    trackEvent('upgrade_cta_clicked', { plan, from: currentPlan });
    const result = await startCheckout(plan);
    if (result.success && onPlanChange) onPlanChange(plan);
  }

  return (
    <div role="dialog" aria-modal="true" style={S.overlay}>
      <div style={S.card}>
        <div style={S.header}>
          <span style={S.badge}>Trial ended</span>
          <h2 style={S.title}>Continue your journey</h2>
          <p style={S.subtitle}>
            Your 14-day free trial has ended. Choose a plan to keep your streak and full access.
          </p>
        </div>

        <div style={S.planGrid}>
          <PlanCard plan="standard" recommended onUpgrade={handleUpgrade} />
          <PlanCard plan="premium" onUpgrade={handleUpgrade} />
        </div>

        <div style={S.tableWrap}>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.8125rem' }}>
            <thead>
              <tr>
                <th style={{ ...S.th, textAlign: 'left' as const, color: '#64748b' }}>Feature</th>
                <th style={{ ...S.th, color: '#6b7280' }}>Free</th>
                <th style={{ ...S.th, color: '#60a5fa' }}>Standard</th>
                <th style={{ ...S.th, color: '#a78bfa' }}>Premium</th>
              </tr>
            </thead>
            <tbody>
              {FEATURE_ROWS.map((row, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.025)' }}>
                  <td style={{ ...S.td, color: '#cbd5e1' }}>{row.label}</td>
                  <td style={{ ...S.td, color: '#6b7280', textAlign: 'center' as const }}>{row.free}</td>
                  <td style={{ ...S.td, color: '#93c5fd', textAlign: 'center' as const }}>{row.standard}</td>
                  <td style={{ ...S.td, color: '#c4b5fd', textAlign: 'center' as const }}>{row.premium}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {onDismiss && (
          <button onClick={() => { trackEvent('paywall_dismissed', { plan: currentPlan }); onDismiss(); }} style={S.dismissBtn}>
            Continue with limited free access
          </button>
        )}
      </div>
    </div>
  );
}

interface PlanCardProps { plan: Exclude<Plan, 'free'>; recommended?: boolean; onUpgrade: (p: Exclude<Plan, 'free'>) => void; }

function PlanCard({ plan, recommended, onUpgrade }: PlanCardProps) {
  const config: PlanConfig = PLANS[plan];
  const isStd = plan === 'standard';
  const accent = isStd ? '#3b82f6' : '#8b5cf6';

  return (
    <div style={{
      background: isStd ? 'rgba(59,130,246,0.08)' : 'rgba(139,92,246,0.08)',
      border: `1px solid ${isStd ? 'rgba(59,130,246,0.25)' : 'rgba(139,92,246,0.25)'}`,
      borderRadius: '1rem', padding: '1.25rem', position: 'relative' as const,
      display: 'flex', flexDirection: 'column' as const, gap: '0.875rem',
    }}>
      {recommended && (
        <div style={{ position: 'absolute' as const, top: '-0.625rem', left: '50%', transform: 'translateX(-50%)',
          background: accent, color: '#fff', fontSize: '0.6875rem', fontWeight: 700,
          letterSpacing: '0.08em', textTransform: 'uppercase' as const,
          padding: '0.2rem 0.75rem', borderRadius: '2rem', whiteSpace: 'nowrap' as const }}>
          Most popular
        </div>
      )}
      <div>
        <div style={{ color: accent, fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>{config.label}</div>
        <div style={{ fontSize: '1.625rem', fontWeight: 700, color: '#f1f5f9', lineHeight: 1.1 }}>{config.price}</div>
        <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.125rem' }}>per month, cancel anytime</div>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none' as const, display: 'flex', flexDirection: 'column' as const, gap: '0.4rem' }}>
        {Array.from(config.features).slice(0, 5).map(f => (
          <li key={f} style={{ display: 'flex', alignItems: 'flex-start' as const, gap: '0.5rem', color: '#cbd5e1', fontSize: '0.8125rem' }}>
            <span style={{ color: accent, marginTop: '1px', flexShrink: 0 }}>\u2713</span>
            {featureLabel(f as Feature)}
          </li>
        ))}
      </ul>
      <button onClick={() => onUpgrade(plan)} style={{
        marginTop: 'auto', padding: '0.6875rem', background: accent, border: 'none',
        borderRadius: '0.625rem', color: '#fff', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
      }}>
        Upgrade to {config.label}
      </button>
    </div>
  );
}

function featureLabel(f: Feature): string {
  const m: Record<Feature, string> = {
    multiple_tracks: 'Multiple active tracks', full_journey: 'Full journey access',
    coach_unlimited: 'Unlimited AI Coach', community_post: 'Post to community',
    streak_shield: 'Streak shields', all_themes: 'All island themes',
    enriched_checkin: 'Enriched check-ins', weekly_letter: 'Weekly review letter',
    sos_button: 'SOS crisis button', savings_calculator: 'Savings calculator',
  };
  return m[f] ?? f;
}

const S = {
  overlay: { position: 'fixed' as const, inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.88)',
    backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', overflowY: 'auto' as const },
  card: { background: 'rgba(12,12,20,0.97)', border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '1.5rem', padding: '2rem 1.75rem', width: '100%', maxWidth: '660px',
    boxShadow: '0 32px 96px rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column' as const, gap: '1.5rem' },
  header: { textAlign: 'center' as const },
  badge: { display: 'inline-block', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)',
    borderRadius: '2rem', padding: '0.25rem 0.875rem', fontSize: '0.75rem', fontWeight: 600,
    color: '#93c5fd', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: '0.875rem' },
  title: { fontSize: '1.875rem', fontWeight: 700, color: '#f1f5f9', margin: '0 0 0.5rem', letterSpacing: '-0.025em' },
  subtitle: { color: '#94a3b8', fontSize: '0.9375rem', lineHeight: 1.6, margin: 0 },
  planGrid: { display: 'grid' as const, gridTemplateColumns: '1fr 1fr', gap: '1rem' },
  tableWrap: { background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '0.875rem', overflow: 'hidden' as const, padding: '0.25rem 0' },
  th: { padding: '0.625rem 0.875rem', fontWeight: 600 as const, fontSize: '0.75rem',
    letterSpacing: '0.04em', textTransform: 'uppercase' as const,
    borderBottom: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' as const },
  td: { padding: '0.5rem 0.875rem' },
  dismissBtn: { display: 'block', width: '100%', padding: '0.625rem', background: 'transparent',
    border: 'none', color: '#475569', fontSize: '0.875rem', cursor: 'pointer',
    textDecoration: 'underline', textAlign: 'center' as const },
} as const;
