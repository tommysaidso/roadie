import { NextRequest, NextResponse } from "next/server";
import { requireUser, isElevated, forbid } from "@/lib/guard";
import {
  runpodQueue, runpodPoll, runpodReachable, RUNPOD_ENDPOINTS, RunpodLane,
} from "@/lib/runpod";

export const dynamic = "force-dynamic";

// The RunPod lanes — for when the machines at home are off.
//
// Its own route for the same reason as Grok: this one spends money, and that
// should be visible in the code and in the network tab.

export async function GET(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("The studio is operator-only.");

  const u = new URL(req.url);
  const id = u.searchParams.get("id");
  const lane = (u.searchParams.get("lane") || "vidu") as RunpodLane;

  if (!id) {
    return NextResponse.json({
      ...runpodReachable(),
      lanes: Object.entries(RUNPOD_ENDPOINTS).map(([k, v]) => ({ id: k, ...v })),
    });
  }
  if (!(lane in RUNPOD_ENDPOINTS)) {
    return NextResponse.json({ error: `Unknown lane ${lane}.` }, { status: 400 });
  }
  return NextResponse.json(await runpodPoll(lane, id));
}

export async function POST(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isElevated(g.user)) return forbid("The studio is operator-only.");

  const b = await req.json().catch(() => ({} as any));
  const lane = String(b?.lane || "vidu") as RunpodLane;
  if (!(lane in RUNPOD_ENDPOINTS)) {
    return NextResponse.json({ error: `Unknown lane ${lane}.` }, { status: 400 });
  }
  const prompt = String(b?.prompt || "").trim();
  if (!prompt) return NextResponse.json({ error: "Needs a prompt." }, { status: 400 });

  let input: Record<string, any>;

  if (lane === "wan25") {
    // Image-to-video, same fetch constraint as VIDU: the endpoint pulls the
    // still itself, so it must be a public URL or an inline data: image.
    const image = String(b?.image || "").trim();
    if (!image) return NextResponse.json({ error: "WAN 2.5 animates a still — pass an image." }, { status: 400 });
    if (!/^https?:\/\//i.test(image) && !/^data:image\//i.test(image)) {
      return NextResponse.json({
        error: "WAN 2.5 has to fetch the still itself. A NAS path won't do — use a public URL or an inline data: image.",
      }, { status: 400 });
    }
    const size = ["480p", "720p", "1080p"].includes(String(b?.size)) ? String(b.size) : "480p";
    const duration = [5, 10].includes(Number(b?.duration)) ? Number(b.duration) : 5;
    input = {
      prompt, image,
      negative_prompt: String(b?.negative || ""),
      size, duration,
      seed: Number.isFinite(b?.seed) ? Number(b.seed) : -1,
      // Off by default: prompt expansion rewrites what you wrote, and his
      // standing rule is that the writer's words are the writer's words.
      enable_prompt_expansion: !!b?.expand,
      enable_safety_checker: true,
    };
    // Optional audio drives the lip-sync. Same reachability rule as the image.
    const audio = String(b?.audio || "").trim();
    if (audio) {
      if (!/^https?:\/\//i.test(audio) && !/^data:audio\//i.test(audio)) {
        return NextResponse.json({
          error: "The audio has to be fetchable too — a public URL or an inline data: audio.",
        }, { status: 400 });
      }
      input.audio = audio;
    }
  } else if (lane === "vidu") {
    // Image-to-video: the endpoint FETCHES the image, so it has to be
    // somewhere RunPod can actually reach. Our stills sit behind the studio's
    // auth on the NAS, which RunPod cannot see — so a public URL or an inline
    // data URI is required, and saying so beats a job that fails ten minutes
    // later with "could not load image".
    const image = String(b?.image || "").trim();
    if (!image) {
      return NextResponse.json({ error: "VIDU animates a still — pass an image." }, { status: 400 });
    }
    if (!/^https?:\/\//i.test(image) && !/^data:image\//i.test(image)) {
      return NextResponse.json({
        error: "VIDU has to fetch the still itself. A NAS path won't do — use a public URL or an inline data: image.",
      }, { status: 400 });
    }
    input = {
      prompt, image,
      size: String(b?.size || "720p"),
      // 5 or 10. Longer than that is not on offer, and stitching two 10s
      // clips on the timeline is the way to go past it.
      duration: [5, 10].includes(Number(b?.duration)) ? Number(b.duration) : 5,
      movement_amplitude: String(b?.movement || "auto"),
      generate_audio: b?.audio !== false,
      bgm: !!b?.bgm,
      seed: Number.isFinite(b?.seed) ? Number(b.seed) : -1,
      enable_safety_checker: true,
    };
  } else {
    input = {
      prompt,
      size: String(b?.size || "1024*1024"),
      seed: Number.isFinite(b?.seed) ? Number(b.seed) : -1,
      enable_safety_checker: true,
    };
  }

  const r = await runpodQueue(lane, input);
  if (r.error) return NextResponse.json({ error: r.error }, { status: 502 });
  return NextResponse.json({ id: r.id, lane });
}
