"use client";

import { useReportWebVitals } from "next/web-vitals";

/**
 * Real-user Core Web Vitals (LCP/CLS/INP/TTFB/FCP) → `/api/vitals`.
 *
 * KYUN: perf ka saara data abhi local synthetic tha (localhost, prod build,
 * staff login). Real users ke device/network par kya ho raha hai — uska koi
 * data nahi tha, isliye regression pakadne ka koi tareeka bhi nahi tha.
 *
 * Design notes:
 *  - `sendBeacon` (fallback `fetch keepalive`) — page unload ke baad bhi
 *    metric pahunch jata hai, aur user ke navigation ko block nahi karta.
 *  - Callback module-level constant hai (docs: reference change na ho warna
 *    duplicate reports aate hain).
 *  - Sirf 5 core metrics + path bhejte hain — koi PII nahi, query string
 *    nahi (job code/token URL me aa sakta hai).
 *  - `next/web-vitals` built-in hai — koi naya dependency nahi.
 */
const CORE = new Set(["TTFB", "FCP", "LCP", "CLS", "INP"]);

type Callback = Parameters<typeof useReportWebVitals>[0];

const report: Callback = (metric) => {
  if (!CORE.has(metric.name)) return;
  if (typeof window === "undefined") return;

  const body = JSON.stringify({
    name: metric.name,
    value: Math.round(metric.value * 1000) / 1000,
    rating: metric.rating,
    id: metric.id,
    path: window.location.pathname.slice(0, 128),
    navigationType: metric.navigationType,
  });

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon("/api/vitals", blob)) return;
    }
  } catch {
    /* beacon fail → fetch fallback */
  }

  void fetch("/api/vitals", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    /* telemetry best-effort — page ko kabhi affect nahi karna */
  });
};

export default function WebVitals() {
  useReportWebVitals(report);
  return null;
}
