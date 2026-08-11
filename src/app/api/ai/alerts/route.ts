import { NextResponse } from "next/server";
import { requireStaff, getSessionRole } from "@/lib/api-auth";
import { executeGeminiTool, type AiRole } from "@/lib/gemini-tools";

export async function GET() {
  try {
    const user = await requireStaff();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sessionRole = await getSessionRole();
    const role: AiRole = sessionRole === "admin" ? "admin" : "staff";

    const alerts = await executeGeminiTool({ name: "get_business_alerts", args: {} }, role);

    return NextResponse.json({ role, alerts });
  } catch (error) {
    console.error("Alerts API Error:", error);
    return NextResponse.json(
      { error: "Failed to load alerts", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
