import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";
import { withSentryConfig } from "@sentry/nextjs";
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

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {},
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
};

export default withSentryConfig(withSerwist(nextConfig), {
  // Turbopack se webpack source-map upload plugin conflict hota hai — isliye
  // build-time sourcemap upload disable (runtime error tracking unaffected).
  sourcemaps: { disable: true },
  silent: true,
});
