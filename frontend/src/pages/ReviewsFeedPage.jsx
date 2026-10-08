import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
  MdStar, 
  MdStorefront, 
  MdClose,
  MdChevronLeft,
  MdChevronRight,
  MdPeople,
  MdMoreVert,
  MdFlag
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
      <img src={src} alt="avatar" onError={() => setError(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  );
};

export default function ReviewsFeedPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [animatingLikeId, setAnimatingLikeId] = useState(null);
  const [lightbox, setLightbox] = useState({ isOpen: false, images: [], currentIndex: 0 });

  const [activeMenuId, setActiveMenuId] = useState(null);
  const [reportModal, setReportModal] = useState({ isOpen: false, reviewId: null });
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
      const { data, error } = await supabase
        .from('reviews')
        .select(`
        id, rating, comment, photo_urls, created_at, user_id, reviewer_name, reviewer_avatar, owner_reply, owner_reply_created_at,
        store_id,
        stores ( store_name, theme_settings ),
        review_likes ( user_id )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFeed(data || []);
    } catch (err) {
      console.error("Error fetching feed:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleLike = async (reviewId, isCurrentlyLiked) => {
    if (!session) {
      navigate('/login');
      return;
    }

    const userId = session.user.id;

    if (!isCurrentlyLiked) {
      setAnimatingLikeId(reviewId);
      setTimeout(() => setAnimatingLikeId(null), 300); 
    }

    setFeed(prevFeed => prevFeed.map(review => {
      if (review.id === reviewId) {
        const newLikes = isCurrentlyLiked 
          ? review.review_likes.filter(like => like.user_id !== userId) 
          : [...review.review_likes, { user_id: userId }]; 
        return { ...review, review_likes: newLikes };
      }
      return review;
    }));

    try {
      if (isCurrentlyLiked) {
        await supabase.from('review_likes').delete().match({ review_id: reviewId, user_id: userId });
      } else {
        await supabase.from('review_likes').insert([{ review_id: reviewId, user_id: userId }]);
        
        const targetReview = feed.find(r => r.id === reviewId);
        
        if (targetReview && targetReview.user_id !== userId) {
          const storeName = targetReview.stores?.store_name || 'a store';
          const actionUrl = `/store/${targetReview.store_id}`;
          
          const totalLikes = (targetReview.review_likes?.length || 0) + 1;
          const messageText = totalLikes > 1 
            ? `${totalLikes} locals liked your review for ${storeName}.`
            : `1 local liked your review for ${storeName}.`;
          
          const { data: existingNotifs } = await supabase
            .from('notifications')
            .select('id, message')
            .eq('user_id', targetReview.user_id)
            .eq('type', 'social_like')
            .eq('action_url', actionUrl)
            .order('created_at', { ascending: false })
            .limit(1);

          const existingNotif = existingNotifs && existingNotifs.length > 0 ? existingNotifs[0] : null;

          if (existingNotif) {
            await supabase.from('notifications').update({
              message: messageText,
              created_at: new Date().toISOString(), 
              is_read: false 
            }).eq('id', existingNotif.id);
          } else {
            await supabase.from('notifications').insert([{
              user_id: targetReview.user_id,
              title: 'New Like!',
              message: messageText,
              type: 'social_like',
              action_url: actionUrl
            }]);
          }
        }
      }
    } catch (err) {
      console.error("Error toggling like:", err);
      fetchFeed();
    }
  };

  const handleAction = async (action, review) => {
    setActiveMenuId(null);
    if (action === 'report') {
      if (!session) return navigate('/login');
      setReportModal({ isOpen: true, reviewId: review.id });
      setReportReason('');
    } else if (action === 'delete') {
      if (!window.confirm("Are you sure you want to delete this review?")) return;
      const { error } = await supabase.from('reviews').delete().eq('id', review.id);
      if (!error) fetchFeed(); 
    }
  };

  const submitReport = async () => {
    if (!reportReason) return alert("Please select a reason for reporting.");
    setIsSubmittingReport(true);

    try {
      const { error } = await supabase.from('reported_reviews').insert([{
        review_id: reportModal.reviewId,
        reporter_id: session.user.id,
        reason: reportReason
      }]);

      if (error) {
        if (error.code === '23505') { 
          alert("You have already reported this review.");
        } else {
          throw error;
        }
      } else {
        alert("Report submitted successfully. Our team will review this shortly.");
      }

      setReportModal({ isOpen: false, reviewId: null });
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
    "Spam or fake review",
    "Inappropriate or offensive language",
    "Hate speech or harassment",
    "Contains personal or private information",
    "Irrelevant to this business"
  ];

  return (
    <div style={{ height: '100%', overflowY: 'auto', backgroundColor: 'var(--bg-color)', padding: '0', fontFamily: 'var(--font-main)' }}>
      
      {reportModal.isOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999999, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--surface-color)', padding: '30px', borderRadius: '24px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MdFlag color="#EF4444" /> Report Review
              </h3>
              <button onClick={() => setReportModal({ isOpen: false, reviewId: null })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><MdClose size={24} /></button>
            </div>
            
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px' }}>Why are you reporting this review? Your report is anonymous.</p>
            
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
              <button onClick={() => setReportModal({ isOpen: false, reviewId: null })} style={{ flex: 1, padding: '12px', backgroundColor: 'var(--surface-hover)', color: 'var(--text-main)', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
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
          <img src={lightbox.images[lightbox.currentIndex]} alt="Review Attachment" style={{ maxWidth: '90%', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px' }} />
          {lightbox.images.length > 1 && <button onClick={nextImage} style={{ position: 'absolute', right: '20px', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', color: 'white', padding: '10px', cursor: 'pointer' }}><MdChevronRight size={32} /></button>}
        </div>
      )}

      <div style={{ backgroundColor: 'var(--surface-color)', padding: '20px', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MdPeople color="var(--brand-primary)" size={24} /> Community Feed
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>Discover the latest experiences around you.</p>
        </div>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
        {feed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No reviews yet. Be the first to share your experience!</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {feed.map(review => {
              const likesCount = review.review_likes?.length || 0;
              const isLikedByMe = session && review.review_likes?.some(like => like.user_id === session.user.id);
              const isAnimating = animatingLikeId === review.id;
              
              const brandColor = review.stores?.theme_settings?.primaryColor || 'var(--brand-primary)';
              
              return (
                <div key={review.id} style={{ backgroundColor: 'var(--surface-color)', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
                  
                  <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <div onClick={() => navigate(`/user/${review.user_id}`)} style={{ cursor: 'pointer', zIndex: 2 }}>
                        <Avatar src={review.reviewer_avatar} name={review.reviewer_name} size="44px" color={brandColor} />
                      </div>
                      <div>
                        <div style={{ fontSize: '14.5px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                          <span 
                            onClick={() => navigate(`/user/${review.user_id}`)} 
                            style={{ fontWeight: '800', cursor: 'pointer' }}
                          >
                            {review.reviewer_name || 'LocalLook User'}
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '13.5px' }}>is at</span>
                          <span 
                            onClick={(e) => { e.stopPropagation(); navigate(`/store/${review.store_id}`); }}
                            style={{ color: 'var(--text-main)', fontWeight: '800', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                            onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
                            onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                          >
                            {review.stores?.store_name || 'Unknown Store'}
                          </span>
                        </div>
                        <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontWeight: '500', marginTop: '2px' }}>
                          {timeAgo(review.created_at)}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '4px 8px', borderRadius: '12px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '800', color: '#F59E0B' }}>{review.rating.toFixed(1)}</span>
                        <MdStar size={14} color="#F59E0B" />
                      </div>

                      <div style={{ position: 'relative' }}>
                        <button onClick={() => setActiveMenuId(activeMenuId === review.id ? null : review.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-muted)' }}><MdMoreVert size={20} /></button>
                        {activeMenuId === review.id && (
                          <>
                            <div onClick={() => setActiveMenuId(null)} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
                            <div style={{ position: 'absolute', top: '100%', right: 0, backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, width: '120px', overflow: 'hidden' }}>
                              <button onClick={() => handleAction('report', review)} style={{ width: '100%', padding: '10px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--text-main)' }}>Report</button>
                              {session?.user?.id === review.user_id && (
                                <button onClick={() => handleAction('delete', review)} style={{ width: '100%', padding: '10px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#DC2626', borderTop: '1px solid var(--border-color)' }}>Delete</button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                  </div>

                  {review.comment && (
                    <div style={{ padding: '0 16px 12px 16px', fontSize: '14px', color: 'var(--text-main)', lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-word', position: 'relative', zIndex: 2 }}>
                      {review.comment}
                    </div>
                  )}

                  {review.photo_urls && review.photo_urls.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: review.photo_urls.length === 1 ? '1fr' : '1fr 1fr', gap: '2px', maxHeight: '300px', overflow: 'hidden', marginBottom: '8px', position: 'relative', zIndex: 2 }}>
                      {review.photo_urls.slice(0, 4).map((url, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => openLightbox(review.photo_urls, idx)}
                          style={{ 
                            height: review.photo_urls.length === 1 ? '300px' : '150px', 
                            backgroundImage: `url(${url})`, 
                            backgroundSize: 'cover', 
                            backgroundPosition: 'center', 
                            cursor: 'pointer',
                            position: 'relative'
                          }}
                        >
                          {idx === 3 && review.photo_urls.length > 4 && (
                            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontWeight: 'bold', fontSize: '20px' }}>
                              +{review.photo_urls.length - 4}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ padding: '4px 16px 16px 16px', display: 'flex', alignItems: 'center', position: 'relative', zIndex: 2 }}>
                    <button 
                      onClick={() => toggleLike(review.id, isLikedByMe)}
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

                  {review.owner_reply && (
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

                            <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main)' }}>Response from {review.stores?.store_name || 'Owner'}</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>· {timeAgo(review.owner_reply_created_at)}</span>
                          </div>
                          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                            {review.owner_reply}
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