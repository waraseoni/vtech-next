'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  Package, Users, TrendingUp, DollarSign, Printer,
  ChevronLeft, ChevronRight, RefreshCw, Eye, MessageCircle,
  X, Loader2, Filter, CheckCircle2, Receipt
} from 'lucide-react';
import { todayIST, formatIST } from '@/lib/dateUtils';

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

const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export default function DeliveredReportClient({ fromDate, toDate, clientId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clientsList, setClientsList] = useState<{ id: number; name: string }[]>([]);
  const [from, setFrom] = useState(fromDate || todayIST());
  const [to, setTo] = useState(toDate || todayIST());
  const [selectedClientId, setSelectedClientId] = useState<string>(clientId || 'all');
  const [clientTotals, setClientTotals] = useState<Record<number, ClientTotals>>({});
  const [showDetailModal, setShowDetailModal] = useState<Transaction | null>(null);

  useEffect(() => {
    setFrom(fromDate || todayIST());
    setTo(toDate || todayIST());
    setSelectedClientId(clientId || 'all');
  }, [fromDate, toDate, clientId]);

  const stats = useMemo(() => {
    const count = transactions.length;
    const total = transactions.reduce((s, t) => s + t.amount, 0);
    const unique = new Set(transactions.map(t => t.client_id)).size;
    const avg = count > 0 ? total / count : 0;
    const totalBalance = transactions.reduce((s, t) => {
      const ct = clientTotals[t.client_id];
      if (!ct) return s;
      return s + t.opening_balance + ct.billed + ct.sales - ct.paid;
    }, 0);
    return { count, total, unique, avg, totalBalance };
  }, [transactions, clientTotals]);

  useEffect(() => {
    const fetchClients = async () => {
      const { data } = await supabase
        .from('client_list')
        .select('id, firstname, middlename, lastname')
        .order('firstname');
      if (data) {
        setClientsList(data.map((c) => ({
          id: c.id,
          name: `${c.firstname} ${c.middlename || ''} ${c.lastname || ''}`.replace(/\s+/g, ' ').trim(),
        })));
      }
    };
    fetchClients();
  }, []);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const startDate = `${from}T00:00:00+05:30`;
      const endDate = `${to}T23:59:59+05:30`;

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

      const { data: txData } = await query;

      if (!txData || txData.length === 0) {
        setTransactions([]);
        setClientTotals({});
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const clientIds = [...new Set(txData.map(t => t.client_name).filter(id => id != null))];

      const [{ data: clientsData }, { data: billedData }, { data: paymentsData }, { data: salesData }] = await Promise.all([
        clientIds.length > 0 ? supabase.from('client_list').select('id, firstname, middlename, lastname, contact, opening_balance').in('id', clientIds) : Promise.resolve({ data: [] }),
        // ALL transactions (any status) for total billed — matches PHP's repair_billed
        clientIds.length > 0 ? supabase.from('transaction_list').select('client_name, amount').neq('del_status', 1).in('client_name', clientIds) : Promise.resolve({ data: [] }),
        // Exclude loan repayments (loan_id = 0 or null) — matches PHP's WHERE loan_id IS NULL OR loan_id = 0
        clientIds.length > 0 ? supabase.from('client_payments').select('client_id, amount, discount').in('client_id', clientIds).or('loan_id.is.null,loan_id.eq.0') : Promise.resolve({ data: [] }),
        clientIds.length > 0 ? supabase.from('direct_sales').select('client_id, total_amount').in('client_id', clientIds) : Promise.resolve({ data: [] }),
      ]);

      const clientMap: Record<number, { name: string; contact: string; opening_balance: number }> = {};
      (clientsData || []).forEach((c) => {
        clientMap[c.id] = {
          name: `${c.firstname} ${c.middlename || ''} ${c.lastname || ''}`.replace(/\s+/g, ' ').trim(),
          contact: c.contact || '',
          opening_balance: c.opening_balance || 0,
        };
      });

      const billedMap: Record<number, number> = {};
      (billedData || []).forEach((b) => {
        billedMap[b.client_name] = (billedMap[b.client_name] || 0) + (b.amount || 0);
      });

      const paidMap: Record<number, number> = {};
      (paymentsData || []).forEach((p) => {
        paidMap[p.client_id] = (paidMap[p.client_id] || 0) + (p.amount || 0) + (p.discount || 0);
      });

      const salesMap: Record<number, number> = {};
      (salesData || []).forEach((s) => {
        salesMap[s.client_id] = (salesMap[s.client_id] || 0) + (s.total_amount || 0);
      });

      const totals: Record<number, ClientTotals> = {};
      clientIds.forEach(id => {
        totals[id] = {
          billed: billedMap[id] || 0,
          paid: paidMap[id] || 0,
          sales: salesMap[id] || 0,
        };
      });
      setClientTotals(totals);

      setTransactions(txData.map((t) => {
        const client = clientMap[t.client_name] || { name: 'Unknown', contact: '', opening_balance: 0 };
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
      }));
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [from, to, selectedClientId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (from) params.set('from_date', from);
    if (to) params.set('to_date', to);
    if (selectedClientId !== 'all') params.set('client_id', selectedClientId);
    router.push(`/reports/delivered?${params.toString()}`);
  };

  const goToDay = (direction: 'prev' | 'next') => {
    // Fix: YYYY-MM-DD string ko direct parse karo — parseISTDate + getDate() UTC timezone se galat date deta hai
    const [year, month, day] = from.split('-').map(Number);
    const current = new Date(year, month - 1, day); // local date, no timezone shift
    current.setDate(current.getDate() + (direction === 'prev' ? -1 : 1));
    const newFrom = [
      current.getFullYear(),
      String(current.getMonth() + 1).padStart(2, '0'),
      String(current.getDate()).padStart(2, '0'),
    ].join('-');
    setFrom(newFrom);
    setTo(newFrom);
    const params = new URLSearchParams();
    params.set('from_date', newFrom);
    params.set('to_date', newFrom);
    if (selectedClientId !== 'all') params.set('client_id', selectedClientId);
    router.push(`/reports/delivered?${params.toString()}`);
  };

  const resetFilter = () => {
    const today = todayIST();
    setSelectedClientId('all');
    setFrom(today);
    setTo(today);
    router.push('/reports/delivered');
  };

  const sendWA = (job: Transaction) => {
    const phone = job.client_contact.replace(/\D/g, '');
    if (phone.length < 10) {
      alert('Valid mobile number nahi mila!');
      return;
    }
    const formattedAmount = new Intl.NumberFormat('en-IN').format(job.amount);
    const msg = `🙏 Namaste ${job.client_name} ji!

🏍️ Aapka *${job.item}* (Job #${job.job_id}) DELIVERED ho gaya hai!

💰 Total Amount: *₹${formattedAmount}*

Team V-Technologies ka service lene ke liye dhanyavaad! ⭐

📱 V-Technologies, Jabalpur
Mob: 9179105875`;

    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const getBalanceInfo = (clientId: number, opening: number) => {
    const totals = clientTotals[clientId];
    if (!totals) return null;
    const balance = opening + totals.billed + totals.sales - totals.paid;
    if (balance > 0) {
      return { type: 'due', label: 'Due', value: balance, color: 'red' };
    } else if (balance < 0) {
      return { type: 'adv', label: 'Advance', value: Math.abs(balance), color: 'emerald' };
    }
    return { type: 'clear', label: 'Clear', value: 0, color: 'slate' };
  };

  const selectedClientName = selectedClientId === 'all'
    ? 'सभी ग्राहक'
    : clientsList.find(c => c.id === parseInt(selectedClientId))?.name || '';

  const dateRangeLabel = from === to
    ? formatIST(from, { day: '2-digit', month: 'short', year: 'numeric' })
    : `${formatIST(from, { day: '2-digit', month: 'short' })} - ${formatIST(to, { day: '2-digit', month: 'short', year: 'numeric' })}`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-white flex items-center gap-2">
            <Package size={20} className="text-emerald-400" />
            डिलीवर्ड आइटम रिपोर्ट
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">{selectedClientName} • {dateRangeLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchData(true)} disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 bg-[#161b27] border border-[#21293d] rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:border-blue-500/40 transition-all">
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} /> Refresh
          </button>
          <button onClick={() => window.open(`/api/print-delivered?from=${from}&to=${to}&client_id=${selectedClientId}`, "_blank")}
            className="flex items-center gap-2 px-4 py-2 bg-[#161b27] border border-[#21293d] rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:border-blue-500/40 transition-all">
            <Printer size={13} /> Print
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="डिलीवर्ड आइटम"
          value={stats.count}
          icon={<Package size={16} />}
          color="emerald"
          sub="Total delivered"
        />
        <StatCard
          label="कुल राशि"
          value={stats.total}
          icon={<DollarSign size={16} />}
          color="amber"
          sub="Total amount"
          format="currency"
        />
        <StatCard
          label="अलग ग्राहक"
          value={stats.unique}
          icon={<Users size={16} />}
          color="blue"
          sub="Unique clients"
        />
        <StatCard
          label="औसत बिल"
          value={stats.avg}
          icon={<TrendingUp size={16} />}
          color="purple"
          sub="Average bill"
          format="currency"
        />
      </div>

      {/* Filter Bar */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl p-4">
        <form onSubmit={handleFilter} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest block mb-1">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="px-3 py-2 bg-[#111520] border border-[#21293d] rounded-xl text-xs font-bold text-slate-300 outline-none focus:border-blue-500/50" />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest block mb-1">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="px-3 py-2 bg-[#111520] border border-[#21293d] rounded-xl text-xs font-bold text-slate-300 outline-none focus:border-blue-500/50" />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="text-[10px] font-black uppercase text-slate-600 tracking-widest block mb-1">Client</label>
            <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full px-3 py-2 bg-[#111520] border border-[#21293d] rounded-xl text-xs font-bold text-slate-300 outline-none focus:border-blue-500/50">
              <option value="all">सभी ग्राहक</option>
              {clientsList.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <button type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold text-white transition-all">
            <Filter size={13} className="inline mr-1" /> Apply
          </button>
          <button type="button" onClick={() => goToDay('prev')}
            className="px-3 py-2 bg-[#111520] border border-[#21293d] rounded-xl text-slate-400 hover:text-white hover:border-blue-500/40 transition-all">
            <ChevronLeft size={14} />
          </button>
          <button type="button" onClick={resetFilter}
            className="px-3 py-2 bg-[#111520] border border-[#21293d] rounded-xl text-slate-400 hover:text-white hover:border-blue-500/40 transition-all">
            <RefreshCw size={13} />
          </button>
          <button type="button" onClick={() => goToDay('next')}
            className="px-3 py-2 bg-[#111520] border border-[#21293d] rounded-xl text-slate-400 hover:text-white hover:border-blue-500/40 transition-all">
            <ChevronRight size={14} />
          </button>
        </form>
      </div>

      {/* Main Table */}
      <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#111520]">
                <th className="px-3 py-3 text-[10px] font-black uppercase text-slate-600 tracking-widest text-left">#</th>
                <th className="px-3 py-3 text-[10px] font-black uppercase text-slate-600 tracking-widest text-left">Job ID</th>
                <th className="px-3 py-3 text-[10px] font-black uppercase text-slate-600 tracking-widest text-left">Date</th>
                <th className="px-3 py-3 text-[10px] font-black uppercase text-slate-600 tracking-widest text-left">Client</th>
                <th className="px-3 py-3 text-[10px] font-black uppercase text-slate-600 tracking-widest text-left">Item</th>
                <th className="px-3 py-3 text-[10px] font-black uppercase text-slate-600 tracking-widest text-right">Amount</th>
                <th className="px-3 py-3 text-[10px] font-black uppercase text-slate-600 tracking-widest text-center">Balance</th>
                <th className="px-3 py-3 text-[10px] font-black uppercase text-slate-600 tracking-widest text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-16">
                    <Loader2 size={24} className="animate-spin text-blue-400 mx-auto" />
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="text-center py-16">
                      <Package size={48} className="text-slate-700 mx-auto mb-3" />
                      <p className="text-slate-500 font-bold">No delivered items found</p>
                      <p className="text-slate-600 text-xs mt-1">Try changing the date range or client</p>
                    </div>
                  </td>
                </tr>
              ) : (
                transactions.map((tx, idx) => {
                  const balanceInfo = getBalanceInfo(tx.client_id, tx.opening_balance);
                  return (
                    <tr key={tx.id} className="border-t border-[#21293d]/50 hover:bg-white/[0.02] transition-colors group">
                      <td className="px-3 py-3 text-xs text-slate-600">{idx + 1}</td>
                      <td className="px-3 py-3">
                        <Link href={`/jobs/${tx.id}/view`}
                          className="text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors">
                          #{tx.job_id}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-400">
                        {formatIST(tx.date_completed, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                      </td>
                      <td className="px-3 py-3">
                        <Link href={`/clients/${tx.client_id}`}
                          className="text-sm font-bold text-slate-200 hover:text-white transition-colors">
                          {tx.client_name}
                        </Link>
                        <div className="text-[10px] text-slate-600">{tx.client_contact || '—'}</div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-xs text-slate-300 line-clamp-1 max-w-[200px] block">{tx.item}</span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="text-sm font-black text-emerald-400">{inr(tx.amount)}</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {balanceInfo && (
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold ${
                            balanceInfo.color === 'red' ? 'bg-red-500/20 text-red-400' :
                            balanceInfo.color === 'emerald' ? 'bg-emerald-500/20 text-emerald-400' :
                            'bg-slate-500/20 text-slate-400'
                          }`}>
                            {balanceInfo.type === 'clear' && <CheckCircle2 size={10} />}
                            {balanceInfo.label}: {inr(balanceInfo.value)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setShowDetailModal(tx)}
                            className="w-7 h-7 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg flex items-center justify-center hover:bg-blue-500/20 transition-all"
                            title="View Details">
                            <Eye size={12} />
                          </button>
                          <a href={`/pdf/bill_template.php?job_id=${tx.job_id}`} target="_blank"
                            className="w-7 h-7 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg flex items-center justify-center hover:bg-emerald-500/20 transition-all"
                            title="Print Bill">
                            <Receipt size={12} />
                          </a>
                          <button onClick={() => sendWA(tx)}
                            className="w-7 h-7 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg flex items-center justify-center hover:bg-green-500/20 transition-all"
                            title="WhatsApp">
                            <MessageCircle size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {!loading && transactions.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-emerald-500/30 bg-emerald-500/5">
                  <td colSpan={5} className="px-3 py-3 text-sm font-black text-emerald-400">कुल ({transactions.length} items)</td>
                  <td className="px-3 py-3 text-right text-sm font-black text-emerald-400">{inr(stats.total)}</td>
                  <td />
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {showDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setShowDetailModal(null)}>
          <div className="bg-[#161b27] border border-[#21293d] rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[#21293d]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                  <CheckCircle2 size={20} className="text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-black text-white">Job #{showDetailModal.job_id}</h3>
                  <p className="text-[10px] text-slate-500">Delivery Details</p>
                </div>
              </div>
              <button onClick={() => setShowDetailModal(null)}
                className="w-8 h-8 flex items-center justify-center bg-[#111520] hover:bg-[#21293d] rounded-lg text-slate-500 hover:text-white transition-all">
                <X size={14} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#111520] rounded-xl p-3">
                  <p className="text-[10px] text-slate-600 font-black uppercase">Client</p>
                  <p className="text-sm font-bold text-white mt-1">{showDetailModal.client_name}</p>
                </div>
                <div className="bg-[#111520] rounded-xl p-3">
                  <p className="text-[10px] text-slate-600 font-black uppercase">Contact</p>
                  <p className="text-sm font-bold text-white mt-1">{showDetailModal.client_contact || '—'}</p>
                </div>
                <div className="bg-[#111520] rounded-xl p-3">
                  <p className="text-[10px] text-slate-600 font-black uppercase">Date</p>
                  <p className="text-sm font-bold text-white mt-1">
                    {formatIST(showDetailModal.date_completed, { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="bg-[#111520] rounded-xl p-3">
                  <p className="text-[10px] text-slate-600 font-black uppercase">Amount</p>
                  <p className="text-sm font-black text-emerald-400 mt-1">{inr(showDetailModal.amount)}</p>
                </div>
              </div>
              <div className="bg-[#111520] rounded-xl p-3">
                <p className="text-[10px] text-slate-600 font-black uppercase">Item Details</p>
                <p className="text-sm text-slate-300 mt-1">{showDetailModal.item}</p>
              </div>
              {(() => {
                const balanceInfo = getBalanceInfo(showDetailModal.client_id, showDetailModal.opening_balance);
                return balanceInfo && (
                  <div className="bg-[#111520] rounded-xl p-3">
                    <p className="text-[10px] text-slate-600 font-black uppercase">Client Balance</p>
                    <p className={`text-sm font-black mt-1 ${
                      balanceInfo.color === 'red' ? 'text-red-400' :
                      balanceInfo.color === 'emerald' ? 'text-emerald-400' : 'text-slate-400'
                    }`}>
                      {balanceInfo.label}: {inr(balanceInfo.value)}
                    </p>
                  </div>
                );
              })()}
              <div className="flex gap-2 pt-2">
                <Link href={`/jobs/${showDetailModal.id}/view`}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold text-white transition-all">
                  <Eye size={14} /> View Job
                </Link>
                <button onClick={() => sendWA(showDetailModal)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 rounded-xl text-xs font-bold text-white transition-all">
                  <MessageCircle size={14} /> WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color, sub, format = 'number' }: {
  label: string; value: number; icon: React.ReactElement; color: string; sub?: string; format?: string;
}) {
  const colorMap: Record<string, { bg: string; text: string; icon: string }> = {
    emerald: { bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400', icon: 'bg-emerald-500/20' },
    amber: { bg: 'bg-amber-500/10 border-amber-500/20', text: 'text-amber-400', icon: 'bg-amber-500/20' },
    blue: { bg: 'bg-blue-500/10 border-blue-500/20', text: 'text-blue-400', icon: 'bg-blue-500/20' },
    purple: { bg: 'bg-purple-500/10 border-purple-500/20', text: 'text-purple-400', icon: 'bg-purple-500/20' },
    red: { bg: 'bg-red-500/10 border-red-500/20', text: 'text-red-400', icon: 'bg-red-500/20' },
  };
  const colors = colorMap[color] || colorMap.blue;
  const formattedValue = format === 'currency'
    ? "₹" + value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    : value.toLocaleString();

  const renderIcon = () => {
    const Icon = icon.type;
    return <Icon size={16} className={colors.text} />;
  };

  return (
    <div className={`border rounded-2xl p-4 ${colors.bg}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-black uppercase text-slate-600 tracking-widest">{label}</span>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${colors.icon}`}>
          {renderIcon()}
        </div>
      </div>
      <p className={`text-xl font-black ${colors.text}`}>{formattedValue}</p>
      {sub && <p className="text-[10px] text-slate-600 mt-1">{sub}</p>}
    </div>
  );
}