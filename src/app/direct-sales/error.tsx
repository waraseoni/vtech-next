"use client";

import { RouteError } from "@/components/RouteError";

export default function DirectSalesError({ reset }: { reset: () => void }) {
  return <RouteError reset={reset} />;
}
