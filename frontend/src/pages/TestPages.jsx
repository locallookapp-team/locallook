import React from 'react';
import { CustomMapPin } from '../components/MapMarkers';

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

export default function TestPages() {
  return (
    <div style={{ padding: '40px', backgroundColor: '#F8FAFC', height: '100vh', overflowY: 'auto', boxSizing: 'border-box' }}>
      
      <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '60px' }}>
        <h1 style={{ color: '#0F172A', marginBottom: '10px', fontSize: '32px', fontWeight: '900' }}>LocalLook Pin Library</h1>
        <p style={{ color: '#64748B', marginBottom: '40px', fontSize: '16px' }}>
          Previewing the white outer pin with colored inner circles and dynamic SVGs.
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '56px' }}>
          {Object.entries(BUSINESS_TAXONOMY).map(([category, industries]) => (
            <div key={category} style={{ backgroundColor: 'white', padding: '32px', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
              
              <h3 style={{ margin: '0 0 24px 0', fontSize: '18px', fontWeight: '800', color: '#1E293B', borderBottom: '2px solid #E2E8F0', paddingBottom: '12px' }}>
                {category}
              </h3>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '40px' }}>
                {industries.map(industry => (
                  <div key={industry} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '110px', textAlign: 'center' }}>
                    <CustomMapPin category={category} industry={industry} size={46} />
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569', lineHeight: '1.3' }}>
                      {industry}
                    </span>
                  </div>
                ))}
              </div>
              
            </div>
          ))}
        </div>
      </div>
      
    </div>
  );
}