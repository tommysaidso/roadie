// Optional LLM layer for Ask ROADIE. Provider switch, all server-side.
// Order: Gemini (user preference) -> Anthropic -> null (caller uses deterministic brain).
// Every call is defensive: any failure returns null so the assistant never breaks.

export function activeProvider(): "gemini" | "anthropic" | null {
  if (process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY2) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

const SYSTEM_TPL = `You are ROADIE, an AI tour manager for Canadian bands - currently serving the {HUB} ({PROV}). Be concise and practical.
You help bands find gigs, route regional runouts, understand {PROV} site-permit/all-ages/noise rules, and claim sponsor perks.

ANSWER THE QUESTION THAT WAS ASKED. Do not open with a welcome, do not describe what ROADIE is, and do not mention signing in or signing up unless they asked about joining or the answer genuinely requires an account. {WHO} A person asking where to get a music video wants the answer to that, not an onboarding pitch — leading with one is the fastest way to lose them.

Only when someone explicitly asks how to join, or clearly says they are new and wants a tour, act as a concierge: explain what ROADIE and mymymy are (use the ABOUT context), then offer to walk them through by role (band/host site/fan/sponsor), and note they can also do it manually from the menu. If someone seems to be returning, route them to what they want. You can also guide bands through music-business paperwork (PRO/BMI/SOCAN registration, reading a contract, copyright in CA/US/EU) as GENERAL INFORMATION only, never definitive legal advice — always suggest confirming with their PRO or a music lawyer. Note mymymy is artists-only (the money/back-end).
Use the CONTEXT facts provided; never invent venues, dates, or rules not present in context.`;

function buildSystem(hubName = "Kelowna Hub", province = "BC",
                     who?: { signedIn?: boolean; name?: string }) {
  // Without this the model assumes every visitor is a stranger and pitches
  // joining at someone who signed in months ago — which reads as the assistant
  // not knowing who it is talking to.
  const whoLine = who?.signedIn
    ? `This person is ALREADY SIGNED IN${who.name ? ` as ${who.name}` : ""} — never suggest they sign up or create an account.`
    : "";
  return SYSTEM_TPL
    .replace(/\{HUB\}/g, hubName)
    .replace(/\{PROV\}/g, province)
    .replace(/\{WHO\}/g, whoLine);
}

export async function llmAnswer(question: string, context: string,
                                hub?: { name: string; province: string },
                                who?: { signedIn?: boolean; name?: string }): Promise<string | null> {
  const provider = activeProvider();
  try {
    const system = buildSystem(hub?.name, hub?.province, who);
    if (provider === "gemini") return await gemini(question, context, system);
    if (provider === "anthropic") return await anthropic(question, context, system);
  } catch { /* fall through to deterministic */ }
  return null;
}

async function gemini(q: string, context: string, system: string): Promise<string | null> {
  const keys = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY2].filter(Boolean) as string[];
  const model = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
  for (const key of keys) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: `CONTEXT:\n${context}\n\nQUESTION: ${q}` }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 1000 },
        }),
      });
      if (r.ok) {
        const d = await r.json();
        const txt = d?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") || null;
        if (txt) return txt;
      }
      // non-OK (e.g. 429 quota) -> try the next key
    } catch { /* try next key */ }
  }
  return null;
}

async function anthropic(q: string, context: string, system: string): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY!;
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    signal: AbortSignal.timeout(8000),
    body: JSON.stringify({
      model, max_tokens: 400, system,
      messages: [{ role: "user", content: `CONTEXT:\n${context}\n\nQUESTION: ${q}` }],
    }),
  });
  if (!r.ok) return null;
  const d = await r.json();
  return d?.content?.map((c: any) => c.text).join("") || null;
}
