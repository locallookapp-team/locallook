import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Step A: Create the User Account in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({ 
        email: formData.email, 
        password: formData.password 
      });
      
      if (authError) throw new Error(authError.message);
      if (!authData.user) throw new Error("Failed to create user account.");
      const userId = authData.user.id;

      // Step B: Insert the Merchant profile into the public users table
      // We use upsert to prevent 409 crashes if you reuse an email during testing
      const { error: userError } = await supabase
        .from('users')
        .upsert(
          { id: userId, email: formData.email, role: 'merchant' },
          { onConflict: 'email' }
        );

      if (userError) throw new Error("Failed to create user profile: " + userError.message);

      alert("Merchant account created successfully! Please log in.");
      navigate('/login');

    } catch (err) {
      alert("Registration Error: " + err.message);
      console.error(err);
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

        <h2 style={{ margin: '0 0 5px 0', color: '#1f2937', fontSize: '24px', fontWeight: '900' }}>Create Account</h2>
        <p style={{ margin: '0 0 25px 0', color: '#6b7280', fontSize: '14px' }}>Sign up to manage your stores and staff.</p>

        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#4b5563', marginBottom: '5px' }}>EMAIL ADDRESS</label>
            <input type="email" name="email" required value={formData.email} onChange={handleChange} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#4b5563', marginBottom: '5px' }}>PASSWORD</label>
            <input type="password" name="password" required value={formData.password} onChange={handleChange} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }} />
          </div>
          
          <button 
            type="submit" 
            disabled={isLoading}
            style={{ padding: '14px', backgroundColor: isLoading ? '#9ca3af' : '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: isLoading ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '15px', marginTop: '10px', transition: 'background-color 0.2s' }}
          >
            {isLoading ? 'Creating...' : 'Sign Up'}
          </button>

          <div style={{ textAlign: 'center', marginTop: '15px', fontSize: '14px', color: '#6b7280' }}>
            Already have an account? <span onClick={() => navigate('/login')} style={{ color: '#2563eb', fontWeight: 'bold', cursor: 'pointer' }}>Log in</span>
          </div>

        </form>
      </div>
    </div>
  );
}