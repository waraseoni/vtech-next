import type { Metadata } from "next";
import { buildServiceMetadata, ServicePageRoute } from "../components/service-route";

export async function generateMetadata(): Promise<Metadata> {
  return buildServiceMetadata("power-supply", "/power-supply");
}

export default function PowerSupplyPage() {
  return <ServicePageRoute serviceId="power-supply" path="/power-supply" />;
}
