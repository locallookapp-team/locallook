import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
  MdLocationOn, MdLocationOff, MdStorefront, 
  MdStar, MdRestaurantMenu, MdCheckCircle, MdLocalOffer,
  MdFastfood, MdLocalMall, MdSpa, MdLocalHospital, 
  MdDirectionsCar, MdHotel, MdHomeRepairService, MdBusinessCenter,
  MdGridView, MdChevronRight, MdArrowBack
} from 'react-icons/md';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://locallook-api.onrender.com';

// Exact robust distance calculator (Returns Kilometers)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const l1 = Number(lat1);
  const ln1 = Number(lon1);
  const l2 = Number(lat2);
  const ln2 = Number(lon2);
  
  if (isNaN(l1) || isNaN(ln1) || isNaN(l2) || isNaN(ln2)) return Infinity;

  const R = 6371; 
  const dLat = (l2 - l1) * Math.PI / 180;
  const dLon = (ln2 - ln1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + 
            Math.cos(l1 * Math.PI / 180) * Math.cos(l2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const formatDistance = (km) => {
  if (km === Infinity || isNaN(km)) return "-- km";
  if (km < 0.1) return "Near you";
  return `${km.toFixed(1)} km`;
};

// Default fallback location (Odiongan Plaza) so distance always renders instantly
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
  
  const [activeCategory, setActiveCategory] = useState('All');
  const [viewMode, setViewMode] = useState('places'); 
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [focusedSwimlane, setFocusedSwimlane] = useState(null); 
  
  const [userLocation, setUserLocation] = useState(DEFAULT_LOCATION);
  const [locationError, setLocationError] = useState(false);

  // 1. Fetch User Location and Data
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
          setLocationError(false);
        },
        () => setLocationError(true),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
      );
    } else {
      setLocationError(true);
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        // 🚀 FIX: Fetch stores from API so we get the correctly formatted lat/lng
        const storesRes = await fetch(`${API_BASE_URL}/api/stores`);
        if (!storesRes.ok) throw new Error("Failed to fetch stores");
        const storesData = await storesRes.json();

        // Fetch reviews from Supabase to attach ratings
        const { data: reviewsData, error: reviewsError } = await supabase
          .from('reviews')
          .select('store_id, rating');
        if (reviewsError) throw reviewsError;

        // Fetch items from Supabase
        const { data: itemsData, error: itemsError } = await supabase
          .from('items')
          .select('*, stores(store_name, is_open, store_category)');
        if (itemsError) throw itemsError;

        // Merge API stores with Supabase ratings
        const processedStores = storesData.map(store => {
          const storeReviews = reviewsData ? reviewsData.filter(r => r.store_id === store.id) : [];
          const ratings = storeReviews.map(r => r.rating);
          const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length) : 0;
          return { ...store, avgRating, reviewCount: ratings.length };
        });

        setStores(processedStores);
        setItems(itemsData || []);
      } catch (error) {
        console.error("Error fetching explore data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 2. REAL-TIME SUBSCRIPTION: Instantly reflect Open/Close changes
  useEffect(() => {
    const subscription = supabase
      .channel('public:stores_explore')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stores' }, (payload) => {
          setStores(currentStores => {
            return currentStores.map(store => 
              store.id === payload.new.id ? { ...store, is_open: payload.new.is_open } : store
            );
          });
      }).subscribe();
      
    return () => { supabase.removeChannel(subscription); };
  }, []);

  // Handle resets when switching tabs
  useEffect(() => { setFocusedSwimlane(null); }, [activeCategory, viewMode]);

  // Dynamically calculate distance and apply filters during render
  const processedStoreList = stores.map(store => ({
    ...store,
    distance: calculateDistance(userLocation.lat, userLocation.lng, store.lat, store.lng)
  }));

  const filteredStores = processedStoreList.filter(store => {
    if (activeCategory !== 'All' && store.store_category !== activeCategory) return false;
    if (onlyOpen && store.is_open !== true) return false;
    return true;
  });

  const filteredItems = items.filter(item => {
    if (activeCategory !== 'All' && item.stores?.store_category !== activeCategory) return false;
    if (onlyOpen && item.stores?.is_open !== true) return false;
    return true;
  });

  // Swimlane Datasets
  const allTopRatedStores = [...filteredStores].sort((a, b) => b.avgRating - a.avgRating);
  const allNearYouStores = [...filteredStores].sort((a, b) => a.distance - b.distance);
  const allNewlyAddedStores = [...filteredStores].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const renderStoreCard = (store, index) => {
    const brandColor = store.theme_settings?.primaryColor || '#2563EB';
    return (
      <div 
        key={`${store.id}-${index}`}
        onClick={() => navigate(`/store/${store.id}`)}
        style={{ 
          minWidth: focusedSwimlane ? '100%' : '260px', 
          width: focusedSwimlane ? '100%' : '260px', 
          backgroundColor: 'white', borderRadius: '16px', 
          overflow: 'hidden', border: '1px solid #E2E8F0', cursor: 'pointer', 
          boxShadow: '0 4px 10px rgba(0,0,0,0.03)', flexShrink: 0, scrollSnapAlign: 'start',
          transition: 'transform 0.2s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
      >
        <div style={{ 
          height: '120px', backgroundColor: brandColor, 
          backgroundImage: store.cover_image_url ? `url(${store.cover_image_url})` : 'none', 
          backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative',
          display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%)' }} />
          
          {!store.cover_image_url && <MdStorefront size={50} color="rgba(255,255,255,0.3)" style={{ position: 'relative', zIndex: 1 }} />}
          
          <div style={{ 
            position: 'absolute', top: '10px', right: '10px', 
            backgroundColor: store.is_open ? 'rgba(209, 250, 229, 0.85)' : 'rgba(254, 242, 242, 0.85)', 
            backdropFilter: 'blur(4px)', color: store.is_open ? '#059669' : '#E11D48', 
            padding: '4px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: '800', zIndex: 2 
          }}>
            {store.is_open ? 'OPEN' : 'CLOSED'}
          </div>
        </div>
        <div style={{ padding: '16px' }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '800', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{store.store_name}</h3>
          <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{store.industry || store.store_category}</p>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#D97706', fontSize: '13px', fontWeight: '700' }}>
              <MdStar size={16} /> {store.reviewCount > 0 ? store.avgRating.toFixed(1) : 'New'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748B', fontSize: '12px', fontWeight: '600' }}>
              <MdLocationOn size={14} /> {formatDistance(store.distance)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderItemCard = (item) => (
    <div 
      key={item.id}
      onClick={() => navigate(`/store/${item.store_id}`)}
      style={{ 
        backgroundColor: 'white', borderRadius: '16px', border: '1px solid #E2E8F0', 
        overflow: 'hidden', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.03)',
        transition: 'transform 0.2s'
      }}
      onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
      onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
    >
      <div style={{ height: '160px', backgroundColor: '#F1F5F9', backgroundImage: item.image_url ? `url(${item.image_url})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {!item.image_url && <MdRestaurantMenu size={32} color="#CBD5E1" />}
      </div>
      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0F172A', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {item.item_name}
          </h4>
          <span style={{ fontSize: '15px', fontWeight: '900', color: '#2563EB' }}>₱{parseFloat(item.price).toFixed(0)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748B', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <MdStorefront size={14} flexShrink={0} /> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.stores?.store_name || 'Unknown Store'}</span>
        </div>
      </div>
    </div>
  );

  const StoreSkeleton = () => (
    <div style={{ minWidth: '260px', width: '260px', height: '220px', backgroundColor: 'white', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ height: '120px', backgroundColor: '#E2E8F0', animation: 'pulse 1.5s infinite' }} />
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ height: '16px', width: '70%', backgroundColor: '#E2E8F0', borderRadius: '6px', animation: 'pulse 1.5s infinite' }} />
        <div style={{ height: '14px', width: '50%', backgroundColor: '#F1F5F9', borderRadius: '6px', animation: 'pulse 1.5s infinite' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
          <div style={{ height: '14px', width: '30%', backgroundColor: '#F1F5F9', borderRadius: '6px', animation: 'pulse 1.5s infinite' }} />
          <div style={{ height: '14px', width: '20%', backgroundColor: '#F1F5F9', borderRadius: '6px', animation: 'pulse 1.5s infinite' }} />
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ height: '100%', overflowY: 'auto', backgroundColor: '#F8FAFC', paddingBottom: '40px', fontFamily: 'Inter, sans-serif' }}>
      
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>

      {/* HEADER & UTILITY BAR (Sticky) */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, backgroundColor: 'rgba(248, 250, 252, 0.95)', backdropFilter: 'blur(10px)', padding: '20px', borderBottom: '1px solid #E2E8F0' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '900', color: '#0F172A' }}>Explore</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: locationError ? '#D97706' : '#64748B', marginTop: '4px', fontWeight: '500' }}>
              {locationError ? <MdLocationOff size={14} /> : <MdLocationOn size={14} />}
              {locationError ? 'Location disabled. Using Odiongan Plaza.' : 'Showing places near you'}
            </div>
          </div>
        </div>

        {/* Category Pills */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '12px', scrollbarWidth: 'none' }}>
          {CATEGORIES.map(category => (
            <button 
              key={category.name}
              onClick={() => setActiveCategory(category.name)}
              style={{ 
                display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '20px', 
                whiteSpace: 'nowrap', border: 'none', fontWeight: '700', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s',
                backgroundColor: activeCategory === category.name ? '#2563EB' : 'white',
                color: activeCategory === category.name ? 'white' : '#475569',
                border: activeCategory === category.name ? '1px solid #2563EB' : '1px solid #E2E8F0',
                boxShadow: activeCategory === category.name ? '0 4px 10px rgba(37, 99, 235, 0.2)' : 'none'
              }}
            >
              <span style={{ opacity: activeCategory === category.name ? 1 : 0.7 }}>{category.icon}</span>
              {category.name}
            </button>
          ))}
        </div>

        {/* Modern Utility Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: '6px', borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          
          <div style={{ display: 'flex', backgroundColor: '#F1F5F9', padding: '4px', borderRadius: '10px' }}>
            <button 
              onClick={() => setViewMode('places')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 16px', borderRadius: '8px', border: 'none', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: viewMode === 'places' ? 'white' : 'transparent', color: viewMode === 'places' ? '#2563EB' : '#64748B', boxShadow: viewMode === 'places' ? '0 2px 6px rgba(0,0,0,0.05)' : 'none' }}
            >
              <MdStorefront size={16} /> Places
            </button>
            <button 
              onClick={() => setViewMode('products')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 16px', borderRadius: '8px', border: 'none', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: viewMode === 'products' ? 'white' : 'transparent', color: viewMode === 'products' ? '#2563EB' : '#64748B', boxShadow: viewMode === 'products' ? '0 2px 6px rgba(0,0,0,0.05)' : 'none' }}
            >
              <MdLocalOffer size={16} /> Products
            </button>
          </div>
          
          <div onClick={() => setOnlyOpen(!onlyOpen)} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', paddingRight: '8px', userSelect: 'none' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: onlyOpen ? '#10B981' : '#64748B', transition: 'color 0.3s' }}>Open Now</span>
            <div style={{ width: '36px', height: '20px', backgroundColor: onlyOpen ? '#10B981' : '#E2E8F0', borderRadius: '12px', position: 'relative', transition: 'background-color 0.3s' }}>
              <div style={{ width: '16px', height: '16px', backgroundColor: 'white', borderRadius: '50%', position: 'absolute', top: '2px', left: onlyOpen ? '18px' : '2px', transition: 'left 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
            </div>
          </div>
        </div>
      </div>

      {/* DYNAMIC CONTENT AREA */}
      <div style={{ padding: '20px' }}>
        
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
             <div>
                <div style={{ height: '24px', width: '150px', backgroundColor: '#E2E8F0', borderRadius: '6px', marginBottom: '16px', animation: 'pulse 1.5s infinite' }} />
                <div style={{ display: 'flex', gap: '16px', overflow: 'hidden' }}>
                  {[1, 2, 3, 4].map(n => <StoreSkeleton key={`s1-${n}`} />)}
                </div>
             </div>
             <div>
                <div style={{ height: '24px', width: '180px', backgroundColor: '#E2E8F0', borderRadius: '6px', marginBottom: '16px', animation: 'pulse 1.5s infinite' }} />
                <div style={{ display: 'flex', gap: '16px', overflow: 'hidden' }}>
                  {[1, 2, 3, 4].map(n => <StoreSkeleton key={`s2-${n}`} />)}
                </div>
             </div>
          </div>
        ) : (
          <>
            {/* ====== VIEW: PLACES ====== */}
            {viewMode === 'places' && (
              <>
                {focusedSwimlane && activeCategory === 'All' ? (
                   <div>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                       <button onClick={() => setFocusedSwimlane(null)} style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', color: '#0F172A', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                         <MdArrowBack size={20} />
                       </button>
                       <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#0F172A' }}>
                         {focusedSwimlane === 'near' && 'Near You'}
                         {focusedSwimlane === 'top' && 'Top Rated Locals'}
                         {focusedSwimlane === 'new' && 'Just Opened'}
                       </h2>
                     </div>
                     <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
                        {focusedSwimlane === 'near' && allNearYouStores.map((store, i) => renderStoreCard(store, `all-near-${i}`))}
                        {focusedSwimlane === 'top' && allTopRatedStores.map((store, i) => renderStoreCard(store, `all-top-${i}`))}
                        {focusedSwimlane === 'new' && allNewlyAddedStores.map((store, i) => renderStoreCard(store, `all-new-${i}`))}
                     </div>
                   </div>
                ) : activeCategory === 'All' ? (
                  // SWIMLANE LAYOUT
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
                    
                    {/* Swimlane 1: Near You */}
                    {allNearYouStores.length > 0 && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <MdLocationOn color="#2563EB" /> Near You
                          </h2>
                          <button onClick={() => setFocusedSwimlane('near')} style={{ background: 'none', border: 'none', color: '#2563EB', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', zIndex: 10 }}>See All <MdChevronRight size={18} /></button>
                        </div>
                        <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '10px', scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}>
                          {allNearYouStores.slice(0, 8).map((store, i) => renderStoreCard(store, `near-${i}`))}
                        </div>
                      </div>
                    )}

                    {/* Swimlane 2: Top Rated */}
                    {allTopRatedStores.length > 0 && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <MdStar color="#2563EB" /> Top Rated Locals
                          </h2>
                          <button onClick={() => setFocusedSwimlane('top')} style={{ background: 'none', border: 'none', color: '#2563EB', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', zIndex: 10 }}>See All <MdChevronRight size={18} /></button>
                        </div>
                        <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '10px', scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}>
                          {allTopRatedStores.slice(0, 8).map((store, i) => renderStoreCard(store, `top-${i}`))}
                        </div>
                      </div>
                    )}

                    {/* Swimlane 3: Newly Added */}
                    {allNewlyAddedStores.length > 0 && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <MdCheckCircle color="#2563EB" /> Just Opened
                          </h2>
                          <button onClick={() => setFocusedSwimlane('new')} style={{ background: 'none', border: 'none', color: '#2563EB', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', zIndex: 10 }}>See All <MdChevronRight size={18} /></button>
                        </div>
                        <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '10px', scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}>
                          {allNewlyAddedStores.slice(0, 8).map((store, i) => renderStoreCard(store, `new-${i}`))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  // GRID LAYOUT (Filtered by Category)
                  <div>
                    <h2 style={{ fontSize: '18px', fontWeight: '900', color: '#0F172A', marginBottom: '20px' }}>{activeCategory} Places</h2>
                    {filteredStores.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94A3B8', border: '1px dashed #CBD5E1', borderRadius: '16px' }}>
                        <MdStorefront size={40} style={{ opacity: 0.5, marginBottom: '10px' }} />
                        <p style={{ margin: 0, fontWeight: '600' }}>No places found in this category.</p>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
                        {filteredStores.map((store, i) => renderStoreCard(store, `grid-${i}`))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ====== VIEW: PRODUCTS ====== */}
            {viewMode === 'products' && (
              <div>
                 <h2 style={{ fontSize: '18px', fontWeight: '900', color: '#0F172A', marginBottom: '20px' }}>
                   {activeCategory === 'All' ? 'Popular Offerings' : `${activeCategory} Offerings`}
                 </h2>
                 {filteredItems.length === 0 ? (
                   <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94A3B8', border: '1px dashed #CBD5E1', borderRadius: '16px' }}>
                     <MdLocalOffer size={40} style={{ opacity: 0.5, marginBottom: '10px' }} />
                     <p style={{ margin: 0, fontWeight: '600' }}>No items found right now.</p>
                   </div>
                 ) : (
                   <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                     {filteredItems.map(item => renderItemCard(item))}
                   </div>
                 )}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}