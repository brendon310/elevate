// ─── Existing types (unchanged) ────────────────────────────────────────────
export interface Track {
  id: string;
  name: string;
  slug: string;
  category: string;
  description?: string;
  icon?: string;
  color?: string;
}

export interface Log {
  id: string;
  user_id: string;
  track_id: string;
  log_date: string;
  created_at: string;
}

export interface JourneyDay {
  day: number;
  title: string;
  description: string;
  tasks: string[];
  reflection?: string;
}

export interface UserProfile {
  id: string;
  display_name?: string;
  avatar_url?: string;
  streak?: number;
  onboarding_ctx?: OnboardingCtx;
  created_at: string;
}

// ─── Phase 5 — new types ───────────────────────────────────────────────────

export interface OnboardingCtx {
  triggers?: string[];
  motivation?: string;
  obstacles?: string[];
  goal_days?: number;
}

export type NudgeType = 'inactivity' | 'high_urge' | 'low_mood' | 'streak_broken';

export interface CoachNudge {
  id: string;
  user_id: string;
  nudge_type: NudgeType;
  message: string;
  cta_label?: string;
  cta_route?: string;
  dismissed_at?: string | null;
  created_at: string;
}

export interface AccountabilityPair {
  id: string;
  requester_id: string;
  partner_email: string;
  partner_id?: string | null;
  status: 'pending' | 'accepted' | 'declined';
  share_streak: boolean;
  share_mood: boolean;
  created_at: string;
}

export interface MilestoneReached {
  id: string;
  user_id: string;
  track_id: string;
  milestone_days: 10 | 30 | 100;
  reached_at: string;
  card_downloaded: boolean;
}

export interface EnrichedLog extends Log {
  mood?: number | null;
  had_urge?: boolean | null;
  urge_intensity?: number | null;
  trigger_label?: string | null;
  hour_of_day?: number | null;
}

export interface PatternData {
  recentLogs: EnrichedLog[];
  topTriggers: { label: string; count: number }[];
  avgMoodByDay: { date: string; avg: number }[];
  riskyHours: number[];
  coachInsight?: string;
}
// src/types.ts
// Shared TypeScript types — exported for use across pages and components.

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
import * as db from "./db";
import { Plan, shouldShowPaywall } from './plans';
import { PaywallModal } from './components/PaywallModal';

// âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
// Types
// âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

export type Screen = "landing" | "login" | "onboarding" | "dashboard";
export type AppPage = "home" | "tracks" | "insights" | "settings";

export interface ElevateUser {
  name: string;
  createdAt: string;
  peakReachedAt?: string | null;
  supabaseId?: string;
  subscriptionStatus?: string | null;
  islandTheme?: string | null;
  shields?: number;
}

export interface UserTrack {
  id: string;
  track_id: string;
  name: string;
  category: string;
  slug: string;
  added_at: string;
  current_streak: number;
  longest_streak: number;
  total_done: number;
  last_log_date: string | null;
  target_days: number;
  vacation_until?: string | null;
}

export interface Log {
  id: string;
  track_id: string;
  log_date: string;
  created_at: string;
}

export interface OnboardingTrack { slug: string; name: string; category: string }

export interface ElevateAuth {
  provider: "google" | "apple" | "email" | "phone";
  email?: string;
  phone?: string;
  name?: string;
  createdAt: string;
}
export interface Journey {
  id: string;
  trackSlug: string;
  totalDays: number;
  startingPoint: string;
  motivation: string;
  obstacle: string;
  startedAt: string;
  generatedThrough: number;
}
export interface JourneyDay {
  id: string;
  journeyId: string;
  dayNumber: number;
  title: string;
  description: string;
  task: string;
  reflection: string;
  science: string;
  checkinPrompt: string;
  completedAt: string | null;
  userNote: string | null;
}
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}
export interface CommunityPost {
  id: string;
  trackSlug: string;
  content: string;
  dayNumber: number;
  flameCount: number;
  userHasFlamed: boolean;
  createdAt: string;
}
