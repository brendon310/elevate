// db.phase5.ts — Phase 5 additions to the Supabase persistence layer
// Import this alongside db.ts to get enriched check-in, nudges, accountability, milestones.

import { createClient } from '@supabase/supabase-js';
import type { EnrichedLog, CoachNudge, AccountabilityPair, MilestoneReached } from './types';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
);

// ─── Enriched check-in ─────────────────────────────────────────────────────

/** Save an enriched check-in (mood + urge + trigger + hour) */
export async function saveEnrichedLog(
  logId: string,
  enriched: {
    mood?: number;
    had_urge?: boolean;
    urge_intensity?: number;
    trigger_label?: string;
    hour_of_day?: number;
  }
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('check_ins')
    .update({
      mood: enriched.mood ?? null,
      had_urge: enriched.had_urge ?? null,
      urge_intensity: enriched.urge_intensity ?? null,
      trigger_label: enriched.trigger_label ?? null,
      hour_of_day: enriched.hour_of_day ?? new Date().getHours(),
    })
    .eq('id', logId);
  if (error) { console.error('[db.phase5] saveEnrichedLog error', error.message); return { ok: false, error: error.message }; }
  return { ok: true };
}

/** Load enriched logs for pattern analysis (last N days) */
export async function loadPatternLogs(userId: string, days = 30): Promise<EnrichedLog[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('check_ins')
    .select('id, user_id, track_id, log_date, created_at, mood, had_urge, urge_intensity, trigger_label, hour_of_day')
    .eq('user_id', userId)
    .gte('log_date', sinceStr)
    .order('log_date', { ascending: false });
  if (error) { console.error('[db.phase5] loadPatternLogs error', error.message); return []; }
  return (data ?? []) as EnrichedLog[];
}

// ─── Coach nudges ──────────────────────────────────────────────────────────

export async function loadActiveNudges(userId: string): Promise<CoachNudge[]> {
  const { data, error } = await supabase.from('coach_nudges').select('*').eq('user_id', userId).is('dismissed_at', null).order('created_at', { ascending: false });
  if (error) { console.error('[db.phase5] loadActiveNudges error', error.message); return []; }
  return (data ?? []) as CoachNudge[];
}

export async function dismissNudge(nudgeId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('coach_nudges').update({ dismissed_at: new Date().toISOString() }).eq('id', nudgeId);
  if (error) { console.error('[db.phase5] dismissNudge error', error.message); return { ok: false, error: error.message }; }
  return { ok: true };
}

// ─── Accountability partners ────────────────────────────────────────────────

export async function loadAccountabilityPairs(userId: string): Promise<AccountabilityPair[]> {
  const { data, error } = await supabase.from('accountability_pairs').select('*').or(`requester_id.eq.${userId},partner_id.eq.${userId}`).order('created_at', { ascending: false });
  if (error) { console.error('[db.phase5] loadAccountabilityPairs error', error.message); return []; }
  return (data ?? []) as AccountabilityPair[];
}

export async function sendAccountabilityInvite(requesterId: string, partnerEmail: string, shareStreak: boolean, shareMood: boolean): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('accountability_pairs').insert({ requester_id: requesterId, partner_email: partnerEmail, status: 'pending', share_streak: shareStreak, share_mood: shareMood });
  if (error) { console.error('[db.phase5] sendAccountabilityInvite error', error.message); return { ok: false, error: error.message }; }
  return { ok: true };
}

// ─── Milestones ─────────────────────────────────────────────────────────────

export async function loadMilestonesReached(userId: string): Promise<MilestoneReached[]> {
  const { data, error } = await supabase.from('milestones_reached').select('*').eq('user_id', userId).order('reached_at', { ascending: false });
  if (error) { console.error('[db.phase5] loadMilestonesReached error', error.message); return []; }
  return (data ?? []) as MilestoneReached[];
}

export async function saveMilestone(userId: string, trackId: string, milestoneDays: 10 | 30 | 100): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('milestones_reached').upsert({ user_id: userId, track_id: trackId, milestone_days: milestoneDays, reached_at: new Date().toISOString(), card_downloaded: false }, { onConflict: 'user_id,track_id,milestone_days' });
  if (error) { console.error('[db.phase5] saveMilestone error', error.message); return { ok: false, error: error.message }; }
  return { ok: true };
}

export async function markMilestoneDownloaded(userId: string, trackId: string, milestoneDays: 10 | 30 | 100): Promise<void> {
  await supabase.from('milestones_reached').update({ card_downloaded: true }).eq('user_id', userId).eq('track_id', trackId).eq('milestone_days', milestoneDays);
}

// ─── Onboarding context ─────────────────────────────────────────────────────

export async function saveOnboardingCtx(userId: string, ctx: { triggers?: string[]; motivation?: string; obstacles?: string[]; goal_days?: number; }): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('profiles').update({ onboarding_ctx: ctx }).eq('id', userId);
  if (error) { console.error('[db.phase5] saveOnboardingCtx error', error.message); return { ok: false, error: error.message }; }
  return { ok: true };
}
