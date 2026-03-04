"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Mail, Phone, MapPin, Send, CheckCircle, ArrowLeft } from 'lucide-react';

interface SystemInfo {
  email: string;
  contact: string;
  address: string;
}

export default function ContactPage() {
  const [systemInfo, setSystemInfo] = useState<SystemInfo>({
    email: '',
    contact: '',
    address: ''
  });
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    fullname: '',
    contact: '',
    email: '',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // Fetch system info on mount
  useEffect(() => {
    const fetchSystemInfo = async () => {
      const { data, error } = await supabase
        .from('system_info')
        .select('meta_field, meta_value');
      if (!error && data) {
        const info: SystemInfo = { email: '', contact: '', address: '' };
        data.forEach(item => {
          if (item.meta_field === 'email') info.email = item.meta_value;
          else if (item.meta_field === 'contact') info.contact = item.meta_value;
          else if (item.meta_field === 'address') info.address = item.meta_value;
        });
        setSystemInfo(info);
      }
      setLoading(false);
    };
    fetchSystemInfo();
  }, []);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const { error } = await supabase
        .from('message_list')
        .insert([{
          fullname: formData.fullname,
          contact: formData.contact,
          email: formData.email,
          message: formData.message,
          status: 0
        }]);
      if (error) throw error;
      setSubmitted(true);
      setFormData({ fullname: '', contact: '', email: '', message: '' });
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header Card with Back Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50 p-6 rounded-[2.5rem] border-2 border-gray-300 shadow-md">
          <div className="flex items-center gap-4">
            <Link 
              href="/inquiries"
              className="p-2.5 bg-white border-2 border-gray-300 rounded-xl text-gray-600 hover:bg-gray-100 transition-all"
            >
              <ArrowLeft size={20} />
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
                <Mail className="text-white" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-900 tracking-tight uppercase leading-none">
                  New Inquiry
                </h2>
                <p className="text-[10px] text-gray-600 font-extrabold uppercase tracking-[0.2em] mt-1">
                  Contact Form
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Contact Information (now dynamic) */}
          <div className="bg-gray-900 text-white p-8 rounded-[2.5rem] border-2 border-gray-700 shadow-xl">
            <h2 className="text-3xl font-black mb-6">Get in Touch</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-gray-800 rounded-xl">
                <Mail size={20} className="text-blue-400" />
                <div>
                  <div className="text-xs font-bold uppercase text-gray-400">Email</div>
                  <div className="font-bold">{systemInfo.email || 'Not set'}</div>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-gray-800 rounded-xl">
                <Phone size={20} className="text-blue-400" />
                <div>
                  <div className="text-xs font-bold uppercase text-gray-400">Phone</div>
                  <div className="font-bold">{systemInfo.contact || 'Not set'}</div>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-gray-800 rounded-xl">
                <MapPin size={60} className="text-blue-400" />
                <div>
                  <div className="text-xs font-bold uppercase text-gray-400">Address</div>
                  <div className="font-bold">{systemInfo.address || 'Not set'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-300 shadow-md">
            <h2 className="text-3xl font-black mb-6 text-gray-900">Send a Message</h2>
            {submitted && (
              <div className="mb-4 p-4 bg-emerald-50 border-2 border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-700">
                <CheckCircle size={20} />
                Your message has been sent. We'll get back to you soon!
              </div>
            )}
            {error && (
              <div className="mb-4 p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-700">
                Error: {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold uppercase text-gray-600 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.fullname}
                  onChange={(e) => setFormData({...formData, fullname: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-extrabold uppercase text-gray-600 mb-1">Contact Number *</label>
                <input
                  type="text"
                  required
                  value={formData.contact}
                  onChange={(e) => setFormData({...formData, contact: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-extrabold uppercase text-gray-600 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-extrabold uppercase text-gray-600 mb-1">Message *</label>
                <textarea
                  required
                  rows={4}
                  value={formData.message}
                  onChange={(e) => setFormData({...formData, message: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 outline-none resize-none"
                />
              </div>
              <button
                type="submit"
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-extrabold uppercase flex items-center justify-center gap-2 transition-all shadow-md"
              >
                <Send size={18} /> Send Message
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}