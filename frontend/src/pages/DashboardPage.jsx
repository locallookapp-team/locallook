import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '../supabaseClient';

const MAPBOX_TOKEN = (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_MAPBOX_TOKEN : '') || '';
if (MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  
  // Core State
  const [user, setUser] = useState(null);
  const [stores, setStores] = useState([]);
  const [activeStore, setActiveStore] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('dashboard'); // 'dashboard' or 'add_store'

  // Forms State
  const [newItem, setNewItem] = useState({ name: '', description: '', price: '', imageFile: null });
  const [isUploading, setIsUploading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [newStoreData, setNewStoreData] = useState({ store_name: '', store_category: 'Food & Dining', lat: '', lng: '' });

  // Mapbox Refs
  const mapContainer = useRef(null);
  const map = useRef(null);
  const newPinRef = useRef(null);

  // 1. AUTH & FETCH STORES
  useEffect(() => {
    const initDashboard = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
        return;
      }
      setUser(session.user);
      fetchStores(session.user.id);
    };
    initDashboard();
  }, [navigate]);

  const fetchStores = async (userId) => {
    try {
      const res = await fetch(`https://locallook-api.onrender.com/api/merchant/stores/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setStores(data);
        if (data.length > 0 && !activeStore) {
          setActiveStore(data[0]); // Default to first store
        }
      }
    } catch (err) {
      console.error("Failed to fetch stores:", err);
    } finally {
      setLoading(false);
    }
  };

  // 2. FETCH ITEMS WHEN ACTIVE STORE CHANGES
  useEffect(() => {
    if (activeStore?.id) {
      fetch(`https://locallook-api.onrender.com/api/stores/${activeStore.id}/items`)
        .then(res => res.json())
        .then(data => setItems(data))
        .catch(err => console.error(err));
    }
  }, [activeStore?.id]);

  // 3. MAPBOX LOGIC (Only runs when view === 'add_store')
  useEffect(() => {
    if (view === 'add_store' && mapContainer.current && !map.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [121.9823, 12.3985],
        zoom: 15.5,
        pitch: 45,
      });

      map.current.addControl(new mapboxgl.NavigationControl({ showZoom: false, visualizePitch: true }), 'bottom-right');

      map.current.on('click', (e) => {
        const lng = e.lngLat.lng.toFixed(6);
        const lat = e.lngLat.lat.toFixed(6);
        setNewStoreData(prev => ({ ...prev, lat, lng }));

        if (!newPinRef.current) {
          const el = document.createElement('div');
          el.innerHTML = `<div style="background-color: #2563eb; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.5); transform: translateY(-12px);"></div>`;
          newPinRef.current = new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat([lng, lat]).addTo(map.current);
        } else {
          newPinRef.current.setLngLat([lng, lat]);
        }
      });
    }
    
    // Cleanup map if we leave the add_store view
    return () => {
      if (view !== 'add_store' && map.current) {
        map.current.remove();
        map.current = null;
        newPinRef.current = null;
      }
    };
  }, [view]);

  // ==========================================
  // ACTIONS & HANDLERS
  // ==========================================

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const toggleStoreStatus = async () => {
    const nextStatus = !activeStore.is_open;
    const response = await fetch(`https://locallook-api.onrender.com/api/stores/${activeStore.id}/toggle`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_open: nextStatus })
    });
    if (response.ok) {
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
        setIsUploading(false); return;
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

  const handleInviteOperator = async (e) => {
    e.preventDefault();
    setIsInviting(true);
    try {
      const response = await fetch(`https://locallook-api.onrender.com/api/stores/${activeStore.id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, requester_id: user.id })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      
      alert("Invite sent securely! The operator can now log in.");
      setInviteEmail('');
    } catch (err) {
      alert("Failed to invite operator: " + err.message);
    } finally {
      setIsInviting(false);
    }
  };

  const handleCreateStore = async (e) => {
    e.preventDefault();
    if (!newStoreData.lat || !newStoreData.lng) return alert("Please drop a pin on the map!");
    setIsUploading(true);
    try {
      const response = await fetch('https://locallook-api.onrender.com/api/stores', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newStoreData, user_id: user.id })
      });
      if (!response.ok) throw new Error("Failed to create store");
      
      await fetchStores(user.id); // Refresh stores list
      setView('dashboard');
      setNewStoreData({ store_name: '', store_category: 'Food & Dining', lat: '', lng: '' });
    } catch (err) {
      alert(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) return <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center' }}>Loading...</div>;

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#f3f4f6', fontFamily: 'sans-serif', overflow: 'hidden' }}>
      
      {/* 1. SIDEBAR (The Hub Navigation) */}
      <div style={{ width: '280px', backgroundColor: '#1f2937', color: 'white', display: 'flex', flexDirection: 'column', boxShadow: '4px 0 15px rgba(0,0,0,0.1)', zIndex: 10 }}>
        <div style={{ padding: '25px 20px', borderBottom: '1px solid #374151' }}>
          <h2 style={{ margin: 0, fontSize: '24px', color: '#3b82f6', fontWeight: '900' }}>LocalLook</h2>
          <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 'bold', letterSpacing: '2px' }}>MERCHANT HUB</span>
        </div>
        
        <div style={{ flexGrow: 1, padding: '20px 15px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#6b7280', marginBottom: '5px', paddingLeft: '5px' }}>YOUR LOCATIONS</div>
          
          {stores.map(s => (
            <button 
              key={s.id} 
              onClick={() => { setActiveStore(s); setView('dashboard'); }}
              style={{ width: '100%', padding: '12px 15px', backgroundColor: activeStore?.id === s.id && view === 'dashboard' ? '#374151' : 'transparent', color: 'white', border: 'none', borderRadius: '8px', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>{s.store_name}</span>
              <span style={{ fontSize: '10px', padding: '3px 6px', borderRadius: '6px', backgroundColor: s.role === 'merchant' ? '#2563eb' : '#059669' }}>
                {s.role.toUpperCase()}
              </span>
            </button>
          ))}

          <button onClick={() => setView('add_store')} style={{ width: '100%', padding: '12px 15px', marginTop: '10px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', border: '1px dashed #3b82f6', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
            + Add a Store
          </button>
        </div>

        <div style={{ padding: '20px', borderTop: '1px solid #374151' }}>
          <button onClick={handleLogout} style={{ width: '100%', padding: '12px', backgroundColor: 'transparent', color: '#ef4444', border: 'none', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer' }}>🚪 Sign Out</button>
        </div>
      </div>

      {/* 2. MAIN CONTENT AREA */}
      <div style={{ flexGrow: 1, overflowY: 'auto', position: 'relative' }}>
        
        {/* VIEW A: CREATE A NEW STORE */}
        {view === 'add_store' && (
          <div style={{ display: 'flex', height: '100%' }}>
            <div style={{ width: '350px', padding: '40px 30px', backgroundColor: 'white', boxShadow: '5px 0 15px rgba(0,0,0,0.05)', zIndex: 2 }}>
              <h2 style={{ marginTop: 0, color: '#1f2937' }}>Register Location</h2>
              <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '25px' }}>Drop a pin on the map and enter your new store's details.</p>
              
              <form onSubmit={handleCreateStore} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <input type="text" placeholder="Store Name" required value={newStoreData.store_name} onChange={e => setNewStoreData({...newStoreData, store_name: e.target.value})} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db' }} />
                <select value={newStoreData.store_category} onChange={e => setNewStoreData({...newStoreData, store_category: e.target.value})} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: 'white' }}>
                  <option value="Food & Dining">Food & Dining</option>
                  <option value="Retail">Retail</option>
                  <option value="Services">Services</option>
                  <option value="Groceries">Groceries</option>
                </select>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input type="text" readOnly placeholder="Lat" value={newStoreData.lat} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb', flex: 1, backgroundColor: '#f3f4f6', fontSize: '12px' }} />
                  <input type="text" readOnly placeholder="Lng" value={newStoreData.lng} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb', flex: 1, backgroundColor: '#f3f4f6', fontSize: '12px' }} />
                </div>
                <button type="submit" disabled={isUploading} style={{ padding: '14px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}>
                  {isUploading ? 'Saving...' : 'Confirm Store'}
                </button>
              </form>
            </div>
            <div style={{ flexGrow: 1, position: 'relative' }}>
              <div ref={mapContainer} style={{ position: 'absolute', inset: 0 }} />
            </div>
          </div>
        )}

        {/* VIEW B: STORE DASHBOARD */}
        {view === 'dashboard' && !activeStore && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <div style={{ textAlign: 'center', color: '#6b7280' }}>
              <h2 style={{ color: '#1f2937' }}>Welcome to your Hub</h2>
              <p>You don't have any stores assigned yet. Click "Add a Store" to begin.</p>
            </div>
          </div>
        )}

        {view === 'dashboard' && activeStore && (
          <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '100%', maxWidth: '900px' }}>
              
              {/* Header & Toggle */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '35px', flexWrap: 'wrap', gap: '20px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h1 style={{ margin: 0, fontSize: '32px', color: '#111827', fontWeight: '900' }}>{activeStore.store_name}</h1>
                    {activeStore.role === 'operator' && <span style={{ padding: '4px 8px', backgroundColor: '#ecfdf5', color: '#059669', fontSize: '12px', fontWeight: 'bold', borderRadius: '6px' }}>STAFF MODE</span>}
                  </div>
                  <p style={{ margin: '5px 0 0 0', color: '#6b7280', fontSize: '15px' }}>{activeStore.store_category} • Manage your menu and availability.</p>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', backgroundColor: 'white', padding: '12px 20px', borderRadius: '50px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', border: '1px solid #e5e7eb' }}>
                  <span style={{ fontWeight: '800', fontSize: '14px', color: activeStore.is_open ? '#10b981' : '#9ca3af' }}>OPEN</span>
                  <div onClick={toggleStoreStatus} style={{ width: '64px', height: '32px', backgroundColor: activeStore.is_open ? '#10b981' : '#d1d5db', borderRadius: '32px', padding: '4px', cursor: 'pointer', boxSizing: 'border-box' }}>
                    <div style={{ width: '24px', height: '24px', backgroundColor: 'white', borderRadius: '50%', transform: activeStore.is_open ? 'translateX(32px)' : 'translateX(0)', transition: 'transform 0.3s' }} />
                  </div>
                  <span style={{ fontWeight: '800', fontSize: '14px', color: !activeStore.is_open ? '#ef4444' : '#9ca3af' }}>CLOSED</span>
                </div>
              </div>

              {/* RBAC: ONLY MERCHANTS CAN SEE THE INVITE PANEL */}
              {activeStore.role === 'merchant' && (
                <div style={{ backgroundColor: '#eff6ff', padding: '25px', borderRadius: '16px', border: '1px dashed #93c5fd', marginBottom: '30px' }}>
                  <h3 style={{ margin: '0 0 10px 0', color: '#1e3a8a', fontSize: '16px' }}>🛡️ Operator Access</h3>
                  <p style={{ margin: '0 0 15px 0', color: '#3b82f6', fontSize: '13px' }}>Invite staff to manage this store's inventory and open/close status. They cannot delete the store.</p>
                  <form onSubmit={handleInviteOperator} style={{ display: 'flex', gap: '10px' }}>
                    <input type="email" placeholder="Staff Email Address" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} style={{ padding: '10px 15px', borderRadius: '8px', border: '1px solid #bfdbfe', flexGrow: 1, outline: 'none' }} />
                    <button type="submit" disabled={isInviting} style={{ padding: '10px 20px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: isInviting ? 'not-allowed' : 'pointer' }}>
                      {isInviting ? 'Sending...' : 'Send Invite'}
                    </button>
                  </form>
                </div>
              )}

              {/* Add New Item Card */}
              <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f3f4f6', marginBottom: '30px' }}>
                <h2 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#111827', fontWeight: '800' }}>Add New Item</h2>
                <form onSubmit={handleAddItem} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                    <div style={{ flex: '2 1 200px' }}><input type="text" placeholder="Item Name" required value={newItem.name} onChange={(e) => setNewItem({...newItem, name: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px', boxSizing: 'border-box' }} /></div>
                    <div style={{ flex: '1 1 100px' }}><input type="number" step="0.01" placeholder="Price (₱)" required value={newItem.price} onChange={(e) => setNewItem({...newItem, price: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px', boxSizing: 'border-box' }} /></div>
                  </div>
                  <input type="text" placeholder="Description (Optional)" value={newItem.description} onChange={(e) => setNewItem({...newItem, description: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px', boxSizing: 'border-box' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', padding: '15px', backgroundColor: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: '8px', flexWrap: 'wrap', gap: '15px' }}>
                    <input id="image-upload" type="file" accept="image/*" onChange={(e) => setNewItem({...newItem, imageFile: e.target.files[0]})} style={{ fontSize: '13px', color: '#6b7280' }} />
                    <button type="submit" disabled={isUploading} style={{ padding: '10px 20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: isUploading ? 'not-allowed' : 'pointer' }}>
                      {isUploading ? 'Uploading...' : '+ Save Item'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Inventory List Card */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f3f4f6', overflow: 'hidden' }}>
                <div style={{ padding: '20px 30px', backgroundColor: '#f9fafb', borderBottom: '1px solid #f3f4f6' }}><h2 style={{ margin: 0, fontSize: '18px', color: '#111827', fontWeight: '800' }}>Current Inventory</h2></div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {items.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic' }}>Menu is empty.</div>
                  ) : (
                    items.map(item => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 30px', borderBottom: '1px solid #f3f4f6' }}>
                        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                          {item.image_url ? <img src={item.image_url} alt={item.item_name} style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '12px' }} /> : <div style={{ width: '64px', height: '64px', backgroundColor: '#f3f4f6', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '24px' }}>🍽️</div>}
                          <div>
                            <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#1f2937' }}>{item.item_name}</h4>
                            <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}>{item.description}</p>
                          </div>
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: '900', color: '#10b981', backgroundColor: '#ecfdf5', padding: '8px 16px', borderRadius: '20px' }}>₱{parseFloat(item.price).toFixed(2)}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}