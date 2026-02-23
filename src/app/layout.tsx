"use client";
import "./globals.css";
import React, { useState, useEffect, Suspense, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  LayoutDashboard, Users, Package, FileText, 
  Settings, Wrench, Search, User, LogOut,
  Sparkles, Loader2, ArrowLeft, RotateCw, ShieldCheck
} from 'lucide-react';

// ========== SEARCH COMPONENT ==========
function NavbarSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const handleSearch = (term: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (term) params.set('search', term);
    else params.delete('search');
    router.push(`/jobs?${params.toString()}`);
  };

  return (
    <div className="relative max-w-md w-full hidden sm:block group">
      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
        <Search size={18} className="text-gray-500 group-focus-within:text-blue-600 transition-colors" />
      </div>
      <input 
        type="text" 
        placeholder="Search jobs, clients or IDs..." 
        className="w-full pl-10 pr-4 py-2.5 bg-white/90 backdrop-blur-sm border border-gray-300/50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30 focus:bg-white focus:border-blue-400 transition-all font-medium text-sm text-gray-900 placeholder:text-gray-500"
        onChange={(e) => handleSearch(e.target.value)}
        defaultValue={searchParams.get('search')?.toString() || ""}
      />
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{full_name: string, role: string} | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Logout Function
  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push('/login');
  }, [router]);

  // Auth & Profile Logic (Naye DB Schema ke mutabiq)
  useEffect(() => {
    const getAuthAndProfile = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        
        if (!authUser) {
          if (pathname !== '/login') router.push('/login');
          setLoading(false);
          return;
        }

        setUserEmail(authUser.email || null);

        // Naye Profiles table se data fetch karna
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('id', authUser.id)
          .maybeSingle();
        
        // Agar DB mein profile nahi hai toh Auth metadata use karein
        const finalName = profileData?.full_name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User';
        const finalRole = profileData?.role || (authUser.email === 'vtech.jbp@gmail.com' ? 'admin' : 'staff');

        setProfile({
          full_name: finalName,
          role: finalRole
        });

      } catch (err) {
        console.error("Auth Logic Error:", err);
      } finally {
        setLoading(false);
      }
    };

    getAuthAndProfile();

    const checkSize = () => setIsMobile(window.innerWidth < 1024);
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, [pathname, router]);

  if (pathname === '/login') return <html lang="en"><body>{children}</body></html>;

  if (loading) {
    return (
      <html lang="en">
        <body className="h-screen flex items-center justify-center bg-white text-center">
          <div>
            <Loader2 className="animate-spin text-blue-600 mx-auto" size={40} />
            <p className="mt-4 text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">V-TECH SECURE BOOT</p>
          </div>
        </body>
      </html>
    );
  }

  const isAdmin = profile?.role === 'admin';
  const displayName = profile?.full_name || "User";

  return (
    <html lang="en" className="h-full bg-gray-100">
      <body className="h-full m-0 font-sans antialiased text-gray-900">
        
        {/* Sidebar for Desktop */}
        {!isMobile && (
          <aside className="fixed top-0 left-0 h-full w-[280px] bg-white border-r border-gray-300/60 shadow-xl flex flex-col z-50">
            <div className="p-7 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                  <Sparkles size={20} />
                </div>
                <div className="text-xl font-black italic uppercase">
                  V-TECH <span className="text-blue-600 not-italic">PRO</span>
                </div>
              </div>
            </div>
            
            <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
              <p className="px-3 text-[9px] font-black uppercase text-gray-400 tracking-widest mb-2">Operation</p>
              <NavLink href="/" icon={<LayoutDashboard size={18}/>} label="Dashboard" active={pathname === '/'} />
              <NavLink href="/jobs" icon={<Wrench size={18}/>} label="Repair Jobs" active={pathname === '/jobs'} />
              <NavLink href="/clients" icon={<Users size={18}/>} label="Customer Directory" active={pathname === '/clients'} />
              <NavLink href="/inventory" icon={<Package size={18}/>} label="Stock Inventory" active={pathname === '/inventory'} />

              {isAdmin && (
                <div className="mt-8 pt-6 border-t border-gray-100">
                  <p className="px-3 text-[9px] font-black uppercase text-gray-400 tracking-widest mb-2">Administration</p>
                  <NavLink href="/users" icon={<ShieldCheck size={18}/>} label="Manage Staff" active={pathname === '/users'} />
                  <NavLink href="/reports" icon={<FileText size={18}/>} label="Reports & Analytics" active={pathname === '/reports'} />
                  <NavLink href="/settings" icon={<Settings size={18}/>} label="System Settings" active={pathname === '/settings'} />
                </div>
              )}
            </nav>
          </aside>
        )}

        <div className={`${!isMobile ? 'lg:ml-[280px]' : 'ml-0'} flex-1 min-h-screen flex flex-col`}>
          {/* Header */}
          <header className="sticky top-0 z-40 h-16 bg-white/80 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-4 sm:px-8">
            <div className="flex items-center gap-2">
              {isMobile && (
                <button onClick={() => router.back()} className="p-2 bg-gray-100 rounded-lg"><ArrowLeft size={18} /></button>
              )}
              <NavbarSearch />
            </div>

            <div className="flex items-center gap-4">
              <div className="relative">
                <button 
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-3 hover:bg-gray-50 p-1.5 rounded-xl transition-all"
                >
                  <div className="hidden sm:block text-right">
                    <p className="text-xs font-black uppercase text-gray-900 m-0">{displayName}</p>
                    <p className="text-[9px] font-bold text-blue-600 uppercase m-0">{profile?.role}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black shadow-md uppercase">
                    {displayName.charAt(0)}
                  </div>
                </button>

                {dropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)}></div>
                    <div className="absolute right-0 mt-3 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 z-50">
                      <div className="px-4 py-3 border-b border-gray-50 mb-1">
                        <p className="text-[10px] font-black text-gray-400 uppercase">Logged in as</p>
                        <p className="text-xs font-bold text-gray-900 truncate">{userEmail}</p>
                      </div>
                      <MenuLink href="/profile" icon={<User size={16}/>} label="My Profile" />
                      {isAdmin && <MenuLink href="/settings" icon={<Settings size={16}/>} label="Settings" />}
                      <button 
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <LogOut size={16} /> Logout
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          <main className={`flex-1 p-4 sm:p-8 ${isMobile ? 'pb-24' : ''}`}>
            {children}
          </main>
        </div>

        {/* Bottom Navigation for Mobile */}
        {isMobile && (
          <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white border-t border-gray-200 flex justify-around items-center z-50 px-2 pb-2">
            <FooterLink href="/" icon={<LayoutDashboard size={20}/>} label="Home" active={pathname === '/'} />
            <FooterLink href="/jobs" icon={<Wrench size={20}/>} label="Jobs" active={pathname === '/jobs'} />
            <FooterLink href="/clients" icon={<Users size={20}/>} label="Clients" active={pathname === '/clients'} />
            {isAdmin && <FooterLink href="/users" icon={<ShieldCheck size={20}/>} label="Staff" active={pathname === '/users'} />}
          </nav>
        )}
      </body>
    </html>
  );
}

// Support Components
const NavLink = ({ href, icon, label, active }: any) => (
  <Link href={href} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
    {icon}
    <span>{label}</span>
  </Link>
);

const MenuLink = ({ href, icon, label }: any) => (
  <Link href={href} className="flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-100 rounded-xl transition-all">
    {icon} {label}
  </Link>
);

const FooterLink = ({ href, icon, label, active }: any) => (
  <Link href={href} className={`flex flex-col items-center gap-1 flex-1 ${active ? 'text-blue-600' : 'text-gray-400'}`}>
    <div className={`p-2 rounded-xl ${active ? 'bg-blue-50' : ''}`}>{icon}</div>
    <span className="text-[9px] font-black uppercase tracking-tighter">{label}</span>
  </Link>
);