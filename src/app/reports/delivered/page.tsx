import { Suspense } from 'react';
import DeliveredReportClient from './client';

export const metadata = {
  title: 'Delivered Items Report - V-TECH',
};

export default async function DeliveredReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from_date?: string; to_date?: string; client_id?: string }>;
}) {
  const { from_date, to_date, client_id } = await searchParams;
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading report...</div>}>
      <DeliveredReportClient
        fromDate={from_date}
        toDate={to_date}
        clientId={client_id}
      />
    </Suspense>
  );
}