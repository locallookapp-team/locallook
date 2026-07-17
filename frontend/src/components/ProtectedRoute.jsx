import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function ProtectedRoute({ children, allowedRoles }) {
  const [status, setStatus] = useState('loading'); 

  useEffect(() => {
    const verifyAccess = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setStatus('unauthenticated');
        return;
      }

      // If no specific roles are required, they just need to be logged in (e.g., Consumer profile)
      if (!allowedRoles || allowedRoles.length === 0) {
        setStatus('authorized');
        return;
      }

      try {
        // 🚀 Require KYC Identity Verification for merchant/operator access
        if (allowedRoles.includes('merchant') || allowedRoles.includes('operator')) {
          
          // Check the user's secure identity verification status
          const { data: kycProfile } = await supabase
            .from('merchant_profiles')
            .select('kyc_status')
            .eq('id', session.user.id)
            .maybeSingle(); 

          // If they haven't submitted an ID or it isn't approved, lock the door
          if (!kycProfile || kycProfile.kyc_status !== 'approved') {
            setStatus('kyc_required'); 
          } else {
            // Identity is verified! Let them into the dashboard.
            // (If they have 0 stores, the Dashboard handles the empty state perfectly)
            setStatus('authorized'); 
          }
        } else {
          setStatus('unauthorized'); 
        }
      } catch (err) {
        console.error("Error verifying access:", err);
        setStatus('unauthorized');
      }
    };

    verifyAccess();
  }, [allowedRoles]);

  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', color: '#64748B', fontWeight: 'bold' }}>
        Verifying security clearance...
      </div>
    );
  }

  // Kick out users who aren't logged in
  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  // 🚀 Kick unverified merchants to the ID Upload screen
  if (status === 'kyc_required') {
    return <Navigate to="/identity-verification" replace />;
  }

  // General unauthorized fallback
  if (status === 'unauthorized') {
    return <Navigate to="/" replace />; 
  }

  return children;
}