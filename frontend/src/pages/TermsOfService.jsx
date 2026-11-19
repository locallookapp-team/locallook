import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MdChevronLeft, MdGavel } from 'react-icons/md';

export default function TermsOfService() {
  const navigate = useNavigate();

  return (
    <div style={{
      height: '100%',
      overflowY: 'auto',
      boxSizing: 'border-box',
      backgroundColor: 'var(--bg-color)',
      padding: '32px 20px 80px 20px',
      fontFamily: 'var(--font-main)'
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '4px',
            color: 'var(--text-muted)', fontWeight: 'bold', fontSize: '13px', marginBottom: '20px'
          }}
        >
          <MdChevronLeft size={18} /> Back
        </button>

        <div style={{
          backgroundColor: 'var(--surface-color)',
          padding: 'clamp(24px, 5vw, 40px)',
          borderRadius: '16px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
            <MdGavel size={28} color="var(--brand-primary)" />
            <h1 style={{ margin: 0, fontSize: 'clamp(22px, 4vw, 28px)', color: 'var(--text-main)', fontWeight: '900' }}>
              Terms of Service & Privacy
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '36px' }}>
            Last Updated: November 2026
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', color: 'var(--text-muted)', lineHeight: '1.7', fontSize: '15px' }}>
            
            <section>
              <h2 style={{ fontSize: '18px', color: 'var(--text-main)', fontWeight: '800', marginBottom: '10px' }}>1. Platform Role & Core Definitions</h2>
              <p style={{ margin: 0 }}>Welcome to LocalLook. We provide a digital directory and storefront management platform. LocalLook acts solely as a technology provider. We do not endorse, guarantee, or assume liability for any products, services, or interactions between consumers and the merchants listed on our platform.</p>
            </section>

            <section>
              <h2 style={{ fontSize: '18px', color: 'var(--text-main)', fontWeight: '800', marginBottom: '10px' }}>2. Merchant Responsibilities</h2>
              <ul style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li><strong style={{ color: 'var(--text-main)' }}>Accurate Information:</strong> Business owners must provide true and legally binding documentation when verifying their store. Fake or misleading listings will be permanently terminated.</li>
                <li><strong style={{ color: 'var(--text-main)' }}>Tax Compliance:</strong> Merchants are strictly and solely responsible for remitting their own local and national taxes to the Bureau of Internal Revenue (BIR) for any goods or services sold.</li>
                <li><strong style={{ color: 'var(--text-main)' }}>Prohibited Content:</strong> You may not list illegal substances, unlicensed firearms, adult content, or any highly regulated items that violate Philippine law.</li>
              </ul>
            </section>

            <section>
              <h2 style={{ fontSize: '18px', color: 'var(--text-main)', fontWeight: '800', marginBottom: '10px' }}>3. Consumer Guidelines & Reviews</h2>
              <p style={{ margin: 0 }}>Consumers must ensure that reviews are based on actual experiences. Spam, hate speech, extortion attempts, or review bombing are strictly prohibited. LocalLook reserves the right to remove any review or suspend any user account that violates these community standards without prior notice.</p>
            </section>

            <section>
              <h2 style={{ fontSize: '18px', color: 'var(--text-main)', fontWeight: '800', marginBottom: '10px' }}>4. Payments, Subscriptions, and Refunds</h2>
              <p style={{ margin: '0 0 10px 0' }}>LocalLook offers premium features accessible via a paid subscription. By upgrading, you authorize us (through our third-party payment processor, PayMongo) to charge your selected payment method.</p>
              <p style={{ margin: '0 0 10px 0' }}><strong style={{ color: 'var(--text-main)' }}>No Refund Policy:</strong> All payments made to LocalLook are strictly non-refundable. We do not provide refunds or credits for partial-month subscription periods, unused features, or premature store closures.</p>
              <p style={{ margin: 0 }}><strong style={{ color: 'var(--text-main)' }}>Promotional Vouchers:</strong> Vouchers granting discounts or "Free Days" hold no cash value and cannot be exchanged for currency. LocalLook reserves the right to modify or revoke promotional codes at any time.</p>
            </section>

            <section>
              <h2 style={{ fontSize: '18px', color: 'var(--text-main)', fontWeight: '800', marginBottom: '10px' }}>5. Privacy & Data Protection</h2>
              <p style={{ margin: '0 0 10px 0' }}>In accordance with the Philippine Data Privacy Act of 2012 (RA 10173), LocalLook only collects information necessary to operate the platform—including account details, user-submitted reviews, and optional device location used to calculate store distances on the map.</p>
              <p style={{ margin: 0 }}>Merchant verification documents (such as DTI/Mayor's Permits and BIR Form 2303) are stored securely and used strictly for business verification. We do not sell your personal data to third parties.</p>
            </section>

            <section>
              <h2 style={{ fontSize: '18px', color: 'var(--text-main)', fontWeight: '800', marginBottom: '10px' }}>6. Limitation of Liability</h2>
              <p style={{ margin: '0 0 10px 0' }}>LocalLook is provided on an "AS IS" and "AS AVAILABLE" basis. We disclaim all warranties, express or implied. We do not warrant that the service will be uninterrupted, error-free, or entirely secure.</p>
              <p style={{ margin: 0 }}>In no event shall LocalLook or its founders be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or goodwill, arising from your access to or inability to use the platform.</p>
            </section>

            <section>
              <h2 style={{ fontSize: '18px', color: 'var(--text-main)', fontWeight: '800', marginBottom: '10px' }}>7. Governing Law & Jurisdiction</h2>
              <p style={{ margin: 0 }}>These Terms shall be governed and construed in accordance with the laws of the Republic of the Philippines. Any legal action or proceeding arising out of or related to these Terms shall be brought exclusively in the competent courts of Odiongan, Romblon.</p>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}