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

      if (!allowedRoles || allowedRoles.length === 0) {
        setStatus('authorized');
        return;
      }

      try {
        // 🚀 We only check if they are requesting merchant access
        if (allowedRoles.includes('merchant') || allowedRoles.includes('operator')) {
          
          // Check if they are associated with ANY business
          const { data } = await supabase
            .from('store_operators')
            .select('id')
            .eq('user_id', session.user.id)
            .limit(1)
            .maybeSingle(); 

          if (data) {
            setStatus('authorized'); // They own/operate at least one store
          } else {
            setStatus('unauthorized'); // They don't have any businesses
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
    return <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', color: '#64748B' }}>Verifying access...</div>;
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  if (status === 'unauthorized') {
    return <Navigate to="/" replace />; 
  }

  return children;
}