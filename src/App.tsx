// Complete self-contained Forge app — localStorage persistence, no backend.

import { useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Eye, Check, Plus, Home, Layers, BarChart3, Settings,
  Sparkles, Flame, Sun, Moon, User as UserIcon, Trophy, CheckCircle2,
  Zap, AlertTriangle, Crown, Mail, Phone, ChevronLeft, Search,
  Database, Download, Bell, Target, Lock, PenLine,
} from "lucide-react";
import confetti from "canvas-confetti";
import { supabase } from "./supabase";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Screen = "landing" | "login" | "onboarding" | "dashboard";
type AppPage = "home" | "tracks" | "insights" | "settings";

interface ElevateUser {
  name: string;
  createdAt: string;
  peakReachedAt?: string | null;
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
  { id: "19", slug: "no-smartphone",       name: "No Smartphone",        category: "Quit Bad Habits",     short_description: "Reclaim your attention from your phone." },
  { id: "20", slug: "no-sugar",            name: "No Sugar",             category: "Quit Bad Habits",     short_description: "End sugar dependency for good." },
  { id: "21", slug: "lack-of-self-control",name: "Lack of Self-Control", category: "Quit Bad Habits",     short_description: "Build impulse control from the ground up." },
  // ── Productivity & Life ─────────────────────────────────────────────────────
  { id: "22", slug: "beat-procrastination",name: "Beat Procrastination", category: "Productivity & Life", short_description: "Act before the voice says 'later'." },
  { id: "23", slug: "build-discipline",    name: "Build Discipline",     category: "Productivity & Life", short_description: "The daily reps that form an identity." },
  { id: "24", slug: "lack-of-motivation",  name: "Lack of Motivation",   category: "Productivity & Life", short_description: "Reignite your drive from the inside out." },
  { id: "25", slug: "chronic-laziness",    name: "Chronic Laziness",     category: "Productivity & Life", short_description: "Dissolve inertia through micro-actions." },
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
  { id: "40", slug: "narcissism",          name: "Narcissism",           category: "Psychology & Self",   short_description: "Cultivate empathy and genuine connection." },
  { id: "41", slug: "victim-mentality",    name: "Victim Mentality",     category: "Psychology & Self",   short_description: "Reclaim agency over your story." },
  { id: "42", slug: "stop-self-sabotage",  name: "Stop Self-Sabotage",   category: "Psychology & Self",   short_description: "Interrupt the patterns that hold you back." },
  { id: "43", slug: "lust-control",        name: "Lust Control",         category: "Psychology & Self",   short_description: "Channel sexual energy with intention." },
  { id: "44", slug: "toxic-perfectionism", name: "Toxic Perfectionism",  category: "Psychology & Self",   short_description: "Done beats perfect, every single time." },
  { id: "45", slug: "jealousy",            name: "Jealousy",             category: "Psychology & Self",   short_description: "Transform jealousy into self-awareness." },
  { id: "46", slug: "envy",               name: "Envy",                 category: "Psychology & Self",   short_description: "Use envy as a compass, not a prison." },
  // ── Financial Health ─────────────────────────────────────────────────────────
  { id: "47", slug: "money-management",    name: "Money Management",     category: "Financial Health",    short_description: "Build financial clarity and control." },
  { id: "48", slug: "impulsive-spending",  name: "Impulsive Spending",   category: "Financial Health",    short_description: "Pause before you purchase." },
  // ── Mind & Learning ──────────────────────────────────────────────────────────
  { id: "49", slug: "sedentary-lifestyle", name: "Sedentary Lifestyle",  category: "Fitness & Body",      short_description: "Move a little every day, forever." },
  { id: "50", slug: "gratitude",           name: "Gratitude Practice",   category: "Mind & Learning",     short_description: "Rewire your brain for abundance." },
];


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
  "no-social-media": "trainer", "quit-smoking": "trainer", "no-smartphone": "trainer",
  "no-sugar": "trainer", "lack-of-self-control": "trainer",
  // Addiction & Recovery
  "quit-alcohol": "trainer", "video-game-addiction": "trainer",
  "compulsive-shopping": "mentor", "impulsive-spending": "mentor",
  "quit-pornography": "clinician", "quit-drugs": "clinician",
  "quit-gambling": "mentor", "binge-eating": "clinician",
  // Mental Health
  "meditation": "clinician", "anxiety-relief": "clinician", "journaling": "clinician",
  "sleep-routine": "clinician", "breathwork": "clinician",
  "stop-overthinking": "clinician", "social-anxiety": "clinician",
  "anger-management": "clinician", "chronic-stress": "clinician",
  "social-isolation": "guide", "negative-mindset": "guide",
  // Productivity & Life
  "deep-work": "mentor", "beat-procrastination": "trainer",
  "build-discipline": "trainer", "lack-of-motivation": "guide",
  "chronic-laziness": "trainer",
  // Psychology & Self
  "low-self-esteem": "clinician", "need-for-approval": "clinician",
  "fear-of-failure": "mentor", "fear-of-judgment": "clinician",
  "emotional-dependency": "clinician", "toxic-relationships": "mentor",
  "control-issues": "mentor", "narcissism": "mentor",
  "victim-mentality": "mentor", "stop-self-sabotage": "guide",
  "lust-control": "clinician", "toxic-perfectionism": "clinician",
  "jealousy": "clinician", "envy": "clinician",
  // Financial Health
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
  "no-smartphone":        "47% of people report feeling addicted to their smartphone",
  "no-sugar":             "50% of people struggle to reduce sugar consumption",
  "lack-of-self-control": "37% of people report poor impulse control",
  "beat-procrastination": "20% of adults are chronic procrastinators",
  "build-discipline":     "41% say lack of discipline is their #1 challenge",
  "lack-of-motivation":   "45% of people struggle with persistent lack of motivation",
  "chronic-laziness":     "41% report chronic low energy and motivation",
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
  "narcissism":           "6% of people show significant narcissistic personality traits",
  "victim-mentality":     "22% of people consistently adopt a victim mindset",
  "stop-self-sabotage":   "33% of people identify as self-sabotagers",
  "lust-control":         "14% of people struggle with compulsive sexual thoughts",
  "toxic-perfectionism":  "29% of people suffer from maladaptive perfectionism",
  "jealousy":             "22% of people report chronic jealousy in relationships",
  "envy":                 "28% of people regularly experience debilitating envy",
  "money-management":     "63% of adults live paycheck to paycheck",
  "impulsive-spending":   "18% of people struggle with compulsive spending",
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
  { slug: "no-smartphone",       keywords: ["phone","smartphone","telefono","cellulare","schermo","screen time","phone addiction","dipendenza telefono","device"] },
  { slug: "no-sugar",            keywords: ["sugar","zucchero","dolci","sweets","candy","caramel","cioccolato","chocolate","junk food","dessert","zuccheri"] },
  { slug: "binge-eating",        keywords: ["binge","overeating","abbuffate","compulsive eat","mangio troppo","cibo","food compuls","eating disorder"] },
  { slug: "compulsive-shopping", keywords: ["shopping compuls","comprare compuls","acquisti compuls","shop addict","acquisti","buy too much"] },
  { slug: "impulsive-spending",  keywords: ["spend","spending","soldi","debt","debito","spendere","impulse buy","acquisto impuls","financial","broke"] },
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
  { slug: "narcissism",          keywords: ["narciss","ego","self-centered","egocentrico","arrogant","arrogante","empathy","empatia","grandiosity"] },
  { slug: "victim-mentality",    keywords: ["victim","vittima","blame","colpa","fault","responsib","victim mindset","always my fault","è sempre colpa"] },
  { slug: "stop-self-sabotage",  keywords: ["self-sabotage","autosabotaggio","sabotage","sabotare","self-destruct","pattern","destroy what i build","rovino tutto"] },
  { slug: "lack-of-motivation",  keywords: ["motivat","motivazione","energy","energia","lazy","pigro","no drive","no energy","non ho voglia","demotivat"] },
  { slug: "money-management",    keywords: ["money","soldi","financial","finanziario","budget","debt","debito","saving","risparmio","broke","spendo tutto"] },
  { slug: "lust-control",        keywords: ["lust","lussuria","sex addict","sesso compuls","sexual","sessuale","desire compuls","obsessed with sex","ossessionato dal sesso"] },
  { slug: "toxic-perfectionism", keywords: ["perfect","perfetto","perfectionism","perfezionismo","perfectionist","perfezionista","never good enough","mai abbastanza"] },
  { slug: "social-isolation",    keywords: ["lonely","solo","solitudine","loneliness","isolated","isolato","connection","connessione","no friends","senza amici","withdraw"] },
  { slug: "video-game-addiction",keywords: ["video game","videogiochi","gaming","giochi","gamer","game addict","gioco troppo","console","twitch","esport","online game"] },
  { slug: "lack-of-self-control",keywords: ["self-control","autocontrollo","impulse","impulso","impulsive","impulsivo","no control","nessun controllo","can't stop"] },
  { slug: "negative-mindset",    keywords: ["negative","negativo","pessimist","pessimista","mindset","mentalità","always negative","sempre negativo","dark thoughts"] },
  { slug: "sedentary-lifestyle", keywords: ["sedentary","sedentario","inactive","inattivo","sit all day","never move","non mi muovo","couch","divano","exercise"] },
  { slug: "chronic-laziness",    keywords: ["lazy","pigro","laziness","pigrizia","tired","stanco","no energy","inertia","inerzia","can't get up","non riesco ad alzarmi"] },
  { slug: "jealousy",            keywords: ["jealous","geloso","jealousy","gelosia","partner jealous","relazione","possessive","possessivo","gelosia partner"] },
  { slug: "envy",                keywords: ["envy","invidia","envious","invidioso","compare","confronto","others have more","gli altri hanno di più","coveting"] },
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
  "lack-of-motivation", "low-self-esteem", "chronic-stress",
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
  if (t.length < 10) return "Scrivi almeno qualche parola prima di inviare.";
  if (/^(.)\1{5,}$/.test(t)) return "Sembra che tu stia scherzando — scrivi davvero!";
  if (/^[\d\s\W]+$/.test(t)) return "Scrivi qualcosa di reale, anche una frase breve.";
  if (t.length > 6 && !/[aeiouàèéìòùAEIOUÀÈÉÌÒÙ]/u.test(t))
    return "Scrivi una risposta vera — anche due parole bastano.";
  if (QUICK_NOTE_BANNED.some(w => t.toLowerCase().includes(w)))
    return "Scegli parole migliori per il tuo check-in.";
  return null;
}

