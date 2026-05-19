// Complete self-contained Elevate app — localStorage persistence, no backend.

import { useState, useEffect, useMemo, useCallback, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Eye, Check, Plus, Home, Layers, BarChart3, Settings,
  Sparkles, Flame, Sun, Moon, User as UserIcon, Trophy, CheckCircle2,
  Zap, AlertTriangle, Crown, Mail, Phone, ChevronLeft,
} from "lucide-react";
import confetti from "canvas-confetti";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Screen = "landing" | "login" | "onboarding" | "dashboard";
type AppPage = "home" | "tracks" | "insights" | "settings";

interface ElevateUser {
  name: string;
  createdAt: string;
  peakReachedAt?: string | null;
}

interface UserTrack {
  id: string;
  track_id: string;
  name: string;
  category: string;
  slug: string;
  added_at: string;
  current_streak: number;
  longest_streak: number;
  total_done: number;
  last_log_date: string | null;
  target_days: number;
}

interface Log {
  id: string;
  track_id: string;
  log_date: string;
  created_at: string;
}

interface OnboardingTrack { slug: string; name: string; category: string }

interface ElevateAuth {
  provider: "google" | "apple" | "email" | "phone";
  email?: string;
  phone?: string;
  name?: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const LS_USER = "elevate-user";
const LS_TRACKS = "elevate-tracks";
const LS_LOGS = "elevate-logs";
const LS_PREFS = "elevate-prefs";
const LS_AUTH = "elevate-auth";

const ALL_TRACKS = [
  { id: "1",  slug: "meditation",       name: "Meditation",       category: "Mental Health",      short_description: "Train your mind to find stillness." },
  { id: "2",  slug: "morning-run",      name: "Morning Run",      category: "Fitness & Body",     short_description: "Build your aerobic base." },
  { id: "3",  slug: "strength-training",name: "Strength Training",category: "Fitness & Body",     short_description: "Progressive overload for strength." },
  { id: "4",  slug: "quit-smoking",     name: "Quit Smoking",     category: "Quit Bad Habits",    short_description: "Allen Carr method." },
  { id: "5",  slug: "deep-work",        name: "Deep Work",        category: "Productivity & Life",short_description: "Cal Newport's framework." },
  { id: "6",  slug: "reading",          name: "Daily Reading",    category: "Mind & Learning",    short_description: "Feynman technique for retention." },
  { id: "7",  slug: "sleep-routine",    name: "Sleep Routine",    category: "Fitness & Body",     short_description: "Sleep science protocols." },
  { id: "8",  slug: "anxiety-relief",   name: "Anxiety Relief",   category: "Mental Health",      short_description: "CBT for anxiety." },
  { id: "9",  slug: "journaling",       name: "Journaling",       category: "Mind & Learning",    short_description: "Reflective writing practice." },
  { id: "10", slug: "cold-exposure",    name: "Cold Exposure",    category: "Fitness & Body",     short_description: "Hormetic stress protocol." },
  { id: "11", slug: "no-social-media",  name: "No Social Media",  category: "Quit Bad Habits",    short_description: "Digital detox protocol." },
];

const ONBOARDING_TRACKS: OnboardingTrack[] = [
  { slug: "meditation",       name: "Meditation",       category: "Mental Health" },
  { slug: "morning-run",      name: "Morning Run",      category: "Fitness & Body" },
  { slug: "strength-training",name: "Strength Training",category: "Fitness & Body" },
  { slug: "quit-smoking",     name: "Quit Smoking",     category: "Quit Bad Habits" },
  { slug: "deep-work",        name: "Deep Work",        category: "Productivity & Life" },
  { slug: "reading",          name: "Daily Reading",    category: "Mind & Learning" },
  { slug: "sleep-routine",    name: "Sleep Routine",    category: "Fitness & Body" },
  { slug: "anxiety-relief",   name: "Anxiety Relief",   category: "Mental Health" },
  { slug: "no-social-media",  name: "No Social Media",  category: "Quit Bad Habits" },
  { slug: "journaling",       name: "Journaling",       category: "Mind & Learning" },
];

const MOTIVATIONS = [
  "Today is a clean page. Write one good line.",
  "Small reps. Big identity.",
  "Show up. The rest follows.",
  "You're closer than you were yesterday.",
  "Repetition is how you become.",
  "Make one move that future-you applauds.",
  "Discipline is self-love in slow motion.",
];

const COACH_RESPONSES = [
  "What you've written holds more courage than you may realize. The desire to change isn't weakness—it's the first muscle you'll train. This path isn't about willpower alone; it's about becoming someone for whom this shift feels completely natural. I'll be with you every step of the way.",
  "I hear the depth in what you've shared. Beneath the specific thing you want to change lives a person who already knows who they're meant to be. That knowing is your compass—we don't add anything to you here, we clear away what's been covering it. I'll be with you every step of the way.",
  "The fact that you named it—clearly, honestly—already sets you apart from most people who feel this weight but never find the words. Your precision is power. Now let's build something with it, one day at a time. I'll be with you every step of the way.",
  "There's a version of you that has already made this change, and they made one decision that you're making right now: to begin. Not when ready. Not when perfect. Just now. That desire you feel is valid, real, and more than enough. I'll be with you every step of the way.",
];

// ─────────────────────────────────────────────────────────────────────────────
// LocalStorage helpers
// ─────────────────────────────────────────────────────────────────────────────

function lsLoad<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

function lsSave(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function nanoid() { return Math.random().toString(36).slice(2, 9) + Date.now().toString(36); }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function yesterdayStr() { return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10); }

function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pickCoachResponse(answer: string) {
  return COACH_RESPONSES[hashStr(answer) % COACH_RESPONSES.length];
}

function trackHueVar(category?: string) {
  const map: Record<string, string> = {
    "Fitness & Body": "--fitness",
    "Mental Health": "--mental",
    "Quit Bad Habits": "--quit",
    "Mind & Learning": "--learning",
    "Productivity & Life": "--productivity",
  };
  return category && map[category] ? map[category] : "--foreground";
}

function trackHueGradient(slug: string) {
  const shades = [
    ["oklch(0.22 0 0)", "oklch(0.10 0 0)"],
    ["oklch(0.20 0 0)", "oklch(0.09 0 0)"],
    ["oklch(0.24 0 0)", "oklch(0.12 0 0)"],
    ["oklch(0.18 0 0)", "oklch(0.08 0 0)"],
    ["oklch(0.26 0 0)", "oklch(0.13 0 0)"],
    ["oklch(0.21 0 0)", "oklch(0.11 0 0)"],
  ];
  const [a, b] = shades[hashStr(slug) % shades.length];
  return `linear-gradient(160deg, ${a}, ${b})`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Momentum (mirrors momentum.ts, pure client-side)
// ─────────────────────────────────────────────────────────────────────────────

function computeMomentum(tracks: UserTrack[]) {
  const t = todayStr();
  const totalStreak = tracks.reduce((s, x) => s + (x.current_streak || 0), 0);
  const totalLongest = tracks.reduce((s, x) => s + (x.longest_streak || 0), 0);
  const breadth = tracks.length;
  const todayDone = tracks.filter(x => x.last_log_date === t).length;
  const consistency = Math.min(400, totalStreak * 5);
  const longevity = Math.min(200, totalLongest * 2);
  const breadthScore = Math.min(150, breadth * 30);
  const todayScore = breadth === 0 ? 0 : Math.round((todayDone / breadth) * 250);
  const score = consistency + longevity + breadthScore + todayScore;
  return { score: Math.max(0, Math.min(1000, score)), consistency, longevity, breadth: breadthScore, today: todayScore };
}

function evolutionFor(mxStreak: number) {
  const tiers = [
    { min: 0,   label: "Spark",    ring: "evo-tier-0" },
    { min: 7,   label: "Glow",     ring: "evo-tier-1" },
    { min: 21,  label: "Ignite",   ring: "evo-tier-2" },
    { min: 66,  label: "Forged",   ring: "evo-tier-3" },
    { min: 180, label: "Anchored", ring: "evo-tier-4" },
    { min: 365, label: "Identity", ring: "evo-tier-5" },
  ];
  let idx = 0;
  for (let i = 0; i < tiers.length; i++) if (mxStreak >= tiers[i].min) idx = i;
  const next = idx < tiers.length - 1 ? tiers[idx + 1].min : null;
  return { label: tiers[idx].label, next, daysToNext: next ? next - mxStreak : 0, ringClass: tiers[idx].ring };
}

function detectFlow(tracks: UserTrack[]) {
  return tracks.filter(x => (x.current_streak || 0) >= 5).length >= 3;
}

function atRiskTracks(tracks: UserTrack[]) {
  const t = todayStr();
  return tracks.filter(x => (x.current_streak || 0) >= 7 && x.last_log_date !== t);
}

function maxStreak(tracks: UserTrack[]) {
  return tracks.reduce((m, x) => Math.max(m, x.current_streak || 0, x.longest_streak || 0), 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// ArcRing
// ─────────────────────────────────────────────────────────────────────────────

function ArcRing({ value, hueVar, size = 84 }: { value: number; hueVar: string; size?: number }) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="oklch(1 0 0 / 0.08)" strokeWidth={stroke} fill="none" />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r}
        stroke={`var(${hueVar})`} strokeWidth={stroke} strokeLinecap="round" fill="none"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c - (c * v) / 100 }}
        transition={{ type: "spring", stiffness: 60, damping: 16 }}
        style={{ filter: `drop-shadow(0 0 8px var(${hueVar}))` }}
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// useCountUp
// ─────────────────────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v;
}

