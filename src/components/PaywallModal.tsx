// src/components/PaywallModal.tsx
// Paywall modal shown when the 14-day trial ends and plan === 'free'.
// Appears every session until user upgrades.
// Placeholder checkout: wire startCheckout() in plans.ts to Stripe later.

import { useTranslation } from 'react-i18next';
import React, { useEffect, useState } from 'react';
import {
  Plan, PlanConfig, PLANS, Feature,
  startCheckout, trackEvent, trialActive,
} from '../plans';

interface FeatureRowDef { labelKey: string; free: string; standard: string; premium: string; }

// FEATURE_ROWS is now built dynamically using t() inside the component

export interface PaywallModalProps {
  currentPlan: Plan;
  accountCreatedAt: string;
  onDismiss?: () => void;
  onPlanChange?: (plan: Plan) => void;
}

export function PaywallModal({ currentPlan, accountCreatedAt, onDismiss, onPlanChange }: PaywallModalProps) {
  const { t } = useTranslation();
  const [yearly, setYearly] = useState(false);
  useEffect(() => { trackEvent('paywall_shown', { plan: currentPlan }); }, []);

  async function handleUpgrade(plan: Exclude<Plan, 'free'>) {
    trackEvent('upgrade_cta_clicked', { plan, from: currentPlan });
    const result = await startCheckout(plan, yearly ? 'year' : 'month');
    if (result.success && onPlanChange) onPlanChange(plan);
  }

  return (
    <div role="dialog" aria-modal="true" style={S.overlay}>
      <div style={S.card}>
        <div style={S.header}>
          {trialActive(accountCreatedAt) ? (
            <h2 style={S.title}>{t('paywall.unlock_title')}</h2>
          ) : (
            <>
              <span style={S.badge}>{t('paywall.trial_ended')}</span>
              <h2 style={S.title}>{t('paywall.continue_journey')}</h2>
            </>
          )}
          <p style={S.subtitle}>{t('paywall.subtitle')}</p>
        </div>

        {/* Billing interval toggle */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.375rem', marginBottom: '0.875rem' }}>
          {(['month', 'year'] as const).map(iv => {
            const active = yearly === (iv === 'year');
            return (
              <button key={iv} onClick={() => setYearly(iv === 'year')} style={{
                padding: '0.375rem 0.875rem', borderRadius: '2rem', fontSize: '0.75rem', fontWeight: 600,
                cursor: 'pointer', border: `1px solid ${active ? '#3b82f6' : 'rgba(148,163,184,0.25)'}`,
                background: active ? 'rgba(59,130,246,0.15)' : 'transparent',
                color: active ? '#93c5fd' : '#64748b',
              }}>
                {iv === 'month' ? t('paywall.billing_monthly') : t('paywall.billing_yearly')}
                {iv === 'year' && (
                  <span style={{ marginLeft: '0.375rem', color: '#4ade80', fontWeight: 700 }}>
                    {t('paywall.two_months_free')}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div style={S.planGrid}>
          <PlanCard plan="standard" recommended yearly={yearly} onUpgrade={handleUpgrade} />
          <PlanCard plan="premium" yearly={yearly} onUpgrade={handleUpgrade} />
        </div>

        <div style={S.tableWrap}>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.8125rem' }}>
            <thead>
              <tr>
                <th style={{ ...S.th, textAlign: 'left' as const, color: '#64748b' }}>{t('paywall.feature_col')}</th>
                <th style={{ ...S.th, color: '#6b7280' }}>{t('paywall.free_col')}</th>
                <th style={{ ...S.th, color: '#60a5fa' }}>{t('paywall.standard_col')}</th>
                <th style={{ ...S.th, color: '#a78bfa' }}>{t('paywall.premium_col')}</th>
              </tr>
            </thead>
            <tbody>
              {([
                { labelKey: 'paywall.features.active_tracks',     free: '1',           standard: '2',      premium: '3' },
                { labelKey: 'paywall.features.journey_length',    free: t('paywall.full_access'), standard: t('paywall.full_access'), premium: t('paywall.full_access') },
                { labelKey: 'paywall.features.ai_coach',          free: t('paywall.five_per_month'), standard: t('paywall.fifty_per_month'), premium: t('common.unlimited') },
                { labelKey: 'paywall.features.community',         free: t('paywall.read_only'),  standard: t('paywall.full_access'), premium: t('paywall.full_access') },
                { labelKey: 'paywall.features.shields',           free: t('common.none'),        standard: t('paywall.two_max'),  premium: t('paywall.five_max') },
                { labelKey: 'paywall.features.island_themes',     free: t('paywall.forest_only'), standard: t('paywall.all_3'), premium: t('paywall.all_3') },
                { labelKey: 'paywall.features.enriched_checkins', free: '—',  standard: '—',  premium: t('common.yes') },
                { labelKey: 'paywall.features.weekly_letter',     free: '—',  standard: '—',  premium: t('common.yes') },
                { labelKey: 'paywall.features.sos',               free: '—',  standard: t('common.yes'), premium: t('common.yes') },
                { labelKey: 'paywall.features.vacation',          free: '—',  standard: t('common.yes'), premium: t('common.yes') },
                { labelKey: 'paywall.features.savings',           free: '—',  standard: t('common.yes'), premium: t('common.yes') },
              ] as FeatureRowDef[]).map((row, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.025)' }}>
                  <td style={{ ...S.td, color: '#cbd5e1' }}>{t(row.labelKey)}</td>
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
{t('paywall.continue_free')}
          </button>
        )}
      </div>
    </div>
  );
}

interface PlanCardProps { plan: Exclude<Plan, 'free'>; recommended?: boolean; yearly?: boolean; onUpgrade: (p: Exclude<Plan, 'free'>) => void; }

function PlanCard({ plan, recommended, yearly, onUpgrade }: PlanCardProps) {
  const { t } = useTranslation();
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
{t('paywall.most_popular')}
        </div>
      )}
      <div>
        <div style={{ color: accent, fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.25rem' }}>{config.label}</div>
        <div style={{ fontSize: '1.625rem', fontWeight: 700, color: '#f1f5f9', lineHeight: 1.1 }}>
          {yearly ? (config.priceYear ?? config.price) : config.price}
        </div>
        <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.125rem' }}>
          {yearly ? t('paywall.per_year') : t('paywall.per_month')}
        </div>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none' as const, display: 'flex', flexDirection: 'column' as const, gap: '0.4rem' }}>
        {Array.from(config.features).slice(0, 5).map(f => (
          <li key={f} style={{ display: 'flex', alignItems: 'flex-start' as const, gap: '0.5rem', color: '#cbd5e1', fontSize: '0.8125rem' }}>
            <span style={{ color: accent, marginTop: '1px', flexShrink: 0 }}>\u2713</span>
{t(FEATURE_KEYS[f as Feature] ?? f)}
          </li>
        ))}
      </ul>
      <button onClick={() => onUpgrade(plan)} style={{
        marginTop: 'auto', padding: '0.6875rem', background: accent, border: 'none',
        borderRadius: '0.625rem', color: '#fff', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
      }}>
{t('paywall.upgrade_to', { plan: config.label })}
      </button>
    </div>
  );
}

const FEATURE_KEYS: Record<Feature, string> = {
  multiple_tracks: 'paywall.features.active_tracks',
  full_journey: 'paywall.features.journey_length',
  coach_unlimited: 'paywall.features.ai_coach',
  community_post: 'paywall.features.community',
  streak_shield: 'paywall.features.shields',
  all_themes: 'paywall.features.island_themes',
  enriched_checkin: 'paywall.features.enriched_checkins',
  weekly_letter: 'paywall.features.weekly_letter',
  sos_button: 'paywall.features.sos',
  savings_calculator: 'paywall.features.savings',
  vacation_mode: 'paywall.features.vacation',
};

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
