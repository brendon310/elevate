// src/components/PlanGate.tsx
// Feature-gate wrapper. Renders children when plan allows, locked UI otherwise.
// Two modes: default (replaces children) and overlay (dims children + blur lock).

import React, { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Plan, Feature, hasFeature, trackEvent } from '../plans';

interface PlanGateProps {
  plan: Plan;
  feature: Feature;
  accountCreatedAt?: string;
  onUpgrade: () => void;
  children: ReactNode;
  overlay?: boolean;
  label?: string;
  minHeight?: number;
}

export function PlanGate({ plan, feature, accountCreatedAt, onUpgrade, children, overlay = false, label, minHeight = 120 }: PlanGateProps) {
  const { t } = useTranslation();
  const allowed = hasFeature(plan, feature, accountCreatedAt);
  if (allowed) return <>{children}</>;

  function handleUpgrade(e: React.MouseEvent) {
    e.stopPropagation();
    trackEvent('feature_blocked', { plan, feature });
    onUpgrade();
  }

  const lockCard = (
    <div onClick={handleUpgrade} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && handleUpgrade(e as unknown as React.MouseEvent)}
      {...{ "aria-label": t("plangate.upgrade_aria") }}
      style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center',
        gap: '0.625rem', padding: '1.5rem 1rem',
        background: 'rgba(15,15,25,0.75)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '0.875rem', cursor: 'pointer', textAlign: 'center' as const, minHeight }}>
      <div style={{ width: '2.5rem', height: '2.5rem', background: 'rgba(59,130,246,0.12)',
        border: '1px solid rgba(59,130,246,0.25)', borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
        🔒
      </div>
      <p style={{ color: '#94a3b8', fontSize: '0.875rem', lineHeight: 1.4, margin: 0, maxWidth: '200px' }}>
        {label ?? t('plangate.default_label')}
      </p>
      <button onClick={handleUpgrade} style={{ padding: '0.4rem 1.125rem', background: '#3b82f6',
        border: 'none', borderRadius: '2rem', color: '#fff', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
        {t('plangate.upgrade_btn')}
      </button>
    </div>
  );

  if (overlay) {
    return (
      <div style={{ position: 'relative' as const }}>
        <div style={{ opacity: 0.25, pointerEvents: 'none', userSelect: 'none' as const }} aria-hidden="true">{children}</div>
        <div style={{ position: 'absolute' as const, inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
          borderRadius: '0.875rem' }}>
          {lockCard}
        </div>
      </div>
    );
  }

  return lockCard;
}

interface UpgradeInlineProps { label?: string; onUpgrade: () => void; }

export function UpgradeInline({ label, onUpgrade }: UpgradeInlineProps) {
  const { t } = useTranslation();
  const effectiveLabel = label ?? t('plangate.upgrade_inline');
  return (
    <button onClick={() => { trackEvent('upgrade_cta_clicked', { source: 'inline' }); onUpgrade(); }}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
        padding: '0.3rem 0.75rem', background: 'rgba(59,130,246,0.12)',
        border: '1px solid rgba(59,130,246,0.25)', borderRadius: '2rem',
        color: '#93c5fd', fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer' }}>
      <span style={{ fontSize: '0.75rem' }}>🔒</span>
      {effectiveLabel}
    </button>
  );
}
