// Complete self-contained Forge app — localStorage persistence, no backend.

import { useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  ArrowRight, Eye, Check, Plus, Home, Layers, BarChart3, Settings, Shield,
  Sparkles, Flame, Sun, Moon, User as UserIcon, Trophy, CheckCircle2,
  Zap, AlertTriangle, Crown, Mail, Phone, ChevronLeft, Search,
  Database, Download, Bell, Target, Lock, PenLine, X, BarChart2} from 'lucide-react';
import confetti from "canvas-confetti";
import { supabase } from "./supabase";

import type { BeforeInstallPromptEvent, Screen, AppPage, ElevateUser, UserTrack, Log, OnboardingTrack, ElevateAuth, Journey, JourneyDay, ChatMessage, CommunityPost } from './types';
import { HomePage, GARDEN_STAGES, MOUNTAIN_STAGES } from './pages/HomePage';
import * as db from "./db";
import { Plan, shouldShowPaywall } from './plans';
import { PaywallModal } from './components/PaywallModal';
import { JourneyView, JourneyOnboarding } from './pages/JourneyPage';
import { MorningCoachOverlay } from './pages/CoachPage';
import { TrackDetailPage } from './pages/TrackDetailPage';
import { TracksPage } from './pages/TracksPage';
import InsightsPage from './pages/InsightsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ReEntryOverlay, StreakRecoveryOverlay, SOSOverlay, SOSButton, CertModal, MilestoneOverlay } from './components/Overlays';
import { CheckInRichModal } from './components/CheckInModal';
import i18n from './i18n';
import { CoachNudge, useCoachNudge } from './components/CoachNudge';
import { MilestoneShareCard } from './components/MilestoneShareCard';
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
  trainer: { id: "trainer", name: "Kai", tagline: "Keeps you accountable", voice: "You are a direct, no-bullshit performance coach. Short punchy sentences. Hold the user accountable. Celebrate effort, never excuses. Push past comfort with warmth. Never preachy." },
  teacher: { id: "teacher", name: "Iris", tagline: "Makes it click", voice: "You are a calm curious teacher. Break change into small learnable steps. Ask great questions before giving answers. Clear examples, treat user as intelligent adult. Patient, structured." },
  clinician: { id: "clinician", name: "Dr. Mara", tagline: "Validates, then guides", voice: "You are a warm evidence-based mental health coach. Validate first, then guide. Speak gently. Reference CBT, ACT, polyvagal in plain language. Never minimize feelings." },
  mentor: { id: "mentor", name: "Roy", tagline: "Strategic, no fluff", voice: "You are a sharp strategic mentor. Think in systems. Ask hard questions. Give crisp actionable frameworks. No fluff, no platitudes. The friend who has done it and tells the truth." },
  guide: { id: "guide", name: "Sasha", tagline: "Finds your deeper why", voice: "You are a creative soulful guide. Speak with imagery and metaphor. Honour the user's deeper why. Make practice feel like play. Blend craft, ritual, meaning. Warm, exploratory." },
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

// MOTIVATIONS moved to i18n JSON (app.motivations)

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

// ─────────────────────────────────────────────────────────────────────────────
// PrizeRequestModal — shown at 100k milestone
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

const CI_TRIGGERS = ["Stress","Noia","Social","Solitudine","Stanchezza","Rabbia","Tristezza","Abitudine"];


function PrizeRequestModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
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
              <h2 className="font-display text-2xl mb-2">{t("badge.submitted")}</h2>
              <p className="text-muted-foreground text-sm">{t("badge.received_msg")}</p>
              <button onClick={onClose} className="mt-6 btn-primary px-8 py-2.5 rounded-full font-semibold text-sm">{t("common.close")}</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: "#FCEBEB" }}>
                  <Crown className="h-5 w-5" style={{ color: "#E24B4A" }} />
                </div>
                <div>
                  <p className="font-display text-lg leading-tight">{t("badge.reached_100k")}</p>
                  <p className="text-xs text-muted-foreground">{t("badge.address_desc")}</p>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t("badge.full_name")}</label>
                <input required value={form.name} onChange={f("name")} placeholder="Brendon Hoxha"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t("badge.address")}</label>
                <input required value={form.address} onChange={f("address")} placeholder="Via Roma 12, Appartamento 3"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">{t("badge.city")}</label>
                  <input required value={form.city} onChange={f("city")} placeholder="Milano"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">{t("badge.zip")}</label>
                  <input required value={form.zip} onChange={f("zip")} placeholder="20100"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t("badge.country")}</label>
                <input required value={form.country} onChange={f("country")} placeholder="Italia"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20" />
              </div>

              {status === "error" && (
                <p className="text-xs text-red-500">{t("common.error_retry")}</p>
              )}
              <button type="submit" disabled={status === "loading"}
                className="w-full py-3 rounded-2xl font-semibold text-sm text-white flex items-center justify-center gap-2"
                style={{ background: "#E24B4A" }}>
                {status === "loading" ? <Spinner light /> : <><Crown className="h-4 w-4" /> {t("badge.request")}</>}
              </button>
              <p className="text-[10px] text-muted-foreground text-center">
                {t("badge.shipping_note")}
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
  onView: (ut: UserTrack) => void;
}) {
  const { t } = useTranslation();
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
    confetti({ particleCount: 55, spread: 65, startVelocity: 30, gravity: 0.9, ticks: 200, origin: { x: 0.5, y: 0.42 }, colors: gold });
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
              <p className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground font-mono">{t("app.momentum_label")}</p>
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
                ? t("app.legend_message")
                : m.score >= 50_000 ? t("app.best_world")
                : m.score >= 10_000 ? t("app.elite_message")
                : m.score >= 1_000 ? t("app.on_fire")
                : m.score >= 300 ? t("app.momentum_building")
                : t("app.today_is_day_one")}
            </h2>

            {/* 50k → 100k teaser */}
            {effectivePeak >= 50_000 && effectivePeak < 100_000 && (
              <p className="mt-1.5 text-[11px] rounded-xl px-2.5 py-1.5 inline-flex items-center gap-1.5"
                style={{ background: "#FCEBEB", color: "#791F1F" }}>
                <Crown className="h-3 w-3 shrink-0" />
                {t("badge.at_100k")} <button onClick={() => setShowPrizeModal(false)} className="underline font-semibold">{t("badge.claim_link")}</button>
              </p>
            )}
            {effectivePeak >= 100_000 && (
              <button onClick={() => setShowPrizeModal(true)}
                className="mt-1.5 text-[11px] rounded-xl px-2.5 py-1.5 inline-flex items-center gap-1.5 font-semibold"
                style={{ background: "#E24B4A", color: "#fff" }}>
                <Crown className="h-3 w-3 shrink-0" /> {t("badge.claim_prize")}
              </button>
            )}

            {!isMaxed && evo.next && (
              <p className="mt-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{evo.daysToNext}</span> day{evo.daysToNext === 1 ? "" : "s"} to{" "}
                <span className="font-semibold text-foreground">{evolutionFor(evo.next).label}</span>
              </p>
            )}
            <div className="mt-3 grid grid-cols-4 gap-1.5">
              <Meter label={t("app.volume")} v={m.volume} max={Math.max(300, m.volume)} />
              <Meter label={t("app.streak_meter")} v={m.consistency} max={Math.max(400, m.consistency)} />
              <Meter label={t("app.depth")} v={m.longevity} max={Math.max(200, m.longevity)} />
              <Meter label={t("app.breadth")} v={m.breadth} max={Math.max(1500, m.breadth)} />
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
            <p className="font-display text-sm leading-tight">{t("app.in_flow")}</p>
            <p className="text-[11px] opacity-90">{t("app.protect_flow")}</p>
          </div>
        </motion.div>
      )}

      {atRisk.map(riskTrack => (
        <motion.div key={riskTrack.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
          className="rounded-2xl p-3.5 border-2 border-[color:var(--secondary)] bg-card flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-[color:var(--secondary)] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight">
              {t("app.streak_at_risk", { streak: riskTrack.current_streak, track: riskTrack.name })}
            </p>
            <p className="text-[11px] text-muted-foreground">{t("app.check_in_today")}</p>
          </div>
          <button onClick={() => onView(riskTrack)}
            className="shrink-0 rounded-full bg-[color:var(--secondary)] text-white px-3 py-1.5 text-xs font-semibold flex items-center gap-1 btn-chunk">
            <Flame className="h-3 w-3" /> {t("app.save_it")}
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
// ─────────────────────────────────────────────────────────────────────────────
// LoginPage
// ─────────────────────────────────────────────────────────────────────────────

type LoginMode = "options" | "phone" | "otp" | "name";

function LoginPage({ onSuccess, onBack }: { onSuccess: (name: string) => void; onBack: () => void }) {
  const { t } = useTranslation();
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
        <ChevronLeft className="h-4 w-4" /> {t("login.back")}
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
                <h1 className="font-display text-2xl font-bold tracking-tight">{t("login.almost_there")}</h1>
                <p className="text-sm text-muted-foreground mt-1 mb-6">{t("login.save_path_start")}</p>

                <div className="space-y-3">
                  <button onClick={handleGoogle} disabled={!!loading} className={btnSecondary}>
                    {loading === "google" ? <Spinner /> : <><GoogleIcon /> {t("login.continue_google")}</>}
                  </button>
                  {authError && <p className="text-xs text-red-400 text-center mt-1">{authError}</p>}
                </div>

                <div className="my-5 flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[11px] text-muted-foreground font-mono uppercase tracking-widest">o</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <button onClick={() => setMode("phone")} disabled={!!loading} className={btnSecondary}>
                  <Phone className="h-4 w-4 text-muted-foreground" /> {t("login.continue_phone")}
                </button>
              </motion.div>
            )}

            {mode === "phone" && (
              <motion.div key="phone" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}>
                <button onClick={() => setMode("options")} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors">
                  <ChevronLeft className="h-4 w-4" /> Back
                </button>
                <h1 className="font-display text-2xl font-bold tracking-tight">{t("login.your_number")}</h1>
                <p className="text-sm text-muted-foreground mt-1 mb-6">{t("login.sms_code")}</p>
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
                    {loading === "phone-send" ? <Spinner light /> : t("login.send_code")}
                  </button>
                </div>
              </motion.div>
            )}

            {mode === "otp" && (
              <motion.div key="otp" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}>
                <h1 className="font-display text-2xl font-bold tracking-tight">{t("login.enter_code")}</h1>
                <p className="text-sm text-muted-foreground mt-1 mb-6">{t("login.sent_to", {phone})}</p>
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
                    {loading === "phone" ? <Spinner light /> : t("login.verify")}
                  </button>
                  <p className="text-xs text-center text-muted-foreground">
                    {t("login.no_receive")}{" "}
                    <button onClick={() => { setOtp(["","","","","",""]); setMode("phone"); }} className="underline hover:text-foreground transition-colors">
                      {t("login.try_again")}
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
                  <h1 className="font-display text-2xl font-bold tracking-tight">{t("login.whats_name")}</h1>
                  <p className="text-sm text-muted-foreground mt-1">{t("login.coach_use")}</p>
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
                    {t("login.start_day1_btn")}
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        <p className="mt-4 text-center text-[11px] text-muted-foreground leading-relaxed">
          {t("login.agree_prefix")}{" "}
          <span className="underline cursor-pointer hover:text-foreground transition-colors">{t("login.terms")}</span>
          {" "}{t("login.and")}{" "}
          <span className="underline cursor-pointer hover:text-foreground transition-colors">{t("login.privacy")}</span>
        </p>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LandingPage
// ─────────────────────────────────────────────────────────────────────────────

function LandingPage({ onBegin }: { onBegin: () => void }) {
  const [phase, setPhase] = useState<"typing" | "question" | "input">("typing");
  const [answer, setAnswer] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("question"), 1400);
    const t2 = setTimeout(() => setPhase("input"), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  useEffect(() => {
    if (phase === "input") inputRef.current?.focus();
  }, [phase]);

  const handleSubmit = () => {
    const lower = answer.toLowerCase();
    let best: string | null = null;
    let bestScore = 0;
    for (const tk of TRACK_KEYWORDS) {
      let score = 0;
      for (const kw of tk.keywords) { if (lower.includes(kw)) score += 2; }
      if (score > bestScore) { bestScore = score; best = tk.slug; }
    }
    if (best) localStorage.setItem("forge_init_slug", best);
    else localStorage.removeItem("forge_init_slug");
    onBegin();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: "oklch(0.08 0.015 145)" }}>
      <div className="w-full max-w-sm space-y-5">
        <div className="flex items-end gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 mb-1">
            <span className="text-emerald-400 text-xs font-semibold">F</span>
          </div>
          <div className="flex-1 min-h-[48px] flex items-end">
            {phase === "typing" && (
              <div className="bg-white/[0.07] rounded-2xl rounded-bl-sm px-4 py-3 inline-flex gap-1.5 items-center">
                <span className="w-2 h-2 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "160ms" }} />
                <span className="w-2 h-2 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "320ms" }} />
              </div>
            )}
            {phase !== "typing" && (
              <div className="bg-white/[0.07] rounded-2xl rounded-bl-sm px-4 py-3.5">
                <p className="text-white/90 text-[15px] leading-snug">What's a habit you want to quit?</p>
              </div>
            )}
          </div>
        </div>
        {phase === "input" && (
          <div className="space-y-3 pl-12">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                onKeyDown={e => e.key === "Enter" && answer.trim() && handleSubmit()}
                placeholder="e.g. smoking, scrolling, drinking..."
                className="flex-1 bg-white/[0.07] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/25 outline-none focus:border-emerald-500/40 transition-colors"
              />
              <button
                onClick={handleSubmit}
                disabled={!answer.trim()}
                className={"w-11 h-11 rounded-xl flex items-center justify-center transition-all text-lg " + (answer.trim() ? "bg-emerald-500 text-white" : "bg-white/[0.05] text-white/20")}
              >
                ↑
              </button>
            </div>
            <button onClick={() => { localStorage.removeItem("forge_init_slug"); onBegin(); }}
              className="w-full text-center text-white/25 text-xs py-1">
              skip
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function OnboardingPage({ onComplete }: { onComplete: (data: { track: OnboardingTrack; name?: string }) => void }) {
  const { t } = useTranslation();
  type OnboardingStep = "question" | "thinking" | "response" | "tracks" | "island" | "coach" | "name";
  const [step, setStep] = useState<OnboardingStep>("question");
  const [showAllPaths, setShowAllPaths] = useState(false);
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState("");
  const [typedCount, setTypedCount] = useState(0);
  const [chosen, setChosen] = useState<OnboardingTrack | null>(null);
  const [islandThemePick, setIslandThemePick] = useState<'garden' | 'mountain'>('garden');
  const [suggestedSlug, setSuggestedSlug] = useState<string | null>(() => localStorage.getItem("forge_init_slug"));
  const [pendingTrackForName, setPendingTrackForName] = useState<OnboardingTrack | null>(null);
  const [onboardingName, setOnboardingName] = useState("");

  const COACH_INTRO_LINES: Record<string, string> = {
    "Kai": "I'll push you forward, one day at a time.",
    "Iris": "We'll break this down until it fully clicks.",
    "Dr. Mara": "I'll help you move gently — and still go far.",
    "Roy": "No fluff. Just clear steps and honest feedback.",
    "Sasha": "We'll find what this journey really means to you.",
  };

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
            <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground mb-10">{t("onboarding.one_question")}</p>
            <h1 className="font-display text-[clamp(2rem,6vw,4.5rem)] leading-[1.05] tracking-[-0.04em] font-semibold">
              What is the one thing that,<br />
              if you changed it,<br />
              <span className="text-[color:var(--secondary)] italic">would change everything?</span>
            </h1>
            <div className="mt-14">
              <textarea autoFocus value={answer} onChange={e => setAnswer(e.target.value.slice(0, 1000))}
                placeholder={t("onboarding.be_honest")}
                className="w-full bg-transparent border-0 border-b-2 border-border focus:border-foreground outline-none text-center font-display text-2xl placeholder:text-muted-foreground py-5 px-2 resize-none min-h-[140px] transition-colors" />
              <div className="mt-3 text-[11px] text-muted-foreground font-mono tracking-wider">
                {answer.trim().length < 10 ? t("onboarding.n_more_to_continue", {n: Math.max(0, 10 - answer.trim().length)}) : t("onboarding.ready")}
              </div>
              <p className="mt-1.5 text-[11px] text-emerald-500/80 font-mono">{t("common.privacy_coach")}</p>
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
            <p className="mt-10 font-display text-xl text-muted-foreground">{t("onboarding.coach_reading")}</p>
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
              <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground mb-4">{t("onboarding.choose_path")}</p>
              <h2 className="font-display text-[clamp(1.75rem,4vw,3rem)] tracking-[-0.03em] leading-tight">
                Let's start with <span className="text-[color:var(--secondary)] italic">one thing</span>.
              </h2>
              <p className="mt-4 text-muted-foreground">{t("onboarding.add_more_later")}</p>
            </div>

            {/* ── Hero-card-only view when a suggestion exists ── */}
            {suggestedSlug && !showAllPaths && (() => {
              const sug = ONBOARDING_TRACKS.find(t => t.slug === suggestedSlug);
              if (!sug) return null;
              return (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="max-w-xl mx-auto">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-yellow-400 font-mono mb-4 text-center font-bold">{t("onboarding.your_path_based")}</p>

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
                        <span className="text-yellow-400 font-medium">{t("onboarding.not_alone")}</span>
                      </p>
                    )}
                    <button onClick={() => { setPendingTrackForName(sug); setStep("island"); }}
                      className="btn-chunk w-full inline-flex items-center justify-center gap-2 rounded-full grad-electric text-white py-4 font-bold text-sm shadow-[var(--shadow-violet)]">
                      {t("onboarding.this_is_my_path")} <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Toggle to see all paths */}
                  <button onClick={() => setShowAllPaths(true)}
                    className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-2 underline underline-offset-4">
                    {t("onboarding.show_all_paths")}
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
                      <p className="text-[10px] uppercase tracking-[0.3em] text-yellow-400 font-mono mb-3 font-bold">{t("onboarding.suggested_for_you")}</p>
                      <button onClick={() => setChosen(sug)}
                        className={`w-full text-left warm-card rounded-2xl p-5 transition btn-chunk relative ${isChosen ? "ring-2 ring-yellow-400" : "ring-2 ring-yellow-400/60"}`}
                        style={{ boxShadow: "0 0 28px 4px oklch(0.875 0.185 95 / 0.38)" }}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="font-display text-xl font-semibold">{sug.name}</p>
                            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-0.5">{sug.category}</p>
                            {TRACK_GLOBAL_STATS[sug.slug] && (
                              <p className="text-xs text-yellow-400/90 mt-2 leading-relaxed">
                                {TRACK_GLOBAL_STATS[sug.slug]}. {t("onboarding.not_alone")}
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
                      {t("onboarding.this_is_my_path")} <ArrowRight className="h-4 w-4" />
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
            <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground mb-6">{t("onboarding.choose_island")}</p>
            <h1 className="font-display text-[clamp(1.8rem,5vw,2.6rem)] leading-tight tracking-tight mb-2">
              Your island reflects<br /><span className="text-electric">your journey</span>
            </h1>
            <p className="text-sm text-muted-foreground mb-10 max-w-xs mx-auto">{t("onboarding.island_body")}</p>
            <div className="grid grid-cols-2 gap-4 mb-8">
              {([
                { key: 'garden' as const, label: t('onboarding.garden_label'), desc: t('onboarding.garden_desc'), img: 'https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/stage-01.png' },
                { key: 'mountain' as const, label: t('onboarding.mountain_label'), desc: t('onboarding.mountain_desc'), img: 'https://res.cloudinary.com/dmyxmn9eg/image/upload/e_background_removal/forge/mountains/mount1.png' },
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
              onClick={() => { localStorage.setItem('forge_island_theme', islandThemePick); setStep('coach'); }}
              className="btn-chunk w-full inline-flex items-center justify-center gap-2 rounded-full grad-electric text-white py-4 font-bold text-sm shadow-[var(--shadow-violet)]"
            >
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          </motion.div>
        )}

        {step === "coach" && pendingTrackForName && (
          <motion.div key="coach" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.7 }} className="max-w-sm w-full text-center">
            {(() => {
              const _arch = archetypeForSlug(pendingTrackForName.slug);
              const _line = COACH_INTRO_LINES[_arch.name] ?? "I'm here to help you follow through.";
              return (
                <>
                  <motion.p
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
                    className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground mb-10">
                    {t("onboarding.your_coach_label")}
                  </motion.p>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.25, duration: 0.55, type: "spring", stiffness: 180, damping: 18 }}
                    className="mx-auto mb-8 h-20 w-20 rounded-full grad-electric flex items-center justify-center text-2xl font-bold text-white select-none"
                    style={{ boxShadow: "var(--shadow-violet)" }}>
                    {_arch.name.replace("Dr. ", "").charAt(0)}
                  </motion.div>
                  <motion.h1
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                    className="font-display text-[clamp(2rem,6vw,3rem)] leading-tight tracking-tight mb-1">
                    Meet <span className="text-electric">{_arch.name}</span>
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}
                    className="text-xs text-muted-foreground mb-8 uppercase tracking-[0.22em] font-mono">
                    {_arch.tagline}
                  </motion.p>
                  <motion.p
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.75, duration: 0.5 }}
                    className="text-lg text-foreground/75 leading-relaxed mb-12 max-w-xs mx-auto">
                    "{_line}"
                  </motion.p>
                  <motion.button
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.0 }}
                    onClick={() => setStep("name")}
                    className="btn-chunk inline-flex items-center gap-2 rounded-full grad-electric text-white px-9 py-4 text-sm font-bold shadow-[var(--shadow-violet)]">
                    Continue <ArrowRight className="h-4 w-4" />
                  </motion.button>
                </>
              );
            })()}
          </motion.div>
        )}

        {step === "name" && (
          <motion.div key="name" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.6 }} className="max-w-lg w-full text-center">
            <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground mb-10">{t("onboarding.one_last_thing")}</p>
            <h1 className="font-display text-[clamp(2rem,5vw,3.5rem)] leading-[1.1] tracking-[-0.04em] font-semibold mb-4">
              What should your coach<br />
              <span className="text-[color:var(--secondary)] italic">call you?</span>
            </h1>
            <p className="text-muted-foreground text-sm mb-12">{t("login.coach_use")}</p>
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
  const { t } = useTranslation();
  const navItems: { id: AppPage; icon: typeof Home; label: string }[] = [
    { id: "home",     icon: Home,     label: t("nav.home") },
    { id: "tracks",   icon: Layers,   label: t("nav.library") },
    { id: "insights", icon: BarChart3,label: t("nav.stats") },
    { id: "settings", icon: Settings, label: t("nav.settings") },
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

// REENTRY_MESSAGES moved to i18n JSON (app.reentry_messages)


// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// DayPanel
// ─────────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────────
// TrackDetailPage
// ─────────────────────────────────────────────────────────────────────────────

// TrackDetailPage → src/pages/TrackDetailPage.tsx

// ─────────────────────────────────────────────────────────────────────────────
// TracksPage
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// DurationPickerModal
// ─────────────────────────────────────────────────────────────────────────────

// TracksPage (+ DurationPickerModal) → src/pages/TracksPage.tsx

// ─────────────────────────────────────────────────────────────────────────────
// InsightsPage
// ─────────────────────────────────────────────────────────────────────────────

// InsightsPage → src/pages/InsightsPage.tsx

// ─────────────────────────────────────────────────────────────────────────────
// SettingsPage
// ─────────────────────────────────────────────────────────────────────────────

// SettingsPage → src/pages/SettingsPage.tsx

// ─────────────────────────────────────────────────────────────────────────────
// FirstDayReveal — cinematic first-login experience
// ─────────────────────────────────────────────────────────────────────────────

function FirstDayReveal({ userName, track, onComplete }: {
  userName: string;
  track: UserTrack;
  onComplete: () => void;
}) {
  const { t } = useTranslation();
  type FDRPhase = "welcome" | "track" | "duration" | "generating" | "reveal";
  const [phase, setPhase] = useState<FDRPhase>("welcome");
  const [glowPulse, setGlowPulse] = useState(false);
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

  // Ambient glow pulse on reveal — cinematic, no confetti
  useEffect(() => {
    if (phase !== "reveal") return;
    setTimeout(() => { setGlowPulse(true); }, 400);
    setTimeout(() => { setGlowPulse(false); }, 2200);
  }, [phase]);

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden" style={{ background: "oklch(0.08 0.02 240)" }}>
      {/* Ambient glow — breathes on reveal */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[32rem] h-[32rem] rounded-full"
          style={{
            background: "radial-gradient(circle, oklch(0.55 0.22 250) 0%, transparent 70%)",
            opacity: glowPulse ? 0.55 : 0.15,
            transform: glowPulse ? "translate(-50%, -50%) scale(1.6)" : "translate(-50%, -50%) scale(1)",
            transition: "opacity 1.2s ease-out, transform 1.8s cubic-bezier(0.2, 0.9, 0.2, 1)",
          }} />
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
              {t("fdr.welcome_name", {name: userName})}
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
              {t("fdr.journey_starts", {n: 30})}
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
              <p className="text-[10px] uppercase tracking-[0.5em] font-mono text-muted-foreground mb-2">{t("fdr.how_long")}</p>
              <h2 className="font-display text-3xl text-foreground tracking-tight">{t("fdr.choose_commitment")}</h2>
            </div>
            <div className="w-full max-w-xs grid grid-cols-3 gap-2">
              {([30, 60, 90, 120, 180, 365] as const).map(d => (
                <button key={d}
                  onClick={() => { setTargetDays(d); setCustomDur(false); }}
                  className={`rounded-xl py-3 text-sm font-semibold border transition ${!customDur && targetDays === d ? "bg-foreground text-neutral-900 border-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>
                  {d === 365 ? t("tracks.one_year_label") : `${d}d`}
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
              {t("fdr.build_journey", {label: targetDays === 365 ? t("fdr.year_long") : targetDays + "-day"})}
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
            <p className="text-muted-foreground text-xs font-mono uppercase tracking-wider">{t("fdr.generating")}</p>
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
                  style={{ color: "oklch(0.65 0.2 250)" }}>{t("app.today_task")}</p>
                <p className="text-foreground text-[15px] leading-relaxed">{day1.task}</p>
              </motion.div>

              {/* Description */}
              <motion.div
                initial={{ opacity: 0, y: 36 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-2xl p-5"
                style={{ background: "oklch(0.11 0.02 240)" }}>
                <p className="text-[9px] uppercase tracking-[0.4em] font-mono text-muted-foreground mb-2.5">{t("app.context")}</p>
                <p className="text-muted-foreground text-sm leading-relaxed">{day1.description}</p>
              </motion.div>

              {/* Science */}
              <motion.div
                initial={{ opacity: 0, y: 36 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-2xl p-5 border-l-4"
                style={{ background: "oklch(0.12 0.04 150)", borderLeftColor: "oklch(0.62 0.2 150)" }}>
                <p className="text-[9px] uppercase tracking-[0.4em] font-mono mb-2.5"
                  style={{ color: "oklch(0.65 0.2 150)" }}>{t("app.the_science")}</p>
                <p className="text-muted-foreground text-sm leading-relaxed">{day1.science}</p>
              </motion.div>

              {/* Reflection */}
              <motion.div
                initial={{ opacity: 0, y: 36 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-2xl p-5 border-l-4"
                style={{ background: "oklch(0.13 0.04 65)", borderLeftColor: "oklch(0.72 0.18 65)" }}>
                <p className="text-[9px] uppercase tracking-[0.4em] font-mono mb-2.5"
                  style={{ color: "oklch(0.72 0.18 65)" }}>{t("app.tonights_reflection")}</p>
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
                {t("fdr.ready_start")}
                <ArrowRight className="h-5 w-5" />
              </button>
              <p className="text-center text-[11px] text-muted-foreground mt-3 font-mono">
                {t("fdr.journey_footer", {n: targetDays, track: track.name})}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Phase 5 — Coach Nudge banner */}
          </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CheckInCelebration overlay
// ─────────────────────────────────────────────────────────────────────────────

// CELEBRATION_PHRASES moved to i18n JSON (app.celebration_phrases)

function CheckInCelebration({ trackName, streak, onDismiss }: {
  trackName: string;
  streak: number;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const celebPhrases = t("app.celebration_phrases", { returnObjects: true }) as string[];
  const phrase = useMemo(() => celebPhrases[Math.floor(Math.random() * celebPhrases.length)], [celebPhrases]);
  const [progress, setProgress] = useState(100);
  const DURATION = 3000;

  // Ambient flash on mount (no confetti — cinematic, not casino)
  useEffect(() => {
    void 0; // intentional — the progress bar + coach flash carry the moment
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
  const { t } = useTranslation();
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
  const [plan, setPlan] = useState<Plan>('free');
  const [user, setUser] = useState<ElevateUser | null>(lsLoad(LS_USER, null));
  const [reengagement, setReengagement] = useState<{ daysMissed: number; trackName: string } | null>(null);
  const [trackCompletion, setTrackCompletion] = useState<{ trackName: string } | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
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
        await fetch('/api/push', {
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
        db.saveProfile(supabaseId, next.name, Intl.DateTimeFormat().resolvedOptions().timeZone, i18n.language).catch(() => {});
      // Welcome email (fires once per device)
      supabase.auth.getUser().then(({ data: { user: au } }) => {
        if (au?.email && !localStorage.getItem('forge_welcome_sent')) {
          localStorage.setItem('forge_welcome_sent', '1');
          fetch('/api/emails/send', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ type: 'welcome', email: au.email, name: au.user_metadata?.full_name }) }).catch(() => {});
        }
      });
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
          // Milestone email
          supabase.auth.getUser().then(({ data: { user: au } }) => {
            if (au?.email) {
              fetch('/api/emails/send', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ type: 'milestone', email: au.email, name: ut.name, milestone: newStreak }) }).catch(() => {});
            }
          });
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
      if (supabaseId) db.saveLog(supabaseId, newLog).then(r => { if (!r.ok) console.error('[forge] syncError:', r.error); });

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
          db.saveProfile(uid, displayName, Intl.DateTimeFormat().resolvedOptions().timeZone, i18n.language).catch(() => {});
          db.saveTracks(uid, [ut]).catch(() => {});
        }
      } else if (uid) {
        // No pending track — save profile only
        db.saveProfile(uid, displayName, Intl.DateTimeFormat().resolvedOptions().timeZone, i18n.language).catch(() => {});
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
                db.loadSubscription(uid).then(sub => {
          if (sub?.plan) setPlan(sub.plan as Plan);
        });
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

  // Morning coach / re-entry: emotionally intelligent trigger
  useEffect(() => {
    if (screen !== "dashboard" || tracks.length === 0) return;
    // Never interrupt a brand-new user on Day 1 — let them explore freely
    if (user?.createdAt) {
      const ageMs = Date.now() - new Date(user.createdAt).getTime();
      if (ageMs < 24 * 60 * 60 * 1000) return;
    }
    // Only activate once the user has completed at least one check-in
    const hasAnyActivity = tracks.some(t => (t.total_done ?? 0) > 0);
    if (!hasAnyActivity) return;
    // Once per calendar day
    const key = `forge-morning-${todayStr()}`;
    if (lsLoad<boolean>(key, false)) return;
    const maxGap = Math.max(...tracks.map(ut => {
      if (!ut.last_log_date) return 0;
      return Math.floor((Date.now() - new Date(ut.last_log_date).getTime()) / 86_400_000);
    }));
    // Slightly quicker for returning-after-miss users; slower for active daily users
    const delay = maxGap >= 1 ? 1100 : 2200;
    const timer = setTimeout(() => {
      if (maxGap >= 3) { setReEntryGap(maxGap); setShowReEntry(true); }
      else setShowMorningCoach(true);
    }, delay);
    return () => clearTimeout(timer);
  }, [screen, tracks.length, user?.createdAt]);

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
            <p className="text-sm font-semibold">{t("common.add_to_home")}</p>
            <p className="text-xs text-muted-foreground">{t("common.install_desc")}</p>
          </div>
          <button onClick={() => {
            (installPrompt as BeforeInstallPromptEvent)?.prompt?.();
            setShowInstallBanner(false);
          }} className="btn-chunk rounded-xl bg-foreground text-neutral-900 px-4 py-2 text-xs font-semibold">
            {t("common.install")}
          </button>
          <button onClick={() => setShowInstallBanner(false)} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
        </motion.div>
      )}
      <DashboardLayout currentPage={page} onNavigate={setPage}>
        {page === "home" && (
          <HomePage user={user!} tracks={tracks} onCheckIn={checkIn} onNavigate={setPage} onUpdateUser={updateUser} onView={setSelectedTrack} onViewForCheckIn={handleViewForCheckIn} onVacation={setVacation} />
        )}
        {page === "tracks" && <TracksPage userTracks={tracks} onAdd={(t, days) => addTrack(t, days)} onView={setSelectedTrack} onRemove={removeTrack} />}
        {page === "insights" && <InsightsPage userTracks={tracks} logs={logs} userId={supabaseId || undefined} />}
        {page === "settings" && <SettingsPage userName={user?.name ?? ""} onSignOut={handleSignOut} onUpdateName={name => updateUser({ name })}  islandTheme={user?.islandTheme ?? 'garden'} onChangeTheme={handleChangeTheme} shields={shields} tracks={tracks}/>}
            {user && shouldShowPaywall(plan, user.createdAt) && (
        <PaywallModal
          currentPlan={plan}
          accountCreatedAt={user.createdAt}
          onPlanChange={(p) => setPlan(p)}
        />
      )}
</DashboardLayout>
    </>
  );
}

