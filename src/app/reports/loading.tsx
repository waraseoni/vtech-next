import PageLoader from "@/components/PageLoader";
import { BarChart3 } from "lucide-react";

export default function ReportsLoading() {
  return <PageLoader icon={BarChart3} label="Loading report..." tone="blue" />;
}
