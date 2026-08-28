import PageLoader from "@/components/PageLoader";
import { Calculator } from "lucide-react";

export default function SalaryLoading() {
  return <PageLoader icon={Calculator} label="Loading salary..." tone="emerald" />;
}
