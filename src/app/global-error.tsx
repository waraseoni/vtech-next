"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Root layout ke errors global-error.tsx mein catch hote hain (error.tsx root
// layout ke andar ke errors hi catch karti hai, apne se upar wale nahi).
// Isliye <html>/<body> khud render karne padte hain. Sentry DSN set hone par
// error yahan se bhi remote track hota hai.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en" data-theme="dark">
      <body style={{ margin: 0, background: "#0d1117", color: "#e2e8f0" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div style={{ textAlign: "center", maxWidth: 360 }}>
            <div
              style={{
                width: 64,
                height: 64,
                margin: "0 auto 24px",
                background: "rgba(245,158,11,0.1)",
                borderRadius: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 900, margin: "0 0 8px" }}>
              Kuch gadbad ho gayi
            </h1>
            <p style={{ fontSize: 14, margin: "0 0 16px", color: "#94a3b8" }}>
              App load nahi ho paya. Dobara try karein.
            </p>
            <button
              onClick={reset}
              style={{
                padding: "12px 24px",
                background: "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Dobara try karo
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
