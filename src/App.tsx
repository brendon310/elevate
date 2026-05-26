// Complete self-contained Forge app — localStorage persistence, no backend.

import { useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Eye, Check, Plus, Home, Layers, BarChart3, Settings, Shield,
  Sparkles, Flame, Sun, Moon, User as UserIcon, Trophy, CheckCircle2,
  Zap, AlertTriangle, Crown, Mail, Phone, ChevronLeft, Search,
  Database, Download, Bell, Target, Lock, PenLine, X, BarChart2} from 'lucide-react';
import confetti from "canvas-confetti";
import { supabase } from "./supabase";

// PWA install prompt type
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
import * as db from "./db";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Screen = "landing" | "login" | "onboarding" | "dashboard";
type AppPage = "home" | "tracks" | "insights" | "settings";

interface ElevateUser {
  name: string;
  createdAt: string;
  peakReachedAt?: string | null;
  supabaseId?: string;
  subscriptionStatus?: string | null;
  islandTheme?: string | null;
  shields?: number;
}

interface UserTrack {
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

interface Log {
  id: string;
  track_id: string;
  log_date: string;
  created_at: string;
}

interface OnboardingTrack { slug: string; name: string; category: string }

interface ElevateAuth {
  provider: "google" | "apple" | "email" | "phone";
  email?: string;
  phone?: string;
  name?: string;
  createdAt: string;
}
interface Journey {
  id: string;
  trackSlug: string;
  totalDays: number;
  startingPoint: string;
  motivation: string;
  obstacle: string;
  startedAt: string;
  generatedThrough: number;
}
interface JourneyDay {
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
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}
interface CommunityPost {
  id: string;
  trackSlug: string;
  content: string;
  dayNumber: number;
  flameCount: number;
  userHasFlamed: boolean;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const LS_USER = "forge-user";
const LS_TRACKS = "forge-tracks";
const LS_LOGS = "forge-logs";
const LS_PREFS = "forge-prefs";
const LS_AUTH = "forge-auth";
const LS_JOURNEY = (slug: string) => `forge-journey-${slug}`;
const LS_DAYS = (slug: string) => `forge-days-${slug}`;
const LS_CHAT = (slug: string) => `forge-chat-${slug}`;
const LS_COMMUNITY = (slug: string) => `forge-community-${slug}`;

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

const COACH_SUGGESTED_PROMPTS: Record<string, string[]> = {
  trainer:   ["How am I actually doing? Be honest.", "Give me today's challenge.", "I almost gave up — what now?", "Call me out on something."],
  clinician: ["I'm struggling today.", "Why do I keep falling back?", "What does the science say about cravings?", "Help me understand my pattern."],
  mentor:    ["What's the strategic move here?", "What am I not seeing?", "Help me build a system.", "Where do I go from here?"],
  teacher:   ["Why does this habit work neurologically?", "Break it down simply.", "What should I focus on this week?", "Explain the psychology of my pattern."],
  guide:     ["What does this journey mean?", "Help me find my why again.", "I need a different perspective.", "What ritual could help me today?"],
};

const COACH_OPENERS: Record<string, (day: number, trackName: string) => string> = {
  trainer:   (d, t) => d <= 1 ? `Day one of ${t}. Before we start — what's the one excuse you've already made in your head about why this won't work? Say it out loud.` : `Day ${d}. You showed up ${d - 1} times before this. What's the honest report — are you going through the motions or actually changing?`,
  clinician: (d, t) => d <= 1 ? `Welcome. Starting ${t} takes courage most people won't admit. How are you feeling right now — not the edited version, the real one?` : `Day ${d} of ${t}. Check in with yourself: what emotion is most present when you think about this journey today?`,
  mentor:    (d, t) => d <= 1 ? `Day 1, ${t}. Every system starts with an honest audit. What got you here, and what specifically has to change for this to be different?` : `Day ${d}. You're ${d - 1} days in. What's working, what isn't, and what would you tell yourself on Day 1 knowing what you know now?`,
  teacher:   (d, t) => d <= 1 ? `Let's start with a question: what do you already know about why ${t} has been hard? There's data in your past attempts.` : `Day ${d} of ${t}. What's one thing you've learned about yourself so far in this process — something you didn't know before?`,
  guide:     (d, t) => d <= 1 ? `You've chosen ${t}. That choice came from somewhere deep. What is the version of you at the end of this journey doing differently — how does their day feel?` : `Day ${d}. You've been on this path for ${d - 1} days. What's shifted — even if it's small — in how you see yourself?`,
};

type ArchetypeId = "trainer" | "teacher" | "clinician" | "mentor" | "guide";
interface Archetype { id: ArchetypeId; name: string; tagline: string; voice: string; }

const ARCHETYPES: Record<ArchetypeId, Archetype> = {
  trainer: { id: "trainer", name: "Trainer", tagline: "Your direct trainer", voice: "You are a direct, no-bullshit performance coach. Short punchy sentences. Hold the user accountable. Celebrate effort, never excuses. Push past comfort with warmth. Never preachy." },
  teacher: { id: "teacher", name: "Teacher", tagline: "Your calm teacher", voice: "You are a calm curious teacher. Break change into small learnable steps. Ask great questions before giving answers. Clear examples, treat user as intelligent adult. Patient, structured." },
  clinician: { id: "clinician", name: "Clinician", tagline: "Your warm clinician", voice: "You are a warm evidence-based mental health coach. Validate first, then guide. Speak gently. Reference CBT, ACT, polyvagal in plain language. Never minimize feelings." },
  mentor: { id: "mentor", name: "Mentor", tagline: "Your sharp mentor", voice: "You are a sharp strategic mentor. Think in systems. Ask hard questions. Give crisp actionable frameworks. No fluff, no platitudes. The friend who has done it and tells the truth." },
  guide: { id: "guide", name: "Guide", tagline: "Your creative guide", voice: "You are a creative soulful guide. Speak with imagery and metaphor. Honour the user's deeper why. Make practice feel like play. Blend craft, ritual, meaning. Warm, exploratory." },
};

const TRACK_ARCHETYPE: Record<string, ArchetypeId> = {
  // Fitness & Body
  "strength-training": "trainer", "morning-run": "trainer", "cold-exposure": "trainer",
  "sedentary-lifestyle": "trainer",
  // Quit Bad Habits
  "no-social-media": "trainer", "quit-smoking": "trainer", "no-sugar": "trainer", // Addiction & Recovery
  "quit-alcohol": "trainer", "video-game-addiction": "trainer",
  "compulsive-shopping": "mentor", "quit-pornography": "clinician", "quit-drugs": "clinician",
  "quit-gambling": "mentor", "binge-eating": "clinician",
  // Mental Health
  "meditation": "clinician", "anxiety-relief": "clinician", "journaling": "clinician",
  "sleep-routine": "clinician", "breathwork": "clinician",
  "stop-overthinking": "clinician", "social-anxiety": "clinician",
  "anger-management": "clinician", "chronic-stress": "clinician",
  "social-isolation": "guide", "negative-mindset": "guide",
  // Productivity & Life
  "deep-work": "mentor", "beat-procrastination": "trainer",
  "build-discipline": "trainer", // Psychology & Self
  "low-self-esteem": "clinician", "need-for-approval": "clinician",
  "fear-of-failure": "mentor", "fear-of-judgment": "clinician",
  "emotional-dependency": "clinician", "toxic-relationships": "mentor",
  "control-issues": "mentor", "stop-self-sabotage": "guide",
  "toxic-perfectionism": "clinician",
  "jealousy": "clinician", // Financial Health
  "money-management": "mentor",
  // Mind & Learning
  "reading": "teacher", "language": "teacher",
  "gratitude": "guide",
};
function archetypeForSlug(slug: string): Archetype {
  const id = TRACK_ARCHETYPE[slug] ?? "teacher";
  return ARCHETYPES[id];
}

// ─────────────────────────────────────────────────────────────────────────────
// Ghost + Morning Coach constants
// ─────────────────────────────────────────────────────────────────────────────

/** The day number the user would be on if they had checked in every single day. */
function ghostDayFor(ut: UserTrack): number {
  const ms = Date.now() - new Date(ut.added_at).getTime();
  return Math.max(1, Math.floor(ms / 86_400_000) + 1);
}

const MORNING_FALLBACKS: Record<ArchetypeId, string[]> = {
  trainer: [
    "Yesterday you chose to show up. Today is the test of whether that was a fluke or a pattern. It wasn't a fluke.",
    "Every rep you do today compounds what you built yesterday. Clock's ticking. Get moving.",
  ],
  teacher: [
    "Consistency is the silent teacher that no class can replicate. Your streak is already teaching you something. Keep the lesson going.",
    "Yesterday's work laid a foundation. Today you get to build one more floor. Simple. Repeatable. Effective.",
  ],
  clinician: [
    "Coming back again takes more courage than you may realize. I'm glad you're here. Let's make today gentle and intentional.",
    "Progress isn't always visible in a day — but it lives in the choice to return. You returned. That matters deeply.",
  ],
  mentor: [
    "The gap between who you are and who you're becoming closes one check-in at a time. Today is one of those times.",
    "Execution is the only strategy that counts. You know what to do. Now go do it.",
  ],
  guide: [
    "Morning has a particular kind of light. It's the same light that was here the day you started. You're still in it. Keep going.",
    "Every day you return, you deepen the groove of the person you're becoming. Today, go a little deeper.",
  ],
};

const JOURNEY_MILESTONES = [1, 3, 7, 14, 21, 30, 60, 90, 180, 365];

const TRACK_HUE: Record<string, string> = {
  "Fitness & Body": "oklch(0.65 0.22 25)",
  "Mental Health": "oklch(0.65 0.22 260)",
  "Quit Bad Habits": "oklch(0.65 0.22 140)",
  "Mind & Learning": "oklch(0.65 0.22 200)",
  "Productivity & Life": "oklch(0.65 0.22 60)",
  "Addiction & Recovery": "oklch(0.65 0.22 350)",
  "Financial Health": "oklch(0.65 0.22 145)",
  "Psychology & Self": "oklch(0.65 0.22 300)",
};
function trackHue(category: string) { return TRACK_HUE[category] ?? "oklch(0.65 0.2 280)"; }

const ONBOARDING_TRACKS: OnboardingTrack[] = ALL_TRACKS.map(t => ({
  slug: t.slug, name: t.name, category: t.category,
}));

const MOTIVATIONS = [
  "Today is a clean page. Write one good line.",
  "Small reps. Big identity.",
  "Show up. The rest follows.",
  "You're closer than you were yesterday.",
  "Repetition is how you become.",
  "Make one move that future-you applauds.",
  "Discipline is self-love in slow motion.",
];

const CHECKIN_WARNINGS = [
  "The task won't complete itself. Write something.",
  "Day 0 is calling. Don't pick up.",
  "Your future self is watching. Fill this in.",
  "The coach knows when you're faking it.",
  "Empty field = empty progress. Come on.",
  "You didn't come this far to leave this blank.",
  "This is the work. Do the work.",
  "Skip this and your streak takes the hit.",
  "Not even one sentence? Really?",
  "The only bad answer is no answer. Go.",
];

// Community content moderation — stems catch conjugations and variants
const COMMUNITY_BLOCKLIST = [
  "jerk","masturbat","porn","sex ","fap","orgasm","naked","nude","dick","cock","pussy","ass ","fuck","shit ","bitch","whore","slut","cum ","jizz","rape","abuse","kill myself","kms","kys","nigger","faggot",
];
function isCommunityBlocked(text: string): boolean {
  const lower = text.toLowerCase();
  return COMMUNITY_BLOCKLIST.some(w => lower.includes(w));
}

const COMMUNITY_MODERATION_MESSAGES = [
  "Keep it real, not raw. This is a community of people doing hard work.",
  "The coach is watching. So is everyone else. Let's keep it respectful.",
  "Your words matter here. Try something you'd be proud to read back.",
  "This community runs on honesty, not shock value. Say it differently.",
  "Strong language, stronger filter. Rewrite it with intention.",
];

const COACH_RESPONSES = [
  "What you've written holds more courage than you may realize. The desire to change isn't weakness—it's the first muscle you'll train. This path isn't about willpower alone; it's about becoming someone for whom this shift feels completely natural. I'll be with you every step of the way.",
  "I hear the depth in what you've shared. Beneath the specific thing you want to change lives a person who already knows who they're meant to be. That knowing is your compass—we don't add anything to you here, we clear away what's been covering it. I'll be with you every step of the way.",
  "The fact that you named it—clearly, honestly—already sets you apart from most people who feel this weight but never find the words. Your precision is power. Now let's build something with it, one day at a time. I'll be with you every step of the way.",
  "There's a version of you that has already made this change, and they made one decision that you're making right now: to begin. Not when ready. Not when perfect. Just now. That desire you feel is valid, real, and more than enough. I'll be with you every step of the way.",
];

// Worldwide statistics shown during onboarding to help users feel less alone
const TRACK_GLOBAL_STATS: Record<string, string> = {
  "meditation":           "31% of people worldwide struggle with mental stillness",
  "morning-run":          "54% of adults are insufficiently physically active",
  "strength-training":    "54% of adults worldwide don't exercise enough",
  "quit-smoking":         "22% of adults worldwide still smoke",
  "deep-work":            "41% of workers report being unable to focus deeply",
  "reading":              "33% of adults read less than they'd like",
  "sleep-routine":        "45% of adults worldwide report poor sleep quality",
  "anxiety-relief":       "28% of people experience anxiety disorders in their lifetime",
  "journaling":           "67% of people want to reflect more but never start",
  "cold-exposure":        "Growing wellness practice — millions are discovering this",
  "no-social-media":      "40% of people report problematic social media use",
  "quit-alcohol":         "14% of people worldwide struggle with alcohol use",
  "quit-pornography":     "12% of people report problematic pornography use",
  "quit-drugs":           "5% of adults worldwide use illicit substances regularly",
  "quit-gambling":        "3% of people worldwide have a gambling disorder",
  "binge-eating":         "4% of people worldwide experience binge eating disorder",
  "video-game-addiction": "8% of gamers show signs of gaming disorder",
  "compulsive-shopping":  "5% of people struggle with compulsive buying",
  "no-sugar":             "50% of people struggle to reduce sugar consumption",
  "beat-procrastination": "20% of adults are chronic procrastinators",
  "build-discipline":     "41% say lack of discipline is their #1 challenge",
  "stop-overthinking":    "73% of adults between 25–35 report chronic overthinking",
  "social-anxiety":       "12% of people experience social anxiety disorder",
  "anger-management":     "7% of adults report uncontrolled anger issues",
  "chronic-stress":       "77% of adults regularly experience physical stress symptoms",
  "social-isolation":     "33% of adults report chronic loneliness",
  "negative-mindset":     "51% of people have a predominantly negative inner voice",
  "breathwork":           "Millions worldwide use breathwork to regulate their nervous system",
  "low-self-esteem":      "85% of people report self-esteem struggles at some point",
  "need-for-approval":    "43% of people struggle with excessive need for validation",
  "fear-of-failure":      "31% of people report a paralyzing fear of failure",
  "fear-of-judgment":     "38% of people fear social judgment on a daily basis",
  "emotional-dependency": "15% of people form emotionally dependent attachments",
  "toxic-relationships":  "29% of adults have experienced a toxic relationship",
  "control-issues":       "11% of people show excessive control tendencies",
  "stop-self-sabotage":   "33% of people identify as self-sabotagers",
  "toxic-perfectionism":  "29% of people suffer from maladaptive perfectionism",
  "jealousy":             "22% of people report chronic jealousy in relationships",
  "money-management":     "63% of adults live paycheck to paycheck",
  "sedentary-lifestyle":  "54% of adults worldwide are insufficiently physically active",
  "gratitude":            "Gratitude practice is used by millions to rewire thinking",
};

// Keyword map for smart path suggestion (supports both English and Italian)
const TRACK_KEYWORDS: { slug: string; keywords: string[] }[] = [
  { slug: "quit-smoking",        keywords: ["smok","cigarette","sigarett","fumar","fumo","nicotine","nicotina","tabacco","tobacco","sigar"] },
  { slug: "quit-alcohol",        keywords: ["alcohol","alcol","alcool","drinking","bere","wine","vino","beer","birra","drink","ubriaco","drunk","liquor","whisky","vodka"] },
  { slug: "quit-pornography",    keywords: ["porn","pornograph","pornografi","porno","xxx","adult content","masturbat","masturbazione","video adult"] },
  { slug: "quit-drugs",          keywords: ["drug","droga","cocaine","cocaina","marijuana","cannabis","heroin","eroina","substance","sostanza","addict","dipendente da"] },
  { slug: "quit-gambling",       keywords: ["gambl","gambling","gioco d'azzardo","scommesse","bet","betting","casino","casinò","poker","slot","lottery","lotteria"] },
  { slug: "no-social-media",     keywords: ["social media","instagram","facebook","tiktok","twitter","social","scrolling","scorrere","like","reels","post"] },
  { slug: "no-sugar",            keywords: ["sugar","zucchero","dolci","sweets","candy","caramel","cioccolato","chocolate","junk food","dessert","zuccheri"] },
  { slug: "binge-eating",        keywords: ["binge","overeating","abbuffate","compulsive eat","mangio troppo","cibo","food compuls","eating disorder"] },
  { slug: "compulsive-shopping", keywords: ["shopping compuls","comprare compuls","acquisti compuls","shop addict","acquisti","buy too much"] },
  { slug: "beat-procrastination",keywords: ["procrastin","rimandare","postpone","delay","later","dopo","domani","tomorrow","ritardare","pigro nel fare"] },
  { slug: "build-discipline",    keywords: ["discipline","disciplina","self-control","autocontrollo","consistency","costanza","habit","abitudine","commit"] },
  { slug: "stop-overthinking",   keywords: ["overthink","pensare troppo","rumination","ruminazione","spin","thoughts racing","pensieri che girano","worry loop"] },
  { slug: "social-anxiety",      keywords: ["social anxiety","ansia sociale","shy","timido","people","persone","social","socializing","public","folla","group"] },
  { slug: "anger-management",    keywords: ["anger","rabbia","rage","furia","aggressiv","temper","collera","frustration","frustrazi","explode","esplosioni"] },
  { slug: "chronic-stress",      keywords: ["stress","burnout","overwhelm","sopraffatto","tension","tensione","pressure","pressione","overload","carico"] },
  { slug: "anxiety-relief",      keywords: ["anxiety","ansia","panic","panico","fear","paura","worry","preoccupazi","nervous","nervoso","angoscia","dread"] },
  { slug: "meditation",          keywords: ["meditat","meditazione","mindfulness","peace","pace","calm","calma","stillness","quiet","silenzio","presence"] },
  { slug: "low-self-esteem",     keywords: ["self-esteem","autostima","confidence","fiducia","insecur","valore","worth","self-worth","not enough","non basto"] },
  { slug: "need-for-approval",   keywords: ["approval","approvazione","validation","validazione","please","piacere","opinion","opinioni","what people think","cosa pensano"] },
  { slug: "fear-of-failure",     keywords: ["failure","fallimento","fail","fallire","fear fail","scared to try","paura di fallire","scared","scared of failing"] },
  { slug: "fear-of-judgment",    keywords: ["judgment","giudizio","judged","giudicato","what people think","cosa pensano gli altri","scared of opinion","giudicato dagli altri"] },
  { slug: "emotional-dependency",keywords: ["dependency","dipendenza","dependent","dipendente","clingy","attaccamento","attachment","relying on","bisogno degli altri"] },
  { slug: "toxic-relationships", keywords: ["toxic","tossico","relationship","relazione","partner","manipulat","manipolatore","abuse","abuso","controlling partner"] },
  { slug: "control-issues",      keywords: ["control","controllo","controlling","let go","lasciare andare","manage everything","need to control","controllare tutto"] },
  { slug: "stop-self-sabotage",  keywords: ["self-sabotage","autosabotaggio","sabotage","sabotare","self-destruct","pattern","destroy what i build","rovino tutto"] },
  { slug: "money-management",    keywords: ["money","soldi","financial","finanziario","budget","debt","debito","saving","risparmio","broke","spendo tutto"] },
  { slug: "toxic-perfectionism", keywords: ["perfect","perfetto","perfectionism","perfezionismo","perfectionist","perfezionista","never good enough","mai abbastanza"] },
  { slug: "social-isolation",    keywords: ["lonely","solo","solitudine","loneliness","isolated","isolato","connection","connessione","no friends","senza amici","withdraw"] },
  { slug: "video-game-addiction",keywords: ["video game","videogiochi","gaming","giochi","gamer","game addict","gioco troppo","console","twitch","esport","online game"] },
  { slug: "negative-mindset",    keywords: ["negative","negativo","pessimist","pessimista","mindset","mentalità","always negative","sempre negativo","dark thoughts"] },
  { slug: "sedentary-lifestyle", keywords: ["sedentary","sedentario","inactive","inattivo","sit all day","never move","non mi muovo","couch","divano","exercise"] },
  { slug: "jealousy",            keywords: ["jealous","geloso","jealousy","gelosia","partner jealous","relazione","possessive","possessivo","gelosia partner"] },
  { slug: "morning-run",         keywords: ["run","corsa","running","jogging","cardio","cardio exercise","correre"] },
  { slug: "strength-training",   keywords: ["strength","forza","gym","palestra","muscle","muscolo","weight","workout","sollevamento"] },
  { slug: "deep-work",           keywords: ["focus","concentrazione","work","lavoro","productive","produttivo","distraction","distrazione","deep work","flow"] },
  { slug: "reading",             keywords: ["read","leggere","book","libro","learning","imparare","knowledge","conoscenza","non leggo"] },
  { slug: "sleep-routine",       keywords: ["sleep","dormire","insomnia","insonnia","rest","riposo","tired","stanco","night","notte","awake","sveglio"] },
  { slug: "journaling",          keywords: ["journal","diario","write","scrivere","reflect","riflettere","thoughts","pensieri","diary"] },
  { slug: "cold-exposure",       keywords: ["cold","freddo","shower","doccia","ice","ghiaccio","cold water","acqua fredda"] },
  { slug: "breathwork",          keywords: ["breath","respiro","breathe","respirare","breathing","respirazione","oxygen","ossigeno","pranayama"] },
  { slug: "gratitude",           keywords: ["gratitude","gratitudine","grateful","grato","thankful","positive","positivo","appreciate","apprezzare"] },
];

// Always returns a slug — either the best keyword match, or a smart fallback based on text hash.
// This ensures the onboarding "Suggested path" hero card always appears.
const FALLBACK_SLUGS = [
  "build-discipline", "stop-self-sabotage", "beat-procrastination",
  "stop-overthinking", "negative-mindset", "toxic-perfectionism",
];
function suggestTrackFromText(text: string): string {
  if (!text || text.trim().length < 5) return FALLBACK_SLUGS[0];
  const lower = text.toLowerCase();
  let bestSlug: string | null = null;
  let bestScore = 0;
  for (const { slug, keywords } of TRACK_KEYWORDS) {
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) score += kw.length;
    }
    if (score > bestScore) { bestScore = score; bestSlug = slug; }
  }
  // If no keyword matched, pick a deterministic fallback from the text hash
  return bestSlug ?? FALLBACK_SLUGS[hashStr(text) % FALLBACK_SLUGS.length];
}

// ─────────────────────────────────────────────────────────────────────────────
// LocalStorage helpers
// ─────────────────────────────────────────────────────────────────────────────

function lsLoad<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

function lsSave(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}


// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function nanoid() { return Math.random().toString(36).slice(2, 9) + Date.now().toString(36); }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function yesterdayStr() { return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10); }

function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pickCoachResponse(answer: string) {
  return COACH_RESPONSES[hashStr(answer) % COACH_RESPONSES.length];
}

function trackHueVar(category?: string) {
  const map: Record<string, string> = {
    "Fitness & Body": "--fitness",
    "Mental Health": "--mental",
    "Quit Bad Habits": "--quit",
    "Mind & Learning": "--learning",
    "Productivity & Life": "--productivity",
    "Addiction & Recovery": "--quit",
    "Financial Health": "--productivity",
    "Psychology & Self": "--mental",
  };
  return category && map[category] ? map[category] : "--foreground";
}

function trackHueGradient(slug: string) {
  const shades = [
    ["oklch(0.22 0 0)", "oklch(0.10 0 0)"],
    ["oklch(0.20 0 0)", "oklch(0.09 0 0)"],
    ["oklch(0.24 0 0)", "oklch(0.12 0 0)"],
    ["oklch(0.18 0 0)", "oklch(0.08 0 0)"],
    ["oklch(0.26 0 0)", "oklch(0.13 0 0)"],
    ["oklch(0.21 0 0)", "oklch(0.11 0 0)"],
  ];
  const [a, b] = shades[hashStr(slug) % shades.length];
  return `linear-gradient(160deg, ${a}, ${b})`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Momentum (mirrors momentum.ts, pure client-side)
// ─────────────────────────────────────────────────────────────────────────────

/** Returns 0 if the user hasn't checked in today or yesterday — streak visually resets in real time */
function liveStreak(ut: UserTrack): number {
  const t = todayStr();
  const y = yesterdayStr();
  if (ut.vacation_until && ut.vacation_until >= t) return ut.current_streak || 0;
  if (ut.last_log_date === t || ut.last_log_date === y) return ut.current_streak || 0;
  return 0;
}

const QUICK_NOTE_BANNED = [
  "cazzo","vaffanculo","merda","stronzo","puttana","figa","coglione","minchia","porco dio",
  "fuck","shit","bitch","asshole","bastard","cunt","dick","pussy","nigger","faggot",
];

function validateQuickNote(text: string): string | null {
  const t = text.trim();
  if (t.length < 10) return "Write at least a few words before sending.";
  if (/^(.)\1{5,}$/.test(t)) return "Sembra che tu stia scherzando — scrivi davvero!";
  if (/^[\d\s\W]+$/.test(t)) return "Scrivi qualcosa di reale, anche una frase breve.";
  if (t.length > 6 && !/[aeiouàèéìòùAEIOUÀÈÉÌÒÙ]/u.test(t))
    return "Scrivi una risposta vera — anche due parole bastano.";
  if (QUICK_NOTE_BANNED.some(w => t.toLowerCase().includes(w)))
    return "Choose better words for your check-in.";
  return null;
}

// Milestones: 1k (yellow), 10k (yellow-pulse), 50k (red), 100k (red-pulse)
const MOMENTUM_MILESTONES = [
  { key: "1k",   threshold: 1_000,   label: "1k",   icon: "bolt"  },
  { key: "10k",  threshold: 10_000,  label: "10k",  icon: "bolt"  },
  { key: "50k",  threshold: 50_000,  label: "50k",  icon: "flame" },
  { key: "100k", threshold: 100_000, label: "100k", icon: "flame" },
] as const;

type MilestoneTier = "yellow" | "yellow-pulse" | "red" | "red-pulse";
function getMomentumTier(score: number): MilestoneTier {
  if (score >= 50_000) return "red-pulse";
  if (score >= 10_000) return "red";
  if (score >= 1_000)  return "yellow-pulse";
  return "yellow";
}
function getMomentumTierColor(tier: MilestoneTier) {
  if (tier === "red-pulse" || tier === "red") return { stroke: "#C0392B", bg: "#C0392B", text: "#fff", glow: "rgba(192,57,43,0.6)" };
  return { stroke: "#EF9F27", bg: "#FAEEDA", text: "#633806", glow: "rgba(239,159,39,0.45)" };
}
function getNextMilestone(score: number) {
  return MOMENTUM_MILESTONES.find(m => score < m.threshold) ?? MOMENTUM_MILESTONES[MOMENTUM_MILESTONES.length - 1];
}

function computeMomentum(tracks: UserTrack[]) {
  const totalStreak = tracks.reduce((s, x) => s + liveStreak(x), 0);
  const totalLongest = tracks.reduce((s, x) => s + (x.longest_streak || 0), 0);
  const totalDone = tracks.reduce((s, x) => s + (x.total_done || 0), 0);
  const breadth = tracks.filter(x => (x.total_done || 0) > 0).length;
  // No caps — momentum grows forever with real effort
  const consistency = totalStreak * 100;          // 100/day per active path
  const longevity   = totalLongest * 50;           // personal record bonus
  const breadthScore = breadth * 300;              // +300 first check-in on any path
  const volumeScore  = Math.round(Math.sqrt(totalDone) * 300); // sqrt growth
  const score = consistency + longevity + breadthScore + volumeScore;
  return { score, consistency, longevity, breadth: breadthScore, volume: volumeScore };
}

function evolutionFor(mxStreak: number) {
  const tiers = [
    { min: 0,   label: "Spark",    ring: "evo-tier-0" },
    { min: 7,   label: "Glow",     ring: "evo-tier-1" },
    { min: 21,  label: "Ignite",   ring: "evo-tier-2" },
    { min: 66,  label: "Forged",   ring: "evo-tier-3" },
    { min: 180, label: "Anchored", ring: "evo-tier-4" },
    { min: 365, label: "Identity", ring: "evo-tier-5" },
  ];
  let idx = 0;
  for (let i = 0; i < tiers.length; i++) if (mxStreak >= tiers[i].min) idx = i;
  const next = idx < tiers.length - 1 ? tiers[idx + 1].min : null;
  return { label: tiers[idx].label, next, daysToNext: next ? next - mxStreak : 0, ringClass: tiers[idx].ring };
}

function detectFlow(tracks: UserTrack[]) {
  return tracks.filter(x => liveStreak(x) >= 5).length >= 3;
}

function atRiskTracks(tracks: UserTrack[]) {
  const t = todayStr();
  return tracks.filter(x => (x.current_streak || 0) >= 7 && x.last_log_date !== t);
}

function maxStreak(tracks: UserTrack[]) {
  return tracks.reduce((m, x) => Math.max(m, x.current_streak || 0, x.longest_streak || 0), 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// ArcRing
// ─────────────────────────────────────────────────────────────────────────────

function ArcRing({ value, hueVar, color, size = 84 }: { value: number; hueVar?: string; color?: string; size?: number }) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  const strokeColor = color ?? (hueVar ? `var(${hueVar})` : "currentColor");
  return (
    <svg width={size} height={size} className="-rotate-90" overflow="visible">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="oklch(1 0 0 / 0.15)" strokeWidth={stroke} fill="none" />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r}
        stroke={strokeColor} strokeWidth={stroke} strokeLinecap="round" fill="none"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c - (c * v) / 100 }}
        transition={{ type: "spring", stiffness: 60, damping: 16 }}
        style={{ filter: `drop-shadow(0 0 6px ${strokeColor})` }}
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// useCountUp
// ─────────────────────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v;
}

