"use client";

import { RouteError } from "@/components/RouteError";

export default function ReportsError({ reset }: { reset: () => void }) {
  return <RouteError reset={reset} />;
}
