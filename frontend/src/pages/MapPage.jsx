import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { renderToString } from 'react-dom/server';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '../supabaseClient';
import { CustomMapPin } from '../components/MapMarkers';
import { useTheme } from '../components/ThemeContext';
import NotificationBell from '../components/NotificationBell'; 
import { 
  MdSearch, MdTune, MdExpandMore, MdLocationOn, 
  MdStorefront, MdFastfood, MdClose, MdStar, MdChevronLeft, 
  MdChevronRight, MdOutlineNearMe, MdDarkMode, MdLightMode, MdPersonOutline,
  MdSpa, MdLocalHospital, MdDirectionsCar, MdHotel, MdHomeRepairService, MdAttachMoney
} from "react-icons/md";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';
if (MAPBOX_TOKEN) { mapboxgl.accessToken = MAPBOX_TOKEN; }

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://locallook-api.onrender.com';

let globalStoreCache = [];

const TABLAS_MUNICIPALITIES = [
  { name: 'Odiongan', lat: 12.3985, lng: 121.9823 }, 
  { name: 'San Andres', lat: 12.5367, lng: 122.0163 }, 
  { name: 'Calatrava', lat: 12.6074, lng: 122.0628 }, 
  { name: 'San Agustin', lat: 12.5606, lng: 122.1331 }, 
  { name: 'Santa Maria', lat: 12.4334, lng: 122.1051 }, 
  { name: 'Alcantara', lat: 12.2570, lng: 122.0543 }, 
  { name: 'Looc', lat: 12.2605, lng: 121.9904 }, 
  { name: 'Ferrol', lat: 12.3216, lng: 121.9427 }, 
  { name: 'Santa Fe', lat: 12.1558, lng: 121.9959 } 
];

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// 🚀 Helper to add icons to the Category Pills & Dropdown
const getCategoryIcon = (cat) => {
  switch(cat) {
    case 'Food & Dining': return <MdFastfood size={16} />;
    case 'Grocery & Retail': return <MdStorefront size={16} />;
    case 'Beauty & Personal Care': return <MdSpa size={16} />;
    case 'Health & Medical': return <MdLocalHospital size={16} />;
    case 'Automotive': return <MdDirectionsCar size={16} />;
    case 'Travel & Accommodation': return <MdHotel size={16} />;
    case 'Home & Professional Services': return <MdHomeRepairService size={16} />;
    case 'Financial & Business': return <MdAttachMoney size={16} />;
    default: return null;
  }
};

