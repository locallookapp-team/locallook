import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
  MdExplore, MdGridView, MdBookmarkBorder, MdStarBorder, 
  MdAddBusiness, MdSpaceDashboard, MdOutlineSettings, MdOutlineHelpOutline, MdLocationOn, MdLogin, MdMenu, MdClose
} from "react-icons/md";

export default function AppLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [session, setSession] = useState(null);
  const [isMerchant, setIsMerchant] = useState(false); 
  const [displayName, setDisplayName] = useState('');
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      
      if (session) {
        setDisplayName(session.user.user_metadata?.full_name || session.user.email.split('@')[0]);
        const { data } = await supabase.from('store_operators').select('id').eq('user_id', session.user.id).limit(1).maybeSingle();
        setIsMerchant(!!data); 
      }
    };

    fetchSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession);
      if (newSession) {
        setDisplayName(newSession.user.user_metadata?.full_name || newSession.user.email.split('@')[0]);
        const { data } = await supabase.from('store_operators').select('id').eq('user_id', newSession.user.id).limit(1).maybeSingle();
        setIsMerchant(!!data);
      } else {
        setIsMerchant(false);
      }
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
    { label: 'Explore', path: '/', icon: <MdExplore size={20} /> },
    { label: 'Categories', path: '/categories', icon: <MdGridView size={20} /> },
    { label: 'Saved Places', path: '/profile', icon: <MdBookmarkBorder size={20} /> },
    { label: 'Reviews', path: '/reviews', icon: <MdStarBorder size={20} /> },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        
        * { font-family: 'Plus Jakarta Sans', sans-serif; }
        .app-wrapper { display: flex; height: 100vh; width: 100vw; overflow: hidden; background-color: #F8FAFC; }
        /* 🚀 Reduced sidebar width from 260px to 220px to mimic 75% zoom */
        .desktop-sidebar { width: 220px; display: flex; flex-direction: column; background-color: #FFFFFF; border-right: 1px solid #F1F5F9; padding: 20px 16px; z-index: 1000; transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); flex-shrink: 0; }
        .main-container { flex-grow: 1; display: flex; flex-direction: column; height: 100vh; overflow: hidden; position: relative; }
        .main-content { flex-grow: 1; overflow-y: hidden; position: relative; }
        .mobile-header { display: none; }
        .mobile-overlay { display: none; }
        
        /* 🚀 Scaled down nav items */
        .nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 13.5px; transition: all 0.2s; color: #64748B; margin-bottom: 2px; }
        .nav-item:hover { background-color: #F8FAFC; color: #0F172A; }
        .nav-item.active { background-color: #EFF6FF; color: #2563EB; }
        .nav-item.active svg { color: #2563EB !important; }
        
        @media (max-width: 768px) {
          .desktop-sidebar { position: fixed; height: 100%; transform: translateX(-100%); box-shadow: 4px 0 24px rgba(0,0,0,0.1); }
          .desktop-sidebar.open { transform: translateX(0); }
          .mobile-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0; z-index: 900; }
          .main-content { height: calc(100vh - 55px); }
          .mobile-overlay.open { display: block; position: fixed; inset: 0; background: rgba(15, 17, 36, 0.4); z-index: 950; backdrop-filter: blur(2px); transition: opacity 0.3s; }
        }
      `}</style>

      <div className="app-wrapper">
        <div className={`mobile-overlay ${isMobileMenuOpen ? 'open' : ''}`} onClick={() => setIsMobileMenuOpen(false)} />

        <aside className={`desktop-sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px 30px 8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ color: '#2563EB', display: 'flex' }}><MdLocationOn size={24} /></div>
              <h2 style={{ margin: 0, fontSize: '18px', color: '#0F172A', fontWeight: '800', letterSpacing: '-0.5px' }}>LocalLook</h2>
            </div>
            {isMobileMenuOpen && (
              <button onClick={() => setIsMobileMenuOpen(false)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', display: 'flex' }}>
                <MdClose size={20} />
              </button>
            )}
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
            {navItems.map(item => (
              <div key={item.label} onClick={() => handleNavigation(item.path)} className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}>
                <span style={{ color: location.pathname === item.path ? '#2563EB' : '#94A3B8' }}>{item.icon}</span> 
                {item.label}
              </div>
            ))}
            
            <div style={{ height: '24px' }} />
            
            {isMerchant ? (
              <div onClick={() => handleNavigation('/dashboard')} className={`nav-item ${location.pathname === '/dashboard' ? 'active' : ''}`}>
                <span style={{ color: location.pathname === '/dashboard' ? '#2563EB' : '#94A3B8' }}><MdSpaceDashboard size={20} /></span>
                Dashboard
              </div>
            ) : (
              <div onClick={() => handleNavigation('/create-business')} className={`nav-item ${location.pathname === '/create-business' ? 'active' : ''}`}>
                <span style={{ color: location.pathname === '/create-business' ? '#2563EB' : '#94A3B8' }}><MdAddBusiness size={20} /></span>
                List Business
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="nav-item"><span style={{ color: '#94A3B8' }}><MdOutlineSettings size={20} /></span> Settings</div>
            <div className="nav-item"><span style={{ color: '#94A3B8' }}><MdOutlineHelpOutline size={20} /></span> Help</div>
            
            {session ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 10px', marginTop: '10px', borderRadius: '10px', transition: 'background-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                <div onClick={() => handleNavigation('/profile')} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#E2E8F0', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#64748B', fontWeight: 'bold', fontSize: '14px' }}>
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', maxWidth: '80px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</span>
                    <span style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', fontWeight: '800' }}>
                      {isMerchant ? 'MERCHANT' : 'CONSUMER'}
                    </span>
                  </div>
                </div>
                <button onClick={handleSignOut} style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>Out</button>
              </div>
            ) : (
              <div onClick={() => handleNavigation('/login')} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 10px', marginTop: '10px', cursor: 'pointer', borderRadius: '10px', backgroundColor: '#EFF6FF', color: '#2563EB', fontWeight: '700', fontSize: '13.5px' }}>
                <MdLogin size={20} /> Log In
              </div>
            )}
          </div>
        </aside>

        <div className="main-container">
          <div className="mobile-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ color: '#2563EB', display: 'flex' }}><MdLocationOn size={22} /></div>
              <h2 style={{ margin: 0, fontSize: '18px', color: '#0F172A', fontWeight: '800', letterSpacing: '-0.5px' }}>LocalLook</h2>
            </div>
            <button onClick={() => setIsMobileMenuOpen(true)} style={{ background: 'none', border: 'none', color: '#0F172A', cursor: 'pointer', display: 'flex', padding: '4px' }}>
              <MdMenu size={24} />
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