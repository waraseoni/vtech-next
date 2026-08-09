import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {},
  allowedDevOrigins: [
    '192.168.1.*',   // ghar/office WiFi
    '192.168.29.*',  // mobile hotspot (optional)
    '10.0.0.*',      // kuch routers ye range use karte hain (optional)
  ],
};

export default withSerwist(nextConfig);
