import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import Cropper from 'react-easy-crop';
import { supabase } from '../supabaseClient';
import { 
  MdDragIndicator, MdSmartphone, MdChevronLeft, MdChevronRight, MdOutlineNearMe, 
  MdEdit, MdDelete, MdAdd, MdCameraAlt, MdDashboard, MdPeople, MdSecurity, 
  MdLocalOffer, MdRocketLaunch, MdPayment, MdRestaurantMenu, MdCheckCircle, 
  MdCancel, MdWarning, MdClose, MdSettings
} from "react-icons/md";

import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';

const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) 
  ? import.meta.env.VITE_API_URL 
  : 'https://locallook-api.onrender.com';

const MAPBOX_TOKEN = (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_MAPBOX_TOKEN : '') || '';
if (MAPBOX_TOKEN) { mapboxgl.accessToken = MAPBOX_TOKEN; }

const BUSINESS_TAXONOMY = {
  'Food & Dining': ['Restaurant', 'Fast Food', 'Carinderia / Eatery', 'Cafe / Coffee Shop', 'Bakery / Pastry Shop', 'Snack House / Grill', 'Food Cart / Street Food', 'Catering Service'],
  'Grocery & Retail': ['Supermarket', 'Grocery Store', 'Convenience Store', 'Sari-Sari Store', 'Water Refilling Station', 'Rice Dealer', 'Meat Shop / Butcher', 'Fresh Produce / Market Stall', 'Hardware & Construction Supply', 'Agri-Vet Supply', 'Pet Shop', 'Pharmacy / Drugstore', 'Bookstore / School Supply', 'Gift & Flower Shop', 'Furniture Store', 'Appliance Store', 'Electronics & Gadgets', 'Clothing / Apparel Boutique', 'Ukay-Ukay', 'Jewelry & Watches', 'LPG Dealer'],
  'Beauty & Personal Care': ['Beauty Salon', 'Barbershop', 'Massage / Spa', 'Skin Care Clinic', 'Tattoo Studio', 'Beauty Supply Store'],
  'Health & Medical': ['Hospital', 'Medical Clinic', 'Dental Clinic', 'Optical Clinic', 'Diagnostic Clinic / Lab', 'Veterinary Clinic', 'Gym / Fitness Center'],
  'Automotive': ['Gas Station', 'Car Dealer', 'Motorcycle Dealer', 'Auto / Motorcycle Repair & Parts', 'Vulcanizing / Tire Shop', 'Car Wash / Detailing', 'Driving School'],
  'Travel & Accommodation': ['Hotel', 'Resort', 'Inn / Guesthouse', 'Travel Agency', 'Vehicle Rental'],
  'Home & Professional Services': ['Laundry Shop', 'Tailor / Dress Shop', 'Printing / Copy Center', 'Gadget Repair', 'Appliance / AC Repair', 'Home Repair / Handyman', 'Glass & Aluminum', 'Courier & Freight Service', 'Internet Cafe', 'Photography / Video Studio', 'Event Services & Rentals', 'IT Services'],
  'Financial & Business': ['Bank / ATM', 'Pawnshop / Remittance', 'Money Changer', 'Lending / Cooperative', 'Insurance Agency', 'Law & Accounting Office', 'Real Estate Office']
};

