import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MdLocationOn, MdAccessTime, MdPhone, MdEmail, MdStarRate, MdArrowBack, MdLanguage } from "react-icons/md";
import { supabase } from '../supabaseClient';

export default function StoreProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [store, setStore] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [categoryOrder, setCategoryOrder] = useState([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const scrollContainerRef = useRef(null);
  const sectionRefs = useRef({});

  useEffect(() => {
    setLoading(true);
    fetch(`https://locallook-api.onrender.com/api/stores/${id}`)
      .then(res => {
        // FIXED: Catch the 404 error before it tries to parse HTML as JSON!
        if (!res.ok) throw new Error('Store not found');
        return res.json();
      })
      .then(data => {
        setStore(data);
        return fetch(`https://locallook-api.onrender.com/api/stores/${id}/items`);
      })
      .then(res => {
        if (!res.ok) return []; 
        return res.json();
      })
      .then(data => { 
        setItems(data || []); 
        setLoading(false); 
      })
      .catch(err => { 
        console.error("Profile Fetch Error:", err); 
        setStore(null); // Triggers the "Store Not Found" screen safely
        setLoading(false); 
      });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const storeSubscription = supabase
      .channel(`store-updates-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stores', filter: `id=eq.${id}` }, (payload) => {
          if (payload.new) { setStore((prev) => ({ ...prev, is_open: payload.new.is_open })); }
      }).subscribe();
    return () => { supabase.removeChannel(storeSubscription); };
  }, [id]);

  useEffect(() => {
    if (store && items.length > 0) {
      const uniqueCats = [...new Set(items.map(i => i.item_category || 'General'))];
      const savedOrder = store.theme_settings?.categoryOrder || [];
      const newOrder = [...savedOrder];
      uniqueCats.forEach(c => { if (!newOrder.includes(c)) newOrder.push(c); });
      const finalOrder = newOrder.filter(c => uniqueCats.includes(c)); 
      setCategoryOrder(finalOrder);
      if (finalOrder.length > 0) setActiveCategory(finalOrder[0]);
    }
  }, [store, items]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const containerTop = scrollContainerRef.current.getBoundingClientRect().top;
    let currentActive = activeCategory; let minDistance = Infinity;
    categoryOrder.forEach(cat => {
      const el = sectionRefs.current[cat];
      if (el) {
        const distance = Math.abs(el.getBoundingClientRect().top - containerTop - 120); 
        if (distance < minDistance) { minDistance = distance; currentActive = cat; }
      }
    });
    if (currentActive !== activeCategory) setActiveCategory(currentActive);
  };

  const scrollToCategory = (cat) => {
    const el = sectionRefs.current[cat];
    if (el && scrollContainerRef.current) { scrollContainerRef.current.scrollTo({ top: el.offsetTop - 120, behavior: 'smooth' }); }
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f9fafb' }}>
      <div style={{ padding: '20px', background: 'white', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <h3 style={{ color: '#2563eb', margin: 0 }}>Loading Profile...</h3>
      </div>
    </div>
  );

  if (!store) return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f9fafb', gap: '15px' }}>
      <div style={{ fontSize: '50px' }}>🧭</div>
      <h3 style={{ color: '#4b5563', margin: 0 }}>Oops! Store not found.</h3>
      <p style={{ color: '#9ca3af', margin: '0 0 10px 0', fontSize: '14px' }}>It may have been deleted or moved.</p>
      <button onClick={() => navigate('/')} style={{ padding: '10px 24px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Return to Map</button>
    </div>
  );

  const theme = store.theme_settings || { primaryColor: '#3b82f6', layout: 'grid' };
  const brandColor = theme.primaryColor || '#3b82f6';
  const isGrid = theme.layout !== 'list';

  const showPhone = theme.showPhone && store.phone;
  const showEmail = theme.showEmail && store.email;
  const showWebsite = theme.showWebsite && store.website;
  const showAddress = theme.showAddress && theme.addressText;

  const groupedItems = items.reduce((acc, item) => {
    const category = item.item_category || 'General';
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {});

  return (
    <>
      <style>
        {`.themed-scrollbar::-webkit-scrollbar { width: 10px; } .themed-scrollbar::-webkit-scrollbar-track { background: #e5e7eb; } .themed-scrollbar::-webkit-scrollbar-thumb { background-color: ${brandColor}; border-radius: 10px; border: 2px solid #e5e7eb; } .themed-scrollbar::-webkit-scrollbar-thumb:hover { filter: brightness(0.8); } .menu-item-card:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(0,0,0,0.08) !important; }`}
      </style>

      {/* CUSTOMER ITEM MODAL */}
      {selectedItem && (
        <div onClick={() => setSelectedItem(null)} style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', padding: '20px', backdropFilter: 'blur(4px)' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: 'white', width: '100%', maxWidth: '500px', maxHeight: '90vh', borderRadius: '24px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 -10px 40px rgba(0,0,0,0.2)', animation: 'slideUp 0.3s ease-out' }}>
            <div style={{ position: 'relative', width: '100%', height: '250px', backgroundColor: '#f3f4f6' }}>
              {selectedItem.image_url ? <img src={selectedItem.image_url} alt={selectedItem.item_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '60px' }}>🍽️</div>}
              <button onClick={() => setSelectedItem(null)} style={{ position: 'absolute', top: '15px', right: '15px', width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'white', border: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '18px', fontWeight: 'bold', color: '#111827' }}>✕</button>
            </div>
            <div style={{ padding: '25px', overflowY: 'auto', flexGrow: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '15px' }}>
                <div>
                  <h2 style={{ margin: '0 0 5px 0', fontSize: '24px', color: '#111827', fontWeight: '900', lineHeight: '1.2' }}>{selectedItem.item_name}</h2>
                  <span style={{ fontSize: '12px', padding: '4px 10px', backgroundColor: '#f3f4f6', color: '#4b5563', borderRadius: '6px', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{selectedItem.item_category}</span>
                </div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#111827', letterSpacing: '-0.5px' }}>₱{parseFloat(selectedItem.price).toFixed(2)}</div>
              </div>
              <p style={{ marginTop: '20px', color: '#4b5563', fontSize: '15px', lineHeight: '1.6' }}>{selectedItem.description || "No description provided for this item."}</p>
            </div>
            <div style={{ padding: '20px', borderTop: '1px solid #f3f4f6', backgroundColor: 'white' }}>
              <button style={{ width: '100%', padding: '16px', backgroundColor: brandColor, color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', boxShadow: `0 4px 15px ${brandColor}40` }}>Add to Order — ₱{parseFloat(selectedItem.price).toFixed(2)}</button>
            </div>
          </div>
        </div>
      )}

      {/* FIXED: Increased paddingBottom to 90px so the last item isn't hidden behind the navbar */}
      <div ref={scrollContainerRef} onScroll={handleScroll} className="themed-scrollbar" style={{ height: '100vh', width: '100vw', overflowY: 'auto', backgroundColor: '#f3f4f6', fontFamily: 'sans-serif', paddingBottom: '40px' }}>
        
        <div style={{ position: 'relative', height: '220px', background: `linear-gradient(135deg, ${brandColor}, #1e293b)`, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px' }}>
            <button onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '10px 16px', backgroundColor: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', transition: 'background 0.2s' }}>
              <MdArrowBack size={18} /> Back
            </button>
          </div>
        </div>

        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 20px', position: 'relative' }}>
          
          <div style={{ display: 'flex', alignItems: 'flex-end', marginTop: '-60px', marginBottom: '15px' }}>
            <div style={{ width: '120px', height: '120px', borderRadius: '50%', backgroundColor: '#111827', border: '4px solid #f3f4f6', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontSize: '48px', fontWeight: '900', zIndex: 10, flexShrink: 0, boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
              {store.store_name.charAt(0).toUpperCase()}
            </div>
          </div>

          <div style={{ padding: '0 5px' }}>
            <h1 style={{ margin: 0, fontSize: '32px', color: '#1f2937', fontWeight: '900', letterSpacing: '-0.5px' }}>{store.store_name}</h1>
            <p style={{ margin: '4px 0 12px 0', color: '#6b7280', fontSize: '15px', fontWeight: '600' }}>{store.store_category}</p>
            {store.description && <p style={{ margin: 0, fontSize: '15px', color: '#374151', lineHeight: '1.6' }}>{store.description}</p>}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '15px', marginBottom: '20px', padding: '0 5px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', backgroundColor: store.is_open ? '#d1fae5' : '#fee2e2', color: store.is_open ? '#059669' : '#dc2626', borderRadius: '20px', fontSize: '13px', fontWeight: '700', transition: 'all 0.3s ease' }}>
              <MdAccessTime size={16} /> {store.is_open ? 'Open now' : 'Closed now'}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', backgroundColor: 'rgba(255, 255, 255, 0.6)', color: '#4b5563', borderRadius: '20px', fontSize: '13px', fontWeight: '600', border: '1px solid #e5e7eb' }}>
              <MdStarRate size={16} color="#f59e0b" /> Highly Recommended
            </div>

            {showAddress && (
              <div onClick={() => navigate(`/?lat=${store.lat}&lng=${store.lng}&zoom=17`)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', backgroundColor: 'rgba(255, 255, 255, 0.6)', color: '#4b5563', borderRadius: '20px', fontSize: '13px', fontWeight: '600', border: '1px solid #e5e7eb', cursor: 'pointer' }}>
                <MdLocationOn size={16} /> {theme.addressText}
              </div>
            )}

            {showPhone && (
              <a href={`tel:${store.phone}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', backgroundColor: 'rgba(255, 255, 255, 0.6)', color: '#4b5563', borderRadius: '20px', fontSize: '13px', fontWeight: '600', border: '1px solid #e5e7eb', cursor: 'pointer' }}>
                <MdPhone size={16} /> {store.phone}
              </a>
            )}

            {showEmail && (
              <a href={`mailto:${store.email}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', backgroundColor: 'rgba(255, 255, 255, 0.6)', color: '#4b5563', borderRadius: '20px', fontSize: '13px', fontWeight: '600', border: '1px solid #e5e7eb', cursor: 'pointer' }}>
                <MdEmail size={16} /> {store.email}
              </a>
            )}

            {showWebsite && (
              <a href={store.website.startsWith('http') ? store.website : `https://${store.website}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', backgroundColor: 'rgba(255, 255, 255, 0.6)', color: '#4b5563', borderRadius: '20px', fontSize: '13px', fontWeight: '600', border: '1px solid #e5e7eb', cursor: 'pointer' }}>
                <MdLanguage size={16} /> {store.website.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '25px 5px 30px 5px' }} />
        </div>

        {categoryOrder.length > 0 && items.length > 0 && (
          <div style={{ display: 'flex', gap: '10px', padding: '15px 20px', overflowX: 'auto', backgroundColor: 'rgba(243, 244, 246, 0.95)', backdropFilter: 'blur(10px)', position: 'sticky', top: '0', zIndex: 50, maxWidth: '800px', margin: '0 auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {categoryOrder.map(cat => (
              <button key={cat} onClick={() => scrollToCategory(cat)} style={{ padding: '8px 20px', borderRadius: '20px', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 'bold', fontSize: '14px', border: 'none', transition: 'all 0.2s', backgroundColor: activeCategory === cat ? brandColor : 'white', color: activeCategory === cat ? 'white' : '#4b5563', boxShadow: activeCategory === cat ? `0 4px 10px ${brandColor}40` : '0 2px 4px rgba(0,0,0,0.05)' }}>
                {cat}
              </button>
            ))}
          </div>
        )}

        <div style={{ maxWidth: '800px', margin: '20px auto 0', padding: '0 20px' }}>
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', backgroundColor: 'white', borderRadius: '20px', border: '2px dashed #e5e7eb' }}>
              <span style={{ fontSize: '40px', display: 'block', marginBottom: '10px' }}>🍽️</span><p style={{ margin: 0, color: '#6b7280', fontWeight: '500' }}>This store hasn't posted any items yet.</p>
            </div>
          ) : (
            <div>
              {categoryOrder.map((category) => {
                if (!groupedItems[category]) return null;
                return (
                  <div key={category} ref={(el) => (sectionRefs.current[category] = el)} style={{ marginBottom: '50px', paddingTop: '10px' }}>
                    <h2 style={{ margin: '0 0 20px 0', fontSize: '22px', color: '#1f2937', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '15px' }}>
                      {category} <div style={{ flexGrow: 1, height: '2px', backgroundColor: brandColor, opacity: 0.2, borderRadius: '2px' }}></div>
                    </h2>
                    <div style={{ display: isGrid ? 'grid' : 'flex', gridTemplateColumns: isGrid ? 'repeat(auto-fill, minmax(250px, 1fr))' : 'none', flexDirection: isGrid ? 'row' : 'column', gap: '20px' }}>
                      {groupedItems[category].map(item => (
                        <div key={item.id} className="menu-item-card" onClick={() => setSelectedItem(item)} style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.04)', display: 'flex', flexDirection: isGrid ? 'column' : 'row', overflow: 'hidden', alignItems: isGrid ? 'stretch' : 'center', padding: isGrid ? '0' : '15px', gap: isGrid ? '0' : '20px', cursor: 'pointer', transition: 'all 0.2s ease' }}>
                          {item.image_url ? ( <div style={{ width: isGrid ? '100%' : '120px', height: isGrid ? 'auto' : '90px', aspectRatio: isGrid ? '4/3' : 'auto', minWidth: isGrid ? 'auto' : '120px', backgroundImage: `url(${item.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: isGrid ? '0' : '8px' }} /> ) : ( <div style={{ width: isGrid ? '100%' : '120px', height: isGrid ? 'auto' : '90px', aspectRatio: isGrid ? '4/3' : 'auto', minWidth: isGrid ? 'auto' : '120px', backgroundColor: '#f3f4f6', borderRadius: isGrid ? '0' : '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '30px' }}>🍽️</div> )}
                          <div style={{ padding: isGrid ? '20px' : '0', display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '10px' }}>
                              <h3 style={{ margin: 0, fontSize: '17px', color: '#1f2937', fontWeight: '700', lineHeight: '1.2' }}>{item.item_name}</h3>
                              <div style={{ fontSize: '18px', fontWeight: '800', color: '#111827', letterSpacing: '-0.5px', whiteSpace: 'nowrap' }}>₱{parseFloat(item.price).toFixed(2)}</div>
                            </div>
                            {item.description && <p style={{ margin: 0, color: '#6b7280', fontSize: '13px', lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.description}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}