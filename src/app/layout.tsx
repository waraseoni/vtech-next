"use client";
import "./globals.css";
import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { 
  LayoutDashboard, Users, Package, FileText, 
  Settings, Wrench, Search, Bell, User, LogOut,
  Menu, ChevronDown, PlusCircle, Sparkles
} from 'lucide-react';

// ========== SEARCH COMPONENT ==========
function NavbarSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const handleSearch = (term: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (term) {
      params.set('search', term);
    } else {
      params.delete('search');
    }
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
        defaultValue={searchParams.get('search')?.toString()}
      />
    </div>
  );
}

// ========== USER DROPDOWN ==========
function UserDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 pl-2 group focus:outline-none"
      >
        <div className="text-right hidden sm:block">
          <p className="text-sm font-bold text-gray-800 m-0 leading-none group-hover:text-blue-600 transition-colors tracking-tight">
            Vikram S.
          </p>
          <p className="text-[9px] text-gray-600 m-0 mt-0.5 uppercase font-semibold tracking-wider">
            Admin
          </p>
        </div>
        <div className="relative">
          <div className="w-10 h-10 rounded-full border-2 border-gray-300/60 p-0.5 group-hover:border-blue-500 transition-all overflow-hidden shadow-sm">
            <div className="w-full h-full bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center text-white font-bold">
              V
            </div>
          </div>
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></span>
        </div>
        <ChevronDown size={14} className={`text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200/80 py-1.5 z-50 animate-in fade-in slide-in-from-top-2">
          <div className="px-4 py-2 border-b border-gray-100">
            <p className="text-xs font-bold text-gray-900">Vikram Singh</p>
            <p className="text-[10px] text-gray-600">vikram@vtech.com</p>
          </div>
          <Link href="/profile" className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors">
            <User size={14} /> Profile
          </Link>
          <Link href="/settings" className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors">
            <Settings size={14} /> Settings
          </Link>
          <div className="border-t border-gray-100 my-1"></div>
          <button className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-50 w-full text-left transition-colors">
            <LogOut size={14} /> Logout
          </button>
        </div>
      )}
    </div>
  );
}

// ========== NOTIFICATION ICON ==========
function NotificationBell() {
  return (
    <div className="relative cursor-pointer hover:scale-110 transition-transform">
      <Bell size={20} className="text-gray-600 hover:text-blue-600 transition-colors" />
      <span className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-br from-red-500 to-rose-600 border-2 border-white rounded-full text-[8px] flex items-center justify-center text-white font-black shadow-sm">
        3
      </span>
      <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-ping opacity-30"></span>
    </div>
  );
}

// ========== MAIN LAYOUT ==========
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const checkSize = () => setIsMobile(window.innerWidth < 1024);
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  const isActive = (path: string) => pathname === path;

  return (
    <html lang="en" className="h-full bg-gray-100">
      <body className="h-full m-0 font-sans antialiased text-gray-900 bg-gray-100">
        
        {/* ===== DESKTOP SIDEBAR – ENHANCED DARKER SHADE ===== */}
        {!isMobile && (
          <aside className="fixed top-0 left-0 h-full w-[280px] bg-gradient-to-b from-gray-100 to-gray-100/95 backdrop-blur-xl border-r border-gray-300/60 shadow-2xl shadow-gray-400/20 flex flex-col z-50 transition-all duration-300">
            
            {/* Logo Area – refined contrast */}
            <div className="relative p-7 border-b border-gray-300/50 bg-gradient-to-br from-gray-50/90 to-gray-100/90">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-transparent"></div>
              <div className="relative flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-lg shadow-blue-500/30 flex items-center justify-center">
                  <Sparkles size={20} className="text-white" />
                </div>
                <div>
                  <div className="text-xl font-black tracking-tighter italic text-gray-900">
                    V-TECH <span className="text-blue-600 not-italic">PRO</span>
                  </div>
                  <p className="text-[8px] text-gray-600 font-bold uppercase tracking-[0.25em] mt-0.5">
                    Management Suite
                  </p>
                </div>
              </div>
            </div>
            
            {/* Navigation */}
            <nav className="flex-1 px-4 py-6 overflow-y-auto">
              <div className="space-y-1.5">
                <p className="px-3 text-[9px] font-extrabold uppercase text-gray-500 tracking-[0.2em] mb-2">
                  MAIN
                </p>
                <NavLink href="/" icon={<LayoutDashboard size={18}/>} label="Dashboard" active={isActive('/')} />
                <NavLink href="/jobs" icon={<Wrench size={18}/>} label="Repair Jobs" active={isActive('/jobs')} />
                <NavLink href="/clients" icon={<Users size={18}/>} label="Customers" active={isActive('/clients')} />
                <NavLink href="/inventory" icon={<Package size={18}/>} label="Inventory" active={isActive('/inventory')} />
              </div>
              
              <div className="mt-8 pt-6 border-t border-gray-300/50">
                <p className="px-3 text-[9px] font-extrabold uppercase text-gray-500 tracking-[0.2em] mb-2">
                  REPORTS
                </p>
                <NavLink href="/reports" icon={<FileText size={18}/>} label="Analytics" active={isActive('/reports')} />
              </div>
              
              <div className="mt-8 pt-6 border-t border-gray-300/50">
                <p className="px-3 text-[9px] font-extrabold uppercase text-gray-500 tracking-[0.2em] mb-2">
                  SYSTEM
                </p>
                <NavLink href="/settings" icon={<Settings size={18}/>} label="Settings" active={isActive('/settings')} />
              </div>
            </nav>

            {/* User Profile Card – Sidebar Bottom */}
            <div className="mt-auto p-5 bg-gradient-to-b from-gray-100/80 to-gray-100/90 border-t border-gray-300/50">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/80 backdrop-blur-sm border border-gray-300/60 shadow-sm hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center font-bold text-white shadow-md">
                  VS
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-extrabold text-gray-900 m-0 leading-none truncate">
                    Vikram Singh
                  </p>
                  <p className="text-[9px] text-gray-600 m-0 mt-1 uppercase font-bold tracking-tight">
                    Owner Access
                  </p>
                </div>
                <button className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-all">
                  <LogOut size={14} />
                </button>
              </div>
            </div>
          </aside>
        )}

        {/* ===== MAIN CONTENT WRAPPER ===== */}
        <div className={`${!isMobile ? 'lg:ml-[280px]' : 'ml-0'} flex-1 min-h-screen flex flex-col transition-all duration-300 bg-gray-100`}>
          
          {/* ===== TOP NAVBAR – ENHANCED DARKER SHADE ===== */}
          <header className="sticky top-0 z-40 h-16 bg-gray-100/80 backdrop-blur-xl border-b border-gray-300/60 shadow-sm flex items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-4 flex-1">
              {isMobile && (
                <button className="p-2 rounded-lg hover:bg-gray-200/70 transition-colors">
                  <Menu size={20} className="text-gray-700" />
                </button>
              )}
              <Suspense fallback={<div className="h-9 w-48 bg-gray-200/70 animate-pulse rounded-lg" />}>
                <NavbarSearch />
              </Suspense>
            </div>

            <div className="flex items-center gap-4 sm:gap-5">
              <NotificationBell />
              <div className="h-6 w-[1px] bg-gray-300/60 hidden sm:block" />
              <Suspense fallback={<div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />}>
                <UserDropdown />
              </Suspense>
            </div>
          </header>

          {/* ===== MAIN CONTENT ===== */}
          <main className={`flex-1 p-5 sm:p-7 ${isMobile ? 'pb-24' : 'pb-7'}`}>
            {children}
          </main>

          {/* ===== DESKTOP FOOTER – ENHANCED DARKER SHADE ===== */}
          {!isMobile && (
            <footer className="py-4 px-6 bg-gray-100/70 backdrop-blur-sm border-t border-gray-300/60">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-2 text-[10px]">
                <p className="font-medium text-gray-600 uppercase tracking-wider m-0">
                  © 2025 <span className="font-extrabold text-gray-800">V-TECH PRO</span>
                </p>
                <div className="flex items-center gap-4">
                  <span className="text-gray-500">v4.2.0</span>
                  <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                  <Link href="#" className="font-semibold text-gray-600 hover:text-blue-600 transition-colors uppercase tracking-wider">
                    Support
                  </Link>
                  <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                  <Link href="#" className="font-semibold text-gray-600 hover:text-blue-600 transition-colors uppercase tracking-wider">
                    Privacy
                  </Link>
                </div>
              </div>
            </footer>
          )}
        </div>

        {/* ===== MOBILE BOTTOM NAVIGATION – WITH FAB ===== */}
        {isMobile && (
          <>
            <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white/90 backdrop-blur-2xl border-t border-gray-300/60 flex justify-around items-center z-[1000] px-2 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
              <FooterLink href="/" icon={<LayoutDashboard size={20}/>} label="Home" active={isActive('/')} />
              <FooterLink href="/jobs" icon={<Wrench size={20}/>} label="Jobs" active={isActive('/jobs')} />
              <FooterLink href="/clients" icon={<Users size={20}/>} label="Clients" active={isActive('/clients')} />
              <FooterLink href="/settings" icon={<Settings size={20}/>} label="Settings" active={isActive('/settings')} />
            </nav>
            
            {/* Floating Action Button (FAB) for Quick Job */}
            <Link 
              href="/jobs/new"
              className="fixed right-5 bottom-20 z-[1001] w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full shadow-xl shadow-blue-500/30 flex items-center justify-center text-white hover:scale-110 transition-transform active:scale-95 border-2 border-white/20"
            >
              <PlusCircle size={24} />
            </Link>
          </>
        )}
      </body>
    </html>
  );
}

// ========== DESKTOP NAVLINK – WITH ACTIVE INDICATOR ==========
const NavLink = ({ href, icon, label, active }: any) => {
  return (
    <Link href={href} className="relative block group">
      <div className={`
        flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-bold tracking-tight transition-all duration-200 no-underline
        ${active 
          ? 'bg-gradient-to-r from-blue-100 to-blue-50/90 text-blue-700 shadow-sm border border-blue-200/60' 
          : 'text-gray-700 hover:bg-gray-200/70 hover:text-gray-900'}
      `}>
        {/* Active Indicator Bar */}
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-600 rounded-r-full shadow-sm shadow-blue-600/30"></span>
        )}
        <span className={`${active ? 'text-blue-600' : 'text-gray-500 group-hover:text-gray-700'} transition-colors`}>
          {icon}
        </span>
        <span className="flex-1">{label}</span>
        {active && (
          <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse"></span>
        )}
      </div>
    </Link>
  );
};

// ========== MOBILE FOOTER LINK ==========
const FooterLink = ({ href, icon, label, active }: any) => (
  <Link href={href} className={`
    flex flex-col items-center justify-center flex-1 no-underline transition-all duration-200 gap-0.5
    ${active ? 'text-blue-600' : 'text-gray-600'}
  `}>
    <div className={`p-1.5 rounded-lg transition-all ${active ? 'bg-blue-100 scale-110' : 'bg-transparent'}`}>
      {icon}
    </div>
    <span className="text-[8px] font-extrabold uppercase tracking-wider">{label}</span>
    {active && <span className="w-1 h-1 bg-blue-600 rounded-full mt-0.5"></span>}
  </Link>
);