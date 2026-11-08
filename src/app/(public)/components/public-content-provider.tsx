"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { PublicSiteContent } from "@/lib/public-site-defaults";

const PublicContentContext = createContext<PublicSiteContent | null>(null);

export function PublicContentProvider({
  content,
  children,
}: {
  content: PublicSiteContent;
  children: ReactNode;
}) {
  return <PublicContentContext.Provider value={content}>{children}</PublicContentContext.Provider>;
}

export function usePublicSiteContent(): PublicSiteContent {
  const content = useContext(PublicContentContext);
  if (!content) {
    throw new Error("usePublicSiteContent must be used inside PublicContentProvider");
  }
  return content;
}
