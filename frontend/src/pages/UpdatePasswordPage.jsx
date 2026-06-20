import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function UpdatePasswordPage() {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // We only want users to see this page if they actually clicked the secure email link
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert("Your password reset link has expired or is invalid. Please request a new one.");
        navigate('/forgot-password');
      }
    };
    checkSession();
  }, [navigate]);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      
      if (error) throw error;
      
      alert("Password updated successfully!");
      navigate('/dashboard'); // Send them straight to work!
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f3f4f6', fontFamily: 'sans-serif' }}>
      <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', width: '100%', maxWidth: '400px' }}>
        
        <h2 style={{ margin: '0 0 5px 0', color: '#1f2937', fontSize: '24px', fontWeight: '900' }}>Set New Password</h2>
        <p style={{ margin: '0 0 20px 0', color: '#6b7280', fontSize: '14px' }}>Please choose a strong password for your account.</p>

        <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#4b5563', marginBottom: '5px' }}>NEW PASSWORD</label>
            <input type="password" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }} />
          </div>
          <button type="submit" disabled={isLoading || newPassword.length < 6} style={{ padding: '14px', backgroundColor: (isLoading || newPassword.length < 6) ? '#9ca3af' : '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: (isLoading || newPassword.length < 6) ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '15px', marginTop: '10px', transition: 'background-color 0.2s' }}>
            {isLoading ? 'Updating...' : 'Save Password & Continue'}
          </button>
        </form>

      </div>
    </div>
  );
}