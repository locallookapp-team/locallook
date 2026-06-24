import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '../supabaseClient';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';
if (MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
}

const getPinConfig = (cat) => {
  switch (cat) {
    case 'Food & Dining': return { color: '#ea4335', icon: 'M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.88 3.75 3.97V22h2.5v-9.03C11.34 12.88 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z' }; 
    case 'Retail':
    case 'Groceries': return { color: '#4285f4', icon: 'M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1.003 1.003 0 0 0 20 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z' }; 
    case 'Services': return { color: '#0f9d58', icon: 'M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.5 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z' }; 
    case 'Health & Wellness': return { color: '#f50057', icon: 'M19 3H5c-1.1 0-1.99.9-1.99 2L3 19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z' }; 
    case 'Tourism & Lodging': return { color: '#ab47bc', icon: 'M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4z' }; 
    default: return { color: '#5f6368', icon: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z' }; 
  }
};

const makeSvgString = (category, isOpen) => {
  const config = getPinConfig(category);
  const statusColor = isOpen ? '#10b981' : '#ef4444';
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 28 36">
      <path d="M14 0C6.268 0 0 6.268 0 14C0 24.5 14 36 14 36C14 36 28 24.5 28 14C28 6.268 21.732 0 14 0Z" fill="white" filter="drop-shadow(0px 2px 2px rgba(0,0,0,0.3))"/>
      <circle cx="14" cy="14" r="11" fill="${config.color}"/>
      <g transform="translate(7, 7)">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="white">
          <path d="${config.icon}"/>
        </svg>
      </g>
      <circle cx="23" cy="5" r="4" fill="white"/>
      <circle cx="23" cy="5" r="2.5" fill="${statusColor}"/>
    </svg>
  `.trim();
};

const PULSING_DOT_HTML = `
  <div class="user-location-marker">
    <div class="ground-layer">
      <div class="pulse-ring"></div>
      <div id="user-view-cone" class="view-cone"></div>
    </div>
    <div class="user-pin">
      <div class="user-pin-popup">You are here</div>
      <svg xmlns="http://www.w3.org/2000/svg" width="36" height="45" viewBox="0 0 28 36">
        <path d="M14 0C6.268 0 0 6.268 0 14C0 24.5 14 36 14 36C14 36 28 24.5 28 14C28 6.268 21.732 0 14 0Z" fill="white" />
        <circle cx="14" cy="14" r="11" fill="#2563eb"/>
        <g transform="translate(7, 7)">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="white">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
        </g>
      </svg>
    </div>
  </div>
`;

export default function MapPage() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const popupRef = useRef(new mapboxgl.Popup({ offset: [0, -32], closeButton: true, closeOnClick: false }));
  
  const userMarkerRef = useRef(null);
  const userHeadingRef = useRef(0); 
  const userCoordsRef = useRef([0, 0]); 
  const loadedIconsRef = useRef(new Set());
  const fetchTimeoutRef = useRef(null);

  // NEW: Initial Loading State
  const [isMapLoading, setIsMapLoading] = useState(true);

  const [stores, setStores] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [itemResults, setItemResults] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  
  const [selectedStore, setSelectedStore] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  
  const [session, setSession] = useState(null);
  const [managedStores, setManagedStores] = useState([]);

  const navigate = useNavigate();
  const reactLocation = useLocation();
  const categories = ['All', 'Food & Dining', 'Retail', 'Services', 'Groceries'];

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) fetchManagedStores(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchManagedStores(session.user.id);
      } else {
        setManagedStores([]); 
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchManagedStores = async (userId) => {
    try {
      const res = await fetch(`https://locallook-api.onrender.com/api/merchant/stores/${userId}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setManagedStores(data);
      }
    } catch (err) { console.error(err); }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSidebarOpen(false); 
  };

  // Modified to return a Promise so we know when it finishes!
  const fetchStoresInBounds = async () => {
    if (!map.current) return;
    
    const bounds = map.current.getBounds();
    const minLng = bounds.getWest();
    const minLat = bounds.getSouth();
    const maxLng = bounds.getEast();
    const maxLat = bounds.getNorth();

    try {
      const res = await fetch(`https://locallook-api.onrender.com/api/stores?minLng=${minLng}&minLat=${minLat}&maxLng=${maxLng}&maxLat=${maxLat}`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setStores(data);
    } catch (err) {
      console.error("Map Fetch Error:", err);
    }
  };

  const updateMarkerVisuals = () => {
    if (!map.current || !userMarkerRef.current) return;
    const currentZoom = map.current.getZoom();
    const zoomScale = Math.pow(2, currentZoom - 16.5);
    let pinHeight = Math.max(25, 60 * zoomScale); 
    const groundScale = Math.max(0.6, Math.min(2.5, zoomScale));

    const el = userMarkerRef.current.getElement();
    const pinEl = el.querySelector('.user-pin');
    if (pinEl) pinEl.style.setProperty('--hover-dist', `${pinHeight}px`);
    const groundEl = el.querySelector('.ground-layer');
    if (groundEl) groundEl.style.setProperty('--ground-scale', groundScale);
  };

  const updateUserLocation = (lng, lat, heading = null) => {
    if (lng === 0 && lat === 0) return; 
    userCoordsRef.current = [lng, lat];
    if (heading !== null) userHeadingRef.current = heading;

    if (!userMarkerRef.current && map.current) {
      const el = document.createElement('div');
      el.style.width = '0px'; el.style.height = '0px'; el.style.position = 'relative';
      el.innerHTML = PULSING_DOT_HTML;
      
      const pinEl = el.querySelector('.user-pin');
      if (pinEl) pinEl.onclick = (e) => { e.stopPropagation(); pinEl.classList.toggle('show-popup'); };
      userMarkerRef.current = new mapboxgl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map.current);
    } else if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat([lng, lat]);
    }

    updateMarkerVisuals();

    const cone = document.getElementById('user-view-cone');
    if (cone && map.current) {
      cone.style.display = 'block'; 
      cone.style.transform = `rotate(${userHeadingRef.current - map.current.getBearing()}deg)`;
    }

    if (map.current && map.current.getSource('user-3d-source')) {
      map.current.getSource('user-3d-source').setData({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lng, lat] },
          properties: { rotation: [0, 0, -userHeadingRef.current] }
        }]
      });
    }
  };

  // MAP INITIALIZATION
  useEffect(() => {
    if (map.current || !mapContainer.current) return; 

    // NEW: Smart Loading! Check URL params or Session Storage to remember where the user was
    const urlParams = new URLSearchParams(reactLocation.search);
    const urlLat = urlParams.get('lat');
    const urlLng = urlParams.get('lng');
    const urlZoom = urlParams.get('zoom');
    
    const savedState = sessionStorage.getItem('locallook_map_state');
    
    let initialCenter = [121.9823, 12.3985]; // Default: Odiongan
    let initialZoom = 15.5;
    let shouldAutoLocate = false;

    if (urlLat && urlLng) {
      // 1. Came from the Profile "View Map Location" pill
      initialCenter = [parseFloat(urlLng), parseFloat(urlLat)];
      initialZoom = urlZoom ? parseFloat(urlZoom) : 17;
    } else if (savedState) {
      // 2. Clicked "Back" from a profile, load their last exact view
      const parsed = JSON.parse(savedState);
      initialCenter = [parsed.lng, parsed.lat];
      initialZoom = parsed.zoom;
    } else {
      // 3. Brand new visit, auto-locate them!
      shouldAutoLocate = true;
    }

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: initialCenter, 
      zoom: initialZoom,
      pitch: 55, 
      bearing: 0
    });

    map.current.addControl(new mapboxgl.NavigationControl({ showZoom: false, visualizePitch: true }), 'bottom-left');

    map.current.on('rotate', () => { if(userCoordsRef.current[0] !== 0) updateUserLocation(userCoordsRef.current[0], userCoordsRef.current[1]); });
    map.current.on('zoom', updateMarkerVisuals);
    map.current.on('click', () => { document.querySelectorAll('.user-pin.show-popup').forEach(el => el.classList.remove('show-popup')); });

    // Save position to memory when they stop moving
    map.current.on('moveend', () => {
      const center = map.current.getCenter();
      sessionStorage.setItem('locallook_map_state', JSON.stringify({ lng: center.lng, lat: center.lat, zoom: map.current.getZoom() }));

      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = setTimeout(() => {
        fetchStoresInBounds();
      }, 500);
    });

    map.current.on('style.load', () => {
      if (!map.current.getLayer('sky')) {
        map.current.addLayer({
          id: 'sky', type: 'sky', paint: { 'sky-type': 'atmosphere', 'sky-atmosphere-sun': [0.0, 0.0], 'sky-atmosphere-sun-intensity': 15 }
        });
      }

      map.current.addSource('user-3d-source', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.current.addLayer({
        id: 'user-shadow-layer', type: 'circle', source: 'user-3d-source',
        paint: {
          'circle-color': '#000000', 'circle-opacity': 0.35, 'circle-blur': 0.9,
          'circle-pitch-alignment': 'map', 'circle-pitch-scale': 'map', 
          'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 14, 0.1, 16.5, 0.6, 19, 3, 22, 24 ]
        }
      });

      map.current.addModel('custom-user-model', '/user-model.glb');
      map.current.addLayer({
        id: 'user-3d-layer', type: 'model', source: 'user-3d-source', layout: { 'model-id': 'custom-user-model' },
        paint: { 'model-color': '#2563eb', 'model-scale': [1, 1, 1], 'model-rotation': ['get', 'rotation'], 'model-translation': [0, 0, 1.5] }
      });

      if (shouldAutoLocate && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            updateUserLocation(position.coords.longitude, position.coords.latitude);
            map.current?.jumpTo({ center: [position.coords.longitude, position.coords.latitude], zoom: 16.5 });
          },
          () => console.log("Silent auto-locate failed."),
          { enableHighAccuracy: false, timeout: 5000, maximumAge: 0 } 
        );
      }
      
      // Fetch initial stores and turn off the loading screen!
      fetchStoresInBounds().then(() => setIsMapLoading(false));
    });

    return () => {
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
      if (map.current) { map.current.remove(); map.current = null; userMarkerRef.current = null; }
    };
  }, [reactLocation.search]);

  useEffect(() => {
    const subscription = supabase
      .channel('public:stores')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stores' }, (payload) => {
          setStores(currentStores => {
            if (!Array.isArray(currentStores)) return [];
            return currentStores.map(store => store.id === payload.new.id ? { ...store, is_open: payload.new.is_open } : store);
          });
      }).subscribe();
    return () => { supabase.removeChannel(subscription); };
  }, []);

  useEffect(() => {
    if (searchTerm.length > 1) {
      fetch(`https://locallook-api.onrender.com/api/search/items?q=${searchTerm}`)
        .then(res => res.json())
        .then(data => setItemResults(Array.isArray(data) ? data : []))
        .catch(err => console.error(err));
    } else {
      setItemResults([]);
    }
  }, [searchTerm]);

  const filteredStores = useMemo(() => {
    if (!Array.isArray(stores)) return [];
    return stores.filter(store => {
      const hasCoords = store.lat && store.lng && !isNaN(Number(store.lat)) && !isNaN(Number(store.lng));
      const matchesSearch = store.store_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = activeCategory === 'All' || store.store_category === activeCategory;
      return hasCoords && matchesSearch && matchesCategory;
    });
  }, [stores, searchTerm, activeCategory]);

  useEffect(() => {
    if (!map.current) return;

    const renderWebGLData = async () => {
      if (!map.current.isStyleLoaded()) return;

      for (const store of filteredStores) {
        const iconId = `sprite-${store.store_category}-${store.is_open ? 'open' : 'closed'}`;
        if (!loadedIconsRef.current.has(iconId)) {
          loadedIconsRef.current.add(iconId);
          const svgString = makeSvgString(store.store_category, store.is_open);
          const img = new Image();
          img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
          await new Promise((resolve) => {
            img.onload = () => { if (map.current && !map.current.hasImage(iconId)) map.current.addImage(iconId, img); resolve(); };
            img.onerror = resolve; 
          });
        }
      }

      const geoJsonData = {
        type: 'FeatureCollection',
        features: filteredStores.map(store => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [Number(store.lng), Number(store.lat)] },
          properties: {
            id: store.id, name: store.store_name, category: store.store_category, isOpen: store.is_open,
            textColor: getPinConfig(store.store_category).color, iconImage: `sprite-${store.store_category}-${store.is_open ? 'open' : 'closed'}`
          }
        }))
      };

      if (map.current.getSource('stores-source')) {
        map.current.getSource('stores-source').setData(geoJsonData);
      } else {
        map.current.addSource('stores-source', { type: 'geojson', data: geoJsonData });

        map.current.addLayer({
          id: 'stores-dots-layer', type: 'circle', source: 'stores-source', maxzoom: 14.8, 
          paint: { 'circle-radius': 4.5, 'circle-color': ['get', 'textColor'], 'circle-stroke-width': 1.5, 'circle-stroke-color': '#ffffff' }
        });

        map.current.addLayer({
          id: 'stores-layer', type: 'symbol', source: 'stores-source', minzoom: 14.8, 
          layout: {
            'icon-image': ['get', 'iconImage'], 'icon-size': 0.85, 'icon-anchor': 'bottom', 'icon-allow-overlap': true, 'icon-ignore-placement': true,
            'text-field': ['get', 'name'], 'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'], 'text-size': 13.5,
            'text-anchor': 'left', 'text-offset': [0.8, -1.4], 'text-justify': 'left', 'text-optional': true 
          },
          paint: { 'text-color': ['get', 'textColor'], 'text-halo-color': '#ffffff', 'text-halo-width': 2.5, 'text-halo-blur': 1 }
        });

        const handleStoreClick = (e) => {
          const props = e.features[0].properties;
          const coords = e.features[0].geometry.coordinates;
          const matchedStore = filteredStores.find(s => s.id === props.id);
          if (matchedStore) {
            setSelectedStore(matchedStore);
            map.current.flyTo({ center: coords, zoom: 18, pitch: 60, duration: 1200 });
          }
        };

        map.current.on('click', 'stores-layer', handleStoreClick);
        map.current.on('click', 'stores-dots-layer', handleStoreClick);

        const addPointer = () => { map.current.getCanvas().style.cursor = 'pointer'; };
        const removePointer = () => { map.current.getCanvas().style.cursor = ''; };
        
        map.current.on('mouseenter', 'stores-layer', addPointer);
        map.current.on('mouseleave', 'stores-layer', removePointer);
        map.current.on('mouseenter', 'stores-dots-layer', addPointer);
        map.current.on('mouseleave', 'stores-dots-layer', removePointer);
      }
    };

    if (map.current.isStyleLoaded()) { renderWebGLData(); } else { map.current.once('style.load', renderWebGLData); }
  }, [filteredStores]);

  // SAFELY BUILD THE POPUP (Fixes the Unclickable Store Bug)
  useEffect(() => {
    if (!map.current) return;
    const onPopupClose = () => setSelectedStore(null);

    if (selectedStore) {
      // Build DOM elements safely to prevent HTML injection bugs
      const div = document.createElement('div');
      div.style.textAlign = 'center'; div.style.padding = '8px 4px 4px 4px';

      const title = document.createElement('strong');
      title.style.cssText = 'font-size: 16px; display: block; margin-bottom: 2px; color: #1f2937;';
      title.textContent = selectedStore.store_name;

      const cat = document.createElement('span');
      cat.style.cssText = 'color: #6b7280; font-size: 13px; display: block; margin-bottom: 12px;';
      cat.textContent = selectedStore.store_category;

      const btn = document.createElement('button');
      btn.style.cssText = 'width: 100%; padding: 10px; background-color: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;';
      btn.textContent = 'View Full Menu';
      btn.onclick = () => navigate(`/store/${selectedStore.id}`);

      div.appendChild(title);
      div.appendChild(cat);
      div.appendChild(btn);

      popupRef.current.setLngLat([Number(selectedStore.lng), Number(selectedStore.lat)]).setDOMContent(div).addTo(map.current);
      popupRef.current.on('close', onPopupClose);
    } else {
      popupRef.current.off('close', onPopupClose);
      popupRef.current.remove();
    }
    return () => popupRef.current.off('close', onPopupClose);
  }, [selectedStore, navigate]);

  const startCompass = () => {
    const handleOrientation = (e) => {
      let heading = null;
      if (e.webkitCompassHeading !== undefined) { heading = e.webkitCompassHeading; } 
      else if (e.alpha !== null) { heading = 360 - e.alpha; }
      if (heading !== null) { updateUserLocation(userCoordsRef.current[0], userCoordsRef.current[1], heading); }
    };

    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().then(response => { if (response === 'granted') { window.addEventListener('deviceorientation', handleOrientation); } }).catch(err => console.log(err));
    } else {
      window.addEventListener('deviceorientationabsolute', handleOrientation);
      window.addEventListener('deviceorientation', handleOrientation); 
    }
  };

  const handleLocateMe = (e) => {
    e.stopPropagation();
    if (!navigator.geolocation) return alert("Your device doesn't support location services.");
    
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        updateUserLocation(position.coords.longitude, position.coords.latitude);
        map.current?.flyTo({ center: [position.coords.longitude, position.coords.latitude], zoom: 18, pitch: 60 });
        startCompass();
      },
      () => {
        fetch('https://ipapi.co/json/').then(res => res.json()).then(data => {
            setIsLocating(false);
            if (data.longitude && data.latitude) {
              updateUserLocation(data.longitude, data.latitude);
              map.current?.flyTo({ center: [data.longitude, data.latitude], zoom: 16, pitch: 50 });
            } else { alert("Could not detect location."); }
          }).catch(() => { setIsLocating(false); alert("Could not detect location."); });
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 } 
    );
  };

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100vw', overflow: 'hidden', backgroundColor: '#f3f4f6', fontFamily: 'sans-serif' }}>
      
      {/* BEAUTIFUL LOADING OVERLAY */}
      {isMapLoading && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 9999, backgroundColor: '#f9fafb', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
          <div style={{ fontSize: '50px', animation: 'bounce 1s infinite' }}>🧭</div>
          <h2 style={{ color: '#1f2937', marginTop: '15px', fontWeight: '800' }}>LocalLook</h2>
          <p style={{ color: '#6b7280', fontSize: '14px', fontWeight: 'bold' }}>Loading your neighborhood...</p>
        </div>
      )}

      <style>{`
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-15px); } }
        .user-location-marker { position: absolute; top: 0; left: 0; pointer-events: none; }
        .user-pin { position: absolute; bottom: 0; left: 50%; cursor: pointer; pointer-events: auto; --hover-dist: 80px; transform: translate(-50%, calc(-1 * var(--hover-dist))); animation: pin-bounce 2s infinite cubic-bezier(0.4, 0, 0.2, 1); z-index: 15; transition: transform 0.05s ease-out; }
        .user-pin:hover { filter: brightness(1.1); }
        @keyframes pin-bounce { 0%, 100% { transform: translate(-50%, calc(-1 * var(--hover-dist))); } 50% { transform: translate(-50%, calc(-1 * var(--hover-dist) - 8px)); } }
        .user-pin-popup { position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%) translateY(0px); background: white; color: #1f2937; font-weight: 800; font-size: 13px; padding: 6px 12px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.15); white-space: nowrap; pointer-events: none; opacity: 0; visibility: hidden; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
        .user-pin-popup::after { content: ''; position: absolute; top: 100%; left: 50%; transform: translateX(-50%); border: 6px solid transparent; border-top-color: white; }
        .user-pin.show-popup .user-pin-popup { opacity: 1; visibility: visible; transform: translateX(-50%) translateY(-6px); }
        .ground-layer { position: absolute; top: 0; left: 0; --ground-scale: 1; transform: translate(-50%, -50%) rotateX(65deg) scale(var(--ground-scale)); transition: transform 0.05s ease-out; z-index: 1; }
        .pulse-ring { position: absolute; top: -60px; left: -60px; width: 120px; height: 120px; background-color: rgba(59, 130, 246, 0.2); border: 1.5px solid rgba(59, 130, 246, 0.6); border-radius: 50%; animation: ground-pulse 2.5s cubic-bezier(0.1, 0.7, 0.1, 1) infinite; }
        .view-cone { position: absolute; top: -60px; left: -60px; width: 120px; height: 120px; border-radius: 50%; background: conic-gradient(from 330deg, transparent 0, rgba(37, 99, 235, 0.4) 30deg, transparent 60deg); transform-origin: center center; display: none; }
        @keyframes ground-pulse { 0% { transform: scale(0.01); opacity: 0.8; } 100% { transform: scale(1); opacity: 0; } }
      `}</style>

      <div ref={mapContainer} style={{ position: 'absolute', inset: 0, zIndex: 0 }} />

      <div style={{ position: 'absolute', bottom: '90px', right: '15px', zIndex: 1000 }}>
        <button onClick={handleLocateMe} disabled={isLocating} style={{ width: '50px', height: '50px', backgroundColor: 'white', borderRadius: '50%', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'transform 0.1s' }} onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'} onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}>
          {isLocating ? ( <svg style={{ animation: 'spin 1s linear infinite', width: '24px', height: '24px', color: '#2563eb' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> ) : ( <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg> )}
        </button>
      </div>

      <div style={{ position: 'absolute', top: '15px', left: '15px', zIndex: 2000 }}>
        <button onClick={() => setSidebarOpen(true)} style={{ width: '45px', height: '45px', backgroundColor: 'white', borderRadius: '50%', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', cursor: 'pointer', fontSize: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#1f2937', transition: 'transform 0.1s' }}>☰</button>
      </div>

      {sidebarOpen && (
        <>
          <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 2999, backdropFilter: 'blur(2px)' }} />
          <div style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: '280px', backgroundColor: 'white', zIndex: 3000, boxShadow: '5px 0 25px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '25px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '20px', color: '#2563eb', fontWeight: '900' }}>LocalLook</h2>
              <button onClick={() => setSidebarOpen(false)} style={{ background: 'transparent', border: 'none', fontSize: '28px', cursor: 'pointer', color: '#6b7280', padding: '0 5px' }}>×</button>
            </div>
            
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '5px' }}>BUSINESS PORTAL</div>
              
              {session ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div style={{ backgroundColor: '#f3f4f6', padding: '15px', borderRadius: '12px' }}>
                    <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 'bold', marginBottom: '4px' }}>SIGNED IN AS</div>
                    <div style={{ fontSize: '15px', color: '#1f2937', fontWeight: '900', wordBreak: 'break-word', textTransform: 'capitalize' }}>{session.user.user_metadata?.full_name || session.user.user_metadata?.name || 'Partner Account'}</div>
                    <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600', marginTop: '2px', wordBreak: 'break-all' }}>{session.user.email}</div>
                  </div>

                  {managedStores.length > 0 && (
                    <div>
                      <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 'bold', marginBottom: '8px' }}>YOUR LOCATIONS</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        {managedStores.map(store => (
                          <div key={`managed-${store.id}`} onClick={() => navigate(`/store/${store.id}`)} style={{ padding: '10px', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', color: '#374151', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>{store.store_name}</span>
                            <span style={{ fontSize: '10px', padding: '2px 6px', backgroundColor: '#e5e7eb', borderRadius: '4px' }}>{store.role.toUpperCase()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button onClick={() => navigate('/dashboard')} style={{ width: '100%', padding: '15px', textAlign: 'center', backgroundColor: '#2563eb', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold', color: 'white' }}>Go to Merchant Hub →</button>
                  <button onClick={handleSignOut} style={{ width: '100%', padding: '10px', textAlign: 'center', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', color: '#ef4444' }}>Sign Out</button>
                </div>
              ) : (
                <>
                  <button onClick={() => navigate('/login')} style={{ width: '100%', padding: '15px', textAlign: 'left', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '12px', color: '#1d4ed8' }}>🔑 Partner & Staff Login</button>
                  <button onClick={() => navigate('/register')} style={{ width: '100%', padding: '15px', textAlign: 'left', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '12px', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '12px', color: '#374151' }}>🏪 Register a Business</button>
                </>
              )}
            </div>
          </div>
        </>
      )}

      <div style={{ position: 'absolute', top: '15px', left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 140px)', maxWidth: '500px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ position: 'relative' }}>
          <div style={{ backgroundColor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', borderRadius: '16px', padding: '10px 15px', display: 'flex', alignItems: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', flexGrow: 1, alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: '20px', padding: '8px 15px' }}>
              <span style={{ fontSize: '16px', color: '#6b7280', marginRight: '10px' }}>🔍</span>
              <input type="text" placeholder="Search places..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ border: 'none', backgroundColor: 'transparent', flexGrow: 1, outline: 'none', fontSize: '15px' }} />
              {searchTerm && <span onClick={() => setSearchTerm('')} style={{ fontSize: '14px', color: '#9ca3af', cursor: 'pointer', padding: '0 5px' }}>✖</span>}
            </div>
          </div>
          {searchTerm.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px', backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', overflow: 'hidden', maxHeight: '400px', overflowY: 'auto', border: '1px solid #f3f4f6' }}>
              {itemResults.length > 0 ? (
                <div>
                  <div style={{ padding: '10px 15px', backgroundColor: '#f9fafb', fontSize: '11px', fontWeight: 'bold', color: '#6b7280', letterSpacing: '1px' }}>ITEMS FOUND IN STORES</div>
                  {itemResults.map(item => {
                    const storeMatch = stores.find(s => s.id === item.store_id);
                    if (!storeMatch) return null;
                    return (
                      <div key={`item-${item.id}`} onClick={() => navigate(`/store/${item.store_id}`)} style={{ padding: '12px 15px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                        <div><h4 style={{ margin: '0 0 2px 0', color: '#1f2937', fontSize: '14px' }}>{item.item_name} <span style={{color: '#9ca3af', fontWeight: 'normal'}}>at {storeMatch.store_name}</span></h4><p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>₱{item.price}</p></div>
                        <span style={{ fontSize: '10px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '12px', backgroundColor: storeMatch.is_open ? '#d1fae5' : '#fee2e2', color: storeMatch.is_open ? '#059669' : '#dc2626' }}>{storeMatch.is_open ? 'OPEN' : 'CLOSED'}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>No items or stores found.</div>
              )}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '5px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {categories.map(category => (
            <button key={category} onClick={() => setActiveCategory(category)} style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', backgroundColor: activeCategory === category ? '#2563eb' : 'white', color: activeCategory === category ? 'white' : '#4b5563', fontWeight: '600', fontSize: '12.5px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s' }}>
              {category}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}