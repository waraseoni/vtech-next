import { Suspense } from "react";
import { requireStaff } from "@/lib/api-auth";
import { fetchSalaryReportData, fetchSalaryMasterData } from "@/lib/server-salary";
import { format } from "date-fns/format";
import SalaryPageInner from "./components/SalaryPageInner";

export const dynamic = "force-dynamic";

async function SalaryPage() {
  await requireStaff();

  const month = format(new Date(), "yyyy-MM");
  const [initialReportData, initialMechanics] = await Promise.all([
    fetchSalaryReportData(month),
    fetchSalaryMasterData(),
  ]);

  return (
    <Suspense>
      <SalaryPageInner initialReportData={initialReportData} initialMechanics={initialMechanics} />
    </Suspense>
  );
}

export default SalaryPage;
