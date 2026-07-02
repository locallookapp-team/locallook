import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState('phone'); // 'phone' or 'email'
  const [identifier, setIdentifier] = useState('');
  const [otpToken, setOtpToken] = useState('');
  
  const [step, setStep] = useState(1); // 1: Request Code, 2: Verify Code
  const [isLoading, setIsLoading] = useState(false);

  const handleSendCode = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      let error;
      if (authMode === 'email') {
        // Triggers the "Reset Password" email template containing the 6-digit Token
        const res = await supabase.auth.resetPasswordForEmail(identifier);
        error = res.error;
      } else {
        // For phones, we simply send a login OTP to verify ownership
        const res = await supabase.auth.signInWithOtp({ phone: identifier });
        error = res.error;
      }

      if (error) throw error;
      setStep(2);
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const verifyData = authMode === 'email'
        ? { email: identifier, token: otpToken, type: 'recovery' }
        : { phone: identifier, token: otpToken, type: 'sms' };

      const { data, error } = await supabase.auth.verifyOtp(verifyData);
      
      if (error) throw new Error("Invalid or expired code.");
      if (!data.user) throw new Error("Verification failed.");
      
      // Successfully verified! Take them to set a new PIN
      navigate('/update-password');
    } catch (err) {
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f3f4f6', fontFamily: 'sans-serif', padding: '20px' }}>
      <div style={{ backgroundColor: 'white', padding: '36px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', width: '100%', maxWidth: '380px', boxSizing: 'border-box' }}>
        
        <button onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', padding: 0, fontWeight: 'bold' }}>
          <span>←</span> Back to Login
        </button>

        <h2 style={{ margin: '0 0 6px 0', color: '#1f2937', fontSize: '24px', fontWeight: '900' }}>Reset Your PIN</h2>
        
        {step === 1 ? (
          <>
            <p style={{ margin: '0 0 20px 0', color: '#6b7280', fontSize: '14px' }}>Choose how you want to receive your 6-digit recovery code.</p>
            
            <div style={{ display: 'flex', backgroundColor: '#f3f4f6', padding: '4px', borderRadius: '10px', marginBottom: '20px' }}>
              <button onClick={() => { setAuthMode('phone'); setIdentifier(''); }} style={{ flex: 1, padding: '8px', border: 'none', borderRadius: '8px', backgroundColor: authMode === 'phone' ? 'white' : 'transparent', color: authMode === 'phone' ? '#1f2937' : '#6b7280', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: authMode === 'phone' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}>Mobile Number</button>
              <button onClick={() => { setAuthMode('email'); setIdentifier(''); }} style={{ flex: 1, padding: '8px', border: 'none', borderRadius: '8px', backgroundColor: authMode === 'email' ? 'white' : 'transparent', color: authMode === 'email' ? '#1f2937' : '#6b7280', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: authMode === 'email' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}>Email</button>
            </div>

            <form onSubmit={handleSendCode} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#4b5563', marginBottom: '6px' }}>
                  {authMode === 'email' ? 'EMAIL ADDRESS' : 'MOBILE NUMBER'}
                </label>
                <input 
                  type={authMode === 'email' ? 'email' : 'tel'} 
                  required 
                  placeholder={authMode === 'phone' ? '+63 9...' : 'name@example.com'}
                  value={identifier} 
                  onChange={(e) => setIdentifier(e.target.value)} 
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box', outline: 'none', letterSpacing: authMode === 'phone' ? '1px' : 'normal' }} 
                />
              </div>
              <button type="submit" disabled={isLoading || identifier.length < 5} style={{ padding: '14px', backgroundColor: (isLoading || identifier.length < 5) ? '#9ca3af' : '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: (isLoading || identifier.length < 5) ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '15px', marginTop: '4px', transition: 'background-color 0.2s' }}>
                {isLoading ? 'Sending...' : 'Send Recovery Code'}
              </button>
            </form>
          </>
        ) : (
          <form onSubmit={handleVerifyCode} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ backgroundColor: '#eff6ff', padding: '12px', borderRadius: '8px', border: '1px solid #bfdbfe', marginBottom: '10px' }}>
              <h3 style={{ margin: '0 0 4px 0', color: '#1e3a8a', fontSize: '15px' }}>Check your {authMode}</h3>
              <p style={{ margin: 0, color: '#3b82f6', fontSize: '13px', lineHeight: '1.4' }}>
                We sent a 6-digit code to <strong style={{wordBreak: 'break-all'}}>{identifier}</strong>.
              </p>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#4b5563', marginBottom: '5px', textAlign: 'center' }}>RECOVERY CODE</label>
              <input type="text" required value={otpToken} onChange={(e) => setOtpToken(e.target.value)} placeholder="000000" maxLength={6} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #d1d5db', fontSize: '22px', letterSpacing: '8px', textAlign: 'center', boxSizing: 'border-box', outline: 'none', fontWeight: 'bold', color: '#1f2937' }} />
            </div>
            <button type="submit" disabled={isLoading || otpToken.length < 6} style={{ padding: '14px', backgroundColor: (isLoading || otpToken.length < 6) ? '#9ca3af' : '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: (isLoading || otpToken.length < 6) ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '15px', marginTop: '6px' }}>
              {isLoading ? 'Verifying...' : 'Verify & Continue'}
            </button>
            <button type="button" onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', marginTop: '5px', fontSize: '13px', textDecoration: 'underline' }}>
              Wait, I need to use a different {authMode}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}