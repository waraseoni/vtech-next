import { Suspense } from 'react';
import LedgerReportClient from './client';

export const metadata = {
  title: 'Business Ledger & Cash Flow - V-TECH',
};

export default async function LedgerReportPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const from = searchParams.from || '';
  const to = searchParams.to || '';
  const apiUrl = `${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/reports/ledger?from=${from}&to=${to}`;
  
  // Fetch data on server (optional) – we can also fetch on client.
  // For faster initial render, we can fetch on server and pass as prop.
  // But to avoid blocking render, we'll fetch on client with loading state.
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading report...</div>}>
      <LedgerReportClient fromDate={from} toDate={to} />
    </Suspense>
  );
}