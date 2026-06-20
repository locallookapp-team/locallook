import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function LoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/dashboard'
      }
    });
    if (error) alert("Google Sign-In Error: " + error.message);
  };

  const handleFacebookSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: {
        redirectTo: window.location.origin + '/dashboard'
      }
    });
    if (error) alert("Facebook Sign-In Error: " + error.message);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({ 
        email: formData.email, 
        password: formData.password 
      });
      if (error) throw new Error(error.message);
      navigate('/dashboard'); 
    } catch (err) {
      alert("Login Failed: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f3f4f6', fontFamily: 'sans-serif' }}>
      
      <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', width: '100%', maxWidth: '400px' }}>
        
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px', padding: 0 }}>
          <span>←</span> Back to Map
        </button>

        <h2 style={{ margin: '0 0 5px 0', color: '#1f2937', fontSize: '24px', fontWeight: '900' }}>Welcome Back</h2>
        <p style={{ margin: '0 0 25px 0', color: '#6b7280', fontSize: '14px' }}>Log in to your Business Portal.</p>

        {/* GOOGLE OAUTH BUTTON */}
        <button onClick={handleGoogleSignIn} style={{ width: '100%', padding: '12px', backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', transition: 'background-color 0.2s', marginBottom: '10px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        {/* FACEBOOK OAUTH BUTTON */}
        <button onClick={handleFacebookSignIn} style={{ width: '100%', padding: '12px', backgroundColor: '#1877F2', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', transition: 'background-color 0.2s', marginBottom: '20px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          Continue with Facebook
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ flexGrow: 1, height: '1px', backgroundColor: '#e5e7eb' }}></div>
          <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 'bold' }}>OR LOG IN WITH EMAIL</span>
          <div style={{ flexGrow: 1, height: '1px', backgroundColor: '#e5e7eb' }}></div>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#4b5563', marginBottom: '5px' }}>EMAIL ADDRESS</label>
            <input type="email" name="email" required value={formData.email} onChange={handleChange} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }} />
          </div>
          
          <div>
            {/* UPDATED PASSWORD HEADER WITH FORGOT PASSWORD LINK */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#4b5563' }}>PASSWORD</label>
              <span 
                onClick={() => navigate('/forgot-password')} 
                style={{ fontSize: '12px', color: '#2563eb', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'none' }}
              >
                Forgot password?
              </span>
            </div>
            <input type="password" name="password" required value={formData.password} onChange={handleChange} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }} />
          </div>

          <button type="submit" disabled={isLoading} style={{ padding: '14px', backgroundColor: isLoading ? '#9ca3af' : '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: isLoading ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '15px', marginTop: '10px', transition: 'background-color 0.2s' }}>
            {isLoading ? 'Verifying...' : 'Log In'}
          </button>
          <div style={{ textAlign: 'center', marginTop: '15px', fontSize: '14px', color: '#6b7280' }}>
            Don't have an account? <span onClick={() => navigate('/register')} style={{ color: '#2563eb', fontWeight: 'bold', cursor: 'pointer' }}>Sign up</span>
          </div>
        </form>
      </div>
    </div>
  );
}