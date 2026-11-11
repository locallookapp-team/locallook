import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function RegisterPage() {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({ fullName: '', email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [otpToken, setOtpToken] = useState('');

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleGoogleSignIn = async () => {
    // 🚀 Set VIP Pass for when they return from Google
    localStorage.setItem('upgrade_to_merchant', 'true');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/dashboard' }
    });
    if (error) alert("Google Sign-In Error: " + error.message);
  };

  const handleFacebookSignIn = async () => {
    // 🚀 Set VIP Pass for when they return from Facebook
    localStorage.setItem('upgrade_to_merchant', 'true');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: { redirectTo: window.location.origin + '/dashboard' }
    });
    if (error) alert("Facebook Sign-In Error: " + error.message);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error: authError } = await supabase.auth.signUp({ 
        email: formData.email, 
        password: formData.password,
        options: { data: { full_name: formData.fullName } }
      });
      
      if (authError) {
        if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
          throw new Error("It looks like a store manager already invited you! Please check your email for the invite link, or go to the Login page and click 'Continue with Google'.");
        }
        throw new Error(authError.message);
      }
      
      setIsOtpSent(true);

    } catch (err) {
      alert(err.message); 
      console.error(err);
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

      const userId = data.user.id;
      
      // 🚀 FIX: Use 'update' instead of 'upsert' because the DB trigger already created the row!
      const { error: userError } = await supabase
        .from('users')
        .update({ role: 'merchant' })
        .eq('id', userId);

      if (userError) throw new Error("Failed to upgrade profile: " + userError.message);

      navigate('/dashboard');

    } catch (err) {
      alert(err.message);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f3f4f6', fontFamily: 'sans-serif', overflowY: 'auto' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', paddingBottom: '100px' }}>
          <div style={{ backgroundColor: 'white', padding: '28px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', width: '100%', maxWidth: '380px', boxSizing: 'border-box' }}>

            <h2 style={{ margin: '0 0 4px 0', color: '#1f2937', fontSize: '22px', fontWeight: '900' }}>Register Business</h2>
            <p style={{ margin: '0 0 20px 0', color: '#6b7280', fontSize: '13px' }}>Create an account to list your store.</p>

            {!isOtpSent ? (
              <>
                <button onClick={handleGoogleSignIn} style={{ width: '100%', padding: '10px', backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'background-color 0.2s', marginBottom: '10px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </button>

                <button onClick={handleFacebookSignIn} style={{ width: '100%', padding: '10px', backgroundColor: '#1877F2', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'background-color 0.2s', marginBottom: '16px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  Continue with Facebook
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ flexGrow: 1, height: '1px', backgroundColor: '#e5e7eb' }}></div>
                  <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 'bold' }}>OR SIGN UP WITH EMAIL</span>
                  <div style={{ flexGrow: 1, height: '1px', backgroundColor: '#e5e7eb' }}></div>
                </div>

                <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#4b5563', marginBottom: '4px' }}>FULL NAME</label>
                    <input type="text" name="fullName" required value={formData.fullName} onChange={handleChange} placeholder="e.g., Juan Dela Cruz" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#4b5563', marginBottom: '4px' }}>EMAIL ADDRESS</label>
                    <input type="email" name="email" required value={formData.email} onChange={handleChange} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#4b5563', marginBottom: '4px' }}>PASSWORD</label>
                    <input type="password" name="password" required value={formData.password} onChange={handleChange} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }} />
                  </div>
                  <button type="submit" disabled={isLoading} style={{ padding: '12px', backgroundColor: isLoading ? '#9ca3af' : '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: isLoading ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '14px', marginTop: '6px', transition: 'background-color 0.2s' }}>
                    {isLoading ? 'Creating...' : 'Register Business'}
                  </button>
                  <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '13px', color: '#6b7280' }}>
                    Already have an account? <span onClick={() => navigate('/login')} style={{ color: '#2563eb', fontWeight: 'bold', cursor: 'pointer' }}>Log in</span>
                  </div>
                </form>
              </>
            ) : (
              <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ backgroundColor: '#eff6ff', padding: '12px', borderRadius: '8px', border: '1px solid #bfdbfe', marginBottom: '10px' }}>
                  <h3 style={{ margin: '0 0 4px 0', color: '#1e3a8a', fontSize: '15px' }}>Check your email</h3>
                  <p style={{ margin: 0, color: '#3b82f6', fontSize: '13px', lineHeight: '1.4' }}>
                    We sent a 6-digit confirmation code to <strong style={{wordBreak: 'break-all'}}>{formData.email}</strong>.
                  </p>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#4b5563', marginBottom: '5px', textAlign: 'center' }}>CONFIRMATION CODE</label>
                  <input type="text" required value={otpToken} onChange={(e) => setOtpToken(e.target.value)} placeholder="000000" maxLength={6} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #d1d5db', fontSize: '22px', letterSpacing: '8px', textAlign: 'center', boxSizing: 'border-box', outline: 'none', fontWeight: 'bold', color: '#1f2937' }} />
                </div>
                <button type="submit" disabled={isLoading || otpToken.length < 6} style={{ padding: '12px', backgroundColor: (isLoading || otpToken.length < 6) ? '#9ca3af' : '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: (isLoading || otpToken.length < 6) ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '14px', marginTop: '6px', transition: 'background-color 0.2s' }}>
                  {isLoading ? 'Verifying...' : 'Verify & Continue'}
                </button>
                <button type="button" onClick={() => setIsOtpSent(false)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', marginTop: '5px', fontSize: '13px', textDecoration: 'underline' }}>
                  Wait, I need to use a different email
                </button>
              </form>
            )}

          </div>
        </div>
      </div>
  );
}