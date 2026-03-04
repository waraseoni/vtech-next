"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { X, User, Phone, Mail, Calendar, MessageSquare, CheckCircle } from 'lucide-react';

interface Inquiry {
  id: number;
  fullname: string;
  contact: string;
  email: string;
  message: string;
  status: 0 | 1;
  date_created: string;
}

export default function InquiryModal({ inquiryId, onClose, onUpdate }: { inquiryId: number; onClose: () => void; onUpdate: () => void }) {
  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInquiry = async () => {
      const { data, error } = await supabase
        .from('message_list')
        .select('*')
        .eq('id', inquiryId)
        .single();
      if (error) {
        console.error(error);
        onClose();
        return;
      }
      setInquiry(data);
      setLoading(false);

      // Mark as read if unread
      if (data.status === 0) {
        await supabase
          .from('message_list')
          .update({ status: 1 })
          .eq('id', inquiryId);
      }
    };
    fetchInquiry();
  }, [inquiryId, onClose]);

  const handleMarkRead = async () => {
    await supabase.from('message_list').update({ status: 1 }).eq('id', inquiryId);
    onUpdate();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-6 shadow-2xl">Loading...</div>
      </div>
    );
  }

  if (!inquiry) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-extrabold flex items-center gap-2">
            <MessageSquare size={24} className="text-blue-600" />
            Inquiry Details
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border-2 border-gray-200">
            <User size={18} className="text-blue-600" />
            <div>
              <div className="text-xs font-extrabold text-gray-500 uppercase">Name</div>
              <div className="font-bold">{inquiry.fullname}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border-2 border-gray-200">
            <Phone size={18} className="text-blue-600" />
            <div>
              <div className="text-xs font-extrabold text-gray-500 uppercase">Contact</div>
              <div className="font-bold">{inquiry.contact}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border-2 border-gray-200">
            <Mail size={18} className="text-blue-600" />
            <div>
              <div className="text-xs font-extrabold text-gray-500 uppercase">Email</div>
              <div className="font-bold">{inquiry.email}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border-2 border-gray-200">
            <Calendar size={18} className="text-blue-600" />
            <div>
              <div className="text-xs font-extrabold text-gray-500 uppercase">Date</div>
              <div className="font-bold">{new Date(inquiry.date_created).toLocaleString()}</div>
            </div>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl border-2 border-gray-200">
            <div className="text-xs font-extrabold text-gray-500 uppercase mb-2">Message</div>
            <div className="whitespace-pre-wrap bg-white p-3 rounded-lg border border-gray-200">{inquiry.message}</div>
          </div>
          <div className="flex items-center justify-between pt-2">
            <span className={`px-3 py-1.5 rounded-full text-xs font-extrabold ${
              inquiry.status === 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
            }`}>
              {inquiry.status === 1 ? 'Read' : 'Unread'}
            </span>
            {inquiry.status === 0 && (
              <button
                onClick={handleMarkRead}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 flex items-center gap-2"
              >
                <CheckCircle size={16} /> Mark as Read
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}