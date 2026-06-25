import { useLocation, useNavigate } from 'react-router-dom';
import { MdMap, MdStorefront } from 'react-icons/md';
import { FaUserTie } from 'react-icons/fa';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  // Removed /login and /register so the nav stays visible!
  const hideOnRoutes = [
    '/forgot-password', 
    '/update-password',
    '/store' 
  ];

  const shouldHide = hideOnRoutes.some(route => location.pathname.startsWith(route));

  if (shouldHide) return null; 

  // Advanced active state matching
  const checkIsActive = (matchPaths) => {
    if (matchPaths.includes('/') && location.pathname === '/') return true;
    return matchPaths.some(p => p !== '/' && location.pathname.startsWith(p));
  };

  const navItems = [
    { path: '/', label: 'Map', icon: MdMap, matchPaths: ['/'] },
    { path: '/browse', label: 'Explore', icon: MdStorefront, matchPaths: ['/browse'] }, 
    // Merchant tab acts as the hub and lights up for dashboard, login, AND register
    { path: '/dashboard', label: 'Merchant', icon: FaUserTie, matchPaths: ['/dashboard', '/login', '/register'] }
  ];

  return (
    <>
      <style>{`
        .premium-nav-container {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(0, 0, 0, 0.05);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0,0,0,0.05);
          border-radius: 100px;
          display: flex;
          align-items: center;
          padding: 8px;
          gap: 8px;
          z-index: 9999;
        }

        .nav-pill {
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border-radius: 100px;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          -webkit-tap-highlight-color: transparent;
          overflow: hidden;
        }

        .nav-pill.active {
          background: #2563eb;
          color: white;
          padding: 12px 24px;
        }

        .nav-pill.inactive {
          background: transparent;
          color: #9ca3af;
          padding: 12px 16px;
        }

        .nav-pill.inactive:hover {
          color: #4b5563;
          background: rgba(0, 0, 0, 0.03);
        }

        .nav-text {
          font-size: 13.5px;
          font-weight: 500;
          white-space: nowrap;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .nav-pill.active .nav-text {
          max-width: 100px;
          opacity: 1;
          margin-left: 8px;
        }

        .nav-pill.inactive .nav-text {
          max-width: 0px;
          opacity: 0;
          margin-left: 0px;
        }

        .nav-icon {
          flex-shrink: 0;
        }
      `}</style>

      <div className="premium-nav-container">
        {navItems.map((item) => {
          const active = checkIsActive(item.matchPaths);
          const Icon = item.icon;
          
          return (
            <div 
              key={item.label}
              onClick={() => navigate(item.path)} 
              className={`nav-pill ${active ? 'active' : 'inactive'}`}
            >
              <Icon size={20} className="nav-icon" />
              <span className="nav-text">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}