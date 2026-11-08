import type { Metadata } from "next";
import type { ReactNode } from "react";

// Staff login public segment me hai, par search index ke liye nahi.
export const metadata: Metadata = {
  title: "Staff Login",
  alternates: { canonical: "/login" },
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
