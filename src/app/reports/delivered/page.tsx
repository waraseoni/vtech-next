import { Suspense } from 'react';
import DeliveredReportClient from './client';

export const metadata = {
  title: 'Delivered Items Report - V-TECH',
};

export default function DeliveredReportPage({
  searchParams,
}: {
  searchParams: { from_date?: string; to_date?: string; client_id?: string };
}) {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading report...</div>}>
      <DeliveredReportClient
        fromDate={searchParams.from_date}
        toDate={searchParams.to_date}
        clientId={searchParams.client_id}
      />
    </Suspense>
  );
}