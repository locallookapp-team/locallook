import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function LoginPage() {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({ email: '', pin: '' });
  const [showPin, setShowPin] = useState(false); 
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin } 
    });
    if (error) alert("Google Sign-In Error: " + error.message);
  };

  const handleStandardLogin = async (e) => {
    e.preventDefault();
    if (formData.pin.length < 6) return alert("Please enter your full 6-digit PIN.");
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email: formData.email, 
        password: formData.pin 
      });
      if (error) throw new Error("Invalid login credentials.");
      
      checkRoleAndRedirect(data.user.id);
    } catch (err) {
      alert("Login Failed: " + err.message);
      setIsLoading(false);
    }
  };

  const checkRoleAndRedirect = async (userId) => {
    try {
      const { data: userData } = await supabase.from('users').select('role').eq('id', userId).maybeSingle();
      if (userData?.role === 'merchant' || userData?.role === 'operator') {
        navigate('/dashboard'); 
      } else {
        navigate('/'); 
      }
    } catch (err) {
      navigate('/');
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

          <h2 style={{ margin: '0 0 6px 0', color: '#111827', fontSize: '22px', fontWeight: '900', letterSpacing: '-0.5px' }}>Welcome to LocalLook</h2>
          <p style={{ margin: '0 0 24px 0', color: '#6b7280', fontSize: '13px', lineHeight: '1.4' }}>Sign in to save places, review stores, or manage your business.</p>

          <button onClick={handleGoogleSignIn} style={{ width: '100%', padding: '10px', backgroundColor: '#ffffff', border: '1px solid #d1d5db', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '13px', color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s', marginBottom: '20px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </button>

          <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0' }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }}></div>
            <span style={{ padding: '0 10px', color: '#9ca3af', fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.5px' }}>OR CONTINUE WITH EMAIL</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }}></div>
          </div>

          <form onSubmit={handleStandardLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#4b5563', marginBottom: '6px' }}>EMAIL ADDRESS</label>
              <input type="email" required placeholder="name@example.com" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box', outline: 'none', backgroundColor: '#f9fafb' }} />
            </div>
            
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: '800', color: '#4b5563' }}>6-DIGIT PIN</label>
                <span onClick={() => navigate('/forgot-password')} style={{ fontSize: '11px', color: '#2563eb', fontWeight: 'bold', cursor: 'pointer' }}>Forgot PIN?</span>
              </div>
              
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
            </div>

            <button type="submit" disabled={isLoading || formData.pin.length < 6} style={{ padding: '12px', backgroundColor: (isLoading || formData.pin.length < 6) ? '#9ca3af' : '#2563eb', color: 'white', border: 'none', borderRadius: '10px', cursor: (isLoading || formData.pin.length < 6) ? 'not-allowed' : 'pointer', fontWeight: '800', fontSize: '14px', marginTop: '6px', boxShadow: (isLoading || formData.pin.length < 6) ? 'none' : '0 4px 10px rgba(37, 99, 235, 0.25)' }}>
              {isLoading ? 'Verifying...' : 'Log In'}
            </button>
          </form>
          
          <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: '#6b7280' }}>
            New here? <span onClick={() => navigate('/signup')} style={{ color: '#2563eb', fontWeight: 'bold', cursor: 'pointer' }}>Create an account</span>
          </div>

        </div>
      </div>
    </>
  );
}