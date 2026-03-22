import type { NextConfig } from "next";

const nextConfig = {
  reactCompiler: true,
  turbopack: false,
} as any;

const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
});

export default withPWA(nextConfig);
