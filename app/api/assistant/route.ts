import { NextRequest, NextResponse } from "next/server";
import { ask } from "@/lib/assistant";
import { llmAnswer, activeProvider } from "@/lib/llm";
import { roadieContext } from "@/lib/context";
import { getHub, hubLoop } from "@/lib/hubs";
import { userForToken, SESSION_COOKIE } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function POST(req:NextRequest){
  const { q } = await req.json();
  const question = String(q||"");
  // Active hub scopes rules, the runout answer, and the LLM's identity.
  const hub = getHub(req.cookies.get("roadie_hub")?.value);
  const hubCtx = { name: hub.name, province: hub.province, loop: hubLoop(hub) };
  // Who is asking? The assistant is open to everyone, but it must not pitch
  // signing up at someone who is already signed in.
  let who: { signedIn?: boolean; name?: string } = { signedIn: false };
  try {
    const u = userForToken(req.cookies.get(SESSION_COOKIE)?.value);
    if (u) who = { signedIn: true, name: u.display_name || undefined };
  } catch {}

  let viaLlm: string | null = null;
  try {
    viaLlm = await llmAnswer(question, roadieContext(hub.rules_region || hub.province),
      { name: hub.name, province: hub.province }, who);
  } catch {}
  let answer: string;
  try { answer = viaLlm ?? ask(question, hubCtx); }
  catch { answer = "I glitched on that one - say it again?"; }
  return NextResponse.json({ answer, provider: viaLlm ? activeProvider() : "offline" });
}
