import { NextRequest, NextResponse } from "next/server";
import { run } from "@/lib/db";
import { bridgeEnabled, verifyBridge } from "@/lib/bridge";

export const dynamic = "force-dynamic";

// LOCALJAMS BRIDGE RECEIVER — the door a partner property knocks on.
//
// Everything verified lands durably in bridge_inbox before any feature touches
// it: intake and processing are separate jobs, and a message from a partner is
// never lost because the feature that consumes it hasn't shipped yet.

function off() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

const KINDS = new Set(["ping", "event.push", "tokens.sync", "profile.claim"]);

export async function GET() {
  if (!bridgeEnabled()) return off();
  // A peer checking the door exists. Says nothing about who is enrolled.
  return NextResponse.json({ ok: true, service: "roadie-bridge", kinds: [...KINDS] });
}

export async function POST(req: NextRequest) {
  if (!bridgeEnabled()) return off();

  const property = req.headers.get("x-bridge-property") || "";
  const timestamp = req.headers.get("x-bridge-timestamp") || "";
  const signature = req.headers.get("x-bridge-signature") || "";
  const rawBody = await req.text();

  const v = verifyBridge(property, timestamp, signature, rawBody);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 401 });

  let body: any = {};
  try { body = JSON.parse(rawBody); } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const kind = String(body.kind || "");
  if (!KINDS.has(kind)) {
    return NextResponse.json({ error: "Unknown kind." }, { status: 400 });
  }

  if (kind === "ping") {
    return NextResponse.json({ ok: true, pong: true, property });
  }

  // Durable intake. Processing ships with each feature.
  run(
    `INSERT INTO bridge_inbox (property, kind, payload, signature) VALUES (?,?,?,?)`,
    property, kind, rawBody, signature,
  );
  return NextResponse.json({ ok: true, accepted: kind });
}
