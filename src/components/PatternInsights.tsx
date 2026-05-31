import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Log } from '../types';

export interface EnrichedLog extends Log {
  mood?: number | null;
  had_urge?: boolean | null;
  urge_intensity?: number | null;
  trigger_label?: string | null;
  hour_of_day?: number | null;
}

function PatternInsights({ logs }: { logs: EnrichedLog[] }) {
  const { t } = useTranslation();

  const enriched = useMemo(() =>
    logs.filter(l => l.mood != null || l.trigger_label != null || l.hour_of_day != null),
  [logs]);

  const hasUrge = enriched.some(l => l.had_urge != null);
  const hasMood = enriched.some(l => l.mood != null);

  // Top 5 triggers by frequency
  const triggerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    enriched.forEach(l => { if (l.trigger_label && l.had_urge) counts[l.trigger_label] = (counts[l.trigger_label] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [enriched]);

  // Urge frequency by hour (0-23)
  const hourBuckets = useMemo(() => {
    const counts = Array<number>(24).fill(0);
    enriched.forEach(l => { if (l.hour_of_day != null && l.had_urge) counts[l.hour_of_day]++; });
    return counts;
  }, [enriched]);
  const maxHour = Math.max(1, ...hourBuckets);

  // Mood trend — last 14 days
  const moodTrend = useMemo(() => {
    const byDay = new Map<string, number[]>();
    enriched.forEach(l => {
      if (l.mood) { if (!byDay.has(l.log_date)) byDay.set(l.log_date, []); byDay.get(l.log_date)!.push(l.mood!); }
    });
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(Date.now() - (13 - i) * 86400000).toISOString().slice(0, 10);
      const moods = byDay.get(d) || [];
      return { date: d, avg: moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : 0 };
    });
  }, [enriched]);

  // Personalized recommendation — uses t() for translated strings with interpolation
  const recommendation = useMemo(() => {
    if (enriched.length < 3) return null;
    const topTrigger = triggerCounts[0];
    const riskHour = hourBuckets.indexOf(Math.max(...hourBuckets));
    const recentMoods = moodTrend.filter(d => d.avg > 0).slice(-5);
    const avgMood = recentMoods.length ? recentMoods.reduce((a, b) => a + b.avg, 0) / recentMoods.length : 0;

    if (topTrigger && topTrigger[1] >= 3)
      return t('pattern.rec_trigger', { trigger: topTrigger[0].toLowerCase() });
    if (maxHour > 1 && riskHour >= 0) {
      const h = riskHour;
      const label = h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;
      return t('pattern.rec_hour', { hour: label });
    }
    if (avgMood > 0 && avgMood < 4.5)
      return t('pattern.rec_mood_low');
    return t('pattern.rec_data');
  }, [triggerCounts, hourBuckets, moodTrend, enriched.length, maxHour, t]);

  if (enriched.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold mb-2">{t('pattern.your_patterns')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('pattern.empty_state')}
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {/* Coach insight */}
      {recommendation && (
        <section className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
          <p className="text-[10px] font-mono uppercase tracking-wider text-blue-400 mb-2">{t('pattern.coach_insight_label')}</p>
          <p className="text-sm leading-relaxed text-foreground/90">{recommendation}</p>
        </section>
      )}

      {/* Top triggers */}
      {hasUrge && triggerCounts.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-semibold mb-3">{t('pattern.top_triggers')}</h2>
          <div className="space-y-2">
            {triggerCounts.map(([label, count], i) => {
              const pct = Math.round((count / triggerCounts[0][1]) * 100);
              return (
                <div key={label}>
                  <div className="flex justify-between text-xs text-muted-foreground font-mono mb-1">
                    <span>{label}</span><span>{count}×</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: i === 0 ? 'var(--secondary)' : 'oklch(0.6 0.15 250)', opacity: 1 - i * 0.15 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Risky hours */}
      {hasUrge && maxHour > 1 && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-semibold mb-3">{t('pattern.urge_by_hour')}</h2>
          <div className="flex items-end gap-0.5 h-10">
            {hourBuckets.map((count, h) => (
              <div key={h} className="flex-1 rounded-t-sm transition-all"
                title={t('pattern.urge_tooltip', { count, h })}
                style={{
                  height: count > 0 ? `${Math.max(4, Math.round((count / maxHour) * 36))}px` : '3px',
                  background: count > 0 ? 'var(--secondary)' : 'oklch(1 0 0 / 0.07)',
                  opacity: count > 0 ? Math.max(0.3, count / maxHour) : 1,
                  borderRadius: '3px 3px 1px 1px',
                }} />
            ))}
          </div>
          <div className="flex justify-between mt-1.5 text-[9px] text-muted-foreground font-mono">
            <span>{t('pattern.hour_12am')}</span>
            <span>{t('pattern.hour_6am')}</span>
            <span>{t('pattern.hour_12pm')}</span>
            <span>{t('pattern.hour_6pm')}</span>
            <span>{t('pattern.hour_11pm')}</span>
          </div>
        </section>
      )}

      {/* Mood trend */}
      {hasMood && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-semibold mb-3">{t('pattern.mood_title')}</h2>
          <div className="flex items-end gap-[3px] h-12">
            {moodTrend.map(d => (
              <div key={d.date} className="flex-1 flex flex-col justify-end h-full"
                title={`${d.date}: ${d.avg > 0 ? d.avg.toFixed(1) : 'no data'}`}>
                <div className="w-full rounded-t-sm transition-all"
                  style={{
                    height: d.avg > 0 ? `${Math.max(4, Math.round((d.avg / 10) * 44))}px` : '2px',
                    background: d.avg > 0
                      ? d.avg >= 7 ? 'oklch(0.65 0.2 145)' : d.avg >= 4 ? 'oklch(0.65 0.18 60)' : 'oklch(0.55 0.2 20)'
                      : 'oklch(1 0 0 / 0.06)',
                    borderRadius: '3px 3px 1px 1px',
                  }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2">
            <p className="text-[9px] text-muted-foreground font-mono">{moodTrend[0]?.date.slice(5)}</p>
            <p className="text-[9px] text-muted-foreground font-mono">{t('pattern.today')}</p>
          </div>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {[
              { color: 'oklch(0.65 0.2 145)', key: 'pattern.legend_good' },
              { color: 'oklch(0.65 0.18 60)',  key: 'pattern.legend_ok' },
              { color: 'oklch(0.55 0.2 20)',   key: 'pattern.legend_tough' },
            ].map(s => (
              <div key={s.key} className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                <span className="text-[9px] text-muted-foreground font-mono">{t(s.key)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export { PatternInsights };