function computeMomentum(tracks: UserTrack[]) {
  const t = todayStr();
  const totalStreak = tracks.reduce((s, x) => s + liveStreak(x), 0);
  const totalLongest = tracks.reduce((s, x) => s + (x.longest_streak || 0), 0);
  const breadth = tracks.filter(x => (x.total_done || 0) > 0).length;
  const todayDone = tracks.filter(x => x.last_log_date === t).length;
  const consistency = Math.min(400, totalStreak * 5);
  const longevity = Math.min(200, totalLongest * 2);
  const breadthScore = Math.min(150, breadth * 30);
  const todayScore = breadth === 0 ? 0 : Math.round((todayDone / breadth) * 250);
  const score = consistency + longevity + breadthScore + todayScore;
  return { score: Math.max(0, Math.min(1000, score)), consistency, longevity, breadth: breadthScore, today: todayScore };
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
    <svg width={size} height={size} className="-rotate-90">
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
  const pct = m.score / 1000;
  const isMaxed = m.score >= 1000;
  const hasPeakBadge = !!user.peakReachedAt;

  useEffect(() => {
    if (!isMaxed || hasPeakBadge) return;
    onUpdateUser({ peakReachedAt: new Date().toISOString() });
    const gold = ["#FFD000", "#FFB347", "#FFE680", "#F5C518", "#FFFFFF"];
    const burst = (originX: number) =>
      confetti({ particleCount: 90, spread: 75, startVelocity: 45, gravity: 0.9, ticks: 220, origin: { x: originX, y: 0.35 }, colors: gold, scalar: 1.05 });
    burst(0.25);
    setTimeout(() => burst(0.75), 180);
    setTimeout(() => confetti({ particleCount: 140, spread: 120, startVelocity: 35, origin: { x: 0.5, y: 0.4 }, colors: gold }), 360);
  }, [isMaxed, hasPeakBadge, onUpdateUser]);

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
                stroke={isMaxed ? "oklch(0.92 0.18 88)" : "oklch(0.83 0.22 88)"}
                strokeWidth={stroke} strokeLinecap="round" fill="none"
                strokeDasharray={c}
                initial={{ strokeDashoffset: c }}
                animate={{ strokeDashoffset: c - c * pct }}
                transition={{ type: "spring", stiffness: 50, damping: 18 }}
                style={{  }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground font-mono">Momentum</p>
              <p className="font-display text-[3.25rem] leading-none text-foreground num-rise">{animated}</p>
              <p className="text-[10px] text-muted-foreground font-mono">/ 1000</p>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
              {isMaxed ? (
                <span className="peak-badge inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.2em] font-bold">
                  <Crown className="h-3 w-3" /> Maxed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground text-background px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.2em]">
                  <Sparkles className="h-3 w-3" /> {evo.label}
                </span>
              )}
              {hasPeakBadge && (
                <span className="peak-badge inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.2em] font-bold"
                  title={`Peak reached ${new Date(user.peakReachedAt!).toLocaleDateString()}`}>
                  <Crown className="h-2.5 w-2.5" /> 1000 Club
                </span>
              )}
            </div>
            <h2 className="font-display text-2xl leading-tight tracking-tight">
              {isMaxed
                ? "Peak momentum. Hold the line."
                : m.score >= 700 ? "You're on fire."
                : m.score >= 400 ? "Momentum is building."
                : m.score >= 150 ? "You've started. Don't stop."
                : "Today is day one."}
            </h2>
            {!isMaxed && evo.next && (
              <p className="mt-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{evo.daysToNext}</span> day{evo.daysToNext === 1 ? "" : "s"} to{" "}
                <span className="font-semibold text-foreground">{evolutionFor(evo.next).label}</span>
              </p>
            )}
            <div className="mt-3 grid grid-cols-4 gap-1.5">
              <Meter label="Today" v={m.today} max={250} />
              <Meter label="Streak" v={m.consistency} max={400} />
              <Meter label="Depth" v={m.longevity} max={200} />
              <Meter label="Breadth" v={m.breadth} max={150} />
            </div>
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
  const [enteredName, setEnteredName] = useState("");

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
    if (digits.length < 8) { setPhoneError("Inserisci un numero valido"); return; }
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
        <ChevronLeft className="h-4 w-4" /> Indietro
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
                <h1 className="font-display text-2xl font-bold tracking-tight">Quasi fatto</h1>
                <p className="text-sm text-muted-foreground mt-1 mb-6">Salva il tuo percorso. Inizia il Day 1.</p>

                <div className="space-y-3">
                  <button onClick={handleGoogle} disabled={!!loading} className={btnSecondary}>
                    {loading === "google" ? <Spinner /> : <><GoogleIcon /> Continua con Google</>}
                  </button>
                  {authError && <p className="text-xs text-red-400 text-center mt-1">{authError}</p>}
                </div>

                <div className="my-5 flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[11px] text-muted-foreground font-mono uppercase tracking-widest">o</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <button onClick={() => setMode("phone")} disabled={!!loading} className={btnSecondary}>
                  <Phone className="h-4 w-4 text-muted-foreground" /> Continua con il telefono
                </button>
              </motion.div>
            )}

            {mode === "phone" && (
              <motion.div key="phone" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}>
                <button onClick={() => setMode("options")} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors">
                  <ChevronLeft className="h-4 w-4" /> Indietro
                </button>
                <h1 className="font-display text-2xl font-bold tracking-tight">Il tuo numero</h1>
                <p className="text-sm text-muted-foreground mt-1 mb-6">Ti mandiamo un codice via SMS.</p>
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
                    {loading === "phone-send" ? <Spinner light /> : "Invia codice →"}
                  </button>
                </div>
              </motion.div>
            )}

            {mode === "otp" && (
              <motion.div key="otp" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}>
                <h1 className="font-display text-2xl font-bold tracking-tight">Inserisci il codice</h1>
                <p className="text-sm text-muted-foreground mt-1 mb-6">Inviato al {phone}.</p>
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
                    {loading === "phone" ? <Spinner light /> : "Verifica →"}
                  </button>
                  <p className="text-xs text-center text-muted-foreground">
                    Non è arrivato?{" "}
                    <button onClick={() => { setOtp(["","","","","",""]); setMode("phone"); }} className="underline hover:text-foreground transition-colors">
                      Riprova
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
                  <h1 className="font-display text-2xl font-bold tracking-tight">Come ti chiami?</h1>
                  <p className="text-sm text-muted-foreground mt-1">Il tuo coach ti chiamerà così ogni giorno.</p>
                </div>
                <div className="space-y-3">
                  <input
                    type="text" value={enteredName} autoFocus
                    onChange={e => setEnteredName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && enteredName.trim().length > 0 && onSuccess(enteredName.trim())}
                    placeholder="Il tuo nome"
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring transition text-center font-display text-lg"
                  />
                  <button
                    onClick={() => enteredName.trim().length > 0 && onSuccess(enteredName.trim())}
                    disabled={enteredName.trim().length === 0}
                    className={btnPrimary}>
                    Inizia il Day 1 →
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        <p className="mt-4 text-center text-[11px] text-muted-foreground leading-relaxed">
          Continuando accetti i nostri{" "}
          <span className="underline cursor-pointer hover:text-foreground transition-colors">Termini</span>
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

type OnboardingStep = "question" | "thinking" | "response" | "tracks";

function OnboardingPage({ onComplete }: { onComplete: (data: { track: OnboardingTrack }) => void }) {
  const [step, setStep] = useState<OnboardingStep>("question");
  const [showAllPaths, setShowAllPaths] = useState(false);
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState("");
  const [typedCount, setTypedCount] = useState(0);
  const [chosen, setChosen] = useState<OnboardingTrack | null>(null);
  const [suggestedSlug, setSuggestedSlug] = useState<string | null>(null);

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
                    <div aria-hidden className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full opacity-30"
                      style={{ background: "radial-gradient(circle, oklch(0.875 0.185 95 / 0.5), transparent 70%)" }} />
                    <p className="text-[10px] uppercase tracking-[0.3em] text-yellow-400 font-mono mb-3">{sug.category}</p>
                    <h3 className="font-display text-4xl font-bold mb-4">{sug.name}</h3>
                    {TRACK_GLOBAL_STATS[sug.slug] && (
                      <p className="text-sm text-muted-foreground leading-relaxed mb-6 max-w-sm mx-auto">
                        {TRACK_GLOBAL_STATS[sug.slug]}.<br />
                        <span className="text-yellow-400 font-medium">You're not alone in this.</span>
                      </p>
                    )}
                    <button onClick={() => onComplete({ track: sug })}
                      className="btn-chunk w-full inline-flex items-center justify-center gap-2 rounded-full grad-electric text-white py-4 font-bold text-sm shadow-[var(--shadow-violet)]">
                      Questo è il mio percorso <ArrowRight className="h-4 w-4" />
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
                    <button onClick={() => onComplete({ track: chosen })}
                      className="btn-chunk inline-flex items-center gap-2 rounded-full grad-electric text-white px-9 py-4 text-sm font-bold shadow-[var(--shadow-violet)]">
                      Questo è il mio percorso <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </motion.div>
            )}

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
  "Sei tornato. È tutto quello che conta.",
  "Il gap non definisce il percorso. Sei qui ora.",
  "I migliori non si arrendono — si ripartono. Ricominciamo.",
  "Ogni grande storia ha un capitolo in cui il protagonista rientra. Questo è il tuo.",
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
          Bentornato — {gapDays} giorni dopo
        </motion.p>
        <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="font-display text-[2rem] leading-[1.2] tracking-[-0.02em] text-foreground mb-10">
          {msg}
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
          <button onClick={onDismiss}
            className="btn-chunk inline-flex items-center gap-2 rounded-full bg-foreground text-background px-8 py-3 text-sm font-semibold">
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
      style={{ background: "oklch(0 0 0 / 0.65)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="w-full max-w-sm rounded-3xl bg-card border border-border p-6"
        onClick={e => e.stopPropagation()}>
        <p className="text-[10px] uppercase tracking-[0.3em] font-mono text-muted-foreground mb-2">Vacation mode</p>
        <h3 className="font-display text-xl mb-1">Proteggi la tua streak</h3>
        <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
          Se sei in viaggio o non puoi accedere, metti in pausa. La streak non si azzera.
        </p>
        {isActive ? (
          <>
            <div className="rounded-2xl bg-[color:var(--tertiary)]/10 border border-[color:var(--tertiary)]/20 p-4 mb-4 text-center">
              <p className="text-sm font-semibold text-[color:var(--tertiary)]">Pausa attiva fino al {track.vacation_until}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 rounded-full border border-border px-4 py-2.5 text-sm font-medium">Chiudi</button>
              <button onClick={() => { onSave(""); onClose(); }}
                className="flex-1 btn-chunk rounded-full bg-[color:var(--secondary)] text-white px-4 py-2.5 text-sm font-semibold">
                Termina pausa
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Quick presets */}
            <div className="flex gap-2 mb-3">
              {[3, 7, 14].map(d => (
                <button key={d} onClick={() => { setDays(d); setCustomDays(""); }}
                  className={`flex-1 rounded-xl border py-3 text-sm font-semibold transition btn-chunk ${customDays === "" && days === d ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
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
                placeholder="Giorni personalizzati…"
                className="flex-1 rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-foreground/30 transition"
              />
              {customDays !== "" && <span className="text-xs text-muted-foreground font-mono shrink-0">giorni</span>}
            </div>
            <p className="text-xs text-muted-foreground text-center mb-5 font-mono">
              Streak protetta fino al <span className="text-foreground">{until}</span>
            </p>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 rounded-full border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground">Annulla</button>
              <button onClick={() => { onSave(until); onClose(); }}
                className="flex-1 btn-chunk rounded-full bg-foreground text-background px-4 py-2.5 text-sm font-semibold">
                Attiva pausa
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
        className="w-full max-w-sm rounded-3xl bg-card border border-border p-6"
      >
        {phase === "done" ? (
          <div className="text-center py-4">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-[color:var(--tertiary)]/15 flex items-center justify-center">
              <Check className="h-6 w-6 text-[color:var(--tertiary)]" />
            </div>
            <p className="font-display text-lg mb-1">Grazie.</p>
            <p className="text-sm text-muted-foreground">Prenderemo in considerazione il tuo feedback.</p>
            <button onClick={onClose} className="mt-5 btn-chunk rounded-full bg-foreground text-background px-6 py-2.5 text-sm font-semibold">
              Chiudi
            </button>
          </div>
        ) : (
          <>
            <p className="text-[10px] uppercase tracking-[0.3em] font-mono text-muted-foreground mb-2">Feedback</p>
            <h3 className="font-display text-xl mb-1">Non hai potuto accedere?</h3>
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
              placeholder="Es. non avevo connessione, l'app non si apriva..."
              rows={3}
              className="w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground resize-none mb-4"
            />

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 rounded-full border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition">
                Annulla
              </button>
              <button
                onClick={submit}
                disabled={!message.trim() || phase === "sending"}
                className="flex-1 btn-chunk rounded-full bg-foreground text-background px-4 py-2.5 text-sm font-semibold disabled:opacity-40 transition"
              >
                {phase === "sending" ? "Invio..." : "Invia"}
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
                className="btn-chunk inline-flex items-center gap-2 rounded-full bg-foreground text-background px-8 py-3 text-sm font-semibold"
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
  1:   { emoji: "🌱", title: "Day 1 completato.", sub: "Il viaggio comincia adesso." },
  3:   { emoji: "🔥", title: "3 giorni di fila.", sub: "Stai costruendo qualcosa di reale." },
  7:   { emoji: "⚡", title: "Una settimana intera.", sub: "7 giorni di fila. Non è poco." },
  14:  { emoji: "💎", title: "Due settimane.", sub: "Stai diventando questa persona." },
  30:  { emoji: "🏆", title: "30 giorni.", sub: "Un mese. Un'abitudine vera." },
  66:  { emoji: "🧬", title: "66 giorni.", sub: "La scienza dice che è ora nella tua natura." },
  100: { emoji: "👑", title: "100 giorni.", sub: "Tre cifre. Pochi arrivano qui." },
  365: { emoji: "🌟", title: "Un anno intero.", sub: "Sei irriconoscibile rispetto a chi eri." },
};

function MilestoneOverlay({ days, trackName, onDismiss }: { days: number; trackName: string; onDismiss: () => void }) {
  const m = MILESTONE_MESSAGES[days] ?? { emoji: "🔥", title: `Day ${days}!`, sub: "Continua così." };
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
          Continua <ArrowRight className="h-4 w-4" />
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
  const todayFormatted = new Date().toLocaleDateString('it-IT', { weekday: "long", month: "long", day: "numeric" }).toUpperCase();
  const hour = new Date().getHours();
  const greeting = hour < 5 ? "È tardi" : hour < 12 ? "Buongiorno" : hour < 18 ? "Buon pomeriggio" : "Buonasera";
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
        <MomentumHero tracks={tracks} user={user} onUpdateUser={onUpdateUser} onCheckIn={onCheckIn} onView={onViewForCheckIn} />
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
            className="btn-chunk inline-flex items-center gap-2 rounded-full bg-foreground text-background px-6 py-2.5 text-sm font-semibold"
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
                      style={{ background: grad, boxShadow: "0 20px 44px -12px oklch(0 0 0 / 0.65), 0 4px 12px -4px oklch(0 0 0 / 0.4)" }}>
                      {/* Normal card content — blurred when frozen */}
                      <div className={onVacCard ? "blur-[2px] pointer-events-none" : ""}>
                        <div aria-hidden className="absolute -right-12 -bottom-12 h-56 w-56 rounded-full opacity-50 blur-2xl"
                          style={{ background: "radial-gradient(circle, oklch(1 0 0 / 0.5), transparent 60%)" }} />
                        <div aria-hidden className="absolute right-3 top-3 h-20 w-20 rounded-full opacity-70"
                          style={{ background: "radial-gradient(circle, oklch(1 0 0 / 0.35), transparent 70%)" }} />
                        <div className="relative flex items-start justify-between">
                          <span className="text-[10px] uppercase tracking-[0.25em] text-white font-mono">{ut.category}</span>
                          <ArcRing value={pct} color="oklch(1 0 0 / 0.85)" size={56} />
                        </div>
                        <div className="relative mt-auto pt-12">
                          <p className="text-[10px] uppercase tracking-[0.3em] text-white font-mono">Day</p>
                          <p className="font-display text-[5.5rem] leading-[0.85] tracking-[-0.05em] text-white">{liveStreak(ut) === 0 && (ut.total_done ?? 0) === 0 ? 1 : liveStreak(ut)}</p>
                          {(() => { const gd = ghostDayFor(ut); const gap = gd - (ut.total_done || 0); return gap > 1 ? (
                            <p className="mt-0.5 text-[9px] font-mono text-white/35 tracking-[0.15em] uppercase">Ghost +{gap}d ahead</p>
                          ) : null; })()}
                          <h3 className="mt-3 font-display text-xl text-white leading-tight line-clamp-2">{ut.name}</h3>
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            {liveStreak(ut) === 0 && !doneToday && (ut.total_done ?? 0) === 0 ? (
                              <button onClick={() => onView(ut)}
                                className="inline-flex items-center gap-1.5 rounded-full grad-electric px-3 py-1.5 text-[11px] font-bold text-white shadow-[var(--shadow-violet)] hover:opacity-90 transition-opacity">
                                Start Day 1 <ArrowRight className="h-3 w-3" />
                              </button>
                            ) : liveStreak(ut) === 0 && !doneToday && (ut.total_done ?? 0) > 0 ? (
                              <p className="text-[10px] font-mono text-white/45 leading-snug">
                                Nessun problema —<br />ricomincia quando vuoi.
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
                        title="Metti in pausa">
                        <Sun className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => toggleNote(ut.id)}
                        className={`rounded-full border px-2 py-2 text-xs transition btn-chunk ${noteOpen[ut.id] ? "border-foreground/30 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
                        title="Nota rapida">
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
                        title="Metti in pausa">
                        <Sun className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => toggleNote(ut.id)}
                        className={`rounded-full border px-2 py-2 text-xs transition btn-chunk ${noteOpen[ut.id] ? "border-foreground/30 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
                        title="Nota rapida">
                        <PenLine className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => onViewForCheckIn(ut)}
                        className="btn-chunk rounded-full bg-foreground text-background px-3.5 py-2 text-xs font-semibold transition"
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
                              placeholder="Racconta com'è andata oggi…"
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
                              Annulla
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
                              className="btn-chunk rounded-full bg-foreground text-background px-4 py-1.5 text-xs font-semibold transition hover:opacity-80">
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
            Non hai potuto accedere e hai perso la streak? Clicca qui
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

function CommunityBoard({ slug }: { slug: string }) {
  const [posts, setPosts] = useState<CommunityPost[]>(() => {
    const saved = lsLoad<CommunityPost[]>(LS_COMMUNITY(slug), []);
    if (saved.length > 0) return saved;
    const seeded = SEED_POSTS.map(p => ({ ...p, id: nanoid(), trackSlug: slug }));
    lsSave(LS_COMMUNITY(slug), seeded);
    return seeded;
  });
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [modWarnKey, setModWarnKey] = useState(0);
  const [modWarnMsg, setModWarnMsg] = useState("");

  const flame = (id: string) => {
    setPosts(prev => {
      const next = prev.map(p => p.id === id
        ? { ...p, flameCount: p.userHasFlamed ? p.flameCount - 1 : p.flameCount + 1, userHasFlamed: !p.userHasFlamed }
        : p);
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
    setTimeout(() => {
      const p: CommunityPost = { id: nanoid(), trackSlug: slug, content: draft.trim(), dayNumber: 0, flameCount: 0, userHasFlamed: false, createdAt: new Date().toISOString() };
      setPosts(prev => {
        const next = [p, ...prev];
        lsSave(LS_COMMUNITY(slug), next);
        return next;
      });
      setDraft("");
      setModWarnKey(0);
      setPosting(false);
    }, 300);
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
            className="btn-chunk rounded-xl bg-foreground text-background px-4 py-2 text-sm font-semibold disabled:opacity-40">
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

function JourneyOnboarding({ track, onStarted }: { track: UserTrack; onStarted: (j: Journey, days: JourneyDay[]) => void }) {
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
      const res = await fetch("/api/generate-days", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: track.slug, trackName: track.name, category: track.category, startingPoint, motivation, obstacle, fromDay: 1, count: 7 }),
      });
      if (!res.ok) throw new Error("API error");
      const { days } = await res.json() as { days: JourneyDay[] };
      const filled = days.map((d, i) => ({ ...d, id: nanoid(), journeyId: journey.id, dayNumber: i + 1, completedAt: null, userNote: null }));
      journey.generatedThrough = 7;
      lsSave(LS_JOURNEY(track.slug), journey);
      lsSave(LS_DAYS(track.slug), filled);
      onStarted(journey, filled);
    } catch {
      const fallback = makeFallback();
      journey.generatedThrough = 7;
      lsSave(LS_JOURNEY(track.slug), journey);
      lsSave(LS_DAYS(track.slug), fallback);
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
                  className={`btn-chunk rounded-xl py-2.5 text-sm font-semibold border transition ${!isCustomDays && totalDays === d ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>
                  {d === 365 ? "1 year" : `${d}d`}
                </button>
              ))}
            </div>
            <button onClick={() => { setIsCustomDays(true); setCustomDaysInput(String(totalDays)); }}
              className={`mt-2 w-full btn-chunk rounded-xl py-2.5 text-sm font-semibold border transition ${isCustomDays ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>
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
            className="btn-chunk w-full rounded-2xl bg-foreground text-background py-3.5 font-semibold text-base disabled:opacity-60 flex items-center justify-center gap-2">
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

function JourneyView({ track, journey: initJourney, days: initDays, onBack, showCheckInHint, onTrackCheckIn }: {
  track: UserTrack;
  journey: Journey;
  days: JourneyDay[];
  onBack: () => void;
  showCheckInHint?: boolean;
  onTrackCheckIn?: () => void;
}) {
  const [journey, setJourney] = useState(initJourney);
  const [days, setDays] = useState(initDays);
  const [activeTab, setActiveTab] = useState<"today" | "map" | "community" | "coach">("today");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => lsLoad<ChatMessage[]>(LS_CHAT(track.slug), []));
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
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
      fetch("/api/generate-days", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: track.slug, trackName: track.name, category: track.category, startingPoint: journey.startingPoint, motivation: journey.motivation, obstacle: journey.obstacle, fromDay, count }),
      }).then(r => r.ok ? r.json() : null).then((data: { days: JourneyDay[] } | null) => {
        if (!data) return;
        const filled = data.days.map((d, i) => ({ ...d, id: nanoid(), journeyId: journey.id, dayNumber: fromDay + i, completedAt: null, userNote: null }));
        setDays(prev => { const next = [...prev, ...filled]; lsSave(LS_DAYS(track.slug), next); return next; });
        const nextJourney = { ...journey, generatedThrough: fromDay + count - 1 };
        setJourney(nextJourney);
        lsSave(LS_JOURNEY(track.slug), nextJourney);
      }).catch(() => {});
    }
  }, [completedCount, journey, days.length, track]);

  const checkIn = (dayId: string, note: string) => {
    setDays(prev => {
      const next = prev.map(d => d.id === dayId ? { ...d, completedAt: new Date().toISOString(), userNote: note || null } : d);
      lsSave(LS_DAYS(track.slug), next);
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
          <div className="text-right">
            <p className="text-[10px] font-mono text-muted-foreground">{completedCount}/{journey.totalDays} days</p>
            <div className="mt-0.5 h-1 w-20 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${(completedCount / journey.totalDays) * 100}%` }} />
            </div>
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
                  className="btn-chunk w-full rounded-xl bg-foreground text-background py-2.5 font-semibold text-sm flex items-center justify-center gap-1.5">
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
                    : isCurrent ? "bg-foreground text-background"
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
            <CommunityBoard slug={track.slug} />
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
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {chatMessages.length === 0 && (
                <div className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
                  I'm here. What's on your mind today about your {track.name} journey?
                </div>
              )}
              {chatMessages.map(m => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.role === "user" ? "bg-foreground text-background" : "bg-muted"}`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl px-4 py-3 flex gap-1">
                    {[0, 1, 2].map(i => <span key={i} className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                  </div>
                </div>
              )}
            </div>
            <div className="sticky bottom-0 bg-background pt-2">
              <div className="flex gap-2">
                <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
                  placeholder="Ask your coach anything…"
                  className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
                <button onClick={sendChat} disabled={!chatInput.trim() || chatLoading}
                  className="btn-chunk rounded-xl bg-foreground text-background px-4 py-2 text-sm font-semibold disabled:opacity-40">
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
                className="btn-chunk w-full rounded-xl bg-foreground text-background py-3 font-semibold">
                Keep going
              </button>
              <button onClick={() => {
                const text = `Day ${milestoneDay} on ${track.name} with Forge. The streak continues. 🔥`;
                if (navigator.share) navigator.share({ text });
                else navigator.clipboard?.writeText(text);
              }} className="btn-chunk w-full rounded-xl border border-border py-2.5 text-sm text-muted-foreground hover:text-foreground transition">
                Condividi questo momento
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

function TrackDetailPage({ track, onBack, showCheckInHint, onTrackCheckIn, onVacation }: {
  track: UserTrack;
  onBack: () => void;
  showCheckInHint?: boolean;
  onTrackCheckIn?: () => void;
  onVacation?: (trackId: string, until: string) => void;
}) {
  const [journey, setJourney] = useState<Journey | null>(() => lsLoad<Journey | null>(LS_JOURNEY(track.slug), null));
  const [days, setDays] = useState<JourneyDay[]>(() => lsLoad<JourneyDay[]>(LS_DAYS(track.slug), []));

  const handleStarted = (j: Journey, d: JourneyDay[]) => { setJourney(j); setDays(d); };
  const onVac = track.vacation_until && track.vacation_until >= todayStr();

  const inner = !journey || days.length === 0
    ? <JourneyOnboarding track={track} onStarted={handleStarted} />
    : <JourneyView track={track} journey={journey} days={days} onBack={onBack} showCheckInHint={showCheckInHint} onTrackCheckIn={onTrackCheckIn} />;

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
              Streak protetta · fino al {track.vacation_until}
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
              className={`rounded-xl py-2.5 text-sm font-semibold border transition ${!custom && selected === d ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>
              {d === 365 ? "1 year" : `${d}d`}
            </button>
          ))}
        </div>
        <button onClick={() => { setCustom(true); setCustomVal(String(selected)); }}
          className={`w-full rounded-xl py-2.5 text-sm font-semibold border transition ${custom ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>
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
  const [pendingAdd, setPendingAdd] = useState<typeof ALL_TRACKS[0] | null>(null);
  const activeMap = new Map(userTracks.map(u => [u.track_id, u]));
  const q = search.toLowerCase().trim();
  const filtered = q
    ? ALL_TRACKS.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.short_description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      )
    : ALL_TRACKS;
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
                          className="btn-chunk inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-semibold bg-foreground text-background transition">
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
                        className="btn-chunk self-start inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-semibold bg-foreground text-background transition">
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

  return (
    <div className="container mx-auto px-6 py-8 max-w-4xl space-y-8">
      <header>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight font-display">Stats</h1>
        <p className="text-muted-foreground mt-1">Your data, clear and honest.</p>
        <button onClick={generateLetter} disabled={letterLoading}
          className="mt-4 btn-chunk inline-flex items-center gap-2 rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-semibold disabled:opacity-60 transition">
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
          <p className="text-4xl">📊</p>
          <h3 className="font-display text-xl font-semibold">Nessun dato ancora</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Completa il tuo primo check-in per vedere le statistiche del tuo percorso qui.
          </p>
        </div>
      )}

      {/* Summary row */}
      {totalCheckins > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Check-in totali", value: totalCheckins },
            { label: "Giorni attivi (90g)", value: activeDays },
            { label: "Active paths", value: userTracks.length },
          ].map(s => (
            <div key={s.label} className="rounded-2xl border border-border bg-card p-4 text-center">
              <p className="font-bold text-2xl font-display">{s.value}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Attività 90 giorni</h2>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
            <span>meno</span>
            {[0,1,2,3].map(v => <div key={v} className={`h-2.5 w-2.5 rounded-sm ${tone(v)}`} />)}
            <span>più</span>
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
          <h2 className="font-semibold mb-3">Per-track</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {userTracks.map(t => (
              <div key={t.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold truncate">{t.name}</h3>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.category}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <div className="rounded-xl bg-muted p-2">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground text-[10px] uppercase">
                      <Flame className="h-3 w-3" />Streak
                    </div>
                    <p className="font-bold text-base mt-0.5">{liveStreak(t)}</p>
                  </div>
                  <div className="rounded-xl bg-muted p-2">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground text-[10px] uppercase">
                      <Trophy className="h-3 w-3" />Best
                    </div>
                    <p className="font-bold text-base mt-0.5">{t.longest_streak || 0}</p>
                  </div>
                  <div className="rounded-xl bg-muted p-2">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground text-[10px] uppercase">
                      <CheckCircle2 className="h-3 w-3" />Done
                    </div>
                    <p className="font-bold text-base mt-0.5">{t.total_done || 0}</p>
                  </div>
                </div>
              </div>
            ))}
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

function SettingsPage({ userName, onSignOut, onUpdateName }: { userName: string; onSignOut: () => void; onUpdateName: (name: string) => void }) {
  const [displayName, setDisplayName] = useState(userName);
  const [nameSaved, setNameSaved] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => lsLoad<{ theme: "light" | "dark" }>(LS_PREFS, { theme: "dark" }).theme);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(() => lsLoad<boolean>("forge-notif", false));
  const [reminderOn, setReminderOn] = useState(() => lsLoad<boolean>("forge-reminder-on", false));
  const [reminderTime, setReminderTime] = useState(() => lsLoad<string>("forge-reminder-time", "21:00"));

  const toggleReminder = async () => {
    if (!reminderOn) {
      if (!("Notification" in window)) return;
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return;
    }
    const next = !reminderOn;
    setReminderOn(next);
    lsSave("forge-reminder-on", next);
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
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Il tuo nome</label>
            <div className="flex gap-2 mt-1.5">
              <input value={displayName} onChange={e => { setDisplayName(e.target.value); setNameSaved(false); }}
                onKeyDown={e => e.key === "Enter" && handleSaveName()}
                placeholder="Come ti chiami?"
                className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
              <button onClick={handleSaveName}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${nameSaved ? "bg-[color:var(--tertiary)] text-white" : "bg-primary text-primary-foreground"}`}>
                {nameSaved ? "Salvato ✓" : "Salva"}
              </button>
            </div>
          </div>
          <button onClick={onSignOut}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted transition">
            Esci dall'account
          </button>
        </div>
      </section>

      {/* Appearance */}
      <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted">
            <Sun className="h-4 w-4" />
          </span>
          <h2 className="font-semibold">Aspetto</h2>
        </div>
        <div className="flex items-center justify-between gap-3 py-3">
          <p className="text-sm font-medium">Tema</p>
          <div className="inline-flex rounded-xl border border-border bg-card p-1">
            <button onClick={() => applyTheme("light")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${theme === "light" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              <Sun className="h-3.5 w-3.5" /> Light
            </button>
            <button onClick={() => applyTheme("dark")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${theme === "dark" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              <Moon className="h-3.5 w-3.5" /> Dark
            </button>
          </div>
        </div>
      </section>

      {/* Notifications */}
      <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted">
            <Bell className="h-4 w-4" />
          </span>
          <h2 className="font-semibold">Notifiche</h2>
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium">Reminder giornaliero</p>
            <p className="text-xs text-muted-foreground">Ti avvisiamo se non hai fatto check-in all'orario scelto</p>
          </div>
          <button onClick={toggleReminder}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${reminderOn ? "bg-[color:var(--tertiary)]" : "bg-muted"}`}>
            <span className={`inline-block h-4 w-4 rounded-full bg-white transition transform ${reminderOn ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
        {reminderOn && (
          <div className="flex items-center justify-between py-2 border-t border-border/50">
            <p className="text-sm text-muted-foreground">Orario</p>
            <input
              type="time"
              value={reminderTime}
              onChange={e => { setReminderTime(e.target.value); lsSave("forge-reminder-time", e.target.value); }}
              className="rounded-xl border border-border bg-muted px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-foreground"
            />
          </div>
        )}
      </section>

      {/* Data & Privacy */}
      <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted">
            <Database className="h-4 w-4" />
          </span>
          <h2 className="font-semibold">Dati e Privacy</h2>
        </div>
        <div className="rounded-xl bg-muted/50 border border-border/50 p-3 mb-4 text-xs text-muted-foreground leading-relaxed">
          Your progress is saved locally and backed up to your account. Sign out to switch accounts.
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between py-3 border-b border-border/50">
            <div>
              <p className="text-sm font-medium">Esporta dati</p>
              <p className="text-xs text-muted-foreground">Scarica tutti i tuoi percorsi e log in formato JSON</p>
            </div>
            <button onClick={handleExport}
              className="btn-chunk inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted transition">
              <Download className="h-3.5 w-3.5" /> Esporta
            </button>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-[color:var(--secondary)]">Cancella tutti i dati</p>
              <p className="text-xs text-muted-foreground">Elimina permanentemente percorsi, log e progressi</p>
            </div>
            {showClearConfirm ? (
              <div className="flex gap-2">
                <button onClick={() => setShowClearConfirm(false)}
                  className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted transition">
                  Annulla
                </button>
                <button onClick={handleClearData}
                  className="rounded-xl bg-[color:var(--secondary)] text-white px-3 py-2 text-xs font-bold transition">
                  Conferma
                </button>
              </div>
            ) : (
              <button onClick={() => setShowClearConfirm(true)}
                className="btn-chunk rounded-xl border border-[color:var(--secondary)]/30 text-[color:var(--secondary)] px-3 py-2 text-xs font-medium hover:bg-[color:var(--secondary)]/10 transition">
                Cancella
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
        const { days } = await res.json() as { days: JourneyDay[] };
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
                  className={`rounded-xl py-3 text-sm font-semibold border transition ${!customDur && targetDays === d ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>
                  {d === 365 ? "1 year" : `${d}d`}
                </button>
              ))}
            </div>
            <button
              onClick={() => { setCustomDur(true); setCustomDurVal(String(targetDays)); }}
              className={`w-full max-w-xs rounded-xl py-3 text-sm font-semibold border transition ${customDur ? "bg-foreground text-background border-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>
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
  const [user, setUser] = useState<ElevateUser | null>(() => lsLoad(LS_USER, null));
  const [tracks, setTracks] = useState<UserTrack[]>(() => lsLoad(LS_TRACKS, []));
  const [logs, setLogs] = useState<Log[]>(() => lsLoad(LS_LOGS, []));

  const updateUser = useCallback((patch: Partial<ElevateUser>) => {
    setUser(prev => {
      const next = { ...prev!, ...patch };
      lsSave(LS_USER, next);
      return next;
    });
  }, []);

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
      return next;
    });
  }, []);

  const removeTrack = useCallback((trackId: string) => {
    setTracks(prev => {
      const next = prev.filter(t => t.id !== trackId);
      lsSave(LS_TRACKS, next);
      return next;
    });
  }, []);

  const setVacation = useCallback((trackId: string, until: string) => {
    setTracks(prev => {
      const next = prev.map(t => t.id === trackId ? { ...t, vacation_until: until || null } : t);
      lsSave(LS_TRACKS, next);
      return next;
    });
  }, []);

  const MILESTONE_DAYS = new Set([1, 3, 7, 14, 30, 66, 100, 365]);

  const checkIn = useCallback((userTrackId: string) => {
    navigator.vibrate?.(40);
    const t = todayStr();
    const y = yesterdayStr();
    setTracks(prev => {
      const next = prev.map(ut => {
        if (ut.id !== userTrackId || ut.last_log_date === t) return ut;
        const newStreak = ut.last_log_date === y ? (ut.current_streak || 0) + 1 : 1;
        const newTotal = (ut.total_done || 0) + 1;
        // Check milestone after update
        const milestoneKey = `forge-milestone-${ut.id}-${newStreak}`;
        if (MILESTONE_DAYS.has(newStreak) && !lsLoad<boolean>(milestoneKey, false)) {
          lsSave(milestoneKey, true);
          setTimeout(() => setMilestone({ days: newStreak, trackName: ut.name }), 600);
        }
        // Trigger celebration for every check-in
        if (!MILESTONE_DAYS.has(newStreak)) {
          setTimeout(() => setCheckInCelebration({ trackName: ut.name, streak: newStreak }), 250);
        } else {
          setTimeout(() => setCheckInCelebration({ trackName: ut.name, streak: newStreak }), 250);
        }
        return { ...ut, current_streak: newStreak, longest_streak: Math.max(ut.longest_streak || 0, newStreak), total_done: newTotal, last_log_date: t };
      });
      lsSave(LS_TRACKS, next);
      return next;
    });
    setLogs(prev => {
      const next = [...prev, { id: nanoid(), track_id: userTrackId, log_date: todayStr(), created_at: new Date().toISOString() }];
      lsSave(LS_LOGS, next);
      return next;
    });
  }, []);

  const handleViewForCheckIn = useCallback((t: UserTrack) => {
    setPendingCheckIn(true);
    setSelectedTrack(t);
  }, []);

  const handleTrackBack = useCallback(() => {
    setSelectedTrack(null);
    setPendingCheckIn(false);
  }, []);

  // Called after user picks their track — save it and go to login
  const handleOnboardingComplete = useCallback(({ track }: { track: OnboardingTrack }) => {
    lsSave("forge-pending-track", track);
    setScreen("login");
  }, []);

  // Called after successful login — create user from entered name + pending track, then open Day 1
  const handleLoginSuccess = useCallback((enteredName: string) => {
    const pendingTrack = lsLoad<OnboardingTrack | null>("forge-pending-track", null);
    const displayName = enteredName.trim() || "Forger";
    const newUser: ElevateUser = { name: displayName, createdAt: new Date().toISOString() };
    lsSave(LS_USER, newUser);
    setUser(newUser);
    if (pendingTrack) {
      const full = ALL_TRACKS.find(t => t.slug === pendingTrack.slug) ?? {
        id: nanoid(), slug: pendingTrack.slug, name: pendingTrack.name, category: pendingTrack.category, short_description: "",
      };
      const ut: UserTrack = {
        id: nanoid(), track_id: full.id, name: full.name, category: full.category, slug: full.slug,
        added_at: new Date().toISOString(), current_streak: 0, longest_streak: 0, total_done: 0,
        last_log_date: null, target_days: 30, // will be updated after duration selection
      };
      lsSave(LS_TRACKS, [ut]);
      setTracks([ut]);
      localStorage.removeItem("forge-pending-track");
      setFirstDayReveal({ track: ut, userName: displayName }); // cinematic Day 1 reveal
    }
    setScreen("dashboard");
  }, []);

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    [LS_USER, LS_TRACKS, LS_LOGS, LS_AUTH].forEach(k => localStorage.removeItem(k));
    setUser(null); setTracks([]); setLogs([]);
    setScreen("landing");
  }, []);

  // Handle auth state changes.
  // SIGNED_IN: fires after OAuth code exchange completes (may race with useEffect).
  // INITIAL_SESSION: fires immediately when listener is registered — catches the case
  //   where Supabase already processed the OAuth code before useEffect ran.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) {
        const existingUser = lsLoad<ElevateUser | null>(LS_USER, null);
        if (!existingUser) {
          // No local profile yet → show name step (new user or cleared localStorage)
          setScreen("login");
        } else {
          // Returning user with full profile → go to dashboard
          setScreen("dashboard");
        }
      }
      if (event === "SIGNED_OUT") {
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
      new Notification("Forge", { body: "Non hai ancora fatto check-in oggi. Il tuo streak ti aspetta." });
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
      />
    );
  }

  return (
    <>
      <AnimatePresence>
        {milestone && (
          <MilestoneOverlay days={milestone.days} trackName={milestone.trackName} onDismiss={() => setMilestone(null)} />
        )}
        {!milestone && showReEntry && (
          <ReEntryOverlay gapDays={reEntryGap} onDismiss={handleReEntryDismiss} />
        )}
        {!milestone && showMorningCoach && (
          <MorningCoachOverlay tracks={tracks} onDismiss={handleMorningDismiss} />
        )}
      </AnimatePresence>
      <DashboardLayout currentPage={page} onNavigate={setPage}>
        {page === "home" && (
          <HomePage user={user!} tracks={tracks} onCheckIn={checkIn} onNavigate={setPage} onUpdateUser={updateUser} onView={setSelectedTrack} onViewForCheckIn={handleViewForCheckIn} onVacation={setVacation} />
        )}
        {page === "tracks" && <TracksPage userTracks={tracks} onAdd={(t, days) => addTrack(t, days)} onView={setSelectedTrack} onRemove={removeTrack} />}
        {page === "insights" && <InsightsPage userTracks={tracks} logs={logs} />}
        {page === "settings" && <SettingsPage userName={user?.name ?? ""} onSignOut={handleSignOut} onUpdateName={name => updateUser({ name })} />}
      </DashboardLayout>
    </>
  );
}
