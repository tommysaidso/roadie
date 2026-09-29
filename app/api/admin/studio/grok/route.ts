import { NextRequest, NextResponse } from "next/server";
import { requireUser, isElevated, forbid } from "@/lib/guard";
import { grokQueue, grokPoll, grokReachable, usdFromTicks, GROK_VIDEO_MODELS, GROK_DEFAULT_MODEL } from "@/lib/grok";

export const dynamic = "force-dynamic";

// The Grok video lane. Kept in its own route rather than folded into the pool
// routes, because it is the one lane that spends money and it should be
// obvious in the code — and in the network tab — when it is being used.

export async function GET(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("The studio is operator-only.");

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({
      ...grokReachable(),
      models: Object.entries(GROK_VIDEO_MODELS).map(([k, v]) => ({ id: k, ...v })),
      default: GROK_DEFAULT_MODEL,
    });
  }

  const job = await grokPoll(id);
  return NextResponse.json({
    ...job,
    usd: job.ticks != null ? usdFromTicks(job.ticks) : null,
  });
}

export async function POST(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("The studio is operator-only.");

  const b = await req.json().catch(() => ({} as any));
  const prompt = String(b?.prompt || "").trim();
  if (!prompt) return NextResponse.json({ error: "Grok needs a prompt." }, { status: 400 });

  const model = String(b?.model || GROK_DEFAULT_MODEL);
  if (!(model in GROK_VIDEO_MODELS)) {
    return NextResponse.json({ error: `Unknown Grok model ${model}.` }, { status: 400 });
  }

  const r = await grokQueue(prompt, model as any);
  if (r.error) return NextResponse.json({ error: r.error }, { status: 502 });
  return NextResponse.json({ id: r.id, model });
}