// ─────────────────────────────────────────────────────────────────────────────
// Meter
// ─────────────────────────────────────────────────────────────────────────────

function Meter({ label, v, max }: { label: string; v: number; max: number }) {
  const pct = Math.min(100, (v / max) * 100);
  return (
    <div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.2, 0.9, 0.2, 1] }}
          className="h-full bg-foreground rounded-full"
        />
      </div>
      <p className="mt-1 text-[10px] uppercase tracking-[0.15em] font-mono text-foreground/60">{label}</p>
    </div>
  );
}

function SlotNumber({ value }: { value: number }) {
  const [pair, setPair] = useState<[number, number]>([value, value]);
  const [anim, setAnim] = useState(false);
  const prev = useRef(value);
  useEffect(() => {
    if (value === prev.current) return;
    const next = value;
    setPair([prev.current, next]);
    setAnim(false);
    const r = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setAnim(true);
        setTimeout(() => {
          prev.current = next;
          setPair([next, next]);
          setAnim(false);
        }, 430);
      })
    );
    return () => cancelAnimationFrame(r);
  }, [value]);
  return (
    <span style={{ display: "inline-block", overflow: "hidden", height: "0.85em", verticalAlign: "bottom" }}>
      <span style={{ display: "flex", flexDirection: "column", transition: anim ? "transform 0.38s cubic-bezier(0.22,1,0.36,1)" : "none", transform: anim ? "translateY(-50%)" : "translateY(0)" }}>
        <span style={{ height: "0.85em" }}>{pair[0]}</span>
        <span style={{ height: "0.85em" }}>{pair[1]}</span>
      </span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PrizeRequestModal — shown at 100k milestone
// ─────────────────────────────────────────────────────────────────────────────
function PrizeRequestModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ name: "", address: "", city: "", zip: "", country: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      const { supabase } = await import('./supabase');
      await supabase.from("prize_requests").insert({
        name: form.name, address: form.address, city: form.city,
        zip: form.zip, country: form.country, momentum_score: 100000,
        created_at: new Date().toISOString(),
      });
      // Also notify via API route if available
      try {
        await fetch("/api/prize-request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      } catch (_) { /* API route optional */ }
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.6)" }}
        onClick={(e) => e.target === e.currentTarget && onClose()}>
        <motion.div initial={{ scale: 0.93, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.93, y: 24 }}
          className="w-full max-w-md bg-card rounded-3xl p-6 relative shadow-2xl">
          <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>

          {status === "done" ? (
            <div className="text-center py-8">
              <div className="text-5xl mb-4">🏆</div>
              <h2 className="font-display text-2xl mb-2">Request submitted!</h2>
              <p className="text-muted-foreground text-sm">You'll receive your physical badge within 7–10 business days. You're a legend.</p>
              <button onClick={onClose} className="mt-6 btn-primary px-8 py-2.5 rounded-full font-semibold text-sm">Chiudi</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: "#FCEBEB" }}>
                  <Crown className="h-5 w-5" style={{ color: "#E24B4A" }} />
                </div>
                <div>
                  <p className="font-display text-lg leading-tight">You've reached 100k Momentum</p>
                  <p className="text-xs text-muted-foreground">Enter your address to receive the physical badge</p>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nome e cognome</label>
                <input required value={form.name} onChange={f("name")} placeholder="Brendon Hoxha"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Indirizzo</label>
                <input required value={form.address} onChange={f("address")} placeholder="Via Roma 12, Appartamento 3"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Città</label>
                  <input required value={form.city} onChange={f("city")} placeholder="Milano"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">ZIP</label>
                  <input required value={form.zip} onChange={f("zip")} placeholder="20100"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Country</label>
                <input required value={form.country} onChange={f("country")} placeholder="Italia"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20" />
              </div>

              {status === "error" && (
                <p className="text-xs text-red-500">Something went wrong. Please try again shortly.</p>
              )}
              <button type="submit" disabled={status === "loading"}
                className="w-full py-3 rounded-2xl font-semibold text-sm text-white flex items-center justify-center gap-2"
                style={{ background: "#E24B4A" }}>
                {status === "loading" ? <Spinner light /> : <><Crown className="h-4 w-4" /> Request physical badge</>}
              </button>
              <p className="text-[10px] text-muted-foreground text-center">
                Your address is only used for shipping. It is never shared with third parties.
              </p>
            </form>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MomentumHero
// ─────────────────────────────────────────────────────────────────────────────

function MomentumHero({ tracks, user, onUpdateUser, onCheckIn, onView }: {
  tracks: UserTrack[];
  user: ElevateUser;
  onUpdateUser: (patch: Partial<ElevateUser>) => void;
  onCheckIn: (id: string) => void;
  onView: (t: UserTrack) => void;
}) {
  const m = computeMomentum(tracks);
  const mxStreak = maxStreak(tracks);
  const evo = evolutionFor(mxStreak);
  const inFlow = detectFlow(tracks);
  const atRisk = atRiskTracks(tracks);
  const animated = useCountUp(m.score);

  // Peak momentum — persists forever, drives milestone badges
  const [peakScore, setPeakScore] = useState<number>(() => lsLoad<number>("forge-peak-momentum", 0));
  const [showPrizeModal, setShowPrizeModal] = useState(false);
  useEffect(() => {
    if (m.score > peakScore) {
      setPeakScore(m.score);
      lsSave("forge-peak-momentum", m.score);
    }
  }, [m.score]);

  const effectivePeak = Math.max(m.score, peakScore);
  const reachedMilestones = MOMENTUM_MILESTONES.filter(ms => effectivePeak >= ms.threshold);
  const nextMs = getNextMilestone(m.score);
  const tier = getMomentumTier(m.score);
  const tierColor = getMomentumTierColor(tier);
  const pct = Math.min(1, m.score / nextMs.threshold);
  const isMaxed = m.score >= 100_000;
  const hasPeakBadge = !!user.peakReachedAt;

  // Milestone confetti bursts
  const prevPeakRef = useRef(peakScore);
  useEffect(() => {
    const prev = prevPeakRef.current;
    prevPeakRef.current = effectivePeak;
    const justHit = MOMENTUM_MILESTONES.find(ms => prev < ms.threshold && effectivePeak >= ms.threshold);
    if (!justHit) return;
    const gold = justHit.icon === "flame" ? ["#E24B4A","#F09595","#FFFFFF","#F7C1C1"] : ["#EF9F27","#FAC775","#FFFFFF","#FAEEDA"];
    confetti({ particleCount: 120, spread: 90, startVelocity: 45, gravity: 0.9, ticks: 250, origin: { x: 0.5, y: 0.35 }, colors: gold });
    if (justHit.key === "100k") onUpdateUser({ peakReachedAt: new Date().toISOString() });
  }, [effectivePeak]);

  const size = 168;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div className="space-y-3 mb-7">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="rounded-3xl p-5 depth-card relative overflow-hidden">
        <div className="flex items-center gap-5 relative">
          <div className="relative shrink-0" style={{ width: size, height: size }}>
            <div className={`absolute inset-0 rounded-full ${isMaxed ? "peak-ring" : evo.ringClass}`} style={{ padding: 3 }}>
              <div className="h-full w-full rounded-full bg-card" />
            </div>
            <svg width={size} height={size} className="absolute inset-0 -rotate-90">
              <circle cx={size / 2} cy={size / 2} r={r} stroke="oklch(0.5 0 0 / 0.25)" strokeWidth={stroke} fill="none" />
              <motion.circle cx={size / 2} cy={size / 2} r={r}
                stroke={tierColor.stroke}
                strokeWidth={stroke} strokeLinecap="round" fill="none"
                strokeDasharray={c}
                initial={{ strokeDashoffset: c }}
                animate={{ strokeDashoffset: c - c * pct }}
                transition={{ type: "spring", stiffness: 50, damping: 18 }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground font-mono">Momentum</p>
              <p className="font-display text-[3.25rem] leading-none text-foreground num-rise">{animated.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground font-mono">/ {nextMs.label}</p>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            {/* Tier badge + evo label */}
            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.2em]"
                style={{
                  background: tierColor.bg, color: tierColor.text,
                  ...(tier === "yellow-pulse" || tier === "red-pulse"
                    ? { animation: "momentum-pulse 1.6s ease-in-out infinite" } : {})
                }}>
                {tier === "red" || tier === "red-pulse"
                  ? <Flame className="h-3 w-3" />
                  : <Zap className="h-3 w-3" />}
                {evo.label}
              </span>
              {/* Permanent milestone badges */}
              {reachedMilestones.map(ms => {
                const is100k = ms.key === "100k";
                const is50k  = ms.key === "50k";
                const style100k: React.CSSProperties = { background: "#0D0D0D", color: "#FFD700", animation: "legend-pulse 2s ease-in-out infinite", letterSpacing: "0.12em" };
                const style50k:  React.CSSProperties = { background: "#C0392B", color: "#fff",    animation: "momentum-pulse 1.4s ease-in-out infinite" };
                const styleAmber: React.CSSProperties = { background: ms.key === "10k" ? "#FAC775" : "#FAEEDA", color: ms.key === "10k" ? "#412402" : "#633806", animation: ms.key === "10k" ? "momentum-pulse 1.6s ease-in-out infinite" : undefined };
                const badgeStyle = is100k ? style100k : is50k ? style50k : styleAmber;
                return (
                  <span key={ms.key}
                    onClick={is100k ? () => setShowPrizeModal(true) : undefined}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.2em] font-bold"
                    style={{ cursor: is100k ? "pointer" : "default", ...badgeStyle }}
                    title={is100k ? "Click to claim your prize" : `${ms.label} reached`}>
                    {is100k ? "★" : ms.icon === "flame" ? <Flame className="h-2.5 w-2.5" /> : <Zap className="h-2.5 w-2.5" />}
                    {is100k ? " 100k ★" : ms.label}
                  </span>
                );
              })}
            </div>

            <h2 className="font-display text-2xl leading-tight tracking-tight">
              {isMaxed
                ? "Absolute legend. You made history."
                : m.score >= 50_000 ? "You're among the best in the world."
                : m.score >= 10_000 ? "Elite level. Keep pushing."
                : m.score >= 1_000 ? "You're on fire."
                : m.score >= 300 ? "Momentum is building."
                : "Today is day one."}
            </h2>

            {/* 50k → 100k teaser */}
            {effectivePeak >= 50_000 && effectivePeak < 100_000 && (
              <p className="mt-1.5 text-[11px] rounded-xl px-2.5 py-1.5 inline-flex items-center gap-1.5"
                style={{ background: "#FCEBEB", color: "#791F1F" }}>
                <Crown className="h-3 w-3 shrink-0" />
                At 100k you can <button onClick={() => setShowPrizeModal(false)} className="underline font-semibold">claim the physical badge</button>
              </p>
            )}
            {effectivePeak >= 100_000 && (
              <button onClick={() => setShowPrizeModal(true)}
                className="mt-1.5 text-[11px] rounded-xl px-2.5 py-1.5 inline-flex items-center gap-1.5 font-semibold"
                style={{ background: "#E24B4A", color: "#fff" }}>
                <Crown className="h-3 w-3 shrink-0" /> Claim your physical prize →
              </button>
            )}

            {!isMaxed && evo.next && (
              <p className="mt-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{evo.daysToNext}</span> day{evo.daysToNext === 1 ? "" : "s"} to{" "}
                <span className="font-semibold text-foreground">{evolutionFor(evo.next).label}</span>
              </p>
            )}
            <div className="mt-3 grid grid-cols-4 gap-1.5">
              <Meter label="Volume" v={m.volume} max={Math.max(300, m.volume)} />
              <Meter label="Streak" v={m.consistency} max={Math.max(400, m.consistency)} />
              <Meter label="Depth" v={m.longevity} max={Math.max(200, m.longevity)} />
              <Meter label="Breadth" v={m.breadth} max={Math.max(1500, m.breadth)} />
            </div>

            {/* Prize modal */}
            {showPrizeModal && <PrizeRequestModal onClose={() => setShowPrizeModal(false)} />}
          </div>
        </div>
      </motion.div>

      {inFlow && (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
          className="flow-banner rounded-2xl p-3.5 flex items-center gap-3 text-white">
          <Zap className="h-5 w-5 shrink-0" fill="currentColor" />
          <div className="flex-1 min-w-0">
            <p className="font-display text-sm leading-tight">You are in flow right now.</p>
            <p className="text-[11px] opacity-90">Protect this. Don't break the rhythm.</p>
          </div>
        </motion.div>
      )}

      {atRisk.map(t => (
        <motion.div key={t.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
          className="rounded-2xl p-3.5 border-2 border-[color:var(--secondary)] bg-card flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-[color:var(--secondary)] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight">
              Your <span className="font-mono">{t.current_streak}</span>-day streak on{" "}
              <span className="font-semibold">{t.name}</span> is at risk.
            </p>
            <p className="text-[11px] text-muted-foreground">Check in today. I know you can do this.</p>
          </div>
          <button onClick={() => onView(t)}
            className="shrink-0 rounded-full bg-[color:var(--secondary)] text-white px-3 py-1.5 text-xs font-semibold flex items-center gap-1 btn-chunk">
            <Flame className="h-3 w-3" /> Save it
          </button>
        </motion.div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LandingPage
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// LoginPage helpers
// ─────────────────────────────────────────────────────────────────────────────

function PrizeClaimModal({ userName, onClose }: { userName: string; onClose: () => void }) {
  const [name, setName] = useState(userName);
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  async function handleSubmit() {
    if (!name.trim() || !email.trim() || !address.trim()) return;
    setSubmitting(true);
    try {
      await supabase.from('prize_claims').insert({
        name: name.trim(), email: email.trim(),
        address: address.trim(), claimed_at: new Date().toISOString(),
      });
      setDone(true);
    } catch (_) {
      // ignore
    } finally {
      setSubmitting(false);
    }
  }
  if (done) return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{background:'rgba(0,0,0,0.75)'}}>
      <div className="w-full max-w-md bg-neutral-900 rounded-t-2xl p-6 pb-10">
        <p className="text-white text-lg font-semibold text-center mb-2">You're on the list!</p>
        <p className="text-white/50 text-sm text-center mb-6">We'll send your personalised prize to the address you provided.</p>
        <button onClick={onClose} className="w-full py-3 rounded-xl bg-white/10 text-white text-sm font-medium">Close</button>
      </div>
    </div>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{background:'rgba(0,0,0,0.75)'}}>
      <div className="w-full max-w-md bg-neutral-900 rounded-t-2xl p-6 pb-10">
        <div className="flex items-center justify-between mb-4">
          <p className="text-white font-semibold">You made it!</p>
          <button onClick={onClose} className="text-white/40 text-2xl leading-none">&times;</button>
        </div>
        <p className="text-white/50 text-sm mb-5">You've reached the final stage. Enter your address below and we'll ship you a personalised prize for just €7.99.</p>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className="w-full mb-3 px-4 py-3 rounded-xl bg-white/10 text-white placeholder-white/30 text-sm border border-white/10 focus:outline-none" />
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Your email" type="email" className="w-full mb-3 px-4 py-3 rounded-xl bg-white/10 text-white placeholder-white/30 text-sm border border-white/10 focus:outline-none" />
        <textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="Delivery address" rows={3} className="w-full mb-5 px-4 py-3 rounded-xl bg-white/10 text-white placeholder-white/30 text-sm border border-white/10 focus:outline-none resize-none" />
        <button onClick={handleSubmit} disabled={submitting || !name.trim() || !email.trim() || !address.trim()} className="w-full py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-40">
          {submitting ? 'Sending…' : 'Send my address — €7.99'}
        </button>
      </div>
    </div>
  );
}
const GARDEN_STAGES = [
  { name: "The Bare Field",     img: "https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/stage-01.png" },
  { name: "The First Sprouts",  img: "https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/stage-02.png" },
  { name: "The Young Garden",   img: "https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/stage-03.png" },
  { name: "The Blooming Patch", img: "https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/stage-04.png" },
  { name: "The Meadow",         img: "https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/stage-05.png" },
  { name: "The Thicket",        img: "https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/stage-06.png" },
  { name: "The Young Grove",    img: "https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/stage-07.png" },
  { name: "The Forest",         img: "https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/stage-08.png" },
  { name: "The Living World",   img: "https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/stage-09.png" },
  { name: "The Ancient Canopy", img: "https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/stage-10.png" },
];

const MOUNTAIN_STAGES = [
  { name: "The Barren Summit",      img: "https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/forge/mountains/mount1.png" },
  { name: "The First Pine",         img: "https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/forge/mountains/mount2.png" },
  { name: "The Alpine Trail",       img: "https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/forge/mountains/mount3.png" },
  { name: "The Mountain Stream",    img: "https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/forge/mountains/mount4.png" },
  { name: "The Rising Peak",        img: "https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/forge/mountains/mount5.png" },
  { name: "The Alpine Lake",        img: "https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/forge/mountains/mount6.png" },
  { name: "The Summit Path",        img: "https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/forge/mountains/mount7.png" },
  { name: "The Sacred Peak",        img: "https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/forge/mountains/mount8.png" },
  { name: "The Enlightened Summit", img: "https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/forge/mountains/mount9.png" },
  { name: "The Celestial Peak",     img: "https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/forge/mountains/mount10.png" },
];

function ForestMomentum({ tracks, user, isPaused = false, islandTheme = 'garden' }: { tracks: UserTrack[]; user?: { name: string }; isPaused?: boolean; islandTheme?: 'garden' | 'mountain' }) {
  const THRESHOLDS = [0, 5, 12, 25, 50, 90, 150, 230, 330, 450];
  const STAGES = islandTheme === 'mountain' ? MOUNTAIN_STAGES : GARDEN_STAGES;
  const total = tracks.reduce((s, t) => s + (t.total_done ?? 0), 0);
  let stageIndex = 0;
  for (let i = THRESHOLDS.length - 1; i >= 0; i--) {
    if (total >= THRESHOLDS[i]) { stageIndex = i; break; }
  }
  const [justUnlocked, setJustUnlocked] = useState(false);
  const prevStageRef = useRef<number>(stageIndex);
  useEffect(() => {
    if (stageIndex > prevStageRef.current) {
      setJustUnlocked(true);
      const t = setTimeout(() => setJustUnlocked(false), 10000);
      prevStageRef.current = stageIndex;
      return () => clearTimeout(t);
    }
    prevStageRef.current = stageIndex;
  }, [stageIndex]);
  const [showClaim, setShowClaim] = useState(false);
  const stage = STAGES[stageIndex] ?? STAGES[0];
  const { name, img } = stage;
  const shareIsland = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080; canvas.height = 1920;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#060c18';
    ctx.fillRect(0, 0, 1080, 1920);
    const glow = ctx.createRadialGradient(540, 1300, 0, 540, 1300, 900);
    glow.addColorStop(0, 'rgba(10,34,64,0.9)');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 1080, 1920);
    [[162,192],[810,153],[972,422],[378,346],[594,96],[86,672],[885,269],[648,538],[518,230],[240,450],[900,380]].forEach(([x,y]) => {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.2 + Math.random() * 0.4) + ')';
      ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
    });
    try {
      const resp = await fetch(img, { mode: 'cors' });
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      await new Promise<void>((resolve) => {
        const i = new Image();
        i.onload = () => { ctx.drawImage(i, 540 - 380, 440, 760, 760); URL.revokeObjectURL(blobUrl); resolve(); };
        i.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(); };
        i.src = blobUrl;
      });
    } catch { /* skip image on error */ }
    const pill = (px: number, py: number, pw: number, ph: number, pr: number, fill: string, stroke: string) => {
      ctx.beginPath();
      ctx.moveTo(px+pr,py); ctx.lineTo(px+pw-pr,py); ctx.quadraticCurveTo(px+pw,py,px+pw,py+pr);
      ctx.lineTo(px+pw,py+ph-pr); ctx.quadraticCurveTo(px+pw,py+ph,px+pw-pr,py+ph);
      ctx.lineTo(px+pr,py+ph); ctx.quadraticCurveTo(px,py+ph,px,py+ph-pr);
      ctx.lineTo(px,py+pr); ctx.quadraticCurveTo(px,py,px+pr,py); ctx.closePath();
      ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke();
    };
    pill(60, 80, 180, 54, 27, 'rgba(10,25,50,0.8)', '#1e3a5c');
    ctx.fillStyle = '#4a7ab5'; ctx.font = '500 24px -apple-system,system-ui,sans-serif';
    ctx.textAlign = 'left'; ctx.fillText('FORGE', 100, 117);
    const stageText = name.toUpperCase();
    ctx.font = '500 26px -apple-system,system-ui,sans-serif';
    const stageW = ctx.measureText(stageText).width + 60;
    pill(540 - stageW/2, 1220, stageW, 58, 29, 'rgba(10,40,20,0.8)', '#1a4a2a');
    ctx.fillStyle = '#3a8060'; ctx.textAlign = 'center'; ctx.fillText(stageText, 540, 1257);
    ctx.fillStyle = '#e8f0fe';
    ctx.font = (total >= 100 ? '700 200px' : '700 240px') + ' -apple-system,system-ui,sans-serif';
    ctx.fillText(String(total), 540, 1560);
    ctx.fillStyle = '#4a6a90'; ctx.font = '400 36px -apple-system,system-ui,sans-serif';
    ctx.fillText('DAYS ON STREAK', 540, 1620);
    const trackTitle = tracks[0]?.name || 'Your Journey';
    ctx.font = '400 30px -apple-system,system-ui,sans-serif';
    const trackW = ctx.measureText(trackTitle).width + 80;
    pill(540 - trackW/2, 1650, trackW, 64, 32, 'rgba(20,45,80,0.8)', '#1e3a5c');
    ctx.fillStyle = '#7aaed4'; ctx.fillText(trackTitle, 540, 1691);
    ctx.strokeStyle = '#1a2840'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(80, 1750); ctx.lineTo(1000, 1750); ctx.stroke();
    const done = tracks.length ? Math.round(tracks.reduce((s,t) => s + (t.total_done??0), 0) / Math.max(1, tracks.reduce((s,t) => s + (t.target_days??1), 0)) * 100) : 0;
    ctx.fillStyle = '#c8daf5'; ctx.font = '600 64px -apple-system,system-ui,sans-serif';
    ctx.fillText(done + '%', 270, 1850);
    ctx.fillStyle = '#3a5575'; ctx.font = '400 26px -apple-system,system-ui,sans-serif';
    ctx.fillText('DONE', 270, 1895);
    ctx.strokeStyle = '#1a2840'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(540, 1780); ctx.lineTo(540, 1910); ctx.stroke();
    ctx.fillStyle = '#c8daf5'; ctx.font = '600 64px -apple-system,system-ui,sans-serif';
    ctx.fillText('Stage ' + (stageIndex + 1), 810, 1850);
    ctx.fillStyle = '#3a5575'; ctx.font = '400 26px -apple-system,system-ui,sans-serif';
    ctx.fillText('ISLAND', 810, 1895);
    ctx.fillStyle = '#2a3d55'; ctx.font = '400 22px -apple-system,system-ui,sans-serif';
    ctx.textAlign = 'right'; ctx.fillText('FORGE-APP.COM', 1020, 1960);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], 'forge-day-' + total + '.png', { type: 'image/png' });
      if (navigator.share && (navigator as any).canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Day ' + total + ' on Forge' });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = 'forge-day-' + total + '.png'; a.click();
        URL.revokeObjectURL(url);
      }
    }, 'image/png');
  };

  return (
    <>
      {showClaim && <PrizeClaimModal userName={user?.name ?? ''} onClose={() => setShowClaim(false)} />}
      <div className="select-none w-full flex overflow-x-auto" style={{scrollbarWidth: 'none', msOverflowStyle: 'none', scrollSnapType: 'x mandatory', WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 18%, black 82%, transparent 100%)', maskImage: 'linear-gradient(to right, transparent 0%, black 18%, black 82%, transparent 100%)'}}>
        <div className="shrink-0 flex flex-col items-center pt-4 pb-3" style={{minWidth: '100%', scrollSnapAlign: 'start'}}>
          <div className="relative" style={{width: '400px', height: '400px'}}>
            <img src={img} alt={name} className={`object-contain${justUnlocked ? ' island-unlock-anim' : ''}`} style={{WebkitTouchCallout: 'none', userSelect: 'none', width: '400px', height: '400px'}} loading="eager"  onContextMenu={(e) => e.preventDefault()} draggable={false}/>
            {isPaused && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
                <div className="absolute inset-0 fog-layer-1"/>
                <div className="absolute inset-0 fog-layer-2"/>
              </div>
            )}
          </div>
          <p className="text-sm font-medium text-white/60 tracking-widest uppercase mt-2">{name}</p>
          <button
            onClick={shareIsland}
            className="flex items-center gap-1.5 text-xs text-white/70 hover:text-white/90 transition-colors mt-3 px-4 py-2 rounded-full bg-white/8 border border-white/25 hover:bg-white/12 active:scale-95 font-medium"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            Share my island
          </button>
          {isPaused && (
            <div className="flex flex-col items-center gap-2 mt-3 px-6">
              <p className="text-sm text-white/50 text-center">Your island is waiting at <span className="font-medium text-white/80">day {total}</span></p>
              <button className="text-xs font-medium px-5 py-2 rounded-full border border-white/20 text-white/70 bg-white/5 active:bg-white/10 transition-colors">Reactivate your plan</button>
            </div>
          )}
          {stageIndex === 9 && (
          <>
            <p className="text-sm font-semibold text-white/80 mt-3 text-center">You've reached the final stage.</p>
          <p className="text-xs text-white/50 mt-1 text-center mb-3">Congratulations! Want to receive your prize at home?</p>
          <button onClick={() => setShowClaim(true)} className="px-5 py-2 rounded-full bg-emerald-600 text-white text-xs font-semibold tracking-wide">€7.99 — Get my prize</button>
          </>
          )}
        </div>
        {STAGES.slice(stageIndex + 1).map((s, i) => {
          const needed = THRESHOLDS[stageIndex + 1 + i] - total;
          return (
            <div key={s.name} className="shrink-0 flex flex-col items-center pt-4 pb-3 pl-6" style={{minWidth: 'calc(100% - 60px)', scrollSnapAlign: 'start'}}>
              <div className="relative">
                <img src={s.img} alt={s.name} className="object-contain" style={{WebkitTouchCallout: 'none', userSelect: 'none', width: '300px', height: '300px', filter: 'grayscale(1) brightness(0.18)'}} loading="lazy"  onContextMenu={(e) => e.preventDefault()} draggable={false}/>
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
              </div>
              <p className="text-sm text-white/20 tracking-widest uppercase mt-2">{s.name}</p>
              <p className="text-xs text-white/35 mt-1">{needed} check-in{needed !== 1 ? 's' : ''} to unlock</p>
            </div>
          );
        })}
      </div>
    </>
  );
}
function Spinner({ light = false }: { light?: boolean }) {
  return (
    <svg className={`animate-spin h-4 w-4 ${light ? "text-white" : "text-foreground"}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="16" height="18" viewBox="0 0 814 1000" fill="currentColor">
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.6-155.5-127.4C46.7 790.7 0 663 0 541.8c0-207.3 134.4-316.9 266.7-316.9 100.9 0 184.4 66.6 246.9 66.6 59.2 0 152.1-70.5 259.1-70.5zM552.7 140.8c-40 0-86.8-27.4-117.8-63.8-28-33.2-48.6-81-48.6-128.8 0-6.4.6-12.8 1.6-19.2 48.1 1.9 105 32.4 138.2 72.1 26.4 31.5 50.3 78.6 50.3 127.2 0 6.7-.6 13.4-1.6 20.1-7.2 1.6-14.4 2.4-22.1 2.4z"/>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LoginPage
// ─────────────────────────────────────────────────────────────────────────────

type LoginMode = "options" | "phone" | "otp" | "name";

function LoginPage({ onSuccess, onBack }: { onSuccess: (name: string) => void; onBack: () => void }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [mode, setMode] = useState<LoginMode>("options");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [phoneError, setPhoneError] = useState("");
  const [enteredName, setEnteredName] = useState<string>(() => lsLoad<string | null>("forge-pending-name", null) ?? "");

  // ── Real Supabase auth ──────────────────────────────────────────────────────

  // On mount: if we already have a Supabase session (e.g. returning from
  // Google OAuth redirect), jump straight to the name step.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setMode("name");
    });
  }, []);

  const [authError, setAuthError] = useState<string | null>(null);

  const handleGoogle = async () => {
    setLoading("google");
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) { setAuthError(error.message); setLoading(null); }
    // on success the browser will redirect — no further action needed here
  };

  const handlePhoneContinue = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 8) { setPhoneError("Enter a valid number"); return; }
    setPhoneError("");
    setAuthError(null);
    setLoading("phone-send");
    const { error } = await supabase.auth.signInWithOtp({ phone });
    setLoading(null);
    if (error) { setPhoneError(error.message); return; }
    setMode("otp");
  };

  const handleOtpVerify = async () => {
    if (otp.join("").length < 6) return;
    setLoading("phone");
    setAuthError(null);
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token: otp.join(""),
      type: "sms",
    });
    setLoading(null);
    if (error) { setAuthError(error.message); return; }
    setMode("name");
  };

  const handleOtpChange = (i: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[i] = digit;
    setOtp(next);
    if (digit && i < 5) {
      const nextInput = document.getElementById(`otp-${i + 1}`);
      nextInput?.focus();
    }
  };

  const btnPrimary = "w-full inline-flex items-center justify-center gap-2 rounded-xl grad-electric px-4 py-3 text-sm font-bold text-white shadow-[var(--shadow-violet)] disabled:opacity-40 transition-opacity";
  const btnSecondary = "w-full inline-flex items-center justify-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-40";

  return (
    <div className="relative min-h-screen flex items-center justify-center px-6 py-16 overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: "radial-gradient(70% 60% at 50% -10%,oklch(0.52 0.22 232 / 0.40),transparent 70%),radial-gradient(40% 50% at 85% 10%,oklch(0.55 0.20 255 / 0.25),transparent 60%),radial-gradient(40% 40% at 15% 30%,oklch(0.62 0.18 210 / 0.15),transparent 70%)" }} />

      <button onClick={onBack}
        className="absolute top-7 left-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="h-4 w-4" /> Back
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-2xl grad-electric flex items-center justify-center shadow-[var(--shadow-violet)]">
              <span className="font-display text-white text-lg leading-none font-bold">F</span>
            </div>
            <span className="font-display text-[18px] tracking-tight font-semibold">Forge</span>
          </div>
        </div>

        <div className="rounded-[2rem] border border-border bg-card p-8 shadow-2xl">
          <AnimatePresence mode="wait">

            {mode === "options" && (
              <motion.div key="options" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <h1 className="font-display text-2xl font-bold tracking-tight">Almost there</h1>
                <p className="text-sm text-muted-foreground mt-1 mb-6">Save your path. Start Day 1.</p>

                <div className="space-y-3">
                  <button onClick={handleGoogle} disabled={!!loading} className={btnSecondary}>
                    {loading === "google" ? <Spinner /> : <><GoogleIcon /> Continue with Google</>}
                  </button>
                  {authError && <p className="text-xs text-red-400 text-center mt-1">{authError}</p>}
                </div>

                <div className="my-5 flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[11px] text-muted-foreground font-mono uppercase tracking-widest">o</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <button onClick={() => setMode("phone")} disabled={!!loading} className={btnSecondary}>
                  <Phone className="h-4 w-4 text-muted-foreground" /> Continue with phone
                </button>
              </motion.div>
            )}

            {mode === "phone" && (
              <motion.div key="phone" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}>
                <button onClick={() => setMode("options")} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors">
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                <h1 className="font-display text-2xl font-bold tracking-tight">Your number</h1>
                <p className="text-sm text-muted-foreground mt-1 mb-6">We'll send you a code via SMS.</p>
                <div className="space-y-3">
                  <div>
                    <input
                      type="tel" value={phone} autoFocus
                      onChange={e => { setPhone(e.target.value); setPhoneError(""); }}
                      onKeyDown={e => e.key === "Enter" && handlePhoneContinue()}
                      placeholder="+39 333 000 0000"
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring transition"
                    />
                    {phoneError && <p className="text-xs text-red-400 mt-1.5">{phoneError}</p>}
                  </div>
                  <button onClick={handlePhoneContinue} disabled={!!loading} className={btnPrimary}>
                    {loading === "phone-send" ? <Spinner light /> : "Send code →"}
                  </button>
                </div>
              </motion.div>
            )}

            {mode === "otp" && (
              <motion.div key="otp" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}>
                <h1 className="font-display text-2xl font-bold tracking-tight">Enter the code</h1>
                <p className="text-sm text-muted-foreground mt-1 mb-6">Sent to {phone}.</p>
                <div className="space-y-4">
                  <div className="flex gap-2 justify-center">
                    {otp.map((digit, i) => (
                      <input
                        key={i} id={`otp-${i}`} type="text" inputMode="numeric"
                        maxLength={1} value={digit}
                        onChange={e => handleOtpChange(i, e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Backspace" && !digit && i > 0)
                            document.getElementById(`otp-${i - 1}`)?.focus();
                        }}
                        autoFocus={i === 0}
                        className="w-11 h-12 rounded-xl border border-border bg-background text-center text-xl font-mono font-bold outline-none focus:ring-2 focus:ring-ring transition"
                      />
                    ))}
                  </div>
                  <button onClick={handleOtpVerify} disabled={otp.join("").length < 6 || !!loading} className={btnPrimary}>
                    {loading === "phone" ? <Spinner light /> : "Verify →"}
                  </button>
                  <p className="text-xs text-center text-muted-foreground">
                    Didn't receive it?{" "}
                    <button onClick={() => { setOtp(["","","","","",""]); setMode("phone"); }} className="underline hover:text-foreground transition-colors">
                      Try again
                    </button>
                  </p>
                </div>
              </motion.div>
            )}

            {mode === "name" && (
              <motion.div key="name" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
                <div className="text-center mb-8">
                  <div className="mx-auto mb-5 h-14 w-14 rounded-2xl grad-electric flex items-center justify-center shadow-[var(--shadow-violet)]">
                    <span className="font-display text-white text-2xl font-bold">👋</span>
                  </div>
                  <h1 className="font-display text-2xl font-bold tracking-tight">What's your name?</h1>
                  <p className="text-sm text-muted-foreground mt-1">Your coach will use this every day.</p>
                </div>
                <div className="space-y-3">
                  <input
                    type="text" value={enteredName} autoFocus
                    onChange={e => setEnteredName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && enteredName.trim().length > 0 && onSuccess(enteredName.trim())}
                    placeholder="Your name"
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring transition text-center font-display text-lg"
                  />
                  <button
                    onClick={() => enteredName.trim().length > 0 && onSuccess(enteredName.trim())}
                    disabled={enteredName.trim().length === 0}
                    className={btnPrimary}>
                    Start Day 1 →
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        <p className="mt-4 text-center text-[11px] text-muted-foreground leading-relaxed">
          By continuing you agree to our{" "}
          <span className="underline cursor-pointer hover:text-foreground transition-colors">Terms of Service</span>
          {" e la "}
          <span className="underline cursor-pointer hover:text-foreground transition-colors">Privacy Policy</span>
        </p>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LandingPage
// ─────────────────────────────────────────────────────────────────────────────

function LandingPage({ onBegin }: { onBegin: () => void }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden text-foreground">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[900px]"
        style={{ background: "radial-gradient(70% 60% at 50% -10%,oklch(0.52 0.22 232 / 0.50),transparent 70%),radial-gradient(40% 50% at 85% 10%,oklch(0.55 0.20 255 / 0.30),transparent 60%),radial-gradient(40% 40% at 15% 30%,oklch(0.62 0.18 210 / 0.18),transparent 70%)" }} />

      <header className="container mx-auto flex items-center justify-between px-6 py-7">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-2xl grad-electric flex items-center justify-center shadow-[var(--shadow-violet)]">
            <span className="font-display text-white text-lg leading-none font-bold">F</span>
          </div>
          <span className="font-display text-[18px] tracking-tight font-semibold">Forge</span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-mono">
          <Eye className="h-3 w-3" /> Public demo
        </span>
      </header>

      <main className="container mx-auto px-6 relative">
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="pt-16 pb-16 max-w-4xl">
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground font-mono">
            A transformation engine · est. 2026
          </motion.p>

          {/* New headline */}
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.1 }}
            className="mt-6 font-display text-[clamp(2.6rem,8vw,6.8rem)] leading-[0.93] tracking-[-0.05em] font-bold">
            The app built<br />
            for the battle<br />
            <span className="text-[color:var(--secondary)] italic">only you know</span><br />
            you're fighting.
          </motion.h1>

          {/* Sub-headline */}
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-8 text-xl text-muted-foreground max-w-md leading-relaxed">
            No judgment. No performance.<br />Just the work.
          </motion.p>

          {/* Live counter */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.45 }}
            className="mt-7 inline-flex items-center gap-3 rounded-full bg-card/80 border border-border px-5 py-2.5 backdrop-blur-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" style={{ boxShadow: "0 0 6px 2px oklch(0.75 0.19 155 / 0.6)" }} />
            <span className="text-sm text-muted-foreground">Today, <strong className="text-foreground">847 people</strong> are on day 1. You're not alone.</span>
          </motion.div>

          {/* Privacy line */}
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.55 }}
            className="mt-3 text-[12px] text-emerald-500/80 font-mono flex items-center gap-1.5">
            Everything you write here is yours alone. We don't read it.
          </motion.p>

          {/* CTA */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-8 flex flex-wrap items-center gap-4">
            <button onClick={onBegin}
              className="btn-chunk group inline-flex items-center gap-2 rounded-full grad-electric px-9 py-4 text-sm font-bold text-white shadow-[var(--shadow-violet)]">
              Begin <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition" />
            </button>
          </motion.div>
        </section>

        {/* ── Testimonials ──────────────────────────────────────────────────── */}
        <section className="pb-16 max-w-3xl">
          <div className="grid md:grid-cols-2 gap-4">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
              className="warm-card rounded-[1.5rem] p-6 relative">
              <div className="absolute top-4 left-5 text-3xl leading-none text-foreground/15 font-display font-bold select-none">"</div>
              <p className="text-sm leading-relaxed text-foreground pt-4">
                Day 47. I deleted the app on day 12. Came back. It waited for me.
              </p>
              <p className="mt-4 text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-mono">Day 47 · Quit Pornography</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.1 }}
              className="warm-card rounded-[1.5rem] p-6 relative">
              <div className="absolute top-4 left-5 text-3xl leading-none text-foreground/15 font-display font-bold select-none">"</div>
              <p className="text-sm leading-relaxed text-foreground pt-4">
                I've tried 6 apps. This is the first one that felt like it actually knew what I was going through.
              </p>
              <p className="mt-4 text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-mono">Day 23 · Social Anxiety</p>
            </motion.div>
          </div>
        </section>

        {/* ── Feature cards ─────────────────────────────────────────────────── */}
        <section className="relative pb-32 max-w-5xl">
          <div className="grid md:grid-cols-12 gap-6">
            <motion.article initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="md:col-span-7 warm-card rounded-[2rem] p-8 md:p-10 relative ambient-warm">
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">01 — Specialist coaches</p>
              <h3 className="mt-4 font-display text-3xl md:text-4xl leading-tight">
                Each habit, its own <span className="italic">world-class mind</span>.
              </h3>
              <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-md">
                CBT for anxiety. Allen Carr for nicotine. Progressive overload for strength.
                Every coach is trained in the actual framework behind the change.
              </p>
            </motion.article>

            <motion.article initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
              className="md:col-span-5 md:mt-12 warm-card rounded-[2rem] p-8">
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">02 — Streaks that breathe</p>
              <h3 className="mt-4 font-display text-3xl leading-tight italic">Shielded, not shamed.</h3>
              <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                Life happens. Earn Shields. Spend them. Your story keeps its shape.
              </p>
            </motion.article>

            <motion.article initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 }}
              className="md:col-span-5 md:-mt-6 warm-card rounded-[2rem] p-8">
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">03 — Identity, not points</p>
              <h3 className="mt-4 font-display text-3xl leading-tight">
                <span className="italic">You are becoming</span> someone.
              </h3>
              <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                Day 21: you are a person who meditates. We track who, not what.
              </p>
            </motion.article>

            <motion.article initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
              className="md:col-span-7 warm-card rounded-[2rem] p-8 md:p-10">
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">04 — A coach that knows you</p>
              <h3 className="mt-4 font-display text-3xl md:text-4xl leading-tight">
                Not a dashboard. <span className="italic">A companion.</span>
              </h3>
              <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-md">
                Your coach remembers what you've said, what you've done, and what you're working towards.
                Every day builds on the last.
              </p>
            </motion.article>
          </div>
        </section>

        <section className="pb-24 max-w-3xl">
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Five worlds. Fifty paths.</p>
          <div className="mt-6 flex flex-wrap gap-2 text-xs">
            {["Fitness & Body", "Mental Health", "Quit Bad Habits", "Mind & Learning", "Productivity & Life"].map(c => (
              <span key={c} className="rounded-full border border-border bg-card px-4 py-2 text-foreground font-mono uppercase tracking-widest text-[10px]">{c}</span>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-10 text-center">
        <p className="font-display italic text-sm text-muted-foreground">Forge · {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OnboardingPage
// ─────────────────────────────────────────────────────────────────────────────

type OnboardingStep = "question" | "thinking" | "response" | "tracks" | "island" | "name";

function OnboardingPage({ onComplete }: { onComplete: (data: { track: OnboardingTrack; name?: string }) => void }) {
  const [step, setStep] = useState<OnboardingStep>("question");
  const [showAllPaths, setShowAllPaths] = useState(false);
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState("");
  const [typedCount, setTypedCount] = useState(0);
  const [chosen, setChosen] = useState<OnboardingTrack | null>(null);
  const [islandThemePick, setIslandThemePick] = useState<'garden' | 'mountain'>('garden');
  const [suggestedSlug, setSuggestedSlug] = useState<string | null>(null);
  const [pendingTrackForName, setPendingTrackForName] = useState<OnboardingTrack | null>(null);
  const [onboardingName, setOnboardingName] = useState("");

  const words = useMemo(() => message.split(/(\s+)/), [message]);
  const typingDone = typedCount >= words.length && words.length > 0;

  useEffect(() => {
    if (step !== "response" || !message) return;
    setTypedCount(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1; setTypedCount(i);
      if (i >= words.length) clearInterval(id);
    }, 75);
    return () => clearInterval(id);
  }, [step, message, words.length]);

  const handleQuestion = async () => {
    if (answer.trim().length < 10) return;
    setStep("thinking");
    await new Promise(r => setTimeout(r, 1800));
    setMessage(pickCoachResponse(answer));
    setStep("response");
  };

  const grouped = ONBOARDING_TRACKS.reduce<Record<string, OnboardingTrack[]>>((acc, t) => {
    (acc[t.category] ??= []).push(t); return acc;
  }, {});

  return (
    <div className="relative min-h-screen flex items-center justify-center px-6 py-16 overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: "radial-gradient(60% 60% at 50% 25%,oklch(0.52 0.22 232 / 0.45),transparent 70%),radial-gradient(45% 55% at 85% 85%,oklch(0.55 0.20 255 / 0.28),transparent 70%)" }} />

      <AnimatePresence mode="wait">

        {step === "question" && (
          <motion.div key="q" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.7 }} className="max-w-3xl w-full text-center">
            <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground mb-10">One question</p>
            <h1 className="font-display text-[clamp(2rem,6vw,4.5rem)] leading-[1.05] tracking-[-0.04em] font-semibold">
              What is the one thing that,<br />
              if you changed it,<br />
              <span className="text-[color:var(--secondary)] italic">would change everything?</span>
            </h1>
            <div className="mt-14">
              <textarea autoFocus value={answer} onChange={e => setAnswer(e.target.value.slice(0, 1000))}
                placeholder="Be honest. No one else will read this."
                className="w-full bg-transparent border-0 border-b-2 border-border focus:border-foreground outline-none text-center font-display text-2xl placeholder:text-muted-foreground py-5 px-2 resize-none min-h-[140px] transition-colors" />
              <div className="mt-3 text-[11px] text-muted-foreground font-mono tracking-wider">
                {answer.trim().length < 10 ? `${Math.max(0, 10 - answer.trim().length)} more to continue` : "Ready when you are"}
              </div>
              <p className="mt-1.5 text-[11px] text-emerald-500/80 font-mono">This stays between you and your coach. Always.</p>
              <AnimatePresence>
                {answer.trim().length >= 10 && (
                  <motion.button key="cont" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    onClick={handleQuestion}
                    className="btn-chunk mt-10 inline-flex items-center gap-2 rounded-full grad-electric text-white px-9 py-4 text-sm font-bold shadow-[var(--shadow-violet)]">
                    Continue <ArrowRight className="h-4 w-4" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {step === "thinking" && (
          <motion.div key="t" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
            <div className="mx-auto h-28 w-28 rounded-full grad-electric breathe" style={{ boxShadow: "var(--shadow-violet)" }} />
            <p className="mt-10 font-display text-xl text-muted-foreground">Your coach is reading this…</p>
          </motion.div>
        )}

        {step === "response" && (
          <motion.div key="r" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.7 }} className="max-w-2xl w-full text-center">
            <div className="mx-auto h-14 w-14 rounded-full grad-electric mb-10" style={{ boxShadow: "var(--shadow-violet)" }} />
            <p className="font-display text-[clamp(1.25rem,2.5vw,1.75rem)] leading-[1.55] tracking-[-0.01em] text-foreground text-left">
              {words.slice(0, typedCount).join("")}
              {!typingDone && <span className="inline-block w-[2px] h-[1.1em] align-[-0.15em] ml-1 bg-foreground animate-pulse" />}
            </p>
            <AnimatePresence>
              {typingDone && (
                <motion.button key="rcont" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }}
                  onClick={() => { setSuggestedSlug(suggestTrackFromText(answer)); setStep("tracks"); }}
                  className="btn-chunk mt-12 inline-flex items-center gap-2 rounded-full grad-electric text-white px-9 py-4 text-sm font-bold shadow-[var(--shadow-violet)]">
                  Continue <ArrowRight className="h-4 w-4" />
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {step === "tracks" && (
          <motion.div key="tracks" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }} className="max-w-5xl w-full">
            <div className="text-center mb-10">
              <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground mb-4">Choose your path</p>
              <h2 className="font-display text-[clamp(1.75rem,4vw,3rem)] tracking-[-0.03em] leading-tight">
                Let's start with <span className="text-[color:var(--secondary)] italic">one thing</span>.
              </h2>
              <p className="mt-4 text-muted-foreground">You can add more later. For now, one commitment is enough.</p>
            </div>

            {/* ── Hero-card-only view when a suggestion exists ── */}
            {suggestedSlug && !showAllPaths && (() => {
              const sug = ONBOARDING_TRACKS.find(t => t.slug === suggestedSlug);
              if (!sug) return null;
              return (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="max-w-xl mx-auto">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-yellow-400 font-mono mb-4 text-center font-bold">✦ Your path, based on what you wrote</p>

                  {/* Hero card */}
                  <div className="warm-card rounded-[2rem] p-8 mb-6 text-center relative overflow-hidden"
                    style={{ boxShadow: "0 0 40px 8px oklch(0.875 0.185 95 / 0.35)", border: "2px solid oklch(0.875 0.185 95 / 0.6)" }}>
                    <div aria-hidden className="pointer-events-none absolute top-4 -right-8 h-40 w-40 rounded-full opacity-30"
                      style={{ background: "radial-gradient(circle, oklch(0.875 0.185 95 / 0.5), transparent 70%)" }} />
                    <p className="text-[10px] uppercase tracking-[0.3em] text-yellow-400 font-mono mb-3">{sug.category}</p>
                    <h3 className="font-display text-4xl font-bold mb-4">{sug.name}</h3>
                    {TRACK_GLOBAL_STATS[sug.slug] && (
                      <p className="text-sm text-muted-foreground leading-relaxed mb-6 max-w-sm mx-auto">
                        {TRACK_GLOBAL_STATS[sug.slug]}.<br />
                        <span className="text-yellow-400 font-medium">You're not alone in this.</span>
                      </p>
                    )}
                    <button onClick={() => { setPendingTrackForName(sug); setStep("island"); }}
                      className="btn-chunk w-full inline-flex items-center justify-center gap-2 rounded-full grad-electric text-white py-4 font-bold text-sm shadow-[var(--shadow-violet)]">
                      This is my path <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Toggle to see all paths */}
                  <button onClick={() => setShowAllPaths(true)}
                    className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-2 underline underline-offset-4">
                    That's not quite right — show me all 50 paths ↓
                  </button>
                </motion.div>
              );
            })()}

            {/* ── Full grid view ── */}
            {(showAllPaths || !suggestedSlug) && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

                {/* Pinned hero card at top if suggestion exists */}
                {suggestedSlug && (() => {
                  const sug = ONBOARDING_TRACKS.find(t => t.slug === suggestedSlug);
                  if (!sug) return null;
                  const isChosen = chosen?.slug === sug.slug;
                  return (
                    <div className="mb-8">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-yellow-400 font-mono mb-3 font-bold">✦ Suggested for you</p>
                      <button onClick={() => setChosen(sug)}
                        className={`w-full text-left warm-card rounded-2xl p-5 transition btn-chunk relative ${isChosen ? "ring-2 ring-yellow-400" : "ring-2 ring-yellow-400/60"}`}
                        style={{ boxShadow: "0 0 28px 4px oklch(0.875 0.185 95 / 0.38)" }}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="font-display text-xl font-semibold">{sug.name}</p>
                            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-0.5">{sug.category}</p>
                            {TRACK_GLOBAL_STATS[sug.slug] && (
                              <p className="text-xs text-yellow-400/90 mt-2 leading-relaxed">
                                {TRACK_GLOBAL_STATS[sug.slug]}. You're not alone in this.
                              </p>
                            )}
                          </div>
                          {isChosen
                            ? <Check className="h-5 w-5 mt-0.5 text-yellow-400 shrink-0" />
                            : <ArrowRight className="h-4 w-4 mt-1 text-yellow-400/60 shrink-0" />
                          }
                        </div>
                      </button>
                    </div>
                  );
                })()}

                <div className="space-y-8">
                  {Object.entries(grouped).map(([cat, tracks]) => (
                    <div key={cat}>
                      <h3 className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-mono mb-3">{cat}</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {tracks.map(t => {
                          const isSuggested = t.slug === suggestedSlug;
                          const isChosen = chosen?.slug === t.slug;
                          return (
                            <button key={t.slug} onClick={() => setChosen(t)}
                              className={`warm-card rounded-2xl p-4 text-left transition btn-chunk relative ${
                                isChosen ? "ring-2 ring-[color:var(--primary)]"
                                : isSuggested ? "ring-2 ring-yellow-400/50"
                                : ""
                              }`}
                              style={isSuggested ? { boxShadow: "0 0 12px 1px oklch(0.875 0.185 95 / 0.25)" } : undefined}>
                              <p className="font-semibold text-sm">{t.name}</p>
                              {isChosen && <Check className="h-4 w-4 mt-1 text-[color:var(--tertiary)]" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                {chosen && (
                  <div className="mt-10 text-center">
                    <button onClick={() => { setPendingTrackForName(chosen!); setStep("island"); }}
                      className="btn-chunk inline-flex items-center gap-2 rounded-full grad-electric text-white px-9 py-4 text-sm font-bold shadow-[var(--shadow-violet)]">
                      This is my path <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </motion.div>
            )}

          </motion.div>
        )}

        {step === "island" && (
          <motion.div key="island" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.6 }} className="max-w-lg w-full text-center">
            <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground mb-6">Choose your island</p>
            <h1 className="font-display text-[clamp(1.8rem,5vw,2.6rem)] leading-tight tracking-tight mb-2">
              Your island reflects<br /><span className="text-electric">your journey</span>
            </h1>
            <p className="text-sm text-muted-foreground mb-10 max-w-xs mx-auto">Every check-in grows your world. Pick the landscape that speaks to you.</p>
            <div className="grid grid-cols-2 gap-4 mb-8">
              {([
                { key: 'garden' as const, label: 'The Garden', desc: 'Forest & nature', img: 'https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/stage-01.png' },
                { key: 'mountain' as const, label: 'The Mountain', desc: 'Peaks & summits', img: 'https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/forge/mountains/mount1.png' },
              ] as { key: 'garden' | 'mountain'; label: string; desc: string; img: string }[]).map(({ key, label, desc, img }) => (
                <button
                  key={key}
                  onClick={() => setIslandThemePick(key)}
                  className={`relative flex flex-col items-center gap-3 rounded-2xl p-4 border-2 transition-all ${islandThemePick === key ? 'border-electric bg-electric/10' : 'border-white/10 bg-white/4 hover:border-white/25'}`}
                >
                  <div className="w-full aspect-square rounded-xl overflow-hidden bg-white/5 flex items-center justify-center">
                    <img src={img} alt={label} className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-white">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  {islandThemePick === key && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-electric flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={() => { localStorage.setItem('forge_island_theme', islandThemePick); setStep('name'); }}
              className="btn-chunk w-full inline-flex items-center justify-center gap-2 rounded-full grad-electric text-white py-4 font-bold text-sm shadow-[var(--shadow-violet)]"
            >
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          </motion.div>
        )}

        {step === "name" && (
          <motion.div key="name" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.6 }} className="max-w-lg w-full text-center">
            <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground mb-10">One last thing</p>
            <h1 className="font-display text-[clamp(2rem,5vw,3.5rem)] leading-[1.1] tracking-[-0.04em] font-semibold mb-4">
              What should your coach<br />
              <span className="text-[color:var(--secondary)] italic">call you?</span>
            </h1>
            <p className="text-muted-foreground text-sm mb-12">Your coach will use this every day.</p>
            <input
              type="text" autoFocus value={onboardingName}
              onChange={e => setOnboardingName(e.target.value.slice(0, 40))}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  const n = onboardingName.trim() || "Forger";
                  onComplete({ track: pendingTrackForName!, name: n });
                }
              }}
              placeholder="Your name"
              className="w-full bg-transparent border-0 border-b-2 border-border focus:border-foreground outline-none text-center font-display text-3xl placeholder:text-muted-foreground py-4 transition-colors"
            />
            <div className="mt-10 flex flex-col items-center gap-3">
              <button
                onClick={() => {
                  const n = onboardingName.trim() || "Forger";
                  onComplete({ track: pendingTrackForName!, name: n });
                }}
                className="btn-chunk inline-flex items-center gap-2 rounded-full grad-electric text-white px-9 py-4 text-sm font-bold shadow-[var(--shadow-violet)]">
                Start Day 1 <ArrowRight className="h-4 w-4" />
              </button>
              <button onClick={() => onComplete({ track: pendingTrackForName! })}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4">
                Skip for now
              </button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DashboardLayout
// ─────────────────────────────────────────────────────────────────────────────

function DashboardLayout({ currentPage, onNavigate, children }: {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  children: ReactNode;
}) {
  const navItems: { id: AppPage; icon: typeof Home; label: string }[] = [
    { id: "home",     icon: Home,     label: "Home" },
    { id: "tracks",   icon: Layers,   label: "Library" },
    { id: "insights", icon: BarChart3,label: "Stats" },
    { id: "settings", icon: Settings, label: "Settings" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-60 border-r border-border bg-card flex-col p-4">
        <div className="flex items-center gap-2 mb-8 px-2">
          <div className="h-8 w-8 rounded-lg grad-electric flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold tracking-tight font-display">Forge</span>
        </div>
        <nav className="flex-1 space-y-1">
          {navItems.map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => onNavigate(id)}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${currentPage === id ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"}`}>
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="md:ml-60 pb-24 md:pb-8">{children}</main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 border-t border-border bg-card z-50 flex justify-around py-2">
        {navItems.map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => onNavigate(id)}
            className={`flex flex-col items-center gap-1 px-4 py-1 text-[10px] ${currentPage === id ? "text-foreground" : "text-muted-foreground"}`}>
            <Icon className="h-5 w-5" />{label}
          </button>
        ))}
      </nav>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HomePage
