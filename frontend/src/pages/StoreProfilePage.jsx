import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function StoreProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [store, setStore] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // ScrollSpy and Category Nav State
  const [categoryOrder, setCategoryOrder] = useState([]);
  const [activeCategory, setActiveCategory] = useState('');
  
  // NEW: Item Modal State for Customers
  const [selectedItem, setSelectedItem] = useState(null);
  
  const scrollContainerRef = useRef(null);
  const sectionRefs = useRef({});

  useEffect(() => {
    fetch(`https://locallook-api.onrender.com/api/stores/${id}`)
      .then(res => res.json())
      .then(data => {
        setStore(data);
        return fetch(`https://locallook-api.onrender.com/api/stores/${id}/items`);
      })
      .then(res => res.json())
      .then(data => {
        setItems(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
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
    
    let currentActive = activeCategory;
    let minDistance = Infinity;

    categoryOrder.forEach(cat => {
      const el = sectionRefs.current[cat];
      if (el) {
        const rect = el.getBoundingClientRect();
        const distance = Math.abs(rect.top - containerTop - 120); 
        if (distance < minDistance) {
          minDistance = distance;
          currentActive = cat;
        }
      }
    });

    if (currentActive !== activeCategory) setActiveCategory(currentActive);
  };

  const scrollToCategory = (cat) => {
    const el = sectionRefs.current[cat];
    const container = scrollContainerRef.current;
    if (el && container) {
      const topPos = el.offsetTop - 120; 
      container.scrollTo({ top: topPos, behavior: 'smooth' });
    }
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
      <h3 style={{ color: '#4b5563', margin: 0 }}>Store not found.</h3>
      <button onClick={() => navigate('/')} style={{ padding: '10px 20px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Return to Map</button>
    </div>
  );

  const theme = store.theme_settings || { primaryColor: '#3b82f6', layout: 'grid' };
  const brandColor = theme.primaryColor || '#3b82f6';
  const isGrid = theme.layout !== 'list';

  const groupedItems = items.reduce((acc, item) => {
    const category = item.item_category || 'General';
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {});

  return (
    <>
      <style>
        {`
          .themed-scrollbar::-webkit-scrollbar {
            width: 10px;
          }
          .themed-scrollbar::-webkit-scrollbar-track {
            background: #e5e7eb;
          }
          .themed-scrollbar::-webkit-scrollbar-thumb {
            background-color: ${brandColor};
            border-radius: 10px;
            border: 2px solid #e5e7eb;
          }
          .themed-scrollbar::-webkit-scrollbar-thumb:hover {
            filter: brightness(0.8);
          }
          /* Hover effect for interactive items */
          .menu-item-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(0,0,0,0.08) !important;
          }
        `}
      </style>

      {/* NEW: CUSTOMER ITEM MODAL (Slide-up Pop-up) */}
      {selectedItem && (
        <div 
          onClick={() => setSelectedItem(null)} // Clicking outside closes it
          style={{ 
            position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.6)', 
            display: 'flex', justifyContent: 'center', alignItems: 'flex-end', // Aligns to bottom for mobile feel
            padding: '20px', backdropFilter: 'blur(4px)'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()} // Prevents closing when clicking inside modal
            style={{ 
              backgroundColor: 'white', width: '100%', maxWidth: '500px', maxHeight: '90vh', 
              borderRadius: '24px', overflow: 'hidden', display: 'flex', flexDirection: 'column',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.2)', animation: 'slideUp 0.3s ease-out'
            }}
          >
            {/* Modal Image Header */}
            <div style={{ position: 'relative', width: '100%', height: '250px', backgroundColor: '#f3f4f6' }}>
              {selectedItem.image_url ? (
                <img src={selectedItem.image_url} alt={selectedItem.item_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '60px' }}>🍽️</div>
              )}
              {/* Close Button */}
              <button 
                onClick={() => setSelectedItem(null)} 
                style={{ position: 'absolute', top: '15px', right: '15px', width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'white', border: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '18px', fontWeight: 'bold', color: '#111827' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Content Details */}
            <div style={{ padding: '25px', overflowY: 'auto', flexGrow: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '15px' }}>
                <div>
                  <h2 style={{ margin: '0 0 5px 0', fontSize: '24px', color: '#111827', fontWeight: '900', lineHeight: '1.2' }}>{selectedItem.item_name}</h2>
                  <span style={{ fontSize: '12px', padding: '4px 10px', backgroundColor: '#f3f4f6', color: '#4b5563', borderRadius: '6px', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{selectedItem.item_category}</span>
                </div>
                {/* Modal Price Tag */}
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#111827', letterSpacing: '-0.5px' }}>
                  ₱{parseFloat(selectedItem.price).toFixed(2)}
                </div>
              </div>
              <p style={{ marginTop: '20px', color: '#4b5563', fontSize: '15px', lineHeight: '1.6' }}>
                {selectedItem.description || "No description provided for this item."}
              </p>
            </div>

            {/* Modal Action Button */}
            <div style={{ padding: '20px', borderTop: '1px solid #f3f4f6', backgroundColor: 'white' }}>
              <button style={{ width: '100%', padding: '16px', backgroundColor: brandColor, color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', boxShadow: `0 4px 15px ${brandColor}40` }}>
                Add to Order — ₱{parseFloat(selectedItem.price).toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      )}

      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="themed-scrollbar"
        style={{ 
          height: '100vh', width: '100vw', overflowY: 'auto', 
          backgroundColor: '#f3f4f6', fontFamily: 'sans-serif', paddingBottom: '60px' 
        }}
      >
        
        {/* HEADER HERO SECTION */}
        <div style={{ position: 'relative', height: '220px', backgroundColor: brandColor, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'background-color 0.3s' }}>
          <div style={{ padding: '20px' }}>
            <button onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', transition: 'background 0.2s' }}>
              ← Back to Map
            </button>
          </div>
          <svg viewBox="0 0 1440 100" style={{ position: 'absolute', bottom: -1, width: '100%', height: 'auto', display: 'block' }}>
            <path fill="#f3f4f6" d="M0,64L80,58.7C160,53,320,43,480,48C640,53,800,75,960,74.7C1120,75,1280,53,1360,42.7L1440,32L1440,100L1360,100C1280,100,1120,100,960,100C800,100,640,100,480,100C320,100,160,100,80,100L0,100Z"></path>
          </svg>
        </div>

        {/* FLOATING STORE INFO CARD */}
        <div style={{ maxWidth: '800px', margin: '-60px auto 0', padding: '0 20px', position: 'relative', zIndex: 10 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '25px', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
            <div>
              <h1 style={{ margin: '0 0 5px 0', fontSize: '28px', color: '#1f2937', fontWeight: '900', letterSpacing: '-0.5px' }}>{store.store_name}</h1>
              <p style={{ color: '#6b7280', fontSize: '15px', margin: '0', fontWeight: '500' }}>{store.store_category}</p>
            </div>
            <div style={{ padding: '8px 16px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold', backgroundColor: store.is_open ? '#d1fae5' : '#fee2e2', color: store.is_open ? '#059669' : '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: store.is_open ? '#059669' : '#dc2626', boxShadow: store.is_open ? '0 0 8px #059669' : 'none' }}></div>
              {store.is_open ? 'OPEN NOW' : 'CURRENTLY CLOSED'}
            </div>
          </div>
        </div>

        {/* STICKY CATEGORY NAV BAR */}
        {categoryOrder.length > 0 && items.length > 0 && (
          <div style={{ 
            display: 'flex', gap: '10px', padding: '15px 20px', 
            overflowX: 'auto', backgroundColor: 'rgba(243, 244, 246, 0.95)', 
            backdropFilter: 'blur(10px)', position: 'sticky', top: '0', 
            zIndex: 50, maxWidth: '800px', margin: '20px auto 0',
            scrollbarWidth: 'none', msOverflowStyle: 'none'
          }}>
            {categoryOrder.map(cat => (
              <button 
                key={cat}
                onClick={() => scrollToCategory(cat)}
                style={{
                  padding: '8px 20px', borderRadius: '20px', cursor: 'pointer', whiteSpace: 'nowrap',
                  fontWeight: 'bold', fontSize: '14px', border: 'none', transition: 'all 0.2s',
                  backgroundColor: activeCategory === cat ? brandColor : 'white',
                  color: activeCategory === cat ? 'white' : '#4b5563',
                  boxShadow: activeCategory === cat ? `0 4px 10px ${brandColor}40` : '0 2px 4px rgba(0,0,0,0.05)'
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* DYNAMIC MENU SECTION */}
        <div style={{ maxWidth: '800px', margin: '20px auto 0', padding: '0 20px' }}>
          
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', backgroundColor: 'white', borderRadius: '20px', border: '2px dashed #e5e7eb' }}>
              <span style={{ fontSize: '40px', display: 'block', marginBottom: '10px' }}>🍽️</span>
              <p style={{ margin: 0, color: '#6b7280', fontWeight: '500' }}>This store hasn't posted any items yet.</p>
            </div>
          ) : (
            <div>
              {categoryOrder.map((category) => {
                if (!groupedItems[category]) return null;
                return (
                  <div key={category} ref={(el) => (sectionRefs.current[category] = el)} style={{ marginBottom: '50px', paddingTop: '10px' }}>
                    
                    {/* Category Header */}
                    <h2 style={{ margin: '0 0 20px 0', fontSize: '22px', color: '#1f2937', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '15px' }}>
                      {category}
                      <div style={{ flexGrow: 1, height: '2px', backgroundColor: brandColor, opacity: 0.2, borderRadius: '2px' }}></div>
                    </h2>

                    {/* DYNAMIC LAYOUT */}
                    <div style={{ 
                      display: isGrid ? 'grid' : 'flex', 
                      gridTemplateColumns: isGrid ? 'repeat(auto-fill, minmax(250px, 1fr))' : 'none', 
                      flexDirection: isGrid ? 'row' : 'column',
                      gap: '20px' 
                    }}>
                      {groupedItems[category].map(item => (
                        <div 
                          key={item.id} 
                          className="menu-item-card"
                          onClick={() => setSelectedItem(item)} // OPEN MODAL ON CLICK
                          style={{ 
                            backgroundColor: 'white', borderRadius: '16px', 
                            boxShadow: '0 4px 15px rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.04)', 
                            display: 'flex', flexDirection: isGrid ? 'column' : 'row', 
                            overflow: 'hidden', alignItems: isGrid ? 'stretch' : 'center',
                            padding: isGrid ? '0' : '15px', gap: isGrid ? '0' : '20px',
                            cursor: 'pointer', transition: 'all 0.2s ease'
                          }}
                        >
                          
                          {/* Image Rendering */}
                          {item.image_url ? (
                            <div style={{ 
                              width: isGrid ? '100%' : '120px', height: isGrid ? 'auto' : '90px', 
                              aspectRatio: isGrid ? '4/3' : 'auto', minWidth: isGrid ? 'auto' : '120px',
                              backgroundImage: `url(${item.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center',
                              borderRadius: isGrid ? '0' : '8px'
                            }} />
                          ) : (
                            <div style={{ 
                              width: isGrid ? '100%' : '120px', height: isGrid ? 'auto' : '90px', 
                              aspectRatio: isGrid ? '4/3' : 'auto', minWidth: isGrid ? 'auto' : '120px', 
                              backgroundColor: '#f3f4f6', borderRadius: isGrid ? '0' : '8px', 
                              display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '30px' 
                            }}>
                              🍽️
                            </div>
                          )}

                          {/* Text Content */}
                          <div style={{ padding: isGrid ? '20px' : '0', display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '10px' }}>
                              <h3 style={{ margin: 0, fontSize: '17px', color: '#1f2937', fontWeight: '700', lineHeight: '1.2' }}>{item.item_name}</h3>
                              
                              {/* --- BOLD MATCHING PRICE TYPOGRAPHY --- */}
                              <div style={{ fontSize: '18px', fontWeight: '800', color: '#111827', letterSpacing: '-0.5px', whiteSpace: 'nowrap' }}>
                                ₱{parseFloat(item.price).toFixed(2)}
                              </div>

                            </div>
                            {item.description && (
                              <p style={{ 
                                margin: 0, color: '#6b7280', fontSize: '13px', lineHeight: '1.5',
                                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                              }}>
                                {item.description}
                              </p>
                            )}
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