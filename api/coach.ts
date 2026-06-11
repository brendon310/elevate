import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyUser } from "./_auth.js";
import { rateLimit } from "./_ratelimit.js";
import { getUserPlan, countCoachMessagesThisMonth, PLAN_LIMITS } from "./_plans.js";

interface ChatMsg { role: "user" | "assistant"; content: string; }

const ARCHETYPES: Record<string, string> = {
  trainer: "You are Kai, a direct no-bullshit performance coach. Short punchy sentences. Hold the user accountable. Celebrate effort, never excuses. Push past comfort with warmth. Never preachy. Keep replies under 120 words.",
  teacher: "You are Iris, a calm curious teacher. Break change into small learnable steps. Ask great questions before giving answers. Clear examples, treat user as intelligent adult. Patient, structured. Keep replies under 120 words.",
  clinician: "You are Dr. Mara, a warm evidence-based mental health coach. Validate first, then guide. Speak gently. Reference CBT, ACT, polyvagal in plain language. Never minimize feelings. Keep replies under 120 words.",
  mentor: "You are Roy, a sharp strategic mentor. Think in systems. Ask hard questions. Give crisp actionable frameworks. No fluff, no platitudes. Keep replies under 120 words.",
  guide: "You are Sasha, a creative soulful guide. Speak with imagery and metaphor. Honour the user's deeper why. Make practice feel like play. Blend craft, ritual, meaning. Keep replies under 120 words.",
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = await verifyUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (!rateLimit(`coach:${user.id}`, 30, 60_000)) return res.status(429).json({ error: "Rate limit exceeded" });

  const { archetype, messages, userContext, voice, context } = req.body as {
    slug?: string;
    archetype?: string;
    messages: ChatMsg[];
    userContext?: { startingPoint: string; motivation: string; daysCompleted: number; totalDays: number };
    // Morning-coach shape (no archetype/userContext):
    voice?: string;
    context?: string;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Missing messages" });
  }

  // Server-side plan enforcement — only for the interactive chat (archetype present).
  // The automated morning nudge is not user-initiated and is not metered.
  if (archetype) {
    const plan = await getUserPlan(user.id);
    const limit = PLAN_LIMITS[plan].coachMessagesMonth;
    if (limit > 0) {
      const used = await countCoachMessagesThisMonth(user.id);
      if (used >= limit) {
        return res.status(402).json({ error: "quota_exceeded", limit, used });
      }
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });

  const persona = archetype
    ? (ARCHETYPES[archetype] ?? ARCHETYPES.teacher)
    : (voice ? `You are the user's habit coach. Voice: ${voice}.` : ARCHETYPES.teacher);
  const ctxLine = userContext
    ? `User context: starting point: "${userContext.startingPoint}", motivation: "${userContext.motivation}", days completed: ${userContext.daysCompleted}/${userContext.totalDays}.`
    : (context ?? "");
  const systemPrompt = `${persona}\n${ctxLine}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        system: systemPrompt,
        messages: messages.slice(-10),
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic error:", err);
      return res.status(502).json({ error: "Upstream API error" });
    }

    const data = await response.json() as { content: Array<{ type: string; text: string }> };
    const message = data.content.find(c => c.type === "text")?.text ?? "I'm here. Keep going.";
    // `reply` kept for the morning-coach client, `message` for the chat client.
    return res.json({ message, reply: message });
  } catch (e) {
    console.error("coach error:", e);
    return res.status(500).json({ error: "Internal error" });
  }
}
