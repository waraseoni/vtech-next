import PageLoader from "@/components/PageLoader";
import { Tag } from "lucide-react";

export default function SpotLabelsLoading() {
  return <PageLoader icon={Tag} label="Loading spot labels..." tone="cyan" />;
}
