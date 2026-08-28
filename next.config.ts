import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {},
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
