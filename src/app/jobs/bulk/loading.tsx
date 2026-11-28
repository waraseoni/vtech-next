import PageLoader from "@/components/PageLoader";
import { Layers } from "lucide-react";

export default function BulkJobLoading() {
  return <PageLoader icon={Layers} label="Loading bulk entry..." tone="cyan" />;
}
