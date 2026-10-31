"use client";

import AdminPage from "@/app/components/AdminPage";
import EstimateBuilder from "./components/EstimateBuilder";

export default function EstimatesPage() {
  return (
    <AdminPage
      title="Estimate"
      subtitle="Client ke liye editable estimate / quotation — sirf print aur share, koi record nahi"
    >
      <EstimateBuilder />
    </AdminPage>
  );
}
