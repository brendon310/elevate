import React, { useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

export interface MilestoneShareCardProps {
  days: 10 | 30 | 100;
  trackName: string;
  userName?: string;
  onClose: () => void;
}

const MILESTONE_CONFIG = {
  10: {
    emoji: '🌱',
    gradient: 'from-emerald-400 via-teal-500 to-cyan-600',
    accentColor: '#34d399',
    labelKey: 'milestones.10_days',
  },
  30: {
    emoji: '🔥',
    gradient: 'from-orange-400 via-rose-500 to-pink-600',
    accentColor: '#fb923c',
    labelKey: 'milestones.30_days',
  },
  100: {
    emoji: '🏆',
    gradient: 'from-yellow-400 via-amber-500 to-orange-500',
    accentColor: '#fbbf24',
    labelKey: 'milestones.100_days',
  },
} as const;

export function MilestoneShareCard({ days, trackName, userName, onClose }: MilestoneShareCardProps) {
  const { t } = useTranslation();
  const cardRef = useRef<HTMLDivElement>(null);
  const cfg = MILESTONE_CONFIG[days];

  const handleDownload = useCallback(async () => {
    if (!cardRef.current) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: null,
        width: 390,
        height: 693,
      });
      const link = document.createElement('a');
      link.download = `elevate-${days}-days.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Screenshot failed', err);
    }
  }, [days]);

  const handleShare = useCallback(async () => {
    if (!cardRef.current) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: null,
        width: 390,
        height: 693,
      });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `elevate-${days}-days.png`, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: t('milestones.share_title', { days }),
            text: t('milestones.share_text', { days, track: trackName }),
          });
        } else {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = `elevate-${days}-days.png`;
          link.href = url;
          link.click();
          URL.revokeObjectURL(url);
        }
      }, 'image/png');
    } catch (err) {
      console.error('Share failed', err);
    }
  }, [days, trackName, t]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="flex flex-col items-center gap-4 w-full max-w-sm">
        <div
          ref={cardRef}
          className={`relative w-[390px] h-[693px] rounded-3xl overflow-hidden bg-gradient-to-br ${cfg.gradient} flex flex-col items-center justify-center`}
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-10 left-10 w-40 h-40 rounded-full bg-white blur-3xl" />
            <div className="absolute bottom-20 right-10 w-56 h-56 rounded-full bg-white blur-3xl" />
          </div>
          <div className="absolute top-10 left-0 right-0 flex justify-center">
            <div className="px-4 py-1 rounded-full bg-white/20 backdrop-blur-sm">
              <span className="text-white font-bold text-sm tracking-widest uppercase">Forge</span>
            </div>
          </div>
          <div className="relative flex flex-col items-center gap-6 px-8 text-center">
            <div className="text-8xl drop-shadow-2xl">{cfg.emoji}</div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[100px] font-black leading-none text-white drop-shadow-2xl" style={{ textShadow: '0 4px 24px rgba(0,0,0,0.3)' }}>{days}</span>
              <span className="text-3xl font-semibold text-white/90 uppercase tracking-[0.15em]">{t('milestones.days_label')}</span>
            </div>
            <div className="mt-2 px-6 py-3 rounded-2xl bg-white/25 backdrop-blur-md">
              <span className="text-white font-semibold text-xl">{trackName}</span>
            </div>
            <p className="text-white/85 text-lg font-medium leading-snug max-w-[280px]">{t(cfg.labelKey)}</p>
            {userName && <p className="text-white/70 text-base">{t('milestones.by_user', { name: userName })}</p>}
          </div>
          <div className="absolute bottom-10 left-0 right-0 flex justify-center">
            <span className="text-white/60 text-sm tracking-wide">forge-app.com</span>
          </div>
        </div>
        <div className="flex gap-3 w-full">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-white/30 text-white font-medium text-sm backdrop-blur-sm hover:bg-white/10 transition-colors">{t('common.close')}</button>
          <button onClick={handleDownload} className="flex-1 py-3 rounded-xl bg-white/20 backdrop-blur-sm text-white font-medium text-sm hover:bg-white/30 transition-colors">{t('milestones.download')}</button>
          <button onClick={handleShare} className="flex-1 py-3 rounded-xl bg-white font-semibold text-sm hover:opacity-90 transition-opacity" style={{ color: cfg.accentColor }}>{t('milestones.share')}</button>
        </div>
      </div>
    </div>
  );
}

export function useMilestoneCheck(currentStreak: number, milestonesReached: number[]): (10 | 30 | 100) | null {
  const MILESTONES: (10 | 30 | 100)[] = [10, 30, 100];
  for (const m of MILESTONES) {
    if (currentStreak >= m && !milestonesReached.includes(m)) return m;
  }
  return null;
}
