import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ArrowRight } from 'lucide-react';
import type { UserTrack } from '../types';
import { GARDEN_STAGES, MOUNTAIN_STAGES } from '../pages/HomePage';

function todayStr() { return new Date().toISOString().slice(0, 10); }

function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const REENTRY_MESSAGES = [
  "You're back. That's all that matters.",
  "The gap doesn't define the path. You're here now.",
  "I migliori non si arrendono â si ripartono. Ricominciamo.",
  "Every great story has a chapter where the main character comes back. This is yours.",
];

const SOS_ALTERNATIVES: Record<string, string[]> = {
  "quit-alcohol": [
    "Call someone you trust right now — even just to talk",
    "Drink a large glass of cold water slowly",
    "Walk outside for 5 minutes, no destination",
    "Write down exactly what triggered this urge",
    "Do 20 push-ups or jumping jacks right now",
    "Text or call a sober support person",
    "Watch a funny video for 10 minutes",
  ],
  "quit-smoking": [
    "Do 10 slow, deep breaths — 4 in, 8 out",
    "Drink a large glass of cold water",
    "Chew gum or eat a healthy snack",
    "Walk outside for 5 minutes",
    "Call or text someone",
    "Do 20 jumping jacks",
    "Write down why you quit",
  ],
  "quit-gambling": [
    "Call someone you trust right now — even just to talk",
    "Leave the area immediately — go somewhere public",
    "Call a helpline: 1-800-522-4700",
    "Write down what you would do with the money you have saved",
    "Think about the last time gambling hurt you — write it down",
    "Do 10 minutes of physical movement",
    "No wallet — no access to cash or cards",
  ],
  "quit-porn": [
    "Close all devices and go somewhere public",
    "Call or text a trusted person",
    "Do 20 push-ups or a physical activity",
    "Write down what triggered this urge",
    "Drink cold water and take 10 deep breaths",
    "Pray, meditate, or read something meaningful",
    "Change your environment immediately",
  ],
  "quit-weed": [
    "Call someone you trust right now",
    "Drink a large glass of cold water slowly",
    "Go for a 10-minute walk outside",
    "Write down exactly what you are feeling",
    "Do 20 jumping jacks or push-ups",
    "Watch or read something engaging",
    "Remind yourself: this craving passes in 15-20 minutes",
  ],
  "binge-eating": [
    "Drink 500ml of water slowly before anything else",
    "Go for a 10-minute walk right now",
    "Call or text someone",
    "Write down what you would do with the money you have saved",
    "Think about the last time gambling hurt you — write it down",
    "Do 10 minutes of physical movement",
  ],
};

const SOS_GENERIC = [
  "Take a slow, deep breath right now — 4 counts in, 8 out",
  "Go to a different room or step outside",
  "Call or text someone you trust",
  "Write down exactly how you are feeling",
  "Do 10 minutes of physical movement",
];

const BREATHE_PHASES = [
  { label: "Breathe in", sub: "through your nose", duration: 4000, targetScale: 1.45 },
  { label: "Hold", sub: "keep it steady", duration: 7000, targetScale: 1.45 },
  { label: "Breathe out", sub: "slowly through your mouth", duration: 8000, targetScale: 0.85 },
  { label: "Hold", sub: "ready for the next breath", duration: 4000, targetScale: 0.85 },
];

const MILESTONE_MESSAGES: Record<number, { emoji: string; title: string; sub: string }> = {
  1:   { emoji: "🌱", title: "Day 1. Done.", sub: "The journey begins now." },
  3:   { emoji: "🔥", title: "3 days straight.", sub: "You're building something real." },
  7:   { emoji: "⚡", title: "One full week.", sub: "Most people quit before this." },
  14:  { emoji: "🏅", title: "Two weeks in.", sub: "Your brain is already changing." },
  21:  { emoji: "💎", title: "21 days.", sub: "A new habit is taking root." },
  30:  { emoji: "🌟", title: "30 days.", sub: "One month. Extraordinary." },
  60:  { emoji: "🚀", title: "60 days.", sub: "Two months of discipline." },
  90:  { emoji: "👑", title: "90 days.", sub: "Three months. You are the proof." },
  180: { emoji: "🏆", title: "180 days.", sub: "Half a year. Legendary." },
  365: { emoji: "🎯", title: "One full year.", sub: "365 days. You changed your life." },
};

