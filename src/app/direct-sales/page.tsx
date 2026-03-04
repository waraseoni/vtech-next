"use client";
import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { 
  Plus, Search, Loader2, Eye, Edit3, Trash2,
  Filter, X, ChevronLeft, ChevronRight, Printer,
  FileSpreadsheet, Phone, User
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';

interface DirectSale {
  id: number;
  sale_code: string;
  client_id: number | null;
  client_name: string | null;
  client_contact: string | null;
  client_image: string | null;
  mechanic_id: number;
  staff_name: string;
  total_amount: number;
  payment_mode: string;
  remarks: string | null;
  date_created: string;
  last_edited_by: number | null;
  last_edited_date: string | null;
  last_editor_name: string | null;
}

export default function DirectSalesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sales, setSales] = useState<DirectSale[]>([]);
  const [filteredSales, setFilteredSales] = useState<DirectSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Filters
  const [dateFrom, setDateFrom] = useState(searchParams.get('from') || format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(searchParams.get('to') || format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [paymentFilter, setPaymentFilter] = useState(searchParams.get('payment_mode') || 'all');

  // Mobile search & filter
  const [mobileSearch, setMobileSearch] = useState('');
  const [mobileFilter, setMobileFilter] = useState('all');
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Stats
  const [stats, setStats] = useState({ totalSales: 0, totalAmount: 0, avgAmount: 0 });

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    fetchSales();
  }, [dateFrom, dateTo, paymentFilter]);

  const fetchSales = async () => {
    setLoading(true);
    try {
      // 1. Fetch direct sales with basic fields
      let query = supabase
        .from('direct_sales')
        .select('*')
        .gte('date_created', `${dateFrom}T00:00:00`)
        .lte('date_created', `${dateTo}T23:59:59`)
        .order('date_created', { ascending: false });

      if (paymentFilter !== 'all') {
        query = query.eq('payment_mode', paymentFilter);
      }

      const { data: salesData, error: salesError } = await query;
      if (salesError) {
        console.error('Sales query error:', JSON.stringify(salesError, null, 2));
        throw salesError;
      }

      if (!salesData || salesData.length === 0) {
        setSales([]);
        setFilteredSales([]);
        setStats({ totalSales: 0, totalAmount: 0, avgAmount: 0 });
        setLoading(false);
        return;
      }

      // 2. Collect IDs for related data
      const clientIds = salesData.map(s => s.client_id).filter(id => id != null);
      const mechanicIds = salesData.map(s => s.mechanic_id).filter(id => id != null);
      const editorIds = salesData.map(s => s.last_edited_by).filter(id => id != null && id !== 0);

      // 3. Fetch clients
      let clientsMap = new Map();
      if (clientIds.length > 0) {
        const { data: clients } = await supabase
          .from('client_list')
          .select('id, firstname, middlename, lastname, contact, image_path')
          .in('id', clientIds);
        clients?.forEach(c => {
          const fullName = [c.firstname, c.middlename, c.lastname].filter(Boolean).join(' ');
          clientsMap.set(c.id, { name: fullName, contact: c.contact, image_path: c.image_path });
        });
      }

      // 4. Fetch mechanics (staff)
      let mechanicsMap = new Map();
      if (mechanicIds.length > 0) {
        const { data: mechanics } = await supabase
          .from('mechanic_list')
          .select('id, firstname, lastname')
          .in('id', mechanicIds);
        mechanics?.forEach(m => {
          mechanicsMap.set(m.id, `${m.firstname} ${m.lastname}`);
        });
      }

      // 5. Fetch last editors (if any)
      let editorsMap = new Map();
      if (editorIds.length > 0) {
        const { data: editors } = await supabase
          .from('mechanic_list')
          .select('id, firstname, lastname')
          .in('id', editorIds);
        editors?.forEach(e => {
          editorsMap.set(e.id, `${e.firstname} ${e.lastname}`);
        });
      }

      // 6. Assemble final data
      const formatted = salesData.map(s => {
        const client = clientsMap.get(s.client_id);
        return {
          ...s,
          client_name: client?.name || null,
          client_contact: client?.contact || null,
          client_image: client?.image_path || null,
          staff_name: mechanicsMap.get(s.mechanic_id) || 'Admin',
          last_editor_name: s.last_edited_by === 0 ? 'Admin' : editorsMap.get(s.last_edited_by) || null,
        };
      });

      setSales(formatted);
      setFilteredSales(formatted);

      // 7. Calculate stats
      const totalSales = formatted.length;
      const totalAmount = formatted.reduce((sum, s) => sum + (s.total_amount || 0), 0);
      const avgAmount = totalSales ? totalAmount / totalSales : 0;
      setStats({ totalSales, totalAmount, avgAmount });
    } catch (err) {
      console.error('Error in fetchSales:', err);
    } finally {
      setLoading(false);
    }
  };

  // Mobile search & filter
  useEffect(() => {
    if (!isMobile) return;
    const filtered = sales.filter(s => {
      const matchesSearch = 
        s.sale_code.toLowerCase().includes(mobileSearch.toLowerCase()) ||
        (s.client_name?.toLowerCase() || '').includes(mobileSearch.toLowerCase()) ||
        s.total_amount.toString().includes(mobileSearch);
      const matchesPayment = mobileFilter === 'all' || s.payment_mode === mobileFilter;
      return matchesSearch && matchesPayment;
    });
    setFilteredSales(filtered);
  }, [mobileSearch, mobileFilter, sales, isMobile]);

  const handlePrevMonth = () => {
    const newFrom = format(subMonths(new Date(dateFrom), 1), 'yyyy-MM-dd');
    const newTo = format(endOfMonth(new Date(newFrom)), 'yyyy-MM-dd');
    updateUrl(newFrom, newTo, paymentFilter);
  };

  const handleNextMonth = () => {
    const newFrom = format(addMonths(new Date(dateFrom), 1), 'yyyy-MM-dd');
    const newTo = format(endOfMonth(new Date(newFrom)), 'yyyy-MM-dd');
    updateUrl(newFrom, newTo, paymentFilter);
  };

  const handleCurrentMonth = () => {
    const newFrom = format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const newTo = format(endOfMonth(new Date()), 'yyyy-MM-dd');
    updateUrl(newFrom, newTo, 'all');
  };

  const updateUrl = (from: string, to: string, payment: string) => {
    const params = new URLSearchParams();
    params.set('from', from);
    params.set('to', to);
    if (payment !== 'all') params.set('payment_mode', payment);
    router.push(`/direct-sales?${params.toString()}`);
    setDateFrom(from);
    setDateTo(to);
    setPaymentFilter(payment);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure to delete this direct sale permanently?')) return;
    try {
      const { error } = await supabase.from('direct_sales').delete().eq('id', id);
      if (error) throw error;
      fetchSales();
    } catch (err) {
      alert('Delete failed');
    }
  };

  const exportToExcel = () => {
    // Create CSV content
    const headers = ['Sale Code', 'Date', 'Client', 'Staff', 'Amount', 'Payment Mode'];
    const rows = filteredSales.map(s => [
      s.sale_code,
      format(new Date(s.date_created), 'dd/MM/yyyy'),
      s.client_name || 'Walk-in',
      s.staff_name,
      s.total_amount.toFixed(2),
      s.payment_mode,
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `direct_sales_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
    a.click();
  };

  const printReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const html = `
      <html>
        <head><title>Direct Sales Report</title></head>
        <body>
          <h1>Direct Sales Report</h1>
          <p>From: ${dateFrom} To: ${dateTo}</p>
          <table border="1" cellpadding="5">
            <thead>
              <tr><th>Code</th><th>Date</th><th>Client</th><th>Staff</th><th>Amount</th><th>Payment</th></tr>
            </thead>
            <tbody>
              ${filteredSales.map(s => `<tr>
                <td>${s.sale_code}</td>
                <td>${format(new Date(s.date_created), 'dd/MM/yyyy')}</td>
                <td>${s.client_name || 'Walk-in'}</td>
                <td>${s.staff_name}</td>
                <td align="right">${s.total_amount.toFixed(2)}</td>
                <td>${s.payment_mode}</td>
              </tr>`).join('')}
            </tbody>
            <tfoot>
              <tr><th colspan="4" align="right">Total:</th><th>${stats.totalAmount.toFixed(2)}</th><th></th></tr>
            </tfoot>
          </table>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  // Mobile view
  if (isMobile) {
    return (
      <div className="min-h-screen bg-gray-50 p-3 pb-24">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-3 mb-3 flex justify-between items-center">
          <h1 className="font-bold">Direct Sales</h1>
          <Link href="/direct-sales/new" className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1">
            <Plus size={16} /> New
          </Link>
        </div>

        {/* Search & Filter */}
        <div className="relative mb-3">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            value={mobileSearch}
            onChange={(e) => setMobileSearch(e.target.value)}
            className="w-full pl-10 pr-10 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <button onClick={() => setShowFilterModal(true)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-gray-200 p-1 rounded">
            <Filter size={16} />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1 mb-3 overflow-x-auto">
          {['all', 'Cash', 'Card', 'UPI', 'Bank Transfer'].map((f) => (
            <button
              key={f}
              onClick={() => setMobileFilter(f)}
              className={`px-3 py-1.5 text-xs font-bold rounded-full whitespace-nowrap ${
                mobileFilter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-700'
              }`}
            >
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>

        {/* Sales Cards */}
        <div className="space-y-3">
          {filteredSales.map((s) => (
            <div key={s.id} className="bg-white rounded-xl shadow-sm border-l-4 border-l-blue-500 p-3">
              <div className="flex justify-between items-start mb-2">
                <Link href={`/direct-sales/${s.id}`} className="font-bold text-blue-600">{s.sale_code}</Link>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  s.payment_mode === 'Cash' ? 'bg-green-100 text-green-700' :
                  s.payment_mode === 'Card' ? 'bg-blue-100 text-blue-700' :
                  s.payment_mode === 'UPI' ? 'bg-cyan-100 text-cyan-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {s.payment_mode}
                </span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <User size={14} className="text-gray-400" />
                <span className="text-sm">{s.client_name || 'Walk-in Customer'}</span>
                {s.client_contact && (
                  <a href={`https://wa.me/91${s.client_contact}`} target="_blank" className="text-green-600">
                    <Phone size={14} />
                  </a>
                )}
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">{format(new Date(s.date_created), 'dd MMM yyyy')}</span>
                <span className="font-bold text-emerald-600">₹{s.total_amount.toFixed(2)}</span>
              </div>
              <div className="flex gap-2 mt-3 pt-2 border-t border-gray-100">
                <Link href={`/direct-sales/${s.id}`} className="flex-1 text-center bg-gray-100 py-2 rounded-lg text-xs font-bold text-gray-700">View</Link>
                <Link href={`/direct-sales/${s.id}/edit`} className="flex-1 text-center bg-blue-100 py-2 rounded-lg text-xs font-bold text-blue-700">Edit</Link>
                <button onClick={() => handleDelete(s.id)} className="flex-1 text-center bg-red-100 py-2 rounded-lg text-xs font-bold text-red-700">Delete</button>
              </div>
            </div>
          ))}
          {filteredSales.length === 0 && (
            <div className="text-center py-8 text-gray-400">No sales found</div>
          )}
        </div>

        {/* Filter Modal */}
        {showFilterModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-sm p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold">Filter Sales</h3>
                <button onClick={() => setShowFilterModal(false)}><X size={20} /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1">From Date</label>
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">To Date</label>
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Payment Mode</label>
                  <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 text-sm">
                    <option value="all">All</option>
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => {
                    setDateFrom(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
                    setDateTo(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
                    setPaymentFilter('all');
                  }} className="flex-1 bg-gray-200 p-2 rounded-lg text-sm">Reset</button>
                  <button onClick={() => {
                    updateUrl(dateFrom, dateTo, paymentFilter);
                    setShowFilterModal(false);
                  }} className="flex-1 bg-blue-600 text-white p-2 rounded-lg text-sm">Apply</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Desktop view
  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Direct Sales</h1>
          <Link href="/direct-sales/new" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2">
            <Plus size={18} /> New Sale
          </Link>
        </div>

        {/* Filter Bar */}
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Payment</label>
              <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="all">All</option>
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
                <option value="UPI">UPI</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
            </div>
            <button onClick={() => updateUrl(dateFrom, dateTo, paymentFilter)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">Apply</button>
            <button onClick={handlePrevMonth} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100" title="Previous Month">
              <ChevronLeft size={18} />
            </button>
            <button onClick={handleNextMonth} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100" title="Next Month">
              <ChevronRight size={18} />
            </button>
            <button onClick={handleCurrentMonth} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100" title="Current Month">
              <span className="text-sm">Current</span>
            </button>
            <div className="flex-1"></div>
            <button onClick={printReport} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100" title="Print">
              <Printer size={18} />
            </button>
            <button onClick={exportToExcel} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100" title="Export Excel">
              <FileSpreadsheet size={18} />
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="text-sm text-gray-500">Total Sales</div>
            <div className="text-2xl font-bold">{stats.totalSales}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="text-sm text-gray-500">Total Amount</div>
            <div className="text-2xl font-bold text-green-600">₹{stats.totalAmount.toFixed(2)}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="text-sm text-gray-500">Average Sale</div>
            <div className="text-2xl font-bold text-blue-600">₹{stats.avgAmount.toFixed(2)}</div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 border-b border-gray-300">
              <tr>
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Sale Code</th>
                <th className="px-4 py-3 text-left">Client</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-left">Payment</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredSales.map((s, idx) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{idx + 1}</td>
                  <td className="px-4 py-3">{format(new Date(s.date_created), 'dd MMM yyyy')}</td>
                  <td className="px-4 py-3 font-medium text-blue-600">
                    <Link href={`/direct-sales/${s.id}`}>{s.sale_code}</Link>
                    <div className="text-xs text-gray-500">by {s.staff_name}</div>
                    {s.last_editor_name && (
                      <div className="text-[10px] text-gray-400">Edited: {s.last_editor_name}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {s.client_image && (
                        <img src={s.client_image} alt="" className="w-8 h-8 rounded-full object-cover" />
                      )}
                      <div>
                        <div>{s.client_name || 'Walk-in Customer'}</div>
                        {s.client_contact && (
                          <a href={`https://wa.me/91${s.client_contact}`} target="_blank" className="text-green-600 text-xs flex items-center gap-1">
                            <Phone size={12} /> {s.client_contact}
                          </a>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-bold">₹{s.total_amount.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      s.payment_mode === 'Cash' ? 'bg-green-100 text-green-700' :
                      s.payment_mode === 'Card' ? 'bg-blue-100 text-blue-700' :
                      s.payment_mode === 'UPI' ? 'bg-cyan-100 text-cyan-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {s.payment_mode}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-2">
                      <Link href={`/direct-sales/${s.id}`} className="p-2 bg-white border border-gray-300 rounded-lg text-blue-600 hover:bg-blue-600 hover:text-white" title="View">
                        <Eye size={16} />
                      </Link>
                      <Link href={`/direct-sales/${s.id}/edit`} className="p-2 bg-white border border-gray-300 rounded-lg text-amber-600 hover:bg-amber-600 hover:text-white" title="Edit">
                        <Edit3 size={16} />
                      </Link>
                      <button onClick={() => handleDelete(s.id)} className="p-2 bg-white border border-gray-300 rounded-lg text-red-600 hover:bg-red-600 hover:text-white" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredSales.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">No sales found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}