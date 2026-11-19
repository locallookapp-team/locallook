import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useShoppingList } from '../context/ShoppingListContext';
import { MdFormatListBulleted, MdArrowBack, MdDelete, MdStorefront } from 'react-icons/md';

export default function ShoppingListPage() {
  const navigate = useNavigate();
  const { shoppingList, removeFromList, clearList } = useShoppingList();

  const totalItems = shoppingList.reduce((sum, item) => sum + item.quantity, 0);
  const grandTotal = shoppingList.reduce((sum, item) => sum + item.total, 0);

  const groupedByStore = shoppingList.reduce((groups, item) => {
    if (!groups[item.store_id]) {
      groups[item.store_id] = { store_name: item.store_name, items: [], storeTotal: 0 };
    }
    groups[item.store_id].items.push(item);
    groups[item.store_id].storeTotal += item.total;
    return groups;
  }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', backgroundColor: 'var(--bg-color)', fontFamily: 'var(--font-main)', overflowY: 'auto' }}>
      
      {/* Header */}
      <div style={{ height: '70px', flexShrink: 0, backgroundColor: 'var(--surface-color)', padding: '0 20px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 40 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', fontSize: '15px', fontWeight: '800', cursor: 'pointer', padding: 0 }}>
          <MdArrowBack size={24} /> Back
        </button>
        <h1 style={{ margin: '0 0 0 20px', fontSize: '18px', fontWeight: '900', color: 'var(--text-main)' }}>My Errand List</h1>
      </div>

      {/* Main Content */}
      <div style={{ flexGrow: 1, padding: '30px 20px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '25px' }}>
          
          {Object.keys(groupedByStore).length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '80px' }}>
              <MdFormatListBulleted size={64} style={{ opacity: 0.2, marginBottom: '15px' }} />
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: 'var(--text-main)' }}>Your list is empty</h2>
              <p style={{ marginTop: '10px', fontSize: '15px' }}>Explore stores and add items to plan your errand run.</p>
              <button onClick={() => navigate('/explore')} style={{ marginTop: '20px', padding: '12px 24px', backgroundColor: 'var(--brand-primary)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' }}>
                Explore Stores
              </button>
            </div>
          ) : (
            <>
              {Object.values(groupedByStore).map((storeGroup, idx) => (
                <div key={idx} style={{ backgroundColor: 'var(--surface-color)', borderRadius: '20px', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
                  
                  {/* Store Header */}
                  <div style={{ padding: '16px 24px', backgroundColor: 'var(--surface-hover)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <MdStorefront size={22} color="var(--brand-primary)" />
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: 'var(--text-main)' }}>{storeGroup.store_name}</h3>
                    </div>
                    <span style={{ fontSize: '15px', fontWeight: '900', color: 'var(--text-main)' }}>Subtotal: ₱{storeGroup.storeTotal.toFixed(2)}</span>
                  </div>

                  {/* Store Items */}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {storeGroup.items.map((item, i) => (
                      <div key={item.cart_id} style={{ display: 'flex', gap: '16px', padding: '20px 24px', borderBottom: i === storeGroup.items.length - 1 ? 'none' : '1px solid var(--surface-hover)' }}>
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.item_name} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '12px', backgroundColor: 'var(--surface-hover)', flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: '80px', height: '80px', backgroundColor: 'var(--surface-hover)', borderRadius: '12px', flexShrink: 0 }} />
                        )}
                        
                        <div style={{ flexGrow: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '900', color: 'var(--text-main)' }}>{item.quantity}x {item.item_name}</h4>
                            <span style={{ fontSize: '16px', fontWeight: '900', color: 'var(--text-main)' }}>₱{item.total.toFixed(2)}</span>
                          </div>
                          
                          {Object.values(item.selections || {}).map((sel, sIdx) => (
                            <div key={sIdx} style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600', marginTop: '2px' }}>• {sel.name}</div>
                          ))}
                          
                          <button onClick={() => removeFromList(item.cart_id)} style={{ marginTop: '12px', background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#EF4444', fontSize: '12px', fontWeight: '800', cursor: 'pointer', padding: '6px 12px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <MdDelete size={14} /> Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              
              {/* Grand Total Footer */}
              <div style={{ padding: '24px', backgroundColor: 'var(--surface-color)', borderRadius: '20px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '16px', color: 'var(--text-muted)', fontWeight: '800' }}>Total Cash to Prepare:</span>
                  <span style={{ fontSize: '32px', fontWeight: '900', color: 'var(--text-main)' }}>₱{grandTotal.toFixed(2)}</span>
                </div>
                <button onClick={() => { if(window.confirm('Clear your entire list?')) { clearList(); navigate(-1); } }} style={{ width: '100%', padding: '16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', border: 'none', borderRadius: '14px', fontWeight: '900', fontSize: '15px', cursor: 'pointer' }}>
                  Clear Entire List
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}