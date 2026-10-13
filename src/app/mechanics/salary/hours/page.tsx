import { Suspense } from "react";
import { requireStaff } from "@/lib/api-auth";
import { format } from "date-fns/format";
import { fetchHoursSalaryData } from "@/lib/server-hours-salary";
import HoursSalaryView from "./components/HoursSalaryView";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ month?: string }>;
};

async function SalaryHoursPage({ searchParams }: Props) {
  await requireStaff();

  const params = await searchParams;
  const currentMonthStr = format(new Date(), "yyyy-MM");
  const month =
    params?.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : currentMonthStr;

  const data = await fetchHoursSalaryData(month);

  return (
    <Suspense>
      <HoursSalaryView data={data} />
    </Suspense>
  );
}

export default SalaryHoursPage;
