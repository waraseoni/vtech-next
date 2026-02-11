"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  LayoutDashboard, Users, Package, FileText, 
  Settings, Wrench 
} from 'lucide-react';
import { usePathname } from 'next/navigation';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkSize = () => setIsMobile(window.innerWidth < 992);
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  const isActive = (path: string) => pathname === path;

  return (
    <html lang="en">
      <body style={{ margin: 0, backgroundColor: '#f4f6f9', fontFamily: 'sans-serif' }}>
        
        {/* --- 1. SIDEBAR (PC View) --- */}
        {!isMobile && (
          <aside style={sidebarStyle}>
            <div style={sidebarHeader}>V-TECH <span style={{fontWeight: 'lighter'}}>Admin</span></div>
            <nav style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <NavLink href="/" icon={<LayoutDashboard size={20}/>} label="Dashboard" active={isActive('/')} />
              <NavLink href="/jobs" icon={<Wrench size={20}/>} label="Jobs" active={isActive('/jobs')} />
              <NavLink href="/clients" icon={<Users size={20}/>} label="Clients" active={isActive('/clients')} />
              <NavLink href="/inventory" icon={<Package size={20}/>} label="Inventory" active={isActive('/inventory')} />
              <NavLink href="/reports" icon={<FileText size={20}/>} label="Reports" active={isActive('/reports')} />
              <NavLink href="/settings" icon={<Settings size={20}/>} label="Settings" active={isActive('/settings')} />
            </nav>
          </aside>
        )}

        {/* --- 2. MAIN CONTENT AREA --- */}
        <div style={{ 
          marginLeft: isMobile ? '0' : '250px', 
          flex: 1, 
          minHeight: '100vh' 
        }}>
          <main style={{ padding: '20px', paddingBottom: isMobile ? '90px' : '20px' }}>
            {children}
          </main>
        </div>

        {/* --- 3. BOTTOM NAVIGATION (Mobile View) --- */}
        {isMobile && (
          <nav style={bottomNavStyle}>
            <FooterLink href="/" icon={<LayoutDashboard size={22}/>} label="Home" active={isActive('/')} />
            <FooterLink href="/jobs" icon={<Wrench size={22}/>} label="Jobs" active={isActive('/jobs')} />
            <FooterLink href="/clients" icon={<Users size={22}/>} label="Clients" active={isActive('/clients')} />
            <FooterLink href="/inventory" icon={<Package size={22}/>} label="Stock" active={isActive('/inventory')} />
            <FooterLink href="/settings" icon={<Settings size={22}/>} label="Settings" active={isActive('/settings')} />
          </nav>
        )}
      </body>
    </html>
  );
}

// --- Helper Components ---
const NavLink = ({ href, icon, label, active }: any) => (
  <Link href={href} style={{
    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 15px',
    textDecoration: 'none', borderRadius: '6px', fontSize: '15px',
    backgroundColor: active ? '#495057' : 'transparent',
    color: active ? 'white' : '#c2c7d0',
    transition: '0.2s'
  }}>
    {icon} {label}
  </Link>
);

const FooterLink = ({ href, icon, label, active }: any) => (
  <Link href={href} style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    textDecoration: 'none', flex: 1, color: active ? '#007bff' : '#666'
  }}>
    {icon}
    <span style={{ fontSize: '10px', marginTop: '4px' }}>{label}</span>
  </Link>
);

// --- Styles ---
const sidebarStyle: React.CSSProperties = {
  width: '250px', backgroundColor: '#343a40', color: 'white',
  position: 'fixed', height: '100vh', display: 'flex', flexDirection: 'column'
};

const sidebarHeader: React.CSSProperties = { 
  padding: '20px', textAlign: 'center', fontSize: '20px', 
  fontWeight: 'bold', borderBottom: '1px solid #4b545c', marginBottom: '10px'
};

const bottomNavStyle: React.CSSProperties = {
  position: 'fixed', bottom: 0, left: 0, right: 0, height: '70px',
  backgroundColor: 'white', borderTop: '1px solid #ddd',
  display: 'flex', justifyContent: 'space-around', alignItems: 'center',
  zIndex: 1000, paddingBottom: '10px'
};