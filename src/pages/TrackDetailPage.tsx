import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sun } from 'lucide-react';
import type { UserTrack, Journey, JourneyDay } from '../types';
import * as db from '../db';
import { JourneyOnboarding, JourneyView } from './JourneyPage';

const LS_DAYS = (slug: string) => `forge-days-${slug}`;
const LS_JOURNEY = (slug: string) => `forge-journey-${slug}`;

function lsLoad<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

function lsSave(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

function todayStr() { return new Date().toISOString().slice(0, 10); }

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

function TrackDetailPage({ track, onBack, showCheckInHint, onTrackCheckIn, onVacation, onRestart, userId }: {
  track: UserTrack;
  onBack: () => void;
  showCheckInHint?: boolean;
  onTrackCheckIn?: () => void;
  onVacation?: (trackId: string, until: string) => void;
  onRestart?: (trackId: string) => void;
  userId?: string | null;
}) {
  const { t } = useTranslation();
  const { i18n } = useTranslation();
  const [journey, setJourney] = useState<Journey | null>(() => {
    const j = lsLoad<Journey | null>(LS_JOURNEY(track.slug), null);
    const rawDays = lsLoad<JourneyDay[]>(LS_DAYS(track.slug), []);
    const storedLang = localStorage.getItem(`forge-days-lang-${track.slug}`) ?? 'en';
    if (j && storedLang !== i18n.language && rawDays.length > 0) {
      const completed = rawDays.filter(d => d.completedAt !== null);
      return { ...j, generatedThrough: completed.length };
    }
    return j;
  });
  const [days, setDays] = useState<JourneyDay[]>(() => {
    const rawDays = lsLoad<JourneyDay[]>(LS_DAYS(track.slug), []);
    const storedLang = localStorage.getItem(`forge-days-lang-${track.slug}`) ?? 'en';
    if (storedLang !== i18n.language && rawDays.length > 0) {
      const completed = rawDays.filter(d => d.completedAt !== null);
      lsSave(LS_DAYS(track.slug), completed);
      localStorage.setItem(`forge-days-lang-${track.slug}`, i18n.language);
      return completed;
    }
    return rawDays;
  });

  // Load journey days from Supabase if localStorage is empty (cross-device / cleared cache)
  useEffect(() => {
    if (!userId || days.length > 0) return;
    db.loadJourneyDays(userId, track.slug).then(dbDays => {
      if (dbDays.length === 0) return;
      const mapped = dbDays.map(d => ({
        id: d.id, journeyId: d.journey_id ?? "", dayNumber: d.day_number,
        title: d.title ?? "", description: d.description ?? "",
        task: d.task ?? "", reflection: d.reflection ?? "",
        science: d.science ?? "", checkinPrompt: d.checkin_prompt ?? "",
        completedAt: d.completed_at ?? null, userNote: d.user_note ?? null,
      })) as JourneyDay[];
      lsSave(LS_DAYS(track.slug), mapped);
      setDays(mapped);
    }).catch(() => {});
    db.loadJourneys(userId).then(dbJourneys => {
      const j = dbJourneys.find(j => j.track_slug === track.slug);
      if (!j || journey) return;
      const mapped: Journey = {
        id: j.id, trackSlug: j.track_slug, totalDays: j.total_days,
        startingPoint: j.starting_point ?? "", motivation: j.motivation ?? "",
        obstacle: j.obstacle ?? "", startedAt: j.started_at ?? "",
        generatedThrough: j.generated_through ?? 0,
      };
      lsSave(LS_JOURNEY(track.slug), mapped);
      setJourney(mapped);
    }).catch(() => {});
  }, [userId, track.slug]);

  const handleStarted = (j: Journey, d: JourneyDay[]) => { setJourney(j); setDays(d); };
  const onVac = track.vacation_until && track.vacation_until >= todayStr();

  const inner = !journey || days.length === 0
    ? <JourneyOnboarding track={track} onStarted={handleStarted} userId={userId} />
    : <JourneyView track={track} journey={journey} days={days} onBack={onBack} showCheckInHint={showCheckInHint} onTrackCheckIn={onTrackCheckIn} onRestart={onRestart} userId={userId} />;

  return (
    <div className="relative min-h-screen">
      {/* Main content — blurred when on vacation */}
      <div className={onVac ? "blur-sm pointer-events-none select-none" : ""}>
        {inner}
      </div>
      {/* Vacation overlay */}
      {onVac && (
        <div className="fixed inset-0 z-30 flex flex-col items-center justify-center"
          style={{ background: "oklch(0.14 0.07 220 / 0.88)" }}>
          <SnowfallBackground count={55} speed={0.8} />
          <div className="relative z-10 text-center space-y-4 px-8">
            <p className="font-display text-6xl font-bold text-white tracking-tight"
              style={{ textShadow: "0 0 40px rgba(160,210,255,0.6)" }}>
              {t("tracks.frozen")}
            </p>
            <p className="text-white/60 text-sm font-mono tracking-widest uppercase">
              {t("tracks.streak_protected_until", { date: track.vacation_until })}
            </p>
            <button
              onClick={() => onVacation?.(track.id, "")}
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-6 py-2.5 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/20 transition">
              <Sun className="h-4 w-4" />
              {t("tracks.end_vacation")}
            </button>
            <button onClick={onBack}
              className="block text-xs text-white/40 hover:text-white/70 transition font-mono mx-auto pt-2">
              {t("common.go_back")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export { TrackDetailPage };
