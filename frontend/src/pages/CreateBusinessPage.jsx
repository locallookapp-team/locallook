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

const BUSINESS_TAXONOMY = {
  'Food & Dining': [
    'Restaurant', 'Fast Food', 'Carinderia / Eatery', 'Cafe / Coffee Shop', 
    'Bakery / Pastry Shop', 'Snack House / Grill', 'Food Cart / Street Food', 
    'Catering Service'
  ],
  'Grocery & Retail': [
    'Supermarket', 'Grocery Store', 'Convenience Store', 'Sari-Sari Store', 
    'Water Refilling Station', 'Rice Dealer', 'Meat Shop / Butcher', 'Fresh Produce / Market Stall', 
    'Hardware & Construction Supply', 'Agri-Vet Supply', 'Pet Shop', 
    'Pharmacy / Drugstore', 'Bookstore / School Supply', 'Gift & Flower Shop', 
    'Furniture Store', 'Appliance Store', 'Electronics & Gadgets', 
    'Clothing / Apparel Boutique', 'Ukay-Ukay', 'Jewelry & Watches', 'LPG Dealer'
  ],
  'Beauty & Personal Care': [
    'Beauty Salon', 'Barbershop', 'Massage / Spa', 'Skin Care Clinic', 
    'Tattoo Studio', 'Beauty Supply Store'
  ],
  'Health & Medical': [
    'Hospital', 'Medical Clinic', 'Dental Clinic', 'Optical Clinic', 
    'Diagnostic Clinic / Lab', 'Veterinary Clinic', 'Gym / Fitness Center'
  ],
  'Automotive': [
    'Gas Station', 'Car Dealer', 'Motorcycle Dealer', 
    'Auto / Motorcycle Repair & Parts', 'Vulcanizing / Tire Shop', 
    'Car Wash / Detailing', 'Driving School'
  ],
  'Travel & Accommodation': [
    'Hotel', 'Resort', 'Inn / Guesthouse', 'Travel Agency', 'Vehicle Rental'
  ],
  'Home & Professional Services': [
    'Laundry Shop', 'Tailor / Dress Shop', 
    'Printing / Copy Center', 'Gadget Repair', 'Appliance / AC Repair', 
    'Home Repair / Handyman', 'Glass & Aluminum', 'Courier & Freight Service', 
    'Internet Cafe', 'Photography / Video Studio', 'Event Services & Rentals', 
    'IT Services'
  ],
  'Financial & Business': [
    'Bank / ATM', 'Pawnshop / Remittance', 'Money Changer', 
    'Lending / Cooperative', 'Insurance Agency', 'Law & Accounting Office', 
    'Real Estate Office'
  ]
};

