import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";
import { withSentryConfig } from "@sentry/nextjs/config";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

// Build-time app version: package.json se liya jata hai taaki app me
// "v1.x.x" badge consistent rahe aur release version se match kare.
const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
const APP_VERSION: string = pkg.version || "0.0.0";

const APP_COMMIT: string = (() => {
  try {
    const sha = execSync("git rev-parse HEAD", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (sha) return sha;
  } catch {
    /* git unavailable (CI/zip builds) — env fallbacks below */
  }
  return (
    process.env.GITHUB_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_APP_COMMIT ||
    ""
  ).trim();
})();

const isDev = process.env.NODE_ENV !== "production";

// Report-only rollout: violations browser console me dikhte hain, kuch block
// nahi hota. Jab production traffic par noise zero ho jaye tab enforce karna.
// Dev me Turbopack HMR ke liye ws://localhost zaroori hai.
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:${isDev ? " http://localhost:* ws://localhost:*" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "media-src 'self' blob: https://*.supabase.co",
  "font-src 'self' data:",
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io${isDev ? " http://localhost:* ws://localhost:*" : ""}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {},
  experimental: {
    // Dev me source maps off → compile ka kaam/memory kam, page load aur startup tez.
    // (Sentry build-time upload pehle hi disabled hai; runtime error tracking unchanged.)
    turbopackSourceMaps: false,
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: APP_VERSION,
    NEXT_PUBLIC_APP_COMMIT: APP_COMMIT,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  allowedDevOrigins: [
    "192.168.1.*", // ghar/office WiFi
    "192.168.29.*", // mobile hotspot (optional)
    "10.0.0.*", // kuch routers ye range use karte hain (optional)
  ],
  outputFileTracingIncludes: {
    "/backup/guide": ["./docs/BACKUP_GUIDE.md"],
  },
  async redirects() {
    return [
      {
        source: "/salary",
        destination: "/mechanics/salary",
        permanent: true,
      },
      {
        source: "/salary/:path*",
        destination: "/mechanics/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        // Baseline headers. CSP sirf Report-Only hai — inline styles, Supabase,
        // Sentry aur Serwist worker ko enforce karne se pehle prod me noise-free
        // verify karna hai.
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=(), payment=()",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
      {
        source: "/:file((?:[^/]+\\.(?:png|jpg|jpeg|webp|svg|ico|gif|woff2?)))",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
      {
        source: "/manifest.json",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
    ];
  },
};

export default withSentryConfig(withSerwist(nextConfig), {
  // Turbopack se webpack source-map upload plugin conflict hota hai — isliye
  // build-time sourcemap upload disable (runtime error tracking unaffected).
  sourcemaps: { disable: true },
  silent: true,
});
