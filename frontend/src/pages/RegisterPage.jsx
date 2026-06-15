import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import { divIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../supabaseClient';

const customMarker = divIcon({
  className: 'custom-map-pin',
  html: `<div style="background-color: #2563eb; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 3px 6px rgba(0,0,0,0.4);"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -14],
});

function MapClickHandler({ onLocationSelect }) {
  useMapEvents({
    click(e) { onLocationSelect(e.latlng.lat, e.latlng.lng); },
  });
  return null;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '', store_name: '', store_category: 'Food & Dining', lat: '', lng: '' });
  const [stores, setStores] = useState([]);

  useEffect(() => { fetch('https://locallook-api.onrender.com/api/stores').then(res => res.json()).then(data => setStores(data)); }, []);
  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleMapClick = (lat, lng) => setFormData(prev => ({ ...prev, lat: lat.toFixed(6), lng: lng.toFixed(6) }));

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
      if (response.ok) { alert("Registration Successful!"); navigate('/login'); }
    } catch (err) { console.error(err); }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', fontFamily: 'sans-serif' }}>
      <div style={{ width: '350px', padding: '20px', backgroundColor: '#f8f9fa', overflowY: 'auto', zIndex: 1000 }}>
        <h2>Partner with Us</h2>
        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input type="email" name="email" placeholder="Email" required value={formData.email} onChange={handleChange} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }} />
          <input type="password" name="password" placeholder="Password" required value={formData.password} onChange={handleChange} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }} />
          <input type="text" name="store_name" placeholder="Store Name" required value={formData.store_name} onChange={handleChange} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }} />
          <select name="store_category" value={formData.store_category} onChange={handleChange} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}>
            <option value="Food & Dining">Food & Dining</option>
            <option value="Retail">Retail</option>
            <option value="Services">Services</option>
            <option value="Groceries">Groceries</option>
          </select>
          <input type="text" readOnly placeholder="Latitude (Click map)" value={formData.lat} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #eee' }} />
          <input type="text" readOnly placeholder="Longitude (Click map)" value={formData.lng} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #eee' }} />
          <button type="submit" style={{ padding: '12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>Register Store</button>
        </form>
      </div>
      <div style={{ flexGrow: 1 }}>
        <MapContainer center={[12.3985, 121.9823]} zoom={16} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapClickHandler onLocationSelect={handleMapClick} />
          
          {formData.lat && formData.lng && (
            <Marker position={[formData.lat, formData.lng]} icon={customMarker}></Marker>
          )}
          {stores.map(store => (
            <Marker key={store.id} position={[Number(store.lat), Number(store.lng)]} icon={customMarker}>
              <Popup>{store.store_name}</Popup>
            </Marker>
          ))}
          
        </MapContainer>
      </div>
    </div>
  );
}