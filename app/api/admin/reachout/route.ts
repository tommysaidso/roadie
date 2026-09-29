import { NextRequest, NextResponse } from "next/server";
import { getDb, one, all, run } from "@/lib/db";
import { requireUser, forbid, rateLimit } from "@/lib/guard";
import { isAdmin } from "@/lib/betateam";
import { createInvite, inviteLink } from "@/lib/invites";
import { sendEmail, mailConfigured } from "@/lib/google";

export const dynamic = "force-dynamic";

// "Invite" on an unclaimed venue or band, from the map.
//
// Most rows in the CRM are places nobody has claimed yet — that IS the growth
// list, and until now the only way to work it was to export it and mail people
// by hand. This turns the map into the outreach tool.
//
// Two things it refuses to do:
//   - guess an address. If we have no contact on file it says so rather than
//     inventing one or silently doing nothing.
//   - mail the same place twice by accident. Every reach-out is logged and the
//     UI can see it, because pestering a venue is worse than missing one.

let ready = false;
function ensure() {
  if (ready) return;
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS reachouts (
      id INTEGER PRIMARY KEY,
      kind TEXT NOT NULL,              -- venue | band
      ref_id INTEGER NOT NULL,
      email TEXT DEFAULT '',
      sent_by INTEGER,
      ok INTEGER DEFAULT 0,
      error TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_reachouts_ref ON reachouts(kind, ref_id);
  `);
  // Punch back to the CRM. The venues/bands tables ARE the contact list — the
  // 1,500-odd unclaimed rows are the growth list — so the outreach has to be
  // visible ON the record, not only in a side table nobody opens.
  for (const t of ["venues", "bands"]) {
    for (const col of ["last_contacted_at TEXT", "last_contacted_by INTEGER", "assigned_to INTEGER"]) {
      try { getDb().exec(`ALTER TABLE ${t} ADD COLUMN ${col}`); } catch { /* already there */ }
    }
  }
  ready = true;
}

/** First thing in a contact field that looks like an address. */
function emailFrom(text: string) {
  const m = String(text || "").match(/[^\s,;<>"']+@[^\s,;<>"']+\.[^\s,;<>"']+/);
  return m ? m[0].toLowerCase() : "";
}

export async function GET(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isAdmin(g.user)) return forbid("Operator-only.");
  ensure();
  return NextResponse.json({
    recent: all<any>("SELECT * FROM reachouts ORDER BY id DESC LIMIT 100"),
  });
}

export async function POST(req: NextRequest) {
  const g = requireUser(req); if (g.deny) return g.deny;
  if (!isAdmin(g.user)) return forbid("Operator-only.");
  const limited = rateLimit(req, "reachout", 60, 60 * 60 * 1000); if (limited) return limited;
  ensure();

  const b = await req.json().catch(() => ({} as any));
  const kind = b?.kind === "band" ? "band" : "venue";
  const id = Number(b?.id) || 0;
  if (!id) return NextResponse.json({ error: "Which one?" }, { status: 400 });

  const row = kind === "venue"
    ? one<any>("SELECT id,name,city,contact,user_id FROM venues WHERE id=?", id)
    : one<any>("SELECT id,name,home_city city,user_id FROM bands WHERE id=?", id);
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (row.user_id) return NextResponse.json({ error: "Already claimed." }, { status: 400 });

  const already = one<any>(
    "SELECT id, created_at FROM reachouts WHERE kind=? AND ref_id=? AND ok=1 ORDER BY id DESC", kind, id);

  const email = emailFrom(row.contact || "");
  if (!email) {
    run("INSERT INTO reachouts(kind,ref_id,email,sent_by,ok,error) VALUES(?,?,?,?,0,?)",
      kind, id, "", g.user.id, "no contact on file");
    return NextResponse.json({
      error: `No email on file for ${row.name}. Add one on the record and try again.`,
      needs_contact: true,
    }, { status: 400 });
  }

  if (!mailConfigured()) {
    return NextResponse.json({ error: "Email isn't configured on this server." }, { status: 503 });
  }

  const link = inviteLink(createInvite(email, g.user.id));
  const what = kind === "venue" ? "room" : "band";
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.55;color:#111;max-width:560px">
    <p>Hi,</p>
    <p><b>${row.name}</b>${row.city ? ` in ${row.city}` : ""} is already listed on ROADIE — the free road kit
    for BC and Alberta bands and the rooms that book them. Nobody has claimed it yet, so it's sitting there
    with whatever we could find about it.</p>
    <p>Claiming it takes a minute and it's free. You get to fix the details, say what you actually want,
    and be found by the people looking for a ${what} like yours.</p>
    <p style="margin:18px 0"><a href="${link}"
      style="background:#ff3d6e;color:#fff;padding:11px 18px;border-radius:999px;text-decoration:none;font-weight:700">
      Claim ${row.name}</a></p>
    <p style="font-size:12px;color:#666">Or paste this in: ${link}</p>
    <p style="margin-top:18px">— ${g.user.display_name || "the ROADIE team"}</p>
  </div>`;

  try {
    await sendEmail({ to: email, subject: `${row.name} is on ROADIE — claim it?`, html });
    run("INSERT INTO reachouts(kind,ref_id,email,sent_by,ok) VALUES(?,?,?,?,1)", kind, id, email, g.user.id);
    // Stamp the record so anyone working the list sees it was already touched,
    // and who owns the follow-up. `assigned_to` sticks with whoever reached
    // out first unless it is reassigned — Dewey's calls stay Dewey's.
    const table = kind === "venue" ? "venues" : "bands";
    try {
      run(`UPDATE ${table} SET last_contacted_at=datetime('now'), last_contacted_by=?,
             assigned_to=COALESCE(assigned_to,?) WHERE id=?`, g.user.id, g.user.id, id);
    } catch { /* stamping is a nicety; the send already happened */ }
    return NextResponse.json({ ok: true, email, previously: already?.created_at || null });
  } catch (e: any) {
    run("INSERT INTO reachouts(kind,ref_id,email,sent_by,ok,error) VALUES(?,?,?,?,0,?)",
      kind, id, email, g.user.id, String(e?.message || e).slice(0, 300));
    return NextResponse.json({ error: `Couldn't send to ${email}.` }, { status: 502 });
  }
}
