import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useShoppingList } from '../context/ShoppingListContext';
import { MdFormatListBulleted } from 'react-icons/md';

export default function FloatingShoppingList() {
  const navigate = useNavigate();
  const location = useLocation();
  const { shoppingList } = useShoppingList();

  const totalItems = shoppingList.reduce((sum, item) => sum + item.quantity, 0);

  // Hide the button if the list is empty OR if the user is already on the /my-list page
  if (totalItems === 0 || location.pathname === '/my-list') return null;

  return createPortal(
    <button
      onClick={() => navigate('/my-list')}
      style={{
        position: 'fixed',
        bottom: '30px',
        right: '30px',
        zIndex: 999999,
        backgroundColor: 'var(--brand-primary, #1877F2)',
        color: 'white',
        border: 'none',
        borderRadius: '50px',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '15px',
        fontWeight: '800',
        cursor: 'pointer',
        boxShadow: '0 8px 25px rgba(0,0,0,0.25)',
        animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <MdFormatListBulleted size={22} />
      <span>My List</span>
      <span style={{ backgroundColor: 'white', color: 'var(--brand-primary, #1877F2)', padding: '2px 8px', borderRadius: '12px', fontSize: '13px' }}>
        {totalItems}
      </span>
    </button>,
    document.body
  );
}