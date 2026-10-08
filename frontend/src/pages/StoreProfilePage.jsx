import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient'; 
import { 
  MdArrowBack, MdLocationOn, MdPhone, MdEmail, MdLanguage, 
  MdStar, MdStarBorder, MdAccessTime, MdSend, MdImage, 
  MdClose, MdMoreVert, MdChevronLeft, MdChevronRight, MdExpandMore,
  MdFlag, MdStorefront, MdRestaurantMenu, MdVisibility
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
      <div style={{ width: '100%', height: '100%', backgroundColor: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: '900', color: color || '#2563EB', fontSize: `${parseInt(size)/2.5}px` }}>
        {(name || 'U').charAt(0).toUpperCase()}
      </div>
    );
  }
  
  return (
    <img src={src} alt="avatar" onError={() => setError(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
  );
};

export default function StoreProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // 🚀 RESTORED MISSING REF
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
  
  const [activeCategory, setActiveCategory] = useState('');

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
          .update({ rating, comment: comment.trim() || null, photo_urls: finalPhotoUrls })
          .eq('id', editingReviewId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('reviews').insert([{
          store_id: id, user_id: session.user.id, reviewer_name: displayName,
          reviewer_avatar: session.user.user_metadata?.avatar_url || null, rating: rating,
          comment: comment.trim() || null, photo_urls: finalPhotoUrls
        }]);
        if (error) throw error;
      }

      setRating(0); setComment(''); setReviewPhotos([]); setEditingReviewId(null);
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
      const { error } = await supabase.from('reported_reviews').insert([{ review_id: reportModal.reviewId, reporter_id: session.user.id, reason: reportReason }]);
      if (error && error.code === '23505') alert("You have already reported this review.");
      else if (error) throw error;
      else alert("Report submitted successfully. Our team will review this shortly.");
      setReportModal({ isOpen: false, reviewId: null });
    } catch (err) { alert("Failed to submit report: " + err.message); } finally { setIsSubmittingReport(false); }
  };

  const scrollToSection = (elementId) => {
    const el = document.getElementById(elementId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openLightbox = (images, index) => setLightbox({ isOpen: true, images, currentIndex: index });
  const closeLightbox = () => setLightbox({ isOpen: false, images: [], currentIndex: 0 });
  const nextImage = (e) => { e.stopPropagation(); setLightbox(prev => ({ ...prev, currentIndex: (prev.currentIndex + 1) % prev.images.length })); };
  const prevImage = (e) => { e.stopPropagation(); setLightbox(prev => ({ ...prev, currentIndex: (prev.currentIndex - 1 + prev.images.length) % prev.images.length })); };

  const theme = store?.theme_settings || {};
  const brandColor = theme.primaryColor || '#2563EB';

  const groupedItems = items.reduce((groups, item) => {
    const category = item.item_category || 'Uncategorized';
    if (!groups[category]) groups[category] = [];
    groups[category].push(item);
    return groups;
  }, {});

  const uniqueCats = Object.keys(groupedItems);
  const categoryOrder = theme.categoryOrder || uniqueCats;
  const activeCategories = categoryOrder.filter(c => uniqueCats.includes(c));
  uniqueCats.forEach(c => { if (!activeCategories.includes(c)) activeCategories.push(c); });

  useEffect(() => {
    if (activeCategories.length > 0 && !activeCategory) setActiveCategory(activeCategories[0]);
  }, [activeCategories.join(','), activeCategory]); 

  // Scroll Spy to automatically highlight the active sticky tab
  const handleScroll = () => {
    let currentActive = activeCategories.length > 0 ? activeCategories[0] : '';
    let minDistance = Infinity;

    activeCategories.forEach(cat => {
      const el = document.getElementById(`category-${cat}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        // Check distance to the sticky header (approx 100px from top)
        const distance = Math.abs(rect.top - 120); 
        if (distance < minDistance) {
          minDistance = distance;
          currentActive = cat;
        }
      }
    });

    if (currentActive && currentActive !== activeCategory) {
      setActiveCategory(currentActive);
    }
  };

  if (loading) return <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>Loading...</div>;
  if (!store) return <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}><h2>Store not found</h2></div>;

  const totalReviews = reviews.length;
  const averageRating = totalReviews > 0 ? (reviews.reduce((a, c) => a + c.rating, 0) / totalReviews).toFixed(1) : '0.0';
  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  reviews.forEach(r => distribution[r.rating]++);
  const filteredReviews = filterRating === 'All' ? reviews : reviews.filter(r => Math.round(r.rating) === filterRating);
  const displayedReviews = filteredReviews.slice(0, visibleCount);

  return (
    <div onScroll={handleScroll} style={{ height: '100%', overflowY: 'auto', width: '100%', backgroundColor: '#FFFFFF', fontFamily: 'Inter, sans-serif' }}>
      
      {reportModal.isOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999999, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '24px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}><MdFlag color="#EF4444" /> Report Review</h3>
              <button onClick={() => setReportModal({ isOpen: false, reviewId: null })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><MdClose size={24} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              {[ "Spam or fake review", "Inappropriate or offensive language", "Hate speech or harassment", "Contains personal or private information", "Irrelevant to this business"].map(option => (
                <label key={option} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#475569', cursor: 'pointer' }}>
                  <input type="radio" name="reportReason" value={option} checked={reportReason === option} onChange={(e) => setReportReason(e.target.value)} style={{ accentColor: brandColor, width: '16px', height: '16px' }} />
                  {option}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setReportModal({ isOpen: false, reviewId: null })} style={{ flex: 1, padding: '12px', backgroundColor: '#F1F5F9', color: '#475569', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
              <button onClick={submitReport} disabled={!reportReason || isSubmittingReport} style={{ flex: 1, padding: '12px', backgroundColor: '#EF4444', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: (!reportReason || isSubmittingReport) ? 'not-allowed' : 'pointer', opacity: (!reportReason || isSubmittingReport) ? 0.6 : 1 }}>{isSubmittingReport ? 'Submitting...' : 'Submit Report'}</button>
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

      {/* Cinematic Max-Width Header with Rounded Corners */}
      <div style={{ maxWidth: '1000px', margin: '0 auto', paddingTop: '20px', paddingBottom: '30px', paddingLeft: '20px', paddingRight: '20px', position: 'relative' }}>
        <div style={{ height: '320px', width: '100%', borderRadius: '24px', overflow: 'hidden', backgroundImage: `url(${getStoreCoverImage(store)})`, backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative' }}>
          
          {/* Gradient Overlay for Text Visibility */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,23,42,0.95) 0%, rgba(15,23,42,0.3) 60%, transparent 100%)' }} />
          
          <button onClick={() => navigate(-1)} style={{ position: 'absolute', top: '20px', left: '20px', backgroundColor: 'rgba(255, 255, 255, 0.2)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.4)', color: 'white', padding: '10px 20px', borderRadius: '24px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', zIndex: 10 }}>
            <MdArrowBack size={18} /> Back
          </button>

          {/* Integrated Store Details at the bottom of the Cover */}
          <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', padding: '25px', display: 'flex', alignItems: 'flex-end', gap: '20px' }}>
            {/* Shift text block right to clear the floating avatar */}
            <div style={{ paddingLeft: '180px', color: 'white', width: '100%' }}>
              <h1 style={{ margin: '0 0 6px 0', fontSize: '36px', fontWeight: '900', textShadow: '0 2px 4px rgba(0,0,0,0.5)', lineHeight: '1.1' }}>{store.store_name}</h1>
              <p style={{ margin: '0 0 14px 0', fontSize: '15px', color: '#E2E8F0', fontWeight: '600' }}>{store.store_category}</p>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap', fontSize: '13px', fontWeight: '500', color: '#F8FAFC' }}>
                {theme.showAddress && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MdLocationOn size={16} /> {theme.addressText || 'Location not set'}</span>}
                
                {/* Clickable Reviews Stat */}
                <button onClick={() => scrollToSection('reviews-section')} style={{ background: 'none', border: 'none', color: 'white', padding: 0, margin: 0, fontSize: '13px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', outline: 'none' }}>
                  <MdStar size={16} color="#F59E0B" /> {totalReviews > 0 ? `${averageRating} (${totalReviews} Reviews)` : 'No reviews yet'}
                </button>

                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MdVisibility size={16} /> 1.2K views</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scaled Avatar with Semi-Transparent Glass Stroke */}
        <div style={{ position: 'absolute', bottom: '-20px', left: '60px', width: '160px', height: '160px', borderRadius: '50%', border: '6px solid rgba(255, 255, 255, 0.3)', backgroundClip: 'padding-box', backgroundColor: 'white', zIndex: 30, boxShadow: '0 10px 30px rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
          {store.logo_url ? (
            <img src={store.logo_url} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <MdStorefront size={60} color="#CBD5E1" />
          )}
        </div>
      </div>

      {/* Description and Quick Status Block (No Boxes, Clean Flow) */}
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '10px 20px 40px 20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', paddingLeft: '180px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', backgroundColor: store.is_open ? '#ECFDF5' : '#FEF2F2', color: store.is_open ? '#059669' : '#DC2626', borderRadius: '20px', fontSize: '13px', fontWeight: '800' }}>
            <MdAccessTime size={16} /> {store.is_open ? 'Open now' : 'Closed'}
          </div>
          {theme.showPhone && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', backgroundColor: '#F1F5F9', color: '#475569', borderRadius: '20px', fontSize: '13px', fontWeight: '700' }}><MdPhone size={16} /> {store.phone}</div>}
        </div>
        
        {store.description && (
          <p style={{ margin: '15px 0 0 0', color: '#475569', fontSize: '15px', lineHeight: '1.6', wordBreak: 'break-word', maxWidth: '800px', paddingLeft: '180px' }}>
            {store.description}
          </p>
        )}
      </div>

      {/* Sticky Category & Reviews Navigation */}
      {(items.length > 0 || totalReviews > 0) && (
        <div style={{ position: 'sticky', top: 0, backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(8px)', zIndex: 50, borderTop: '1px solid #F1F5F9', borderBottom: '1px solid #F1F5F9', padding: '12px 20px', display: 'flex', gap: '10px', overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', gap: '10px', width: '100%' }}>
            
            {activeCategories.map(category => (
              <button
                key={category}
                onClick={() => {
                   setActiveCategory(category);
                   scrollToSection(`category-${category}`);
                }}
                style={{
                  padding: '8px 20px',
                  borderRadius: '24px',
                  backgroundColor: activeCategory === category ? brandColor : '#F8FAFC',
                  color: activeCategory === category ? 'white' : '#64748B',
                  border: activeCategory === category ? `1px solid ${brandColor}` : '1px solid #E2E8F0',
                  fontWeight: '800',
                  fontSize: '13px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                  boxShadow: activeCategory === category ? '0 4px 10px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                {category}
              </button>
            ))}

            {/* Permanent Sticky Review Button */}
            <div style={{ marginLeft: 'auto', paddingLeft: '20px', borderLeft: '1px solid #E2E8F0', display: 'flex' }}>
              <button
                onClick={() => scrollToSection('reviews-section')}
                style={{ padding: '8px 20px', borderRadius: '24px', backgroundColor: 'white', color: '#0F172A', border: '1px solid #E2E8F0', fontWeight: '800', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}
              >
                <MdStar size={16} color="#F59E0B" /> Reviews
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CONTINUOUS MENU SECTION (No outer box wrappers) --- */}
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 20px' }}>
        {items.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '60px' }}>
            {activeCategories.map(category => (
              <div key={category} id={`category-${category}`} style={{ scrollMarginTop: '90px' }}>
                
                {/* Accent Color applied to vertical section line */}
                <h3 style={{ margin: '0 0 20px 0', fontSize: '20px', color: '#0F172A', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '4px', height: '20px', backgroundColor: brandColor, borderRadius: '4px' }} />
                  {category}
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                  {groupedItems[category].map(item => (
                    <div key={item.id} style={{ backgroundColor: 'white', borderRadius: '16px', overflow: 'hidden', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', transition: 'box-shadow 0.2s, transform 0.2s', cursor: 'pointer' }} onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.05)'; }} onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
                      {item.image_url ? (
                        <div style={{ height: '200px', backgroundImage: `url(${item.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#F1F5F9', borderBottom: '1px solid #F1F5F9' }} />
                      ) : (
                        <div style={{ height: '200px', backgroundColor: '#F8FAFC', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '40px', borderBottom: '1px solid #F1F5F9' }}><MdRestaurantMenu size={48} color="#CBD5E1" /></div>
                      )}
                      <div style={{ padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
                          <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0F172A', lineHeight: '1.3' }}>{item.item_name}</h4>
                          {/* Guaranteed Readable Price */}
                          <span style={{ fontSize: '16px', fontWeight: '900', color: '#0F172A', whiteSpace: 'nowrap' }}>₱{parseFloat(item.price).toFixed(2)}</span>
                        </div>
                        {item.description && <p style={{ margin: 0, fontSize: '13px', color: '#64748B', lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ height: '1px', backgroundColor: '#F1F5F9', width: '100%', margin: '20px 0' }} />

      {/* --- CONTINUOUS REVIEWS SECTION (No outer box wrapper) --- */}
      <div id="reviews-section" style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 20px 100px 20px', scrollMarginTop: '80px' }}>
        <h2 style={{ margin: '0 0 30px 0', fontSize: '24px', fontWeight: '900', color: '#0F172A' }}>Reviews</h2>

        {totalReviews > 0 && (
          <div style={{ display: 'flex', gap: '40px', alignItems: 'center', marginBottom: '50px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '120px' }}>
              <div style={{ fontSize: '56px', fontWeight: '900', color: '#0F172A', lineHeight: '1' }}>{averageRating}</div>
              <div style={{ display: 'flex', margin: '10px 0' }}>
                {[1, 2, 3, 4, 5].map(star => <MdStar key={star} size={22} color={star <= Math.round(averageRating) ? '#F59E0B' : '#E2E8F0'} />)}
              </div>
              <div style={{ fontSize: '13px', color: '#64748B', fontWeight: '600' }}>{totalReviews} ratings</div>
            </div>

            <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '400px' }}>
              {[5, 4, 3, 2, 1].map(star => {
                const count = distribution[star];
                const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
                return (
                  <div key={star} style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#475569', minWidth: '20px' }}>{star}</span>
                    <div style={{ flexGrow: 1, height: '8px', backgroundColor: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${percentage}%`, height: '100%', backgroundColor: '#F59E0B', borderRadius: '4px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {totalReviews > 0 && (
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '40px', scrollbarWidth: 'none' }}>
            {['All', 5, 4, 3, 2, 1].map(val => (
              <button
                key={val}
                onClick={() => { setFilterRating(val); setVisibleCount(5); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 20px', borderRadius: '24px',
                  backgroundColor: filterRating === val ? '#0F172A' : 'white',
                  color: filterRating === val ? 'white' : '#64748B',
                  border: filterRating === val ? `1px solid #0F172A` : '1px solid #E2E8F0',
                  fontWeight: '800', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s'
                }}
              >
                <MdStar size={16} color={filterRating === val ? '#F59E0B' : '#94A3B8'} /> {val === 'All' ? 'All' : val}
              </button>
            ))}
          </div>
        )}

        <div ref={reviewFormRef} style={{ backgroundColor: '#F8FAFC', padding: '30px', borderRadius: '20px', border: '1px solid #E2E8F0', marginBottom: '40px' }}>
          {!session ? (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '18px', color: '#0F172A', fontWeight: '800' }}>Want to leave a review?</h4>
              {/* Primary Brand Color Action Button */}
              <button onClick={() => navigate('/login')} style={{ padding: '12px 28px', backgroundColor: brandColor, color: 'white', border: 'none', borderRadius: '12px', fontWeight: '800', cursor: 'pointer', fontSize: '14px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>Sign In to Review</button>
            </div>
          ) : (
            <form onSubmit={handleSubmitReview}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h4 style={{ margin: 0, fontSize: '16px', color: '#0F172A', fontWeight: '800' }}>{editingReviewId ? 'Edit your review' : 'Rate your experience'}</h4>
                {editingReviewId && (
                  <button type="button" onClick={() => { setEditingReviewId(null); setRating(0); setComment(''); setReviewPhotos([]); }} style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel Edit</button>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} type="button" onClick={() => setRating(star)} onMouseEnter={() => setHoverRating(star)} onMouseLeave={() => setHoverRating(0)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                    {star <= (hoverRating || rating) ? <MdStar size={36} color="#F59E0B" /> : <MdStarBorder size={36} color="#CBD5E1" />}
                  </button>
                ))}
              </div>

              <div style={{ position: 'relative', marginBottom: '15px' }}>
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
                  style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid #CBD5E1', boxSizing: 'border-box', minHeight: '120px', fontSize: '15px', fontFamily: 'inherit', resize: 'vertical', outlineColor: brandColor }} 
                />
                <div style={{ position: 'absolute', bottom: '12px', right: '16px', fontSize: '12px', color: '#94A3B8', fontWeight: '600' }}>
                  {comment.length}/500
                </div>
              </div>

              {reviewPhotos.length > 0 && (
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '15px' }}>
                  {reviewPhotos.map((item, idx) => {
                    const previewUrl = typeof item === 'string' ? item : URL.createObjectURL(item);
                    return (
                      <div key={idx} style={{ position: 'relative', width: '70px', height: '70px', borderRadius: '10px', backgroundImage: `url(${previewUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', border: '1px solid #E2E8F0' }}>
                        <button type="button" onClick={() => removePhoto(idx)} style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#EF4444', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }}><MdClose size={14} /></button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0F172A', fontWeight: '800', fontSize: '13px', cursor: reviewPhotos.length >= 4 ? 'not-allowed' : 'pointer', padding: '10px 16px', backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', opacity: reviewPhotos.length >= 4 ? 0.6 : 1, transition: 'all 0.2s' }}>
                  <MdImage size={20} color={brandColor} /> {reviewPhotos.length >= 4 ? 'Max 4 Photos' : 'Attach Photos'}
                  <input type="file" multiple accept="image/*" onChange={handlePhotoSelect} style={{ display: 'none' }} disabled={isSubmittingReview || reviewPhotos.length >= 4} />
                </label>

                <button type="submit" disabled={isSubmittingReview || rating === 0} style={{ padding: '12px 28px', backgroundColor: rating === 0 ? '#94A3B8' : brandColor, color: 'white', border: 'none', borderRadius: '12px', fontWeight: '800', fontSize: '14px', cursor: isSubmittingReview || rating === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: rating !== 0 ? '0 4px 10px rgba(0,0,0,0.1)' : 'none' }}>
                  {isSubmittingReview ? 'Posting...' : <><MdSend size={18} /> {editingReviewId ? 'Update' : 'Post'}</>}
                </button>
              </div>
            </form>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          {displayedReviews.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94A3B8', fontSize: '15px', fontWeight: '500' }}>
              {filterRating === 'All' ? 'No reviews yet. Be the first to review this place!' : `No ${filterRating}-star reviews yet.`}
            </div>
          ) : (
            displayedReviews.map(review => {
              const likesCount = review.review_likes?.length || 0;
              const isLikedByMe = session && review.review_likes?.some(like => like.user_id === session.user.id);
              const isAnimating = animatingLikeId === review.id;

              return (
                <div key={review.id} style={{ paddingBottom: '30px', borderBottom: '1px solid #F1F5F9', position: 'relative' }}>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div 
                      onClick={() => navigate(`/user/${review.user_id}`)} 
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                    >
                      <Avatar src={review.reviewer_avatar} name={review.reviewer_name} size="48px" color={brandColor} />
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>{review.reviewer_name || 'LocalLook User'}</div>
                        <div style={{ fontSize: '13px', color: '#94A3B8', fontWeight: '600' }}>{timeAgo(review.created_at)}</div>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>{review.rating.toFixed(1)}</span>
                        <div style={{ display: 'flex' }}>{[...Array(5)].map((_, i) => <MdStar key={i} size={18} color={i < review.rating ? '#F59E0B' : '#E2E8F0'} />)}</div>
                      </div>
                      
                      <div style={{ position: 'relative' }}>
                        <button onClick={() => setActiveMenuId(activeMenuId === review.id ? null : review.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#94A3B8' }}><MdMoreVert size={22} /></button>
                        {activeMenuId === review.id && (
                          <>
                            <div onClick={() => setActiveMenuId(null)} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
                            <div style={{ position: 'absolute', top: '100%', right: 0, backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: '0 8px 20px rgba(0,0,0,0.1)', zIndex: 100, width: '140px', overflow: 'hidden' }}>
                              <button onClick={() => handleAction('report', review)} style={{ width: '100%', padding: '12px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#475569', fontWeight: '600' }}>Report</button>
                              {session?.user?.id === review.user_id && (
                                <button onClick={() => handleAction('delete', review)} style={{ width: '100%', padding: '12px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#DC2626', fontWeight: '600', borderTop: '1px solid #F1F5F9' }}>Delete</button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {review.comment && (
                    <p style={{ 
                      margin: '0 0 20px 0', 
                      fontSize: '15px', 
                      color: '#334155', 
                      lineHeight: '1.6',
                      whiteSpace: 'pre-wrap', 
                      wordBreak: 'break-word' 
                    }}>
                      {review.comment}
                    </p>
                  )}
                  
                {review.photo_urls && review.photo_urls.length > 0 && (
                  <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '15px' }}>
                    {review.photo_urls.map((url, idx) => (
                      <div key={idx} onClick={() => openLightbox(review.photo_urls, idx)} style={{ width: '100px', height: '100px', borderRadius: '12px', backgroundImage: `url(${url})`, backgroundSize: 'cover', backgroundPosition: 'center', cursor: 'pointer', flexShrink: 0, border: '1px solid #E2E8F0' }} />
                    ))}
                  </div>
                )}

                <div style={{ padding: '0 0 16px 0', display: 'flex', alignItems: 'center' }}>
                  <button 
                    onClick={() => toggleLike(review.id, isLikedByMe)}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px', 
                      background: 'none', 
                      border: 'none', 
                      padding: 0, 
                      cursor: 'pointer', 
                      color: isLikedByMe ? brandColor : '#64748B', 
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
                      {isLikedByMe ? <VscThumbsupFilled size={22} /> : <VscThumbsup size={22} />}
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: '700' }}>
                      {likesCount > 0 ? likesCount : 'Helpful'}
                    </span>
                  </button>
                </div>

                {review.owner_reply && (
                  <>
                    <div style={{ padding: '0' }}>
                      <div style={{ 
                        backgroundColor: '#F8FAFC', 
                        padding: '20px', 
                        borderRadius: '16px', 
                        border: '1px solid #E2E8F0', 
                        position: 'relative', 
                        zIndex: 2
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'white', border: `1px solid ${brandColor}`, display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                            <MdStorefront size={18} color={brandColor} />
                          </div>
                          <span style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>Response from {store?.store_name || 'Owner'}</span>
                          <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '500' }}>· {timeAgo(review.owner_reply_created_at)}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '14px', color: '#475569', lineHeight: '1.6', whiteSpace: 'pre-wrap', wordBreak: 'break-word', paddingLeft: '40px' }}>
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
          <div style={{ paddingTop: '20px', display: 'flex', justifyContent: 'flex-start' }}>
            <button 
              onClick={() => setVisibleCount(prev => prev + 5)}
              style={{ background: 'none', border: 'none', padding: 0, color: brandColor, fontWeight: '800', fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              Read more reviews <MdExpandMore size={22} />
            </button>
          </div>
        )}

      </div>

    </div>
  );
}