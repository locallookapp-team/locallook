import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  MdBadge, MdStorefront, MdRocketLaunch, 
  MdRestaurantMenu, MdCheckCircle, MdPendingActions, MdUploadFile
} from 'react-icons/md';

export default function MerchantOnboarding({ activeStoreId, onAction }) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({
    hasId: false,
    hasStore: false,
    hasPermits: false,
    isPremium: false,
    hasMenuItem: false,
    isStoreVerified: false
  });

  useEffect(() => {
    const fetchOnboardingStatus = async () => {
      if (!activeStoreId) return; 

      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const userId = session.user.id;

        const { data: merchantProfile } = await supabase
          .from('merchant_profiles')
          .select('kyc_status')
          .eq('id', userId)
          .maybeSingle();

        const { data: store } = await supabase
          .from('stores')
          .select('id, dti_permit_url, bir_cor_url, is_verified')
          .eq('id', activeStoreId)
          .maybeSingle();

        let premiumActive = false;
        let hasItems = false;

        if (store) {
          const { data: sub } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('store_id', store.id)
            .eq('status', 'active')
            .limit(1)
            .maybeSingle();
            
          premiumActive = sub && 
                          sub.plan_type === 'premium' && 
                          sub.status === 'active' && 
                          (!sub.end_date || new Date(sub.end_date) > new Date());

          const { count } = await supabase
            .from('items')
            .select('*', { count: 'exact', head: true })
            .eq('store_id', store.id);
            
          hasItems = count > 0;
        }

        setStatus({
          hasId: merchantProfile?.kyc_status === 'approved', 
          hasStore: !!store,
          hasPermits: store ? (!!store.dti_permit_url && !!store.bir_cor_url) : false,
          isPremium: premiumActive,
          hasMenuItem: hasItems,
          isStoreVerified: store?.is_verified || false
        });
        
      } catch (error) {
        console.error("Error fetching onboarding status:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOnboardingStatus();
  }, [activeStoreId]); 

  if (loading) return null; 

  // 🚀 UPDATED SEQUENCE: Permits moved to the final step
  const steps = [
    { id: 1, title: "Identity Verified", icon: <MdBadge size={20} />, isComplete: status.hasId, actionKey: null },
    { id: 2, title: "Store Created", icon: <MdStorefront size={20} />, isComplete: status.hasStore, actionKey: null },
    { id: 3, title: "Unlock Premium", icon: <MdRocketLaunch size={20} />, isComplete: status.isPremium, actionKey: 'premium' },
    { id: 4, title: "Publish Menu", icon: <MdRestaurantMenu size={20} />, isComplete: status.hasMenuItem, actionKey: 'menu' },
    { id: 5, title: "Submit Permits", icon: <MdUploadFile size={20} />, isComplete: status.hasPermits, actionKey: 'verify' }
  ];

  const completedSteps = steps.filter(step => step.isComplete).length;
  const totalSteps = steps.length;
  const progressPercentage = (completedSteps / totalSteps) * 100;
  const isFullyOnboarded = completedSteps === totalSteps;

  if (isFullyOnboarded && status.isStoreVerified) {
    return null; 
  }

  const handleStepClick = (actionKey) => {
    if (actionKey && onAction) {
      onAction(actionKey);
    }
  };

  return (
    <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '30px', marginBottom: '30px', fontFamily: 'Inter, sans-serif', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '25px' }}>
        <div>
          <h2 style={{ margin: '0 0 5px 0', fontSize: '20px', color: '#0F172A', fontWeight: '800' }}>
            Store Setup Guide
          </h2>
          <p style={{ margin: 0, color: '#64748B', fontSize: '14px' }}>
            Complete these steps to build your storefront. ({completedSteps}/{totalSteps})
          </p>
        </div>
        <div style={{ fontSize: '14px', fontWeight: '800', color: '#2563EB', backgroundColor: '#EFF6FF', padding: '6px 12px', borderRadius: '20px' }}>
          {progressPercentage}% Completed
        </div>
      </div>

      {status.hasPermits && !status.isStoreVerified && (
        <div style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE047', borderRadius: '12px', padding: '15px 20px', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <MdPendingActions size={24} color="#D97706" style={{ flexShrink: 0 }} />
          <p style={{ margin: 0, color: '#B45309', fontSize: '13px', lineHeight: '1.5' }}>
            <strong>Permits Submitted:</strong> Your DTI/BIR documents are currently under review. Once approved by the administrator, your store will receive an official Blue Verified Badge.
          </p>
        </div>
      )}

      <div style={{ position: 'relative', marginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 10 }}>
          {steps.map((step, index) => {
            const isActive = step.isComplete;
            const firstIncompleteIndex = steps.findIndex(s => !s.isComplete);
            const isCurrent = index === firstIncompleteIndex;
            const isClickable = !!step.actionKey; 

            return (
              <div 
                key={step.id} 
                onClick={() => handleStepClick(step.actionKey)}
                title={isClickable ? `Click to ${step.title}` : undefined}
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  flex: 1, 
                  position: 'relative',
                  cursor: isClickable ? 'pointer' : 'default',
                  opacity: 1, // 🚀 Fully opaque to prevent glitchy looks
                  transition: 'opacity 0.3s ease'
                }}
              >
                {/* CONNECTING LINES */}
                {index !== 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '16px', 
                    right: '50%', 
                    width: 'calc(100% - 36px)', 
                    marginRight: '18px',
                    height: '4px',
                    backgroundColor: step.isComplete || steps[index - 1].isComplete ? '#2563EB' : '#F1F5F9',
                    zIndex: -1,
                    transition: 'background-color 0.3s ease'
                  }} />
                )}

                {/* THE CIRCLE */}
                <div style={{ 
                  width: '36px', height: '36px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '10px',
                  backgroundColor: isActive ? '#2563EB' : 'white',
                  color: isActive ? 'white' : isCurrent ? '#2563EB' : '#CBD5E1',
                  border: `2px solid ${isActive || isCurrent ? '#2563EB' : '#E2E8F0'}`,
                  boxShadow: isCurrent ? '0 0 0 6px #EFF6FF' : 'none',
                  transition: 'all 0.3s ease',
                  transform: isCurrent ? 'scale(1.1)' : 'scale(1)',
                  zIndex: 2
                }}>
                  {isActive ? <MdCheckCircle size={22} /> : step.icon}
                </div>
                
                {/* THE TEXT */}
                <div style={{ 
                  fontSize: '13px', 
                  fontWeight: isActive || isCurrent ? '800' : '600', 
                  color: isActive ? '#0F172A' : isCurrent ? '#2563EB' : '#94A3B8', 
                  marginBottom: '4px', 
                  textAlign: 'center',
                  transition: 'color 0.2s ease'
                }}>
                  {step.title}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}