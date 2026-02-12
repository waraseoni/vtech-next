"use client";
import React, { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Save, ArrowLeft, UserCheck, Loader2, Phone, MapPin, FileText 
} from 'lucide-react';

export default function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ 
    name: "", 
    mobile: "", 
    gst: "", 
    address: "" 
  });

  // Fetch client data
  useEffect(() => {
    const fetchClient = async () => {
      try {
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .eq('id', resolvedParams.id)
          .single();

        if (error) throw error;
        
        setForm({
          name: data.name || "",
          mobile: data.mobile || "",
          gst: data.gst || "",
          address: data.address || ""
        });
      } catch (err) {
        console.error("Error fetching client:", err);
        alert("Client details nahi mil payi!");
        router.push('/clients');
      } finally {
        setLoading(false);
      }
    };
    fetchClient();
  }, [resolvedParams.id, router]);

  // Handle form update
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.name.trim()) {
      alert("Customer name zaroori hai!");
      return;
    }
    if (!form.mobile.trim()) {
      alert("Mobile number zaroori hai!");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({
          name: form.name.trim(),
          mobile: form.mobile.trim(),
          gst: form.gst.trim() || null,
          address: form.address.trim() || null
        })
        .eq('id', resolvedParams.id);

      if (error) throw error;

      alert("Client details successfully updated! ✅");
      router.push(`/clients/${resolvedParams.id}/view`);
    } catch (err: any) {
      console.error("Update error:", err);
      alert("Update karne mein galti hui: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-4 bg-white">
        <Loader2 className="animate-spin text-blue-600" size={48} />
        <p className="text-gray-500 font-bold italic uppercase tracking-[0.25em] text-sm">
          Loading Client Details...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 p-4 md:p-8 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* ===== HEADER CARD ===== */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50 p-6 rounded-[2.5rem] border-2 border-gray-300 shadow-md">
          <div className="flex items-center gap-4">
            <Link 
              href={`/clients/${resolvedParams.id}/view`}
              className="p-2.5 bg-white border-2 border-gray-300 rounded-xl text-gray-600 hover:bg-gray-100 transition-all"
            >
              <ArrowLeft size={20} />
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
                <UserCheck className="text-white" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-900 tracking-tight uppercase leading-none">
                  Edit Customer
                </h2>
                <p className="text-[10px] text-gray-600 font-extrabold uppercase tracking-[0.2em] mt-1">
                  ID: #C-{resolvedParams.id}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ===== FORM CARD ===== */}
        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border-2 border-gray-300 shadow-md">
          <form onSubmit={handleUpdate} className="space-y-6">
            
            {/* Full Name */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[11px] font-extrabold uppercase text-gray-600 tracking-[0.1em]">
                <UserCheck size={16} className="text-blue-600" />
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({...form, name: e.target.value})}
                placeholder="e.g. Vikram Singh"
                className="w-full px-5 py-3.5 bg-white border-2 border-gray-300 rounded-xl outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all text-gray-900 font-bold text-base placeholder:text-gray-400"
                required
              />
            </div>

            {/* Mobile Number */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[11px] font-extrabold uppercase text-gray-600 tracking-[0.1em]">
                <Phone size={16} className="text-blue-600" />
                Mobile Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={form.mobile}
                onChange={(e) => setForm({...form, mobile: e.target.value})}
                placeholder="e.g. 9876543210"
                className="w-full px-5 py-3.5 bg-white border-2 border-gray-300 rounded-xl outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all text-gray-900 font-bold text-base placeholder:text-gray-400"
                required
              />
            </div>

            {/* GST Number (Optional) */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[11px] font-extrabold uppercase text-gray-600 tracking-[0.1em]">
                <FileText size={16} className="text-blue-600" />
                GST Number (Optional)
              </label>
              <input
                type="text"
                value={form.gst}
                onChange={(e) => setForm({...form, gst: e.target.value})}
                placeholder="e.g. 22AAAAA0000A1Z5"
                className="w-full px-5 py-3.5 bg-white border-2 border-gray-300 rounded-xl outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all text-gray-900 font-bold text-base placeholder:text-gray-400"
              />
            </div>

            {/* Full Address */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[11px] font-extrabold uppercase text-gray-600 tracking-[0.1em]">
                <MapPin size={16} className="text-blue-600" />
                Full Address
              </label>
              <textarea
                value={form.address}
                onChange={(e) => setForm({...form, address: e.target.value})}
                placeholder="Shop or home address..."
                rows={4}
                className="w-full px-5 py-3.5 bg-white border-2 border-gray-300 rounded-xl outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all text-gray-900 font-bold text-base placeholder:text-gray-400 resize-none"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto px-10 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-[2rem] font-extrabold flex items-center justify-center gap-3 transition-all active:scale-95 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:hover:bg-gray-300 disabled:active:scale-100 shadow-md shadow-blue-500/20 text-sm uppercase tracking-wide"
              >
                {saving ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    <span>Updating...</span>
                  </>
                ) : (
                  <>
                    <Save size={20} strokeWidth={2.5} />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}