// ─────────────────────────────────────────────────────────────────────────────
// Meter
// ─────────────────────────────────────────────────────────────────────────────

function Meter({ label, v, max }: { label: string; v: number; max: number }) {
  const pct = Math.min(100, (v / max) * 100);
  return (
    <div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.2, 0.9, 0.2, 1] }}
          className="h-full bg-foreground rounded-full"
        />
      </div>
      <p className="mt-1 text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-mono">{label}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MomentumHero
// ─────────────────────────────────────────────────────────────────────────────

function MomentumHero({ tracks, user, onUpdateUser, onCheckIn }: {
  tracks: UserTrack[];
  user: ElevateUser;
  onUpdateUser: (patch: Partial<ElevateUser>) => void;
  onCheckIn: (id: string) => void;
}) {
  const m = computeMomentum(tracks);
  const mxStreak = maxStreak(tracks);
  const evo = evolutionFor(mxStreak);
  const inFlow = detectFlow(tracks);
  const atRisk = atRiskTracks(tracks);
  const animated = useCountUp(m.score);
  const pct = m.score / 1000;
  const isMaxed = m.score >= 1000;
  const hasPeakBadge = !!user.peakReachedAt;

  useEffect(() => {
    if (!isMaxed || hasPeakBadge) return;
    onUpdateUser({ peakReachedAt: new Date().toISOString() });
    const gold = ["#FFD000", "#FFB347", "#FFE680", "#F5C518", "#FFFFFF"];
    const burst = (originX: number) =>
      confetti({ particleCount: 90, spread: 75, startVelocity: 45, gravity: 0.9, ticks: 220, origin: { x: originX, y: 0.35 }, colors: gold, scalar: 1.05 });
    burst(0.25);
    setTimeout(() => burst(0.75), 180);
    setTimeout(() => confetti({ particleCount: 140, spread: 120, startVelocity: 35, origin: { x: 0.5, y: 0.4 }, colors: gold }), 360);
  }, [isMaxed, hasPeakBadge, onUpdateUser]);

  const size = 168;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div className="space-y-3 mb-7">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="rounded-3xl p-5 depth-card relative overflow-hidden">
        <div aria-hidden className="absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, oklch(0.875 0.185 95), transparent 60%)" }} />
        <div className="flex items-center gap-5 relative">
          <div className="relative shrink-0" style={{ width: size, height: size }}>
            <div className={`absolute inset-0 rounded-full ${isMaxed ? "peak-ring" : evo.ringClass}`} style={{ padding: 3 }}>
              <div className="h-full w-full rounded-full bg-card" />
            </div>
            <svg width={size} height={size} className="absolute inset-0 -rotate-90">
              <circle cx={size / 2} cy={size / 2} r={r} stroke="oklch(0.92 0 0)" strokeWidth={stroke} fill="none" />
              <motion.circle cx={size / 2} cy={size / 2} r={r}
                stroke={isMaxed ? "oklch(0.78 0.20 70)" : "oklch(0.18 0 0)"}
                strokeWidth={stroke} strokeLinecap="round" fill="none"
                strokeDasharray={c}
                initial={{ strokeDashoffset: c }}
                animate={{ strokeDashoffset: c - c * pct }}
                transition={{ type: "spring", stiffness: 50, damping: 18 }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground font-mono">Momentum</p>
              <p className="font-display text-[3.25rem] leading-none text-foreground num-rise">{animated}</p>
              <p className="text-[10px] text-muted-foreground font-mono">/ 1000</p>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
              {isMaxed ? (
                <span className="peak-badge inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.2em] font-bold">
                  <Crown className="h-3 w-3" /> Maxed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground text-background px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.2em]">
                  <Sparkles className="h-3 w-3" /> {evo.label}
                </span>
              )}
              {hasPeakBadge && !isMaxed && (
                <span className="peak-badge inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.2em] font-bold"
                  title={`Peak reached ${new Date(user.peakReachedAt!).toLocaleDateString()}`}>
                  <Crown className="h-2.5 w-2.5" /> 1000 Club
                </span>
              )}
            </div>
            <h2 className="font-display text-2xl leading-tight tracking-tight">
              {isMaxed
                ? "Peak momentum. Hold the line."
                : m.score >= 700 ? "You're on fire."
                : m.score >= 400 ? "Momentum is building."
                : m.score >= 150 ? "You've started. Don't stop."
                : "Today is day one."}
            </h2>
            {!isMaxed && evo.next && (
              <p className="mt-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{evo.daysToNext}</span> day{evo.daysToNext === 1 ? "" : "s"} to{" "}
                <span className="font-semibold text-foreground">{evolutionFor(evo.next).label}</span>
              </p>
            )}
            <div className="mt-3 grid grid-cols-4 gap-1.5">
              <Meter label="Today" v={m.today} max={250} />
              <Meter label="Streak" v={m.consistency} max={400} />
              <Meter label="Depth" v={m.longevity} max={200} />
              <Meter label="Breadth" v={m.breadth} max={150} />
            </div>
          </div>
        </div>
      </motion.div>

      {inFlow && (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
          className="flow-banner rounded-2xl p-3.5 flex items-center gap-3 text-white">
          <Zap className="h-5 w-5 shrink-0" fill="currentColor" />
          <div className="flex-1 min-w-0">
            <p className="font-display text-sm leading-tight">You are in flow right now.</p>
            <p className="text-[11px] opacity-90">Protect this. Don't break the rhythm.</p>
          </div>
        </motion.div>
      )}

      {atRisk.map(t => (
        <motion.div key={t.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
          className="rounded-2xl p-3.5 border-2 border-[color:var(--secondary)] bg-card flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-[color:var(--secondary)] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight">
              Your <span className="font-mono">{t.current_streak}</span>-day streak on{" "}
              <span className="font-semibold">{t.name}</span> is at risk.
            </p>
            <p className="text-[11px] text-muted-foreground">Check in today. I know you can do this.</p>
          </div>
          <button onClick={() => onCheckIn(t.id)}
            className="shrink-0 rounded-full bg-[color:var(--secondary)] text-white px-3 py-1.5 text-xs font-semibold flex items-center gap-1 btn-chunk">
            <Flame className="h-3 w-3" /> Save it
          </button>
        </motion.div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LandingPage
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// LoginPage helpers
// ─────────────────────────────────────────────────────────────────────────────

function Spinner({ light = false }: { light?: boolean }) {
  return (
    <svg className={`animate-spin h-4 w-4 ${light ? "text-white" : "text-foreground"}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="16" height="18" viewBox="0 0 814 1000" fill="currentColor">
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.6-155.5-127.4C46.7 790.7 0 663 0 541.8c0-207.3 134.4-316.9 266.7-316.9 100.9 0 184.4 66.6 246.9 66.6 59.2 0 152.1-70.5 259.1-70.5zM552.7 140.8c-40 0-86.8-27.4-117.8-63.8-28-33.2-48.6-81-48.6-128.8 0-6.4.6-12.8 1.6-19.2 48.1 1.9 105 32.4 138.2 72.1 26.4 31.5 50.3 78.6 50.3 127.2 0 6.7-.6 13.4-1.6 20.1-7.2 1.6-14.4 2.4-22.1 2.4z"/>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LoginPage
// ─────────────────────────────────────────────────────────────────────────────

type LoginMode = "options" | "email" | "phone" | "otp";

function LoginPage({ onSuccess, onBack }: { onSuccess: () => void; onBack: () => void }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [mode, setMode] = useState<LoginMode>("options");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");

  const simulateAuth = useCallback(async (
    provider: ElevateAuth["provider"],
    data?: Partial<Omit<ElevateAuth, "provider" | "createdAt">>
  ) => {
    setLoading(provider);
    await new Promise(r => setTimeout(r, 1500));
    lsSave(LS_AUTH, { provider, ...data, createdAt: new Date().toISOString() } as ElevateAuth);
    setLoading(null);
    onSuccess();
  }, [onSuccess]);

  const handleGoogle = () => simulateAuth("google", { email: "user@gmail.com", name: "Elevate User" });
  const handleApple  = () => simulateAuth("apple",  { email: "user@icloud.com", name: "Elevate User" });

  const handleEmailContinue = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Enter a valid email address");
      return;
    }
    setEmailError("");
    simulateAuth("email", { email });
  };

  const handlePhoneContinue = () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setPhoneError("Enter a valid phone number");
      return;
    }
    setPhoneError("");
    setLoading("phone-send");
    setTimeout(() => { setLoading(null); setMode("otp"); }, 1000);
  };

  const handleOtpVerify = () => {
    if (otp.join("").length < 6) return;
    simulateAuth("phone", { phone });
  };

  const handleOtpChange = (i: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[i] = digit;
    setOtp(next);
    if (digit && i < 5) {
      const nextInput = document.getElementById(`otp-${i + 1}`);
      nextInput?.focus();
    }
  };

  const btnPrimary = "w-full inline-flex items-center justify-center gap-2 rounded-xl grad-electric px-4 py-3 text-sm font-bold text-white shadow-[var(--shadow-violet)] disabled:opacity-40 transition-opacity";
  const btnSecondary = "w-full inline-flex items-center justify-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-40";

  return (
    <div className="relative min-h-screen flex items-center justify-center px-6 py-16 overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: "radial-gradient(70% 60% at 50% -10%,oklch(0.62 0.215 275 / 0.4),transparent 70%),radial-gradient(40% 50% at 85% 10%,oklch(0.70 0.215 340 / 0.25),transparent 60%),radial-gradient(40% 40% at 15% 30%,oklch(0.82 0.165 165 / 0.15),transparent 70%)" }} />

      <button onClick={onBack}
        className="absolute top-7 left-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="h-4 w-4" /> Back
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-2xl grad-electric flex items-center justify-center shadow-[var(--shadow-violet)]">
              <span className="font-display text-white text-lg leading-none font-bold">e</span>
            </div>
            <span className="font-display text-[18px] tracking-tight font-semibold">Elevate</span>
          </div>
        </div>

        <div className="rounded-[2rem] border border-border bg-card p-8 shadow-2xl">
          <AnimatePresence mode="wait">

            {mode === "options" && (
              <motion.div key="options" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <h1 className="font-display text-2xl font-bold tracking-tight">Welcome back</h1>
                <p className="text-sm text-muted-foreground mt-1 mb-6">Continue your transformation.</p>

                <div className="space-y-3">
                  <button onClick={handleGoogle} disabled={!!loading} className={btnSecondary}>
                    {loading === "google" ? <Spinner /> : <><GoogleIcon /> Continue with Google</>}
                  </button>
                  <button onClick={handleApple} disabled={!!loading}
                    className="w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-foreground text-background px-4 py-3 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40">
                    {loading === "apple" ? <Spinner light /> : <><AppleIcon /> Continue with Apple</>}
                  </button>
                </div>

                <div className="my-5 flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[11px] text-muted-foreground font-mono uppercase tracking-widest">or</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <div className="space-y-2.5">
                  <button onClick={() => setMode("email")} disabled={!!loading} className={btnSecondary}>
                    <Mail className="h-4 w-4 text-muted-foreground" /> Continue with Email
                  </button>
                  <button onClick={() => setMode("phone")} disabled={!!loading} className={btnSecondary}>
                    <Phone className="h-4 w-4 text-muted-foreground" /> Continue with Phone
                  </button>
                </div>
              </motion.div>
            )}

            {mode === "email" && (
              <motion.div key="email" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}>
                <button onClick={() => setMode("options")} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors">
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                <h1 className="font-display text-2xl font-bold tracking-tight">Your email</h1>
                <p className="text-sm text-muted-foreground mt-1 mb-6">We'll send you a sign-in link.</p>
                <div className="space-y-3">
                  <div>
                    <input
                      type="email" value={email} autoFocus
                      onChange={e => { setEmail(e.target.value); setEmailError(""); }}
                      onKeyDown={e => e.key === "Enter" && handleEmailContinue()}
                      placeholder="you@example.com"
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring transition"
                    />
                    {emailError && <p className="text-xs text-red-400 mt-1.5">{emailError}</p>}
                  </div>
                  <button onClick={handleEmailContinue} disabled={!!loading} className={btnPrimary}>
                    {loading === "email" ? <Spinner light /> : "Continue →"}
                  </button>
                </div>
              </motion.div>
            )}

            {mode === "phone" && (
              <motion.div key="phone" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}>
                <button onClick={() => setMode("options")} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors">
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                <h1 className="font-display text-2xl font-bold tracking-tight">Your phone</h1>
                <p className="text-sm text-muted-foreground mt-1 mb-6">We'll send a verification code.</p>
                <div className="space-y-3">
                  <div>
                    <div className="flex gap-2">
                      <div className="rounded-xl border border-border bg-background px-3 py-3 text-sm text-muted-foreground font-mono">+1</div>
                      <input
                        type="tel" value={phone} autoFocus
                        onChange={e => { setPhone(e.target.value); setPhoneError(""); }}
                        onKeyDown={e => e.key === "Enter" && handlePhoneContinue()}
                        placeholder="(555) 000-0000"
                        className="flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring transition"
                      />
                    </div>
                    {phoneError && <p className="text-xs text-red-400 mt-1.5">{phoneError}</p>}
                  </div>
                  <button onClick={handlePhoneContinue} disabled={!!loading} className={btnPrimary}>
                    {loading === "phone-send" ? <Spinner light /> : "Send Code →"}
                  </button>
                </div>
              </motion.div>
            )}

            {mode === "otp" && (
              <motion.div key="otp" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}>
                <h1 className="font-display text-2xl font-bold tracking-tight">Enter the code</h1>
                <p className="text-sm text-muted-foreground mt-1 mb-6">Sent to {phone}.</p>
                <div className="space-y-4">
                  <div className="flex gap-2 justify-center">
                    {otp.map((digit, i) => (
                      <input
                        key={i} id={`otp-${i}`} type="text" inputMode="numeric"
                        maxLength={1} value={digit}
                        onChange={e => handleOtpChange(i, e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Backspace" && !digit && i > 0)
                            document.getElementById(`otp-${i - 1}`)?.focus();
                        }}
                        autoFocus={i === 0}
                        className="w-11 h-12 rounded-xl border border-border bg-background text-center text-xl font-mono font-bold outline-none focus:ring-2 focus:ring-ring transition"
                      />
                    ))}
                  </div>
                  <button onClick={handleOtpVerify} disabled={otp.join("").length < 6 || !!loading} className={btnPrimary}>
                    {loading === "phone" ? <Spinner light /> : "Verify →"}
                  </button>
                  <p className="text-xs text-center text-muted-foreground">
                    Didn't get it?{" "}
                    <button onClick={() => { setOtp(["","","","","",""]); setMode("phone"); }} className="underline hover:text-foreground transition-colors">
                      Try again
                    </button>
                  </p>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        <p className="mt-4 text-center text-[11px] text-muted-foreground leading-relaxed">
          By continuing you agree to our{" "}
          <span className="underline cursor-pointer hover:text-foreground transition-colors">Terms</span>
          {" & "}
          <span className="underline cursor-pointer hover:text-foreground transition-colors">Privacy Policy</span>
        </p>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LandingPage
// ─────────────────────────────────────────────────────────────────────────────

function LandingPage({ onBegin }: { onBegin: () => void }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden text-foreground">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[900px]"
        style={{ background: "radial-gradient(70% 60% at 50% -10%,oklch(0.62 0.215 275 / 0.5),transparent 70%),radial-gradient(40% 50% at 85% 10%,oklch(0.70 0.215 340 / 0.35),transparent 60%),radial-gradient(40% 40% at 15% 30%,oklch(0.82 0.165 165 / 0.20),transparent 70%)" }} />

      <header className="container mx-auto flex items-center justify-between px-6 py-7">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-2xl grad-electric flex items-center justify-center shadow-[var(--shadow-violet)]">
            <span className="font-display text-white text-lg leading-none font-bold">e</span>
          </div>
          <span className="font-display text-[18px] tracking-tight font-semibold">Elevate</span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-mono">
          <Eye className="h-3 w-3" /> Public demo
        </span>
      </header>

      <main className="container mx-auto px-6 relative">
        <section className="pt-20 pb-32 max-w-4xl">
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground font-mono">
            A transformation engine · est. 2026
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-6 font-display text-[clamp(3rem,9vw,7.5rem)] leading-[0.92] tracking-[-0.05em] font-bold">
            Become<br />
            <span className="text-yellow-400">who you</span><br />
            already are.
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-10 text-lg text-muted-foreground max-w-xl leading-relaxed">
            Fifty specialist AI coaches. One quiet companion that remembers everything.
            Built for the version of you that's already begun.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-12 flex flex-wrap items-center gap-5">
            <button onClick={onBegin}
              className="btn-chunk group inline-flex items-center gap-2 rounded-full grad-electric px-8 py-4 text-sm font-bold text-white shadow-[var(--shadow-violet)]">
              Begin <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition" />
            </button>
            <span className="text-sm text-muted-foreground">Read-only · everything you see is shared</span>
          </motion.div>
        </section>

        <section className="relative pb-32 max-w-5xl">
          <div className="grid md:grid-cols-12 gap-6">
            <motion.article initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="md:col-span-7 warm-card rounded-[2rem] p-8 md:p-10 relative ambient-warm">
              <p className="text-[10px] uppercase tracking-[0.3em] text-primary">01 — Specialist coaches</p>
              <h3 className="mt-4 font-display text-3xl md:text-4xl leading-tight">
                Each habit, its own <span className="italic">world-class mind</span>.
              </h3>
              <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-md">
                CBT for anxiety. Allen Carr for nicotine. Progressive overload for strength.
                Every coach is trained in the actual framework behind the change.
              </p>
            </motion.article>

            <motion.article initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
              className="md:col-span-5 md:mt-12 warm-card rounded-[2rem] p-8">
              <p className="text-[10px] uppercase tracking-[0.3em] text-primary">02 — Streaks that breathe</p>
              <h3 className="mt-4 font-display text-3xl leading-tight italic">Shielded, not shamed.</h3>
              <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                Life happens. Earn Shields. Spend them. Your story keeps its shape.
              </p>
            </motion.article>

            <motion.article initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 }}
              className="md:col-span-5 md:-mt-6 warm-card rounded-[2rem] p-8">
              <p className="text-[10px] uppercase tracking-[0.3em] text-primary">03 — Identity, not points</p>
              <h3 className="mt-4 font-display text-3xl leading-tight">
                <span className="italic">You are becoming</span> someone.
              </h3>
              <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                Day 21: you are a person who meditates. We track who, not what.
              </p>
            </motion.article>

            <motion.article initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
              className="md:col-span-7 warm-card rounded-[2rem] p-8 md:p-10">
              <p className="text-[10px] uppercase tracking-[0.3em] text-primary">04 — A letter, every Sunday</p>
              <h3 className="mt-4 font-display text-3xl md:text-4xl leading-tight">
                Not a dashboard. <span className="italic">A letter.</span>
              </h3>
              <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-md">
                Each week, your coach writes to you. Personally. With memory.
                With warmth. With something to believe about who you're becoming.
              </p>
            </motion.article>
          </div>
        </section>

        <section className="pb-24 max-w-3xl">
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Five worlds. Fifty paths.</p>
          <div className="mt-6 flex flex-wrap gap-2 text-xs">
            {["Fitness & Body", "Mental Health", "Quit Bad Habits", "Mind & Learning", "Productivity & Life"].map(c => (
              <span key={c} className="rounded-full border border-[color:var(--primary)]/30 bg-card px-4 py-2 text-foreground font-mono uppercase tracking-widest text-[10px]">{c}</span>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-10 text-center">
        <p className="font-display italic text-sm text-muted-foreground">Elevate · {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OnboardingPage
// ─────────────────────────────────────────────────────────────────────────────

type OnboardingStep = "question" | "thinking" | "response" | "tracks" | "contract";

function OnboardingPage({ onComplete }: { onComplete: (data: { name: string; track: OnboardingTrack }) => void }) {
  const [step, setStep] = useState<OnboardingStep>("question");
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState("");
  const [typedCount, setTypedCount] = useState(0);
  const [chosen, setChosen] = useState<OnboardingTrack | null>(null);
  const [name, setName] = useState("");

  const words = useMemo(() => message.split(/(\s+)/), [message]);
  const typingDone = typedCount >= words.length && words.length > 0;

  useEffect(() => {
    if (step !== "response" || !message) return;
    setTypedCount(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1; setTypedCount(i);
      if (i >= words.length) clearInterval(id);
    }, 75);
    return () => clearInterval(id);
  }, [step, message, words.length]);

  const handleQuestion = async () => {
    if (answer.trim().length < 10) return;
    setStep("thinking");
    await new Promise(r => setTimeout(r, 1800));
    setMessage(pickCoachResponse(answer));
    setStep("response");
  };

  const grouped = ONBOARDING_TRACKS.reduce<Record<string, OnboardingTrack[]>>((acc, t) => {
    (acc[t.category] ??= []).push(t); return acc;
  }, {});

  return (
    <div className="relative min-h-screen flex items-center justify-center px-6 py-16 overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: "radial-gradient(60% 60% at 50% 25%,oklch(0.62 0.215 275 / 0.45),transparent 70%),radial-gradient(45% 55% at 85% 85%,oklch(0.70 0.215 340 / 0.30),transparent 70%)" }} />

      <AnimatePresence mode="wait">
        {step === "question" && (
          <motion.div key="q" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.7 }} className="max-w-3xl w-full text-center">
            <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground mb-10">One question</p>
            <h1 className="font-display text-[clamp(2rem,6vw,4.5rem)] leading-[1.05] tracking-[-0.04em] font-semibold">
              What is the one thing that,<br />
              if you changed it,<br />
              <span className="text-yellow-400 italic">would change everything?</span>
            </h1>
            <div className="mt-14">
              <textarea autoFocus value={answer} onChange={e => setAnswer(e.target.value.slice(0, 1000))}
                placeholder="Be honest. No one else will read this."
                className="w-full bg-transparent border-0 border-b-2 border-border focus:border-[color:var(--primary)] outline-none text-center font-display text-2xl placeholder:text-muted-foreground py-5 px-2 resize-none min-h-[140px] transition-colors" />
              <div className="mt-3 text-[11px] text-muted-foreground font-mono tracking-wider">
                {answer.trim().length < 10 ? `${Math.max(0, 10 - answer.trim().length)} more to continue` : "Ready when you are"}
              </div>
              <AnimatePresence>
                {answer.trim().length >= 10 && (
                  <motion.button key="cont" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    onClick={handleQuestion}
                    className="btn-chunk mt-10 inline-flex items-center gap-2 rounded-full grad-electric text-white px-9 py-4 text-sm font-bold shadow-[var(--shadow-violet)]">
                    Continue <ArrowRight className="h-4 w-4" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {step === "thinking" && (
          <motion.div key="t" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
            <div className="mx-auto h-28 w-28 rounded-full grad-electric breathe" style={{ boxShadow: "var(--shadow-violet)" }} />
            <p className="mt-10 font-display text-xl text-muted-foreground">Your coach is reading this…</p>
          </motion.div>
        )}

        {step === "response" && (
          <motion.div key="r" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.7 }} className="max-w-2xl w-full text-center">
            <div className="mx-auto h-14 w-14 rounded-full grad-electric mb-10" style={{ boxShadow: "var(--shadow-violet)" }} />
            <p className="font-display text-[clamp(1.25rem,2.5vw,1.75rem)] leading-[1.55] tracking-[-0.01em] text-foreground text-left">
              {words.slice(0, typedCount).join("")}
              {!typingDone && <span className="inline-block w-[2px] h-[1.1em] align-[-0.15em] ml-1 bg-foreground animate-pulse" />}
            </p>
            <AnimatePresence>
              {typingDone && (
                <motion.button key="rcont" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }}
                  onClick={() => setStep("tracks")}
                  className="btn-chunk mt-12 inline-flex items-center gap-2 rounded-full grad-electric text-white px-9 py-4 text-sm font-bold shadow-[var(--shadow-violet)]">
                  Continue <ArrowRight className="h-4 w-4" />
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {step === "tracks" && (
          <motion.div key="tracks" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }} className="max-w-5xl w-full">
            <div className="text-center mb-10">
              <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground mb-4">Choose your path</p>
              <h2 className="font-display text-[clamp(1.75rem,4vw,3rem)] tracking-[-0.03em] leading-tight">
                Let's start with <span className="text-yellow-400 italic">one thing</span>.
              </h2>
              <p className="mt-4 text-muted-foreground">You can add more later. For now, one commitment is enough.</p>
            </div>
            <div className="space-y-8">
              {Object.entries(grouped).map(([cat, tracks]) => (
                <div key={cat}>
                  <h3 className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono mb-3">{cat}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {tracks.map(t => (
                      <button key={t.slug} onClick={() => setChosen(t)}
                        className={`warm-card rounded-2xl p-4 text-left transition btn-chunk ${chosen?.slug === t.slug ? "ring-2 ring-[color:var(--primary)]" : ""}`}>
                        <p className="font-semibold text-sm">{t.name}</p>
                        {chosen?.slug === t.slug && <Check className="h-4 w-4 mt-1 text-[color:var(--tertiary)]" />}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {chosen && (
              <div className="mt-10 text-center">
                <button onClick={() => setStep("contract")}
                  className="btn-chunk inline-flex items-center gap-2 rounded-full grad-electric text-white px-9 py-4 text-sm font-bold shadow-[var(--shadow-violet)]">
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </motion.div>
        )}

        {step === "contract" && (
          <motion.div key="contract" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }} className="max-w-lg w-full text-center">
            <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground mb-6">Last step</p>
            <h2 className="font-display text-3xl tracking-tight mb-8">What should your coach call you?</h2>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
              className="w-full bg-transparent border-0 border-b-2 border-border focus:border-[color:var(--primary)] outline-none text-center font-display text-2xl py-4 transition-colors" />
            {name.trim().length > 0 && (
              <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                onClick={() => onComplete({ name: name.trim(), track: chosen! })}
                className="btn-chunk mt-10 inline-flex items-center gap-2 rounded-full grad-electric text-white px-9 py-4 text-sm font-bold shadow-[var(--shadow-violet)]">
                Start my path <ArrowRight className="h-4 w-4" />
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DashboardLayout
// ─────────────────────────────────────────────────────────────────────────────

function DashboardLayout({ currentPage, onNavigate, children }: {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  children: ReactNode;
}) {
  const navItems: { id: AppPage; icon: typeof Home; label: string }[] = [
    { id: "home",     icon: Home,     label: "Home" },
    { id: "tracks",   icon: Layers,   label: "Tracks" },
    { id: "insights", icon: BarChart3,label: "Insights" },
    { id: "settings", icon: Settings, label: "Settings" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-60 border-r border-border bg-card flex-col p-4">
        <div className="flex items-center gap-2 mb-8 px-2">
          <div className="h-8 w-8 rounded-lg grad-electric flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold tracking-tight font-display">Elevate</span>
        </div>
        <nav className="flex-1 space-y-1">
          {navItems.map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => onNavigate(id)}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${currentPage === id ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"}`}>
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="md:ml-60 pb-24 md:pb-8">{children}</main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 border-t border-border bg-card z-50 flex justify-around py-2">
        {navItems.map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => onNavigate(id)}
            className={`flex flex-col items-center gap-1 px-4 py-1 text-[10px] ${currentPage === id ? "text-foreground" : "text-muted-foreground"}`}>
            <Icon className="h-5 w-5" />{label}
          </button>
        ))}
      </nav>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HomePage
// ─────────────────────────────────────────────────────────────────────────────

function HomePage({ user, tracks, onCheckIn, onNavigate, onUpdateUser }: {
  user: ElevateUser;
  tracks: UserTrack[];
  onCheckIn: (id: string) => void;
  onNavigate: (page: AppPage) => void;
  onUpdateUser: (patch: Partial<ElevateUser>) => void;
}) {
  const motivation = useMemo(() => {
    const d = new Date();
    const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    return MOTIVATIONS[seed % MOTIVATIONS.length];
  }, []);

  const t = todayStr();
  const todayFormatted = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const hour = new Date().getHours();
  const greeting = hour < 5 ? "Still up" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = user.name.split(" ")[0];

  return (
    <div className="relative max-w-5xl mx-auto px-5 pt-8 pb-32">
      <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-7">
        <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground font-mono">{todayFormatted}</p>
        <h1 className="mt-2 font-display text-[2.5rem] leading-[1] tracking-[-0.03em]">
          {greeting},<br />
          <span className="text-electric">{firstName}.</span>
        </h1>
        <p className="mt-3 text-base text-foreground max-w-md leading-snug">{motivation}</p>
      </motion.header>

      {tracks.length > 0 && (
        <MomentumHero tracks={tracks} user={user} onUpdateUser={onUpdateUser} onCheckIn={onCheckIn} />
      )}

      <div className="flex items-end justify-between mb-4">
        <h2 className="font-display text-2xl tracking-tight">Your paths</h2>
        <button onClick={() => onNavigate("tracks")}
          className="btn-chunk inline-flex items-center gap-1.5 rounded-full bg-[color:var(--primary)] text-primary-foreground px-3.5 py-2 text-xs font-semibold"
          style={{ boxShadow: "var(--shadow-violet)" }}>
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>

      <div className="-mx-5 px-5 overflow-x-auto no-scrollbar mb-10">
        <div className="flex gap-4 pb-2 snap-x snap-mandatory">
          {tracks.map((ut, i) => {
            const hueVar = trackHueVar(ut.category);
            const grad = trackHueGradient(ut.slug);
            const target = Math.max(1, ut.target_days ?? 30);
            const pct = Math.min(100, Math.round(((ut.current_streak ?? 0) / target) * 100));
            const doneToday = ut.last_log_date === t;
            return (
              <motion.div key={ut.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + i * 0.05, type: "spring", stiffness: 90, damping: 16 }}>
                <div className="snap-start w-[260px] h-[340px] rounded-[20px] p-5 relative overflow-hidden btn-chunk"
                  style={{ background: grad, boxShadow: `0 24px 50px -16px color-mix(in oklab, var(${hueVar}) 55%, transparent), 0 4px 14px -4px color-mix(in oklab, var(${hueVar}) 35%, transparent)` }}>
                  <div aria-hidden className="absolute -right-12 -bottom-12 h-56 w-56 rounded-full opacity-50 blur-2xl"
                    style={{ background: "radial-gradient(circle, oklch(1 0 0 / 0.5), transparent 60%)" }} />
                  <div aria-hidden className="absolute right-3 top-3 h-20 w-20 rounded-full opacity-70"
                    style={{ background: "radial-gradient(circle, oklch(1 0 0 / 0.35), transparent 70%)" }} />
                  <div className="relative flex items-start justify-between">
                    <span className="text-[10px] uppercase tracking-[0.25em] text-white font-mono">{ut.category}</span>
                    <ArcRing value={pct} hueVar="--background" size={56} />
                  </div>
                  <div className="relative mt-auto pt-12">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-white font-mono">Day</p>
                    <p className="font-display text-[5.5rem] leading-[0.85] tracking-[-0.05em] text-white">{ut.current_streak || 0}</p>
                    <h3 className="mt-3 font-display text-xl text-white leading-tight line-clamp-2">{ut.name}</h3>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-black px-2.5 py-1 text-[11px] text-white">
                        <Flame className="h-3 w-3 flame text-[color:var(--highlight)]" />
                        <span className="font-mono">{ut.current_streak || 0}</span>
                        <span>streak</span>
                      </div>
                      {doneToday && (
                        <div className="inline-flex items-center gap-1 rounded-full bg-[color:var(--tertiary)] px-2.5 py-1 text-[11px] text-white font-semibold">
                          <Check className="h-3 w-3" /> Done
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
          <button onClick={() => onNavigate("tracks")}
            className="snap-start flex flex-col items-center justify-center w-[200px] h-[340px] rounded-[20px] border-2 border-dashed border-[color:var(--primary)]/40 text-muted-foreground hover:border-[color:var(--primary)] hover:text-foreground transition btn-chunk">
            <Plus className="h-8 w-8 mb-2" />
            <span className="text-sm font-medium">New path</span>
          </button>
        </div>
      </div>

      <h2 className="font-display text-2xl tracking-tight mb-4">Today's actions</h2>
      <div className="space-y-2.5">
        {tracks.map(ut => {
          const hueVar = trackHueVar(ut.category);
          const doneToday = ut.last_log_date === t;
          return (
            <div key={ut.id} className="group flex items-center gap-4 rounded-2xl p-4 depth-card">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="h-12 w-12 rounded-2xl flex items-center justify-center text-white font-display text-base shrink-0"
                  style={{ background: trackHueGradient(ut.slug), boxShadow: `0 8px 20px -6px color-mix(in oklab, var(${hueVar}) 60%, transparent)` }}>
                  {ut.name.slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.25em] font-mono" style={{ color: `var(${hueVar})` }}>{ut.category}</p>
                  <p className="font-semibold text-[15px] truncate">{ut.name}</p>
                </div>
              </div>
              {doneToday ? (
                <div className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-[color:var(--tertiary)]/15 text-[color:var(--tertiary)] px-3.5 py-2 text-xs font-semibold">
                  <Check className="h-3.5 w-3.5" /> Done
                </div>
              ) : (
                <button onClick={() => onCheckIn(ut.id)}
                  className="shrink-0 btn-chunk rounded-full bg-foreground text-background px-3.5 py-2 text-xs font-semibold transition"
                  aria-label={`Check in for ${ut.name}`}>
                  Check in
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TracksPage
// ─────────────────────────────────────────────────────────────────────────────

function TracksPage({ userTracks, onAdd }: {
  userTracks: UserTrack[];
  onAdd: (t: typeof ALL_TRACKS[0]) => void;
}) {
  const activeIds = new Set(userTracks.map(u => u.track_id));
  const grouped = ALL_TRACKS.reduce<Record<string, typeof ALL_TRACKS>>((acc, t) => {
    (acc[t.category] ??= []).push(t); return acc;
  }, {});

  return (
    <div className="max-w-5xl mx-auto px-5 py-8 pb-24">
      <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground font-mono">Library</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">Fifty <span className="text-yellow-400">specialists</span>.</h1>
      <p className="mt-2 text-foreground">Pick the one that calls you today.</p>
      <div className="mt-10 space-y-10">
        {Object.entries(grouped).map(([cat, tracks]) => (
          <section key={cat}>
            <h2 className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground font-mono mb-4">{cat}</h2>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {tracks.map((t, i) => {
                const on = activeIds.has(t.id);
                return (
                  <motion.div key={t.id} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                    className="warm-card rounded-2xl p-5 flex flex-col gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.25em] font-mono text-muted-foreground">{t.category}</p>
                      <h3 className="mt-1 font-semibold text-[15px]">{t.name}</h3>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{t.short_description}</p>
                    </div>
                    <button onClick={() => !on && onAdd(t)} disabled={on}
                      className={`btn-chunk self-start rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${on ? "bg-[color:var(--tertiary)]/15 text-[color:var(--tertiary)]" : "bg-foreground text-background"}`}>
                      {on
                        ? <><Check className="inline h-3 w-3 mr-1" />Active</>
                        : <><Plus className="inline h-3 w-3 mr-1" />Start</>}
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// InsightsPage
// ─────────────────────────────────────────────────────────────────────────────

function InsightsPage({ userTracks, logs }: { userTracks: UserTrack[]; logs: Log[] }) {
  const heatmap = useMemo(() => {
    const byDay = new Map<string, number>();
    logs.forEach(l => byDay.set(l.log_date, (byDay.get(l.log_date) || 0) + 1));
    const result: { date: string; count: number }[] = [];
    for (let i = 89; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
      result.push({ date: d, count: byDay.get(d) || 0 });
    }
    return result;
  }, [logs]);

  const weeks = useMemo(() => {
    const cols: typeof heatmap[] = [];
    for (let i = 0; i < heatmap.length; i += 7) cols.push(heatmap.slice(i, i + 7));
    return cols;
  }, [heatmap]);

  const tone = (count: number) => {
    if (count <= 0) return "bg-muted";
    if (count === 1) return "bg-green-200";
    if (count === 2) return "bg-green-400";
    return "bg-green-600";
  };

  return (
    <div className="container mx-auto px-6 py-8 max-w-4xl space-y-8">
      <header>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight font-display">Your Weekly Letter</h1>
        <p className="text-muted-foreground mt-1">The page where the data tells the truth.</p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold mb-4">90-day activity</h2>
        <div className="flex gap-1 overflow-x-auto">
          {weeks.map((w, i) => (
            <div key={i} className="flex flex-col gap-1">
              {w.map(d => (
                <div key={d.date} title={d.date} className={`h-3 w-3 rounded-sm ${tone(d.count)}`} />
              ))}
            </div>
          ))}
        </div>
      </section>

      {userTracks.length > 0 && (
        <section>
          <h2 className="font-semibold mb-3">Per-track</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {userTracks.map(t => (
              <div key={t.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold truncate">{t.name}</h3>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.category}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <div className="rounded-xl bg-muted p-2">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground text-[10px] uppercase">
                      <Flame className="h-3 w-3" />Streak
                    </div>
                    <p className="font-bold text-base mt-0.5">{t.current_streak || 0}</p>
                  </div>
                  <div className="rounded-xl bg-muted p-2">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground text-[10px] uppercase">
                      <Trophy className="h-3 w-3" />Best
                    </div>
                    <p className="font-bold text-base mt-0.5">{t.longest_streak || 0}</p>
                  </div>
                  <div className="rounded-xl bg-muted p-2">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground text-[10px] uppercase">
                      <CheckCircle2 className="h-3 w-3" />Done
                    </div>
                    <p className="font-bold text-base mt-0.5">{t.total_done || 0}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SettingsPage
// ─────────────────────────────────────────────────────────────────────────────

function SettingsPage({ userName, onSignOut }: { userName: string; onSignOut: () => void }) {
  const [displayName, setDisplayName] = useState(userName);
  const [theme, setTheme] = useState<"light" | "dark">(() => lsLoad<{ theme: "light" | "dark" }>(LS_PREFS, { theme: "light" }).theme);

  const applyTheme = (t: "light" | "dark") => {
    setTheme(t);
    lsSave(LS_PREFS, { theme: t });
    document.documentElement.classList.toggle("dark", t === "dark");
  };

  return (
    <div className="container mx-auto px-6 py-8 max-w-2xl space-y-6">
      <header>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight font-display">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and preferences.</p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted">
            <UserIcon className="h-4 w-4" />
          </span>
          <h2 className="font-semibold">Account</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Display name</label>
            <div className="flex gap-2 mt-1.5">
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name"
                className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
              <button className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Save</button>
            </div>
          </div>
          <button onClick={onSignOut}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted">
            Sign out
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted">
            <Sun className="h-4 w-4" />
          </span>
          <h2 className="font-semibold">Appearance</h2>
        </div>
        <div className="flex items-center justify-between gap-3 py-3">
          <p className="text-sm font-medium">Theme</p>
          <div className="inline-flex rounded-xl border border-border bg-card p-1">
            <button onClick={() => applyTheme("light")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${theme === "light" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              <Sun className="h-3.5 w-3.5" /> Light
            </button>
            <button onClick={() => applyTheme("dark")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${theme === "dark" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              <Moon className="h-3.5 w-3.5" /> Dark
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ElevateApp — root component
// ─────────────────────────────────────────────────────────────────────────────

export function ElevateApp() {
  const [screen, setScreen] = useState<Screen>(() => {
    const user = lsLoad<ElevateUser | null>(LS_USER, null);
    const auth = lsLoad<ElevateAuth | null>(LS_AUTH, null);
    if (user) return "dashboard";
    if (auth) return "onboarding";
    return "landing";
  });
  const [page, setPage] = useState<AppPage>("home");
  const [user, setUser] = useState<ElevateUser | null>(() => lsLoad(LS_USER, null));
  const [tracks, setTracks] = useState<UserTrack[]>(() => lsLoad(LS_TRACKS, []));
  const [logs, setLogs] = useState<Log[]>(() => lsLoad(LS_LOGS, []));

  const updateUser = useCallback((patch: Partial<ElevateUser>) => {
    setUser(prev => {
      const next = { ...prev!, ...patch };
      lsSave(LS_USER, next);
      return next;
    });
  }, []);

  const addTrack = useCallback((trackDef: typeof ALL_TRACKS[0]) => {
    setTracks(prev => {
      if (prev.some(t => t.track_id === trackDef.id)) return prev;
      const next: UserTrack[] = [...prev, {
        id: nanoid(), track_id: trackDef.id, name: trackDef.name,
        category: trackDef.category, slug: trackDef.slug,
        added_at: new Date().toISOString(),
        current_streak: 0, longest_streak: 0, total_done: 0,
        last_log_date: null, target_days: 30,
      }];
      lsSave(LS_TRACKS, next);
      return next;
    });
  }, []);

  const checkIn = useCallback((userTrackId: string) => {
    const t = todayStr();
    const y = yesterdayStr();
    setTracks(prev => {
      const next = prev.map(ut => {
        if (ut.id !== userTrackId || ut.last_log_date === t) return ut;
        const newStreak = ut.last_log_date === y ? (ut.current_streak || 0) + 1 : 1;
        return { ...ut, current_streak: newStreak, longest_streak: Math.max(ut.longest_streak || 0, newStreak), total_done: (ut.total_done || 0) + 1, last_log_date: t };
      });
      lsSave(LS_TRACKS, next);
      return next;
    });
    setLogs(prev => {
      const next = [...prev, { id: nanoid(), track_id: userTrackId, log_date: todayStr(), created_at: new Date().toISOString() }];
      lsSave(LS_LOGS, next);
      return next;
    });
  }, []);

  const handleOnboardingComplete = useCallback(({ name, track }: { name: string; track: OnboardingTrack }) => {
    const newUser: ElevateUser = { name, createdAt: new Date().toISOString() };
    lsSave(LS_USER, newUser);
    setUser(newUser);
    const full = ALL_TRACKS.find(t => t.slug === track.slug) ?? {
      id: nanoid(), slug: track.slug, name: track.name, category: track.category, short_description: "",
    };
    const ut: UserTrack = {
      id: nanoid(), track_id: full.id, name: full.name, category: full.category, slug: full.slug,
      added_at: new Date().toISOString(), current_streak: 0, longest_streak: 0, total_done: 0,
      last_log_date: null, target_days: 30,
    };
    lsSave(LS_TRACKS, [ut]);
    setTracks([ut]);
    setScreen("dashboard");
  }, []);

  const handleSignOut = useCallback(() => {
    [LS_USER, LS_TRACKS, LS_LOGS, LS_AUTH].forEach(k => localStorage.removeItem(k));
    setUser(null); setTracks([]); setLogs([]);
    setScreen("landing");
  }, []);

  if (screen === "landing") return <LandingPage onBegin={() => setScreen("login")} />;
  if (screen === "login") return (
    <LoginPage
      onSuccess={() => setScreen("onboarding")}
      onBack={() => setScreen("landing")}
    />
  );
  if (screen === "onboarding") return <OnboardingPage onComplete={handleOnboardingComplete} />;

  return (
    <DashboardLayout currentPage={page} onNavigate={setPage}>
      {page === "home" && (
        <HomePage user={user!} tracks={tracks} onCheckIn={checkIn} onNavigate={setPage} onUpdateUser={updateUser} />
      )}
      {page === "tracks" && <TracksPage userTracks={tracks} onAdd={addTrack} />}
      {page === "insights" && <InsightsPage userTracks={tracks} logs={logs} />}
      {page === "settings" && <SettingsPage userName={user?.name ?? ""} onSignOut={handleSignOut} />}
    </DashboardLayout>
  );
}
