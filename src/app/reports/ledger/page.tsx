import { Suspense } from 'react';
import LedgerReportClient from './client';

export const metadata = {
  title: 'Business Ledger & Cash Flow - V-TECH',
};

// Next.js 14+ mein searchParams ek Promise hai, isliye async/await zaroori hai
export default async function LedgerReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  // Next.js 14+ ke liye await karna zaroori hai
  const params = await searchParams;
  const from = params.from || '';
  const to = params.to || '';

  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-500">Loading report...</p>
        </div>
      </div>
    }>
      <LedgerReportClient fromDate={from} toDate={to} />
    </Suspense>
  );
}