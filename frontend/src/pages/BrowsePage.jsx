import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdSearch, MdLocationOn } from "react-icons/md";

export default function BrowsePage() {
  const navigate = useNavigate();
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const categories = ['All', 'Food & Dining', 'Retail', 'Services', 'Groceries'];

  // 1. Get Location and Fetch Stores
  useEffect(() => {
    const fetchLocalStores = async (lat, lng) => {
      try {
        const res = await fetch(`https://locallook-api.onrender.com/api/stores?userLat=${lat}&userLng=${lng}&radius=5000`);
        const data = await res.json();
        setStores(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to fetch stores", err);
      } finally {
        setLoading(false);
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => fetchLocalStores(position.coords.latitude, position.coords.longitude),
        () => {
          // Fallback to Odiongan default coordinates if they deny location
          fetchLocalStores(12.3985, 121.9823); 
        }
      );
    } else {
      fetchLocalStores(12.3985, 121.9823);
    }
  }, []);

  // 2. Filter Logic
  const filteredStores = stores.filter(store => {
    const matchesSearch = store.store_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === 'All' || store.store_category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div style={{ backgroundColor: '#f9fafb', minHeight: '100vh', paddingBottom: '90px', fontFamily: 'sans-serif' }}>
      
      {/* STICKY HEADER */}
      <div style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 10, padding: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
        <h1 style={{ margin: '0 0 15px 0', fontSize: '28px', color: '#111827', fontWeight: '900' }}>Discover Nearby</h1>
        
        {/* Search Bar */}
        <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: '12px', padding: '10px 15px', marginBottom: '15px' }}>
          <MdSearch size={22} color="#6b7280" />
          <input 
            type="text" placeholder="Search for stores..." 
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} 
            style={{ border: 'none', backgroundColor: 'transparent', flexGrow: 1, outline: 'none', fontSize: '15px', marginLeft: '10px' }} 
          />
        </div>

        {/* Categories */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {categories.map(category => (
            <button 
              key={category} onClick={() => setActiveCategory(category)} 
              style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', backgroundColor: activeCategory === category ? '#2563eb' : '#f3f4f6', color: activeCategory === category ? 'white' : '#4b5563', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* FEED */}
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#6b7280', padding: '40px 0' }}>Finding locations near you...</div>
        ) : filteredStores.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#6b7280', padding: '40px 0' }}>No stores found in this area.</div>
        ) : (
          filteredStores.map(store => {
            // Format distance cleanly
            const distanceText = store.distance_meters 
              ? store.distance_meters < 1000 
                ? `${Math.round(store.distance_meters)}m away` 
                : `${(store.distance_meters / 1000).toFixed(1)}km away`
              : 'Unknown distance';

            return (
              <div 
                key={store.id} 
                onClick={() => navigate(`/store/${store.id}`)}
                style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 10px rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.04)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '10px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', color: '#1f2937', fontWeight: '800' }}>{store.store_name}</h2>
                    <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>{store.store_category}</span>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '12px', backgroundColor: store.is_open ? '#d1fae5' : '#fee2e2', color: store.is_open ? '#059669' : '#dc2626' }}>
                    {store.is_open ? 'OPEN' : 'CLOSED'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#4b5563', fontSize: '13px', fontWeight: '500', marginTop: '5px' }}>
                  <MdLocationOn size={16} color="#9ca3af" /> 
                  {distanceText}
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}