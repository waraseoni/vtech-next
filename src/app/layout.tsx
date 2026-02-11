import Link from 'next/link';
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  FileText, 
  Settings, 
  Wrench 
} from 'lucide-react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, display: 'flex', minHeight: '100vh', backgroundColor: '#f4f6f9', fontFamily: 'sans-serif' }}>
        
        {/* --- GLOBAL SIDEBAR --- */}
        <div style={{ width: '250px', backgroundColor: '#343a40', color: '#c2c7d0', display: 'flex', flexDirection: 'column', position: 'fixed', height: '100vh', zIndex: 100 }}>
          <div style={{ padding: '20px', textAlign: 'center', borderBottom: '1px solid #4b545c', color: 'white', fontWeight: 'bold', fontSize: '20px' }}>
            V-TECH <span style={{ fontWeight: 'lighter', color: '#adb5bd' }}>Admin</span>
          </div>
          
          <div style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <Link href="/" style={navStyle}>
              <LayoutDashboard size={18}/> Dashboard
            </Link>
            
            <Link href="/jobs" style={navStyle}>
              <Wrench size={18}/> Job Management
            </Link>
            
            <Link href="/clients" style={navStyle}>
              <Users size={18}/> Client Management
            </Link>
            
            <Link href="/inventory" style={navStyle}>
              <Package size={18}/> Inventory / Spares
            </Link>
            
            <Link href="/reports" style={navStyle}>
              <FileText size={18}/> Reports / Khata
            </Link>
          </div>

          {/* Bottom Settings Link */}
          <div style={{ marginTop: 'auto', padding: '15px', borderTop: '1px solid #4b545c' }}>
            <Link href="/settings" style={navStyle}>
              <Settings size={18}/> Settings
            </Link>
          </div>
        </div>

        {/* --- MAIN CONTENT AREA --- */}
        <div style={{ marginLeft: '250px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Top Navbar */}
          <nav style={{ 
            height: '57px', 
            backgroundColor: 'white', 
            borderBottom: '1px solid #dee2e6', 
            display: 'flex', 
            alignItems: 'center', 
            padding: '0 20px', 
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 50
          }}>
            <span style={{ color: '#666', fontWeight: 'bold' }}>V-Tech Workshop Management System</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '12px', color: '#999', background: '#eee', padding: '2px 8px', borderRadius: '10px' }}>v2.0</span>
              <div style={{ width: '30px', height: '30px', background: '#007bff', borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>V</div>
            </div>
          </nav>

          {/* Page Content */}
          <main style={{ padding: '25px' }}>
            {children}
          </main>
        </div>

      </body>
    </html>
  );
}

const navStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '12px 15px',
  color: '#c2c7d0',
  textDecoration: 'none',
  fontSize: '15px',
  borderRadius: '6px',
  transition: 'all 0.2s ease',
  // Hover effect CSS is handled by browser usually, 
  // for Next.js it's better to use a class, but keeping inline for simplicity:
};