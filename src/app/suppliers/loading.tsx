import PageLoader from "@/components/PageLoader";
import { Truck } from "lucide-react";

export default function SuppliersLoading() {
  return <PageLoader icon={Truck} label="Loading suppliers..." tone="blue" />;
}
