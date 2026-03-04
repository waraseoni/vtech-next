"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { 
  Package, Search, Loader2, Eye, Printer,
  MapPin
} from 'lucide-react';

interface ProductStock {
  id: number;
  name: string;
  description: string;
  total_in: number;
  total_sold: number;
  available: number;
  place: string | null;
}

export default function InventoryPage() {
  const [products, setProducts] = useState<ProductStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'in-stock' | 'low-stock' | 'out-of-stock'>('all');
  const [stats, setStats] = useState({ total: 0, inStock: 0, lowStock: 0, outOfStock: 0 });
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      // Get all active products
      const { data: productsData, error: productsError } = await supabase
        .from('product_list')
        .select('*')
        .eq('delete_flag', 0)
        .order('name');

      if (productsError) throw productsError;
      if (!productsData) {
        setProducts([]);
        setLoading(false);
        return;
      }

      const productsWithStock: ProductStock[] = await Promise.all(
        productsData.map(async (p) => {
          // Total stock in
          const { data: stockInData } = await supabase
            .from('inventory_list')
            .select('quantity')
            .eq('product_id', p.id);
          const totalIn = stockInData?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;

          // Total sold from transaction_products (repair jobs)
          let totalSold = 0;

          // 1. From repair jobs (transaction_products)
          const { data: jobItems } = await supabase
            .from('transaction_products')
            .select('qty, transaction_id')
            .eq('product_id', p.id);

          if (jobItems && jobItems.length > 0) {
            // Get transaction IDs
            const transactionIds = jobItems.map(item => item.transaction_id);
            // Fetch only non-cancelled transactions (status != 4)
            const { data: transactions } = await supabase
              .from('transaction_list')
              .select('id')
              .in('id', transactionIds)
              .neq('status', 4);

            if (transactions) {
              const validTransactionIds = new Set(transactions.map(t => t.id));
              const soldFromJobs = jobItems
                .filter(item => validTransactionIds.has(item.transaction_id))
                .reduce((sum, item) => sum + (item.qty || 0), 0);
              totalSold += soldFromJobs;
            }
          }

          // 2. From direct sales (direct_sale_items)
          const { data: saleItems } = await supabase
            .from('direct_sale_items')
            .select('qty')
            .eq('product_id', p.id);

          if (saleItems) {
            totalSold += saleItems.reduce((sum, item) => sum + (item.qty || 0), 0);
          }

          const available = totalIn - totalSold;

          // Latest place
          const { data: latestStock } = await supabase
            .from('inventory_list')
            .select('place')
            .eq('product_id', p.id)
            .order('id', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            id: p.id,
            name: p.name,
            description: p.description,
            total_in: totalIn,
            total_sold: totalSold,
            available,
            place: latestStock?.place || null,
          };
        })
      );

      setProducts(productsWithStock);

      // Calculate stats
      const total = productsWithStock.length;
      const inStock = productsWithStock.filter(p => p.available > 5).length;
      const lowStock = productsWithStock.filter(p => p.available > 0 && p.available <= 5).length;
      const outOfStock = productsWithStock.filter(p => p.available <= 0).length;
      setStats({ total, inStock, lowStock, outOfStock });

    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.description.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === 'all') return true;
    if (filter === 'in-stock') return p.available > 5;
    if (filter === 'low-stock') return p.available > 0 && p.available <= 5;
    if (filter === 'out-of-stock') return p.available <= 0;
    return true;
  });

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const content = `
      <html>
        <head><title>Inventory Report</title></head>
        <body>
          <h1>Inventory Report</h1>
          <p>Generated on: ${new Date().toLocaleString()}</p>
          <table border="1" cellpadding="5">
            <thead>
              <tr><th>#</th><th>Product</th><th>Available</th><th>Sold</th><th>Status</th></tr>
            </thead>
            <tbody>
              ${products.map((p, idx) => `
                <tr>
                  <td>${idx+1}</td>
                  <td>${p.name}</td>
                  <td>${p.available}</td>
                  <td>${p.total_sold}</td>
                  <td>${p.available <= 0 ? 'Out' : p.available <= 5 ? 'Low' : 'In Stock'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    printWindow.document.write(content);
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

  return (
    <div className="min-h-screen bg-white text-gray-900 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gray-50 p-6 md:p-8 rounded-[2.5rem] border-2 border-gray-300 shadow-md">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/20">
              <Package className="text-white" size={32} />
            </div>
            <div>
              <h2 className="text-3xl font-black text-gray-900 tracking-tighter m-0 uppercase leading-none">
                Inventory Management
              </h2>
              <p className="text-blue-600 text-[11px] font-extrabold uppercase tracking-[0.25em] mt-2">
                Total: {stats.total} | In Stock: {stats.inStock} | Low: {stats.lowStock} | Out: {stats.outOfStock}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="p-2 bg-gray-200 rounded-lg hover:bg-gray-300">
              <Printer size={18} />
            </button>
          </div>
        </div>

        {/* Desktop Table – No Image Column */}
        {!isMobile && (
          <div className="bg-white rounded-[2.5rem] shadow-md border-2 border-gray-300 overflow-hidden">
            <table className="w-full border-collapse">
              <thead className="bg-gray-100 border-b-2 border-gray-300">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-extrabold uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-extrabold uppercase">Product</th>
                  <th className="px-4 py-3 text-right text-xs font-extrabold uppercase">Available</th>
                  <th className="px-4 py-3 text-right text-xs font-extrabold uppercase">Sold</th>
                  <th className="px-4 py-3 text-center text-xs font-extrabold uppercase">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-extrabold uppercase">Place</th>
                  <th className="px-4 py-3 text-center text-xs font-extrabold uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {products.map((p, idx) => {
                  const statusClass = p.available <= 0 ? 'text-red-600' : p.available <= 5 ? 'text-amber-600' : 'text-emerald-600';
                  const statusText = p.available <= 0 ? 'Out of Stock' : p.available <= 5 ? 'Low Stock' : 'In Stock';
                  const badgeColor = p.available <= 0 ? 'bg-red-100 text-red-700 border-red-200' : 
                                    p.available <= 5 ? 'bg-amber-100 text-amber-700 border-amber-200' : 
                                    'bg-emerald-100 text-emerald-700 border-emerald-200';
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{idx+1}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold">{p.name}</div>
                        <div className="text-xs text-gray-500 truncate max-w-xs">{p.description}</div>
                      </td>
                      <td className={`px-4 py-3 text-right font-bold ${statusClass}`}>{p.available}</td>
                      <td className="px-4 py-3 text-right">{p.total_sold}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-extrabold border ${badgeColor}`}>
                          {statusText}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">{p.place || 'N/A'}</td>
                      <td className="px-4 py-3 text-center">
                        <Link href={`/inventory/${p.id}`} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700">
                          <Eye size={14} /> View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {products.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-500">No products found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Mobile View */}
        {isMobile && (
          <div className="space-y-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border-2 border-gray-300 rounded-2xl focus:border-blue-600 outline-none"
              />
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
            <div className="flex gap-2 flex-wrap">
              {(['all','in-stock','low-stock','out-of-stock'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-2 rounded-xl text-xs font-extrabold uppercase border-2 ${
                    filter === f ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'in-stock' ? 'In Stock' : f === 'low-stock' ? 'Low' : 'Out'}
                </button>
              ))}
            </div>
            {filteredProducts.map((p) => {
              const statusClass = p.available <= 0 ? 'text-red-600' : p.available <= 5 ? 'text-amber-600' : 'text-emerald-600';
              const statusText = p.available <= 0 ? 'Out of Stock' : p.available <= 5 ? 'Low Stock' : 'In Stock';
              const badgeColor = p.available <= 0 ? 'bg-red-100 text-red-700' : 
                                p.available <= 5 ? 'bg-amber-100 text-amber-700' : 
                                'bg-emerald-100 text-emerald-700';
              return (
                <div key={p.id} className="bg-white p-4 rounded-2xl border-2 border-gray-300 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-extrabold text-lg">{p.name}</div>
                    <span className={`px-2 py-1 rounded-full text-xs font-extrabold ${badgeColor}`}>
                      {statusText}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2 mb-2">{p.description}</p>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Available: <span className={`font-bold ${statusClass}`}>{p.available}</span></span>
                    <span>Sold: <span className="font-bold">{p.total_sold}</span></span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-gray-600 mb-3">
                    <MapPin size={14} className="text-blue-600" /> {p.place || 'N/A'}
                  </div>
                  <Link href={`/inventory/${p.id}`} className="block w-full text-center py-2 bg-blue-600 text-white rounded-xl font-bold">
                    View Details
                  </Link>
                </div>
              );
            })}
            {filteredProducts.length === 0 && (
              <div className="text-center py-8 text-gray-500">No products match your filters</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}