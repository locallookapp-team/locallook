import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function SignupPage() {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({ fullName: '', email: '', pin: '' });
  const [otpToken, setOtpToken] = useState('');
  const [showPin, setShowPin] = useState(false); 
  
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    if (error) alert("Google Sign-In Error: " + error.message);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (formData.pin.length < 6) return alert("Please enter a full 6-digit PIN.");
    setIsLoading(true);
    try {
      const { error: authError } = await supabase.auth.signUp({ 
        email: formData.email, 
        password: formData.pin,
        options: { data: { full_name: formData.fullName } } 
      });
      
      if (authError) throw new Error(authError.message);
      setIsOtpSent(true);
    } catch (err) {
      alert(err.message); 
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({ 
        email: formData.email, 
        token: otpToken, 
        type: 'signup' 
      });
      
      if (error) throw new Error("Invalid or expired code.");
      if (!data.user) throw new Error("Failed to verify user account.");
      
      navigate('/');
    } catch (err) {
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinChange = (e) => {
    const val = e.target.value.replace(/\D/g, '');
    if (val.length <= 6) setFormData({...formData, pin: val});
  };

  return (
    <>
      <style>{`
        .auth-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #e0e7ff 0%, #f3f4f6 100%);
          font-family: 'Inter', 'Segoe UI', sans-serif;
          padding: 16px;
        }
        .auth-card {
          background-color: #ffffff;
          padding: 32px 24px;
          border-radius: 20px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.05);
          width: 100%;
          max-width: 360px;
          box-sizing: border-box;
        }
        /* Mobile Full Screen Fix */
        @media (max-width: 480px) {
          .auth-container {
            padding: 0;
            background: #ffffff;
          }
          .auth-card {
            max-width: 100%;
            min-height: 100vh;
            border-radius: 0;
            box-shadow: none;
            display: flex;
            flex-direction: column;
            justify-content: center;
            padding: 24px;
          }
        }
      `}</style>

      <div className="auth-container">
        <div className="auth-card">

          {/* 🚀 FIXED: Back to Home Button */}
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#6b7280', fontWeight: 'bold', fontSize: '13px', marginBottom: '20px', width: 'fit-content' }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            Back to Home
          </button>

          <h2 style={{ margin: '0 0 6px 0', color: '#111827', fontSize: '22px', fontWeight: '900', letterSpacing: '-0.5px' }}>Join the Community</h2>
          <p style={{ margin: '0 0 24px 0', color: '#6b7280', fontSize: '13px', lineHeight: '1.4' }}>Create an account to save places and leave reviews.</p>

          {!isOtpSent ? (
            <>
              <button onClick={handleGoogleSignIn} style={{ width: '100%', padding: '10px', backgroundColor: '#ffffff', border: '1px solid #d1d5db', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '13px', color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s', marginBottom: '20px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Sign up with Google
              </button>

              <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0' }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }}></div>
                <span style={{ padding: '0 10px', color: '#9ca3af', fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.5px' }}>OR CONTINUE WITH EMAIL</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }}></div>
              </div>

              <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#4b5563', marginBottom: '6px' }}>FULL NAME</label>
                  <input type="text" required value={formData.fullName} onChange={(e) => setFormData({...formData, fullName: e.target.value})} placeholder="e.g., Juan Dela Cruz" style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box', outline: 'none', backgroundColor: '#f9fafb' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#4b5563', marginBottom: '6px' }}>EMAIL ADDRESS</label>
                  <input type="email" required placeholder="name@example.com" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box', outline: 'none', backgroundColor: '#f9fafb' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#4b5563', marginBottom: '6px' }}>CREATE 6-DIGIT PIN</label>
                  
                  <div style={{ position: 'relative' }}>
                    <input 
                      type={showPin ? "text" : "password"} 
                      inputMode="numeric" 
                      maxLength={6} 
                      required 
                      placeholder="••••••" 
                      value={formData.pin} 
                      onChange={handlePinChange} 
                      style={{ width: '100%', padding: '10px 40px 10px 12px', borderRadius: '10px', border: '1px solid #d1d5db', fontSize: showPin ? '18px' : '22px', letterSpacing: showPin ? '4px' : '8px', textAlign: 'center', boxSizing: 'border-box', outline: 'none', fontWeight: 'bold', backgroundColor: '#f9fafb' }} 
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPin(!showPin)} 
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      {showPin ? (
                        <svg width="20" height="20" fill="none" stroke="#6b7280" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                      ) : (
                        <svg width="20" height="20" fill="none" stroke="#6b7280" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      )}
                    </button>
                  </div>

                  <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#d97706', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    Please memorize this PIN for future logins.
                  </p>

                </div>
                <button type="submit" disabled={isLoading || formData.pin.length < 6} style={{ padding: '12px', backgroundColor: (isLoading || formData.pin.length < 6) ? '#9ca3af' : '#2563eb', color: 'white', border: 'none', borderRadius: '10px', cursor: (isLoading || formData.pin.length < 6) ? 'not-allowed' : 'pointer', fontWeight: '800', fontSize: '14px', marginTop: '6px', boxShadow: (isLoading || formData.pin.length < 6) ? 'none' : '0 4px 10px rgba(37, 99, 235, 0.25)' }}>
                  {isLoading ? 'Creating...' : 'Create Account'}
                </button>
              </form>

              <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: '#6b7280' }}>
                Already have an account? <span onClick={() => navigate('/login')} style={{ color: '#2563eb', fontWeight: 'bold', cursor: 'pointer' }}>Log in</span>
              </div>
            </>
          ) : (
            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ backgroundColor: '#eff6ff', padding: '14px', borderRadius: '10px', border: '1px solid #bfdbfe', marginBottom: '6px' }}>
                <h3 style={{ margin: '0 0 4px 0', color: '#1e3a8a', fontSize: '14px', fontWeight: '800' }}>Verify your email</h3>
                <p style={{ margin: 0, color: '#3b82f6', fontSize: '13px', lineHeight: '1.4' }}>We sent a 6-digit code to <br/><strong>{formData.email}</strong>.</p>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#4b5563', marginBottom: '6px', textAlign: 'center' }}>CONFIRMATION CODE</label>
                <input type="text" required value={otpToken} onChange={(e) => setOtpToken(e.target.value)} placeholder="000000" maxLength={6} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '2px solid #d1d5db', fontSize: '24px', letterSpacing: '8px', textAlign: 'center', boxSizing: 'border-box', outline: 'none', fontWeight: '900', color: '#111827', backgroundColor: '#f9fafb' }} />
              </div>
              <button type="submit" disabled={isLoading || otpToken.length < 6} style={{ padding: '14px', backgroundColor: (isLoading || otpToken.length < 6) ? '#9ca3af' : '#10b981', color: 'white', border: 'none', borderRadius: '10px', cursor: (isLoading || otpToken.length < 6) ? 'not-allowed' : 'pointer', fontWeight: '800', fontSize: '14px', marginTop: '6px', boxShadow: (isLoading || otpToken.length < 6) ? 'none' : '0 4px 10px rgba(16, 185, 129, 0.25)' }}>
                {isLoading ? 'Verifying...' : 'Verify & Continue'}
              </button>
              <button type="button" onClick={() => setIsOtpSent(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', marginTop: '6px', fontSize: '13px', textDecoration: 'underline', fontWeight: '500' }}>
                Wait, I need to use a different email
              </button>
            </form>
          )}

        </div>
      </div>
    </>
  );
}