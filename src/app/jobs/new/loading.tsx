import PageLoader from "@/components/PageLoader";
import { FilePlus2 } from "lucide-react";

export default function NewJobLoading() {
  return <PageLoader icon={FilePlus2} label="Loading job form..." tone="cyan" />;
}
