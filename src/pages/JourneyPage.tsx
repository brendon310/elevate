import { useState, useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../supabase";
import * as db from "../db";
import type { UserTrack, Journey, JourneyDay, ChatMessage, CommunityPost } from "../types";
import confetti from 'canvas-confetti';
import { Flame, Sparkles, ChevronLeft, Zap, CheckCircle2, Check, Trophy, Lock, RefreshCw } from 'lucide-react';

const ADAPT_REASON_IDS = ["busy", "motivation", "overwhelmed", "sick", "travel", "other"] as const;
const ADAPT_REASONS = ADAPT_REASON_IDS.map(id => ({ id }));
type AdaptReasonId = typeof ADAPT_REASON_IDS[number];

// Post check-in micro-reactions per archetype (no API call — instant dopamine)
const COACH_FLASH: Record<string, string[]> = {
  Kai: [
    "Logged. That's the rep that matters.",
    "Good. Same time tomorrow.",
    "Consistency is the only strategy that works.",
    "One more day in the bank.",
    "You're building something real here.",
  ],
  Iris: [
    "Filed. Your brain noticed that.",
    "Patterns form one day at a time. This was one.",
    "Noted. Progress is quieter than you think.",
    "Every check-in is a data point in your favor.",
    "You're learning something today, even if it's subtle.",
  ],
  "Dr. Mara": [
    "I see you showing up. That takes courage.",
    "You came back. That's the whole work.",
    "Good. Now rest in that for a moment.",
    "Each day you return, the path widens.",
    "That took something from you. It was worth it.",
  ],
  Roy: [
    "Done. Stack another one tomorrow.",
    "Execution noted. Systems compound.",
    "That's leverage. Keep going.",
    "One more proof point that you do what you say.",
    "The gap closes a little more today.",
  ],
  Sasha: [
    "That was a ritual. Honor it.",
    "You deepened the groove today.",
    "The work you do in the dark shows up in the light.",
    "Something shifted. You may not feel it yet.",
    "The journey recognizes your return.",
  ],
};

const LS_DAYS = (slug: string) => `forge-days-${slug}`;
const LS_JOURNEY = (slug: string) => `forge-journey-${slug}`;
const LS_CHAT = (slug: string) => `forge-chat-${slug}`;
// Community content moderation — stems catch conjugations and variants
const COACH_PROMPT_KEYS: Record<string, string[]> = {
  trainer:   ["coach.prompts.trainer_1","coach.prompts.trainer_2","coach.prompts.trainer_3","coach.prompts.trainer_4"],
  clinician: ["coach.prompts.clinician_1","coach.prompts.clinician_2","coach.prompts.clinician_3","coach.prompts.clinician_4"],
  mentor:    ["coach.prompts.mentor_1","coach.prompts.mentor_2","coach.prompts.mentor_3","coach.prompts.mentor_4"],
  teacher:   ["coach.prompts.teacher_1","coach.prompts.teacher_2","coach.prompts.teacher_3","coach.prompts.teacher_4"],
  guide:     ["coach.prompts.guide_1","coach.prompts.guide_2","coach.prompts.guide_3","coach.prompts.guide_4"],
};

const DURATION_PRESETS = [30, 60, 90, 120, 180, 365] as const;

const JOURNEY_MILESTONES = [1, 3, 7, 14, 21, 30, 60, 90, 180, 365];

const JOURNEY_PRESETS = [30, 60, 90, 120, 180, 365] as const;

const CI_TRIGGERS = ["stress","boredom","social","loneliness","fatigue","anger","sadness","habit"];

type ArchetypeId = "trainer" | "teacher" | "clinician" | "mentor" | "guide";
const TRACK_HUE: Record<string, string> = {
  "Fitness & Body": "oklch(0.65 0.22 25)",
  "Mental Health": "oklch(0.65 0.22 260)",
  "Quit Bad Habits": "oklch(0.65 0.22 140)",
  "Mind & Learning": "oklch(0.65 0.22 200)",
  "Productivity & Life": "oklch(0.65 0.22 60)",
  "Addiction & Recovery": "oklch(0.65 0.22 350)",
  "Financial Health": "oklch(0.65 0.22 145)",
  "Psychology & Self": "oklch(0.65 0.22 300)",
};
const TRACK_ARCHETYPE: Record<string, ArchetypeId> = {
  // Fitness & Body
  "strength-training": "trainer", "morning-run": "trainer", "cold-exposure": "trainer",
  "sedentary-lifestyle": "trainer",
  // Quit Bad Habits
  "no-social-media": "trainer", "quit-smoking": "trainer", "no-sugar": "trainer", // Addiction & Recovery
  "quit-alcohol": "trainer", "video-game-addiction": "trainer",
  "compulsive-shopping": "mentor", "quit-pornography": "clinician", "quit-drugs": "clinician",
  "quit-gambling": "mentor", "binge-eating": "clinician",
  // Mental Health
  "meditation": "clinician", "anxiety-relief": "clinician", "journaling": "clinician",
  "sleep-routine": "clinician", "breathwork": "clinician",
  "stop-overthinking": "clinician", "social-anxiety": "clinician",
  "anger-management": "clinician", "chronic-stress": "clinician",
  "social-isolation": "guide", "negative-mindset": "guide",
  // Productivity & Life
  "deep-work": "mentor", "beat-procrastination": "trainer",
  "build-discipline": "trainer", // Psychology & Self
  "low-self-esteem": "clinician", "need-for-approval": "clinician",
  "fear-of-failure": "mentor", "fear-of-judgment": "clinician",
  "emotional-dependency": "clinician", "toxic-relationships": "mentor",
  "control-issues": "mentor", "stop-self-sabotage": "guide",
  "toxic-perfectionism": "clinician",
  "jealousy": "clinician", // Financial Health
  "money-management": "mentor",
  // Mind & Learning
  "reading": "teacher", "language": "teacher",
  "gratitude": "guide",
};
const ARCHETYPES: Record<ArchetypeId, Archetype> = {
  trainer: { id: "trainer", name: "Kai", tagline: "Keeps you accountable", voice: "You are a direct, no-bullshit performance coach. Short punchy sentences. Hold the user accountable. Celebrate effort, never excuses. Push past comfort with warmth. Never preachy." },
  teacher: { id: "teacher", name: "Iris", tagline: "Makes it click", voice: "You are a calm curious teacher. Break change into small learnable steps. Ask great questions before giving answers. Clear examples, treat user as intelligent adult. Patient, structured." },
  clinician: { id: "clinician", name: "Dr. Mara", tagline: "Validates, then guides", voice: "You are a warm evidence-based mental health coach. Validate first, then guide. Speak gently. Reference CBT, ACT, polyvagal in plain language. Never minimize feelings." },
  mentor: { id: "mentor", name: "Roy", tagline: "Strategic, no fluff", voice: "You are a sharp strategic mentor. Think in systems. Ask hard questions. Give crisp actionable frameworks. No fluff, no platitudes. The friend who has done it and tells the truth." },
  guide: { id: "guide", name: "Sasha", tagline: "Finds your deeper why", voice: "You are a creative soulful guide. Speak with imagery and metaphor. Honour the user's deeper why. Make practice feel like play. Blend craft, ritual, meaning. Warm, exploratory." },
};
const LS_COMMUNITY = (slug: string) => `forge-community-${slug}`;
const SEED_POSTS: Omit<CommunityPost, "id" | "trackSlug">[] = [
  { content: "Finished day 7. Never thought I'd make it this far — the habit is starting to feel natural.", dayNumber: 7, flameCount: 14, userHasFlamed: false, createdAt: new Date(Date.now() - 2 * 86400000).toISOString() },
  { content: "Hit my first milestone today 🎉 The science note about neuroplasticity blew my mind.", dayNumber: 21, flameCount: 8, userHasFlamed: false, createdAt: new Date(Date.now() - 86400000).toISOString() },
  { content: "Day 3 was brutal but I checked in anyway. Small win counts.", dayNumber: 3, flameCount: 22, userHasFlamed: false, createdAt: new Date(Date.now() - 3600000).toISOString() },
];
function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function isCommunityBlocked(text: string): boolean {
  const lower = text.toLowerCase();
  return COMMUNITY_BLOCKLIST.some(w => lower.includes(w));
}

interface Archetype { id: ArchetypeId; name: string; tagline: string; voice: string; }
const COMMUNITY_BLOCKLIST = [
  "jerk","masturbat","porn","sex ","fap","orgasm","naked","nude","dick","cock","pussy","ass ","fuck","shit ","bitch","whore","slut","cum ","jizz","rape","abuse","kill myself","kms","kys","nigger","faggot",
];

function lsLoad<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

function lsSave(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

function nanoid() { return Math.random().toString(36).slice(2, 9) + Date.now().toString(36); }

function trackHue(category: string) { return TRACK_HUE[category] ?? "oklch(0.65 0.2 280)"; }

function archetypeForSlug(slug: string): Archetype {
  const id = TRACK_ARCHETYPE[slug] ?? "teacher";
  return ARCHETYPES[id];
}
function CheckInRichModal({ onConfirm, onSkip }: {
  onConfirm: (data: { mood: number; hadUrge: boolean; urgeIntensity: number; trigger: string }) => void;
  onSkip: () => void;
}) {
  const { t } = useTranslation();
  const [mood, setMood] = useState(7);
  const [hadUrge, setHadUrge] = useState<boolean | null>(null);
  const [urgeIntensity, setUrgeIntensity] = useState(5);
  const [trigger, setTrigger] = useState("");
  const canConfirm = hadUrge !== null;
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onSkip()}>
      <div className="w-full max-w-md rounded-t-3xl p-6 pb-10 space-y-5"
        style={{ background: "oklch(0.12 0.02 145)" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">{t("journey.how_are_you_today")}</h2>
          <button onClick={onSkip} className="text-white/40 text-sm">{t("common.skip")}</button>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-white/50">
            <span>{t("journey.mood")}</span><span className="text-white font-semibold">{mood}/10</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg">😔</span>
            <input type="range" min={1} max={10} value={mood}
              onChange={e => setMood(Number(e.target.value))}
              className="flex-1 accent-emerald-400 h-2" />
            <span className="text-lg">😊</span>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs text-white/50">{t("journey.felt_urge_today")}</p>
          <div className="flex gap-2">
            {[{ key: "yes", label: t("common.yes") }, { key: "no", label: t("common.no") }].map(opt => (
              <button key={opt.key} onClick={() => setHadUrge(opt.key === "yes")}
                className={"flex-1 py-2 rounded-xl text-sm font-medium border transition-all " + (
                  (opt.key === "yes" ? hadUrge === true : hadUrge === false)
                    ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                    : "border-white/10 text-white/50")}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {hadUrge === true && (<>
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-white/50">
              <span>{t("journey.urge_intensity")}</span><span className="text-white font-semibold">{urgeIntensity}/10</span>
            </div>
            <input type="range" min={1} max={10} value={urgeIntensity}
              onChange={e => setUrgeIntensity(Number(e.target.value))}
              className="w-full accent-amber-400 h-2" />
          </div>
          <div className="space-y-2">
            <p className="text-xs text-white/50">{t("journey.what_triggered_it")}</p>
            <div className="flex flex-wrap gap-2">
              {CI_TRIGGERS.map(trig => (
                <button key={trig} onClick={() => setTrigger(trigger === trig ? "" : trig)}
                  className={"px-3 py-1 rounded-full text-xs font-medium border transition-all " + (
                    trigger === trig ? "bg-amber-500/20 border-amber-500/50 text-amber-400" : "border-white/10 text-white/40")}>
                  {t(`checkin.triggers.${trig}`)}
                </button>
              ))}
            </div>
          </div>
        </>)}
        <button disabled={!canConfirm}
          onClick={() => onConfirm({ mood, hadUrge: hadUrge!, urgeIntensity: hadUrge ? urgeIntensity : 0, trigger: hadUrge ? trigger : "" })}
          className={"w-full py-3 rounded-xl font-semibold text-sm transition-all " + (canConfirm ? "bg-emerald-500 text-white" : "bg-white/5 text-white/20 cursor-not-allowed")}>
          {t("journey.save_checkin")}
        </button>
      </div>
    </div>
  );
}

function CommunityBoard({ slug, userId }: { slug: string; userId?: string | null }) {
  const { t } = useTranslation();
  const [posts, setPosts] = useState<CommunityPost[]>(() => {
    const saved = lsLoad<CommunityPost[]>(LS_COMMUNITY(slug), []);
    if (saved.length > 0) return saved;
    const seeded = SEED_POSTS.map(p => ({ ...p, id: nanoid(), trackSlug: slug }));
    lsSave(LS_COMMUNITY(slug), seeded);
    return seeded;
  });
  const [communityLoaded, setCommunityLoaded] = useState(false);
  const [flamedIds] = useState<Set<string>>(() => {
    const arr = lsLoad<string[]>(`forge-flamed-${slug}`, []);
    return new Set(arr);
  });
  // Load real posts from Supabase on mount
  useEffect(() => {
    if (communityLoaded) return;
    setCommunityLoaded(true);
    db.loadCommunityPosts(slug).then(dbPosts => {
      if (dbPosts.length === 0) return;
      const mapped: CommunityPost[] = dbPosts.map(p => ({
        id: p.id, trackSlug: p.track_slug, content: p.content,
        dayNumber: p.day_number, flameCount: p.flame_count,
        userHasFlamed: flamedIds.has(p.id), createdAt: p.created_at,
      }));
      setPosts(mapped);
      lsSave(LS_COMMUNITY(slug), mapped);
    }).catch(() => {});
  }, [slug]);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [modWarnKey, setModWarnKey] = useState(0);
  const [modWarnMsg, setModWarnMsg] = useState("");

  const flame = (id: string) => {
    setPosts(prev => {
      const next = prev.map(p => {
        if (p.id !== id) return p;
        const newFlamed = !p.userHasFlamed;
        const newCount = newFlamed ? p.flameCount + 1 : p.flameCount - 1;
        // Persist flamed IDs in localStorage
        const arr = lsLoad<string[]>(`forge-flamed-${slug}`, []);
        const updated = newFlamed ? [...arr.filter(x => x !== id), id] : arr.filter(x => x !== id);
        lsSave(`forge-flamed-${slug}`, updated);
        db.updateFlameCount(id, newCount).catch(() => {});
        return { ...p, flameCount: newCount, userHasFlamed: newFlamed };
      });
      lsSave(LS_COMMUNITY(slug), next);
      return next;
    });
  };

  const post = () => {
    if (!draft.trim()) return;
    if (isCommunityBlocked(draft)) {
      const msgs = t("community.moderation", { returnObjects: true }) as string[];
      const msg = msgs[hashStr(draft) % msgs.length];
      setModWarnMsg(msg);
      setModWarnKey(k => k + 1);
      return;
    }
    setPosting(true);
    const p: CommunityPost = { id: nanoid(), trackSlug: slug, content: draft.trim(), dayNumber: 0, flameCount: 0, userHasFlamed: false, createdAt: new Date().toISOString() };
    if (userId) {
      db.saveCommunityPost(userId, { id: p.id, track_slug: slug, content: p.content, day_number: 0, flame_count: 0, created_at: p.createdAt }).catch(() => {});
    }
    setPosts(prev => {
      const next = [p, ...prev];
      lsSave(LS_COMMUNITY(slug), next);
      return next;
    });
    setDraft("");
    setModWarnKey(0);
    setPosting(false);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex gap-2">
          <input value={draft} onChange={e => { setDraft(e.target.value); if (modWarnKey > 0) setModWarnKey(0); }}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && post()}
            placeholder={t("journey.community_placeholder")}
            className={`flex-1 rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring transition-colors ${modWarnKey > 0 ? "border-red-500" : "border-border"}`} />
          <button onClick={post} disabled={!draft.trim() || posting}
            className="btn-chunk rounded-xl bg-foreground text-neutral-900 px-4 py-2 text-sm font-semibold disabled:opacity-40">
            {t("journey.post")}
          </button>
        </div>
        <AnimatePresence mode="wait">
          {modWarnKey > 0 && (
            <motion.p key={modWarnKey}
              initial={{ opacity: 0, x: 0 }}
              animate={{ opacity: 1, x: [-5, 5, -4, 4, -2, 2, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="text-xs text-red-500 font-medium px-1">
              {modWarnMsg}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {posts.map(p => (
          <div key={p.id} className="rounded-xl bg-muted/50 border border-border/50 p-3 flex gap-3">
            <div className="flex-1">
              <p className="text-sm">{p.content}</p>
              {p.dayNumber > 0 && <p className="mt-1 text-[10px] text-muted-foreground font-mono uppercase">{t("journey.day_n", { n: p.dayNumber })}</p>}
            </div>
            <button onClick={() => flame(p.id)}
              className={`shrink-0 flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition ${p.userHasFlamed ? "text-orange-400" : "text-muted-foreground hover:text-orange-400"}`}>
              <Flame className="h-3.5 w-3.5" /> {p.flameCount}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function DayPanel({ label, children, accentColor }: { label: string; children: ReactNode; accentColor?: string }) {
  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border" style={accentColor ? { borderLeft: `3px solid ${accentColor}` } : {}}>
        <p className="text-[10px] uppercase tracking-[0.25em] font-mono text-muted-foreground">{label}</p>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function JourneyOnboarding({ track, onStarted, userId }: { track: UserTrack; onStarted: (j: Journey, days: JourneyDay[]) => void; userId?: string | null }) {
  const { t, i18n } = useTranslation();
  const tn = (slug: string, name: string) => t(`tracks.${slug}.name`, { defaultValue: name });
  const tc = (cat: string) => t(`categories.${cat}`, { defaultValue: cat });
  const archetype = archetypeForSlug(track.slug);
  const [totalDays, setTotalDays] = useState(30);
  const [isCustomDays, setIsCustomDays] = useState(false);
  const [customDaysInput, setCustomDaysInput] = useState("");
  const [startingPoint, setStartingPoint] = useState("");
  const [motivation, setMotivation] = useState("");
  const [obstacle, setObstacle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    if (!startingPoint.trim() || !motivation.trim() || !obstacle.trim()) {
      setError(t("journey.fill_all_fields"));
      return;
    }
    setError(null);
    setLoading(true);
    const journey: Journey = {
      id: nanoid(), trackSlug: track.slug, totalDays, startingPoint, motivation, obstacle,
      startedAt: new Date().toISOString(), generatedThrough: 0,
    };
    const makeFallback = (): JourneyDay[] => Array.from({ length: 7 }, (_, i) => ({
      id: nanoid(), journeyId: journey.id, dayNumber: i + 1,
      title: `Day ${i + 1} — ${track.name}`,
      description: `Your ${track.name} journey, day ${i + 1}. Consistency is the foundation of every transformation.`,
      task: `Spend at least 15 minutes on ${track.name} today. Record how it felt.`,
      reflection: "What did you notice about yourself today?",
      science: "Research shows repetition within 24 hours strengthens neural pathways by up to 40%.",
      checkinPrompt: "How are you feeling right now, on a scale from 1–10?",
      completedAt: null, userNote: null,
    }));
    try {
      let rawDays: JourneyDay[] | null = null;
      // Check cache first
      const cached1 = i18n.language === "en" ? await db.loadJourneyTemplate(track.slug, 1, 7).catch(() => null) : null;
      if (cached1) {
        rawDays = cached1 as JourneyDay[];
      } else {
        const { data: { session: _gds } } = await supabase.auth.getSession();
        const res = await fetch("/api/generate-days", {
          method: "POST",
          headers: { "Content-Type": "application/json" , "Authorization": `Bearer ${_gds?.access_token ?? ""}` },
          body: JSON.stringify({ slug: track.slug, trackName: track.name, category: track.category, startingPoint, motivation, obstacle, fromDay: 1, count: 7, language: i18n.language }),
        });
        if (!res.ok) throw new Error("API error");
        const { days: freshDays } = await res.json() as { days: JourneyDay[] };
        rawDays = freshDays;
        db.saveJourneyTemplate(track.slug, 1, 7, freshDays).catch(() => {});
      }
      const days = rawDays!;
      const filled = days.map((d, i) => ({ ...d, id: nanoid(), journeyId: journey.id, dayNumber: i + 1, completedAt: null, userNote: null }));
      journey.generatedThrough = 7;
      lsSave(LS_JOURNEY(track.slug), journey);
      lsSave(LS_DAYS(track.slug), filled);
      localStorage.setItem(`forge-days-lang2-${track.slug}`, i18n.language);
      if (userId) { db.saveJourney(userId, journey).catch(() => {}); db.saveJourneyDays(userId, track.slug, filled).catch(() => {}); }
      onStarted(journey, filled);
    } catch {
      const fallback = makeFallback();
      journey.generatedThrough = 7;
      lsSave(LS_JOURNEY(track.slug), journey);
      lsSave(LS_DAYS(track.slug), fallback);
      localStorage.setItem(`forge-days-lang2-${track.slug}`, i18n.language);
      if (userId) { db.saveJourney(userId, journey).catch(() => {}); db.saveJourneyDays(userId, track.slug, fallback).catch(() => {}); }
      onStarted(journey, fallback);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-xl mx-auto px-5 py-12 space-y-8">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] font-mono text-muted-foreground">{track.category}</p>
          <h1 className="mt-2 font-display text-3xl tracking-tight">{tn(track.slug, track.name)}</h1>
          <p className="mt-2 text-muted-foreground text-sm">{t("journey.meet_coach", { name: archetypeForSlug(track.slug).name })}</p>
        </div>
        <div className="space-y-5">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">{t("journey.journey_length")}</label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {JOURNEY_PRESETS.map(d => (
                <button key={d} onClick={() => { setTotalDays(d); setIsCustomDays(false); }}
                  className={`btn-chunk rounded-xl py-2.5 text-sm font-semibold border transition ${!isCustomDays && totalDays === d ? "bg-foreground text-neutral-900 border-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>
                  {d === 365 ? "1 year" : `${d}d`}
                </button>
              ))}
            </div>
            <button onClick={() => { setIsCustomDays(true); setCustomDaysInput(String(totalDays)); }}
              className={`mt-2 w-full btn-chunk rounded-xl py-2.5 text-sm font-semibold border transition ${isCustomDays ? "bg-foreground text-neutral-900 border-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>
              {t("journey.custom_days")}
            </button>
            {isCustomDays && (
              <input
                type="number" value={customDaysInput} autoFocus
                onChange={e => {
                  setCustomDaysInput(e.target.value);
                  const n = parseInt(e.target.value);
                  if (n >= 7 && n <= 999) setTotalDays(n);
                }}
                min={7} max={999} placeholder={t("journey.enter_days")}
                className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            )}
            {isCustomDays && totalDays >= 7 && (
              <p className="mt-1 text-xs text-muted-foreground text-right">{t("journey.days_selected", { n: totalDays })}</p>
            )}
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">{t("journey.where_starting")}</label>
            <textarea value={startingPoint} onChange={e => setStartingPoint(e.target.value)}
              placeholder={t("journey.placeholder_starting", { name: track.name })}
              rows={2} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">{t("journey.what_drives_you")}</label>
            <textarea value={motivation} onChange={e => setMotivation(e.target.value)}
              placeholder={t("journey.placeholder_motivation")}
              rows={2} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">{t("journey.biggest_obstacle")}</label>
            <textarea value={obstacle} onChange={e => setObstacle(e.target.value)}
              placeholder={t("journey.placeholder_obstacle")}
              rows={2} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button onClick={handleStart} disabled={loading}
            className="btn-chunk w-full rounded-2xl bg-foreground text-neutral-900 py-3.5 font-semibold text-base disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? (
              <><span className="h-4 w-4 rounded-full border-2 border-background/30 border-t-background animate-spin" />{t("journey.generating_journey")}</>
            ) : (
              <><Sparkles className="h-4 w-4" />{t("journey.begin_my_journey")}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function DurationPickerModal({ trackName, onConfirm, onCancel }: {
  trackName: string;
  onConfirm: (days: number) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(30);
  const [custom, setCustom] = useState(false);
  const [customVal, setCustomVal] = useState("");

  const days = custom ? (parseInt(customVal) || 0) : selected;
  const valid = days >= 7 && days <= 999;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0"
      style={{ background: "oklch(0 0 0 / 0.65)" }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <motion.div
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="w-full max-w-sm rounded-3xl p-6 space-y-5"
        style={{ background: "oklch(0.12 0.02 240)", border: "1px solid oklch(1 0 0 / 0.08)" }}>
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] font-mono text-muted-foreground mb-1">{t("journey.journey_length")}</p>
          <h2 className="font-display text-xl tracking-tight">{trackName}</h2>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {DURATION_PRESETS.map(d => (
            <button key={d}
              onClick={() => { setSelected(d); setCustom(false); }}
              className={`rounded-xl py-2.5 text-sm font-semibold border transition ${!custom && selected === d ? "bg-foreground text-neutral-900 border-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>
              {d === 365 ? "1 year" : `${d}d`}
            </button>
          ))}
        </div>
        <button onClick={() => { setCustom(true); setCustomVal(String(selected)); }}
          className={`w-full rounded-xl py-2.5 text-sm font-semibold border transition ${custom ? "bg-foreground text-neutral-900 border-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>
          {t("journey.custom")}
        </button>
        {custom && (
          <input type="number" autoFocus value={customVal}
            onChange={e => setCustomVal(e.target.value)}
            min={7} max={999} placeholder={t("journey.days_placeholder")}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
        )}
        <div className="flex gap-3 pt-1">
          <button onClick={onCancel}
            className="flex-1 rounded-2xl py-3 text-sm font-semibold border border-border text-muted-foreground hover:text-foreground transition">
            {t("common.cancel")}
          </button>
          <button onClick={() => valid && onConfirm(days)} disabled={!valid}
            className="flex-2 flex-1 rounded-2xl py-3 text-sm font-semibold transition disabled:opacity-40"
            style={{ background: valid ? "oklch(0.6 0.22 250)" : undefined, color: valid ? "#fff" : undefined,
              ...(valid ? {} : { background: "oklch(0.2 0.02 240)", color: "oklch(0.5 0 0)" }) }}>
            {valid ? t("journey.start_n_day_journey", { n: days === 365 ? "1-year" : days }) : t("journey.start_journey")}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
function JourneyView({ track, journey: initJourney, days: initDays, onBack, showCheckInHint, onTrackCheckIn, onRestart, userId }: {
  track: UserTrack;
  journey: Journey;
  days: JourneyDay[];
  onBack: () => void;
  showCheckInHint?: boolean;
  onTrackCheckIn?: () => void;
  onRestart?: (trackId: string) => void;
  userId?: string | null;
}) {
  const { t, i18n } = useTranslation();
  const tn = (slug: string, name: string) => t(`tracks.${slug}.name`, { defaultValue: name });
  const tc = (cat: string) => t(`categories.${cat}`, { defaultValue: cat });
  const [journey, setJourney] = useState(initJourney);
  const [days, setDays] = useState(initDays);
  const [activeTab, setActiveTab] = useState<"today" | "map" | "community" | "coach">("today");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => lsLoad<ChatMessage[]>(LS_CHAT(track.slug), []));
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  // Count this-month user messages across all tracks for free-tier soft limit
  const thisMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const monthMsgCount = chatMessages.filter(m => m.role === "user" && m.createdAt.startsWith(thisMonth)).length;
  const FREE_COACH_LIMIT = 5;
  const coachLimitReached = monthMsgCount >= FREE_COACH_LIMIT;
  const [coachOpening, setCoachOpening] = useState(false);

  // Load coach messages from Supabase on first open
  const [coachLoaded, setCoachLoaded] = useState(false);
  useEffect(() => {
    if (!userId || coachLoaded) return;
    setCoachLoaded(true);
    db.loadCoachMessages(userId, track.slug).then(dbMsgs => {
      if (dbMsgs.length === 0) return;
      const mapped: ChatMessage[] = dbMsgs.map(m => ({
        id: m.id, role: m.role as 'user' | 'assistant',
        content: m.content, createdAt: m.created_at,
      }));
      setChatMessages(mapped);
      lsSave(LS_CHAT(track.slug), mapped);
    }).catch(() => {});
  }, [userId, track.slug]);

  // Auto-generate opening message on first coach tab visit
  useEffect(() => {
    if (activeTab !== "coach" || chatMessages.length > 0 || coachOpening) return;
    setCoachOpening(true);
    const openerKey = completedCount < 1
      ? `coach.opener_day1_${archetype.id}`
      : `coach.opener_later_${archetype.id}`;
    const opener = t(openerKey, { name: track.name, day: completedCount + 1, prev: completedCount })
      || t('coach.opener_fallback', { name: track.name });
    const openingMsg: ChatMessage = { id: nanoid(), role: "assistant", content: opener, createdAt: new Date().toISOString() };
    const withOpening = [openingMsg];
    setChatMessages(withOpening);
    lsSave(LS_CHAT(track.slug), withOpening);
    if (userId) db.saveCoachMessage(userId, { id: openingMsg.id, track_slug: track.slug, role: "assistant", content: openingMsg.content, created_at: openingMsg.createdAt }).catch(() => {});
  }, [activeTab, chatMessages.length, coachOpening]);
  const [milestoneDay, setMilestoneDay] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<JourneyDay | null>(null);
  const [checkInNote, setCheckInNote] = useState("");
  const [checkInTask, setCheckInTask] = useState("");
  const [checkInReflect, setCheckInReflect] = useState("");
  const [warnTaskKey, setWarnTaskKey] = useState(0);
  const [warnReflectKey, setWarnReflectKey] = useState(0);
  const warnTaskIdx = useRef(0);
  const warnReflectIdx = useRef(0);
  const [fillFirstBanner, setFillFirstBanner] = useState(showCheckInHint ?? false);
  const [showRichModal, setShowRichModal] = useState(false);

  // Phase 5 — missed days adaptation
  const [adaptModal, setAdaptModal] = useState<{ missedDays: number } | null>(null);
  const [adaptReason, setAdaptReason] = useState<AdaptReasonId>("busy");
  const [adapting, setAdapting] = useState(false);
  const [adaptedDayNumbers, setAdaptedDayNumbers] = useState<Set<number>>(new Set());
  const adaptShownRef = useRef(false);
  const [coachFlash, setCoachFlash] = useState<string | null>(null);

  const archetype = archetypeForSlug(track.slug);
  const completedCount = days.filter(d => d.completedAt !== null).length;
  const todayDay = days.find(d => d.completedAt === null) ?? days[days.length - 1];
  const accentColor = trackHue(track.category);

  useEffect(() => {
    if (!journey) return;
    if (completedCount >= journey.generatedThrough - 2 && journey.generatedThrough < journey.totalDays) {
      const fromDay = journey.generatedThrough + 1;
      const count = Math.min(7, journey.totalDays - journey.generatedThrough);
      (async () => {
        let rawNext: JourneyDay[] | null = null;
        const cachedNext = i18n.language === "en" ? await db.loadJourneyTemplate(track.slug, fromDay, count).catch(() => null) : null;
        if (cachedNext) {
          rawNext = cachedNext as JourneyDay[];
        } else {
          const { data: { session: _gds2 } } = await supabase.auth.getSession();
          const r = await fetch("/api/generate-days", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${_gds2?.access_token ?? ""}` },
            body: JSON.stringify({ slug: track.slug, trackName: track.name, category: track.category, startingPoint: journey.startingPoint, motivation: journey.motivation, obstacle: journey.obstacle, fromDay, count, language: i18n.language }),
          }).catch(() => null);
          if (!r || !r.ok) return;
          const data = await r.json() as { days: JourneyDay[] };
          rawNext = data.days;
          db.saveJourneyTemplate(track.slug, fromDay, count, data.days).catch(() => {});
        }
        if (!rawNext) return;
        const data = { days: rawNext };
        const filled = data.days.map((d: JourneyDay, i: number) => ({ ...d, id: nanoid(), journeyId: journey.id, dayNumber: fromDay + i, completedAt: null, userNote: null }));
        setDays(prev => { const next = [...prev, ...filled]; lsSave(LS_DAYS(track.slug), next); localStorage.setItem(`forge-days-lang2-${track.slug}`, i18n.language); if (userId) db.saveJourneyDays(userId, track.slug, next).catch(() => {}); return next; });
        const nextJourney = { ...journey, generatedThrough: fromDay + count - 1 };
        setJourney(nextJourney);
        lsSave(LS_JOURNEY(track.slug), nextJourney);
        if (userId) db.saveJourney(userId, nextJourney).catch(() => {});
      })();
    }
  }, [completedCount, journey, days.length, track]);

  // Phase 5 — detect missed days and prompt adaptation
  useEffect(() => {
    if (adaptShownRef.current || days.length === 0 || completedCount === 0) return;
    const completed = days.filter(d => d.completedAt !== null);
    if (completed.length === 0) return;
    const last = completed.sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())[0];
    const daysSince = Math.floor((Date.now() - new Date(last.completedAt!).getTime()) / 86400000);
    if (daysSince >= 2) {
      adaptShownRef.current = true;
      setAdaptModal({ missedDays: daysSince - 1 });
    }
  }, [days, completedCount]);

  // Phase 5 — adapt journey via API
  const adaptJourney = async () => {
    if (!journey || !userId || adapting) return;
    setAdapting(true);

    // Extract recent moods and triggers from check-in notes
    const recentNotes = days
      .filter(d => d.completedAt && d.userNote)
      .slice(-7)
      .map(d => d.userNote ?? "");

    const recentMoods: number[] = [];
    const recentTriggers: string[] = [];
    recentNotes.forEach(note => {
      const moodMatch = note.match(/Umore:\s*(\d+)/);
      if (moodMatch) recentMoods.push(parseInt(moodMatch[1]));
      const triggerMatch = note.match(/Trigger:\s*([^\n]+)/);
      if (triggerMatch) recentTriggers.push(triggerMatch[1].trim());
    });

    const missedDays = adaptModal?.missedDays ?? 1;
    const reasonLabel = adaptReason;
    const fromDay = completedCount + 1;
    const count = Math.min(7, journey.totalDays - completedCount);
    if (count <= 0) { setAdapting(false); setAdaptModal(null); return; }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/adapt-journey", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token ?? ""}` },
        body: JSON.stringify({
          slug: track.slug,
          trackName: track.name,
          category: track.category,
          startingPoint: journey.startingPoint,
          motivation: journey.motivation,
          obstacle: journey.obstacle,
          fromDay,
          count,
          recentMoods,
          recentTriggers,
          missedDays,
          reason: reasonLabel,
        }),
      });
      if (!res.ok) throw new Error("API error");
      const { days: adapted } = await res.json() as { days: Array<{ day: number; task: string; type: string; duration: string }> };

      // Convert to JourneyDay format, replacing upcoming uncompleted days
      const adaptedDays = adapted.map((d, i) => ({
        id: nanoid(),
        journeyId: journey.id,
        dayNumber: fromDay + i,
        title: `Day ${fromDay + i} — Adapted for you`,
        description: `Your journey continues. This task was adapted to meet you exactly where you are.`,
        task: d.task,
        reflection: "Looking back at the days you missed — what was the real barrier? What would make it easier?",
        science: "Research shows returning after a break with adapted goals is 3× more effective than restarting from scratch.",
        checkinPrompt: "How are you feeling about getting back on track today?",
        completedAt: null,
        userNote: null,
      }));

      const adaptedNumbers = new Set(adaptedDays.map(d => d.dayNumber));
      setAdaptedDayNumbers(prev => new Set([...prev, ...adaptedNumbers]));

      setDays(prev => {
        // Replace upcoming days (dayNumber >= fromDay) with adapted ones
        const kept = prev.filter(d => d.dayNumber < fromDay);
        const merged = [...kept, ...adaptedDays];
        lsSave(LS_DAYS(track.slug), merged);
        if (userId) db.saveJourneyDays(userId, track.slug, merged).catch(() => {});
        return merged;
      });

      const nextJourney = { ...journey, generatedThrough: Math.max(journey.generatedThrough, fromDay + count - 1) };
      setJourney(nextJourney);
      lsSave(LS_JOURNEY(track.slug), nextJourney);
      db.saveJourney(userId, nextJourney).catch(() => {});
    } catch (e) {
      console.error("adaptJourney error:", e);
    } finally {
      setAdapting(false);
      setAdaptModal(null);
    }
  };

  const checkIn = (dayId: string, note: string) => {
    setDays(prev => {
      const next = prev.map(d => d.id === dayId ? { ...d, completedAt: new Date().toISOString(), userNote: note || null } : d);
      lsSave(LS_DAYS(track.slug), next);
      if (userId) db.saveJourneyDays(userId, track.slug, next).catch(() => {});
      return next;
    });
    const completedNow = completedCount + 1;
    if (JOURNEY_MILESTONES.includes(completedNow)) {
      setMilestoneDay(completedNow);
      confetti({ particleCount: 100, spread: 80, origin: { y: 0.4 }, colors: ["#FFD000", "#FFB347", "#FFE680"] });
    } else {
      // Show coach micro-reaction (non-blocking, auto-dismisses)
      const flashes = COACH_FLASH[archetype.name] ?? COACH_FLASH.Kai;
      const msg = flashes[completedNow % flashes.length];
      setCoachFlash(msg);
      setTimeout(() => setCoachFlash(null), 4000);
    }
  };

  const handleCheckIn = () => {
    let valid = true;
    if (!checkInTask.trim()) {
      warnTaskIdx.current = (warnTaskIdx.current + 1) % 10;
      setWarnTaskKey(k => k + 1);
      valid = false;
    }
    if (!checkInReflect.trim()) {
      warnReflectIdx.current = (warnReflectIdx.current + 1) % 10;
      setWarnReflectKey(k => k + 1);
      valid = false;
    }
        if (!valid || !todayDay) return;
    setShowRichModal(true);
  };

  const handleRichConfirm = (richData: { mood: number; hadUrge: boolean; urgeIntensity: number; trigger: string }) => {
    setShowRichModal(false);
    if (!todayDay) return;
    let richMeta = "\n\n---\nUmore: " + richData.mood + "/10";
    if (richData.hadUrge) {
      richMeta += " | Impulso: Sì (" + richData.urgeIntensity + "/10)";
      if (richData.trigger) richMeta += " | Trigger: " + richData.trigger;
    } else { richMeta += " | Impulso: No"; }
    checkIn(todayDay.id, "Task: " + checkInTask.trim() + "\n\nReflection: " + checkInReflect.trim() + richMeta);
    onTrackCheckIn?.();
    setCheckInTask(""); setCheckInReflect(""); setCheckInNote("");
  };


  const sendChat = async () => {
    if (!chatInput.trim()) return;
    const userMsg: ChatMessage = { id: nanoid(), role: "user", content: chatInput.trim(), createdAt: new Date().toISOString() };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    lsSave(LS_CHAT(track.slug), newMessages);
    if (userId) db.saveCoachMessage(userId, { id: userMsg.id, track_slug: track.slug, role: "user", content: userMsg.content, created_at: userMsg.createdAt }).catch(() => {});
    setChatInput("");
    setChatLoading(true);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: track.slug, archetype: archetype.id,
          messages: newMessages.slice(-10).map(m => ({ role: m.role, content: m.content })),
          userContext: { startingPoint: journey.startingPoint, motivation: journey.motivation, daysCompleted: completedCount, totalDays: journey.totalDays },
        }),
      });
      const { message } = await res.json() as { message: string };
      const assistantMsg: ChatMessage = { id: nanoid(), role: "assistant", content: message, createdAt: new Date().toISOString() };
      if (userId) db.saveCoachMessage(userId, { id: assistantMsg.id, track_slug: track.slug, role: "assistant", content: assistantMsg.content, created_at: assistantMsg.createdAt }).catch(() => {});
      const withReply = [...newMessages, assistantMsg];
      setChatMessages(withReply);
      lsSave(LS_CHAT(track.slug), withReply);
    } catch {
      const fallback: ChatMessage = { id: nanoid(), role: "assistant", content: `I'm here with you on day ${completedCount + 1}. Keep going — each session builds the foundation of who you're becoming.`, createdAt: new Date().toISOString() };
      const withFallback = [...newMessages, fallback];
      setChatMessages(withFallback);
      lsSave(LS_CHAT(track.slug), withFallback);
    } finally {
      setChatLoading(false);
    }
  };

  const tabs: { key: typeof activeTab; label: string }[] = [
    { key: "today", label: t("journey.tab_today") },
    { key: "map", label: t("journey.tab_journey") },
    { key: "community", label: t("journey.tab_community") },
    { key: "coach", label: archetype.name },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-muted transition">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.25em] font-mono text-muted-foreground">{track.category}</p>
            <h1 className="font-semibold text-sm truncate">{tn(track.slug, track.name)}</h1>
          </div>
          <div className="text-right flex items-center gap-2">
            <div>
              <p className="text-[10px] font-mono text-muted-foreground">{completedCount}/{journey.totalDays} days</p>
              <div className="mt-0.5 h-1 w-20 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${(completedCount / journey.totalDays) * 100}%` }} />
              </div>
            </div>
            {onRestart && (
              <button
                onClick={() => { if (confirm(t("journey.restart_confirm"))) { onRestart(track.id); onBack(); } }}
                className="text-[10px] text-muted-foreground hover:text-foreground border border-border rounded-lg px-2 py-1 transition"
                title={t("journey.restart_journey")}>
                ↺
              </button>
            )}
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 flex border-t border-border/50">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 text-xs font-semibold transition border-b-2 ${activeTab === tab.key ? "text-foreground border-foreground" : "text-muted-foreground border-transparent"}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-4">
        {activeTab === "today" && todayDay && (
          <motion.div key="today" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <AnimatePresence>
              {fillFirstBanner && todayDay.completedAt === null && (
                <motion.div key="fill-first"
                  initial={{ opacity: 0, y: -10, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 200, damping: 22 }}
                  className="rounded-2xl border-2 border-[color:var(--secondary)]/40 bg-[color:var(--secondary)]/8 p-4 flex items-start gap-3">
                  <svg className="h-5 w-5 mt-0.5 shrink-0 text-[color:var(--secondary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-semibold text-sm text-[color:var(--secondary)]">{t("journey.fill_first")}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("journey.fill_first_sub")}</p>
                  </div>
                  <button onClick={() => setFillFirstBanner(false)}
                    className="text-muted-foreground hover:text-foreground text-lg leading-none shrink-0 mt-0.5">✕</button>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="rounded-2xl bg-card border border-border p-5" style={{ borderLeft: `3px solid ${accentColor}` }}>
              <p className="text-[10px] uppercase tracking-[0.25em] font-mono text-muted-foreground">{t("journey.day_n", { n: todayDay.dayNumber })}</p>
              <h2 className="mt-1.5 font-display text-xl font-semibold">{todayDay.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{todayDay.description}</p>
            </div>
            {/* Today's task — mission-style card (blue) */}
            <div className="rounded-2xl overflow-hidden border border-border bg-card relative">
              <div className="px-5 py-3 border-b border-border/60 flex items-center gap-2"
                style={{ borderLeft: "3px solid oklch(0.65 0.22 240)" }}>
                <Zap className="h-3.5 w-3.5" style={{ color: "oklch(0.65 0.22 240)" }} fill="currentColor" />
                <p className="text-[10px] uppercase tracking-[0.25em] font-mono font-bold" style={{ color: "oklch(0.65 0.22 240)" }}>{t("journey.your_mission")}</p>
              </div>
              <div className="px-5 py-4">
                <p className="text-base leading-relaxed font-medium whitespace-pre-line">{todayDay.task}</p>
              </div>
            </div>

            {/* Reflection (yellow) */}
            <DayPanel label={t("journey.reflection_prompt")} accentColor="oklch(0.875 0.185 95)"><p className="text-sm text-muted-foreground italic">{todayDay.reflection}</p></DayPanel>
            {/* Science (green) */}
            <DayPanel label={t("journey.the_science")} accentColor="oklch(0.65 0.22 145)"><p className="text-sm text-muted-foreground">{todayDay.science}</p></DayPanel>
            {todayDay.completedAt === null ? (
              <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] font-mono text-muted-foreground">{t("journey.checkin_label")}</p>
                  <p className="text-sm text-muted-foreground mt-1">{todayDay.checkinPrompt}</p>
                </div>

                {/* Task field */}
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-foreground">{t("journey.did_you_do_task")}</p>
                  <textarea value={checkInTask} onChange={e => { setCheckInTask(e.target.value); if (e.target.value) setFillFirstBanner(false); }}
                    placeholder={t("journey.describe_task_placeholder")} rows={2}
                    className={`w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none transition-colors ${warnTaskKey > 0 && !checkInTask.trim() ? "border-red-500" : "border-border"}`} />
                  <AnimatePresence mode="wait">
                    {warnTaskKey > 0 && !checkInTask.trim() && (
                      <motion.p key={warnTaskKey}
                        initial={{ opacity: 0, x: 0 }}
                        animate={{ opacity: 1, x: [-5, 5, -4, 4, -2, 2, 0] }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4 }}
                        className="text-xs text-red-500 font-medium">
                        {(t("checkin.warnings", { returnObjects: true }) as string[])[warnTaskIdx.current % 10]}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* Reflection field */}
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-foreground">{t("journey.your_reflection")}</p>
                  <textarea value={checkInReflect} onChange={e => { setCheckInReflect(e.target.value); if (e.target.value) setFillFirstBanner(false); }}
                    placeholder={t("journey.reflection_placeholder")} rows={2}
                    className={`w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none transition-colors ${warnReflectKey > 0 && !checkInReflect.trim() ? "border-red-500" : "border-border"}`} />
                  <AnimatePresence mode="wait">
                    {warnReflectKey > 0 && !checkInReflect.trim() && (
                      <motion.p key={warnReflectKey}
                        initial={{ opacity: 0, x: 0 }}
                        animate={{ opacity: 1, x: [-5, 5, -4, 4, -2, 2, 0] }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4 }}
                        className="text-xs text-red-500 font-medium">
                        {(t("checkin.warnings", { returnObjects: true }) as string[])[warnReflectIdx.current % 10]}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                <button onClick={handleCheckIn}
                  className="btn-chunk w-full rounded-xl bg-foreground text-neutral-900 py-2.5 font-semibold text-sm flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> {t("journey.mark_complete", { n: todayDay.dayNumber })}
                </button>
              </div>
            ) : (
              <div className="rounded-2xl bg-[color:var(--tertiary)]/10 border border-[color:var(--tertiary)]/20 p-4 flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-[color:var(--tertiary)] shrink-0" />
                <div>
                  <p className="font-semibold text-sm">{t("journey.day_complete", { n: todayDay.dayNumber })}</p>
                  {todayDay.userNote && <p className="text-xs text-muted-foreground mt-0.5">{todayDay.userNote}</p>}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "map" && (
          <motion.div key="map" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.25em] font-mono text-muted-foreground mb-4">{t("journey.map_label", { n: journey.totalDays })}</p>
            {days.map(d => {
              const isCompleted = d.completedAt !== null;
              const isCurrent = d.id === todayDay?.id;
              // Only completed days and today are accessible; everything else is locked
              const locked = !isCompleted && !isCurrent;
              return (
                <button key={d.id}
                  onClick={locked ? undefined : () => setSelectedDay(d)}
                  className={`w-full text-left rounded-xl p-4 border transition flex items-center gap-3 ${
                    isCurrent ? "border-foreground bg-card"
                    : isCompleted ? "border-[color:var(--tertiary)]/30 bg-[color:var(--tertiary)]/5"
                    : "border-border bg-card/30 opacity-35 cursor-not-allowed"
                  }`}>
                  <div className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    isCompleted ? "bg-[color:var(--tertiary)]/20 text-[color:var(--tertiary)]"
                    : isCurrent ? "bg-foreground text-neutral-900"
                    : "bg-muted text-muted-foreground"
                  }`}>
                    {isCompleted ? <Check className="h-3.5 w-3.5" />
                     : locked ? <Lock className="h-3 w-3" />
                     : d.dayNumber}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{locked ? t("journey.day_n", { n: d.dayNumber }) : d.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {locked ? t("journey.locked_hint") : `${d.description.slice(0, 60)}…`}
                    </p>
                  </div>
                  {JOURNEY_MILESTONES.includes(d.dayNumber) && !locked && <Trophy className="shrink-0 h-3.5 w-3.5 text-yellow-400" />}
                  {adaptedDayNumbers.has(d.dayNumber) && !locked && (
                    <span className="shrink-0 flex items-center gap-1 rounded-full bg-[color:var(--secondary)]/15 px-2 py-0.5 text-[10px] font-semibold text-[color:var(--secondary)]">
                      <Sparkles className="h-2.5 w-2.5" />{t("journey.adapted")}
                    </span>
                  )}
                </button>
              );
            })}
            {journey.generatedThrough < journey.totalDays && (
              <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                {t("journey.days_will_generate", { from: journey.generatedThrough + 1, to: journey.totalDays })}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "community" && (
          <motion.div key="community" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-[10px] uppercase tracking-[0.25em] font-mono text-muted-foreground mb-4">{t("journey.community_title", { name: track.name })}</p>
            <CommunityBoard slug={track.slug} userId={userId} />
          </motion.div>
        )}

        {activeTab === "coach" && (
          <motion.div key="coach" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full grad-electric flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="font-semibold text-sm">{archetype.name}</p>
                <p className="text-xs text-muted-foreground">{archetype.tagline}</p>
              </div>
            </div>
            <div className="space-y-3 max-h-[420px] overflow-y-auto pb-1">
              {chatMessages.length === 0 && (
                <div className="rounded-xl bg-muted/50 p-4 flex gap-2">
                  <div className="h-2 w-2 rounded-full bg-muted-foreground mt-1.5 animate-pulse shrink-0" />
                  <p className="text-sm text-muted-foreground italic">{t("journey.coach_warming_up", { name: archetype.name })}</p>
                </div>
              )}
              {chatMessages.map(m => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.role === "user" ? "bg-foreground text-neutral-900" : "bg-muted"}`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl px-4 py-3 flex gap-1.5 items-center">
                    {[0, 1, 2].map(i => <span key={i} className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                  </div>
                </div>
              )}
            </div>

            {/* Suggested prompts — shown only when few messages */}
            {chatMessages.length <= 2 && (
              <div className="flex gap-2 flex-wrap">
                {(COACH_PROMPT_KEYS[archetype.id] ?? COACH_PROMPT_KEYS.teacher).map(key => (
                  <button key={key}
                    onClick={() => { setChatInput(t(key)); }}
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors text-left">
                    {t(key)}
                  </button>
                ))}
              </div>
            )}

            <div className="sticky bottom-0 bg-background pt-1">
              {coachLimitReached ? (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 p-3 text-center space-y-1">
                  <p className="text-xs font-medium text-amber-400">{t("journey.coach_limit_reached")}</p>
                  <p className="text-[10px] text-muted-foreground">{t("journey.coach_limit_sub", { n: FREE_COACH_LIMIT })}</p>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                    placeholder={t("journey.message_coach", { name: archetype.name })}
                    className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
                  <button onClick={sendChat} disabled={!chatInput.trim() || chatLoading}
                    className="btn-chunk rounded-xl bg-foreground text-neutral-900 px-4 py-2 text-sm font-semibold disabled:opacity-40">
                    {t("common.send")}
                  </button>
                </div>
              )}
              {!coachLimitReached && monthMsgCount >= 3 && (
                <p className="mt-1.5 text-[10px] text-muted-foreground/60 font-mono text-center">
{t("journey.messages_left", { n: FREE_COACH_LIMIT - monthMsgCount })}
                </p>
              )}
              {!coachLimitReached && monthMsgCount < 3 && (
                <p className="mt-2 text-[10px] text-emerald-500/70 font-mono text-center">{t("journey.coach_privacy")}</p>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* Coach flash — micro-reaction after check-in */}
      <AnimatePresence>
        {coachFlash && (
          <motion.div
            key="coach-flash"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm"
            onClick={() => setCoachFlash(null)}
          >
            <div className="rounded-2xl bg-card border border-border/60 shadow-2xl p-4 flex items-start gap-3">
              <div className="shrink-0 h-8 w-8 rounded-full grad-electric flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-[0.2em] font-mono text-muted-foreground mb-0.5">{archetype.name}</p>
                <p className="text-sm leading-snug">{coachFlash}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedDay && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
            onClick={() => setSelectedDay(null)}>
            <motion.div initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }}
              className="w-full max-w-lg bg-background rounded-3xl p-6 space-y-4 max-h-[80vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.25em] font-mono text-muted-foreground">{t("journey.day_n", { n: selectedDay.dayNumber })}</p>
                <button onClick={() => setSelectedDay(null)} className="text-muted-foreground hover:text-foreground text-lg">✕</button>
              </div>
              <h2 className="font-display text-xl font-semibold">{selectedDay.title}</h2>
              <p className="text-sm text-muted-foreground">{selectedDay.description}</p>
              <div className="rounded-xl bg-muted p-3">
                <p className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-1">{t("journey.task_label")}</p>
                <p className="text-sm">{selectedDay.task}</p>
              </div>
              {selectedDay.completedAt && selectedDay.userNote && (
                <div className="rounded-xl bg-[color:var(--tertiary)]/10 p-3">
                  <p className="text-[10px] uppercase tracking-wider font-mono text-[color:var(--tertiary)] mb-1">{t("journey.your_note")}</p>
                  <p className="text-sm">{selectedDay.userNote}</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {adaptModal !== null && (
          <motion.div
            key="adapt-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 26 }}
              className="w-full max-w-sm bg-background rounded-3xl p-6 space-y-5"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[color:var(--secondary)]/15 flex items-center justify-center shrink-0">
                  <RefreshCw className="h-4 w-4 text-[color:var(--secondary)]" />
                </div>
                <div>
                  <p className="font-semibold text-base leading-snug">
                    {t("journey.welcome_back")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("journey.away_for_days", { n: adaptModal.missedDays })}
                  </p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("journey.adapt_intro")}
              </p>

              {/* Reason selector */}
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-[0.2em] font-mono text-muted-foreground">{t("journey.what_happened")}</p>
                <div className="flex flex-wrap gap-2">
                  {ADAPT_REASONS.map(r => (
                    <button
                      key={r.id}
                      onClick={() => setAdaptReason(r.id)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition border ${
                        adaptReason === r.id
                          ? "bg-foreground text-neutral-900 border-foreground"
                          : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                      }`}
                    >
                      {t(`adapt_reasons.${r.id}`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* CTAs */}
              <div className="space-y-2 pt-1">
                <button
                  onClick={adaptJourney}
                  disabled={adapting}
                  className="w-full rounded-xl bg-foreground text-neutral-900 py-3 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition"
                >
                  {adapting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      {t("journey.adapting")}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      {t("journey.adapt_my_journey")}
                    </>
                  )}
                </button>
                <button
                  onClick={() => setAdaptModal(null)}
                  className="w-full rounded-xl border border-border py-2.5 text-sm text-muted-foreground hover:text-foreground transition"
                >
                  {t("journey.keep_original_plan")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
              {showRichModal && (
        <CheckInRichModal
          onConfirm={handleRichConfirm}
          onSkip={() => {
            setShowRichModal(false);
            if (!todayDay) return;
            checkIn(todayDay.id, "Task: " + checkInTask.trim() + "\n\nReflection: " + checkInReflect.trim());
            onTrackCheckIn?.();
            setCheckInTask(""); setCheckInReflect(""); setCheckInNote("");
          }}
        />
      )}
{milestoneDay !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
            onClick={() => setMilestoneDay(null)}>
            <motion.div initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.85 }}
              className="bg-background rounded-3xl p-8 max-w-sm w-full text-center space-y-4"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-center h-16 w-16 rounded-full bg-yellow-400/15 mx-auto">
                <Trophy className="h-8 w-8 text-yellow-400" />
              </div>
              <h2 className="font-display text-2xl font-bold">{t("journey.milestone_title", { day: milestoneDay })}</h2>
              <p className="text-muted-foreground text-sm">{t("journey.milestone_message", { name: track.name })}</p>
              <button onClick={() => setMilestoneDay(null)}
                className="btn-chunk w-full rounded-xl bg-foreground text-neutral-900 py-3 font-semibold">
                {t("journey.keep_going")}
              </button>
              <button onClick={() => {
                const text = `Day ${milestoneDay} on ${track.name} with Forge. The streak continues. 🔥`;
                if (navigator.share) navigator.share({ text });
                else navigator.clipboard?.writeText(text);
              }} className="btn-chunk w-full rounded-xl border border-border py-2.5 text-sm text-muted-foreground hover:text-foreground transition">
                {t("journey.share_moment")}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
export { JourneyView, JourneyOnboarding };
