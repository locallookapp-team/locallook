import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
  MdLocationOn, MdLocationOff, MdStorefront, 
  MdStar, MdRestaurantMenu, MdCheckCircle, MdLocalOffer,
  MdFastfood, MdLocalMall, MdSpa, MdLocalHospital, 
  MdDirectionsCar, MdHotel, MdHomeRepairService, MdBusinessCenter,
  MdGridView, MdChevronRight, MdChevronLeft, MdArrowBack, MdTune, MdClose, MdSearch, MdExpandMore
} from 'react-icons/md';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://locallook-api.onrender.com';

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const l1 = Number(lat1); const ln1 = Number(lon1);
  const l2 = Number(lat2); const ln2 = Number(lon2);
  if (isNaN(l1) || isNaN(ln1) || isNaN(l2) || isNaN(ln2)) return Infinity;
  const R = 6371; 
  const dLat = (l2 - l1) * Math.PI / 180; const dLon = (ln2 - ln1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(l1 * Math.PI / 180) * Math.cos(l2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
};

const formatDistance = (km) => {
  if (km === Infinity || isNaN(km)) return "-- km";
  if (km < 0.1) return "Near you";
  return `${km.toFixed(1)} km`;
};

const DEFAULT_LOCATION = { lat: 12.3985, lng: 121.9823 };

const CATEGORIES = [
  { name: 'All', icon: <MdGridView size={16} /> },
  { name: 'Food & Dining', icon: <MdFastfood size={16} /> },
  { name: 'Grocery & Retail', icon: <MdLocalMall size={16} /> },
  { name: 'Beauty & Personal Care', icon: <MdSpa size={16} /> },
  { name: 'Health & Medical', icon: <MdLocalHospital size={16} /> },
  { name: 'Automotive', icon: <MdDirectionsCar size={16} /> },
  { name: 'Travel & Accommodation', icon: <MdHotel size={16} /> },
  { name: 'Home & Professional Services', icon: <MdHomeRepairService size={16} /> },
  { name: 'Financial & Business', icon: <MdBusinessCenter size={16} /> }
];

export default function ExplorePage() {
  const navigate = useNavigate();
  const [stores, setStores] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [viewMode, setViewMode] = useState('places'); 
  const [focusedSwimlane, setFocusedSwimlane] = useState(null); 
  const [userLocation, setUserLocation] = useState(DEFAULT_LOCATION);
  const [locationError, setLocationError] = useState(false);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [filters, setFilters] = useState({ category: 'All', distance: 10, minRating: 0, openNow: false });

  // Drag Scroll Refs & State
  const swimlaneRefs = useRef({});
  const dragState = useRef({ isDown: false, startX: 0, scrollLeft: 0, activeRef: null });
  const [scrollState, setScrollState] = useState({
    near: { left: false, right: true },
    top: { left: false, right: true },
    new: { left: false, right: true }
  });

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => { setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude }); setLocationError(false); },
        () => setLocationError(true), { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
      );
    } else { setLocationError(true); }

    const fetchData = async () => {
      setLoading(true);
      try {
        const storesRes = await fetch(`${API_BASE_URL}/api/stores`);
        if (!storesRes.ok) throw new Error("Failed to fetch stores");
        const storesData = await storesRes.json();

        const { data: reviewsData } = await supabase.from('reviews').select('store_id, rating');
        const { data: itemsData } = await supabase.from('items').select('*, stores(store_name, is_open, store_category)');

        const processedStores = storesData.map(store => {
          const storeReviews = reviewsData ? reviewsData.filter(r => r.store_id === store.id) : [];
          const ratings = storeReviews.map(r => r.rating);
          const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length) : 0;
          return { ...store, avgRating, reviewCount: ratings.length };
        });

        setStores(processedStores); setItems(itemsData || []);
        
        // Initial scroll check
        setTimeout(() => {
          ['near', 'top', 'new'].forEach(checkScrollVisibility);
        }, 100);

      } catch (error) { console.error("Error fetching explore data:", error); } finally { setLoading(false); }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const subscription = supabase.channel('public:stores_explore')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stores' }, (payload) => {
          setStores(currentStores => currentStores.map(store => store.id === payload.new.id ? { ...store, is_open: payload.new.is_open } : store));
      }).subscribe();
    return () => { supabase.removeChannel(subscription); };
  }, []);

  // --- SCROLL & DRAG LOGIC ---
  const checkScrollVisibility = (key) => {
    const el = swimlaneRefs.current[key];
    if (!el) return;
    setScrollState(prev => ({
      ...prev,
      [key]: {
        left: el.scrollLeft > 0,
        right: Math.ceil(el.scrollLeft + el.clientWidth) < el.scrollWidth
      }
    }));
  };

  const handleDragStart = (e, refKey) => {
    const ref = swimlaneRefs.current[refKey];
    if (!ref) return;
    dragState.current = { isDown: true, startX: e.pageX - ref.offsetLeft, scrollLeft: ref.scrollLeft, activeRef: ref, refKey };
    ref.style.cursor = 'grabbing';
  };
  const handleDragEnd = () => {
    const ref = dragState.current.activeRef;
    if (ref) {
      ref.style.cursor = 'grab';
      checkScrollVisibility(dragState.current.refKey);
    }
    dragState.current.isDown = false;
    dragState.current.activeRef = null;
  };
  const handleDragMove = (e) => {
    if (!dragState.current.isDown || !dragState.current.activeRef) return;
    e.preventDefault();
    const ref = dragState.current.activeRef;
    const x = e.pageX - ref.offsetLeft;
    const walk = (x - dragState.current.startX) * 2;
    ref.scrollLeft = dragState.current.scrollLeft - walk;
    checkScrollVisibility(dragState.current.refKey);
  };
  
  const scrollSwimlane = (refKey, direction) => {
    const ref = swimlaneRefs.current[refKey];
    if (ref) {
      const scrollAmount = direction === 'left' ? -400 : 400;
      ref.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      setTimeout(() => checkScrollVisibility(refKey), 300);
    }
  };

  // --- FILTERING LOGIC ---
  const processedStoreList = stores.map(store => ({ ...store, distance: calculateDistance(userLocation.lat, userLocation.lng, store.lat, store.lng) }));

  const filteredStores = processedStoreList.filter(store => {
    if (filters.category !== 'All' && store.store_category !== filters.category) return false;
    if (filters.openNow && !store.is_open) return false;
    if (store.distance > filters.distance) return false;
    if (filters.minRating > 0 && store.avgRating < filters.minRating) return false;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (!store.store_name?.toLowerCase().includes(term) && !store.store_category?.toLowerCase().includes(term) && !store.industry?.toLowerCase().includes(term)) return false;
    }
    return true;
  });

  const filteredItems = items.filter(item => {
    if (filters.category !== 'All' && item.stores?.store_category !== filters.category) return false;
    if (filters.openNow && !item.stores?.is_open) return false;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (!item.item_name?.toLowerCase().includes(term) && !item.stores?.store_name?.toLowerCase().includes(term)) return false;
    }
    return true;
  });

  const allTopRatedStores = [...filteredStores].sort((a, b) => b.avgRating - a.avgRating);
  const allNearYouStores = [...filteredStores].sort((a, b) => a.distance - b.distance);
  const allNewlyAddedStores = [...filteredStores].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  // --- RENDERERS ---
  const renderDesktopStoreCard = (store, index, isSwimlane = false) => {
    const brandColor = store.theme_settings?.primaryColor || 'var(--brand-primary)';
    return (
      <div 
        key={`desktop-${store.id}-${index}`} onClick={() => navigate(`/store/${store.id}`)}
        style={{ minWidth: isSwimlane ? '280px' : '100%', width: isSwimlane ? '280px' : '100%', backgroundColor: 'var(--surface-color)', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-color)', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.03)', flexShrink: 0, scrollSnapAlign: 'start', transition: 'transform 0.2s', userSelect: 'none' }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
      >
        <div style={{ height: '140px', backgroundColor: brandColor, backgroundImage: store.cover_image_url ? `url(${store.cover_image_url})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 100%)' }} />
          {!store.cover_image_url && <MdStorefront size={50} color="rgba(255,255,255,0.3)" style={{ position: 'relative', zIndex: 1 }} />}
          
          <div style={{ 
            position: 'absolute', top: '12px', right: '12px', 
            backgroundColor: store.is_open ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)', 
            backdropFilter: 'blur(8px)', border: `1px solid ${store.is_open ? 'rgba(16,185,129,0.3)' : 'rgba(100,116,139,0.3)'}`,
            color: store.is_open ? '#10B981' : '#E2E8F0', 
            padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '900', zIndex: 2 
          }}>
            {store.is_open ? 'OPEN' : 'CLOSED'}
          </div>
        </div>
        <div style={{ padding: '16px' }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '17px', fontWeight: '900', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{store.store_name}</h3>
          <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{store.industry || store.store_category}</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#D97706', fontSize: '13px', fontWeight: '800' }}><MdStar size={16} /> {store.reviewCount > 0 ? store.avgRating.toFixed(1) : 'New'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: '700' }}><MdLocationOn size={14} /> {formatDistance(store.distance)}</div>
          </div>
        </div>
      </div>
    );
  };

  const renderMobileStoreCard = (store, index) => {
    const brandColor = store.theme_settings?.primaryColor || 'var(--brand-primary)';
    
    return (
      <div 
        key={`mobile-${store.id}-${index}`} 
        onClick={() => navigate(`/store/${store.id}`)} 
        style={{ 
          width: '100%', display: 'flex', gap: '14px', padding: '12px', marginBottom: '12px', 
          border: '1px solid var(--border-color)', borderRadius: '16px', 
          backgroundColor: 'var(--surface-color)', cursor: 'pointer', 
          boxShadow: '0 2px 10px rgba(0,0,0,0.02)', flexShrink: 0
        }}
      >
        <div style={{ position: 'relative', width: '100px', height: '75px', borderRadius: '10px', backgroundImage: store.cover_image_url ? `url(${store.cover_image_url})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', flexShrink: 0, backgroundColor: brandColor, display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid var(--border-color)' }}>
          {!store.cover_image_url && <MdStorefront size={32} color="rgba(255,255,255,0.3)" />}
          
          <div style={{ 
            position: 'absolute', top: '6px', right: '6px', 
            padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: '900',
            backgroundColor: store.is_open ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)',
            border: `1px solid ${store.is_open ? 'rgba(16,185,129,0.3)' : 'rgba(100,116,139,0.3)'}`,
            color: store.is_open ? '#10B981' : '#64748B', backdropFilter: 'blur(4px)'
          }}>
            {store.is_open ? 'OPEN' : 'CLOSED'}
          </div>
        </div>
        
        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', overflow: 'hidden' }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '900', color: 'var(--text-main)', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{store.store_name}</h3>
          <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{store.industry || store.store_category}</p>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#D97706', fontSize: '13px', fontWeight: '800' }}>
              <MdStar size={16} /> {store.reviewCount > 0 ? store.avgRating.toFixed(1) : 'New'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: '700' }}>
              <MdLocationOn size={14} /> {formatDistance(store.distance)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderItemCard = (item) => (
    <div key={`desktop-item-${item.id}`} onClick={() => navigate(`/store/${item.store_id}`)} style={{ display: 'flex', padding: '16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)', gap: '16px', alignItems: 'center', cursor: 'pointer', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: '0 4px 10px rgba(0,0,0,0.02)', transition: 'transform 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
      {item.image_url ? (
        <img src={item.image_url} alt={item.item_name} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '12px', flexShrink: 0, border: '1px solid var(--border-color)' }} />
      ) : (
        <div style={{ width: '80px', height: '80px', backgroundColor: 'var(--surface-hover)', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0, border: '1px solid var(--border-color)' }}><MdRestaurantMenu size={28} color="var(--icon-color)" /></div>
      )}
      <div style={{ flexGrow: 1, minWidth: 0 }}>
        <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', color: 'var(--text-main)', fontWeight: '800', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.item_name}</h4>
        <div style={{ fontSize: '15px', fontWeight: '900', color: 'var(--brand-primary)', marginBottom: '6px' }}>₱{parseFloat(item.price).toFixed(0)}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>
          <MdStorefront size={14} flexShrink={0} /> <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.stores?.store_name || 'Unknown'}</span>
        </div>
      </div>
    </div>
  );

  const StoreSkeleton = () => (
    <div style={{ minWidth: '260px', width: '260px', height: '220px', backgroundColor: 'var(--surface-color)', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ height: '120px', backgroundColor: 'var(--surface-hover)', animation: 'pulse 1.5s infinite' }} />
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ height: '16px', width: '70%', backgroundColor: 'var(--border-color)', borderRadius: '6px', animation: 'pulse 1.5s infinite' }} />
        <div style={{ height: '14px', width: '50%', backgroundColor: 'var(--surface-hover)', borderRadius: '6px', animation: 'pulse 1.5s infinite' }} />
      </div>
    </div>
  );

  return (
    <div style={{ height: '100%', overflowY: 'auto', backgroundColor: 'var(--bg-color)', paddingBottom: '40px', fontFamily: 'var(--font-main)', position: 'relative' }}>
      
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .custom-scrollbar::-webkit-scrollbar { display: none; }
        
        .desktop-ui { display: block; }
        .mobile-ui-block { display: none; }
        .explore-container { padding: 20px; }
        
        .swimlane-wrapper { position: relative; }
        .swimlane-arrow { position: absolute; top: 50%; transform: translateY(-50%); z-index: 10; opacity: 0; transition: opacity 0.2s; background: var(--surface-color); border: 1px solid var(--border-color); border-radius: 50%; width: 44px; height: 44px; display: flex; justify-content: center; align-items: center; cursor: pointer; box-shadow: 0 8px 20px rgba(0,0,0,0.1); color: var(--text-main); }
        .swimlane-wrapper:hover .swimlane-arrow { opacity: 1; }
        .swimlane-arrow.left { left: 5px; }
        .swimlane-arrow.right { right: 5px; }

        .swimlane-container { display: flex; gap: 20px; overflow-x: auto; padding-bottom: 15px; padding-top: 5px; cursor: grab; }
        .grid-container { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 24px; }

        @media (max-width: 768px) {
          .desktop-ui { display: none !important; }
          .mobile-ui-block { display: block !important; }
          .explore-container { padding: 0; }
          .grid-container { display: flex; flex-direction: column; gap: 0; }
        }
      `}</style>

      {/* 🚀 SHARED FILTERS MODAL */}
      {isFilterOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 999999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '24px', borderRadius: '24px', width: '90%', maxWidth: '380px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: 'var(--text-main)' }}>Filters</h3>
              <button onClick={() => setIsFilterOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><MdClose size={22} /></button>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px' }}>Category</label>
              <div style={{ position: 'relative' }}>
                <button onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontSize: '14px', fontWeight: '700', color: 'var(--text-main)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: 'var(--brand-primary)' }}>{CATEGORIES.find(c => c.name === filters.category)?.icon}</span> {filters.category}
                  </div>
                  <MdExpandMore size={20} color="var(--text-muted)" style={{ transform: isCategoryDropdownOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
                </button>
                {isCategoryDropdownOpen && (
                  <div className="custom-scrollbar" style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 10, maxHeight: '200px', overflowY: 'auto' }}>
                    {CATEGORIES.map(cat => (
                      <div key={cat.name} onClick={() => { setFilters({...filters, category: cat.name}); setIsCategoryDropdownOpen(false); setFocusedSwimlane(null); }} style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)', backgroundColor: filters.category === cat.name ? 'var(--surface-hover)' : 'transparent', color: filters.category === cat.name ? 'var(--brand-primary)' : 'var(--text-main)', fontWeight: '700', fontSize: '13px' }}>
                        <div style={{ color: filters.category === cat.name ? 'var(--brand-primary)' : 'var(--text-muted)' }}>{cat.icon}</div>{cat.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)' }}>Distance Radius</label>
                <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--brand-primary)' }}>{filters.distance} km</span>
              </div>
              <input type="range" min="1" max="50" value={filters.distance} onChange={(e) => setFilters({...filters, distance: Number(e.target.value)})} style={{ width: '100%', accentColor: 'var(--brand-primary)' }} />
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Searching near Odiongan</div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px' }}>Minimum Rating</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[0, 3, 4, 5].map(rating => (
                  <button key={rating} onClick={() => setFilters({...filters, minRating: rating})} style={{ flex: 1, padding: '10px 0', borderRadius: '12px', border: filters.minRating === rating ? '2px solid var(--brand-primary)' : '1px solid var(--border-color)', backgroundColor: filters.minRating === rating ? 'var(--surface-hover)' : 'var(--bg-color)', color: filters.minRating === rating ? 'var(--brand-primary)' : 'var(--text-muted)', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    {rating === 0 ? 'Any' : <>{rating}+ <MdStar size={16} /></>}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={() => setIsFilterOpen(false)} style={{ width: '100%', padding: '14px', backgroundColor: 'var(--brand-primary)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '900', fontSize: '15px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.2)' }}>
              Show Results
            </button>
          </div>
        </div>
      )}

      {/* 🚀 COMPACT STICKY HEADER */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, backgroundColor: 'var(--bg-color)', padding: '12px 16px', borderBottom: '1px solid var(--border-color)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
        
        {/* Title Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '900', color: 'var(--text-main)', letterSpacing: '-0.5px' }}>Explore</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: locationError ? '#D97706' : 'var(--text-muted)', marginTop: '2px', fontWeight: '600' }}>
              <MdLocationOn size={14} /> {locationError ? 'Location disabled. Using Odiongan Plaza.' : 'Showing places near you'}
            </div>
          </div>
        </div>

        {/* Global Search and Filter Button */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--surface-color)', borderRadius: '12px', padding: '0 12px', height: '42px', flexGrow: 1, border: '1px solid var(--border-color)' }}>
            <MdSearch size={20} color="var(--text-muted)" />
            <input type="text" placeholder={`Search ${viewMode}...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ border: 'none', background: 'transparent', flexGrow: 1, outline: 'none', color: 'var(--text-main)', fontSize: '14px', marginLeft: '8px', fontWeight: '500', height: '100%' }} />
          </div>
          <button onClick={() => setIsFilterOpen(true)} style={{ position: 'relative', width: '42px', height: '42px', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', color: 'var(--text-main)', flexShrink: 0 }}>
            <MdTune size={20} />
            {(filters.category !== 'All' || filters.distance < 50 || filters.minRating > 0) && (
              <span style={{ position: 'absolute', top: '8px', right: '8px', width: '8px', height: '8px', backgroundColor: '#EF4444', borderRadius: '50%', border: '2px solid var(--surface-color)' }} />
            )}
          </button>
        </div>

        {/* Unified View Toggle & Open Now */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', backgroundColor: 'var(--surface-hover)', padding: '3px', borderRadius: '12px', border: '1px solid var(--border-color)', width: '220px' }}>
            <button onClick={() => { setViewMode('places'); setFocusedSwimlane(null); }} style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', padding: '8px 10px', borderRadius: '10px', border: 'none', fontWeight: '800', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: viewMode === 'places' ? 'var(--surface-color)' : 'transparent', color: viewMode === 'places' ? 'var(--brand-primary)' : 'var(--text-muted)', boxShadow: viewMode === 'places' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}>
              <MdStorefront size={16} /> Places
            </button>
            <button onClick={() => { setViewMode('products'); setFocusedSwimlane(null); }} style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', padding: '8px 10px', borderRadius: '10px', border: 'none', fontWeight: '800', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: viewMode === 'products' ? 'var(--surface-color)' : 'transparent', color: viewMode === 'products' ? 'var(--brand-primary)' : 'var(--text-muted)', boxShadow: viewMode === 'products' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}>
              <MdLocalOffer size={16} /> Products
            </button>
          </div>
          
          <div onClick={() => setFilters({...filters, openNow: !filters.openNow})} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: filters.openNow ? '#10B981' : 'var(--text-muted)', transition: 'color 0.3s' }}>Open Now</span>
            <div style={{ width: '36px', height: '20px', backgroundColor: filters.openNow ? '#10B981' : 'var(--border-color)', borderRadius: '12px', position: 'relative', transition: 'background-color 0.3s' }}>
              <div style={{ width: '16px', height: '16px', backgroundColor: 'white', borderRadius: '50%', position: 'absolute', top: '2px', left: filters.openNow ? '18px' : '2px', transition: 'left 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
            </div>
          </div>
        </div>
      </div>

      {/* DYNAMIC CONTENT AREA */}
      <div className="explore-container">
        
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '40px', padding: '20px' }}>
             <div><div style={{ height: '24px', width: '150px', backgroundColor: 'var(--border-color)', borderRadius: '6px', marginBottom: '16px', animation: 'pulse 1.5s infinite' }} /><div style={{ display: 'flex', gap: '16px', overflow: 'hidden' }}>{[1, 2, 3].map(n => <StoreSkeleton key={`s1-${n}`} />)}</div></div>
             <div><div style={{ height: '24px', width: '180px', backgroundColor: 'var(--border-color)', borderRadius: '6px', marginBottom: '16px', animation: 'pulse 1.5s infinite' }} /><div style={{ display: 'flex', gap: '16px', overflow: 'hidden' }}>{[1, 2, 3].map(n => <StoreSkeleton key={`s2-${n}`} />)}</div></div>
          </div>
        ) : (
          <>
            {/* ====== VIEW: PLACES ====== */}
            {viewMode === 'places' && (
              <>
                {/* 1. "SEE ALL" FOCUSED VIEW (Triggered from Swimlanes) */}
                {focusedSwimlane ? (
                   <div style={{ paddingTop: '20px' }}>
                     {/* 🚀 BACK BUTTON NOW SCROLLS WITH CONTENT BELOW THE HEADER */}
                     <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', padding: '0 16px' }}>
                       <button onClick={() => setFocusedSwimlane(null)} style={{ background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', color: 'var(--text-main)', boxShadow: '0 4px 10px rgba(0,0,0,0.05)', transition: 'transform 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform='scale(1.05)'} onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>
                         <MdArrowBack size={24} />
                       </button>
                       <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '900', color: 'var(--text-main)', letterSpacing: '-0.5px' }}>
                         {focusedSwimlane === 'near' && 'Near You'}
                         {focusedSwimlane === 'top' && 'Top Rated Locals'}
                         {focusedSwimlane === 'new' && 'Just Opened'}
                       </h2>
                     </div>
                     
                     <div className="desktop-ui">
                       <div className="grid-container" style={{ padding: '0 16px' }}>
                          {focusedSwimlane === 'near' && allNearYouStores.map((store, i) => renderDesktopStoreCard(store, i, false))}
                          {focusedSwimlane === 'top' && allTopRatedStores.map((store, i) => renderDesktopStoreCard(store, i, false))}
                          {focusedSwimlane === 'new' && allNewlyAddedStores.map((store, i) => renderDesktopStoreCard(store, i, false))}
                       </div>
                     </div>
                     <div className="mobile-ui-block">
                       <div style={{ display: 'flex', flexDirection: 'column', padding: '0 16px' }}>
                          {focusedSwimlane === 'near' && allNearYouStores.map((store, i) => renderMobileStoreCard(store, i))}
                          {focusedSwimlane === 'top' && allTopRatedStores.map((store, i) => renderMobileStoreCard(store, i))}
                          {focusedSwimlane === 'new' && allNewlyAddedStores.map((store, i) => renderMobileStoreCard(store, i))}
                       </div>
                     </div>
                   </div>
                ) : 
                /* 2. MAIN FEED VIEW (When no category or search is active) */
                (filters.category === 'All' && searchTerm === '') ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '40px', paddingTop: '20px' }}>
                    
                    {/* Swimlane 1: Near You */}
                    {allNearYouStores.length > 0 && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '0 16px' }}>
                          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}><MdLocationOn color="var(--brand-primary)" /> Near You</h2>
                          <button onClick={() => setFocusedSwimlane('near')} style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', fontWeight: '800', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>See All <MdChevronRight size={20} /></button>
                        </div>
                        <div className="desktop-ui swimlane-wrapper">
                          {scrollState.near.left && <button className="swimlane-arrow left" onClick={() => scrollSwimlane('near', 'left')}><MdChevronLeft size={24}/></button>}
                          <div className="swimlane-container custom-scrollbar" ref={el => swimlaneRefs.current['near'] = el} onScroll={() => checkScrollVisibility('near')} onMouseDown={(e) => handleDragStart(e, 'near')} onMouseLeave={handleDragEnd} onMouseUp={handleDragEnd} onMouseMove={handleDragMove} style={{ padding: '0 16px' }}>
                            {allNearYouStores.slice(0, 8).map((store, i) => renderDesktopStoreCard(store, i, true))}
                          </div>
                          {scrollState.near.right && <button className="swimlane-arrow right" onClick={() => scrollSwimlane('near', 'right')}><MdChevronRight size={24}/></button>}
                        </div>
                        <div className="mobile-ui-block">
                          <div style={{ display: 'flex', flexDirection: 'column', padding: '0 16px' }}>
                            {/* 🚀 TRUE VERTICAL LIST ON MOBILE (Max 5 items) */}
                            {allNearYouStores.slice(0, 5).map((store, i) => renderMobileStoreCard(store, i))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Swimlane 2: Top Rated */}
                    {allTopRatedStores.length > 0 && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '0 16px' }}>
                          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}><MdStar color="var(--brand-primary)" /> Top Rated Locals</h2>
                          <button onClick={() => setFocusedSwimlane('top')} style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', fontWeight: '800', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>See All <MdChevronRight size={20} /></button>
                        </div>
                        <div className="desktop-ui swimlane-wrapper">
                          {scrollState.top.left && <button className="swimlane-arrow left" onClick={() => scrollSwimlane('top', 'left')}><MdChevronLeft size={24}/></button>}
                          <div className="swimlane-container custom-scrollbar" ref={el => swimlaneRefs.current['top'] = el} onScroll={() => checkScrollVisibility('top')} onMouseDown={(e) => handleDragStart(e, 'top')} onMouseLeave={handleDragEnd} onMouseUp={handleDragEnd} onMouseMove={handleDragMove} style={{ padding: '0 16px' }}>
                            {allTopRatedStores.slice(0, 8).map((store, i) => renderDesktopStoreCard(store, i, true))}
                          </div>
                          {scrollState.top.right && <button className="swimlane-arrow right" onClick={() => scrollSwimlane('top', 'right')}><MdChevronRight size={24}/></button>}
                        </div>
                        <div className="mobile-ui-block">
                          <div style={{ display: 'flex', flexDirection: 'column', padding: '0 16px' }}>
                            {allTopRatedStores.slice(0, 5).map((store, i) => renderMobileStoreCard(store, i))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Swimlane 3: Newly Added */}
                    {allNewlyAddedStores.length > 0 && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '0 16px' }}>
                          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}><MdCheckCircle color="var(--brand-primary)" /> Just Opened</h2>
                          <button onClick={() => setFocusedSwimlane('new')} style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', fontWeight: '800', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>See All <MdChevronRight size={20} /></button>
                        </div>
                        <div className="desktop-ui swimlane-wrapper">
                          {scrollState.new.left && <button className="swimlane-arrow left" onClick={() => scrollSwimlane('new', 'left')}><MdChevronLeft size={24}/></button>}
                          <div className="swimlane-container custom-scrollbar" ref={el => swimlaneRefs.current['new'] = el} onScroll={() => checkScrollVisibility('new')} onMouseDown={(e) => handleDragStart(e, 'new')} onMouseLeave={handleDragEnd} onMouseUp={handleDragEnd} onMouseMove={handleDragMove} style={{ padding: '0 16px' }}>
                            {allNewlyAddedStores.slice(0, 8).map((store, i) => renderDesktopStoreCard(store, i, true))}
                          </div>
                          {scrollState.new.right && <button className="swimlane-arrow right" onClick={() => scrollSwimlane('new', 'right')}><MdChevronRight size={24}/></button>}
                        </div>
                        <div className="mobile-ui-block">
                          <div style={{ display: 'flex', flexDirection: 'column', padding: '0 16px' }}>
                            {allNewlyAddedStores.slice(0, 5).map((store, i) => renderMobileStoreCard(store, i))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* 3. FILTERED GRID VIEW (When a category is picked or search is active) */
                  <div style={{ paddingTop: '20px' }}>
                    <h2 style={{ fontSize: '22px', fontWeight: '900', color: 'var(--text-main)', marginBottom: '20px', padding: '0 16px' }}>
                      {searchTerm ? `Search Results` : `${filters.category} Places`}
                    </h2>
                    {filteredStores.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '16px', margin: '0 16px' }}>
                        <MdStorefront size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
                        <p style={{ margin: 0, fontWeight: '700', fontSize: '16px' }}>No places found matching your filters.</p>
                      </div>
                    ) : (
                      <>
                        <div className="desktop-ui">
                          <div className="grid-container" style={{ padding: '0 16px' }}>
                            {filteredStores.map((store, i) => renderDesktopStoreCard(store, i, false))}
                          </div>
                        </div>
                        <div className="mobile-ui-block">
                          <div style={{ padding: '0 16px' }}>
                            {filteredStores.map((store, i) => renderMobileStoreCard(store, i))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ====== VIEW: PRODUCTS ====== */}
            {viewMode === 'products' && (
              <div style={{ paddingTop: '20px' }}>
                 <h2 style={{ fontSize: '22px', fontWeight: '900', color: 'var(--text-main)', marginBottom: '20px', padding: '0 16px' }}>
                   {searchTerm ? 'Search Results' : (filters.category === 'All' ? 'Popular Offerings' : `${filters.category} Offerings`)}
                 </h2>
                 {filteredItems.length === 0 ? (
                   <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '16px', margin: '0 16px' }}>
                     <MdLocalOffer size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
                     <p style={{ margin: 0, fontWeight: '700', fontSize: '16px' }}>No items found right now.</p>
                   </div>
                 ) : (
                   <>
                     <div className="desktop-ui">
                       <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', padding: '0 16px' }}>
                         {/* 🚀 FIXED: Changed to renderItemCard */}
                         {filteredItems.map(item => renderItemCard(item))}
                       </div>
                     </div>
                     <div className="mobile-ui-block">
                       <div style={{ display: 'flex', flexDirection: 'column', padding: '0 16px', gap: '12px' }}>
                         {/* 🚀 FIXED: Changed to renderItemCard */}
                         {filteredItems.map(item => renderItemCard(item))}
                       </div>
                     </div>
                   </>
                 )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}