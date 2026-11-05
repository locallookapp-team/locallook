import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MdMap, MdExplore, MdStar, MdPerson } from 'react-icons/md';

// Notice we removed userRole since we no longer inject the dashboard tab here
export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { name: 'Map', path: '/map', icon: <MdMap size={28} /> },
    { name: 'Explore', path: '/explore', icon: <MdExplore size={28} /> },
    { name: 'Reviews', path: '/reviews', icon: <MdStar size={28} /> },
    { name: 'Profile', path: '/profile', icon: <MdPerson size={28} /> },
  ];

  return (
    <>
      <style>{`
        .mobile-bottom-nav {
          display: none;
        }

        @media (max-width: 768px) {
          .mobile-bottom-nav {
            display: flex;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 60px; /* Slimmed down slightly since there are no labels */
            background-color: var(--surface-color);
            /* Frosted glass effect for native feel */
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border-top: 1px solid var(--border-color);
            justify-content: space-around;
            align-items: center;
            z-index: 9999;
            padding-bottom: env(safe-area-inset-bottom);
            box-shadow: 0 -4px 15px rgba(0,0,0,0.03);
          }

          .nav-item {
            display: flex;
            align-items: center;
            justify-content: center;
            flex: 1;
            height: 100%;
            background: none;
            border: none;
            cursor: pointer;
            color: var(--icon-color);
            transition: color 0.2s, transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            outline: none;
            -webkit-tap-highlight-color: transparent;
          }

          .nav-item.active {
            color: var(--brand-primary);
          }

          /* Remove hover state on mobile to avoid sticky ghost hovers */
          @media (hover: none) {
            .nav-item:hover { color: var(--icon-color); }
            .nav-item.active:hover { color: var(--brand-primary); }
          }
          
          /* Native springy click effect */
          .nav-item:active {
            transform: scale(0.85);
          }
        }
      `}</style>

      <nav className="mobile-bottom-nav">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || 
                           (item.path !== '/' && location.pathname.startsWith(item.path));
          
          return (
            <button 
              key={item.name}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
              aria-label={item.name}
            >
              {item.icon}
            </button>
          );
        })}
      </nav>
    </>
  );
}