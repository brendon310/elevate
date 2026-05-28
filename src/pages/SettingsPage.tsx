import { useState } from 'react';
import { User as UserIcon, Database, Download, Bell, Globe, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../supabase';
import type { SupportedLanguage } from '../i18n';
import type { UserTrack } from '../types';

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
];

function getForgeTitle(tracks: UserTrack[]): { title: string; color: string } {
  const maxStreak = Math.max(0, ...tracks.map(t => t.current_streak ?? 0));
  let result = FORGE_TITLES[0];
  for (const ft of FORGE_TITLES) { if (maxStreak >= ft.days) result = ft; }
  return result;
}

function SettingsPage({
  userName, onSignOut, onUpdateName, islandTheme, onChangeTheme, shields, tracks
}: {
  userName: string;
  onSignOut: () => void;
  onUpdateName: (name: string) => void;
  islandTheme: string;
  onChangeTheme: (t: string) => void;
  shields: number;
  tracks: UserTrack[];
}) {
  const { t, i18n } = useTranslation();

  const [displayName, setDisplayName] = useState(userName);
  const [nameSaved, setNameSaved] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [reminderOn, setReminderOn] = useState(() => lsLoad<boolean>("forge-reminder-on", false));
  const [reminderTime] = useState(() => lsLoad<string>("forge-reminder-time", "21:00"));
  const [pushLoading, setPushLoading] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  // GDPR state
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "BLsx3Fhbc_Z2gD4jDBRaIUgwd8A2jAo2aBeTeZ800-y2y4yrbTDCJJoYnfaZk83VNdwKiFN6LciifgkZj5q4US4";

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = "=".repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
  };

  const handleLangChange = (lang: SupportedLanguage) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('forge_lang', lang);
  };

  const toggleReminder = async () => {
    setPushError(null);
    if (reminderOn) {
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      if (reg) {
        const sub = await reg.pushManager.getSubscription().catch(() => null);
        if (sub) await sub.unsubscribe().catch(() => {});
      }
      const userId = lsLoad<{ id: string } | null>(LS_AUTH, null)?.id;
      if (userId) fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, action: 'unsubscribe' }) }).catch(() => {});
      setReminderOn(false);
      lsSave("forge-reminder-on", false);
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
setPushError(t("settings.push_not_supported"));
      return;
    }
    setPushLoading(true);
    try {
      const perm = await Notification.requestPermission();
if (perm !== "granted") { setPushError(t("settings.push_permission_denied")); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
      const userId = lsLoad<{ id: string } | null>(LS_AUTH, null)?.id;
      const hour = parseInt(reminderTime.split(":")[0], 10);
      if (userId) {
        await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, subscription: sub, reminderHour: hour }) });
      }
      setReminderOn(true);
      lsSave("forge-reminder-on", true);
    } catch {
setPushError(t("settings.push_error"));
    } finally {
      setPushLoading(false);
    }
  };

  const handleSaveName = () => {
    if (!displayName.trim()) return;
    onUpdateName(displayName.trim());
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
  };

  // GDPR: export all data from Supabase
  const handleExport = async () => {
    setExportLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (token) {
        const resp = await fetch('/api/user/export', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'forge-data-export.json';
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // Fallback: export localStorage data
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
      }
    } catch {
      // Silent fail
    } finally {
      setExportLoading(false);
    }
  };

  // GDPR: delete account and all data
  const handleDeleteAccount = async () => {
    const confirmWord = t('gdpr.delete_confirm_word');
    if (deleteConfirm !== confirmWord) return;
    setDeleteLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (token) {
        await fetch('/api/user/delete', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      // Clear local storage and sign out
      [LS_USER, LS_TRACKS, LS_LOGS, LS_AUTH, LS_PREFS].forEach(k => localStorage.removeItem(k));
      await supabase.auth.signOut();
      onSignOut();
    } catch {
      setDeleteLoading(false);
    }
  };

  const handleClearData = () => {
    [LS_USER, LS_TRACKS, LS_LOGS, LS_AUTH].forEach(k => localStorage.removeItem(k));
    onSignOut();
  };

  const forgeTitle = getForgeTitle(tracks);

  return (
    <div className="container mx-auto px-6 py-8 max-w-2xl space-y-6">
      <header>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight font-display">{t('settings.title')}</h1>
        <p className="text-muted-foreground mt-1">{t("settings.subtitle")}</p>
      </header>

      {/* Account */}
      <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted">
            <UserIcon className="h-4 w-4" />
          </span>
          <h2 className="font-semibold">{t("settings.account")}</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">{t("settings.your_name")}</label>
            <div className="flex gap-2 mt-1.5">
              <input value={displayName} onChange={e => { setDisplayName(e.target.value); setNameSaved(false); }}
                onKeyDown={e => e.key === "Enter" && handleSaveName()}
                placeholder={t("settings.name_placeholder")}
                className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
              <button onClick={handleSaveName}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${nameSaved ? "bg-[color:var(--tertiary)] text-white" : "bg-primary text-primary-foreground"}`}>
{nameSaved ? t("common.saved") : t("common.save")}
              </button>
            </div>
          </div>
          <button onClick={onSignOut}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted transition">
            {t('settings.logout')}
          </button>
        </div>
      </section>

      {/* Language */}
      <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted">
            <Globe className="h-4 w-4" />
          </span>
          <h2 className="font-semibold">{t('settings.language')}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {([
            { code: 'en', label: 'English' },
            { code: 'it', label: 'Italiano' },
            { code: 'es', label: 'Español' },
            { code: 'fr', label: 'Français' },
            { code: 'pt', label: 'Português' },
            { code: 'de', label: 'Deutsch' },
          ] as { code: import('../i18n').SupportedLanguage; label: string }[]).map(({ code, label }) => (
            <button
              key={code}
              onClick={() => handleLangChange(code)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${i18n.language === code ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Notifications */}
      <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted">
            <Bell className="h-4 w-4" />
          </span>
          <h2 className="font-semibold">{t('settings.notifications')}</h2>
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium">{t('settings.reminder_time')}</p>
            <p className="text-xs text-muted-foreground">{t("settings.notifications_desc")}</p>
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
            <p className="text-xs text-muted-foreground">{t("settings.notifications_active")}</p>
          </div>
        )}
        {pushError && <p className="mt-2 text-xs text-[color:var(--secondary)]">{pushError}</p>}
      </section>

      {/* Rank & Shields */}
      <section className="rounded-2xl border border-border bg-card p-5 md:p-6 space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-widest">{t("settings.rank_shields")}</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">{t("settings.your_title")}</p>
            <p className={`text-base font-semibold ${forgeTitle.color}`}>{forgeTitle.title}</p>
          </div>
          <div className="flex items-center gap-2 bg-white/5 border border-border rounded-xl px-4 py-2">
            <span className="text-xl font-bold text-blue-400">{shields}</span>
<span className="text-xs text-muted-foreground">{t("settings.shields")}</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{t("settings.shields_desc")}</p>
      </section>

      {/* Island Theme */}
      <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5.4 7.1 11.5 7.4 11.8.3.2.9.2 1.2 0C12.9 21.5 20 15.4 20 10a8 8 0 0 0-8-8z"/></svg>
          </span>
          <h2 className="font-semibold">{t("settings.island_theme")}</h2>
        </div>
        {(() => {
          const lastChanged = Number(localStorage.getItem('forge_island_theme_changed_at') || 0);
          const msLeft = 14 * 24 * 60 * 60 * 1000 - (Date.now() - lastChanged);
          const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
          const onCooldown = msLeft > 0;
          return (
            <>
              <div className="grid grid-cols-2 gap-3 mb-3">
                {[{ key: 'garden', label: t('settings.garden_island') }, { key: 'mountain', label: t('settings.mountain_peak') }].map(({ key, label }) => (
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
                <p className="text-xs text-muted-foreground">{t("settings.theme_cooldown", { n: daysLeft })}</p>
              ) : (
                <p className="text-xs text-muted-foreground">{t("settings.theme_available")}</p>
              )}
            </>
          );
        })()}
      </section>

      {/* Data & Privacy (GDPR) */}
      <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted">
            <Database className="h-4 w-4" />
          </span>
          <h2 className="font-semibold">{t("settings.data_privacy")}</h2>
        </div>
        <div className="rounded-xl bg-muted/50 border border-border/50 p-3 mb-4 text-xs text-muted-foreground leading-relaxed">
{t("settings.data_desc")}
        </div>
        <div className="space-y-1">
          {/* Export */}
          <div className="flex items-center justify-between py-3 border-b border-border/50">
            <div>
              <p className="text-sm font-medium">{t('gdpr.export_title')}</p>
              <p className="text-xs text-muted-foreground">{t('gdpr.export_desc')}</p>
            </div>
            <button onClick={handleExport} disabled={exportLoading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted transition disabled:opacity-50">
              <Download className="h-3.5 w-3.5" />
              {exportLoading ? t('settings.exporting') : t('gdpr.export_btn')}
            </button>
          </div>

          {/* Delete account */}
          <div className="py-3 border-b border-border/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[color:var(--secondary)]">{t('gdpr.delete_title')}</p>
                <p className="text-xs text-muted-foreground">{t('gdpr.delete_desc')}</p>
              </div>
              {!showDeleteConfirm && (
                <button onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--secondary)]/30 text-[color:var(--secondary)] px-3 py-2 text-xs font-medium hover:bg-[color:var(--secondary)]/10 transition">
                  <Trash2 className="h-3.5 w-3.5" />
                  {t('gdpr.delete_btn')}
                </button>
              )}
            </div>
            {showDeleteConfirm && (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-muted-foreground">{t('gdpr.delete_confirm')}</p>
                <input
                  value={deleteConfirm}
                  onChange={e => setDeleteConfirm(e.target.value)}
                  placeholder={t('gdpr.delete_confirm_word')}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--secondary)]"
                />
                <div className="flex gap-2">
                  <button onClick={() => { setShowDeleteConfirm(false); setDeleteConfirm(''); }}
                    className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted transition">
                    {t("common.cancel")}
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirm !== t('gdpr.delete_confirm_word') || deleteLoading}
                    className="flex-1 rounded-xl bg-[color:var(--secondary)] text-white px-3 py-2 text-xs font-bold transition disabled:opacity-40">
                    {deleteLoading ? t('settings.deleting') : t('gdpr.delete_btn')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Clear local data */}
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-[color:var(--secondary)]">{t("settings.clear_local_data")}</p>
              <p className="text-xs text-muted-foreground">{t("settings.clear_local_desc")}</p>
            </div>
            {showClearConfirm ? (
              <div className="flex gap-2">
                <button onClick={() => setShowClearConfirm(false)}
                  className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted transition">
                  {t("common.cancel")}
                </button>
                <button onClick={handleClearData}
                  className="rounded-xl bg-[color:var(--secondary)] text-white px-3 py-2 text-xs font-bold transition">
                  {t("common.confirm")}
                </button>
              </div>
            ) : (
              <button onClick={() => setShowClearConfirm(true)}
                className="rounded-xl border border-[color:var(--secondary)]/30 text-[color:var(--secondary)] px-3 py-2 text-xs font-medium hover:bg-[color:var(--secondary)]/10 transition">
                {t("common.clear")}
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export { SettingsPage };
