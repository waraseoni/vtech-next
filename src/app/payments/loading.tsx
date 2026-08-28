import PageLoader from "@/components/PageLoader";
import { Wallet } from "lucide-react";

export default function PaymentsLoading() {
  return <PageLoader icon={Wallet} label="Loading payments..." tone="blue" />;
}
