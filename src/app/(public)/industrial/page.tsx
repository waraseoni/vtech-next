import type { Metadata } from "next";
import { buildServiceMetadata, ServicePageRoute } from "../components/service-route";

export async function generateMetadata(): Promise<Metadata> {
  return buildServiceMetadata("industrial", "/industrial");
}

export default function IndustrialPage() {
  return <ServicePageRoute serviceId="industrial" path="/industrial" />;
}
