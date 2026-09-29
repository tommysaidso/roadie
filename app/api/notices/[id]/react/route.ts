import { NextRequest, NextResponse } from "next/server";
import { one, run } from "@/lib/db";
export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const params = await context.params;
  const id = Number(params.id);
  if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  const n = one<any>("SELECT id, reactions FROM notices WHERE id=?", id);
  if (!n) return NextResponse.json({ error: "not found" }, { status: 404 });
  run("UPDATE notices SET reactions=reactions+1 WHERE id=?", id);
  return NextResponse.json({ reactions: (n.reactions || 0) + 1 });
}
