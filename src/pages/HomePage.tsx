import { useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Eye, Check, Plus, Home, Layers, BarChart3, Settings, Shield,
  Sparkles, Flame, Sun, Moon, User as UserIcon, Trophy, CheckCircle2,
  Zap, AlertTriangle, Crown, Mail, Phone, ChevronLeft, Search,
  Database, Download, Bell, Target, Lock, PenLine, X, BarChart2
} from 'lucide-react';
import confetti from "canvas-confetti";
import { supabase } from "../supabase";
import { CoachNudge, useCoachNudge } from '../components/CoachNudge';
import { useTranslation } from 'react-i18next';
import type { BeforeInstallPromptEvent, Screen, AppPage, ElevateUser, UserTrack, Log, OnboardingTrack, ElevateAuth, Journey, JourneyDay, ChatMessage, CommunityPost } from '../types';

function SlotNumber({ value }: { value: number }) {
  const [pair, setPair] = useState<[number, number]>([value, value]);
  const [anim, setAnim] = useState(false);
  const prev = useRef(value);
  useEffect(() => {
    if (value === prev.current) return;
    const next = value;
    setPair([prev.current, next]);
    setAnim(false);
    const r = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setAnim(true);
        setTimeout(() => {
          prev.current = next;
          setPair([next, next]);
          setAnim(false);
        }, 430);
      })
    );
    return () => cancelAnimationFrame(r);
  }, [value]);
  return (
    <span style={{ display: "inline-block", overflow: "hidden", height: "0.85em", verticalAlign: "bottom" }}>
      <span style={{ display: "flex", flexDirection: "column", transition: anim ? "transform 0.38s cubic-bezier(0.22,1,0.36,1)" : "none", transform: anim ? "translateY(-50%)" : "translateY(0)" }}>
        <span style={{ height: "0.85em" }}>{pair[0]}</span>
        <span style={{ height: "0.85em" }}>{pair[1]}</span>
      </span>
    </span>
  );
}

interface TrackSavings {
  costPerUnit: number;   // euro
  unitName: string;      // singolare
  unitNamePlural: string;
  emoji: string;
}

function todayStr() { return new Date().toISOString().slice(0, 10); }

function lsLoad<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

function lsSave(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

const MOTIVATIONS = [
  "Today is a clean page. Write one good line.",
  "Small reps. Big identity.",
  "Show up. The rest follows.",
  "You're closer than you were yesterday.",
  "Repetition is how you become.",
  "Make one move that future-you applauds.",
  "Discipline is self-love in slow motion.",
];

function trackHueVar(category?: string) {
  const map: Record<string, string> = {
    "Fitness & Body": "--fitness",
    "Mental Health": "--mental",
    "Quit Bad Habits": "--quit",
    "Mind & Learning": "--learning",
    "Productivity & Life": "--productivity",
    "Addiction & Recovery": "--quit",
    "Financial Health": "--productivity",
    "Psychology & Self": "--mental",
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

function liveStreak(ut: UserTrack): number {
  const today = todayStr();
  const y = yesterdayStr();
  if (ut.vacation_until && ut.vacation_until >= today) return ut.current_streak || 0;
  if (ut.last_log_date === today || ut.last_log_date === y) return ut.current_streak || 0;
  return 0;
}

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

function ArcRing({ value, hueVar, color, size = 84 }: { value: number; hueVar?: string; color?: string; size?: number }) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  const strokeColor = color ?? (hueVar ? `var(${hueVar})` : "currentColor");
  return (
    <svg width={size} height={size} className="-rotate-90" overflow="visible">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="oklch(1 0 0 / 0.15)" strokeWidth={stroke} fill="none" />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r}
        stroke={strokeColor} strokeWidth={stroke} strokeLinecap="round" fill="none"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c - (c * v) / 100 }}
        transition={{ type: "spring", stiffness: 60, damping: 16 }}
        style={{ filter: `drop-shadow(0 0 6px ${strokeColor})` }}
      />
    </svg>
  );
}

function PrizeClaimModal({ userName, onClose }: { userName: string; onClose: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState(userName);
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  async function handleSubmit() {
    if (!name.trim() || !email.trim() || !address.trim()) return;
    setSubmitting(true);
    try {
      await supabase.from('prize_claims').insert({
        name: name.trim(), email: email.trim(),
        address: address.trim(), claimed_at: new Date().toISOString(),
      });
      setDone(true);
    } catch (_) {
      // ignore
    } finally {
      setSubmitting(false);
    }
  }
  if (done) return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{background:'rgba(0,0,0,0.75)'}}>
      <div className="w-full max-w-md bg-neutral-900 rounded-t-2xl p-6 pb-10">
<p className="text-white text-lg font-semibold text-center mb-2">{t("home.prize_on_list")}</p>
<p className="text-white/50 text-sm text-center mb-6">{t("home.prize_on_list_body")}</p>
<button onClick={onClose} className="w-full py-3 rounded-xl bg-white/10 text-white text-sm font-medium">{t("common.close")}</button>
      </div>
    </div>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{background:'rgba(0,0,0,0.75)'}}>
      <div className="w-full max-w-md bg-neutral-900 rounded-t-2xl p-6 pb-10">
        <div className="flex items-center justify-between mb-4">
<p className="text-white font-semibold">{t("home.prize_title")}</p>
          <button onClick={onClose} className="text-white/40 text-2xl leading-none">&times;</button>
        </div>
<p className="text-white/50 text-sm mb-5">{t("home.prize_body")}</p>
        <input value={name} onChange={e => setName(e.target.value)} placeholder={t("home.name_placeholder")} className="w-full mb-3 px-4 py-3 rounded-xl bg-white/10 text-white placeholder-white/30 text-sm border border-white/10 focus:outline-none" />
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder={t("home.email_placeholder_field")} type="email" className="w-full mb-3 px-4 py-3 rounded-xl bg-white/10 text-white placeholder-white/30 text-sm border border-white/10 focus:outline-none" />
        <textarea value={address} onChange={e => setAddress(e.target.value)} placeholder={t("home.address_placeholder")} rows={3} className="w-full mb-5 px-4 py-3 rounded-xl bg-white/10 text-white placeholder-white/30 text-sm border border-white/10 focus:outline-none resize-none" />
        <button onClick={handleSubmit} disabled={submitting || !name.trim() || !email.trim() || !address.trim()} className="w-full py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-40">
{submitting ? t('common.sending') : t('home.send_address')}
        </button>
      </div>
    </div>
  );
}

