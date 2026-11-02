"use client";

import { createContext, useContext, type ReactNode } from "react";

const ServerSeedContext = createContext<Record<string, unknown>>({});

/**
 * Route layout server par jo data fetch karta hai use is provider me daalta
 * hai. Nested providers merge hote hain, isliye har route apni key add kar
 * sakta hai. Seed `null` hone par context unchanged rehta hai aur page apna
 * purana client fetch chalata hai.
 */
export function ServerSeedProvider({
  seedKey,
  data,
  children,
}: {
  seedKey: string;
  data: unknown;
  children: ReactNode;
}) {
  const parent = useContext(ServerSeedContext);
  const value = data == null ? parent : { ...parent, [seedKey]: data };
  return <ServerSeedContext.Provider value={value}>{children}</ServerSeedContext.Provider>;
}

export function useServerSeed<T>(key: string): T | undefined {
  const seeds = useContext(ServerSeedContext);
  return seeds[key] as T | undefined;
}
