import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MdChevronLeft, MdShield } from 'react-icons/md';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFC', padding: '40px 20px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: '#64748B', fontWeight: 'bold', fontSize: '13px', marginBottom: '20px' }}>
          <MdChevronLeft size={18} /> Back
        </button>

        <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', border: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
            <MdShield size={28} color="#10B981" />
            <h1 style={{ margin: 0, fontSize: '28px', color: '#0F172A', fontWeight: '900' }}>Privacy Policy</h1>
          </div>
          <p style={{ color: '#64748B', fontSize: '14px', marginBottom: '40px' }}>Last Updated: August 2026</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', color: '#334155', lineHeight: '1.7', fontSize: '15px' }}>
            
            <section>
              <h2 style={{ fontSize: '18px', color: '#0F172A', fontWeight: '800', marginBottom: '10px' }}>1. Introduction & Compliance</h2>
              <p>LocalLook respects your privacy and is committed to protecting your personal data in compliance with the Philippine Data Privacy Act of 2012 (R.A. 10173). This policy explains how we collect, use, and safeguard your information when you use our platform.</p>
            </section>

            <section>
              <h2 style={{ fontSize: '18px', color: '#0F172A', fontWeight: '800', marginBottom: '10px' }}>2. Information We Collect</h2>
              <ul style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li><strong>Account Information:</strong> When you register, we collect your email address, display name, and securely hashed passwords via our authentication provider (Supabase).</li>
                <li><strong>Merchant Data:</strong> Store owners must provide business details, contact information, and verification documents (DTI/BIR) which are stored securely.</li>
                <li><strong>Location Data:</strong> If you grant permission, we collect geolocation data (via Mapbox) to display stores near you and allow merchants to drop pins for their storefronts.</li>
              </ul>
            </section>

            <section>
              <h2 style={{ fontSize: '18px', color: '#0F172A', fontWeight: '800', marginBottom: '10px' }}>3. How We Use Your Information</h2>
              <p>We use your data strictly to provide and improve the LocalLook service. This includes creating your account, processing secure payments via PayMongo, verifying business legitimacy, and sending crucial service updates or staff invitations to your email.</p>
            </section>

            <section>
              <h2 style={{ fontSize: '18px', color: '#0F172A', fontWeight: '800', marginBottom: '10px' }}>4. Data Sharing and Security</h2>
              <p>We do not sell your personal data. We only share necessary information with trusted third-party service providers (such as PayMongo for payment processing and Resend for email delivery) under strict confidentiality agreements. LocalLook employs industry-standard security measures, including Row Level Security (RLS) in our database, to protect your information against unauthorized access.</p>
            </section>

            <section>
              <h2 style={{ fontSize: '18px', color: '#0F172A', fontWeight: '800', marginBottom: '10px' }}>5. Your Privacy Rights</h2>
              <p>Under the Data Privacy Act, you have the right to be informed, object to processing, access your data, and request the correction or deletion of your personal information from our systems. If you wish to exercise these rights or permanently delete your account, please contact our support team.</p>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}