import PageLoader from "@/components/PageLoader";
import { Briefcase } from "lucide-react";

export default function JobsLoading() {
  return <PageLoader icon={Briefcase} label="Loading jobs..." tone="blue" />;
}
