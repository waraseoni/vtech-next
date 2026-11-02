"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ClientDetail } from "../../clientDetailQueries";

// Server layout (RSC) snapshot yahan aata hai; page ise React Query ke
// initialData ki tarah use karta hai — pehla render hi final data.
const ClientDetailSeedContext = createContext<ClientDetail | null>(null);

export default function ClientDetailSeedProvider({
  seed,
  children,
}: {
  seed: ClientDetail | null;
  children: ReactNode;
}) {
  return (
    <ClientDetailSeedContext.Provider value={seed}>{children}</ClientDetailSeedContext.Provider>
  );
}

export function useClientDetailSeed(): ClientDetail | null {
  return useContext(ClientDetailSeedContext);
}
