import { NextResponse } from "next/server";
import { getServerSupabase, requireAdmin, UNAUTHORIZED } from "@/lib/api-auth";
import { fetchBalanceSheetData } from "@/lib/balance-sheet-data";
import { logger } from "@/lib/logger";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const isDay = (v: string) => DAY_RE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

export async function GET(request: Request) {
  if (!(await requireAdmin())) return UNAUTHORIZED();

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";
  const asOn = searchParams.get("asOn") || to;

  if (!isDay(from) || !isDay(to) || !isDay(asOn)) {
    return NextResponse.json({ error: "Invalid from/to/asOn date" }, { status: 400 });
  }
  if (from > to) {
    return NextResponse.json(
      { error: "from date, to date se baad nahi ho sakti" },
      { status: 400 }
    );
  }

  try {
    const supabase = await getServerSupabase();
    const data = await fetchBalanceSheetData(supabase, { from, to, asOn });
    return NextResponse.json(data);
  } catch (err) {
    logger.error("Balance Sheet API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