function ReEntryOverlay({ gapDays, onDismiss }: { gapDays: number; onDismiss: () => void }) {
  const msg = REENTRY_MESSAGES[hashStr(todayStr()) % REENTRY_MESSAGES.length];
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-7"
      style={{ background: "oklch(0.06 0.01 250 / 0.97)" }}
    >
      <div aria-hidden className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(55% 50% at 50% 40%, oklch(0.645 0.245 25 / 0.10), transparent 70%)" }} />
      <div className="relative max-w-sm w-full text-center">
        <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="text-[10px] uppercase tracking-[0.3em] font-mono text-muted-foreground mb-6">
          Welcome back â {gapDays} days later
        </motion.p>
        <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="font-display text-[2rem] leading-[1.2] tracking-[-0.02em] text-foreground mb-10">
          {msg}
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
          <button onClick={onDismiss}
            className="btn-chunk inline-flex items-center gap-2 rounded-full bg-foreground text-neutral-900 px-8 py-3 text-sm font-semibold">
            Ricominciamo <ArrowRight className="h-4 w-4" />
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}

function StreakRecoveryOverlay({
  brokenStreak,
  trackName,
  onDismiss,
}: {
  brokenStreak: number;
  trackName: string;
  onDismiss: () => void;
}) {
  return (
    <motion.div
      key="streak-recovery"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-7"
      style={{ background: "oklch(0.06 0.01 250 / 0.97)" }}
    >
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(55% 45% at 50% 55%, oklch(0.55 0.2 45 / 0.10), transparent 70%)",
        }}
      />
      <div className="relative max-w-sm w-full text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.88 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 180, damping: 22 }}
          className="mb-0"
        >
          <span
            className="font-display tracking-[-0.06em] leading-none text-foreground/10 select-none"
            style={{ fontSize: "clamp(5.5rem, 30vw, 10rem)" }}
          >
            {brokenStreak}
          </span>
        </motion.div>
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="text-[10px] uppercase tracking-[0.3em] font-mono text-muted-foreground mb-5"
        >
          days on {trackName}
        </motion.p>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="font-display text-[1.75rem] leading-[1.2] tracking-[-0.02em] text-foreground mb-3"
        >
          {"That's still "}{brokenStreak}{" days"}<br />{"you showed up."}
        </motion.p>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="text-sm text-muted-foreground leading-relaxed mb-8 max-w-[264px] mx-auto"
        >
          {"Streaks measure consistency â not worth. Missing one day doesn't erase what you built."}
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mb-8 rounded-2xl border border-border/40 bg-foreground/[0.04] px-5 py-4 text-left"
        >
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" />
            <div>
              <p className="text-xs font-semibold text-foreground mb-1">Shields protect your streak</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {"Forge gives you 1 Shield every 14 days of consistent use â automatically spent when you miss a day. Keep going to earn the next one."}
              </p>
            </div>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85 }}
        >
          <button
            onClick={onDismiss}
            className="btn-chunk inline-flex items-center gap-2 rounded-full bg-foreground text-background px-8 py-3 text-sm font-semibold"
          >
            Start fresh <ArrowRight className="h-4 w-4" />
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}

