import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '../supabaseClient';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';
if (MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
}

const fetchAddressFromCoords = async (lng, lat) => {
  if (!MAPBOX_TOKEN) return '';
  try {
    const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}`);
    const data = await res.json();
    return data.features?.[0]?.place_name || '';
  } catch (e) {
    console.error("Geocoding error:", e);
    return '';
  }
};

export default function CreateBusinessPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [existingStores, setExistingStores] = useState([]);
  
  const [newStoreData, setNewStoreData] = useState({
    store_name: '',
    store_category: 'Food & Dining',
    description: '',
    phone: '',
    email: '',
    website: '',
    lat: '',
    lng: '',
    showPhone: false,
    showEmail: false,
    showWebsite: false,
    showAddress: false,
    addressText: ''
  });

  const mapContainer = useRef(null);
  const map = useRef(null);
  const newPinRef = useRef(null);
  
  // Use a ref for the state so the mapbox event listener always has the freshest state
  const newStoreRef = useRef(newStoreData);
  useEffect(() => { newStoreRef.current = newStoreData; }, [newStoreData]);

  // 1. Fetch Existing Stores to prevent overlapping
  useEffect(() => {
    const fetchExistingLocations = async () => {
      try {
        const { data, error } = await supabase
          .from('stores')
          .select('id, store_name, lat, lng')
          .not('lat', 'is', null)
          .not('lng', 'is', null);
          
        if (!error && data) {
          setExistingStores(data);
        }
      } catch (err) {
        console.error("Error fetching existing stores:", err);
      }
    };
    fetchExistingLocations();
  }, []);

  // 2. Initialize Mapbox & Plot Pins
  useEffect(() => {
    if (mapContainer.current && !map.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [121.9823, 12.3985], // Odiongan Coordinates
        zoom: 15.5,
        pitch: 45,
      });
      map.current.addControl(new mapboxgl.NavigationControl({ showZoom: false, visualizePitch: true }), 'bottom-right');

      // Add existing stores to map once it loads
      map.current.on('load', () => {
        existingStores.forEach(store => {
          if (store.lng && store.lat) {
            const el = document.createElement('div');
            // Gray, semi-transparent dot for existing stores
            el.innerHTML = `<div style="background-color: #94A3B8; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2); cursor: not-allowed;" title="Taken: ${store.store_name}"></div>`;
            new mapboxgl.Marker({ element: el })
              .setLngLat([store.lng, store.lat])
              .setPopup(new mapboxgl.Popup({ offset: 10 }).setHTML(`<strong style="font-size:12px; font-family:sans-serif;">${store.store_name}</strong>`))
              .addTo(map.current);
          }
        });
      });
      
      // Handle User Click to drop their new pin
      map.current.on('click', async (e) => {
        const lng = e.lngLat.lng.toFixed(6);
        const lat = e.lngLat.lat.toFixed(6);
        
        let addressText = newStoreRef.current.addressText;
        if (newStoreRef.current.showAddress) {
          addressText = await fetchAddressFromCoords(lng, lat);
        }

        setNewStoreData(prev => ({ ...prev, lat, lng, addressText }));
        
        if (!newPinRef.current) {
          const el = document.createElement('div');
          // Vibrant Blue Pin for the user's new store
          el.innerHTML = `<div style="background-color: #2563eb; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.5); transform: translateY(-12px); cursor: pointer;"></div>`;
          newPinRef.current = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([lng, lat])
            .addTo(map.current);
        } else {
          newPinRef.current.setLngLat([lng, lat]);
        }
      });
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
        newPinRef.current = null;
      }
    };
  }, [existingStores]);

  const handleCreateStore = async (e) => {
    e.preventDefault();
    if (!newStoreData.lat || !newStoreData.lng) {
      return alert("Please drop a pin on the map to mark your location!");
    }
    
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Authentication required.");

      // 1. Insert Store with proper PostGIS formatting for the map
      const { data: storeData, error: storeError } = await supabase
        .from('stores')
        .insert([{
          store_name: newStoreData.store_name,
          store_category: newStoreData.store_category,
          description: newStoreData.description,
          phone: newStoreData.phone,
          email: newStoreData.email,
          website: newStoreData.website,
          lat: newStoreData.lat, 
          lng: newStoreData.lng,
          location: `POINT(${newStoreData.lng} ${newStoreData.lat})`, // 🚀 PostGIS Format
          theme_settings: {
            showPhone: newStoreData.showPhone,
            showEmail: newStoreData.showEmail,
            showWebsite: newStoreData.showWebsite,
            showAddress: newStoreData.showAddress,
            addressText: newStoreData.addressText,
            primaryColor: '#2563EB',
            layout: 'grid',
            categoryOrder: []
          }
        }])
        .select('id')
        .single();

      if (storeError) throw new Error("Failed to create store: " + storeError.message);

      // 2. 🚀 The New Architecture: Link User to Store in store_operators
      const { error: operatorError } = await supabase
        .from('store_operators')
        .insert([{
          store_id: storeData.id,
          user_id: session.user.id,
          role: 'owner'
        }]);

      if (operatorError) throw new Error("Failed to link ownership: " + operatorError.message);

      // 3. Enter Dashboard
      window.location.href = '/dashboard';

    } catch (err) {
      alert(err.message);
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden', backgroundColor: '#F8FAFC' }}>
      
      {/* 🚀 LEFT PANEL: The sleek onboarding form */}
      <div style={{ width: '100%', maxWidth: '420px', padding: '30px', overflowY: 'auto', borderRight: '1px solid #E2E8F0', backgroundColor: 'white', zIndex: 10, boxShadow: '4px 0 15px rgba(0,0,0,0.03)' }}>
        <h2 style={{ marginTop: 0, color: '#0F172A', fontWeight: '900', fontSize: '24px' }}>Register Location</h2>
        <p style={{ margin: '0 0 20px 0', color: '#64748B', fontSize: '14px', lineHeight: '1.5' }}>
          Drop a pin on the map to claim your spot. You can see gray dots where other stores are already registered.
        </p>
        
        <form onSubmit={handleCreateStore} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <input 
            type="text" 
            placeholder="Store Name" 
            required 
            value={newStoreData.store_name} 
            onChange={e => setNewStoreData({...newStoreData, store_name: e.target.value})} 
            style={{ padding: '14px', borderRadius: '12px', border: '1px solid #CBD5E1', fontSize: '15px', fontWeight: '500', outline: 'none' }} 
          />
          
          <select 
            value={newStoreData.store_category} 
            onChange={e => setNewStoreData({...newStoreData, store_category: e.target.value})} 
            style={{ padding: '14px', borderRadius: '12px', border: '1px solid #CBD5E1', backgroundColor: 'white', fontSize: '15px', fontWeight: '500', outline: 'none' }}
          >
            <option value="Food & Dining">Food & Dining</option>
            <option value="Retail">Retail</option>
            <option value="Services">Services</option>
            <option value="Groceries">Groceries</option>
          </select>
          
          <textarea 
            placeholder="Store Description (Optional)" 
            value={newStoreData.description} 
            onChange={(e) => setNewStoreData({...newStoreData, description: e.target.value})} 
            style={{ padding: '14px', border: '1px solid #CBD5E1', borderRadius: '12px', width: '100%', boxSizing: 'border-box', minHeight: '90px', fontFamily: 'inherit', fontSize: '14px', outline: 'none' }} 
          />
          
          <div style={{ padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#0F172A', fontWeight: '800' }}>Profile Contact Buttons</h4>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer', marginBottom: newStoreData.showPhone ? '12px' : '8px', fontWeight: '600', color: '#475569' }}>
              <input type="checkbox" checked={newStoreData.showPhone} onChange={(e) => setNewStoreData({...newStoreData, showPhone: e.target.checked})} /> Show Phone Number
            </label>
            {newStoreData.showPhone && <input type="text" placeholder="Phone (e.g., +63 900...)" value={newStoreData.phone} onChange={e => setNewStoreData({...newStoreData, phone: e.target.value})} style={{ padding: '12px', borderRadius: '10px', border: '1px solid #CBD5E1', width: '100%', boxSizing: 'border-box', marginBottom: '16px', outline: 'none' }} />}

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer', marginBottom: newStoreData.showEmail ? '12px' : '8px', fontWeight: '600', color: '#475569' }}>
              <input type="checkbox" checked={newStoreData.showEmail} onChange={(e) => setNewStoreData({...newStoreData, showEmail: e.target.checked})} /> Show Email Address
            </label>
            {newStoreData.showEmail && <input type="email" placeholder="Business Email" value={newStoreData.email} onChange={e => setNewStoreData({...newStoreData, email: e.target.value})} style={{ padding: '12px', borderRadius: '10px', border: '1px solid #CBD5E1', width: '100%', boxSizing: 'border-box', marginBottom: '16px', outline: 'none' }} />}

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer', marginBottom: newStoreData.showWebsite ? '12px' : '8px', fontWeight: '600', color: '#475569' }}>
              <input type="checkbox" checked={newStoreData.showWebsite} onChange={(e) => setNewStoreData({...newStoreData, showWebsite: e.target.checked})} /> Show Website Link
            </label>
            {newStoreData.showWebsite && <input type="url" placeholder="Website URL" value={newStoreData.website} onChange={e => setNewStoreData({...newStoreData, website: e.target.value})} style={{ padding: '12px', borderRadius: '10px', border: '1px solid #CBD5E1', width: '100%', boxSizing: 'border-box', marginBottom: '16px', outline: 'none' }} />}

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer', marginBottom: newStoreData.showAddress ? '12px' : '0', fontWeight: '600', color: '#475569' }}>
              <input type="checkbox" checked={newStoreData.showAddress} onChange={async (e) => {
                const checked = e.target.checked; 
                let text = newStoreData.addressText;
                if (checked && !text && newStoreData.lng) {
                  text = await fetchAddressFromCoords(newStoreData.lng, newStoreData.lat);
                }
                setNewStoreData({...newStoreData, showAddress: checked, addressText: text});
              }} /> Show Exact Street Address
            </label>
            {newStoreData.showAddress && <input type="text" placeholder="Auto-detects when you drop a pin" value={newStoreData.addressText} onChange={(e) => setNewStoreData({...newStoreData, addressText: e.target.value})} style={{ padding: '12px', border: '1px solid #CBD5E1', borderRadius: '10px', width: '100%', boxSizing: 'border-box', marginTop: '8px', outline: 'none' }} />}
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <input type="text" readOnly placeholder="Latitude" value={newStoreData.lat} style={{ padding: '12px', borderRadius: '10px', border: '1px solid #E2E8F0', flex: 1, backgroundColor: '#F1F5F9', fontSize: '13px', color: '#64748B', outline: 'none' }} />
            <input type="text" readOnly placeholder="Longitude" value={newStoreData.lng} style={{ padding: '12px', borderRadius: '10px', border: '1px solid #E2E8F0', flex: 1, backgroundColor: '#F1F5F9', fontSize: '13px', color: '#64748B', outline: 'none' }} />
          </div>
          
          <button 
            type="submit" 
            disabled={isLoading} 
            style={{ padding: '16px', backgroundColor: '#2563EB', color: 'white', border: 'none', borderRadius: '14px', fontWeight: '800', fontSize: '15px', cursor: isLoading ? 'not-allowed' : 'pointer', marginTop: '10px', transition: 'background-color 0.2s', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)' }}
          >
            {isLoading ? 'Creating Store...' : 'Confirm Store Location'}
          </button>
        </form>
      </div>

      {/* 🚀 RIGHT PANEL: The Interactive Map */}
      <div style={{ flexGrow: 1, position: 'relative' }}>
        <div ref={mapContainer} style={{ position: 'absolute', inset: 0 }} />
      </div>
      
    </div>
  );
}