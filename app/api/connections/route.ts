import { NextResponse } from "next/server";
import { sharedInterests } from "@/lib/community";
export const dynamic="force-dynamic";
export async function GET(){ return NextResponse.json({ groups: sharedInterests() }); }
