import { NextRequest, NextResponse } from "next/server";
import { all, run } from "@/lib/db";
import { requireUser } from "@/lib/guard";
export const dynamic = "force-dynamic";

const FAN_KINDS = new Set(["carpool", "spark"]);

export async function GET() { return NextResponse.json({ notices: all("SELECT * FROM notices ORDER BY created_at DESC") }); }
export async function POST(req: NextRequest) {
  const n = await req.json();
  if (!FAN_KINDS.has(n.kind)) {
    const g = requireUser(req); if (g.deny) return g.deny;
  }
  const r = run(
    `INSERT INTO notices(kind,author_type,author_id,title,body,city,date_from,date_to,genre,contact)
     VALUES(?,?,?,?,?,?,?,?,?,?)`,
    n.kind, n.author_type || "fan", n.author_id || null,
    n.title, n.body || "", n.city || "",
    n.date_from || null, n.date_to || null, n.genre || null, n.contact || null
  );
  return NextResponse.json({ id: r.lastInsertRowid });
}
