import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

webpush.setVapidDetails(
  "mailto:noreply@forgeapp.io",
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

// Archetype → persona name mapping
const ARCHETYPE_NAMES: Record<string, string> = {
  trainer: "Kai", teacher: "Iris", clinician: "Dr. Mara", mentor: "Roy", guide: "Sasha",
};
const TRACK_ARCHETYPE: Record<string, string> = {
  "strength-training": "trainer", "morning-run": "trainer", "cold-exposure": "trainer",
  "sedentary-lifestyle": "trainer", "no-social-media": "trainer", "quit-smoking": "trainer",
  "no-sugar": "trainer", "quit-alcohol": "trainer", "video-game-addiction": "trainer",
  "beat-procrastination": "trainer", "build-discipline": "trainer",
  "compulsive-shopping": "mentor", "quit-gambling": "mentor", "deep-work": "mentor",
  "fear-of-failure": "mentor", "toxic-relationships": "mentor", "control-issues": "mentor",
  "money-management": "mentor",
  "quit-pornography": "clinician", "quit-drugs": "clinician", "binge-eating": "clinician",
  "meditation": "clinician", "anxiety-relief": "clinician", "journaling": "clinician",
  "sleep-routine": "clinician", "breathwork": "clinician", "stop-overthinking": "clinician",
  "social-anxiety": "clinician", "anger-management": "clinician", "chronic-stress": "clinician",
  "low-self-esteem": "clinician", "need-for-approval": "clinician", "fear-of-judgment": "clinician",
  "emotional-dependency": "clinician", "toxic-perfectionism": "clinician", "jealousy": "clinician",
  "social-isolation": "guide", "negative-mindset": "guide", "stop-self-sabotage": "guide",
  "gratitude": "guide",
  "reading": "teacher", "language": "teacher",
};

// Per-archetype rotating messages
const PUSH_MESSAGES: Record<string, string[]> = {
  trainer: [
    "Check-in time. No excuses accepted.",
    "Your streak doesn't protect itself. Go.",
    "One check-in. That's all it takes today.",
    "Don't overthink it. Just show up.",
    "You've shown up before. Do it again.",
  ],
  teacher: [
    "Small, consistent steps. Today's is waiting.",
    "Your progress compounds every single day.",
    "One more data point in your growth graph.",
    "Show up today — even briefly.",
    "Learning never stops. Neither does progress.",
  ],
  clinician: [
    "How are you feeling today? Check in with yourself.",
    "Your journey is worth continuing. I'm here.",
    "Just a moment of honesty with yourself today.",
    "Progress is gentle. Show up with kindness.",
    "You don't have to be perfect. Just present.",
  ],
  mentor: [
    "Strategy requires consistency. Check in.",
    "The system works when you work the system.",
    "Every day you execute, you compound your edge.",
    "This is the work. Do the work.",
    "Showing up is the decision. Everything else follows.",
  ],
  guide: [
    "The path is still here, waiting for you.",
    "Your journey deepens with every return.",
    "Come back to yourself today.",
    "A single step counts. What's yours today?",
    "The ritual is the point. Time to begin.",
  ],
  _default: [
    "Your check-in is waiting.",
    "Keep the streak alive — just one check-in.",
    "Today's the day. Don't skip it.",
    "A small act of consistency changes everything.",
    "Your coach is waiting to hear from you.",
  ],
};

function localHour(tz: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hour: "numeric", hour12: false,
    }).formatToParts(new Date());
    const h = parts.find((p) => p.type === "hour");
    return h ? parseInt(h.value, 10) : new Date().getUTCHours();
  } catch {
    return new Date().getUTCHours();
  }
}

function pickMessage(archetypeId: string, streak: number): { title: string; body: string } {
  const msgs = PUSH_MESSAGES[archetypeId] ?? PUSH_MESSAGES._default;
  const coachName = ARCHETYPE_NAMES[archetypeId] ?? "Your coach";
  const body = msgs[Math.floor(Math.random() * msgs.length)];
  const title = streak > 1 ? `Forge · Day ${streak + 1}` : "Forge";
  return { title, body: `${coachName}: ${body}` };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers["x-cron-secret"] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const today = new Date().toISOString().slice(0, 10);

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select(`endpoint, p256dh, auth, user_id, profiles!inner(reminder_hour, timezone)`);

  if (error || !subs) {
    return res.status(500).json({ error: error?.message ?? "No data" });
  }

  let sent = 0;
  let skipped = 0;

  for (const sub of subs) {
    const profile = Array.isArray(sub.profiles) ? sub.profiles[0] : sub.profiles as { reminder_hour?: number; timezone?: string };
    const reminderHour: number = profile?.reminder_hour ?? 9;
    const tz: string = profile?.timezone ?? "UTC";
    const userLocalHour = localHour(tz);

    if (userLocalHour !== reminderHour) { skipped++; continue; }

    // Skip if already checked in today
    const { data: checkin } = await supabase
      .from("check_ins").select("id")
      .eq("user_id", sub.user_id).eq("log_date", today).maybeSingle();
    if (checkin) { skipped++; continue; }

    // Get primary track for archetype + streak
    const { data: tracks } = await supabase
      .from("user_tracks").select("slug, current_streak")
      .eq("user_id", sub.user_id).order("current_streak", { ascending: false }).limit(1);

    const primaryTrack = tracks?.[0];
    const archetypeId = primaryTrack ? (TRACK_ARCHETYPE[primaryTrack.slug] ?? "_default") : "_default";
    const streak = primaryTrack?.current_streak ?? 0;
    const { title, body } = pickMessage(archetypeId, streak);

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title, body, url: "/home" })
      );
      sent++;
    } catch (e) {
      console.error("Push failed for", sub.user_id, e);
    }
  }

  return res.status(200).json({ sent, skipped });
}
