"use client";

import { useEffect } from "react";

export default function PWAHead() {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = "/manifest.json";
    document.head.appendChild(link);

    // Also add theme-color meta
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = "#3b82f6";
    document.head.appendChild(meta);

    // Register service worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then((registration) => {
            console.log('SW registered: ', registration);
          })
          .catch((registrationError) => {
            console.log('SW registration failed: ', registrationError);
          });
      });
    }

    return () => {
      document.head.removeChild(link);
      document.head.removeChild(meta);
    };
  }, []);

  return null;
}