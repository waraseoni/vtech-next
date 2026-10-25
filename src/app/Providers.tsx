"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/queryClient";

// Devtools sirf development me load ho. `process.env.NODE_ENV` build-time par
// replace hota hai, isliye production bundle me ye import dead-code ban jata hai
// (bundle size zero impact).
const ReactQueryDevtools =
  process.env.NODE_ENV === "development"
    ? dynamic(() => import("@tanstack/react-query-devtools").then((m) => m.ReactQueryDevtools), {
        ssr: false,
      })
    : () => null;

// Root layout server component hai, isliye provider client wrapper me.
// RootClient ke BAHAR wrap kiya — public pages + boot/license guards ke
// har branch me rahe.
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={getQueryClient()}>
      {children}
      {/* bottom-left: AI FAB (bottom-right) + mobile tab bar se clash nahi. */}
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
    </QueryClientProvider>
  );
}
