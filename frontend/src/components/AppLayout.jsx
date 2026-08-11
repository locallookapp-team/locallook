import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import NotificationBell from './NotificationBell'; 
import { 
  MdExplore, MdStarBorder, MdMap, 
  MdAddBusiness, MdSpaceDashboard, MdOutlineSettings, MdOutlineHelpOutline, 
  MdLocationOn, MdLogin, MdMenu, MdClose, MdPersonOutline,
  MdChevronLeft, MdChevronRight, MdLogout, MdPayment
} from "react-icons/md";

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://locallook-api.onrender.com';

export default function AppLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [session, setSession] = useState(null);
  const [isMerchant, setIsMerchant] = useState(false); 
  const [displayName, setDisplayName] = useState('');
  
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // State for desktop sidebar collapse
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const checkMerchantStatus = async (userId) => {
    try {
      const { data: kycData } = await supabase
        .from('merchant_profiles')
        .select('kyc_status')
        .eq('id', userId)
        .maybeSingle();

      if (kycData?.kyc_status === 'approved') return true;

      const res = await fetch(`${API_BASE_URL}/api/users/${userId}`);
      if (res.ok) {
        const userData = await res.json();
        if (userData.role === 'merchant' || userData.role === 'super_admin') {
          return true;
        }
      }
      return false;
    } catch (e) {
      console.error("Failed to verify merchant status:", e);
      return false;
    }
  };

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      
      if (session) {
        setDisplayName(session.user.user_metadata?.full_name || session.user.email.split('@')[0]);
        const merchantStatus = await checkMerchantStatus(session.user.id);
        setIsMerchant(merchantStatus); 
      }
      setIsAuthLoading(false);
    };

    fetchSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setIsAuthLoading(true); 
      setSession(newSession);
      if (newSession) {
        setDisplayName(newSession.user.user_metadata?.full_name || newSession.user.email.split('@')[0]);
        const merchantStatus = await checkMerchantStatus(newSession.user.id);
        setIsMerchant(merchantStatus);
      } else {
        setIsMerchant(false);
      }
      setIsAuthLoading(false);
    });

    return () => { authListener.subscription.unsubscribe(); };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setIsMobileMenuOpen(false);
    navigate('/');
  };

  const handleNavigation = (path) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  const navItems = [
    { label: 'Map', path: '/', icon: <MdMap size={22} /> }, 
    { label: 'Explore', path: '/explore', icon: <MdExplore size={22} /> }, 
    { label: 'Profile', path: '/profile', icon: <MdPersonOutline size={22} /> },
    { label: 'Reviews', path: '/reviews', icon: <MdStarBorder size={22} /> },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        
        * { font-family: 'Plus Jakarta Sans', sans-serif; }
        .app-wrapper { display: flex; height: 100vh; width: 100vw; overflow: hidden; background-color: #F8FAFC; }
        
        /* 🚀 FIX: Outer sidebar container (No overflow hidden, allows button to float) */
        .desktop-sidebar { 
            width: 240px; 
            background-color: #FFFFFF; 
            border-right: 1px solid #F1F5F9; 
            z-index: 1000; 
            transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
            flex-shrink: 0; 
            position: relative;
        }
        .desktop-sidebar.collapsed {
            width: 88px;
        }

        /* 🚀 FIX: Inner scrollable container */
        .sidebar-inner {
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100%;
            padding: 24px 16px;
            overflow-y: auto;
            overflow-x: hidden;
            scrollbar-width: none;
            box-sizing: border-box;
        }
        .sidebar-inner::-webkit-scrollbar { display: none; }
        
        .desktop-sidebar.collapsed .sidebar-inner {
            padding: 24px 12px;
            align-items: center;
        }
        
        .main-container { flex-grow: 1; display: flex; flex-direction: column; height: 100vh; overflow: hidden; position: relative; }
        .main-content { flex-grow: 1; overflow-y: hidden; position: relative; }
        .mobile-header { display: none; }
        .mobile-overlay { display: none; }
        
        /* 🚀 FIX: Nav Item Layout */
        .nav-item { 
            display: flex; 
            align-items: center; 
            gap: 12px; 
            padding: 12px 14px; 
            border-radius: 12px; 
            cursor: pointer; 
            font-weight: 600; 
            font-size: 14px; 
            transition: all 0.2s ease; 
            color: #64748B; 
            margin-bottom: 4px; 
            white-space: nowrap;
            width: 100%;
            box-sizing: border-box;
        }
        .nav-item:hover { background-color: #F8FAFC; color: #0F172A; }
        .nav-item.active { background-color: #EFF6FF; color: #2563EB; }
        .nav-item.active .nav-icon { color: #2563EB; }
        
        .nav-icon { display: flex; flex-shrink: 0; }

        /* 🚀 FIX: Perfectly centered icons when collapsed */
        .desktop-sidebar.collapsed .nav-item {
            width: 48px;
            height: 48px;
            padding: 0;
            justify-content: center;
        }
        .desktop-sidebar.collapsed .nav-label {
            display: none;
        }

        /* 🚀 FIX: Force NotificationBell to conform to collapsed layout */
        .desktop-sidebar.collapsed .nav-wrapper > div {
            width: 48px !important;
            height: 48px !important;
            padding: 0 !important;
            justify-content: center !important;
        }
        .desktop-sidebar.collapsed .nav-wrapper span:not(:first-child) {
            display: none !important;
        }

        /* 🚀 FIX: Re-anchored Collapse Toggle */
        .collapse-toggle {
            position: absolute;
            top: 32px;
            right: -14px;
            background: #FFFFFF;
            border: 1px solid #E2E8F0;
            color: #64748B;
            border-radius: 50%;
            width: 28px;
            height: 28px;
            display: flex;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            z-index: 1050;
        }
        .collapse-toggle:hover {
            background: #F8FAFC;
            color: #0F172A;
            transform: scale(1.1);
        }

        @keyframes skeletonPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        
        @media (max-width: 768px) {
          .collapse-toggle { display: none; }
          .desktop-sidebar { width: 260px; position: fixed; height: 100%; transform: translateX(-100%); box-shadow: 4px 0 24px rgba(0,0,0,0.1); }
          .desktop-sidebar.open { transform: translateX(0); }
          .mobile-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0; z-index: 900; }
          .main-content { height: calc(100vh - 55px); }
          .mobile-overlay.open { display: block; position: fixed; inset: 0; background: rgba(15, 17, 36, 0.4); z-index: 950; backdrop-filter: blur(2px); transition: opacity 0.3s; }
        }
      `}</style>

      <div className="app-wrapper">
        <div className={`mobile-overlay ${isMobileMenuOpen ? 'open' : ''}`} onClick={() => setIsMobileMenuOpen(false)} />

        <aside className={`desktop-sidebar ${isMobileMenuOpen ? 'open' : ''} ${isSidebarCollapsed && !isMobileMenuOpen ? 'collapsed' : ''}`}>
          
          {/* Collapse Toggle Button (Now cleanly floats outside the sidebar) */}
          {!isMobileMenuOpen && (
            <button className="collapse-toggle" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
              {isSidebarCollapsed ? <MdChevronRight size={18} /> : <MdChevronLeft size={18} />}
            </button>
          )}

          <div className="sidebar-inner">
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: isSidebarCollapsed ? 'center' : 'space-between', paddingBottom: '30px', width: '100%', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                <div style={{ color: '#2563EB', display: 'flex', flexShrink: 0 }}><MdLocationOn size={28} /></div>
                {!isSidebarCollapsed && <h2 style={{ margin: 0, fontSize: '20px', color: '#0F172A', fontWeight: '900', letterSpacing: '-0.5px' }}>LocalLook</h2>}
              </div>
              {isMobileMenuOpen && (
                <button onClick={() => setIsMobileMenuOpen(false)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', display: 'flex' }}>
                  <MdClose size={24} />
                </button>
              )}
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
              {navItems.map(item => (
                <div 
                  key={item.label} 
                  title={isSidebarCollapsed ? item.label : ""} 
                  onClick={() => handleNavigation(item.path)} 
                  className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                >
                  <span className="nav-icon">{item.icon}</span> 
                  <span className="nav-label">{item.label}</span>
                </div>
              ))}
              
              <div style={{ height: '24px' }} />
              
              {isAuthLoading ? (
                <div className="nav-item">
                  <span className="nav-icon" style={{ color: '#94A3B8', opacity: 0.5 }}><MdSpaceDashboard size={22} /></span>
                  {!isSidebarCollapsed && <div className="nav-label" style={{ backgroundColor: '#E2E8F0', height: '14px', width: '90px', borderRadius: '4px', animation: 'skeletonPulse 1.5s infinite' }} />}
                </div>
              ) : isMerchant ? (
                <>
                  <div 
                    title={isSidebarCollapsed ? "Dashboard" : ""}
                    onClick={() => handleNavigation('/dashboard')} 
                    className={`nav-item ${location.pathname === '/dashboard' ? 'active' : ''}`}
                  >
                    <span className="nav-icon" style={{ color: location.pathname === '/dashboard' ? '#2563EB' : '#94A3B8' }}><MdSpaceDashboard size={22} /></span>
                    <span className="nav-label">Dashboard</span>
                  </div>
                  <div 
                    title={isSidebarCollapsed ? "Billing" : ""}
                    onClick={() => handleNavigation('/billing')} 
                    className={`nav-item ${location.pathname === '/billing' ? 'active' : ''}`}
                  >
                    <span className="nav-icon" style={{ color: location.pathname === '/billing' ? '#2563EB' : '#94A3B8' }}><MdPayment size={22} /></span>
                    <span className="nav-label">Billing</span>
                  </div>
                </>
              ) : (
                <div 
                  title={isSidebarCollapsed ? "List Business" : ""}
                  onClick={() => handleNavigation('/create-business')} 
                  className={`nav-item ${location.pathname === '/create-business' ? 'active' : ''}`}
                >
                  <span className="nav-icon" style={{ color: location.pathname === '/create-business' ? '#2563EB' : '#94A3B8' }}><MdAddBusiness size={22} /></span>
                  <span className="nav-label">List Business</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', marginTop: 'auto' }}>
              
              <div className="nav-wrapper" title={isSidebarCollapsed ? "Notifications" : ""}>
                <NotificationBell session={session} isSidebarMode={true} onInviteAccepted={() => setIsMerchant(true)} />
              </div>

              <div className="nav-item" title={isSidebarCollapsed ? "Settings" : ""}><span className="nav-icon" style={{ color: '#94A3B8' }}><MdOutlineSettings size={22} /></span> <span className="nav-label">Settings</span></div>
              <div className="nav-item" title={isSidebarCollapsed ? "Help" : ""}><span className="nav-icon" style={{ color: '#94A3B8' }}><MdOutlineHelpOutline size={22} /></span> <span className="nav-label">Help</span></div>
              
              {session ? (
                <div 
                  title={isSidebarCollapsed ? "Profile & Sign Out" : ""}
                  style={{ 
                    display: 'flex', 
                    flexDirection: isSidebarCollapsed ? 'column' : 'row',
                    alignItems: 'center', 
                    justifyContent: isSidebarCollapsed ? 'center' : 'space-between', 
                    padding: isSidebarCollapsed ? '12px 0' : '12px 10px', 
                    marginTop: '10px', 
                    borderRadius: '12px', 
                    transition: 'background-color 0.2s', 
                    border: '1px solid transparent',
                    width: '100%',
                    boxSizing: 'border-box'
                  }} 
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; e.currentTarget.style.borderColor = '#E2E8F0'; }} 
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                >
                  <div onClick={() => handleNavigation('/profile')} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', overflow: 'hidden', width: isSidebarCollapsed ? 'auto' : '100%', justifyContent: 'center' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#E2E8F0', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#64748B', fontWeight: '900', fontSize: '15px', flexShrink: 0 }}>
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    {!isSidebarCollapsed && (
                      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                        <span style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', maxWidth: '100px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</span>
                        <span style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.5px' }}>
                          {isAuthLoading ? '...' : (isMerchant ? 'MERCHANT' : 'CONSUMER')}
                        </span>
                      </div>
                    )}
                  </div>
                  {!isSidebarCollapsed ? (
                    <button onClick={handleSignOut} style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: '12px', fontWeight: '800', cursor: 'pointer', padding: '8px' }}>Out</button>
                  ) : (
                    // Stacked Sign-out button for collapsed view
                    <div onClick={handleSignOut} style={{ marginTop: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', color: '#EF4444', width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#FEF2F2' }} title="Sign Out">
                      <MdLogout size={18} />
                    </div>
                  )}
                </div>
              ) : (
                <div onClick={() => handleNavigation('/login')} title={isSidebarCollapsed ? "Log In" : ""} style={{ display: 'flex', alignItems: 'center', justifyContent: isSidebarCollapsed ? 'center' : 'flex-start', gap: '12px', padding: '12px', marginTop: '10px', cursor: 'pointer', borderRadius: '12px', backgroundColor: '#EFF6FF', color: '#2563EB', fontWeight: '800', fontSize: '14px' }}>
                  <MdLogin size={22} style={{ flexShrink: 0 }} /> <span className="nav-label">Log In</span>
                </div>
              )}
            </div>

          </div>
        </aside>

        <div className="main-container">
          <div className="mobile-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ color: '#2563EB', display: 'flex' }}><MdLocationOn size={22} /></div>
              <h2 style={{ margin: 0, fontSize: '18px', color: '#0F172A', fontWeight: '900', letterSpacing: '-0.5px' }}>LocalLook</h2>
            </div>
            <button onClick={() => setIsMobileMenuOpen(true)} style={{ background: 'none', border: 'none', color: '#0F172A', cursor: 'pointer', display: 'flex', padding: '4px' }}>
              <MdMenu size={28} />
            </button>
          </div>

          <main className="main-content">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}