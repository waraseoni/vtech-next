import PageLoader from "@/components/PageLoader";
import { UserPlus } from "lucide-react";

export default function NewClientLoading() {
  return <PageLoader icon={UserPlus} label="Loading form..." tone="blue" />;
}
