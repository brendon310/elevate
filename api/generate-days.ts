import type { VercelRequest, VercelResponse } from "@vercel/node";

// Track-specific task archetypes so the AI knows what KIND of actions to generate
const TRACK_TASK_HINTS: Record<string, string> = {
  "quit-smoking": "Remove all cigarettes, lighters, ashtrays. Block purchase sites. Replace with gum/nicotine patch. Text a friend. Identify your 3 triggers.",
  "quit-alcohol": "Pour out or remove alcohol at home. Block alcohol delivery apps. Identify your drinking triggers and replace rituals (sparkling water in a wine glass, etc.).",
  "quit-pornography": "Delete all pornographic apps. Use Screen Time (iOS) / Digital Wellbeing (Android) to block adult sites. Clean your social media feeds of triggering accounts. Remove bookmarks. Install BlockSite or similar.",
  "quit-drugs": "Remove all substances and paraphernalia from your environment. Block dealer contacts. Identify the emotional state that triggers use. Find a substitute ritual.",
  "quit-gambling": "Delete all gambling apps. Block gambling websites. Remove your credit card from betting sites. Call your bank to block gambling transactions. Find a substitute dopamine activity.",
  "no-social-media": "Delete social media apps from your phone. Log out on all browsers. Use app-blockers (Freedom, Cold Turkey). Replace scroll time with a specific 5-minute ritual.",
  "no-smartphone": "Put phone in another room for 1 hour. Enable grayscale mode. Turn off all non-essential notifications. Create phone-free zones (bedroom, dinner table).",
  "no-sugar": "Read all food labels today. Discard hidden sugars from pantry. Replace with whole fruit. Prepare a sugar-free snack for tomorrow.",
  "binge-eating": "Remove binge-trigger foods from home. Eat scheduled meals at set times. Use a smaller plate. Log what you eat — not calories, just awareness.",
  "compulsive-shopping": "Delete shopping apps. Unsubscribe from all promo emails. Add a 48-hour rule before any purchase. Make a list of what you own already.",
  "impulsive-spending": "Check your bank statement and highlight impulse buys. Remove saved cards from online stores. Create a weekly spending cap in cash.",
  "video-game-addiction": "Uninstall one game. Set a hard timer: 45-min sessions max. Move your console/PC out of your bedroom. Plan one non-gaming activity for today.",
  "beat-procrastination": "Write ONE task you've been avoiding. Set a 10-minute timer and start only that. Use the 2-minute rule: if it takes less than 2 minutes, do it NOW.",
  "build-discipline": "Define your one non-negotiable daily action for this week. Do it first thing tomorrow. Track it with a streak. Tell someone your commitment.",
  "lack-of-motivation": "Write down the real reason you started this. Make your goal visible (phone wallpaper, sticky note). Take one micro-action toward it — even 5 minutes counts.",
  "chronic-laziness": "Set an alarm 30 minutes earlier. Prepare tomorrow's clothes tonight. Do 5 jumping jacks upon waking. Start the day with a win, however small.",
  "stop-overthinking": "Write down the thought loop that's spinning. Ask: Is this within my control? Circle yes or no. For 'no' items, write: I release this. Set a 10-min worry window.",
  "social-anxiety": "Make one small social move today: smile at a stranger, hold a door, say hi to a coworker. No expectation of outcome — just the action.",
  "anger-management": "Identify your anger trigger from the last 48 hours. Write what you felt in your body before the explosion. Practice: 4 counts in, hold 4, out 6.",
  "chronic-stress": "List your top 3 stressors. Circle the one you CAN influence today. Make one move on it. Then do 5 minutes of box breathing.",
  "social-isolation": "Send one message to someone you haven't spoken to in a while. It can be short. Just reconnect. Schedule one real-world activity this week.",
  "negative-mindset": "Write 3 things that went OK today — not great, just OK. Rewire starts small. Catch one negative thought and rephrase it as a neutral observation.",
  "breathwork": "Do 4-7-8 breathing: inhale 4s, hold 7s, exhale 8s. Repeat 4 cycles. Do this morning and evening. Track how your body feels before and after.",
  "low-self-esteem": "Write 3 things you did well this week — skills, kindness, effort. Read them out loud. Add one compliment about yourself that you actually believe.",
  "need-for-approval": "Do one thing today without mentioning it to anyone. Keep it just for you. Notice how it feels to act without validation.",
  "fear-of-failure": "Name the thing you've been avoiding because you might fail. Break it into the smallest possible first step. Take that step today. Failure is data.",
  "fear-of-judgment": "Do one thing today that you'd normally edit for an audience: send a message without proofreading 10 times, post something real, speak your opinion.",
  "emotional-dependency": "Spend 30 minutes alone without checking who's texted you. Journal: what am I feeling? What do I need that I'm looking for in others?",
  "toxic-relationships": "Write the name of the person or dynamic that drains you. Define ONE boundary. You don't need to enforce it today — just name it clearly.",
  "control-issues": "Identify one thing you tried to control today that wasn't yours to control. Write: What would happen if I let this go? Sit with the answer.",
  "narcissism": "Ask someone how they're doing — and listen without redirecting the conversation to yourself for the entire exchange. Just listen.",
  "victim-mentality": "Write one situation where you felt like a victim. Rewrite it from the angle: what was MY role? What could I have done differently?",
  "stop-self-sabotage": "Identify the last time you sabotaged yourself. What belief was underneath it? ('I don't deserve this', 'It'll go wrong anyway'). Name the belief.",
  "lust-control": "Identify your top 3 lust triggers (time of day, emotional state, content). For each one, write a redirect action. Block one trigger source today.",
  "toxic-perfectionism": "Ship something imperfect today. Send the email, submit the draft, post the thing. Done > perfect. Write down what 'good enough' looks like for one project.",
  "jealousy": "Write who you're jealous of and exactly what you're jealous of. Ask: what does this tell me about what I actually want? Make it a roadmap, not a wound.",
  "envy": "Name one person you envy. Write 3 genuine good things about them. Then write: what in their life am I actually craving for myself?",
  "money-management": "Open your bank app and categorize last week's spending into: needs / wants / waste. Set one rule for the coming week. Automate one saving, even $5.",
  "meditation": "Sit for 5 minutes. Focus only on your breath. When a thought comes, label it 'thinking' and return to breath. This is the entire practice.",
  "morning-run": "Lay out your running clothes tonight. Set your alarm 15 min earlier. Walk 5 min, run 1 min, walk 5 min. Build the ritual, not the pace.",
  "strength-training": "Do 3 sets of one compound movement (push-up, squat, or deadlift). Focus on form, not load. Log: sets, reps, how it felt.",
  "deep-work": "Block 90 minutes on your calendar with zero notifications. One task only. Phone in another room. Start with the hardest thing.",
  "reading": "Read for 15 minutes before you pick up your phone in the morning. Put the book on your nightstand tonight so it's the first thing you see.",
  "sleep-routine": "Set a consistent bedtime alarm. 30 minutes before: no screens. Write 3 things from today. Cool the room. This is your pre-sleep protocol.",
  "anxiety-relief": "Write down what's making you anxious. Rate each item 1-10 for how much you can influence it. Work only on the controllables today.",
  "journaling": "Write 3 pages longhand — no filter, no reread. This is called Morning Pages. Write whatever comes. Speed matters more than quality.",
  "cold-exposure": "End your shower with 30 seconds of cold water. Focus on slow exhales, not fighting it. Increase by 10 seconds each day.",
  "sedentary-lifestyle": "Stand up from your desk every 30 minutes. Take a 10-minute walk after lunch. Set a reminder. Movement is medicine.",
  "gratitude": "Write 3 specific things you're grateful for — not generic ('health'), but specific ('the quiet hour I had this morning'). Name why each one matters.",
  "lack-of-self-control": "Pick one area of weakness today (food, phone, spending). Set one rule and tell someone. Accountability doubles your follow-through.",
  "victim-mentality": "Write one situation where you felt like a victim. Rewrite it from the angle: what was MY role? What could I have done differently?",
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { slug, trackName, category, startingPoint, motivation, obstacle, fromDay, count } = req.body as {
    slug: string; trackName: string; category: string;
    startingPoint: string; motivation: string; obstacle: string;
    fromDay: number; count: number;
  };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });

  const taskHint = TRACK_TASK_HINTS[slug] ?? `Concrete, specific daily action for ${trackName}.`;

  const systemPrompt = `You are a world-class behavior change coach. Design a deeply personal daily program for someone on the "${trackName}" path (category: ${category}).

Generate exactly ${count} daily entries for days ${fromDay} through ${fromDay + count - 1}.

USER CONTEXT:
- Their starting point: "${startingPoint}"
- Their motivation: "${motivation}"
- Their main obstacle: "${obstacle}"

TRACK-SPECIFIC TASK STYLE GUIDE:
${taskHint}

STRICT RULES FOR EACH FIELD:

**TITLE** (max 8 words): Action-oriented, exciting, makes you want to read more. NOT generic like "Day 7 Challenge". Example: "Delete Every Escape Route — For Good."

**DESCRIPTION** (2-3 sentences): Speak directly to the user ("you"). Acknowledge where they are on the journey emotionally. Build narrative continuity — reference the path they've been on, what's coming.

**TASK** (80-180 words): This is the MISSION. It must:
- Be a specific, concrete action the user can COMPLETE TODAY in one session
- For addiction/quit paths: include removing access, creating friction, building replacement behaviors
- Include exact steps (what app to open, what to write, what to say to whom)
- End with ONE sentence that explains WHY this specific action matters for their brain/habits
- Feel exciting and purposeful, not homework
- Reference their specific obstacle: "${obstacle}"

**REFLECTION** (one powerful question): Should be DIFFERENT every day. Rotate between:
- Days 1-7: identity questions ("Who are you becoming?")
- Days 8-14: pattern questions ("What triggered this today?")
- Days 15-21: resistance questions ("Where did you almost give up, and what pulled you back?")
- Days 22+: integration questions ("How is your relationship with yourself changing?")

**SCIENCE** (1-2 sentences): One fascinating, specific piece of neuroscience or behavioral research that makes this day's action make sense. Include approximate stats or study references (e.g., "A 2012 Duke study found...").

**CHECKIN PROMPT** (varied daily): Rotate styles each day:
- Rating: "On a scale of 1-10, how present were you during today's task? What would make it a 10 tomorrow?"
- Specific: "Describe the exact moment today when you felt the pull to revert — and what you did instead."
- Future: "What is ONE thing you'll do differently tomorrow based on today?"
- Body: "Where in your body do you feel the effect of today's practice?"
- Identity: "Complete this sentence: 'Today I proved to myself that I am someone who ___'"

VARIETY IS ESSENTIAL. Days must build on each other. Early days (1-7): remove temptations, establish identity, build foundation. Middle days (8-30): deepen habits, handle setbacks, build resilience. Later days (30+): maintain, celebrate growth, prevent complacency.

Return ONLY valid JSON, no markdown, no explanation:
{"days":[{"title":"string","description":"string","task":"string","reflection":"string","science":"string","checkinPrompt":"string"}]}`;

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
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{
          role: "user",
          content: `Generate days ${fromDay} to ${fromDay + count - 1} for the "${trackName}" journey (slug: ${slug}). Make each day feel distinct, exciting, and actionable. The user's biggest obstacle is: "${obstacle}". Their deepest motivation is: "${motivation}".`,
        }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic error:", err);
      return res.status(502).json({ error: "Upstream API error" });
    }

    const data = await response.json() as { content: Array<{ type: string; text: string }> };
    const raw = data.content.find(c => c.type === "text")?.text ?? "{}";

    // Strip potential markdown code fences
    const cleaned = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    const parsed = JSON.parse(cleaned) as { days: object[] };
    return res.json(parsed);
  } catch (e) {
    console.error("generate-days error:", e);
    return res.status(500).json({ error: "Internal error" });
  }
}
