import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useTheme } from '../components/ThemeContext';
import Cropper from 'react-easy-crop';
import { CATEGORY_COLORS } from '../components/MapMarkers';
import { 
  MdEdit, MdLocationOn, MdPerson, 
  MdDarkMode, MdLightMode, MdAddBusiness, MdStorefront, MdStore,
  MdHelpOutline, MdLogin, MdOutlineSettings, MdArticle, MdLogout
} from 'react-icons/md';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://locallook-api.onrender.com';

// --- CANVAS HELPER FOR CROPPING & COMPRESSION ---
const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

async function getCroppedImg(imageSrc, pixelCrop, maxSize = 400) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const scale = Math.min(1, maxSize / Math.max(pixelCrop.width, pixelCrop.height));
  canvas.width = Math.round(pixelCrop.width * scale);
  canvas.height = Math.round(pixelCrop.height * scale);

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0, 0,
    canvas.width,
    canvas.height
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/jpeg', 0.8);
  });
}
// ----------------------------------

export default function ProfilePage() {
  const navigate = useNavigate();
  const { isDarkMode, toggleDarkMode } = useTheme();
  
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ display_name: '', avatar_url: '', role: 'consumer' });
  const [avatarError, setAvatarError] = useState(false);
  const [followedStores, setFollowedStores] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');

  // Cropper States
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      
      if (session) {
        setUser(session.user);
        const meta = session.user.user_metadata;
        
        try {
          const [profileRes, followRes] = await Promise.all([
            fetch(`${API_BASE_URL}/api/users/${session.user.id}`),
            supabase
              .from('store_followers')
              .select('store_id, stores ( id, store_name, store_category, industry, cover_image_url, is_open )')
              .eq('user_id', session.user.id)
              .order('created_at', { ascending: false })
          ]);
          
          let role = 'consumer';
          let dbAvatar = '';
          if (profileRes.ok) {
            const profileData = await profileRes.json();
            role = profileData.role || 'consumer';
            dbAvatar = profileData.avatar_url || '';
          }

          const currentName = meta?.full_name || session.user.email.split('@')[0];
          const currentAvatar =
            meta?.custom_avatar_url ||
            dbAvatar ||
            meta?.avatar_url ||
            meta?.picture ||
            '';         
          
          setProfile({ display_name: currentName, avatar_url: currentAvatar, role: role });
          setAvatarError(false);
          setTempName(currentName);

          if (!followRes.error && followRes.data) {
            const storesList = followRes.data.map(row => row.stores).filter(Boolean);
            setFollowedStores(storesList);
          }
        } catch (err) {
          console.error("Error fetching profile data:", err);
        } 
      }
      setLoading(false);
    };
    fetchData();
  }, [navigate]);

  // 1. User selects a file to upload (with MIME & size validation)
  const onFileChange = async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

      if (!allowedTypes.includes(file.type)) {
        alert('Please upload a JPG, PNG, or WebP image.');
        e.target.value = null;
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        alert('Image is too large. Maximum size is 5MB.');
        e.target.value = null;
        return;
      }

      const reader = new FileReader();
      reader.addEventListener('load', () => setImageSrc(reader.result));
      reader.readAsDataURL(file);
      e.target.value = null;
    }
  };

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  // 2. Crop, compress, upload, then delete previous avatar
  const handleCropAndUpload = async () => {
    try {
      setIsUploading(true);
      const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels, 400);
      const filePath = `${user.id}/avatar-${Date.now()}.jpg`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, croppedImageBlob, { upsert: true, contentType: 'image/jpeg' });
        
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Delete previous avatar only if it was stored in your Supabase avatars bucket
      if (profile.avatar_url && profile.avatar_url.includes('/avatars/')) {
        const oldPath = profile.avatar_url.split('/avatars/')[1]?.split('?')[0];
        if (oldPath && oldPath !== filePath) {
          await supabase.storage.from('avatars').remove([oldPath]);
        }
      }

      const { error: updateError } = await supabase.auth.updateUser({
        data: { 
          avatar_url: publicUrl,
          custom_avatar_url: publicUrl
        }
      });


      if (updateError) throw updateError;

      setProfile(prev => ({ ...prev, avatar_url: publicUrl }));
      setAvatarError(false);
      setImageSrc(null);
      
      fetch(`${API_BASE_URL}/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: publicUrl })
      }).catch(err => console.error("Sync error:", err));

    } catch (err) { 
      alert("Upload failed! Error: " + err.message); 
    } finally { 
      setIsUploading(false); 
    }
  };

  const handleSaveName = async () => {
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: tempName }
      });

      if (error) throw error;

      setProfile(prev => ({ ...prev, display_name: tempName }));
      setIsEditingName(false);
      
      fetch(`${API_BASE_URL}/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: tempName })
      }).catch(err => console.error("Sync error:", err));

    } catch (err) {
      alert("Failed to update name: " + err.message);
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
  const userInitial = (profile.display_name || user?.email || 'U').charAt(0).toUpperCase();

  return (
    <div style={{ height: '100%', overflowY: 'auto', backgroundColor: 'var(--bg-color)', padding: '40px 20px', fontFamily: 'var(--font-main)' }}>
      <style>{`
        @keyframes ping { 75%, 100% { transform: scale(2); opacity: 0; } }
        .profile-store-card { position: relative; }
        .profile-store-vignette {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle, rgba(15, 23, 42, 0.1) 20%, rgba(15, 23, 42, 0.55) 100%);
          opacity: 0;
          transition: opacity 0.25s ease;
          pointer-events: none;
          z-index: 1;
        }
        .profile-store-card:hover .profile-store-vignette {
          opacity: 1;
        }
      `}</style>
      {/* CROPPER MODAL */}
      {imageSrc && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'var(--bg-color)', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px', backgroundColor: 'var(--surface-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', zIndex: 10 }}>
            <h3 style={{ margin: 0, color: 'var(--text-main)' }}>Adjust Profile Picture</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setImageSrc(null)} style={{ padding: '10px 20px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: 'var(--surface-hover)', color: 'var(--text-main)' }} disabled={isUploading}>Cancel</button>
              <button onClick={handleCropAndUpload} style={{ padding: '10px 20px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: 'var(--brand-primary)', color: 'white' }} disabled={isUploading}>
                {isUploading ? 'Saving...' : 'Crop & Save'}
              </button>
            </div>
          </div>
          <div style={{ position: 'relative', flexGrow: 1, backgroundColor: '#000' }}>
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
              cropShape="round"
            />
          </div>
        </div>
      )}

      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        
        {!session ? (
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '32px 24px', borderRadius: '24px', textAlign: 'center', border: '1px solid var(--border-color)', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', marginBottom: '32px' }}>
            <div style={{ width: '64px', height: '64px', backgroundColor: 'rgba(37, 99, 235, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
              <MdPerson size={32} color="var(--brand-primary)" />
            </div>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '22px', fontWeight: '900', color: 'var(--text-main)' }}>Your Local Hub</h2>
            <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.5' }}>Log in to leave reviews, save your favorite places, and customize your experience.</p>
            <button onClick={() => navigate('/login')} style={{ width: '100%', padding: '14px', backgroundColor: 'var(--brand-primary)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '800', fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <MdLogin size={20} /> Log In / Sign Up
            </button>
          </div>
        ) : (
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '40px', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', gap: '30px', marginBottom: '32px', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
            
            <div style={{ position: 'relative' }}>
              <div style={{ width: '120px', height: '120px', borderRadius: '50%', backgroundColor: !profile.avatar_url || avatarError ? 'rgba(37, 99, 235, 0.1)' : 'var(--surface-hover)', color: 'var(--brand-primary)', border: '4px solid var(--surface-color)', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '42px', fontWeight: '900' }}>
                {!profile.avatar_url || avatarError ? (
                  userInitial
                ) : (
                  <img
                    src={profile.avatar_url}
                    alt={profile.display_name || 'User'}
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarError(true)}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
              </div>
              <label style={{ position: 'absolute', bottom: '5px', right: '5px', backgroundColor: 'var(--brand-primary)', color: 'white', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', boxShadow: '0 2px 10px rgba(37, 99, 235, 0.4)', transition: 'transform 0.2s' }}>
                <MdEdit size={18} />
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onFileChange} style={{ display: 'none' }} />
              </label>
            </div>

            <div style={{ flexGrow: 1, marginTop: '10px' }}>
              {isEditingName ? (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <input 
                    type="text" 
                    value={tempName} 
                    onChange={(e) => setTempName(e.target.value)} 
                    style={{ padding: '10px 15px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', fontSize: '20px', fontWeight: '800', outline: 'none', color: 'var(--text-main)', width: '250px' }} 
                    autoFocus
                  />
                  <button onClick={handleSaveName} style={{ padding: '10px 20px', backgroundColor: 'var(--brand-primary)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Save</button>
                  <button onClick={() => { setIsEditingName(false); setTempName(profile.display_name); }} style={{ padding: '10px', backgroundColor: 'transparent', color: 'var(--text-muted)', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '8px' }}>
                  <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '900', color: 'var(--text-main)' }}>{profile.display_name}</h1>
                  <button onClick={() => setIsEditingName(true)} style={{ background: 'var(--surface-hover)', border: 'none', padding: '8px', borderRadius: '50%', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MdEdit size={16} />
                  </button>
                </div>
              )}
              
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '15px', fontWeight: '600' }}>{user?.email}</p>
              
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '12px', padding: '6px 12px', backgroundColor: 'rgba(37, 99, 235, 0.1)', color: 'var(--brand-primary)', fontSize: '12px', fontWeight: '800', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {isMerchant ? <MdStorefront size={14} /> : <MdPerson size={14} />}
                {profile.role || 'Consumer'} Account
              </div>
            </div>
            
            <button onClick={handleSignOut} style={{ marginLeft: 'auto', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', border: 'none', padding: '10px 16px', borderRadius: '12px', fontWeight: '800', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: '0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}>
              <MdLogout size={18} /> Log Out
            </button>
          </div>
        )}

        <div style={{ backgroundColor: 'var(--surface-color)', borderRadius: '24px', border: '1px solid var(--border-color)', overflow: 'hidden', marginBottom: '40px' }}>
          <div onClick={toggleDarkMode} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-main)', fontWeight: '700', fontSize: '15px' }}>
              {isDarkMode ? <MdDarkMode size={22} color="var(--brand-primary)"/> : <MdLightMode size={22} color="#F59E0B"/>} 
              Dark Mode
            </div>
            <div style={{ width: '44px', height: '24px', backgroundColor: isDarkMode ? 'var(--brand-primary)' : 'var(--border-color)', borderRadius: '12px', position: 'relative', transition: '0.2s' }}>
              <div style={{ position: 'absolute', top: '2px', left: isDarkMode ? '22px' : '2px', width: '20px', height: '20px', backgroundColor: 'white', borderRadius: '50%', transition: '0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
            </div>
          </div>

          {session && isMerchant ? (
            <div onClick={() => navigate('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', color: 'var(--text-main)', fontWeight: '700', fontSize: '15px' }}>
              <MdStorefront size={22} color="var(--brand-primary)"/> Merchant Dashboard
            </div>
          ) : (
            <div onClick={() => session ? navigate('/create-business') : navigate('/login')} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', color: 'var(--text-main)', fontWeight: '700', fontSize: '15px' }}>
              <MdAddBusiness size={22} color="var(--text-muted)"/> List your business
            </div>
          )}

          {session && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', color: 'var(--text-main)', fontWeight: '700', fontSize: '15px' }}>
              <MdOutlineSettings size={22} color="var(--text-muted)"/> App Settings
            </div>
          )}

          <div onClick={() => navigate('/terms')} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', color: 'var(--text-main)', fontWeight: '700', fontSize: '15px' }}>
            <MdArticle size={22} color="var(--text-muted)"/> Legal & Privacy
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', cursor: 'pointer', color: 'var(--text-main)', fontWeight: '700', fontSize: '15px' }}>
            <MdHelpOutline size={22} color="var(--text-muted)"/> Help & Support
          </div>
        </div>

        {session && (
          <div style={{ marginBottom: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <MdStorefront size={24} color="var(--text-main)" />
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: 'var(--text-main)' }}>
                Following {followedStores.length > 0 && <span style={{ color: 'var(--text-muted)', fontSize: '16px', fontWeight: '700' }}>({followedStores.length})</span>}
              </h2>
            </div>

            {followedStores.length === 0 ? (
              <div style={{ backgroundColor: 'var(--surface-color)', padding: '60px 20px', borderRadius: '24px', textAlign: 'center', border: '2px dashed var(--border-color)' }}>
                <div style={{ fontSize: '40px', marginBottom: '10px' }}>🗺️</div>
                <h3 style={{ margin: '0 0 10px 0', color: 'var(--text-main)', fontSize: '18px' }}>Not following any stores yet</h3>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px', maxWidth: '320px', display: 'inline-block' }}>
                  Follow your favorite local spots to keep them right here and stay updated on their latest posts.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
                {followedStores.map(store => {
                  const fallbackColor = CATEGORY_COLORS[store.store_category] || '#1E293B';
                  return (
                    <div 
                      key={store.id}
                      className="profile-store-card"
                      onClick={() => navigate(`/store/${store.id}`)}
                      style={{ backgroundColor: 'var(--surface-color)', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-color)', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}
                    >
                      <div style={{ height: '130px', background: store.cover_image_url ? `url(${store.cover_image_url}) center/cover no-repeat` : `linear-gradient(135deg, ${fallbackColor} 0%, ${fallbackColor}CC 100%)`, position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 100%)' }} />
                        {!store.cover_image_url && <MdStore size={48} color="rgba(255,255,255,0.45)" style={{ position: 'relative', zIndex: 1 }} />}
                        <div className="profile-store-vignette" />

                        <div style={{ 
                          position: 'absolute', top: '10px', right: '10px', 
                          backgroundColor: 'rgba(15, 23, 42, 0.35)', 
                          backdropFilter: 'blur(12px) saturate(160%)', WebkitBackdropFilter: 'blur(12px) saturate(160%)',
                          border: '1px solid rgba(255, 255, 255, 0.28)',
                          color: store.is_open ? '#FFFFFF' : '#F1F5F9', 
                          textShadow: '0 1px 2px rgba(0, 0, 0, 0.35)',
                          padding: '4px 9px', borderRadius: '8px', fontSize: '10.5px', fontWeight: '900', letterSpacing: '0.5px',
                          display: 'flex', alignItems: 'center', gap: '6px', zIndex: 2 
                        }}>
                          {store.is_open && (
                            <span style={{ position: 'relative', display: 'flex', width: '6px', height: '6px' }}>
                              <span style={{ position: 'absolute', display: 'inline-flex', height: '100%', width: '100%', borderRadius: '50%', backgroundColor: '#34D399', opacity: 0.8, animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite' }} />
                              <span style={{ position: 'relative', display: 'inline-flex', borderRadius: '50%', width: '6px', height: '6px', backgroundColor: '#34D399', boxShadow: '0 0 6px rgba(52, 211, 153, 0.9)' }} />
                            </span>
                          )}
                          {store.is_open ? 'OPEN' : 'CLOSED'}
                        </div>
                      </div>

                      <div style={{ padding: '16px' }}>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '800', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {store.store_name}
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <MdLocationOn size={15} style={{ flexShrink: 0 }} /> {store.industry || store.store_category}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}