// ─────────────────────────────────────────────────────────────────────────────
// ReEntryOverlay — shown when user returns after 3+ days away
// ─────────────────────────────────────────────────────────────────────────────

const REENTRY_MESSAGES = [
  "You're back. That's all that matters.",
  "The gap doesn't define the path. You're here now.",
  "I migliori non si arrendono — si ripartono. Ricominciamo.",
  "Every great story has a chapter where the main character comes back. This is yours.",
];

function ReEntryOverlay({ gapDays, onDismiss }: { gapDays: number; onDismiss: () => void }) {
  const msg = REENTRY_MESSAGES[hashStr(todayStr()) % REENTRY_MESSAGES.length];
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-7"
      style={{ background: "oklch(0.06 0.01 250 / 0.97)" }}
    >
      <div aria-hidden className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(55% 50% at 50% 40%, oklch(0.645 0.245 25 / 0.10), transparent 70%)" }} />
      <div className="relative max-w-sm w-full text-center">
        <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="text-[10px] uppercase tracking-[0.3em] font-mono text-muted-foreground mb-6">
          Welcome back — {gapDays} days later
        </motion.p>
        <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="font-display text-[2rem] leading-[1.2] tracking-[-0.02em] text-foreground mb-10">
          {msg}
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
          <button onClick={onDismiss}
            className="btn-chunk inline-flex items-center gap-2 rounded-full bg-foreground text-neutral-900 px-8 py-3 text-sm font-semibold">
            Ricominciamo <ArrowRight className="h-4 w-4" />
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SnowfallBackground
// ─────────────────────────────────────────────────────────────────────────────
// StreakRecoveryOverlay — shown when a streak breaks with no shield left
// ─────────────────────────────────────────────────────────────────────────────

function StreakRecoveryOverlay({
  brokenStreak,
  trackName,
  onDismiss,
}: {
  brokenStreak: number;
  trackName: string;
  onDismiss: () => void;
}) {
  return (
    <motion.div
      key="streak-recovery"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-7"
      style={{ background: "oklch(0.06 0.01 250 / 0.97)" }}
    >
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(55% 45% at 50% 55%, oklch(0.55 0.2 45 / 0.10), transparent 70%)",
        }}
      />
      <div className="relative max-w-sm w-full text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.88 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 180, damping: 22 }}
          className="mb-0"
        >
          <span
            className="font-display tracking-[-0.06em] leading-none text-foreground/10 select-none"
            style={{ fontSize: "clamp(5.5rem, 30vw, 10rem)" }}
          >
            {brokenStreak}
          </span>
        </motion.div>
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="text-[10px] uppercase tracking-[0.3em] font-mono text-muted-foreground mb-5"
        >
          days on {trackName}
        </motion.p>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="font-display text-[1.75rem] leading-[1.2] tracking-[-0.02em] text-foreground mb-3"
        >
          {"That's still "}{brokenStreak}{" days"}<br />{"you showed up."}
        </motion.p>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="text-sm text-muted-foreground leading-relaxed mb-8 max-w-[264px] mx-auto"
        >
          {"Streaks measure consistency — not worth. Missing one day doesn't erase what you built."}
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mb-8 rounded-2xl border border-border/40 bg-foreground/[0.04] px-5 py-4 text-left"
        >
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" />
            <div>
              <p className="text-xs font-semibold text-foreground mb-1">Shields protect your streak</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {"Forge gives you 1 Shield every 14 days of consistent use — automatically spent when you miss a day. Keep going to earn the next one."}
              </p>
            </div>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85 }}
        >
          <button
            onClick={onDismiss}
            className="btn-chunk inline-flex items-center gap-2 rounded-full bg-foreground text-background px-8 py-3 text-sm font-semibold"
          >
            Start fresh <ArrowRight className="h-4 w-4" />
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}


