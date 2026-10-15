import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MdMap, MdExplore, MdStar, MdPerson, MdStorefront } from 'react-icons/md';

export default function BottomNav({ userRole }) {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { name: 'Map', path: '/map', icon: <MdMap size={24} /> },
    { name: 'Explore', path: '/explore', icon: <MdExplore size={24} /> },
    { name: 'Reviews', path: '/reviews', icon: <MdStar size={24} /> },
    { name: 'Profile', path: '/profile', icon: <MdPerson size={24} /> },
  ];

  if (userRole === 'merchant' || userRole === 'operator') {
    navItems.push({ name: 'Dashboard', path: '/dashboard', icon: <MdStorefront size={24} /> });
  }

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
            height: 65px;
            /* 🚀 FIXED: Swapped invalid rgba() for standard CSS variable */
            background-color: var(--surface-color);
            border-top: 1px solid var(--border-color);
            justify-content: space-around;
            align-items: center;
            z-index: 9999;
            padding-bottom: env(safe-area-inset-bottom);
          }

          .nav-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            flex: 1;
            height: 100%;
            background: none;
            border: none;
            cursor: pointer;
            color: var(--icon-color);
            transition: color 0.2s, transform 0.2s;
            outline: none;
            -webkit-tap-highlight-color: transparent;
          }

          .nav-item.active {
            color: var(--brand-primary);
          }

          .nav-label {
            font-size: 10px;
            font-weight: 700;
            margin-top: 4px;
            letter-spacing: 0.2px;
          }
          
          .nav-item:active {
            transform: scale(0.92);
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
            >
              {item.icon}
              <span className="nav-label">{item.name}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}