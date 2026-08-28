import PageLoader from "@/components/PageLoader";
import { Users } from "lucide-react";

export default function ClientsLoading() {
  return <PageLoader icon={Users} label="Loading clients..." tone="blue" />;
}