const LS_DAYS = (slug: string) => `forge-days-${slug}`;
function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function yesterdayStr() { return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10); }
function ghostDayFor(ut: UserTrack): number {
  const ms = Date.now() - new Date(ut.added_at).getTime();
  return Math.max(1, Math.floor(ms / 86_400_000) + 1);
}
const QUICK_NOTE_BANNED = [
  "cazzo","vaffanculo","merda","stronzo","puttana","figa","coglione","minchia","porco dio",
  "fuck","shit","bitch","asshole","bastard","cunt","dick","pussy","nigger","faggot",
];

function validateQuickNote(text: string): string | null {
  const t = text.trim();
  if (t.length < 10) return "Write at least a few words before sending.";
  if (/^(.)\1{5,}$/.test(t)) return "Sembra che tu stia scherzando — scrivi davvero!";
  if (/^[\d\s\W]+$/.test(t)) return "Scrivi qualcosa di reale, anche una frase breve.";
  if (t.length > 6 && !/[aeiouàèéìòùAEIOUÀÈÉÌÒÙ]/u.test(t))
    return "Scrivi una risposta vera — anche due parole bastano.";
  if (QUICK_NOTE_BANNED.some(w => t.toLowerCase().includes(w)))
    return "Choose better words for your check-in.";
  return null;
}
export const GARDEN_STAGES = [
  { name: "The Bare Field",     img: "https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/stage-01.png" },
  { name: "The First Sprouts",  img: "https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/stage-02.png" },
  { name: "The Young Garden",   img: "https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/stage-03.png" },
  { name: "The Blooming Patch", img: "https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/stage-04.png" },
  { name: "The Meadow",         img: "https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/stage-05.png" },
  { name: "The Thicket",        img: "https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/stage-06.png" },
  { name: "The Young Grove",    img: "https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/stage-07.png" },
  { name: "The Forest",         img: "https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/stage-08.png" },
  { name: "The Living World",   img: "https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/stage-09.png" },
  { name: "The Ancient Canopy", img: "https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/stage-10.png" },
];

export const MOUNTAIN_STAGES = [
  { name: "The Barren Summit",      img: "https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/forge/mountains/mount1.png" },
  { name: "The First Pine",         img: "https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/forge/mountains/mount2.png" },
  { name: "The Alpine Trail",       img: "https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/forge/mountains/mount3.png" },
  { name: "The Mountain Stream",    img: "https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/forge/mountains/mount4.png" },
  { name: "The Rising Peak",        img: "https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/forge/mountains/mount5.png" },
  { name: "The Alpine Lake",        img: "https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/forge/mountains/mount6.png" },
  { name: "The Summit Path",        img: "https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/forge/mountains/mount7.png" },
  { name: "The Sacred Peak",        img: "https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/forge/mountains/mount8.png" },
  { name: "The Enlightened Summit", img: "https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/forge/mountains/mount9.png" },
  { name: "The Celestial Peak",     img: "https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/forge/mountains/mount10.png" },
];

