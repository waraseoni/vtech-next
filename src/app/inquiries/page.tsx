"use client";
import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { 
  Calendar, Search, Filter, ChevronLeft, ChevronRight, 
  RefreshCw, Eye, Trash2, Phone, Mail, User, MessageSquare,
  CheckCircle, XCircle, Loader2, Plus
} from 'lucide-react';
import InquiryModal from './components/InquiryModal';

interface Inquiry {
  id: number;
  fullname: string;
  contact: string;
  email: string;
  message: string;
  status: 0 | 1;
  date_created: string;
}

export default function InquiriesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Filter states
  const [fromDate, setFromDate] = useState(searchParams.get('from') || getFirstDayOfMonth());
  const [toDate, setToDate] = useState(searchParams.get('to') || getLastDayOfMonth());
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  
  // Data states
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, unread: 0, read: 0 });
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedInquiryId, setSelectedInquiryId] = useState<number | null>(null);
  
  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  const [mobileSearch, setMobileSearch] = useState('');
  const [mobileFilter, setMobileFilter] = useState<'all' | 'unread' | 'read'>('all');

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch inquiries when filters change
  useEffect(() => {
    fetchInquiries();
  }, [fromDate, toDate, statusFilter]);

  const fetchInquiries = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('message_list')
        .select('*', { count: 'exact' })
        .order('status', { ascending: true })
        .order('date_created', { ascending: false });

      if (fromDate) {
        query = query.gte('date_created', fromDate);
      }
      if (toDate) {
        // Add one day to include the end date
        const nextDay = new Date(toDate);
        nextDay.setDate(nextDay.getDate() + 1);
        query = query.lt('date_created', nextDay.toISOString().split('T')[0]);
      }
      if (statusFilter === 'unread') {
        query = query.eq('status', 0);
      } else if (statusFilter === 'read') {
        query = query.eq('status', 1);
      }

      const { data, error } = await query;
      if (error) throw error;
      setInquiries(data || []);
      
      // Get stats
      const { data: all } = await supabase.from('message_list').select('status');
      if (all) {
        const total = all.length;
        const unread = all.filter(i => i.status === 0).length;
        const read = total - unread;
        setStats({ total, unread, read });
      }
    } catch (err) {
      console.error('Error fetching inquiries:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this inquiry?')) return;
    try {
      const { error } = await supabase.from('message_list').delete().eq('id', id);
      if (error) throw error;
      fetchInquiries();
    } catch (err) {
      alert('Delete failed');
    }
  };

  const handleView = (id: number) => {
    setSelectedInquiryId(id);
    setModalOpen(true);
  };

  const handleFilterChange = (newFrom: string, newTo: string, newStatus: string) => {
    setFromDate(newFrom);
    setToDate(newTo);
    setStatusFilter(newStatus);
    const params = new URLSearchParams();
    if (newFrom) params.set('from', newFrom);
    if (newTo) params.set('to', newTo);
    if (newStatus && newStatus !== 'all') params.set('status', newStatus);
    router.push(`/inquiries?${params.toString()}`);
  };

  // Helper functions for month navigation
  function getFirstDayOfMonth(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
  }
  function getLastDayOfMonth(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
  }
  function addMonths(dateStr: string, months: number) {
    const d = new Date(dateStr);
    d.setMonth(d.getMonth() + months);
    return d;
  }

  const handlePrevMonth = () => {
    const newDate = addMonths(fromDate, -1);
    handleFilterChange(
      getFirstDayOfMonth(newDate),
      getLastDayOfMonth(newDate),
      statusFilter
    );
  };
  const handleNextMonth = () => {
    const newDate = addMonths(fromDate, 1);
    handleFilterChange(
      getFirstDayOfMonth(newDate),
      getLastDayOfMonth(newDate),
      statusFilter
    );
  };
  const handleCurrentMonth = () => {
    const today = new Date();
    handleFilterChange(
      getFirstDayOfMonth(today),
      getLastDayOfMonth(today),
      statusFilter
    );
  };

  // Filtered inquiries for mobile search
  const filteredMobile = inquiries.filter(i => {
    const searchTerm = mobileSearch.toLowerCase();
    const matchesSearch = 
      i.fullname.toLowerCase().includes(searchTerm) ||
      i.contact.includes(searchTerm) ||
      i.email.toLowerCase().includes(searchTerm) ||
      i.message.toLowerCase().includes(searchTerm);
    const matchesStatus = 
      mobileFilter === 'all' ||
      (mobileFilter === 'unread' && i.status === 0) ||
      (mobileFilter === 'read' && i.status === 1);
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* ===== HEADER CARD ===== */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gray-50 p-6 md:p-8 rounded-[2.5rem] border-2 border-gray-300 shadow-md">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/20">
              <MessageSquare className="text-white" size={32} />
            </div>
            <div>
              <h2 className="text-3xl font-black text-gray-900 tracking-tighter m-0 uppercase leading-none">
                Inquiries
              </h2>
              <p className="text-blue-600 text-[11px] font-extrabold uppercase tracking-[0.25em] mt-2">
                Total: {stats.total} | Unread: {stats.unread} | Read: {stats.read}
              </p>
            </div>
          </div>
          <Link 
            href="/contact"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-extrabold flex items-center gap-2 transition-all shadow-md"
          >
            <Plus size={20} /> New Inquiry
          </Link>
        </div>

        {/* Filter Bar */}
        <div className="bg-gray-50 p-4 rounded-2xl border-2 border-gray-300 shadow-sm">
          <div className="flex flex-wrap gap-3 items-center">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => handleFilterChange(e.target.value, toDate, statusFilter)}
              className="px-3 py-2 border-2 border-gray-300 rounded-xl focus:border-blue-600 outline-none text-sm font-bold"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => handleFilterChange(fromDate, e.target.value, statusFilter)}
              className="px-3 py-2 border-2 border-gray-300 rounded-xl focus:border-blue-600 outline-none text-sm font-bold"
            />
            <select
              value={statusFilter}
              onChange={(e) => handleFilterChange(fromDate, toDate, e.target.value)}
              className="px-3 py-2 border-2 border-gray-300 rounded-xl focus:border-blue-600 outline-none text-sm font-bold"
            >
              <option value="all">All Status</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
            </select>
            <div className="flex gap-2 ml-auto">
              <button onClick={handlePrevMonth} className="p-2 bg-gray-200 rounded-lg hover:bg-gray-300">
                <ChevronLeft size={18} />
              </button>
              <button onClick={handleCurrentMonth} className="p-2 bg-gray-200 rounded-lg hover:bg-gray-300">
                <RefreshCw size={18} />
              </button>
              <button onClick={handleNextMonth} className="p-2 bg-gray-200 rounded-lg hover:bg-gray-300">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Desktop Table with Horizontal Scroll */}
        {!isMobile && (
          <div className="bg-white rounded-[2.5rem] shadow-md border-2 border-gray-300 overflow-x-auto">
            <table className="w-full min-w-[1000px] border-collapse">
              <thead className="bg-gray-100 border-b-2 border-gray-300">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-extrabold uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-extrabold uppercase">Inquirer</th>
                  <th className="px-4 py-3 text-left text-xs font-extrabold uppercase">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-extrabold uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-extrabold uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-extrabold uppercase">Message</th>
                  <th className="px-4 py-3 text-center text-xs font-extrabold uppercase">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-extrabold uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {inquiries.map((inq, index) => (
                  <tr key={inq.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-sm">{index + 1}</td>
                    <td className="px-4 py-3 font-bold">{inq.fullname}</td>
                    <td className="px-4 py-3">{inq.contact}</td>
                    <td className="px-4 py-3">{inq.email}</td>
                    <td className="px-4 py-3 text-sm">{new Date(inq.date_created).toLocaleDateString()}</td>
                    <td className="px-4 py-3 max-w-xs truncate">{inq.message}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-extrabold uppercase ${
                        inq.status === 1 
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' 
                          : 'bg-blue-100 text-blue-700 border border-blue-300'
                      }`}>
                        {inq.status === 1 ? 'Read' : 'Unread'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleView(inq.id)}
                          className="p-2 bg-white border-2 border-gray-300 rounded-xl text-blue-600 hover:bg-blue-600 hover:text-white transition-all"
                          title="View"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(inq.id)}
                          className="p-2 bg-white border-2 border-gray-300 rounded-xl text-red-600 hover:bg-red-600 hover:text-white transition-all"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {inquiries.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-8 text-gray-500">No inquiries found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Mobile View */}
        {isMobile && (
          <div className="space-y-4">
            {/* Mobile Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search..."
                value={mobileSearch}
                onChange={(e) => setMobileSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border-2 border-gray-300 rounded-2xl focus:border-blue-600 outline-none"
              />
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
            
            {/* Mobile Status Filter */}
            <div className="flex gap-2">
              {['all', 'unread', 'read'].map((f) => (
                <button
                  key={f}
                  onClick={() => setMobileFilter(f as any)}
                  className={`flex-1 py-2 rounded-xl text-xs font-extrabold uppercase border-2 ${
                    mobileFilter === f
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'unread' ? 'Unread' : 'Read'}
                </button>
              ))}
            </div>

            {/* Mobile Cards */}
            {filteredMobile.map((inq) => (
              <div key={inq.id} className="bg-white p-4 rounded-2xl border-2 border-gray-300 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div className="font-extrabold text-lg">{inq.fullname}</div>
                  <span className={`px-2 py-1 rounded-full text-xs font-extrabold ${
                    inq.status === 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {inq.status === 1 ? 'Read' : 'Unread'}
                  </span>
                </div>
                <div className="text-sm text-gray-600 space-y-1 mb-3">
                  <div className="flex items-center gap-2"><Phone size={14} className="text-blue-600" /> {inq.contact}</div>
                  <div className="flex items-center gap-2"><Mail size={14} className="text-blue-600" /> {inq.email}</div>
                  <div className="flex items-start gap-2"><MessageSquare size={14} className="text-blue-600 mt-0.5" /> 
                    <span className="line-clamp-2">{inq.message}</span>
                  </div>
                  <div className="text-xs text-gray-400">{new Date(inq.date_created).toLocaleDateString()}</div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => handleView(inq.id)} className="p-2 bg-blue-50 border-2 border-blue-200 rounded-xl text-blue-700 hover:bg-blue-600 hover:text-white">
                    <Eye size={18} />
                  </button>
                  <button onClick={() => handleDelete(inq.id)} className="p-2 bg-red-50 border-2 border-red-200 rounded-xl text-red-700 hover:bg-red-600 hover:text-white">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
            {filteredMobile.length === 0 && (
              <div className="text-center py-8 text-gray-500">No inquiries match your filters</div>
            )}
          </div>
        )}
      </div>

      {/* Inquiry Modal */}
      {modalOpen && selectedInquiryId && (
        <InquiryModal
          inquiryId={selectedInquiryId}
          onClose={() => setModalOpen(false)}
          onUpdate={() => {
            fetchInquiries();
            setModalOpen(false);
          }}
        />
      )}
    </div>
  );
}