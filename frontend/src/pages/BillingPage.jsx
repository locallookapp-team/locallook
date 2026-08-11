import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  MdPayment, MdReceipt, MdCheckCircle, MdLockClock, 
  MdRocketLaunch, MdLocalOffer, MdCancel, MdCheck, MdClose
} from 'react-icons/md';

const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) 
  ? import.meta.env.VITE_API_URL 
  : 'https://locallook-api.onrender.com';

export default function BillingPage() {
  const [stores, setStores] = useState([]);
  const [activeStore, setActiveStore] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal & Payment States
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [checkoutPromoCode, setCheckoutPromoCode] = useState('');

  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherMessage, setVoucherMessage] = useState(null);

  const getAuthHeaders = async (isJson = true) => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = { 'Authorization': `Bearer ${session?.access_token}` };
    if (isJson) headers['Content-Type'] = 'application/json';
    return headers;
  };

  useEffect(() => {
    const fetchBillingData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: userStores, error: storesError } = await supabase
          .from('stores')
          .select('id, store_name')
          .eq('merchant_id', session.user.id);
          
        if (storesError) throw storesError;
        setStores(userStores || []);
        
        if (userStores && userStores.length > 0) {
          const defaultStore = userStores[0];
          setActiveStore(defaultStore);
          await loadStoreFinancials(defaultStore.id);
        }
      } catch (err) {
        console.error("Error fetching billing:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBillingData();
  }, []);

  const loadStoreFinancials = async (storeId) => {
    const { data: subData } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
      
    setSubscription(subData || { plan_type: 'free', end_date: null });

    const { data: txData } = await supabase
      .from('transaction_logs')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });
      
    setTransactions(txData || []);
  };

  const handleStoreChange = async (e) => {
    const storeId = e.target.value;
    const selected = stores.find(s => s.id === storeId);
    setActiveStore(selected);
    await loadStoreFinancials(storeId);
  };

  const handleProceedToPayment = async () => {
    if (!activeStore) return;
    setIsProcessingPayment(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/create-checkout-session`, { 
        method: 'POST', 
        headers: await getAuthHeaders(), 
        body: JSON.stringify({ store_id: activeStore.id, voucher_code: checkoutPromoCode.trim() || null }) 
      });
      const data = await res.json();
      if (data.checkoutUrl) window.location.href = data.checkoutUrl; 
      else throw new Error(data.error || "Failed to initiate payment");
    } catch (err) { 
      alert("Error initiating payment: " + err.message); 
      setIsProcessingPayment(false); 
    }
  };

  const handleRedeemVoucher = async () => {
    if (!activeStore || !voucherCode.trim()) return;
    setVoucherLoading(true); setVoucherMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/vouchers/redeem`, { 
        method: 'POST', 
        headers: await getAuthHeaders(), 
        body: JSON.stringify({ store_id: activeStore.id, voucher_code: voucherCode }) 
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to redeem voucher.");
      
      setVoucherMessage({ type: 'success', text: data.message });
      await loadStoreFinancials(activeStore.id); 
      
      setTimeout(() => setIsVoucherModalOpen(false), 2000);
    } catch (err) { 
      setVoucherMessage({ type: 'error', text: err.message }); 
    } finally { 
      setVoucherLoading(false); 
    }
  };

  if (loading) {
    return <div style={{ padding: '40px', color: '#64748B' }}>Loading financial records...</div>;
  }

  const isPremium = subscription?.plan_type === 'premium' && new Date(subscription.end_date) > new Date();

  return (
    <div style={{ height: '100%', width: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      <div style={{ padding: '30px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <h1 style={{ margin: 0, fontSize: '24px', color: '#0F172A', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <MdPayment color="#2563EB" /> Billing & Subscriptions
          </h1>
          
          {stores.length > 0 && (
            <select 
              value={activeStore?.id || ''} 
              onChange={handleStoreChange}
              style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid #CBD5E1', outline: 'none', fontWeight: 'bold', color: '#334155', backgroundColor: 'white' }}
            >
              {stores.map(store => (
                <option key={store.id} value={store.id}>{store.store_name}</option>
              ))}
            </select>
          )}
        </div>

        {stores.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', backgroundColor: 'white', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
            <p style={{ color: '#64748B', fontWeight: 'bold' }}>You need to register a store before managing billing.</p>
          </div>
        ) : (
          <>
            {/* PRICING TIERS SECTION (LocalLook Light Mode) */}
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '40px' }}>
              
              {/* FREE PLAN CARD */}
              <div style={{ flex: '1 1 350px', backgroundColor: 'white', color: '#0F172A', padding: '30px', borderRadius: '16px', display: 'flex', flexDirection: 'column', position: 'relative', border: '1px solid #E2E8F0', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '20px', fontWeight: '800' }}>Free</h3>
                <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: '20px' }}>
                  <span style={{ fontSize: '18px', fontWeight: 'bold', marginRight: '4px', marginTop: '4px' }}>₱</span>
                  <span style={{ fontSize: '40px', fontWeight: '900', lineHeight: '1' }}>0</span>
                  <span style={{ fontSize: '12px', color: '#64748B', marginLeft: '6px' }}>/ month</span>
                </div>
                <p style={{ margin: '0 0 20px 0', color: '#64748B', fontSize: '13px' }}>The essential listing for local discovery.</p>
                
                <button 
                  disabled={true} 
                  style={{ width: '100%', padding: '12px', backgroundColor: isPremium ? '#F8FAFC' : '#F1F5F9', color: isPremium ? '#CBD5E1' : '#64748B', border: 'none', borderRadius: '8px', fontWeight: 'bold', marginBottom: '30px', cursor: 'not-allowed' }}
                >
                  {isPremium ? 'Included with Premium' : 'Your Current Plan'}
                </button>

                <div style={{ flexGrow: 1 }}>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#334155', fontWeight: '500' }}><MdCheck color="#10B981" size={18} /> Map Pin & Search Listing</li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#334155', fontWeight: '500' }}><MdCheck color="#10B981" size={18} /> Toggle Open/Closed Status</li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#334155', fontWeight: '500' }}><MdCheck color="#10B981" size={18} /> Business Contact Info</li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#334155', fontWeight: '500' }}><MdCheck color="#10B981" size={18} /> Custom Logo & Cover Photo</li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#334155', fontWeight: '500' }}><MdCheck color="#10B981" size={18} /> Brand Color Customization</li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#94A3B8' }}><MdClose size={18} /> Digital Menu Builder</li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#94A3B8' }}><MdClose size={18} /> Printable QR Code</li>
                  </ul>
                </div>
              </div>

              {/* PREMIUM PLAN CARD */}
              <div style={{ flex: '1 1 350px', backgroundColor: '#F8FAFC', color: '#0F172A', padding: '30px', borderRadius: '16px', border: '2px solid #2563EB', display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.1)' }}>
                <div style={{ position: 'absolute', top: '-12px', right: '20px', backgroundColor: '#2563EB', color: 'white', padding: '4px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: '900', letterSpacing: '0.5px', textTransform: 'uppercase' }}>POPULAR</div>
                
                <h3 style={{ margin: '0 0 10px 0', fontSize: '20px', fontWeight: '800' }}>Premium</h3>
                <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: '20px' }}>
                  <span style={{ fontSize: '18px', fontWeight: 'bold', marginRight: '4px', marginTop: '4px' }}>₱</span>
                  <span style={{ fontSize: '40px', fontWeight: '900', lineHeight: '1' }}>199</span>
                  <span style={{ fontSize: '12px', color: '#64748B', marginLeft: '6px' }}>/ 30 days (No VAT)</span>
                </div>
                <p style={{ margin: '0 0 20px 0', color: '#64748B', fontSize: '13px' }}>Unlock the full storefront experience.</p>

                <button 
                  onClick={() => setIsUpgradeModalOpen(true)}
                  disabled={isPremium} 
                  style={{ width: '100%', padding: '12px', backgroundColor: isPremium ? '#10B981' : '#2563EB', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', marginBottom: '30px', cursor: isPremium ? 'default' : 'pointer', transition: 'background-color 0.2s', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', boxShadow: isPremium ? 'none' : '0 4px 12px rgba(37,99,235,0.2)' }}
                >
                  {isPremium ? <><MdCheckCircle size={18} /> Active until {new Date(subscription.end_date).toLocaleDateString()}</> : 'Upgrade to Premium'}
                </button>

                <div style={{ flexGrow: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '15px' }}>Everything in Free, plus:</div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#0F172A', fontWeight: '500' }}><MdCheck color="#2563EB" size={18} /> Unlimited Digital Menu Items</li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#0F172A', fontWeight: '500' }}><MdCheck color="#2563EB" size={18} /> Printable QR Code Generation</li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#0F172A', fontWeight: '500' }}><MdCheck color="#2563EB" size={18} /> Reply to Customer Reviews</li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#0F172A', fontWeight: '500' }}><MdCheck color="#2563EB" size={18} /> Invite Staff / Operator Accounts</li>
                  </ul>
                </div>
              </div>

            </div>

            {/* TRANSACTION LEDGER */}
            <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <div style={{ padding: '20px', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#0F172A', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MdReceipt color="#64748B" /> Transaction History
                </h3>
              </div>
              
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #E2E8F0', color: '#64748B', fontSize: '13px' }}>
                      <th style={{ padding: '15px 20px' }}>Date</th>
                      <th style={{ padding: '15px 20px' }}>Description</th>
                      <th style={{ padding: '15px 20px' }}>Reference / ID</th>
                      <th style={{ padding: '15px 20px', textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.length === 0 ? (
                      <tr><td colSpan="4" style={{ padding: '30px', textAlign: 'center', color: '#94A3B8' }}>No transactions found for this store.</td></tr>
                    ) : (
                      transactions.map(tx => (
                        <tr key={tx.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '15px 20px', color: '#334155', fontSize: '14px' }}>{new Date(tx.created_at).toLocaleDateString()}</td>
                          <td style={{ padding: '15px 20px', color: '#0F172A', fontWeight: '600', fontSize: '14px' }}>{tx.event_type.replace(/_/g, ' ')}</td>
                          <td style={{ padding: '15px 20px', color: '#64748B', fontSize: '13px', fontFamily: 'monospace' }}>{tx.reference_number || 'N/A'}</td>
                          <td style={{ padding: '15px 20px', textAlign: 'right', fontWeight: 'bold', color: tx.amount > 0 ? '#0F172A' : '#059669', fontSize: '14px' }}>
                            {tx.amount > 0 ? `₱${parseFloat(tx.amount).toFixed(2)}` : 'FREE'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* UPGRADE MODAL */}
        {isUpgradeModalOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
            <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '20px', width: '100%', maxWidth: '450px', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
              <h2 style={{ margin: '0 0 10px 0', fontSize: '24px', color: '#0F172A', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>Unlock Premium <MdRocketLaunch color="#2563EB" /></h2>
              <p style={{ color: '#64748B', marginBottom: '25px', fontSize: '14px', lineHeight: '1.5' }}>Get full access to edit your menu, customize your store branding, and accept online orders.</p>
              
              <div style={{ marginBottom: '15px', textAlign: 'left' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#64748B', marginBottom: '8px' }}>Have a percentage or fixed discount code?</label>
                <input 
                  type="text" 
                  placeholder="e.g. SUMMER20" 
                  value={checkoutPromoCode} 
                  onChange={e => setCheckoutPromoCode(e.target.value.toUpperCase())} 
                  style={{ width: '100%', padding: '12px', border: '1px solid #E2E8F0', borderRadius: '10px', boxSizing: 'border-box', textTransform: 'uppercase' }} 
                />
              </div>

              <div style={{ marginBottom: '15px', fontSize: '11px', color: '#475569', lineHeight: '1.4', textAlign: 'center', padding: '0 10px' }}>
                By proceeding with this payment, you acknowledge that you have read and agree to our strictly non-refundable payment policy as outlined in our <a href="/terms" target="_blank" rel="noreferrer" style={{ color: '#2563EB', textDecoration: 'underline' }}>Terms of Service</a>.
              </div>

              <button onClick={handleProceedToPayment} disabled={isProcessingPayment} style={{ width: '100%', padding: '14px', backgroundColor: '#F8FAFC', color: '#0F172A', border: '1px solid #E2E8F0', borderRadius: '12px', fontWeight: 'bold', cursor: isProcessingPayment ? 'not-allowed' : 'pointer', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <MdPayment size={18} /> {isProcessingPayment ? 'Redirecting...' : 'Pay via GCash / Maya'}
              </button>
              
              <div style={{ margin: '20px 0', borderTop: '1px solid #E2E8F0', position: 'relative' }}>
                 <span style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'white', padding: '0 10px', fontSize: '12px', color: '#94A3B8', fontWeight: 'bold' }}>OR</span>
              </div>

              <button onClick={() => { setIsUpgradeModalOpen(false); setIsVoucherModalOpen(true); }} style={{ width: '100%', padding: '14px', backgroundColor: '#2563EB', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '5px', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <MdLocalOffer size={18} /> Claim Free Days
              </button>
              
              <button onClick={() => setIsUpgradeModalOpen(false)} style={{ marginTop: '15px', background: 'none', border: 'none', color: '#94A3B8', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}

        {/* VOUCHER MODAL */}
        {isVoucherModalOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
            <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '20px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
              <h2 style={{ margin: '0 0 15px 0', fontSize: '20px', color: '#0F172A', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}><MdLocalOffer color="#2563EB" /> Redeem Free Days</h2>
              <input 
                type="text" 
                placeholder="ENTER FREE DAYS CODE" 
                value={voucherCode} 
                onChange={e => setVoucherCode(e.target.value.toUpperCase())} 
                style={{ width: '100%', padding: '12px', border: '1px solid #E2E8F0', borderRadius: '10px', boxSizing: 'border-box', marginBottom: '15px', textTransform: 'uppercase' }} 
              />
              {voucherMessage && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '15px', fontSize: '13px', color: voucherMessage.type === 'success' ? '#059669' : '#DC2626', fontWeight: 'bold' }}>
                  {voucherMessage.type === 'success' ? <MdCheckCircle size={16} /> : <MdCancel size={16} />} {voucherMessage.text}
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setIsVoucherModalOpen(false)} style={{ flex: 1, padding: '12px', backgroundColor: '#F1F5F9', color: '#475569', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleRedeemVoucher} disabled={voucherLoading || !voucherCode.trim()} style={{ flex: 1, padding: '12px', backgroundColor: '#2563EB', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: voucherLoading || !voucherCode.trim() ? 'not-allowed' : 'pointer' }}>{voucherLoading ? 'Redeeming...' : 'Redeem'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}