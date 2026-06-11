// src/forgeTitles.ts — shared rank/title ladder (used by SettingsPage + HomePage).
import type { UserTrack } from './types';

export interface ForgeTitle { days: number; titleKey: string; color: string; }

export const FORGE_TITLES: ForgeTitle[] = [
  { days: 0, titleKey: 'settings.title_newcomer', color: 'text-muted-foreground' },
  { days: 10, titleKey: 'settings.title_apprentice', color: 'text-blue-400' },
  { days: 25, titleKey: 'settings.title_journeyman', color: 'text-purple-400' },
  { days: 50, titleKey: 'settings.title_forge_master', color: 'text-amber-400' },
  { days: 100, titleKey: 'settings.title_legend', color: 'text-yellow-300' },
];

export function maxStreakOf(tracks: UserTrack[]): number {
  return Math.max(0, ...tracks.map(t => t.current_streak ?? 0));
}

export function getForgeTitle(tracks: UserTrack[]): ForgeTitle {
  const maxStreak = maxStreakOf(tracks);
  let result = FORGE_TITLES[0];
  for (const ft of FORGE_TITLES) { if (maxStreak >= ft.days) result = ft; }
  return result;
}

/** The next title to unlock, or null if already at the top. */
export function getNextTitle(tracks: UserTrack[]): { title: ForgeTitle; daysLeft: number } | null {
  const maxStreak = maxStreakOf(tracks);
  const next = FORGE_TITLES.find(ft => ft.days > maxStreak);
  return next ? { title: next, daysLeft: next.days - maxStreak } : null;
}
