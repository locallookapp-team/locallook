import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdLocationOn, MdLocationOff, MdStorefront, MdAccessTime } from 'react-icons/md';
import { supabase } from '../supabaseClient';

export default function BrowsePage() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locationError, setLocationError] = useState(false);
  const navigate = useNavigate();

  const getBrandColor = (store) => {
    return store.theme_settings?.primaryColor || '#3b82f6';
  };

  const formatDistance = (meters) => {
    if (meters == null) return "-- km";
    if (meters < 100) return "< 0.1 km";
    const km = (meters / 1000).toFixed(1);
    return `${km} km`;
  };

  useEffect(() => {
    const fetchNearbyStores = async (lat, lng) => {
      setLoading(true);
      try {
        let url = 'https://locallook-api.onrender.com/api/stores';
        if (lat && lng) {
          url += `?userLat=${lat}&userLng=${lng}&radius=15000`;
        }
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        setStores(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Error fetching stores:", error);
      } finally {
        setLoading(false);
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          fetchNearbyStores(position.coords.latitude, position.coords.longitude);
        },
        () => {
          setLocationError(true);
          fetchNearbyStores(null, null);
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
      );
    } else {
      setLocationError(true);
      fetchNearbyStores(null, null);
    }
  }, []);

  useEffect(() => {
    const subscription = supabase
      .channel('public:stores_browse')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stores' }, (payload) => {
          setStores(currentStores => {
            return currentStores.map(store => 
              store.id === payload.new.id ? { ...store, is_open: payload.new.is_open } : store
            );
          });
      }).subscribe();
      
    return () => { supabase.removeChannel(subscription); };
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' }}>
        <MdStorefront size={40} color="#9ca3af" style={{ animation: 'pulse 1.5s infinite' }} />
        <p style={{ marginTop: '15px', color: '#6b7280', fontSize: '14px', fontWeight: '500' }}>Locating nearby places...</p>
        <style>{`@keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.1); opacity: 0.7; } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', paddingBottom: '90px', fontFamily: 'sans-serif' }}>
      
      <style>{`
        .store-card {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .store-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0,0,0,0.08) !important;
        }
      `}</style>

      <div style={{ position: 'sticky', top: 0, zIndex: 100, backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(8px)', padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <h1 style={{ margin: 0, fontSize: '22px', color: '#1f2937', fontWeight: '600' }}>Discover Places</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: locationError ? '#d97706' : '#6b7280', fontSize: '13px', fontWeight: '500' }}>
          {locationError ? <MdLocationOff size={16} /> : <MdLocationOn size={16} />}
          {locationError ? 'Location disabled. Showing all stores.' : `Found ${stores.length} locations`}
        </div>
      </div>

      <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
        {stores.map(store => {
          const brandColor = getBrandColor(store);
          
          return (
            <div 
              key={store.id} 
              className="store-card"
              onClick={() => navigate(`/store/${store.id}`)}
              style={{ cursor: 'pointer', backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)', display: 'flex', flexDirection: 'column' }}
            >
              
              {/* STOREFRONT COVER - Uses Brand Color */}
              <div style={{ height: '110px', backgroundColor: brandColor, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                <span style={{ fontSize: '64px', color: 'rgba(255,255,255,0.15)', fontWeight: 'bold', userSelect: 'none' }}>
                  {store.store_name.charAt(0).toUpperCase()}
                </span>
              </div>

              {/* CARD DETAILS */}
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '600', color: '#1f2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {store.store_name}
                </h3>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', color: '#6b7280' }}>
                    {store.store_category}
                  </span>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px', color: '#6b7280' }}>
                    <MdLocationOn size={16} />
                    {formatDistance(store.distance_meters)}
                  </div>
                </div>

                {/* EXACT OPEN/CLOSED INDICATOR MATCH (Green) */}
                <div>
                  <div style={{ 
                    display: 'inline-flex', alignItems: 'center', gap: '6px', 
                    padding: '6px 14px', borderRadius: '100px', 
                    backgroundColor: store.is_open ? '#d1fae5' : '#f3f4f6', 
                    color: store.is_open ? '#059669' : '#6b7280'
                  }}>
                    <MdAccessTime size={16} />
                    <span style={{ fontSize: '13px', fontWeight: '600' }}>
                      {store.is_open ? 'Open now' : 'Closed'}
                    </span>
                  </div>
                </div>

              </div>
            </div>
          );
        })}
      </div>

      {stores.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
          <MdStorefront size={40} style={{ opacity: 0.3, marginBottom: '10px' }} />
          <p style={{ fontSize: '15px', fontWeight: '500', margin: 0 }}>No local places found nearby.</p>
        </div>
      )}
    </div>
  );
}