const SOS_ALTERNATIVES: Record<string, string[]> = {
  "quit-alcohol": [
    "Call someone you trust right now — even just to talk",
    "Drink a large glass of cold water slowly",
    "Walk outside for 5 minutes, no destination",
    "Write down exactly what triggered this urge",
    "Do 15 push-ups or jumping jacks right now",
  ],
  "quit-pornography": [
    "Go to a public space immediately — a café, a street, anywhere",
    "Do 20 push-ups right now, then 20 more",
    "Call or mext a friend — say anything",
    "Take a cold shower for 30 seconds",
    "Write down 3 things you want your life to look like in 1 year",
  ],
  "quit-drugs": [
    "Call your support person right now — this is what they are there for",
    "Go somewhere safe and public immediately",
    "Drink water and eat something — your body needs it",
    "Do intense physical activity for 10 minutes",
    "Write down exactly what triggered this moment",
  ],
  "quit-gambling": [
    "Put your devices in another room right now",
    "Call someone immediately — tell them where you are",
    "Go for a walk outside with no wallet",
    "Write down what you would do with the money you have saved",
    "Think about the last time gambling hurt you — write it down",
  ],
  "binge-eating": [
    "Drink 500ml of water slowly before anything else",
    "Go for a 10-minute walk right now",
    "Call or text someone to talk through what you are feeling",
    "Write down what emotion is underneath this urge",
    "Step outside for fresh air — change your environment",
  ],
  "video-game-addiction": [
    "Stand up, stretch, and walk to a different room",
    "Go outside for fresh air — even 5 minutes helps",
    "Call or message a friend to do something together",
    "Do 10 minutes of physical movement",
    "Make yourself a healthy meal or snack",
  ],
  "compulsive-shopping": [
    "Close all browser tabs and apps immediately",
    "The urge will peak and pass — wait 20 minutes",
    "Write down what you were feeling before the urge hit",
    "Go for a walk without your phone or wallet",
    "Calculate what you have saved this week by not buying",
  ],
  "social-media-addiction": [
    "Put your phone in another room right now",
    "Go outside and observe your surroundings for 5 minutes",
    "Do something with your hands — cook, draw, clean",
    "Call someone instead of scrolling",
    "Write one page in a journal — about anything",
  ],
};

const SOS_GENERIC = [
  "Take a slow, deep breath right now — 4 counts in, 8 out",
  "Go to a different room or step outside",
  "Call or text someone you trust",
  "Write down exactly how you are feeling",
  "Do 10 minutes of physical movement",
];

const BREATHE_PHASES = [
  { label: "Breathe in", sub: "through your nose", duration: 4000, targetScale: 1.45 },
  { label: "Hold", sub: "keep it steady", duration: 7000, targetScale: 1.45 },
  { label: "Breathe out", sub: "slowly through your mouth", duration: 8000, targetScale: 0.85 },
] as const;

