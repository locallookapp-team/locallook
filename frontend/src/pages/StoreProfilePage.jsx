import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient'; 
import { 
  MdArrowBack, MdLocationOn, MdPhone, MdEmail, MdLanguage, 
  MdStar, MdStarBorder, MdAccessTime, MdSend, MdImage, 
  MdClose, MdMoreVert, MdChevronLeft, MdChevronRight, MdExpandMore,
  MdFlag, MdStorefront
} from 'react-icons/md';
import { VscThumbsup, VscThumbsupFilled } from 'react-icons/vsc';

const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) 
  ? import.meta.env.VITE_API_URL 
  : 'https://locallook-api.onrender.com';

const getStoreCoverImage = (store) => {
  if (store.cover_image_url) return store.cover_image_url;
  switch (store.store_category) {
    case 'Food & Dining': return 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80';
    case 'Retail': return 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&q=80';
    case 'Services': return 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1200&q=80';
    case 'Groceries': return 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&q=80';
    case 'Health': return 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=1200&q=80';
    default: return 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80';
  }
};

const timeAgo = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.round((now - date) / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);
  const months = Math.round(days / 30);
  const years = Math.round(days / 365);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes} mins ago`;
  if (hours < 24) return `${hours} hours ago`;
  if (days < 30) return `${days} days ago`;
  if (months < 12) return `${months} months ago`;
  return `${years} years ago`;
};

const Avatar = ({ src, name, size, color }) => {
  const [error, setError] = useState(false);
  
  if (!src || error) {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', backgroundColor: '#EFF6FF', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: '800', color: color || '#2563EB', flexShrink: 0, overflow: 'hidden', fontSize: `${parseInt(size)/2.5}px` }}>
        {(name || 'U').charAt(0).toUpperCase()}
      </div>
    );
  }
  
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', backgroundColor: '#EFF6FF', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0, overflow: 'hidden' }}>
      <img src={src} alt="avatar" onError={() => setError(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  );
};

export default function StoreProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const reviewFormRef = useRef(null);
  
  const [session, setSession] = useState(null);
  const [store, setStore] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [reviews, setReviews] = useState([]);
  const [visibleCount, setVisibleCount] = useState(5);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [filterRating, setFilterRating] = useState('All'); 
  
  const [animatingLikeId, setAnimatingLikeId] = useState(null);
  
  const [reviewPhotos, setReviewPhotos] = useState([]); 
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [activeMenuId, setActiveMenuId] = useState(null);

  const [reportModal, setReportModal] = useState({ isOpen: false, reviewId: null });
  const [reportReason, setReportReason] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const [lightbox, setLightbox] = useState({ isOpen: false, images: [], currentIndex: 0 });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));

    const fetchStoreData = async () => {
      try {
        const storeRes = await fetch(`${API_BASE_URL}/api/stores/${id}`);
        if (!storeRes.ok) throw new Error("Store not found");
        const storeData = await storeRes.json();
        setStore(storeData);

        const itemsRes = await fetch(`${API_BASE_URL}/api/stores/${id}/items`);
        if (itemsRes.ok) setItems(await itemsRes.json());

        await fetchReviews();
      } catch (err) {
        console.error("Error fetching store:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStoreData();
  }, [id]);

  const fetchReviews = async () => {
    const { data, error } = await supabase
      .from('reviews')
      .select('id, rating, comment, photo_urls, created_at, user_id, reviewer_name, reviewer_avatar, owner_reply, owner_reply_created_at, review_likes ( user_id )')
      .eq('store_id', id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setReviews(data);
      setVisibleCount(data.length <= 10 ? data.length : 5);
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

    setReviews(prevReviews => prevReviews.map(review => {
      if (review.id === reviewId) {
        const newLikes = isCurrentlyLiked 
          ? (review.review_likes || []).filter(like => like.user_id !== userId) 
          : [...(review.review_likes || []), { user_id: userId }]; 
        return { ...review, review_likes: newLikes };
      }
      return review;
    }));

    try {
      if (isCurrentlyLiked) {
        await supabase.from('review_likes').delete().match({ review_id: reviewId, user_id: userId });
      } else {
        await supabase.from('review_likes').insert([{ review_id: reviewId, user_id: userId }]);
        
        const targetReview = reviews.find(r => r.id === reviewId);
        
        if (targetReview && targetReview.user_id !== userId) {
          const storeName = store?.store_name || 'a store';
          const actionUrl = `/store/${id}`;
          
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
      fetchReviews();
    }
  };

  const handlePhotoSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + reviewPhotos.length > 4) {
      return alert("You can only attach a maximum of 4 photos per review.");
    }
    setReviewPhotos(prev => [...prev, ...files]);
  };

  const removePhoto = (index) => {
    setReviewPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!session) return navigate('/login');
    if (rating === 0) return alert("Please select a star rating.");

    setIsSubmittingReview(true);
    try {
      let finalPhotoUrls = [];
      
      const existingUrls = reviewPhotos.filter(item => typeof item === 'string');
      const newFiles = reviewPhotos.filter(item => typeof item !== 'string');

      finalPhotoUrls = [...existingUrls];

      if (newFiles.length > 0) {
        for (const file of newFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${session.user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          const { error: uploadError } = await supabase.storage.from('review-photos').upload(fileName, file);
          if (uploadError) throw uploadError;
          
          const { data: { publicUrl } } = supabase.storage.from('review-photos').getPublicUrl(fileName);
          finalPhotoUrls.push(publicUrl);
        }
      }

      const fallbackName = session.user.email?.split('@')[0] || 'LocalLook User';
      const displayName = session.user.user_metadata?.full_name || fallbackName;

      if (editingReviewId) {
        const { error } = await supabase.from('reviews')
          .update({ 
            rating, 
            comment: comment.trim() || null,
            photo_urls: finalPhotoUrls 
          })
          .eq('id', editingReviewId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('reviews').insert([{
          store_id: id,
          user_id: session.user.id,
          reviewer_name: displayName,
          reviewer_avatar: session.user.user_metadata?.avatar_url || null,
          rating: rating,
          comment: comment.trim() || null,
          photo_urls: finalPhotoUrls
        }]);
        if (error) throw error;
      }

      setRating(0);
      setComment('');
      setReviewPhotos([]);
      setEditingReviewId(null);
      await fetchReviews(); 
    } catch (err) {
      alert("Failed to submit review: " + err.message);
    } finally {
      setIsSubmittingReview(false);
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
      if (!error) fetchReviews();
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

  if (loading) return <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>Loading...</div>;
  if (!store) return <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}><h2>Store not found</h2></div>;

  const theme = store.theme_settings || {};
  const brandColor = theme.primaryColor || '#2563EB';

  const totalReviews = reviews.length;
  const averageRating = totalReviews > 0 ? (reviews.reduce((a, c) => a + c.rating, 0) / totalReviews).toFixed(1) : '0.0';
  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  reviews.forEach(r => distribution[r.rating]++);

  const filteredReviews = filterRating === 'All' 
    ? reviews 
    : reviews.filter(r => Math.round(r.rating) === filterRating);

  const displayedReviews = filteredReviews.slice(0, visibleCount);

  const reportOptions = [
    "Spam or fake review",
    "Inappropriate or offensive language",
    "Hate speech or harassment",
    "Contains personal or private information",
    "Irrelevant to this business"
  ];

  return (
    <div style={{ height: '100%', overflowY: 'auto', width: '100%', backgroundColor: '#F8FAFC', fontFamily: 'Inter, sans-serif' }}>
      
      {reportModal.isOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999999, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '24px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MdFlag color="#EF4444" /> Report Review
              </h3>
              <button onClick={() => setReportModal({ isOpen: false, reviewId: null })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><MdClose size={24} /></button>
            </div>
            
            <p style={{ color: '#64748B', fontSize: '14px', marginBottom: '20px' }}>Why are you reporting this review? Your report is anonymous.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              {reportOptions.map(option => (
                <label key={option} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#475569', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="reportReason" 
                    value={option} 
                    checked={reportReason === option}
                    onChange={(e) => setReportReason(e.target.value)}
                    style={{ accentColor: brandColor, width: '16px', height: '16px' }}
                  />
                  {option}
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setReportModal({ isOpen: false, reviewId: null })} style={{ flex: 1, padding: '12px', backgroundColor: '#F1F5F9', color: '#475569', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
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
          
          {lightbox.images.length > 1 && (
            <button onClick={prevImage} style={{ position: 'absolute', left: '20px', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', color: 'white', padding: '10px', cursor: 'pointer' }}><MdChevronLeft size={32} /></button>
          )}
          
          <img src={lightbox.images[lightbox.currentIndex]} alt="Review Attachment" style={{ maxWidth: '90%', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px' }} />
          
          {lightbox.images.length > 1 && (
            <button onClick={nextImage} style={{ position: 'absolute', right: '20px', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', color: 'white', padding: '10px', cursor: 'pointer' }}><MdChevronRight size={32} /></button>
          )}
        </div>
      )}

      <div style={{ height: '320px', width: '100%', backgroundImage: `url(${getStoreCoverImage(store)})`, backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 50%)' }} />
        <button onClick={() => navigate(-1)} style={{ position: 'absolute', top: '25px', left: '25px', backgroundColor: 'rgba(255, 255, 255, 0.2)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.4)', color: 'white', padding: '10px 20px', borderRadius: '24px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', zIndex: 10 }}>
          <MdArrowBack size={18} /> Back
        </button>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '30px 20px', textAlign: 'center' }}>
        <h1 style={{ margin: '0 0 5px 0', fontSize: '32px', fontWeight: '900', color: '#0F172A' }}>{store.store_name}</h1>
        <p style={{ margin: '0 0 15px 0', fontSize: '15px', color: '#64748B', fontWeight: '600' }}>{store.store_category}</p>
        {store.description && <p style={{ margin: '0 auto 25px auto', maxWidth: '600px', color: '#475569', fontSize: '15px', lineHeight: '1.6', wordBreak: 'break-word' }}>{store.description}</p>}

        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '25px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', backgroundColor: store.is_open ? '#D1FAE5' : '#FEE2E2', color: store.is_open ? '#059669' : '#DC2626', borderRadius: '20px', fontSize: '13px', fontWeight: '700' }}>
            <MdAccessTime size={16} /> {store.is_open ? 'Open now' : 'Closed'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', backgroundColor: '#FFFBEB', border: '1px solid #FEF3C7', color: '#D97706', borderRadius: '20px', fontSize: '13px', fontWeight: '700' }}>
            <MdStar size={16} /> {totalReviews > 0 ? `${averageRating} / 5.0 (${totalReviews} Reviews)` : 'New - No Reviews Yet'}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '40px' }}>
          {theme.showAddress && <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', fontSize: '13px', color: '#475569', fontWeight: '600' }}><MdLocationOn size={16} color="#94A3B8" /> {theme.addressText}</div>}
          {theme.showPhone && <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', fontSize: '13px', color: '#475569', fontWeight: '600' }}><MdPhone size={16} color="#94A3B8" /> {store.phone}</div>}
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 20px 40px 20px' }}>
        {items.length > 0 && (
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A', marginBottom: '20px' }}>Menu & Catalog</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
              {items.map(item => (
                <div key={item.id} style={{ backgroundColor: 'white', borderRadius: '16px', overflow: 'hidden', border: '1px solid #E2E8F0', boxShadow: '0 4px 15px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column' }}>
                  {item.image_url ? (
                    <div style={{ height: '160px', backgroundImage: `url(${item.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#F1F5F9' }} />
                  ) : (
                    <div style={{ height: '160px', backgroundColor: '#F1F5F9', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '40px' }}>🍽️</div>
                  )}
                  <div style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '6px' }}>
                      <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>{item.item_name}</h4>
                      <span style={{ fontSize: '15px', fontWeight: '800', color: brandColor, whiteSpace: 'nowrap' }}>₱{parseFloat(item.price).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 20px 60px 20px' }}>
        <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', border: '1px solid #E2E8F0' }}>
          
          <h2 style={{ margin: '0 0 30px 0', fontSize: '24px', fontWeight: '900', color: '#0F172A' }}>Reviews</h2>

          {totalReviews > 0 && (
            <div style={{ display: 'flex', gap: '40px', alignItems: 'center', marginBottom: '40px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '120px' }}>
                <div style={{ fontSize: '48px', fontWeight: '900', color: '#0F172A', lineHeight: '1' }}>{averageRating}</div>
                <div style={{ display: 'flex', margin: '8px 0' }}>
                  {[1, 2, 3, 4, 5].map(star => <MdStar key={star} size={18} color={star <= Math.round(averageRating) ? brandColor : '#E2E8F0'} />)}
                </div>
                <div style={{ fontSize: '13px', color: '#64748B', fontWeight: '600' }}>{totalReviews} ratings</div>
              </div>

              <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[5, 4, 3, 2, 1].map(star => {
                  const count = distribution[star];
                  const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
                  return (
                    <div key={star} style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#475569', minWidth: '20px' }}>{star}</span>
                      <div style={{ flexGrow: 1, height: '8px', backgroundColor: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${percentage}%`, height: '100%', backgroundColor: brandColor, borderRadius: '4px' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {totalReviews > 0 && (
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '30px', scrollbarWidth: 'none' }}>
              {['All', 5, 4, 3, 2, 1].map(val => (
                <button
                  key={val}
                  onClick={() => { setFilterRating(val); setVisibleCount(5); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '20px',
                    backgroundColor: filterRating === val ? brandColor : 'white',
                    color: filterRating === val ? 'white' : '#64748B',
                    border: filterRating === val ? `1px solid ${brandColor}` : '1px solid #E2E8F0',
                    fontWeight: '700', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s'
                  }}
                >
                  <MdStar size={16} /> {val === 'All' ? 'All' : val}
                </button>
              ))}
            </div>
          )}

          <div ref={reviewFormRef} style={{ backgroundColor: '#F8FAFC', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', marginBottom: '30px' }}>
            {!session ? (
              <div style={{ textAlign: 'center' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#0F172A', fontWeight: '800' }}>Want to leave a review?</h4>
                <button onClick={() => navigate('/login')} style={{ padding: '10px 24px', backgroundColor: brandColor, color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Sign In to Review</button>
              </div>
            ) : (
              <form onSubmit={handleSubmitReview}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ margin: 0, fontSize: '15px', color: '#0F172A', fontWeight: '800' }}>{editingReviewId ? 'Edit your review' : 'Rate your experience'}</h4>
                  {editingReviewId && (
                    <button type="button" onClick={() => { setEditingReviewId(null); setRating(0); setComment(''); setReviewPhotos([]); }} style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel Edit</button>
                  )}
                </div>
                
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} type="button" onClick={() => setRating(star)} onMouseEnter={() => setHoverRating(star)} onMouseLeave={() => setHoverRating(0)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                      {star <= (hoverRating || rating) ? <MdStar size={32} color={brandColor} /> : <MdStarBorder size={32} color="#CBD5E1" />}
                    </button>
                  ))}
                </div>

                <div style={{ position: 'relative', marginBottom: '12px' }}>
                  <textarea 
                    placeholder="Share details of your own experience at this place..." 
                    value={comment} 
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.split('\n').length <= 6) {
                        setComment(val);
                      }
                    }} 
                    maxLength={500} 
                    style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #CBD5E1', boxSizing: 'border-box', minHeight: '100px', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical', outlineColor: brandColor }} 
                  />
                  <div style={{ position: 'absolute', bottom: '8px', right: '12px', fontSize: '11px', color: '#94A3B8', fontWeight: '600' }}>
                    {comment.length}/500
                  </div>
                </div>

                {reviewPhotos.length > 0 && (
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
                    {reviewPhotos.map((item, idx) => {
                      const previewUrl = typeof item === 'string' ? item : URL.createObjectURL(item);
                      return (
                        <div key={idx} style={{ position: 'relative', width: '60px', height: '60px', borderRadius: '8px', backgroundImage: `url(${previewUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', border: '1px solid #E2E8F0' }}>
                          <button type="button" onClick={() => removePhoto(idx)} style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#EF4444', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }}><MdClose size={12} /></button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: brandColor, fontWeight: '700', fontSize: '13px', cursor: reviewPhotos.length >= 4 ? 'not-allowed' : 'pointer', padding: '8px 12px', backgroundColor: 'rgba(37,99,235,0.05)', borderRadius: '8px', opacity: reviewPhotos.length >= 4 ? 0.6 : 1 }}>
                    <MdImage size={18} /> {reviewPhotos.length >= 4 ? 'Max 4 Photos' : 'Add Photos'}
                    <input type="file" multiple accept="image/*" onChange={handlePhotoSelect} style={{ display: 'none' }} disabled={isSubmittingReview || reviewPhotos.length >= 4} />
                  </label>

                  <button type="submit" disabled={isSubmittingReview || rating === 0} style={{ padding: '12px 24px', backgroundColor: rating === 0 ? '#94A3B8' : brandColor, color: 'white', border: 'none', borderRadius: '10px', fontWeight: '800', fontSize: '14px', cursor: isSubmittingReview || rating === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isSubmittingReview ? 'Posting...' : <><MdSend size={16} /> {editingReviewId ? 'Update Review' : 'Post Review'}</>}
                  </button>
                </div>
              </form>
            )}
          </div>

          <div style={{ height: '1px', backgroundColor: '#E2E8F0', margin: '0 0 30px 0' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            {displayedReviews.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#94A3B8', fontSize: '14px' }}>
                {filterRating === 'All' ? 'No reviews yet. Be the first to review this place!' : `No ${filterRating}-star reviews yet.`}
              </div>
            ) : (
              displayedReviews.map(review => {
                const likesCount = review.review_likes?.length || 0;
                const isLikedByMe = session && review.review_likes?.some(like => like.user_id === session.user.id);
                const isAnimating = animatingLikeId === review.id;

                return (
                  <div key={review.id} style={{ paddingBottom: '20px', borderBottom: '1px solid #F1F5F9', position: 'relative' }}>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div 
                        onClick={() => navigate(`/user/${review.user_id}`)} 
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                      >
                        <Avatar src={review.reviewer_avatar} name={review.reviewer_name} size="44px" color={brandColor} />
                        <div>
                          <div style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>{review.reviewer_name || 'LocalLook User'}</div>
                          <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '600' }}>{timeAgo(review.created_at)}</div>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>{review.rating.toFixed(1)}</span>
                          <div style={{ display: 'flex' }}>{[...Array(5)].map((_, i) => <MdStar key={i} size={16} color={i < review.rating ? brandColor : '#E2E8F0'} />)}</div>
                        </div>
                        
                        <div style={{ position: 'relative' }}>
                          <button onClick={() => setActiveMenuId(activeMenuId === review.id ? null : review.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#94A3B8' }}><MdMoreVert size={20} /></button>
                          {activeMenuId === review.id && (
                            <>
                              <div onClick={() => setActiveMenuId(null)} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
                              <div style={{ position: 'absolute', top: '100%', right: 0, backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, width: '120px', overflow: 'hidden' }}>
                                <button onClick={() => handleAction('report', review)} style={{ width: '100%', padding: '10px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#475569' }}>Report</button>
                                {session?.user?.id === review.user_id && (
                                  <button onClick={() => handleAction('delete', review)} style={{ width: '100%', padding: '10px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#DC2626', borderTop: '1px solid #F1F5F9' }}>Delete</button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {review.comment && (
                      <p style={{ 
                        margin: '0 0 16px 0', 
                        fontSize: '15px', 
                        color: '#475569', 
                        lineHeight: '1.6',
                        whiteSpace: 'pre-wrap', 
                        wordBreak: 'break-word' 
                      }}>
                        {review.comment}
                      </p>
                    )}
                    
                  {review.photo_urls && review.photo_urls.length > 0 && (
                    <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '10px' }}>
                      {review.photo_urls.map((url, idx) => (
                        <div key={idx} onClick={() => openLightbox(review.photo_urls, idx)} style={{ width: '80px', height: '80px', borderRadius: '12px', backgroundImage: `url(${url})`, backgroundSize: 'cover', backgroundPosition: 'center', cursor: 'pointer', flexShrink: 0, border: '1px solid #E2E8F0' }} />
                      ))}
                    </div>
                  )}

                  <div style={{ padding: '4px 0 16px 0', display: 'flex', alignItems: 'center' }}>
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
                        color: isLikedByMe ? '#2563EB' : '#64748B', 
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
                      <div style={{ height: '1px', backgroundColor: '#E2E8F0', margin: '0 0 16px 0' }} />
                      
                      <div style={{ padding: '0' }}>
                        <div style={{ 
                          backgroundColor: '#F8FAFC', 
                          padding: '16px', 
                          borderRadius: '16px', 
                          border: '1px solid #E2E8F0', 
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
                            <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>Response from {store?.store_name || 'Owner'}</span>
                            <span style={{ fontSize: '11px', color: '#94A3B8' }}>· {timeAgo(review.owner_reply_created_at)}</span>
                          </div>
                          <p style={{ margin: 0, fontSize: '14px', color: '#475569', lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {review.owner_reply}
                          </p>
                        </div>
                      </div>
                    </>
                  )}

                  </div>
                );
              })
            )}
          </div>

          {filteredReviews.length > visibleCount && (
            <div style={{ paddingTop: '10px', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'flex-start' }}>
              <button 
                onClick={() => setVisibleCount(prev => prev + 5)}
                style={{ background: 'none', border: 'none', padding: 0, color: brandColor, fontWeight: '800', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                Read more reviews <MdExpandMore size={20} />
              </button>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}