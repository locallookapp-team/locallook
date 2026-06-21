import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import Cropper from 'react-easy-crop';
import { supabase } from '../supabaseClient';

const MAPBOX_TOKEN = (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_MAPBOX_TOKEN : '') || '';
if (MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
}

const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

const getCroppedImg = async (imageSrc, pixelCrop) => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) return null;

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);

  return new Promise((resolve) => {
    canvas.toBlob((file) => {
      if (file) resolve(new File([file], "cropped-image.jpg", { type: "image/jpeg" }));
    }, 'image/jpeg', 0.9);
  });
};

export default function DashboardPage() {
  const navigate = useNavigate();
  
  const [user, setUser] = useState(null);
  const [displayName, setDisplayName] = useState(''); 
  const [stores, setStores] = useState([]);
  const [activeStore, setActiveStore] = useState(null);
  const [items, setItems] = useState([]);
  const [storeOperators, setStoreOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('dashboard'); 

  const [newItem, setNewItem] = useState({ name: '', description: '', price: '', category: 'General', imageFile: null });
  const [isUploading, setIsUploading] = useState(false);
  
  const [imageToCrop, setImageToCrop] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [croppedPreview, setCroppedPreview] = useState(null);

  const [storeTheme, setStoreTheme] = useState({ primaryColor: '#3b82f6', layout: 'grid' });
  const [isSavingTheme, setIsSavingTheme] = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null); 

  const [newStoreData, setNewStoreData] = useState({ store_name: '', store_category: 'Food & Dining', lat: '', lng: '' });

  const mapContainer = useRef(null);
  const map = useRef(null);
  const newPinRef = useRef(null);

  useEffect(() => {
    const initDashboard = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
        return;
      }
      const currentUser = session.user;
      setUser(currentUser);
      
      const nameToDisplay = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email;
      setDisplayName(nameToDisplay);

      fetchStores(currentUser.id);
    };
    initDashboard();
  }, [navigate]);

  const fetchStores = async (userId) => {
    try {
      const res = await fetch(`https://locallook-api.onrender.com/api/merchant/stores/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setStores(data);
        if (data.length > 0 && !activeStore) setActiveStore(data[0]); 
      }
    } catch (err) {
      console.error("Failed to fetch stores:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeStore?.id) {
      fetch(`https://locallook-api.onrender.com/api/stores/${activeStore.id}`)
        .then(res => res.json())
        .then(data => { if (data.theme_settings) setStoreTheme(data.theme_settings); })
        .catch(err => console.error(err));

      fetch(`https://locallook-api.onrender.com/api/stores/${activeStore.id}/items`)
        .then(res => res.json())
        .then(data => setItems(data))
        .catch(err => console.error(err));

      fetch(`https://locallook-api.onrender.com/api/stores/${activeStore.id}/operators`)
        .then(res => res.ok ? res.json() : [])
        .then(data => setStoreOperators(data))
        .catch(err => console.error("Failed to fetch operators", err));
    }
  }, [activeStore?.id]);

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
    
    return () => {
      if (view !== 'add_store' && map.current) {
        map.current.remove();
        map.current = null;
        newPinRef.current = null;
      }
    };
  }, [view]);

  const onFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.readAsDataURL(e.target.files[0]);
      reader.onload = () => setImageToCrop(reader.result); 
      e.target.value = null; 
    }
  };

  const onCropComplete = (croppedArea, croppedAreaPixels) => setCroppedAreaPixels(croppedAreaPixels);

  const handleSaveCrop = async () => {
    try {
      const croppedFile = await getCroppedImg(imageToCrop, croppedAreaPixels);
      setNewItem({ ...newItem, imageFile: croppedFile });
      setCroppedPreview(URL.createObjectURL(croppedFile));
      setImageToCrop(null); 
    } catch (e) {
      alert("Error cropping image");
      console.error(e);
    }
  };

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

  const handleSaveTheme = async () => {
    setIsSavingTheme(true);
    try {
      const response = await fetch(`https://locallook-api.onrender.com/api/stores/${activeStore.id}/theme`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theme_settings: storeTheme })
      });
      if (!response.ok) throw new Error("Failed to save theme");
      alert("Storefront theme updated successfully!");
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSavingTheme(false);
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    let finalImageUrl = null;

    if (newItem.imageFile) {
      const fileExt = newItem.imageFile.name.split('.').pop() || 'jpg';
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
      body: JSON.stringify({ 
        store_id: activeStore.id, item_name: newItem.name, description: newItem.description, 
        price: parseFloat(newItem.price), image_url: finalImageUrl, item_category: newItem.category
      })
    });
    
    if (response.ok) {
      const addedItem = await response.json();
      setItems([addedItem, ...items]);
      setNewItem({ name: '', description: '', price: '', category: 'General', imageFile: null });
      setCroppedPreview(null);
    }
    setIsUploading(false);
  };

  const handleInviteOperator = async (e) => {
    e.preventDefault();
    setIsInviting(true);
    setInviteMessage(null); 
    try {
      const response = await fetch(`https://locallook-api.onrender.com/api/stores/${activeStore.id}/invite`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: inviteEmail, requester_id: user.id })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to invite operator");
      
      setInviteMessage({ type: 'success', text: 'Invite sent successfully!' });
      setStoreOperators([...storeOperators, { email: inviteEmail, status: 'pending', role: 'operator' }]);
      setInviteEmail(''); 
    } catch (err) {
      setInviteMessage({ type: 'error', text: err.message });
    } finally {
      setIsInviting(false);
      setTimeout(() => setInviteMessage(null), 6000);
    }
  };

  const handleCreateStore = async (e) => {
    e.preventDefault();
    if (!newStoreData.lat || !newStoreData.lng) return alert("Please drop a pin on the map!");
    setIsUploading(true);
    try {
      const response = await fetch('https://locallook-api.onrender.com/api/stores', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newStoreData, user_id: user.id })
      });
      if (!response.ok) throw new Error("Failed to create store");
      await fetchStores(user.id);
      setView('dashboard');
      setNewStoreData({ store_name: '', store_category: 'Food & Dining', lat: '', lng: '' });
    } catch (err) {
      alert(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const toggleMenu = (staffId) => setOpenMenuId(openMenuId === staffId ? null : staffId);

  const handleRemoveStaff = async (staffId, staffEmail) => {
    if (!window.confirm(`Are you sure you want to remove ${staffEmail} from this store?`)) return;
    try {
      const response = await fetch(`https://locallook-api.onrender.com/api/stores/${activeStore.id}/staff/${staffId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error("Failed to remove staff");
      
      alert(`${staffEmail} has been removed.`);
      setStoreOperators(storeOperators.filter(op => op.id !== staffId));
      setOpenMenuId(null);
    } catch (error) {
      alert("Error: " + error.message);
    }
  };

  if (loading) return <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center' }}>Loading...</div>;

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#f3f4f6', fontFamily: 'sans-serif', overflow: 'hidden' }}>
      
      {imageToCrop && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ position: 'relative', flexGrow: 1 }}>
            <Cropper image={imageToCrop} crop={crop} zoom={zoom} aspect={4 / 3} onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom} />
          </div>
          <div style={{ padding: '20px', backgroundColor: 'white', display: 'flex', justifyContent: 'center', gap: '20px', alignItems: 'center' }}>
            <button onClick={() => setImageToCrop(null)} style={{ padding: '10px 20px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
            <input type="range" value={zoom} min={1} max={3} step={0.1} aria-labelledby="Zoom" onChange={(e) => setZoom(e.target.value)} style={{ width: '200px' }} />
            <button onClick={handleSaveCrop} style={{ padding: '10px 20px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Save 4:3 Crop</button>
          </div>
        </div>
      )}

      {/* 1. SIDEBAR */}
      <div style={{ width: '280px', backgroundColor: '#1f2937', color: 'white', display: 'flex', flexDirection: 'column', boxShadow: '4px 0 15px rgba(0,0,0,0.1)', zIndex: 10 }}>
        <div style={{ padding: '25px 20px', borderBottom: '1px solid #374151' }}>
          <h2 style={{ margin: '0', fontSize: '24px', color: '#3b82f6', fontWeight: '900' }}>LocalLook</h2>
          <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 'bold', letterSpacing: '2px' }}>MERCHANT HUB</span>
          <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#374151', padding: '10px', borderRadius: '8px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#60a5fa', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#1e3a8a', fontWeight: '900', fontSize: '16px' }}>
              {displayName ? displayName.charAt(0).toUpperCase() : '?'}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '14px', color: '#f3f4f6', fontWeight: 'bold', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{displayName}</div>
              <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 'bold', letterSpacing: '0.5px' }}>{activeStore ? activeStore.role.toUpperCase() : 'MERCHANT'}</div>
            </div>
          </div>
        </div>
        
        <div style={{ flexGrow: 1, padding: '20px 15px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#6b7280', marginBottom: '5px', paddingLeft: '5px' }}>YOUR STORES</div>
          {stores.map(s => (
            <button 
              key={s.id} onClick={() => { setActiveStore(s); setView('dashboard'); }}
              style={{ width: '100%', padding: '12px 15px', backgroundColor: activeStore?.id === s.id && view === 'dashboard' ? '#374151' : 'transparent', color: 'white', border: 'none', borderRadius: '8px', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {s.store_name}
            </button>
          ))}
          <button onClick={() => setView('add_store')} style={{ width: '100%', padding: '12px 15px', marginTop: '10px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', border: '1px dashed #3b82f6', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>+ Add a Store</button>
        </div>

        <div style={{ padding: '20px', borderTop: '1px solid #374151' }}>
          <button onClick={handleLogout} style={{ width: '100%', padding: '12px', backgroundColor: 'transparent', color: '#ef4444', border: 'none', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer' }}>🚪 Sign Out</button>
        </div>
      </div>

      {/* 2. MAIN CONTENT AREA */}
      <div style={{ flexGrow: 1, overflowY: 'auto', position: 'relative' }}>
        {view === 'add_store' && (
          <div style={{ display: 'flex', height: '100%' }}>
            <div style={{ width: '350px', padding: '40px 30px', backgroundColor: 'white', boxShadow: '5px 0 15px rgba(0,0,0,0.05)', zIndex: 2 }}>
              <h2 style={{ marginTop: 0, color: '#1f2937' }}>Register Location</h2>
              <form onSubmit={handleCreateStore} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
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
            <div style={{ flexGrow: 1, position: 'relative' }}><div ref={mapContainer} style={{ position: 'absolute', inset: 0 }} /></div>
          </div>
        )}

        {view === 'dashboard' && activeStore && (
          <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '100%', maxWidth: '900px' }}>
              
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

              {activeStore.role === 'merchant' && (
                <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, backgroundColor: 'white', padding: '25px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f3f4f6', minWidth: '300px' }}>
                    <h3 style={{ margin: '0 0 15px 0', color: '#111827', fontSize: '16px' }}>🎨 Storefront Branding</h3>
                    <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#6b7280', marginBottom: '5px' }}>BRAND COLOR</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <input type="color" value={storeTheme.primaryColor} onChange={(e) => setStoreTheme({...storeTheme, primaryColor: e.target.value})} style={{ width: '40px', height: '40px', padding: 0, border: 'none', borderRadius: '8px', cursor: 'pointer' }} />
                          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#374151' }}>{storeTheme.primaryColor.toUpperCase()}</span>
                        </div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#6b7280', marginBottom: '5px' }}>MENU LAYOUT</label>
                        <select value={storeTheme.layout} onChange={(e) => setStoreTheme({...storeTheme, layout: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: '#f9fafb', fontSize: '14px' }}>
                          <option value="grid">Grid Cards</option>
                          <option value="list">Compact List</option>
                        </select>
                      </div>
                    </div>
                    <button onClick={handleSaveTheme} disabled={isSavingTheme} style={{ width: '100%', padding: '10px', backgroundColor: '#111827', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: isSavingTheme ? 'not-allowed' : 'pointer' }}>
                      {isSavingTheme ? 'Saving...' : 'Save Theme'}
                    </button>
                  </div>

                  <div style={{ flex: 1, backgroundColor: '#eff6ff', padding: '25px', borderRadius: '16px', border: '1px dashed #93c5fd', minWidth: '300px' }}>
                    <h3 style={{ margin: '0 0 10px 0', color: '#1e3a8a', fontSize: '16px' }}>🛡️ Operator Access</h3>
                    <p style={{ margin: '0 0 15px 0', color: '#3b82f6', fontSize: '13px' }}>Invite staff to manage inventory and open/close status.</p>
                    
                    <form onSubmit={handleInviteOperator} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                      <input type="email" placeholder="Staff Email Address" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} style={{ padding: '10px 15px', borderRadius: '8px', border: '1px solid #bfdbfe', flexGrow: 1, outline: 'none' }} />
                      <button type="submit" disabled={isInviting} style={{ padding: '10px 20px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: isInviting ? 'not-allowed' : 'pointer' }}>
                        {isInviting ? 'Sending...' : 'Invite'}
                      </button>
                    </form>
                    
                    {inviteMessage && (
                      <div style={{ fontSize: '13px', fontWeight: 'bold', padding: '8px 12px', borderRadius: '6px', marginBottom: '10px', backgroundColor: inviteMessage.type === 'success' ? '#d1fae5' : '#fee2e2', color: inviteMessage.type === 'success' ? '#059669' : '#dc2626' }}>
                        {inviteMessage.type === 'success' ? '✅ ' : '❌ '} {inviteMessage.text}
                      </div>
                    )}

                    {/* STAFF/OPERATOR LIST (Simplified) */}
                    {storeOperators.length > 0 && (
                      <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#60a5fa' }}>CURRENT STAFF</span>
                        
                        {storeOperators.map((op, idx) => (
                          <div key={op.id || idx} style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: '8px 12px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                            <span style={{ fontSize: '13px', color: '#1e3a8a', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis' }}>{op.email}</span>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '12px', backgroundColor: op.status === 'pending' ? '#fef3c7' : '#d1fae5', color: op.status === 'pending' ? '#d97706' : '#059669', fontWeight: 'bold' }}>
                                {op.status === 'pending' ? 'PENDING' : 'STAFF'}
                              </span>

                              {op.status !== 'pending' && (
                                <button onClick={() => toggleMenu(op.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#60a5fa', padding: '0', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '50%', transition: 'background-color 0.2s' }}>
                                  ⋮
                                </button>
                              )}
                            </div>

                            {openMenuId === op.id && (
                              <div style={{ position: 'absolute', right: '10px', top: '40px', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 50, width: '160px', overflow: 'hidden' }}>
                                <button onClick={() => handleRemoveStaff(op.id, op.email)} style={{ display: 'block', width: '100%', padding: '10px 15px', border: 'none', background: 'white', textAlign: 'left', cursor: 'pointer', fontSize: '13px', color: '#ef4444', fontWeight: '600', transition: 'background-color 0.2s' }}>
                                  Remove Staff
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
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
                  
                  <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                    <div style={{ flex: '2 1 200px' }}><input type="text" placeholder="Description (Optional)" value={newItem.description} onChange={(e) => setNewItem({...newItem, description: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px', boxSizing: 'border-box' }} /></div>
                    <div style={{ flex: '1 1 150px' }}>
                      <input type="text" list="category-suggestions" placeholder="Category (e.g., Coffee)" required value={newItem.category} onChange={(e) => setNewItem({...newItem, category: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px', boxSizing: 'border-box' }} />
                      <datalist id="category-suggestions">
                        <option value="General" /><option value="Hot Drinks" /><option value="Cold Drinks" /><option value="Desserts" /><option value="Main Course" />
                      </datalist>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', padding: '15px', backgroundColor: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: '8px', flexWrap: 'wrap', gap: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      {croppedPreview ? (
                        <div style={{ position: 'relative' }}>
                          <img src={croppedPreview} alt="Preview" style={{ width: '120px', height: '90px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #d1d5db' }} />
                          <button type="button" onClick={() => { setCroppedPreview(null); setNewItem({...newItem, imageFile: null}) }} style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>×</button>
                        </div>
                      ) : (
                        <div>
                          <label htmlFor="image-upload" style={{ display: 'inline-block', padding: '8px 16px', backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', color: '#4b5563' }}>📸 Choose Image</label>
                          <input id="image-upload" type="file" accept="image/*" onChange={onFileSelect} style={{ display: 'none' }} />
                        </div>
                      )}
                      {!croppedPreview && <span style={{ fontSize: '12px', color: '#9ca3af' }}>Formats to 4:3 Landscape</span>}
                    </div>
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
                          {item.image_url ? <img src={item.image_url} alt={item.item_name} style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '8px' }} /> : <div style={{ width: '80px', height: '60px', backgroundColor: '#f3f4f6', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '20px' }}>🍽️</div>}
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#1f2937' }}>{item.item_name}</h4>
                              <span style={{ fontSize: '10px', padding: '2px 6px', backgroundColor: '#e5e7eb', color: '#4b5563', borderRadius: '4px', fontWeight: 'bold' }}>{item.item_category}</span>
                            </div>
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