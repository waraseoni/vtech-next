import PageLoader from "@/components/PageLoader";
import { IndianRupee } from "lucide-react";

export default function ExpensesLoading() {
  return <PageLoader icon={IndianRupee} label="Loading expenses..." tone="amber" />;
}
