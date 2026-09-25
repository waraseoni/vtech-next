import PageLoader from "@/components/PageLoader";
import { ShoppingBag } from "lucide-react";

export default function DirectSalesLoading() {
  return <PageLoader icon={ShoppingBag} label="Loading sales..." tone="emerald" />;
}
