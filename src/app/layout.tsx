"use client";
import "./globals.css";
import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { 
  LayoutDashboard, Users, Package, FileText, 
  Settings, Wrench, Search, Bell, User, LogOut,
  Menu
} from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

// Search logic ko client side par handle karne ke liye alag component
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
    // Search karne par user ko jobs page par redirect karega results ke saath
    router.push(`/jobs?${params.toString()}`);
  };

  return (
    <div className="relative max-w-md w-full hidden sm:block group">
      <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
      <input 
        type="text" 
        placeholder="Search jobs, clients or IDs..." 
        className="w-full pl-12 pr-4 py-2.5 bg-gray-100 border-none rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium text-sm text-gray-900 placeholder:text-gray-500"
        onChange={(e) => handleSearch(e.target.value)}
        defaultValue={searchParams.get('search')?.toString()}
      />
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkSize = () => setIsMobile(window.innerWidth < 1024);
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  const isActive = (path: string) => pathname === path;

  return (
    <html lang="en">
      <body className="m-0 bg-gray-50 font-sans text-gray-900 antialiased">
        
        {/* --- 1. SIDEBAR (Desktop) - LIGHT THEME --- */}
        {!isMobile && (
          <aside className="w-[280px] bg-white text-gray-900 fixed h-screen flex flex-col shadow-xl z-50 border-r border-gray-200">
            <div className="p-8 text-center border-b border-gray-200">
              <div className="text-2xl font-black tracking-tighter italic text-gray-900">
                V-TECH <span className="text-blue-600 not-italic">PRO</span>
              </div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em] mt-1">Management System</p>
            </div>
            
            <nav className="px-4 py-6 flex flex-col gap-2 overflow-y-auto">
              <NavLink href="/" icon={<LayoutDashboard size={20}/>} label="Dashboard" active={isActive('/')} />
              <NavLink href="/jobs" icon={<Wrench size={20}/>} label="Repair Jobs" active={isActive('/jobs')} />
              <NavLink href="/clients" icon={<Users size={20}/>} label="Customers" active={isActive('/clients')} />
              <NavLink href="/inventory" icon={<Package size={20}/>} label="Inventory" active={isActive('/inventory')} />
              <NavLink href="/reports" icon={<FileText size={20}/>} label="Analytics" active={isActive('/reports')} />
              <div className="my-4 border-t border-gray-200 mx-4" />
              <NavLink href="/settings" icon={<Settings size={20}/>} label="Settings" active={isActive('/settings')} />
            </nav>

            <div className="mt-auto p-6 bg-gray-50 border-t border-gray-200">
               <div className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-gray-200 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/20">V</div>
                  <div className="flex-1">
                    <p className="text-xs font-black m-0 leading-none text-gray-900">Vikram S.</p>
                    <p className="text-[10px] text-gray-600 m-0 mt-1 uppercase font-bold tracking-tighter">Owner Access</p>
                  </div>
                  <LogOut size={16} className="text-gray-400 hover:text-red-600 cursor-pointer transition-colors" />
               </div>
            </div>
          </aside>
        )}

        {/* --- 2. MAIN CONTENT WRAPPER --- */}
        <div className={`${!isMobile ? 'ml-[280px]' : 'ml-0'} flex-1 min-h-screen flex flex-col transition-all duration-300`}>
          
          {/* --- TOP NAVBAR (Already light, minor tweaks) --- */}
          <header className="h-20 bg-white/90 backdrop-blur-xl border-b border-gray-200 sticky top-0 z-40 flex items-center justify-between px-6 sm:px-10">
            <div className="flex items-center gap-4 flex-1">
               {isMobile && <Menu className="text-gray-500" size={24} />}
               <Suspense fallback={<div className="h-10 w-48 bg-gray-200 animate-pulse rounded-2xl" />}>
                  <NavbarSearch />
               </Suspense>
            </div>

            <div className="flex items-center gap-3 sm:gap-6">
               <div className="relative cursor-pointer hover:scale-110 transition-transform">
                  <Bell size={22} className="text-gray-600" />
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 border-2 border-white rounded-full text-[8px] flex items-center justify-center text-white font-black">3</span>
               </div>
               <div className="h-8 w-[1px] bg-gray-200 hidden sm:block" />
               <div className="flex items-center gap-3 pl-2 group cursor-pointer">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-black text-gray-800 m-0 leading-none group-hover:text-blue-600 transition-colors tracking-tight">V-Tech Admin</p>
                    <p className="text-[10px] text-gray-500 m-0 mt-1 uppercase font-black tracking-widest">Active Now</p>
                  </div>
                  <div className="w-10 h-10 rounded-full border-2 border-gray-200 p-0.5 group-hover:border-blue-500 transition-all overflow-hidden">
                    <div className="w-full h-full bg-gray-100 rounded-full flex items-center justify-center text-gray-600">
                       <User size={20} />
                    </div>
                  </div>
               </div>
            </div>
          </header>

          {/* MAIN VIEWPORT */}
          <main className={`flex-1 p-6 sm:p-10 ${isMobile ? 'pb-32' : 'pb-10'} bg-gray-50`}>
            {children}
          </main>

          {/* --- DESKTOP FOOTER (Light) --- */}
          {!isMobile && (
            <footer className="p-8 border-t border-gray-200 bg-white flex flex-col sm:flex-row justify-between items-center gap-4">
               <p className="text-xs font-bold text-gray-500 uppercase tracking-widest m-0">
                  © 2024 V-Tech Solutions <span className="mx-2 text-gray-300">|</span> 
                  <span className="text-gray-400">Enterprise Edition v4.0.2</span>
               </p>
               <div className="flex gap-6">
                  <Link href="#" className="text-xs font-black text-gray-500 no-underline hover:text-blue-600 transition-colors uppercase">Support</Link>
                  <Link href="#" className="text-xs font-black text-gray-500 no-underline hover:text-blue-600 transition-colors uppercase">Privacy</Link>
               </div>
            </footer>
          )}
        </div>

        {/* --- MOBILE BOTTOM NAVIGATION (Light) --- */}
        {isMobile && (
          <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white/90 backdrop-blur-2xl border-t border-gray-200 flex justify-around items-center z-[1000] px-2 pb-2 shadow-[0_-5px_20px_rgba(0,0,0,0.03)]">
            <FooterLink href="/" icon={<LayoutDashboard size={22}/>} label="Home" active={isActive('/')} />
            <FooterLink href="/jobs" icon={<Wrench size={22}/>} label="Jobs" active={isActive('/jobs')} />
            <FooterLink href="/clients" icon={<Users size={22}/>} label="Clients" active={isActive('/clients')} />
            <FooterLink href="/settings" icon={<Settings size={22}/>} label="Settings" active={isActive('/settings')} />
          </nav>
        )}
      </body>
    </html>
  );
}

// --- Light Theme NavLink (Desktop Sidebar) ---
const NavLink = ({ href, icon, label, active }: any) => (
  <Link href={href} className={`
    flex items-center gap-3 px-5 py-3.5 rounded-2xl text-[14px] font-black tracking-tight transition-all duration-300 no-underline italic
    ${active 
      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 translate-x-1' 
      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 hover:translate-x-1'}
  `}>
    <span className={`${active ? 'text-white' : 'text-gray-500'}`}>{icon}</span>
    {label}
  </Link>
);

// --- Light Theme FooterLink (Mobile Bottom Nav) ---
const FooterLink = ({ href, icon, label, active }: any) => (
  <Link href={href} className={`
    flex flex-col items-center justify-center flex-1 no-underline transition-all duration-300 gap-1
    ${active ? 'text-blue-600' : 'text-gray-500'}
  `}>
    <div className={`p-2 rounded-xl transition-all ${active ? 'bg-blue-50 scale-110 shadow-sm' : 'bg-transparent'}`}>
      {icon}
    </div>
    <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
  </Link>
);