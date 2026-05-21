// db.ts — Supabase persistence layer
// Write-through cache: localStorage for speed, Supabase for durability.
// All functions are fire-and-forget safe (errors logged, never thrown to UI).

import { supabase } from './supabase';

// ─── DB row types (snake_case, mirrors Supabase tables) ──────────────────────

export interface DbTrack {
  id: string; user_id?: string; track_id: string;
  name: string; category: string; slug: string;
  added_at: string; current_streak: number; longest_streak: number;
  total_done: number; last_log_date: string | null;
  target_days: number; vacation_until?: string | null;
}

export interface DbLog {
  id: string; user_id?: string; track_id: string;
  log_date: string; created_at: string;
}

export interface DbJourneyDay {
  id: string; user_id?: string; track_slug: string; journey_id?: string;
  day_number: number; title: string; description: string;
  task: string; reflection: string; science: string;
  checkin_prompt: string; completed_at: string | null; user_note: string | null;
}

export interface DbJourney {
  id: string; user_id?: string; track_slug: string;
  total_days: number; starting_point: string;
  motivation: string; obstacle: string;
  started_at: string; generated_through: number;
}

// ─── App-level types accepted at call sites (camelCase) ───────────────────────

export interface AppJourney {
  id: string; trackSlug: string; totalDays: number;
  startingPoint: string; motivation: string; obstacle: string;
  startedAt: string; generatedThrough: number;
}

export interface AppJourneyDay {
  id: string; journeyId?: string; dayNumber: number;
  title: string; description: string; task: string;
  reflection: string; science: string; checkinPrompt: string;
  completedAt: string | null; userNote: string | null;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function toDbJourney(j: AppJourney | DbJourney): DbJourney {
  if ('track_slug' in j) return j as DbJourney; // already snake_case
  const a = j as AppJourney;
  return {
    id: a.id,
    track_slug: a.trackSlug,
    total_days: a.totalDays,
    starting_point: a.startingPoint,
    motivation: a.motivation,
    obstacle: a.obstacle,
    started_at: a.startedAt,
    generated_through: a.generatedThrough,
  };
}

function toDbJourneyDay(d: AppJourneyDay | DbJourneyDay, slug: string): DbJourneyDay {
  if ('track_slug' in d) return d as DbJourneyDay; // already snake_case
  const a = d as AppJourneyDay;
  return {
    id: a.id,
    track_slug: slug,
    journey_id: a.journeyId,
    day_number: a.dayNumber,
    title: a.title,
    description: a.description,
    task: a.task,
    reflection: a.reflection,
    science: a.science,
    checkin_prompt: a.checkinPrompt,
    completed_at: a.completedAt,
    user_note: a.userNote,
  };
}

// ─── Load ─────────────────────────────────────────────────────────────────────

export async function loadUserData(userId: string) {
  const [profileRes, tracksRes, logsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('user_tracks').select('*').eq('user_id', userId),
    supabase.from('check_ins').select('*').eq('user_id', userId),
  ]);
  return {
    profile: profileRes.data as { id: string; name: string; created_at: string } | null,
    tracks: (tracksRes.data ?? []) as DbTrack[],
    logs: (logsRes.data ?? []) as DbLog[],
  };
}

export async function loadJourneys(userId: string): Promise<DbJourney[]> {
  const { data } = await supabase.from('journeys').select('*').eq('user_id', userId);
  return (data ?? []) as DbJourney[];
}

export async function loadJourneyDays(userId: string, slug: string): Promise<DbJourneyDay[]> {
  const { data } = await supabase
    .from('journey_days').select('*')
    .eq('user_id', userId).eq('track_slug', slug)
    .order('day_number');
  return (data ?? []) as DbJourneyDay[];
}

// ─── Save ─────────────────────────────────────────────────────────────────────

export async function saveProfile(userId: string, name: string): Promise<void> {
  const { error } = await supabase.from('profiles').upsert(
    { id: userId, name, updated_at: new Date().toISOString() },
    { onConflict: 'id' }
  );
  if (error) console.warn('[db] saveProfile:', error.message);
}

export async function saveTracks(userId: string, tracks: DbTrack[]): Promise<void> {
  if (!tracks.length) return;
  const rows = tracks.map(t => ({ ...t, user_id: userId }));
  const { error } = await supabase.from('user_tracks').upsert(rows, { onConflict: 'id' });
  if (error) console.warn('[db] saveTracks:', error.message);
}

export async function deleteTrack(userId: string, trackId: string): Promise<void> {
  const { error } = await supabase.from('user_tracks')
    .delete().eq('id', trackId).eq('user_id', userId);
  if (error) console.warn('[db] deleteTrack:', error.message);
  const { error: e2 } = await supabase.from('journey_days')
    .delete().eq('user_id', userId);
  if (e2) console.warn('[db] deleteJourneyDays:', e2.message);
}

export async function saveLog(userId: string, log: DbLog): Promise<void> {
  const { error } = await supabase.from('check_ins').upsert(
    { ...log, user_id: userId }, { onConflict: 'id' }
  );
  if (error) console.warn('[db] saveLog:', error.message);
}

export async function saveJourney(userId: string, journey: AppJourney | DbJourney): Promise<void> {
  const row = { ...toDbJourney(journey), user_id: userId };
  const { error } = await supabase.from('journeys').upsert(row, { onConflict: 'id' });
  if (error) console.warn('[db] saveJourney:', error.message);
}

export async function saveJourneyDays(
  userId: string,
  slug: string,
  days: (AppJourneyDay | DbJourneyDay)[]
): Promise<void> {
  if (!days.length) return;
  const rows = days.map(d => ({ ...toDbJourneyDay(d, slug), user_id: userId }));
  const { error } = await supabase.from('journey_days').upsert(rows, { onConflict: 'id' });
  if (error) console.warn('[db] saveJourneyDays:', error.message);
}

// ─── Migrate from localStorage ────────────────────────────────────────────────

export async function migrateFromLocalStorage(
  userId: string,
  lsUser: { name: string } | null,
  lsTracks: DbTrack[],
  lsLogs: DbLog[],
  lsGetDays: (slug: string) => (AppJourneyDay | DbJourneyDay)[],
  lsGetJourney: (slug: string) => AppJourney | DbJourney | null,
): Promise<void> {
  console.log('[db] migrating localStorage → Supabase');
  const ops: Promise<void>[] = [];

  if (lsUser) ops.push(saveProfile(userId, lsUser.name));
  if (lsTracks.length) ops.push(saveTracks(userId, lsTracks));
  if (lsLogs.length) {
    for (let i = 0; i < lsLogs.length; i += 100) {
      const batch = lsLogs.slice(i, i + 100);
      const { error } = await supabase.from('check_ins').upsert(
        batch.map(l => ({ ...l, user_id: userId })), { onConflict: 'id' }
      );
      if (error) console.warn('[db] migrateLog batch:', error.message);
    }
  }
  for (const track of lsTracks) {
    const days = lsGetDays(track.slug);
    if (days.length) ops.push(saveJourneyDays(userId, track.slug, days));
    const journey = lsGetJourney(track.slug);
    if (journey) ops.push(saveJourney(userId, journey));
  }
  await Promise.all(ops);
  console.log('[db] migration complete');
}
