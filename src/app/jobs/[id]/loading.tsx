import PageLoader from "@/components/PageLoader";
import { Briefcase } from "lucide-react";

// PERF (nav audit): `[id]` ke sub-routes (view/edit/old) ke liye instant
// skeleton. Pehle in segments me loading.tsx nahi tha → click ke baad blank
// wait. Ab router turant yeh fallback paint karta hai.
export default function JobDetailLoading() {
  return <PageLoader icon={Briefcase} label="Loading job..." tone="cyan" />;
}
