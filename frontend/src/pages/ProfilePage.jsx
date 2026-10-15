import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useTheme } from '../components/ThemeContext';
import { 
  MdEdit, MdLocationOn, MdBookmarkBorder, MdPerson, 
  MdDarkMode, MdLightMode, MdAddBusiness, MdStorefront,
  MdHelpOutline, MdLogin, MdOutlineSettings, MdArticle
} from 'react-icons/md';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://locallook-api.onrender.com';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { isDarkMode, toggleDarkMode } = useTheme();
  
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ display_name: '', avatar_url: '', role: 'consumer' });
  const [savedPlaces, setSavedPlaces] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      
      if (session) {
        setUser(session.user);
        try {
          const [profileRes, savedRes] = await Promise.all([
            fetch(`${API_BASE_URL}/api/users/${session.user.id}`),
            fetch(`${API_BASE_URL}/api/users/${session.user.id}/saved-places`)
          ]);
          
          if (profileRes.ok) {
            const profileData = await profileRes.json();
            setProfile(profileData);
            setTempName(profileData.display_name || '');
          }
          if (savedRes.ok) {
            setSavedPlaces(await savedRes.json());
          }
        } catch (err) {
          console.error("Error fetching profile data:", err);
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [navigate]);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}-${Math.random()}.${fileExt}`;
      
      // Note: This requires an active 'avatars' bucket in Supabase
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);

      const response = await fetch(`${API_BASE_URL}/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: profile.display_name, avatar_url: publicUrl })
      });

      if (response.ok) {
        setProfile({ ...profile, avatar_url: publicUrl });
      }
    } catch (err) { 
      alert("Note: Avatar upload failed. Ensure your 'avatars' storage bucket is configured. Details: " + err.message); 
    } finally { 
      setIsUploading(false); 
    }
  };

  const handleSaveName = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: tempName, avatar_url: profile.avatar_url })
      });

      if (response.ok) {
        setProfile({ ...profile, display_name: tempName });
        setIsEditingName(false);
      }
    } catch (err) {
      alert("Failed to update name");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (loading) {
    return <div style={{ display: 'flex', height: '100%', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)' }}>Loading Profile...</div>;
  }

  const isMerchant = profile.role === 'merchant' || profile.role === 'operator';

  return (
    <div style={{ height: '100%', overflowY: 'auto', backgroundColor: 'var(--bg-color)', padding: '40px 20px', fontFamily: 'var(--font-main)' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        
        {/* ========================================== */}
        {/* 🚀 GUEST VIEW (Not Logged In)                */}
        {/* ========================================== */}
        {!session ? (
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '32px 24px', borderRadius: '24px', textAlign: 'center', border: '1px solid var(--border-color)', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', marginBottom: '32px' }}>
            <div style={{ width: '64px', height: '64px', backgroundColor: 'rgba(37, 99, 235, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
              <MdPerson size={32} color="#2563EB" />
            </div>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '22px', fontWeight: '900', color: 'var(--text-main)' }}>Your Local Hub</h2>
            <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.5' }}>Log in to leave reviews, save your favorite places, and customize your experience.</p>
            <button onClick={() => navigate('/login')} style={{ width: '100%', padding: '14px', backgroundColor: '#2563EB', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '800', fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <MdLogin size={20} /> Log In / Sign Up
            </button>
          </div>
        ) : (
          /* ========================================== */
          /* 🚀 AUTHENTICATED PROFILE HEADER            */
          /* ========================================== */
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '40px', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', gap: '30px', marginBottom: '32px', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
            
            {/* Avatar Upload */}
            <div style={{ position: 'relative' }}>
              <div style={{ width: '120px', height: '120px', borderRadius: '50%', backgroundColor: 'var(--surface-hover)', backgroundImage: `url(${profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.display_name || 'User'}&background=EFF6FF&color=2563EB&size=120`})`, backgroundSize: 'cover', backgroundPosition: 'center', border: '4px solid var(--surface-color)', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }} />
              <label style={{ position: 'absolute', bottom: '5px', right: '5px', backgroundColor: 'var(--brand-primary)', color: 'white', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: isUploading ? 'not-allowed' : 'pointer', boxShadow: '0 2px 10px rgba(37, 99, 235, 0.4)', transition: 'transform 0.2s' }}>
                <MdEdit size={18} />
                <input type="file" accept="image/*" onChange={handleAvatarUpload} disabled={isUploading} style={{ display: 'none' }} />
              </label>
            </div>

            {/* Name & Role */}
            <div style={{ flexGrow: 1 }}>
              {isEditingName ? (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
                  <input 
                    type="text" 
                    value={tempName} 
                    onChange={(e) => setTempName(e.target.value)} 
                    style={{ padding: '10px 15px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', fontSize: '20px', fontWeight: '800', outline: 'none', color: 'var(--text-main)', width: '250px' }} 
                    autoFocus
                  />
                  <button onClick={handleSaveName} style={{ padding: '10px 20px', backgroundColor: '#10B981', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Save</button>
                  <button onClick={() => { setIsEditingName(false); setTempName(profile.display_name); }} style={{ padding: '10px', backgroundColor: 'transparent', color: 'var(--text-muted)', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '8px' }}>
                  <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '900', color: 'var(--text-main)' }}>{profile.display_name || 'Community Member'}</h1>
                  <button onClick={() => setIsEditingName(true)} style={{ background: 'var(--surface-hover)', border: 'none', padding: '8px', borderRadius: '50%', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MdEdit size={16} />
                  </button>
                </div>
              )}
              
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '15px', fontWeight: '600' }}>{user?.email}</p>
              
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '12px', padding: '6px 12px', backgroundColor: isMerchant ? 'rgba(16, 185, 129, 0.1)' : 'var(--surface-hover)', color: isMerchant ? '#10B981' : 'var(--brand-primary)', fontSize: '12px', fontWeight: '800', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {isMerchant ? <MdStorefront size={14} /> : <MdPerson size={14} />}
                {profile.role || 'Consumer'} Account
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* 🚀 SHARED APP HUB MENU (Settings & Links)  */}
        {/* ========================================== */}
        <div style={{ backgroundColor: 'var(--surface-color)', borderRadius: '24px', border: '1px solid var(--border-color)', overflow: 'hidden', marginBottom: '40px' }}>
          
          {/* Dark Mode Toggle */}
          <div onClick={toggleDarkMode} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-main)', fontWeight: '700', fontSize: '15px' }}>
              {isDarkMode ? <MdDarkMode size={22} color="#2563EB"/> : <MdLightMode size={22} color="#F59E0B"/>} 
              Dark Mode
            </div>
            <div style={{ width: '44px', height: '24px', backgroundColor: isDarkMode ? '#2563EB' : 'var(--border-color)', borderRadius: '12px', position: 'relative', transition: '0.2s' }}>
              <div style={{ position: 'absolute', top: '2px', left: isDarkMode ? '22px' : '2px', width: '20px', height: '20px', backgroundColor: 'white', borderRadius: '50%', transition: '0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
            </div>
          </div>

          {/* Dynamic Business / Dashboard Link */}
          {session && isMerchant ? (
            <div onClick={() => navigate('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', color: 'var(--text-main)', fontWeight: '700', fontSize: '15px' }}>
              <MdStorefront size={22} color="#10B981"/> Merchant Dashboard
            </div>
          ) : (
            <div onClick={() => session ? navigate('/create-business') : navigate('/login')} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', color: 'var(--text-main)', fontWeight: '700', fontSize: '15px' }}>
              <MdAddBusiness size={22} color="var(--text-muted)"/> List your business
            </div>
          )}

          {/* Settings (Only show if logged in) */}
          {session && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', color: 'var(--text-main)', fontWeight: '700', fontSize: '15px' }}>
              <MdOutlineSettings size={22} color="var(--text-muted)"/> App Settings
            </div>
          )}

          {/* Legal */}
          <div onClick={() => navigate('/terms')} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', color: 'var(--text-main)', fontWeight: '700', fontSize: '15px' }}>
            <MdArticle size={22} color="var(--text-muted)"/> Legal & Privacy
          </div>

          {/* Help */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', cursor: 'pointer', color: 'var(--text-main)', fontWeight: '700', fontSize: '15px' }}>
            <MdHelpOutline size={22} color="var(--text-muted)"/> Help & Support
          </div>
        </div>

        {/* ========================================== */}
        {/* 🚀 SAVED PLACES (Logged In Only)           */}
        {/* ========================================== */}
        {session && (
          <div style={{ marginBottom: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <MdBookmarkBorder size={24} color="var(--text-main)" />
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: 'var(--text-main)' }}>Saved Places</h2>
            </div>

            {savedPlaces.length === 0 ? (
              <div style={{ backgroundColor: 'var(--surface-color)', padding: '60px 20px', borderRadius: '24px', textAlign: 'center', border: '2px dashed var(--border-color)' }}>
                <div style={{ fontSize: '40px', marginBottom: '10px' }}>🗺️</div>
                <h3 style={{ margin: '0 0 10px 0', color: 'var(--text-main)', fontSize: '18px' }}>No saved places yet</h3>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px', maxWidth: '300px', display: 'inline-block' }}>When you find a store you love on the map, click the bookmark icon to save it here!</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                {savedPlaces.map(place => (
                  <div 
                    key={place.id} 
                    onClick={() => navigate(`/store/${place.id}`)}
                    style={{ backgroundColor: 'var(--surface-color)', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-color)', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.08)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.02)'; }}
                  >
                    <div style={{ height: '140px', backgroundImage: `url(${place.cover_image_url || 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&q=80'})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                    <div style={{ padding: '16px' }}>
                      <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '800', color: 'var(--text-main)' }}>{place.store_name}</h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600' }}>
                        <MdLocationOn size={16} /> {place.store_category}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 🚀 LOGOUT BUTTON */}
        {session && (
          <button onClick={handleSignOut} style={{ width: '100%', padding: '16px', backgroundColor: 'transparent', border: '2px solid #EF4444', color: '#EF4444', borderRadius: '16px', fontWeight: '800', fontSize: '15px', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(239, 68, 68, 0.05)'} onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}>
            Log Out
          </button>
        )}

      </div>
    </div>
  );
}