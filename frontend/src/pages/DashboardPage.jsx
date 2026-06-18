import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function DashboardPage() {
  const [stores, setStores] = useState([]); // NEW: Holds ALL assigned stores
  const [activeStore, setActiveStore] = useState(null); // NEW: The currently selected store
  
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  
  const [newItem, setNewItem] = useState({ name: '', description: '', price: '', imageFile: null });
  const [isUploading, setIsUploading] = useState(false);
  
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(window.location.search);
  const ownerId = queryParams.get('user_id');

  // 1. Fetch ALL stores the user has access to
  useEffect(() => {
    if (!ownerId) { navigate('/login'); return; }
    fetch(`https://locallook-api.onrender.com/api/merchant/store/${ownerId}`)
      .then(res => res.json())
      .then(data => { 
        if (Array.isArray(data) && data.length > 0) {
          setStores(data);
          setActiveStore(data[0]); // Default to the first store in the list
        }
        setLoading(false); 
      })
      .catch(() => setLoading(false));
  }, [ownerId, navigate]);

  // 2. Fetch items whenever the ACTIVE store changes
  useEffect(() => {
    if (activeStore?.id) {
      fetch(`https://locallook-api.onrender.com/api/stores/${activeStore.id}/items`)
        .then(res => res.json())
        .then(data => setItems(data));
    }
  }, [activeStore?.id]);

  const toggleStoreStatus = async () => {
    const nextStatus = !activeStore.is_open;
    const response = await fetch(`https://locallook-api.onrender.com/api/stores/${activeStore.id}/toggle`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_open: nextStatus })
    });
    
    if (response.ok) {
      // Update both the active store view AND the background array
      setActiveStore({ ...activeStore, is_open: nextStatus });
      setStores(stores.map(s => s.id === activeStore.id ? { ...s, is_open: nextStatus } : s));
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    let finalImageUrl = null;

    if (newItem.imageFile) {
      const fileExt = newItem.imageFile.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${activeStore.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('item-images').upload(filePath, newItem.imageFile);
      if (uploadError) {
        alert("Error uploading image: " + uploadError.message);
        setIsUploading(false);
        return;
      }
      const { data: publicUrlData } = supabase.storage.from('item-images').getPublicUrl(filePath);
      finalImageUrl = publicUrlData.publicUrl;
    }

    const response = await fetch('https://locallook-api.onrender.com/api/items', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store_id: activeStore.id, item_name: newItem.name, description: newItem.description, price: parseFloat(newItem.price), image_url: finalImageUrl })
    });
    
    if (response.ok) {
      const addedItem = await response.json();
      setItems([addedItem, ...items]);
      setNewItem({ name: '', description: '', price: '', imageFile: null });
      document.getElementById('image-upload').value = ''; 
    }
    setIsUploading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f3f4f6' }}>
      <h3 style={{ color: '#6b7280' }}>Loading your dashboard...</h3>
    </div>
  );
  
  if (!activeStore) return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f3f4f6', gap: '15px' }}>
      <h3 style={{ color: '#ef4444', margin: 0 }}>No store linked to this account.</h3>
      <button onClick={() => navigate('/register')} style={{ padding: '10px 20px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Register a Store</button>
    </div>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#f3f4f6', fontFamily: 'sans-serif', overflow: 'hidden' }}>
      
      {/* 1. DARK MODE SIDEBAR */}
      <div style={{ width: '260px', backgroundColor: '#1f2937', color: 'white', display: 'flex', flexDirection: 'column', boxShadow: '4px 0 15px rgba(0,0,0,0.1)', zIndex: 10 }}>
        <div style={{ padding: '25px 20px', borderBottom: '1px solid #374151' }}>
          <h2 style={{ margin: 0, fontSize: '24px', color: '#3b82f6', fontWeight: '900', letterSpacing: '-0.5px' }}>LocalLook</h2>
          <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 'bold', letterSpacing: '2px' }}>MERCHANT PORTAL</span>
        </div>
        
        <div style={{ flexGrow: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button style={{ width: '100%', padding: '12px 15px', backgroundColor: '#374151', color: 'white', border: 'none', borderRadius: '8px', textAlign: 'left', fontWeight: 'bold', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            📦 Menu Inventory
          </button>
          <button onClick={() => navigate('/')} style={{ width: '100%', padding: '12px 15px', backgroundColor: 'transparent', color: '#d1d5db', border: 'none', borderRadius: '8px', textAlign: 'left', fontWeight: 'bold', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', transition: 'background-color 0.2s' }} onMouseEnter={e => e.target.style.backgroundColor = '#374151'} onMouseLeave={e => e.target.style.backgroundColor = 'transparent'}>
            🌍 View Live Map
          </button>
        </div>

        <div style={{ padding: '20px', borderTop: '1px solid #374151' }}>
          <button onClick={handleLogout} style={{ width: '100%', padding: '12px 15px', backgroundColor: 'transparent', color: '#ef4444', border: 'none', borderRadius: '8px', textAlign: 'left', fontWeight: 'bold', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            🚪 Sign Out
          </button>
        </div>
      </div>

      {/* 2. MAIN CONTENT AREA */}
      <div style={{ flexGrow: 1, overflowY: 'auto', padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '100%', maxWidth: '900px' }}>
          
          {/* Header Row: Title & Toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '35px', flexWrap: 'wrap', gap: '20px' }}>
            <div>
              {/* NEW: Store Dropdown Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <select 
                  value={activeStore.id} 
                  onChange={(e) => setActiveStore(stores.find(s => s.id === e.target.value))}
                  style={{ margin: 0, fontSize: '32px', color: '#111827', fontWeight: '900', border: 'none', backgroundColor: 'transparent', outline: 'none', cursor: 'pointer', padding: 0 }}
                >
                  {stores.map(s => (
                    <option key={s.id} value={s.id}>{s.store_name}</option>
                  ))}
                </select>
                
                {/* Dynamic Role Badge */}
                <span style={{ fontSize: '11px', fontWeight: '900', letterSpacing: '0.5px', padding: '4px 8px', borderRadius: '8px', backgroundColor: activeStore.role === 'merchant' ? '#dbeafe' : '#f3f4f6', color: activeStore.role === 'merchant' ? '#1d4ed8' : '#4b5563' }}>
                  {activeStore.role === 'merchant' ? 'OWNER' : 'STAFF'}
                </span>
              </div>

              <p style={{ margin: '5px 0 0 0', color: '#6b7280', fontSize: '15px' }}>Manage your menu and store availability.</p>
            </div>
            
            {/* Smooth Animated Toggle Switch */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', backgroundColor: 'white', padding: '12px 20px', borderRadius: '50px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', border: '1px solid #e5e7eb' }}>
              <span style={{ fontWeight: '800', fontSize: '14px', color: activeStore.is_open ? '#10b981' : '#9ca3af', transition: 'color 0.3s' }}>OPEN</span>
              
              <div onClick={toggleStoreStatus} style={{ width: '64px', height: '32px', backgroundColor: activeStore.is_open ? '#10b981' : '#d1d5db', borderRadius: '32px', padding: '4px', cursor: 'pointer', transition: 'background-color 0.3s', boxSizing: 'border-box' }}>
                <div style={{ width: '24px', height: '24px', backgroundColor: 'white', borderRadius: '50%', transform: activeStore.is_open ? 'translateX(32px)' : 'translateX(0)', transition: 'transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
              </div>
              
              <span style={{ fontWeight: '800', fontSize: '14px', color: !activeStore.is_open ? '#ef4444' : '#9ca3af', transition: 'color 0.3s' }}>CLOSED</span>
            </div>
          </div>

          {/* Add New Item Card */}
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f3f4f6', marginBottom: '30px' }}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#111827', fontWeight: '800' }}>Add New Item to Menu</h2>
            <form onSubmit={handleAddItem} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                <div style={{ flex: '2 1 200px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#4b5563', marginBottom: '6px' }}>Item Name</label>
                  <input type="text" required value={newItem.name} onChange={(e) => setNewItem({...newItem, name: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px', outline: 'none', fontSize: '14px', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: '1 1 100px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#4b5563', marginBottom: '6px' }}>Price (₱)</label>
                  <input type="number" step="0.01" required value={newItem.price} onChange={(e) => setNewItem({...newItem, price: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px', outline: 'none', fontSize: '14px', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#4b5563', marginBottom: '6px' }}>Description (Optional)</label>
                <input type="text" value={newItem.description} onChange={(e) => setNewItem({...newItem, description: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px', outline: 'none', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', padding: '15px', backgroundColor: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: '8px', flexWrap: 'wrap', gap: '15px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#4b5563', marginBottom: '6px' }}>Item Photo</label>
                  <input id="image-upload" type="file" accept="image/*" onChange={(e) => setNewItem({...newItem, imageFile: e.target.files[0]})} style={{ fontSize: '13px', color: '#6b7280' }} />
                </div>
                <button type="submit" disabled={isUploading} style={{ padding: '12px 24px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', fontSize: '14px', cursor: isUploading ? 'not-allowed' : 'pointer', opacity: isUploading ? 0.7 : 1, transition: 'background-color 0.2s' }}>
                  {isUploading ? 'Uploading...' : '+ Add Item to Menu'}
                </button>
              </div>
            </form>
          </div>

          {/* Inventory List Card */}
          <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f3f4f6', overflow: 'hidden' }}>
            <div style={{ padding: '20px 30px', backgroundColor: '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
              <h2 style={{ margin: 0, fontSize: '18px', color: '#111827', fontWeight: '800' }}>Current Inventory</h2>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {items.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic' }}>Your menu is empty. Add an item above to get started!</div>
              ) : (
                items.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 30px', borderBottom: '1px solid #f3f4f6', transition: 'background-color 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fdfdbf0a'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}>
                    
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.item_name} style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
                      ) : (
                        <div style={{ width: '64px', height: '64px', backgroundColor: '#f3f4f6', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '24px' }}>🍽️</div>
                      )}
                      <div>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#1f2937', fontWeight: '700' }}>{item.item_name}</h4>
                        <p style={{ margin: 0, color: '#6b7280', fontSize: '13px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description || 'No description provided.'}</p>
                      </div>
                    </div>
                    
                    <div style={{ fontSize: '18px', fontWeight: '900', color: '#10b981', backgroundColor: '#ecfdf5', padding: '8px 16px', borderRadius: '20px' }}>
                      ₱{parseFloat(item.price).toFixed(2)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}