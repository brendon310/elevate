import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || "https://placeholder.invalid",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "No token" });
  const token = authHeader.slice(7);

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: "Invalid token" });
  const userId = user.id;

  // Max one nudge per day
  const today = new Date().toISOString().slice(0, 10);
  const { data: recentNudge } = await supabaseAdmin
    .from("coach_nudges").select("id").eq("user_id", userId)
    .gte("created_at", today + "T00:00:00Z").limit(1);
  if (recentNudge && recentNudge.length > 0) {
    return res.json({ nudge: null, reason: "already_sent_today" });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data: checkIns } = await supabaseAdmin
    .from("check_ins")
    .select("log_date, mood, had_urge, urge_intensity, trigger_label, hour_of_day, track_id")
    .eq("user_id", userId).gte("created_at", thirtyDaysAgo)
    .order("log_date", { ascending: false });

  const { data: userTracks } = await supabaseAdmin
    .from("user_tracks").select("slug, name, current_streak, last_log_date").eq("user_id", userId);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "No API key" });

  const todayStr  = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const twoDaysAgo= new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);

  let nudgeType: string | null = null;
  let context = "";
  let trackName = "";

  for (const track of (userTracks || [])) {
    const last = track.last_log_date;
    if (last && last !== todayStr && last !== yesterday && last <= twoDaysAgo) {
      const daysSince = Math.floor((Date.now() - new Date(last + "T12:00:00Z").getTime()) / 86400000);
      if (daysSince >= 2) {
        nudgeType = "inactivity";
        context = `The user has not checked in for ${daysSince} days. Their track "${track.name}" had a ${track.current_streak}-day streak.`;
        trackName = track.name;
        break;
      }
    }
  }

  if (!nudgeType && checkIns) {
    const recentHighUrge = checkIns.filter(c => {
      const diff = Math.floor((Date.now() - new Date(c.log_date + "T12:00:00Z").getTime()) / 86400000);
      return diff <= 7 && c.had_urge && (c.urge_intensity || 0) >= 7;
    });
    if (recentHighUrge.length >= 3) {
      const triggers = recentHighUrge.map(c => c.trigger_label).filter(Boolean);
      const top = triggers.length > 0 ? triggers[0] : "various situations";
      nudgeType = "high_urge";
      context = `User reported high urges (7+/10) on ${recentHighUrge.length} of the last 7 days. Top trigger: ${top}.`;
    }
  }

  if (!nudgeType && checkIns) {
    const withMood = checkIns.slice(0, 5).filter(c => c.mood);
    if (withMood.length >= 3) {
      const avg = withMood.reduce((s, c) => s + (c.mood || 5), 0) / withMood.length;
      if (avg < 4) {
        nudgeType = "low_mood";
        context = `User's average mood over last ${withMood.length} check-ins is ${avg.toFixed(1)}/10 — they may be struggling.`;
      }
    }
  }

  if (!nudgeType) {
    const broken = (userTracks || []).find(t =>
      t.current_streak === 0 && (checkIns || []).some(c => c.track_id === t.slug)
    );
    if (broken) {
      nudgeType = "streak_broken";
      context = `User's streak on "${broken.name}" was recently broken. Last check-in: ${broken.last_log_date}.`;
      trackName = broken.name;
    }
  }

  if (!nudgeType) return res.json({ nudge: null, reason: "no_trigger" });

  const systemPrompt = `You are a compassionate behavior change coach inside the Forge app.
Write ONE short in-app message (2-3 sentences max) based on the user's situation.
Rules: never shame or guilt-trip. Be warm, specific, caring. End with one gentle actionable suggestion. No emojis.`;

  const promptMap: Record<string, string> = {
    inactivity:    `Situation: ${context}\nWrite a warm comeback message that acknowledges the gap without judgment and gently invites them back.`,
    high_urge:     `Situation: ${context}\nWrite a supportive message acknowledging their struggle and offering one concrete coping strategy.`,
    low_mood:      `Situation: ${context}\nWrite a gentle check-in message that validates their feelings and suggests one small positive action.`,
    streak_broken: `Situation: ${context}\nWrite an encouraging restart message — no shame, pure forward momentum.`,
  };

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001", max_tokens: 200,
        system: systemPrompt,
        messages: [{ role: "user", content: promptMap[nudgeType] || promptMap.inactivity }],
      }),
    });
    if (!response.ok) return res.status(502).json({ error: "Upstream error" });
    const data = await response.json() as { content: Array<{ type: string; text: string }> };
    const message = data.content.find(c => c.type === "text")?.text?.trim() ?? "";
    if (!message) return res.json({ nudge: null });

    const ctaMap: Record<string, { label: string; route: string }> = {
      inactivity:    { label: "Resume journey", route: "journey" },
      high_urge:     { label: "Open SOS tools", route: "sos" },
      low_mood:      { label: "Check in now",   route: "home" },
      streak_broken: { label: "Start fresh",    route: "home" },
    };
    const cta = ctaMap[nudgeType];

    await supabaseAdmin.from("coach_nudges").insert({
      user_id: userId, track_slug: trackName || null,
      nudge_type: nudgeType, message,
      cta_label: cta?.label ?? null, cta_route: cta?.route ?? null,
    });

    return res.json({ nudge: { type: nudgeType, message, cta } });
  } catch (e) {
    console.error("proactive-coach error:", e);
    return res.status(500).json({ error: "Internal error" });
  }
}
