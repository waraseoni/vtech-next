"use client";

import { RouteError } from "@/components/RouteError";

export default function JobsError({ reset }: { reset: () => void }) {
  return <RouteError reset={reset} />;
}
