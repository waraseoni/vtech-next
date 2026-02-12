"use client";
import "./globals.css";
import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  LayoutDashboard, Users, Package, FileText, 
  Settings, Wrench, Search, Bell, User, LogOut,
  ChevronDown, Sparkles, Loader2, ArrowLeft, RotateCw
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

        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('id', authUser.id)
          .maybeSingle();
        
        if (profileData && profileData.full_name) {
          setProfile(profileData);
        } else {
          const metaName = authUser.user_metadata?.full_name;
          const assignedRole = authUser.email === 'vtech.jbp@gmail.com' ? 'admin' : 'staff';
          setProfile({ 
            full_name: metaName || authUser.email?.split('@')[0] || 'User', 
            role: assignedRole 
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
  const isAdmin = profile?.role === 'admin';

  return (
    <html lang="en" className="h-full bg-gray-100">
      <body className="h-full m-0 font-sans antialiased text-gray-900 bg-gray-100">
        
        {/* DESKTOP SIDEBAR */}
        {!isMobile && (
          <aside className="fixed top-0 left-0 h-full w-[280px] bg-gradient-to-b from-gray-100 to-gray-50 border-r border-gray-300/60 shadow-xl flex flex-col z-50">
            <div className="p-7 border-b border-gray-300/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-lg flex items-center justify-center text-white">
                  <Sparkles size={20} />
                </div>
                <div className="text-xl font-black tracking-tighter italic text-gray-900 uppercase">
                  V-TECH <span className="text-blue-600 not-italic">PRO</span>
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

              {/* Only Show Admin Sections */}
              {isAdmin && (
                <div className="mt-8 pt-6 border-t border-gray-300/50">
                  <p className="px-3 text-[9px] font-extrabold uppercase text-gray-500 tracking-[0.2em] mb-2">Advanced</p>
                  <NavLink href="/reports" icon={<FileText size={18}/>} label="Analytics" active={isActive('/reports')} />
                  <NavLink href="/settings" icon={<Settings size={18}/>} label="Settings" active={isActive('/settings')} />
                </div>
              )}
            </nav>
          </aside>
        )}

        <div className={`${!isMobile ? 'lg:ml-[280px]' : 'ml-0'} flex-1 min-h-screen flex flex-col bg-gray-100`}>
          <header className="sticky top-0 z-40 h-16 bg-gray-100/80 backdrop-blur-xl border-b border-gray-300/60 flex items-center justify-between px-4 sm:px-6">
            
            {isMobile && (
              <div className="flex items-center gap-2">
                <button onClick={() => router.back()} className="p-2.5 bg-white border border-gray-300 rounded-xl text-gray-700 active:scale-90 transition-all">
                  <ArrowLeft size={18} />
                </button>
                <button onClick={() => window.location.reload()} className="p-2.5 bg-white border border-gray-300 rounded-xl text-blue-600 active:scale-90 transition-all">
                  <RotateCw size={18} />
                </button>
              </div>
            )}

            <div className="flex-1 px-4">
              <Suspense fallback={<div className="h-9 w-48 bg-gray-200 animate-pulse rounded-lg" />}>
                <NavbarSearch />
              </Suspense>
            </div>

            <div className="flex items-center gap-3 sm:gap-5">
              <div className="relative cursor-pointer hover:bg-gray-200/50 p-2 rounded-lg transition-all hidden sm:block">
                <Bell size={20} className="text-gray-600" />
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-600 border-2 border-white rounded-full text-[8px] flex items-center justify-center text-white font-black">3</span>
              </div>
              
              <div className="relative">
                <button onClick={() => setDropdownOpen(!dropdownOpen)} className="flex items-center gap-2 sm:gap-3 focus:outline-none group cursor-pointer p-1 rounded-full hover:bg-white/50 transition-all border border-transparent">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-black text-gray-900 m-0 uppercase leading-none group-hover:text-blue-600 transition-colors">{displayName}</p>
                    <p className="text-[9px] text-blue-600 m-0 mt-1 uppercase font-black tracking-wider">{isAdmin ? 'Administrator' : 'Staff Member'}</p>
                  </div>
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 text-white flex items-center justify-center font-black uppercase shadow-md shadow-blue-500/20">
                    {displayName.charAt(0)}
                  </div>
                </button>

                {dropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)}></div>
                    <div className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-2xl border border-gray-200 py-2 z-50">
                      <div className="px-5 py-3 border-b border-gray-100">
                        <p className="text-sm font-black text-gray-900 m-0 uppercase">{displayName}</p>
                        <p className="text-[10px] text-gray-500 truncate mt-1 font-bold">{userEmail}</p>
                      </div>
                      <div className="p-2">
                        <MenuLink href="/profile" icon={<User size={16} />} label="My Profile" />
                        {isAdmin && <MenuLink href="/settings" icon={<Settings size={16} />} label="Settings" />}
                        <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 text-[13px] font-bold text-red-600 hover:bg-red-50 w-full text-left transition-all rounded-xl border-none bg-transparent">
                          <LogOut size={16} /> Logout Session
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          <main className={`flex-1 p-4 sm:p-7 ${isMobile ? 'pb-24' : ''}`}>
            {children}
          </main>
        </div>

        {/* MOBILE FOOTER NAV (ADMIN LINKS FILTERED) */}
        {isMobile && (
          <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white border-t border-gray-200 flex justify-around items-center z-[1000] px-2 pb-2">
            <FooterLink href="/" icon={<LayoutDashboard size={20}/>} label="Home" active={isActive('/')} />
            <FooterLink href="/jobs" icon={<Wrench size={20}/>} label="Jobs" active={isActive('/jobs')} />
            <FooterLink href="/inventory" icon={<Package size={20}/>} label="Stock" active={isActive('/inventory')} />
            <FooterLink href="/clients" icon={<Users size={20}/>} label="Clients" active={isActive('/clients')} />
            {isAdmin && <FooterLink href="/reports" icon={<FileText size={20}/>} label="Reports" active={isActive('/reports')} />}
          </nav>
        )}
      </body>
    </html>
  );
}

const NavLink = ({ href, icon, label, active }: any) => (
  <Link href={href} className="relative block group no-underline">
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-bold tracking-tight transition-all duration-200 ${active ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'text-gray-700 hover:bg-gray-200'}`}>
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
  <Link href={href} className={`flex flex-col items-center justify-center flex-1 no-underline gap-1 ${active ? 'text-blue-600' : 'text-gray-500'}`}>
    <div className={`p-2 rounded-xl transition-all ${active ? 'bg-blue-50' : ''}`}>{icon}</div>
    <span className="text-[9px] font-black uppercase tracking-tighter">{label}</span>
  </Link>
);