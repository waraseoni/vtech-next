import PageLoader from "@/components/PageLoader";
import { Boxes } from "lucide-react";

export default function InventoryLoading() {
  return <PageLoader icon={Boxes} label="Loading inventory..." tone="blue" />;
}
