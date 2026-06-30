import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '../supabaseClient';
import { MdSearch, MdNotificationsNone, MdTune, MdExpandMore, MdLocationOn } from "react-icons/md";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';
if (MAPBOX_TOKEN) { mapboxgl.accessToken = MAPBOX_TOKEN; }

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://locallook-api.onrender.com';

let globalStoreCache = [];

export default function MapPage() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const popupRef = useRef(new mapboxgl.Popup({ offset: [0, -32], closeButton: true, closeOnClick: false }));
  
  const [stores, setStores] = useState(globalStoreCache);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedStore, setSelectedStore] = useState(null);

  // 🚀 NEW AUTH STATES
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);

  const navigate = useNavigate();
  // Functional Categories
  const categories = ['All', 'Food & Dining', 'Retail', 'Services', 'Groceries'];

  // 🚀 FETCH USER SESSION & PROFILE
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      
      if (session) {
        try {
          const res = await fetch(`${API_BASE_URL}/api/users/${session.user.id}`);
          if (res.ok) {
            const data = await res.json();
            setProfile(data);
          }
        } catch (err) {
          console.error("Error fetching user profile for map:", err);
        }
      }
    };
    fetchUser();
  }, []);

  const fetchStoresInBounds = async () => {
    if (!map.current) return [];
    const bounds = map.current.getBounds();
    try {
      const res = await fetch(`${API_BASE_URL}/api/stores?minLng=${bounds.getWest()}&minLat=${bounds.getSouth()}&maxLng=${bounds.getEast()}&maxLat=${bounds.getNorth()}`);
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
      style: 'mapbox://styles/locallook/cmqttzcqe004h01rc8ya580zb', 
      center: [121.9823, 12.3985], 
      zoom: 15.5, 
      pitch: 0 // Mockup shows flat map
    });

    // RESTORED CONTROLS: Zoom & Locate Me
    map.current.addControl(new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true
    }), 'bottom-right');
    map.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');

    map.current.on('moveend', fetchStoresInBounds);
    map.current.on('style.load', fetchStoresInBounds);

    return () => {
      if (map.current) { map.current.remove(); map.current = null; }
    };
  }, []);

  const mapStores = useMemo(() => {
    if (!Array.isArray(stores)) return [];
    return stores.filter(store => {
      const matchesSearch = store.store_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = activeCategory === 'All' || store.store_category === activeCategory;
      return store.lat && store.lng && matchesSearch && matchesCategory;
    });
  }, [stores, searchTerm, activeCategory]);

  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    const geoJsonData = {
      type: 'FeatureCollection',
      features: mapStores.map(store => ({
        type: 'Feature', geometry: { type: 'Point', coordinates: [Number(store.lng), Number(store.lat)] },
        properties: { id: store.id, name: store.store_name, category: store.store_category, lat: Number(store.lat), lng: Number(store.lng) }
      }))
    };

    if (map.current.getSource('stores-source')) { 
      map.current.getSource('stores-source').setData(geoJsonData); 
    } else {
      map.current.addSource('stores-source', { type: 'geojson', data: geoJsonData });
      map.current.addLayer({ 
        id: 'stores-dots-layer', type: 'circle', source: 'stores-source', 
        paint: { 'circle-radius': 10, 'circle-color': '#2563EB', 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff', 'circle-stroke-opacity': 0.8 } 
      });

      map.current.on('click', 'stores-dots-layer', (e) => {
        const props = e.features[0].properties;
        setSelectedStore({ id: props.id, store_name: props.name, store_category: props.category, lat: props.lat, lng: props.lng });
        map.current.flyTo({ center: [props.lng, props.lat], zoom: 17, duration: 1000 });
      });
      map.current.on('mouseenter', 'stores-dots-layer', () => map.current.getCanvas().style.cursor = 'pointer');
      map.current.on('mouseleave', 'stores-dots-layer', () => map.current.getCanvas().style.cursor = '');
    }
  }, [mapStores]); 

  // Mapbox Popup
  useEffect(() => {
    if (!map.current) return;
    const onPopupClose = () => setSelectedStore(null);

    if (selectedStore) {
      const div = document.createElement('div');
      div.style.textAlign = 'center'; div.style.padding = '8px 4px 4px 4px';

      const title = document.createElement('strong');
      title.style.cssText = 'font-size: 16px; display: block; margin-bottom: 2px; color: #0F172A;'; 
      title.textContent = selectedStore.store_name;

      const cat = document.createElement('span');
      cat.style.cssText = 'color: #64748B; font-size: 13px; display: block; margin-bottom: 12px;';
      cat.textContent = selectedStore.store_category;

      const btn = document.createElement('button');
      btn.style.cssText = 'width: 100%; padding: 10px; background-color: #2563EB; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;';
      btn.textContent = 'View Full Menu';
      btn.onclick = () => navigate(`/store/${selectedStore.id}`);

      div.appendChild(title);
      div.appendChild(cat);
      div.appendChild(btn);

      popupRef.current.setLngLat([Number(selectedStore.lng), Number(selectedStore.lat)]).setDOMContent(div).addTo(map.current);
      popupRef.current.on('close', onPopupClose);
    } else {
      popupRef.current.remove();
    }
    return () => popupRef.current.off('close', onPopupClose);
  }, [selectedStore, navigate]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', padding: '24px 32px', overflowY: 'auto', backgroundColor: '#F8FAFC' }}>
      
      {/* 🚀 1. HEADER ROW */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        {/* Search Bar */}
        <div style={{ display: 'flex', flexGrow: 1, alignItems: 'center', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '12px 18px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <MdSearch size={22} color="#94A3B8" />
          <input type="text" placeholder="Search places, categories or services..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ border: 'none', backgroundColor: 'transparent', flexGrow: 1, outline: 'none', fontSize: '15px', color: '#0F172A', marginLeft: '12px' }} />
          <div style={{ fontSize: '12px', backgroundColor: '#F1F5F9', border: '1px solid #E2E8F0', padding: '4px 8px', borderRadius: '6px', color: '#64748B', fontWeight: 'bold' }}>⌘ K</div>
        </div>

        {/* Location Picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '12px 18px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <MdLocationOn size={18} color="#2563EB" />
          <span style={{ fontSize: '14.5px', fontWeight: '600', color: '#0F172A' }}>Olongapo City</span>
          <MdExpandMore size={18} color="#64748B" />
        </div>

        {/* Bell */}
        <div style={{ width: '46px', height: '46px', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid #E2E8F0', borderRadius: '50%', cursor: 'pointer', position: 'relative', backgroundColor: '#FFFFFF' }}>
          <MdNotificationsNone size={22} color="#475569" />
          {session && <div style={{ position: 'absolute', top: '12px', right: '12px', width: '6px', height: '6px', backgroundColor: '#EF4444', borderRadius: '50%' }} />}
        </div>
        
        {/* 🚀 DYNAMIC AVATAR / SIGN IN */}
        {session ? (
          <div 
            onClick={() => navigate('/profile')}
            style={{ 
              width: '46px', height: '46px', borderRadius: '50%', 
              backgroundImage: `url(${profile?.avatar_url || `https://ui-avatars.com/api/?name=${profile?.display_name || 'User'}&background=EFF6FF&color=2563EB`})`, 
              backgroundSize: 'cover', backgroundPosition: 'center', cursor: 'pointer', border: '2px solid #FFFFFF', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' 
            }} 
            title="Go to Profile"
          />
        ) : (
          <button 
            onClick={() => navigate('/login')} 
            style={{ padding: '10px 20px', backgroundColor: '#2563EB', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            Sign In
          </button>
        )}
      </div>

      {/* 🚀 2. CATEGORY PILLS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {categories.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)} style={{ padding: '8px 20px', borderRadius: '24px', border: activeCategory === cat ? 'none' : '1px solid #E2E8F0', backgroundColor: activeCategory === cat ? '#2563EB' : '#FFFFFF', color: activeCategory === cat ? 'white' : '#475569', fontWeight: '600', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s', boxShadow: activeCategory === cat ? '0 4px 12px rgba(37,99,235,0.2)' : '0 2px 4px rgba(0,0,0,0.02)' }}>
              {cat}
            </button>
          ))}
          <button style={{ padding: '8px 16px', borderRadius: '24px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#475569', fontWeight: '600', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            More <MdExpandMore size={18} />
          </button>
        </div>
        
        <button style={{ padding: '8px 16px', borderRadius: '24px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#475569', fontWeight: '600', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <MdTune size={18} /> Filters
        </button>
      </div>

      {/* 🚀 3. THE ROUNDED MAP */}
      <div style={{ flexShrink: 0, height: '45vh', borderRadius: '24px', overflow: 'hidden', position: 'relative', marginBottom: '32px', border: '4px solid #FFFFFF', boxShadow: '0 10px 30px rgba(0,0,0,0.06)' }}>
        <div ref={mapContainer} style={{ position: 'absolute', inset: 0 }} />
        
        {/* Weather Widget Mockup Overlay */}
        <div style={{ position: 'absolute', bottom: '20px', left: '20px', backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', zIndex: 10 }}>
           <div style={{ fontSize: '28px' }}>☀️</div>
           <div style={{ display: 'flex', flexDirection: 'column' }}>
             <span style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', lineHeight: '1.2' }}>28°C</span>
             <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>Sunny</span>
           </div>
        </div>
      </div>

      {/* 🚀 4. MOCKUP STORE FEED */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>Popular near you</h2>
          <span style={{ fontSize: '14px', color: '#2563EB', fontWeight: '700', cursor: 'pointer' }}>View all</span>
        </div>
        
        <div style={{ display: 'flex', gap: '20px', overflowX: 'auto', paddingBottom: '20px', scrollbarWidth: 'none' }}>
          {mapStores.slice(0, 5).map(store => (
            <div key={store.id} onClick={() => navigate(`/store/${store.id}`)} style={{ minWidth: '260px', maxWidth: '260px', backgroundColor: '#FFFFFF', borderRadius: '16px', overflow: 'hidden', cursor: 'pointer', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
              
              {/* Image Header */}
              <div style={{ height: '140px', backgroundColor: '#e2e8f0', backgroundImage: `url(${store.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative', margin: '10px 10px 0 10px', borderRadius: '12px' }}>
                <div style={{ position: 'absolute', top: '10px', left: '10px', background: '#2563EB', color: 'white', fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '6px' }}>
                  Promoted
                </div>
              </div>
              
              {/* Card Content */}
              <div style={{ padding: '16px 14px' }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: '800', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{store.store_name}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ color: '#F59E0B', fontSize: '14px' }}>★</span>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#475569' }}>4.8</span>
                  <span style={{ fontSize: '13px', color: '#94A3B8' }}>(124)</span>
                </div>
                <div style={{ fontSize: '12.5px', color: '#94A3B8', marginTop: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {store.store_category} • 0.2 km
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
    </div>
  );
}