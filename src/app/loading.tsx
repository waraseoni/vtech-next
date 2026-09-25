import PageLoader from "@/components/PageLoader";
import { Wrench } from "lucide-react";

export default function RootLoading() {
  return <PageLoader icon={Wrench} label="V-TECH Loading..." tone="blue" />;
}
