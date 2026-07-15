import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { renderToString } from 'react-dom/server';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '../supabaseClient'; 
import { CustomMapPin } from '../components/MapMarkers';
import { MdOutlineNearMe, MdChevronLeft } from "react-icons/md";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';
if (MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://locallook-api.onrender.com';

// 🚀 FIXED: Custom address parser to inject missing commas between street and barangay
const fetchAddressFromCoords = async (lng, lat) => {
  if (!MAPBOX_TOKEN) return '';
  try {
    const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}`);
    const data = await res.json();
    const feature = data.features?.[0];
    
    if (!feature) return '';
    
    let address = feature.place_name || '';
    
    // Check if Mapbox concatenated the street and neighborhood without a comma
    if (feature.text && feature.context && feature.context.length > 0) {
      const nextPart = feature.context[0].text;
      const missingCommaStr = `${feature.text} ${nextPart}`;
      
      if (address.includes(missingCommaStr)) {
        address = address.replace(missingCommaStr, `${feature.text}, ${nextPart}`);
      }
    }
    
    return address;
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
  const [zoom, setZoom] = useState(15.5);
  
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
  const existingMarkersRef = useRef({});
  
  const newStoreRef = useRef(newStoreData);
  useEffect(() => { newStoreRef.current = newStoreData; }, [newStoreData]);

  useEffect(() => {
    const fetchExistingLocations = async () => {
      try {
        const { data, error } = await supabase
          .from('stores')
          .select('id, store_name, store_category, industry, lat, lng')
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
        style: 'mapbox://styles/locallook/cmqttzcqe004h01rc8ya580zb',
        center: [121.9823, 12.3985], 
        zoom: 15.5,
        pitch: 60,
        attributionControl: false 
      });
      map.current.addControl(new mapboxgl.NavigationControl({ showZoom: false, visualizePitch: true }), 'bottom-right');

      map.current.on('zoom', () => setZoom(map.current.getZoom()));
      
      map.current.on('click', async (e) => {
        const lng = e.lngLat.lng.toFixed(6);
        const lat = e.lngLat.lat.toFixed(6);
        
        let addressText = newStoreRef.current.addressText;
        if (newStoreRef.current.showAddress) {
          addressText = await fetchAddressFromCoords(lng, lat);
        }

        setNewStoreData(prev => ({ ...prev, lat, lng, addressText }));
      });
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
        newPinRef.current = null;
        existingMarkersRef.current = {};
      }
    };
  }, []);

  useEffect(() => {
    if (!map.current) return;
    const isZoomedOut = zoom < 15.5;

    existingStores.forEach(store => {
      if (!store.lng || !store.lat) return;
      const htmlString = renderToString(
        <CustomMapPin 
          category={store.store_category} 
          industry={store.industry} 
          storeName={store.store_name} 
          showLabel={zoom >= 16.5} 
          isDotMode={isZoomedOut} 
          size={28} 
        />
      );

      if (!existingMarkersRef.current[store.id]) {
        const el = document.createElement('div');
        el.style.opacity = '0.6'; 
        el.style.cursor = 'not-allowed';
        el.innerHTML = htmlString;
        
        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([store.lng, store.lat])
          .addTo(map.current);
          
        existingMarkersRef.current[store.id] = marker;
      } else {
        existingMarkersRef.current[store.id].getElement().innerHTML = htmlString;
      }
    });
  }, [existingStores, zoom]);

  useEffect(() => {
    if (!map.current || !newStoreData.lat || !newStoreData.lng) return;

    const isZoomedOut = zoom < 15.5;
    const htmlString = renderToString(
      <CustomMapPin 
        category={newStoreData.store_category} 
        industry={newStoreData.industry} 
        storeName={newStoreData.store_name || "New Location"} 
        showLabel={zoom >= 16.5} 
        isDotMode={isZoomedOut} 
        size={34} 
      />
    );

    if (!newPinRef.current) {
      const el = document.createElement('div');
      el.style.zIndex = '99999'; 
      el.innerHTML = htmlString;
      
      newPinRef.current = new mapboxgl.Marker({ element: el, anchor: 'bottom', draggable: true })
        .setLngLat([newStoreData.lng, newStoreData.lat])
        .addTo(map.current);
        
      newPinRef.current.on('dragend', async () => {
        const lngLat = newPinRef.current.getLngLat();
        const lng = lngLat.lng.toFixed(6);
        const lat = lngLat.lat.toFixed(6);
        
        let addressText = newStoreRef.current.addressText;
        if (newStoreRef.current.showAddress) {
          addressText = await fetchAddressFromCoords(lng, lat);
        }
        setNewStoreData(prev => ({ ...prev, lat, lng, addressText }));
      });
    } else {
      newPinRef.current.getElement().innerHTML = htmlString;
      newPinRef.current.setLngLat([newStoreData.lng, newStoreData.lat]);
    }
  }, [newStoreData.lat, newStoreData.lng, newStoreData.store_name, newStoreData.store_category, newStoreData.industry, zoom]);


  const handleLocateMerchant = () => {
    if (!navigator.geolocation || !map.current) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { longitude, latitude } = pos.coords;
        const lng = longitude.toFixed(6);
        const lat = latitude.toFixed(6);
        
        map.current.flyTo({ center: [lng, lat], zoom: 18.5, speed: 1.5 });
        
        let addressText = newStoreRef.current.addressText;
        if (newStoreRef.current.showAddress) {
          addressText = await fetchAddressFromCoords(lng, lat);
        }
        setNewStoreData(prev => ({ ...prev, lat, lng, addressText }));
      },
      (err) => alert("Could not access location. Please check your browser permissions."),
      { enableHighAccuracy: true }
    );
  };

  const handleCategoryChange = (e) => {
    const newCategory = e.target.value;
    setNewStoreData({
      ...newStoreData,
      store_category: newCategory,
      industry: BUSINESS_TAXONOMY[newCategory][0] 
    });
  };

  const handleCoordChange = (field, value) => {
    setNewStoreData(prev => ({ ...prev, [field]: value }));
    
    const num = parseFloat(value);
    if (!isNaN(num)) {
      const targetLat = field === 'lat' ? num : parseFloat(newStoreData.lat);
      const targetLng = field === 'lng' ? num : parseFloat(newStoreData.lng);
      
      if (!isNaN(targetLat) && !isNaN(targetLng) && map.current) {
         map.current.flyTo({ center: [targetLng, targetLat], zoom: 16.5, speed: 1.2 });
      }
    }
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

      const response = await fetch(`${API_BASE_URL}/api/stores`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ ...newStoreData, user_id: session.user.id }) 
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to create store");
      }
      
      const createdStore = await response.json();

      const newTheme = { 
        primaryColor: '#2563EB', layout: 'grid', categoryOrder: [], 
        showPhone: newStoreData.showPhone, showEmail: newStoreData.showEmail, 
        showWebsite: newStoreData.showWebsite, showAddress: newStoreData.showAddress, 
        addressText: newStoreData.addressText 
      };
      
      await fetch(`${API_BASE_URL}/api/stores/${createdStore.id}/theme`, { 
        method: 'PATCH', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ theme_settings: newTheme }) 
      });

      window.location.href = '/dashboard';

    } catch (err) {
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 🚀 SCALED DOWN: Adjusted typography and padding to simulate 90% zoom
  const labelStyle = { fontSize: '10px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' };
  const inputStyle = { padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', fontWeight: '500', outline: 'none', backgroundColor: 'white', width: '100%', boxSizing: 'border-box' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', backgroundColor: '#F8FAFC', padding: '24px', boxSizing: 'border-box' }}>
      
      <style>{`
        .mapboxgl-ctrl-bottom-left, .mapboxgl-ctrl-bottom-right, .mapboxgl-ctrl-logo, .mapboxgl-ctrl-attrib { 
          display: none !important; 
        }
        .hide-scroll::-webkit-scrollbar {
          display: none;
        }
        .hide-scroll {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Back Button */}
      <div style={{ width: '100%', maxWidth: '940px', margin: '0 auto 12px auto' }}>
         <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: '#64748B', fontWeight: 'bold', fontSize: '13px' }}>
            <MdChevronLeft size={18} /> Back to Dashboard
         </button>
      </div>

      <div style={{ width: '100%', maxWidth: '940px', margin: '0 auto', display: 'flex', gap: '24px', flexWrap: 'wrap', height: 'calc(100% - 32px)' }}>
        
        {/* LEFT PANEL (FORM CARD) */}
        <div className="hide-scroll" style={{ flex: '1 1 360px', backgroundColor: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 8px 24px rgba(0,0,0,0.02)', border: '1px solid #E2E8F0', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
          <h2 style={{ marginTop: 0, color: '#0F172A', fontSize: '20px', fontWeight: '900' }}>Register New Location</h2>
          <p style={{ margin: '0 0 16px 0', color: '#64748B', fontSize: '12px', lineHeight: '1.5' }}>Fill out the details and drop a pin on the map to claim your spot.</p>
          
          <form onSubmit={handleCreateStore} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Store Name</label>
              <input type="text" placeholder="Store Name" required value={newStoreData.store_name} onChange={e => setNewStoreData({...newStoreData, store_name: e.target.value})} style={inputStyle} />
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Category</label>
                <select required value={newStoreData.store_category} onChange={handleCategoryChange} style={inputStyle}>
                   <option value="" disabled>Select...</option>
                   {Object.keys(BUSINESS_TAXONOMY).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Industry</label>
                <select required disabled={!newStoreData.store_category} value={newStoreData.industry} onChange={e => setNewStoreData({...newStoreData, industry: e.target.value})} style={inputStyle}>
                   <option value="" disabled>Select...</option>
                   {newStoreData.store_category && BUSINESS_TAXONOMY[newStoreData.store_category].map(ind => <option key={ind} value={ind}>{ind}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Store Description (Optional)</label>
              <textarea placeholder="Brief summary of your business..." value={newStoreData.description} onChange={(e) => setNewStoreData({...newStoreData, description: e.target.value})} style={{ ...inputStyle, minHeight: '60px', fontFamily: 'inherit' }} />
            </div>
            
            <div style={{ padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#374151' }}>Profile Contact Buttons</h4>
              
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', marginBottom: newStoreData.showPhone ? '8px' : '4px', fontWeight: 'bold' }}><input type="checkbox" checked={newStoreData.showPhone} onChange={(e) => setNewStoreData({...newStoreData, showPhone: e.target.checked})} /> Show Phone Number</label>
              {newStoreData.showPhone && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>Phone Number</label>
                  <input type="tel" pattern="[0-9]*" placeholder="e.g. 09123456789" value={newStoreData.phone} onChange={e => setNewStoreData({...newStoreData, phone: e.target.value.replace(/\D/g, '')})} style={inputStyle} />
                </div>
              )}
              
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', marginBottom: newStoreData.showEmail ? '8px' : '4px', fontWeight: 'bold' }}><input type="checkbox" checked={newStoreData.showEmail} onChange={(e) => setNewStoreData({...newStoreData, showEmail: e.target.checked})} /> Show Email Address</label>
              {newStoreData.showEmail && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>Business Email</label>
                  <input type="email" placeholder="store@example.com" value={newStoreData.email} onChange={e => setNewStoreData({...newStoreData, email: e.target.value})} style={inputStyle} />
                </div>
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', marginBottom: newStoreData.showWebsite ? '8px' : '4px', fontWeight: 'bold' }}><input type="checkbox" checked={newStoreData.showWebsite} onChange={(e) => setNewStoreData({...newStoreData, showWebsite: e.target.checked})} /> Show Website Link</label>
              {newStoreData.showWebsite && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>Website URL</label>
                  <input type="url" placeholder="https://yourstore.com" value={newStoreData.website} onChange={e => setNewStoreData({...newStoreData, website: e.target.value})} style={inputStyle} />
                </div>
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', marginBottom: newStoreData.showAddress ? '8px' : '0', fontWeight: 'bold' }}><input type="checkbox" checked={newStoreData.showAddress} onChange={async (e) => { const checked = e.target.checked; let text = newStoreData.addressText; if (checked && !text && newStoreData.lng) text = await fetchAddressFromCoords(newStoreData.lng, newStoreData.lat); setNewStoreData({...newStoreData, showAddress: checked, addressText: text}); }} /> Show Exact Street Address</label>
              {newStoreData.showAddress && (
                <div style={{ marginTop: '8px' }}>
                  <label style={labelStyle}>Store Address</label>
                  <input type="text" placeholder="Auto-detects when you drop a pin" value={newStoreData.addressText} onChange={(e) => setNewStoreData({...newStoreData, addressText: e.target.value})} style={inputStyle} />
                </div>
              )}
            </div>

            <button type="submit" disabled={isLoading} style={{ padding: '12px', backgroundColor: '#2563EB', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: isLoading ? 'not-allowed' : 'pointer', marginTop: '8px', transition: 'background-color 0.2s', fontSize: '13px' }}>
              {isLoading ? 'Creating Store...' : 'Confirm Store Location'}
            </button>
          </form>
        </div>

        {/* RIGHT PANEL (MAP CARD) */}
        <div style={{ flex: '1 1 400px', display: 'flex', flexDirection: 'column', height: '100%' }}>
          
          <div style={{ padding: '12px 16px', backgroundColor: 'white', borderRadius: '16px 16px 0 0', border: '1px solid #E2E8F0', borderBottom: 'none' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#0F172A', fontWeight: '800' }}>Drop a Pin Location</h3>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={labelStyle}>Latitude</label>
                <input 
                  type="number" 
                  step="any" 
                  placeholder="e.g. 12.3985" 
                  value={newStoreData.lat} 
                  onChange={(e) => handleCoordChange('lat', e.target.value)} 
                  style={{...inputStyle, fontSize: '12px', padding: '6px 8px'}} 
                />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={labelStyle}>Longitude</label>
                <input 
                  type="number" 
                  step="any" 
                  placeholder="e.g. 121.9823" 
                  value={newStoreData.lng} 
                  onChange={(e) => handleCoordChange('lng', e.target.value)} 
                  style={{...inputStyle, fontSize: '12px', padding: '6px 8px'}} 
                />
              </div>
            </div>
          </div>

          <div style={{ flexGrow: 1, position: 'relative', minHeight: '350px', borderRadius: '0 0 16px 16px', overflow: 'hidden', border: '1px solid #E2E8F0' }}>
            <div ref={mapContainer} style={{ position: 'absolute', inset: 0 }} />
            
            <div style={{ position: 'absolute', bottom: '16px', right: '16px', zIndex: 10 }}>
               <button 
                 type="button" 
                 onClick={handleLocateMerchant} 
                 style={{ width: '40px', height: '40px', backgroundColor: '#FFFFFF', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', cursor: 'pointer' }}
               >
                 <MdOutlineNearMe size={20} color="#2563EB" style={{ transform: 'translate(-1px, 1px)' }} />
               </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}