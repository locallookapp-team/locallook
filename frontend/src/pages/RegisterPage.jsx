import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl'; 
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '../supabaseClient';

// INITIALIZE MAPBOX
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
mapboxgl.accessToken = MAPBOX_TOKEN;

export default function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '', store_name: '', store_category: 'Food & Dining', lat: '', lng: '' });
  const [stores, setStores] = useState([]);

  // MAPBOX REFS
  const mapContainer = useRef(null);
  const map = useRef(null);
  const newPinRef = useRef(null); 
  const existingMarkersRef = useRef({}); 

  // FETCH EXISTING STORES (for reference on the map)
  useEffect(() => { 
    fetch('https://locallook-api.onrender.com/api/stores')
      .then(res => res.json())
      .then(data => setStores(data))
      .catch(err => console.error(err)); 
  }, []);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  // 1. INITIALIZE MAPBOX
  useEffect(() => {
    if (map.current) return; 

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [121.9823, 12.3985], // Odiongan
        zoom: 15.5,
        pitch: 45, // 3D tilt
      });

      map.current.addControl(new mapboxgl.NavigationControl({ showZoom: false, visualizePitch: true }), 'bottom-right');

      // 2. HANDLE MAP CLICKS (Drops the new registration pin)
      map.current.on('click', (e) => {
        const lng = e.lngLat.lng.toFixed(6);
        const lat = e.lngLat.lat.toFixed(6);
        
        // Update the form
        setFormData(prev => ({ ...prev, lat, lng }));

        // Move or create the blue selection pin
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
      if (!existingMarkersRef.current[store.id]) {
        const el = document.createElement('div');
        el.innerHTML = `<div style="background-color: #9ca3af; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`;
        
        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([Number(store.lng), Number(store.lat)])
          .addTo(map.current);

        const popup = new mapboxgl.Popup({ offset: 10, closeButton: false }).setText(store.store_name);
        marker.setPopup(popup);

        existingMarkersRef.current[store.id] = marker;
      }
    });
  }, [stores]);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!formData.lat || !formData.lng) return alert("Please click on the map to set the store location!");
    const { data, error } = await supabase.auth.signUp({ email: formData.email, password: formData.password });
    if (error) return alert("Account Error: " + error.message);

    try {
      const response = await fetch('https://locallook-api.onrender.com/api/stores', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_name: formData.store_name, store_category: formData.store_category, lat: formData.lat, lng: formData.lng, owner_id: data.user?.id, email: formData.email })
      });
      if (response.ok) { 
        alert("Registration Successful!"); 
        navigate('/login'); 
      }
    } catch (err) { 
      console.error(err); 
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', fontFamily: 'sans-serif' }}>
      
      {/* SIDEBAR FORM */}
      <div style={{ width: '350px', padding: '30px 20px', backgroundColor: '#f8f9fa', overflowY: 'auto', zIndex: 1000, boxShadow: '5px 0 15px rgba(0,0,0,0.1)' }}>
        <h2 style={{ color: '#1f2937', marginBottom: '20px' }}>Partner with Us</h2>
        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input type="email" name="email" placeholder="Email" required value={formData.email} onChange={handleChange} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }} />
          <input type="password" name="password" placeholder="Password" required value={formData.password} onChange={handleChange} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }} />
          <input type="text" name="store_name" placeholder="Store Name" required value={formData.store_name} onChange={handleChange} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }} />
          <select name="store_category" value={formData.store_category} onChange={handleChange} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', backgroundColor: 'white' }}>
            <option value="Food & Dining">Food & Dining</option>
            <option value="Retail">Retail</option>
            <option value="Services">Services</option>
            <option value="Groceries">Groceries</option>
            <option value="Tourism & Lodging">Tourism & Lodging</option>
            <option value="Health & Wellness">Health & Wellness</option>
          </select>
          
          <div style={{ padding: '10px', backgroundColor: '#e0e7ff', borderRadius: '8px', color: '#4338ca', fontSize: '13px', textAlign: 'center', fontWeight: 'bold' }}>
            Click on the map to set location 📍
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <input type="text" readOnly placeholder="Latitude" value={formData.lat} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb', flex: 1, backgroundColor: '#f3f4f6', fontSize: '12px' }} />
            <input type="text" readOnly placeholder="Longitude" value={formData.lng} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb', flex: 1, backgroundColor: '#f3f4f6', fontSize: '12px' }} />
          </div>
          
          <button type="submit" style={{ padding: '14px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', marginTop: '10px', transition: 'background-color 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#1d4ed8'} onMouseLeave={e => e.currentTarget.style.backgroundColor = '#2563eb'}>
            Register Store
          </button>
        </form>
      </div>

      {/* MAPBOX CONTAINER */}
      <div style={{ flexGrow: 1, position: 'relative' }}>
        <div ref={mapContainer} style={{ position: 'absolute', inset: 0 }} />
      </div>

    </div>
  );
}