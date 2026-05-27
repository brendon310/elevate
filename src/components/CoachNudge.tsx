import { useState, useEffect } from 'react';
import { X, Moon, Zap, Heart, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface CoachNudgeData {
  id?: string;
  type: 'inactivity' | 'high_urge' | 'low_mood' | 'streak_broken' | 'milestone';
  message: string;
  cta?: { label: string; route: string } | null;
}

const NUDGE_CONFIG: Record<string, {
  icon: React.ComponentType<{ className?: string }>;
  gradient: string; border: string; iconColor: string;
}> = {
  inactivity:    { icon: Moon,      gradient: 'from-blue-600/15 to-blue-500/5',    border: 'border-blue-500/20',   iconColor: 'text-blue-400' },
  high_urge:     { icon: Zap,       gradient: 'from-amber-600/15 to-amber-500/5',  border: 'border-amber-500/20',  iconColor: 'text-amber-400' },
  low_mood:      { icon: Heart,     gradient: 'from-purple-600/15 to-purple-500/5',border: 'border-purple-500/20', iconColor: 'text-purple-400' },
  streak_broken: { icon: RefreshCw, gradient: 'from-rose-600/15 to-rose-500/5',    border: 'border-rose-500/20',   iconColor: 'text-rose-400' },
  milestone:     { icon: Zap,       gradient: 'from-yellow-600/15 to-yellow-500/5',border: 'border-yellow-500/20', iconColor: 'text-yellow-400' },
};

export function CoachNudge({
  nudge, onDismiss, onCta,
}: {
  nudge: CoachNudgeData;
  onDismiss: () => void;
  onCta?: (route: string) => void;
}) {
  const cfg = NUDGE_CONFIG[nudge.type] || NUDGE_CONFIG.inactivity;
  const Icon = cfg.icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24 }}
        className={`relative rounded-2xl border bg-gradient-to-br ${cfg.gradient} ${cfg.border} p-4 mb-4`}
      >
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="flex gap-3 items-start pr-6">
          <div className={`mt-0.5 shrink-0 ${cfg.iconColor}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm leading-relaxed text-foreground/90">{nudge.message}</p>
            {nudge.cta && onCta && (
              <button
                onClick={() => onCta(nudge.cta!.route)}
                className="mt-2.5 text-xs font-semibold underline underline-offset-2 opacity-75 hover:opacity-100 transition"
              >
                {nudge.cta.label} &rarr;
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// Hook: fetch nudge from proactive-coach API (once per session)
export function useCoachNudge(userId: string | undefined, token: string | undefined) {
  const [nudge, setNudge] = useState<CoachNudgeData | null>(null);

  useEffect(() => {
    if (!userId || !token) return;
    if (sessionStorage.getItem('forge-nudge-checked')) return;
    sessionStorage.setItem('forge-nudge-checked', '1');

    fetch('/api/proactive-coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    })
      .then(r => r.ok ? r.json() : null)
      .then((data: { nudge: CoachNudgeData | null } | null) => {
        if (data?.nudge) setNudge(data.nudge);
      })
      .catch(() => {});
  }, [userId, token]);

  return { nudge, dismiss: () => setNudge(null) };
}
import { useState, useEffect } from 'react';
import { X, Moon, Zap, Heart, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface CoachNudgeData {
  id?: string;
  type: 'inactivity' | 'high_urge' | 'low_mood' | 'streak_broken' | 'milestone';
  message: string;
  cta?: { label: string; route: string } | null;
}

const NUDGE_CONFIG: Record<string, {
  icon: React.ComponentType<{ className?: string }>;
  gradient: string; border: string; iconColor: string;
}> = {
  inactivity:    { icon: Moon,      gradient: 'from-blue-600/15 to-blue-500/5',    border: 'border-blue-500/20',   iconColor: 'text-blue-400' },
  high_urge:     { icon: Zap,       gradient: 'from-amber-600/15 to-amber-500/5',  border: 'border-amber-500/20',  iconColor: 'text-amber-400' },
  low_mood:      { icon: Heart,     gradient: 'from-purple-600/15 to-purple-500/5',border: 'border-purple-500/20', iconColor: 'text-purple-400' },
  streak_broken: { icon: RefreshCw, gradient: 'from-rose-600/15 to-rose-500/5',    border: 'border-rose-500/20',   iconColor: 'text-rose-400' },
  milestone:     { icon: Zap,       gradient: 'from-yellow-600/15 to-yellow-500/5',border: 'border-yellow-500/20', iconColor: 'text-yellow-400' },
};

export function CoachNudge({
  nudge, onDismiss, onCta,
}: {
  nudge: CoachNudgeData;
  onDismiss: () => void;
  onCta?: (route: string) => void;
}) {
  const cfg = NUDGE_CONFIG[nudge.type] || NUDGE_CONFIG.inactivity;
  const Icon = cfg.icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24 }}
        className={`relative rounded-2xl border bg-gradient-to-br ${cfg.gradient} ${cfg.border} p-4 mb-4`}
      >
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="flex gap-3 items-start pr-6">
          <div className={`mt-0.5 shrink-0 ${cfg.iconColor}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm leading-relaxed text-foreground/90">{nudge.message}</p>
            {nudge.cta && onCta && (
              <button
                onClick={() => onCta(nudge.cta!.route)}
                className="mt-2.5 text-xs font-semibold underline underline-offset-2 opacity-75 hover:opacity-100 transition"
              >
                {nudge.cta.label} â
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// Hook: fetch nudge from proactive-coach API (once per session)
export function useCoachNudge(userId: string | undefined, token: string | undefined) {
  const [nudge, setNudge] = useState<CoachNudgeData | null>(null);

  useEffect(() => {
    if (!userId || !token) return;
    if (sessionStorage.getItem('forge-nudge-checked')) return;
    sessionStorage.setItem('forge-nudge-checked', '1');

    fetch('/api/proactive-coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    })
      .then(r => r.ok ? r.json() : null)
      .then((data: { nudge: CoachNudgeData | null } | null) => {
        if (data?.nudge) setNudge(data.nudge);
      })
      .catch(() => {});
  }, [userId, token]);

  return { nudge, dismiss: () => setNudge(null) };
}
