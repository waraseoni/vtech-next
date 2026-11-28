import PageLoader from "@/components/PageLoader";
import { Layers } from "lucide-react";

export default function BulkEditLoading() {
  return <PageLoader icon={Layers} label="Loading bulk edit..." tone="cyan" />;
}
