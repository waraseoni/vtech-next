"use client";
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { LogIn, Mail, Lock, Loader2, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Naya SSR Compatible Login
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert("Error: " + error.message);
      setLoading(false);
    } else {
      // Refresh taaki middleware cookies detect kar sake
      router.refresh();
      router.push('/');
    }
  };

  return (
    <div style={containerStyle}>
      <div style={loginCard}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={iconCircle}><ShieldCheck size={32} color="#007bff" /></div>
          <h2 style={{ margin: '10px 0 5px 0' }}>Welcome Back</h2>
          <p style={{ color: '#666', fontSize: '14px' }}>Login to manage your shop</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={inputWrapper}>
            <label style={labelStyle}>Email Address</label>
            <div style={inputGroup}>
              <Mail size={18} color="#888" />
              <input 
                type="email" 
                placeholder="staff@vtech.com" 
                style={inputStyle} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
              />
            </div>
          </div>

          <div style={inputWrapper}>
            <label style={labelStyle}>Password</label>
            <div style={inputGroup}>
              <Lock size={18} color="#888" />
              <input 
                type="password" 
                placeholder="••••••••" 
                style={inputStyle} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
              />
            </div>
          </div>

          <button type="submit" disabled={loading} style={loginBtn}>
            {loading ? <Loader2 className="animate-spin" size={20} /> : <><LogIn size={20} /> Login</>}
          </button>
        </form>
      </div>
    </div>
  );
}

// Modern CSS Styles
const containerStyle: React.CSSProperties = { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f0f2f5', padding: '15px' };
const loginCard: React.CSSProperties = { background: 'white', padding: '40px 30px', borderRadius: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', width: '100%', maxWidth: '400px' };
const iconCircle: React.CSSProperties = { width: '60px', height: '60px', background: '#eef6ff', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0 auto' };
const inputWrapper: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '5px' };
const labelStyle: React.CSSProperties = { fontSize: '13px', fontWeight: 'bold', color: '#555' };
const inputGroup: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid #ddd', padding: '12px', borderRadius: '10px', transition: '0.3s' };
const inputStyle: React.CSSProperties = { border: 'none', outline: 'none', width: '100%', fontSize: '15px' };
const loginBtn: React.CSSProperties = { background: '#007bff', color: 'white', padding: '14px', borderRadius: '12px', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', fontWeight: 'bold', fontSize: '16px', marginTop: '10px', boxShadow: '0 4px 12px rgba(0,123,255,0.2)' };