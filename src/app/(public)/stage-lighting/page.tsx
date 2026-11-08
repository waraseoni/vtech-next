import type { Metadata } from "next";
import { buildServiceMetadata, ServicePageRoute } from "../components/service-route";

export async function generateMetadata(): Promise<Metadata> {
  return buildServiceMetadata("stage-lighting", "/stage-lighting");
}

export default function StageLightingPage() {
  return <ServicePageRoute serviceId="stage-lighting" path="/stage-lighting" />;
}
