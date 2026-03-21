'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { FaPrint, FaWhatsapp, FaEye, FaAngleLeft, FaAngleRight, FaRedo } from 'react-icons/fa';
import { Loader2 } from 'lucide-react';
import { todayIST, formatIST, parseISTDate } from '@/lib/dateUtils';

type Transaction = {
  id: number;
  job_id: string;
  date_completed: string;
  item: string;
  amount: number;
  client_id: number;
  client_name: string;
  client_contact: string;
  opening_balance: number;
};

type ClientTotals = {
  billed: number;
  paid: number;
  sales: number;
};

type Props = {
  fromDate?: string;
  toDate?: string;
  clientId?: string;
};

import { todayIST, formatIST, parseISTDate } from '@/lib/dateUtils';

export default function DeliveredReportClient({ fromDate, toDate, clientId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clientsList, setClientsList] = useState<{ id: number; name: string }[]>([]);

  // Local state – initialized from props
  const [from, setFrom] = useState(fromDate || todayIST());
  const [to, setTo] = useState(toDate || todayIST());
  const [selectedClientId, setSelectedClientId] = useState<string>(clientId || 'all');

  // Sync local state when props change (after navigation)
  useEffect(() => {
    setFrom(fromDate || todayIST());
    setTo(toDate || todayIST());
    setSelectedClientId(clientId || 'all');
  }, [fromDate, toDate, clientId]);

  const [clientTotals, setClientTotals] = useState<Record<number, ClientTotals>>({});

  // Summary stats
  const [totalCount, setTotalCount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [uniqueClients, setUniqueClients] = useState(0);
  const [avgBill, setAvgBill] = useState(0);

  // Fetch clients for dropdown
  useEffect(() => {
    const fetchClients = async () => {
      const { data, error } = await supabase
        .from('client_list')
        .select('id, firstname, middlename, lastname')
        .order('firstname');
      if (error) {
        console.error('Error fetching clients:', error);
      } else {
        const mapped = data.map((c: any) => ({
          id: c.id,
          name: `${c.firstname} ${c.middlename || ''} ${c.lastname || ''}`.replace(/\s+/g, ' ').trim(),
        }));
        setClientsList(mapped);
      }
    };
    fetchClients();
  }, []);

  // Fetch main report data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      try {
        const startDate = `${from}T00:00:00`;
        const endDate = `${to}T23:59:59`;

        // 1. Fetch delivered transactions (status=5, del_status=0) within date range
        let query = supabase
          .from('transaction_list')
          .select('id, job_id, date_completed, item, amount, client_name')
          .eq('status', 5)
          .eq('del_status', 0)
          .gte('date_completed', startDate)
          .lte('date_completed', endDate)
          .order('date_completed', { ascending: false });

        if (selectedClientId !== 'all') {
          query = query.eq('client_name', parseInt(selectedClientId));
        }

        const { data: txData, error: txError } = await query;

        if (txError) {
          console.error('Error fetching transactions:', JSON.stringify(txError));
          setLoading(false);
          return;
        }

        if (!txData || txData.length === 0) {
          setTransactions([]);
          setTotalCount(0);
          setTotalAmount(0);
          setUniqueClients(0);
          setAvgBill(0);
          setClientTotals({});
          setLoading(false);
          return;
        }

        // 2. Extract unique client IDs from transactions
        const clientIds = [...new Set(txData.map(t => t.client_name).filter(id => id != null))];

        // 3. Fetch client details for these IDs
        let clientDetailsMap: Record<number, { name: string; contact: string; opening_balance: number }> = {};
        if (clientIds.length > 0) {
          const { data: clientsData, error: clientsError } = await supabase
            .from('client_list')
            .select('id, firstname, middlename, lastname, contact, opening_balance')
            .in('id', clientIds);

          if (clientsError) {
            console.error('Error fetching client details:', clientsError);
          } else {
            clientDetailsMap = Object.fromEntries(
              (clientsData || []).map((c: any) => [
                c.id,
                {
                  name: `${c.firstname} ${c.middlename || ''} ${c.lastname || ''}`.replace(/\s+/g, ' ').trim(),
                  contact: c.contact || '',
                  opening_balance: c.opening_balance || 0,
                },
              ])
            );
          }
        }

        // 4. Build transactions array with client details
        const transactionsList: Transaction[] = txData.map((t: any) => {
          const client = clientDetailsMap[t.client_name] || {
            name: 'Unknown',
            contact: '',
            opening_balance: 0,
          };
          return {
            id: t.id,
            job_id: t.job_id,
            date_completed: t.date_completed,
            item: t.item,
            amount: t.amount || 0,
            client_id: t.client_name,
            client_name: client.name,
            client_contact: client.contact,
            opening_balance: client.opening_balance,
          };
        });

        setTransactions(transactionsList);

        // Calculate summary stats
        const count = transactionsList.length;
        const total = transactionsList.reduce((sum, t) => sum + t.amount, 0);
        const unique = new Set(transactionsList.map(t => t.client_id)).size;
        const avg = count > 0 ? total / count : 0;

        setTotalCount(count);
        setTotalAmount(total);
        setUniqueClients(unique);
        setAvgBill(avg);

        // 5. Fetch all-time totals for balance calculation
        if (clientIds.length > 0) {
          // All-time billed amounts (status=5)
          const { data: billedData } = await supabase
            .from('transaction_list')
            .select('client_name, amount')
            .eq('status', 5)
            .in('client_name', clientIds);

          const billedMap: Record<number, number> = {};
          (billedData || []).forEach((b: any) => {
            billedMap[b.client_name] = (billedMap[b.client_name] || 0) + (b.amount || 0);
          });

          // All-time payments (amount + discount)
          const { data: paymentsData } = await supabase
            .from('client_payments')
            .select('client_id, amount, discount')
            .in('client_id', clientIds);

          const paidMap: Record<number, number> = {};
          (paymentsData || []).forEach((p: any) => {
            paidMap[p.client_id] = (paidMap[p.client_id] || 0) + (p.amount || 0) + (p.discount || 0);
          });

          // All-time direct sales
          const { data: salesData } = await supabase
            .from('direct_sales')
            .select('client_id, total_amount')
            .in('client_id', clientIds);

          const salesMap: Record<number, number> = {};
          (salesData || []).forEach((s: any) => {
            salesMap[s.client_id] = (salesMap[s.client_id] || 0) + (s.total_amount || 0);
          });

          // Combine totals
          const totals: Record<number, ClientTotals> = {};
          clientIds.forEach(id => {
            totals[id] = {
              billed: billedMap[id] || 0,
              paid: paidMap[id] || 0,
              sales: salesMap[id] || 0,
            };
          });
          setClientTotals(totals);
        } else {
          setClientTotals({});
        }
      } catch (err) {
        console.error('Unexpected error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [from, to, selectedClientId]);

  // Handle filter submit
  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (from) params.set('from_date', from);
    if (to) params.set('to_date', to);
    if (selectedClientId !== 'all') params.set('client_id', selectedClientId);
    router.push(`/reports/delivered?${params.toString()}`);
  };

  // Navigation to previous/next day – update local state first, then URL
  const goToDay = (direction: 'prev' | 'next') => {
    const current = parseISTDate(from);
    const newDate = new Date(current);
    newDate.setDate(direction === 'prev' ? current.getDate() - 1 : current.getDate() + 1);
    const newFrom = newDate.toISOString().split('T')[0];
    // Update local state immediately
    setFrom(newFrom);
    setTo(newFrom);
    // Then update URL
    const params = new URLSearchParams();
    params.set('from_date', newFrom);
    params.set('to_date', newFrom);
    if (selectedClientId !== 'all') params.set('client_id', selectedClientId);
    router.push(`/reports/delivered?${params.toString()}`);
  };

  // Reset filter – update local state then URL
  const resetFilter = () => {
    const today = todayIST();
    setSelectedClientId('all');
    setFrom(today);
    setTo(today);
    router.push('/reports/delivered');
  };

  // WhatsApp function
  const sendWA = (job: Transaction) => {
    const phone = job.client_contact.replace(/\D/g, '');
    if (phone.length < 10) {
      alert('Valid mobile number nahi mila!');
      return;
    }

    const formattedAmount = new Intl.NumberFormat('en-IN').format(job.amount);
    const businessName = 'Vikram Jain, V-Technologies, Jabalpur, Mob. 9179105875';
    const msg = `Namaste ${job.client_name} ji 🙏!\n\nAapka *${job.item}* (Job ID: #${job.job_id}) deliver kar diya gaya hai. 🏁\n\nTotal Paid: *₹${formattedAmount}*\n\nV-Technologies ki seva lene ke liye dhanyavaad. ⭐\n\n${businessName}`;

    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Get badge for balance
  const getBalanceBadge = (clientId: number, opening: number) => {
    const totals = clientTotals[clientId];
    if (!totals) return null;
    const balance = opening + totals.billed + totals.sales - totals.paid;
    if (balance > 0) {
      return <span className="badge-due">Due: ₹{balance.toFixed(2)}</span>;
    } else if (balance < 0) {
      return <span className="badge-adv">Adv: ₹{Math.abs(balance).toFixed(2)}</span>;
    } else {
      return <span className="badge-zero">Bal: ₹0.00</span>;
    }
  };

  // Selected client name for header
  const selectedClientName = selectedClientId === 'all'
    ? 'All Clients'
    : clientsList.find(c => c.id === parseInt(selectedClientId))?.name || '';

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-white rounded-lg shadow">
      {/* Header with print button */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">Delivered Items Report</h2>
        <button
          onClick={() => window.print()}
          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm flex items-center gap-1"
        >
          <FaPrint /> Print
        </button>
      </div>

      {/* Filter Form */}
      <form onSubmit={handleFilter} className="bg-gray-50 p-4 rounded mb-6 no-print">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700">From Date</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">To Date</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Client Name</label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            >
              <option value="all">All Clients</option>
              {clientsList.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
            >
              Filter
            </button>
            <button
              type="button"
              onClick={() => goToDay('prev')}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-2 rounded text-sm"
              title="Previous Day"
            >
              <FaAngleLeft />
            </button>
            <button
              type="button"
              onClick={resetFilter}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-2 rounded text-sm"
              title="Reset"
            >
              <FaRedo />
            </button>
            <button
              type="button"
              onClick={() => goToDay('next')}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-2 rounded text-sm"
              title="Next Day"
            >
              <FaAngleRight />
            </button>
          </div>
        </div>
      </form>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 no-print">
        <div className="bg-green-100 rounded-lg p-4 shadow">
          <div className="text-sm text-gray-600">Total Delivered</div>
          <div className="text-2xl font-bold">{totalCount}</div>
        </div>
        <div className="bg-yellow-100 rounded-lg p-4 shadow">
          <div className="text-sm text-gray-600">Total Amount</div>
          <div className="text-2xl font-bold">₹{totalAmount.toFixed(2)}</div>
        </div>
        <div className="bg-blue-100 rounded-lg p-4 shadow">
          <div className="text-sm text-gray-600">Unique Clients</div>
          <div className="text-2xl font-bold">{uniqueClients}</div>
        </div>
        <div className="bg-red-100 rounded-lg p-4 shadow">
          <div className="text-sm text-gray-600">Average Bill</div>
          <div className="text-2xl font-bold">₹{avgBill.toFixed(2)}</div>
        </div>
      </div>

      {/* Report Header for Print */}
      <div id="print-area">
        <div className="text-center mb-6 no-print:hidden">
          <h3 className="text-lg font-bold">Delivered Items Report</h3>
          <p className="text-gray-600">
            {selectedClientName} | {formatIST(from, { day: '2-digit', month: 'short', year: 'numeric' })} {from !== to ? `- ${formatIST(to, { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}
          </p>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead className="bg-gray-800 text-white text-sm">
              <tr>
                <th className="px-4 py-2 text-center">#</th>
                <th className="px-4 py-2 text-left">Job ID</th>
                <th className="px-4 py-2 text-left">Delivery Date</th>
                <th className="px-4 py-2 text-left">Client Name & Balance</th>
                <th className="px-4 py-2 text-left">Item Details</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2 text-center no-print">Action</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-4 text-gray-500">
                    No delivered items found in this period.
                  </td>
                </tr>
              ) : (
                transactions.map((tx, idx) => (
                  <tr key={tx.id} className="border-t border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-2 text-center">{idx + 1}</td>
                    <td className="px-4 py-2 font-medium">
                      <Link href={`/jobs/${tx.id}/view`} className="text-blue-600 hover:underline">
                        {tx.job_id}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      {formatIST(tx.date_completed, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                    </td>
                    <td className="px-4 py-2">
                      <div className="font-semibold">
                        <Link href={`/clients/${tx.client_id}/view`} className="hover:underline" target="_blank">
                          {tx.client_name}
                        </Link>
                      </div>
                      <div className="mt-1">
                        {getBalanceBadge(tx.client_id, tx.opening_balance)}
                      </div>
                    </td>
                    <td className="px-4 py-2">{tx.item}</td>
                    <td className="px-4 py-2 text-right">₹{tx.amount.toFixed(2)}</td>
                    <td className="px-4 py-2 text-center no-print">
                      <div className="flex justify-center gap-1">
                        <Link
                          href={`/jobs/${tx.id}/view`}
                          className="bg-blue-500 hover:bg-blue-600 text-white p-1 rounded text-xs"
                          title="View Details"
                        >
                          <FaEye size={14} />
                        </Link>
                        <a
                          href={`/pdf/bill_template.php?job_id=${tx.job_id}`}
                          target="_blank"
                          className="bg-green-600 hover:bg-green-700 text-white p-1 rounded text-xs"
                          title="Print Bill"
                        >
                          <FaPrint size={14} />
                        </a>
                        <button
                          onClick={() => sendWA(tx)}
                          className="bg-green-500 hover:bg-green-600 text-white p-1 rounded text-xs"
                          title="WhatsApp"
                        >
                          <FaWhatsapp size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
              {transactions.length > 0 && (
                <tr className="bg-gray-100 font-semibold">
                  <td colSpan={5} className="px-4 py-2 text-right">Total Amount:</td>
                  <td className="px-4 py-2 text-right">₹{totalAmount.toFixed(2)}</td>
                  <td className="no-print"></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Custom badge styles */}
      <style jsx>{`
        .badge-due {
          background: #fc8181;
          color: white;
          font-size: 0.75rem;
          padding: 3px 8px;
          border-radius: 10px;
          font-weight: 600;
          display: inline-block;
        }
        .badge-adv {
          background: #68d391;
          color: white;
          font-size: 0.75rem;
          padding: 3px 8px;
          border-radius: 10px;
          font-weight: 600;
        }
        .badge-zero {
          background: #a0aec0;
          color: white;
          font-size: 0.75rem;
          padding: 3px 8px;
          border-radius: 10px;
          font-weight: 600;
        }
        @media print {
          .no-print { display: none; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}