export default function MapPage() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef({}); 
  const { isDarkMode, toggleDarkMode } = useTheme();
  const categoryScrollRef = useRef(null);
  const dragState = useRef({ isDown: false, startX: 0, scrollLeft: 0 });
  
  const popupRef = useRef(new mapboxgl.Popup({ 
    offset: [0, -38], 
    anchor: 'bottom',
    closeButton: false, 
    closeOnClick: true 
  }));
  
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [zoom, setZoom] = useState(16);

  const [stores, setStores] = useState(globalStoreCache);
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedStore, setSelectedStore] = useState(null);

  const selectedStoreRef = useRef(selectedStore);
  useEffect(() => { selectedStoreRef.current = selectedStore; }, [selectedStore]);

  const [activeLocation, setActiveLocation] = useState(TABLAS_MUNICIPALITIES[0]); 
  
  const [actualUserLocation, setActualUserLocation] = useState(null);

  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false); 
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false); // 🚀 State for Mobile Category Dropdown

  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState({ stores: [], items: [] });

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState({ distance: 10, minRating: 0, openNow: false });

  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(true);
  const [isLocating, setIsLocating] = useState(false);

  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);

  const navigate = useNavigate();
  
  const categories = [
    'All', 'Food & Dining', 'Grocery & Retail', 'Beauty & Personal Care', 
    'Health & Medical', 'Automotive', 'Travel & Accommodation', 
    'Home & Professional Services', 'Financial & Business'
  ];

  const bgColors = {
    primary: isDarkMode ? '#1E293B' : '#FFFFFF',
    secondary: isDarkMode ? '#0F172A' : '#F8FAFC',
    border: isDarkMode ? '#334155' : '#E2E8F0',
    textMain: isDarkMode ? '#F8FAFC' : '#0F172A',
    textMuted: isDarkMode ? '#94A3B8' : '#64748B',
    hover: isDarkMode ? '#334155' : '#F8FAFC',
  };

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setActualUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.log("Silent GPS fallback:", err),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
      );
    }
  }, []);

  const checkScrollArrows = () => {
    if (!categoryScrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = categoryScrollRef.current;
    setShowLeftScroll(scrollLeft > 0);
    setShowRightScroll(scrollLeft < scrollWidth - clientWidth - 5); 
  };

  useEffect(() => {
    checkScrollArrows();
    window.addEventListener('resize', checkScrollArrows);
    return () => window.removeEventListener('resize', checkScrollArrows);
  }, [categories]);

  const handleMouseDown = (e) => {
    dragState.current.isDown = true;
    if (categoryScrollRef.current) {
      categoryScrollRef.current.style.cursor = 'grabbing';
      dragState.current.startX = e.pageX - categoryScrollRef.current.offsetLeft;
      dragState.current.scrollLeft = categoryScrollRef.current.scrollLeft;
    }
  };
  const handleMouseLeave = () => {
    dragState.current.isDown = false;
    if (categoryScrollRef.current) categoryScrollRef.current.style.cursor = 'grab';
  };
  const handleMouseUp = () => {
    dragState.current.isDown = false;
    if (categoryScrollRef.current) categoryScrollRef.current.style.cursor = 'grab';
  };
  const handleMouseMove = (e) => {
    if (!dragState.current.isDown) return;
    e.preventDefault();
    if (categoryScrollRef.current) {
      const x = e.pageX - categoryScrollRef.current.offsetLeft;
      const walk = (x - dragState.current.startX) * 2; 
      categoryScrollRef.current.scrollLeft = dragState.current.scrollLeft - walk;
    }
  };

  const handleLocateUser = () => {
    if (!navigator.geolocation || !map.current) return;
    
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { longitude, latitude, heading } = pos.coords;
        setActualUserLocation({ lat: latitude, lng: longitude });

        map.current.getSource('user-location').setData({
          type: 'Feature', 
          geometry: { type: 'Point', coordinates: [longitude, latitude] }, 
          properties: { heading: heading || 0 }
        });
        
        map.current.flyTo({ center: [longitude, latitude], zoom: 18.5, speed: 1.5 });
        setIsLocating(false);
      },
      (err) => {
        console.error("Geolocation error:", err);
        setIsLocating(false);
        alert("Could not access your location. Please check browser permissions.");
      },
      { enableHighAccuracy: true }
    );
  };

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (session) {
        try {
          const res = await fetch(`${API_BASE_URL}/api/users/${session.user.id}`);
          if (res.ok) setProfile(await res.json());
        } catch (err) { console.error(err); }
      }
    };
    fetchUser();
  }, []);

  const fetchStoresInBounds = async () => {
    if (!map.current) return [];
    const b = map.current.getBounds();
    try {
      const res = await fetch(`${API_BASE_URL}/api/stores?minLng=${b.getWest()}&minLat=${b.getSouth()}&maxLng=${b.getEast()}&maxLat=${b.getNorth()}`);
      if (!res.ok) return [];
      const data = await res.json();
      globalStoreCache = Array.isArray(data) ? data : [];
      setStores(globalStoreCache);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (map.current || !mapContainer.current) return; 
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current, 
      style: isDarkMode 
        ? 'mapbox://styles/locallook/cmuya47zw00gk01r7gs3thdzs'
        : 'mapbox://styles/locallook/cmqttzcqe004h01rc8ya580zb', 
      center: [activeLocation.lng, activeLocation.lat], 
      zoom: 16, 
      pitch: 60 
    });
    
    map.current.on('idle', () => setIsMapLoaded(true));

    const updateMapState = () => {
      const currentZoom = map.current.getZoom();
      setZoom(currentZoom);
      if (currentZoom < 16 && selectedStoreRef.current) {
        setSelectedStore(null);
      }
    };

    map.current.on('move', updateMapState);
    map.current.on('zoom', updateMapState);
    map.current.on('moveend', fetchStoresInBounds);

    map.current.on('render', () => {
      Object.entries(markersRef.current).forEach(([id, marker]) => {
        const lngLat = marker.getLngLat();
        if (lngLat) {
          const pos = map.current.project(lngLat);
          let zIndex = Math.round(pos.y * 10); 
          if (selectedStoreRef.current && selectedStoreRef.current.id === id) {
            zIndex += 100000;
          }
          marker.getElement().style.zIndex = zIndex;
        }
      });
    });

    map.current.on('style.load', async () => {
      await fetchStoresInBounds();
      updateMapState();
      setIsDataLoaded(true);

      map.current.addModel('user-model', '/user-model.glb');
      
      map.current.addSource('user-location', {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'Point', coordinates: [0,0] }, properties: { heading: 0 } }
      });

      map.current.addLayer({
        id: 'user-pulse',
        type: 'circle',
        source: 'user-location',
        paint: {
          'circle-radius': 30,
          'circle-color': '#2563EB',
          'circle-opacity': 0.2,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#2563EB',
          'circle-pitch-alignment': 'map'
        }
      });

      map.current.addLayer({
        id: 'user-model-layer',
        type: 'model',
        source: 'user-location',
        layout: {
          'model-id': 'user-model',
          'model-scale': [5, 5, 5], 
          'model-rotation': [0, 0, ['get', 'heading']], 
        }
      });
    });

    return () => { if (map.current) { map.current.remove(); map.current = null; } };
  }, []);

  useEffect(() => {
    if (!map.current || !isMapLoaded) return;
    
    const targetStyle = isDarkMode 
      ? 'mapbox://styles/locallook/cmuya47zw00gk01r7gs3thdzs'
      : 'mapbox://styles/locallook/cmqttzcqe004h01rc8ya580zb';
      
    map.current.setStyle(targetStyle);
  }, [isDarkMode, isMapLoaded]);

  useEffect(() => {
    if (!mapContainer.current) return;
    const resizeObserver = new ResizeObserver(() => {
      if (map.current) map.current.resize();
    });
    resizeObserver.observe(mapContainer.current);
    return () => resizeObserver.disconnect();
  }, []);

  const handleLocationSelect = (loc) => {
    setActiveLocation(loc);
    setIsLocationDropdownOpen(false); 
    setIsLocationModalOpen(false);    
    if (map.current) {
      map.current.flyTo({ center: [loc.lng, loc.lat], zoom: 16, speed: 1.2, essential: true });
    }
  };

  useEffect(() => {
    if (!searchTerm.trim()) { setSearchResults({ stores: [], items: [] }); return; }
    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        const term = searchTerm.toLowerCase();
        const storeHits = globalStoreCache.filter(store => {
          return store.store_name?.toLowerCase().includes(term) || store.industry?.toLowerCase().includes(term) || store.store_category?.toLowerCase().includes(term);
        }).slice(0, 5);
          
        const { data: itemHits, error: itemError } = await supabase.from('items').select('id, item_name, price, stores(id, store_name, lat, lng)').ilike('item_name', `%${searchTerm}%`).limit(4);
        setSearchResults({ stores: storeHits, items: itemError ? [] : (itemHits || []) });
      } catch (error) { console.error(error); } finally { setIsSearching(false); }
    }, 300); 
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const handleSearchResultClick = (target) => {
    setIsSearchFocused(false);
    setSearchTerm('');
    const lat = target.lat || target.stores?.lat;
    const lng = target.lng || target.stores?.lng;
    
    if (map.current && lat && lng) {
      map.current.flyTo({ center: [lng, lat], zoom: 18.5, duration: 1200, offset: [0, 160] });
      setSelectedStore(target.stores ? target.stores : target);
    }
  };

  const mapStores = useMemo(() => {
    if (!Array.isArray(stores)) return [];
    return stores.filter(store => {
      if (!store.lat || !store.lng) return false;
      if (activeCategory !== 'All' && store.store_category !== activeCategory) return false;
      if (calculateDistance(activeLocation.lat, activeLocation.lng, store.lat, store.lng) > filters.distance) return false;
      if (filters.openNow && store.is_open === false) return false;
      return true;
    });
  }, [stores, activeCategory, filters, activeLocation]);

  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    const currentMarkerIds = new Set(mapStores.map(s => s.id));
    const isZoomedOut = zoom < 15.5; 

    Object.keys(markersRef.current).forEach(id => {
      if (!currentMarkerIds.has(id.toString())) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    mapStores.forEach(store => {
      const id = store.id;
      const lat = store.lat;
      const lng = store.lng;

      const htmlString = renderToString(
        <CustomMapPin 
          category={store.store_category} 
          industry={store.industry} 
          storeName={store.store_name} 
          showLabel={zoom >= 16.5} 
          isDotMode={isZoomedOut} 
          size={30} 
          isOpen={store.is_open} 
          isDarkMode={isDarkMode}
        />
      );

      if (!markersRef.current[id]) {
        const el = document.createElement('div');
        el.style.cursor = 'pointer';
        el.innerHTML = htmlString;

        el.onclick = (e) => {
          e.stopPropagation();
          setSelectedStore(store);
          map.current.flyTo({ center: [lng, lat], zoom: 18.5, duration: 1000, offset: [0, 160] });
        };

        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([lng, lat])
          .addTo(map.current);
          
        markersRef.current[id] = marker;
      } else {
        const existingEl = markersRef.current[id].getElement();
        if (existingEl.innerHTML !== htmlString) {
           existingEl.innerHTML = htmlString;
        }
      }
    });
  }, [mapStores, isMapLoaded, zoom, selectedStore]); 

  useEffect(() => {
    if (!map.current) return;
    const onPopupClose = () => setSelectedStore(null);

    if (selectedStore) {
      const distanceBase = actualUserLocation || activeLocation;
      const dist = calculateDistance(distanceBase.lat, distanceBase.lng, selectedStore.lat, selectedStore.lng).toFixed(2);
      
      const isOpen = selectedStore.is_open;
      const coverImage = selectedStore.cover_url || selectedStore.image_url || 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=400&q=80';
      
      const rating = selectedStore.rating || 0;
      const reviewCount = selectedStore.review_count || 0;

      const popupBg = isDarkMode ? '#1E293B' : '#FFFFFF';
      const popupText = isDarkMode ? '#F8FAFC' : '#0F172A';
      const popupSub = isDarkMode ? '#94A3B8' : '#64748B';
      const popupBorder = isDarkMode ? '#334155' : '#E2E8F0';

      const div = document.createElement('div');
      
      div.innerHTML = `
        <div style="font-family: 'Plus Jakarta Sans', sans-serif; width: 240px; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden; background-color: ${popupBg}; border-radius: 12px;">
          <div style="width: 100%; height: 80px; background-image: url('${coverImage}'); background-size: cover; background-position: center; border-bottom: 1px solid ${popupBorder}; position: relative;">
             <div style="position: absolute; top: 10px; right: 10px; background-color: ${isOpen ? 'rgba(209, 250, 229, 0.85)' : 'rgba(254, 242, 242, 0.85)'}; backdrop-filter: blur(4px); padding: 4px 10px; border-radius: 9999px; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.08);">
              <span style="position: relative; display: flex; width: 6px; height: 6px;">
                  ${isOpen ? `<span style="position: absolute; display: inline-flex; height: 100%; width: 100%; border-radius: 50%; background-color: #10B981; opacity: 0.75; animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>` : ''}
                  <span style="position: relative; display: inline-flex; border-radius: 50%; width: 6px; height: 6px; background-color: ${isOpen ? '#059669' : '#DC2626'};"></span>
              </span>
              <span style="font-size: 10.5px; font-weight: 700; text-transform: capitalize; color: ${isOpen ? '#059669' : '#DC2626'}; letter-spacing: 0.2px;">
                  ${isOpen ? 'Open' : 'Closed'}
              </span>
          </div>
          </div>
          
          <div style="padding: 10px 12px; box-sizing: border-box; width: 100%;">
            <h3 style="margin: 0 0 2px 0; font-size: 14px; font-weight: 800; color: ${popupText}; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
              ${selectedStore.store_name}
            </h3>
            <div style="font-size: 11px; color: ${popupSub}; font-weight: 600; margin-bottom: 8px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
              ${selectedStore.industry || selectedStore.store_category}
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; font-size: 11px;">
              ${reviewCount > 0 ? `
                <div style="display: flex; align-items: center; gap: 4px;">
                  <span style="color: #F59E0B; font-size: 13px;">★</span>
                  <span style="color: ${popupText}; font-weight: 800;">${rating.toFixed(1)}</span>
                  <span style="color: ${popupSub}; font-weight: 500;">(${reviewCount})</span>
                </div>
              ` : `<span style="color: #94A3B8; font-weight: 600; font-style: italic;">No reviews yet</span>`}
              <div style="color: ${popupSub}; font-weight: 700; display: flex; align-items: center; gap: 3px; flex-shrink: 0;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                ${dist} km
              </div>
            </div>
            
            <button id="view-store-btn" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px; background: #2563EB; color: white; border: none; outline: none; -webkit-tap-highlight-color: transparent; padding: 8px; border-radius: 8px; font-weight: 800; font-size: 12px; cursor: pointer; transition: background-color 0.2s;">
              View Full Details
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>
        </div>
      `;

      setTimeout(() => {
        const btn = document.getElementById('view-store-btn');
        if(btn) btn.onclick = () => navigate(`/store/${selectedStore.id}`);
      }, 0);

      popupRef.current.setLngLat([Number(selectedStore.lng), Number(selectedStore.lat)]).setDOMContent(div).addTo(map.current);
      popupRef.current.on('close', onPopupClose);
    } else {
      popupRef.current.remove();
    }
    return () => popupRef.current.off('close', onPopupClose);
  }, [selectedStore, navigate, actualUserLocation, activeLocation, isDarkMode]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { font-family: 'Plus Jakarta Sans', sans-serif; -webkit-tap-highlight-color: transparent; }
        
        button:focus { outline: none !important; box-shadow: none !important; }
        .mapboxgl-map { user-select: none !important; -webkit-user-select: none !important; }
        .mapboxgl-popup { z-index: 800001 !important; user-select: none !important; -webkit-user-select: none !important; }
        .mapboxgl-popup-tip { display: none !important; }
        .mapboxgl-popup-content { border-radius: 12px !important; padding: 0 !important; overflow: hidden !important; box-shadow: 0 10px 25px rgba(0,0,0,0.15) !important; border: none !important; background: transparent !important; }
        .mapboxgl-ctrl-logo, .mapboxgl-ctrl-attrib { display: none !important; }
        .custom-scrollbar::-webkit-scrollbar { display: none; }

        /* 🚀 STRICT CSS ISOLATION BETWEEN DESKTOP AND MOBILE */
        .desktop-ui { display: block; }
        .mobile-ui-block { display: none; }
        .mobile-ui-flex { display: none; }

        @media (max-width: 768px) {
          .desktop-ui { display: none !important; }
          .mobile-ui-block { display: block !important; }
          .mobile-ui-flex { display: flex !important; }
        }
      `}</style>

      {/* 🚀 SHARED FILTERS MODAL */}
      {isFilterOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.7)' : 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', zIndex: 999999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ backgroundColor: bgColors.primary, padding: '24px', borderRadius: '24px', width: '90%', maxWidth: '380px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: bgColors.textMain }}>Filters</h3>
              <button onClick={() => setIsFilterOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: bgColors.textMuted }}><MdClose size={22} /></button>
            </div>

            {/* 🚀 MOBILE CATEGORIES DROPDOWN (ONLY VISIBLE ON MOBILE) */}
            <div className="mobile-ui-block" style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: bgColors.textMuted, marginBottom: '8px' }}>Category</label>
              <div style={{ position: 'relative' }}>
                <button 
                  onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: `1px solid ${bgColors.border}`, backgroundColor: bgColors.primary, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontSize: '14px', fontWeight: '700', color: bgColors.textMain }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#2563EB' }}>{getCategoryIcon(activeCategory)}</span> {activeCategory}
                  </div>
                  <MdExpandMore size={20} color={bgColors.textMuted} style={{ transform: isCategoryDropdownOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
                </button>
                
                {isCategoryDropdownOpen && (
                  <div className="custom-scrollbar" style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px', backgroundColor: bgColors.primary, border: `1px solid ${bgColors.border}`, borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 10, maxHeight: '250px', overflowY: 'auto' }}>
                    {categories.map(cat => (
                      <div 
                        key={cat}
                        onClick={() => { setActiveCategory(cat); setIsCategoryDropdownOpen(false); }}
                        style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', borderBottom: `1px solid ${bgColors.secondary}`, backgroundColor: activeCategory === cat ? (isDarkMode ? '#1E3A8A' : '#EFF6FF') : 'transparent', color: activeCategory === cat ? '#2563EB' : bgColors.textMain, fontWeight: '600', fontSize: '13px' }}
                      >
                        <div style={{ color: activeCategory === cat ? '#2563EB' : bgColors.textMuted }}>{getCategoryIcon(cat)}</div>
                        {cat}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: '700', color: bgColors.textMuted }}>Distance Radius</label>
                <span style={{ fontSize: '13px', fontWeight: '800', color: '#2563EB' }}>{filters.distance} km</span>
              </div>
              <input type="range" min="1" max="50" value={filters.distance} onChange={(e) => setFilters({...filters, distance: Number(e.target.value)})} style={{ width: '100%', accentColor: '#2563EB' }} />
              <div style={{ fontSize: '11px', color: bgColors.textMuted, marginTop: '4px' }}>Searching from {activeLocation.name}</div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: bgColors.textMuted, marginBottom: '8px' }}>Minimum Rating</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[0, 3, 4, 5].map(rating => (
                  <button key={rating} onClick={() => setFilters({...filters, minRating: rating})} style={{ flex: 1, padding: '10px 0', borderRadius: '12px', border: filters.minRating === rating ? '2px solid #2563EB' : `1px solid ${bgColors.border}`, backgroundColor: filters.minRating === rating ? (isDarkMode ? '#1E3A8A' : '#EFF6FF') : bgColors.primary, color: filters.minRating === rating ? (isDarkMode ? '#60A5FA' : '#2563EB') : bgColors.textMuted, fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    {rating === 0 ? 'Any' : <>{rating}+ <MdStar size={16} /></>}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: bgColors.textMain }}>Open Now</label>
                <span style={{ fontSize: '12px', color: bgColors.textMuted }}>Hide closed businesses</span>
              </div>
              <div onClick={() => setFilters({...filters, openNow: !filters.openNow})} style={{ width: '50px', height: '28px', backgroundColor: filters.openNow ? '#10B981' : bgColors.border, borderRadius: '14px', position: 'relative', cursor: 'pointer', transition: 'background-color 0.2s' }}>
                <div style={{ width: '24px', height: '24px', backgroundColor: '#FFFFFF', borderRadius: '50%', position: 'absolute', top: '2px', left: filters.openNow ? '24px' : '2px', transition: 'left 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
              </div>
            </div>

            <button onClick={() => setIsFilterOpen(false)} style={{ width: '100%', padding: '14px', backgroundColor: '#2563EB', color: '#FFFFFF', border: 'none', borderRadius: '12px', fontWeight: '800', fontSize: '15px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.2)' }}>
              Show {mapStores.length} Results
            </button>
          </div>
        </div>
      )}

      {/* 🚀 SHARED LOCATION MODAL */}
      {isLocationModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.7)' : 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', zIndex: 999999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ backgroundColor: bgColors.primary, padding: '24px', borderRadius: '24px', width: '90%', maxWidth: '360px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: bgColors.textMain }}>Select Location</h3>
              <button onClick={() => setIsLocationModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: bgColors.textMuted }}><MdClose size={22} /></button>
            </div>
            <div className="custom-scrollbar" style={{ maxHeight: '60vh', overflowY: 'auto', margin: '0 -10px', padding: '0 10px' }}>
              {TABLAS_MUNICIPALITIES.map(loc => (
                <div key={loc.name} onClick={() => handleLocationSelect(loc)} style={{ padding: '16px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', borderBottom: `1px solid ${bgColors.secondary}`, color: activeLocation.name === loc.name ? '#2563EB' : bgColors.textMain, backgroundColor: activeLocation.name === loc.name ? (isDarkMode ? '#1E3A8A' : '#EFF6FF') : 'transparent', borderRadius: '12px', marginBottom: '4px', transition: 'background-color 0.2s' }}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}><MdLocationOn size={22} color={activeLocation.name === loc.name ? '#2563EB' : bgColors.textMuted} />{loc.name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Map Container */}
      <div style={{ position: 'relative', height: '100%', width: '100%', backgroundColor: bgColors.secondary, overflow: 'hidden' }}>
        <div ref={mapContainer} style={{ position: 'absolute', inset: 0 }} />

        {/* ========================================================= */}
        {/* 💻 ORIGINAL DESKTOP UI (Restored & Fully Isolated) */}
        {/* ========================================================= */}
        <div className="desktop-ui" style={{ position: 'absolute', top: 0, left: 0, right: 0, pointerEvents: 'none', zIndex: 900000 }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '20px 24px 10px 36px', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ position: 'relative', flexGrow: 1, pointerEvents: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', backgroundColor: bgColors.primary, border: isSearchFocused ? '2px solid #2563EB' : `1px solid ${bgColors.border}`, borderRadius: '12px', padding: '0 16px', height: '42px', boxShadow: isSearchFocused ? '0 0 0 4px rgba(37,99,235,0.1)' : '0 4px 15px rgba(0,0,0,0.08)', transition: 'all 0.2s' }}>
                <MdSearch size={20} color={isSearchFocused ? '#2563EB' : bgColors.textMuted} />
                <input type="text" placeholder="Search places, products or services..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onFocus={() => setIsSearchFocused(true)} style={{ border: 'none', backgroundColor: 'transparent', flexGrow: 1, outline: 'none', fontSize: '13.5px', color: bgColors.textMain, marginLeft: '10px', fontWeight: '500', height: '100%' }} />
              </div>

              {isSearchFocused && searchTerm.trim().length > 0 && (
                <>
                  <div onClick={() => setIsSearchFocused(false)} style={{ position: 'fixed', inset: 0, zIndex: 999997 }} />
                  <div className="custom-scrollbar" style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '6px', backgroundColor: bgColors.primary, border: `1px solid ${bgColors.border}`, borderRadius: '12px', boxShadow: '0 15px 35px rgba(0,0,0,0.1)', zIndex: 999998, overflowY: 'auto', maxHeight: '300px', padding: '8px 0' }}>
                    {searchResults.stores.length === 0 && searchResults.items.length === 0 && !isSearching ? (
                      <div style={{ padding: '16px', textAlign: 'center', color: bgColors.textMuted, fontSize: '13px' }}>No results found for "{searchTerm}"</div>
                    ) : (
                      <>
                        {searchResults.stores.length > 0 && (
                          <div style={{ paddingBottom: searchResults.items.length > 0 ? '10px' : '0' }}>
                            <div style={{ padding: '6px 14px', fontSize: '10px', fontWeight: '900', color: bgColors.textMuted, textTransform: 'uppercase' }}>Stores</div>
                            {searchResults.stores.map(store => (
                              <div key={store.id} onClick={() => handleSearchResultClick(store)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', cursor: 'pointer' }}>
                                <div style={{ backgroundColor: isDarkMode ? '#1E3A8A' : '#EFF6FF', padding: '8px', borderRadius: '8px' }}><MdStorefront size={18} color="#2563EB" /></div>
                                <div><div style={{ fontSize: '14px', fontWeight: '800', color: bgColors.textMain }}>{store.store_name}</div><div style={{ fontSize: '12px', color: bgColors.textMuted, fontWeight: '500' }}>{store.industry || store.store_category}</div></div>
                              </div>
                            ))}
                          </div>
                        )}
                        {searchResults.items.length > 0 && (
                          <div style={{ borderTop: searchResults.stores.length > 0 ? `1px solid ${bgColors.border}` : 'none', paddingTop: searchResults.stores.length > 0 ? '10px' : '0' }}>
                            <div style={{ padding: '6px 14px', fontSize: '10px', fontWeight: '900', color: bgColors.textMuted, textTransform: 'uppercase' }}>Menu Items & Products</div>
                            {searchResults.items.map(item => (
                              <div key={item.id} onClick={() => handleSearchResultClick(item)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 14px', cursor: 'pointer' }}>
                                <div style={{ backgroundColor: isDarkMode ? 'rgba(22, 163, 74, 0.2)' : '#F0FDF4', padding: '6px', borderRadius: '8px' }}><MdFastfood size={16} color="#16A34A" /></div>
                                <div><div style={{ fontSize: '13px', fontWeight: '700', color: bgColors.textMain }}>{item.item_name} <span style={{ color: '#16A34A', fontWeight: '800' }}>₱{item.price}</span></div><div style={{ fontSize: '11px', color: bgColors.textMuted }}>Available at {item.stores?.store_name}</div></div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
            
            <div style={{ position: 'relative', pointerEvents: 'auto', minWidth: '180px' }}>
              <div onClick={() => setIsLocationDropdownOpen(!isLocationDropdownOpen)} style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: bgColors.primary, border: `1px solid ${bgColors.border}`, borderRadius: '12px', padding: '0 16px', height: '42px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.08)', userSelect: 'none' }}>
                <MdLocationOn size={18} color="#2563EB" />
                <span style={{ fontSize: '13.5px', fontWeight: '700', color: bgColors.textMain, flexGrow: 1 }}>{activeLocation.name}</span>
                <MdExpandMore size={20} color={bgColors.textMuted} style={{ transform: isLocationDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
              </div>
              {isLocationDropdownOpen && (
                <>
                  <div onClick={() => setIsLocationDropdownOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 999997 }} />
                  <div style={{ position: 'absolute', top: '100%', right: 0, left: 0, marginTop: '8px', backgroundColor: bgColors.primary, border: `1px solid ${bgColors.border}`, borderRadius: '12px', boxShadow: '0 15px 35px rgba(0,0,0,0.15)', zIndex: 999998, overflow: 'hidden' }}>
                    <div className="custom-scrollbar" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                      {TABLAS_MUNICIPALITIES.map(loc => (
                        <div key={loc.name} onClick={() => handleLocationSelect(loc)} style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', borderBottom: `1px solid ${bgColors.secondary}`, color: activeLocation.name === loc.name ? '#2563EB' : bgColors.textMuted, backgroundColor: activeLocation.name === loc.name ? (isDarkMode ? '#1E3A8A' : '#EFF6FF') : 'transparent' }}>{loc.name}</div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div style={{ pointerEvents: 'auto' }}>
              <div onClick={toggleDarkMode} style={{ width: '76px', height: '42px', backgroundColor: bgColors.primary, border: `1px solid ${bgColors.border}`, borderRadius: '24px', display: 'flex', alignItems: 'center', position: 'relative', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.08)', padding: '4px', boxSizing: 'border-box' }}>
                <div style={{ position: 'absolute', width: '32px', height: '32px', backgroundColor: '#2563EB', borderRadius: '50%', left: isDarkMode ? '40px' : '4px', transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)', zIndex: 1 }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', position: 'relative', zIndex: 2, padding: '0 6px' }}>
                  <MdLightMode size={20} color={!isDarkMode ? '#FFFFFF' : bgColors.textMuted} />
                  <MdDarkMode size={20} color={isDarkMode ? '#FFFFFF' : bgColors.textMuted} />
                </div>
              </div>
            </div>
            
            <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center' }}>
              <NotificationBell session={session} isSidebarMode={false} />
            </div>
            
            <div style={{ pointerEvents: 'auto' }}>
              {session ? (
                <div onClick={() => navigate('/profile')} style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundImage: `url('${profile?.avatar_url || `https://ui-avatars.com/api/?name=${profile?.display_name || 'User'}&background=EFF6FF&color=2563EB`}')`, backgroundSize: 'cover', backgroundPosition: 'center', cursor: 'pointer', border: `2px solid ${bgColors.primary}`, boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }} />
              ) : (
                <button onClick={() => navigate('/login')} style={{ padding: '0 20px', height: '42px', backgroundColor: '#2563EB', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '13.5px', cursor: 'pointer' }}>Sign In</button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 24px 0 36px', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', maxWidth: 'calc(100% - 130px)', pointerEvents: 'auto' }}>
              {showLeftScroll && <button onClick={() => categoryScrollRef.current.scrollBy({ left: -200, behavior: 'smooth' })} style={{ position: 'absolute', left: '-18px', zIndex: 5, background: bgColors.primary, border: `1px solid ${bgColors.border}`, width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}><MdChevronLeft size={22} color={bgColors.textMain} /></button>}
              
              {/* 🚀 DESKTOP CATEGORY PILLS (Fully Restored) */}
              <div ref={categoryScrollRef} onScroll={checkScrollArrows} onMouseDown={handleMouseDown} onMouseLeave={handleMouseUp} onMouseUp={handleMouseUp} onMouseMove={handleMouseMove} style={{ display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none', padding: '4px 0', WebkitOverflowScrolling: 'touch', cursor: 'grab', width: '100%' }}>
                {categories.map(cat => (
                  <button key={cat} onClick={() => setActiveCategory(cat)} style={{ flexShrink: 0, padding: '8px 18px', borderRadius: '24px', border: activeCategory === cat ? '1px solid transparent' : `1px solid ${bgColors.border}`, backgroundColor: activeCategory === cat ? '#2563EB' : bgColors.primary, color: activeCategory === cat ? 'white' : bgColors.textMuted, fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {getCategoryIcon(cat)} {cat}
                  </button>
                ))}
              </div>

              {showRightScroll && <button onClick={() => categoryScrollRef.current.scrollBy({ left: 200, behavior: 'smooth' })} style={{ position: 'absolute', right: '-16px', zIndex: 5, background: bgColors.primary, border: `1px solid ${bgColors.border}`, width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}><MdChevronRight size={22} color={bgColors.textMain} /></button>}
            </div>

            <button onClick={() => setIsFilterOpen(true)} style={{ pointerEvents: 'auto', padding: '8px 18px', borderRadius: '24px', border: `1px solid ${bgColors.border}`, backgroundColor: bgColors.primary, color: bgColors.textMuted, fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
              <MdTune size={18} /> Filters
            </button>
          </div>
          
          <div style={{ position: 'absolute', bottom: '30px', right: '30px', zIndex: 900000, pointerEvents: 'auto' }}>
            <button onClick={handleLocateUser} style={{ width: '48px', height: '48px', backgroundColor: bgColors.primary, border: `1px solid ${bgColors.border}`, borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 8px 25px rgba(0,0,0,0.15)', cursor: 'pointer' }}>
              {isLocating ? <div style={{ width: '20px', height: '20px', border: `3px solid ${bgColors.border}`, borderTopColor: '#2563EB', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> : <MdOutlineNearMe size={24} color="#2563EB" style={{ transform: 'translate(-1px, 1px)' }} />}
            </button>
          </div>
        </div>


        {/* ========================================================= */}
        {/* 📱 MOBILE UI (Strictly hidden on Desktop) */}
        {/* ========================================================= */}
        <div className="mobile-ui-flex" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 900000, pointerEvents: 'none', flexDirection: 'column' }}>
          
          {/* 1. Solid Top Header */}
          <div style={{ pointerEvents: 'auto', backgroundColor: bgColors.primary, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: `1px solid ${bgColors.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MdLocationOn size={24} color="#2563EB" />
              <span style={{ fontSize: '18px', fontWeight: '900', color: bgColors.textMain, letterSpacing: '-0.5px' }}>LocalLook</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <NotificationBell session={session} isSidebarMode={false} />
              <div onClick={() => session ? navigate('/profile') : navigate('/login')} style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: bgColors.secondary, border: `1px solid ${bgColors.border}`, display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', flexShrink: 0, backgroundImage: session ? `url('${profile?.avatar_url || `https://ui-avatars.com/api/?name=${profile?.display_name || 'User'}&background=EFF6FF&color=2563EB`}')` : 'none', backgroundSize: 'cover' }}>
                {!session && <MdPersonOutline size={20} color="#2563EB" />}
              </div>
            </div>
          </div>

          {/* 2. Floating Search Bar */}
          <div style={{ padding: '16px 16px 0 16px', pointerEvents: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: bgColors.primary, borderRadius: '24px', padding: '0 16px', height: '48px', boxShadow: '0 4px 15px rgba(0,0,0,0.08)', border: `1px solid ${bgColors.border}` }}>
              <MdSearch size={22} color={bgColors.textMuted} />
              <input type="text" placeholder="Search places or products..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onFocus={() => setIsSearchFocused(true)} style={{ border: 'none', background: 'transparent', flexGrow: 1, outline: 'none', color: bgColors.textMain, fontSize: '14px', marginLeft: '10px', fontWeight: '500', height: '100%', width: '100%' }} />
            </div>

            {/* Mobile Search Results */}
            {isSearchFocused && searchTerm.trim().length > 0 && (
               <div style={{ position: 'relative', zIndex: 999998 }}>
                  <div onClick={() => setIsSearchFocused(false)} style={{ position: 'fixed', inset: 0, zIndex: -1 }} />
                  <div className="custom-scrollbar" style={{ position: 'absolute', top: '8px', left: 0, right: 0, backgroundColor: bgColors.primary, border: `1px solid ${bgColors.border}`, borderRadius: '16px', boxShadow: '0 15px 35px rgba(0,0,0,0.15)', overflowY: 'auto', maxHeight: '50vh', padding: '8px 0' }}>
                    {searchResults.stores.map(store => (
                      <div key={store.id} onClick={() => handleSearchResultClick(store)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderBottom: `1px solid ${bgColors.secondary}` }}>
                        <MdStorefront size={20} color="#2563EB" />
                        <div style={{ fontSize: '14px', fontWeight: '800', color: bgColors.textMain }}>{store.store_name}</div>
                      </div>
                    ))}
                    {searchResults.items.map(item => (
                      <div key={item.id} onClick={() => handleSearchResultClick(item)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderBottom: `1px solid ${bgColors.secondary}` }}>
                        <MdFastfood size={18} color="#16A34A" />
                        <div><div style={{ fontSize: '13px', fontWeight: '700', color: bgColors.textMain }}>{item.item_name} <span style={{ color: '#16A34A' }}>₱{item.price}</span></div></div>
                      </div>
                    ))}
                  </div>
               </div>
            )}
          </div>

          {/* 3. Location Picker (Floating on Right Side, below Search) */}
          <div style={{ padding: '8px 16px 0 0', display: 'flex', justifyContent: 'flex-end', pointerEvents: 'none' }}>
             <button onClick={() => setIsLocationModalOpen(true)} style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: '4px', height: '36px', padding: '0 14px', borderRadius: '18px', backgroundColor: bgColors.primary, border: `1px solid ${bgColors.border}`, fontSize: '13px', fontWeight: '700', color: '#2563EB', boxShadow: '0 4px 10px rgba(0,0,0,0.08)' }}>
               <MdLocationOn size={16} /> {activeLocation.name} <MdExpandMore size={18} color={bgColors.textMuted} style={{marginLeft: '2px'}}/>
             </button>
          </div>
        </div>

        {/* 📱 Mobile Floating Action Buttons (Stacked Bottom Right) */}
        <div className="mobile-ui-flex" style={{ position: 'absolute', bottom: '24px', right: '16px', zIndex: 900000, pointerEvents: 'none', flexDirection: 'column', gap: '16px' }}>
           
           <button onClick={handleLocateUser} style={{ pointerEvents: 'auto', width: '48px', height: '48px', backgroundColor: bgColors.primary, border: `1px solid ${bgColors.border}`, borderRadius: '50%', boxShadow: '0 4px 15px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isLocating ? <div style={{ width: '20px', height: '20px', border: `3px solid ${bgColors.border}`, borderTopColor: '#2563EB', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> : <MdOutlineNearMe size={24} color="#2563EB" style={{ transform: 'translate(-1px, 1px)' }} />}
           </button>
           
           <button onClick={() => setIsFilterOpen(true)} style={{ pointerEvents: 'auto', width: '48px', height: '48px', backgroundColor: bgColors.primary, border: `1px solid ${bgColors.border}`, borderRadius: '50%', boxShadow: '0 4px 15px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <MdTune size={22} color={bgColors.textMain} />
              {activeCategory !== 'All' && <span style={{ position: 'absolute', top: '0', right: '0', backgroundColor: '#EF4444', border: `2px solid ${bgColors.primary}`, width: '12px', height: '12px', borderRadius: '50%' }} />}
           </button>
        </div>

        {(!isMapLoaded || !isDataLoaded) && (
          <div style={{ position: 'absolute', inset: 0, backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.5)', backdropFilter: 'blur(10px)', zIndex: 20, display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', transition: 'opacity 0.5s ease' }}>
            <div style={{ width: '48px', height: '48px', border: `4px solid ${bgColors.border}`, borderTopColor: '#2563EB', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            <strong style={{ marginTop: '16px', color: bgColors.textMain, fontSize: '15px' }}>Loading Map...</strong>
          </div>
        )}

      </div>
    </>
  );
}