import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { MdArrowBack, MdWarning } from 'react-icons/md';

export default function LoginPage() {
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    let timer;
    if (isOtpSent && countdown > 0) {
      timer = setInterval(() => setCountdown(c => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [isOtpSent, countdown]);

  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin } 
    });
    if (error) alert("Google Sign-In Error: " + error.message);
  };

  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    try {
      const { error } = await supabase.auth.signInWithOtp({ 
        email: email,
        options: { shouldCreateUser: false } // Prevents ghost accounts
      });
      
      if (error) {
        if (error.message.includes('Signups not allowed') || error.status === 400) {
          throw new Error("No account found with this email. Please sign up first.");
        }
        throw error;
      }
      
      setIsOtpSent(true);
      setCountdown(60); 
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otpToken.length < 6) return;
    
    setIsLoading(true);
    setErrorMsg('');
    try {
      const { data, error } = await supabase.auth.verifyOtp({ 
        email: email, 
        token: otpToken,
        type: 'email'
      });
      
      if (error) throw new Error("Invalid or expired code.");
      if (!data.user) throw new Error("Verification failed.");
      
      checkRoleAndRedirect(data.user.id);
    } catch (err) {
      setErrorMsg(err.message);
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
    if (val.length <= 6) {
      setOtpToken(val);
      setErrorMsg(''); 
    }
  };

  return (
    <>
      <style>{`
        .auth-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-color);
          font-family: var(--font-main);
          padding: 20px;
        }
        .auth-card {
          background-color: var(--surface-color);
          padding: 40px 32px;
          border-radius: 20px;
          border: 1px solid var(--border-color);
          box-shadow: 0 10px 30px rgba(0,0,0,0.05);
          width: 100%;
          max-width: 400px;
          min-height: 560px; /* 🚀 Fixed size matches Signup */
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
        }
        @media (max-width: 480px) {
          .auth-container { padding: 0; }
          .auth-card {
            max-width: 100%;
            min-height: 100vh;
            border-radius: 0;
            border: none;
            display: flex;
            flex-direction: column;
            justify-content: center;
            padding: 30px 24px;
          }
        }
      `}</style>

      <div className="auth-container">
        <div className="auth-card">

          <button onClick={() => navigate('/map')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontWeight: 'bold', fontSize: '13px', marginBottom: '24px', width: 'fit-content' }}>
            <MdArrowBack size={18} /> Back to Home
          </button>

          <h2 style={{ margin: '0 0 6px 0', color: 'var(--text-main)', fontSize: '24px', fontWeight: '900', letterSpacing: '-0.5px' }}>Welcome back</h2>
          <p style={{ margin: '0 0 46px 0', color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.4' }}>Sign in to review places or manage your store.</p>

          {errorMsg && (
            <div style={{ padding: '10px 14px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.3)', fontSize: '13px', fontWeight: 'bold', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MdWarning size={18} /> {errorMsg}
            </div>
          )}

          {!isOtpSent ? (
            <>
              <button onClick={handleGoogleSignIn} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', transition: 'all 0.2s', marginBottom: '24px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Continue with Google
              </button>

              <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0' }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }}></div>
                <span style={{ padding: '0px 12px', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.5px' }}>OR CONTINUE WITH EMAIL</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }}></div>
              </div>

              <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '6px' }}>EMAIL ADDRESS</label>
                  <input type="email" required placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '14px', boxSizing: 'border-box', outline: 'none', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)' }} />
                </div>
                
                <button type="submit" disabled={isLoading || !email} style={{ padding: '12px', backgroundColor: (isLoading || !email) ? 'var(--border-color)' : 'var(--brand-primary)', color: (isLoading || !email) ? 'var(--text-muted)' : 'white', border: 'none', borderRadius: '10px', cursor: (isLoading || !email) ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '14px', marginTop: '4px', transition: 'all 0.2s' }}>
                  {isLoading ? 'Sending Code...' : 'Send Login Code'}
                </button>
              </form>
            </>
          ) : (
            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ backgroundColor: 'var(--surface-hover)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '4px' }}>
                <h3 style={{ margin: '0 0 4px 0', color: 'var(--text-main)', fontSize: '14px', fontWeight: '800' }}>Check your email</h3>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.5' }}>
                  We sent a 6-digit code to <br/><strong style={{color: 'var(--brand-primary)'}}>{email}</strong>.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '6px', textAlign: 'center' }}>ENTER LOGIN CODE</label>
                <input type="text" required value={otpToken} onChange={handlePinChange} placeholder="000000" maxLength={6} style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '2px solid var(--border-color)', fontSize: '24px', letterSpacing: '10px', textAlign: 'center', boxSizing: 'border-box', outline: 'none', fontWeight: '900', color: 'var(--text-main)', backgroundColor: 'var(--bg-color)' }} autoFocus />
              </div>
              
              <button type="submit" disabled={isLoading || otpToken.length < 6} style={{ padding: '12px', backgroundColor: (isLoading || otpToken.length < 6) ? 'var(--border-color)' : '#10b981', color: (isLoading || otpToken.length < 6) ? 'var(--text-muted)' : 'white', border: 'none', borderRadius: '10px', cursor: (isLoading || otpToken.length < 6) ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '14px', marginTop: '4px', transition: 'all 0.2s', boxShadow: (isLoading || otpToken.length < 6) ? 'none' : '0 4px 10px rgba(16, 185, 129, 0.2)' }}>
                {isLoading ? 'Verifying...' : 'Secure Login'}
              </button>
              
              <div style={{ textAlign: 'center', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {countdown > 0 ? (
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>
                    Resend code in {countdown}s
                  </span>
                ) : (
                  <button type="button" onClick={handleSendOtp} style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>
                    Resend Code
                  </button>
                )}
                
                <button type="button" onClick={() => {setIsOtpSent(false); setOtpToken(''); setCountdown(0); setErrorMsg('');}} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline', fontWeight: '500' }}>
                  Use a different email
                </button>
              </div>
            </form>
          )}

          {/* 🚀 FIXED FOOTER: margin-top: auto pushes the empty space below the form */}
          <div style={{ textAlign: 'center', marginTop: 'auto', paddingTop: '24px', fontSize: '13px', color: 'var(--text-muted)' }}>
            New here? <span onClick={() => navigate('/signup')} style={{ color: 'var(--brand-primary)', fontWeight: 'bold', cursor: 'pointer' }}>Create an account</span>
          </div>

        </div>
      </div>
    </>
  );
}