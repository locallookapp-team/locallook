import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleResetRequest = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/update-password',
      });

      if (error) throw error;
      setIsSent(true);
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f3f4f6', fontFamily: 'sans-serif' }}>
      <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', width: '100%', maxWidth: '400px' }}>
        
        <button onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px', padding: 0 }}>
          <span>←</span> Back to Login
        </button>

        <h2 style={{ margin: '0 0 5px 0', color: '#1f2937', fontSize: '24px', fontWeight: '900' }}>Reset Password</h2>
        
        {isSent ? (
          <div style={{ backgroundColor: '#eff6ff', padding: '15px', borderRadius: '8px', border: '1px solid #bfdbfe', marginTop: '20px' }}>
            <h3 style={{ margin: '0 0 5px 0', color: '#1e3a8a', fontSize: '16px' }}>Check your email</h3>
            <p style={{ margin: 0, color: '#3b82f6', fontSize: '14px', lineHeight: '1.4' }}>
              We sent a password recovery link to <strong>{email}</strong>.
            </p>
          </div>
        ) : (
          <>
            <p style={{ margin: '0 0 20px 0', color: '#6b7280', fontSize: '14px' }}>Enter your email address and we will send you a secure link to set a new password.</p>
            <form onSubmit={handleResetRequest} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#4b5563', marginBottom: '5px' }}>EMAIL ADDRESS</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }} />
              </div>
              <button type="submit" disabled={isLoading} style={{ padding: '14px', backgroundColor: isLoading ? '#9ca3af' : '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: isLoading ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '15px', marginTop: '10px', transition: 'background-color 0.2s' }}>
                {isLoading ? 'Sending...' : 'Send Recovery Link'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}