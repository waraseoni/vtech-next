"use client";

import { RouteError } from "@/components/RouteError";

export default function InventoryError({ reset }: { reset: () => void }) {
  return <RouteError reset={reset} />;
}
