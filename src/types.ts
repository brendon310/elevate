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
