import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '../supabaseClient';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
mapboxgl.accessToken = MAPBOX_TOKEN;

const generatePinHTML = (category, storeName, isOpen, zoom) => {
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

  const config = getPinConfig(category);
  const statusColor = isOpen ? '#10b981' : '#ef4444'; 
  const isTextVisible = zoom >= 16.5; 
  const isIconVisible = zoom >= 14.5; 
  const circleSize = isIconVisible ? 24 : 12; 
  const iconSize = 14; 

  return `
    <div style="display: flex; align-items: center; gap: 6px; cursor: pointer; will-change: transform;">
      <div style="position: relative; width: ${circleSize}px; height: ${circleSize}px; background-color: ${config.color}; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3); display: flex; justify-content: center; align-items: center; transition: all 0.2s;">
        ${isIconVisible ? `<svg viewBox="0 0 24 24" width="${iconSize}" height="${iconSize}" fill="white"><path d="${config.icon}" /></svg>` : ''}
        <div style="position: absolute; top: -2px; right: -2px; width: ${isIconVisible ? '8px' : '6px'}; height: ${isIconVisible ? '8px' : '6px'}; background-color: ${statusColor}; border: 1.5px solid white; border-radius: 50%;"></div>
      </div>
      ${isTextVisible ? `
        <div style="color: ${config.color}; font-weight: 800; font-size: 13.5px; white-space: nowrap; text-shadow: -1.5px -1.5px 0 #fff, 1.5px -1.5px 0 #fff, -1.5px 1.5px 0 #fff, 1.5px 1.5px 0 #fff, 0 2px 5px rgba(0,0,0,0.3);">
          ${storeName}
        </div>
      ` : ''}
    </div>
  `;
};

const PULSING_DOT_HTML = `
  <div style="position: relative; width: 22px; height: 22px; display: flex; justify-content: center; align-items: center; pointer-events: none; will-change: transform;">
    <div style="position: absolute; width: 100%; height: 100%; background-color: #3b82f6; border-radius: 50%; opacity: 0.5; animation: pulse 2s ease-out infinite;"></div>
    <div style="position: relative; width: 16px; height: 16px; background-color: #2563eb; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.4);"></div>
  </div>
  <style>
    @keyframes pulse {
      0% { transform: scale(1); opacity: 0.6; }
      100% { transform: scale(3.5); opacity: 0; }
    }
  </style>
`;

