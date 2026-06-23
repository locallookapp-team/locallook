import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import Cropper from 'react-easy-crop';
import { supabase } from '../supabaseClient';
import { MdDragIndicator, MdMoreVert } from "react-icons/md";

import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';

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

function SortableCategory({ id, activeCategory, brandColor, onClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : 1, position: 'relative' };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <button onClick={() => onClick(id)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 16px', borderRadius: '20px', whiteSpace: 'nowrap', border: 'none', fontWeight: 'bold', fontSize: '13px', transition: isDragging ? 'none' : 'background-color 0.2s, color 0.2s, box-shadow 0.2s', backgroundColor: activeCategory === id ? brandColor : 'white', color: activeCategory === id ? 'white' : '#4b5563', boxShadow: isDragging ? '0 10px 25px rgba(0,0,0,0.15)' : (activeCategory === id ? `0 4px 10px ${brandColor}40` : '0 1px 3px rgba(0,0,0,0.1)'), cursor: isDragging ? 'grabbing' : 'grab', opacity: isDragging ? 0.95 : 1, touchAction: 'none' }}>
        <MdDragIndicator size={18} style={{ opacity: 0.7, marginLeft: '-4px' }} />
        {id}
      </button>
    </div>
  );
}

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

  const [openStoreMenuId, setOpenStoreMenuId] = useState(null);
  const [isEditStoreModalOpen, setIsEditStoreModalOpen] = useState(false);
  const [editStoreData, setEditStoreData] = useState({ 
    id: '', store_name: '', store_category: '', description: '', phone: '', email: '', website: '', lat: '', lng: '',
    showPhone: false, showEmail: false, showWebsite: false, showAddress: false, addressText: '', theme_settings: {} 
  });
  
  const [isDeleteStoreModalOpen, setIsDeleteStoreModalOpen] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');

  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', description: '', price: '', category: '', imageFile: null });
  const [isUploading, setIsUploading] = useState(false);
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

  const [storeTheme, setStoreTheme] = useState({ primaryColor: '#3b82f6', layout: 'grid' });
  const [isSavingTheme, setIsSavingTheme] = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null); 

  const [newStoreData, setNewStoreData] = useState({ 
    store_name: '', store_category: 'Food & Dining', description: '', phone: '', email: '', website: '', lat: '', lng: '',
    showPhone: false, showEmail: false, showWebsite: false, showAddress: false, addressText: ''
  });

  const mapContainer = useRef(null);
  const map = useRef(null);
  const newPinRef = useRef(null);
  
  const newStoreRef = useRef(newStoreData);
  useEffect(() => { newStoreRef.current = newStoreData; }, [newStoreData]);

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
      setDisplayName(session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email);
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
        if (data.length > 0 && !activeStore) setActiveStore(data[0]); 
      }
    } catch (err) { console.error("Failed to fetch stores:", err); } finally { setLoading(false); }
  };

  useEffect(() => {
    if (activeStore?.id) {
      fetch(`https://locallook-api.onrender.com/api/stores/${activeStore.id}`)
        .then(res => res.json())
        .then(data => { 
          if (data.theme_settings) {
            setStoreTheme(data.theme_settings); 
            if (data.theme_settings.categoryOrder) setCategoryOrder(data.theme_settings.categoryOrder);
          }
        })
        .catch(err => console.error(err));

      fetch(`https://locallook-api.onrender.com/api/stores/${activeStore.id}/items`)
        .then(res => res.json())
        .then(data => setItems(data))
        .catch(err => console.error(err));

      fetch(`https://locallook-api.onrender.com/api/stores/${activeStore.id}/operators`)
        .then(res => res.ok ? res.json() : [])
        .then(data => setStoreOperators(data))
        .catch(err => console.error("Failed to fetch operators", err));
        
      closeItemModal();
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

  useEffect(() => {
    if (view === 'add_store' && mapContainer.current && !map.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current, style: 'mapbox://styles/mapbox/streets-v12', center: [121.9823, 12.3985], zoom: 15.5, pitch: 45,
      });
      map.current.addControl(new mapboxgl.NavigationControl({ showZoom: false, visualizePitch: true }), 'bottom-right');
      
      map.current.on('click', async (e) => {
        const lng = e.lngLat.lng.toFixed(6); const lat = e.lngLat.lat.toFixed(6);
        let addressText = newStoreRef.current.addressText;
        if (newStoreRef.current.showAddress) addressText = await fetchAddressFromCoords(lng, lat);

        setNewStoreData(prev => ({ ...prev, lat, lng, addressText }));
        
        if (!newPinRef.current) {
          const el = document.createElement('div');
          el.innerHTML = `<div style="background-color: #2563eb; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.5); transform: translateY(-12px);"></div>`;
          newPinRef.current = new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat([lng, lat]).addTo(map.current);
        } else {
          newPinRef.current.setLngLat([lng, lat]);
        }
      });
    }
    return () => { if (view !== 'add_store' && map.current) { map.current.remove(); map.current = null; newPinRef.current = null; } };
  }, [view]);

  useEffect(() => {
    if (isEditStoreModalOpen && editMapContainer.current && !editMap.current) {
      editMap.current = new mapboxgl.Map({
        container: editMapContainer.current, style: 'mapbox://styles/mapbox/streets-v12', center: [editStoreData.lng || 121.9823, editStoreData.lat || 12.3985], zoom: 15.5, pitch: 45,
      });
      
      if (editStoreData.lng && editStoreData.lat) {
        const el = document.createElement('div');
        el.innerHTML = `<div style="background-color: #f59e0b; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.5); transform: translateY(-12px);"></div>`;
        editPinRef.current = new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat([editStoreData.lng, editStoreData.lat]).addTo(editMap.current);
      }

      editMap.current.on('click', async (e) => {
        const lng = e.lngLat.lng.toFixed(6); const lat = e.lngLat.lat.toFixed(6);
        let addressText = editStoreRef.current.addressText;
        if (editStoreRef.current.showAddress) addressText = await fetchAddressFromCoords(lng, lat);

        setEditStoreData(prev => ({ ...prev, lat, lng, addressText }));

        if (!editPinRef.current) {
          const el = document.createElement('div');
          el.innerHTML = `<div style="background-color: #f59e0b; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.5); transform: translateY(-12px);"></div>`;
          editPinRef.current = new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat([lng, lat]).addTo(editMap.current);
        } else {
          editPinRef.current.setLngLat([lng, lat]);
        }
      });
    }

    return () => { if (!isEditStoreModalOpen && editMap.current) { editMap.current.remove(); editMap.current = null; editPinRef.current = null; } };
  }, [isEditStoreModalOpen]);


  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const toggleStoreStatus = async () => {
    const nextStatus = !activeStore.is_open;
    const response = await fetch(`https://locallook-api.onrender.com/api/stores/${activeStore.id}/toggle`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_open: nextStatus }) });
    if (response.ok) {
      setActiveStore({ ...activeStore, is_open: nextStatus });
      setStores(stores.map(s => s.id === activeStore.id ? { ...s, is_open: nextStatus } : s));
    }
  };

  const handleSaveTheme = async () => {
    setIsSavingTheme(true);
    try {
      const response = await fetch(`https://locallook-api.onrender.com/api/stores/${activeStore.id}/theme`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theme_settings: { ...storeTheme, categoryOrder } }) });
      if (!response.ok) throw new Error("Failed to save theme");
      alert("Storefront branding and category layout saved successfully!");
    } catch (err) { alert(err.message); } finally { setIsSavingTheme(false); }
  };

  const handleOpenEditStore = (store) => {
    const theme = store.theme_settings || {};
    setEditStoreData({ 
      id: store.id, store_name: store.store_name, store_category: store.store_category, description: store.description || '', 
      phone: store.phone || '', email: store.email || '', website: store.website || '', lat: store.lat, lng: store.lng,
      showPhone: !!theme.showPhone, showEmail: !!theme.showEmail, showWebsite: !!theme.showWebsite, showAddress: !!theme.showAddress, 
      addressText: theme.addressText || '', theme_settings: theme
    });
    setIsEditStoreModalOpen(true);
    setOpenStoreMenuId(null);
  };

  const handleUpdateStore = async (e) => {
    e.preventDefault();
    if (!editStoreData.lat || !editStoreData.lng) return alert("Please drop a pin on the map!");
    setIsUploading(true);
    try {
      const response = await fetch(`https://locallook-api.onrender.com/api/stores/${editStoreData.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          store_name: editStoreData.store_name, store_category: editStoreData.store_category, description: editStoreData.description, 
          phone: editStoreData.phone, email: editStoreData.email, website: editStoreData.website, lat: editStoreData.lat, lng: editStoreData.lng 
        })
      });

      if (response.ok) {
        const updatedStore = await response.json();
        const themeUpdate = { 
          ...editStoreData.theme_settings, showPhone: editStoreData.showPhone, showEmail: editStoreData.showEmail, showWebsite: editStoreData.showWebsite, showAddress: editStoreData.showAddress, addressText: editStoreData.addressText 
        };
        await fetch(`https://locallook-api.onrender.com/api/stores/${editStoreData.id}/theme`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theme_settings: themeUpdate }) });
        
        const fullyUpdatedStore = { ...updatedStore, theme_settings: themeUpdate };
        setStores(stores.map(s => s.id === fullyUpdatedStore.id ? { ...s, ...fullyUpdatedStore } : s));
        if (activeStore?.id === fullyUpdatedStore.id) setActiveStore({ ...activeStore, ...fullyUpdatedStore });
        setIsEditStoreModalOpen(false);
      }
    } catch (err) { alert("Failed to update store."); } finally { setIsUploading(false); }
  };

  const handleOpenDeleteStore = (store) => { setStoreToDelete(store); setDeleteConfirmationText(''); setIsDeleteStoreModalOpen(true); setOpenStoreMenuId(null); };

  const handleDeleteStore = async () => {
    if (deleteConfirmationText !== storeToDelete.store_name) return;
    setIsUploading(true);
    try {
      const response = await fetch(`https://locallook-api.onrender.com/api/stores/${storeToDelete.id}`, { method: 'DELETE' });
      if (response.ok) {
        const updatedStores = stores.filter(s => s.id !== storeToDelete.id);
        setStores(updatedStores);
        if (activeStore?.id === storeToDelete.id) {
          setActiveStore(updatedStores.length > 0 ? updatedStores[0] : null);
          if (updatedStores.length === 0) setView('add_store');
        }
        setIsDeleteStoreModalOpen(false);
      }
    } catch (err) { alert("Failed to delete store."); } finally { setIsUploading(false); }
  };

  const openAddModal = () => { setEditingItemId(null); setNewItem({ name: '', description: '', price: '', category: '', imageFile: null }); setCroppedPreview(null); setIsItemModalOpen(true); };
  const closeItemModal = () => { setIsItemModalOpen(false); setEditingItemId(null); setNewItem({ name: '', description: '', price: '', category: '', imageFile: null }); setCroppedPreview(null); };
  const startEditItem = (item) => { setEditingItemId(item.id); setNewItem({ name: item.item_name, description: item.description || '', price: item.price, category: item.item_category, imageFile: null }); setCroppedPreview(item.image_url || null); setIsItemModalOpen(true); };

  const handleAddItem = async (e) => {
    e.preventDefault(); setIsUploading(true); let finalImageUrl = null;
    if (newItem.imageFile) {
      const fileName = `${Math.random()}.${newItem.imageFile.name.split('.').pop() || 'jpg'}`;
      const filePath = `${activeStore.id}/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('item-images').upload(filePath, newItem.imageFile);
      if (uploadError) { alert("Error uploading image: " + uploadError.message); setIsUploading(false); return; }
      finalImageUrl = supabase.storage.from('item-images').getPublicUrl(filePath).data.publicUrl;
    }

    const payload = { item_name: newItem.name, description: newItem.description, price: parseFloat(newItem.price), image_url: finalImageUrl, item_category: newItem.category };
    if (editingItemId) {
      const response = await fetch(`https://locallook-api.onrender.com/api/items/${editingItemId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (response.ok) { const updatedItem = await response.json(); setItems(items.map(i => i.id === editingItemId ? updatedItem : i)); closeItemModal(); }
    } else {
      const response = await fetch('https://locallook-api.onrender.com/api/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ store_id: activeStore.id, ...payload }) });
      if (response.ok) { const addedItem = await response.json(); setItems([addedItem, ...items]); closeItemModal(); }
    }
    setIsUploading(false);
  };

  const handleDeleteItem = async (itemId, itemName) => {
    if (!window.confirm(`Delete "${itemName}" from the menu permanently?`)) return;
    try {
      const response = await fetch(`https://locallook-api.onrender.com/api/items/${itemId}`, { method: 'DELETE' });
      if (response.ok) { setItems(items.filter(item => item.id !== itemId)); if (editingItemId === itemId) closeItemModal(); }
    } catch (err) { alert("Failed to delete item."); }
  };

  const handleInviteOperator = async (e) => {
    e.preventDefault(); setIsInviting(true); setInviteMessage(null); 
    try {
      const response = await fetch(`https://locallook-api.onrender.com/api/stores/${activeStore.id}/invite`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: inviteEmail, requester_id: user.id }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Failed to invite operator");
      setInviteMessage({ type: 'success', text: data.message });
      setStoreOperators([...storeOperators, { email: inviteEmail, status: data.message.includes('Existing') ? 'confirmed' : 'pending', role: 'operator' }]);
      setInviteEmail(''); 
    } catch (err) { setInviteMessage({ type: 'error', text: err.message }); } finally { setIsInviting(false); setTimeout(() => setInviteMessage(null), 6000); }
  };

  const handleCreateStore = async (e) => {
    e.preventDefault();
    if (!newStoreData.lat || !newStoreData.lng) return alert("Please drop a pin on the map!");
    setIsUploading(true);
    try {
      const response = await fetch('https://locallook-api.onrender.com/api/stores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newStoreData, user_id: user.id }) });
      if (!response.ok) throw new Error("Failed to create store");
      const createdStore = await response.json();
      
      const newTheme = { primaryColor: '#3b82f6', layout: 'grid', categoryOrder: [], showPhone: newStoreData.showPhone, showEmail: newStoreData.showEmail, showWebsite: newStoreData.showWebsite, showAddress: newStoreData.showAddress, addressText: newStoreData.addressText };
      await fetch(`https://locallook-api.onrender.com/api/stores/${createdStore.id}/theme`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theme_settings: newTheme }) });

      await fetchStores(user.id);
      setView('dashboard');
      setNewStoreData({ store_name: '', store_category: 'Food & Dining', description: '', phone: '', email: '', website: '', lat: '', lng: '', showPhone: false, showEmail: false, showWebsite: false, showAddress: false, addressText: '' });
    } catch (err) { alert(err.message); } finally { setIsUploading(false); }
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
    } catch (error) { alert("Error: " + error.message); }
  };

  const groupedItems = items.reduce((groups, item) => {
    const category = item.item_category || 'Uncategorized';
    if (!groups[category]) groups[category] = [];
    groups[category].push(item);
    return groups;
  }, {});

  if (loading) return <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center' }}>Loading...</div>;

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#f3f4f6', fontFamily: 'sans-serif', overflow: 'hidden' }}>
      
      {imageToCrop && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ position: 'relative', flexGrow: 1 }}><Cropper image={imageToCrop} crop={crop} zoom={zoom} aspect={4 / 3} onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom} /></div>
          <div style={{ padding: '20px', backgroundColor: 'white', display: 'flex', justifyContent: 'center', gap: '20px', alignItems: 'center' }}>
            <button onClick={() => setImageToCrop(null)} style={{ padding: '10px 20px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
            <input type="range" value={zoom} min={1} max={3} step={0.1} aria-labelledby="Zoom" onChange={(e) => setZoom(e.target.value)} style={{ width: '200px' }} />
            <button onClick={handleSaveCrop} style={{ padding: '10px 20px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Save 4:3 Crop</button>
          </div>
        </div>
      )}

      {isItemModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '16px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', color: '#111827', fontWeight: '800' }}>{editingItemId ? '✏️ Edit Item' : '✨ Add New Item'}</h2>
              <button onClick={closeItemModal} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '24px', cursor: 'pointer', lineHeight: '1' }}>&times;</button>
            </div>

            <form onSubmit={handleAddItem} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                <div style={{ flex: '2 1 200px' }}><input type="text" placeholder="Item Name" required value={newItem.name} onChange={(e) => setNewItem({...newItem, name: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px', boxSizing: 'border-box' }} /></div>
                <div style={{ flex: '1 1 100px' }}><input type="number" step="0.01" placeholder="Price (₱)" required value={newItem.price} onChange={(e) => setNewItem({...newItem, price: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px', boxSizing: 'border-box' }} /></div>
              </div>
              
              <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                <div style={{ flex: '2 1 200px' }}><input type="text" placeholder="Description (Optional)" value={newItem.description} onChange={(e) => setNewItem({...newItem, description: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px', boxSizing: 'border-box' }} /></div>
                <div style={{ flex: '1 1 150px' }}>
                  <input type="text" list="category-suggestions" placeholder="Category" required value={newItem.category} onChange={(e) => setNewItem({...newItem, category: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px', boxSizing: 'border-box' }} />
                  <datalist id="category-suggestions"><option value="General" /><option value="Appetizers" /><option value="Main Course" /><option value="Desserts" /><option value="Snacks" /><option value="Hot Drinks" /><option value="Cold Drinks" /><option value="Bakery & Pastries" /><option value="Vegan/Vegetarian" /><option value="Fresh Produce" /><option value="Meat & Seafood" /><option value="Dairy & Eggs" /><option value="Pantry Staples" /><option value="Personal Care" /><option value="Household" /><option value="Clothing & Apparel" /><option value="Electronics" /><option value="Beauty & Cosmetics" /><option value="Toys & Games" /><option value="Services" /></datalist>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', padding: '15px', backgroundColor: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: '8px', flexWrap: 'wrap', gap: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  {croppedPreview ? (
                    <div style={{ position: 'relative' }}>
                      <img src={croppedPreview} alt="Preview" style={{ width: '120px', height: '90px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #d1d5db' }} />
                      <button type="button" onClick={() => { setCroppedPreview(null); setNewItem({...newItem, imageFile: null}) }} style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>×</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <div><label htmlFor="image-upload" style={{ display: 'inline-block', padding: '8px 12px', backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', color: '#4b5563' }}>🖼️ {editingItemId ? 'Change Image' : 'Upload Image'}</label><input id="image-upload" type="file" accept="image/*" onChange={onFileSelect} style={{ display: 'none' }} /></div>
                      <div><label htmlFor="camera-upload" style={{ display: 'inline-block', padding: '8px 12px', backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', color: '#4b5563' }}>📸 Take Photo</label><input id="camera-upload" type="file" accept="image/*" capture="environment" onChange={onFileSelect} style={{ display: 'none' }} /></div>
                    </div>
                  )}
                </div>
                <button type="submit" disabled={isUploading} style={{ padding: '10px 24px', backgroundColor: editingItemId ? '#f59e0b' : '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: isUploading ? 'not-allowed' : 'pointer' }}>{isUploading ? 'Saving...' : (editingItemId ? 'Update Item' : 'Save New Item')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditStoreModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '16px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', color: '#111827', fontWeight: '800' }}>Edit Store Info</h2>
              <button onClick={() => setIsEditStoreModalOpen(false)} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '24px', cursor: 'pointer', lineHeight: '1' }}>&times;</button>
            </div>
            
            <form onSubmit={handleUpdateStore} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <input type="text" placeholder="Store Name" required value={editStoreData.store_name} onChange={(e) => setEditStoreData({...editStoreData, store_name: e.target.value})} style={{ padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }} />
              
              <select value={editStoreData.store_category} onChange={(e) => setEditStoreData({...editStoreData, store_category: e.target.value})} style={{ padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px', width: '100%', boxSizing: 'border-box', backgroundColor: 'white' }}>
                <option value="Food & Dining">Food & Dining</option><option value="Retail">Retail</option><option value="Services">Services</option><option value="Groceries">Groceries</option>
              </select>

              <textarea placeholder="Store Description (Optional)" value={editStoreData.description} onChange={(e) => setEditStoreData({...editStoreData, description: e.target.value})} style={{ padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px', width: '100%', boxSizing: 'border-box', minHeight: '80px', fontFamily: 'inherit' }} />
              
              <div style={{ padding: '15px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#374151' }}>Profile Contact Buttons</h4>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', marginBottom: editStoreData.showPhone ? '10px' : '5px', fontWeight: 'bold' }}>
                  <input type="checkbox" checked={editStoreData.showPhone} onChange={(e) => setEditStoreData({...editStoreData, showPhone: e.target.checked})} /> Show Phone Number
                </label>
                {editStoreData.showPhone && <input type="text" placeholder="Phone (e.g., +63 900...)" value={editStoreData.phone} onChange={(e) => setEditStoreData({...editStoreData, phone: e.target.value})} style={{ padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', width: '100%', boxSizing: 'border-box', marginBottom: '15px' }} />}

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', marginBottom: editStoreData.showEmail ? '10px' : '5px', fontWeight: 'bold' }}>
                  <input type="checkbox" checked={editStoreData.showEmail} onChange={(e) => setEditStoreData({...editStoreData, showEmail: e.target.checked})} /> Show Email Address
                </label>
                {editStoreData.showEmail && <input type="email" placeholder="Business Email" value={editStoreData.email} onChange={(e) => setEditStoreData({...editStoreData, email: e.target.value})} style={{ padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', width: '100%', boxSizing: 'border-box', marginBottom: '15px' }} />}

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', marginBottom: editStoreData.showWebsite ? '10px' : '5px', fontWeight: 'bold' }}>
                  <input type="checkbox" checked={editStoreData.showWebsite} onChange={(e) => setEditStoreData({...editStoreData, showWebsite: e.target.checked})} /> Show Website Link
                </label>
                {editStoreData.showWebsite && <input type="url" placeholder="Website URL (e.g., https://yourstore.com)" value={editStoreData.website} onChange={(e) => setEditStoreData({...editStoreData, website: e.target.value})} style={{ padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', width: '100%', boxSizing: 'border-box', marginBottom: '15px' }} />}

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', marginBottom: editStoreData.showAddress ? '10px' : '0', fontWeight: 'bold' }}>
                  <input type="checkbox" checked={editStoreData.showAddress} onChange={async (e) => {
                    const checked = e.target.checked;
                    let text = editStoreData.addressText;
                    if (checked && !text && editStoreData.lng) text = await fetchAddressFromCoords(editStoreData.lng, editStoreData.lat);
                    setEditStoreData({...editStoreData, showAddress: checked, addressText: text});
                  }} /> Show Exact Street Address
                </label>
                {editStoreData.showAddress && <input type="text" placeholder="Auto-detects when you drop a pin below" value={editStoreData.addressText} onChange={(e) => setEditStoreData({...editStoreData, addressText: e.target.value})} style={{ padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }} />}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#6b7280', marginBottom: '8px' }}>Update Location (Drag map to move pin)</label>
                <div style={{ position: 'relative', width: '100%', height: '200px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #d1d5db' }}>
                  <div ref={editMapContainer} style={{ position: 'absolute', inset: 0 }} />
                </div>
              </div>

              <button type="submit" disabled={isUploading} style={{ padding: '14px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: isUploading ? 'not-allowed' : 'pointer', marginTop: '10px' }}>
                {isUploading ? 'Updating...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}

      {isDeleteStoreModalOpen && storeToDelete && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '16px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h2 style={{ margin: '0 0 15px 0', fontSize: '20px', color: '#dc2626', fontWeight: '800' }}>⚠️ Delete Store</h2>
            <p style={{ margin: '0 0 20px 0', color: '#4b5563', fontSize: '14px', lineHeight: '1.5' }}>This action cannot be undone. This will permanently delete <strong>{storeToDelete.store_name}</strong> and all of its items.</p>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#6b7280', marginBottom: '8px' }}>Type <strong style={{ color: '#111827' }}>{storeToDelete.store_name}</strong> to confirm:</label>
              <input type="text" value={deleteConfirmationText} onChange={(e) => setDeleteConfirmationText(e.target.value)} style={{ padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setIsDeleteStoreModalOpen(false)} style={{ flex: 1, padding: '12px', backgroundColor: '#f3f4f6', color: '#4b5563', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleDeleteStore} disabled={deleteConfirmationText !== storeToDelete.store_name || isUploading} style={{ flex: 1, padding: '12px', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: deleteConfirmationText !== storeToDelete.store_name || isUploading ? 'not-allowed' : 'pointer', opacity: deleteConfirmationText !== storeToDelete.store_name ? 0.5 : 1 }}>{isUploading ? 'Deleting...' : 'Delete Store'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 1. SIDEBAR */}
      <div style={{ width: '280px', backgroundColor: '#1f2937', color: 'white', display: 'flex', flexDirection: 'column', boxShadow: '4px 0 15px rgba(0,0,0,0.1)', zIndex: 10 }}>
        <div style={{ padding: '25px 20px', borderBottom: '1px solid #374151' }}>
          <h2 style={{ margin: '0', fontSize: '24px', color: '#3b82f6', fontWeight: '900' }}>LocalLook</h2>
          <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 'bold', letterSpacing: '2px' }}>MERCHANT HUB</span>
          <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#374151', padding: '10px', borderRadius: '8px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#60a5fa', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#1e3a8a', fontWeight: '900', fontSize: '16px' }}>{displayName ? displayName.charAt(0).toUpperCase() : '?'}</div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '14px', color: '#f3f4f6', fontWeight: 'bold', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{displayName}</div>
              <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 'bold', letterSpacing: '0.5px' }}>{activeStore ? activeStore.role.toUpperCase() : 'MERCHANT'}</div>
            </div>
          </div>
        </div>
        
        <div style={{ flexGrow: 1, padding: '20px 15px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#6b7280', marginBottom: '5px', paddingLeft: '5px' }}>YOUR STORES</div>
          {stores.map(s => (
            <div key={s.id} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <button onClick={() => { setActiveStore(s); setView('dashboard'); }} style={{ width: '100%', padding: '12px 35px 12px 15px', backgroundColor: activeStore?.id === s.id && view === 'dashboard' ? '#374151' : 'transparent', color: 'white', border: 'none', borderRadius: '8px', textAlign: 'left', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.store_name}</button>
              <button onClick={() => setOpenStoreMenuId(openStoreMenuId === s.id ? null : s.id)} style={{ position: 'absolute', right: '5px', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '5px', display: 'flex', alignItems: 'center', borderRadius: '50%' }}><MdMoreVert size={18} /></button>
              {openStoreMenuId === s.id && (
                <div style={{ position: 'absolute', right: '10px', top: '40px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', zIndex: 100, overflow: 'hidden', width: '130px' }}>
                  <button onClick={() => handleOpenEditStore(s)} style={{ width: '100%', padding: '10px 15px', border: 'none', borderBottom: '1px solid #f3f4f6', background: 'white', textAlign: 'left', cursor: 'pointer', fontSize: '13px', color: '#374151', fontWeight: 'bold' }}>Edit Store</button>
                  <button onClick={() => handleOpenDeleteStore(s)} style={{ width: '100%', padding: '10px 15px', border: 'none', background: 'white', textAlign: 'left', cursor: 'pointer', fontSize: '13px', color: '#dc2626', fontWeight: 'bold' }}>Delete Store</button>
                </div>
              )}
            </div>
          ))}
          <button onClick={() => setView('add_store')} style={{ width: '100%', padding: '12px 15px', marginTop: '10px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', border: '1px dashed #3b82f6', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>+ Add a Store</button>
        </div>

        <div style={{ padding: '20px', borderTop: '1px solid #374151' }}>
          <button onClick={handleLogout} style={{ width: '100%', padding: '12px', backgroundColor: 'transparent', color: '#ef4444', border: 'none', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer' }}>🚪 Sign Out</button>
        </div>
      </div>

      <div ref={scrollContainerRef} onScroll={handleScroll} style={{ flexGrow: 1, overflowY: 'auto', position: 'relative' }}>
        {view === 'add_store' && (
          <div style={{ display: 'flex', height: '100%' }}>
            <div style={{ width: '350px', padding: '40px 30px', backgroundColor: 'white', boxShadow: '5px 0 15px rgba(0,0,0,0.05)', zIndex: 2, overflowY: 'auto' }}>
              <h2 style={{ marginTop: 0, color: '#1f2937' }}>Register Location</h2>
              <form onSubmit={handleCreateStore} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
                <input type="text" placeholder="Store Name" required value={newStoreData.store_name} onChange={e => setNewStoreData({...newStoreData, store_name: e.target.value})} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db' }} />
                <select value={newStoreData.store_category} onChange={e => setNewStoreData({...newStoreData, store_category: e.target.value})} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: 'white' }}><option value="Food & Dining">Food & Dining</option><option value="Retail">Retail</option><option value="Services">Services</option><option value="Groceries">Groceries</option></select>
                <textarea placeholder="Store Description (Optional)" value={newStoreData.description} onChange={(e) => setNewStoreData({...newStoreData, description: e.target.value})} style={{ padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px', width: '100%', boxSizing: 'border-box', minHeight: '80px', fontFamily: 'inherit' }} />
                
                <div style={{ padding: '15px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#374151' }}>Profile Contact Buttons</h4>
                  
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', marginBottom: newStoreData.showPhone ? '10px' : '5px', fontWeight: 'bold' }}>
                    <input type="checkbox" checked={newStoreData.showPhone} onChange={(e) => setNewStoreData({...newStoreData, showPhone: e.target.checked})} /> Show Phone Number
                  </label>
                  {newStoreData.showPhone && <input type="text" placeholder="Phone (e.g., +63 900...)" value={newStoreData.phone} onChange={e => setNewStoreData({...newStoreData, phone: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', width: '100%', boxSizing: 'border-box', marginBottom: '15px' }} />}

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', marginBottom: newStoreData.showEmail ? '10px' : '5px', fontWeight: 'bold' }}>
                    <input type="checkbox" checked={newStoreData.showEmail} onChange={(e) => setNewStoreData({...newStoreData, showEmail: e.target.checked})} /> Show Email Address
                  </label>
                  {newStoreData.showEmail && <input type="email" placeholder="Business Email" value={newStoreData.email} onChange={e => setNewStoreData({...newStoreData, email: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', width: '100%', boxSizing: 'border-box', marginBottom: '15px' }} />}

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', marginBottom: newStoreData.showWebsite ? '10px' : '5px', fontWeight: 'bold' }}>
                    <input type="checkbox" checked={newStoreData.showWebsite} onChange={(e) => setNewStoreData({...newStoreData, showWebsite: e.target.checked})} /> Show Website Link
                  </label>
                  {newStoreData.showWebsite && <input type="url" placeholder="Website URL (e.g., https://yourstore.com)" value={newStoreData.website} onChange={e => setNewStoreData({...newStoreData, website: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', width: '100%', boxSizing: 'border-box', marginBottom: '15px' }} />}

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', marginBottom: newStoreData.showAddress ? '10px' : '0', fontWeight: 'bold' }}>
                    <input type="checkbox" checked={newStoreData.showAddress} onChange={async (e) => {
                      const checked = e.target.checked; let text = newStoreData.addressText;
                      if (checked && !text && newStoreData.lng) text = await fetchAddressFromCoords(newStoreData.lng, newStoreData.lat);
                      setNewStoreData({...newStoreData, showAddress: checked, addressText: text});
                    }} /> Show Exact Street Address
                  </label>
                  {newStoreData.showAddress && <input type="text" placeholder="Auto-detects when you drop a pin" value={newStoreData.addressText} onChange={(e) => setNewStoreData({...newStoreData, addressText: e.target.value})} style={{ padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }} />}
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <input type="text" readOnly placeholder="Lat" value={newStoreData.lat} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb', flex: 1, backgroundColor: '#f3f4f6', fontSize: '12px' }} />
                  <input type="text" readOnly placeholder="Lng" value={newStoreData.lng} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb', flex: 1, backgroundColor: '#f3f4f6', fontSize: '12px' }} />
                </div>
                <button type="submit" disabled={isUploading} style={{ padding: '14px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}>{isUploading ? 'Saving...' : 'Confirm Store'}</button>
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
                  <p style={{ margin: '5px 0 2px 0', color: '#6b7280', fontSize: '15px', fontWeight: 'bold' }}>{activeStore.store_category}</p>
                  {activeStore.description && <p style={{ margin: 0, color: '#4b5563', fontSize: '14px' }}>{activeStore.description}</p>}
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
                    <p style={{ margin: '0 0 15px 0', color: '#6b7280', fontSize: '12px' }}>Tip: Drag and drop categories below to set custom sorting, then click save!</p>
                    <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#6b7280', marginBottom: '5px' }}>BRAND COLOR</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><input type="color" value={storeTheme.primaryColor} onChange={(e) => setStoreTheme({...storeTheme, primaryColor: e.target.value})} style={{ width: '40px', height: '40px', padding: 0, border: 'none', borderRadius: '8px', cursor: 'pointer' }} /><span style={{ fontSize: '14px', fontWeight: 'bold', color: '#374151' }}>{storeTheme.primaryColor.toUpperCase()}</span></div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#6b7280', marginBottom: '5px' }}>MENU LAYOUT</label>
                        <select value={storeTheme.layout} onChange={(e) => setStoreTheme({...storeTheme, layout: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: '#f9fafb', fontSize: '14px' }}><option value="grid">Grid Cards</option><option value="list">Compact List</option></select>
                      </div>
                    </div>
                    <button onClick={handleSaveTheme} disabled={isSavingTheme} style={{ width: '100%', padding: '10px', backgroundColor: '#111827', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: isSavingTheme ? 'not-allowed' : 'pointer' }}>{isSavingTheme ? 'Saving...' : 'Save Theme & Sorting'}</button>
                  </div>

                  <div style={{ flex: 1, backgroundColor: '#eff6ff', padding: '25px', borderRadius: '16px', border: '1px dashed #93c5fd', minWidth: '300px' }}>
                    <h3 style={{ margin: '0 0 10px 0', color: '#1e3a8a', fontSize: '16px' }}>🛡️ Operator Access</h3>
                    <p style={{ margin: '0 0 15px 0', color: '#3b82f6', fontSize: '13px' }}>Invite staff to manage inventory and open/close status.</p>
                    <form onSubmit={handleInviteOperator} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                      <input type="email" placeholder="Staff Email Address" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} style={{ padding: '10px 15px', borderRadius: '8px', border: '1px solid #bfdbfe', flexGrow: 1, outline: 'none' }} />
                      <button type="submit" disabled={isInviting} style={{ padding: '10px 20px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: isInviting ? 'not-allowed' : 'pointer' }}>{isInviting ? 'Sending...' : 'Invite'}</button>
                    </form>
                    {inviteMessage && <div style={{ fontSize: '13px', fontWeight: 'bold', padding: '8px 12px', borderRadius: '6px', marginBottom: '10px', backgroundColor: inviteMessage.type === 'success' ? '#d1fae5' : '#fee2e2', color: inviteMessage.type === 'success' ? '#059669' : '#dc2626' }}>{inviteMessage.type === 'success' ? '✅ ' : '❌ '} {inviteMessage.text}</div>}
                    {storeOperators.length > 0 && (
                      <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#60a5fa' }}>CURRENT STAFF</span>
                        {storeOperators.map((op, idx) => (
                          <div key={op.id || idx} style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: '8px 12px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                            <span style={{ fontSize: '13px', color: '#1e3a8a', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis' }}>{op.email}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '12px', backgroundColor: op.status === 'pending' ? '#fef3c7' : '#d1fae5', color: op.status === 'pending' ? '#d97706' : '#059669', fontWeight: 'bold' }}>{op.status === 'pending' ? 'PENDING' : 'STAFF'}</span>
                              {op.status !== 'pending' && <button onClick={() => toggleMenu(op.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#60a5fa', padding: '0', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '50%', transition: 'background-color 0.2s' }}>⋮</button>}
                            </div>
                            {openMenuId === op.id && (
                              <div style={{ position: 'absolute', right: '10px', top: '40px', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 50, width: '160px', overflow: 'hidden' }}>
                                <button onClick={() => handleRemoveStaff(op.id, op.email)} style={{ display: 'block', width: '100%', padding: '10px 15px', border: 'none', background: 'white', textAlign: 'left', cursor: 'pointer', fontSize: '13px', color: '#ef4444', fontWeight: '600', transition: 'background-color 0.2s' }}>Remove Staff</button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, fontSize: '20px', color: '#111827', fontWeight: '800' }}>Menu & Inventory</h2>
                <button onClick={openAddModal} style={{ padding: '10px 20px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ fontSize: '16px' }}>+</span> Add Item</button>
              </div>

              {categoryOrder.length > 0 && (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToHorizontalAxis]}>
                  <div style={{ display: 'flex', gap: '10px', padding: '10px', marginBottom: '20px', overflowX: 'auto', backgroundColor: '#e5e7eb', borderRadius: '12px', position: 'sticky', top: '0px', zIndex: 5, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    <SortableContext items={categoryOrder} strategy={horizontalListSortingStrategy}>
                      {categoryOrder.map(cat => <SortableCategory key={cat} id={cat} activeCategory={activeCategory} brandColor={storeTheme.primaryColor} onClick={scrollToCategory} />)}
                    </SortableContext>
                  </div>
                </DndContext>
              )}

              <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f3f4f6', overflow: 'hidden', paddingBottom: '100px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {Object.keys(groupedItems).length === 0 ? (
                    <div style={{ padding: '60px 40px', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic' }}><p style={{ margin: '0 0 10px 0', fontSize: '24px' }}>🍽️</p>Your menu is currently empty.</div>
                  ) : (
                    categoryOrder.map(category => {
                      if (!groupedItems[category]) return null;
                      return (
                        <div key={category} ref={(el) => (sectionRefs.current[category] = el)}>
                          <div style={{ padding: '12px 30px', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', borderTop: '1px solid #e5e7eb' }}><h3 style={{ margin: 0, fontSize: '13px', color: '#6b7280', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>{category}</h3></div>
                          {groupedItems[category].map(item => (
                            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 30px', borderBottom: '1px solid #f3f4f6' }}>
                              <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                                {item.image_url ? <img src={item.image_url} alt={item.item_name} style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '8px' }} /> : <div style={{ width: '80px', height: '60px', backgroundColor: '#f3f4f6', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '20px' }}>🍽️</div>}
                                <div><h4 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#1f2937' }}>{item.item_name}</h4><p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}>{item.description}</p></div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <div style={{ fontSize: '18px', fontWeight: '800', color: '#111827', letterSpacing: '-0.5px', whiteSpace: 'nowrap' }}>₱{parseFloat(item.price).toFixed(2)}</div>
                                <div style={{ display: 'flex', gap: '5px', marginLeft: '10px' }}>
                                  <button onClick={() => startEditItem(item)} style={{ background: '#eff6ff', color: '#3b82f6', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Edit Item">✏️</button>
                                  <button onClick={() => handleDeleteItem(item.id, item.item_name)} style={{ background: '#fef2f2', color: '#ef4444', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Delete Item">🗑️</button>
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
          </div>
        )}
      </div>
    </div>
  );
}