const fetchAddressFromCoords = async (lng, lat) => {
  if (!MAPBOX_TOKEN) return '';
  try {
    const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}`);
    const data = await res.json();
    return data.features?.[0]?.place_name || '';
  } catch (e) { return ''; }
};

const createImage = (url) => new Promise((resolve, reject) => {
  const image = new Image(); image.addEventListener('load', () => resolve(image)); image.addEventListener('error', (error) => reject(error));
  image.setAttribute('crossOrigin', 'anonymous'); image.src = url;
});

const getCroppedImg = async (imageSrc, pixelCrop) => {
  const image = await createImage(imageSrc); const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
  if (!ctx) return null; canvas.width = pixelCrop.width; canvas.height = pixelCrop.height;
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
  return new Promise((resolve) => { canvas.toBlob((file) => { if (file) resolve(new File([file], "cropped-image.jpg", { type: "image/jpeg" })); }, 'image/jpeg', 0.9); });
};

const getStoreCoverImage = (store) => {
  if (store?.cover_image_url) return store.cover_image_url;
  switch (store?.store_category) {
    case 'Food & Dining': return 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80';
    case 'Retail': return 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&q=80';
    case 'Services': return 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1200&q=80';
    case 'Groceries': return 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&q=80';
    default: return 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80';
  }
};

function SortableCategory({ id, activeCategory, brandColor, onClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : 1, position: 'relative', flexShrink: 0 };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <button onClick={() => onClick(id)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '20px', whiteSpace: 'nowrap', border: 'none', fontWeight: 'bold', fontSize: '13px', transition: isDragging ? 'none' : 'all 0.2s', backgroundColor: activeCategory === id ? brandColor : 'white', color: activeCategory === id ? 'white' : '#475569', boxShadow: isDragging ? '0 10px 25px rgba(0,0,0,0.15)' : (activeCategory === id ? `0 4px 10px ${brandColor}40` : '0 1px 3px rgba(0,0,0,0.1)'), cursor: isDragging ? 'grabbing' : 'grab', opacity: isDragging ? 0.95 : 1, touchAction: 'none' }}>
        <MdDragIndicator size={16} style={{ opacity: 0.7, marginLeft: '-4px' }} />{id}
      </button>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [stores, setStores] = useState([]);
  const [activeStore, setActiveStore] = useState(null);
  const [activeTab, setActiveTab] = useState('menu'); 
  const [isAddingStore, setIsAddingStore] = useState(false);
  const [items, setItems] = useState([]);
  const [storeOperators, setStoreOperators] = useState([]);
  const [loading, setLoading] = useState(true);

  const storeScrollRef = useRef(null);
  const storeDragState = useRef({ isDown: false, startX: 0, scrollLeft: 0 });
  const [showStoreLeft, setShowStoreLeft] = useState(false);
  const [showStoreRight, setShowStoreRight] = useState(false);

  const [isEditStoreModalOpen, setIsEditStoreModalOpen] = useState(false);

  const [editStoreData, setEditStoreData] = useState({ 
    id: '', store_name: '', store_category: '', industry: '', description: '', phone: '', email: '', website: '', lat: '', lng: '', cover_image_url: '',
    showPhone: false, showEmail: false, showWebsite: false, showAddress: false, addressText: '', theme_settings: {} 
  });
  
  const [newStoreData, setNewStoreData] = useState({ 
    store_name: '', store_category: '', industry: '', description: '', phone: '', email: '', website: '', lat: '', lng: '',
    showPhone: false, showEmail: false, showWebsite: false, showAddress: false, addressText: ''
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
  const [cropType, setCropType] = useState('item'); 
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [croppedPreview, setCroppedPreview] = useState(null);

  const [storeTheme, setStoreTheme] = useState({ primaryColor: '#2563EB', layout: 'grid' });
  const [isSavingTheme, setIsSavingTheme] = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState(null);

  const [subscription, setSubscription] = useState({ plan_type: 'free', end_date: null });
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherMessage, setVoucherMessage] = useState(null);

  const addMapContainer = useRef(null);
  const addMap = useRef(null);
  const addPinRef = useRef(null);
  const newStoreRef = useRef(newStoreData);
  useEffect(() => { newStoreRef.current = newStoreData; }, [newStoreData]);

  const editMapContainer = useRef(null);
  const editMap = useRef(null);
  const editPinRef = useRef(null);
  const editStoreRef = useRef(editStoreData);
  useEffect(() => { editStoreRef.current = editStoreData; }, [editStoreData]);

  const handleHeaderMouseDown = (e) => {
    storeDragState.current.isDown = true;
    if (storeScrollRef.current) {
      storeScrollRef.current.style.cursor = 'grabbing';
      storeDragState.current.startX = e.pageX - storeScrollRef.current.offsetLeft;
      storeDragState.current.scrollLeft = storeScrollRef.current.scrollLeft;
    }
  };
  const handleHeaderMouseLeave = () => {
    storeDragState.current.isDown = false;
    if (storeScrollRef.current) storeScrollRef.current.style.cursor = 'grab';
  };
  const handleHeaderMouseUp = () => {
    storeDragState.current.isDown = false;
    if (storeScrollRef.current) storeScrollRef.current.style.cursor = 'grab';
  };
  const handleHeaderMouseMove = (e) => {
    if (!storeDragState.current.isDown) return;
    e.preventDefault();
    if (storeScrollRef.current) {
      const x = e.pageX - storeScrollRef.current.offsetLeft;
      const walk = (x - storeDragState.current.startX) * 1.5;
      storeScrollRef.current.scrollLeft = storeDragState.current.scrollLeft - walk;
    }
  };

  const checkHeaderScroll = () => {
    if (!storeScrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = storeScrollRef.current;
    setShowStoreLeft(scrollLeft > 0);
    setShowStoreRight(scrollLeft < scrollWidth - clientWidth - 5);
  };

  useEffect(() => {
    checkHeaderScroll();
    window.addEventListener('resize', checkHeaderScroll);
    return () => window.removeEventListener('resize', checkHeaderScroll);
  }, [stores]);

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
        if (data.length === 0) setIsAddingStore(true);
      }
    } catch (err) { console.error("Failed to fetch stores:", err); } finally { setLoading(false); }
  };

  const fetchSubscription = async (storeId) => {
    try {
      const { data } = await supabase.from('subscriptions').select('*').eq('store_id', storeId).order('created_at', { ascending: false }).limit(1).maybeSingle(); 
      if (data) setSubscription(data); else setSubscription({ plan_type: 'free', end_date: null });
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (activeStore?.id && !isAddingStore) {
      fetch(`${API_BASE_URL}/api/stores/${activeStore.id}`)
        .then(res => res.json())
        .then(data => { 
          const theme = data.theme_settings || {};
          if (theme.primaryColor) setStoreTheme(theme); 
          if (theme.categoryOrder) setCategoryOrder(theme.categoryOrder);
          setEditStoreData({ 
            id: data.id, store_name: data.store_name, store_category: data.store_category, industry: data.industry || '', description: data.description || '', 
            phone: data.phone || '', email: data.email || '', website: data.website || '', lat: data.lat, lng: data.lng,
            cover_image_url: data.cover_image_url || '', showPhone: !!theme.showPhone, showEmail: !!theme.showEmail, showWebsite: !!theme.showWebsite, showAddress: !!theme.showAddress, 
            addressText: theme.addressText || '', theme_settings: theme
          });
        }).catch(err => console.error(err));

      fetch(`${API_BASE_URL}/api/stores/${activeStore.id}/items`).then(res => res.json()).then(data => setItems(data)).catch(err => console.error(err));
      fetch(`${API_BASE_URL}/api/stores/${activeStore.id}/operators`).then(res => res.ok ? res.json() : []).then(data => setStoreOperators(data)).catch(err => console.error(err));
      fetchSubscription(activeStore.id);
      setActiveTab('menu'); 
    }
  }, [activeStore?.id, isAddingStore]);

  useEffect(() => {
    const uniqueCats = [...new Set(items.map(i => i.item_category || 'Uncategorized'))];
    setCategoryOrder(prevOrder => {
      const newOrder = [...prevOrder];
      uniqueCats.forEach(c => { if (!newOrder.includes(c)) newOrder.push(c); });
      return newOrder.filter(c => uniqueCats.includes(c)); 
    });
  }, [items]);

  useEffect(() => {
    if (!isAddingStore && isEditStoreModalOpen && editMapContainer.current && !editMap.current) {
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
        } else { editPinRef.current.setLngLat([lng, lat]); }
      });
    }

    return () => { if (!isEditStoreModalOpen && editMap.current) { editMap.current.remove(); editMap.current = null; editPinRef.current = null; } };
  }, [isAddingStore, isEditStoreModalOpen, editStoreData.lng, editStoreData.lat]);

  useEffect(() => {
    if (isAddingStore && addMapContainer.current && !addMap.current) {
      addMap.current = new mapboxgl.Map({
        container: addMapContainer.current, style: 'mapbox://styles/mapbox/streets-v12', center: [121.9823, 12.3985], zoom: 15.5, pitch: 45,
      });
      
      addMap.current.on('click', async (e) => {
        const lng = e.lngLat.lng.toFixed(6); const lat = e.lngLat.lat.toFixed(6);
        let addressText = newStoreRef.current.addressText;
        if (newStoreRef.current.showAddress) addressText = await fetchAddressFromCoords(lng, lat);
        setNewStoreData(prev => ({ ...prev, lat, lng, addressText }));

        if (!addPinRef.current) {
          const el = document.createElement('div');
          el.innerHTML = `<div style="background-color: #2563eb; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.5); transform: translateY(-12px);"></div>`;
          addPinRef.current = new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat([lng, lat]).addTo(addMap.current);
        } else { addPinRef.current.setLngLat([lng, lat]); }
      });
    }
    return () => { if (!isAddingStore && addMap.current) { addMap.current.remove(); addMap.current = null; addPinRef.current = null; } };
  }, [isAddingStore]);

  const handleLocateMerchant = (mapRef, isEditing) => {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { longitude, latitude } = pos.coords;
        const lng = longitude.toFixed(6); const lat = latitude.toFixed(6);
        mapRef.current.flyTo({ center: [lng, lat], zoom: 18.5, speed: 1.5 });
        
        if (isEditing) {
          let addressText = editStoreRef.current.addressText;
          if (editStoreRef.current.showAddress) addressText = await fetchAddressFromCoords(lng, lat);
          setEditStoreData(prev => ({ ...prev, lat, lng, addressText }));
          if (editPinRef.current) editPinRef.current.setLngLat([lng, lat]);
        } else {
          let addressText = newStoreRef.current.addressText;
          if (newStoreRef.current.showAddress) addressText = await fetchAddressFromCoords(lng, lat);
          setNewStoreData(prev => ({ ...prev, lat, lng, addressText }));
          if (addPinRef.current) addPinRef.current.setLngLat([lng, lat]);
        }
      },
      (err) => alert("Could not access location. Check permissions."),
      { enableHighAccuracy: true }
    );
  };

  const handleScroll = () => {
    if (activeTab !== 'menu' || isAddingStore || !scrollContainerRef.current) return;
    const containerTop = scrollContainerRef.current.getBoundingClientRect().top;
    let currentActive = activeCategory; let minDistance = Infinity;
    categoryOrder.forEach(cat => {
      const el = sectionRefs.current[cat];
      if (el) {
        // Offset mapping to account for the 70px height of the top header + sticky space
        const distance = Math.abs(el.getBoundingClientRect().top - containerTop - 140); 
        if (distance < minDistance) { minDistance = distance; currentActive = cat; }
      }
    });
    if (currentActive !== activeCategory) setActiveCategory(currentActive);
  };

  const scrollToCategory = (cat) => {
    const el = sectionRefs.current[cat]; const container = scrollContainerRef.current;
    if (el && container) { container.scrollTo({ top: el.offsetTop - 140, behavior: 'smooth' }); }
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) setCategoryOrder((items) => arrayMove(items, items.indexOf(active.id), items.indexOf(over.id)));
  };

  const onItemFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader(); reader.readAsDataURL(e.target.files[0]);
      reader.onload = () => { setImageToCrop(reader.result); setCropType('item'); }; 
      e.target.value = null; 
    }
  };

  const onCoverFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader(); reader.readAsDataURL(e.target.files[0]);
      reader.onload = () => { setImageToCrop(reader.result); setCropType('cover'); }; 
      e.target.value = null; 
    }
  };

  const onCropComplete = (croppedArea, croppedAreaPixels) => setCroppedAreaPixels(croppedAreaPixels);
  
  const handleSaveCrop = async () => {
    try {
      const croppedFile = await getCroppedImg(imageToCrop, croppedAreaPixels);
      if (cropType === 'item') {
        setNewItem({ ...newItem, imageFile: croppedFile }); 
        setCroppedPreview(URL.createObjectURL(croppedFile));
      } else if (cropType === 'cover') {
        handleCoverUploadFinal(croppedFile);
      }
      setImageToCrop(null); 
    } catch (e) { console.error(e); }
  };

  const handleCoverUploadFinal = async (file) => {
    setIsUploadingCover(true);
    try {
      const fileExt = 'jpg'; const filePath = `${activeStore.id}/${activeStore.id}-cover-${Math.random()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('store-covers').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('store-covers').getPublicUrl(filePath);
      const response = await fetch(`${API_BASE_URL}/api/stores/${activeStore.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cover_image_url: publicUrl }) });
      if (!response.ok) throw new Error("Failed to update store in database");
      setActiveStore({ ...activeStore, cover_image_url: publicUrl }); 
      setStores(stores.map(s => s.id === activeStore.id ? { ...s, cover_image_url: publicUrl } : s)); 
    } catch (err) { alert("Error uploading cover: " + err.message); } finally { setIsUploadingCover(false); }
  };

  const handleLogout = async () => { await supabase.auth.signOut(); navigate('/'); };

  const toggleStoreStatus = async () => {
    const nextStatus = !activeStore.is_open;
    const response = await fetch(`${API_BASE_URL}/api/stores/${activeStore.id}/toggle`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_open: nextStatus }) });
    if (response.ok) { setActiveStore({ ...activeStore, is_open: nextStatus }); setStores(stores.map(s => s.id === activeStore.id ? { ...s, is_open: nextStatus } : s)); }
  };

  const handleCreateStore = async (e) => {
    e.preventDefault();
    if (!newStoreData.lat || !newStoreData.lng) return alert("Please drop a pin on the map!");
    setIsUploading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/stores`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newStoreData, user_id: user.id }) });
      if (!response.ok) throw new Error("Failed to create store");
      const createdStore = await response.json();
      
      const newTheme = { primaryColor: '#2563EB', layout: 'grid', categoryOrder: [], showPhone: newStoreData.showPhone, showEmail: newStoreData.showEmail, showWebsite: newStoreData.showWebsite, showAddress: newStoreData.showAddress, addressText: newStoreData.addressText };
      await fetch(`${API_BASE_URL}/api/stores/${createdStore.id}/theme`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theme_settings: newTheme }) });

      await fetchStores(user.id);
      setActiveStore(createdStore);
      setIsAddingStore(false);
      setNewStoreData({ store_name: '', store_category: '', industry: '', description: '', phone: '', email: '', website: '', lat: '', lng: '', showPhone: false, showEmail: false, showWebsite: false, showAddress: false, addressText: '' });
    } catch (err) { alert(err.message); } finally { setIsUploading(false); }
  };

  const handleUpdateSettings = async (e) => {
    e.preventDefault(); if (!editStoreData.lat || !editStoreData.lng) return alert("Please drop a pin on the map!"); setIsUploading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/stores/${editStoreData.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          store_name: editStoreData.store_name, store_category: editStoreData.store_category, industry: editStoreData.industry, description: editStoreData.description, 
          phone: editStoreData.phone, email: editStoreData.email, website: editStoreData.website, lat: editStoreData.lat, lng: editStoreData.lng, location: `POINT(${editStoreData.lng} ${editStoreData.lat})`
        })
      });
      if (response.ok) {
        const updatedStore = await response.json();
        const themeUpdate = { ...storeTheme, categoryOrder, showPhone: editStoreData.showPhone, showEmail: editStoreData.showEmail, showWebsite: editStoreData.showWebsite, showAddress: editStoreData.showAddress, addressText: editStoreData.addressText };
        await fetch(`${API_BASE_URL}/api/stores/${editStoreData.id}/theme`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theme_settings: themeUpdate }) });
        const fullyUpdatedStore = { ...updatedStore, theme_settings: themeUpdate };
        setStores(stores.map(s => s.id === fullyUpdatedStore.id ? { ...s, ...fullyUpdatedStore } : s)); setActiveStore({ ...activeStore, ...fullyUpdatedStore }); 
        setIsEditStoreModalOpen(false);
      }
    } catch (err) { alert("Failed to save settings."); } finally { setIsUploading(false); }
  };

  const handleSaveTheme = async () => {
    setIsSavingTheme(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/stores/${activeStore.id}/theme`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theme_settings: { ...storeTheme, categoryOrder } }) });
      if (!response.ok) throw new Error("Failed to save theme");
    } catch (err) { alert(err.message); } finally { setIsSavingTheme(false); }
  };

  const handleDeleteStore = async () => {
    if (deleteConfirmationText !== activeStore.store_name) return; setIsUploading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/stores/${activeStore.id}`, { method: 'DELETE' });
      if (response.ok) { 
        const updatedStores = stores.filter(s => s.id !== activeStore.id); 
        setStores(updatedStores); 
        if (updatedStores.length > 0) { setActiveStore(updatedStores[0]); } else { setActiveStore(null); setIsAddingStore(true); }
        setIsDeleteStoreModalOpen(false); 
        setIsEditStoreModalOpen(false);
      }
    } catch (err) { alert("Failed to delete store."); } finally { setIsUploading(false); }
  };

  const openAddModal = () => { setEditingItemId(null); setNewItem({ name: '', description: '', price: '', category: '', imageFile: null }); setCroppedPreview(null); setIsItemModalOpen(true); };
  const closeItemModal = () => { setIsItemModalOpen(false); setEditingItemId(null); setNewItem({ name: '', description: '', price: '', category: '', imageFile: null }); setCroppedPreview(null); };
  const startEditItem = (item) => { setEditingItemId(item.id); setNewItem({ name: item.item_name, description: item.description || '', price: item.price, category: item.item_category, imageFile: null }); setCroppedPreview(item.image_url || null); setIsItemModalOpen(true); };

  const handleAddItem = async (e) => {
    e.preventDefault(); setIsUploading(true); let finalImageUrl = null;
    if (newItem.imageFile) {
      const fileName = `${Math.random()}.${newItem.imageFile.name.split('.').pop() || 'jpg'}`; const filePath = `${activeStore.id}/${fileName}`;
      await supabase.storage.from('item-images').upload(filePath, newItem.imageFile); finalImageUrl = supabase.storage.from('item-images').getPublicUrl(filePath).data.publicUrl;
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

  const handleRedeemVoucher = async () => {
    if (!voucherCode.trim()) return;
    setVoucherLoading(true); setVoucherMessage(null);
    try {
      const { data: voucher, error: vErr } = await supabase.from('vouchers').select('*').eq('code', voucherCode.toUpperCase()).single();
      if (vErr || !voucher) throw new Error("Invalid voucher code.");
      
      if (voucher.max_uses && voucher.current_uses >= voucher.max_uses) throw new Error("Voucher has reached its limit.");
      if (voucher.valid_until && new Date(voucher.valid_until) < new Date()) throw new Error("Voucher expired.");

      const { data: existing } = await supabase.from('voucher_redemptions').select('*').eq('store_id', activeStore.id).eq('voucher_id', voucher.id).maybeSingle();
      if (existing) throw new Error("Voucher already claimed for this store.");

      let newEndDate = new Date();
      if (subscription?.plan_type === 'premium' && subscription.end_date && new Date(subscription.end_date) > new Date()) {
          newEndDate = new Date(subscription.end_date);
      }
      newEndDate.setDate(newEndDate.getDate() + Number(voucher.discount_value));

      if (subscription?.id) {
         await supabase.from('subscriptions').update({ plan_type: 'premium', status: 'active', end_date: newEndDate.toISOString() }).eq('id', subscription.id);
      } else {
         await supabase.from('subscriptions').insert([{ store_id: activeStore.id, plan_type: 'premium', status: 'active', end_date: newEndDate.toISOString() }]);
      }

      await supabase.from('voucher_redemptions').insert([{ store_id: activeStore.id, voucher_id: voucher.id }]);
      await supabase.from('vouchers').update({ current_uses: voucher.current_uses + 1 }).eq('id', voucher.id);

      setVoucherMessage({ type: 'success', text: `Success! Added ${voucher.discount_value} days to premium.` });
      fetchSubscription(activeStore.id);
      setTimeout(() => setIsVoucherModalOpen(false), 2000);
    } catch (err) { setVoucherMessage({ type: 'error', text: err.message }); } finally { setVoucherLoading(false); }
  };

  const handleProceedToPayment = async () => {
    setIsProcessingPayment(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/create-checkout-session`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ store_id: activeStore.id })
      });
      const data = await res.json();
      if (data.checkoutUrl) window.location.href = data.checkoutUrl;
      else throw new Error(data.error || "Failed to initiate payment");
    } catch (err) { alert("Error initiating payment: " + err.message); setIsProcessingPayment(false); }
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
    if (!window.confirm(`Are you sure you want to remove ${staffEmail} from this store?`)) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/stores/${activeStore.id}/staff/${staffId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error("Failed to remove staff");
      setStoreOperators(storeOperators.filter(op => op.id !== staffId));
    } catch (error) { alert("Error: " + error.message); }
  };

  const groupedItems = items.reduce((groups, item) => { const category = item.item_category || 'Uncategorized'; if (!groups[category]) groups[category] = []; groups[category].push(item); return groups; }, {});
  const isMenuLocked = subscription?.plan_type === 'free' || (subscription?.plan_type === 'premium' && subscription?.end_date && new Date(subscription.end_date) <= new Date());

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', backgroundColor: '#F8FAFC', padding: '30px' }}>
        <div style={{ height: '70px', width: '100%', backgroundColor: '#E2E8F0', borderRadius: '12px', animation: 'pulse 1.5s infinite', marginBottom: '30px' }} />
        <div style={{ height: '240px', width: '100%', maxWidth: '1000px', margin: '0 auto', backgroundColor: '#E2E8F0', borderRadius: '24px', animation: 'pulse 1.5s infinite', marginBottom: '20px' }} />
        <div style={{ display: 'flex', gap: '20px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
           <div style={{ flex: 1, height: '400px', backgroundColor: '#E2E8F0', borderRadius: '20px', animation: 'pulse 1.5s infinite' }} />
           <div style={{ flex: 1, height: '400px', backgroundColor: '#E2E8F0', borderRadius: '20px', animation: 'pulse 1.5s infinite' }} />
        </div>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', backgroundColor: '#F8FAFC', fontFamily: 'Inter, sans-serif', overflowY: 'auto', position: 'relative' }}>
      
      {/* 🚀 Modals */}
      {imageToCrop && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ position: 'relative', flexGrow: 1 }}><Cropper image={imageToCrop} crop={crop} zoom={zoom} aspect={cropType === 'cover' ? 16 / 9 : 4 / 3} onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom} /></div>
          <div style={{ padding: '20px', backgroundColor: 'white', display: 'flex', justifyContent: 'center', gap: '20px', alignItems: 'center' }}>
            <button onClick={() => { setImageToCrop(null); setCropType(null); }} style={{ padding: '10px 20px', backgroundColor: '#EF4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
            <input type="range" value={zoom} min={1} max={3} step={0.1} aria-labelledby="Zoom" onChange={(e) => setZoom(e.target.value)} style={{ width: '200px' }} />
            <button onClick={handleSaveCrop} style={{ padding: '10px 20px', backgroundColor: '#2563EB', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Save Crop</button>
          </div>
        </div>
      )}

      {isVoucherModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '20px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h2 style={{ margin: '0 0 15px 0', fontSize: '20px', color: '#0F172A', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}><MdLocalOffer color="#2563EB" /> Redeem Voucher</h2>
            <input 
              type="text" 
              placeholder="ENTER VIP CODE" 
              value={voucherCode} 
              onChange={e => setVoucherCode(e.target.value.toUpperCase())} 
              style={{ width: '100%', padding: '12px', border: '1px solid #E2E8F0', borderRadius: '10px', boxSizing: 'border-box', marginBottom: '15px', textTransform: 'uppercase' }} 
            />
            {voucherMessage && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '15px', fontSize: '13px', color: voucherMessage.type === 'success' ? '#059669' : '#DC2626', fontWeight: 'bold' }}>
                {voucherMessage.type === 'success' ? <MdCheckCircle size={16} /> : <MdCancel size={16} />} {voucherMessage.text}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setIsVoucherModalOpen(false)} style={{ flex: 1, padding: '12px', backgroundColor: '#F1F5F9', color: '#475569', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleRedeemVoucher} disabled={voucherLoading || !voucherCode.trim()} style={{ flex: 1, padding: '12px', backgroundColor: '#2563EB', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: voucherLoading || !voucherCode.trim() ? 'not-allowed' : 'pointer' }}>{voucherLoading ? 'Redeeming...' : 'Redeem'}</button>
            </div>
          </div>
        </div>
      )}

      {isUpgradeModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '20px', width: '100%', maxWidth: '450px', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h2 style={{ margin: '0 0 10px 0', fontSize: '24px', color: '#0F172A', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>Unlock Premium <MdRocketLaunch color="#2563EB" /></h2>
            <p style={{ color: '#64748B', marginBottom: '25px', fontSize: '14px', lineHeight: '1.5' }}>Get full access to edit your menu, customize your store branding, and accept online orders.</p>
            <button onClick={() => { setIsUpgradeModalOpen(false); setIsVoucherModalOpen(true); }} style={{ width: '100%', padding: '14px', backgroundColor: '#2563EB', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '15px', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><MdLocalOffer size={18} /> Redeem Voucher Code</button>
            <button onClick={handleProceedToPayment} disabled={isProcessingPayment} style={{ width: '100%', padding: '14px', backgroundColor: '#F8FAFC', color: '#0F172A', border: '1px solid #E2E8F0', borderRadius: '12px', fontWeight: 'bold', cursor: isProcessingPayment ? 'not-allowed' : 'pointer', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><MdPayment size={18} /> {isProcessingPayment ? 'Redirecting...' : 'Pay via GCash / Maya'}</button>
            <button onClick={() => setIsUpgradeModalOpen(false)} style={{ marginTop: '20px', background: 'none', border: 'none', color: '#94A3B8', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* 🚀 Edit Store Profile Modal */}
      {isEditStoreModalOpen && activeStore && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '20px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', color: '#0F172A', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}><MdSettings color="#2563EB" /> Edit Store Profile</h2>
              <button onClick={() => setIsEditStoreModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '24px', cursor: 'pointer', lineHeight: '1' }}><MdClose /></button>
            </div>
            
            <form onSubmit={handleUpdateSettings} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '5px' }}>Store Name</label>
                <input type="text" placeholder="Store Name" required value={editStoreData.store_name} onChange={(e) => setEditStoreData({...editStoreData, store_name: e.target.value})} style={{ padding: '12px', border: '1px solid #E2E8F0', borderRadius: '10px', width: '100%', boxSizing: 'border-box' }} />
              </div>
              
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '5px' }}>Category</label>
                  <select required value={editStoreData.store_category} onChange={(e) => setEditStoreData({...editStoreData, store_category: e.target.value, industry: ''})} style={{ width: '100%', padding: '12px', border: '1px solid #E2E8F0', borderRadius: '10px', boxSizing: 'border-box', backgroundColor: 'white' }}>
                    <option value="" disabled>Select Category</option>
                    {Object.keys(BUSINESS_TAXONOMY).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '5px' }}>Industry</label>
                  <select required value={editStoreData.industry} onChange={(e) => setEditStoreData({...editStoreData, industry: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #E2E8F0', borderRadius: '10px', boxSizing: 'border-box', backgroundColor: 'white' }} disabled={!editStoreData.store_category}>
                    <option value="" disabled>Select Industry</option>
                    {editStoreData.store_category && BUSINESS_TAXONOMY[editStoreData.store_category]?.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '5px' }}>Store Description</label>
                <textarea placeholder="Store Description (Optional)" value={editStoreData.description} onChange={(e) => setEditStoreData({...editStoreData, description: e.target.value})} style={{ padding: '12px', border: '1px solid #E2E8F0', borderRadius: '10px', width: '100%', boxSizing: 'border-box', minHeight: '80px', fontFamily: 'inherit' }} />
              </div>
              
              <div style={{ padding: '15px', backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#374151' }}>Contact Details</h4>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', marginBottom: editStoreData.showPhone ? '10px' : '5px', fontWeight: 'bold' }}><input type="checkbox" checked={editStoreData.showPhone} onChange={(e) => setEditStoreData({...editStoreData, showPhone: e.target.checked})} /> Show Phone Number</label>
                {editStoreData.showPhone && (
                  <div style={{ marginBottom: '15px' }}>
                    <input type="tel" pattern="[0-9]*" placeholder="e.g. 09123456789" value={editStoreData.phone} onChange={(e) => setEditStoreData({...editStoreData, phone: e.target.value.replace(/\D/g, '')})} style={{ padding: '10px', border: '1px solid #E2E8F0', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }} />
                  </div>
                )}
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', marginBottom: editStoreData.showEmail ? '10px' : '5px', fontWeight: 'bold' }}><input type="checkbox" checked={editStoreData.showEmail} onChange={(e) => setEditStoreData({...editStoreData, showEmail: e.target.checked})} /> Show Email</label>
                {editStoreData.showEmail && (
                  <div style={{ marginBottom: '15px' }}>
                    <input type="email" placeholder="Business Email" value={editStoreData.email} onChange={(e) => setEditStoreData({...editStoreData, email: e.target.value})} style={{ padding: '10px', border: '1px solid #E2E8F0', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }} />
                  </div>
                )}

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', marginBottom: editStoreData.showWebsite ? '10px' : '5px', fontWeight: 'bold' }}><input type="checkbox" checked={editStoreData.showWebsite} onChange={(e) => setEditStoreData({...editStoreData, showWebsite: e.target.checked})} /> Show Website Link</label>
                {editStoreData.showWebsite && (
                  <div style={{ marginBottom: '15px' }}>
                    <input type="url" placeholder="https://yourstore.com" value={editStoreData.website} onChange={(e) => setEditStoreData({...editStoreData, website: e.target.value})} style={{ padding: '10px', border: '1px solid #E2E8F0', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }} />
                  </div>
                )}
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', marginBottom: editStoreData.showAddress ? '10px' : '0', fontWeight: 'bold' }}><input type="checkbox" checked={editStoreData.showAddress} onChange={async (e) => { const checked = e.target.checked; let text = editStoreData.addressText; if (checked && !text && editStoreData.lng) text = await fetchAddressFromCoords(editStoreData.lng, editStoreData.lat); setEditStoreData({...editStoreData, showAddress: checked, addressText: text}); }} /> Show Exact Street Address</label>
                {editStoreData.showAddress && (
                  <div style={{ marginTop: '10px' }}>
                    <input type="text" placeholder="Auto-detects when you drop a pin below" value={editStoreData.addressText} onChange={(e) => setEditStoreData({...editStoreData, addressText: e.target.value})} style={{ padding: '10px', border: '1px solid #E2E8F0', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }} />
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '8px' }}>Store Location (Drag map to move pin)</label>
                <div style={{ position: 'relative', width: '100%', height: '240px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #E2E8F0' }}>
                  <div ref={editMapContainer} style={{ position: 'absolute', inset: 0 }} />
                  <div style={{ position: 'absolute', bottom: '10px', right: '10px', zIndex: 10 }}>
                    <button type="button" onClick={() => handleLocateMerchant(editMap, true)} style={{ width: '36px', height: '36px', backgroundColor: '#FFFFFF', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', border: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.15)', cursor: 'pointer' }}><MdOutlineNearMe size={20} color="#2563EB" style={{ transform: 'translate(-1px, 1px)' }} /></button>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', gap: '15px' }}>
                 <button type="submit" disabled={isUploading} style={{ flex: 1, padding: '14px', backgroundColor: '#2563EB', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: isUploading ? 'not-allowed' : 'pointer' }}>
                   {isUploading ? 'Saving...' : 'Save Profile Changes'}
                 </button>
                 {activeStore.merchant_id === user?.id && (
                   <button type="button" onClick={() => setIsDeleteStoreModalOpen(true)} style={{ padding: '14px 20px', backgroundColor: '#EF4444', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                     <MdDelete size={18} /> Delete Store
                   </button>
                 )}
              </div>
            </form>
          </div>
        </div>
      )}

      {isItemModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '20px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', color: '#0F172A', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>{editingItemId ? <><MdEdit color="#2563EB" /> Edit Item</> : <><MdAdd color="#2563EB" /> Add New Item</>}</h2>
              <button onClick={closeItemModal} style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '24px', cursor: 'pointer', lineHeight: '1' }}><MdClose /></button>
            </div>
            <form onSubmit={handleAddItem} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                <div style={{ flex: '2 1 200px' }}><label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#64748B', marginBottom: '4px' }}>Item Name</label><input type="text" placeholder="Item Name" required value={newItem.name} onChange={(e) => setNewItem({...newItem, name: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #E2E8F0', borderRadius: '10px', boxSizing: 'border-box' }} /></div>
                <div style={{ flex: '1 1 100px' }}><label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#64748B', marginBottom: '4px' }}>Price (₱)</label><input type="number" step="0.01" placeholder="Price" required value={newItem.price} onChange={(e) => setNewItem({...newItem, price: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #E2E8F0', borderRadius: '10px', boxSizing: 'border-box' }} /></div>
              </div>
              <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                <div style={{ flex: '2 1 200px' }}><label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#64748B', marginBottom: '4px' }}>Description (Optional)</label><input type="text" placeholder="Brief details about the item..." value={newItem.description} onChange={(e) => setNewItem({...newItem, description: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #E2E8F0', borderRadius: '10px', boxSizing: 'border-box' }} /></div>
                <div style={{ flex: '1 1 150px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#64748B', marginBottom: '4px' }}>Category Menu</label>
                  <input type="text" list="category-suggestions" placeholder="Category" required value={newItem.category} onChange={(e) => setNewItem({...newItem, category: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #E2E8F0', borderRadius: '10px', boxSizing: 'border-box' }} />
                  <datalist id="category-suggestions"><option value="General" /><option value="Best Sellers" /><option value="Promos" /></datalist>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', padding: '15px', backgroundColor: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: '12px', flexWrap: 'wrap', gap: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  {croppedPreview ? (
                    <div style={{ position: 'relative' }}>
                      <img src={croppedPreview} alt="Preview" style={{ width: '120px', height: '90px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #E2E8F0' }} />
                      <button type="button" onClick={() => { setCroppedPreview(null); setNewItem({...newItem, imageFile: null}) }} style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#EF4444', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MdClose /></button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <div><label htmlFor="item-upload" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px', backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', color: '#475569' }}><MdCameraAlt size={16} color="#2563EB" /> Upload Image</label><input id="item-upload" type="file" accept="image/*" onChange={onItemFileSelect} style={{ display: 'none' }} /></div>
                    </div>
                  )}
                </div>
                <button type="submit" disabled={isUploading} style={{ padding: '10px 24px', backgroundColor: editingItemId ? '#F59E0B' : '#2563EB', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: isUploading ? 'not-allowed' : 'pointer' }}>{isUploading ? 'Saving...' : (editingItemId ? 'Update Item' : 'Save New Item')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleteStoreModalOpen && activeStore && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '20px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h2 style={{ margin: '0 0 15px 0', fontSize: '20px', color: '#DC2626', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}><MdWarning /> Delete Store</h2>
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

      {/* 🚀 TOP HEADER: Horizontal Scrollable Store Selector (Drag Enabled) */}
      <div style={{ height: '70px', boxSizing: 'border-box', position: 'sticky', top: 0, zIndex: 40, backgroundColor: '#FFFFFF', padding: '0 30px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', overflow: 'hidden', flexGrow: 1, marginRight: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#0F172A', paddingRight: '15px', borderRight: '1px solid #E2E8F0', flexShrink: 0 }}>Hub</h2>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', overflow: 'hidden', flexGrow: 1 }}>
            {showStoreLeft && (
              <button onClick={() => storeScrollRef.current.scrollBy({ left: -200, behavior: 'smooth' })} style={{ position: 'absolute', left: 0, zIndex: 5, background: 'linear-gradient(to right, white 70%, transparent)', border: 'none', height: '100%', padding: '0 10px 0 0', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><MdChevronLeft size={24} color="#0F172A" /></button>
            )}
            <div 
              ref={storeScrollRef} 
              onScroll={checkHeaderScroll} 
              onMouseDown={handleHeaderMouseDown}
              onMouseLeave={handleHeaderMouseLeave}
              onMouseUp={handleHeaderMouseUp}
              onMouseMove={handleHeaderMouseMove}
              style={{ display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none', padding: '5px 0', width: '100%', cursor: 'grab', userSelect: 'none' }}
            >
              {stores.map(s => (
                <button key={s.id} onClick={() => { setActiveStore(s); setIsAddingStore(false); }} style={{ flexShrink: 0, padding: '8px 16px', borderRadius: '20px', backgroundColor: activeStore?.id === s.id && !isAddingStore ? '#2563EB' : 'transparent', color: activeStore?.id === s.id && !isAddingStore ? 'white' : '#64748B', border: activeStore?.id === s.id && !isAddingStore ? '1px solid transparent' : '1px solid #E2E8F0', fontWeight: '700', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap', boxShadow: activeStore?.id === s.id && !isAddingStore ? '0 4px 10px rgba(37,99,235,0.2)' : 'none' }}>{s.store_name}</button>
              ))}
              <button onClick={() => { setIsAddingStore(true); setActiveStore(null); }} style={{ flexShrink: 0, padding: '8px 16px', borderRadius: '20px', backgroundColor: isAddingStore ? '#2563EB' : '#EFF6FF', color: isAddingStore ? 'white' : '#2563EB', border: isAddingStore ? '1px solid transparent' : '1px dashed #BFDBFE', fontWeight: '700', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}><MdAdd size={16} /> Add Store</button>
            </div>
            {showStoreRight && (
              <button onClick={() => storeScrollRef.current.scrollBy({ left: 200, behavior: 'smooth' })} style={{ position: 'absolute', right: 0, zIndex: 5, background: 'linear-gradient(to left, white 70%, transparent)', border: 'none', height: '100%', padding: '0 0 0 10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><MdChevronRight size={24} color="#0F172A" /></button>
            )}
          </div>
        </div>
        <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#EF4444', fontWeight: '700', cursor: 'pointer', fontSize: '14px', flexShrink: 0 }}>Sign Out</button>
      </div>


      {/* 🚀 MAIN CONTENT AREA */}
      <div ref={scrollContainerRef} onScroll={handleScroll} style={{ flexGrow: 1, padding: '30px', paddingBottom: '90px', position: 'relative', overflowY: 'auto' }}>
        
        {/* ADD STORE VIEW */}
        {isAddingStore && (
          <div style={{ width: '100%', maxWidth: '1000px', margin: '0 auto', display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 400px', backgroundColor: 'white', padding: '30px', borderRadius: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.02)', border: '1px solid #E2E8F0' }}>
              <h2 style={{ marginTop: 0, color: '#0F172A', fontSize: '24px', fontWeight: '900' }}>Register New Location</h2>
              <form onSubmit={handleCreateStore} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#64748B', marginBottom: '4px' }}>Store Name</label>
                  <input type="text" placeholder="Store Name" required value={newStoreData.store_name} onChange={e => setNewStoreData({...newStoreData, store_name: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #E2E8F0', boxSizing: 'border-box' }} />
                </div>
                
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#64748B', marginBottom: '4px' }}>Category</label>
                    <select required value={newStoreData.store_category} onChange={e => setNewStoreData({...newStoreData, store_category: e.target.value, industry: ''})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #E2E8F0', backgroundColor: 'white', boxSizing: 'border-box' }}>
                       <option value="" disabled>Select...</option>
                       {Object.keys(BUSINESS_TAXONOMY).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#64748B', marginBottom: '4px' }}>Industry</label>
                    <select required disabled={!newStoreData.store_category} value={newStoreData.industry} onChange={e => setNewStoreData({...newStoreData, industry: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #E2E8F0', backgroundColor: 'white', boxSizing: 'border-box' }}>
                       <option value="" disabled>Select...</option>
                       {newStoreData.store_category && BUSINESS_TAXONOMY[newStoreData.store_category].map(ind => <option key={ind} value={ind}>{ind}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#64748B', marginBottom: '4px' }}>Store Description (Optional)</label>
                  <textarea placeholder="Brief summary of your business..." value={newStoreData.description} onChange={(e) => setNewStoreData({...newStoreData, description: e.target.value})} style={{ padding: '12px', border: '1px solid #E2E8F0', borderRadius: '10px', width: '100%', boxSizing: 'border-box', minHeight: '80px', fontFamily: 'inherit' }} />
                </div>
                
                <div style={{ padding: '15px', backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#374151' }}>Profile Contact Buttons</h4>
                  
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', marginBottom: newStoreData.showPhone ? '10px' : '5px', fontWeight: 'bold' }}><input type="checkbox" checked={newStoreData.showPhone} onChange={(e) => setNewStoreData({...newStoreData, showPhone: e.target.checked})} /> Show Phone Number</label>
                  {newStoreData.showPhone && (
                    <div style={{ marginBottom: '15px' }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#64748B', marginBottom: '4px' }}>Phone Number</label>
                      <input type="tel" pattern="[0-9]*" placeholder="e.g. 09123456789" value={newStoreData.phone} onChange={e => setNewStoreData({...newStoreData, phone: e.target.value.replace(/\D/g, '')})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0', width: '100%', boxSizing: 'border-box' }} />
                    </div>
                  )}
                  
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', marginBottom: newStoreData.showEmail ? '10px' : '5px', fontWeight: 'bold' }}><input type="checkbox" checked={newStoreData.showEmail} onChange={(e) => setNewStoreData({...newStoreData, showEmail: e.target.checked})} /> Show Email Address</label>
                  {newStoreData.showEmail && (
                    <div style={{ marginBottom: '15px' }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#64748B', marginBottom: '4px' }}>Business Email</label>
                      <input type="email" placeholder="store@example.com" value={newStoreData.email} onChange={e => setNewStoreData({...newStoreData, email: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0', width: '100%', boxSizing: 'border-box' }} />
                    </div>
                  )}

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', marginBottom: newStoreData.showWebsite ? '10px' : '5px', fontWeight: 'bold' }}><input type="checkbox" checked={newStoreData.showWebsite} onChange={(e) => setNewStoreData({...newStoreData, showWebsite: e.target.checked})} /> Show Website Link</label>
                  {newStoreData.showWebsite && (
                    <div style={{ marginBottom: '15px' }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#64748B', marginBottom: '4px' }}>Website URL</label>
                      <input type="url" placeholder="https://yourstore.com" value={newStoreData.website} onChange={e => setNewStoreData({...newStoreData, website: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0', width: '100%', boxSizing: 'border-box' }} />
                    </div>
                  )}

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', marginBottom: newStoreData.showAddress ? '10px' : '0', fontWeight: 'bold' }}><input type="checkbox" checked={newStoreData.showAddress} onChange={async (e) => { const checked = e.target.checked; let text = newStoreData.addressText; if (checked && !text && newStoreData.lng) text = await fetchAddressFromCoords(newStoreData.lng, newStoreData.lat); setNewStoreData({...newStoreData, showAddress: checked, addressText: text}); }} /> Show Exact Street Address</label>
                  {newStoreData.showAddress && (
                    <div style={{ marginTop: '10px' }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#64748B', marginBottom: '4px' }}>Store Address</label>
                      <input type="text" placeholder="Auto-detects when you drop a pin" value={newStoreData.addressText} onChange={(e) => setNewStoreData({...newStoreData, addressText: e.target.value})} style={{ padding: '10px', border: '1px solid #E2E8F0', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }} />
                    </div>
                  )}
                </div>

                <button type="submit" disabled={isUploading} style={{ padding: '14px', backgroundColor: '#2563EB', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}>{isUploading ? 'Saving...' : 'Confirm Store'}</button>
              </form>
            </div>

            <div style={{ flex: '1 1 400px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '20px', backgroundColor: 'white', borderRadius: '20px 20px 0 0', border: '1px solid #E2E8F0', borderBottom: 'none' }}>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#0F172A', fontWeight: '800' }}>Drop a Pin Location</h3>
              </div>
              <div style={{ flexGrow: 1, position: 'relative', minHeight: '400px', borderRadius: '0 0 20px 20px', overflow: 'hidden', border: '1px solid #E2E8F0' }}>
                <div ref={addMapContainer} style={{ position: 'absolute', inset: 0 }} />
                <div style={{ position: 'absolute', bottom: '20px', right: '20px', zIndex: 10 }}>
                   <button type="button" onClick={() => handleLocateMerchant(addMap, false)} style={{ width: '44px', height: '44px', backgroundColor: '#FFFFFF', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.15)', cursor: 'pointer' }}><MdOutlineNearMe size={24} color="#2563EB" style={{ transform: 'translate(-1px, 1px)' }} /></button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DASHBOARD VIEW */}
        {!isAddingStore && activeStore && (
          <div style={{ width: '100%', maxWidth: '1000px', margin: '0 auto' }}>
            
            <div style={{ width: '100%', height: '240px', borderRadius: '24px', overflow: 'hidden', backgroundImage: `url(${getStoreCoverImage(activeStore)})`, backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative', marginBottom: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)' }} />
              
              <div style={{ position: 'absolute', top: '20px', right: '20px' }}>
                 <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(4px)', color: '#0F172A', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', cursor: isUploadingCover ? 'not-allowed' : 'pointer', border: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                    {isUploadingCover ? 'Uploading...' : <><MdCameraAlt size={16} color="#2563EB" /> Edit Cover</>}
                    <input type="file" accept="image/*" onChange={onCoverFileSelect} disabled={isUploadingCover} style={{ display: 'none' }} />
                 </label>
              </div>

              <div style={{ position: 'absolute', bottom: '20px', left: '30px', right: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '15px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h1 style={{ margin: 0, fontSize: '36px', color: 'white', fontWeight: '900', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>{activeStore.store_name}</h1>
                    {activeStore.role === 'operator' && <span style={{ padding: '4px 8px', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid #34d399', fontSize: '12px', fontWeight: 'bold', borderRadius: '6px' }}>STAFF</span>}
                  </div>
                  <p style={{ margin: '5px 0 0 0', color: '#d1d5db', fontSize: '15px', fontWeight: 'bold' }}>{activeStore.industry || activeStore.store_category}</p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', backgroundColor: '#1E293B', padding: '10px 20px', borderRadius: '50px', border: '1px solid #334155', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>
                  <span style={{ fontWeight: '800', fontSize: '13px', color: activeStore.is_open ? '#10B981' : '#64748B', transition: 'color 0.3s' }}>OPEN</span>
                  <div onClick={toggleStoreStatus} style={{ width: '48px', height: '24px', backgroundColor: activeStore.is_open ? '#10B981' : '#475569', borderRadius: '24px', position: 'relative', cursor: 'pointer', transition: 'background-color 0.3s' }}>
                    <div style={{ width: '20px', height: '20px', backgroundColor: 'white', borderRadius: '50%', position: 'absolute', top: '2px', left: activeStore.is_open ? '26px' : '2px', transition: 'left 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
                  </div>
                  <span style={{ fontWeight: '800', fontSize: '13px', color: !activeStore.is_open ? '#EF4444' : '#64748B', transition: 'color 0.3s' }}>CLOSED</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '1px solid #E2E8F0', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', scrollbarWidth: 'none' }}>
                {['menu', 'staff', 'preview'].map(tab => {
                  const labels = { menu: <><MdDashboard size={18} /> Dashboard & Menu</>, staff: <><MdPeople size={18} /> Staff Access</>, preview: <><MdSmartphone size={18} /> Live Preview</> };
                  const isActive = activeTab === tab;
                  
                  return (
                    <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '10px 20px', borderRadius: '20px', backgroundColor: isActive ? '#0F172A' : 'transparent', color: isActive ? 'white' : '#64748B', border: 'none', fontWeight: '800', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {labels[tab]}
                    </button>
                  );
                })}
              </div>
              
              <button onClick={() => {
                setEditStoreData({ 
                  ...editStoreData, id: activeStore.id, store_name: activeStore.store_name, store_category: activeStore.store_category, 
                  industry: activeStore.industry || '', description: activeStore.description || '', phone: activeStore.phone || '', 
                  email: activeStore.email || '', website: activeStore.website || '', lat: activeStore.lat, lng: activeStore.lng, 
                  showPhone: !!activeStore.theme_settings?.showPhone, showEmail: !!activeStore.theme_settings?.showEmail, 
                  showWebsite: !!activeStore.theme_settings?.showWebsite, showAddress: !!activeStore.theme_settings?.showAddress, 
                  addressText: activeStore.theme_settings?.addressText || '' 
                });
                setIsEditStoreModalOpen(true);
              }} style={{ padding: '8px 16px', backgroundColor: '#EFF6FF', color: '#2563EB', border: '1px dashed #BFDBFE', borderRadius: '10px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MdEdit size={16} /> Edit Store Info
              </button>
            </div>

            {/* TAB 1: DASHBOARD */}
            {activeTab === 'menu' && (
              <div>
                
                {/* Store Branding Section (Visible only to owners/merchants) */}
                {activeStore.merchant_id === user?.id && (
                  <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, backgroundColor: 'white', padding: '25px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', border: '1px solid #E2E8F0', minWidth: '300px' }}>
                      <h3 style={{ margin: '0 0 15px 0', color: '#0F172A', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><MdSettings color="#64748B" /> Storefront Branding</h3>
                      <p style={{ margin: '0 0 15px 0', color: '#64748B', fontSize: '12px' }}>Drag and drop categories below to set sorting, set your color, then click save!</p>
                      <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#64748B', marginBottom: '5px' }}>BRAND COLOR</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><input type="color" value={storeTheme.primaryColor} onChange={(e) => setStoreTheme({...storeTheme, primaryColor: e.target.value})} style={{ width: '40px', height: '40px', padding: 0, border: 'none', borderRadius: '8px', cursor: 'pointer' }} /><span style={{ fontSize: '14px', fontWeight: 'bold', color: '#374151' }}>{storeTheme.primaryColor.toUpperCase()}</span></div>
                        </div>
                      </div>
                      <button onClick={handleSaveTheme} disabled={isSavingTheme} style={{ width: '100%', padding: '10px', backgroundColor: '#0F172A', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: isSavingTheme ? 'not-allowed' : 'pointer' }}>{isSavingTheme ? 'Saving...' : 'Save Theme & Sorting'}</button>
                    </div>
                  </div>
                )}

                {/* Manage Items */}
                <div style={{ position: 'relative' }}>
                  {isMenuLocked && (
                    <div style={{ position: 'absolute', inset: 0, zIndex: 10, backgroundColor: 'rgba(248, 250, 252, 0.7)', backdropFilter: 'blur(6px)', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '20px', flexDirection: 'column' }}>
                      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: '1px solid #E2E8F0', textAlign: 'center', maxWidth: '350px' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}><MdSecurity size={40} color="#94A3B8" /></div>
                        <h3 style={{ margin: '0 0 10px 0', color: '#0F172A', fontSize: '18px', fontWeight: '800' }}>Menu Locked</h3>
                        <p style={{ margin: '0 0 20px 0', color: '#64748B', fontSize: '14px' }}>Redeem a voucher or upgrade your plan to access and edit your digital catalog.</p>
                        <button onClick={() => setIsUpgradeModalOpen(true)} style={{ width: '100%', padding: '12px', backgroundColor: '#2563EB', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Upgrade or Redeem Code</button>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h2 style={{ margin: '0 0 0 0', fontSize: '20px', color: '#0F172A', fontWeight: '800' }}>Manage Menu & Products</h2>
                    <button onClick={openAddModal} disabled={isMenuLocked} style={{ padding: '10px 20px', backgroundColor: isMenuLocked ? '#94A3B8' : '#2563EB', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: isMenuLocked ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}><MdAdd size={18} /> Add Item</button>
                  </div>

                  {/* 🚀 STICKY CATEGORIES HEADER (Pinned under Store Header) */}
                  {categoryOrder.length > 0 && (
                    <div style={{ position: 'sticky', top: '70px', zIndex: 30, backgroundColor: '#F8FAFC', padding: '10px 0', margin: '0 -10px', paddingLeft: '10px', paddingRight: '10px' }}>
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToHorizontalAxis]}>
                        <div style={{ display: 'flex', gap: '10px', padding: '10px', overflowX: 'auto', backgroundColor: '#E2E8F0', borderRadius: '16px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)', scrollbarWidth: 'none' }}>
                          <SortableContext items={categoryOrder} strategy={horizontalListSortingStrategy}>
                            {categoryOrder.map(cat => <SortableCategory key={cat} id={cat} activeCategory={activeCategory} brandColor={storeTheme.primaryColor} onClick={scrollToCategory} />)}
                          </SortableContext>
                        </div>
                      </DndContext>
                    </div>
                  )}

                  <div style={{ backgroundColor: 'white', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {Object.keys(groupedItems).length === 0 ? (
                        <div style={{ padding: '60px 40px', textAlign: 'center', color: '#94A3B8', fontStyle: 'italic', fontWeight: '500', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}><MdRestaurantMenu size={32} /> Your menu is currently empty.</div>
                      ) : (
                        categoryOrder.map(category => {
                          if (!groupedItems[category]) return null;
                          return (
                            <div key={category} ref={(el) => (sectionRefs.current[category] = el)}>
                              <div style={{ padding: '12px 30px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', borderTop: '1px solid #E2E8F0' }}><h3 style={{ margin: '0', fontSize: '13px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>{category}</h3></div>
                              {groupedItems[category].map(item => (
                                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 30px', borderBottom: '1px solid #F8FAFC' }}>
                                  <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                                    {item.image_url ? <img src={item.image_url} alt={item.item_name} style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '10px' }} /> : <div style={{ width: '80px', height: '60px', backgroundColor: '#F1F5F9', borderRadius: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#CBD5E1' }}><MdRestaurantMenu size={24} /></div>}
                                    <div><h4 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#0F172A', fontWeight: '800' }}>{item.item_name}</h4><p style={{ margin: '0', color: '#64748B', fontSize: '13px', fontWeight: '500' }}>{item.description}</p></div>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>₱{parseFloat(item.price).toFixed(2)}</div>
                                    <div style={{ display: 'flex', gap: '5px', marginLeft: '10px' }}>
                                      <button onClick={() => startEditItem(item)} disabled={isMenuLocked} style={{ background: '#EFF6FF', color: '#2563EB', border: 'none', padding: '8px', borderRadius: '8px', cursor: isMenuLocked ? 'not-allowed' : 'pointer' }}><MdEdit size={16} /></button>
                                      <button onClick={() => handleDeleteItem(item.id, item.item_name)} disabled={isMenuLocked} style={{ background: '#FEF2F2', color: '#EF4444', border: 'none', padding: '8px', borderRadius: '8px', cursor: isMenuLocked ? 'not-allowed' : 'pointer' }}><MdDelete size={16} /></button>
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

            {/* TAB 2: STAFF ACCESS */}
            {activeTab === 'staff' && (
              <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '20px', border: '1px solid #E2E8F0' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#0F172A', fontSize: '18px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}><MdSecurity color="#2563EB" /> Operator Access</h3>
                <p style={{ margin: '0 0 20px 0', color: '#64748B', fontSize: '14px' }}>Invite trusted staff to manage inventory and open/close the store.</p>
                <form onSubmit={handleInviteOperator} style={{ display: 'flex', gap: '10px', marginBottom: '30px', maxWidth: '400px' }}>
                  <input type="email" placeholder="Staff Email Address" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} style={{ padding: '12px 15px', borderRadius: '10px', border: '1px solid #CBD5E1', flexGrow: 1, outline: 'none' }} />
                  <button type="submit" disabled={isInviting} style={{ padding: '12px 20px', backgroundColor: '#2563EB', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: isInviting ? 'not-allowed' : 'pointer' }}>{isInviting ? 'Sending...' : 'Invite'}</button>
                </form>
                {inviteMessage && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 'bold', padding: '12px', borderRadius: '10px', marginBottom: '20px', backgroundColor: inviteMessage.type === 'success' ? '#D1FAE5' : '#FEE2E2', color: inviteMessage.type === 'success' ? '#059669' : '#DC2626' }}>
                    {inviteMessage.type === 'success' ? <MdCheckCircle size={18} /> : <MdCancel size={18} />} {inviteMessage.text}
                  </div>
                )}
                
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead><tr style={{ borderBottom: '2px solid #E2E8F0', color: '#64748B', fontSize: '13px' }}><th style={{ padding: '12px 0' }}>User Email</th><th style={{ padding: '12px 0' }}>Status</th><th style={{ padding: '12px 0', textAlign: 'right' }}>Action</th></tr></thead>
                  <tbody>
                    {storeOperators.map((op, idx) => {
                      // 🚀 Identify if the current row belongs to the merchant/owner
                      const isCurrentUserOwner = activeStore.role === 'merchant' && op.email === user?.email;
                      const isOwner = op.role === 'merchant' || isCurrentUserOwner;

                      return (
                        <tr key={op.id || idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '16px 0', fontWeight: '600', color: '#0F172A' }}>{op.email}</td>
                          <td style={{ padding: '16px 0' }}>
                            <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '12px', backgroundColor: isOwner ? '#EFF6FF' : (op.status === 'pending' ? '#FEF3C7' : '#D1FAE5'), color: isOwner ? '#2563EB' : (op.status === 'pending' ? '#D97706' : '#059669'), fontWeight: 'bold' }}>
                              {isOwner ? 'STORE OWNER' : (op.status === 'pending' ? 'PENDING' : 'ACTIVE STAFF')}
                            </span>
                          </td>
                          <td style={{ padding: '16px 0', textAlign: 'right' }}>
                            {!isOwner && op.status !== 'pending' && <button onClick={() => handleRemoveStaff(op.id, op.email)} style={{ padding: '6px 12px', backgroundColor: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>Remove</button>}
                          </td>
                        </tr>
                      );
                    })}
                    {storeOperators.length === 0 && <tr><td colSpan="3" style={{ padding: '20px 0', textAlign: 'center', color: '#94A3B8' }}>No staff members added yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB 3: LIVE PREVIEW */}
            {activeTab === 'preview' && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', backgroundColor: '#F1F5F9', borderRadius: '24px', border: '1px dashed #CBD5E1' }}>
                <div style={{ width: '375px', height: '700px', backgroundColor: 'white', borderRadius: '40px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '8px solid #0F172A', overflowY: 'auto', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ height: '30px', width: '100%', backgroundColor: 'rgba(0,0,0,0.2)', position: 'absolute', top: 0, zIndex: 10, borderRadius: '32px 32px 0 0' }} />
                  <div style={{ height: '200px', backgroundImage: `url(${getStoreCoverImage(activeStore)})`, backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative' }}>
                     <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)' }} />
                     <div style={{ position: 'absolute', top: '10px', right: '10px', backgroundColor: activeStore.is_open ? 'rgba(209, 250, 229, 0.85)' : 'rgba(254, 242, 242, 0.85)', backdropFilter: 'blur(4px)', padding: '4px 10px', borderRadius: '6px', boxShadow: '0 2px 6px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '10.5px', fontWeight: '700', color: activeStore.is_open ? '#059669' : '#E11D48', textTransform: 'capitalize', letterSpacing: '0.2px' }}>{activeStore.is_open ? 'Open' : 'Closed'}</span>
                     </div>
                     <div style={{ position: 'absolute', bottom: '15px', left: '20px' }}>
                        <h2 style={{ color: 'white', margin: 0, fontSize: '24px', fontWeight: '900' }}>{activeStore.store_name}</h2>
                        <p style={{ color: '#E2E8F0', margin: 0, fontSize: '13px' }}>{activeStore.industry || activeStore.store_category}</p>
                     </div>
                  </div>
                  <div style={{ padding: '20px', flexGrow: 1, backgroundColor: '#F8FAFC' }}>
                     <p style={{ color: '#475569', fontSize: '14px', margin: '0 0 20px 0', lineHeight: '1.5' }}>{editStoreData.description || "No description provided."}</p>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                       <h3 style={{ margin: 0, fontSize: '16px', color: '#0F172A' }}>Menu Highlights</h3>
                       <span style={{ color: storeTheme.primaryColor, fontWeight: 'bold', fontSize: '13px' }}>View All</span>
                     </div>
                     {items.slice(0, 3).map(item => (
                       <div key={item.id} style={{ display: 'flex', gap: '15px', padding: '15px', backgroundColor: 'white', borderRadius: '16px', marginBottom: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                          {item.image_url ? <img src={item.image_url} alt="item" style={{ width: '60px', height: '60px', borderRadius: '10px', objectFit: 'cover' }} /> : <div style={{ width: '60px', height: '60px', backgroundColor: '#F1F5F9', borderRadius: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#CBD5E1' }}><MdRestaurantMenu size={24} /></div>}
                          <div style={{ flexGrow: 1 }}>
                             <h4 style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#0F172A' }}>{item.item_name}</h4>
                             <p style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: storeTheme.primaryColor }}>₱{item.price}</p>
                          </div>
                       </div>
                     ))}
                     {items.length === 0 && <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: '13px', marginTop: '40px' }}>No items uploaded yet.</p>}
                  </div>
                  <div style={{ position: 'absolute', bottom: '20px', right: '20px', width: '50px', height: '50px', borderRadius: '25px', backgroundColor: storeTheme.primaryColor, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', boxShadow: `0 4px 10px ${storeTheme.primaryColor}80` }}>
                    <MdSmartphone size={24} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}