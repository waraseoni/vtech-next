import PageLoader from "@/components/PageLoader";
import { LayoutDashboard } from "lucide-react";

export default function Loading() {
  return <PageLoader icon={LayoutDashboard} label="Loading dashboard..." tone="blue" />;
}
