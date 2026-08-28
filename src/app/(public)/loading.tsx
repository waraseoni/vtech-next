import PageLoader from "@/components/PageLoader";
import { Globe } from "lucide-react";

export default function PublicLoading() {
  return <PageLoader icon={Globe} label="Loading..." tone="blue" />;
}
