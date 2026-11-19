import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
  MdStar, 
  MdStorefront, 
  MdClose,
  MdChevronLeft,
  MdChevronRight,
  MdMoreVert,
  MdFlag,
  MdCampaign,
  MdDynamicFeed
} from 'react-icons/md';
import { VscThumbsup, VscThumbsupFilled } from 'react-icons/vsc';

const timeAgo = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.round((now - date) / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const Avatar = ({ src, name, size, color }) => {
  const [error, setError] = useState(false);
  
  if (!src || error) {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', backgroundColor: 'var(--surface-hover)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: '800', color: color || 'var(--brand-primary)', flexShrink: 0, overflow: 'hidden', fontSize: `${parseInt(size)/2.5}px` }}>
        {(name || 'U').charAt(0).toUpperCase()}
      </div>
    );
  }
  
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', backgroundColor: 'var(--surface-hover)', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0, overflow: 'hidden' }}>
      <img src={src} alt="avatar" referrerPolicy="no-referrer" onError={() => setError(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  );
};

export default function ReviewsFeedPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState('Feed');
  
  const [animatingLikeId, setAnimatingLikeId] = useState(null);
  const [lightbox, setLightbox] = useState({ isOpen: false, images: [], currentIndex: 0 });

  const [activeMenuId, setActiveMenuId] = useState(null);
  
  // 🚀 FIXED: Modal now tracks if it is reporting a 'review' or a 'post'
  const [reportModal, setReportModal] = useState({ isOpen: false, targetId: null, type: null });
  const [reportReason, setReportReason] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    fetchFeed();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  const fetchFeed = async () => {
    try {
      const [reviewsRes, postsRes] = await Promise.all([
        supabase
          .from('reviews')
          .select(`
            id, rating, comment, photo_urls, created_at, user_id, reviewer_name, reviewer_avatar, owner_reply, owner_reply_created_at,
            store_id,
            stores ( store_name, theme_settings ),
            review_likes ( user_id )
          `),
        supabase
          .from('merchant_posts')
          .select(`
            id, content, photo_url, created_at, merchant_id,
            store_id,
            stores ( store_name, logo_url, theme_settings ),
            post_likes ( user_id )
          `)
      ]);

      if (reviewsRes.error) throw reviewsRes.error;
      if (postsRes.error) throw postsRes.error;

      // 🚀 FIXED: Normalizing the data so both types share the exact same 'likes' and 'author_id' variables
      const formattedReviews = (reviewsRes.data || []).map(r => ({ ...r, feed_type: 'review', author_id: r.user_id, likes: r.review_likes || [] }));
      const formattedPosts = (postsRes.data || []).map(p => ({ ...p, feed_type: 'post', author_id: p.merchant_id, likes: p.post_likes || [] }));

      const combined = [...formattedReviews, ...formattedPosts].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      setFeed(combined);
    } catch (err) {
      console.error("Error fetching feed:", err);
    } finally {
      setLoading(false);
    }
  };

  // 🚀 FIXED: Single toggle function that routes likes to the correct database table dynamically
  const toggleLike = async (item, isCurrentlyLiked) => {
    if (!session) return navigate('/login');

    const userId = session.user.id;

    if (!isCurrentlyLiked) {
      setAnimatingLikeId(item.id);
      setTimeout(() => setAnimatingLikeId(null), 300); 
    }

    setFeed(prevFeed => prevFeed.map(feedItem => {
      if (feedItem.id === item.id) {
        const newLikes = isCurrentlyLiked 
          ? feedItem.likes.filter(like => like.user_id !== userId) 
          : [...feedItem.likes, { user_id: userId }]; 
        return { ...feedItem, likes: newLikes };
      }
      return feedItem;
    }));

    try {
      const table = item.feed_type === 'review' ? 'review_likes' : 'post_likes';
      const idColumn = item.feed_type === 'review' ? 'review_id' : 'post_id';

      if (isCurrentlyLiked) {
        await supabase.from(table).delete().match({ [idColumn]: item.id, user_id: userId });
      } else {
        await supabase.from(table).insert([{ [idColumn]: item.id, user_id: userId }]);
        
        if (item.author_id !== userId) {
          const storeName = item.stores?.store_name || 'a store';
          const actionUrl = item.feed_type === 'review' ? `/store/${item.store_id}` : '/reviews';
          const totalLikes = (item.likes?.length || 0) + 1;
          const contentType = item.feed_type === 'review' ? 'review' : 'store update';
          
          const messageText = totalLikes > 1 
            ? `${totalLikes} locals liked your ${contentType} for ${storeName}.`
            : `1 local liked your ${contentType} for ${storeName}.`;
          
          const { data: existingNotifs } = await supabase
            .from('notifications')
            .select('id, message')
            .eq('user_id', item.author_id)
            .eq('type', 'social_like')
            .eq('action_url', actionUrl)
            .order('created_at', { ascending: false })
            .limit(1);

          if (existingNotifs && existingNotifs.length > 0) {
            await supabase.from('notifications').update({
              message: messageText, created_at: new Date().toISOString(), is_read: false 
            }).eq('id', existingNotifs[0].id);
          } else {
            await supabase.from('notifications').insert([{
              user_id: item.author_id, title: 'New Like!', message: messageText, type: 'social_like', action_url: actionUrl
            }]);
          }
        }
      }
    } catch (err) {
      console.error("Error toggling like:", err);
      fetchFeed(); // Revert on failure
    }
  };

  useEffect(() => {
    const channel = supabase
      .channel('public-merchant-posts-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'merchant_posts' },
        () => {
          fetchFeed();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 🚀 FIXED: Dynamic routing for deleting or reporting based on post/review
  const handleAction = async (action, item) => {
    setActiveMenuId(null);
    if (action === 'report') {
      if (!session) return navigate('/login');
      setReportModal({ isOpen: true, targetId: item.id, type: item.feed_type });
      setReportReason('');
    } else if (action === 'delete') {
      if (!window.confirm(`Are you sure you want to delete this ${item.feed_type}?`)) return;
      const table = item.feed_type === 'review' ? 'reviews' : 'merchant_posts';
      const { error } = await supabase.from(table).delete().eq('id', item.id);
      if (!error) fetchFeed(); 
    }
  };

  const submitReport = async () => {
    if (!reportReason) return alert("Please select a reason for reporting.");
    setIsSubmittingReport(true);

    try {
      const table = reportModal.type === 'review' ? 'reported_reviews' : 'reported_posts';
      const idColumn = reportModal.type === 'review' ? 'review_id' : 'post_id';

      const { error } = await supabase.from(table).insert([{
        [idColumn]: reportModal.targetId,
        reporter_id: session.user.id,
        reason: reportReason
      }]);

      if (error) {
        if (error.code === '23505') { 
          alert("You have already reported this item.");
        } else {
          throw error;
        }
      } else {
        alert("Report submitted successfully. Our team will review this shortly.");
      }

      setReportModal({ isOpen: false, targetId: null, type: null });
    } catch (err) {
      alert("Failed to submit report: " + err.message);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const openLightbox = (images, index) => setLightbox({ isOpen: true, images, currentIndex: index });
  const closeLightbox = () => setLightbox({ isOpen: false, images: [], currentIndex: 0 });
  const nextImage = (e) => { e.stopPropagation(); setLightbox(prev => ({ ...prev, currentIndex: (prev.currentIndex + 1) % prev.images.length })); };
  const prevImage = (e) => { e.stopPropagation(); setLightbox(prev => ({ ...prev, currentIndex: (prev.currentIndex - 1 + prev.images.length) % prev.images.length })); };

  if (loading) return <div style={{ display: 'flex', height: '100%', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)' }}>Loading Feed...</div>;

  const reportOptions = [
    "Spam or fake content",
    "Inappropriate or offensive language",
    "Hate speech or harassment",
    "Contains personal or private information",
    "Irrelevant to this business"
  ];

  const filteredFeed = feed.filter(item => {
    if (activeTab === "Customer's Reviews") return item.feed_type === 'review';
    if (activeTab === 'Store Updates') return item.feed_type === 'post';
    return true; 
  });

  const tabOptions = [
    { id: 'Feed', label: 'Feed', icon: <MdDynamicFeed size={18} /> },
    { id: "Customer's Reviews", label: "Customer's Reviews", icon: <MdStar size={18} /> },
    { id: 'Store Updates', label: 'Store Updates', icon: <MdCampaign size={18} /> }
  ];

  return (
    <div style={{ height: '100%', overflowY: 'auto', backgroundColor: 'var(--bg-color)', padding: '0', fontFamily: 'var(--font-main)' }}>
      
      {reportModal.isOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999999, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '30px', borderRadius: '24px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MdFlag color="#EF4444" /> Report {reportModal.type === 'review' ? 'Review' : 'Post'}
              </h3>
              <button onClick={() => setReportModal({ isOpen: false, targetId: null, type: null })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><MdClose size={24} /></button>
            </div>
            
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px' }}>Why are you reporting this {reportModal.type === 'review' ? 'review' : 'post'}? Your report is anonymous.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              {reportOptions.map(option => (
                <label key={option} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: 'var(--text-main)', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="reportReason" 
                    value={option} 
                    checked={reportReason === option}
                    onChange={(e) => setReportReason(e.target.value)}
                    style={{ accentColor: 'var(--brand-primary)', width: '16px', height: '16px' }}
                  />
                  {option}
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setReportModal({ isOpen: false, targetId: null, type: null })} style={{ flex: 1, padding: '12px', backgroundColor: 'var(--surface-hover)', color: 'var(--text-main)', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
              <button onClick={submitReport} disabled={!reportReason || isSubmittingReport} style={{ flex: 1, padding: '12px', backgroundColor: '#EF4444', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: (!reportReason || isSubmittingReport) ? 'not-allowed' : 'pointer', opacity: (!reportReason || isSubmittingReport) ? 0.6 : 1 }}>
                {isSubmittingReport ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {lightbox.isOpen && (
        <div onClick={closeLightbox} style={{ position: 'fixed', inset: 0, zIndex: 999999, backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <button onClick={closeLightbox} style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><MdClose size={32} /></button>
          {lightbox.images.length > 1 && <button onClick={prevImage} style={{ position: 'absolute', left: '20px', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', color: 'white', padding: '10px', cursor: 'pointer' }}><MdChevronLeft size={32} /></button>}
          <img src={lightbox.images[lightbox.currentIndex]} alt="Attachment" style={{ maxWidth: '90%', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px' }} />
          {lightbox.images.length > 1 && <button onClick={nextImage} style={{ position: 'absolute', right: '20px', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', color: 'white', padding: '10px', cursor: 'pointer' }}><MdChevronRight size={32} /></button>}
        </div>
      )}

      <div style={{ backgroundColor: 'var(--surface-color)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', paddingTop: '20px' }}>
          <div style={{ padding: '0 20px' }}>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '900', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Local Feed
            </h1>
            <p style={{ margin: '4px 0 20px 0', fontSize: '13px', color: 'var(--text-muted)' }}>Discover the latest experiences and promos around you.</p>
          </div>
          
          <div className="custom-scrollbar" style={{ display: 'flex', gap: '20px', overflowX: 'auto', borderBottom: '1px solid var(--border-color)', padding: '0 20px' }}>
            {tabOptions.map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 0',
                  background: 'none',
                  color: activeTab === tab.id ? 'var(--brand-primary)' : 'var(--text-muted)',
                  border: 'none',
                  borderBottom: activeTab === tab.id ? '3px solid var(--brand-primary)' : '3px solid transparent',
                  fontWeight: '700',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'color 0.2s, border-color 0.2s',
                  whiteSpace: 'nowrap',
                  marginBottom: '-1px' 
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
        {filteredFeed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Nothing to show in this feed yet!</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {filteredFeed.map(item => {
              
              const likesCount = item.likes?.length || 0;
              const isLikedByMe = session && item.likes?.some(like => like.user_id === session.user.id);
              const isAnimating = animatingLikeId === item.id;
              const brandColor = item.stores?.theme_settings?.primaryColor || 'var(--brand-primary)';
              
              // 🚀 NEW: Render Merchant Post Card with Likes & 3-Dot Menus integrated
              if (item.feed_type === 'post') {
                return (
                  <div key={`post-${item.id}`} style={{ backgroundColor: 'var(--surface-color)', borderRadius: '16px', border: `2px solid ${brandColor}`, overflow: 'hidden', boxShadow: '0 4px 15px rgba(37,99,235,0.05)' }}>
                    <div style={{ padding: '16px', display: 'flex', gap: '12px', alignItems: 'flex-start', backgroundColor: `${brandColor}0D`, justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div onClick={() => navigate(`/store/${item.store_id}`)} style={{ cursor: 'pointer' }}>
                           <Avatar src={item.stores?.logo_url} name={item.stores?.store_name} size="44px" color={brandColor} />
                        </div>
                        <div>
                          <div style={{ fontSize: '15px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span onClick={() => navigate(`/store/${item.store_id}`)} style={{ fontWeight: '900', cursor: 'pointer' }}>{item.stores?.store_name || 'Store Update'}</span>
                          </div>
                          <div style={{ fontSize: '12px', color: brandColor, fontWeight: '800', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <MdCampaign size={16} /> Official Broadcast · {timeAgo(item.created_at)}
                          </div>
                        </div>
                      </div>
                      
                      <div style={{ position: 'relative' }}>
                        <button onClick={() => setActiveMenuId(activeMenuId === item.id ? null : item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: brandColor }}><MdMoreVert size={20} /></button>
                        {activeMenuId === item.id && (
                          <>
                            <div onClick={() => setActiveMenuId(null)} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
                            <div style={{ position: 'absolute', top: '100%', right: 0, backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, width: '120px', overflow: 'hidden' }}>
                              {session?.user?.id !== item.author_id && (
                                <button onClick={() => handleAction('report', item)} style={{ width: '100%', padding: '10px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--text-main)' }}>Report</button>
                              )}
                              {session?.user?.id === item.author_id && (
                                <button onClick={() => handleAction('delete', item)} style={{ width: '100%', padding: '10px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#DC2626' }}>Delete</button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div style={{ padding: '16px', fontSize: '15px', color: 'var(--text-main)', lineHeight: '1.6', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontWeight: '500' }}>
                      {item.content}
                    </div>

                    {item.photo_url && (
                      <div onClick={() => openLightbox([item.photo_url], 0)} style={{ width: '100%', height: '300px', backgroundImage: `url(${item.photo_url})`, backgroundSize: 'cover', backgroundPosition: 'center', cursor: 'pointer' }} />
                    )}
                    
                    <div style={{ padding: '4px 16px 16px 16px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px' }}>
                       <button 
                        onClick={() => toggleLike(item, isLikedByMe)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: isLikedByMe ? brandColor : 'var(--text-muted)', transition: 'color 0.2s', outline: 'none' }}
                       >
                         <div style={{ display: 'flex', alignItems: 'center', transform: isAnimating ? 'scale(1.4)' : 'scale(1)', transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
                           {isLikedByMe ? <VscThumbsupFilled size={20} /> : <VscThumbsup size={20} />}
                         </div>
                         <span style={{ fontSize: '13px', fontWeight: '600' }}>
                           {likesCount > 0 ? likesCount : 'Like'}
                         </span>
                       </button>
                       <button onClick={() => navigate(`/store/${item.store_id}`)} style={{ padding: '8px 16px', backgroundColor: 'var(--surface-hover)', color: brandColor, border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>Visit Store</button>
                    </div>
                  </div>
                );
              }

              // 🌟 Render Standard Review Card
              return (
                <div key={`review-${item.id}`} style={{ backgroundColor: 'var(--surface-color)', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
                  
                  <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <div onClick={() => navigate(`/user/${item.author_id}`)} style={{ cursor: 'pointer', zIndex: 2 }}>
                        <Avatar src={item.reviewer_avatar} name={item.reviewer_name} size="44px" color={brandColor} />
                      </div>
                      <div>
                        <div style={{ fontSize: '14.5px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                          <span 
                            onClick={() => navigate(`/user/${item.author_id}`)} 
                            style={{ fontWeight: '800', cursor: 'pointer' }}
                          >
                            {item.reviewer_name || 'LocalLook User'}
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '13.5px' }}>is at</span>
                          <span 
                            onClick={(e) => { e.stopPropagation(); navigate(`/store/${item.store_id}`); }}
                            style={{ color: 'var(--text-main)', fontWeight: '800', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                            onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
                            onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                          >
                            {item.stores?.store_name || 'Unknown Store'}
                          </span>
                        </div>
                        <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontWeight: '500', marginTop: '2px' }}>
                          {timeAgo(item.created_at)}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '4px 8px', borderRadius: '12px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '800', color: '#F59E0B' }}>{item.rating.toFixed(1)}</span>
                        <MdStar size={14} color="#F59E0B" />
                      </div>

                      <div style={{ position: 'relative' }}>
                        <button onClick={() => setActiveMenuId(activeMenuId === item.id ? null : item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-muted)' }}><MdMoreVert size={20} /></button>
                        {activeMenuId === item.id && (
                          <>
                            <div onClick={() => setActiveMenuId(null)} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
                            <div style={{ position: 'absolute', top: '100%', right: 0, backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, width: '120px', overflow: 'hidden' }}>
                              {session?.user?.id !== item.author_id && (
                                <button onClick={() => handleAction('report', item)} style={{ width: '100%', padding: '10px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--text-main)' }}>Report</button>
                              )}
                              {session?.user?.id === item.author_id && (
                                <button onClick={() => handleAction('delete', item)} style={{ width: '100%', padding: '10px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#DC2626', borderTop: '1px solid var(--border-color)' }}>Delete</button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                  </div>

                  {item.comment && (
                    <div style={{ padding: '0 16px 12px 16px', fontSize: '14px', color: 'var(--text-main)', lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-word', position: 'relative', zIndex: 2 }}>
                      {item.comment}
                    </div>
                  )}

                  {item.photo_urls && item.photo_urls.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: item.photo_urls.length === 1 ? '1fr' : '1fr 1fr', gap: '2px', maxHeight: '300px', overflow: 'hidden', marginBottom: '8px', position: 'relative', zIndex: 2 }}>
                      {item.photo_urls.slice(0, 4).map((url, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => openLightbox(item.photo_urls, idx)}
                          style={{ 
                            height: item.photo_urls.length === 1 ? '300px' : '150px', 
                            backgroundImage: `url(${url})`, 
                            backgroundSize: 'cover', 
                            backgroundPosition: 'center', 
                            cursor: 'pointer',
                            position: 'relative'
                          }}
                        >
                          {idx === 3 && item.photo_urls.length > 4 && (
                            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontWeight: 'bold', fontSize: '20px' }}>
                              +{item.photo_urls.length - 4}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ padding: '4px 16px 16px 16px', display: 'flex', alignItems: 'center', position: 'relative', zIndex: 2 }}>
                    <button 
                      onClick={() => toggleLike(item, isLikedByMe)}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        background: 'none', 
                        border: 'none', 
                        padding: 0, 
                        cursor: 'pointer', 
                        color: isLikedByMe ? 'var(--brand-primary)' : 'var(--text-muted)', 
                        transition: 'color 0.2s', 
                        outline: 'none' 
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        transform: isAnimating ? 'scale(1.4)' : 'scale(1)',
                        transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                      }}>
                        {isLikedByMe ? <VscThumbsupFilled size={20} /> : <VscThumbsup size={20} />}
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: '600' }}>
                        {likesCount > 0 ? likesCount : 'Like'}
                      </span>
                    </button>
                  </div>

                  {item.owner_reply && (
                    <>
                      <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '0 0 16px 0' }} />
                      
                      <div style={{ padding: '0 16px 16px 16px' }}>
                        <div style={{ 
                          backgroundColor: 'var(--bg-color)', 
                          padding: '16px', 
                          borderRadius: '16px', 
                          border: '1px solid var(--border-color)', 
                          position: 'relative', 
                          zIndex: 2,
                          boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            
                            <div style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              backgroundColor: `${brandColor}15`,
                              display: 'flex',
                              justifyContent: 'center',
                              alignItems: 'center',
                              flexShrink: 0
                            }}>
                              <MdStorefront size={16} color={brandColor} />
                            </div>

                            <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main)' }}>Response from {item.stores?.store_name || 'Owner'}</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>· {timeAgo(item.owner_reply_created_at)}</span>
                          </div>
                          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                            {item.owner_reply}
                          </p>
                        </div>
                      </div>
                    </>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}