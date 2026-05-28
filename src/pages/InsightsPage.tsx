import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Mail, BarChart2 } from 'lucide-react';
import type { UserTrack, Log, JourneyDay } from '../types';
import { PatternInsights } from '../components/PatternInsights';
import { AccountabilityCard } from '../components/AccountabilityCard';
import { loadPatternLogs, loadAccountabilityPairs, sendAccountabilityInvite } from '../db.phase5';
import type { EnrichedLog, AccountabilityPair } from '../types';

const LS_DAYS = (slug: string) => `forge-days-${slug}`;

function lsLoad<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

function todayStr() { return new Date().toISOString().slice(0, 10); }
function yesterdayStr() { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); }
function liveStreak(ut: UserTrack): number {
  const t = todayStr();
  const y = yesterdayStr();
  if (ut.vacation_until && ut.vacation_until >= t) return ut.current_streak || 0;
  if (ut.last_log_date === t || ut.last_log_date === y) return ut.current_streak || 0;
  return 0;
}

function InsightsPage({ userTracks, logs, userId }: { userTracks: UserTrack[]; logs: Log[]; userId?: string }) {
  const { t } = useTranslation();
  const [letterLoading, setLetterLoading] = useState(false);
  const [letter, setLetter] = useState<string | null>(null);
  const [showLetter, setShowLetter] = useState(false);
  const [patternLogs, setPatternLogs] = useState<EnrichedLog[]>([]);
  const [accPairs, setAccPairs] = useState<AccountabilityPair[]>([]);

  const generateLetter = async () => {
    setLetterLoading(true);
    try {
      const journeyData = userTracks.map(ut => {
        const days = lsLoad<JourneyDay[]>(LS_DAYS(ut.slug), []);
        const completedDays = days.filter(d => d.completedAt !== null);
        const recentNotes = completedDays
          .filter(d => d.userNote)
          .slice(-7)
          .map(d => `Day ${d.dayNumber}: ${d.userNote}`);
        return { trackName: ut.name, category: ut.category, streak: ut.current_streak || 0, totalDone: ut.total_done || 0, recentNotes };
      });

      const hasNotes = journeyData.some(d => d.recentNotes.length > 0);
      const prompt = `You are a warm, personal growth coach writing a weekly recap letter for someone using the Forge app. Based on their journey data below, write a heartfelt letter (3-4 paragraphs, 150-200 words total) that:
- Acknowledges their specific progress with genuine warmth
${hasNotes ? "- Reflects back meaningful moments from their own notes/reflections — use their actual words where possible" : "- Encourages them to start writing notes after check-ins so you can reflect their journey back to them"}
- Feels deeply personal, never generic or motivational-poster-ish
- Ends with one concrete, specific thing to focus on this week

Their journey data:
${journeyData.map(d => `
${d.trackName} (${d.category})
Streak: ${d.streak} days | Total completed: ${d.totalDone} days
${d.recentNotes.length > 0 ? `Recent reflections:\n${d.recentNotes.join("\n")}` : "No notes yet — they are just getting started"}`).join("\n---\n")}

Start with "This week," and sign it "— Your Coach". Write like you actually know and care about them.`;

      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: "weekly-letter",
          archetype: "mentor",
          messages: [{ role: "user", content: prompt }],
          userContext: { totalTracks: userTracks.length, totalCheckins: logs.length },
        }),
      });
      const data = await res.json() as { message: string };
      setLetter(data.message);
      setShowLetter(true);
    } catch {
      setLetter("Something went wrong generating your letter. Check your connection and try again in a moment.");
      setShowLetter(true);
    } finally {
      setLetterLoading(false);
    }
  };

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

  const monthLabels = useMemo(() => weeks.map((w, i) => {
    if (i === 0) return new Date(w[0].date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' });
    const prev = new Date(weeks[i - 1][0].date + 'T12:00:00');
    const cur  = new Date(w[0].date + 'T12:00:00');
    return prev.getMonth() !== cur.getMonth()
      ? cur.toLocaleDateString('en-US', { month: 'short' })
      : "";
  }), [weeks]);

  const tone = (count: number) => {
    if (count <= 0) return "bg-muted";
    if (count === 1) return "bg-[color:var(--tertiary)]/30";
    if (count === 2) return "bg-[color:var(--tertiary)]/60";
    return "bg-[color:var(--tertiary)]";
  };

  const totalCheckins = logs.length;
  const activeDays = heatmap.filter(d => d.count > 0).length;

  // Weekly comparison
  const todayTs = Date.now();
  const thisWeekStart = todayTs - 7 * 86_400_000;
  const lastWeekStart = todayTs - 14 * 86_400_000;
  const thisWeekCount = logs.filter(l => new Date(l.log_date).getTime() >= thisWeekStart).length;
  const lastWeekCount = logs.filter(l => {
    const t = new Date(l.log_date).getTime();
    return t >= lastWeekStart && t < thisWeekStart;
  }).length;
  const weekDelta = thisWeekCount - lastWeekCount;

  // 28-day bar chart data
  const last28 = useMemo(() => {
    const byDay = new Map<string, number>();
    logs.forEach(l => byDay.set(l.log_date, (byDay.get(l.log_date) || 0) + 1));
    return Array.from({ length: 28 }, (_, i) => {
      const d = new Date(Date.now() - (27 - i) * 86_400_000).toISOString().slice(0, 10);
      return { date: d, count: byDay.get(d) || 0, isToday: i === 27 };
    });
  }, [logs])

  // Phase 5 — load pattern logs and accountability pairs
  useEffect(() => {
    if (!userId) return;
    loadPatternLogs(userId, 30).then(setPatternLogs);
    loadAccountabilityPairs(userId).then(setAccPairs);
  }, [userId]);;
  const maxBar = Math.max(1, ...last28.map(d => d.count));

  // Best streak across all tracks
  const bestStreak = userTracks.reduce((best, t) => Math.max(best, t.longest_streak || 0), 0);

  return (
    <div className="container mx-auto px-6 py-8 max-w-4xl space-y-8">
      <header>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight font-display">{t("insights.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("insights.subtitle")}</p>
        <button onClick={generateLetter} disabled={letterLoading}
          className="mt-4 btn-chunk inline-flex items-center gap-2 rounded-full bg-foreground text-neutral-900 px-5 py-2.5 text-sm font-semibold disabled:opacity-60 transition">
          {letterLoading ? (
            <><span className="h-3.5 w-3.5 rounded-full border-2 border-background/30 border-t-background animate-spin" />{t("insights.generating_letter")}</>
          ) : (
            <><Mail className="h-3.5 w-3.5" />{t("insights.weekly_letter")}</>
          )}
        </button>
      </header>

      {/* Empty state */}
      {totalCheckins === 0 && (
        <div className="rounded-2xl border border-[color:var(--secondary)]/20 bg-[color:var(--secondary)]/5 p-8 text-center space-y-3">
          <div className="h-12 w-12 rounded-full grad-electric flex items-center justify-center mx-auto opacity-70">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <h3 className="font-display text-xl font-semibold">{t("insights.day_one")}</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
            {t("insights.empty_desc")}
          </p>
          <p className="text-xs text-muted-foreground/60 font-mono italic">{t("insights.coach_waiting")}</p>
        </div>
      )}

      {/* Summary row */}
      {totalCheckins > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: t("insights.total_checkins"), value: totalCheckins },
            { label: t("insights.active_days"), value: activeDays },
            { label: t("insights.best_streak"), value: bestStreak, unit: "d" },
            { label: t("insights.active_paths"), value: userTracks.length },
          ].map(s => (
            <div key={s.label} className="rounded-2xl border border-border bg-card p-4 text-center">
              <p className="font-bold text-2xl font-display">{s.value}{s.unit ?? ""}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Weekly comparison */}
      {totalCheckins > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-semibold mb-4">{t("insights.this_vs_last_week")}</h2>
          <div className="flex items-end gap-6">
            {/* Last week bar */}
            <div className="flex flex-col items-center gap-2 flex-1">
              <p className="text-xl font-bold font-display text-muted-foreground">{lastWeekCount}</p>
              <div className="w-full rounded-t-lg bg-muted/60 transition-all" style={{ height: `${Math.round((lastWeekCount / Math.max(1, thisWeekCount, lastWeekCount)) * 80) + 8}px` }} />
              <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">{t("insights.last_week")}</p>
            </div>
            {/* Delta */}
            <div className="flex flex-col items-center gap-1 pb-6 shrink-0">
              <span className={`text-sm font-bold ${weekDelta > 0 ? "text-emerald-400" : weekDelta < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                {weekDelta > 0 ? `+${weekDelta}` : weekDelta === 0 ? "=" : weekDelta}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">vs</span>
            </div>
            {/* This week bar */}
            <div className="flex flex-col items-center gap-2 flex-1">
              <p className="text-xl font-bold font-display" style={{ color: "var(--tertiary)" }}>{thisWeekCount}</p>
              <div className="w-full rounded-t-lg transition-all" style={{ height: `${Math.round((thisWeekCount / Math.max(1, thisWeekCount, lastWeekCount)) * 80) + 8}px`, background: "var(--tertiary)", opacity: 0.8 }} />
              <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">{t("insights.this_week")}</p>
            </div>
          </div>
        </section>
      )}

      {/* 28-day activity bar chart */}
      {totalCheckins > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-semibold mb-4">{t("insights.daily_activity")}</h2>
          <div className="flex items-end gap-[3px] h-16">
            {last28.map(d => (
              <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full" title={`${d.date}: ${d.count} check-in${d.count !== 1 ? "s" : ""}`}>
                <div
                  className={`w-full rounded-t-sm transition-all ${d.isToday ? "opacity-100" : "opacity-70"}`}
                  style={{
                    height: d.count > 0 ? `${Math.max(8, Math.round((d.count / maxBar) * 52))}px` : "3px",
                    background: d.count > 0 ? "var(--tertiary)" : "oklch(1 0 0 / 0.08)",
                    borderRadius: "3px 3px 1px 1px",
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2">
            <p className="text-[9px] text-muted-foreground font-mono">{last28[0]?.date.slice(5)}</p>
            <p className="text-[9px] text-muted-foreground font-mono">{t("insights.today_label")}</p>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">{t("insights.ninety_day")}</h2>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
            <span>less</span>
            {[0,1,2,3].map(v => <div key={v} className={`h-2.5 w-2.5 rounded-sm ${tone(v)}`} />)}
<span>{t("insights.more")}</span>
          </div>
        </div>
        {totalCheckins === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {t("insights.no_activity_yet")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Month labels */}
            <div className="flex gap-1 mb-1">
              {weeks.map((_, i) => (
                <div key={i} className="w-3 shrink-0 text-[8px] text-muted-foreground font-mono leading-none">
                  {monthLabels[i]}
                </div>
              ))}
            </div>
            {/* Day squares */}
            <div className="flex gap-1">
              {weeks.map((w, i) => (
                <div key={i} className="flex flex-col gap-1">
                  {w.map(d => (
                    <div key={d.date} title={`${d.date}: ${d.count} check-in${d.count !== 1 ? "s" : ""}`}
                      className={`h-3 w-3 rounded-sm transition-colors ${tone(d.count)}`} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {userTracks.length > 0 && (
        <section>
          <h2 className="font-semibold mb-3">{t("insights.per_path")}</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {userTracks.map(ut => {
              const streak = liveStreak(ut);
              const best = ut.longest_streak || 0;
              const done = ut.total_done || 0;
              const target = ut.target_days || 30;
              const progressPct = Math.min(1, done / target);
              const streakPct = best > 0 ? Math.min(1, streak / best) : 0;
              return (
                <div key={ut.id} className="rounded-2xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-[15px] leading-tight">{ut.name}</h3>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mt-0.5">{ut.category}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-lg font-display leading-none" style={{ color: streak > 0 ? "var(--tertiary)" : undefined }}>{streak}d</p>
                      <p className="text-[9px] text-muted-foreground font-mono mt-0.5">{t("common.streak")}</p>
                    </div>
                  </div>

                  {/* Journey progress bar */}
                  <div>
                    <div className="flex justify-between text-[10px] text-muted-foreground font-mono mb-1">
                      <span>{t("insights.journey_progress")}</span>
                      <span>{done}/{target} {t("common.days")}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${progressPct * 100}%`, background: "var(--tertiary)" }} />
                    </div>
                  </div>

                  {/* Streak vs best */}
                  {best > 0 && (
                    <div>
                      <div className="flex justify-between text-[10px] text-muted-foreground font-mono mb-1">
                        <span>{t("insights.streak_vs_best")}</span>
                        <span>{streak} / {best}d</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${streakPct * 100}%`, background: streak >= best && best > 0 ? "#f59e0b" : "oklch(0.6 0.22 250)" }} />
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <div className="flex-1 rounded-xl bg-muted/50 p-2 text-center">
                      <p className="font-bold text-sm">{best}d</p>
                      <p className="text-[9px] text-muted-foreground font-mono uppercase mt-0.5">{t("insights.best")}</p>
                    </div>
                    <div className="flex-1 rounded-xl bg-muted/50 p-2 text-center">
                      <p className="font-bold text-sm">{done}</p>
                      <p className="text-[9px] text-muted-foreground font-mono uppercase mt-0.5">{t("insights.done")}</p>
                    </div>
                    <div className="flex-1 rounded-xl bg-muted/50 p-2 text-center">
                      <p className="font-bold text-sm">{target - done > 0 ? target - done : "✓"}</p>
                      <p className="text-[9px] text-muted-foreground font-mono uppercase mt-0.5">{target - done > 0 ? t("insights.left") : t("insights.complete")}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Weekly Letter Modal */}
      <AnimatePresence>
        {showLetter && letter && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowLetter(false)}>
            <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 24 }}
              className="bg-background rounded-3xl p-6 max-w-lg w-full max-h-[82vh] overflow-y-auto shadow-2xl"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-5">
                <div className="h-10 w-10 rounded-full grad-electric flex items-center justify-center shrink-0">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-semibold text-base">{t("insights.weekly_letter")}</p>
                  <p className="text-[11px] text-muted-foreground font-mono">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
                </div>
                <button onClick={() => setShowLetter(false)}
                  className="text-muted-foreground hover:text-foreground text-xl leading-none shrink-0">✕</button>
              </div>
              <div className="rounded-2xl bg-card border border-border p-5">
                <p className="text-sm leading-[1.75] whitespace-pre-line text-foreground">{letter}</p>
              </div>
              <p className="mt-3 text-center text-[10px] text-muted-foreground font-mono">{t("insights.letter_private")}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase 5 — Pattern Insights */}
      {patternLogs.length >= 5 && (
        <PatternInsights logs={patternLogs} />
      )}

      {/* Phase 5 — Accountability Partner */}
      <AccountabilityCard
        pairs={accPairs}
        onSendInvite={async (email: string, shareStreak: boolean, shareMood: boolean) => {
          if (!userId) return;
          await sendAccountabilityInvite(userId, email, shareStreak, shareMood);
          loadAccountabilityPairs(userId).then(setAccPairs);
        }}
      />
    </div>
  );
}
export default InsightsPage;