export default function CreateBusinessPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [existingStores, setExistingStores] = useState([]);
  
  const [newStoreData, setNewStoreData] = useState({
    store_name: '',
    store_category: 'Food & Dining',
    industry: BUSINESS_TAXONOMY['Food & Dining'][0],
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
  
  const newStoreRef = useRef(newStoreData);
  useEffect(() => { newStoreRef.current = newStoreData; }, [newStoreData]);

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

  useEffect(() => {
    if (mapContainer.current && !map.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [121.9823, 12.3985], 
        zoom: 15.5,
        pitch: 45,
      });
      map.current.addControl(new mapboxgl.NavigationControl({ showZoom: false, visualizePitch: true }), 'bottom-right');

      map.current.on('load', () => {
        existingStores.forEach(store => {
          if (store.lng && store.lat) {
            const el = document.createElement('div');
            el.innerHTML = `<div style="background-color: #94A3B8; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2); cursor: not-allowed;" title="Taken: ${store.store_name}"></div>`;
            new mapboxgl.Marker({ element: el })
              .setLngLat([store.lng, store.lat])
              .setPopup(new mapboxgl.Popup({ offset: 10 }).setHTML(`<strong style="font-size:12px; font-family:sans-serif;">${store.store_name}</strong>`))
              .addTo(map.current);
          }
        });
      });
      
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

  const handleCategoryChange = (e) => {
    const newCategory = e.target.value;
    setNewStoreData({
      ...newStoreData,
      store_category: newCategory,
      industry: BUSINESS_TAXONOMY[newCategory][0] 
    });
  };

  const handleCreateStore = async (e) => {
    e.preventDefault();
    if (!newStoreData.lat || !newStoreData.lng) {
      return alert("Please drop a pin on the map to mark your location!");
    }
    
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Authentication required.");

      const { data: storeData, error: storeError } = await supabase
        .from('stores')
        .insert([{
          store_name: newStoreData.store_name,
          store_category: newStoreData.store_category,
          industry: newStoreData.industry, 
          description: newStoreData.description,
          phone: newStoreData.phone,
          email: newStoreData.email,
          website: newStoreData.website,
          lat: newStoreData.lat, 
          lng: newStoreData.lng,
          location: `POINT(${newStoreData.lng} ${newStoreData.lat})`,
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

      const { error: operatorError } = await supabase
        .from('store_operators')
        .insert([{
          store_id: storeData.id,
          user_id: session.user.id,
          role: 'owner'
        }]);

      if (operatorError) throw new Error("Failed to link ownership: " + operatorError.message);

      window.location.href = '/dashboard';

    } catch (err) {
      alert(err.message);
      setIsLoading(false);
    }
  };

  const labelStyle = { fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' };
  const inputStyle = { padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', fontWeight: '500', outline: 'none', backgroundColor: 'white', width: '100%', boxSizing: 'border-box' };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden', backgroundColor: '#F8FAFC' }}>
      
      {/* LEFT PANEL */}
      <div style={{ width: '100%', maxWidth: '380px', padding: '24px', overflowY: 'auto', borderRight: '1px solid #E2E8F0', backgroundColor: 'white', zIndex: 10, boxShadow: '4px 0 15px rgba(0,0,0,0.03)' }}>
        <h2 style={{ marginTop: 0, color: '#0F172A', fontWeight: '800', fontSize: '22px' }}>Register Location</h2>
        <p style={{ margin: '0 0 20px 0', color: '#64748B', fontSize: '13px', lineHeight: '1.5' }}>
          Drop a pin on the map to claim your spot. You can see gray dots where other stores are already registered.
        </p>
        
        <form onSubmit={handleCreateStore} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={labelStyle}>Store Name</label>
            <input 
              type="text" 
              required 
              value={newStoreData.store_name} 
              onChange={e => setNewStoreData({...newStoreData, store_name: e.target.value})} 
              style={inputStyle} 
            />
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={labelStyle}>Primary Category</label>
            <select 
              value={newStoreData.store_category} 
              onChange={handleCategoryChange} 
              style={inputStyle}
            >
              {Object.keys(BUSINESS_TAXONOMY).map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={labelStyle}>Specific Industry</label>
            <select 
              value={newStoreData.industry} 
              onChange={e => setNewStoreData({...newStoreData, industry: e.target.value})} 
              style={inputStyle}
            >
              {BUSINESS_TAXONOMY[newStoreData.store_category].map(ind => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={labelStyle}>Store Description (Optional)</label>
            <textarea 
              value={newStoreData.description} 
              onChange={(e) => setNewStoreData({...newStoreData, description: e.target.value})} 
              style={{ ...inputStyle, minHeight: '80px', fontFamily: 'inherit', resize: 'vertical' }} 
            />
          </div>
          
          <div style={{ padding: '14px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#0F172A', fontWeight: '800' }}>Profile Contact Buttons</h4>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', marginBottom: newStoreData.showPhone ? '8px' : '6px', fontWeight: '600', color: '#475569' }}>
              <input type="checkbox" checked={newStoreData.showPhone} onChange={(e) => setNewStoreData({...newStoreData, showPhone: e.target.checked})} /> Show Phone Number
            </label>
            {newStoreData.showPhone && <input type="text" placeholder="+63 900..." value={newStoreData.phone} onChange={e => setNewStoreData({...newStoreData, phone: e.target.value})} style={{ ...inputStyle, marginBottom: '12px' }} />}

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', marginBottom: newStoreData.showEmail ? '8px' : '6px', fontWeight: '600', color: '#475569' }}>
              <input type="checkbox" checked={newStoreData.showEmail} onChange={(e) => setNewStoreData({...newStoreData, showEmail: e.target.checked})} /> Show Email Address
            </label>
            {newStoreData.showEmail && <input type="email" placeholder="Email" value={newStoreData.email} onChange={e => setNewStoreData({...newStoreData, email: e.target.value})} style={{ ...inputStyle, marginBottom: '12px' }} />}

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', marginBottom: newStoreData.showWebsite ? '8px' : '6px', fontWeight: '600', color: '#475569' }}>
              <input type="checkbox" checked={newStoreData.showWebsite} onChange={(e) => setNewStoreData({...newStoreData, showWebsite: e.target.checked})} /> Show Website Link
            </label>
            {newStoreData.showWebsite && <input type="url" placeholder="URL" value={newStoreData.website} onChange={e => setNewStoreData({...newStoreData, website: e.target.value})} style={{ ...inputStyle, marginBottom: '12px' }} />}

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', marginBottom: newStoreData.showAddress ? '8px' : '0', fontWeight: '600', color: '#475569' }}>
              <input type="checkbox" checked={newStoreData.showAddress} onChange={async (e) => {
                const checked = e.target.checked; 
                let text = newStoreData.addressText;
                if (checked && !text && newStoreData.lng) {
                  text = await fetchAddressFromCoords(newStoreData.lng, newStoreData.lat);
                }
                setNewStoreData({...newStoreData, showAddress: checked, addressText: text});
              }} /> Show Exact Street Address
            </label>
            {newStoreData.showAddress && <input type="text" placeholder="Auto-detects when you drop a pin" value={newStoreData.addressText} onChange={(e) => setNewStoreData({...newStoreData, addressText: e.target.value})} style={{ ...inputStyle, marginTop: '6px' }} />}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <input type="text" readOnly placeholder="Latitude" value={newStoreData.lat} style={{ ...inputStyle, flex: 1, backgroundColor: '#F1F5F9', color: '#64748B' }} />
            <input type="text" readOnly placeholder="Longitude" value={newStoreData.lng} style={{ ...inputStyle, flex: 1, backgroundColor: '#F1F5F9', color: '#64748B' }} />
          </div>
          
          <button 
            type="submit" 
            disabled={isLoading} 
            style={{ padding: '12px', backgroundColor: '#2563EB', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', fontSize: '14px', cursor: isLoading ? 'not-allowed' : 'pointer', marginTop: '6px', transition: 'background-color 0.2s', boxShadow: '0 2px 8px rgba(37, 99, 235, 0.2)' }}
          >
            {isLoading ? 'Creating Store...' : 'Confirm Store Location'}
          </button>
        </form>
      </div>

      {/* RIGHT PANEL: The Interactive Map */}
      <div style={{ flexGrow: 1, position: 'relative' }}>
        <div ref={mapContainer} style={{ position: 'absolute', inset: 0 }} />
      </div>
      
    </div>
  );
}