function ForestMomentum({ tracks, user, isPaused = false, islandTheme = 'garden' }: { tracks: UserTrack[]; user?: { name: string }; isPaused?: boolean; islandTheme?: 'garden' | 'mountain' }) {
  const { t } = useTranslation();
  const THRESHOLDS = [0, 5, 12, 25, 50, 90, 150, 230, 330, 450];
  const STAGES = islandTheme === 'mountain' ? MOUNTAIN_STAGES : GARDEN_STAGES;
  const total = tracks.reduce((s, t) => s + (t.total_done ?? 0), 0);
  let stageIndex = 0;
  for (let i = THRESHOLDS.length - 1; i >= 0; i--) {
    if (total >= THRESHOLDS[i]) { stageIndex = i; break; }
  }
  const [justUnlocked, setJustUnlocked] = useState(false);
  const prevStageRef = useRef<number>(stageIndex);
  useEffect(() => {
    if (stageIndex > prevStageRef.current) {
      setJustUnlocked(true);
      const t = setTimeout(() => setJustUnlocked(false), 10000);
      prevStageRef.current = stageIndex;
      return () => clearTimeout(t);
    }
    prevStageRef.current = stageIndex;
  }, [stageIndex]);
  const [showClaim, setShowClaim] = useState(false);
  const stage = STAGES[stageIndex] ?? STAGES[0];
  const { name, img } = stage;
  const shareIsland = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080; canvas.height = 1920;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#060c18';
    ctx.fillRect(0, 0, 1080, 1920);
    const glow = ctx.createRadialGradient(540, 1300, 0, 540, 1300, 900);
    glow.addColorStop(0, 'rgba(10,34,64,0.9)');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 1080, 1920);
    [[162,192],[810,153],[972,422],[378,346],[594,96],[86,672],[885,269],[648,538],[518,230],[240,450],[900,380]].forEach(([x,y]) => {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.2 + Math.random() * 0.4) + ')';
      ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
    });
    try {
      const resp = await fetch(img, { mode: 'cors' });
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      await new Promise<void>((resolve) => {
        const i = new Image();
        i.onload = () => { ctx.drawImage(i, 540 - 380, 440, 760, 760); URL.revokeObjectURL(blobUrl); resolve(); };
        i.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(); };
        i.src = blobUrl;
      });
    } catch { /* skip image on error */ }
    const pill = (px: number, py: number, pw: number, ph: number, pr: number, fill: string, stroke: string) => {
      ctx.beginPath();
      ctx.moveTo(px+pr,py); ctx.lineTo(px+pw-pr,py); ctx.quadraticCurveTo(px+pw,py,px+pw,py+pr);
      ctx.lineTo(px+pw,py+ph-pr); ctx.quadraticCurveTo(px+pw,py+ph,px+pw-pr,py+ph);
      ctx.lineTo(px+pr,py+ph); ctx.quadraticCurveTo(px,py+ph,px,py+ph-pr);
      ctx.lineTo(px,py+pr); ctx.quadraticCurveTo(px,py,px+pr,py); ctx.closePath();
      ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke();
    };
    pill(60, 80, 180, 54, 27, 'rgba(10,25,50,0.8)', '#1e3a5c');
    ctx.fillStyle = '#4a7ab5'; ctx.font = '500 24px -apple-system,system-ui,sans-serif';
    ctx.textAlign = 'left'; ctx.fillText('FORGE', 100, 117);
    const stageText = name.toUpperCase();
    ctx.font = '500 26px -apple-system,system-ui,sans-serif';
    const stageW = ctx.measureText(stageText).width + 60;
    pill(540 - stageW/2, 1220, stageW, 58, 29, 'rgba(10,40,20,0.8)', '#1a4a2a');
    ctx.fillStyle = '#3a8060'; ctx.textAlign = 'center'; ctx.fillText(stageText, 540, 1257);
    ctx.fillStyle = '#e8f0fe';
    ctx.font = (total >= 100 ? '700 200px' : '700 240px') + ' -apple-system,system-ui,sans-serif';
    ctx.fillText(String(total), 540, 1560);
    ctx.fillStyle = '#4a6a90'; ctx.font = '400 36px -apple-system,system-ui,sans-serif';
    ctx.fillText('DAYS ON STREAK', 540, 1620);
    const trackTitle = tracks[0]?.name || 'Your Journey';
    ctx.font = '400 30px -apple-system,system-ui,sans-serif';
    const trackW = ctx.measureText(trackTitle).width + 80;
    pill(540 - trackW/2, 1650, trackW, 64, 32, 'rgba(20,45,80,0.8)', '#1e3a5c');
    ctx.fillStyle = '#7aaed4'; ctx.fillText(trackTitle, 540, 1691);
    ctx.strokeStyle = '#1a2840'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(80, 1750); ctx.lineTo(1000, 1750); ctx.stroke();
    const done = tracks.length ? Math.round(tracks.reduce((s,t) => s + (t.total_done??0), 0) / Math.max(1, tracks.reduce((s,t) => s + (t.target_days??1), 0)) * 100) : 0;
    ctx.fillStyle = '#c8daf5'; ctx.font = '600 64px -apple-system,system-ui,sans-serif';
    ctx.fillText(done + '%', 270, 1850);
    ctx.fillStyle = '#3a5575'; ctx.font = '400 26px -apple-system,system-ui,sans-serif';
    ctx.fillText('DONE', 270, 1895);
    ctx.strokeStyle = '#1a2840'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(540, 1780); ctx.lineTo(540, 1910); ctx.stroke();
    ctx.fillStyle = '#c8daf5'; ctx.font = '600 64px -apple-system,system-ui,sans-serif';
    ctx.fillText('Stage ' + (stageIndex + 1), 810, 1850);
    ctx.fillStyle = '#3a5575'; ctx.font = '400 26px -apple-system,system-ui,sans-serif';
    ctx.fillText('ISLAND', 810, 1895);
    ctx.fillStyle = '#2a3d55'; ctx.font = '400 22px -apple-system,system-ui,sans-serif';
    ctx.textAlign = 'right'; ctx.fillText('FORGE-APP.COM', 1020, 1960);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], 'forge-day-' + total + '.png', { type: 'image/png' });
      if (navigator.share && (navigator as any).canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Day ' + total + ' on Forge' });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = 'forge-day-' + total + '.png'; a.click();
        URL.revokeObjectURL(url);
      }
    }, 'image/png');
  };

  return (
    <>
      {showClaim && <PrizeClaimModal userName={user?.name ?? ''} onClose={() => setShowClaim(false)} />}
      <div className="select-none w-full flex overflow-x-auto" style={{scrollbarWidth: 'none', msOverflowStyle: 'none', scrollSnapType: 'x mandatory', WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 18%, black 82%, transparent 100%)', maskImage: 'linear-gradient(to right, transparent 0%, black 18%, black 82%, transparent 100%)'}}>
        <div className="shrink-0 flex flex-col items-center pt-4 pb-3" style={{minWidth: '100%', scrollSnapAlign: 'start'}}>
          <div className="relative" style={{width: '400px', height: '400px'}}>
            <img src={img} alt={name} className={`object-contain${justUnlocked ? ' island-unlock-anim' : ''}`} style={{WebkitTouchCallout: 'none', userSelect: 'none', width: '400px', height: '400px'}} loading="eager"  onContextMenu={(e) => e.preventDefault()} draggable={false}/>
            {isPaused && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
                <div className="absolute inset-0 fog-layer-1"/>
                <div className="absolute inset-0 fog-layer-2"/>
              </div>
            )}
          </div>
          <p className="text-sm font-medium text-white/60 tracking-widest uppercase mt-2">{name}</p>
          <button
            onClick={shareIsland}
            className="flex items-center gap-1.5 text-xs text-white/70 hover:text-white/90 transition-colors mt-3 px-4 py-2 rounded-full bg-white/8 border border-white/25 hover:bg-white/12 active:scale-95 font-medium"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
{t("home.share_island")}
          </button>
          {isPaused && (
            <div className="flex flex-col items-center gap-2 mt-3 px-6">
              <p className="text-sm text-white/50 text-center">Your island is waiting at <span className="font-medium text-white/80">day {total}</span></p>
<button className="text-xs font-medium px-5 py-2 rounded-full border border-white/20 text-white/70 bg-white/5 active:bg-white/10 transition-colors">{t("home.reactivate_plan")}</button>
            </div>
          )}
          {stageIndex === 9 && (
          <>
<p className="text-sm font-semibold text-white/80 mt-3 text-center">{t("home.final_stage_title")}</p>
<p className="text-xs text-white/50 mt-1 text-center mb-3">{t("home.final_stage_body")}</p>
<button onClick={() => setShowClaim(true)} className="px-5 py-2 rounded-full bg-emerald-600 text-white text-xs font-semibold tracking-wide">{t("home.claim_prize")}</button>
          </>
          )}
        </div>
        {STAGES.slice(stageIndex + 1).map((s, i) => {
          const needed = THRESHOLDS[stageIndex + 1 + i] - total;
          return (
            <div key={s.name} className="shrink-0 flex flex-col items-center pt-4 pb-3 pl-6" style={{minWidth: 'calc(100% - 60px)', scrollSnapAlign: 'start'}}>
              <div className="relative">
                <img src={s.img} alt={s.name} className="object-contain" style={{WebkitTouchCallout: 'none', userSelect: 'none', width: '300px', height: '300px', filter: 'grayscale(1) brightness(0.18)'}} loading="lazy"  onContextMenu={(e) => e.preventDefault()} draggable={false}/>
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
              </div>
              <p className="text-sm text-white/20 tracking-widest uppercase mt-2">{s.name}</p>
              <p className="text-xs text-white/35 mt-1">{needed} check-in{needed !== 1 ? 's' : ''} to unlock</p>
            </div>
          );
        })}
      </div>
    </>
  );
}
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

