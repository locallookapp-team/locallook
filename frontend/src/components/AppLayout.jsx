import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import NotificationBell from './NotificationBell'; 
import BottomNav from './BottomNav'; // 🚀 Added Bottom Navigation
import { 
  MdExplore, MdStarBorder, MdMap, 
  MdAddBusiness, MdSpaceDashboard, MdOutlineSettings, MdOutlineHelpOutline, 
  MdLocationOn, MdLogin, MdClose, MdPersonOutline, MdPayment
} from "react-icons/md";

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://locallook-api.onrender.com';

export default function AppLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [session, setSession] = useState(null);
  const [isMerchant, setIsMerchant] = useState(false); 
  const [displayName, setDisplayName] = useState('');
  
  const [isAuthLoading, setIsAuthLoading] = useState(true);

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
    navigate('/');
  };

  const handleNavigation = (path) => {
    navigate(path);
  };

  const navItems = [
    { label: 'Map', path: '/map', icon: <MdMap size={22} /> }, 
    { label: 'Explore', path: '/explore', icon: <MdExplore size={22} /> }, 
    { label: 'Profile', path: '/profile', icon: <MdPersonOutline size={22} /> },
    { label: 'Reviews', path: '/reviews', icon: <MdStarBorder size={22} /> },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        
        * { font-family: 'Plus Jakarta Sans', sans-serif; }
        
        /* 🚀 Changed to 100dvh for native mobile browser support */
        .app-wrapper { display: flex; height: 100dvh; width: 100vw; overflow: hidden; background-color: var(--bg-color); }
        
        .desktop-sidebar { 
            width: 240px; 
            background-color: var(--surface-color); 
            border-right: 1px solid var(--border-color); 
            box-shadow: 4px 0 20px rgba(0,0,0,0.04);
            z-index: 1000; 
            flex-shrink: 0; 
            position: relative;
            transition: background-color 0.3s ease, border-color 0.3s ease;
        }

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
        
        .main-container { flex-grow: 1; display: flex; flex-direction: column; height: 100dvh; overflow: hidden; position: relative; }
        .main-content { flex-grow: 1; overflow-y: auto; overflow-x: hidden; position: relative; }
        
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
            color: var(--text-muted); 
            margin-bottom: 4px; 
            white-space: nowrap;
            width: 100%;
            box-sizing: border-box;
        }
        .nav-item:hover { background-color: var(--surface-hover); color: var(--text-main); }
        .nav-item.active { background-color: rgba(37, 99, 235, 0.1); color: var(--brand-primary); }
        .nav-item.active .nav-icon { color: var(--brand-primary); }
        
        .nav-icon { display: flex; flex-shrink: 0; }

        @keyframes skeletonPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        
        /* 🚀 NATIVE MOBILE OVERRIDES */
        @media (max-width: 768px) {
          .desktop-sidebar { 
            display: none; /* Completely hide desktop sidebar */
          }
          
          .main-content {
            /* Add bottom padding so content scrolls behind the BottomNav */
            /* 65px bar height + safe area for iPhone home indicator */
            padding-bottom: calc(65px + env(safe-area-inset-bottom)); 
          }
        }
      `}</style>

      <div className="app-wrapper">
        <aside className="desktop-sidebar">
          <div className="sidebar-inner">
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '30px', width: '100%', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                <div style={{ color: 'var(--brand-primary)', display: 'flex', flexShrink: 0 }}><MdLocationOn size={28} /></div>
                <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--text-main)', fontWeight: '900', letterSpacing: '-0.5px' }}>LocalLook</h2>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
              {navItems.map(item => (
                <div 
                  key={item.label} 
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
                  <span className="nav-icon" style={{ color: 'var(--icon-color)', opacity: 0.5 }}><MdSpaceDashboard size={22} /></span>
                  <div className="nav-label" style={{ backgroundColor: 'var(--border-color)', height: '14px', width: '90px', borderRadius: '4px', animation: 'skeletonPulse 1.5s infinite' }} />
                </div>
              ) : isMerchant ? (
                <>
                  <div 
                    onClick={() => handleNavigation('/dashboard')} 
                    className={`nav-item ${location.pathname === '/dashboard' ? 'active' : ''}`}
                  >
                    <span className="nav-icon" style={{ color: location.pathname === '/dashboard' ? 'var(--brand-primary)' : 'var(--icon-color)' }}><MdSpaceDashboard size={22} /></span>
                    <span className="nav-label">Dashboard</span>
                  </div>
                  <div 
                    onClick={() => handleNavigation('/billing')} 
                    className={`nav-item ${location.pathname === '/billing' ? 'active' : ''}`}
                  >
                    <span className="nav-icon" style={{ color: location.pathname === '/billing' ? 'var(--brand-primary)' : 'var(--icon-color)' }}><MdPayment size={22} /></span>
                    <span className="nav-label">Billing</span>
                  </div>
                </>
              ) : (
                <div 
                  onClick={() => handleNavigation('/create-business')} 
                  className={`nav-item ${location.pathname === '/create-business' ? 'active' : ''}`}
                >
                  <span className="nav-icon" style={{ color: location.pathname === '/create-business' ? 'var(--brand-primary)' : 'var(--icon-color)' }}><MdAddBusiness size={22} /></span>
                  <span className="nav-label">List Business</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', marginTop: 'auto' }}>
              
              <div className="nav-wrapper">
                <NotificationBell session={session} isSidebarMode={true} onInviteAccepted={() => setIsMerchant(true)} />
              </div>

              <div className="nav-item"><span className="nav-icon" style={{ color: 'var(--icon-color)' }}><MdOutlineSettings size={22} /></span> <span className="nav-label">Settings</span></div>
              <div className="nav-item"><span className="nav-icon" style={{ color: 'var(--icon-color)' }}><MdOutlineHelpOutline size={22} /></span> <span className="nav-label">Help</span></div>
              
              {session ? (
                <div 
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'row',
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    padding: '12px 10px', 
                    marginTop: '10px', 
                    borderRadius: '12px', 
                    transition: 'background-color 0.2s', 
                    border: '1px solid transparent',
                    width: '100%',
                    boxSizing: 'border-box'
                  }} 
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface-hover)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }} 
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                >
                  <div onClick={() => handleNavigation('/profile')} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', overflow: 'hidden', width: '100%', justifyContent: 'flex-start' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--surface-hover)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)', fontWeight: '900', fontSize: '15px', flexShrink: 0 }}>
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                      <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-main)', maxWidth: '100px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.5px' }}>
                        {isAuthLoading ? '...' : (isMerchant ? 'MERCHANT' : 'CONSUMER')}
                      </span>
                    </div>
                  </div>
                  <button onClick={handleSignOut} style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: '12px', fontWeight: '800', cursor: 'pointer', padding: '8px' }}>Out</button>
                </div>
              ) : (
                <div onClick={() => handleNavigation('/login')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '12px', padding: '12px', marginTop: '10px', cursor: 'pointer', borderRadius: '12px', backgroundColor: 'rgba(37, 99, 235, 0.1)', color: 'var(--brand-primary)', fontWeight: '800', fontSize: '14px' }}>
                  <MdLogin size={22} style={{ flexShrink: 0 }} /> <span className="nav-label">Log In</span>
                </div>
              )}
            </div>

          </div>
        </aside>

        <div className="main-container">
          <main className="main-content">
            {children}
          </main>
          
          <BottomNav />
        </div>
      </div>
    </>
  );
}