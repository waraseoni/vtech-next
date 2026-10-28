import type { Metadata } from "next";
import type { ReactNode } from "react";

// Tracking page par client ka job data render hota hai — search engines ise
// index na karein.
export const metadata: Metadata = {
  title: "Job Status",
  robots: { index: false, follow: false },
};

export default function JobStatusLayout({ children }: { children: ReactNode }) {
  return children;
}