export default function MapPage() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef({}); 
  const popupRef = useRef(new mapboxgl.Popup({ offset: 24, closeButton: true, closeOnClick: false }));
  const userMarkerRef = useRef(null);

  const [stores, setStores] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [itemResults, setItemResults] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  
  const [selectedStore, setSelectedStore] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(16.5);
  const [isLocating, setIsLocating] = useState(false);
  
  const navigate = useNavigate();
  const categories = ['All', 'Food & Dining', 'Retail', 'Services', 'Groceries'];

  // 1. BULLETPROOF MAP INITIALIZATION
  useEffect(() => {
    if (map.current) return; 

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [121.9823, 12.3985], // Odiongan default
      zoom: 16.5,
      pitch: 55, 
      bearing: 0
    });

    map.current.addControl(new mapboxgl.NavigationControl({ showZoom: false, visualizePitch: true }), 'bottom-left');

    // FIX: Using zoomend instead of zoom to prevent CPU lag
    map.current.on('zoomend', () => {
      setZoomLevel(map.current.getZoom());
    });

    map.current.on('load', () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { longitude, latitude } = position.coords;
            
            if (!userMarkerRef.current && map.current) {
              const el = document.createElement('div');
              el.innerHTML = PULSING_DOT_HTML;
              userMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' }).addTo(map.current);
            }
            if (userMarkerRef.current) userMarkerRef.current.setLngLat([longitude, latitude]);
            
            if (map.current) {
              map.current.easeTo({
                center: [longitude, latitude],
                zoom: 16.5,
                duration: 1000
              });
            }
          },
          (error) => console.log("Auto-locate skipped.", error),
          { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
        );
      }
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // 2. FETCH DATA
  useEffect(() => {
    fetch('https://locallook-api.onrender.com/api/stores')
      .then(res => res.json())
      .then(data => setStores(data))
      .catch(err => console.error(err));

    const subscription = supabase
      .channel('public:stores')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stores' }, (payload) => {
          setStores(currentStores => 
            currentStores.map(store => store.id === payload.new.id ? { ...store, is_open: payload.new.is_open } : store)
          );
      }).subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, []);

  // 3. SEARCH LOGIC
  useEffect(() => {
    if (searchTerm.length > 1) {
      fetch(`https://locallook-api.onrender.com/api/search/items?q=${searchTerm}`)
        .then(res => res.json())
        .then(data => setItemResults(data))
        .catch(err => console.error(err));
    } else {
      setItemResults([]);
    }
  }, [searchTerm]);

  const filteredStores = useMemo(() => {
    return stores.filter(store => {
      const matchesSearch = store.store_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = activeCategory === 'All' || store.store_category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [stores, searchTerm, activeCategory]);

  // 4. SYNC MARKERS WITH MAP
  useEffect(() => {
    if (!map.current) return;

    if (zoomLevel < 13) {
      Object.values(markersRef.current).forEach(m => m.remove());
      markersRef.current = {};
      return;
    }

    const newStoreIds = new Set(filteredStores.map(s => s.id));

    Object.keys(markersRef.current).forEach(id => {
      if (!newStoreIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    filteredStores.forEach(store => {
      const pinHTML = generatePinHTML(store.store_category, store.store_name, store.is_open, zoomLevel);

      if (!markersRef.current[store.id]) {
        const el = document.createElement('div');
        el.innerHTML = pinHTML;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelectedStore(store);
          map.current.flyTo({ center: [Number(store.lng), Number(store.lat)], zoom: 18, pitch: 60, duration: 1500 });
        });

        // FIX: Changed anchor to 'left' so the pin never shifts position when text is added
        const marker = new mapboxgl.Marker({ element: el, anchor: 'left' })
          .setLngLat([Number(store.lng), Number(store.lat)])
          .addTo(map.current);

        markersRef.current[store.id] = marker;
      } else {
        markersRef.current[store.id].getElement().innerHTML = pinHTML;
      }
    });
  }, [filteredStores, zoomLevel]);

  // 5. MANAGE NATIVE POPUP
  useEffect(() => {
    if (!map.current) return;

    const onPopupClose = () => setSelectedStore(null);

    if (selectedStore) {
      const div = document.createElement('div');
      div.innerHTML = `
        <div style="text-align: center; padding: 8px 4px 4px 4px;">
          <strong style="font-size: 16px; display: block; margin-bottom: 2px; color: #1f2937;">${selectedStore.store_name}</strong>
          <span style="color: #6b7280; font-size: 13px; display: block; margin-bottom: 12px;">${selectedStore.store_category}</span>
          <button id="popup-btn-${selectedStore.id}" style="width: 100%; padding: 10px; background-color: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
            View Full Menu
          </button>
        </div>
      `;

      popupRef.current
        .setLngLat([Number(selectedStore.lng), Number(selectedStore.lat)])
        .setDOMContent(div)
        .addTo(map.current);

      popupRef.current.on('close', onPopupClose);

      document.getElementById(`popup-btn-${selectedStore.id}`).onclick = () => {
        navigate(`/store/${selectedStore.id}`);
      };
    } else {
      popupRef.current.off('close', onPopupClose);
      popupRef.current.remove();
    }

    return () => {
      popupRef.current.off('close', onPopupClose);
    };
  }, [selectedStore, navigate]);

  // 6. EXPLICIT LOCATE ME WITH HIGH ACCURACY
  const handleLocateMe = (e) => {
    e.stopPropagation();
    if (!navigator.geolocation) {
      alert("Your device doesn't support location services.");
      return;
    }

    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        const { longitude, latitude } = position.coords;
        
        if (!userMarkerRef.current) {
          const el = document.createElement('div');
          el.innerHTML = PULSING_DOT_HTML;
          userMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' }).addTo(map.current);
        }
        
        userMarkerRef.current.setLngLat([longitude, latitude]);
        
        if (map.current) {
          map.current.flyTo({ 
            center: [longitude, latitude], 
            zoom: 17.5, 
            pitch: 50, 
            duration: 2000, 
            essential: true
          });
        }
      },
      (error) => {
        setIsLocating(false);
        switch(error.code) {
          case error.PERMISSION_DENIED:
            alert("Location access denied. Please allow location access for this site.");
            break;
          case error.POSITION_UNAVAILABLE:
            alert("Location information is currently unavailable.");
            break;
          case error.TIMEOUT:
            alert("The request to get your location timed out.");
            break;
          default:
            alert("An unknown error occurred while trying to find your location.");
            break;
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100vw', overflow: 'hidden', backgroundColor: '#f3f4f6', fontFamily: 'sans-serif' }}>
      
      {/* MAPBOX CONTAINER */}
      <div ref={mapContainer} style={{ position: 'absolute', inset: 0, zIndex: 0 }} />

      {/* LOCATE ME BUTTON */}
      <div style={{ position: 'absolute', bottom: '40px', right: '15px', zIndex: 1000 }}>
        <button 
          onClick={handleLocateMe} 
          disabled={isLocating}
          style={{ width: '50px', height: '50px', backgroundColor: 'white', borderRadius: '50%', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'transform 0.1s' }}
          onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
          onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          {isLocating ? (
             <svg style={{ animation: 'spin 1s linear infinite', width: '24px', height: '24px', color: '#2563eb' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
               <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
               <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
             </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
            </svg>
          )}
        </button>
        <style>
          {`@keyframes spin { 100% { transform: rotate(360deg); } }`}
        </style>
      </div>

      {/* HAMBURGER MENU BUTTON */}
      <div style={{ position: 'absolute', top: '15px', left: '15px', zIndex: 2000 }}>
        <button 
          onClick={() => setSidebarOpen(true)} 
          style={{ width: '45px', height: '45px', backgroundColor: 'white', borderRadius: '50%', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', cursor: 'pointer', fontSize: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#1f2937', transition: 'transform 0.1s' }}
        >
          ☰
        </button>
      </div>

      {/* SLIDE-OUT SIDEBAR MENU */}
      {sidebarOpen && (
        <>
          <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 2999, backdropFilter: 'blur(2px)' }} />
          
          <div style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: '280px', backgroundColor: 'white', zIndex: 3000, boxShadow: '5px 0 25px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', animation: 'slideIn 0.3s ease-out' }}>
            <div style={{ padding: '25px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '20px', color: '#2563eb', fontWeight: '900' }}>LocalLook</h2>
              <button onClick={() => setSidebarOpen(false)} style={{ background: 'transparent', border: 'none', fontSize: '28px', cursor: 'pointer', color: '#6b7280', padding: '0 5px' }}>×</button>
            </div>
            
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '5px' }}>MERCHANT PORTAL</div>
              
              <button onClick={() => navigate('/login')} style={{ width: '100%', padding: '15px', textAlign: 'left', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '12px', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '12px', color: '#374151' }}>
                🔑 Operator Login
              </button>
              
              <button onClick={() => navigate('/register')} style={{ width: '100%', padding: '15px', textAlign: 'left', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '12px', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '12px', color: '#374151' }}>
                🏪 Register a Store
              </button>
            </div>
          </div>
        </>
      )}

      {/* TOP FLOATING UI (Search Bar & Dropdown) */}
      <div style={{ position: 'absolute', top: '15px', left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 140px)', maxWidth: '500px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        
        <div style={{ position: 'relative' }}>
          
          <div style={{ backgroundColor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', borderRadius: '16px', padding: '10px 15px', display: 'flex', alignItems: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', flexGrow: 1, alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: '20px', padding: '8px 15px' }}>
              <span style={{ fontSize: '16px', color: '#6b7280', marginRight: '10px' }}>🔍</span>
              <input 
                type="text" 
                placeholder="Search places..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ border: 'none', backgroundColor: 'transparent', flexGrow: 1, outline: 'none', fontSize: '15px' }} 
              />
              {searchTerm && (
                <span onClick={() => setSearchTerm('')} style={{ fontSize: '14px', color: '#9ca3af', cursor: 'pointer', padding: '0 5px' }}>✖</span>
              )}
            </div>
          </div>

          {searchTerm.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px', backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', overflow: 'hidden', maxHeight: '400px', overflowY: 'auto', border: '1px solid #f3f4f6' }}>
              
              {filteredStores.length > 0 && (
                <div>
                  <div style={{ padding: '10px 15px', backgroundColor: '#f9fafb', fontSize: '11px', fontWeight: 'bold', color: '#6b7280', letterSpacing: '1px' }}>STORES</div>
                  {filteredStores.map(store => (
                    <div 
                      key={`store-${store.id}`}
                      onClick={() => navigate(`/store/${store.id}`)}
                      style={{ padding: '12px 15px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    >
                      <div>
                        <h4 style={{ margin: '0 0 2px 0', color: '#1f2937', fontSize: '14px' }}>{store.store_name}</h4>
                        <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>{store.store_category}</p>
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '12px', backgroundColor: store.is_open ? '#d1fae5' : '#fee2e2', color: store.is_open ? '#059669' : '#dc2626' }}>
                        {store.is_open ? 'OPEN' : 'CLOSED'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {itemResults.length > 0 && (
                <div>
                  <div style={{ padding: '10px 15px', backgroundColor: '#f9fafb', fontSize: '11px', fontWeight: 'bold', color: '#6b7280', letterSpacing: '1px' }}>ITEMS</div>
                  {itemResults.map(item => (
                    <div 
                      key={`item-${item.item_id}`}
                      onClick={() => navigate(`/store/${item.store_id}`)}
                      style={{ 
                        padding: '12px 15px', 
                        borderBottom: '1px solid #f3f4f6', 
                        cursor: 'pointer', 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        opacity: item.is_open ? 1 : 0.5
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    >
                      <div>
                        <h4 style={{ margin: '0 0 2px 0', color: '#1f2937', fontSize: '14px' }}>
                          {item.item_name}
                        </h4>
                        <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
                          at <strong style={{ color: item.is_open ? '#2563eb' : '#6b7280' }}>{item.store_name}</strong>
                        </p>
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: '800', color: item.is_open ? '#10b981' : '#9ca3af' }}>
                        ₱{parseFloat(item.price).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {filteredStores.length === 0 && itemResults.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280', fontSize: '14px', fontStyle: 'italic' }}>
                  No stores or items found for "{searchTerm}"
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '5px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {categories.map(category => (
            <button 
              key={category} 
              onClick={() => setActiveCategory(category)}
              style={{ 
                padding: '8px 16px', 
                borderRadius: '20px', 
                border: 'none', 
                backgroundColor: activeCategory === category ? '#2563eb' : 'white', 
                color: activeCategory === category ? 'white' : '#4b5563', 
                fontWeight: '600', 
                fontSize: '12.5px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)', 
                cursor: 'pointer', 
                whiteSpace: 'nowrap',
                transition: 'all 0.2s'
              }}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}