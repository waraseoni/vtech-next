"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { JobViewSnapshot } from "./jobViewQueries";

// Server layout (RSC) snapshot yahan aata hai; page ise React Query ke
// initialData ki tarah use karta hai — pehla render hi final data.
const JobViewSeedContext = createContext<JobViewSnapshot | null>(null);

export default function JobViewSeedProvider({
  seed,
  children,
}: {
  seed: JobViewSnapshot | null;
  children: ReactNode;
}) {
  return <JobViewSeedContext.Provider value={seed}>{children}</JobViewSeedContext.Provider>;
}

export function useJobViewSeed(): JobViewSnapshot | null {
  return useContext(JobViewSeedContext);
}
