import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MdArrowBack, MdLocationOn, MdPhone, MdEmail, MdLanguage, MdStar, MdAccessTime } from 'react-icons/md';

// Dynamic API URL setup (Matches your Dashboard config)
const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) 
  ? import.meta.env.VITE_API_URL 
  : 'https://locallook-api.onrender.com';

// 🚀 THE COVER IMAGE FALLBACK SYSTEM
const getStoreCoverImage = (store) => {
  // 1. If merchant uploaded a cover, use it!
  if (store.cover_image_url) {
    return store.cover_image_url;
  }
  // 2. Otherwise, fall back to high-quality category defaults
  switch (store.store_category) {
    case 'Food & Dining': return 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80';
    case 'Retail': return 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&q=80';
    case 'Services': return 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1200&q=80';
    case 'Groceries': return 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&q=80';
    case 'Health': return 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=1200&q=80';
    default: return 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80';
  }
};

export default function StoreProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [store, setStore] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch store data and items on mount
  useEffect(() => {
    const fetchStoreData = async () => {
      try {
        const storeRes = await fetch(`${API_BASE_URL}/api/stores/${id}`);
        if (!storeRes.ok) throw new Error("Store not found");
        const storeData = await storeRes.json();
        setStore(storeData);

        const itemsRes = await fetch(`${API_BASE_URL}/api/stores/${id}/items`);
        if (itemsRes.ok) {
          const itemsData = await itemsRes.json();
          setItems(itemsData);
        }
      } catch (err) {
        console.error("Error fetching store:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStoreData();
  }, [id]);

  if (loading) {
    return <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>Loading...</div>;
  }

  if (!store) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
        <h2>Store not found</h2>
        <button onClick={() => navigate('/')} style={{ padding: '10px 20px', backgroundColor: '#2563EB', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Go Back Home</button>
      </div>
    );
  }

  // Parse theme settings (or use defaults)
  const theme = store.theme_settings || {};
  const showPhone = theme.showPhone !== false && store.phone; 
  const showEmail = theme.showEmail !== false && store.email;
  const showWebsite = theme.showWebsite !== false && store.website;
  const showAddress = theme.showAddress !== false && theme.addressText;

  return (
  <div style={{ height: '100%', overflowY: 'auto', width: '100%', backgroundColor: '#F8FAFC', fontFamily: 'Inter, sans-serif' }}>
      {/* 🚀 1. THE HERO COVER IMAGE (No Avatar) */}
      <div style={{ 
        height: '320px', 
        width: '100%', 
        backgroundColor: '#1E293B',
        backgroundImage: `url(${getStoreCoverImage(store)})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        position: 'relative'
      }}>
        {/* Dark gradient overlay to make the back button visible */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 50%)' }} />
        
        {/* Floating Back Button */}
        <button 
          onClick={() => navigate(-1)} 
          style={{ 
            position: 'absolute', 
            top: '25px', 
            left: '25px', 
            backgroundColor: 'rgba(255, 255, 255, 0.2)', 
            backdropFilter: 'blur(10px)', 
            border: '1px solid rgba(255,255,255,0.4)', 
            color: 'white', 
            padding: '10px 20px', 
            borderRadius: '24px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px',
            zIndex: 10,
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
        >
          <MdArrowBack size={18} /> Back
        </button>
      </div>

      {/* 🚀 2. STORE INFO SECTION (Clean & Centered) */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '30px 20px', textAlign: 'center' }}>
        
        <h1 style={{ margin: '0 0 5px 0', fontSize: '32px', fontWeight: '900', color: '#0F172A' }}>
          {store.store_name}
        </h1>
        <p style={{ margin: '0 0 15px 0', fontSize: '15px', color: '#64748B', fontWeight: '600' }}>
          {store.store_category}
        </p>
        
        {store.description && (
          <p style={{ margin: '0 auto 25px auto', maxWidth: '600px', color: '#475569', fontSize: '15px', lineHeight: '1.6' }}>
            {store.description}
          </p>
        )}

        {/* Status & Rating Pills */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '25px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', backgroundColor: store.is_open ? '#D1FAE5' : '#FEE2E2', color: store.is_open ? '#059669' : '#DC2626', borderRadius: '20px', fontSize: '13px', fontWeight: '700' }}>
            <MdAccessTime size={16} /> {store.is_open ? 'Open now' : 'Closed'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', backgroundColor: '#FFFBEB', border: '1px solid #FEF3C7', color: '#D97706', borderRadius: '20px', fontSize: '13px', fontWeight: '700' }}>
            <MdStar size={16} /> Highly Recommended
          </div>
        </div>

        {/* Contact Information Pills */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '40px' }}>
          {showAddress && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', fontSize: '13px', color: '#475569', fontWeight: '600', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <MdLocationOn size={16} color="#94A3B8" /> {theme.addressText}
            </div>
          )}
          {showPhone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', fontSize: '13px', color: '#475569', fontWeight: '600', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <MdPhone size={16} color="#94A3B8" /> {store.phone}
            </div>
          )}
          {showEmail && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', fontSize: '13px', color: '#475569', fontWeight: '600', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <MdEmail size={16} color="#94A3B8" /> {store.email}
            </div>
          )}
          {showWebsite && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', fontSize: '13px', color: '#475569', fontWeight: '600', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <MdLanguage size={16} color="#94A3B8" /> {store.website.replace(/^https?:\/\//, '')}
            </div>
          )}
        </div>
      </div>

      {/* 🚀 3. MENU / CATALOG SECTION */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 20px 60px 20px' }}>
        
        {items.length === 0 ? (
          /* EMPTY CATALOG PAYWALL SCREEN */
          <div style={{ textAlign: 'center', padding: '60px 30px', backgroundColor: 'white', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', border: '2px dashed #E2E8F0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
            <div style={{ fontSize: '50px', marginBottom: '5px' }}>📋</div>
            <h3 style={{ color: '#0F172A', margin: 0, fontSize: '22px', fontWeight: '800' }}>Catalog Not Available Online</h3>
            <p style={{ color: '#64748B', margin: 0, fontSize: '15px', maxWidth: '450px', lineHeight: '1.6', fontWeight: '500' }}>
              This store hasn't published their digital menu or catalog yet. Feel free to use the contact details above to inquire about their offerings, or visit them in person!
            </p>
          </div>
        ) : (
          /* ACTUAL MENU LAYOUT */
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A', marginBottom: '20px' }}>Menu & Catalog</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
              {items.map(item => (
                <div key={item.id} style={{ backgroundColor: 'white', borderRadius: '16px', overflow: 'hidden', border: '1px solid #E2E8F0', boxShadow: '0 4px 15px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column' }}>
                  {item.image_url ? (
                    <div style={{ height: '160px', backgroundImage: `url(${item.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#F1F5F9' }} />
                  ) : (
                    <div style={{ height: '160px', backgroundColor: '#F1F5F9', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '40px' }}>🍽️</div>
                  )}
                  <div style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '6px' }}>
                      <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>{item.item_name}</h4>
                      <span style={{ fontSize: '15px', fontWeight: '800', color: '#2563EB', whiteSpace: 'nowrap' }}>₱{parseFloat(item.price).toFixed(2)}</span>
                    </div>
                    {item.description && <p style={{ margin: 0, fontSize: '13px', color: '#64748B', lineHeight: '1.4' }}>{item.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}