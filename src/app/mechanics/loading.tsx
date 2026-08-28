import PageLoader from "@/components/PageLoader";
import { Wrench } from "lucide-react";

export default function MechanicsLoading() {
  return <PageLoader icon={Wrench} label="Loading mechanics..." tone="blue" />;
}
