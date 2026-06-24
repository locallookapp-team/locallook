import { useLocation, useNavigate } from 'react-router-dom';
import { MdMap, MdList, MdStorefront } from 'react-icons/md';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  // ADDED '/store' so the nav hides on the Store Profile page
  const hideOnRoutes = [
    '/login', 
    '/register', 
    '/forgot-password', 
    '/update-password',
    '/store' 
  ];

  const shouldHide = hideOnRoutes.some(route => location.pathname.startsWith(route));

  if (shouldHide) {
    return null; 
  }

  const isActive = (path) => location.pathname.startsWith(path) && path !== '/' || (path === '/' && location.pathname === '/');

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)',
      boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
      display: 'flex', justifyContent: 'space-around', alignItems: 'center',
      paddingBottom: 'env(safe-area-inset-bottom)',
      height: '65px', zIndex: 9999
    }}>
      
      <div onClick={() => navigate('/')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', color: isActive('/') ? '#2563eb' : '#9ca3af', width: '33%' }}>
        <MdMap size={26} />
        <span style={{ fontSize: '11px', fontWeight: 'bold' }}>Map</span>
      </div>

      <div onClick={() => navigate('/browse')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', color: isActive('/browse') ? '#2563eb' : '#9ca3af', width: '33%' }}>
        <MdList size={28} />
        <span style={{ fontSize: '11px', fontWeight: 'bold' }}>Browse</span>
      </div>

      <div onClick={() => navigate('/dashboard')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', color: isActive('/dashboard') ? '#2563eb' : '#9ca3af', width: '33%' }}>
        <MdStorefront size={26} />
        <span style={{ fontSize: '11px', fontWeight: 'bold' }}>Merchant</span>
      </div>

    </div>
  );
}