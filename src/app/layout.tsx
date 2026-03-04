"use client";
import "./globals.css";
import React, { useState, useEffect, Suspense, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  LayoutDashboard, Users, Package, FileText, 
  Settings, Wrench, Search, User, LogOut,
  Sparkles, Loader2, ArrowLeft, ShieldCheck,
  CalendarCheck, HelpCircle, ShoppingCart, ClipboardList,
  PieChart, TrendingUp, DollarSign, Truck, 
  CreditCard, Clock, Briefcase, Coins, 
  Toolbox, FolderOpen, UsersRound, Database,  // 🔥 Tool → Toolbox
  Settings2, ChevronDown, ChevronRight
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

// ========== SUBMENU COMPONENT ==========
function SubMenu({ title, icon, children, basePath }: { title: string; icon: React.ReactNode; children: React.ReactNode; basePath?: string }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(() => {
    // Auto-open if any child is active
    if (basePath && pathname.startsWith(basePath)) return true;
    return false;
  });

  return (
    <li className="nav-item">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold text-gray-300 hover:bg-gray-800 hover:text-white cursor-pointer transition-all"
      >
        <div className="flex items-center gap-3">
          <span className="text-gray-400">{icon}</span>
          <span>{title}</span>
        </div>
        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </div>
      {isOpen && (
        <ul className="nav-treeview pl-4 mt-1 space-y-1">
          {children}
        </ul>
      )}
    </li>
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

  // Logout Function
  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push('/login');
  }, [router]);

  // Auth & Profile Logic
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

        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('id', authUser.id)
          .maybeSingle();
        
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
        
        {/* ===== DESKTOP SIDEBAR (AdminLTE Style – Dark) ===== */}
        {!isMobile && (
          <aside className="fixed top-0 left-0 h-full w-[280px] bg-gray-900 text-gray-300 border-r border-gray-800 shadow-2xl flex flex-col z-50">
            {/* Brand Logo */}
            <div className="bg-gradient-to-r from-blue-700 to-blue-800 p-5 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                  <Sparkles className="text-white" size={22} />
                </div>
                <div>
                  <div className="text-xl font-black italic text-white tracking-tight">
                    V-TECH <span className="font-normal not-italic">PRO</span>
                  </div>
                  <div className="text-[8px] text-blue-200 font-bold uppercase tracking-widest mt-0.5">
                    Management System
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar Navigation */}
            <nav className="flex-1 overflow-y-auto py-4 px-3">
              <ul className="nav nav-pills nav-sidebar flex-column space-y-1">
                {/* Dashboard */}
                <li className="nav-item">
                  <Link href="/" className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${pathname === '/' ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-900/30' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
                    <LayoutDashboard size={18} />
                    <span>Dashboard</span>
                  </Link>
                </li>

                {/* Attendance (example) */}
                <li className="nav-item">
                  <Link href="/attendance" className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${pathname === '/attendance' ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
                    <CalendarCheck size={18} />
                    <span>Mark My Attendance</span>
                  </Link>
                </li>

                {/* Clients */}
                <li className="nav-item">
                  <Link href="/clients" className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${pathname === '/clients' ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
                    <Users size={18} />
                    <span>Clients List</span>
                  </Link>
                </li>

                {/* Inquiries */}
                <li className="nav-item">
                  <Link href="/inquiries" className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${pathname === '/inquiries' ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
                    <HelpCircle size={18} />
                    <span>Inquiries</span>
                  </Link>
                </li>

                {/* Direct Sales */}
                <li className="nav-item">
                  <Link href="/direct-sales" className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${pathname === '/direct-sales' ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
                    <ShoppingCart size={18} />
                    <span>Direct Sales</span>
                  </Link>
                </li>

                {/* Inventory */}
                <li className="nav-item">
                  <Link href="/inventory" className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${pathname === '/inventory' ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
                    <Package size={18} />
                    <span>Inventory</span>
                  </Link>
                </li>

                {/* JobSheet (Transactions) */}
                <li className="nav-item">
                  <Link href="/transactions" className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${pathname === '/transactions' ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
                    <ClipboardList size={18} />
                    <span>JobSheet</span>
                  </Link>
                </li>

                {isAdmin && (
                  <>
                    {/* Reports Section (Collapsible) */}
                    <li className="nav-header text-[10px] font-black uppercase text-gray-500 tracking-widest px-4 pt-4 pb-1">Reports</li>
                    <SubMenu title="Reports" icon={<PieChart size={18} />} basePath="/reports">
                      <li>
                        <Link href="/reports/delivered" className="flex items-center gap-3 px-4 py-2.5 pl-10 text-xs font-bold text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-all">
                          <Truck size={14} /> Delivered Report
                        </Link>
                      </li>
                      <li>
                        <Link href="/reports/cash-flow" className="flex items-center gap-3 px-4 py-2.5 pl-10 text-xs font-bold text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-all">
                          <TrendingUp size={14} /> Cash Flow
                        </Link>
                      </li>
                      <li>
                        <Link href="/reports/ledger" className="flex items-center gap-3 px-4 py-2.5 pl-10 text-xs font-bold text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-all">
                          <DollarSign size={14} /> Business Ledger
                        </Link>
                      </li>
                      <li>
                        <Link href="/reports/yearly" className="flex items-center gap-3 px-4 py-2.5 pl-10 text-xs font-bold text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-all">
                          <Clock size={14} /> Yearly Report
                        </Link>
                      </li>
                      <li>
                        <Link href="/reports/client-payment" className="flex items-center gap-3 px-4 py-2.5 pl-10 text-xs font-bold text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-all">
                          <CreditCard size={14} /> Clients Payment
                        </Link>
                      </li>
                      <li>
                        <Link href="/reports/daily-sales" className="flex items-center gap-3 px-4 py-2.5 pl-10 text-xs font-bold text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-all">
                          <ShoppingCart size={14} /> Daily Sales
                        </Link>
                      </li>
                      <li>
                        <Link href="/reports/daily-service" className="flex items-center gap-3 px-4 py-2.5 pl-10 text-xs font-bold text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-all">
                          <Wrench size={14} /> Daily Service
                        </Link>
                      </li>
                    </SubMenu>

                    {/* Back Office Section (Collapsible) */}
                    <li className="nav-header text-[10px] font-black uppercase text-gray-500 tracking-widest px-4 pt-4 pb-1">Back Office</li>
                    <SubMenu title="Back Office" icon={<Briefcase size={18} />} basePath="/backoffice">
                      <li>
                        <Link href="/expenses" className="flex items-center gap-3 px-4 py-2.5 pl-10 text-xs font-bold text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-all">
                          <DollarSign size={14} /> Pay Outs
                        </Link>
                      </li>
                      <li>
                        <Link href="/salary" className="flex items-center gap-3 px-4 py-2.5 pl-10 text-xs font-bold text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-all">
                          <Coins size={14} /> Salary
                        </Link>
                      </li>
                      <li>
                        <Link href="/commission" className="flex items-center gap-3 px-4 py-2.5 pl-10 text-xs font-bold text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-all">
                          <CreditCard size={14} /> Commission
                        </Link>
                      </li>
                      <li>
                        <Link href="/services" className="flex items-center gap-3 px-4 py-2.5 pl-10 text-xs font-bold text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-all">
                          <Toolbox size={14} /> Services  {/* 🔥 Fixed icon */}
                        </Link>
                      </li>
                      <li>
                        <Link href="/products" className="flex items-center gap-3 px-4 py-2.5 pl-10 text-xs font-bold text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-all">
                          <Package size={14} /> Products
                        </Link>
                      </li>
                      <li>
                        <Link href="/mechanics" className="flex items-center gap-3 px-4 py-2.5 pl-10 text-xs font-bold text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-all">
                          <UsersRound size={14} /> Mechanics
                        </Link>
                      </li>
                      <li>
                        <Link href="/clients-admin" className="flex items-center gap-3 px-4 py-2.5 pl-10 text-xs font-bold text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-all">
                          <FolderOpen size={14} /> Client Amt
                        </Link>
                      </li>
                      <li>
                        <Link href="/loans" className="flex items-center gap-3 px-4 py-2.5 pl-10 text-xs font-bold text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-all">
                          <CreditCard size={14} /> Loans
                        </Link>
                      </li>
                      <li>
                        <Link href="/users" className="flex items-center gap-3 px-4 py-2.5 pl-10 text-xs font-bold text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-all">
                          <ShieldCheck size={14} /> Users
                        </Link>
                      </li>
                      <li>
                        <Link href="/backup" className="flex items-center gap-3 px-4 py-2.5 pl-10 text-xs font-bold text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-all">
                          <Database size={14} /> Backup
                        </Link>
                      </li>
                      <li>
                        <Link href="/settings" className="flex items-center gap-3 px-4 py-2.5 pl-10 text-xs font-bold text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-all">
                          <Settings2 size={14} /> Settings
                        </Link>
                      </li>
                    </SubMenu>
                  </>
                )}
              </ul>
            </nav>

            {/* Sidebar Footer */}
            <div className="p-4 border-t border-gray-800 text-xs text-gray-500 text-center">
              V-TECH PRO v4.2
            </div>
          </aside>
        )}

        {/* Main Content Area */}
        <div className={`${!isMobile ? 'lg:ml-[280px]' : 'ml-0'} flex-1 min-h-screen flex flex-col`}>
          
          {/* Header */}
          <header className="sticky top-0 z-40 h-16 bg-white/90 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-4 sm:px-8">
            <div className="flex items-center gap-2">
              {isMobile && (
                <button onClick={() => router.back()} className="p-2 bg-gray-100 rounded-lg">
                  <ArrowLeft size={18} />
                </button>
              )}
              <NavbarSearch />
            </div>

            {/* User Dropdown */}
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
                    <Link href="/profile" className="flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-100 rounded-xl transition-all">
                      <User size={16} /> My Profile
                    </Link>
                    {isAdmin && (
                      <Link href="/settings" className="flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-100 rounded-xl transition-all">
                        <Settings size={16} /> Settings
                      </Link>
                    )}
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
          </header>

          {/* Page Content */}
          <main className={`flex-1 p-4 sm:p-8 ${isMobile ? 'pb-24' : ''}`}>
            {children}
          </main>
        </div>

        {/* Mobile Bottom Navigation */}
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

// ========== HELPER COMPONENTS ==========
const NavLink = ({ href, icon, label, active }: any) => (
  <Link href={href} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${active ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-900/30' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
    {icon}
    <span>{label}</span>
  </Link>
);

const FooterLink = ({ href, icon, label, active }: any) => (
  <Link href={href} className={`flex flex-col items-center gap-1 flex-1 ${active ? 'text-blue-600' : 'text-gray-400'}`}>
    <div className={`p-2 rounded-xl ${active ? 'bg-blue-50' : ''}`}>{icon}</div>
    <span className="text-[9px] font-black uppercase tracking-tighter">{label}</span>
  </Link>
);