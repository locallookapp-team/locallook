import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import Cropper from 'react-easy-crop';
import { supabase } from '../supabaseClient';
import { MdDragIndicator, MdSmartphone } from "react-icons/md";

import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';

const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) 
  ? import.meta.env.VITE_API_URL 
  : 'https://locallook-api.onrender.com';

const MAPBOX_TOKEN = (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_MAPBOX_TOKEN : '') || '';
if (MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
}

const fetchAddressFromCoords = async (lng, lat) => {
  if (!MAPBOX_TOKEN) return '';
  try {
    const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}`);
    const data = await res.json();
    return data.features?.[0]?.place_name || '';
  } catch (e) {
    console.error("Geocoding error:", e);
    return '';
  }
};

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

const getStoreCoverImage = (store) => {
  if (store.cover_image_url) return store.cover_image_url;
  switch (store.store_category) {
    case 'Food & Dining': return 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80';
    case 'Retail': return 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&q=80';
    case 'Services': return 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1200&q=80';
    case 'Groceries': return 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&q=80';
    default: return 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80';
  }
};

function SortableCategory({ id, activeCategory, brandColor, onClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : 1, position: 'relative' };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <button onClick={() => onClick(id)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 16px', borderRadius: '20px', whiteSpace: 'nowrap', border: 'none', fontWeight: 'bold', fontSize: '13px', transition: isDragging ? 'none' : 'background-color 0.2s, color 0.2s, box-shadow 0.2s', backgroundColor: activeCategory === id ? brandColor : 'white', color: activeCategory === id ? 'white' : '#475569', boxShadow: isDragging ? '0 10px 25px rgba(0,0,0,0.15)' : (activeCategory === id ? `0 4px 10px ${brandColor}40` : '0 1px 3px rgba(0,0,0,0.1)'), cursor: isDragging ? 'grabbing' : 'grab', opacity: isDragging ? 0.95 : 1, touchAction: 'none' }}>
        <MdDragIndicator size={18} style={{ opacity: 0.7, marginLeft: '-4px' }} />
        {id}
      </button>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  
  const [user, setUser] = useState(null);
  const [stores, setStores] = useState([]);
  const [activeStore, setActiveStore] = useState(null);
  
  // 🚀 NEW: Horizontal Tab State
  const [activeTab, setActiveTab] = useState('menu'); // 'menu', 'settings', 'staff', 'preview'

  const [items, setItems] = useState([]);
  const [storeOperators, setStoreOperators] = useState([]);
  const [loading, setLoading] = useState(true);

  const [editStoreData, setEditStoreData] = useState({ 
    id: '', store_name: '', store_category: '', description: '', phone: '', email: '', website: '', lat: '', lng: '', cover_image_url: '',
    showPhone: false, showEmail: false, showWebsite: false, showAddress: false, addressText: '', theme_settings: {} 
  });
  
  const [isDeleteStoreModalOpen, setIsDeleteStoreModalOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');

  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', description: '', price: '', category: '', imageFile: null });
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false); 
  const [editingItemId, setEditingItemId] = useState(null); 
  
  const [categoryOrder, setCategoryOrder] = useState([]);
  const [activeCategory, setActiveCategory] = useState('');
  
  const scrollContainerRef = useRef(null);
  const sectionRefs = useRef({});
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  
  const [imageToCrop, setImageToCrop] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [croppedPreview, setCroppedPreview] = useState(null);

  const [storeTheme, setStoreTheme] = useState({ primaryColor: '#2563EB', layout: 'grid' });
  const [isSavingTheme, setIsSavingTheme] = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null); 

  const [subscription, setSubscription] = useState({ plan_type: 'free', end_date: null });
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherLoading, setVoucherLoading] = useState(false);

  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const editMapContainer = useRef(null);
  const editMap = useRef(null);
  const editPinRef = useRef(null);
  const editStoreRef = useRef(editStoreData);
  useEffect(() => { editStoreRef.current = editStoreData; }, [editStoreData]);

  useEffect(() => {
    const initDashboard = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate('/login'); return; }
      setUser(session.user);
      fetchStores(session.user.id);
    };
    initDashboard();
  }, [navigate]);

  const fetchStores = async (userId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/merchant/stores/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setStores(data);
        if (data.length > 0 && !activeStore) setActiveStore(data[0]); 
      }
    } catch (err) { console.error("Failed to fetch stores:", err); } finally { setLoading(false); }
  };

  const fetchSubscription = async (storeId) => {
    try {
      const { data } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(); 
      if (data) setSubscription(data);
      else setSubscription({ plan_type: 'free', end_date: null });
    } catch (err) { console.error(err); }
  };

  // 🚀 Load active store data into the edit state automatically
  useEffect(() => {
    if (activeStore?.id) {
      fetch(`${API_BASE_URL}/api/stores/${activeStore.id}`)
        .then(res => res.json())
        .then(data => { 
          const theme = data.theme_settings || {};
          if (data.theme_settings) {
            setStoreTheme(data.theme_settings); 
            if (data.theme_settings.categoryOrder) setCategoryOrder(data.theme_settings.categoryOrder);
          }
          setEditStoreData({ 
            id: data.id, store_name: data.store_name, store_category: data.store_category, description: data.description || '', 
            phone: data.phone || '', email: data.email || '', website: data.website || '', lat: data.lat, lng: data.lng,
            cover_image_url: data.cover_image_url || '',
            showPhone: !!theme.showPhone, showEmail: !!theme.showEmail, showWebsite: !!theme.showWebsite, showAddress: !!theme.showAddress, 
            addressText: theme.addressText || '', theme_settings: theme
          });
        })
        .catch(err => console.error(err));

      fetch(`${API_BASE_URL}/api/stores/${activeStore.id}/items`)
        .then(res => res.json())
        .then(data => setItems(data))
        .catch(err => console.error(err));

      fetch(`${API_BASE_URL}/api/stores/${activeStore.id}/operators`)
        .then(res => res.ok ? res.json() : [])
        .then(data => setStoreOperators(data))
        .catch(err => console.error("Failed to fetch operators", err));
        
      fetchSubscription(activeStore.id);
      setActiveTab('menu'); // Reset to menu when switching stores
    }
  }, [activeStore?.id]);

  useEffect(() => {
    const uniqueCats = [...new Set(items.map(i => i.item_category || 'Uncategorized'))];
    setCategoryOrder(prevOrder => {
      const newOrder = [...prevOrder];
      uniqueCats.forEach(c => { if (!newOrder.includes(c)) newOrder.push(c); });
      return newOrder.filter(c => uniqueCats.includes(c)); 
    });
  }, [items]);

  // 🚀 Initialize Settings Map only when Settings Tab is active
  useEffect(() => {
    if (activeTab === 'settings' && editMapContainer.current && !editMap.current) {
      editMap.current = new mapboxgl.Map({
        container: editMapContainer.current, style: 'mapbox://styles/mapbox/streets-v12', center: [editStoreData.lng || 121.9823, editStoreData.lat || 12.3985], zoom: 15.5, pitch: 45,
      });
      
      if (editStoreData.lng && editStoreData.lat) {
        const el = document.createElement('div');
        el.innerHTML = `<div style="background-color: #2563eb; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.5); transform: translateY(-12px);"></div>`;
        editPinRef.current = new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat([editStoreData.lng, editStoreData.lat]).addTo(editMap.current);
      }

      editMap.current.on('click', async (e) => {
        const lng = e.lngLat.lng.toFixed(6); const lat = e.lngLat.lat.toFixed(6);
        let addressText = editStoreRef.current.addressText;
        if (editStoreRef.current.showAddress) addressText = await fetchAddressFromCoords(lng, lat);
        setEditStoreData(prev => ({ ...prev, lat, lng, addressText }));

        if (!editPinRef.current) {
          const el = document.createElement('div');
          el.innerHTML = `<div style="background-color: #2563eb; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.5); transform: translateY(-12px);"></div>`;
          editPinRef.current = new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat([lng, lat]).addTo(editMap.current);
        } else {
          editPinRef.current.setLngLat([lng, lat]);
        }
      });
    }

    return () => { if (activeTab !== 'settings' && editMap.current) { editMap.current.remove(); editMap.current = null; editPinRef.current = null; } };
  }, [activeTab, editStoreData.lng, editStoreData.lat]);

  const handleScroll = () => {
    if (activeTab !== 'menu' || !scrollContainerRef.current) return;
    const containerTop = scrollContainerRef.current.getBoundingClientRect().top;
    
    let currentActive = activeCategory; let minDistance = Infinity;
    categoryOrder.forEach(cat => {
      const el = sectionRefs.current[cat];
      if (el) {
        const distance = Math.abs(el.getBoundingClientRect().top - containerTop - 100); 
        if (distance < minDistance) { minDistance = distance; currentActive = cat; }
      }
    });
    if (currentActive !== activeCategory) setActiveCategory(currentActive);
  };

  const scrollToCategory = (cat) => {
    const el = sectionRefs.current[cat];
    const container = scrollContainerRef.current;
    if (el && container) { container.scrollTo({ top: el.offsetTop - 120, behavior: 'smooth' }); }
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setCategoryOrder((items) => arrayMove(items, items.indexOf(active.id), items.indexOf(over.id)));
    }
  };

  const onFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader(); reader.readAsDataURL(e.target.files[0]);
      reader.onload = () => setImageToCrop(reader.result); e.target.value = null; 
    }
  };
  const onCropComplete = (croppedArea, croppedAreaPixels) => setCroppedAreaPixels(croppedAreaPixels);
  const handleSaveCrop = async () => {
    try {
      const croppedFile = await getCroppedImg(imageToCrop, croppedAreaPixels);
      setNewItem({ ...newItem, imageFile: croppedFile });
      setCroppedPreview(URL.createObjectURL(croppedFile));
      setImageToCrop(null); 
    } catch (e) { console.error(e); }
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploadingCover(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${activeStore.id}-cover-${Math.random()}.${fileExt}`;
      const filePath = `${activeStore.id}/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('store-covers').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('store-covers').getPublicUrl(filePath);

      const response = await fetch(`${API_BASE_URL}/api/stores/${activeStore.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cover_image_url: publicUrl })
      });
      if (!response.ok) throw new Error("Failed to update store in database");

      setActiveStore({ ...activeStore, cover_image_url: publicUrl });
      setStores(stores.map(s => s.id === activeStore.id ? { ...s, cover_image_url: publicUrl } : s));
      alert("Cover photo updated successfully!");
    } catch (err) { alert("Error uploading cover: " + err.message); } finally { setIsUploadingCover(false); }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const toggleStoreStatus = async () => {
    const nextStatus = !activeStore.is_open;
    const response = await fetch(`${API_BASE_URL}/api/stores/${activeStore.id}/toggle`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_open: nextStatus }) });
    if (response.ok) {
      setActiveStore({ ...activeStore, is_open: nextStatus });
      setStores(stores.map(s => s.id === activeStore.id ? { ...s, is_open: nextStatus } : s));
    }
  };

  const handleUpdateSettings = async (e) => {
    e.preventDefault();
    if (!editStoreData.lat || !editStoreData.lng) return alert("Please drop a pin on the map!");
    setIsUploading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/stores/${editStoreData.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          store_name: editStoreData.store_name, store_category: editStoreData.store_category, description: editStoreData.description, 
          phone: editStoreData.phone, email: editStoreData.email, website: editStoreData.website, lat: editStoreData.lat, lng: editStoreData.lng,
          location: `POINT(${editStoreData.lng} ${editStoreData.lat})`
        })
      });

      if (response.ok) {
        const updatedStore = await response.json();
        const themeUpdate = { 
          ...storeTheme, categoryOrder, showPhone: editStoreData.showPhone, showEmail: editStoreData.showEmail, showWebsite: editStoreData.showWebsite, showAddress: editStoreData.showAddress, addressText: editStoreData.addressText 
        };
        await fetch(`${API_BASE_URL}/api/stores/${editStoreData.id}/theme`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theme_settings: themeUpdate }) });
        
        const fullyUpdatedStore = { ...updatedStore, theme_settings: themeUpdate };
        setStores(stores.map(s => s.id === fullyUpdatedStore.id ? { ...s, ...fullyUpdatedStore } : s));
        setActiveStore({ ...activeStore, ...fullyUpdatedStore });
        alert("Store settings saved successfully!");
      }
    } catch (err) { alert("Failed to save settings."); } finally { setIsUploading(false); }
  };

  const handleDeleteStore = async () => {
    if (deleteConfirmationText !== activeStore.store_name) return;
    setIsUploading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/stores/${activeStore.id}`, { method: 'DELETE' });
      if (response.ok) {
        const updatedStores = stores.filter(s => s.id !== activeStore.id);
        setStores(updatedStores);
        setActiveStore(updatedStores.length > 0 ? updatedStores[0] : null);
        setIsDeleteStoreModalOpen(false);
      }
    } catch (err) { alert("Failed to delete store."); } finally { setIsUploading(false); }
  };

  const handleRedeemVoucher = async () => { /* ... Keep existing code ... */ };
  const handleProceedToPayment = async () => { /* ... Keep existing code ... */ };

  const openAddModal = () => { setEditingItemId(null); setNewItem({ name: '', description: '', price: '', category: '', imageFile: null }); setCroppedPreview(null); setIsItemModalOpen(true); };
  const closeItemModal = () => { setIsItemModalOpen(false); setEditingItemId(null); setNewItem({ name: '', description: '', price: '', category: '', imageFile: null }); setCroppedPreview(null); };
  const startEditItem = (item) => { setEditingItemId(item.id); setNewItem({ name: item.item_name, description: item.description || '', price: item.price, category: item.item_category, imageFile: null }); setCroppedPreview(item.image_url || null); setIsItemModalOpen(true); };

  const handleAddItem = async (e) => {
    e.preventDefault(); setIsUploading(true); let finalImageUrl = null;
    if (newItem.imageFile) {
      const fileName = `${Math.random()}.${newItem.imageFile.name.split('.').pop() || 'jpg'}`;
      const filePath = `${activeStore.id}/${fileName}`;
      await supabase.storage.from('item-images').upload(filePath, newItem.imageFile);
      finalImageUrl = supabase.storage.from('item-images').getPublicUrl(filePath).data.publicUrl;
    }

    const payload = { item_name: newItem.name, description: newItem.description, price: parseFloat(newItem.price), image_url: finalImageUrl, item_category: newItem.category };
    if (editingItemId) {
      const response = await fetch(`${API_BASE_URL}/api/items/${editingItemId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (response.ok) { const updatedItem = await response.json(); setItems(items.map(i => i.id === editingItemId ? updatedItem : i)); closeItemModal(); }
    } else {
      const response = await fetch(`${API_BASE_URL}/api/items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ store_id: activeStore.id, ...payload }) });
      if (response.ok) { const addedItem = await response.json(); setItems([addedItem, ...items]); closeItemModal(); }
    }
    setIsUploading(false);
  };

  const handleDeleteItem = async (itemId, itemName) => {
    if (!window.confirm(`Delete "${itemName}" permanently?`)) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/items/${itemId}`, { method: 'DELETE' });
      if (response.ok) { setItems(items.filter(item => item.id !== itemId)); if (editingItemId === itemId) closeItemModal(); }
    } catch (err) { alert("Failed to delete item."); }
  };

  const handleInviteOperator = async (e) => {
    e.preventDefault(); setIsInviting(true); setInviteMessage(null); 
    try {
      const response = await fetch(`${API_BASE_URL}/api/stores/${activeStore.id}/invite`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: inviteEmail, requester_id: user.id }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Failed to invite operator");
      setInviteMessage({ type: 'success', text: data.message });
      setStoreOperators([...storeOperators, { email: inviteEmail, status: data.message.includes('Existing') ? 'confirmed' : 'pending', role: 'operator' }]);
      setInviteEmail(''); 
    } catch (err) { setInviteMessage({ type: 'error', text: err.message }); } finally { setIsInviting(false); setTimeout(() => setInviteMessage(null), 6000); }
  };

  const handleRemoveStaff = async (staffId, staffEmail) => {
    if (!window.confirm(`Remove ${staffEmail} from this store?`)) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/stores/${activeStore.id}/staff/${staffId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error("Failed to remove staff");
      setStoreOperators(storeOperators.filter(op => op.id !== staffId));
    } catch (error) { alert("Error: " + error.message); }
  };

  const groupedItems = items.reduce((groups, item) => {
    const category = item.item_category || 'Uncategorized';
    if (!groups[category]) groups[category] = [];
    groups[category].push(item);
    return groups;
  }, {});

  const isMenuLocked = subscription?.plan_type === 'free' || (subscription?.plan_type === 'premium' && subscription?.end_date && new Date(subscription.end_date) <= new Date());

  if (loading) return <div style={{ display: 'flex', height: '100%', justifyContent: 'center', alignItems: 'center' }}>Loading...</div>;
  if (!activeStore) return <div style={{ display: 'flex', height: '100%', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}><h2>No Stores Found</h2><button onClick={() => navigate('/create-business')}>Create One</button></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', backgroundColor: '#F8FAFC', fontFamily: 'Inter, sans-serif', overflowY: 'auto', position: 'relative' }}>
      
      {/* 🚀 KEEP EXISTING MODALS HERE (Cropper, Voucher, Upgrade, Items, Delete) */}
      {/* ... (Cropper Modal) ... */}
      {imageToCrop && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ position: 'relative', flexGrow: 1 }}><Cropper image={imageToCrop} crop={crop} zoom={zoom} aspect={4 / 3} onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom} /></div>
          <div style={{ padding: '20px', backgroundColor: 'white', display: 'flex', justifyContent: 'center', gap: '20px', alignItems: 'center' }}>
            <button onClick={() => setImageToCrop(null)} style={{ padding: '10px 20px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
            <input type="range" value={zoom} min={1} max={3} step={0.1} aria-labelledby="Zoom" onChange={(e) => setZoom(e.target.value)} style={{ width: '200px' }} />
            <button onClick={handleSaveCrop} style={{ padding: '10px 20px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Save Crop</button>
          </div>
        </div>
      )}

      {/* Delete Store Modal */}
      {isDeleteStoreModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '20px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h2 style={{ margin: '0 0 15px 0', fontSize: '20px', color: '#DC2626', fontWeight: '800' }}>⚠️ Delete Store</h2>
            <p style={{ margin: '0 0 20px 0', color: '#475569', fontSize: '14px', lineHeight: '1.5' }}>This action cannot be undone. This will permanently delete <strong>{activeStore.store_name}</strong> and all of its items.</p>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#64748B', marginBottom: '8px' }}>Type <strong style={{ color: '#0F172A' }}>{activeStore.store_name}</strong> to confirm:</label>
              <input type="text" value={deleteConfirmationText} onChange={(e) => setDeleteConfirmationText(e.target.value)} style={{ padding: '12px', border: '1px solid #E2E8F0', borderRadius: '10px', width: '100%', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setIsDeleteStoreModalOpen(false)} style={{ flex: 1, padding: '12px', backgroundColor: '#F1F5F9', color: '#475569', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleDeleteStore} disabled={deleteConfirmationText !== activeStore.store_name || isUploading} style={{ flex: 1, padding: '12px', backgroundColor: '#DC2626', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: deleteConfirmationText !== activeStore.store_name || isUploading ? 'not-allowed' : 'pointer', opacity: deleteConfirmationText !== activeStore.store_name ? 0.5 : 1 }}>{isUploading ? 'Deleting...' : 'Delete Store'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Item Modal */}
      {isItemModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '20px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', color: '#0F172A', fontWeight: '800' }}>{editingItemId ? '✏️ Edit Item' : '✨ Add New Item'}</h2>
              <button onClick={closeItemModal} style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '24px', cursor: 'pointer', lineHeight: '1' }}>&times;</button>
            </div>
            <form onSubmit={handleAddItem} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                <div style={{ flex: '2 1 200px' }}><input type="text" placeholder="Item Name" required value={newItem.name} onChange={(e) => setNewItem({...newItem, name: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #E2E8F0', borderRadius: '10px', boxSizing: 'border-box' }} /></div>
                <div style={{ flex: '1 1 100px' }}><input type="number" step="0.01" placeholder="Price (₱)" required value={newItem.price} onChange={(e) => setNewItem({...newItem, price: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #E2E8F0', borderRadius: '10px', boxSizing: 'border-box' }} /></div>
              </div>
              <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                <div style={{ flex: '2 1 200px' }}><input type="text" placeholder="Description (Optional)" value={newItem.description} onChange={(e) => setNewItem({...newItem, description: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #E2E8F0', borderRadius: '10px', boxSizing: 'border-box' }} /></div>
                <div style={{ flex: '1 1 150px' }}>
                  <input type="text" list="category-suggestions" placeholder="Category" required value={newItem.category} onChange={(e) => setNewItem({...newItem, category: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #E2E8F0', borderRadius: '10px', boxSizing: 'border-box' }} />
                  <datalist id="category-suggestions"><option value="General" /><option value="Appetizers" /><option value="Main Course" /><option value="Desserts" /><option value="Cold Drinks" /><option value="Services" /></datalist>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', padding: '15px', backgroundColor: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: '12px', flexWrap: 'wrap', gap: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  {croppedPreview ? (
                    <div style={{ position: 'relative' }}>
                      <img src={croppedPreview} alt="Preview" style={{ width: '120px', height: '90px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #E2E8F0' }} />
                      <button type="button" onClick={() => { setCroppedPreview(null); setNewItem({...newItem, imageFile: null}) }} style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#EF4444', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>×</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <div><label htmlFor="image-upload" style={{ display: 'inline-block', padding: '8px 12px', backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>🖼️ Upload Image</label><input id="image-upload" type="file" accept="image/*" onChange={onFileSelect} style={{ display: 'none' }} /></div>
                    </div>
                  )}
                </div>
                <button type="submit" disabled={isUploading} style={{ padding: '10px 24px', backgroundColor: editingItemId ? '#F59E0B' : '#2563EB', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: isUploading ? 'not-allowed' : 'pointer' }}>{isUploading ? 'Saving...' : (editingItemId ? 'Update Item' : 'Save New Item')}</button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* TOP HEADER: Store Selector */}
      <div style={{ backgroundColor: '#FFFFFF', padding: '16px 30px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', position: 'sticky', top: 0, zIndex: 40, boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#0F172A', paddingRight: '15px', borderRight: '1px solid #E2E8F0' }}>Hub</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            {stores.map(s => (
              <button key={s.id} onClick={() => setActiveStore(s)} style={{ padding: '8px 16px', borderRadius: '20px', backgroundColor: activeStore?.id === s.id ? '#2563EB' : 'transparent', color: activeStore?.id === s.id ? 'white' : '#64748B', border: activeStore?.id === s.id ? 'none' : '1px solid #E2E8F0', fontWeight: '600', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap' }}>
                {s.store_name}
              </button>
            ))}
            <button onClick={() => navigate('/create-business')} style={{ padding: '8px 16px', borderRadius: '20px', backgroundColor: '#EFF6FF', color: '#2563EB', border: '1px dashed #BFDBFE', fontWeight: '600', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              + Add Store
            </button>
          </div>
        </div>
        <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#EF4444', fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}>Sign Out</button>
      </div>


      {/* 🚀 MAIN CONTENT AREA */}
      <div ref={scrollContainerRef} onScroll={handleScroll} style={{ flexGrow: 1, padding: '30px', paddingBottom: '90px' }}>
        
        {/* HERO BANNER (Visible on all tabs) */}
        <div style={{ width: '100%', maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ width: '100%', height: '240px', borderRadius: '24px', overflow: 'hidden', backgroundImage: `url(${getStoreCoverImage(activeStore)})`, backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative', marginBottom: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)' }} />
            <div style={{ position: 'absolute', bottom: '20px', left: '30px', right: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '15px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h1 style={{ margin: 0, fontSize: '36px', color: 'white', fontWeight: '900', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>{activeStore.store_name}</h1>
                  {activeStore.role === 'operator' && <span style={{ padding: '4px 8px', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid #34d399', fontSize: '12px', fontWeight: 'bold', borderRadius: '6px' }}>STAFF MODE</span>}
                </div>
                <p style={{ margin: '5px 0 0 0', color: '#d1d5db', fontSize: '15px', fontWeight: 'bold' }}>{activeStore.store_category}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', backgroundColor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', padding: '12px 20px', borderRadius: '50px', border: '1px solid rgba(255,255,255,0.2)' }}>
                <span style={{ fontWeight: '800', fontSize: '14px', color: activeStore.is_open ? '#34d399' : '#d1d5db' }}>OPEN</span>
                <div onClick={toggleStoreStatus} style={{ width: '64px', height: '32px', backgroundColor: activeStore.is_open ? '#10b981' : 'rgba(255,255,255,0.3)', borderRadius: '32px', padding: '4px', cursor: 'pointer', boxSizing: 'border-box' }}>
                  <div style={{ width: '24px', height: '24px', backgroundColor: 'white', borderRadius: '50%', transform: activeStore.is_open ? 'translateX(32px)' : 'translateX(0)', transition: 'transform 0.3s' }} />
                </div>
                <span style={{ fontWeight: '800', fontSize: '14px', color: !activeStore.is_open ? '#ef4444' : '#d1d5db' }}>CLOSED</span>
              </div>
            </div>
          </div>

          {/* 🚀 NEW HORIZONTAL TABS */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', overflowX: 'auto', scrollbarWidth: 'none', borderBottom: '1px solid #E2E8F0', paddingBottom: '10px' }}>
            {['menu', 'settings', 'staff', 'preview'].map(tab => {
              if (tab === 'staff' && activeStore.role !== 'merchant') return null; // Only owners see staff tab
              if (tab === 'settings' && activeStore.role !== 'merchant') return null; 
              
              const labels = { menu: '🍔 Menu & Inventory', settings: '⚙️ Store Settings', staff: '👥 Staff Access', preview: '📱 Live Preview' };
              const isActive = activeTab === tab;
              
              return (
                <button 
                  key={tab} 
                  onClick={() => setActiveTab(tab)} 
                  style={{ padding: '10px 20px', borderRadius: '20px', backgroundColor: isActive ? '#0F172A' : 'transparent', color: isActive ? 'white' : '#64748B', border: 'none', fontWeight: '800', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s' }}
                >
                  {labels[tab]}
                </button>
              );
            })}
          </div>


          {/* 🚀 TAB 1: MENU & INVENTORY */}
          {activeTab === 'menu' && (
            <div style={{ position: 'relative' }}>
              
              {/* Keep existing subscription warning logic here */}
              {isMenuLocked && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 10, backgroundColor: 'rgba(248, 250, 252, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '20px', flexDirection: 'column' }}>
                  <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: '1px solid #E2E8F0', textAlign: 'center', maxWidth: '350px' }}>
                    <div style={{ fontSize: '40px', marginBottom: '10px' }}>🔒</div>
                    <h3 style={{ margin: '0 0 10px 0', color: '#0F172A', fontSize: '18px', fontWeight: '800' }}>Menu Locked</h3>
                    <button style={{ width: '100%', padding: '12px', backgroundColor: '#2563EB', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold' }}>Upgrade to Edit</button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: '0 0 0 0', fontSize: '20px', color: '#0F172A', fontWeight: '800' }}>Manage Items</h2>
                <button onClick={openAddModal} disabled={isMenuLocked} style={{ padding: '10px 20px', backgroundColor: isMenuLocked ? '#94A3B8' : '#2563EB', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: isMenuLocked ? 'not-allowed' : 'pointer' }}>+ Add Item</button>
              </div>

              {categoryOrder.length > 0 && (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToHorizontalAxis]}>
                  <div style={{ display: 'flex', gap: '10px', padding: '10px', marginBottom: '20px', overflowX: 'auto', backgroundColor: '#E2E8F0', borderRadius: '16px', position: 'sticky', top: '0px', zIndex: 5 }}>
                    <SortableContext items={categoryOrder} strategy={horizontalListSortingStrategy}>
                      {categoryOrder.map(cat => <SortableCategory key={cat} id={cat} activeCategory={activeCategory} brandColor={storeTheme.primaryColor} onClick={scrollToCategory} />)}
                    </SortableContext>
                  </div>
                </DndContext>
              )}

              <div style={{ backgroundColor: 'white', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {Object.keys(groupedItems).length === 0 ? (
                    <div style={{ padding: '60px 40px', textAlign: 'center', color: '#94A3B8', fontStyle: 'italic', fontWeight: '500' }}>Your menu is currently empty.</div>
                  ) : (
                    categoryOrder.map(category => {
                      if (!groupedItems[category]) return null;
                      return (
                        <div key={category} ref={(el) => (sectionRefs.current[category] = el)}>
                          <div style={{ padding: '12px 30px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', borderTop: '1px solid #E2E8F0' }}><h3 style={{ margin: '0', fontSize: '13px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>{category}</h3></div>
                          {groupedItems[category].map(item => (
                            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 30px', borderBottom: '1px solid #F8FAFC' }}>
                              <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                                {item.image_url ? <img src={item.image_url} alt={item.item_name} style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '10px' }} /> : <div style={{ width: '80px', height: '60px', backgroundColor: '#F1F5F9', borderRadius: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '20px' }}>🍽️</div>}
                                <div><h4 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#0F172A', fontWeight: '800' }}>{item.item_name}</h4><p style={{ margin: '0', color: '#64748B', fontSize: '13px', fontWeight: '500' }}>{item.description}</p></div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <div style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>₱{parseFloat(item.price).toFixed(2)}</div>
                                <div style={{ display: 'flex', gap: '5px', marginLeft: '10px' }}>
                                  <button onClick={() => startEditItem(item)} style={{ background: '#EFF6FF', color: '#2563EB', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}>✏️</button>
                                  <button onClick={() => handleDeleteItem(item.id, item.item_name)} style={{ background: '#FEF2F2', color: '#EF4444', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}>🗑️</button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          )}


          {/* 🚀 TAB 2: STORE SETTINGS (Combined Edit Modal + Branding) */}
          {activeTab === 'settings' && (
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              
              {/* Left Column: Form & Map */}
              <div style={{ flex: '1 1 500px', backgroundColor: 'white', padding: '30px', borderRadius: '20px', border: '1px solid #E2E8F0' }}>
                <h3 style={{ margin: '0 0 20px 0', color: '#0F172A', fontSize: '18px', fontWeight: '800' }}>Store Information</h3>
                
                <form onSubmit={handleUpdateSettings} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <input type="text" placeholder="Store Name" required value={editStoreData.store_name} onChange={(e) => setEditStoreData({...editStoreData, store_name: e.target.value})} style={{ padding: '12px', border: '1px solid #E2E8F0', borderRadius: '10px', width: '100%', boxSizing: 'border-box' }} />
                  <select value={editStoreData.store_category} onChange={(e) => setEditStoreData({...editStoreData, store_category: e.target.value})} style={{ padding: '12px', border: '1px solid #E2E8F0', borderRadius: '10px', width: '100%', boxSizing: 'border-box', backgroundColor: 'white' }}>
                    <option value="Food & Dining">Food & Dining</option><option value="Retail">Retail</option><option value="Services">Services</option><option value="Groceries">Groceries</option>
                  </select>
                  <textarea placeholder="Store Description (Optional)" value={editStoreData.description} onChange={(e) => setEditStoreData({...editStoreData, description: e.target.value})} style={{ padding: '12px', border: '1px solid #E2E8F0', borderRadius: '10px', width: '100%', boxSizing: 'border-box', minHeight: '80px', fontFamily: 'inherit' }} />
                  
                  <div style={{ padding: '15px', backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#374151' }}>Contact Details</h4>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', marginBottom: editStoreData.showPhone ? '10px' : '5px', fontWeight: 'bold' }}><input type="checkbox" checked={editStoreData.showPhone} onChange={(e) => setEditStoreData({...editStoreData, showPhone: e.target.checked})} /> Show Phone</label>
                    {editStoreData.showPhone && <input type="text" placeholder="Phone" value={editStoreData.phone} onChange={(e) => setEditStoreData({...editStoreData, phone: e.target.value})} style={{ padding: '10px', border: '1px solid #E2E8F0', borderRadius: '8px', width: '100%', boxSizing: 'border-box', marginBottom: '15px' }} />}
                    
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', marginBottom: editStoreData.showEmail ? '10px' : '5px', fontWeight: 'bold' }}><input type="checkbox" checked={editStoreData.showEmail} onChange={(e) => setEditStoreData({...editStoreData, showEmail: e.target.checked})} /> Show Email</label>
                    {editStoreData.showEmail && <input type="email" placeholder="Email" value={editStoreData.email} onChange={(e) => setEditStoreData({...editStoreData, email: e.target.value})} style={{ padding: '10px', border: '1px solid #E2E8F0', borderRadius: '8px', width: '100%', boxSizing: 'border-box', marginBottom: '15px' }} />}
                    
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', marginBottom: editStoreData.showAddress ? '10px' : '0', fontWeight: 'bold' }}><input type="checkbox" checked={editStoreData.showAddress} onChange={(e) => setEditStoreData({...editStoreData, showAddress: e.target.checked})} /> Show Address</label>
                    {editStoreData.showAddress && <input type="text" placeholder="Address" value={editStoreData.addressText} onChange={(e) => setEditStoreData({...editStoreData, addressText: e.target.value})} style={{ padding: '10px', border: '1px solid #E2E8F0', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }} />}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#64748B', marginBottom: '8px' }}>Location Pin (Drag map to move)</label>
                    <div style={{ position: 'relative', width: '100%', height: '250px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #E2E8F0' }}>
                      <div ref={editMapContainer} style={{ position: 'absolute', inset: 0 }} />
                    </div>
                  </div>

                  <button type="submit" disabled={isUploading} style={{ padding: '14px', backgroundColor: '#F59E0B', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: isUploading ? 'not-allowed' : 'pointer', marginTop: '10px' }}>
                    {isUploading ? 'Saving...' : 'Save Store Details'}
                  </button>
                </form>
              </div>

              {/* Right Column: Branding & Danger Zone */}
              <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '20px', border: '1px solid #E2E8F0' }}>
                  <h3 style={{ margin: '0 0 20px 0', color: '#0F172A', fontSize: '18px', fontWeight: '800' }}>🎨 Branding</h3>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#64748B', marginBottom: '8px' }}>COVER PHOTO</label>
                    <div style={{ height: '120px', borderRadius: '12px', backgroundImage: `url(${getStoreCoverImage(activeStore)})`, backgroundSize: 'cover', backgroundPosition: 'center', marginBottom: '10px', border: '1px solid #E2E8F0' }} />
                    <label style={{ display: 'inline-block', padding: '10px 16px', backgroundColor: '#F8FAFC', color: '#374151', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', cursor: isUploadingCover ? 'not-allowed' : 'pointer', border: '1px solid #E2E8F0' }}>
                      {isUploadingCover ? 'Uploading...' : '📷 Change Cover'}
                      <input type="file" accept="image/*" onChange={handleCoverUpload} disabled={isUploadingCover} style={{ display: 'none' }} />
                    </label>
                  </div>
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#64748B', marginBottom: '5px' }}>BRAND COLOR</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input type="color" value={storeTheme.primaryColor} onChange={(e) => setStoreTheme({...storeTheme, primaryColor: e.target.value})} style={{ width: '40px', height: '40px', padding: 0, border: 'none', borderRadius: '10px', cursor: 'pointer' }} />
                        <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#374151' }}>{storeTheme.primaryColor.toUpperCase()}</span>
                    </div>
                  </div>
                </div>

                <div style={{ backgroundColor: '#FEF2F2', padding: '30px', borderRadius: '20px', border: '1px dashed #FCA5A5' }}>
                  <h3 style={{ margin: '0 0 10px 0', color: '#DC2626', fontSize: '18px', fontWeight: '800' }}>Danger Zone</h3>
                  <p style={{ margin: '0 0 15px 0', color: '#991B1B', fontSize: '13px' }}>Permanently delete this store and all its inventory items.</p>
                  <button onClick={() => setIsDeleteStoreModalOpen(true)} style={{ padding: '10px 16px', backgroundColor: '#DC2626', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Delete Store</button>
                </div>

              </div>
            </div>
          )}


          {/* 🚀 TAB 3: STAFF ACCESS */}
          {activeTab === 'staff' && (
            <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '20px', border: '1px solid #E2E8F0' }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#0F172A', fontSize: '18px', fontWeight: '800' }}>🛡️ Operator Access</h3>
              <p style={{ margin: '0 0 20px 0', color: '#64748B', fontSize: '14px' }}>Invite trusted staff to manage inventory and open/close the store.</p>
              
              <form onSubmit={handleInviteOperator} style={{ display: 'flex', gap: '10px', marginBottom: '30px', maxWidth: '400px' }}>
                <input type="email" placeholder="Staff Email Address" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} style={{ padding: '12px 15px', borderRadius: '10px', border: '1px solid #CBD5E1', flexGrow: 1, outline: 'none' }} />
                <button type="submit" disabled={isInviting} style={{ padding: '12px 20px', backgroundColor: '#2563EB', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: isInviting ? 'not-allowed' : 'pointer' }}>{isInviting ? 'Sending...' : 'Invite'}</button>
              </form>
              
              {inviteMessage && <div style={{ fontSize: '13px', fontWeight: 'bold', padding: '12px', borderRadius: '10px', marginBottom: '20px', backgroundColor: inviteMessage.type === 'success' ? '#D1FAE5' : '#FEE2E2', color: inviteMessage.type === 'success' ? '#059669' : '#DC2626' }}>{inviteMessage.text}</div>}
              
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #E2E8F0', color: '#64748B', fontSize: '13px' }}>
                    <th style={{ padding: '12px 0' }}>User Email</th>
                    <th style={{ padding: '12px 0' }}>Status</th>
                    <th style={{ padding: '12px 0', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {storeOperators.map((op, idx) => (
                    <tr key={op.id || idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '16px 0', fontWeight: '600', color: '#0F172A' }}>{op.email}</td>
                      <td style={{ padding: '16px 0' }}>
                        <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '12px', backgroundColor: op.status === 'pending' ? '#FEF3C7' : '#D1FAE5', color: op.status === 'pending' ? '#D97706' : '#059669', fontWeight: 'bold' }}>
                          {op.status === 'pending' ? 'PENDING' : 'ACTIVE STAFF'}
                        </span>
                      </td>
                      <td style={{ padding: '16px 0', textAlign: 'right' }}>
                        {op.status !== 'pending' && <button onClick={() => handleRemoveStaff(op.id, op.email)} style={{ padding: '6px 12px', backgroundColor: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>Remove</button>}
                      </td>
                    </tr>
                  ))}
                  {storeOperators.length === 0 && (
                    <tr><td colSpan="3" style={{ padding: '20px 0', textAlign: 'center', color: '#94A3B8' }}>No staff members added yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}


          {/* 🚀 TAB 4: LIVE PREVIEW */}
          {activeTab === 'preview' && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', backgroundColor: '#F1F5F9', borderRadius: '24px', border: '1px dashed #CBD5E1' }}>
              
              {/* The Mobile Phone Mockup */}
              <div style={{ width: '375px', height: '700px', backgroundColor: 'white', borderRadius: '40px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '8px solid #0F172A', overflowY: 'auto', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                
                {/* Mobile Status Bar Fake */}
                <div style={{ height: '30px', width: '100%', backgroundColor: 'rgba(0,0,0,0.2)', position: 'absolute', top: 0, zIndex: 10, borderRadius: '32px 32px 0 0' }} />

                <div style={{ height: '200px', backgroundImage: `url(${getStoreCoverImage(activeStore)})`, backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative' }}>
                   <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)' }} />
                   <div style={{ position: 'absolute', bottom: '15px', left: '20px' }}>
                      <h2 style={{ color: 'white', margin: 0, fontSize: '24px', fontWeight: '900' }}>{activeStore.store_name}</h2>
                      <p style={{ color: '#E2E8F0', margin: 0, fontSize: '13px' }}>{activeStore.store_category}</p>
                   </div>
                </div>

                <div style={{ padding: '20px', flexGrow: 1, backgroundColor: '#F8FAFC' }}>
                   <p style={{ color: '#475569', fontSize: '14px', margin: '0 0 20px 0', lineHeight: '1.5' }}>{editStoreData.description || "No description provided."}</p>
                   
                   {/* Preview Category / Item */}
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                     <h3 style={{ margin: 0, fontSize: '16px', color: '#0F172A' }}>Menu Highlights</h3>
                     <span style={{ color: storeTheme.primaryColor, fontWeight: 'bold', fontSize: '13px' }}>View All</span>
                   </div>
                   
                   {items.slice(0, 3).map(item => (
                     <div key={item.id} style={{ display: 'flex', gap: '15px', padding: '15px', backgroundColor: 'white', borderRadius: '16px', marginBottom: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                        {item.image_url ? (
                           <img src={item.image_url} alt="item" style={{ width: '60px', height: '60px', borderRadius: '10px', objectFit: 'cover' }} />
                        ) : (
                           <div style={{ width: '60px', height: '60px', backgroundColor: '#F1F5F9', borderRadius: '10px' }} />
                        )}
                        <div style={{ flexGrow: 1 }}>
                           <h4 style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#0F172A' }}>{item.item_name}</h4>
                           <p style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: storeTheme.primaryColor }}>₱{item.price}</p>
                        </div>
                     </div>
                   ))}
                   {items.length === 0 && <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: '13px', marginTop: '40px' }}>No items uploaded yet.</p>}
                </div>
                
                {/* Fake floating action button colored with their brand color */}
                <div style={{ position: 'absolute', bottom: '20px', right: '20px', width: '50px', height: '50px', borderRadius: '25px', backgroundColor: storeTheme.primaryColor, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', boxShadow: `0 4px 10px ${storeTheme.primaryColor}80` }}>
                  <MdSmartphone size={24} />
                </div>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}