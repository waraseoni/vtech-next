"use client";
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { 
  ArrowLeft, Package, Plus, Edit3, Trash2,
  Calendar, Loader2, FileText
} from 'lucide-react';
import StockModal from './components/StockModal';

interface Product {
  id: number;
  name: string;
  description: string;
  image_path: string | null;
}

interface StockIn {
  id: number;
  quantity: number;
  place: string | null;
  stock_date: string;
}

interface StockOut {
  id: number;
  date: string;
  reference: string;
  type: 'Repair Job' | 'Direct Sale';
  client_name: string;
  qty: number;
  price: number;
  total: number;
  link: string;
}

export default function ProductDetailPage() {
  const params = useParams();
  const productId = Number(params.id);

  const [product, setProduct] = useState<Product | null>(null);
  const [stockIn, setStockIn] = useState<StockIn[]>([]);
  const [stockOut, setStockOut] = useState<StockOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStock, setEditingStock] = useState<StockIn | null>(null);
  const [stats, setStats] = useState({ totalIn: 0, totalSold: 0, available: 0 });

  useEffect(() => {
    fetchData();
  }, [productId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch product details
      const { data: prod, error: prodErr } = await supabase
        .from('product_list')
        .select('*')
        .eq('id', productId)
        .single();
      if (prodErr) throw prodErr;
      setProduct(prod);

      // 2. Fetch stock-in entries
      const { data: stockInData } = await supabase
        .from('inventory_list')
        .select('*')
        .eq('product_id', productId)
        .order('stock_date', { ascending: false });
      setStockIn(stockInData || []);
      const totalIn = stockInData?.reduce((sum, s) => sum + s.quantity, 0) || 0;

      // 3. Fetch stock-out from repair jobs (transaction_products)
      const { data: jobItems } = await supabase
        .from('transaction_products')
        .select('qty, price, transaction_id')
        .eq('product_id', productId);

      const jobOut: StockOut[] = [];
      if (jobItems && jobItems.length > 0) {
        const transactionIds = jobItems.map(item => item.transaction_id);
        const { data: transactions } = await supabase
          .from('transaction_list')
          .select('id, date_created, job_id, code, status, client_name')
          .in('id', transactionIds)
          .neq('status', 4); // exclude cancelled

        if (transactions) {
          // Get client IDs
          const clientIds = [...new Set(transactions.map(t => Number(t.client_name)))];
          // Fetch client names
          const { data: clients } = await supabase
            .from('client_list')
            .select('id, firstname, middlename, lastname')
            .in('id', clientIds);
          const clientMap = new Map();
          clients?.forEach(c => {
            const fullName = [c.firstname, c.middlename, c.lastname].filter(Boolean).join(' ');
            clientMap.set(c.id, fullName);
          });

          const transMap = new Map(transactions.map(t => [t.id, t]));
          jobItems.forEach(item => {
            const trans = transMap.get(item.transaction_id);
            if (trans) {
              jobOut.push({
                id: trans.id,
                date: trans.date_created,
                reference: trans.job_id || trans.code,
                type: 'Repair Job',
                client_name: clientMap.get(Number(trans.client_name)) || 'N/A',
                qty: item.qty,
                price: item.price,
                total: item.qty * item.price,
                link: `/jobs/${trans.id}/view`,
              });
            }
          });
        }
      }

      // 4. Fetch stock-out from direct sales (direct_sale_items)
      const { data: saleItems } = await supabase
        .from('direct_sale_items')
        .select('qty, price, sale_id')
        .eq('product_id', productId);

      const saleOut: StockOut[] = [];
      if (saleItems && saleItems.length > 0) {
        const saleIds = saleItems.map(item => item.sale_id);
        const { data: sales } = await supabase
          .from('direct_sales')
          .select('id, date_created, sale_code, client_id')
          .in('id', saleIds);

        if (sales) {
          const clientIds = [...new Set(sales.map(s => s.client_id).filter(id => id != null))];
          const { data: clients } = await supabase
            .from('client_list')
            .select('id, firstname, middlename, lastname')
            .in('id', clientIds);
          const clientMap = new Map();
          clients?.forEach(c => {
            const fullName = [c.firstname, c.middlename, c.lastname].filter(Boolean).join(' ');
            clientMap.set(c.id, fullName);
          });

          const saleMap = new Map(sales.map(s => [s.id, s]));
          saleItems.forEach(item => {
            const sale = saleMap.get(item.sale_id);
            if (sale) {
              saleOut.push({
                id: sale.id,
                date: sale.date_created,
                reference: sale.sale_code,
                type: 'Direct Sale',
                client_name: clientMap.get(sale.client_id) || 'N/A',
                qty: item.qty,
                price: item.price,
                total: item.qty * item.price,
                link: `/direct-sales/${sale.id}/view`,
              });
            }
          });
        }
      }

      const allOut = [...jobOut, ...saleOut].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setStockOut(allOut);

      const totalSold = allOut.reduce((sum, o) => sum + o.qty, 0);
      setStats({ totalIn, totalSold, available: totalIn - totalSold });

    } catch (err) {
      console.error('Error fetching product details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStock = async (id: number) => {
    if (!confirm('Delete this stock entry?')) return;
    try {
      const { error } = await supabase.from('inventory_list').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (err) {
      alert('Failed to delete');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Product not found</h2>
          <Link href="/inventory" className="text-blue-600 underline mt-4 block">Back to Inventory</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50 p-6 rounded-[2.5rem] border-2 border-gray-300 shadow-md">
          <div className="flex items-center gap-4">
            <Link 
              href="/inventory"
              className="p-2.5 bg-white border-2 border-gray-300 rounded-xl text-gray-600 hover:bg-gray-100 transition-all"
            >
              <ArrowLeft size={20} />
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
                <Package className="text-white" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-900 tracking-tight uppercase leading-none">
                  {product.name}
                </h2>
                <p className="text-[10px] text-gray-600 font-extrabold uppercase tracking-[0.2em] mt-1">
                  ID: #{product.id}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => { setEditingStock(null); setModalOpen(true); }}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-extrabold hover:bg-blue-700 transition-all"
          >
            <Plus size={18} /> Add Stock
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-2xl border-2 border-gray-300 shadow-sm">
            <div className="text-xs font-extrabold uppercase text-gray-500">Total Stock In</div>
            <div className="text-3xl font-black text-blue-600">{stats.totalIn}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border-2 border-gray-300 shadow-sm">
            <div className="text-xs font-extrabold uppercase text-gray-500">Total Sold</div>
            <div className="text-3xl font-black text-purple-600">{stats.totalSold}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border-2 border-gray-300 shadow-sm">
            <div className="text-xs font-extrabold uppercase text-gray-500">Available Stock</div>
            <div className={`text-3xl font-black ${
              stats.available <= 0 ? 'text-red-600' : 
              stats.available <= 5 ? 'text-amber-600' : 'text-emerald-600'
            }`}>
              {stats.available}
            </div>
          </div>
        </div>

        {/* Stock-In History */}
        <div className="bg-white p-6 rounded-[2.5rem] border-2 border-gray-300 shadow-md">
          <h3 className="text-lg font-extrabold mb-4 flex items-center gap-2">
            <Package size={20} className="text-blue-600" /> Stock-In History
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse">
              <thead className="bg-gray-100 border-b-2 border-gray-300">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-extrabold uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-extrabold uppercase">Date</th>
                  <th className="px-4 py-3 text-right text-xs font-extrabold uppercase">Quantity</th>
                  <th className="px-4 py-3 text-left text-xs font-extrabold uppercase">Place</th>
                  <th className="px-4 py-3 text-center text-xs font-extrabold uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stockIn.map((s, idx) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3">{idx+1}</td>
                    <td className="px-4 py-3">{new Date(s.stock_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right font-bold">{s.quantity}</td>
                    <td className="px-4 py-3">{s.place || 'N/A'}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => { setEditingStock(s); setModalOpen(true); }}
                          className="p-2 bg-white border-2 border-gray-300 rounded-xl text-blue-600 hover:bg-blue-600 hover:text-white"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteStock(s.id)}
                          className="p-2 bg-white border-2 border-gray-300 rounded-xl text-red-600 hover:bg-red-600 hover:text-white"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {stockIn.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-4 text-gray-500">No stock entries</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stock-Out History */}
        <div className="bg-white p-6 rounded-[2.5rem] border-2 border-gray-300 shadow-md">
          <h3 className="text-lg font-extrabold mb-4 flex items-center gap-2">
            <FileText size={20} className="text-blue-600" /> Stock-Out (Usage) History
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] border-collapse">
              <thead className="bg-gray-100 border-b-2 border-gray-300">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-extrabold uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-extrabold uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-extrabold uppercase">Reference</th>
                  <th className="px-4 py-3 text-left text-xs font-extrabold uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-extrabold uppercase">Client</th>
                  <th className="px-4 py-3 text-right text-xs font-extrabold uppercase">Rate</th>
                  <th className="px-4 py-3 text-center text-xs font-extrabold uppercase">Qty</th>
                  <th className="px-4 py-3 text-right text-xs font-extrabold uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stockOut.map((s, idx) => (
                  <tr key={`${s.type}-${s.id}`}>
                    <td className="px-4 py-3">{idx+1}</td>
                    <td className="px-4 py-3">{new Date(s.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <Link href={s.link} className="text-blue-600 hover:underline font-bold">
                        {s.reference}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{s.type}</td>
                    <td className="px-4 py-3">{s.client_name}</td>
                    <td className="px-4 py-3 text-right">₹{s.price}</td>
                    <td className="px-4 py-3 text-center font-bold">{s.qty}</td>
                    <td className="px-4 py-3 text-right font-bold">₹{s.total}</td>
                  </tr>
                ))}
                {stockOut.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-4 text-gray-500">No usage records</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Stock Modal */}
      {modalOpen && (
        <StockModal
          productId={productId}
          stock={editingStock}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}