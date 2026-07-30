"use client";

import { useEffect } from "react";

export default function PWAHead() {
  useEffect(() => {
    // Manifest link
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = "/manifest.json";
    document.head.appendChild(link);

    // Theme color meta
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = "#3b82f6";
    document.head.appendChild(meta);

    // iOS support
    const appleMeta = document.createElement("meta");
    appleMeta.name = "apple-mobile-web-app-capable";
    appleMeta.content = "yes";
    document.head.appendChild(appleMeta);

    const appleStatus = document.createElement("meta");
    appleStatus.name = "apple-mobile-web-app-status-bar-style";
    appleStatus.content = "black-translucent";
    document.head.appendChild(appleStatus);

    // Apple touch icon
    const appleIcon = document.createElement("link");
    appleIcon.rel = "apple-touch-icon";
    appleIcon.href = "/icon-192x192.png";
    document.head.appendChild(appleIcon);

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  return null;
}