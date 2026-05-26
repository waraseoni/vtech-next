import type { NextConfig } from "next";
import withPWA from "next-pwa";

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {},
  allowedDevOrigins: [
    '192.168.1.*',   // ghar/office WiFi
    '192.168.29.*',  // mobile hotspot (optional)
    '10.0.0.*',      // kuch routers ye range use karte hain (optional)
  ],
};

const withPWAConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

export default withPWAConfig(nextConfig);