function SOSOverlay({ tracks, onDismiss }: { tracks: UserTrack[]; onDismiss: () => void }) {
  const [sosPhase, setSosPhase] = useState<"breathe" | "ground" | "act">("breathe");
  const [breatheIdx, setBreatheIdx] = useState(0);
  const [breatheCycles, setBreatheCycles] = useState(0);
  const [breatheScale, setBreatheScale] = useState(0.85);

  useEffect(() => {
    if (sosPhase !== "breathe") return;
    const { duration, targetScale } = BREATHE_PHASES[breatheIdx];
    setBreatheScale(targetScale);
    const t = window.setTimeout(() => {
      const next = (breatheIdx + 1) % 3;
      setBreatheIdx(next);
      if (next === 0) setBreatheCycles(c => c + 1);
    }, duration);
    return () => clearTimeout(t);
  }, [breatheIdx, sosPhase]);

  useEffect(() => {
    if (breatheCycles >= 2 && sosPhase === "breathe") setSosPhase("ground");
  }, [breatheCycles, sosPhase]);

  const primarySlug = tracks[0]?.slug ?? "";
  const alternatives = SOS_ALTERNATIVES[primarySlug] ?? SOS_GENERIC;
  const { label: breatheLabel, sub: breatheSub, duration: breatheDur } = BREATHE_PHASES[breatheIdx];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ background: "oklch(0.05 0.02 230 / 0.98)" }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden"
    >
      {/* ambient glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, oklch(0.35 0.15 230 / 0.12) 0%, transparent 70%)",
        }}
      />

      <AnimatePresence mode="wait">
        {sosPhase === "breathe" && (
          <motion.div
            key="breathe"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative flex flex-col items-center gap-8 px-6"
          >
            <p className="text-sm font-mono tracking-widest text-white/30 uppercase">
              sos â breathing
            </p>

            {/* Breathing circle */}
            <div className="relative flex items-center justify-center">
              <motion.div
                animate={{ scale: breatheScale }}
                transition={{ duration: breatheDur / 1000, ease: "easeInOut" }}
                className="rounded-full"
                style={{
                  width: 180,
                  height: 180,
                  background:
                    "radial-gradient(circle, oklch(0.55 0.18 230 / 0.6) 0%, oklch(0.35 0.15 230 / 0.2) 70%, transparent 100%)",
                  boxShadow: "0 0 60px oklch(0.55 0.18 230 / 0.3)",
                }}
              />
              <div className="absolute flex flex-col items-center gap-1">
                <span className="text-xl font-semibold text-white/90">{breatheLabel}</span>
                <span className="text-xs text-white/40">{breatheSub}</span>
              </div>
            </div>

            {/* Cycle dots */}
            <div className="flex gap-2">
              {[0, 1].map(i => (
                <div
                  key={i}
                  className="h-1.5 w-1.5 rounded-full transition-all duration-500"
                  style={{
                    background:
                      i < breatheCycles
                        ? "oklch(0.75 0.15 230)"
                        : "oklch(0.4 0.05 230 / 0.4)",
                  }}
                />
              ))}
            </div>

            <p className="text-center text-sm text-white/30 max-w-xs">
              2 full cycles â then we ground you
            </p>

            <button
              onClick={() => setSosPhase("ground")}
              className="mt-2 text-xs text-white/20 underline underline-offset-4 hover:text-white/40 transition-colors"
            >
              skip
            </button>
          </motion.div>
        )}

        {sosPhase === "ground" && (
          <motion.div
            key="ground"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative flex flex-col items-center gap-8 px-8 max-w-sm text-center"
          >
            <p className="text-sm font-mono tracking-widest text-white/30 uppercase">
              sos â grounding
            </p>

            <div className="space-y-4">
              <p className="text-2xl font-semibold text-white/90 leading-snug">
                This urge will pass.
              </p>
              <p className="text-2xl font-semibold text-white/90 leading-snug">
                It always does.
              </p>
            </div>

            <div
              className="rounded-2xl p-5 space-y-3 text-left"
              style={{ background: "oklch(0.12 0.03 230 / 0.8)", border: "1px solid oklch(0.3 0.08 230 / 0.3)" }}
            >
              <p className="text-sm font-medium text-white/60">What's happening in your brain</p>
              <p className="text-sm text-white/40 leading-relaxed">
                Urges peak at 15â20 minutes, then naturally subside. Your prefrontal cortex â the part that makes decisions â is temporarily overwhelmed. It will come back online.
              </p>
            </div>

            <button
              onClick={() => setSosPhase("act")}
              className="mt-2 rounded-2xl px-8 py-3.5 font-semibold text-white transition-all active:scale-95"
              style={{
                background: "oklch(0.45 0.18 230)",
                boxShadow: "0 0 20px oklch(0.45 0.18 230 / 0.4)",
              }}
            >
              Show me what to do
            </button>
          </motion.div>
        )}

        {sosPhase === "act" && (
          <motion.div
            key="act"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative flex flex-col items-center gap-6 px-8 max-w-sm w-full"
          >
            <p className="text-sm font-mono tracking-widest text-white/30 uppercase">
              sos â act now
            </p>

            <p className="text-center text-white/70 text-sm">
              Do <strong className="text-white/90">one</strong> of these right now:
            </p>

            <div className="space-y-3 w-full">
              {alternatives.map((alt: string, i: number) => (
                <div
                  key={i}
                  className="flex gap-3 items-start rounded-xl p-4"
                  style={{ background: "oklch(0.12 0.03 230 / 0.7)", border: "1px solid oklch(0.25 0.06 230 / 0.3)" }}
                >
                  <span
                    className="shrink-0 text-xs font-mono font-bold mt-0.5"
                    style={{ color: "oklch(0.65 0.15 230)" }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="text-sm text-white/80 leading-relaxed">{alt}</p>
                </div>
              ))}
            </div>

            <button
              onClick={onDismiss}
              className="mt-2 rounded-2xl px-8 py-3.5 font-semibold text-white transition-all active:scale-95"
              style={{
                background: "oklch(0.35 0.08 230)",
              }}
            >
              I'm okay now
            </button>

            <button
              onClick={() => { setBreatheIdx(0); setBreatheCycles(0); setBreatheScale(0.85); setSosPhase("breathe"); }}
              className="text-xs text-white/20 underline underline-offset-4 hover:text-white/40 transition-colors"
            >
              Breathe again
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SOSButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={() => setHovered(true)}
      onTouchEnd={() => setHovered(false)}
      whileTap={{ scale: 0.94 }}
      className="fixed z-40 flex items-center gap-2 rounded-full shadow-lg transition-all duration-300"
      style={{
        bottom: "5.5rem",
        right: "1rem",
        background: "oklch(0.18 0.05 230 / 0.92)",
        border: "1px solid oklch(0.35 0.1 230 / 0.5)",
        backdropFilter: "blur(12px)",
        padding: hovered ? "0.6rem 1.1rem" : "0.6rem",
        boxShadow: "0 0 20px oklch(0.45 0.18 230 / 0.25)",
      }}
    >
      {/* pulsing dot */}
      <div className="relative shrink-0 h-2.5 w-2.5">
        <div
          className="absolute inset-0 rounded-full animate-ping"
          style={{ background: "oklch(0.65 0.2 15 / 0.6)" }}
        />
        <div
          className="relative rounded-full h-2.5 w-2.5"
          style={{ background: "oklch(0.65 0.2 15)" }}
        />
      </div>
      <AnimatePresence>
        {hovered && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            className="overflow-hidden whitespace-nowrap text-xs font-medium text-white/80"
          >
            I'm struggling
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

function CertModal({ streak, tracks, islandTheme, userName, onDismiss }: {
  streak: number;
  tracks: Array<{ total_done?: number | null }>;
  islandTheme: string;
  userName: string;
  onDismiss: () => void;
}) {
  const total = tracks.reduce((s, t) => s + (t.total_done ?? 0), 0);
  const CT = [0, 5, 12, 25, 50, 90, 150, 230, 330, 450];
  let si = 0;
  for (let i = CT.length - 1; i >= 0; i--) { if (total >= CT[i]) { si = i; break; } }
  const stages = islandTheme === 'mountain' ? MOUNTAIN_STAGES : GARDEN_STAGES;
  const stage = stages[Math.min(si, stages.length - 1)];
  const [imgUrl, setImgUrl] = useState('');
  const [sharing, setSharing] = useState(false);
  useEffect(() => {
    (async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1080; canvas.height = 1080;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#060c18';
      ctx.fillRect(0, 0, 1080, 1080);
      const glow = ctx.createRadialGradient(540, 540, 0, 540, 540, 600);
      glow.addColorStop(0, 'rgba(59,130,246,0.15)');
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, 1080, 1080);
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(60, 60, 960, 5); ctx.fillRect(60, 1015, 960, 5);
      ctx.fillRect(60, 60, 5, 960); ctx.fillRect(1015, 60, 5, 960);
      const diamond = (cx: number, cy: number) => {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#d4af37'; ctx.fillRect(-7, -7, 14, 14); ctx.restore();
      };
      diamond(60, 60); diamond(1020, 60); diamond(60, 1020); diamond(1020, 1020);
      try {
        const img = new Image(); img.crossOrigin = 'anonymous';
        await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = stage.img; });
        ctx.drawImage(img, 290, 195, 500, 500);
      } catch {}
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = 'bold 26px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('â  F O R G E  â', 540, 128);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '500 30px system-ui, sans-serif';
      ctx.fillText('Certificate of Progress', 540, 175);
      ctx.strokeStyle = 'rgba(212,175,55,0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(180, 730); ctx.lineTo(900, 730); ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 110px system-ui, sans-serif';
      ctx.fillText(String(streak), 540, 840);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = 'bold 32px system-ui, sans-serif';
      ctx.fillText('DAYS STRONG', 540, 888);
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.font = '500 36px system-ui, sans-serif';
      ctx.fillText(userName, 540, 950);
      ctx.fillStyle = 'rgba(212,175,55,0.8)';
      ctx.font = '24px system-ui, sans-serif';
      ctx.fillText(stage.name, 540, 995);
      canvas.toBlob(blob => { if (blob) setImgUrl(URL.createObjectURL(blob)); }, 'image/png');
    })();
  }, []);
  const handleShare = async () => {
    if (!imgUrl) return; setSharing(true);
    try {
      const blob = await fetch(imgUrl).then(r => r.blob());
      const file = new File([blob], 'forge-cert.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${streak} Days on Forge`, text: `${streak} consecutive days â certified.` });
      } else { const a = document.createElement('a'); a.href = imgUrl; a.download = 'forge-cert.png'; a.click(); }
    } catch {}
    setSharing(false);
  };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={onDismiss}>
      <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', damping: 22 }}
        className="w-full max-w-sm mb-6 mx-4 rounded-3xl border border-yellow-500/30 bg-[#0d1526] p-5 shadow-2xl"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-medium text-yellow-400/70 uppercase tracking-widest">Certificate</p>
          <button onClick={onDismiss} className="text-muted-foreground hover:text-white text-2xl leading-none">&times;</button>
        </div>
        {imgUrl ? (
          <img src={imgUrl} alt="certificate" className="w-full rounded-2xl mb-4 border border-white/10" />
        ) : (
          <div className="w-full aspect-square rounded-2xl mb-4 bg-white/5 animate-pulse" />
        )}
        <p className="text-center text-lg font-semibold mb-1">{streak} Days Strong</p>
        <p className="text-center text-sm text-muted-foreground mb-4">You showed up. That counts.</p>
        <div className="flex gap-3">
          <button onClick={handleShare} disabled={!imgUrl || sharing}
            className="flex-1 rounded-xl bg-yellow-500 py-3 text-sm font-semibold text-black disabled:opacity-50 active:scale-95 transition-transform">
            {sharing ? 'Sharingâ¦' : 'Share'}
          </button>
          <button onClick={onDismiss} className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-muted-foreground">
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function MilestoneOverlay({ days, trackName, onDismiss }: { days: number; trackName: string; onDismiss: () => void }) {
  const m = MILESTONE_MESSAGES[days] ?? { emoji: "ð¥", title: `Day ${days}!`, sub: "Keep it up." };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ background: "oklch(0.05 0.03 260 / 0.92)" }}>
      <motion.div initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="max-w-sm w-full text-center space-y-5">
        <motion.p initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.15 }}
          className="text-7xl">{m.emoji}</motion.p>
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground font-mono mb-2">{trackName}</p>
          <h2 className="font-display text-4xl font-bold tracking-tight leading-tight">{m.title}</h2>
          <p className="mt-2 text-muted-foreground text-lg">{m.sub}</p>
        </div>
        <button onClick={onDismiss}
          className="btn-chunk inline-flex items-center gap-2 rounded-full grad-electric text-white px-8 py-3.5 text-sm font-bold shadow-[var(--shadow-violet)]">
          Continue <ArrowRight className="h-4 w-4" />
        </button>
      </motion.div>
    </motion.div>
  );
}

export { ReEntryOverlay, StreakRecoveryOverlay, SOSOverlay, SOSButton, CertModal, MilestoneOverlay };
