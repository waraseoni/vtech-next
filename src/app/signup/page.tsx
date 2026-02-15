"use client";
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { UserPlus, Mail, Lock, User, Shield, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("staff");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // 1. Supabase Auth mein user create karna
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName }
      }
    });

    if (authError) {
      alert("Auth Error: " + authError.message);
      setLoading(false);
      return;
    }

    if (authData.user) {
      // 2. Profiles table mein role aur details insert karna
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([
          { id: authData.user.id, role: role }
        ]);

      if (profileError) {
        alert("Profile Error: " + profileError.message);
      } else {
        alert("Account created! Please check your email for verification.");
        router.push('/login');
      }
    }
    setLoading(false);
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <Link href="/login" style={backLink}><ArrowLeft size={16} /> Back to Login</Link>
        <h2 style={{ textAlign: 'center', marginBottom: '10px' }}>Create Staff Account</h2>
        <p style={{ textAlign: 'center', color: '#666', fontSize: '14px', marginBottom: '25px' }}>Add a new team member to V-Tech</p>

        <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          
          <div style={inputGroup}>
            <User size={18} color="#888" />
            <input placeholder="Full Name" style={inputStyle} onChange={(e) => setFullName(e.target.value)} required />
          </div>

          <div style={inputGroup}>
            <Mail size={18} color="#888" />
            <input type="email" placeholder="Email Address" style={inputStyle} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div style={inputGroup}>
            <Lock size={18} color="#888" />
            <input type="password" placeholder="Password (Min 6 chars)" style={inputStyle} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          <div style={inputGroup}>
            <Shield size={18} color="#888" />
            <select style={inputStyle} value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="staff">Staff (Limited Access)</option>
              <option value="admin">Admin (Full Access)</option>
            </select>
          </div>

          <button type="submit" disabled={loading} style={signUpBtn}>
            {loading ? <Loader2 className="animate-spin" /> : <><UserPlus size={18} /> Register User</>}
          </button>
        </form>
      </div>
    </div>
  );
}

// Styles
const containerStyle: React.CSSProperties = { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f4f7f9', padding: '15px' };
const cardStyle: React.CSSProperties = { background: 'white', padding: '35px', borderRadius: '15px', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', width: '100%', maxWidth: '450px' };
const inputGroup: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid #ddd', padding: '12px', borderRadius: '10px' };
const inputStyle: React.CSSProperties = { border: 'none', outline: 'none', width: '100%', fontSize: '15px', background: 'transparent' };
const signUpBtn: React.CSSProperties = { background: '#28a745', color: 'white', padding: '14px', borderRadius: '10px', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', fontWeight: 'bold', fontSize: '16px', marginTop: '10px' };
const backLink: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '5px', textDecoration: 'none', color: '#007bff', fontSize: '14px', marginBottom: '20px' };