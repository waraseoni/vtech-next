"use client";

import { RouteError } from "@/components/RouteError";

export default function SuppliersError({ reset }: { reset: () => void }) {
  return <RouteError reset={reset} />;
}
