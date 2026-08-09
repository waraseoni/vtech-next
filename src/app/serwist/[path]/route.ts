import { createSerwistRoute } from "@serwist/turbopack";

// Generates + serves the service worker at /serwist/sw.js.
// The Service-Worker-Allowed: / header (set by createSerwistRoute) lets the
// worker control the whole site even though it lives under /serwist/.
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    swSrc: "src/app/sw.ts",
  });
