"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useParams } from 'next/navigation';
import { Save, ArrowLeft, UserPlus, Loader2, Edit3, AlertTriangle, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { logActivity } from '@/lib/activity';

// ── DARK THEME CONSTANTS ──────────────────────────────────
const inputCls = "w-full px-4 py-3 rounded-xl bg-[#0d1117] border border-[#21293d] text-white placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none transition-all text-sm font-medium";
const labelCls = "block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5";
const errCls   = "text-red-400 text-xs mt-1 font-medium";

type FormState = {
  firstname: string;
  middlename: string;
  lastname: string;
  contact: string;
  email: string;
  address: string;
  opening_balance: string;
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

// ── VALIDATION ────────────────────────────────────────────
function validate(form: FormState): FieldErrors {
  const e: FieldErrors = {};
  if (!form.firstname.trim())  e.firstname = 'First name is required';
  if (!form.lastname.trim())   e.lastname  = 'Last name is required';
  if (!form.contact.trim()) {
    e.contact = 'Contact number is required';
  } else if (!/^[0-9]{10}$/.test(form.contact.trim())) {
    e.contact = 'Enter valid 10-digit number';
  }
  if (form.email.trim()) {
    const emailRe  = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const mobileRe = /^[0-9]{10}$/;
    if (!emailRe.test(form.email.trim()) && !mobileRe.test(form.email.trim()))
      e.email = 'Enter valid email or 10-digit mobile';
  }
  if (!form.address.trim()) e.address = 'Address is required';
  return e;
}

// ── MAIN COMPONENT ────────────────────────────────────────
export default function ManageClientPage() {
  const router   = useRouter();
  const params   = useParams();
  const clientId = params?.id ? parseInt(params.id as string) : null;
  const isEdit   = !!clientId;

  const [loading,      setLoading]      = useState(false);
  const [fetchLoading, setFetchLoading] = useState(isEdit);
  const [errors,       setErrors]       = useState<FieldErrors>({});
  const [submitted,    setSubmitted]    = useState(false);
  const [duplicateClients, setDuplicateClients] = useState<{id: number; name: string; contact: string}[]>([]);
  const [checkingDup, setCheckingDup] = useState(false);
  const [form, setForm] = useState<FormState>({
    firstname: '', middlename: '', lastname: '',
    contact: '', email: '', address: '', opening_balance: '0.00',
  });

  // ── FETCH EXISTING CLIENT (edit mode) ──────────────────
  useEffect(() => {
    if (!isEdit || !clientId) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('client_list')
          .select('firstname, middlename, lastname, contact, email, address, opening_balance')
          .eq('id', clientId).single();
        if (error) throw error;
        if (data) setForm({
          firstname:       data.firstname       || '',
          middlename:      data.middlename      || '',
          lastname:        data.lastname        || '',
          contact:         data.contact         || '',
          email:           data.email           || '',
          address:         data.address         || '',
          opening_balance: data.opening_balance?.toString() || '0.00',
        });
      } catch (err) {
        alert('Error loading client: ' + (err instanceof Error ? err.message : String(err)));
        router.back();
      } finally {
        setFetchLoading(false);
      }
    })();
  }, [clientId, isEdit, router]);

  // ── FIELD CHANGE ───────────────────────────────────────
  const handleChange = (field: keyof FormState, value: string) => {
    const updated = { ...form, [field]: value };
    setForm(updated);
    if (submitted) setErrors(validate(updated));
    
    // Check for duplicate contact
    if (field === 'contact' && value.length === 10 && !isEdit) {
      checkDuplicateContact(value);
    }
    if (field === 'contact' && value.length < 10) {
      setDuplicateClients([]);
    }
    
    // Check for duplicate email
    if (field === 'email' && value.trim().length > 0 && !isEdit) {
      checkDuplicateEmail(value.trim());
    }
    if (field === 'email' && value.trim().length === 0) {
      setDuplicateClients([]);
    }
  };

  // ── DUPLICATE CONTACT CHECK ───────────────────────────
  const checkDuplicateContact = async (contact: string) => {
    setCheckingDup(true);
    try {
      const { data, error } = await supabase
        .from('client_list')
        .select('id, firstname, middlename, lastname, contact')
        .eq('contact', contact)
        .eq('delete_flag', 0)
        .limit(5);
      if (!error && data && data.length > 0) {
        setDuplicateClients(data.map(c => ({
          id: c.id,
          name: [c.firstname, c.middlename, c.lastname].filter(Boolean).join(' ').trim(),
          contact: c.contact || '',
        })));
      } else {
        setDuplicateClients([]);
      }
    } catch (err) {
      console.error('Duplicate check error:', err);
      setDuplicateClients([]);
    } finally {
      setCheckingDup(false);
    }
  };

  // ── DUPLICATE EMAIL CHECK ───────────────────────────
  const checkDuplicateEmail = async (email: string) => {
    setCheckingDup(true);
    try {
      const { data, error } = await supabase
        .from('client_list')
        .select('id, firstname, middlename, lastname, email')
        .eq('email', email)
        .eq('delete_flag', 0)
        .limit(5);
      if (!error && data && data.length > 0) {
        setDuplicateClients(data.map(c => ({
          id: c.id,
          name: [c.firstname, c.middlename, c.lastname].filter(Boolean).join(' ').trim(),
          contact: c.email || '',
        })));
      } else {
        setDuplicateClients([]);
      }
    } catch (err) {
      console.error('Duplicate email check error:', err);
      setDuplicateClients([]);
    } finally {
      setCheckingDup(false);
    }
  };

  // ── SUBMIT ─────────────────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const fieldErrors = validate(form);
    if (Object.keys(fieldErrors).length > 0) { setErrors(fieldErrors); return; }
    setLoading(true);
    try {
      const payload = {
        firstname:       form.firstname.trim(),
        middlename:      form.middlename.trim() || null,
        lastname:        form.lastname.trim(),
        contact:         form.contact.trim(),
        email:           form.email.trim() || null,
        address:         form.address.trim(),
        opening_balance: parseFloat(form.opening_balance) || 0,
      };
      const clientName = [payload.firstname, payload.lastname].filter(Boolean).join(' ');
      if (isEdit) {
        const { error } = await supabase
          .from('client_list')
          .update({ ...payload, date_updated: new Date().toISOString() })
          .eq('id', clientId);
        if (error) throw error;
        await logActivity('Updated Client Details', 'Clients', clientId, `Client: ${clientName}`);
      } else {
        const { data, error } = await supabase
          .from('client_list')
          .insert([{ ...payload, delete_flag: 0 }])
          .select('id').single();
        if (error) throw error;
        await logActivity('Created New Client', 'Clients', data.id, `Client: ${clientName}`);
      }
      router.push('/clients');
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  // ── LOADING ────────────────────────────────────────────
  if (fetchLoading) return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-blue-500" size={40} />
      <p className="text-slate-500 text-xs font-extrabold uppercase tracking-[0.3em]">Loading Client...</p>
    </div>
  );

  // ── RENDER ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0d1117] text-white font-sans p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* ── TOP BAR ── */}
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-bold">
            <ArrowLeft size={18} /> Back
          </button>
          <Link href="/clients" className="text-xs text-slate-600 hover:text-slate-400 transition-colors font-medium">
            All Clients
          </Link>
        </div>

        {/* ── FORM CARD ── */}
        <div className="bg-[#161b27] border border-[#21293d] rounded-2xl overflow-hidden">

          {/* Card Header */}
          <div className="px-6 py-5 border-b border-[#21293d] flex items-center gap-4">
            <div className={`p-3 rounded-xl border ${isEdit ? 'bg-amber-500/10 border-amber-500/20' : 'bg-blue-500/10 border-blue-500/20'}`}>
              {isEdit
                ? <Edit3 size={22} className="text-amber-400" />
                : <UserPlus size={22} className="text-blue-400" />
              }
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">
                {isEdit ? 'Edit Client' : 'New Client'}
              </h1>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 mt-0.5">
                {isEdit ? `Editing Client #${clientId}` : 'Add a new client to the system'}
              </p>
            </div>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSave} noValidate className="p-6 space-y-5">

            {/* First Name + Middle Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>First Name <span className="text-red-500">*</span></label>
                <input
                  type="text" placeholder="Enter first name"
                  value={form.firstname}
                  onChange={e => handleChange('firstname', e.target.value)}
                  className={`${inputCls} ${errors.firstname ? 'border-red-500' : ''}`}
                />
                {errors.firstname && <p className={errCls}>{errors.firstname}</p>}
              </div>
              <div>
                <label className={labelCls}>
                  Middle Name <span className="text-slate-600 normal-case font-semibold text-[9px]">(optional)</span>
                </label>
                <input
                  type="text" placeholder="Enter middle name"
                  value={form.middlename}
                  onChange={e => handleChange('middlename', e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Last Name + Opening Balance */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Last Name <span className="text-red-500">*</span></label>
                <input
                  type="text" placeholder="Enter last name"
                  value={form.lastname}
                  onChange={e => handleChange('lastname', e.target.value)}
                  className={`${inputCls} ${errors.lastname ? 'border-red-500' : ''}`}
                />
                {errors.lastname && <p className={errCls}>{errors.lastname}</p>}
              </div>
              <div>
                <label className={labelCls}>Opening Balance</label>
                <input
                  type="number" step="0.01" placeholder="0.00"
                  value={form.opening_balance}
                  onChange={e => handleChange('opening_balance', e.target.value)}
                  className={`${inputCls} text-right`}
                />
                <p className="text-[9px] text-slate-600 mt-1">
                  Positive = Due from client &nbsp;·&nbsp; Negative = Advance paid
                </p>
              </div>
            </div>

            {/* Contact */}
            <div>
              <label className={labelCls}>WhatsApp / Contact <span className="text-red-500">*</span></label>
              <div className="relative">
                <input
                  type="tel" placeholder="10-digit mobile number" maxLength={10}
                  value={form.contact}
                  onChange={e => handleChange('contact', e.target.value.replace(/\D/g, ''))}
                  className={`${inputCls} ${errors.contact ? 'border-red-500' : duplicateClients.length > 0 ? 'border-amber-500' : ''}`}
                />
                {checkingDup && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 size={16} className="animate-spin text-slate-500" />
                  </div>
                )}
              </div>
              {errors.contact && <p className={errCls}>{errors.contact}</p>}
              {duplicateClients.length > 0 && (
                <div className="mt-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
                    <AlertTriangle size={14} />
                    <span>⚠️ Duplicate contact found! These clients already exist:</span>
                  </div>
                  {duplicateClients.map(dup => (
                    <div key={dup.id} className="flex items-center justify-between bg-[#0d1117] rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle size={12} className="text-amber-500" />
                        <span className="text-white text-xs font-medium">{dup.name}</span>
                        <span className="text-slate-500 text-[10px]">#{dup.id}</span>
                      </div>
                      <div className="flex gap-2">
                        <a href={`/clients/${dup.id}/view`} target="_blank"
                          className="text-blue-400 hover:text-blue-300 text-[10px] font-bold no-underline">
                          View →
                        </a>
                        <a href={`/clients/${dup.id}/edit`} target="_blank"
                          className="text-amber-400 hover:text-amber-300 text-[10px] font-bold no-underline">
                          Edit →
                        </a>
                      </div>
                    </div>
                  ))}
                  <p className="text-[10px] text-amber-500/70">Still want to add? This will create a duplicate entry.</p>
                </div>
              )}
            </div>

            {/* Email (optional) */}
            <div>
              <label className={labelCls}>
                Email or Secondary Mobile <span className="text-slate-600 normal-case font-semibold text-[9px]">(optional)</span>
              </label>
              <input
                type="text" placeholder="example@gmail.com or 98xxxxxxxx"
                value={form.email}
                onChange={e => handleChange('email', e.target.value)}
                className={`${inputCls} ${errors.email ? 'border-red-500' : ''}`}
              />
              {errors.email && <p className={errCls}>{errors.email}</p>}
            </div>

            {/* Address */}
            <div>
              <label className={labelCls}>Address <span className="text-red-500">*</span></label>
              <textarea
                rows={3} placeholder="Complete address..."
                value={form.address}
                onChange={e => handleChange('address', e.target.value)}
                className={`${inputCls} resize-none ${errors.address ? 'border-red-500' : ''}`}
              />
              {errors.address && <p className={errCls}>{errors.address}</p>}
            </div>

            {/* Divider */}
            <div className="border-t border-[#21293d]" />

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="submit" disabled={loading}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg ${
                  isEdit
                    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
                }`}
              >
                {loading
                  ? <><Loader2 className="animate-spin" size={16} /> Saving...</>
                  : <><Save size={16} /> {isEdit ? 'Update Client' : 'Save Client'}</>
                }
              </button>
              <button
                type="button" onClick={() => router.back()}
                className="flex-1 sm:flex-none sm:px-8 py-3 rounded-xl font-bold text-sm bg-[#21293d] hover:bg-[#2a3550] text-slate-300 transition-all"
              >
                Cancel
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}