const TRACK_SAVINGS: Record<string, TrackSavings> = {
  "quit-alcohol": {
    costPerUnit: 7,
    unitName: "drink",
    unitNamePlural: "drink",
    emoji: "🍺",
  },
  "quit-pornography": {
    costPerUnit: 0,
    unitName: "sessione",
    unitNamePlural: "sessioni",
    emoji: "🧠",
  },
  "quit-drugs": {
    costPerUnit: 20,
    unitName: "dose",
    unitNamePlural: "dosi",
    emoji: "💊",
  },
  "quit-gambling": {
    costPerUnit: 30,
    unitName: "sessione",
    unitNamePlural: "sessioni",
    emoji: "🎲",
  },
  "binge-eating": {
    costPerUnit: 12,
    unitName: "binge",
    unitNamePlural: "binge",
    emoji: "🍕",
  },
  "video-game-addiction": {
    costPerUnit: 0,
    unitName: "sessione",
    unitNamePlural: "sessioni",
    emoji: "🎮",
  },
  "compulsive-shopping": {
    costPerUnit: 45,
    unitName: "acquisto",
    unitNamePlural: "acquisti",
    emoji: "🛍️",
  },
  "social-media-addiction": {
    costPerUnit: 0,
    unitName: "ora",
    unitNamePlural: "ore",
    emoji: "📵",
  },
};

