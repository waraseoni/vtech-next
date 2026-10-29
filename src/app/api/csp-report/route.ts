import { NextResponse } from "next/server";
import { clientIpFromHeaders, rateLimit } from "@/lib/rate-limit";

// CSP Report-Only violations yahan aate hain (report-uri + report-to dono).
// Endpoint fire-and-forget hai: hamesha 204, kabhi body echo nahi. Sirf
// sanitized fields prod function logs me jate hain taaki 3-5 din ke observation
// window me actual noise dekh kar CSP enforce kar sakein.
// NOTE: logger prod me silent hai — yahan jaan-boojh kar console.warn use hai
// (Vercel function logs hi observation ka source hain).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8 * 1024;
const MAX_REPORTS_PER_REQUEST = 5;

const noContent = () =>
  new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });

function pick(report: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = report[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

// Document URL me tracking token / job code query me aa sakta hai — sirf pathname.
function pathOf(value: string | null): string {
  if (!value) return "";
  try {
    return new URL(value).pathname.slice(0, 128) || "/";
  } catch {
    const path = value.split(/[?#]/)[0];
    return (path.startsWith("/") ? path : `/${path}`).slice(0, 128);
  }
}

// blocked-uri kabhi poora URL ho sakta hai; origin ke aage kuch log nahi karte.
// data:/blob: par scheme hi rakhte hain (payload log karna hi nahi hai).
function originOf(value: string | null): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : url.protocol;
  } catch {
    return value.split(/[?#]/)[0].slice(0, 64);
  }
}

function toReportList(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload
      .filter(
        (entry): entry is Record<string, unknown> =>
          Boolean(entry) && typeof entry === "object" && !Array.isArray(entry)
      )
      .filter((entry) => entry.type === "csp-violation")
      .map((entry) =>
        entry.body && typeof entry.body === "object"
          ? (entry.body as Record<string, unknown>)
          : entry
      );
  }
  if (payload && typeof payload === "object") {
    const legacy = (payload as Record<string, unknown>)["csp-report"];
    if (legacy && typeof legacy === "object") return [legacy as Record<string, unknown>];
  }
  return [];
}

function sanitize(report: Record<string, unknown>) {
  const directive = pick(report, [
    "effectiveDirective",
    "effective-directive",
    "violatedDirective",
    "violated-directive",
  ]);
  if (!directive) return null;
  return {
    directive: directive.slice(0, 64),
    blocked: originOf(pick(report, ["blockedURL", "blocked-uri"])),
    document: pathOf(pick(report, ["documentURL", "document-uri"])),
    disposition: (pick(report, ["disposition"]) || "report").slice(0, 16),
  };
}

export async function POST(request: Request) {
  try {
    const ip = clientIpFromHeaders(request.headers);
    if (!(await rateLimit(`csp:${ip}`, 60, 60_000)).ok) return noContent();

    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MAX_BODY_BYTES) return noContent();

    const raw = await request.text();
    if (!raw || raw.length > MAX_BODY_BYTES) return noContent();

    const reports = toReportList(JSON.parse(raw)).slice(0, MAX_REPORTS_PER_REQUEST);
    for (const report of reports) {
      const clean = sanitize(report);
      if (clean) console.warn("[csp-report]", JSON.stringify(clean));
    }
  } catch {
    // Malformed report — report hi karna tha, koi response error nahi.
  }
  return noContent();
}
