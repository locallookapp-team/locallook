import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function StoreProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [store, setStore] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div style={{ backgroundColor: '#f3f4f6', minHeight: '100vh', fontFamily: 'sans-serif', paddingBottom: '40px' }}>
      
      {/* HEADER HERO SECTION */}
      <div style={{ position: 'relative', height: '220px', background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
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

      {/* MENU SECTION */}
      <div style={{ maxWidth: '800px', margin: '40px auto 0', padding: '0 20px' }}>
        <h2 style={{ margin: '0 0 20px 0', fontSize: '22px', color: '#1f2937', fontWeight: '800' }}>Menu & Items</h2>
        
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', backgroundColor: 'white', borderRadius: '20px', border: '2px dashed #e5e7eb' }}>
            <span style={{ fontSize: '40px', display: 'block', marginBottom: '10px' }}>🍽️</span>
            <p style={{ margin: 0, color: '#6b7280', fontWeight: '500' }}>This store hasn't posted any items yet.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {items.map(item => (
              <div key={item.id} style={{ backgroundColor: 'white', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.04)', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column' }}>
                
                {/* NEW: THE IMAGE HERO BANNER FOR EACH ITEM */}
                {item.image_url ? (
                  <div style={{ width: '100%', height: '180px', backgroundImage: `url(${item.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                ) : null}

                {/* ITEM DETAILS */}
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '10px' }}>
                      <h3 style={{ margin: 0, fontSize: '18px', color: '#1f2937', fontWeight: '700', lineHeight: '1.2' }}>{item.item_name}</h3>
                      <span style={{ fontSize: '16px', fontWeight: '800', color: '#2563eb', backgroundColor: '#eff6ff', padding: '6px 12px', borderRadius: '12px', whiteSpace: 'nowrap' }}>₱{parseFloat(item.price).toFixed(2)}</span>
                    </div>
                    {item.description && <p style={{ margin: 0, color: '#6b7280', fontSize: '14px', lineHeight: '1.5' }}>{item.description}</p>}
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}