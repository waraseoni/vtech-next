"use client";

import { createContext, useContext, type ReactNode } from "react";
import type {
  BulkEditSeed,
  BulkJobSeed,
  CombinedInvoiceSeed,
  SpotLabelsSeed,
} from "./jobsAuxQueries";

type SeedDataMap = {
  bulk: BulkJobSeed;
  "bulk-edit": BulkEditSeed;
  "combined-invoice": CombinedInvoiceSeed;
  "spot-labels": SpotLabelsSeed;
};

type JobAuxSeed = {
  [K in keyof SeedDataMap]: { kind: K; data: SeedDataMap[K] };
}[keyof SeedDataMap];

const JobAuxSeedContext = createContext<JobAuxSeed | null>(null);

export function JobAuxSeedProvider({
  seed,
  children,
}: {
  seed: JobAuxSeed | null;
  children: ReactNode;
}) {
  return <JobAuxSeedContext.Provider value={seed}>{children}</JobAuxSeedContext.Provider>;
}

export function useJobAuxSeed<K extends keyof SeedDataMap>(kind: K): SeedDataMap[K] | undefined {
  const seed = useContext(JobAuxSeedContext);
  if (!seed || seed.kind !== kind) return undefined;
  return (seed as { kind: K; data: SeedDataMap[K] }).data;
}
