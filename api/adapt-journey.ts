import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || "https://placeholder.invalid",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"
);

interface AdaptRequest {
  slug: string;
  trackName: string;
  category: string;
  startingPoint: string;
  motivation: string;
  obstacle: string;
  fromDay: number;
  count: number;
  recentTriggers?: string[];
  recentMoods?: number[];
  missedDays?: number;
  reason?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "No token" });
  const token = authHeader.slice(7);

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: "Invalid token" });

  const body: AdaptRequest = req.body;
  const {
    trackName, category, startingPoint, motivation, obstacle,
    fromDay, count, recentTriggers = [], recentMoods = [],
    missedDays = 0, reason = "",
  } = body;
  const langCode = ((body as { language?: string }).language ?? "en").slice(0, 2);
  const langName = ({ it: "Italian", es: "Spanish", de: "German", fr: "French", pt: "Portuguese" } as Record<string, string>)[langCode] ?? "English";

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "No API key" });

  const avgMood = recentMoods.length > 0
    ? (recentMoods.reduce((a, b) => a + b, 0) / recentMoods.length).toFixed(1)
    : null;

  const triggerSummary = recentTriggers.length > 0
    ? `Common triggers: ${[...new Set(recentTriggers)].slice(0, 3).join(", ")}`
    : "";

  const adaptContext = [
    missedDays > 0 ? `The user missed ${missedDays} day(s)${reason ? " because: " + reason : ""}.` : "",
    avgMood ? `Recent average mood: ${avgMood}/10.` : "",
    triggerSummary,
  ].filter(Boolean).join(" ");

  const systemPrompt = `IMPORTANT: Write ALL content in ${langName}. Natural, native ${langName} only.
You are a compassionate behavior change coach creating personalized daily tasks.
The user is working on: "${trackName}" (category: ${category}).
Their starting point: ${startingPoint}.
Their motivation: ${motivation}.
Their main obstacle: ${obstacle}.
${adaptContext}

Generate exactly ${count} daily tasks starting from day ${fromDay}.
Rules:
- Be compassionate and non-judgmental if they missed days
- Make tasks achievable and specific to their situation
- Reference their motivation and obstacle where helpful
- Vary task types: practical action, reflection, science insight
- Keep each task under 60 words
- If they missed days, start gently and rebuild momentum

Return ONLY valid JSON: {"days":[{"day":N,"task":"...","type":"action|reflection|science","duration":"X min"}]}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001", max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: "user", content: `Generate ${count} adapted days starting from day ${fromDay}.` }],
      }),
    });
    if (!response.ok) return res.status(502).json({ error: "Upstream error" });
    const data = await response.json() as { content: Array<{ type: string; text: string }> };
    const text = data.content.find(c => c.type === "text")?.text?.trim() ?? "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: "Invalid response format" });
    return res.json(JSON.parse(jsonMatch[0]));
  } catch (e) {
    console.error("adapt-journey error:", e);
    return res.status(500).json({ error: "Internal error" });
  }
}
