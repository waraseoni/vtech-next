"use client";

import { createContext, useContext, type ReactNode } from "react";
import type {
  ClientBalanceSeed,
  ClientEditSeed,
  ClientEmiSeed,
  ClientPaymentSeed,
} from "../clientActionQueries";

type SeedDataMap = {
  pay: ClientPaymentSeed;
  balance: ClientBalanceSeed;
  emi: ClientEmiSeed;
  edit: ClientEditSeed;
};

type ClientActionSeed = {
  [K in keyof SeedDataMap]: { kind: K; data: SeedDataMap[K] };
}[keyof SeedDataMap];

const ClientActionSeedContext = createContext<ClientActionSeed | null>(null);

export function ClientActionSeedProvider({
  seed,
  children,
}: {
  seed: ClientActionSeed | null;
  children: ReactNode;
}) {
  return (
    <ClientActionSeedContext.Provider value={seed}>{children}</ClientActionSeedContext.Provider>
  );
}

export function useClientActionSeed<K extends keyof SeedDataMap>(
  kind: K
): SeedDataMap[K] | undefined {
  const seed = useContext(ClientActionSeedContext);
  if (!seed || seed.kind !== kind) return undefined;
  return (seed as { kind: K; data: SeedDataMap[K] }).data;
}