function SOSOverlay({ tracks, onDismiss }: { tracks: UserTrack[]; onDismiss: () => void }) {
  const [sosPhase, setSosPhase] = useState<"breathe" | "ground" | "act">("breathe");
  const [breatheIdx, setBreatheIdx] = useState(0);
  const [breatheCycles, setBreatheCycles] = useState(0);
  const [breatheScale, setBreatheScale] = useState(0.85);

  useEffect(() => {
    if (sosPhase !== "breathe") return;
    const { duration, targetScale } = BREATHE_PHASES[breatheIdx];
    setBreatheScale(targetScale);
    const t = window.setTimeout(() => {
      const next = (breatheIdx + 1) % 3;
      setBreatheIdx(next);
      if (next === 0) setBreatheCycles(c => c + 1);
    }, duration);
    return () => clearTimeout(t);
  }, [breatheIdx, sosPhase]);

  useEffect(() => {
    if (breatheCycles >= 2 && sosPhase === "breathe") setSosPhase("ground");
  }, [breatheCycles, sosPhase]);

  const primarySlug = tracks[0]?.slug ?? "";
  const alternatives = SOS_ALTERNATIVES[primarySlug] ?? SOS_GENERIC;
  const { label: breatheLabel, sub: breatheSub, duration: breatheDur } = BREATHE_PHASES[breatheIdx];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ background: "oklch(0.05 0.02 230 / 0.98)" }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden"
    >
      {/* ambient glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, oklch(0.35 0.15 230 / 0.12) 0%, transparent 70%)",
        }}
      />

      <AnimatePresence mode="wait">
        {sosPhase === "breathe" && (
          <motion.div
            key="breathe"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative flex flex-col items-center gap-8 px-6"
          >
            <p className="text-sm font-mono tracking-widest text-white/30 uppercase">
              sos — breathing
            </p>

            {/* Breathing circle */}
            <div className="relative flex items-center justify-center">
              <motion.div
                animate={{ scale: breatheScale }}
                transition={{ duration: breatheDur / 1000, ease: "easeInOut" }}
                className="rounded-full"
                style={{
                  width: 180,
                  height: 180,
                  background:
                    "radial-gradient(circle, oklch(0.55 0.18 230 / 0.6) 0%, oklch(0.35 0.15 230 / 0.2) 70%, transparent 100%)",
                  boxShadow: "0 0 60px oklch(0.55 0.18 230 / 0.3)",
                }}
              />
              <div className="absolute flex flex-col items-center gap-1">
                <span className="text-xl font-semibold text-white/90">{breatheLabel}</span>
                <span className="text-xs text-white/40">{breatheSub}</span>
              </div>
            </div>

            {/* Cycle dots */}
            <div className="flex gap-2">
              {[0, 1].map(i => (
                <div
                  key={i}
                  className="h-1.5 w-1.5 rounded-full transition-all duration-500"
                  style={{
                    background:
                      i < breatheCycles
                        ? "oklch(0.75 0.15 230)"
                        : "oklch(0.4 0.05 230 / 0.4)",
                  }}
                />
              ))}
            </div>

            <p className="text-center text-sm text-white/30 max-w-xs">
              2 full cycles — then we ground you
            </p>

            <button
              onClick={() => setSosPhase("ground")}
              className="mt-2 text-xs text-white/20 underline underline-offset-4 hover:text-white/40 transition-colors"
            >
              skip
            </button>
          </motion.div>
        )}

        {sosPhase === "ground" && (
          <motion.div
            key="ground"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative flex flex-col items-center gap-8 px-8 max-w-sm text-center"
          >
            <p className="text-sm font-mono tracking-widest text-white/30 uppercase">
              sos — grounding
            </p>

            <div className="space-y-4">
              <p className="text-2xl font-semibold text-white/90 leading-snug">
                This urge will pass.
              </p>
              <p className="text-2xl font-semibold text-white/90 leading-snug">
                It always does.
              </p>
            </div>

            <div
              className="rounded-2xl p-5 space-y-3 text-left"
              style={{ background: "oklch(0.12 0.03 230 / 0.8)", border: "1px solid oklch(0.3 0.08 230 / 0.3)" }}
            >
              <p className="text-sm font-medium text-white/60">What's happening in your brain</p>
              <p className="text-sm text-white/40 leading-relaxed">
                Urges peak at 15–20 minutes, then naturally subside. Your prefrontal cortex — the part that makes decisions — is temporarily overwhelmed. It will come back online.
              </p>
            </div>

            <button
              onClick={() => setSosPhase("act")}
              className="mt-2 rounded-2xl px-8 py-3.5 font-semibold text-white transition-all active:scale-95"
              style={{
                background: "oklch(0.45 0.18 230)",
                boxShadow: "0 0 20px oklch(0.45 0.18 230 / 0.4)",
              }}
            >
              Show me what to do
            </button>
          </motion.div>
        )}

        {sosPhase === "act" && (
          <motion.div
            key="act"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative flex flex-col items-center gap-6 px-8 max-w-sm w-full"
          >
            <p className="text-sm font-mono tracking-widest text-white/30 uppercase">
              sos — act now
            </p>

            <p className="text-center text-white/70 text-sm">
              Do <strong className="text-white/90">one</strong> of these right now:
            </p>

            <div className="space-y-3 w-full">
              {alternatives.map((alt, i) => (
                <div
                  key={i}
                  className="flex gap-3 items-start rounded-xl p-4"
                  style={{ background: "oklch(0.12 0.03 230 / 0.7)", border: "1px solid oklch(0.25 0.06 230 / 0.3)" }}
                >
                  <span
                    className="shrink-0 text-xs font-mono font-bold mt-0.5"
                    style={{ color: "oklch(0.65 0.15 230)" }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="text-sm text-white/80 leading-relaxed">{alt}</p>
                </div>
              ))}
            </div>

            <button
              onClick={onDismiss}
              className="mt-2 rounded-2xl px-8 py-3.5 font-semibold text-white transition-all active:scale-95"
              style={{
                background: "oklch(0.35 0.08 230)",
              }}
            >
              I'm okay now
            </button>

            <button
              onClick={() => { setBreatheIdx(0); setBreatheCycles(0); setBreatheScale(0.85); setSosPhase("breathe"); }}
              className="text-xs text-white/20 underline underline-offset-4 hover:text-white/40 transition-colors"
            >
              Breathe again
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SOSButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={() => setHovered(true)}
      onTouchEnd={() => setHovered(false)}
      whileTap={{ scale: 0.94 }}
      className="fixed z-40 flex items-center gap-2 rounded-full shadow-lg transition-all duration-300"
      style={{
        bottom: "5.5rem",
        right: "1rem",
        background: "oklch(0.18 0.05 230 / 0.92)",
        border: "1px solid oklch(0.35 0.1 230 / 0.5)",
        backdropFilter: "blur(12px)",
        padding: hovered ? "0.6rem 1.1rem" : "0.6rem",
        boxShadow: "0 0 20px oklch(0.45 0.18 230 / 0.25)",
      }}
    >
      {/* pulsing dot */}
      <div className="relative shrink-0 h-2.5 w-2.5">
        <div
          className="absolute inset-0 rounded-full animate-ping"
          style={{ background: "oklch(0.65 0.2 15 / 0.6)" }}
        />
        <div
          className="relative rounded-full h-2.5 w-2.5"
          style={{ background: "oklch(0.65 0.2 15)" }}
        />
      </div>
      <AnimatePresence>
        {hovered && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            className="overflow-hidden whitespace-nowrap text-xs font-medium text-white/80"
          >
            I'm struggling
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}


// ── SAVINGS CALCULATOR ──────────────────────────────────────────────────────

interface TrackSavings {
  costPerUnit: number;   // euro
  unitName: string;      // singolare
  unitNamePlural: string;
  emoji: string;
}

const TRACK_SAVINGS: Record<string, TrackSavings> = {
  "quit-alcohol": {
    costPerUnit: 7,
    unitName: "drink",
    unitNamePlural: "drink",
    emoji: "🍺",
  },
  "quit-pornography": {
    costPerUnit: 0,
    unitName: "sessione",
    unitNamePlural: "sessioni",
    emoji: "🧠",
  },
  "quit-drugs": {
    costPerUnit: 20,
    unitName: "dose",
    unitNamePlural: "dosi",
    emoji: "💊",
  },
  "quit-gambling": {
    costPerUnit: 30,
    unitName: "sessione",
    unitNamePlural: "sessioni",
    emoji: "🎲",
  },
  "binge-eating": {
    costPerUnit: 12,
    unitName: "binge",
    unitNamePlural: "binge",
    emoji: "🍕",
  },
  "video-game-addiction": {
    costPerUnit: 0,
    unitName: "sessione",
    unitNamePlural: "sessioni",
    emoji: "🎮",
  },
  "compulsive-shopping": {
    costPerUnit: 45,
    unitName: "acquisto",
    unitNamePlural: "acquisti",
    emoji: "🛍️",
  },
  "social-media-addiction": {
    costPerUnit: 0,
    unitName: "ora",
    unitNamePlural: "ore",
    emoji: "📵",
  },
};

function useCountUp(target: number, duration = 1400): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    const raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

function SavingsCard({ tracks }: { tracks: UserTrack[] }) {
  const primaryTrack = tracks[0];
  if (!primaryTrack) return null;

  const savings = TRACK_SAVINGS[primaryTrack.slug];
  if (!savings) return null;

  const totalDays = primaryTrack.total_done ?? 0;
  const totalMoney = savings.costPerUnit > 0 ? totalDays * savings.costPerUnit : 0;
  const totalUnits = totalDays;

  const animMoney = useCountUp(totalMoney);
  const animUnits = useCountUp(totalUnits);

  if (totalDays < 1) return null;

  const showMoney = savings.costPerUnit > 0;

  return (
    <div
      className="mx-4 mb-4 rounded-2xl p-4 flex gap-3"
      style={{
        background: "oklch(0.14 0.04 145 / 0.5)",
        border: "1px solid oklch(0.35 0.12 145 / 0.3)",
      }}
    >
      {showMoney && (
        <div className="flex-1 flex flex-col items-center gap-0.5">
          <span
            className="text-2xl font-bold tabular-nums"
            style={{ color: "oklch(0.82 0.18 145)" }}
          >
            €{animMoney}
          </span>
          <span className="text-xs text-white/40">risparmiati</span>
        </div>
      )}

      {showMoney && (
        <div
          className="w-px self-stretch"
          style={{ background: "oklch(0.35 0.08 145 / 0.3)" }}
        />
      )}

      <div className="flex-1 flex flex-col items-center gap-0.5">
        <span
          className="text-2xl font-bold tabular-nums"
          style={{ color: "oklch(0.82 0.18 145)" }}
        >
          {animUnits}
        </span>
        <span className="text-xs text-white/40">
          {totalUnits === 1 ? savings.unitName : savings.unitNamePlural} {savings.costPerUnit === 0 ? "evitate" : "saltate"}
        </span>
      </div>

      <div
        className="w-px self-stretch"
        style={{ background: "oklch(0.35 0.08 145 / 0.3)" }}
      />

      <div className="flex-1 flex flex-col items-center gap-0.5">
        <span
          className="text-2xl font-bold tabular-nums"
          style={{ color: "oklch(0.82 0.18 145)" }}
        >
          {totalDays}
        </span>
        <span className="text-xs text-white/40">
          {totalDays === 1 ? "giorno" : "giorni"} puliti
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface SnowflakeData { id: number; size: number; left: number; dur: number; opacity: number; }

function SnowfallBackground({ count = 45, speed = 1 }: { count?: number; speed?: number }) {
  const [flakes, setFlakes] = useState<SnowflakeData[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setFlakes(Array.from({ length: count }, (_, i) => ({
      id: i, size: Math.random() * 14 + 7,
      left: Math.random() * 100,
      dur: (Math.random() * 5 + 4) / speed,
      opacity: Math.random() * 0.65 + 0.25,
    })));
    setReady(true);
  }, [count, speed]);
  useEffect(() => {
    if (!ready || flakes.length === 0) return;
    const style = document.createElement("style");
    style.innerHTML = flakes.map(f => {
      const wx = Math.random() * 80 - 40;
      return `@keyframes sf${f.id}{0%{transform:translateY(-8vh) translateX(0) rotate(0deg)}100%{transform:translateY(108vh) translateX(${wx}px) rotate(360deg)}}`;
    }).join("");
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, [flakes, ready]);
  if (!ready) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {flakes.map(f => (
        <div key={f.id} className="absolute select-none"
          style={{ left: `${f.left}%`, top: 0, fontSize: `${f.size}px`, opacity: f.opacity,
            color: "#b8e0ff", animation: `sf${f.id} ${f.dur}s linear infinite`,
            textShadow: "0 0 6px rgba(180,220,255,0.95)" }}>❄</div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VacationModal
// ─────────────────────────────────────────────────────────────────────────────

function VacationModal({ track, onSave, onClose }: {
  track: UserTrack;
  onSave: (until: string) => void;
  onClose: () => void;
}) {
  const [days, setDays] = useState(3);
  const [customDays, setCustomDays] = useState("");
  const activeDays = customDays !== "" ? Math.max(1, Math.min(90, parseInt(customDays) || 1)) : days;
  const until = new Date(Date.now() + activeDays * 86_400_000).toISOString().slice(0, 10);
  const isActive = track.vacation_until && track.vacation_until >= todayStr();

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0" style={{backdropFilter:'blur(12px) saturate(160%)', WebkitBackdropFilter:'blur(12px) saturate(160%)', background:'oklch(0 0 0 / 0.45)'}}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="w-full max-w-sm rounded-3xl p-6" style={{background:'oklch(0.96 0 0 / 0.14)', backdropFilter:'blur(40px) saturate(200%)', WebkitBackdropFilter:'blur(40px) saturate(200%)', border:'1px solid oklch(1 0 0 / 0.25)', boxShadow:'0 24px 60px oklch(0 0 0 / 0.45)'}}
        onClick={e => e.stopPropagation()}>
        <p className="text-[10px] uppercase tracking-[0.3em] font-mono text-muted-foreground mb-2">Vacation mode</p>
        <h3 className="font-display text-xl mb-1">Protect your streak</h3>
        <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
          Traveling or need a break? Pause your streak — it won't reset.
        </p>
        {isActive ? (
          <>
            <div className="rounded-2xl bg-[color:var(--tertiary)]/10 border border-[color:var(--tertiary)]/20 p-4 mb-4 text-center">
              <p className="text-sm font-semibold text-[color:var(--tertiary)]">Pause active until {track.vacation_until}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 rounded-full border border-border px-4 py-2.5 text-sm font-medium">Chiudi</button>
              <button onClick={() => { onSave(""); onClose(); }}
                className="flex-1 btn-chunk rounded-full bg-[color:var(--secondary)] text-white px-4 py-2.5 text-sm font-semibold">
                End pause
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Quick presets */}
            <div className="flex gap-2 mb-3">
              {[3, 7, 14].map(d => (
                <button key={d} onClick={() => { setDays(d); setCustomDays(""); }}
                  className={`flex-1 rounded-xl border py-3 text-sm font-semibold transition btn-chunk ${customDays === "" && days === d ? "bg-foreground text-neutral-900 border-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
                  {d}g
                </button>
              ))}
            </div>
            {/* Custom days */}
            <div className="flex items-center gap-2 mb-5">
              <input
                type="number" min={1} max={90}
                value={customDays}
                onChange={e => setCustomDays(e.target.value)}
                placeholder="Custom days…"
                className="flex-1 rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-foreground/30 transition"
              />
              {customDays !== "" && <span className="text-xs text-muted-foreground font-mono shrink-0">days</span>}
            </div>
            <p className="text-xs text-muted-foreground text-center mb-5 font-mono">
              Streak protected until <span className="text-foreground">{until}</span>
            </p>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 rounded-full border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground">Cancel</button>
              <button onClick={() => { onSave(until); onClose(); }}
                className="flex-1 btn-chunk rounded-full bg-foreground text-neutral-900 px-4 py-2.5 text-sm font-semibold">
                Pause streak
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MissedAccessModal
// ─────────────────────────────────────────────────────────────────────────────

function MissedAccessModal({ tracks, onClose }: { tracks: UserTrack[]; onClose: () => void }) {
  const [message, setMessage] = useState("");
  const [track, setTrack] = useState(tracks[0]?.name ?? "");
  const [phase, setPhase] = useState<"form" | "sending" | "done">("form");

  const submit = async () => {
    if (!message.trim()) return;
    setPhase("sending");
    try {
      await fetch("/api/report-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          trackName: track,
          date: todayStr(),
        }),
      });
    } catch { /* best-effort */ }
    setPhase("done");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
      style={{ background: "oklch(0 0 0 / 0.65)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="w-full max-w-sm rounded-3xl p-6" style={{background:'oklch(0.12 0.02 248 / 0.85)', backdropFilter:'blur(40px) saturate(180%)', WebkitBackdropFilter:'blur(40px) saturate(180%)', border:'1px solid oklch(1 0 0 / 0.18)', boxShadow:'0 24px 60px oklch(0 0 0 / 0.5)'}}
      >
        {phase === "done" ? (
          <div className="text-center py-4">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-[color:var(--tertiary)]/15 flex items-center justify-center">
              <Check className="h-6 w-6 text-[color:var(--tertiary)]" />
            </div>
            <p className="font-display text-lg mb-1">Grazie.</p>
            <p className="text-sm text-muted-foreground">We'll take your feedback into account.</p>
            <button onClick={onClose} className="mt-5 btn-chunk rounded-full bg-foreground text-neutral-900 px-6 py-2.5 text-sm font-semibold">
              Chiudi
            </button>
          </div>
        ) : (
          <>
            <p className="text-[10px] uppercase tracking-[0.3em] font-mono text-muted-foreground mb-2">Feedback</p>
            <h3 className="font-display text-xl mb-1">Can't log in?</h3>
            <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
              Se hai avuto problemi ad aprire l'app, raccontaci cosa è successo. Ci aiuta a migliorare.
            </p>

            {tracks.length > 1 && (
              <div className="mb-3">
                <label className="text-[10px] uppercase tracking-[0.2em] font-mono text-muted-foreground block mb-1.5">Track</label>
                <select
                  value={track}
                  onChange={e => setTrack(e.target.value)}
                  className="w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-foreground"
                >
                  {tracks.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                </select>
              </div>
            )}

            <label className="text-[10px] uppercase tracking-[0.2em] font-mono text-muted-foreground block mb-1.5">Cosa è successo?</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="e.g. no connection, app wouldn't open..."
              rows={3}
              className="w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground resize-none mb-4"
            />

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 rounded-full border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition">
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={!message.trim() || phase === "sending"}
                className="flex-1 btn-chunk rounded-full bg-foreground text-neutral-900 px-4 py-2.5 text-sm font-semibold disabled:opacity-40 transition"
              >
                {phase === "sending" ? "Sending..." : "Send"}
              </button>
            </div>

            <p className="mt-3 text-center text-[10px] text-emerald-500/70 font-mono">
              Inviato privatamente al team Forge.
            </p>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MorningCoachOverlay
// ─────────────────────────────────────────────────────────────────────────────

function MorningCoachOverlay({ tracks, onDismiss }: { tracks: UserTrack[]; onDismiss: () => void }) {
  const [phase, setPhase] = useState<"typing" | "message">("typing");
  const [message, setMessage] = useState<string>("");
  const [revealed, setRevealed] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    // Pick best track (most recent activity, or first)
    const best = tracks.reduce<UserTrack | null>((acc, t) => {
      if (!acc) return t;
      if ((t.total_done || 0) > (acc.total_done || 0)) return t;
      return acc;
    }, null);
    if (!best) { onDismiss(); return; }

    const archetype = archetypeForSlug(best.slug);
    const fallbacks = MORNING_FALLBACKS[archetype.id];
    const fallback = fallbacks[hashStr(todayStr()) % fallbacks.length];

    // Try to get yesterday's note
    const days = lsLoad<JourneyDay[]>(LS_DAYS(best.slug), []);
    const yDay = yesterdayStr();
    const noteDay = days.find(d => d.completedAt?.slice(0, 10) === yDay && d.userNote?.trim());
    const userNote = noteDay?.userNote?.trim() ?? null;

    const run = async () => {
      // Show typing for 1.8s, then fetch/fallback
      await new Promise(r => setTimeout(r, 1800));
      if (!mountedRef.current) return;

      let result = fallback;
      if (userNote) {
        try {
          const res = await fetch("/api/coach", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: [{ role: "user", content: userNote }],
              voice: archetype.voice,
              context: `This is the user's morning check-in message from yesterday for their "${best.name}" journey. Write 2–3 sentences that feel personal, seen, and motivating — as if you read what they wrote and you're responding this morning. Do not use phrases like "I can see" or "I understand". Be warm, direct, human. No lists. Just speak to them.`,
            }),
          });
          if (res.ok) {
            const data = await res.json() as { reply?: string };
            if (data.reply?.trim() && mountedRef.current) result = data.reply.trim();
          }
        } catch { /* use fallback */ }
      }

      if (!mountedRef.current) return;
      setMessage(result);
      setPhase("message");
    };
    run();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Word-by-word typewriter reveal
  const words = message.split(" ");
  useEffect(() => {
    if (phase !== "message" || !message) return;
    setRevealed(0);
    const interval = setInterval(() => {
      setRevealed(prev => {
        if (prev >= words.length) { clearInterval(interval); return prev; }
        return prev + 1;
      });
    }, 60);
    return () => clearInterval(interval);
  }, [phase, message]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleText = words.slice(0, revealed).join(" ");
  const archetype = archetypeForSlug(tracks[0]?.slug ?? "meditation");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-7"
      style={{ background: "oklch(0.06 0.01 250 / 0.97)" }}
    >
      {/* Ambient glow */}
      <div aria-hidden className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(60% 55% at 50% 40%, oklch(0.52 0.22 232 / 0.12), transparent 70%)" }} />

      <div className="relative max-w-sm w-full">
        {/* Coach label */}
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-[10px] uppercase tracking-[0.3em] font-mono text-muted-foreground mb-6 text-center"
        >
          {archetype.tagline}
        </motion.p>

        {/* Message area */}
        <div className="min-h-[120px] flex items-center justify-center">
          {phase === "typing" ? (
            <div className="flex items-center gap-2">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="h-2 w-2 rounded-full bg-muted-foreground"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 0.7, delay: i * 0.15, repeat: Infinity, ease: "easeInOut" }}
                />
              ))}
            </div>
          ) : (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-display text-[1.6rem] leading-[1.25] tracking-[-0.02em] text-center text-foreground"
            >
              {visibleText}
              {revealed < words.length && (
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className="inline-block w-[2px] h-6 bg-foreground ml-1 align-middle"
                />
              )}
            </motion.p>
          )}
        </div>

        {/* CTA — shown once message is fully revealed */}
        <AnimatePresence>
          {phase === "message" && revealed >= words.length && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mt-10 flex justify-center"
            >
              <button
                onClick={onDismiss}
                className="btn-chunk inline-flex items-center gap-2 rounded-full bg-foreground text-neutral-900 px-8 py-3 text-sm font-semibold"
              >
                Begin today <ArrowRight className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// MilestoneOverlay
// ─────────────────────────────────────────────────────────────────────────────
const MILESTONE_MESSAGES: Record<number, { emoji: string; title: string; sub: string }> = {
  1:   { emoji: "🌱", title: "Day 1. Done.", sub: "The journey begins now." },
  3:   { emoji: "🔥", title: "3 days straight.", sub: "You're building something real." },
  7:   { emoji: "⚡", title: "A full week.", sub: "7 days straight. That's not nothing." },
  14:  { emoji: "💎", title: "Two weeks.", sub: "You're becoming this person." },
  30:  { emoji: "🏆", title: "30 days.", sub: "A month. A real habit." },
  66:  { emoji: "🧬", title: "66 days.", sub: "Science says it's now in your nature." },
  100: { emoji: "👑", title: "100 days.", sub: "Triple digits. Very few get here." },
  365: { emoji: "🌟", title: "A full year.", sub: "You're unrecognizable compared to who you were." },
};

function CertModal({ streak, tracks, islandTheme, userName, onDismiss }: {
  streak: number;
  tracks: Array<{ total_done?: number | null }>;
  islandTheme: string;
  userName: string;
  onDismiss: () => void;
}) {
  const total = tracks.reduce((s, t) => s + (t.total_done ?? 0), 0);
  const CT = [0, 5, 12, 25, 50, 90, 150, 230, 330, 450];
  let si = 0;
  for (let i = CT.length - 1; i >= 0; i--) { if (total >= CT[i]) { si = i; break; } }
  const stages = islandTheme === 'mountain' ? MOUNTAIN_STAGES : GARDEN_STAGES;
  const stage = stages[Math.min(si, stages.length - 1)];
  const [imgUrl, setImgUrl] = useState('');
  const [sharing, setSharing] = useState(false);
  useEffect(() => {
    (async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1080; canvas.height = 1080;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#060c18';
      ctx.fillRect(0, 0, 1080, 1080);
      const glow = ctx.createRadialGradient(540, 540, 0, 540, 540, 600);
      glow.addColorStop(0, 'rgba(59,130,246,0.15)');
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, 1080, 1080);
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(60, 60, 960, 5); ctx.fillRect(60, 1015, 960, 5);
      ctx.fillRect(60, 60, 5, 960); ctx.fillRect(1015, 60, 5, 960);
      const diamond = (cx: number, cy: number) => {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#d4af37'; ctx.fillRect(-7, -7, 14, 14); ctx.restore();
      };
      diamond(60, 60); diamond(1020, 60); diamond(60, 1020); diamond(1020, 1020);
      try {
        const img = new Image(); img.crossOrigin = 'anonymous';
        await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = stage.img; });
        ctx.drawImage(img, 290, 195, 500, 500);
      } catch {}
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = 'bold 26px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('❖  F O R G E  ❖', 540, 128);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '500 30px system-ui, sans-serif';
      ctx.fillText('Certificate of Progress', 540, 175);
      ctx.strokeStyle = 'rgba(212,175,55,0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(180, 730); ctx.lineTo(900, 730); ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 110px system-ui, sans-serif';
      ctx.fillText(String(streak), 540, 840);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = 'bold 32px system-ui, sans-serif';
      ctx.fillText('DAYS STRONG', 540, 888);
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.font = '500 36px system-ui, sans-serif';
      ctx.fillText(userName, 540, 950);
      ctx.fillStyle = 'rgba(212,175,55,0.8)';
      ctx.font = '24px system-ui, sans-serif';
      ctx.fillText(stage.name, 540, 995);
      canvas.toBlob(blob => { if (blob) setImgUrl(URL.createObjectURL(blob)); }, 'image/png');
    })();
  }, []);
  const handleShare = async () => {
    if (!imgUrl) return; setSharing(true);
    try {
      const blob = await fetch(imgUrl).then(r => r.blob());
      const file = new File([blob], 'forge-cert.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${streak} Days on Forge`, text: `${streak} consecutive days — certified.` });
      } else { const a = document.createElement('a'); a.href = imgUrl; a.download = 'forge-cert.png'; a.click(); }
    } catch {}
    setSharing(false);
  };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={onDismiss}>
      <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', damping: 22 }}
        className="w-full max-w-sm mb-6 mx-4 rounded-3xl border border-yellow-500/30 bg-[#0d1526] p-5 shadow-2xl"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-medium text-yellow-400/70 uppercase tracking-widest">Certificate</p>
          <button onClick={onDismiss} className="text-muted-foreground hover:text-white text-2xl leading-none">&times;</button>
        </div>
        {imgUrl ? (
          <img src={imgUrl} alt="certificate" className="w-full rounded-2xl mb-4 border border-white/10" />
        ) : (
          <div className="w-full aspect-square rounded-2xl mb-4 bg-white/5 animate-pulse" />
        )}
        <p className="text-center text-lg font-semibold mb-1">{streak} Days Strong</p>
        <p className="text-center text-sm text-muted-foreground mb-4">You showed up. That counts.</p>
        <div className="flex gap-3">
          <button onClick={handleShare} disabled={!imgUrl || sharing}
            className="flex-1 rounded-xl bg-yellow-500 py-3 text-sm font-semibold text-black disabled:opacity-50 active:scale-95 transition-transform">
            {sharing ? 'Sharing…' : 'Share'}
          </button>
          <button onClick={onDismiss} className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-muted-foreground">
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function MilestoneOverlay({ days, trackName, onDismiss }: { days: number; trackName: string; onDismiss: () => void }) {
  const m = MILESTONE_MESSAGES[days] ?? { emoji: "🔥", title: `Day ${days}!`, sub: "Keep it up." };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ background: "oklch(0.05 0.03 260 / 0.92)" }}>
      <motion.div initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="max-w-sm w-full text-center space-y-5">
        <motion.p initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.15 }}
          className="text-7xl">{m.emoji}</motion.p>
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground font-mono mb-2">{trackName}</p>
          <h2 className="font-display text-4xl font-bold tracking-tight leading-tight">{m.title}</h2>
          <p className="mt-2 text-muted-foreground text-lg">{m.sub}</p>
        </div>
        <button onClick={onDismiss}
          className="btn-chunk inline-flex items-center gap-2 rounded-full grad-electric text-white px-8 py-3.5 text-sm font-bold shadow-[var(--shadow-violet)]">
          Continue <ArrowRight className="h-4 w-4" />
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function HomePage({ user, tracks, onCheckIn, onNavigate, onUpdateUser, onView, onViewForCheckIn, onVacation }: {
  user: ElevateUser;
  tracks: UserTrack[];
  onCheckIn: (id: string) => void;
  onNavigate: (page: AppPage) => void;
  onUpdateUser: (patch: Partial<ElevateUser>) => void;
  onView: (t: UserTrack) => void;
  onViewForCheckIn: (t: UserTrack) => void;
  onVacation: (trackId: string, until: string) => void;
}) {
  const [showMissedModal, setShowMissedModal] = useState(false);
  const [vacationTrack, setVacationTrack] = useState<UserTrack | null>(null);
  const [noteOpen, setNoteOpen] = useState<Record<string, boolean>>({});
  const [noteText, setNoteText] = useState<Record<string, string>>({});
  const [noteError, setNoteError] = useState<Record<string, string>>({});
  const [noteSubmitted, setNoteSubmitted] = useState<Record<string, boolean>>({});

  // Load today's saved quick-notes from localStorage on mount / when tracks change
  useEffect(() => {
    const today = todayStr();
    const loadedText: Record<string, string> = {};
    const autoOpen: Record<string, boolean> = {};
    const autoSubmitted: Record<string, boolean> = {};
    tracks.forEach(ut => {
      const saved = lsLoad<string>(`forge-quick-note-${ut.id}-${today}`, "");
      loadedText[ut.id] = saved;
      if (saved) { autoSubmitted[ut.id] = true; }
      // Never auto-open the textarea on home load
    });
    setNoteText(loadedText);
    setNoteOpen(prev => ({ ...prev, ...autoOpen }));
    setNoteSubmitted(autoSubmitted);
  }, [tracks.length]);

  const saveNote = (trackId: string, text: string) => {
    const today = todayStr();
    lsSave(`forge-quick-note-${trackId}-${today}`, text);
    setNoteText(prev => ({ ...prev, [trackId]: text }));
  };

  const toggleNote = (trackId: string) => {
    setNoteOpen(prev => ({ ...prev, [trackId]: !prev[trackId] }));
  };

  const motivation = useMemo(() => {
    const d = new Date();
    const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    return MOTIVATIONS[seed % MOTIVATIONS.length];
  }, []);

  const t = todayStr();
  const todayFormatted = new Date().toLocaleDateString('en-US', { weekday: "long", month: "long", day: "numeric" }).toUpperCase();
  const hour = new Date().getHours();
  const greeting = hour < 5 ? "Good evening" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const islandTheme = (localStorage.getItem('forge_island_theme') ?? 'garden') as 'garden' | 'mountain';
              const isPaused = user?.subscriptionStatus === 'paused';
  const firstName = user.name.split(" ")[0];

  return (
    <div className="relative">
    <div className="relative max-w-5xl mx-auto px-5 pt-8 pb-32">
      <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-7">
        <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground font-mono">{todayFormatted}</p>
        <h1 className="mt-2 font-display text-[2.5rem] leading-[1] tracking-[-0.03em]">
          {greeting},<br />
          <span className="text-electric">{firstName}.</span>
        </h1>
        <p className="mt-3 text-base text-foreground max-w-md leading-snug">{motivation}</p>
      </motion.header>

      {tracks.length > 0 && (
        <>
        <ForestMomentum tracks={tracks} user={user} islandTheme={islandTheme} isPaused={isPaused} />
        <SavingsCard tracks={tracks} />
        </>
      )}

      <div className="flex items-end justify-between mb-4">
        <h2 className="font-display text-2xl tracking-tight">Your paths</h2>
        {tracks.length > 0 && (
          <button onClick={() => onNavigate("tracks")}
            className="btn-chunk inline-flex items-center gap-1.5 rounded-full bg-[color:var(--primary)] text-primary-foreground px-3.5 py-2 text-xs font-semibold"
            style={{ boxShadow: "var(--shadow-violet)" }}>
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        )}
      </div>

      {tracks.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="mb-10 rounded-[20px] border-2 border-dashed border-[color:var(--primary)]/25 p-8 text-center">
          <div className="mx-auto mb-4 h-14 w-14 rounded-2xl grad-electric flex items-center justify-center opacity-80">
            <Target className="h-7 w-7 text-white" />
          </div>
          <h3 className="font-display text-lg mb-1">No paths yet</h3>
          <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto">
            Pick your first track and your AI coach will build a personalized journey for you.
          </p>
          <button onClick={() => onNavigate("tracks")}
            className="btn-chunk inline-flex items-center gap-2 rounded-full bg-foreground text-neutral-900 px-6 py-2.5 text-sm font-semibold"
            style={{ boxShadow: "var(--shadow-violet)" }}>
            <Layers className="h-4 w-4" /> Browse 50 tracks
          </button>
        </motion.div>
      ) : (
      <div className="-mx-5 px-5 overflow-x-auto no-scrollbar mb-10">
        <div className="flex gap-4 pb-2 snap-x snap-mandatory">
          {tracks.map((ut, i) => {
            const hueVar = trackHueVar(ut.category);
            const grad = trackHueGradient(ut.slug);
            const target = Math.max(1, ut.target_days ?? 30);
            const pct = Math.min(100, Math.round(((ut.current_streak ?? 0) / target) * 100));
            const doneToday = ut.last_log_date === t;
            return (
              <motion.div key={ut.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + i * 0.05, type: "spring", stiffness: 90, damping: 16 }}>
                {(() => {
                  const onVacCard = ut.vacation_until && ut.vacation_until >= t;
                  return (
                    <div className="snap-start w-[260px] h-[340px] rounded-[20px] p-5 relative overflow-hidden btn-chunk cursor-pointer"
                      onClick={() => onView(ut)}
                      style={{ background: grad.replace(/oklch\((\S+ \S+ \S+)\)/g, 'oklch($1 / 0.75)'), backdropFilter: "blur(20px) saturate(160%)", WebkitBackdropFilter: "blur(20px) saturate(160%)", border: "1px solid oklch(1 0 0 / 0.15)", boxShadow: "0 20px 44px -12px oklch(0 0 0 / 0.55), 0 4px 12px -4px oklch(0 0 0 / 0.3)" }}>
                      {/* Normal card content — blurred when frozen */}
                      <div className={onVacCard ? "blur-[2px] pointer-events-none" : ""}>
                        <div aria-hidden className="absolute -right-12 -bottom-12 h-56 w-56 rounded-full opacity-50 blur-2xl"
                          style={{ background: "radial-gradient(circle, oklch(1 0 0 / 0.5), transparent 60%)" }} />
                        <div aria-hidden className="absolute right-3 top-3 h-20 w-20 rounded-full opacity-70"
                          style={{ background: "radial-gradient(circle, oklch(1 0 0 / 0.35), transparent 70%)" }} />
                        <div className="relative flex items-start justify-between pt-2">
                          <span className="text-[10px] uppercase tracking-[0.25em] text-white font-mono">{ut.category}</span>
                          <ArcRing value={pct} color="oklch(1 0 0 / 0.85)" size={56} />
                        </div>
                        <div className="relative mt-auto pt-12">
                          <p className="text-[10px] uppercase tracking-[0.3em] text-white font-mono">{(ut.total_done ?? 0) >= (ut.target_days ?? 30) ? "Done" : "Day"}</p>
                          <p className="font-display text-[5.5rem] leading-[0.85] tracking-[-0.05em] text-white"><SlotNumber value={liveStreak(ut) === 0 && (ut.total_done ?? 0) === 0 ? 1 : liveStreak(ut)} /></p>
                          {(ut.total_done ?? 0) >= (ut.target_days ?? 30) && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-400/20 border border-yellow-400/40 px-2 py-0.5 text-[9px] font-bold text-yellow-300 uppercase tracking-widest mt-1">
                              ✓ Completed
                            </span>
                          )}
                          {(() => { const gd = ghostDayFor(ut); const gap = gd - (ut.total_done || 0); return gap > 1 ? (
                            <p className="mt-0.5 text-[9px] font-mono text-white/35 tracking-[0.15em] uppercase">Ghost +{gap}d ahead</p>
                          ) : null; })()}
                          <h3 className="mt-3 font-display text-xl text-white leading-tight line-clamp-2">{ut.name}</h3>
                          {(() => {
                            const jDays = lsLoad<JourneyDay[]>(LS_DAYS(ut.slug), []);
                            const todayTask = jDays.find(d => d.completedAt === null) ?? jDays[jDays.length - 1];
                            const taskTitle = todayTask?.title;
                            const isGeneric = !taskTitle || taskTitle.startsWith("Day ");
                            return !isGeneric ? (
                              <p className="mt-1.5 text-[11px] text-white/70 leading-snug line-clamp-2 italic">
                                "{taskTitle}"
                              </p>
                            ) : null;
                          })()}
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            {liveStreak(ut) === 0 && !doneToday && (ut.total_done ?? 0) === 0 ? (
                              <button onClick={() => onView(ut)}
                                className="inline-flex items-center gap-1.5 rounded-full grad-electric px-3 py-1.5 text-[11px] font-bold text-white shadow-[var(--shadow-violet)] hover:opacity-90 transition-opacity">
                                Start Day 1 <ArrowRight className="h-3 w-3" />
                              </button>
                            ) : liveStreak(ut) === 0 && !doneToday && (ut.total_done ?? 0) > 0 ? (
                              <p className="text-[10px] font-mono text-white/45 leading-snug">
                                No problem —<br />start again whenever you're ready.
                              </p>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 rounded-full bg-black px-2.5 py-1 text-[11px] text-white">
                                <Flame className="h-3 w-3 flame text-[color:var(--highlight)]" />
                                <span className="font-mono">{liveStreak(ut)}</span>
                                <span>streak</span>
                              </div>
                            )}
                            {doneToday && (
                              <div className="inline-flex items-center gap-1 rounded-full bg-[color:var(--tertiary)] px-2.5 py-1 text-[11px] text-white font-semibold">
                                <Check className="h-3 w-3" /> Done
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Frozen overlay */}
                      {onVacCard && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-[20px]"
                          style={{ background: "oklch(0.13 0.08 220 / 0.82)" }}>
                          <SnowfallBackground count={22} speed={0.75} />
                          <div className="relative z-10 text-center pointer-events-none">
                            <p className="font-display text-4xl font-bold text-white tracking-tight"
                              style={{ textShadow: "0 0 28px rgba(160,215,255,0.7)" }}>
                              Freezed
                            </p>
                            <p className="text-white/50 text-[10px] font-mono mt-1.5 tracking-widest uppercase">
                              until {ut.vacation_until}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </motion.div>
            );
          })}
          <button onClick={() => onNavigate("tracks")}
            className="snap-start flex flex-col items-center justify-center w-[200px] h-[340px] rounded-[20px] border-2 border-dashed border-[color:var(--primary)]/40 text-muted-foreground hover:border-[color:var(--primary)] hover:text-foreground transition btn-chunk">
            <Plus className="h-8 w-8 mb-2" />
            <span className="text-sm font-medium">New path</span>
          </button>
        </div>
      </div>
      )}

      <h2 className="font-display text-2xl tracking-tight mb-4">Today's actions</h2>
      <div className="space-y-2.5">
        {tracks.map(ut => {
          const hueVar = trackHueVar(ut.category);
          const doneToday = ut.last_log_date === t;
          return (
            <div key={ut.id} className="rounded-2xl depth-card overflow-hidden relative">
              {/* Frozen overlay on row */}
              {ut.vacation_until && ut.vacation_until >= t && (
                <div className="absolute inset-0 z-10 flex items-center justify-between px-4 rounded-2xl overflow-hidden"
                  style={{ background: "oklch(0.13 0.08 220 / 0.88)" }}>
                  <SnowfallBackground count={12} speed={0.7} />
                  <div className="relative z-10 flex items-center gap-2">
                    <div className="h-12 w-12 rounded-2xl flex items-center justify-center text-white/30 font-display text-base shrink-0 blur-[1px]"
                      style={{ background: trackHueGradient(ut.slug) }}>
                      {ut.name.slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.25em] font-mono" style={{ color: "#b8e0ff" }}>Freezed</p>
                      <p className="font-semibold text-[15px] text-white/80 truncate">{ut.name}</p>
                    </div>
                  </div>
                  <button onClick={() => setVacationTrack(ut)}
                    className="relative z-10 shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition"
                    style={{ borderColor: "oklch(0.55 0.1 220 / 0.5)", color: "#b8e0ff", background: "oklch(0.2 0.08 220 / 0.6)" }}>
                    ❄ until {ut.vacation_until}
                  </button>
                </div>
              )}
              <div className="flex items-center gap-4 p-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="h-12 w-12 rounded-2xl flex items-center justify-center text-white font-display text-base shrink-0"
                    style={{ background: trackHueGradient(ut.slug), boxShadow: "0 6px 16px -4px oklch(0 0 0 / 0.5)" }}>
                    {ut.name.slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.25em] font-mono" style={{ color: `var(${hueVar})` }}>{ut.category}</p>
                    <p className="font-semibold text-[15px] truncate">{ut.name}</p>
                  </div>
                </div>
                {(() => {
                  const onVac = ut.vacation_until && ut.vacation_until >= t;
                  if (doneToday) return (
                    <div className="shrink-0 flex items-center gap-2">
                      <button onClick={() => setVacationTrack(ut)}
                        className="rounded-full border border-border px-2.5 py-2 text-xs text-muted-foreground hover:text-foreground transition btn-chunk"
                        title="Pause streak">
                        <Sun className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => toggleNote(ut.id)}
                        className={`rounded-full border px-2 py-2 text-xs transition btn-chunk ${noteOpen[ut.id] ? "border-foreground/30 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
                        title="Quick note">
                        <PenLine className="h-3.5 w-3.5" />
                      </button>
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--tertiary)]/15 text-[color:var(--tertiary)] px-3.5 py-2 text-xs font-semibold">
                        <Check className="h-3.5 w-3.5" /> Done
                      </div>
                    </div>
                  );
                  if (onVac) return (
                    <button onClick={() => setVacationTrack(ut)}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition"
                      style={{ background: "oklch(0.18 0.07 220 / 0.9)", borderColor: "oklch(0.55 0.1 220 / 0.4)", color: "#b8e0ff" }}>
                      ❄ Freezed
                    </button>
                  );
                  return (
                    <div className="shrink-0 flex items-center gap-2">
                      <button onClick={() => setVacationTrack(ut)}
                        className="rounded-full border border-border px-2.5 py-2 text-xs text-muted-foreground hover:text-foreground transition btn-chunk"
                        title="Pause streak">
                        <Sun className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => toggleNote(ut.id)}
                        className={`rounded-full border px-2 py-2 text-xs transition btn-chunk ${noteOpen[ut.id] ? "border-foreground/30 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
                        title="Quick note">
                        <PenLine className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => onViewForCheckIn(ut)}
                        className="btn-chunk rounded-full bg-foreground text-neutral-900 px-3.5 py-2 text-xs font-semibold transition"
                        aria-label={`Check in for ${ut.name}`}>
                        Check in
                      </button>
                    </div>
                  );
                })()}
              </div>
              {/* Quick check-in — inline, animated */}
              <AnimatePresence>
                {noteOpen[ut.id] && (
                  <motion.div
                    key="note"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden">
                    <div className="border-t border-border/40 px-4 pb-4 pt-3 space-y-2.5">
                      {/* Title */}
                      <p className="text-[10px] uppercase tracking-[0.25em] font-mono text-muted-foreground">
                        Check-in rapido
                      </p>
                      {/* Today's task as context */}
                      {(() => {
                        const jDays = lsLoad<JourneyDay[]>(LS_DAYS(ut.slug), []);
                        const activeDay = jDays.find(d => d.completedAt === null) ?? null;
                        return activeDay ? (
                          <p className="text-[11px] text-muted-foreground/70 leading-snug border-l-2 border-border pl-2.5 line-clamp-4">
                            {activeDay.task}
                          </p>
                        ) : null;
                      })()}
                      {/* Read-only note (after submit) */}
                      {noteSubmitted[ut.id] ? (
                        <div className="space-y-2">
                          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                            {noteText[ut.id]}
                          </p>
                          <button
                            onClick={() => setNoteSubmitted(prev => ({ ...prev, [ut.id]: false }))}
                            className="text-[11px] font-mono text-muted-foreground hover:text-foreground transition underline underline-offset-2">
                            Modifica
                          </button>
                        </div>
                      ) : (
                        <>
                          {/* Textarea */}
                          <motion.div
                            animate={noteError[ut.id] ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
                            transition={{ duration: 0.3 }}>
                            <textarea
                              value={noteText[ut.id] ?? ""}
                              onChange={e => {
                                setNoteText(prev => ({ ...prev, [ut.id]: e.target.value }));
                                if (noteError[ut.id]) setNoteError(prev => ({ ...prev, [ut.id]: "" }));
                              }}
                              placeholder="How did today go…"
                              className={`w-full bg-muted/40 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 resize-none outline-none leading-relaxed border transition ${noteError[ut.id] ? "border-[color:var(--secondary)]" : "border-border/50 focus:border-foreground/30"}`}
                              rows={3}
                              autoFocus
                            />
                          </motion.div>
                          {/* Error */}
                          <AnimatePresence>
                            {noteError[ut.id] && (
                              <motion.p
                                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                className="text-[11px] text-[color:var(--secondary)] font-mono">
                                {noteError[ut.id]}
                              </motion.p>
                            )}
                          </AnimatePresence>
                          {/* Actions */}
                          <div className="flex items-center justify-between pt-0.5">
                            <button
                              onClick={() => { toggleNote(ut.id); setNoteError(prev => ({ ...prev, [ut.id]: "" })); }}
                              className="text-xs text-muted-foreground hover:text-foreground transition font-mono">
                              Cancel
                            </button>
                            <button
                              onClick={() => {
                                const text = (noteText[ut.id] ?? "").trim();
                                const err = validateQuickNote(text);
                                if (err) { setNoteError(prev => ({ ...prev, [ut.id]: err })); return; }
                                // Complete the active journey day → advances to next day
                                const jDays = lsLoad<JourneyDay[]>(LS_DAYS(ut.slug), []);
                                const activeDayIdx = jDays.findIndex(d => d.completedAt === null);
                                if (activeDayIdx !== -1) {
                                  const updatedDays = jDays.map((d, i) =>
                                    i === activeDayIdx
                                      ? { ...d, completedAt: new Date().toISOString(), userNote: text }
                                      : d
                                  );
                                  lsSave(LS_DAYS(ut.slug), updatedDays);
                                }
                                saveNote(ut.id, text);
                                if (!doneToday) onCheckIn(ut.id);
                                setNoteSubmitted(prev => ({ ...prev, [ut.id]: true }));
                                setNoteError(prev => ({ ...prev, [ut.id]: "" }));
                              }}
                              className="btn-chunk rounded-full bg-foreground text-neutral-900 px-4 py-1.5 text-xs font-semibold transition hover:opacity-80">
                              Invia
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Missed access nudge — only when at least one track is behind */}
      {tracks.length > 0 && tracks.some(tr => liveStreak(tr) === 0 && tr.last_log_date !== t) && (
        <div className="mt-8 text-center">
          <button
            onClick={() => setShowMissedModal(true)}
            className="text-[11px] text-muted-foreground hover:text-foreground transition underline underline-offset-2 font-mono"
          >
            Missed a day and lost your streak? Click here
          </button>
        </div>
      )}

      <AnimatePresence>
        {showMissedModal && (
          <MissedAccessModal tracks={tracks} onClose={() => setShowMissedModal(false)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {vacationTrack && (
          <VacationModal
            track={vacationTrack}
            onSave={(until) => { onVacation(vacationTrack.id, until); }}
            onClose={() => setVacationTrack(null)}
          />
        )}
      </AnimatePresence>
    </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DayPanel
// ─────────────────────────────────────────────────────────────────────────────

function DayPanel({ label, children, accentColor }: { label: string; children: ReactNode; accentColor?: string }) {
  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border" style={accentColor ? { borderLeft: `3px solid ${accentColor}` } : {}}>
        <p className="text-[10px] uppercase tracking-[0.25em] font-mono text-muted-foreground">{label}</p>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CommunityBoard
// ─────────────────────────────────────────────────────────────────────────────

const SEED_POSTS: Omit<CommunityPost, "id" | "trackSlug">[] = [
  { content: "Finished day 7. Never thought I'd make it this far — the habit is starting to feel natural.", dayNumber: 7, flameCount: 14, userHasFlamed: false, createdAt: new Date(Date.now() - 2 * 86400000).toISOString() },
  { content: "Hit my first milestone today 🎉 The science note about neuroplasticity blew my mind.", dayNumber: 21, flameCount: 8, userHasFlamed: false, createdAt: new Date(Date.now() - 86400000).toISOString() },
  { content: "Day 3 was brutal but I checked in anyway. Small win counts.", dayNumber: 3, flameCount: 22, userHasFlamed: false, createdAt: new Date(Date.now() - 3600000).toISOString() },
];

function CommunityBoard({ slug, userId }: { slug: string; userId?: string | null }) {
  const [posts, setPosts] = useState<CommunityPost[]>(() => {
    const saved = lsLoad<CommunityPost[]>(LS_COMMUNITY(slug), []);
    if (saved.length > 0) return saved;
    const seeded = SEED_POSTS.map(p => ({ ...p, id: nanoid(), trackSlug: slug }));
    lsSave(LS_COMMUNITY(slug), seeded);
    return seeded;
  });
  const [communityLoaded, setCommunityLoaded] = useState(false);
  const [flamedIds] = useState<Set<string>>(() => {
    const arr = lsLoad<string[]>(`forge-flamed-${slug}`, []);
    return new Set(arr);
  });
  // Load real posts from Supabase on mount
  useEffect(() => {
    if (communityLoaded) return;
    setCommunityLoaded(true);
    db.loadCommunityPosts(slug).then(dbPosts => {
      if (dbPosts.length === 0) return;
      const mapped: CommunityPost[] = dbPosts.map(p => ({
        id: p.id, trackSlug: p.track_slug, content: p.content,
        dayNumber: p.day_number, flameCount: p.flame_count,
        userHasFlamed: flamedIds.has(p.id), createdAt: p.created_at,
      }));
      setPosts(mapped);
      lsSave(LS_COMMUNITY(slug), mapped);
    }).catch(() => {});
  }, [slug]);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [modWarnKey, setModWarnKey] = useState(0);
  const [modWarnMsg, setModWarnMsg] = useState("");

  const flame = (id: string) => {
    setPosts(prev => {
      const next = prev.map(p => {
        if (p.id !== id) return p;
        const newFlamed = !p.userHasFlamed;
        const newCount = newFlamed ? p.flameCount + 1 : p.flameCount - 1;
        // Persist flamed IDs in localStorage
        const arr = lsLoad<string[]>(`forge-flamed-${slug}`, []);
        const updated = newFlamed ? [...arr.filter(x => x !== id), id] : arr.filter(x => x !== id);
        lsSave(`forge-flamed-${slug}`, updated);
        db.updateFlameCount(id, newCount).catch(() => {});
        return { ...p, flameCount: newCount, userHasFlamed: newFlamed };
      });
      lsSave(LS_COMMUNITY(slug), next);
      return next;
    });
  };

  const post = () => {
    if (!draft.trim()) return;
    if (isCommunityBlocked(draft)) {
      const msg = COMMUNITY_MODERATION_MESSAGES[hashStr(draft) % COMMUNITY_MODERATION_MESSAGES.length];
      setModWarnMsg(msg);
      setModWarnKey(k => k + 1);
      return;
    }
    setPosting(true);
    const p: CommunityPost = { id: nanoid(), trackSlug: slug, content: draft.trim(), dayNumber: 0, flameCount: 0, userHasFlamed: false, createdAt: new Date().toISOString() };
    if (userId) {
      db.saveCommunityPost(userId, { id: p.id, track_slug: slug, content: p.content, day_number: 0, flame_count: 0, created_at: p.createdAt }).catch(() => {});
    }
    setPosts(prev => {
      const next = [p, ...prev];
      lsSave(LS_COMMUNITY(slug), next);
      return next;
    });
    setDraft("");
    setModWarnKey(0);
    setPosting(false);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex gap-2">
          <input value={draft} onChange={e => { setDraft(e.target.value); if (modWarnKey > 0) setModWarnKey(0); }}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && post()}
            placeholder="Share a win or struggle…"
            className={`flex-1 rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring transition-colors ${modWarnKey > 0 ? "border-red-500" : "border-border"}`} />
          <button onClick={post} disabled={!draft.trim() || posting}
            className="btn-chunk rounded-xl bg-foreground text-neutral-900 px-4 py-2 text-sm font-semibold disabled:opacity-40">
            Post
          </button>
        </div>
        <AnimatePresence mode="wait">
          {modWarnKey > 0 && (
            <motion.p key={modWarnKey}
              initial={{ opacity: 0, x: 0 }}
              animate={{ opacity: 1, x: [-5, 5, -4, 4, -2, 2, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="text-xs text-red-500 font-medium px-1">
              {modWarnMsg}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {posts.map(p => (
          <div key={p.id} className="rounded-xl bg-muted/50 border border-border/50 p-3 flex gap-3">
            <div className="flex-1">
              <p className="text-sm">{p.content}</p>
              {p.dayNumber > 0 && <p className="mt-1 text-[10px] text-muted-foreground font-mono uppercase">Day {p.dayNumber}</p>}
            </div>
            <button onClick={() => flame(p.id)}
              className={`shrink-0 flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition ${p.userHasFlamed ? "text-orange-400" : "text-muted-foreground hover:text-orange-400"}`}>
              <Flame className="h-3.5 w-3.5" /> {p.flameCount}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// JourneyOnboarding
// ─────────────────────────────────────────────────────────────────────────────

const JOURNEY_PRESETS = [30, 60, 90, 120, 180, 365] as const;

function JourneyOnboarding({ track, onStarted, userId }: { track: UserTrack; onStarted: (j: Journey, days: JourneyDay[]) => void; userId?: string | null }) {
  const archetype = archetypeForSlug(track.slug);
  const [totalDays, setTotalDays] = useState(30);
  const [isCustomDays, setIsCustomDays] = useState(false);
  const [customDaysInput, setCustomDaysInput] = useState("");
  const [startingPoint, setStartingPoint] = useState("");
  const [motivation, setMotivation] = useState("");
  const [obstacle, setObstacle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    if (!startingPoint.trim() || !motivation.trim() || !obstacle.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    setError(null);
    setLoading(true);
    const journey: Journey = {
      id: nanoid(), trackSlug: track.slug, totalDays, startingPoint, motivation, obstacle,
      startedAt: new Date().toISOString(), generatedThrough: 0,
    };
    const makeFallback = (): JourneyDay[] => Array.from({ length: 7 }, (_, i) => ({
      id: nanoid(), journeyId: journey.id, dayNumber: i + 1,
      title: `Day ${i + 1} — ${track.name}`,
      description: `Your ${track.name} journey, day ${i + 1}. Consistency is the foundation of every transformation.`,
      task: `Spend at least 15 minutes on ${track.name} today. Record how it felt.`,
      reflection: "What did you notice about yourself today?",
      science: "Research shows repetition within 24 hours strengthens neural pathways by up to 40%.",
      checkinPrompt: "How are you feeling right now, on a scale from 1–10?",
      completedAt: null, userNote: null,
    }));
    try {
      let rawDays: JourneyDay[] | null = null;
      // Check cache first
      const cached1 = await db.loadJourneyTemplate(track.slug, 1, 7).catch(() => null);
      if (cached1) {
        rawDays = cached1 as JourneyDay[];
      } else {
        const res = await fetch("/api/generate-days", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: track.slug, trackName: track.name, category: track.category, startingPoint, motivation, obstacle, fromDay: 1, count: 7 }),
        });
        if (!res.ok) throw new Error("API error");
        const { days: freshDays } = await res.json() as { days: JourneyDay[] };
        rawDays = freshDays;
        db.saveJourneyTemplate(track.slug, 1, 7, freshDays).catch(() => {});
      }
      const days = rawDays!;
      const filled = days.map((d, i) => ({ ...d, id: nanoid(), journeyId: journey.id, dayNumber: i + 1, completedAt: null, userNote: null }));
      journey.generatedThrough = 7;
      lsSave(LS_JOURNEY(track.slug), journey);
      lsSave(LS_DAYS(track.slug), filled);
      if (userId) { db.saveJourney(userId, journey).catch(() => {}); db.saveJourneyDays(userId, track.slug, filled).catch(() => {}); }
      onStarted(journey, filled);
    } catch {
      const fallback = makeFallback();
      journey.generatedThrough = 7;
      lsSave(LS_JOURNEY(track.slug), journey);
      lsSave(LS_DAYS(track.slug), fallback);
      if (userId) { db.saveJourney(userId, journey).catch(() => {}); db.saveJourneyDays(userId, track.slug, fallback).catch(() => {}); }
      onStarted(journey, fallback);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-xl mx-auto px-5 py-12 space-y-8">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] font-mono text-muted-foreground">{track.category}</p>
          <h1 className="mt-2 font-display text-3xl tracking-tight">{track.name}</h1>
          <p className="mt-2 text-muted-foreground text-sm">Meet <strong>Your Coach</strong> — here for every day of this journey.</p>
        </div>
        <div className="space-y-5">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Journey length</label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {JOURNEY_PRESETS.map(d => (
                <button key={d} onClick={() => { setTotalDays(d); setIsCustomDays(false); }}
                  className={`btn-chunk rounded-xl py-2.5 text-sm font-semibold border transition ${!isCustomDays && totalDays === d ? "bg-foreground text-neutral-900 border-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>
                  {d === 365 ? "1 year" : `${d}d`}
                </button>
              ))}
            </div>
            <button onClick={() => { setIsCustomDays(true); setCustomDaysInput(String(totalDays)); }}
              className={`mt-2 w-full btn-chunk rounded-xl py-2.5 text-sm font-semibold border transition ${isCustomDays ? "bg-foreground text-neutral-900 border-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>
              Custom number of days
            </button>
            {isCustomDays && (
              <input
                type="number" value={customDaysInput} autoFocus
                onChange={e => {
                  setCustomDaysInput(e.target.value);
                  const n = parseInt(e.target.value);
                  if (n >= 7 && n <= 999) setTotalDays(n);
                }}
                min={7} max={999} placeholder="Enter days (7–999)"
                className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            )}
            {isCustomDays && totalDays >= 7 && (
              <p className="mt-1 text-xs text-muted-foreground text-right">{totalDays} days selected</p>
            )}
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Where are you starting from?</label>
            <textarea value={startingPoint} onChange={e => setStartingPoint(e.target.value)}
              placeholder={`e.g. "Complete beginner, never tried ${track.name} before"`}
              rows={2} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">What drives you?</label>
            <textarea value={motivation} onChange={e => setMotivation(e.target.value)}
              placeholder={`e.g. "I want to feel calmer and less reactive in daily life"`}
              rows={2} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Biggest obstacle</label>
            <textarea value={obstacle} onChange={e => setObstacle(e.target.value)}
              placeholder={`e.g. "I always quit after a few days when things get hard"`}
              rows={2} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button onClick={handleStart} disabled={loading}
            className="btn-chunk w-full rounded-2xl bg-foreground text-neutral-900 py-3.5 font-semibold text-base disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? (
              <><span className="h-4 w-4 rounded-full border-2 border-background/30 border-t-background animate-spin" />Generating your journey…</>
            ) : (
              <><Sparkles className="h-4 w-4" />Begin my journey</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// JourneyView
// ─────────────────────────────────────────────────────────────────────────────

function JourneyView({ track, journey: initJourney, days: initDays, onBack, showCheckInHint, onTrackCheckIn, onRestart, userId }: {
  track: UserTrack;
  journey: Journey;
  days: JourneyDay[];
  onBack: () => void;
  showCheckInHint?: boolean;
  onTrackCheckIn?: () => void;
  onRestart?: (trackId: string) => void;
  userId?: string | null;
}) {
  const [journey, setJourney] = useState(initJourney);
  const [days, setDays] = useState(initDays);
  const [activeTab, setActiveTab] = useState<"today" | "map" | "community" | "coach">("today");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => lsLoad<ChatMessage[]>(LS_CHAT(track.slug), []));
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [coachOpening, setCoachOpening] = useState(false);

  // Load coach messages from Supabase on first open
  const [coachLoaded, setCoachLoaded] = useState(false);
  useEffect(() => {
    if (!userId || coachLoaded) return;
    setCoachLoaded(true);
    db.loadCoachMessages(userId, track.slug).then(dbMsgs => {
      if (dbMsgs.length === 0) return;
      const mapped: ChatMessage[] = dbMsgs.map(m => ({
        id: m.id, role: m.role as 'user' | 'assistant',
        content: m.content, createdAt: m.created_at,
      }));
      setChatMessages(mapped);
      lsSave(LS_CHAT(track.slug), mapped);
    }).catch(() => {});
  }, [userId, track.slug]);

  // Auto-generate opening message on first coach tab visit
  useEffect(() => {
    if (activeTab !== "coach" || chatMessages.length > 0 || coachOpening) return;
    setCoachOpening(true);
    const opener = COACH_OPENERS[archetype.id]?.(completedCount + 1, track.name)
      ?? `I'm here. What's on your mind today about your ${track.name} journey?`;
    const openingMsg: ChatMessage = { id: nanoid(), role: "assistant", content: opener, createdAt: new Date().toISOString() };
    const withOpening = [openingMsg];
    setChatMessages(withOpening);
    lsSave(LS_CHAT(track.slug), withOpening);
    if (userId) db.saveCoachMessage(userId, { id: openingMsg.id, track_slug: track.slug, role: "assistant", content: openingMsg.content, created_at: openingMsg.createdAt }).catch(() => {});
  }, [activeTab, chatMessages.length, coachOpening]);
  const [milestoneDay, setMilestoneDay] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<JourneyDay | null>(null);
  const [checkInNote, setCheckInNote] = useState("");
  const [checkInTask, setCheckInTask] = useState("");
  const [checkInReflect, setCheckInReflect] = useState("");
  const [warnTaskKey, setWarnTaskKey] = useState(0);
  const [warnReflectKey, setWarnReflectKey] = useState(0);
  const warnTaskIdx = useRef(0);
  const warnReflectIdx = useRef(0);
  const [fillFirstBanner, setFillFirstBanner] = useState(showCheckInHint ?? false);

  const archetype = archetypeForSlug(track.slug);
  const completedCount = days.filter(d => d.completedAt !== null).length;
  const todayDay = days.find(d => d.completedAt === null) ?? days[days.length - 1];
  const accentColor = trackHue(track.category);

  useEffect(() => {
    if (!journey || days.length === 0) return;
    if (completedCount >= journey.generatedThrough - 2 && journey.generatedThrough < journey.totalDays) {
      const fromDay = journey.generatedThrough + 1;
      const count = Math.min(7, journey.totalDays - journey.generatedThrough);
      (async () => {
        let rawNext: JourneyDay[] | null = null;
        const cachedNext = await db.loadJourneyTemplate(track.slug, fromDay, count).catch(() => null);
        if (cachedNext) {
          rawNext = cachedNext as JourneyDay[];
        } else {
          const r = await fetch("/api/generate-days", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slug: track.slug, trackName: track.name, category: track.category, startingPoint: journey.startingPoint, motivation: journey.motivation, obstacle: journey.obstacle, fromDay, count }),
          }).catch(() => null);
          if (!r || !r.ok) return;
          const data = await r.json() as { days: JourneyDay[] };
          rawNext = data.days;
          db.saveJourneyTemplate(track.slug, fromDay, count, data.days).catch(() => {});
        }
        if (!rawNext) return;
        const data = { days: rawNext };
        const filled = data.days.map((d: JourneyDay, i: number) => ({ ...d, id: nanoid(), journeyId: journey.id, dayNumber: fromDay + i, completedAt: null, userNote: null }));
        setDays(prev => { const next = [...prev, ...filled]; lsSave(LS_DAYS(track.slug), next); if (userId) db.saveJourneyDays(userId, track.slug, next).catch(() => {}); return next; });
        const nextJourney = { ...journey, generatedThrough: fromDay + count - 1 };
        setJourney(nextJourney);
        lsSave(LS_JOURNEY(track.slug), nextJourney);
        if (userId) db.saveJourney(userId, nextJourney).catch(() => {});
      })();
    }
  }, [completedCount, journey, days.length, track]);

  const checkIn = (dayId: string, note: string) => {
    setDays(prev => {
      const next = prev.map(d => d.id === dayId ? { ...d, completedAt: new Date().toISOString(), userNote: note || null } : d);
      lsSave(LS_DAYS(track.slug), next);
      if (userId) db.saveJourneyDays(userId, track.slug, next).catch(() => {});
      return next;
    });
    const completedNow = completedCount + 1;
    if (JOURNEY_MILESTONES.includes(completedNow)) {
      setMilestoneDay(completedNow);
      confetti({ particleCount: 100, spread: 80, origin: { y: 0.4 }, colors: ["#FFD000", "#FFB347", "#FFE680"] });
    }
  };

  const handleCheckIn = () => {
    let valid = true;
    if (!checkInTask.trim()) {
      warnTaskIdx.current = (warnTaskIdx.current + 1) % CHECKIN_WARNINGS.length;
      setWarnTaskKey(k => k + 1);
      valid = false;
    }
    if (!checkInReflect.trim()) {
      warnReflectIdx.current = (warnReflectIdx.current + 1) % CHECKIN_WARNINGS.length;
      setWarnReflectKey(k => k + 1);
      valid = false;
    }
    if (!valid || !todayDay) return;
    checkIn(todayDay.id, `Task: ${checkInTask.trim()}\n\nReflection: ${checkInReflect.trim()}`);
    onTrackCheckIn?.();
    setCheckInTask("");
    setCheckInReflect("");
    setCheckInNote("");
  };

  const sendChat = async () => {
    if (!chatInput.trim()) return;
    const userMsg: ChatMessage = { id: nanoid(), role: "user", content: chatInput.trim(), createdAt: new Date().toISOString() };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    lsSave(LS_CHAT(track.slug), newMessages);
    if (userId) db.saveCoachMessage(userId, { id: userMsg.id, track_slug: track.slug, role: "user", content: userMsg.content, created_at: userMsg.createdAt }).catch(() => {});
    setChatInput("");
    setChatLoading(true);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: track.slug, archetype: archetype.id,
          messages: newMessages.slice(-10).map(m => ({ role: m.role, content: m.content })),
          userContext: { startingPoint: journey.startingPoint, motivation: journey.motivation, daysCompleted: completedCount, totalDays: journey.totalDays },
        }),
      });
      const { message } = await res.json() as { message: string };
      const assistantMsg: ChatMessage = { id: nanoid(), role: "assistant", content: message, createdAt: new Date().toISOString() };
      if (userId) db.saveCoachMessage(userId, { id: assistantMsg.id, track_slug: track.slug, role: "assistant", content: assistantMsg.content, created_at: assistantMsg.createdAt }).catch(() => {});
      const withReply = [...newMessages, assistantMsg];
      setChatMessages(withReply);
      lsSave(LS_CHAT(track.slug), withReply);
    } catch {
      const fallback: ChatMessage = { id: nanoid(), role: "assistant", content: `I'm here with you on day ${completedCount + 1}. Keep going — each session builds the foundation of who you're becoming.`, createdAt: new Date().toISOString() };
      const withFallback = [...newMessages, fallback];
      setChatMessages(withFallback);
      lsSave(LS_CHAT(track.slug), withFallback);
    } finally {
      setChatLoading(false);
    }
  };

  const tabs: { key: typeof activeTab; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "map", label: "Journey" },
    { key: "community", label: "Community" },
    { key: "coach", label: "Your Coach" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-muted transition">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.25em] font-mono text-muted-foreground">{track.category}</p>
            <h1 className="font-semibold text-sm truncate">{track.name}</h1>
          </div>
          <div className="text-right flex items-center gap-2">
            <div>
              <p className="text-[10px] font-mono text-muted-foreground">{completedCount}/{journey.totalDays} days</p>
              <div className="mt-0.5 h-1 w-20 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${(completedCount / journey.totalDays) * 100}%` }} />
              </div>
            </div>
            {onRestart && (
              <button
                onClick={() => { if (confirm("Restart this journey? Your streak and progress will be reset.")) { onRestart(track.id); onBack(); } }}
                className="text-[10px] text-muted-foreground hover:text-foreground border border-border rounded-lg px-2 py-1 transition"
                title="Restart journey">
                ↺
              </button>
            )}
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 flex border-t border-border/50">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 text-xs font-semibold transition border-b-2 ${activeTab === tab.key ? "text-foreground border-foreground" : "text-muted-foreground border-transparent"}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-4">
        {activeTab === "today" && todayDay && (
          <motion.div key="today" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <AnimatePresence>
              {fillFirstBanner && todayDay.completedAt === null && (
                <motion.div key="fill-first"
                  initial={{ opacity: 0, y: -10, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 200, damping: 22 }}
                  className="rounded-2xl border-2 border-[color:var(--secondary)]/40 bg-[color:var(--secondary)]/8 p-4 flex items-start gap-3">
                  <svg className="h-5 w-5 mt-0.5 shrink-0 text-[color:var(--secondary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-semibold text-sm text-[color:var(--secondary)]">Fill this in first!</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Write down what you did and your reflection — then you're ready to check in.</p>
                  </div>
                  <button onClick={() => setFillFirstBanner(false)}
                    className="text-muted-foreground hover:text-foreground text-lg leading-none shrink-0 mt-0.5">✕</button>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="rounded-2xl bg-card border border-border p-5" style={{ borderLeft: `3px solid ${accentColor}` }}>
              <p className="text-[10px] uppercase tracking-[0.25em] font-mono text-muted-foreground">Day {todayDay.dayNumber}</p>
              <h2 className="mt-1.5 font-display text-xl font-semibold">{todayDay.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{todayDay.description}</p>
            </div>
            {/* Today's task — mission-style card (blue) */}
            <div className="rounded-2xl overflow-hidden border border-border bg-card relative">
              <div className="px-5 py-3 border-b border-border/60 flex items-center gap-2"
                style={{ borderLeft: "3px solid oklch(0.65 0.22 240)" }}>
                <Zap className="h-3.5 w-3.5" style={{ color: "oklch(0.65 0.22 240)" }} fill="currentColor" />
                <p className="text-[10px] uppercase tracking-[0.25em] font-mono font-bold" style={{ color: "oklch(0.65 0.22 240)" }}>Your Mission Today</p>
              </div>
              <div className="px-5 py-4">
                <p className="text-base leading-relaxed font-medium whitespace-pre-line">{todayDay.task}</p>
              </div>
            </div>

            {/* Reflection (yellow) */}
            <DayPanel label="Reflection prompt" accentColor="oklch(0.875 0.185 95)"><p className="text-sm text-muted-foreground italic">{todayDay.reflection}</p></DayPanel>
            {/* Science (green) */}
            <DayPanel label="The science" accentColor="oklch(0.65 0.22 145)"><p className="text-sm text-muted-foreground">{todayDay.science}</p></DayPanel>
            {todayDay.completedAt === null ? (
              <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] font-mono text-muted-foreground">Check-in</p>
                  <p className="text-sm text-muted-foreground mt-1">{todayDay.checkinPrompt}</p>
                </div>

                {/* Task field */}
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-foreground">Did you do the task? How did it go?</p>
                  <textarea value={checkInTask} onChange={e => { setCheckInTask(e.target.value); if (e.target.value) setFillFirstBanner(false); }}
                    placeholder="Describe what you actually did today…" rows={2}
                    className={`w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none transition-colors ${warnTaskKey > 0 && !checkInTask.trim() ? "border-red-500" : "border-border"}`} />
                  <AnimatePresence mode="wait">
                    {warnTaskKey > 0 && !checkInTask.trim() && (
                      <motion.p key={warnTaskKey}
                        initial={{ opacity: 0, x: 0 }}
                        animate={{ opacity: 1, x: [-5, 5, -4, 4, -2, 2, 0] }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4 }}
                        className="text-xs text-red-500 font-medium">
                        {CHECKIN_WARNINGS[warnTaskIdx.current % CHECKIN_WARNINGS.length]}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* Reflection field */}
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-foreground">Your reflection</p>
                  <textarea value={checkInReflect} onChange={e => { setCheckInReflect(e.target.value); if (e.target.value) setFillFirstBanner(false); }}
                    placeholder="What did you notice about yourself today?" rows={2}
                    className={`w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none transition-colors ${warnReflectKey > 0 && !checkInReflect.trim() ? "border-red-500" : "border-border"}`} />
                  <AnimatePresence mode="wait">
                    {warnReflectKey > 0 && !checkInReflect.trim() && (
                      <motion.p key={warnReflectKey}
                        initial={{ opacity: 0, x: 0 }}
                        animate={{ opacity: 1, x: [-5, 5, -4, 4, -2, 2, 0] }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4 }}
                        className="text-xs text-red-500 font-medium">
                        {CHECKIN_WARNINGS[warnReflectIdx.current % CHECKIN_WARNINGS.length]}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                <button onClick={handleCheckIn}
                  className="btn-chunk w-full rounded-xl bg-foreground text-neutral-900 py-2.5 font-semibold text-sm flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Mark day {todayDay.dayNumber} complete
                </button>
              </div>
            ) : (
              <div className="rounded-2xl bg-[color:var(--tertiary)]/10 border border-[color:var(--tertiary)]/20 p-4 flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-[color:var(--tertiary)] shrink-0" />
                <div>
                  <p className="font-semibold text-sm">Day {todayDay.dayNumber} complete!</p>
                  {todayDay.userNote && <p className="text-xs text-muted-foreground mt-0.5">{todayDay.userNote}</p>}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "map" && (
          <motion.div key="map" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.25em] font-mono text-muted-foreground mb-4">Journey Map — {journey.totalDays} days</p>
            {days.map(d => {
              const isCompleted = d.completedAt !== null;
              const isCurrent = d.id === todayDay?.id;
              // Only completed days and today are accessible; everything else is locked
              const locked = !isCompleted && !isCurrent;
              return (
                <button key={d.id}
                  onClick={locked ? undefined : () => setSelectedDay(d)}
                  className={`w-full text-left rounded-xl p-4 border transition flex items-center gap-3 ${
                    isCurrent ? "border-foreground bg-card"
                    : isCompleted ? "border-[color:var(--tertiary)]/30 bg-[color:var(--tertiary)]/5"
                    : "border-border bg-card/30 opacity-35 cursor-not-allowed"
                  }`}>
                  <div className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    isCompleted ? "bg-[color:var(--tertiary)]/20 text-[color:var(--tertiary)]"
                    : isCurrent ? "bg-foreground text-neutral-900"
                    : "bg-muted text-muted-foreground"
                  }`}>
                    {isCompleted ? <Check className="h-3.5 w-3.5" />
                     : locked ? <Lock className="h-3 w-3" />
                     : d.dayNumber}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{locked ? `Day ${d.dayNumber}` : d.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {locked ? "Complete today's check-in to unlock" : `${d.description.slice(0, 60)}…`}
                    </p>
                  </div>
                  {JOURNEY_MILESTONES.includes(d.dayNumber) && !locked && <Trophy className="shrink-0 h-3.5 w-3.5 text-yellow-400" />}
                </button>
              );
            })}
            {journey.generatedThrough < journey.totalDays && (
              <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                Days {journey.generatedThrough + 1}–{journey.totalDays} will be generated as you progress.
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "community" && (
          <motion.div key="community" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-[10px] uppercase tracking-[0.25em] font-mono text-muted-foreground mb-4">{track.name} Community</p>
            <CommunityBoard slug={track.slug} userId={userId} />
          </motion.div>
        )}

        {activeTab === "coach" && (
          <motion.div key="coach" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full grad-electric flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="font-semibold text-sm">Your Coach</p>
                <p className="text-xs text-muted-foreground">Here for every day of this journey</p>
              </div>
            </div>
            <div className="space-y-3 max-h-[420px] overflow-y-auto pb-1">
              {chatMessages.length === 0 && (
                <div className="rounded-xl bg-muted/50 p-4 flex gap-2">
                  <div className="h-2 w-2 rounded-full bg-muted-foreground mt-1.5 animate-pulse shrink-0" />
                  <p className="text-sm text-muted-foreground italic">Your coach is warming up…</p>
                </div>
              )}
              {chatMessages.map(m => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.role === "user" ? "bg-foreground text-neutral-900" : "bg-muted"}`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl px-4 py-3 flex gap-1.5 items-center">
                    {[0, 1, 2].map(i => <span key={i} className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                  </div>
                </div>
              )}
            </div>

            {/* Suggested prompts — shown only when few messages */}
            {chatMessages.length <= 2 && (
              <div className="flex gap-2 flex-wrap">
                {(COACH_SUGGESTED_PROMPTS[archetype.id] ?? COACH_SUGGESTED_PROMPTS.teacher).map(prompt => (
                  <button key={prompt}
                    onClick={() => { setChatInput(prompt); }}
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors text-left">
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            <div className="sticky bottom-0 bg-background pt-1">
              <div className="flex gap-2">
                <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                  placeholder="Reply to your coach…"
                  className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
                <button onClick={sendChat} disabled={!chatInput.trim() || chatLoading}
                  className="btn-chunk rounded-xl bg-foreground text-neutral-900 px-4 py-2 text-sm font-semibold disabled:opacity-40">
                  Send
                </button>
              </div>
              <p className="mt-2 text-[10px] text-emerald-500/70 font-mono text-center">This stays between you and your coach. Always.</p>
            </div>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {selectedDay && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
            onClick={() => setSelectedDay(null)}>
            <motion.div initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }}
              className="w-full max-w-lg bg-background rounded-3xl p-6 space-y-4 max-h-[80vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.25em] font-mono text-muted-foreground">Day {selectedDay.dayNumber}</p>
                <button onClick={() => setSelectedDay(null)} className="text-muted-foreground hover:text-foreground text-lg">✕</button>
              </div>
              <h2 className="font-display text-xl font-semibold">{selectedDay.title}</h2>
              <p className="text-sm text-muted-foreground">{selectedDay.description}</p>
              <div className="rounded-xl bg-muted p-3">
                <p className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-1">Task</p>
                <p className="text-sm">{selectedDay.task}</p>
              </div>
              {selectedDay.completedAt && selectedDay.userNote && (
                <div className="rounded-xl bg-[color:var(--tertiary)]/10 p-3">
                  <p className="text-[10px] uppercase tracking-wider font-mono text-[color:var(--tertiary)] mb-1">Your note</p>
                  <p className="text-sm">{selectedDay.userNote}</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {milestoneDay !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
            onClick={() => setMilestoneDay(null)}>
            <motion.div initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.85 }}
              className="bg-background rounded-3xl p-8 max-w-sm w-full text-center space-y-4"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-center h-16 w-16 rounded-full bg-yellow-400/15 mx-auto">
                <Trophy className="h-8 w-8 text-yellow-400" />
              </div>
              <h2 className="font-display text-2xl font-bold">Day {milestoneDay}!</h2>
              <p className="text-muted-foreground text-sm">You've hit a major milestone on your {track.name} journey. This is the moment most people quit — and you didn't.</p>
              <button onClick={() => setMilestoneDay(null)}
                className="btn-chunk w-full rounded-xl bg-foreground text-neutral-900 py-3 font-semibold">
                Keep going
              </button>
              <button onClick={() => {
                const text = `Day ${milestoneDay} on ${track.name} with Forge. The streak continues. 🔥`;
                if (navigator.share) navigator.share({ text });
                else navigator.clipboard?.writeText(text);
              }} className="btn-chunk w-full rounded-xl border border-border py-2.5 text-sm text-muted-foreground hover:text-foreground transition">
                Share this moment
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TrackDetailPage
// ─────────────────────────────────────────────────────────────────────────────

function TrackDetailPage({ track, onBack, showCheckInHint, onTrackCheckIn, onVacation, onRestart, userId }: {
  track: UserTrack;
  onBack: () => void;
  showCheckInHint?: boolean;
  onTrackCheckIn?: () => void;
  onVacation?: (trackId: string, until: string) => void;
  onRestart?: (trackId: string) => void;
  userId?: string | null;
}) {
  const [journey, setJourney] = useState<Journey | null>(() => lsLoad<Journey | null>(LS_JOURNEY(track.slug), null));
  const [days, setDays] = useState<JourneyDay[]>(() => lsLoad<JourneyDay[]>(LS_DAYS(track.slug), []));

  // Load journey days from Supabase if localStorage is empty (cross-device / cleared cache)
  useEffect(() => {
    if (!userId || days.length > 0) return;
    db.loadJourneyDays(userId, track.slug).then(dbDays => {
      if (dbDays.length === 0) return;
      const mapped = dbDays.map(d => ({
        id: d.id, journeyId: d.journey_id ?? "", dayNumber: d.day_number,
        title: d.title ?? "", description: d.description ?? "",
        task: d.task ?? "", reflection: d.reflection ?? "",
        science: d.science ?? "", checkinPrompt: d.checkin_prompt ?? "",
        completedAt: d.completed_at ?? null, userNote: d.user_note ?? null,
      })) as JourneyDay[];
      lsSave(LS_DAYS(track.slug), mapped);
      setDays(mapped);
    }).catch(() => {});
    db.loadJourneys(userId).then(dbJourneys => {
      const j = dbJourneys.find(j => j.track_slug === track.slug);
      if (!j || journey) return;
      const mapped: Journey = {
        id: j.id, trackSlug: j.track_slug, totalDays: j.total_days,
        startingPoint: j.starting_point ?? "", motivation: j.motivation ?? "",
        obstacle: j.obstacle ?? "", startedAt: j.started_at ?? "",
        generatedThrough: j.generated_through ?? 0,
      };
      lsSave(LS_JOURNEY(track.slug), mapped);
      setJourney(mapped);
    }).catch(() => {});
  }, [userId, track.slug]);

  const handleStarted = (j: Journey, d: JourneyDay[]) => { setJourney(j); setDays(d); };
  const onVac = track.vacation_until && track.vacation_until >= todayStr();

  const inner = !journey || days.length === 0
    ? <JourneyOnboarding track={track} onStarted={handleStarted} userId={userId} />
    : <JourneyView track={track} journey={journey} days={days} onBack={onBack} showCheckInHint={showCheckInHint} onTrackCheckIn={onTrackCheckIn} onRestart={onRestart} userId={userId} />;

  return (
    <div className="relative min-h-screen">
      {/* Main content — blurred when on vacation */}
      <div className={onVac ? "blur-sm pointer-events-none select-none" : ""}>
        {inner}
      </div>
      {/* Vacation overlay */}
      {onVac && (
        <div className="fixed inset-0 z-30 flex flex-col items-center justify-center"
          style={{ background: "oklch(0.14 0.07 220 / 0.88)" }}>
          <SnowfallBackground count={55} speed={0.8} />
          <div className="relative z-10 text-center space-y-4 px-8">
            <p className="font-display text-6xl font-bold text-white tracking-tight"
              style={{ textShadow: "0 0 40px rgba(160,210,255,0.6)" }}>
              Freezed
            </p>
            <p className="text-white/60 text-sm font-mono tracking-widest uppercase">
              Streak protected · until {track.vacation_until}
            </p>
            <button
              onClick={() => onVacation?.(track.id, "")}
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-6 py-2.5 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/20 transition">
              <Sun className="h-4 w-4" />
              End Vacation
            </button>
            <button onClick={onBack}
              className="block text-xs text-white/40 hover:text-white/70 transition font-mono mx-auto pt-2">
              ← Torna indietro
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TracksPage
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// DurationPickerModal
// ─────────────────────────────────────────────────────────────────────────────

const DURATION_PRESETS = [30, 60, 90, 120, 180, 365] as const;

function DurationPickerModal({ trackName, onConfirm, onCancel }: {
  trackName: string;
  onConfirm: (days: number) => void;
  onCancel: () => void;
}) {
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
          <p className="text-[10px] uppercase tracking-[0.4em] font-mono text-muted-foreground mb-1">Journey length</p>
          <h2 className="font-display text-xl tracking-tight">{trackName}</h2>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {DURATION_PRESETS.map(d => (
            <button key={d}
              onClick={() => { setSelected(d); setCustom(false); }}
              className={`rounded-xl py-2.5 text-sm font-semibold border transition ${!custom && selected === d ? "bg-foreground text-neutral-900 border-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>
              {d === 365 ? "1 year" : `${d}d`}
            </button>
          ))}
        </div>
        <button onClick={() => { setCustom(true); setCustomVal(String(selected)); }}
          className={`w-full rounded-xl py-2.5 text-sm font-semibold border transition ${custom ? "bg-foreground text-neutral-900 border-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>
          Custom
        </button>
        {custom && (
          <input type="number" autoFocus value={customVal}
            onChange={e => setCustomVal(e.target.value)}
            min={7} max={999} placeholder="Days (7–999)"
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
        )}
        <div className="flex gap-3 pt-1">
          <button onClick={onCancel}
            className="flex-1 rounded-2xl py-3 text-sm font-semibold border border-border text-muted-foreground hover:text-foreground transition">
            Cancel
          </button>
          <button onClick={() => valid && onConfirm(days)} disabled={!valid}
            className="flex-2 flex-1 rounded-2xl py-3 text-sm font-semibold transition disabled:opacity-40"
            style={{ background: valid ? "oklch(0.6 0.22 250)" : undefined, color: valid ? "#fff" : undefined,
              ...(valid ? {} : { background: "oklch(0.2 0.02 240)", color: "oklch(0.5 0 0)" }) }}>
            Start {days >= 7 && days <= 999 ? `${days === 365 ? "1-year" : days + "-day"}` : ""} journey
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
      <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground font-mono">Library</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">Fifty <span className="text-yellow-400">specialists</span>.</h1>
      <p className="mt-2 text-foreground">Pick the one that calls you today.</p>
      <div className="mt-6 relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search tracks, categories…"
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
          All
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
          No tracks match "<span className="text-foreground">{search}</span>".
        </div>
      )}
      <div className="mt-8 space-y-10">
        {Object.entries(grouped).map(([cat, tracks]) => (
          <section key={cat}>
            <h2 className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground font-mono mb-4">{cat}</h2>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {tracks.map((t, i) => {
                const ut = activeMap.get(t.id);
                const on = !!ut;
                return (
                  <motion.div key={t.id} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                    className="warm-card rounded-2xl p-5 flex flex-col gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.25em] font-mono text-muted-foreground">{t.category}</p>
                      <h3 className="mt-1 font-semibold text-[15px]">{t.name}</h3>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{t.short_description}</p>
                    </div>
                    {on && ut ? (
                      <div className="flex gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold bg-[color:var(--tertiary)]/15 text-[color:var(--tertiary)]">
                          <Check className="h-3 w-3" />Active
                        </span>
                        <button onClick={() => onView(ut)}
                          className="btn-chunk inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-semibold bg-foreground text-neutral-900 transition">
                          View <ArrowRight className="h-3 w-3" />
                        </button>
                        <button onClick={() => { if (confirm(`Remove "${t.name}" from your paths?`)) onRemove(ut.id); }}
                          className="btn-chunk inline-flex items-center rounded-full px-2.5 py-1.5 text-xs border border-[color:var(--secondary)]/30 text-[color:var(--secondary)] hover:bg-[color:var(--secondary)]/10 transition"
                          title="Rimuovi track">
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setPendingAdd(t)}
                        className="btn-chunk self-start inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-semibold bg-foreground text-neutral-900 transition">
                        <Plus className="h-3 w-3" />Start
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

// ─────────────────────────────────────────────────────────────────────────────
// InsightsPage
// ─────────────────────────────────────────────────────────────────────────────

function InsightsPage({ userTracks, logs }: { userTracks: UserTrack[]; logs: Log[] }) {
  const [letterLoading, setLetterLoading] = useState(false);
  const [letter, setLetter] = useState<string | null>(null);
  const [showLetter, setShowLetter] = useState(false);

  const generateLetter = async () => {
    setLetterLoading(true);
    try {
      const journeyData = userTracks.map(t => {
        const days = lsLoad<JourneyDay[]>(LS_DAYS(t.slug), []);
        const completedDays = days.filter(d => d.completedAt !== null);
        const recentNotes = completedDays
          .filter(d => d.userNote)
          .slice(-7)
          .map(d => `Day ${d.dayNumber}: ${d.userNote}`);
        return { trackName: t.name, category: t.category, streak: t.current_streak || 0, totalDone: t.total_done || 0, recentNotes };
      });

      const hasNotes = journeyData.some(d => d.recentNotes.length > 0);
      const prompt = `You are a warm, personal growth coach writing a weekly recap letter for someone using the Forge app. Based on their journey data below, write a heartfelt letter (3-4 paragraphs, 150-200 words total) that:
- Acknowledges their specific progress with genuine warmth
${hasNotes ? "- Reflects back meaningful moments from their own notes/reflections — use their actual words where possible" : "- Encourages them to start writing notes after check-ins so you can reflect their journey back to them"}
- Feels deeply personal, never generic or motivational-poster-ish
- Ends with one concrete, specific thing to focus on this week

Their journey data:
${journeyData.map(d => `
${d.trackName} (${d.category})
Streak: ${d.streak} days | Total completed: ${d.totalDone} days
${d.recentNotes.length > 0 ? `Recent reflections:\n${d.recentNotes.join("\n")}` : "No notes yet — they are just getting started"}`).join("\n---\n")}

Start with "This week," and sign it "— Your Coach". Write like you actually know and care about them.`;

      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: "weekly-letter",
          archetype: "mentor",
          messages: [{ role: "user", content: prompt }],
          userContext: { totalTracks: userTracks.length, totalCheckins: logs.length },
        }),
      });
      const data = await res.json() as { message: string };
      setLetter(data.message);
      setShowLetter(true);
    } catch {
      setLetter("Something went wrong generating your letter. Check your connection and try again in a moment.");
      setShowLetter(true);
    } finally {
      setLetterLoading(false);
    }
  };

  const heatmap = useMemo(() => {
    const byDay = new Map<string, number>();
    logs.forEach(l => byDay.set(l.log_date, (byDay.get(l.log_date) || 0) + 1));
    const result: { date: string; count: number }[] = [];
    for (let i = 89; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
      result.push({ date: d, count: byDay.get(d) || 0 });
    }
    return result;
  }, [logs]);

  const weeks = useMemo(() => {
    const cols: typeof heatmap[] = [];
    for (let i = 0; i < heatmap.length; i += 7) cols.push(heatmap.slice(i, i + 7));
    return cols;
  }, [heatmap]);

  const monthLabels = useMemo(() => weeks.map((w, i) => {
    if (i === 0) return new Date(w[0].date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' });
    const prev = new Date(weeks[i - 1][0].date + 'T12:00:00');
    const cur  = new Date(w[0].date + 'T12:00:00');
    return prev.getMonth() !== cur.getMonth()
      ? cur.toLocaleDateString('en-US', { month: 'short' })
      : "";
  }), [weeks]);

  const tone = (count: number) => {
    if (count <= 0) return "bg-muted";
    if (count === 1) return "bg-[color:var(--tertiary)]/30";
    if (count === 2) return "bg-[color:var(--tertiary)]/60";
    return "bg-[color:var(--tertiary)]";
  };

  const totalCheckins = logs.length;
  const activeDays = heatmap.filter(d => d.count > 0).length;

  // Weekly comparison
  const todayTs = Date.now();
  const thisWeekStart = todayTs - 7 * 86_400_000;
  const lastWeekStart = todayTs - 14 * 86_400_000;
  const thisWeekCount = logs.filter(l => new Date(l.log_date).getTime() >= thisWeekStart).length;
  const lastWeekCount = logs.filter(l => {
    const t = new Date(l.log_date).getTime();
    return t >= lastWeekStart && t < thisWeekStart;
  }).length;
  const weekDelta = thisWeekCount - lastWeekCount;

  // 28-day bar chart data
  const last28 = useMemo(() => {
    const byDay = new Map<string, number>();
    logs.forEach(l => byDay.set(l.log_date, (byDay.get(l.log_date) || 0) + 1));
    return Array.from({ length: 28 }, (_, i) => {
      const d = new Date(Date.now() - (27 - i) * 86_400_000).toISOString().slice(0, 10);
      return { date: d, count: byDay.get(d) || 0, isToday: i === 27 };
    });
  }, [logs]);
  const maxBar = Math.max(1, ...last28.map(d => d.count));

  // Best streak across all tracks
  const bestStreak = userTracks.reduce((best, t) => Math.max(best, t.longest_streak || 0), 0);

  return (
    <div className="container mx-auto px-6 py-8 max-w-4xl space-y-8">
      <header>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight font-display">Insights</h1>
        <p className="text-muted-foreground mt-1">Your data, clear and honest.</p>
        <button onClick={generateLetter} disabled={letterLoading}
          className="mt-4 btn-chunk inline-flex items-center gap-2 rounded-full bg-foreground text-neutral-900 px-5 py-2.5 text-sm font-semibold disabled:opacity-60 transition">
          {letterLoading ? (
            <><span className="h-3.5 w-3.5 rounded-full border-2 border-background/30 border-t-background animate-spin" />Generating your letter…</>
          ) : (
            <><Mail className="h-3.5 w-3.5" />Weekly recap letter</>
          )}
        </button>
      </header>

      {/* Empty state */}
      {totalCheckins === 0 && (
        <div className="rounded-2xl border border-border bg-card p-10 text-center space-y-3">
          <BarChart2 className="h-10 w-10 mx-auto text-muted-foreground/50" />
          <h3 className="font-display text-xl font-semibold">No data yet</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Complete your first check-in to see your progress here.
          </p>
        </div>
      )}

      {/* Summary row */}
      {totalCheckins > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total check-ins", value: totalCheckins },
            { label: "Active days (90d)", value: activeDays },
            { label: "Best streak", value: bestStreak, unit: "d" },
            { label: "Active paths", value: userTracks.length },
          ].map(s => (
            <div key={s.label} className="rounded-2xl border border-border bg-card p-4 text-center">
              <p className="font-bold text-2xl font-display">{s.value}{s.unit ?? ""}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Weekly comparison */}
      {totalCheckins > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-semibold mb-4">This week vs last week</h2>
          <div className="flex items-end gap-6">
            {/* Last week bar */}
            <div className="flex flex-col items-center gap-2 flex-1">
              <p className="text-xl font-bold font-display text-muted-foreground">{lastWeekCount}</p>
              <div className="w-full rounded-t-lg bg-muted/60 transition-all" style={{ height: `${Math.round((lastWeekCount / Math.max(1, thisWeekCount, lastWeekCount)) * 80) + 8}px` }} />
              <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">Last week</p>
            </div>
            {/* Delta */}
            <div className="flex flex-col items-center gap-1 pb-6 shrink-0">
              <span className={`text-sm font-bold ${weekDelta > 0 ? "text-emerald-400" : weekDelta < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                {weekDelta > 0 ? `+${weekDelta}` : weekDelta === 0 ? "=" : weekDelta}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">vs</span>
            </div>
            {/* This week bar */}
            <div className="flex flex-col items-center gap-2 flex-1">
              <p className="text-xl font-bold font-display" style={{ color: "var(--tertiary)" }}>{thisWeekCount}</p>
              <div className="w-full rounded-t-lg transition-all" style={{ height: `${Math.round((thisWeekCount / Math.max(1, thisWeekCount, lastWeekCount)) * 80) + 8}px`, background: "var(--tertiary)", opacity: 0.8 }} />
              <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">This week</p>
            </div>
          </div>
        </section>
      )}

      {/* 28-day activity bar chart */}
      {totalCheckins > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-semibold mb-4">Daily activity — last 28 days</h2>
          <div className="flex items-end gap-[3px] h-16">
            {last28.map(d => (
              <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full" title={`${d.date}: ${d.count} check-in${d.count !== 1 ? "s" : ""}`}>
                <div
                  className={`w-full rounded-t-sm transition-all ${d.isToday ? "opacity-100" : "opacity-70"}`}
                  style={{
                    height: d.count > 0 ? `${Math.max(8, Math.round((d.count / maxBar) * 52))}px` : "3px",
                    background: d.count > 0 ? "var(--tertiary)" : "oklch(1 0 0 / 0.08)",
                    borderRadius: "3px 3px 1px 1px",
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2">
            <p className="text-[9px] text-muted-foreground font-mono">{last28[0]?.date.slice(5)}</p>
            <p className="text-[9px] text-muted-foreground font-mono">today</p>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">90-day activity</h2>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
            <span>less</span>
            {[0,1,2,3].map(v => <div key={v} className={`h-2.5 w-2.5 rounded-sm ${tone(v)}`} />)}
            <span>more</span>
          </div>
        </div>
        {totalCheckins === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Complete your first check-in to see activity here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Month labels */}
            <div className="flex gap-1 mb-1">
              {weeks.map((_, i) => (
                <div key={i} className="w-3 shrink-0 text-[8px] text-muted-foreground font-mono leading-none">
                  {monthLabels[i]}
                </div>
              ))}
            </div>
            {/* Day squares */}
            <div className="flex gap-1">
              {weeks.map((w, i) => (
                <div key={i} className="flex flex-col gap-1">
                  {w.map(d => (
                    <div key={d.date} title={`${d.date}: ${d.count} check-in${d.count !== 1 ? "s" : ""}`}
                      className={`h-3 w-3 rounded-sm transition-colors ${tone(d.count)}`} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {userTracks.length > 0 && (
        <section>
          <h2 className="font-semibold mb-3">Per path</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {userTracks.map(t => {
              const streak = liveStreak(t);
              const best = t.longest_streak || 0;
              const done = t.total_done || 0;
              const target = t.target_days || 30;
              const progressPct = Math.min(1, done / target);
              const streakPct = best > 0 ? Math.min(1, streak / best) : 0;
              return (
                <div key={t.id} className="rounded-2xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-[15px] leading-tight">{t.name}</h3>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mt-0.5">{t.category}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-lg font-display leading-none" style={{ color: streak > 0 ? "var(--tertiary)" : undefined }}>{streak}d</p>
                      <p className="text-[9px] text-muted-foreground font-mono mt-0.5">streak</p>
                    </div>
                  </div>

                  {/* Journey progress bar */}
                  <div>
                    <div className="flex justify-between text-[10px] text-muted-foreground font-mono mb-1">
                      <span>Journey progress</span>
                      <span>{done}/{target} days</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${progressPct * 100}%`, background: "var(--tertiary)" }} />
                    </div>
                  </div>

                  {/* Streak vs best */}
                  {best > 0 && (
                    <div>
                      <div className="flex justify-between text-[10px] text-muted-foreground font-mono mb-1">
                        <span>Streak vs best</span>
                        <span>{streak} / {best}d</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${streakPct * 100}%`, background: streak >= best && best > 0 ? "#f59e0b" : "oklch(0.6 0.22 250)" }} />
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <div className="flex-1 rounded-xl bg-muted/50 p-2 text-center">
                      <p className="font-bold text-sm">{best}d</p>
                      <p className="text-[9px] text-muted-foreground font-mono uppercase mt-0.5">Best</p>
                    </div>
                    <div className="flex-1 rounded-xl bg-muted/50 p-2 text-center">
                      <p className="font-bold text-sm">{done}</p>
                      <p className="text-[9px] text-muted-foreground font-mono uppercase mt-0.5">Done</p>
                    </div>
                    <div className="flex-1 rounded-xl bg-muted/50 p-2 text-center">
                      <p className="font-bold text-sm">{target - done > 0 ? target - done : "✓"}</p>
                      <p className="text-[9px] text-muted-foreground font-mono uppercase mt-0.5">{target - done > 0 ? "Left" : "Complete"}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Weekly Letter Modal */}
      <AnimatePresence>
        {showLetter && letter && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowLetter(false)}>
            <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 24 }}
              className="bg-background rounded-3xl p-6 max-w-lg w-full max-h-[82vh] overflow-y-auto shadow-2xl"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-5">
                <div className="h-10 w-10 rounded-full grad-electric flex items-center justify-center shrink-0">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-semibold text-base">Weekly Letter</p>
                  <p className="text-[11px] text-muted-foreground font-mono">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
                </div>
                <button onClick={() => setShowLetter(false)}
                  className="text-muted-foreground hover:text-foreground text-xl leading-none shrink-0">✕</button>
              </div>
              <div className="rounded-2xl bg-card border border-border p-5">
                <p className="text-sm leading-[1.75] whitespace-pre-line text-foreground">{letter}</p>
              </div>
              <p className="mt-3 text-center text-[10px] text-muted-foreground font-mono">Generated privately for you alone</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SettingsPage
// ─────────────────────────────────────────────────────────────────────────────

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
function SettingsPage({ userName, onSignOut, onUpdateName, islandTheme, onChangeTheme , shields, tracks}: { userName: string; onSignOut: () => void; onUpdateName: (name: string) => void; islandTheme: string; onChangeTheme: (t: string) => void ; shields: number; tracks: UserTrack[]}) {
  const [displayName, setDisplayName] = useState(userName);
  const [nameSaved, setNameSaved] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => lsLoad<{ theme: "light" | "dark" }>(LS_PREFS, { theme: "dark" }).theme);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(() => lsLoad<boolean>("forge-notif", false));
  const [reminderOn, setReminderOn] = useState(() => lsLoad<boolean>("forge-reminder-on", false));
  const [reminderTime, setReminderTime] = useState(() => lsLoad<string>("forge-reminder-time", "21:00"));
  const [pushLoading, setPushLoading] = useState(false);
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
                {nameSaved ? "Saved ✓" : "Save"}
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
            <span className="text-lg" aria-hidden="true">🛡</span>
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
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FirstDayReveal — cinematic first-login experience
// ─────────────────────────────────────────────────────────────────────────────

function FirstDayReveal({ userName, track, onComplete }: {
  userName: string;
  track: UserTrack;
  onComplete: () => void;
}) {
  type FDRPhase = "welcome" | "track" | "duration" | "generating" | "reveal";
  const [phase, setPhase] = useState<FDRPhase>("welcome");
  const [day1, setDay1] = useState<JourneyDay | null>(null);
  const [targetDays, setTargetDays] = useState(30);
  const [customDur, setCustomDur] = useState(false);
  const [customDurVal, setCustomDurVal] = useState("");

  // Phase auto-progression (welcome → track only; duration waits for user)
  useEffect(() => {
    const t1 = setTimeout(() => setPhase("track"), 1400);
    const t2 = setTimeout(() => setPhase("duration"), 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Generate days when phase reaches "generating"
  useEffect(() => {
    if (phase !== "generating") return;
    const generate = async () => {
      const j: Journey = {
        id: nanoid(), trackSlug: track.slug, totalDays: targetDays,
        startingPoint: "Ready to start fresh",
        motivation: "I want real, lasting change",
        obstacle: "Staying consistent when motivation fades",
        startedAt: new Date().toISOString(), generatedThrough: 0,
      };
      const makeFallback = (): JourneyDay[] => Array.from({ length: 7 }, (_, i) => ({
        id: nanoid(), journeyId: j.id, dayNumber: i + 1,
        title: `Day ${i + 1} — ${track.name}`,
        description: `Your ${track.name} journey begins. Every day forward counts.`,
        task: `Spend at least 15 minutes on ${track.name} today. Notice how it feels.`,
        reflection: "What surprised you about today's experience?",
        science: "Repetition within 24 hours strengthens neural pathways by up to 40%.",
        checkinPrompt: "How are you feeling right now, 1–10?",
        completedAt: null, userNote: null,
      }));
      try {
        let rawDays3: JourneyDay[] | null = null;
        const cached3 = await db.loadJourneyTemplate(track.slug, 1, 7).catch(() => null);
        if (cached3) {
          rawDays3 = cached3 as JourneyDay[];
        } else {
          const res = await fetch("/api/generate-days", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              slug: track.slug, trackName: track.name, category: track.category,
              startingPoint: "Complete beginner, first time",
              motivation: "I want real and lasting change in my life",
              obstacle: "Staying consistent when motivation drops",
              fromDay: 1, count: 7,
            }),
          });
          if (!res.ok) throw new Error();
          const { days: freshDays3 } = await res.json() as { days: JourneyDay[] };
          rawDays3 = freshDays3;
          db.saveJourneyTemplate(track.slug, 1, 7, freshDays3).catch(() => {});
        }
        const days = rawDays3!;
        const filled = days.map((d, i) => ({ ...d, id: nanoid(), journeyId: j.id, dayNumber: i + 1, completedAt: null, userNote: null }));
        j.generatedThrough = 7;
        lsSave(LS_JOURNEY(track.slug), j);
        lsSave(LS_DAYS(track.slug), filled);
        setDay1(filled[0]);
      } catch {
        const fallback = makeFallback();
        j.generatedThrough = 7;
        lsSave(LS_JOURNEY(track.slug), j);
        lsSave(LS_DAYS(track.slug), fallback);
        setDay1(fallback[0]);
      }
      setTimeout(() => setPhase("reveal"), 300);
    };
    generate();
  }, [phase, track, targetDays]);

  // Confetti burst on reveal
  useEffect(() => {
    if (phase !== "reveal") return;
    setTimeout(() => {
      confetti({ particleCount: 90, spread: 75, origin: { y: 0.38 }, colors: ["#3b82f6", "#6366f1", "#8b5cf6", "#ffffff", "#38bdf8"] });
    }, 600);
  }, [phase]);

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden" style={{ background: "oklch(0.08 0.02 240)" }}>
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[32rem] h-[32rem] rounded-full opacity-[0.15]"
          style={{ background: "radial-gradient(circle, oklch(0.55 0.22 250) 0%, transparent 70%)" }} />
      </div>

      <AnimatePresence mode="wait">
        {/* PHASE 1 — Welcome */}
        {phase === "welcome" && (
          <motion.div key="welcome"
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -28, transition: { duration: 0.4 } }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.6 }}
              className="text-muted-foreground text-[10px] uppercase tracking-[0.5em] font-mono mb-5">
              Forge
            </motion.p>
            <h1 className="font-display text-5xl text-foreground tracking-tight">
              Welcome, {userName}.
            </h1>
          </motion.div>
        )}

        {/* PHASE 2 — Track name */}
        {phase === "track" && (
          <motion.div key="track"
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -28, transition: { duration: 0.4 } }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.5 }}
              className="text-muted-foreground text-[10px] uppercase tracking-[0.5em] font-mono mb-3">
              {track.category}
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="font-display text-5xl text-foreground tracking-tight mb-4">
              {track.name}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.5 }}
              className="text-muted-foreground text-sm">
              Your 30-day journey starts now.
            </motion.p>
          </motion.div>
        )}

        {/* PHASE 3 — Duration picker */}
        {phase === "duration" && (
          <motion.div key="duration"
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -28, transition: { duration: 0.4 } }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="absolute inset-0 flex flex-col items-center justify-center px-6 gap-6 text-center">
            <div>
              <p className="text-[10px] uppercase tracking-[0.5em] font-mono text-muted-foreground mb-2">How long?</p>
              <h2 className="font-display text-3xl text-foreground tracking-tight">Choose your commitment.</h2>
            </div>
            <div className="w-full max-w-xs grid grid-cols-3 gap-2">
              {([30, 60, 90, 120, 180, 365] as const).map(d => (
                <button key={d}
                  onClick={() => { setTargetDays(d); setCustomDur(false); }}
                  className={`rounded-xl py-3 text-sm font-semibold border transition ${!customDur && targetDays === d ? "bg-foreground text-neutral-900 border-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>
                  {d === 365 ? "1 year" : `${d}d`}
                </button>
              ))}
            </div>
            <button
              onClick={() => { setCustomDur(true); setCustomDurVal(String(targetDays)); }}
              className={`w-full max-w-xs rounded-xl py-3 text-sm font-semibold border transition ${customDur ? "bg-foreground text-neutral-900 border-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>
              Custom
            </button>
            {customDur && (
              <input type="number" autoFocus value={customDurVal}
                onChange={e => { setCustomDurVal(e.target.value); const n = parseInt(e.target.value); if (n >= 7 && n <= 999) setTargetDays(n); }}
                min={7} max={999} placeholder="Days (7–999)"
                className="w-full max-w-xs rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring text-center" />
            )}
            <button
              onClick={() => { lsSave("forge-track-target-days-" + track.slug, targetDays); setPhase("generating"); }}
              className="w-full max-w-xs rounded-2xl py-4 font-semibold text-[15px] flex items-center justify-center gap-2"
              style={{ background: "oklch(0.6 0.22 250)", color: "#fff" }}>
              Build my {targetDays === 365 ? "year-long" : targetDays + "-day"} journey
              <ArrowRight className="h-5 w-5" />
            </button>
          </motion.div>
        )}

        {/* PHASE 4 — Generating */}
        {phase === "generating" && (
          <motion.div key="generating"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
            className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center gap-6">
            <div className="flex gap-2 items-center">
              {[0, 1, 2].map(i => (
                <motion.div key={i}
                  className="w-2 h-2 rounded-full"
                  style={{ background: "oklch(0.65 0.2 250)" }}
                  animate={{ opacity: [0.25, 1, 0.25], scale: [0.7, 1.3, 0.7] }}
                  transition={{ duration: 1.3, repeat: Infinity, delay: i * 0.22 }} />
              ))}
            </div>
            <p className="text-muted-foreground text-xs font-mono uppercase tracking-wider">Building your Day 1…</p>
          </motion.div>
        )}

        {/* PHASE 5 — Day 1 Reveal */}
        {phase === "reveal" && day1 && (
          <motion.div key="reveal"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
            className="absolute inset-0 flex flex-col overflow-y-auto">

            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.6 }}
              className="pt-14 pb-6 px-6 text-center flex-shrink-0">
              <p className="text-[10px] uppercase tracking-[0.5em] font-mono text-muted-foreground mb-2">Day 1</p>
              <h1 className="font-display text-3xl text-foreground tracking-tight leading-tight">
                {day1.title.replace(/^Day\s+\d+\s*[—\-–]\s*/i, "")}
              </h1>
            </motion.div>

            {/* Cards */}
            <div className="flex-1 px-5 space-y-3 pb-6">
              {/* Task */}
              <motion.div
                initial={{ opacity: 0, y: 36 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-2xl p-5 border-l-4"
                style={{ background: "oklch(0.13 0.04 250)", borderLeftColor: "oklch(0.6 0.22 250)" }}>
                <p className="text-[9px] uppercase tracking-[0.4em] font-mono mb-2.5"
                  style={{ color: "oklch(0.65 0.2 250)" }}>Today's Task</p>
                <p className="text-foreground text-[15px] leading-relaxed">{day1.task}</p>
              </motion.div>

              {/* Description */}
              <motion.div
                initial={{ opacity: 0, y: 36 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-2xl p-5"
                style={{ background: "oklch(0.11 0.02 240)" }}>
                <p className="text-[9px] uppercase tracking-[0.4em] font-mono text-muted-foreground mb-2.5">Context</p>
                <p className="text-muted-foreground text-sm leading-relaxed">{day1.description}</p>
              </motion.div>

              {/* Science */}
              <motion.div
                initial={{ opacity: 0, y: 36 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-2xl p-5 border-l-4"
                style={{ background: "oklch(0.12 0.04 150)", borderLeftColor: "oklch(0.62 0.2 150)" }}>
                <p className="text-[9px] uppercase tracking-[0.4em] font-mono mb-2.5"
                  style={{ color: "oklch(0.65 0.2 150)" }}>The Science</p>
                <p className="text-muted-foreground text-sm leading-relaxed">{day1.science}</p>
              </motion.div>

              {/* Reflection */}
              <motion.div
                initial={{ opacity: 0, y: 36 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-2xl p-5 border-l-4"
                style={{ background: "oklch(0.13 0.04 65)", borderLeftColor: "oklch(0.72 0.18 65)" }}>
                <p className="text-[9px] uppercase tracking-[0.4em] font-mono mb-2.5"
                  style={{ color: "oklch(0.72 0.18 65)" }}>Tonight's Reflection</p>
                <p className="text-muted-foreground text-sm leading-relaxed">{day1.reflection}</p>
              </motion.div>
            </div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.95, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="flex-shrink-0 px-5 pb-10 pt-3">
              <button
                onClick={onComplete}
                className="w-full rounded-2xl py-4 font-semibold text-[15px] flex items-center justify-center gap-2 transition-opacity active:opacity-80"
                style={{ background: "oklch(0.6 0.22 250)", color: "#fff" }}>
                I'm ready. Start Day 1
                <ArrowRight className="h-5 w-5" />
              </button>
              <p className="text-center text-[11px] text-muted-foreground mt-3 font-mono">
                30-day journey · {track.name}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CheckInCelebration overlay
// ─────────────────────────────────────────────────────────────────────────────

const CELEBRATION_PHRASES = [
  "The version of you who quit is getting further away.",
  "You showed up. That's the whole game.",
  "Discipline is just self-love spelled differently.",
  "Another rep. Another brick. Another day.",
  "The streak doesn't care how you feel. It cares that you came.",
  "Most people talked about it. You did it.",
  "One day you'll look back — this is when it started.",
  "Your future self just exhaled.",
  "Identity is built in moments like this one.",
  "The hard days count double.",
  "You're not building a habit. You're building a person.",
  "Small reps. Big identity.",
  "Every check-in is a vote for who you're becoming.",
  "Consistency isn't glamorous. Neither is greatness — until it is.",
  "This is what the comeback looks like.",
  "No one can take today away from you.",
  "The gap between who you are and who you want to be just got smaller.",
  "Showing up when you don't want to — that's the real flex.",
  "You didn't need motivation. You used discipline. That's stronger.",
  "Day by day. That's how empires are built.",
];

function CheckInCelebration({ trackName, streak, onDismiss }: {
  trackName: string;
  streak: number;
  onDismiss: () => void;
}) {
  const phrase = useMemo(() => CELEBRATION_PHRASES[Math.floor(Math.random() * CELEBRATION_PHRASES.length)], []);
  const [progress, setProgress] = useState(100);
  const DURATION = 3000;

  // confetti on mount
  useEffect(() => {
    confetti({ particleCount: 70, spread: 60, origin: { y: 0.5 }, colors: ["#3b82f6","#6366f1","#8b5cf6","#ffffff","#fbbf24"] });
    const start = Date.now();
    const raf = requestAnimationFrame(function tick() {
      const elapsed = Date.now() - start;
      const pct = Math.max(0, 100 - (elapsed / DURATION) * 100);
      setProgress(pct);
      if (pct > 0) requestAnimationFrame(tick);
      else onDismiss();
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[90] flex flex-col items-center justify-center cursor-pointer select-none"
      style={{ background: "oklch(0.07 0.02 240)" }}
      onClick={onDismiss}>

      {/* ambient glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1.4, opacity: 0.18 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full"
          style={{ background: "radial-gradient(circle, oklch(0.65 0.25 250), transparent 70%)" }} />
      </div>

      <div className="relative flex flex-col items-center gap-6 px-8 text-center max-w-sm">
        {/* Streak ring + number */}
        <motion.div
          initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 18, delay: 0.05 }}
          className="relative flex items-center justify-center">
          <svg width="140" height="140" className="-rotate-90">
            <circle cx="70" cy="70" r="58" stroke="oklch(1 0 0 / 0.08)" strokeWidth="8" fill="none" />
            <motion.circle cx="70" cy="70" r="58"
              stroke="oklch(0.65 0.22 250)" strokeWidth="8" fill="none"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 58}`}
              initial={{ strokeDashoffset: 2 * Math.PI * 58 }}
              animate={{ strokeDashoffset: 0 }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.p
              initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 280, damping: 18, delay: 0.2 }}
              className="font-display text-5xl text-white tracking-tight leading-none">
              {streak}
            </motion.p>
            <p className="text-[10px] uppercase tracking-[0.35em] font-mono text-white/50 mt-1">
              {streak === 1 ? "day" : "days"}
            </p>
          </div>
        </motion.div>

        {/* Track + completion */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}>
          <p className="text-[10px] uppercase tracking-[0.4em] font-mono text-muted-foreground mb-1">{trackName}</p>
          <h2 className="font-display text-2xl text-white tracking-tight">
            Day {streak} complete.
          </h2>
        </motion.div>

        {/* Phrase */}
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="text-sm text-muted-foreground leading-relaxed italic">
          "{phrase}"
        </motion.p>

        {/* See you tomorrow */}
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 0.75, duration: 0.5 }}
          className="text-[11px] font-mono uppercase tracking-[0.4em] text-white/30">
          See you tomorrow.
        </motion.p>
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5">
        <motion.div className="h-full" style={{ background: "oklch(0.65 0.22 250)", width: `${progress}%` }} />
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ElevateApp — root component
// ─────────────────────────────────────────────────────────────────────────────

export function ElevateApp() {
  const [screen, setScreen] = useState<Screen>(() => {
    const user = lsLoad<ElevateUser | null>(LS_USER, null);
    const auth = lsLoad<ElevateAuth | null>(LS_AUTH, null);
    const pendingTrack = lsLoad<OnboardingTrack | null>("forge-pending-track", null);
    if (user) return "dashboard";
    // Auth done but no user yet → finish setting up
    if (auth && !pendingTrack) return "onboarding";
    if (auth && pendingTrack) return "dashboard"; // should not happen, but safe fallback
    return "landing";
  });
  const [page, setPage] = useState<AppPage>("home");
  const [selectedTrack, setSelectedTrack] = useState<UserTrack | null>(null);
  const [firstDayReveal, setFirstDayReveal] = useState<{ track: UserTrack; userName: string } | null>(null);
  const [checkInCelebration, setCheckInCelebration] = useState<{ trackName: string; streak: number } | null>(null);
  const [pendingCheckIn, setPendingCheckIn] = useState(false);
  const [showMorningCoach, setShowMorningCoach] = useState(false);
  const [showReEntry, setShowReEntry] = useState(false);
  const [reEntryGap, setReEntryGap] = useState(0);
  const [milestone, setMilestone] = useState<{ days: number; trackName: string } | null>(null);
  const [showSOS, setShowSOS] = useState(false);
  const [streakRecovery, setStreakRecovery] = useState<{ brokenStreak: number; trackName: string } | null>(null);
  const [cert, setCert] = useState<number | null>(null);
  const [shields, setShields] = useState<number>(() => lsLoad<number>('forge-shields', 0));

  // Register push subscription when user logs in
  const [trackCompletion, setTrackCompletion] = useState<{ trackName: string } | null>(null);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [reengagement, setReengagement] = useState<{ daysMissed: number; trackName: string } | null>(null);
  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e); setShowInstallBanner(true); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  const [user, setUser] = useState<ElevateUser | null>(() => lsLoad(LS_USER, null));
  useEffect(() => {
    if (!user) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing) return;
        const resp = await fetch('/api/vapid-public-key');
        const { key } = await resp.json();
        if (!key) return;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        });
        await fetch('/api/push-subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: sub.toJSON(), userId: user.supabaseId, reminderHour: 9 }),
        });
      } catch (e) {
        console.warn('Push subscription failed:', e);
      }
    })();
  }, [user?.supabaseId]);
  const [tracks, setTracks] = useState<UserTrack[]>(() => lsLoad(LS_TRACKS, []));
  const [logs, setLogs] = useState<Log[]>(() => lsLoad(LS_LOGS, []));
  const [supabaseId, setSupabaseId] = useState<string | null>(() => lsLoad<ElevateUser | null>(LS_USER, null)?.supabaseId ?? null);

  const updateUser = useCallback((patch: Partial<ElevateUser>) => {
    setUser(prev => {
      const next = { ...prev!, ...patch };
      lsSave(LS_USER, next);
      if (supabaseId && patch.name !== undefined) {
        db.saveProfile(supabaseId, next.name).catch(() => {});
      }
      return next;
    });
  }, [supabaseId]);

  const addTrack = useCallback((trackDef: typeof ALL_TRACKS[0], targetDays = 30) => {
    setTracks(prev => {
      if (prev.some(t => t.track_id === trackDef.id)) return prev;
      const next: UserTrack[] = [...prev, {
        id: nanoid(), track_id: trackDef.id, name: trackDef.name,
        category: trackDef.category, slug: trackDef.slug,
        added_at: new Date().toISOString(),
        current_streak: 0, longest_streak: 0, total_done: 0,
        last_log_date: null, target_days: targetDays,
      }];
      lsSave(LS_TRACKS, next);
      if (supabaseId) db.saveTracks(supabaseId, next).catch(() => {});
      return next;
    });
  }, [supabaseId]);

  const removeTrack = useCallback((trackId: string) => {
    setTracks(prev => {
      const next = prev.filter(t => t.id !== trackId);
      lsSave(LS_TRACKS, next);
      if (supabaseId) db.deleteTrack(supabaseId, trackId).catch(() => {});
      return next;
    });
  }, [supabaseId]);

  const setVacation = useCallback((trackId: string, until: string) => {
    setTracks(prev => {
      const next = prev.map(t => t.id === trackId ? { ...t, vacation_until: until || null } : t);
      lsSave(LS_TRACKS, next);
      if (supabaseId) db.saveTracks(supabaseId, next).catch(() => {});
      return next;
    });
  }, [supabaseId]);

  const restartTrack = useCallback((trackId: string) => {
    setTracks(prev => {
      const ut = prev.find(t => t.id === trackId);
      if (ut) {
        lsSave(LS_JOURNEY(ut.slug), null);
        lsSave(LS_DAYS(ut.slug), []);
        lsSave(LS_CHAT(ut.slug), []);
        lsSave(LS_COMMUNITY(ut.slug), []);
        lsSave(`forge-completed-${trackId}`, false);
        if (supabaseId) {
          db.deleteJourneyForTrack(supabaseId, ut.slug).catch(() => {});
          db.deleteLogsForTrack(supabaseId, trackId).catch(() => {});
        }
      }
      const next = prev.map(t => t.id === trackId
        ? { ...t, current_streak: 0, total_done: 0, last_log_date: null }
        : t);
      lsSave(LS_TRACKS, next);
      if (supabaseId) db.saveTracks(supabaseId, next).catch(() => {});
      return next;
    });
    setLogs(prev => {
      const next = prev.filter(l => l.track_id !== trackId);
      lsSave(LS_LOGS, next);
      return next;
    });
  }, [supabaseId]);

  const MILESTONE_DAYS = new Set([1, 3, 7, 14, 30, 66, 100, 365]);

  const checkIn = useCallback((userTrackId: string) => {
    navigator.vibrate?.(40);
    const t = todayStr();
    const y = yesterdayStr();
    setTracks(prev => {
      const next = prev.map(ut => {
        if (ut.id !== userTrackId || ut.last_log_date === t) return ut;
        const rawStreak = ut.last_log_date === y ? (ut.current_streak || 0) + 1 : 1;
        let newStreak = rawStreak;
        if (rawStreak === 1 && (ut.current_streak || 0) > 1) {
          const shieldCount = lsLoad<number>('forge-shields', 0);
          if (shieldCount > 0) {
            const used = shieldCount - 1;
            lsSave('forge-shields', used);
            newStreak = (ut.current_streak || 0) + 1;
            setTimeout(() => setShields(used), 100);
          }
        }
        const newTotal = (ut.total_done || 0) + 1;
        // Check milestone after update
        const milestoneKey = `forge-milestone-${ut.id}-${newStreak}`;
        if (MILESTONE_DAYS.has(newStreak) && !lsLoad<boolean>(milestoneKey, false)) {
          lsSave(milestoneKey, true);
          setTimeout(() => setMilestone({ days: newStreak, trackName: ut.name }), 600);
        }
        // Certificate every 10 consecutive days
        if (newStreak % 10 === 0) {
          const certKey = `forge-cert-${ut.id}-${newStreak}`;
          if (!lsLoad<boolean>(certKey, false)) {
            lsSave(certKey, true);
            setTimeout(() => setCert(newStreak), 900);
          }
        }
        // Earn a shield every 10 consecutive days
        if (newStreak % 10 === 0) {
          const sKey = `forge-shield-${ut.id}-${newStreak}`;
          if (!lsLoad<boolean>(sKey, false)) {
            lsSave(sKey, true);
            const earned = lsLoad<number>('forge-shields', 0) + 1;
            lsSave('forge-shields', earned);
            setTimeout(() => setShields(earned), 300);
          }
        }
        // Trigger celebration for every check-in
        if (!MILESTONE_DAYS.has(newStreak)) {
          setTimeout(() => setCheckInCelebration({ trackName: ut.name, streak: newStreak }), 250);
        } else {
          setTimeout(() => setCheckInCelebration({ trackName: ut.name, streak: newStreak }), 250);
        }
        // Detect track completion
        const targetDays = ut.target_days || 30;
        if (newTotal >= targetDays) {
          const compKey = `forge-completed-${ut.id}`;
          if (!lsLoad<boolean>(compKey, false)) {
            lsSave(compKey, true);
            setTimeout(() => setTrackCompletion({ trackName: ut.name }), 800);
          }
        }
        return { ...ut, current_streak: newStreak, longest_streak: Math.max(ut.longest_streak || 0, newStreak), total_done: newTotal, last_log_date: t };
      });
      lsSave(LS_TRACKS, next);
      return next;
    });
    setLogs(prev => {
      const newLog = { id: nanoid(), track_id: userTrackId, log_date: todayStr(), created_at: new Date().toISOString() };
      const next = [...prev, newLog];
      lsSave(LS_LOGS, next);
      if (supabaseId) db.saveLog(supabaseId, newLog).catch(() => {});
      return next;
    });
    // Also persist updated track stats
    if (supabaseId) {
      setTracks(current => {
        db.saveTracks(supabaseId, current).catch(() => {});
        return current;
      });
    }
  }, [supabaseId]);

  const handleViewForCheckIn = useCallback((t: UserTrack) => {
    setPendingCheckIn(true);
    setSelectedTrack(t);
  }, []);

  const handleTrackBack = useCallback(() => {
    setSelectedTrack(null);
    setPendingCheckIn(false);
  }, []);

  // Called after user picks their track — save it and go to login
  const handleOnboardingComplete = useCallback(({ track, name }: { track: OnboardingTrack; name?: string }) => {
    lsSave("forge-pending-track", track);
    if (name) lsSave("forge-pending-name", name);
    setScreen("login");
  }, []);

  // Called after successful login — create user from entered name + pending track, then open Day 1
  const handleLoginSuccess = useCallback((enteredName: string) => {
    const pendingTrack = lsLoad<OnboardingTrack | null>("forge-pending-track", null);
    const savedName = lsLoad<string | null>("forge-pending-name", null);
    const displayName = savedName || enteredName.trim() || "Forger";
    localStorage.removeItem("forge-pending-name");

    // Get Supabase auth user
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      const uid = authUser?.id ?? null;
      if (uid) setSupabaseId(uid);

      const newUser: ElevateUser = { name: displayName, createdAt: new Date().toISOString(), supabaseId: uid ?? undefined };
      lsSave(LS_USER, newUser);
      setUser(newUser);

      if (pendingTrack) {
        const full = ALL_TRACKS.find(t => t.slug === pendingTrack.slug) ?? {
          id: nanoid(), slug: pendingTrack.slug, name: pendingTrack.name, category: pendingTrack.category, short_description: "",
        };
        const ut: UserTrack = {
          id: nanoid(), track_id: full.id, name: full.name, category: full.category, slug: full.slug,
          added_at: new Date().toISOString(), current_streak: 0, longest_streak: 0, total_done: 0,
          last_log_date: null, target_days: 30,
        };
        lsSave(LS_TRACKS, [ut]);
        setTracks([ut]);
        localStorage.removeItem("forge-pending-track");
        setFirstDayReveal({ track: ut, userName: displayName });

        // Save to Supabase
        if (uid) {
          db.saveProfile(uid, displayName).catch(() => {});
          db.saveTracks(uid, [ut]).catch(() => {});
        }
      } else if (uid) {
        // No pending track — save profile only
        db.saveProfile(uid, displayName).catch(() => {});
      }
    });
    setScreen("dashboard");
  }, []);

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    [LS_USER, LS_TRACKS, LS_LOGS, LS_AUTH].forEach(k => localStorage.removeItem(k));
    setUser(null); setTracks([]); setLogs([]); setSupabaseId(null);
    setScreen("landing");
  }, []);
  const handleChangeTheme = useCallback(async (newTheme: string) => {
    localStorage.setItem('forge_island_theme', newTheme);
    localStorage.setItem('forge_island_theme_changed_at', String(Date.now()));
    setUser(u => u ? { ...u, islandTheme: newTheme } : u);
    if (supabaseId) {
      await supabase.from('profiles').update({ island_theme: newTheme }).eq('id', supabaseId);
    }
  }, [supabaseId]);

  // Handle auth state changes.
  // SIGNED_IN: fires after OAuth code exchange completes (may race with useEffect).
  // INITIAL_SESSION: fires immediately when listener is registered — catches the case
  //   where Supabase already processed the OAuth code before useEffect ran.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) {
        const uid = session.user.id;
        setSupabaseId(uid);

        // Try to load from Supabase first
        db.loadUserData(uid).then(({ profile, tracks: dbTracks, logs: dbLogs }) => {
          const localUser = lsLoad<ElevateUser | null>(LS_USER, null);
          const localTracks = lsLoad<UserTrack[]>(LS_TRACKS, []);
          const localLogs = lsLoad<Log[]>(LS_LOGS, []);

          if (profile && dbTracks.length > 0) {
            // ── Supabase has data: use it as source of truth ──
            const restoredUser: ElevateUser = {
              name: profile.name,
              createdAt: profile.created_at,
              subscriptionStatus: (profile as any).subscription_status ?? null,
              islandTheme: (profile as any).island_theme ?? null,
              supabaseId: uid,
            };
            lsSave(LS_USER, restoredUser);
              const dbTheme = (profile as any).island_theme;
              if (dbTheme) {
                localStorage.setItem('forge_island_theme', dbTheme);
              } else {
                const lsTheme = localStorage.getItem('forge_island_theme') || 'garden';
                supabase.from('profiles').update({ island_theme: lsTheme }).eq('id', uid);
              }
            lsSave(LS_TRACKS, dbTracks);
            lsSave(LS_LOGS, dbLogs);
            setUser(restoredUser);
            setTracks(dbTracks as UserTrack[]);
            setLogs(dbLogs as Log[]);
            setScreen("dashboard");
          } else if (localUser) {
            // ── No Supabase data but have localStorage: migrate up ──
            db.migrateFromLocalStorage(
              uid, localUser, localTracks, localLogs,
              (slug) => lsLoad<JourneyDay[]>(LS_DAYS(slug), []),
              (slug) => {
                const j = lsLoad<Journey | null>(LS_JOURNEY(slug), null);
                return j;
              }
            ).catch(() => {});
            const merged = { ...localUser, supabaseId: uid };
            lsSave(LS_USER, merged);
            setUser(merged);
            setScreen("dashboard");
          } else {
            // ── Brand new user ──
            setScreen("login");
          }
        }).catch(() => {
          // Network error: fall back to localStorage
          const existingUser = lsLoad<ElevateUser | null>(LS_USER, null);
          if (existingUser) setScreen("dashboard");
          else setScreen("login");
        });
      }
      if (event === "SIGNED_OUT") {
        setSupabaseId(null);
        setScreen("landing");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Morning coach / re-entry: show once per day
  useEffect(() => {
    if (screen !== "dashboard" || tracks.length === 0) return;
    const key = `forge-morning-${todayStr()}`;
    if (lsLoad<boolean>(key, false)) return;
    const maxGap = Math.max(...tracks.map(ut => {
      if (!ut.last_log_date) return 0;
      return Math.floor((Date.now() - new Date(ut.last_log_date).getTime()) / 86_400_000);
    }));
    const timer = setTimeout(() => {
      if (maxGap >= 3) { setReEntryGap(maxGap); setShowReEntry(true); }
      else setShowMorningCoach(true);
    }, 900);
    return () => clearTimeout(timer);
  }, [screen, tracks.length]);

  const handleMorningDismiss = useCallback(() => {
    lsSave(`forge-morning-${todayStr()}`, true);
    setShowMorningCoach(false);
  }, []);

  const handleReEntryDismiss = useCallback(() => {
    lsSave(`forge-morning-${todayStr()}`, true);
    setShowReEntry(false);
  }, []);

  // Detect broken streaks — show StreakRecoveryOverlay once per break event
  useEffect(() => {
    if (screen !== "dashboard" || tracks.length === 0) return;
    const y = yesterdayStr();
    const t = todayStr();
    for (const tr of tracks) {
      if (!tr.last_log_date) continue;
      if (tr.last_log_date === t || tr.last_log_date === y) continue;
      const streak = tr.current_streak || 0;
      if (streak < 2) continue;
      const key = `forge-streak-recovery-${tr.id}-${tr.last_log_date}`;
      if (lsLoad<boolean>(key, false)) continue;
      lsSave(key, true);
      setStreakRecovery({ brokenStreak: streak, trackName: tr.name });
      break;
    }
  }, [screen, tracks]);

  // Re-engagement check — show overlay if user was active but missed 3+ days
  useEffect(() => {
    if (tracks.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const alreadyShown = lsLoad<string>("forge-reengagement-shown", "");
    if (alreadyShown === today) return;
    const dormant = tracks.find(t => {
      if (!t.last_log_date || t.total_done === 0) return false;
      if (t.vacation_until && t.vacation_until >= today) return false;
      const daysMissed = Math.floor((Date.now() - new Date(t.last_log_date).getTime()) / 864e5);
      return daysMissed >= 3;
    });
    if (!dormant) return;
    const daysMissed = Math.floor((Date.now() - new Date(dormant.last_log_date!).getTime()) / 864e5);
    lsSave("forge-reengagement-shown", today);
    setTimeout(() => setReengagement({ daysMissed, trackName: dormant.name }), 1200);
  }, [tracks]);

  // Notification reminder check — every minute
  useEffect(() => {
    if (!("Notification" in window)) return;
    const interval = setInterval(() => {
      if (!lsLoad<boolean>("forge-reminder-on", false)) return;
      if (Notification.permission !== "granted") return;
      const time = lsLoad<string>("forge-reminder-time", "21:00");
      const now = new Date();
      const [h, m] = time.split(":").map(Number);
      if (now.getHours() !== h || now.getMinutes() !== m) return;
      const t = todayStr();
      const allDone = tracks.every(tr => tr.last_log_date === t);
      if (allDone) return;
      const sentKey = `forge-notif-sent-${t}`;
      if (lsLoad<boolean>(sentKey, false)) return;
      lsSave(sentKey, true);
      new Notification("Forge", { body: "You haven't checked in yet today. Your streak is waiting." });
    }, 60_000);
    return () => clearInterval(interval);
  }, [tracks]);

  if (screen === "landing") return <LandingPage onBegin={() => setScreen("onboarding")} />;
  if (screen === "onboarding") return <OnboardingPage onComplete={handleOnboardingComplete} />;
  if (screen === "login") return (
    <LoginPage
      onSuccess={handleLoginSuccess}
      onBack={() => setScreen("onboarding")}
    />
  );

  // Re-engagement overlay
  if (reengagement) return (
    <AnimatePresence>
      <motion.div key="reengagement" className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
        style={{ background: "oklch(0.08 0.02 260 / 0.97)" }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.div className="text-center max-w-sm space-y-5 w-full"
          initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 80, damping: 14, delay: 0.1 }}>
          <div className="text-5xl">👋</div>
          <div>
            <p className="font-display text-3xl font-bold text-white tracking-tight leading-tight mb-2">
              Welcome back.
            </p>
            <p className="text-white/50 text-sm leading-relaxed">
              {reengagement.daysMissed === 1
                ? `You missed yesterday on ${reengagement.trackName}.`
                : `You've been away for ${reengagement.daysMissed} days.`}
              <br />That's okay. The path is still here.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left space-y-2">
            <p className="text-[10px] uppercase tracking-[0.2em] font-mono text-white/30">What helps</p>
            <p className="text-white/70 text-sm leading-relaxed">
              {reengagement.daysMissed >= 7
                ? "Start with one minute. Seriously — open your journey, read today's task, and just begin. That's the whole job."
                : reengagement.daysMissed >= 3
                ? "Three days off doesn't erase what you built. Your identity is still there. One check-in and you're back."
                : "Missing a day happens to everyone. The only mistake is letting one miss become two."}
            </p>
          </div>
          <div className="space-y-2 w-full">
            <button
              onClick={() => { setReengagement(null); setPage("home"); }}
              className="w-full btn-chunk rounded-full bg-white text-black px-8 py-3 text-sm font-bold">
              Let's go →
            </button>
            <button
              onClick={() => setReengagement(null)}
              className="w-full text-white/30 text-xs py-2">
              Maybe later
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  if (trackCompletion) return (
    <AnimatePresence>
      <motion.div key="completion" className="fixed inset-0 z-50 flex flex-col items-center justify-center"
        style={{ background: "oklch(0.08 0.02 260 / 0.97)" }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.div className="text-center px-8 space-y-6"
          initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 90, damping: 14, delay: 0.1 }}>
          <p className="text-6xl">🏆</p>
          <p className="font-display text-4xl font-bold text-white tracking-tight leading-tight">
            Journey<br />Complete
          </p>
          <p className="text-white/60 text-sm max-w-xs mx-auto leading-relaxed">
            You finished <span className="text-white font-semibold">{trackCompletion.trackName}</span>.<br />
            That is real. You showed up every day.
          </p>
          <button onClick={() => setTrackCompletion(null)}
            className="btn-chunk rounded-full bg-white text-black px-8 py-3 text-sm font-bold">
            Continue
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  if (checkInCelebration) return (
    <AnimatePresence>
      <CheckInCelebration
        trackName={checkInCelebration.trackName}
        streak={checkInCelebration.streak}
        onDismiss={() => setCheckInCelebration(null)}
      />
    </AnimatePresence>
  );

  if (firstDayReveal) return (
    <FirstDayReveal
      userName={firstDayReveal.userName}
      track={firstDayReveal.track}
      onComplete={() => {
        // Update the track's targetDays from what was chosen in the duration phase
        const savedDays = lsLoad<number>("forge-track-target-days-" + firstDayReveal.track.slug, 30);
        setTracks(prev => {
          const next = prev.map(t => t.id === firstDayReveal.track.id ? { ...t, target_days: savedDays } : t);
          lsSave(LS_TRACKS, next);
          return next;
        });
        setFirstDayReveal(null);
      }}
    />
  );

  if (selectedTrack) {
    return (
      <TrackDetailPage
        track={selectedTrack}
        onBack={handleTrackBack}
        showCheckInHint={pendingCheckIn}
        onTrackCheckIn={() => { checkIn(selectedTrack.id); setPendingCheckIn(false); }}
        onVacation={setVacation}
        onRestart={restartTrack}
        userId={supabaseId}
      />
    );
  }

  return (
    <>
      <AnimatePresence>
        {milestone && (
          <MilestoneOverlay days={milestone.days} trackName={milestone.trackName} onDismiss={() => setMilestone(null)} />
        )}
        {cert !== null && (
          <CertModal streak={cert} tracks={tracks} islandTheme={user?.islandTheme ?? 'garden'} userName={user?.name ?? 'Forger'} onDismiss={() => setCert(null)} />
        )}
        {!milestone && showReEntry && (
          <ReEntryOverlay gapDays={reEntryGap} onDismiss={handleReEntryDismiss} />
        )}
                      {showSOS && <SOSOverlay tracks={tracks} onDismiss={() => setShowSOS(false)} />}
              <SOSButton onClick={() => setShowSOS(true)} />
              {!milestone && showMorningCoach && (
          <MorningCoachOverlay tracks={tracks} onDismiss={handleMorningDismiss} />
        )}
        {!milestone && !showReEntry && !showMorningCoach && streakRecovery && (
          <StreakRecoveryOverlay
            brokenStreak={streakRecovery.brokenStreak}
            trackName={streakRecovery.trackName}
            onDismiss={() => setStreakRecovery(null)}
          />
        )}
      </AnimatePresence>
      {showInstallBanner && (
        <motion.div className="fixed bottom-20 left-4 right-4 z-40 rounded-2xl bg-muted border border-border p-4 flex items-center gap-3 shadow-2xl"
          initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}>
          <div className="flex-1">
            <p className="text-sm font-semibold">Add Forge to Home Screen</p>
            <p className="text-xs text-muted-foreground">Install for the full experience — works offline too</p>
          </div>
          <button onClick={() => {
            (installPrompt as BeforeInstallPromptEvent)?.prompt?.();
            setShowInstallBanner(false);
          }} className="btn-chunk rounded-xl bg-foreground text-neutral-900 px-4 py-2 text-xs font-semibold">
            Install
          </button>
          <button onClick={() => setShowInstallBanner(false)} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
        </motion.div>
      )}
      <DashboardLayout currentPage={page} onNavigate={setPage}>
        {page === "home" && (
          <HomePage user={user!} tracks={tracks} onCheckIn={checkIn} onNavigate={setPage} onUpdateUser={updateUser} onView={setSelectedTrack} onViewForCheckIn={handleViewForCheckIn} onVacation={setVacation} />
        )}
        {page === "tracks" && <TracksPage userTracks={tracks} onAdd={(t, days) => addTrack(t, days)} onView={setSelectedTrack} onRemove={removeTrack} />}
        {page === "insights" && <InsightsPage userTracks={tracks} logs={logs} />}
        {page === "settings" && <SettingsPage userName={user?.name ?? ""} onSignOut={handleSignOut} onUpdateName={name => updateUser({ name })}  islandTheme={user?.islandTheme ?? 'garden'} onChangeTheme={handleChangeTheme} shields={shields} tracks={tracks}/>}
      </DashboardLayout>
    </>
  );
}

