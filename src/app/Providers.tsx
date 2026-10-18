"use client";

import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/queryClient";

// Root layout server component hai, isliye provider client wrapper me.
// RootClient ke BAHAR wrap kiya — public pages + boot/license guards ke
// har branch me rahe.
export default function Providers({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>;
}
