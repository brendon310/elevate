import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import type { UserTrack, JourneyDay, Journey } from '../types';

const LS_DAYS = (slug: string) => `forge-days-${slug}`;
type ArchetypeId = "trainer" | "teacher" | "clinician" | "mentor" | "guide";
interface Archetype { id: ArchetypeId; name: string; taglineKey: string; voice: string; }
const ARCHETYPES: Record<ArchetypeId, Archetype> = {
  trainer: { id: "trainer", name: "Kai", taglineKey: "coach.trainer_tagline", voice: "You are a direct, no-bullshit performance coach. Short punchy sentences. Hold the user accountable. Celebrate effort, never excuses. Push past comfort with warmth. Never preachy." },
  teacher: { id: "teacher", name: "Iris", taglineKey: "coach.teacher_tagline", voice: "You are a calm curious teacher. Break change into small learnable steps. Ask great questions before giving answers. Clear examples, treat user as intelligent adult. Patient, structured." },
  clinician: { id: "clinician", name: "Dr. Mara", taglineKey: "coach.clinician_tagline", voice: "You are a warm evidence-based mental health coach. Validate first, then guide. Speak gently. Reference CBT, ACT, polyvagal in plain language. Never minimize feelings." },
  mentor: { id: "mentor", name: "Roy", taglineKey: "coach.mentor_tagline", voice: "You are a sharp strategic mentor. Think in systems. Ask hard questions. Give crisp actionable frameworks. No fluff, no platitudes. The friend who has done it and tells the truth." },
  guide: { id: "guide", name: "Sasha", taglineKey: "coach.guide_tagline", voice: "You are a creative soulful guide. Speak with imagery and metaphor. Honour the user's deeper why. Make practice feel like play. Blend craft, ritual, meaning. Warm, exploratory." },
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
function archetypeForSlug(slug: string): Archetype {
  const id = TRACK_ARCHETYPE[slug] ?? "teacher";
  return ARCHETYPES[id];
}
const MORNING_FALLBACKS: Record<ArchetypeId, string[]> = {
  trainer: [
    "Yesterday you chose to show up. Today is the test of whether that was a fluke or a pattern. It wasn't a fluke.",
    "Every rep you do today compounds what you built yesterday. Clock's ticking. Get moving.",
  ],
  teacher: [
    "Consistency is the silent teacher that no class can replicate. Your streak is already teaching you something. Keep the lesson going.",
    "Yesterday's work laid a foundation. Today you get to build one more floor. Simple. Repeatable. Effective.",
  ],
  clinician: [
    "Coming back again takes more courage than you may realize. I'm glad you're here. Let's make today gentle and intentional.",
    "Progress isn't always visible in a day — but it lives in the choice to return. You returned. That matters deeply.",
  ],
  mentor: [
    "The gap between who you are and who you're becoming closes one check-in at a time. Today is one of those times.",
    "Execution is the only strategy that counts. You know what to do. Now go do it.",
  ],
  guide: [
    "Morning has a particular kind of light. It's the same light that was here the day you started. You're still in it. Keep going.",
    "Every day you return, you deepen the groove of the person you're becoming. Today, go a little deeper.",
  ],
};
function lsLoad<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}
function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function todayStr() { return new Date().toISOString().slice(0, 10); }
function yesterdayStr() { return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10); }

function MorningCoachOverlay({ tracks, onDismiss }: { tracks: UserTrack[]; onDismiss: () => void }) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<"typing" | "message">("typing");
  const [message, setMessage] = useState<string>("");
  const [revealed, setRevealed] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    // Pick best track (most recent activity, or first)
    const best = tracks.reduce<UserTrack | null>((acc, t) => {
      if (!acc) return t;
      if ((t.total_done || 0) > (acc.total_done || 0)) return t;
      return acc;
    }, null);
    if (!best) { onDismiss(); return; }

    const archetype = archetypeForSlug(best.slug);
    const fallbacks = MORNING_FALLBACKS[archetype.id];
    const fallback = fallbacks[hashStr(todayStr()) % fallbacks.length];

    // Try to get yesterday's note
    const days = lsLoad<JourneyDay[]>(LS_DAYS(best.slug), []);
    const yDay = yesterdayStr();
    const noteDay = days.find(d => d.completedAt?.slice(0, 10) === yDay && d.userNote?.trim());
    const userNote = noteDay?.userNote?.trim() ?? null;

    const run = async () => {
      // Show typing for 1.8s, then fetch/fallback
      await new Promise(r => setTimeout(r, 1800));
      if (!mountedRef.current) return;

      let result = fallback;
      if (userNote) {
        try {
          const res = await fetch("/api/coach", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: [{ role: "user", content: userNote }],
              voice: archetype.voice,
              context: `This is the user's morning check-in message from yesterday for their "${best.name}" journey. Write 2–3 sentences that feel personal, seen, and motivating — as if you read what they wrote and you're responding this morning. Do not use phrases like "I can see" or "I understand". Be warm, direct, human. No lists. Just speak to them.`,
            }),
          });
          if (res.ok) {
            const data = await res.json() as { reply?: string };
            if (data.reply?.trim() && mountedRef.current) result = data.reply.trim();
          }
        } catch { /* use fallback */ }
      }

      if (!mountedRef.current) return;
      setMessage(result);
      setPhase("message");
    };
    run();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Word-by-word typewriter reveal
  const words = message.split(" ");
  useEffect(() => {
    if (phase !== "message" || !message) return;
    setRevealed(0);
    const interval = setInterval(() => {
      setRevealed(prev => {
        if (prev >= words.length) { clearInterval(interval); return prev; }
        return prev + 1;
      });
    }, 60);
    return () => clearInterval(interval);
  }, [phase, message]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleText = words.slice(0, revealed).join(" ");
  const archetype = archetypeForSlug(tracks[0]?.slug ?? "meditation");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-7"
      style={{ background: "oklch(0.06 0.01 250 / 0.97)" }}
    >
      {/* Ambient glow */}
      <div aria-hidden className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(60% 55% at 50% 40%, oklch(0.52 0.22 232 / 0.12), transparent 70%)" }} />

      <div className="relative max-w-sm w-full">
        {/* Coach label */}
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-[10px] uppercase tracking-[0.3em] font-mono text-muted-foreground mb-6 text-center"
        >
          {archetype.name} · {t(archetype.taglineKey)}
        </motion.p>

        {/* Message area */}
        <div className="min-h-[120px] flex items-center justify-center">
          {phase === "typing" ? (
            <div className="flex items-center gap-2">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="h-2 w-2 rounded-full bg-muted-foreground"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 0.7, delay: i * 0.15, repeat: Infinity, ease: "easeInOut" }}
                />
              ))}
            </div>
          ) : (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-display text-[1.6rem] leading-[1.25] tracking-[-0.02em] text-center text-foreground"
            >
              {visibleText}
              {revealed < words.length && (
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className="inline-block w-[2px] h-6 bg-foreground ml-1 align-middle"
                />
              )}
            </motion.p>
          )}
        </div>

        {/* CTA — shown once message is fully revealed */}
        <AnimatePresence>
          {phase === "message" && revealed >= words.length && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mt-10 flex justify-center"
            >
              <button
                onClick={onDismiss}
                className="btn-chunk inline-flex items-center gap-2 rounded-full bg-foreground text-neutral-900 px-8 py-3 text-sm font-semibold"
              >
                {t("morning_coach.begin_today")} <ArrowRight className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export { MorningCoachOverlay };
