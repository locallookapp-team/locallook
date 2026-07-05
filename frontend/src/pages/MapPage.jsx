import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { renderToString } from 'react-dom/server';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '../supabaseClient';
import { CustomMapPin } from '../components/MapMarkers';
import { MdSearch, MdNotificationsNone, MdTune, MdExpandMore, MdLocationOn, MdStorefront, MdFastfood, MdClose, MdStar } from "react-icons/md";

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

export default function MapPage() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef({}); 
  const popupRef = useRef(new mapboxgl.Popup({ offset: [0, -32], closeButton: true, closeOnClick: false }));
  
  const [stores, setStores] = useState(globalStoreCache);
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedStore, setSelectedStore] = useState(null);

  const [activeLocation, setActiveLocation] = useState(TABLAS_MUNICIPALITIES[0]); 
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState({ stores: [], items: [] });

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    distance: 10, 
    minRating: 0,
    openNow: false
  });

  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);

  const navigate = useNavigate();
  const categories = ['All', 'Food & Dining', 'Grocery & Retail', 'Beauty & Personal Care', 'Automotive'];

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
      center: [activeLocation.lng, activeLocation.lat], 
      zoom: 16, 
      pitch: 0 
    });
    map.current.addControl(new mapboxgl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }), 'bottom-right');
    map.current.on('moveend', fetchStoresInBounds);
    map.current.on('style.load', fetchStoresInBounds);

    return () => { if (map.current) { map.current.remove(); map.current = null; } };
  }, []);

  const handleLocationSelect = (loc) => {
    setActiveLocation(loc);
    setIsLocationDropdownOpen(false);
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
          const matchesName = store.store_name?.toLowerCase().includes(term);
          const matchesIndustry = store.industry?.toLowerCase().includes(term);
          const matchesCategory = store.store_category?.toLowerCase().includes(term);
          
          return matchesName || matchesIndustry || matchesCategory;
        }).slice(0, 5);
          
        const { data: itemHits, error: itemError } = await supabase
          .from('items')
          .select('id, item_name, price, stores(id, store_name, lat, lng)')
          .ilike('item_name', `%${searchTerm}%`)
          .limit(4);
          
        setSearchResults({ 
          stores: storeHits, 
          items: itemError ? [] : (itemHits || []) 
        });

      } catch (error) { 
        console.error("Search Error:", error); 
      } finally { 
        setIsSearching(false); 
      }
    }, 300); 

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const handleSearchResultClick = (target) => {
    setIsSearchFocused(false);
    setSearchTerm('');
    const lat = target.lat || target.stores?.lat;
    const lng = target.lng || target.stores?.lng;
    
    if (map.current && lat && lng) {
      map.current.flyTo({ center: [lng, lat], zoom: 18, duration: 1200 });
      const storeObj = target.stores ? target.stores : target;
      setSelectedStore(storeObj);
    }
  };

  const mapStores = useMemo(() => {
    if (!Array.isArray(stores)) return [];
    
    return stores.filter(store => {
      if (!store.lat || !store.lng) return false;
      if (activeCategory !== 'All' && store.store_category !== activeCategory) return false;
      
      const dist = calculateDistance(activeLocation.lat, activeLocation.lng, store.lat, store.lng);
      if (dist > filters.distance) return false;
      
      const storeRating = store.rating || 0; 
      if (filters.minRating > 0 && storeRating < filters.minRating) return false;
      if (filters.openNow && store.is_open === false) return false;

      return true;
    });
  }, [stores, activeCategory, filters, activeLocation]);

  useEffect(() => {
    if (!map.current) return;

    const currentMarkerIds = new Set(mapStores.map(s => s.id));

    Object.keys(markersRef.current).forEach(id => {
      if (!currentMarkerIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    mapStores.forEach(store => {
      if (!markersRef.current[store.id]) {
        const el = document.createElement('div');
        el.style.cursor = 'pointer';
        
        el.innerHTML = renderToString(
          <CustomMapPin category={store.store_category} industry={store.industry} size={40} />
        );

        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([store.lng, store.lat])
          .addTo(map.current);

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelectedStore(store);
          map.current.flyTo({ center: [store.lng, store.lat], zoom: 17.5, duration: 1000 });
        });

        markersRef.current[store.id] = marker;
      }
    });
  }, [mapStores]); 

  useEffect(() => {
    if (!map.current) return;
    const onPopupClose = () => setSelectedStore(null);

    if (selectedStore) {
      const div = document.createElement('div');
      div.style.padding = '8px 4px 4px 4px';
      div.style.minWidth = '160px';

      const title = document.createElement('strong');
      title.style.cssText = 'font-size: 15px; display: block; margin-bottom: 2px; color: #0F172A; font-family: "Plus Jakarta Sans", sans-serif;'; 
      title.textContent = selectedStore.store_name;

      const ind = document.createElement('span');
      ind.style.cssText = 'color: #64748B; font-size: 12px; display: block; margin-bottom: 12px; font-weight: 600; font-family: "Plus Jakarta Sans", sans-serif;';
      ind.textContent = selectedStore.industry || selectedStore.store_category;

      div.appendChild(title);
      div.appendChild(ind);

      const btn = document.createElement('button');
      btn.style.cssText = 'width: 100%; padding: 10px; background-color: #2563EB; color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 800; font-size: 13px; font-family: "Plus Jakarta Sans", sans-serif; transition: background-color 0.2s;';
      btn.textContent = 'View Store';
      btn.onclick = () => navigate(`/store/${selectedStore.id}`);

      div.appendChild(btn);

      popupRef.current.setLngLat([Number(selectedStore.lng), Number(selectedStore.lat)]).setDOMContent(div).addTo(map.current);
      popupRef.current.on('close', onPopupClose);
    } else {
      popupRef.current.remove();
    }
    return () => popupRef.current.off('close', onPopupClose);
  }, [selectedStore, navigate]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { font-family: 'Plus Jakarta Sans', sans-serif; }
      `}</style>

      {isFilterOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ backgroundColor: '#FFFFFF', padding: '24px', borderRadius: '20px', width: '90%', maxWidth: '360px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>Filters</h3>
              <button onClick={() => setIsFilterOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}><MdClose size={22} /></button>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#475569' }}>Distance Radius</label>
                <span style={{ fontSize: '13px', fontWeight: '800', color: '#2563EB' }}>{filters.distance} km</span>
              </div>
              <input 
                type="range" min="1" max="50" value={filters.distance} 
                onChange={(e) => setFilters({...filters, distance: Number(e.target.value)})} 
                style={{ width: '100%', accentColor: '#2563EB' }} 
              />
              <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>Searching from {activeLocation.name} plaza</div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>Minimum Rating</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[0, 3, 4, 5].map(rating => (
                  <button 
                    key={rating} onClick={() => setFilters({...filters, minRating: rating})}
                    style={{ flex: 1, padding: '8px 0', borderRadius: '8px', border: filters.minRating === rating ? '2px solid #2563EB' : '1px solid #E2E8F0', backgroundColor: filters.minRating === rating ? '#EFF6FF' : '#FFFFFF', color: filters.minRating === rating ? '#2563EB' : '#64748B', fontWeight: '700', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  >
                    {rating === 0 ? 'Any' : <>{rating}+ <MdStar size={14} /></>}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>Open Now</label>
                <span style={{ fontSize: '11px', color: '#64748B' }}>Hide closed businesses</span>
              </div>
              <div 
                onClick={() => setFilters({...filters, openNow: !filters.openNow})}
                style={{ width: '44px', height: '24px', backgroundColor: filters.openNow ? '#10B981' : '#E2E8F0', borderRadius: '12px', position: 'relative', cursor: 'pointer', transition: 'background-color 0.2s' }}
              >
                <div style={{ width: '20px', height: '20px', backgroundColor: '#FFFFFF', borderRadius: '50%', position: 'absolute', top: '2px', left: filters.openNow ? '22px' : '2px', transition: 'left 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
              </div>
            </div>

            <button onClick={() => setIsFilterOpen(false)} style={{ width: '100%', padding: '12px', backgroundColor: '#2563EB', color: '#FFFFFF', border: 'none', borderRadius: '10px', fontWeight: '800', fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.2)' }}>
              Show {mapStores.length} Results
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', padding: '16px 24px', overflowY: 'auto', backgroundColor: '#F8FAFC' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          
          <div style={{ position: 'relative', flexGrow: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#FFFFFF', border: isSearchFocused ? '2px solid #2563EB' : '1px solid #E2E8F0', borderRadius: '12px', padding: '9px 14px', boxShadow: isSearchFocused ? '0 0 0 4px rgba(37,99,235,0.1)' : '0 2px 4px rgba(0,0,0,0.02)', transition: 'all 0.2s' }}>
              <MdSearch size={20} color={isSearchFocused ? '#2563EB' : '#94A3B8'} />
              <input type="text" placeholder="Search places or industries..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onFocus={() => setIsSearchFocused(true)} style={{ border: 'none', backgroundColor: 'transparent', flexGrow: 1, outline: 'none', fontSize: '13.5px', color: '#0F172A', marginLeft: '10px', fontWeight: '500' }} />
              {isSearching && <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 'bold' }}>Searching...</span>}
            </div>

            {isSearchFocused && searchTerm.trim().length > 0 && (
              <>
                <div onClick={() => setIsSearchFocused(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '6px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: '0 15px 35px rgba(0,0,0,0.1)', zIndex: 50, overflow: 'hidden', padding: '8px 0' }}>
                  {searchResults.stores.length === 0 && searchResults.items.length === 0 && !isSearching ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>No results found for "{searchTerm}"</div>
                  ) : (
                    <>
                      {searchResults.stores.length > 0 && (
                        <div style={{ paddingBottom: searchResults.items.length > 0 ? '10px' : '0' }}>
                          <div style={{ padding: '6px 14px', fontSize: '10px', fontWeight: '900', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Stores</div>
                          {searchResults.stores.map(store => (
                            <div key={store.id} onClick={() => handleSearchResultClick(store)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', cursor: 'pointer', transition: 'background-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                              <div style={{ backgroundColor: '#EFF6FF', padding: '8px', borderRadius: '8px' }}><MdStorefront size={18} color="#2563EB" /></div>
                              <div>
                                <div style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>{store.store_name}</div>
                                <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>{store.industry || store.store_category}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {searchResults.items.length > 0 && (
                        <div style={{ borderTop: searchResults.stores.length > 0 ? '1px solid #F1F5F9' : 'none', paddingTop: searchResults.stores.length > 0 ? '10px' : '0' }}>
                          <div style={{ padding: '6px 14px', fontSize: '10px', fontWeight: '900', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Menu Items & Products</div>
                          {searchResults.items.map(item => (
                            <div key={item.id} onClick={() => handleSearchResultClick(item)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 14px', cursor: 'pointer', transition: 'background-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                              <div style={{ backgroundColor: '#F0FDF4', padding: '6px', borderRadius: '8px' }}><MdFastfood size={16} color="#16A34A" /></div>
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>{item.item_name} <span style={{ color: '#16A34A', fontWeight: '800' }}>₱{item.price}</span></div>
                                <div style={{ fontSize: '11px', color: '#64748B' }}>Available at <span style={{ fontWeight: '600' }}>{item.stores?.store_name}</span></div>
                              </div>
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

          <div style={{ position: 'relative' }}>
            <div onClick={() => setIsLocationDropdownOpen(!isLocationDropdownOpen)} style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '9px 14px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', userSelect: 'none' }}>
              <MdLocationOn size={18} color="#2563EB" />
              <span style={{ fontSize: '13.5px', fontWeight: '700', color: '#0F172A', minWidth: '75px' }}>{activeLocation.name}</span>
              <MdExpandMore size={18} color="#64748B" style={{ transform: isLocationDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
            </div>
            {isLocationDropdownOpen && (
              <>
                <div onClick={() => setIsLocationDropdownOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '6px', width: '200px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 50, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', fontSize: '10px', fontWeight: '900', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #F1F5F9', backgroundColor: '#F8FAFC' }}>
                    Tablas Island
                  </div>
                  <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
                    {TABLAS_MUNICIPALITIES.map(loc => (
                      <div 
                        key={loc.name} onClick={() => handleLocationSelect(loc)} 
                        style={{ padding: '10px 14px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', borderBottom: '1px solid #F8FAFC', color: activeLocation.name === loc.name ? '#2563EB' : '#475569', backgroundColor: activeLocation.name === loc.name ? '#EFF6FF' : 'transparent' }}
                        onMouseEnter={(e) => { if(activeLocation.name !== loc.name) e.target.style.backgroundColor = '#F1F5F9' }}
                        onMouseLeave={(e) => { if(activeLocation.name !== loc.name) e.target.style.backgroundColor = 'transparent' }}
                      >
                        {loc.name}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <div style={{ width: '40px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid #E2E8F0', borderRadius: '50%', cursor: 'pointer', position: 'relative', backgroundColor: '#FFFFFF' }}>
            <MdNotificationsNone size={20} color="#475569" />
            {session && <div style={{ position: 'absolute', top: '10px', right: '10px', width: '6px', height: '6px', backgroundColor: '#EF4444', borderRadius: '50%' }} />}
          </div>
          
          {session ? (
            <div onClick={() => navigate('/profile')} style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundImage: `url(${profile?.avatar_url || `https://ui-avatars.com/api/?name=${profile?.display_name || 'User'}&background=EFF6FF&color=2563EB`})`, backgroundSize: 'cover', backgroundPosition: 'center', cursor: 'pointer', border: '2px solid #FFFFFF', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }} />
          ) : (
            <button onClick={() => navigate('/login')} style={{ padding: '8px 16px', backgroundColor: '#2563EB', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Sign In</button>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none' }}>
            {categories.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)} style={{ padding: '6px 16px', borderRadius: '20px', border: activeCategory === cat ? 'none' : '1px solid #E2E8F0', backgroundColor: activeCategory === cat ? '#2563EB' : '#FFFFFF', color: activeCategory === cat ? 'white' : '#475569', fontWeight: '700', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s', boxShadow: activeCategory === cat ? '0 4px 12px rgba(37,99,235,0.2)' : '0 2px 4px rgba(0,0,0,0.02)' }}>
                {cat}
              </button>
            ))}
            <button style={{ padding: '6px 14px', borderRadius: '20px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#475569', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              More <MdExpandMore size={16} />
            </button>
          </div>
          <button onClick={() => setIsFilterOpen(true)} style={{ padding: '6px 14px', borderRadius: '20px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#475569', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <MdTune size={16} /> Filters
          </button>
        </div>

        <div style={{ flexShrink: 0, height: '68vh', borderRadius: '20px', overflow: 'hidden', position: 'relative', marginBottom: '24px', border: '4px solid #FFFFFF', boxShadow: '0 10px 30px rgba(0,0,0,0.06)' }}>
          <div ref={mapContainer} style={{ position: 'absolute', inset: 0 }} />
          <div style={{ position: 'absolute', bottom: '16px', left: '16px', backgroundColor: '#FFFFFF', borderRadius: '14px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', zIndex: 10 }}>
             <div style={{ fontSize: '24px' }}>☀️</div>
             <div style={{ display: 'flex', flexDirection: 'column' }}>
               <span style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', lineHeight: '1.2' }}>28°C</span>
               <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>Sunny</span>
             </div>
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>Popular near you</h2>
            <span style={{ fontSize: '13px', color: '#2563EB', fontWeight: '700', cursor: 'pointer' }}>View all</span>
          </div>
          
          <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '16px', scrollbarWidth: 'none' }}>
            {mapStores.slice(0, 5).map(store => (
              <div key={store.id} onClick={() => navigate(`/store/${store.id}`)} style={{ minWidth: '220px', maxWidth: '220px', backgroundColor: '#FFFFFF', borderRadius: '14px', overflow: 'hidden', cursor: 'pointer', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
                <div style={{ height: '120px', backgroundColor: '#e2e8f0', backgroundImage: `url(${store.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative', margin: '8px 8px 0 8px', borderRadius: '10px' }}>
                  <div style={{ position: 'absolute', top: '8px', left: '8px', background: '#2563EB', color: 'white', fontSize: '10px', fontWeight: '800', padding: '4px 8px', borderRadius: '6px' }}>Promoted</div>
                </div>
                <div style={{ padding: '12px' }}>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: '800', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{store.store_name}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: '#F59E0B', fontSize: '13px' }}>★</span>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#475569' }}>4.8</span>
                    <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '500' }}>(124)</span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#94A3B8', marginTop: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: '500' }}>{store.industry || store.store_category} • {calculateDistance(activeLocation.lat, activeLocation.lng, store.lat, store.lng).toFixed(1)} km</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
      </div>
    </>
  );
}