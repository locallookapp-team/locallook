import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function UpdatePasswordPage() {
  const navigate = useNavigate();
  const [newPin, setNewPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Ensure the user actually verified an OTP and has an active session
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert("Your session is invalid. Please request a new recovery code.");
        navigate('/forgot-password');
      }
    };
    checkSession();
  }, [navigate]);

  const handleUpdatePin = async (e) => {
    e.preventDefault();
    if (newPin.length < 6) return alert("Your PIN must be exactly 6 digits.");
    
    setIsLoading(true);

    try {
      // Supabase still calls it "password", but we pass the 6-digit string
      const { error } = await supabase.auth.updateUser({ password: newPin });
      
      if (error) throw error;
      
      alert("PIN updated successfully!");
      
      // Route them appropriately based on role, or drop them at the map
      navigate('/'); 
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinChange = (e) => {
    const val = e.target.value.replace(/\D/g, ''); // Enforce numbers only
    if (val.length <= 6) setNewPin(val);
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f3f4f6', fontFamily: 'sans-serif', padding: '20px' }}>
      <div style={{ backgroundColor: 'white', padding: '36px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', width: '100%', maxWidth: '380px', boxSizing: 'border-box' }}>
        
        <h2 style={{ margin: '0 0 6px 0', color: '#1f2937', fontSize: '24px', fontWeight: '900' }}>Create New PIN</h2>
        <p style={{ margin: '0 0 24px 0', color: '#6b7280', fontSize: '14px' }}>Your identity has been verified. Please set a new 6-digit PIN for your account.</p>

        <form onSubmit={handleUpdatePin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#4b5563', marginBottom: '6px', textAlign: 'center' }}>NEW 6-DIGIT PIN</label>
            <input 
              type="password" 
              inputMode="numeric"
              maxLength={6}
              required 
              placeholder="••••••"
              value={newPin} 
              onChange={handlePinChange} 
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '20px', letterSpacing: '6px', textAlign: 'center', boxSizing: 'border-box', outline: 'none', fontWeight: 'bold' }} 
            />
          </div>
          
          <button type="submit" disabled={isLoading || newPin.length < 6} style={{ padding: '14px', backgroundColor: (isLoading || newPin.length < 6) ? '#9ca3af' : '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: (isLoading || newPin.length < 6) ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '15px', marginTop: '10px', transition: 'background-color 0.2s' }}>
            {isLoading ? 'Saving...' : 'Save PIN & Continue'}
          </button>
        </form>

      </div>
    </div>
  );
}