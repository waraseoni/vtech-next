"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { JobFormSeed } from "./jobFormQueries";

const JobFormSeedContext = createContext<JobFormSeed | null>(null);

export default function JobFormSeedProvider({
  seed,
  children,
}: {
  seed: JobFormSeed | null;
  children: ReactNode;
}) {
  return <JobFormSeedContext.Provider value={seed}>{children}</JobFormSeedContext.Provider>;
}

export function useJobFormSeed(): JobFormSeed | null {
  return useContext(JobFormSeedContext);
}
