"use client";
import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function UserEditModal({ user, onClose, onSaved }: any) {
  const [email, setEmail] = useState(user.email || '');
  const [fullName, setFullName] = useState(user.full_name || '');
  const [role, setRole] = useState(user.role || 'staff');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Auth अपडेट (ईमेल, पासवर्ड, नाम)
      if (email !== user.email || password || fullName !== user.full_name) {
        const res = await fetch('/api/admin/update-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            email: email !== user.email ? email : undefined,
            password: password || undefined,
            full_name: fullName !== user.full_name ? fullName : undefined,
          }),
        });
        if (!res.ok) throw new Error('Auth update failed');
      }

      // 2. Profile अपडेट (रोल, फुल_नेम)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: fullName, role })
        .eq('id', user.id);
      if (profileError) throw profileError;

      alert('User updated successfully!');
      onSaved(); // पैरेंट को रिफ्रेश करने के लिए कहें
      onClose();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black uppercase">Edit User</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase block mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border-2 rounded-xl text-sm"
              required
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase block mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full p-3 border-2 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase block mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full p-3 border-2 rounded-xl text-sm"
            >
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase block mb-1">
              New Password <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border-2 rounded-xl text-sm"
              placeholder="Leave blank to keep current"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-black uppercase text-sm hover:bg-blue-700"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 py-3 rounded-xl font-black uppercase text-sm hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}