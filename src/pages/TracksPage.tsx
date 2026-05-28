import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Check, Plus, Search } from 'lucide-react';
import type { UserTrack } from '../types';

const ALL_TRACKS = [
  // ── Fitness & Body ──────────────────────────────────────────────────────────
  { id: "1",  slug: "meditation",          name: "Meditation",           category: "Mental Health",       short_description: "Train your mind to find stillness." },
  { id: "2",  slug: "morning-run",         name: "Morning Run",          category: "Fitness & Body",      short_description: "Build your aerobic base." },
  { id: "3",  slug: "strength-training",   name: "Strength Training",    category: "Fitness & Body",      short_description: "Progressive overload for strength." },
  { id: "4",  slug: "quit-smoking",        name: "Quit Smoking",         category: "Quit Bad Habits",     short_description: "Allen Carr method." },
  { id: "5",  slug: "deep-work",           name: "Deep Work",            category: "Productivity & Life", short_description: "Cal Newport's framework." },
  { id: "6",  slug: "reading",             name: "Daily Reading",        category: "Mind & Learning",     short_description: "Feynman technique for retention." },
  { id: "7",  slug: "sleep-routine",       name: "Sleep Routine",        category: "Fitness & Body",      short_description: "Sleep science protocols." },
  { id: "8",  slug: "anxiety-relief",      name: "Anxiety Relief",       category: "Mental Health",       short_description: "CBT for anxiety." },
  { id: "9",  slug: "journaling",          name: "Journaling",           category: "Mind & Learning",     short_description: "Reflective writing practice." },
  { id: "10", slug: "cold-exposure",       name: "Cold Exposure",        category: "Fitness & Body",      short_description: "Hormetic stress protocol." },
  { id: "11", slug: "no-social-media",     name: "No Social Media",      category: "Quit Bad Habits",     short_description: "Digital detox protocol." },
  // ── Addiction & Recovery ────────────────────────────────────────────────────
  { id: "12", slug: "quit-alcohol",        name: "Quit Alcohol",         category: "Addiction & Recovery",short_description: "Break free from alcohol dependency." },
  { id: "13", slug: "quit-pornography",    name: "Quit Pornography",     category: "Addiction & Recovery",short_description: "Rewire your brain, reclaim your life." },
  { id: "14", slug: "quit-drugs",          name: "Quit Drugs",           category: "Addiction & Recovery",short_description: "Structured sobriety roadmap." },
  { id: "15", slug: "quit-gambling",       name: "Quit Gambling",        category: "Addiction & Recovery",short_description: "Break the cycle of compulsive betting." },
  { id: "16", slug: "binge-eating",        name: "Stop Binge Eating",    category: "Addiction & Recovery",short_description: "Heal your relationship with food." },
  { id: "17", slug: "video-game-addiction",name: "Video Game Addiction", category: "Addiction & Recovery",short_description: "Regain control over gaming." },
  { id: "18", slug: "compulsive-shopping", name: "Compulsive Shopping",  category: "Addiction & Recovery",short_description: "Break the buy-to-feel-good loop." },
  // ── Quit Bad Habits ─────────────────────────────────────────────────────────
  { id: "20", slug: "no-sugar",            name: "No Sugar",             category: "Quit Bad Habits",     short_description: "End sugar dependency for good." },
  // ── Productivity & Life ─────────────────────────────────────────────────────
  { id: "22", slug: "beat-procrastination",name: "Beat Procrastination", category: "Productivity & Life", short_description: "Act before the voice says 'later'." },
  { id: "23", slug: "build-discipline",    name: "Build Discipline",     category: "Productivity & Life", short_description: "The daily reps that form an identity." },
  // ── Mental Health ────────────────────────────────────────────────────────────
  { id: "26", slug: "stop-overthinking",   name: "Stop Overthinking",    category: "Mental Health",       short_description: "Silence the mental noise loop." },
  { id: "27", slug: "social-anxiety",      name: "Social Anxiety",       category: "Mental Health",       short_description: "Show up without the inner terror." },
  { id: "28", slug: "anger-management",    name: "Anger Management",     category: "Mental Health",       short_description: "Transform rage into responsive power." },
  { id: "29", slug: "chronic-stress",      name: "Chronic Stress",       category: "Mental Health",       short_description: "Regulate your nervous system daily." },
  { id: "30", slug: "social-isolation",    name: "Social Isolation",     category: "Mental Health",       short_description: "Bridge back to human connection." },
  { id: "31", slug: "negative-mindset",    name: "Negative Mindset",     category: "Mental Health",       short_description: "Rewire pessimistic thought patterns." },
  { id: "32", slug: "breathwork",          name: "Breathwork",           category: "Mental Health",       short_description: "Use breath to shift state instantly." },
  // ── Psychology & Self ────────────────────────────────────────────────────────
  { id: "33", slug: "low-self-esteem",     name: "Low Self-Esteem",      category: "Psychology & Self",   short_description: "Build unshakeable self-worth." },
  { id: "34", slug: "need-for-approval",   name: "Need for Approval",    category: "Psychology & Self",   short_description: "Stop outsourcing your self-worth." },
  { id: "35", slug: "fear-of-failure",     name: "Fear of Failure",      category: "Psychology & Self",   short_description: "Act despite the outcome." },
  { id: "36", slug: "fear-of-judgment",    name: "Fear of Judgment",     category: "Psychology & Self",   short_description: "Live beyond others' opinions." },
  { id: "37", slug: "emotional-dependency",name: "Emotional Dependency", category: "Psychology & Self",   short_description: "Become your own emotional anchor." },
  { id: "38", slug: "toxic-relationships", name: "Toxic Relationships",  category: "Psychology & Self",   short_description: "Identify and exit unhealthy bonds." },
  { id: "39", slug: "control-issues",      name: "Control Issues",       category: "Psychology & Self",   short_description: "Release control, find real power." },
  { id: "42", slug: "stop-self-sabotage",  name: "Stop Self-Sabotage",   category: "Psychology & Self",   short_description: "Interrupt the patterns that hold you back." },
  { id: "44", slug: "toxic-perfectionism", name: "Toxic Perfectionism",  category: "Psychology & Self",   short_description: "Done beats perfect, every single time." },
  { id: "45", slug: "jealousy",            name: "Jealousy",             category: "Psychology & Self",   short_description: "Transform jealousy into self-awareness." },
  // ── Financial Health ─────────────────────────────────────────────────────────
  { id: "47", slug: "money-management",    name: "Money Management",     category: "Financial Health",    short_description: "Build financial clarity and control." },
  // ── Mind & Learning ──────────────────────────────────────────────────────────
  { id: "49", slug: "sedentary-lifestyle", name: "Sedentary Lifestyle",  category: "Fitness & Body",      short_description: "Move a little every day, forever." },
  { id: "50", slug: "gratitude",           name: "Gratitude Practice",   category: "Mind & Learning",     short_description: "Rewire your brain for abundance." },
];


