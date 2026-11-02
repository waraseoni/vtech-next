"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ClientLedgerSeed } from "../../clientLedgerQueries";

// Default (unfiltered) ledger ka RSC seed — page ise sirf tab use karta hai
// jab URL me from/to/status filters nahi hain.
const ClientLedgerSeedContext = createContext<ClientLedgerSeed | null>(null);

export default function ClientLedgerSeedProvider({
  seed,
  children,
}: {
  seed: ClientLedgerSeed | null;
  children: ReactNode;
}) {
  return (
    <ClientLedgerSeedContext.Provider value={seed}>{children}</ClientLedgerSeedContext.Provider>
  );
}

export function useClientLedgerSeed(): ClientLedgerSeed | null {
  return useContext(ClientLedgerSeedContext);
}
