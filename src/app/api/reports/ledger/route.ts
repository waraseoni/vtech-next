import { NextResponse } from "next/server";
import { getServerSupabase, requireStaffWithReason, UNAUTHORIZED } from "@/lib/api-auth";
import { fetchLedgerData } from "@/lib/ledger-data";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  const staff = await requireStaffWithReason();
  if (staff.status !== "ok") {
    // no-profile = login to hai par public.profiles me row nahi (auth
    // auto-trigger 20260809 se dropped hai). Pehle ye case chup-chaap 200 +
    // saare totals 0 deta tha (RLS sab deny kar deta tha) — ab seedha 403
    // with repair hint, taaki "sab 0 kyon" ka jawaab screen par hi mile.
    if (staff.status === "no-profile") {
      return NextResponse.json(
        {
          error:
            "Account provision nahi hua hai — aapki profiles row missing hai, isliye report ka data nahi dikh sakta. Admin se staff role lagwayein (Supabase Auth user id ke liye public.profiles me row insert karo).",
        },
        { status: 403 }
      );
    }
    return UNAUTHORIZED();
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json({ error: "Missing from or to date" }, { status: 400 });
  }

  try {
    const supabase = await getServerSupabase();
    const data = await fetchLedgerData(supabase, { from, to });
    return NextResponse.json(data);
  } catch (err) {
    logger.error("Ledger API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