const DURATION_PRESETS = [30, 60, 90, 120, 180, 365] as const;

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
              {d === 365 ? t("tracks.one_year_label") : `${d}d`}
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

function TracksPage({ userTracks, onAdd, onView, onRemove }: {
  userTracks: UserTrack[];
  onAdd: (t: typeof ALL_TRACKS[0], days: number) => void;
  onView: (t: UserTrack) => void;
  onRemove: (id: string) => void;
}) {
  const { t } = useTranslation();
  const tn = (slug: string, name: string) => t(`tracks.${slug}.name`, { defaultValue: name });
  const tc = (cat: string) => t(`categories.${cat}`, { defaultValue: cat });
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [pendingAdd, setPendingAdd] = useState<typeof ALL_TRACKS[0] | null>(null);
  const activeMap = new Map(userTracks.map(u => [u.track_id, u]));
  const allCategories = useMemo(() => Array.from(new Set(ALL_TRACKS.map(t => t.category))), []);
  const q = search.toLowerCase().trim();
  const filtered = ALL_TRACKS.filter(t => {
    const matchesSearch = !q || t.name.toLowerCase().includes(q) || t.short_description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
    const matchesCat = !categoryFilter || t.category === categoryFilter;
    return matchesSearch && matchesCat;
  });
  const grouped = filtered.reduce<Record<string, typeof ALL_TRACKS>>((acc, t) => {
    (acc[t.category] ??= []).push(t); return acc;
  }, {});

  return (
    <>
    <div className="max-w-5xl mx-auto px-5 py-8 pb-24">
      <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground font-mono">{t("tracks.library")}</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">{t("tracks.headline")}</h1>
      <p className="mt-2 text-foreground">{t("tracks.subheadline")}</p>
      <div className="mt-6 relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t("tracks.search_placeholder")}
          className="w-full rounded-xl border border-border bg-card pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring transition"
        />
        {search && (
          <button onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-base leading-none">
            ✕
          </button>
        )}
      </div>
      {/* Category filter chips */}
      <div className="mt-3 flex gap-2 flex-wrap">
        <button
          onClick={() => setCategoryFilter(null)}
          className={`rounded-full px-3.5 py-1.5 text-[11px] font-semibold border transition-colors ${!categoryFilter ? "bg-foreground text-neutral-900 border-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>
          {t("tracks.all")}
        </button>
        {allCategories.map(cat => (
          <button key={cat}
            onClick={() => setCategoryFilter(cat === categoryFilter ? null : cat)}
            className={`rounded-full px-3.5 py-1.5 text-[11px] font-semibold border transition-colors ${categoryFilter === cat ? "bg-foreground text-neutral-900 border-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>
            {cat}
          </button>
        ))}
      </div>
      {Object.keys(grouped).length === 0 && (
        <div className="mt-12 text-center text-muted-foreground text-sm">
          {t("tracks.no_match", { q: search })}
        </div>
      )}
      <div className="mt-8 space-y-10">
        {Object.entries(grouped).map(([cat, tracks]) => (
          <section key={cat}>
            <h2 className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground font-mono mb-4">{cat}</h2>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {tracks.map((track, i) => {
                const ut = activeMap.get(track.id);
                const on = !!ut;
                return (
                  <motion.div key={track.id} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                    className="warm-card rounded-2xl p-5 flex flex-col gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.25em] font-mono text-muted-foreground">{tc(track.category)}</p>
                      <h3 className="mt-1 font-semibold text-[15px]">{tn(track.slug, track.name)}</h3>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{track.short_description}</p>
                    </div>
                    {on && ut ? (
                      <div className="flex gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold bg-[color:var(--tertiary)]/15 text-[color:var(--tertiary)]">
                          <Check className="h-3 w-3" />{t("tracks.active")}
                        </span>
                        <button onClick={() => onView(ut)}
                          className="btn-chunk inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-semibold bg-foreground text-neutral-900 transition">
                          {t("tracks.view")} <ArrowRight className="h-3 w-3" />
                        </button>
                        <button onClick={() => { if (confirm(t("tracks.remove_confirm", { name: track.name }))) onRemove(ut.id); }}
                          className="btn-chunk inline-flex items-center rounded-full px-2.5 py-1.5 text-xs border border-[color:var(--secondary)]/30 text-[color:var(--secondary)] hover:bg-[color:var(--secondary)]/10 transition"
                          title="Remove track">
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setPendingAdd(track)}
                        className="btn-chunk self-start inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-semibold bg-foreground text-neutral-900 transition">
                        <Plus className="h-3 w-3" />{t("tracks.start")}
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
    <AnimatePresence>
      {pendingAdd && (
        <DurationPickerModal
          trackName={pendingAdd.name}
          onConfirm={days => { onAdd(pendingAdd, days); setPendingAdd(null); }}
          onCancel={() => setPendingAdd(null)}
        />
      )}
    </AnimatePresence>
    </>
  );
}

export { TracksPage };
