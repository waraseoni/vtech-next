"use client";
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { 
  ArrowLeft, Edit3, Printer, Phone,
  User, Loader2
} from 'lucide-react';
import { numberToWords } from '@/lib/utils';

interface SaleItem {
  id: number;
  product_id: number;
  product_name: string;
  qty: number;
  price: number;
  total: number;
}

interface Sale {
  id: number;
  sale_code: string;
  client_id: number | null;
  client_name: string | null;
  client_contact: string | null;
  client_address: string | null;
  mechanic_id: number;
  staff_name: string;
  total_amount: number;
  payment_mode: string;
  remarks: string | null;
  date_created: string;
  last_edited_by: number | null;
  last_edited_date: string | null;
  last_editor_name: string | null;
  items: SaleItem[];
}

export default function ViewSalePage() {
  const params = useParams();
  const saleId = Number(params.id);
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyInfo, setCompanyInfo] = useState({ name: 'V-Technologies', address: '', contact: '' });

  // Helper to format date in IST
  const formatIST = (dateStr: string, includeTime: boolean = true) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    };
    if (includeTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
      options.hour12 = true;
    }
    return date.toLocaleString('en-IN', options);
  };

  useEffect(() => {
    fetchSale();
    fetchCompanyInfo();
  }, [saleId]);

  const fetchCompanyInfo = async () => {
    const { data } = await supabase.from('system_info').select('meta_field, meta_value');
    if (data) {
      const info: any = { name: 'V-Technologies', address: '', contact: '' };
      data.forEach(item => {
        if (item.meta_field === 'name') info.name = item.meta_value;
        else if (item.meta_field === 'address') info.address = item.meta_value;
        else if (item.meta_field === 'contact') info.contact = item.meta_value;
      });
      setCompanyInfo(info);
    }
  };

  const fetchSale = async () => {
    setLoading(true);
    try {
      // 1. Fetch sale basic data
      const { data: saleData, error: saleErr } = await supabase
        .from('direct_sales')
        .select('*')
        .eq('id', saleId)
        .single();
      if (saleErr) {
        console.error('Sale query error:', JSON.stringify(saleErr, null, 2));
        throw saleErr;
      }

      // 2. Fetch client if exists
      let clientData = null;
      if (saleData.client_id) {
        const { data } = await supabase
          .from('client_list')
          .select('firstname, middlename, lastname, contact, address')
          .eq('id', saleData.client_id)
          .single();
        clientData = data;
      }

      // 3. Fetch mechanic (staff)
      let mechanicName = 'Admin';
      if (saleData.mechanic_id) {
        const { data } = await supabase
          .from('mechanic_list')
          .select('firstname, lastname')
          .eq('id', saleData.mechanic_id)
          .single();
        if (data) {
          mechanicName = `${data.firstname} ${data.lastname}`;
        }
      }

      // 4. Fetch last editor if exists
      let editorName = null;
      if (saleData.last_edited_by) {
        if (saleData.last_edited_by === 0) {
          editorName = 'Admin';
        } else {
          const { data } = await supabase
            .from('mechanic_list')
            .select('firstname, lastname')
            .eq('id', saleData.last_edited_by)
            .single();
          if (data) {
            editorName = `${data.firstname} ${data.lastname}`;
          }
        }
      }

      // 5. Fetch items with product names
      const { data: itemsData, error: itemsErr } = await supabase
        .from('direct_sale_items')
        .select('id, product_id, qty, price')
        .eq('sale_id', saleId);
      if (itemsErr) {
        console.error('Items query error:', JSON.stringify(itemsErr, null, 2));
        throw itemsErr;
      }

      const productIds = itemsData?.map(i => i.product_id) || [];
      let productMap = new Map();
      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from('product_list')
          .select('id, name')
          .in('id', productIds);
        products?.forEach(p => productMap.set(p.id, p.name));
      }

      const items: SaleItem[] = (itemsData || []).map(i => ({
        ...i,
        product_name: productMap.get(i.product_id) || 'Unknown',
        total: i.qty * i.price,
      }));

      // 6. Assemble final sale object
      const clientName = clientData
        ? [clientData.firstname, clientData.middlename, clientData.lastname].filter(Boolean).join(' ')
        : null;

      const formattedSale: Sale = {
        ...saleData,
        client_name: clientName,
        client_contact: clientData?.contact || null,
        client_address: clientData?.address || null,
        staff_name: mechanicName,
        last_editor_name: editorName,
        items,
      };

      setSale(formattedSale);
    } catch (err) {
      console.error('Error fetching sale:', err);
    } finally {
      setLoading(false);
    }
  };

  const printInvoice = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !sale) return;
    const html = `
      <html><head><title>Invoice ${sale.sale_code}</title>
      <style>body { font-family: Arial; padding: 20px; }</style></head>
      <body>
        <h1>${companyInfo.name}</h1>
        <p>${companyInfo.address}<br>Phone: ${companyInfo.contact}</p>
        <h2>Invoice: ${sale.sale_code}</h2>
        <p>Date: ${formatIST(sale.date_created)}</p>
        <p>Customer: ${sale.client_name || 'Walk-in'}</p>
        <table border="1" cellpadding="5" style="width:100%">
          <thead><tr><th>#</th><th>Product</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
          <tbody>
            ${sale.items.map((item, idx) => `
              <tr>
                <td>${idx+1}</td>
                <td>${item.product_name}</td>
                <td align="center">${item.qty}</td>
                <td align="right">₹${item.price.toFixed(2)}</td>
                <td align="right">₹${item.total.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr><th colspan="4" align="right">Total:</th><th align="right">₹${sale.total_amount.toFixed(2)}</th></tr>
          </tfoot>
        </table>
        <p>Amount in words: ${numberToWords(sale.total_amount)} Rupees Only</p>
        <p>${sale.remarks || ''}</p>
      </body></html>
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

  if (!sale) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center">Sale not found</div>
      </div>
    );
  }

  const subtotal = sale.items.reduce((sum, i) => sum + i.total, 0);
  const grandTotal = sale.total_amount;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4 flex flex-wrap justify-between items-center">
          <div className="flex items-center gap-3">
            <Link href="/direct-sales" className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-xl font-bold">Sale Invoice: {sale.sale_code}</h1>
          </div>
          <div className="flex gap-2">
            <Link href={`/direct-sales/${sale.id}/edit`} className="bg-amber-500 text-white px-4 py-2 rounded-lg flex items-center gap-2">
              <Edit3 size={18} /> Edit
            </Link>
            <button onClick={printInvoice} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
              <Printer size={18} /> Print
            </button>
          </div>
        </div>

        {/* Invoice Card */}
        <div className="bg-white rounded-xl shadow-sm p-6" id="print-area">
          {/* Company Header */}
          <div className="text-center mb-6 border-b pb-4">
            <h2 className="text-2xl font-bold text-blue-600">{companyInfo.name}</h2>
            <p className="text-sm text-gray-600">{companyInfo.address}</p>
            <p className="text-sm text-gray-600">Phone: {companyInfo.contact}</p>
          </div>

          {/* Invoice Info */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="font-semibold mb-2">Customer Details</h3>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p><span className="text-gray-500">Name:</span> {sale.client_name || 'Walk-in Customer'}</p>
                {sale.client_contact && <p><span className="text-gray-500">Phone:</span> {sale.client_contact}</p>}
                {sale.client_address && <p><span className="text-gray-500">Address:</span> {sale.client_address}</p>}
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Invoice Details</h3>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p><span className="text-gray-500">Invoice No:</span> {sale.sale_code}</p>
                <p><span className="text-gray-500">Date:</span> {formatIST(sale.date_created)}</p>
                <p><span className="text-gray-500">Staff:</span> {sale.staff_name}</p>
                {sale.last_editor_name && (
                  <p className="text-xs text-gray-400 mt-1">
                    Last edited by {sale.last_editor_name} on {formatIST(sale.last_edited_date!)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto mb-6">
            <table className="w-full border-collapse">
              <thead className="bg-gray-100 border-b border-gray-300">
                <tr>
                  <th className="p-2 text-left">#</th>
                  <th className="p-2 text-left">Product</th>
                  <th className="p-2 text-center">Qty</th>
                  <th className="p-2 text-right">Price</th>
                  <th className="p-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sale.items.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="p-2">{idx + 1}</td>
                    <td className="p-2">{item.product_name}</td>
                    <td className="p-2 text-center">{item.qty}</td>
                    <td className="p-2 text-right">₹{item.price.toFixed(2)}</td>
                    <td className="p-2 text-right">₹{item.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          <div className="flex justify-end">
            <div className="w-64">
              <div className="flex justify-between py-2">
                <span>Subtotal:</span>
                <span className="font-bold">₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 border-t border-gray-300">
                <span>Total:</span>
                <span className="font-bold text-lg">₹{grandTotal.toFixed(2)}</span>
              </div>
              <div className="text-xs text-gray-500 mt-2">
                Amount in words: {numberToWords(grandTotal)} Rupees Only
              </div>
            </div>
          </div>

          {/* Remarks */}
          {sale.remarks && (
            <div className="mt-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm"><span className="font-bold">Remarks:</span> {sale.remarks}</p>
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 pt-4 border-t text-center text-sm text-gray-500">
            <p>Goods sold are not returnable. Thank you for your business!</p>
          </div>
        </div>
      </div>
    </div>
  );
}