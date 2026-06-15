import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { divIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../supabaseClient';

// 1. THE STORE PIN ICON
const customMarker = divIcon({
  className: 'custom-map-pin',
  html: `<div style="background-color: #2563eb; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 3px 6px rgba(0,0,0,0.4);"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -14],
});

// 2. THE NEW USER LOCATION ICON (Glowing Blue Dot)
const userMarker = divIcon({
  className: 'user-location-pin',
  html: `<div style="background-color: #3b82f6; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 15px rgba(59,130,246,0.8);"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -12],
});

// 3. THE CAMERA CONTROLLER (Smoothly flies the map to the user)
function LocationController({ userPosition }) {
  const map = useMap();
  useEffect(() => {
    if (userPosition) {
      map.flyTo(userPosition, 16, { animate: true, duration: 1.5 });
    }
  }, [userPosition, map]);
  
  return userPosition === null ? null : (
    <Marker position={userPosition} icon={userMarker}>
      <Popup>You are here!</Popup>
    </Marker>
  );
}

export default function MapPage() {
  const [stores, setStores] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [itemResults, setItemResults] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  
  // NEW: State to track where the user is
  const [userPosition, setUserPosition] = useState(null);
  
  const navigate = useNavigate();
  const categories = ['All', 'Food & Dining', 'Retail', 'Services', 'Groceries'];

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

  const filteredStores = stores.filter(store => {
    const matchesSearch = store.store_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === 'All' || store.store_category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  // NEW: Function to trigger browser GPS
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert("Your browser doesn't support location services.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserPosition([position.coords.latitude, position.coords.longitude]);
      },
      (error) => {
        alert("Could not get your location. Please check your browser permissions.");
      }
    );
  };

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100vw', overflow: 'hidden', backgroundColor: '#f3f4f6', fontFamily: 'sans-serif' }}>
      
      {/* 1. THE MAP BACKGROUND */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        {/* Default center is Odiongan */}
        <MapContainer center={[12.3985, 121.9823]} zoom={16} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          
          {/* Automatically controls the camera if user tracking is triggered */}
          <LocationController userPosition={userPosition} />
          
          {filteredStores.map(store => (
            <Marker key={store.id} position={[Number(store.lat), Number(store.lng)]} icon={customMarker}>
              <Popup minWidth={200}>
                <div style={{ textAlign: 'center', padding: '5px 0' }}>
                  <strong style={{ fontSize: '16px', display: 'block', marginBottom: '4px' }}>{store.store_name}</strong>
                  <span style={{ color: '#666', display: 'block', marginBottom: '8px' }}>{store.store_category}</span>
                  <button onClick={() => navigate(`/store/${store.id}`)} style={{ width: '100%', padding: '10px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
                    View Full Menu
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* NEW: LOCATE ME BUTTON (Bottom Right) */}
      <div style={{ position: 'absolute', bottom: '30px', right: '15px', zIndex: 1000 }}>
        <button 
          onClick={handleLocateMe} 
          style={{ width: '50px', height: '50px', backgroundColor: 'white', borderRadius: '50%', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', cursor: 'pointer', fontSize: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#2563eb', transition: 'transform 0.1s' }}
          onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
          onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          📍
        </button>
      </div>

      {/* 2. HAMBURGER MENU BUTTON */}
      <div style={{ position: 'absolute', top: '15px', left: '15px', zIndex: 2000 }}>
        <button 
          onClick={() => setSidebarOpen(true)} 
          style={{ width: '45px', height: '45px', backgroundColor: 'white', borderRadius: '50%', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', cursor: 'pointer', fontSize: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#1f2937', transition: 'transform 0.1s' }}
        >
          ☰
        </button>
      </div>

      {/* 3. SLIDE-OUT SIDEBAR MENU */}
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

      {/* 4. TOP FLOATING UI (Search Bar & Dropdown) */}
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
              
              {/* STORE RESULTS */}
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

              {/* ITEM RESULTS */}
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
                          {!item.is_open && (
                            <span style={{ marginLeft: '6px', color: '#dc2626', fontWeight: '900', fontSize: '10px' }}>
                              (CLOSED)
                            </span>
                          )}
                        </p>
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: '800', color: item.is_open ? '#10b981' : '#9ca3af' }}>
                        ₱{parseFloat(item.price).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* EMPTY STATE */}
              {filteredStores.length === 0 && itemResults.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280', fontSize: '14px', fontStyle: 'italic' }}>
                  No stores or items found for "{searchTerm}"
                </div>
              )}
            </div>
          )}
        </div>

        {/* Category Pills */}
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
                fontWeight: 'bold', 
                fontSize: '13px',
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