"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, Save } from 'lucide-react';

interface Product {
  id: number;
  name: string;
  price: number;
  available_stock: number;
}

interface SaleItem {
  product_id: number;
  product_name: string;
  qty: number;
  price: number;
  original_qty?: number; // for edit mode
  available_stock: number;
}

interface SaleFormProps {
  mode: 'new' | 'edit';
  saleId?: number;
}

export default function SaleForm({ mode, saleId }: SaleFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState<'admin' | 'staff'>('staff');
  const [mechanicId, setMechanicId] = useState<number | null>(null);
  const [mechanicName, setMechanicName] = useState<string>('');
  const [clients, setClients] = useState<any[]>([]);
  const [mechanics, setMechanics] = useState<any[]>([]); // for admin dropdown
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedClient, setSelectedClient] = useState<number | ''>('');
  const [selectedMechanic, setSelectedMechanic] = useState<number | ''>(''); // for admin
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [remarks, setRemarks] = useState('');
  const [items, setItems] = useState<SaleItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [totalAmount, setTotalAmount] = useState(0);
  const [originalSaleData, setOriginalSaleData] = useState<any>(null);

  useEffect(() => {
    fetchUserRole();
    fetchClients();
    fetchProducts();
    if (userRole === 'admin') fetchMechanics();
    if (mode === 'edit' && saleId) {
      fetchSaleData();
    }
  }, [mode, saleId, userRole]);

  const fetchUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, mechanic_id')
        .eq('id', user.id)
        .single();
      if (profile) {
        setUserRole(profile.role);
        if (profile.mechanic_id) {
          setMechanicId(profile.mechanic_id);
          const { data: mech } = await supabase
            .from('mechanic_list')
            .select('firstname, lastname')
            .eq('id', profile.mechanic_id)
            .single();
          if (mech) {
            setMechanicName(`${mech.firstname} ${mech.lastname}`);
          }
        }
      }
    }
  };

  const fetchClients = async () => {
    const { data } = await supabase
      .from('client_list')
      .select('id, firstname, middlename, lastname')
      .eq('delete_flag', 0)
      .order('firstname');
    if (data) {
      setClients(data.map(c => ({
        id: c.id,
        name: [c.firstname, c.middlename, c.lastname].filter(Boolean).join(' ')
      })));
    }
  };

  const fetchMechanics = async () => {
    const { data } = await supabase
      .from('mechanic_list')
      .select('id, firstname, lastname')
      .eq('status', 1)
      .order('firstname');
    if (data) {
      setMechanics(data.map(m => ({
        id: m.id,
        name: `${m.firstname} ${m.lastname}`
      })));
    }
  };

  const fetchProducts = async () => {
    // Get all active products with stock calculation
    const { data: productsData } = await supabase
      .from('product_list')
      .select('id, name, price')
      .eq('delete_flag', 0)
      .eq('status', 1);
    if (!productsData) return;

    const productsWithStock: Product[] = await Promise.all(
      productsData.map(async (p) => {
        // Total in
        const { data: stockIn } = await supabase
          .from('inventory_list')
          .select('quantity')
          .eq('product_id', p.id);
        const totalIn = stockIn?.reduce((sum, s) => sum + s.quantity, 0) || 0;

        // Total sold from transactions (excluding cancelled)
        const { data: soldFromJobs } = await supabase
          .from('transaction_products')
          .select('qty, transaction:transaction_list!inner(status)')
          .eq('product_id', p.id)
          .neq('transaction.status', 4);
        const soldJobs = soldFromJobs?.reduce((sum, s) => sum + s.qty, 0) || 0;

        // Total sold from direct sales (all sales, including current one if editing)
        const { data: soldFromDirect } = await supabase
          .from('direct_sale_items')
          .select('qty, sale_id')
          .eq('product_id', p.id);
        // If editing, exclude this sale's own items from the sold count
        const soldDirect = soldFromDirect
          ?.filter(s => mode === 'edit' && s.sale_id === saleId ? false : true)
          .reduce((sum, s) => sum + s.qty, 0) || 0;

        const available = totalIn - soldJobs - soldDirect;
        return {
          id: p.id,
          name: p.name,
          price: p.price,
          available_stock: available,
        };
      })
    );
    setProducts(productsWithStock);
  };

  const fetchSaleData = async () => {
    const { data: sale, error } = await supabase
      .from('direct_sales')
      .select(`
        *,
        items:direct_sale_items(
          product_id,
          qty,
          price
        )
      `)
      .eq('id', saleId)
      .single();
    if (error) {
      alert('Sale not found');
      router.push('/direct-sales');
      return;
    }
    setOriginalSaleData(sale);
    setSelectedClient(sale.client_id || '');
    setSelectedMechanic(sale.mechanic_id || '');
    setPaymentMode(sale.payment_mode);
    setRemarks(sale.remarks || '');

    // Fetch product names for items
    const productIds = sale.items.map((i: any) => i.product_id);
    const { data: prods } = await supabase
      .from('product_list')
      .select('id, name')
      .in('id', productIds);
    const prodMap = new Map(prods?.map(p => [p.id, p.name]));

    const itemsWithDetails = sale.items.map((item: any) => ({
      product_id: item.product_id,
      product_name: prodMap.get(item.product_id) || '',
      qty: item.qty,
      price: item.price,
      original_qty: item.qty,
      available_stock: products.find(p => p.id === item.product_id)?.available_stock || 0,
    }));
    setItems(itemsWithDetails);
    calcTotal(itemsWithDetails);
  };

  const addProduct = () => {
    if (!selectedProductId) {
      alert('Please select a product');
      return;
    }
    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;

    if (items.some(i => i.product_id === product.id)) {
      alert('Product already added');
      return;
    }

    if (product.available_stock <= 0) {
      alert('Product out of stock');
      return;
    }

    const newItem: SaleItem = {
      product_id: product.id,
      product_name: product.name,
      qty: 1,
      price: product.price,
      original_qty: 0,
      available_stock: product.available_stock,
    };
    const newItems = [...items, newItem];
    setItems(newItems);
    calcTotal(newItems);
    setSelectedProductId('');
  };

  const updateItemQty = (index: number, newQty: number) => {
    if (newQty < 1) newQty = 1;
    const item = items[index];
    const product = products.find(p => p.id === item.product_id);
    if (!product) return;

    const extraNeeded = newQty - (item.original_qty || 0);
    if (extraNeeded > product.available_stock) {
      alert(`Only ${product.available_stock} extra available`);
      return;
    }

    const newItems = [...items];
    newItems[index].qty = newQty;
    setItems(newItems);
    calcTotal(newItems);
  };

  const updateItemPrice = (index: number, newPrice: number) => {
    const newItems = [...items];
    newItems[index].price = newPrice;
    setItems(newItems);
    calcTotal(newItems);
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
    calcTotal(newItems);
  };

  const calcTotal = (itemsList: SaleItem[]) => {
    const total = itemsList.reduce((sum, i) => sum + i.qty * i.price, 0);
    setTotalAmount(total);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      alert('Please add at least one product');
      return;
    }

    // Validate stock again
    for (const item of items) {
      const product = products.find(p => p.id === item.product_id);
      if (!product) continue;
      const extraNeeded = item.qty - (item.original_qty || 0);
      if (extraNeeded > product.available_stock) {
        alert(`Insufficient stock for ${item.product_name}`);
        return;
      }
    }

    // For admin, ensure mechanic is selected
    if (userRole === 'admin' && mode === 'new' && !selectedMechanic) {
      alert('Please select a staff member');
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;
      let lastEditedBy = 0; // 0 = admin
      if (userRole === 'staff' && mechanicId) {
        lastEditedBy = mechanicId;
      } else if (userRole === 'admin') {
        lastEditedBy = 0; // admin
      }

      const saleData: any = {
        client_id: selectedClient || null,
        payment_mode: paymentMode,
        remarks: remarks || null,
        total_amount: totalAmount,
        last_edited_by: lastEditedBy,
        last_edited_date: new Date().toISOString(),
      };

      if (mode === 'new') {
        // 🔥 Send client-side timestamp
        saleData.date_created = new Date().toISOString();

        // Generate sale_code
        const { data: last } = await supabase
          .from('direct_sales')
          .select('sale_code')
          .order('id', { ascending: false })
          .limit(1);
        let nextNum = 1;
        if (last && last.length > 0) {
          const lastCode = last[0].sale_code;
          const numPart = parseInt(lastCode.replace(/\D/g, ''));
          nextNum = isNaN(numPart) ? 1 : numPart + 1;
        }
        const saleCode = `SALE${String(nextNum).padStart(6, '0')}`;
        saleData.sale_code = saleCode;

        // Set mechanic_id
        if (userRole === 'staff') {
          saleData.mechanic_id = mechanicId;
        } else {
          saleData.mechanic_id = selectedMechanic || null;
        }
      } else {
        // For edit, preserve original date_created
        saleData.date_created = originalSaleData?.date_created;
        saleData.mechanic_id = originalSaleData?.mechanic_id;
      }

      let saleIdResult;
      if (mode === 'new') {
        const { data, error } = await supabase
          .from('direct_sales')
          .insert([saleData])
          .select()
          .single();
        if (error) throw error;
        saleIdResult = data.id;
      } else {
        const { error } = await supabase
          .from('direct_sales')
          .update(saleData)
          .eq('id', saleId);
        if (error) throw error;
        saleIdResult = saleId;
      }

      // Save items
      const itemsToInsert = items.map(i => ({
        sale_id: saleIdResult,
        product_id: i.product_id,
        qty: i.qty,
        price: i.price,
      }));
      if (mode === 'edit') {
        await supabase.from('direct_sale_items').delete().eq('sale_id', saleId);
      }
      const { error: itemsError } = await supabase
        .from('direct_sale_items')
        .insert(itemsToInsert);
      if (itemsError) throw itemsError;

      router.push(`/direct-sales/${saleIdResult}`);
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Staff selection for admin */}
      {userRole === 'admin' && mode === 'new' && (
        <div>
          <label className="block text-sm font-medium mb-1">Staff (Sold by) *</label>
          <select
            value={selectedMechanic}
            onChange={(e) => setSelectedMechanic(e.target.value ? Number(e.target.value) : '' )}
            className="w-full border border-gray-300 rounded-lg p-2"
            required
          >
            <option value="">Select Staff</option>
            {mechanics.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Client & Payment */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Client</label>
          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value ? Number(e.target.value) : '' )}
            className="w-full border border-gray-300 rounded-lg p-2"
          >
            <option value="">Walk-in Customer</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Payment Mode *</label>
          <select
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value)}
            className="w-full border border-gray-300 rounded-lg p-2"
            required
          >
            <option value="Cash">Cash</option>
            <option value="Card">Card</option>
            <option value="UPI">UPI</option>
            <option value="Bank Transfer">Bank Transfer</option>
          </select>
        </div>
      </div>

      {/* Product Selection */}
      <div className="grid md:grid-cols-4 gap-2 items-end">
        <div className="md:col-span-3">
          <label className="block text-sm font-medium mb-1">Add Product</label>
          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value ? Number(e.target.value) : '' )}
            className="w-full border border-gray-300 rounded-lg p-2"
          >
            <option value="">Select Product</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} - ₹{p.price} (Stock: {p.available_stock})
              </option>
            ))}
          </select>
        </div>
        <div>
          <button
            type="button"
            onClick={addProduct}
            className="w-full bg-blue-600 text-white p-2 rounded-lg flex items-center justify-center gap-1"
          >
            <Plus size={16} /> Add
          </button>
        </div>
      </div>

      {/* Items Table */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Product</th>
              <th className="p-2 text-center w-20">Qty</th>
              <th className="p-2 text-right w-28">Price</th>
              <th className="p-2 text-right w-28">Total</th>
              <th className="p-2 text-center w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item, idx) => (
              <tr key={idx}>
                <td className="p-2">{item.product_name}</td>
                <td className="p-2">
                  <input
                    type="number"
                    min="1"
                    value={item.qty}
                    onChange={(e) => updateItemQty(idx, parseInt(e.target.value) || 1)}
                    className="w-20 border border-gray-300 rounded px-2 py-1 text-center"
                  />
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    step="0.01"
                    value={item.price}
                    onChange={(e) => updateItemPrice(idx, parseFloat(e.target.value) || 0)}
                    className="w-28 border border-gray-300 rounded px-2 py-1 text-right"
                  />
                </td>
                <td className="p-2 text-right font-medium">₹{(item.qty * item.price).toFixed(2)}</td>
                <td className="p-2 text-center">
                  <button type="button" onClick={() => removeItem(idx)} className="text-red-600 hover:text-red-800">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={5} className="p-4 text-center text-gray-400">No products added</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Total */}
      <div className="text-right text-xl font-bold">
        Total: ₹{totalAmount.toFixed(2)}
      </div>

      {/* Remarks */}
      <div>
        <label className="block text-sm font-medium mb-1">Remarks</label>
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={3}
          className="w-full border border-gray-300 rounded-lg p-2"
        />
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 disabled:bg-gray-300"
        >
          <Save size={16} /> {loading ? 'Saving...' : (mode === 'new' ? 'Create Sale' : 'Update Sale')}
        </button>
      </div>
    </form>
  );
}