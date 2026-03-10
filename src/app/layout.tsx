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
  Toolbox, FolderOpen, UsersRound, Database,
  Settings2, ChevronDown, ChevronRight
} from 'lucide-react';

// ============================================================
// SEARCH
// ============================================================
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
        <Search size={16} className="text-slate-500 group-focus-within:text-blue-400 transition-colors" />
      </div>
      <input
        type="text"
        placeholder="Search jobs, clients or IDs..."
        className="w-full pl-10 pr-4 py-2.5 bg-[#0d1117] border border-[#21293d] rounded-xl outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500 transition-all font-medium text-sm text-slate-200 placeholder:text-slate-600"
        onChange={(e) => handleSearch(e.target.value)}
        defaultValue={searchParams.get('search')?.toString() || ""}
      />
    </div>
  );
}

// ============================================================
// SUBMENU
// ============================================================
function SubMenu({ title, icon, children, basePath }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; basePath?: string;
}) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(() => !!(basePath && pathname.startsWith(basePath)));

  return (
    <li className="nav-item">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 cursor-pointer transition-all"
      >
        <div className="flex items-center gap-3">
          <span className="text-slate-500">{icon}</span>
          <span>{title}</span>
        </div>
        {isOpen ? <ChevronDown size={14} className="text-slate-600" /> : <ChevronRight size={14} className="text-slate-600" />}
      </div>
      {isOpen && (
        <ul className="nav-treeview pl-4 mt-1 space-y-0.5">
          {children}
        </ul>
      )}
    </li>
  );
}

