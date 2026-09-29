import { NextRequest, NextResponse } from "next/server";
import { requireUser, rateLimit } from "@/lib/guard";
import { all, one } from "@/lib/db";
import { startUpload, completeUpload, storageReady, LICENCE_TEXT } from "@/lib/fanclips";
import { verifyShareToken } from "@/lib/shareTokens";

export const dynamic = "force-dynamic";

// FAN UPLOAD — the phone's half of the multicam.
//
// Two calls, and the bytes go through neither of them:
//   GET               -> what you are agreeing to, before you agree to it
//   POST {start}      -> a URL that uploads STRAIGHT TO R2
//   POST {complete}   -> the phone says it finished
//
// Signing in is required, and not for gatekeeping: we are taking a licence to
// publish somebody's footage and credit them by name. An anonymous grant from
// an address we cannot reach is not a licence worth having, and it leaves the
// uploader no way to ask for their clip back.
//
// GUEST LANE (dark unless ROADIE_FAN_GUEST=1): a QR code at a venue reaches
// people with no ROADIE account and no time to make one mid-show. An email
// address plays the same role a session does — a way to reach them and the
// thing they present on "complete" to prove the clip was theirs. Signed-in
// callers are unaffected; requireUser succeeds for them and guestEmail is
// never consulted.

const GUEST_MODE = () => process.env.ROADIE_FAN_GUEST === "1";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  // The recent nights only. A fan uploads hours or days after a show, not
  // months, and a list of every stop we have ever run is a scroll nobody
  // finishes on a phone.
  return NextResponse.json({
    ok: true,
    ready: storageReady(),
    licence: LICENCE_TEXT,
    stops: all<any>(
      `SELECT s.id, s.city, s.date, v.name AS venue
         FROM stops s LEFT JOIN venues v ON v.id = s.venue_id
        WHERE s.date <= date('now', '+1 day') OR s.is_test = 1
        ORDER BY s.is_test DESC, s.date DESC LIMIT 30`),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "start");

  const g = requireUser(req);
  let guestEmail: string | null = null;

  if (g.deny) {
    // No session. The only other door is the flagged guest lane, and it opens
    // only with a real email — the vaguer "not right now" of a blank field
    // gets the plain guest message, not the generic sign-in one, so someone at
    // a show knows exactly what to type.
    if (!GUEST_MODE()) return g.deny;
    const raw = typeof body.guest_email === "string" ? body.guest_email.trim().toLowerCase() : "";
    if (!EMAIL_RE.test(raw)) {
      return NextResponse.json(
        { error: "Enter your email so we can credit you and reach you about your footage — or sign in." },
        { status: 401 },
      );
    }
    guestEmail = raw;
  }

  if (action === "start") {
    // Generous but finite: a fan filming a whole set legitimately uploads a lot
    // of clips, a script does not need forty in an hour. Guests rate-limit on
    // their email since there is no user id to key on.
    const rlKey = g.user ? `fanclip:${g.user.id}` : `fanclip:guest:${guestEmail}`;
    const rl = rateLimit(req, rlKey, 40, 60 * 60 * 1000);
    if (rl) return rl;

    const stopId = Number(body.stop_id || 0);
    if (!stopId) return NextResponse.json({ error: "Which show was this?" }, { status: 400 });
    if (!one<any>(`SELECT id FROM stops WHERE id=?`, stopId)) {
      return NextResponse.json({ error: "We do not have that show." }, { status: 404 });
    }
    // The token guards the ANONYMOUS QR link specifically — the thing that
    // can actually leak. A signed-in ROADIE user (e.g. the pop-out inside The
    // Pit) already came through the app's own session and never touched a
    // shareable link, so there's nothing there for a token to protect against.
    // Only bites once a show has opted in (see lib/shareTokens.ts) — a stop
    // with none set keeps working exactly as before.
    if (guestEmail && !verifyShareToken(stopId, typeof body.k === "string" ? body.k : null)) {
      return NextResponse.json(
        { error: "This show's upload link has been refreshed. Please rescan the current QR, or ask the operator for the new link." },
        { status: 401 },
      );
    }

    const r = startUpload({
      stopId,
      setId: Number(body.set_id || 0) || null,
      userId: g.user?.id ?? null,
      guestEmail,
      filename: String(body.filename || "clip.mp4"),
      mime: String(body.mime || "video/mp4"),
      uploaderName: String(body.uploader_name || g.user?.display_name || ""),
      licenceGranted: body.licence === true,
      // Only a live-recorded clip carries this — the client sets it to
      // Date.now() the moment its own MediaRecorder actually starts. A
      // finite, sane number or nothing; never trust an arbitrary client claim
      // any further than "here is a rough clock reading to sanity-check".
      recordedStartedAtMs: Number.isFinite(body.recorded_started_at_ms) ? Number(body.recorded_started_at_ms) : null,
    });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });

    // The URL is the credential. It is returned once and never stored.
    return NextResponse.json({ ok: true, id: r.id, upload_url: r.url, licence: r.licence });
  }

  if (action === "complete") {
    const id = Number(body.id || 0);
    if (!id) return NextResponse.json({ error: "Which clip?" }, { status: 400 });
    const clip = one<any>(`SELECT user_id, guest_email FROM fan_clips WHERE id=?`, id);
    if (!clip) return NextResponse.json({ error: "No such clip." }, { status: 404 });
    // Only the person who started this upload can finish it. A guest has no
    // session to check, so the email they started with stands in for one.
    if (g.user) {
      if (clip.user_id && Number(clip.user_id) !== Number(g.user.id)) {
        return NextResponse.json({ error: "That is not your upload." }, { status: 403 });
      }
    } else if (clip.guest_email && clip.guest_email !== guestEmail) {
      return NextResponse.json({ error: "That is not your upload." }, { status: 403 });
    }
    const r = completeUpload(id, Number(body.bytes || 0) || undefined);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
