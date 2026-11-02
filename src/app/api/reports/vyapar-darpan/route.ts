import { NextResponse } from "next/server";
import { getServerSupabase, requireStaff, UNAUTHORIZED } from "@/lib/api-auth";
import { logger } from "@/lib/logger";
import { fetchVyaparData } from "@/lib/vyapar-data";

// ════════════════════════════════════════════════════════════════════════
//  VYAPAR DARPAN — "Business Mirror"
//  Aati-khata (P&L) + Chittha (Balance Sheet) — server-side se accurate
//  numbers, live schema par base kar ke. Computation ab neutral
//  `vyaparSeed.ts` module me hai (page first paint bhi wahi use karta hai).
// ════════════════════════════════════════════════════════════════════════

export async function GET(request: Request) {
  if (!(await requireStaff())) return UNAUTHORIZED();

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json({ error: "Missing from or to date" }, { status: 400 });
  }

  const supabase = await getServerSupabase();

  try {
    const payload = await fetchVyaparData(supabase, from, to);
    return NextResponse.json(payload);
  } catch (err) {
    logger.error("Vyapar Darpan API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
