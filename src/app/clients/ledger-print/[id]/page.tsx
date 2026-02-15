"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSearchParams } from 'next/navigation';

export default function LedgerPrintPage({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams();
  const clientId = parseInt(params.id);
  const fromDate = searchParams.get('from');
  const toDate = searchParams.get('to');

  const [client, setClient] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLedger = async () => {
      setLoading(true);
      
      // Client details
      const { data: clientData } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();
      setClient(clientData);

      // Fetch combined transactions (jobs + direct sales + payments) with date filtering
      // This is simplified - you may need a union query or separate fetches
      
      setLoading(false);
    };
    fetchLedger();
  }, [clientId, fromDate, toDate]);

  useEffect(() => {
    // Auto-print when loaded
    window.print();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">Client Ledger</h1>
      {/* Print-friendly table */}
    </div>
  );
}