// ============================================================
// MAIN LAYOUT
// ============================================================
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobile, setIsMobile]       = useState(false);
  const [loading, setLoading]         = useState(true);
  const [profile, setProfile]         = useState<{ full_name: string; role: string } | null>(null);
  const [userEmail, setUserEmail]     = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push('/login');
  }, [router]);

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
          .from('profiles').select('full_name, role').eq('id', authUser.id).maybeSingle();
        const finalName = profileData?.full_name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User';
        const finalRole = profileData?.role || (authUser.email === 'vtech.jbp@gmail.com' ? 'admin' : 'staff');
        setProfile({ full_name: finalName, role: finalRole });
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
        <body className="h-screen flex items-center justify-center bg-[#0d1117] text-center">
          <div>
            <Loader2 className="animate-spin text-blue-500 mx-auto" size={40} />
            <p className="mt-4 text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">V-TECH SECURE BOOT</p>
          </div>
        </body>
      </html>
    );
  }

  const isAdmin     = profile?.role === 'admin';
  const displayName = profile?.full_name || "User";

  // ── SHARED NAV LINK STYLE ──────────────────────────────
  const navLinkCls = (active: boolean) =>
    `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
      active
        ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-900/30'
        : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
    }`;

  const subLinkCls = (active: boolean) =>
    `flex items-center gap-3 px-4 py-2.5 pl-10 text-xs font-bold rounded-lg transition-all ${
      active ? 'text-blue-400 bg-blue-500/10' : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.04]'
    }`;

  return (
    <html lang="en" className="h-full" style={{ backgroundColor: '#0d1117' }}>
      <body className="h-full m-0 font-sans antialiased text-slate-200 bg-[#0d1117]">

        {/* ══════════════════════════════════════════════════
            DESKTOP SIDEBAR
        ══════════════════════════════════════════════════ */}
        {!isMobile && (
          <aside className="fixed top-0 left-0 h-full w-[270px] bg-[#0d1117] border-r border-[#21293d] flex flex-col z-50">

            {/* Brand */}
            <div className="bg-gradient-to-r from-blue-700 to-blue-800 p-5 border-b border-[#21293d]">
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

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto py-4 px-3 scrollbar-hide">
              <ul className="space-y-0.5">

                <li>
                  <Link href="/" className={navLinkCls(pathname === '/')}>
                    <LayoutDashboard size={17} /><span>Dashboard</span>
                  </Link>
                </li>
                <li>
                  <Link href="/attendance" className={navLinkCls(pathname === '/attendance')}>
                    <CalendarCheck size={17} /><span>Attendance</span>
                  </Link>
                </li>
                <li>
                  <Link href="/clients" className={navLinkCls(pathname.startsWith('/clients'))}>
                    <Users size={17} /><span>Clients</span>
                  </Link>
                </li>
                <li>
                  <Link href="/inquiries" className={navLinkCls(pathname === '/inquiries')}>
                    <HelpCircle size={17} /><span>Inquiries</span>
                  </Link>
                </li>
                <li>
                  <Link href="/direct-sales" className={navLinkCls(pathname.startsWith('/direct-sales'))}>
                    <ShoppingCart size={17} /><span>Direct Sales</span>
                  </Link>
                </li>
                <li>
                  <Link href="/inventory" className={navLinkCls(pathname.startsWith('/inventory'))}>
                    <Package size={17} /><span>Inventory</span>
                  </Link>
                </li>
                <li>
                  <Link href="/jobs" className={navLinkCls(pathname.startsWith('/jobs'))}>
                    <ClipboardList size={17} /><span>JobSheet</span>
                  </Link>
                </li>

                {isAdmin && (
                  <>
                    <li className="text-[9px] font-black uppercase text-slate-600 tracking-widest px-4 pt-5 pb-1">
                      Reports
                    </li>
                    <SubMenu title="Reports" icon={<PieChart size={17} />} basePath="/reports">
                      <li><Link href="/reports/delivered"      className={subLinkCls(pathname === '/reports/delivered')}><Truck size={13} /> Delivered Report</Link></li>
                      <li><Link href="/reports/cash-flow"      className={subLinkCls(pathname === '/reports/cash-flow')}><TrendingUp size={13} /> Cash Flow</Link></li>
                      <li><Link href="/reports/ledger"         className={subLinkCls(pathname === '/reports/ledger')}><DollarSign size={13} /> Business Ledger</Link></li>
                      <li><Link href="/reports/yearly"         className={subLinkCls(pathname === '/reports/yearly')}><Clock size={13} /> Yearly Report</Link></li>
                      <li><Link href="/reports/client-payment" className={subLinkCls(pathname === '/reports/client-payment')}><CreditCard size={13} /> Clients Payment</Link></li>
                      <li><Link href="/reports/daily-sales"    className={subLinkCls(pathname === '/reports/daily-sales')}><ShoppingCart size={13} /> Daily Sales</Link></li>
                      <li><Link href="/reports/daily-service"  className={subLinkCls(pathname === '/reports/daily-service')}><Wrench size={13} /> Daily Service</Link></li>
                    </SubMenu>

                    <li className="text-[9px] font-black uppercase text-slate-600 tracking-widest px-4 pt-5 pb-1">
                      Back Office
                    </li>
                    <SubMenu title="Back Office" icon={<Briefcase size={17} />} basePath="/backoffice">
                      <li><Link href="/expenses"      className={subLinkCls(pathname === '/expenses')}><DollarSign size={13} /> Pay Outs</Link></li>
                      <li><Link href="/salary"        className={subLinkCls(pathname === '/salary')}><Coins size={13} /> Salary</Link></li>
                      <li><Link href="/commission"    className={subLinkCls(pathname === '/commission')}><CreditCard size={13} /> Commission</Link></li>
                      <li><Link href="/services"      className={subLinkCls(pathname === '/services')}><Toolbox size={13} /> Services</Link></li>
                      <li><Link href="/products"      className={subLinkCls(pathname === '/products')}><Package size={13} /> Products</Link></li>
                      <li><Link href="/mechanics"     className={subLinkCls(pathname === '/mechanics')}><UsersRound size={13} /> Mechanics</Link></li>
                      <li><Link href="/clients-admin" className={subLinkCls(pathname === '/clients-admin')}><FolderOpen size={13} /> Client Amt</Link></li>
                      <li><Link href="/loans"         className={subLinkCls(pathname === '/loans')}><CreditCard size={13} /> Loans</Link></li>
                      <li><Link href="/users"         className={subLinkCls(pathname === '/users')}><ShieldCheck size={13} /> Users</Link></li>
                      <li><Link href="/backup"        className={subLinkCls(pathname === '/backup')}><Database size={13} /> Backup</Link></li>
                      <li><Link href="/settings"      className={subLinkCls(pathname === '/settings')}><Settings2 size={13} /> Settings</Link></li>
                    </SubMenu>
                  </>
                )}
              </ul>
            </nav>

            <div className="px-4 py-3 border-t border-[#21293d] text-[10px] text-slate-600 text-center font-bold tracking-wider">
              V-TECH PRO v4.2
            </div>
          </aside>
        )}

        {/* ══════════════════════════════════════════════════
            MAIN CONTENT AREA
        ══════════════════════════════════════════════════ */}
        <div className={`${!isMobile ? 'lg:ml-[270px]' : 'ml-0'} flex-1 min-h-screen flex flex-col bg-[#0d1117]`}>

          {/* ── TOPBAR ── */}
          <header className="sticky top-0 z-40 h-14 bg-[#0d1117]/90 backdrop-blur-md border-b border-[#21293d] flex items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-3">
              {isMobile && (
                <button
                  onClick={() => router.back()}
                  className="p-2 bg-[#161b27] hover:bg-[#21293d] border border-[#21293d] rounded-lg transition-all"
                >
                  <ArrowLeft size={16} className="text-slate-400" />
                </button>
              )}
              <Suspense>
                <NavbarSearch />
              </Suspense>
            </div>

            {/* User dropdown */}
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-3 hover:bg-white/[0.04] p-1.5 rounded-xl transition-all"
              >
                <div className="hidden sm:block text-right">
                  <p className="text-xs font-black uppercase text-slate-200 m-0 leading-none">{displayName}</p>
                  <p className="text-[9px] font-bold text-blue-400 uppercase m-0 mt-0.5">{profile?.role}</p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black shadow-md uppercase text-sm">
                  {displayName.charAt(0)}
                </div>
              </button>

              {dropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                  <div className="absolute right-0 mt-2 w-52 bg-[#161b27] border border-[#21293d] rounded-2xl shadow-2xl p-1.5 z-50">
                    <div className="px-3 py-2.5 border-b border-[#21293d] mb-1">
                      <p className="text-[9px] font-black text-slate-600 uppercase tracking-wider">Logged in as</p>
                      <p className="text-xs font-bold text-slate-300 truncate mt-0.5">{userEmail}</p>
                    </div>
                    <Link
                      href="/profile"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-slate-300 hover:bg-white/[0.05] hover:text-white rounded-xl transition-all"
                    >
                      <User size={14} /> My Profile
                    </Link>
                    {isAdmin && (
                      <Link
                        href="/settings"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-slate-300 hover:bg-white/[0.05] hover:text-white rounded-xl transition-all"
                      >
                        <Settings size={14} /> Settings
                      </Link>
                    )}
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-red-400 hover:bg-red-500/10 rounded-xl transition-all mt-0.5"
                    >
                      <LogOut size={14} /> Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          </header>

          {/* ── PAGE CONTENT ── */}
          <main className={`flex-1 p-4 sm:p-6 bg-[#0d1117] ${isMobile ? 'pb-24' : ''}`}>
            {children}
          </main>
        </div>

        {/* ══════════════════════════════════════════════════
            MOBILE BOTTOM NAV
        ══════════════════════════════════════════════════ */}
        {isMobile && (
          <nav className="fixed bottom-0 left-0 right-0 h-[64px] bg-[#0d1117] border-t border-[#21293d] flex items-center overflow-x-auto z-50 px-2 space-x-1 scrollbar-hide">
            <MobileNavLink href="/"            icon={<LayoutDashboard size={19}/>} label="Home"      active={pathname === '/'} />
            <MobileNavLink href="/attendance"  icon={<CalendarCheck size={19}/>}   label="Attend"    active={pathname === '/attendance'} />
            <MobileNavLink href="/clients"     icon={<Users size={19}/>}           label="Clients"   active={pathname.startsWith('/clients')} />
            <MobileNavLink href="/inquiries"   icon={<HelpCircle size={19}/>}      label="Inquiries" active={pathname === '/inquiries'} />
            <MobileNavLink href="/direct-sales"icon={<ShoppingCart size={19}/>}    label="Sales"     active={pathname.startsWith('/direct-sales')} />
            <MobileNavLink href="/inventory"   icon={<Package size={19}/>}         label="Inventory" active={pathname.startsWith('/inventory')} />
            <MobileNavLink href="/jobs"        icon={<ClipboardList size={19}/>}   label="Jobs"      active={pathname.startsWith('/jobs')} />
            {isAdmin && (
              <MobileNavLink href="/users" icon={<ShieldCheck size={19}/>} label="Staff" active={pathname === '/users'} />
            )}
          </nav>
        )}
      </body>
    </html>
  );
}

// ============================================================
// HELPER COMPONENTS
// ============================================================
const MobileNavLink = ({ href, icon, label, active }: any) => (
  <Link
    href={href}
    className={`flex flex-col items-center justify-center flex-none w-[58px] gap-0.5 no-underline transition-all duration-200 py-1 rounded-xl ${
      active ? 'text-blue-400' : 'text-slate-600 hover:text-slate-400'
    }`}
  >
    <div className={`p-1.5 rounded-lg transition-all ${active ? 'bg-blue-500/15' : ''}`}>
      {icon}
    </div>
    <span className="text-[8px] font-black uppercase tracking-tight leading-none">{label}</span>
  </Link>
);