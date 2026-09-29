import { NextResponse } from "next/server";
import { all } from "@/lib/db";
export const dynamic="force-dynamic";
export async function GET(){ return NextResponse.json({ festivals: all("SELECT * FROM festivals ORDER BY month, name") }); }
