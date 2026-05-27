import { useState } from 'react';
import { User as UserIcon, Database, Download, Bell } from 'lucide-react';
import type { UserTrack } from '../types';
import i18n, { STORAGE_KEY } from '../i18n';
import { supabase } from '../supabase';

const LS_LOGS = "forge-logs";
const LS_USER = "forge-user";
const LS_TRACKS = "forge-tracks";
const LS_PREFS = "forge-prefs";
const LS_AUTH = "forge-auth";

function lsLoad<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

function lsSave(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

const FORGE_TITLES = [
  { days: 0, title: 'Newcomer', color: 'text-muted-foreground' },
  { days: 10, title: 'Apprentice', color: 'text-blue-400' },
  { days: 25, title: 'Journeyman', color: 'text-purple-400' },
  { days: 50, title: 'Forge Master', color: 'text-amber-400' },
  { days: 100, title: 'Legend', color: 'text-yellow-300' },
]
function getForgeTitle(tracks: UserTrack[]): { title: string; color: string } {
  const maxStreak = Math.max(0, ...tracks.map(t => t.current_streak ?? 0));
  let result = FORGE_TITLES[0];
  for (const ft of FORGE_TITLES) { if (maxStreak >= ft.days) result = ft; }
  return result;
}

function SettingsPage({ userName, onSignOut, onUpdateName, islandTheme, onChangeTheme , shields, tracks}: { userName: string; onSignOut: () => void; onUpdateName: (name: string) => void; islandTheme: string; onChangeTheme: (t: string) => void ; shields: number; tracks: UserTrack[]}) {
  const [currentLang, setCurrentLang] = useState<string>(i18n.language);
  const [displayName, setDisplayName] = useState(userName);
  const [nameSaved, setNameSaved] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => lsLoad<{ theme: "light" | "dark" }>(LS_PREFS, { theme: "dark" }).theme);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(() => lsLoad<boolean>("forge-notif", false));
  const [reminderOn, setReminderOn] = useState(() => lsLoad<boolean>("forge-reminder-on", false));
  const [reminderTime, setReminderTime] = useState(() => lsLoad<string>("forge-reminder-time", "21:00"));
  const [pushLoading, setPushLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "BLsx3Fhbc_Z2gD4jDBRaIUgwd8A2jAo2aBeTeZ800-y2y4yrbTDCJJoYnfaZk83VNdwKiFN6LciifgkZj5q4US4";

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = "=".repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
  };

  const toggleReminder = async () => {
    setPushError(null);
    if (reminderOn) {
      // Unsubscribe
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      if (reg) {
        const sub = await reg.pushManager.getSubscription().catch(() => null);
        if (sub) await sub.unsubscribe().catch(() => {});
      }
      const userId = lsLoad<{ id: string } | null>(LS_AUTH, null)?.id;
      if (userId) fetch("/api/push-unsubscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) }).catch(() => {});
      setReminderOn(false);
      lsSave("forge-reminder-on", false);
      return;
    }
    // Subscribe
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushError("Push notifications are not supported in this browser.");
      return;
    }
    setPushLoading(true);
    try {
      {/* Language */}
      <div className="settings-section">
        <h2 className="section-title">Language</h2>
        <div className="setting-row">
          <span className="setting-label">App language</span>
          <div style={{display:'flex',gap:'8px',marginTop:'4px'}}>
            {(['en','it'] as const).map(lang => (
              <button
                key={lang}
                onClick={() => { i18n.changeLanguage(lang); localStorage.setItem(STORAGE_KEY, lang); setCurrentLang(lang); }}
                style={{padding:'6px 14px',borderRadius:'8px',border:'1px solid',borderColor:currentLang===lang?'#4f8ef7':'#444',background:currentLang===lang?'#4f8ef7':'transparent',color:'#fff',cursor:'pointer',fontWeight:currentLang===lang?700:400}}
              >
                {lang === 'en' ? 'EN' : 'IT'}
              </button>
            ))}
          </div>
        </div>
      </div>
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setPushError("Permission denied. Enable notifications in browser settings."); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
      const userId = lsLoad<{ id: string } | null>(LS_AUTH, null)?.id;
      const hour = parseInt(reminderTime.split(":")[0], 10);
      if (userId) {
        await fetch("/api/push-subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, subscription: sub, reminderHour: hour }) });
      }
      setReminderOn(true);
      lsSave("forge-reminder-on", true);
    } catch (e) {
      setPushError("Could not enable notifications. Try again.");
    } finally {
      setPushLoading(false);
    }
  };

  const applyTheme = (t: "light" | "dark") => {
    setTheme(t);
    lsSave(LS_PREFS, { theme: t });
    document.documentElement.classList.toggle("dark", t === "dark");
  };

  const handleSaveName = () => {
    if (!displayName.trim()) return;
    onUpdateName(displayName.trim());
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
  };

  const handleExport = () => {
    const data = {
      exported: new Date().toISOString(),
      user: lsLoad(LS_USER, null),
      tracks: lsLoad(LS_TRACKS, []),
      logs: lsLoad(LS_LOGS, []),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "forge-data.json"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearData = () => {
    [LS_USER, LS_TRACKS, LS_LOGS, LS_AUTH].forEach(k => localStorage.removeItem(k));
    onSignOut();
  };
  const handleExport = async () => {
    setExportLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const res = await fetch('/api/user/export', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'forge-data-export.json'; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { console.error('[export]', err); }
    finally { setExportLoading(false); }
  };

  const handleDelete = async () => {
    if (deleteConfirm !== 'DELETE') return;
    setDeleteLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const res = await fetch('/api/user/delete', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Delete failed');
      localStorage.clear();
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (err) { console.error('[delete]', err); setDeleteLoading(false); }
  };


  return (
    <div className="container mx-auto px-6 py-8 max-w-2xl space-y-6">
      <header>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight font-display">Settings</h1>
        <p className="text-muted-foreground mt-1">Account and preferences.</p>
      </header>

      {/* Account */}
      <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted">
            <UserIcon className="h-4 w-4" />
          </span>
          <h2 className="font-semibold">Account</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Your name</label>
            <div className="flex gap-2 mt-1.5">
              <input value={displayName} onChange={e => { setDisplayName(e.target.value); setNameSaved(false); }}
                onKeyDown={e => e.key === "Enter" && handleSaveName()}
                placeholder="What's your name?"
                className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
              <button onClick={handleSaveName}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${nameSaved ? "bg-[color:var(--tertiary)] text-white" : "bg-primary text-primary-foreground"}`}>
                {nameSaved ? "Saved â" : "Save"}
              </button>
            </div>
          </div>
          <button onClick={onSignOut}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted transition">
            Sign out
          </button>
        </div>
      </section>

      {/* Notifications */}
      <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted">
            <Bell className="h-4 w-4" />
          </span>
          <h2 className="font-semibold">Notifications</h2>
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium">Daily reminder</p>
            <p className="text-xs text-muted-foreground">Get a nudge when you haven't checked in yet.</p>
          </div>
          <button
            onClick={toggleReminder}
            disabled={pushLoading}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${reminderOn ? "bg-primary" : "bg-muted"} ${pushLoading ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${reminderOn ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
        {reminderOn && (
                    <div className="flex items-center gap-1.5 py-2 border-t border-border/50 mt-1">
            <p className="text-xs text-muted-foreground">{"You'll get a daily nudge each morning if you haven't checked in."}</p>
          </div>
        )}
        {pushError && <p className="mt-2 text-xs text-[color:var(--secondary)]">{pushError}</p>}
      </section>
            {/* Rank & Shields */}
      <section className="rounded-2xl border border-border bg-card p-5 md:p-6 space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Rank & Shields</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Your Title</p>
            <p className={`text-base font-semibold ${getForgeTitle(tracks).color}`}>{getForgeTitle(tracks).title}</p>
          </div>
          <div className="flex items-center gap-2 bg-white/5 border border-border rounded-xl px-4 py-2">
            <span className="text-lg" aria-hidden="true">ð¡</span>
            <span className="text-xl font-bold text-blue-400">{shields}</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Earn a shield every 10 consecutive days. Auto-used if you miss a day.</p>
      </section>
      {/* Island Theme */}
      <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5.4 7.1 11.5 7.4 11.8.3.2.9.2 1.2 0C12.9 21.5 20 15.4 20 10a8 8 0 0 0-8-8z"/></svg>
          </span>
          <h2 className="font-semibold">Island Theme</h2>
        </div>
        {(() => {
          const lastChanged = Number(localStorage.getItem('forge_island_theme_changed_at') || 0);
          const msLeft = 14 * 24 * 60 * 60 * 1000 - (Date.now() - lastChanged);
          const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
          const onCooldown = msLeft > 0;
          return (
            <>
              <div className="grid grid-cols-2 gap-3 mb-3">
                {[{ key: 'garden', label: 'Garden Island' }, { key: 'mountain', label: 'Mountain Peak' }].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => { if (!onCooldown) onChangeTheme(key); }}
                    disabled={onCooldown && islandTheme !== key}
                    className={`rounded-xl border-2 p-3 text-sm font-medium transition-all ${islandTheme === key ? 'border-blue-500 bg-blue-500/10 text-blue-400' : onCooldown ? 'border-border bg-muted/30 text-muted-foreground opacity-40 cursor-not-allowed' : 'border-border bg-muted/30 text-muted-foreground hover:border-blue-500/50'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {onCooldown ? (
                <p className="text-xs text-muted-foreground">Next change in {daysLeft} day{daysLeft !== 1 ? 's' : ''}</p>
              ) : (
                <p className="text-xs text-muted-foreground">Change available once every 2 weeks</p>
              )}
            </>
          );
        })()}
      </section>

      {/* Data & Privacy */}
      <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted">
            <Database className="h-4 w-4" />
          </span>
          <h2 className="font-semibold">Data & Privacy</h2>
        </div>
        <div className="rounded-xl bg-muted/50 border border-border/50 p-3 mb-4 text-xs text-muted-foreground leading-relaxed">
          Your progress is saved locally and backed up to your account. Sign out to switch accounts.
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between py-3 border-b border-border/50">
            <div>
              <p className="text-sm font-medium">Export data</p>
              <p className="text-xs text-muted-foreground">Download all your paths and logs as JSON</p>
            </div>
            <button onClick={handleExport}
              className="btn-chunk inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted transition">
              <Download className="h-3.5 w-3.5" /> Export
            </button>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-[color:var(--secondary)]">Clear all data</p>
              <p className="text-xs text-muted-foreground">Permanently delete all your paths, logs, and progress</p>
            </div>
            {showClearConfirm ? (
              <div className="flex gap-2">
                <button onClick={() => setShowClearConfirm(false)}
                  className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted transition">
                  Cancel
                </button>
                <button onClick={handleClearData}
                  className="rounded-xl bg-[color:var(--secondary)] text-white px-3 py-2 text-xs font-bold transition">
                  Confirm
                </button>
              </div>
            ) : (
              <button onClick={() => setShowClearConfirm(true)}
                className="btn-chunk rounded-xl border border-[color:var(--secondary)]/30 text-[color:var(--secondary)] px-3 py-2 text-xs font-medium hover:bg-[color:var(--secondary)]/10 transition">
                Clear
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
        <div className="flex items-center gap-3 mb-4">
          <Database className="w-5 h-5 text-muted-foreground" />
          <h2 className="font-semibold">Your Data</h2>
        </div>
        <div className="mb-6">
          <p className="text-sm text-muted-foreground mb-3">Download a copy of all your data — check-ins, journeys, posts.</p>
          <button
            onClick={handleExport}
            disabled={exportLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary text-sm font-medium transition hover:opacity-80 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exportLoading ? 'Preparing...' : 'Export my data'}
          </button>
        </div>
        <div className="border-t border-border pt-5">
          <p className="text-sm font-medium text-red-400 mb-1">Delete account</p>
          <p className="text-xs text-muted-foreground mb-3">Permanently deletes your account and all data. This cannot be undone.</p>
          <input
            type="text"
            placeholder="Type DELETE to confirm"
            value={deleteConfirm}
            onChange={e => setDeleteConfirm(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm mb-3 focus:outline-none"
          />
          <button
            onClick={handleDelete}
            disabled={deleteLoading || deleteConfirm !== 'DELETE'}
            className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium transition hover:opacity-80 disabled:opacity-50"
          >
            {deleteLoading ? 'Deleting...' : 'Delete my account'}
          </button>
        </div>
      </section>    </div>
  );
}

export { SettingsPage };
