import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import BottomNav from './BottomNav'; 
import { useShoppingList } from '../context/ShoppingListContext';
import { 
  MdExplore, MdStarBorder, MdMap, 
  MdAddBusiness, MdSpaceDashboard, 
  MdLocationOn, MdLogin, MdPayment,
  MdFormatListBulleted, MdNotifications
} from "react-icons/md";

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://locallook-api.onrender.com';

export default function AppLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  
  const { shoppingList } = useShoppingList();
  const totalListItems = shoppingList.reduce((sum, item) => sum + item.quantity, 0);

  const [avatarError, setAvatarError] = useState(false);
  const [session, setSession] = useState(null);
  const [isMerchant, setIsMerchant] = useState(false); 
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(''); 
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const lastUserIdRef = useRef(null);

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
        
        if (userData.avatar_url) {
          setAvatarUrl(userData.avatar_url);
        }

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
      setAvatarError(false);
      
      if (session) {
        setDisplayName(session.user.user_metadata?.full_name || session.user.email.split('@')[0]);
        const merchantStatus = await checkMerchantStatus(session.user.id);
        setIsMerchant(merchantStatus); 
      }
      setIsAuthLoading(false);
    };

    fetchSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      // 1. Handle Sign Out cleanly and clear cache
      if (!newSession) {
        if (lastUserIdRef.current) {
          sessionStorage.removeItem(`locallook_merchant_${lastUserIdRef.current}`);
        }
        lastUserIdRef.current = null;
        setSession(null);
        setIsMerchant(false);
        setAvatarUrl('');
        setIsAuthLoading(false);
        return;
      }

      const userId = newSession.user.id;

      // 2. Tab-switch / token-refresh guard: same user is already loaded, update session silently
      if (lastUserIdRef.current === userId) {
        setSession(newSession);
        return;
      }

      // 3. New login or initial page load
      lastUserIdRef.current = userId;
      setSession(newSession);
      setAvatarError(false);
      setDisplayName(newSession.user.user_metadata?.full_name || newSession.user.email.split('@')[0]);

      const cacheKey = `locallook_merchant_${userId}`;
      const cachedStatus = sessionStorage.getItem(cacheKey);

      if (cachedStatus !== null) {
        // Use cached role immediately (no loading flicker)
        setIsMerchant(cachedStatus === 'true');
        setIsAuthLoading(false);
      } else {
        setIsAuthLoading(true);
      }

      // Verify in the background so role changes still sync without blocking the UI
      const merchantStatus = await checkMerchantStatus(userId);
      setIsMerchant(merchantStatus);
      sessionStorage.setItem(cacheKey, String(merchantStatus));
      setIsAuthLoading(false);
    });

    return () => { authListener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session) {
      setUnreadNotifCount(0);
      return;
    }

    const fetchUnreadCount = async () => {
      let inviteCount = 0;
      try {
        const res = await fetch(`${API_BASE_URL}/api/invitations/pending`, {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        if (res.ok) {
          const invites = await res.json();
          inviteCount = Array.isArray(invites) ? invites.length : 0;
        }
      } catch (err) {
        console.error("Failed to fetch invite count:", err);
      }

      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .eq('is_read', false);

      setUnreadNotifCount(inviteCount + (count || 0));
    };

    fetchUnreadCount();

    const channel = supabase
      .channel('public-notifications-sidebar')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${session.user.id}`
        },
        () => fetchUnreadCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  const handleNavigation = (path) => {
    navigate(path);
  };

  const navItems = [
    { label: 'Map', path: '/map', icon: <MdMap size={22} /> }, 
    { label: 'Explore', path: '/explore', icon: <MdExplore size={22} /> }, 
    { label: 'Reviews', path: '/reviews', icon: <MdStarBorder size={22} /> },
    { label: 'My List', path: '/my-list', icon: <MdFormatListBulleted size={22} /> },
    { label: 'Notifications', path: '/notifications', icon: <MdNotifications size={22} /> },
  ];

  const finalAvatar =
    session?.user?.user_metadata?.avatar_url ||
    avatarUrl ||
    session?.user?.user_metadata?.picture;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        
        * { font-family: 'Plus Jakarta Sans', sans-serif; }
        
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
        
        @media (max-width: 768px) {
          .desktop-sidebar { 
            display: none; 
          }
          
          .main-content {
            padding-bottom: calc(65px + env(safe-area-inset-bottom)); 
          }
        }
      `}</style>

      <div className="app-wrapper">
        <aside className="desktop-sidebar">
          <div className="sidebar-inner">
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '30px', width: '100%', boxSizing: 'border-box' }}>
              <div onClick={() => handleNavigation('/')} style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden', cursor: 'pointer' }}>
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
                  
                  {item.label === 'My List' && totalListItems > 0 && (
                    <div style={{
                      marginLeft: 'auto', 
                      backgroundColor: '#EF4444', 
                      color: 'white', 
                      fontSize: '11px', 
                      fontWeight: '800',
                      padding: '2px 8px', 
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      animation: 'slideUp 0.2s ease-out'
                    }}>
                      {totalListItems > 99 ? '99+' : totalListItems}
                    </div>
                  )}
                  {item.label === 'Notifications' && unreadNotifCount > 0 && (
                    <div style={{
                      marginLeft: 'auto',
                      backgroundColor: '#EF4444',
                      color: 'white',
                      fontSize: '11px',
                      fontWeight: '800',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      animation: 'slideUp 0.2s ease-out'
                    }}>
                      {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                    </div>
                  )}
                </div>
              ))}
            </div>
            

            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', marginTop: 'auto' }}>
              
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

              {session ? (
                <div 
                  onClick={() => handleNavigation('/profile')}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px',
                    padding: '12px', 
                    marginTop: '8px', 
                    borderRadius: '12px', 
                    transition: 'background-color 0.2s', 
                    border: '1px solid transparent',
                    width: '100%',
                    boxSizing: 'border-box',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--surface-hover)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }} 
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                >
                  {!finalAvatar || avatarError ? (
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(37, 99, 235, 0.1)',
                        color: 'var(--brand-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '800',
                        fontSize: '14px',
                        flexShrink: 0,
                      }}
                    >
                      {(displayName || 'U').charAt(0).toUpperCase()}
                    </div>
                  ) : (
                    <img
                      src={finalAvatar}
                      alt={displayName || 'User'}
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarError(true)}
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        flexShrink: 0,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                      }}
                    />
                  )}
                  
                  <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }}>
                    <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-main)', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {displayName}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.5px', marginTop: '2px' }}>
                      {isAuthLoading ? '...' : (isMerchant ? 'MERCHANT' : 'CONSUMER')}
                    </span>
                  </div>
                </div>
              ) : (
                <div onClick={() => handleNavigation('/login')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '12px', padding: '12px 14px', marginTop: '8px', cursor: 'pointer', borderRadius: '12px', backgroundColor: 'rgba(37, 99, 235, 0.1)', color: 'var(--brand-primary)', fontWeight: '800', fontSize: '14px' }}>
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