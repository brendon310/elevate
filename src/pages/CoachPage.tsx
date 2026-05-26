import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import type { UserTrack, JourneyDay, Journey } from '../types';

function MorningCoachOverlay({ tracks, onDismiss }: { tracks: UserTrack[]; onDismiss: () => void }) {
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
          {archetype.tagline}
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
                Begin today <ArrowRight className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export { MorningCoachOverlay };
