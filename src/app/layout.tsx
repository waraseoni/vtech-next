"use client";
import "./globals.css";
import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  LayoutDashboard, Users, Package, FileText, 
  Settings, Wrench, Search, Bell, User, LogOut,
  ChevronDown, Sparkles, Loader2
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

// ========== MAIN LAYOUT ==========
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{full_name: string, role: string} | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

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

        // 1. Check Profiles Table
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('id', authUser.id)
          .maybeSingle();
        
        if (profileData && profileData.full_name) {
          setProfile(profileData);
        } else {
          // 2. Metadata Fallback (Using your DB details)
          const metaName = authUser.user_metadata?.full_name;
          setProfile({ 
            full_name: metaName || authUser.email?.split('@')[0] || 'User', 
            role: authUser.email === 'vtech.jbp@gmail.com' ? 'admin' : 'staff' 
          });
        }
      } catch (err) {
        console.error("Auth Error:", err);
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

  // FIX: Added .auth. before signOut()
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/login');
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  if (pathname === '/login') return <html lang="en"><body>{children}</body></html>;

  if (loading) {
    return (
      <html lang="en">
        <body className="h-screen flex items-center justify-center bg-white">
          <div className="text-center">
            <Loader2 className="animate-spin text-blue-600 mx-auto" size={40} />
            <p className="mt-4 text-gray-400 font-bold uppercase tracking-[0.3em] text-[10px]">V-TECH SECURE BOOT</p>
          </div>
        </body>
      </html>
    );
  }

  const isActive = (path: string) => pathname === path;
  const displayName = profile?.full_name || "User";
  const userInitial = displayName.charAt(0).toUpperCase();

  return (
    <html lang="en" className="h-full bg-gray-100">
      <body className="h-full m-0 font-sans antialiased text-gray-900 bg-gray-100">
        
        {/* SIDEBAR */}
        {!isMobile && (
          <aside className="fixed top-0 left-0 h-full w-[280px] bg-gradient-to-b from-gray-100 to-gray-50 border-r border-gray-300/60 shadow-xl flex flex-col z-50">
            <div className="p-7 border-b border-gray-300/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-lg flex items-center justify-center text-white">
                  <Sparkles size={20} />
                </div>
                <div>
                  <div className="text-xl font-black tracking-tighter italic text-gray-900 uppercase">
                    V-TECH <span className="text-blue-600 not-italic">PRO</span>
                  </div>
                </div>
              </div>
            </div>
            
            <nav className="flex-1 px-4 py-6 overflow-y-auto">
              <div className="space-y-1.5">
                <p className="px-3 text-[9px] font-extrabold uppercase text-gray-500 tracking-[0.2em] mb-2">Main Menu</p>
                <NavLink href="/" icon={<LayoutDashboard size={18}/>} label="Dashboard" active={isActive('/')} />
                <NavLink href="/jobs" icon={<Wrench size={18}/>} label="Repair Jobs" active={isActive('/jobs')} />
                <NavLink href="/clients" icon={<Users size={18}/>} label="Customers" active={isActive('/clients')} />
                <NavLink href="/inventory" icon={<Package size={18}/>} label="Inventory" active={isActive('/inventory')} />
              </div>
              <div className="mt-8 pt-6 border-t border-gray-300/50">
                <p className="px-3 text-[9px] font-extrabold uppercase text-gray-500 tracking-[0.2em] mb-2">Advanced</p>
                <NavLink href="/reports" icon={<FileText size={18}/>} label="Analytics" active={isActive('/reports')} />
                <NavLink href="/settings" icon={<Settings size={18}/>} label="Settings" active={isActive('/settings')} />
              </div>
            </nav>
          </aside>
        )}

        <div className={`${!isMobile ? 'lg:ml-[280px]' : 'ml-0'} flex-1 min-h-screen flex flex-col bg-gray-100`}>
          <header className="sticky top-0 z-40 h-16 bg-gray-100/80 backdrop-blur-xl border-b border-gray-300/60 flex items-center justify-between px-6">
            <div className="flex-1">
              <Suspense fallback={<div className="h-9 w-48 bg-gray-200 animate-pulse rounded-lg" />}>
                <NavbarSearch />
              </Suspense>
            </div>

            <div className="flex items-center gap-5">
              <div className="relative cursor-pointer hover:bg-gray-200/50 p-2 rounded-lg transition-all">
                <Bell size={20} className="text-gray-600" />
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-600 border-2 border-white rounded-full text-[8px] flex items-center justify-center text-white font-black">3</span>
              </div>
              
              <div className="h-6 w-[1px] bg-gray-300/60 hidden sm:block" />
              
              {/* TOP PROFILE */}
              <div className="relative">
                <button onClick={() => setDropdownOpen(!dropdownOpen)} className="flex items-center gap-3 focus:outline-none group cursor-pointer p-1 rounded-full hover:bg-white/50 transition-all border border-transparent hover:border-gray-300/50">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-black text-gray-900 m-0 leading-none group-hover:text-blue-600 transition-colors uppercase">
                      {displayName}
                    </p>
                    <p className="text-[9px] text-blue-600 m-0 mt-1 uppercase font-black tracking-wider">
                      {profile?.role === 'admin' ? 'Administrator' : 'Staff Member'}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 text-white flex items-center justify-center font-black uppercase shadow-md shadow-blue-500/20">
                    {userInitial}
                  </div>
                  <ChevronDown size={14} className={`text-gray-500 transition-transform duration-300 ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {dropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)}></div>
                    <div className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-2xl border border-gray-200 py-2 z-50 animate-in fade-in slide-in-from-top-3">
                      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 rounded-t-2xl">
                        <p className="text-sm font-black text-gray-900 m-0 uppercase">{displayName}</p>
                        <p className="text-[10px] text-gray-500 truncate mt-1 font-bold">{userEmail}</p>
                      </div>
                      <div className="p-2 space-y-1">
                        <MenuLink href="/profile" icon={<User size={16} />} label="My Profile" />
                        <MenuLink href="/settings" icon={<Settings size={16} />} label="Account Settings" />
                        <div className="h-px bg-gray-100 my-1 mx-2"></div>
                        <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 text-[13px] font-bold text-red-600 hover:bg-red-50 w-full text-left transition-all rounded-xl cursor-pointer border-none bg-transparent">
                          <LogOut size={16} /> Logout Session
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          <main className={`flex-1 p-5 sm:p-7 ${isMobile ? 'pb-24' : ''}`}>
            {children}
          </main>
        </div>

        {/* MOBILE NAV */}
        {isMobile && (
          <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-2xl border-t border-gray-300/60 flex justify-around items-center z-[1000]">
            <FooterLink href="/" icon={<LayoutDashboard size={20}/>} label="Home" active={isActive('/')} />
            <FooterLink href="/jobs" icon={<Wrench size={20}/>} label="Jobs" active={isActive('/jobs')} />
            <FooterLink href="/clients" icon={<Users size={20}/>} label="Clients" active={isActive('/clients')} />
            <FooterLink href="/settings" icon={<Settings size={20}/>} label="Settings" active={isActive('/settings')} />
          </nav>
        )}
      </body>
    </html>
  );
}

const NavLink = ({ href, icon, label, active }: any) => (
  <Link href={href} className="relative block group no-underline">
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-bold tracking-tight transition-all duration-200 ${active ? 'bg-blue-100 text-blue-700 shadow-sm border border-blue-200' : 'text-gray-700 hover:bg-gray-200'}`}>
      {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-600 rounded-r-full shadow-sm shadow-blue-600/30"></span>}
      <span className={active ? 'text-blue-600' : 'text-gray-500'}>{icon}</span>
      <span className="flex-1">{label}</span>
    </div>
  </Link>
);

const MenuLink = ({ href, icon, label }: any) => (
  <Link href={href} className="flex items-center gap-3 px-4 py-2.5 text-[13px] font-bold text-gray-700 hover:bg-gray-100 transition-all rounded-xl no-underline">
    <span className="text-gray-400">{icon}</span>
    {label}
  </Link>
);

const FooterLink = ({ href, icon, label, active }: any) => (
  <Link href={href} className={`flex flex-col items-center justify-center flex-1 no-underline gap-0.5 ${active ? 'text-blue-600' : 'text-gray-600'}`}>
    <div className={`p-1.5 rounded-lg ${active ? 'bg-blue-100' : ''}`}>{icon}</div>
    <span className="text-[8px] font-extrabold uppercase">{label}</span>
  </Link>
);