"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Users, UserPlus, Trash2, Shield, 
  UserCheck, Loader2, Mail, Calendar, AlertTriangle 
} from 'lucide-react';

export default function UsersManager() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // 1. Fetch Users List (Fixed Query)
  const fetchUsers = async () => {
    try {
      setLoading(true);
      // Specific columns mangwane se 400 error ke chances kam ho jate hain
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, created_at') 
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Fetch Error:", error.message);
        throw error;
      }
      setUsers(data || []);
    } catch (error: any) {
      alert("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // 2. Update Role (Admin <-> Staff)
  const toggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'staff' : 'admin';
    if (!confirm(`Kya aap is user ko ${newRole} banana chahte hain?`)) return;

    setActionLoading(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);

    if (error) {
      alert("Role update failed: " + error.message);
    } else {
      await fetchUsers(); // Refresh the list
    }
    setActionLoading(null);
  };

  // 3. Delete User Profile
  const deleteUser = async (userId: string) => {
    if (!confirm("Chetavni: Ye sirf profile data delete karega. User ko poori tarah hatane ke liye Supabase Auth se bhi delete karna hoga.")) return;

    setActionLoading(userId);
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (error) {
      alert("Delete failed: " + error.message);
    } else {
      await fetchUsers();
    }
    setActionLoading(null);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <Loader2 className="animate-spin text-blue-600 mx-auto" size={40} />
        <p className="mt-2 text-xs font-bold text-gray-400 uppercase tracking-widest">Loading Users...</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border-2 border-gray-300 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-gray-900 uppercase italic flex items-center gap-3">
            <Users className="text-blue-600" /> Staff Management
          </h1>
          <p className="text-gray-500 text-[10px] font-black mt-1 uppercase tracking-wider">Control who can access the admin panel</p>
        </div>
        <button 
          onClick={() => alert("Naye user ko add karne ke liye Supabase Auth Dashboard ka use karein, phir wo yahan dikhne lagenge.")}
          className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-black uppercase text-xs hover:bg-blue-700 transition-all shadow-lg"
        >
          <UserPlus size={18} /> Invite Staff
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border-2 border-gray-300 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 border-b-2 border-gray-300">
              <tr>
                <th className="p-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Employee Details</th>
                <th className="p-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Access Level</th>
                <th className="p-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Joining Date</th>
                <th className="p-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 text-right">Settings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-10 text-center text-gray-400 font-bold uppercase text-xs italic">
                    No users found in database
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="p-5">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700 flex items-center justify-center font-black uppercase border-2 border-white shadow-sm">
                          {u.full_name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <div className="font-black text-gray-900 uppercase text-sm">{u.full_name || 'Unnamed User'}</div>
                          <div className="text-[10px] text-blue-600 font-bold flex items-center gap-1 uppercase tracking-tighter">
                            <Mail size={12} /> ID: {u.id.substring(0, 12)}...
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-5">
                      <span className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border-2 ${
                        u.role === 'admin' 
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200' 
                        : 'bg-white text-gray-600 border-gray-300'
                      }`}>
                        {u.role || 'staff'}
                      </span>
                    </td>
                    <td className="p-5 text-[11px] font-bold text-gray-500 uppercase italic">
                      <div className="flex items-center gap-1">
                        <Calendar size={14} className="text-gray-400" /> {new Date(u.created_at).toLocaleDateString('en-GB')}
                      </div>
                    </td>
                    <td className="p-5 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button 
                          onClick={() => toggleRole(u.id, u.role)}
                          disabled={actionLoading === u.id}
                          className={`p-2.5 rounded-xl border-2 transition-all active:scale-95 ${
                            u.role === 'admin' 
                            ? 'bg-white border-gray-300 text-gray-600 hover:border-blue-600 hover:text-blue-600' 
                            : 'bg-white border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white'
                          }`}
                          title={u.role === 'admin' ? "Make Staff" : "Make Admin"}
                        >
                          {actionLoading === u.id ? <Loader2 size={18} className="animate-spin" /> : (u.role === 'admin' ? <Shield size={18} /> : <UserCheck size={18} />)}
                        </button>
                        
                        <button 
                          onClick={() => deleteUser(u.id)}
                          disabled={actionLoading === u.id}
                          className="p-2.5 bg-white border-2 border-gray-300 text-red-600 rounded-xl hover:bg-red-600 hover:text-white hover:border-red-600 transition-all active:scale-95 shadow-sm"
                          title="Delete User"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Security Tip */}
      <div className="bg-amber-50 border-2 border-amber-200 p-4 rounded-xl flex gap-3 items-start">
        <AlertTriangle className="text-amber-600 shrink-0" size={20} />
        <p className="text-[11px] text-amber-800 font-bold leading-relaxed">
          <span className="uppercase tracking-wider block mb-1">Security Notice:</span>
          Roles changed here take effect immediately on the user's next action. Admin users can access Analytics, Settings, and User Management. Staff users only see Jobs and Inventory.
        </p>
      </div>
    </div>
  );
}