function SavingsCard({ tracks }: { tracks: UserTrack[] }) {
  const primaryTrack = tracks[0];
  if (!primaryTrack) return null;

  const savings = TRACK_SAVINGS[primaryTrack.slug];
  if (!savings) return null;

  const totalDays = primaryTrack.total_done ?? 0;
  const totalMoney = savings.costPerUnit > 0 ? totalDays * savings.costPerUnit : 0;
  const totalUnits = totalDays;

  const animMoney = useCountUp(totalMoney);
  const animUnits = useCountUp(totalUnits);

  if (totalDays < 1) return null;

  const showMoney = savings.costPerUnit > 0;

  return (
    <div
      className="mx-4 mb-4 rounded-2xl p-4 flex gap-3"
      style={{
        background: "oklch(0.14 0.04 145 / 0.5)",
        border: "1px solid oklch(0.35 0.12 145 / 0.3)",
      }}
    >
      {showMoney && (
        <div className="flex-1 flex flex-col items-center gap-0.5">
          <span
            className="text-2xl font-bold tabular-nums"
            style={{ color: "oklch(0.82 0.18 145)" }}
          >
            €{animMoney}
          </span>
          <span className="text-xs text-white/40">risparmiati</span>
        </div>
      )}

      {showMoney && (
        <div
          className="w-px self-stretch"
          style={{ background: "oklch(0.35 0.08 145 / 0.3)" }}
        />
      )}

      <div className="flex-1 flex flex-col items-center gap-0.5">
        <span
          className="text-2xl font-bold tabular-nums"
          style={{ color: "oklch(0.82 0.18 145)" }}
        >
          {animUnits}
        </span>
        <span className="text-xs text-white/40">
          {totalUnits === 1 ? savings.unitName : savings.unitNamePlural} {savings.costPerUnit === 0 ? "evitate" : "saltate"}
        </span>
      </div>

      <div
        className="w-px self-stretch"
        style={{ background: "oklch(0.35 0.08 145 / 0.3)" }}
      />

      <div className="flex-1 flex flex-col items-center gap-0.5">
        <span
          className="text-2xl font-bold tabular-nums"
          style={{ color: "oklch(0.82 0.18 145)" }}
        >
          {totalDays}
        </span>
        <span className="text-xs text-white/40">
          {totalDays === 1 ? "giorno" : "giorni"} puliti
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

// CheckInRichModal removed — use src/components/CheckInModal.tsx
interface SnowflakeData { id: number; size: number; left: number; dur: number; opacity: number; }

function SnowfallBackground({ count = 45, speed = 1 }: { count?: number; speed?: number }) {
  const [flakes, setFlakes] = useState<SnowflakeData[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setFlakes(Array.from({ length: count }, (_, i) => ({
      id: i, size: Math.random() * 14 + 7,
      left: Math.random() * 100,
      dur: (Math.random() * 5 + 4) / speed,
      opacity: Math.random() * 0.65 + 0.25,
    })));
    setReady(true);
  }, [count, speed]);
  useEffect(() => {
    if (!ready || flakes.length === 0) return;
    const style = document.createElement("style");
    style.innerHTML = flakes.map(f => {
      const wx = Math.random() * 80 - 40;
      return `@keyframes sf${f.id}{0%{transform:translateY(-8vh) translateX(0) rotate(0deg)}100%{transform:translateY(108vh) translateX(${wx}px) rotate(360deg)}}`;
    }).join("");
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, [flakes, ready]);
  if (!ready) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {flakes.map(f => (
        <div key={f.id} className="absolute select-none"
          style={{ left: `${f.left}%`, top: 0, fontSize: `${f.size}px`, opacity: f.opacity,
            color: "#b8e0ff", animation: `sf${f.id} ${f.dur}s linear infinite`,
            textShadow: "0 0 6px rgba(180,220,255,0.95)" }}>❄</div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VacationModal
// ─────────────────────────────────────────────────────────────────────────────

function VacationModal({ track, onSave, onClose }: {
  track: UserTrack;
  onSave: (until: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [days, setDays] = useState(3);
  const [customDays, setCustomDays] = useState("");
  const activeDays = customDays !== "" ? Math.max(1, Math.min(90, parseInt(customDays) || 1)) : days;
  const until = new Date(Date.now() + activeDays * 86_400_000).toISOString().slice(0, 10);
  const isActive = track.vacation_until && track.vacation_until >= todayStr();

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0" style={{backdropFilter:'blur(12px) saturate(160%)', WebkitBackdropFilter:'blur(12px) saturate(160%)', background:'oklch(0 0 0 / 0.45)'}}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="w-full max-w-sm rounded-3xl p-6" style={{background:'oklch(0.96 0 0 / 0.14)', backdropFilter:'blur(40px) saturate(200%)', WebkitBackdropFilter:'blur(40px) saturate(200%)', border:'1px solid oklch(1 0 0 / 0.25)', boxShadow:'0 24px 60px oklch(0 0 0 / 0.45)'}}
        onClick={e => e.stopPropagation()}>
<p className="text-[10px] uppercase tracking-[0.3em] font-mono text-muted-foreground mb-2">{t("home.vacation_mode")}</p>
<h3 className="font-display text-xl mb-1">{t("home.protect_streak")}</h3>
        <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
{t("home.vacation_body")}
        </p>
        {isActive ? (
          <>
            <div className="rounded-2xl bg-[color:var(--tertiary)]/10 border border-[color:var(--tertiary)]/20 p-4 mb-4 text-center">
              <p className="text-sm font-semibold text-[color:var(--tertiary)]">Pause active until {track.vacation_until}</p>
            </div>
            <div className="flex gap-3">
<button onClick={onClose} className="flex-1 rounded-full border border-border px-4 py-2.5 text-sm font-medium">{t("common.close")}</button>
              <button onClick={() => { onSave(""); onClose(); }}
className="flex-1 btn-chunk rounded-full bg-[color:var(--secondary)] text-white px-4 py-2.5 text-sm font-semibold">
                {t("home.end_pause")}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Quick presets */}
            <div className="flex gap-2 mb-3">
              {[3, 7, 14].map(d => (
                <button key={d} onClick={() => { setDays(d); setCustomDays(""); }}
                  className={`flex-1 rounded-xl border py-3 text-sm font-semibold transition btn-chunk ${customDays === "" && days === d ? "bg-foreground text-neutral-900 border-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
                  {d}g
                </button>
              ))}
            </div>
            {/* Custom days */}
            <div className="flex items-center gap-2 mb-5">
              <input
                type="number" min={1} max={90}
                value={customDays}
                onChange={e => setCustomDays(e.target.value)}
                placeholder="Custom days…"
                className="flex-1 rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-foreground/30 transition"
              />
              {customDays !== "" && <span className="text-xs text-muted-foreground font-mono shrink-0">days</span>}
            </div>
            <p className="text-xs text-muted-foreground text-center mb-5 font-mono">
              Streak protected until <span className="text-foreground">{until}</span>
            </p>
            <div className="flex gap-3">
<button onClick={onClose} className="flex-1 rounded-full border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground">{t("common.cancel")}</button>
              <button onClick={() => { onSave(until); onClose(); }}
className="flex-1 btn-chunk rounded-full bg-foreground text-neutral-900 px-4 py-2.5 text-sm font-semibold">
                {t("home.pause_streak")}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MissedAccessModal
// ─────────────────────────────────────────────────────────────────────────────

function MissedAccessModal({ tracks, onClose }: { tracks: UserTrack[]; onClose: () => void }) {
  const { t } = useTranslation();
  const [message, setMessage] = useState("");
  const [track, setTrack] = useState(tracks[0]?.name ?? "");
  const [phase, setPhase] = useState<"form" | "sending" | "done">("form");

  const submit = async () => {
    if (!message.trim()) return;
    setPhase("sending");
    try {
      await fetch("/api/report-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          trackName: track,
          date: todayStr(),
        }),
      });
    } catch { /* best-effort */ }
    setPhase("done");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
      style={{ background: "oklch(0 0 0 / 0.65)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="w-full max-w-sm rounded-3xl p-6" style={{background:'oklch(0.12 0.02 248 / 0.85)', backdropFilter:'blur(40px) saturate(180%)', WebkitBackdropFilter:'blur(40px) saturate(180%)', border:'1px solid oklch(1 0 0 / 0.18)', boxShadow:'0 24px 60px oklch(0 0 0 / 0.5)'}}
      >
        {phase === "done" ? (
          <div className="text-center py-4">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-[color:var(--tertiary)]/15 flex items-center justify-center">
              <Check className="h-6 w-6 text-[color:var(--tertiary)]" />
            </div>
<p className="font-display text-lg mb-1">{t("home.feedback_sent")}</p>
<p className="text-sm text-muted-foreground">{t("home.feedback_sent_body")}</p>
            <button onClick={onClose} className="mt-5 btn-chunk rounded-full bg-foreground text-neutral-900 px-6 py-2.5 text-sm font-semibold">
              Chiudi
            </button>
          </div>
        ) : (
          <>
            <p className="text-[10px] uppercase tracking-[0.3em] font-mono text-muted-foreground mb-2">Feedback</p>
<h3 className="font-display text-xl mb-1">{t("home.feedback_title")}</h3>
            <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
              Se hai avuto problemi ad aprire l'app, raccontaci cosa è successo. Ci aiuta a migliorare.
            </p>

            {tracks.length > 1 && (
              <div className="mb-3">
                <label className="text-[10px] uppercase tracking-[0.2em] font-mono text-muted-foreground block mb-1.5">Track</label>
                <select
                  value={track}
                  onChange={e => setTrack(e.target.value)}
                  className="w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-foreground"
                >
                  {tracks.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                </select>
              </div>
            )}

            <label className="text-[10px] uppercase tracking-[0.2em] font-mono text-muted-foreground block mb-1.5">Cosa è successo?</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="e.g. no connection, app wouldn't open..."
              rows={3}
              className="w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground resize-none mb-4"
            />

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 rounded-full border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition">
  {t("common.cancel")}
              </button>
              <button
                onClick={submit}
                disabled={!message.trim() || phase === "sending"}
                className="flex-1 btn-chunk rounded-full bg-foreground text-neutral-900 px-4 py-2.5 text-sm font-semibold disabled:opacity-40 transition"
              >
  {phase === "sending" ? t("common.sending") : t("common.send")}
              </button>
            </div>

            <p className="mt-3 text-center text-[10px] text-emerald-500/70 font-mono">
              Inviato privatamente al team Forge.
            </p>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

export function HomePage({ user, tracks, onCheckIn, onNavigate, onUpdateUser, onView, onViewForCheckIn, onVacation }: {
  user: ElevateUser;
  tracks: UserTrack[];
  onCheckIn: (id: string) => void;
  onNavigate: (page: AppPage) => void;
  onUpdateUser: (patch: Partial<ElevateUser>) => void;
  onView: (t: UserTrack) => void;
  onViewForCheckIn: (t: UserTrack) => void;
  onVacation: (trackId: string, until: string) => void;
}) {
  const { t } = useTranslation();
  const [showMissedModal, setShowMissedModal] = useState(false);
  const [vacationTrack, setVacationTrack] = useState<UserTrack | null>(null);
  const [noteOpen, setNoteOpen] = useState<Record<string, boolean>>({});
  const [noteText, setNoteText] = useState<Record<string, string>>({});
  const [noteError, setNoteError] = useState<Record<string, string>>({});
  const [noteSubmitted, setNoteSubmitted] = useState<Record<string, boolean>>({});

  // Proactive coach nudge (once per session, after auth)
  const { nudge: coachNudge, dismiss: dismissCoachNudge } = useCoachNudge(
    user.supabaseId,
    undefined, // token fetched internally by the hook via supabase.auth.getSession()
  );

  // Load today's saved quick-notes from localStorage on mount / when tracks change
  useEffect(() => {
    const today = todayStr();
    const loadedText: Record<string, string> = {};
    const autoOpen: Record<string, boolean> = {};
    const autoSubmitted: Record<string, boolean> = {};
    tracks.forEach(ut => {
      const saved = lsLoad<string>(`forge-quick-note-${ut.id}-${today}`, "");
      loadedText[ut.id] = saved;
      if (saved) { autoSubmitted[ut.id] = true; }
      // Never auto-open the textarea on home load
    });
    setNoteText(loadedText);
    setNoteOpen(prev => ({ ...prev, ...autoOpen }));
    setNoteSubmitted(autoSubmitted);
  }, [tracks.length]);

  const saveNote = (trackId: string, text: string) => {
    const today = todayStr();
    lsSave(`forge-quick-note-${trackId}-${today}`, text);
    setNoteText(prev => ({ ...prev, [trackId]: text }));
  };

  const toggleNote = (trackId: string) => {
    setNoteOpen(prev => ({ ...prev, [trackId]: !prev[trackId] }));
  };

  const motivation = useMemo(() => {
    const d = new Date();
    const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    return MOTIVATIONS[seed % MOTIVATIONS.length];
  }, []);

  const todayDate = todayStr();
  const todayFormatted = new Date().toLocaleDateString('en-US', { weekday: "long", month: "long", day: "numeric" }).toUpperCase();
  const hour = new Date().getHours();
  const greeting = hour < 5 ? t("home.greeting_evening") : hour < 12 ? t("home.greeting_morning") : hour < 18 ? t("home.greeting_afternoon") : t("home.greeting_evening");
  const islandTheme = (localStorage.getItem('forge_island_theme') ?? 'garden') as 'garden' | 'mountain';
              const isPaused = user?.subscriptionStatus === 'paused';
  const firstName = user.name.split(" ")[0];

  return (
    <div className="relative">
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
        <>
        <ForestMomentum tracks={tracks} user={user} islandTheme={islandTheme} isPaused={isPaused} />
        <SavingsCard tracks={tracks} />
        </>
      )}

      {coachNudge && (
        <CoachNudge
          nudge={coachNudge}
          onDismiss={dismissCoachNudge}
          onCta={(route) => { dismissCoachNudge(); onNavigate(route as AppPage); }}
        />
      )}

      <div className="flex items-end justify-between mb-4">
        <h2 className="font-display text-2xl tracking-tight">{t("home.your_paths")}</h2>
        {tracks.length > 0 && (
          <button onClick={() => onNavigate("tracks")}
            className="btn-chunk inline-flex items-center gap-1.5 rounded-full bg-[color:var(--primary)] text-primary-foreground px-3.5 py-2 text-xs font-semibold"
            style={{ boxShadow: "var(--shadow-violet)" }}>
            <Plus className="h-3.5 w-3.5" /> {t("common.add")}
          </button>
        )}
      </div>

      {tracks.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="mb-10 rounded-[20px] border-2 border-dashed border-[color:var(--primary)]/25 p-8 text-center">
          <div className="mx-auto mb-4 h-14 w-14 rounded-2xl grad-electric flex items-center justify-center opacity-80">
            <Target className="h-7 w-7 text-white" />
          </div>
          <h3 className="font-display text-lg mb-1">{t("home.no_paths_title")}</h3>
          <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto">
{t("home.no_paths_body")}
          </p>
          <button onClick={() => onNavigate("tracks")}
            className="btn-chunk inline-flex items-center gap-2 rounded-full bg-foreground text-neutral-900 px-6 py-2.5 text-sm font-semibold"
            style={{ boxShadow: "var(--shadow-violet)" }}>
{t("common.browse_tracks")}
          </button>
        </motion.div>
      ) : (
      <div className="-mx-5 px-5 overflow-x-auto no-scrollbar mb-10">
        <div className="flex gap-4 pb-2 snap-x snap-mandatory">
          {tracks.map((ut, i) => {
            const hueVar = trackHueVar(ut.category);
            const grad = trackHueGradient(ut.slug);
            const target = Math.max(1, ut.target_days ?? 30);
            const pct = Math.min(100, Math.round(((ut.current_streak ?? 0) / target) * 100));
            const doneToday = ut.last_log_date === todayDate;
            return (
              <motion.div key={ut.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + i * 0.05, type: "spring", stiffness: 90, damping: 16 }}>
                {(() => {
                  const onVacCard = ut.vacation_until && ut.vacation_until >= todayDate;
                  return (
                    <div className="snap-start w-[260px] h-[340px] rounded-[20px] p-5 relative overflow-hidden btn-chunk cursor-pointer"
                      onClick={() => onView(ut)}
                      style={{ background: grad.replace(/oklch\((\S+ \S+ \S+)\)/g, 'oklch($1 / 0.75)'), backdropFilter: "blur(20px) saturate(160%)", WebkitBackdropFilter: "blur(20px) saturate(160%)", border: "1px solid oklch(1 0 0 / 0.15)", boxShadow: "0 20px 44px -12px oklch(0 0 0 / 0.55), 0 4px 12px -4px oklch(0 0 0 / 0.3)" }}>
                      {/* Normal card content — blurred when frozen */}
                      <div className={onVacCard ? "blur-[2px] pointer-events-none" : ""}>
                        <div aria-hidden className="absolute -right-12 -bottom-12 h-56 w-56 rounded-full opacity-50 blur-2xl"
                          style={{ background: "radial-gradient(circle, oklch(1 0 0 / 0.5), transparent 60%)" }} />
                        <div aria-hidden className="absolute right-3 top-3 h-20 w-20 rounded-full opacity-70"
                          style={{ background: "radial-gradient(circle, oklch(1 0 0 / 0.35), transparent 70%)" }} />
                        <div className="relative flex items-start justify-between pt-2">
                          <span className="text-[10px] uppercase tracking-[0.25em] text-white font-mono">{ut.category}</span>
                          <ArcRing value={pct} color="oklch(1 0 0 / 0.85)" size={56} />
                        </div>
                        <div className="relative mt-auto pt-12">
                          <p className="text-[10px] uppercase tracking-[0.3em] text-white font-mono">{(ut.total_done ?? 0) >= (ut.target_days ?? 30) ? "Done" : "Day"}</p>
                          <p className="font-display text-[5.5rem] leading-[0.85] tracking-[-0.05em] text-white"><SlotNumber value={liveStreak(ut) === 0 && (ut.total_done ?? 0) === 0 ? 1 : liveStreak(ut)} /></p>
                          {(ut.total_done ?? 0) >= (ut.target_days ?? 30) && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-400/20 border border-yellow-400/40 px-2 py-0.5 text-[9px] font-bold text-yellow-300 uppercase tracking-widest mt-1">
                              ✓ Completed
                            </span>
                          )}
                          {(() => { const gd = ghostDayFor(ut); const gap = gd - (ut.total_done || 0); return gap > 1 ? (
                            <p className="mt-0.5 text-[9px] font-mono text-white/35 tracking-[0.15em] uppercase">Ghost +{gap}d ahead</p>
                          ) : null; })()}
                          <h3 className="mt-3 font-display text-xl text-white leading-tight line-clamp-2">{ut.name}</h3>
                          {(() => {
                            const jDays = lsLoad<JourneyDay[]>(LS_DAYS(ut.slug), []);
                            const todayTask = jDays.find(d => d.completedAt === null) ?? jDays[jDays.length - 1];
                            const taskTitle = todayTask?.title;
                            const isGeneric = !taskTitle || taskTitle.startsWith("Day ");
                            return !isGeneric ? (
                              <p className="mt-1.5 text-[11px] text-white/70 leading-snug line-clamp-2 italic">
                                "{taskTitle}"
                              </p>
                            ) : null;
                          })()}
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            {liveStreak(ut) === 0 && !doneToday && (ut.total_done ?? 0) === 0 ? (
                              <button onClick={() => onView(ut)}
                                className="inline-flex items-center gap-1.5 rounded-full grad-electric px-3 py-1.5 text-[11px] font-bold text-white shadow-[var(--shadow-violet)] hover:opacity-90 transition-opacity">
{t("home.start_day_1")} <ArrowRight className="h-3 w-3" />
                              </button>
                            ) : liveStreak(ut) === 0 && !doneToday && (ut.total_done ?? 0) > 0 ? (
                              <p className="text-[10px] font-mono text-white/45 leading-snug">
  {t("home.no_problem")}
                              </p>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 rounded-full bg-black px-2.5 py-1 text-[11px] text-white">
                                <Flame className="h-3 w-3 flame text-[color:var(--highlight)]" />
                                <span className="font-mono">{liveStreak(ut)}</span>
    <span>{t("common.streak")}</span>
                              </div>
                            )}
                            {doneToday && (
                              <div className="inline-flex items-center gap-1 rounded-full bg-[color:var(--tertiary)] px-2.5 py-1 text-[11px] text-white font-semibold">
                                <Check className="h-3 w-3" /> Done
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Frozen overlay */}
                      {onVacCard && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-[20px]"
                          style={{ background: "oklch(0.13 0.08 220 / 0.82)" }}>
                          <SnowfallBackground count={22} speed={0.75} />
                          <div className="relative z-10 text-center pointer-events-none">
                            <p className="font-display text-4xl font-bold text-white tracking-tight"
                              style={{ textShadow: "0 0 28px rgba(160,215,255,0.7)" }}>
                              Freezed
                            </p>
                            <p className="text-white/50 text-[10px] font-mono mt-1.5 tracking-widest uppercase">
                              until {ut.vacation_until}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </motion.div>
            );
          })}
          <button onClick={() => onNavigate("tracks")}
            className="snap-start flex flex-col items-center justify-center w-[200px] h-[340px] rounded-[20px] border-2 border-dashed border-[color:var(--primary)]/40 text-muted-foreground hover:border-[color:var(--primary)] hover:text-foreground transition btn-chunk">
            <Plus className="h-8 w-8 mb-2" />
<span className="text-sm font-medium">{t("common.new_path")}</span>
          </button>
        </div>
      </div>
      )}

      <h2 className="font-display text-2xl tracking-tight mb-4">{t("home.todays_actions")}</h2>
      <div className="space-y-2.5">
        {tracks.map(ut => {
          const hueVar = trackHueVar(ut.category);
          const doneToday = ut.last_log_date === todayDate;
          return (
            <div key={ut.id} className="rounded-2xl depth-card overflow-hidden relative">
              {/* Frozen overlay on row */}
              {ut.vacation_until && ut.vacation_until >= todayDate && (
                <div className="absolute inset-0 z-10 flex items-center justify-between px-4 rounded-2xl overflow-hidden"
                  style={{ background: "oklch(0.13 0.08 220 / 0.88)" }}>
                  <SnowfallBackground count={12} speed={0.7} />
                  <div className="relative z-10 flex items-center gap-2">
                    <div className="h-12 w-12 rounded-2xl flex items-center justify-center text-white/30 font-display text-base shrink-0 blur-[1px]"
                      style={{ background: trackHueGradient(ut.slug) }}>
                      {ut.name.slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.25em] font-mono" style={{ color: "#b8e0ff" }}>Freezed</p>
                      <p className="font-semibold text-[15px] text-white/80 truncate">{ut.name}</p>
                    </div>
                  </div>
                  <button onClick={() => setVacationTrack(ut)}
                    className="relative z-10 shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition"
                    style={{ borderColor: "oklch(0.55 0.1 220 / 0.5)", color: "#b8e0ff", background: "oklch(0.2 0.08 220 / 0.6)" }}>
                    ❄ until {ut.vacation_until}
                  </button>
                </div>
              )}
              <div className="flex items-center gap-4 p-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="h-12 w-12 rounded-2xl flex items-center justify-center text-white font-display text-base shrink-0"
                    style={{ background: trackHueGradient(ut.slug), boxShadow: "0 6px 16px -4px oklch(0 0 0 / 0.5)" }}>
                    {ut.name.slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.25em] font-mono" style={{ color: `var(${hueVar})` }}>{ut.category}</p>
                    <p className="font-semibold text-[15px] truncate">{ut.name}</p>
                  </div>
                </div>
                {(() => {
                  const onVac = ut.vacation_until && ut.vacation_until >= todayDate;
                  if (doneToday) return (
                    <div className="shrink-0 flex items-center gap-2">
                      <button onClick={() => setVacationTrack(ut)}
                        className="rounded-full border border-border px-2.5 py-2 text-xs text-muted-foreground hover:text-foreground transition btn-chunk"
                        title="Pause streak">
                        <Sun className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => toggleNote(ut.id)}
                        className={`rounded-full border px-2 py-2 text-xs transition btn-chunk ${noteOpen[ut.id] ? "border-foreground/30 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
                        title="Quick note">
                        <PenLine className="h-3.5 w-3.5" />
                      </button>
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--tertiary)]/15 text-[color:var(--tertiary)] px-3.5 py-2 text-xs font-semibold">
                        <Check className="h-3.5 w-3.5" /> Done
                      </div>
                    </div>
                  );
                  if (onVac) return (
                    <button onClick={() => setVacationTrack(ut)}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition"
                      style={{ background: "oklch(0.18 0.07 220 / 0.9)", borderColor: "oklch(0.55 0.1 220 / 0.4)", color: "#b8e0ff" }}>
                      ❄ Freezed
                    </button>
                  );
                  return (
                    <div className="shrink-0 flex items-center gap-2">
                      <button onClick={() => setVacationTrack(ut)}
                        className="rounded-full border border-border px-2.5 py-2 text-xs text-muted-foreground hover:text-foreground transition btn-chunk"
                        title="Pause streak">
                        <Sun className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => toggleNote(ut.id)}
                        className={`rounded-full border px-2 py-2 text-xs transition btn-chunk ${noteOpen[ut.id] ? "border-foreground/30 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
                        title="Quick note">
                        <PenLine className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => onViewForCheckIn(ut)}
                        className="btn-chunk rounded-full bg-foreground text-neutral-900 px-3.5 py-2 text-xs font-semibold transition"
                        aria-label={`Check in for ${ut.name}`}>
                        {t("home.check_in")}
                      </button>
                    </div>
                  );
                })()}
              </div>
              {/* Quick check-in — inline, animated */}
              <AnimatePresence>
                {noteOpen[ut.id] && (
                  <motion.div
                    key="note"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden">
                    <div className="border-t border-border/40 px-4 pb-4 pt-3 space-y-2.5">
                      {/* Title */}
                      <p className="text-[10px] uppercase tracking-[0.25em] font-mono text-muted-foreground">
{t("home.quick_checkin_label")}
                      </p>
                      {/* Today's task as context */}
                      {(() => {
                        const jDays = lsLoad<JourneyDay[]>(LS_DAYS(ut.slug), []);
                        const activeDay = jDays.find(d => d.completedAt === null) ?? null;
                        return activeDay ? (
                          <p className="text-[11px] text-muted-foreground/70 leading-snug border-l-2 border-border pl-2.5 line-clamp-4">
                            {activeDay.task}
                          </p>
                        ) : null;
                      })()}
                      {/* Read-only note (after submit) */}
                      {noteSubmitted[ut.id] ? (
                        <div className="space-y-2">
                          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                            {noteText[ut.id]}
                          </p>
                          <button
                            onClick={() => setNoteSubmitted(prev => ({ ...prev, [ut.id]: false }))}
                            className="text-[11px] font-mono text-muted-foreground hover:text-foreground transition underline underline-offset-2">
                            {t("home.edit_note")}
                          </button>
                        </div>
                      ) : (
                        <>
                          {/* Textarea */}
                          <motion.div
                            animate={noteError[ut.id] ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
                            transition={{ duration: 0.3 }}>
                            <textarea
                              value={noteText[ut.id] ?? ""}
                              onChange={e => {
                                setNoteText(prev => ({ ...prev, [ut.id]: e.target.value }));
                                if (noteError[ut.id]) setNoteError(prev => ({ ...prev, [ut.id]: "" }));
                              }}
placeholder={t("home.quick_note_placeholder")}
                              className={`w-full bg-muted/40 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 resize-none outline-none leading-relaxed border transition ${noteError[ut.id] ? "border-[color:var(--secondary)]" : "border-border/50 focus:border-foreground/30"}`}
                              rows={3}
                              autoFocus
                            />
                          </motion.div>
                          {/* Error */}
                          <AnimatePresence>
                            {noteError[ut.id] && (
                              <motion.p
                                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                className="text-[11px] text-[color:var(--secondary)] font-mono">
                                {noteError[ut.id]}
                              </motion.p>
                            )}
                          </AnimatePresence>
                          {/* Actions */}
                          <div className="flex items-center justify-between pt-0.5">
                            <button
                              onClick={() => { toggleNote(ut.id); setNoteError(prev => ({ ...prev, [ut.id]: "" })); }}
                              className="text-xs text-muted-foreground hover:text-foreground transition font-mono">
                              {t("common.cancel")}
                            </button>
                            <button
                              onClick={() => {
                                const text = (noteText[ut.id] ?? "").trim();
                                const err = validateQuickNote(text);
                                if (err) { setNoteError(prev => ({ ...prev, [ut.id]: err })); return; }
                                // Complete the active journey day → advances to next day
                                const jDays = lsLoad<JourneyDay[]>(LS_DAYS(ut.slug), []);
                                const activeDayIdx = jDays.findIndex(d => d.completedAt === null);
                                if (activeDayIdx !== -1) {
                                  const updatedDays = jDays.map((d, i) =>
                                    i === activeDayIdx
                                      ? { ...d, completedAt: new Date().toISOString(), userNote: text }
                                      : d
                                  );
                                  lsSave(LS_DAYS(ut.slug), updatedDays);
                                }
                                saveNote(ut.id, text);
                                if (!doneToday) onCheckIn(ut.id);
                                setNoteSubmitted(prev => ({ ...prev, [ut.id]: true }));
                                setNoteError(prev => ({ ...prev, [ut.id]: "" }));
                              }}
                              className="btn-chunk rounded-full bg-foreground text-neutral-900 px-4 py-1.5 text-xs font-semibold transition hover:opacity-80">
                              {t("home.submit_note")}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Missed access nudge — only when at least one track is behind */}
      {tracks.length > 0 && tracks.some(tr => liveStreak(tr) === 0 && tr.last_log_date !== todayDate) && (
        <div className="mt-8 text-center">
          <button
            onClick={() => setShowMissedModal(true)}
            className="text-[11px] text-muted-foreground hover:text-foreground transition underline underline-offset-2 font-mono"
          >
{t("home.missed_streak")}
          </button>
        </div>
      )}

      <AnimatePresence>
        {showMissedModal && (
          <MissedAccessModal tracks={tracks} onClose={() => setShowMissedModal(false)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {vacationTrack && (
          <VacationModal
            track={vacationTrack}
            onSave={(until) => { onVacation(vacationTrack.id, until); }}
            onClose={() => setVacationTrack(null)}
          />
        )}
      </AnimatePresence>
    </div>
    </div>
  );
}
