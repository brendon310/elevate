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

export interface DbCommunityPost {
  id: string; user_id?: string; track_slug: string;
  content: string; day_number: number;
  flame_count: number; created_at: string;
}

export interface DbCoachMessage {
  id: string; user_id?: string; track_slug: string;
  role: 'user' | 'assistant'; content: string; created_at: string;
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
  if ('track_slug' in j) return j as DbJourney;
  const a = j as AppJourney;
  return {
    id: a.id, track_slug: a.trackSlug, total_days: a.totalDays,
    starting_point: a.startingPoint, motivation: a.motivation,
    obstacle: a.obstacle, started_at: a.startedAt, generated_through: a.generatedThrough,
  };
}

function toDbJourneyDay(d: AppJourneyDay | DbJourneyDay, slug: string): DbJourneyDay {
  if ('track_slug' in d) return d as DbJourneyDay;
  const a = d as AppJourneyDay;
  return {
    id: a.id, track_slug: slug, journey_id: a.journeyId,
    day_number: a.dayNumber, title: a.title, description: a.description,
    task: a.task, reflection: a.reflection, science: a.science,
    checkin_prompt: a.checkinPrompt, completed_at: a.completedAt, user_note: a.userNote,
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

export async function loadCommunityPosts(slug: string): Promise<DbCommunityPost[]> {
  const { data } = await supabase
    .from('community_posts').select('*')
    .eq('track_slug', slug)
    .order('created_at', { ascending: false })
    .limit(50);
  return (data ?? []) as DbCommunityPost[];
}

export async function loadCoachMessages(userId: string, slug: string): Promise<DbCoachMessage[]> {
  const { data } = await supabase
    .from('coach_messages').select('*')
    .eq('user_id', userId).eq('track_slug', slug)
    .order('created_at', { ascending: true })
    .limit(100);
  return (data ?? []) as DbCoachMessage[];
}

// ─── Save ─────────────────────────────────────────────────────────────────────

export async function saveProfile(userId: string, name: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('profiles').upsert(
    { id: userId, name, updated_at: new Date().toISOString() }, { onConflict: 'id' }
  );
  if (error) { console.warn('[db] saveProfile:', error.message); return { ok: false, error: error.message }; }
  return { ok: true };
}

export async function saveTracks(userId: string, tracks: DbTrack[]): Promise<{ ok: boolean; error?: string }> {
  if (!tracks.length) return { ok: true };
  const rows = tracks.map(t => ({ ...t, user_id: userId }));
  const { error } = await supabase.from('user_tracks').upsert(rows, { onConflict: 'id' });
  if (error) { console.warn('[db] saveTracks:', error.message); return { ok: false, error: error.message }; }
  return { ok: true };
}

export async function deleteTrack(userId: string, trackId: string): Promise<void> {
  const { error } = await supabase.from('user_tracks')
    .delete().eq('id', trackId).eq('user_id', userId);
  if (error) console.warn('[db] deleteTrack:', error.message);
}

export async function deleteJourneyForTrack(userId: string, slug: string): Promise<void> {
  const [r1, r2] = await Promise.all([
    supabase.from('journey_days').delete().eq('user_id', userId).eq('track_slug', slug),
    supabase.from('journeys').delete().eq('user_id', userId).eq('track_slug', slug),
  ]);
  if (r1.error) console.warn('[db] deleteJourneyDays:', r1.error.message);
  if (r2.error) console.warn('[db] deleteJourney:', r2.error.message);
}

export async function deleteLogsForTrack(userId: string, trackId: string): Promise<void> {
  const { error } = await supabase.from('check_ins')
    .delete().eq('user_id', userId).eq('track_id', trackId);
  if (error) console.warn('[db] deleteLogsForTrack:', error.message);
}

export async function saveLog(userId: string, log: DbLog): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('check_ins').upsert(
    { ...log, user_id: userId }, { onConflict: 'id' }
  );
  if (error) { console.warn('[db] saveLog:', error.message); return { ok: false, error: error.message }; }
  return { ok: true };
}

export async function saveJourney(userId: string, journey: AppJourney | DbJourney): Promise<{ ok: boolean; error?: string }> {
  const row = { ...toDbJourney(journey), user_id: userId };
  const { error } = await supabase.from('journeys').upsert(row, { onConflict: 'id' });
  if (error) { console.warn('[db] saveJourney:', error.message); return { ok: false, error: error.message }; }
  return { ok: true };
}

export async function saveJourneyDays(
  userId: string, slug: string, days: (AppJourneyDay | DbJourneyDay)[]
): Promise<{ ok: boolean; error?: string }> {
  if (!days.length) return { ok: true };
  const rows = days.map(d => ({ ...toDbJourneyDay(d, slug), user_id: userId }));
  const { error } = await supabase.from('journey_days').upsert(rows, { onConflict: 'id' });
  if (error) { console.warn('[db] saveJourneyDays:', error.message); return { ok: false, error: error.message }; }
  return { ok: true };
}

export async function saveCommunityPost(userId: string, post: DbCommunityPost): Promise<void> {
  const { error } = await supabase.from('community_posts').insert(
    { ...post, user_id: userId }
  );
  if (error) console.warn('[db] saveCommunityPost:', error.message);
}

export async function updateFlameCount(postId: string, newCount: number): Promise<void> {
  const { error } = await supabase.from('community_posts')
    .update({ flame_count: newCount }).eq('id', postId);
  if (error) console.warn('[db] updateFlameCount:', error.message);
}

export async function saveCoachMessage(userId: string, msg: DbCoachMessage): Promise<void> {
  const { error } = await supabase.from('coach_messages').insert(
    { ...msg, user_id: userId }
  );
  if (error) console.warn('[db] saveCoachMessage:', error.message);
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
  const ops: Promise<unknown>[] = [];

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

// ─── Journey Template Cache ────────────────────────────────────────────────────

export interface DbJourneyTemplate {
  id: string;
  track_slug: string;
  from_day: number;
  count: number;
  days: object[];
}

export async function loadJourneyTemplate(slug: string, fromDay: number, count: number): Promise<object[] | null> {
  const id = `${slug}-${fromDay}-${count}`;
  const { data, error } = await supabase.from('journey_templates').select('days').eq('id', id).single();
  if (error || !data) return null;
  return data.days as object[];
}

export async function saveJourneyTemplate(slug: string, fromDay: number, count: number, days: object[]): Promise<void> {
  const id = `${slug}-${fromDay}-${count}`;
  const { error } = await supabase.from('journey_templates').upsert(
    { id, track_slug: slug, from_day: fromDay, count, days },
    { onConflict: 'id' }
  );
  if (error) console.warn('[db] saveJourneyTemplate:', error.message);
}
