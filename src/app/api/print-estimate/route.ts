import { NextRequest, NextResponse } from "next/server";

import { requireStaffWithRole } from "@/lib/api-auth";
import { getPrintShop } from "@/lib/print-shop";
import { printHtmlResponse } from "@/lib/print-html";
import { parseData } from "@/lib/validation";
import { estimatePrintSchema } from "@/lib/validation/schemas/estimate";
import { renderEstimateHtml } from "@/lib/estimate-print";
import type { EstimatePrintPayload } from "@/lib/estimate";

// Record-free estimate print (R1/R2/R3): read-only — koi DB write nahi.
// Body JSON ya hidden-form `payload` field (urlencoded) — dono accepted.

async function readPayload(req: NextRequest): Promise<unknown> {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return req.json();
  const form = await req.formData();
  const raw = form.get("payload");
  if (typeof raw !== "string" || !raw.trim()) return null;
  return JSON.parse(raw);
}

export async function POST(req: NextRequest) {
  const session = await requireStaffWithRole();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized — pehle login karein" }, { status: 401 });
  }
  if (session.role !== "admin" && session.role !== "developer") {
    return NextResponse.json(
      { error: "Sirf admin/developer estimate print kar sakte hain" },
      { status: 403 }
    );
  }

  let raw: unknown;
  try {
    raw = await readPayload(req);
  } catch {
    return NextResponse.json({ error: "Request body valid JSON nahi hai" }, { status: 400 });
  }

  const parsed = parseData(estimatePrintSchema, raw);
  if (!parsed.ok) return parsed.response;

  const shop = await getPrintShop();
  const html = renderEstimateHtml(parsed.data as EstimatePrintPayload, shop);
  return printHtmlResponse(html);
}
