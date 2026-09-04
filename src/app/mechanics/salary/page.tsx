import { Suspense } from "react";
import { requireStaff } from "@/lib/api-auth";
import { fetchSalaryReportData, fetchSalaryMasterData } from "@/lib/server-salary";
import { format } from "date-fns/format";
import SalaryPageInner from "./components/SalaryPageInner";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ month?: string }>;
};

async function SalaryPage({ searchParams }: Props) {
  await requireStaff();

  const params = await searchParams;
  const currentMonthStr = format(new Date(), "yyyy-MM");
  const month = params?.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : currentMonthStr;

  const [initialReportData, initialMechanics] = await Promise.all([
    fetchSalaryReportData(month),
    fetchSalaryMasterData(),
  ]);

  return (
    <Suspense>
      <SalaryPageInner
        initialMonth={month}
        initialReportData={initialReportData}
        initialMechanics={initialMechanics}
      />
    </Suspense>
  );
}

export default SalaryPage;
