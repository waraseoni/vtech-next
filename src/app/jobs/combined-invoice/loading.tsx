import PageLoader from "@/components/PageLoader";
import { Receipt } from "lucide-react";

export default function CombinedInvoiceLoading() {
  return <PageLoader icon={Receipt} label="Loading invoice..." tone="cyan" />;
}
