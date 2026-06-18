import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl'; 
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '../supabaseClient';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';
if (MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ 
    email: '', password: '', store_name: '', store_category: 'Food & Dining', lat: '', lng: '' 
  });
  const [stores, setStores] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // MAPBOX REFS
  const mapContainer = useRef(null);
  const map = useRef(null);
  const newPinRef = useRef(null); 
  const existingMarkersRef = useRef({}); 

  // FETCH EXISTING STORES (for reference on the map)
  useEffect(() => { 
    const fetchStores = async () => {
      const { data, error } = await supabase.from('stores').select('*');
      if (data) setStores(data);
      if (error) console.error("Error fetching stores:", error);
    };
    fetchStores();
  }, []);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  // 1. INITIALIZE MAPBOX
  useEffect(() => {
    if (map.current || !mapContainer.current) return; 

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [121.9823, 12.3985], // Odiongan
        zoom: 15.5,
        pitch: 45, 
      });

      map.current.addControl(new mapboxgl.NavigationControl({ showZoom: false, visualizePitch: true }), 'bottom-right');

      // 2. HANDLE MAP CLICKS (Drops the new registration pin)
      map.current.on('click', (e) => {
        const lng = e.lngLat.lng.toFixed(6);
        const lat = e.lngLat.lat.toFixed(6);
        
        setFormData(prev => ({ ...prev, lat, lng }));

        if (!newPinRef.current) {
          const el = document.createElement('div');
          el.innerHTML = `<div style="background-color: #2563eb; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.5); transform: translateY(-12px);"></div>`;
          newPinRef.current = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([lng, lat])
            .addTo(map.current);
        } else {
          newPinRef.current.setLngLat([lng, lat]);
        }
      });
    } catch (err) {
      console.error("Mapbox initialization error:", err);
    }
  }, []);

  // 3. RENDER EXISTING STORE PINS (As gray reference dots)
  useEffect(() => {
    if (!map.current) return;

    stores.forEach(store => {
      const lat = Number(store.lat);
      const lng = Number(store.lng);
      
      if (isNaN(lat) || isNaN(lng) || store.lat === null || store.lng === null || store.lat === '' || store.lng === '') {
        return; 
      }

      if (!existingMarkersRef.current[store.id]) {
        const el = document.createElement('div');
        el.innerHTML = `<div style="background-color: #9ca3af; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`;
        
        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([lng, lat])
          .addTo(map.current);

        const popup = new mapboxgl.Popup({ offset: 10, closeButton: false }).setText(store.store_name);
        marker.setPopup(popup);

        existingMarkersRef.current[store.id] = marker;
      }
    });

  }, [stores]);

  // 4. MULTI-TIER REGISTRATION LOGIC
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!formData.lat || !formData.lng) return alert("Please click on the map to set the store location!");
    
    setIsLoading(true);

    try {
      // Step A: Create the User Account in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({ 
        email: formData.email, 
        password: formData.password 
      });
      
      if (authError) throw new Error(authError.message);
      if (!authData.user) throw new Error("Failed to create user account.");
      const userId = authData.user.id;

      // Step B: INSERT USER INTO PUBLIC TABLE FIRST (Fixes Foreign Key Constraint!)
      const { error: userError } = await supabase
        .from('users')
        .insert([{
          id: userId,
          email: formData.email,
          role: 'merchant'
        }]);

      if (userError) throw new Error("Failed to create public user profile: " + userError.message);

      // Step C: Insert the Store into the `stores` table
      const { data: storeData, error: storeError } = await supabase
        .from('stores')
        .insert([{
          store_name: formData.store_name,
          store_category: formData.store_category,
          lat: formData.lat,
          lng: formData.lng,
          owner_id: userId, 
          is_open: false 
        }])
        .select(); 

      if (storeError) throw new Error("Failed to create store: " + storeError.message);
      const newStoreId = storeData[0].id;

      // Step D: Link the User to the Store in `store_operators` table
      const { error: operatorError } = await supabase
        .from('store_operators')
        .insert([{
          store_id: newStoreId,
          user_id: userId,
          role: 'merchant' // Tagging them as the highest level merchant
        }]);

      if (operatorError) throw new Error("Failed to link operator: " + operatorError.message);

      alert("Store successfully registered! You can now log in.");
      navigate('/login');

    } catch (err) {
      alert("Registration Error: " + err.message);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', fontFamily: 'sans-serif' }}>
      
      {/* SIDEBAR FORM */}
      <div style={{ width: '350px', padding: '30px 20px', backgroundColor: '#f8f9fa', overflowY: 'auto', zIndex: 1000, boxShadow: '5px 0 15px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' }}>
        
        <button onClick={() => navigate('/')} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px', fontWeight: 'bold' }}>
          <span>←</span> Back to Map
        </button>

        <h2 style={{ color: '#1f2937', marginBottom: '20px', marginTop: 0 }}>Partner with Us</h2>
        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Account Details</div>
          <input type="email" name="email" placeholder="Email Address" required value={formData.email} onChange={handleChange} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }} />
          <input type="password" name="password" placeholder="Create Password" required value={formData.password} onChange={handleChange} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }} />
          
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '10px' }}>Store Details</div>
          <input type="text" name="store_name" placeholder="Store Name" required value={formData.store_name} onChange={handleChange} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }} />
          <select name="store_category" value={formData.store_category} onChange={handleChange} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', backgroundColor: 'white' }}>
            <option value="Food & Dining">Food & Dining</option>
            <option value="Retail">Retail</option>
            <option value="Services">Services</option>
            <option value="Groceries">Groceries</option>
            <option value="Tourism & Lodging">Tourism & Lodging</option>
            <option value="Health & Wellness">Health & Wellness</option>
          </select>
          
          <div style={{ padding: '12px', backgroundColor: '#e0e7ff', borderRadius: '8px', color: '#4338ca', fontSize: '13px', textAlign: 'center', fontWeight: 'bold', border: '1px dashed #818cf8' }}>
            📍 Click on the map to drop your store pin
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <input type="text" readOnly placeholder="Latitude" value={formData.lat} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb', flex: 1, backgroundColor: '#f3f4f6', fontSize: '12px', color: '#6b7280' }} />
            <input type="text" readOnly placeholder="Longitude" value={formData.lng} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb', flex: 1, backgroundColor: '#f3f4f6', fontSize: '12px', color: '#6b7280' }} />
          </div>
          
          <button 
            type="submit" 
            disabled={isLoading}
            style={{ padding: '14px', backgroundColor: isLoading ? '#9ca3af' : '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: isLoading ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '15px', marginTop: '10px', transition: 'background-color 0.2s' }}
          >
            {isLoading ? 'Creating Account...' : 'Register Store'}
          </button>

          <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '13px', color: '#6b7280' }}>
            Already a merchant? <span onClick={() => navigate('/login')} style={{ color: '#2563eb', fontWeight: 'bold', cursor: 'pointer' }}>Log In here</span>
          </div>

        </form>
      </div>

      {/* MAPBOX CONTAINER */}
      <div style={{ flexGrow: 1, position: 'relative' }}>
        <div ref={mapContainer} style={{ position: 'absolute', inset: 0 }} />
      </div>

    </div>
  );
}