import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
  MdStar, 
  MdStorefront, 
  MdFavorite, 
  MdFavoriteBorder,
  MdClose,
  MdChevronLeft,
  MdChevronRight,
  MdArrowBack,
  MdVerified
} from 'react-icons/md';

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
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function PublicUserProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [profileUser, setProfileUser] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Lightbox State
  const [lightbox, setLightbox] = useState({ isOpen: false, images: [], currentIndex: 0 });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    fetchUserData();
  }, [id]);

  const fetchUserData = async () => {
    setLoading(true);
    try {
      // 1. Fetch the user's basic profile details
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, display_name, avatar_url, role')
        .eq('id', id)
        .single();

      if (userError) throw userError;
      setProfileUser(userData);

      // 2. Fetch all reviews written by this specific user
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('reviews')
        .select(`
          id, rating, comment, photo_urls, created_at, reviewer_name, reviewer_avatar, owner_reply, owner_reply_created_at,
          store_id,
          stores ( store_name ),
          review_likes ( user_id )
        `)
        .eq('user_id', id)
        .order('created_at', { ascending: false });

      if (reviewsError) throw reviewsError;
      setReviews(reviewsData || []);

    } catch (err) {
      console.error("Error fetching user data:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleLike = async (reviewId, isCurrentlyLiked) => {
    if (!session) return navigate('/login');

    const userId = session.user.id;

    // Optimistic UI update
    setReviews(prevReviews => prevReviews.map(review => {
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
      }
    } catch (err) {
      console.error("Error toggling like:", err);
      fetchUserData(); // Revert on failure
    }
  };

  const openLightbox = (images, index) => setLightbox({ isOpen: true, images, currentIndex: index });
  const closeLightbox = () => setLightbox({ isOpen: false, images: [], currentIndex: 0 });
  const nextImage = (e) => { e.stopPropagation(); setLightbox(prev => ({ ...prev, currentIndex: (prev.currentIndex + 1) % prev.images.length })); };
  const prevImage = (e) => { e.stopPropagation(); setLightbox(prev => ({ ...prev, currentIndex: (prev.currentIndex - 1 + prev.images.length) % prev.images.length })); };

  if (loading) return <div style={{ display: 'flex', height: '100%', justifyContent: 'center', alignItems: 'center', color: '#64748B' }}>Loading Profile...</div>;
  if (!profileUser) return <div style={{ display: 'flex', height: '100%', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#64748B' }}><h2>User not found</h2><button onClick={() => navigate(-1)} style={{ padding: '10px 20px', backgroundColor: '#2563EB', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>Go Back</button></div>;

  const totalReviews = reviews.length;
  const averageRating = totalReviews > 0 ? (reviews.reduce((acc, curr) => acc + curr.rating, 0) / totalReviews).toFixed(1) : '0.0';

  return (
    <div style={{ height: '100%', overflowY: 'auto', backgroundColor: '#F8FAFC', padding: '0', fontFamily: 'Inter, sans-serif' }}>
      
      {/* LIGHTBOX OVERLAY */}
      {lightbox.isOpen && (
        <div onClick={closeLightbox} style={{ position: 'fixed', inset: 0, zIndex: 999999, backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <button onClick={closeLightbox} style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><MdClose size={32} /></button>
          {lightbox.images.length > 1 && <button onClick={prevImage} style={{ position: 'absolute', left: '20px', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', color: 'white', padding: '10px', cursor: 'pointer' }}><MdChevronLeft size={32} /></button>}
          <img src={lightbox.images[lightbox.currentIndex]} alt="Review Attachment" style={{ maxWidth: '90%', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px' }} />
          {lightbox.images.length > 1 && <button onClick={nextImage} style={{ position: 'absolute', right: '20px', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', color: 'white', padding: '10px', cursor: 'pointer' }}><MdChevronRight size={32} /></button>}
        </div>
      )}

      {/* TOP NAVIGATION BAR */}
      <div style={{ backgroundColor: 'white', padding: '15px 20px', borderBottom: '1px solid #E2E8F0', position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', gap: '15px' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', cursor: 'pointer', color: '#0F172A', padding: 0 }}>
          <MdArrowBack size={24} />
        </button>
        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>{profileUser.display_name || 'Community Member'}</h1>
      </div>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
        
        {/* PROFILE HEADER CARD */}
        <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', border: '1px solid #E2E8F0', marginBottom: '30px', textAlign: 'center' }}>
          <div style={{ width: '100px', height: '100px', borderRadius: '50%', backgroundColor: '#EFF6FF', backgroundImage: `url(${profileUser.avatar_url || `https://ui-avatars.com/api/?name=${profileUser.display_name}&background=EFF6FF&color=2563EB&size=100`})`, backgroundSize: 'cover', backgroundPosition: 'center', border: '4px solid white', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', marginBottom: '16px' }} />
          
          <h2 style={{ margin: '0 0 5px 0', fontSize: '24px', fontWeight: '900', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
            {profileUser.display_name || 'Community Member'}
            {totalReviews >= 5 && <MdVerified color="#3B82F6" size={20} title="Top Contributor" />}
          </h2>
          
          <div style={{ display: 'inline-block', padding: '4px 12px', backgroundColor: '#EFF6FF', color: '#2563EB', fontSize: '12px', fontWeight: '800', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '20px' }}>
            LocalLook Contributor
          </div>

          <div style={{ display: 'flex', gap: '30px', justifyContent: 'center', width: '100%', borderTop: '1px solid #F1F5F9', paddingTop: '20px' }}>
            <div>
              <div style={{ fontSize: '24px', fontWeight: '900', color: '#0F172A' }}>{totalReviews}</div>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '600', textTransform: 'uppercase' }}>Reviews</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: '900', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                {averageRating} <MdStar size={18} color="#F59E0B" />
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '600', textTransform: 'uppercase' }}>Avg Rating</div>
            </div>
          </div>
        </div>

        {/* REVIEWS FEED */}
        <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>Recent Activity</h3>
        
        {reviews.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#94A3B8', backgroundColor: 'white', borderRadius: '16px', border: '1px dashed #CBD5E1' }}>This user hasn't posted any reviews yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {reviews.map(review => {
              const likesCount = review.review_likes?.length || 0;
              const isLikedByMe = session && review.review_likes?.some(like => like.user_id === session.user.id);
              
              return (
                <div key={review.id} style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
                  
                  {/* CARD HEADER */}
                  <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#EFF6FF', backgroundImage: `url(${review.reviewer_avatar || `https://ui-avatars.com/api/?name=${review.reviewer_name}&background=EFF6FF&color=2563EB`})`, backgroundSize: 'cover', backgroundPosition: 'center', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {review.reviewer_name}
                          <span style={{ color: '#94A3B8', fontWeight: 'normal', fontSize: '12px' }}>· {timeAgo(review.created_at)}</span>
                        </div>
                        
                        <div onClick={() => navigate(`/store/${review.store_id}`)} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px', fontSize: '12px', color: '#2563EB', fontWeight: '600', cursor: 'pointer', backgroundColor: '#EFF6FF', padding: '4px 8px', borderRadius: '6px', transition: 'background-color 0.2s' }}>
                          <MdStorefront size={14} /> {review.stores?.store_name || 'Unknown Store'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', backgroundColor: '#FFFBEB', border: '1px solid #FEF3C7', padding: '4px 8px', borderRadius: '12px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#D97706' }}>{review.rating.toFixed(1)}</span>
                      <MdStar size={14} color="#F59E0B" />
                    </div>
                  </div>

                  {/* COMMENT TEXT */}
                  {review.comment && (
                    <div style={{ padding: '0 16px 12px 16px', fontSize: '14px', color: '#334155', lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {review.comment}
                    </div>
                  )}

                  {/* OWNER REPLY */}
                  {review.owner_reply && (
                    <div style={{ margin: '0 16px 12px 16px', backgroundColor: '#F8FAFC', padding: '16px', borderRadius: '12px', borderLeft: '4px solid #10B981' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                        <MdStorefront size={16} color="#10B981" />
                        <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>Response from Owner</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '14px', color: '#475569', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                        {review.owner_reply}
                      </p>
                    </div>
                  )}

                  {/* PHOTO GRID */}
                  {review.photo_urls && review.photo_urls.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: review.photo_urls.length === 1 ? '1fr' : '1fr 1fr', gap: '2px', maxHeight: '300px', overflow: 'hidden' }}>
                      {review.photo_urls.slice(0, 4).map((url, idx) => (
                        <div key={idx} onClick={() => openLightbox(review.photo_urls, idx)} style={{ height: review.photo_urls.length === 1 ? '300px' : '150px', backgroundImage: `url(${url})`, backgroundSize: 'cover', backgroundPosition: 'center', cursor: 'pointer', position: 'relative' }}>
                          {idx === 3 && review.photo_urls.length > 4 && (
                            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontWeight: 'bold', fontSize: '20px' }}>
                              +{review.photo_urls.length - 4}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* LIKES COUNTER */}
                  <div style={{ padding: '12px 16px', borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center' }}>
                    <button onClick={() => toggleLike(review.id, isLikedByMe)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: isLikedByMe ? '#EF4444' : '#64748B', outline: 'none' }}>
                      {isLikedByMe ? <MdFavorite size={22} /> : <MdFavoriteBorder size={22} />}
                      <span style={{ fontSize: '13px', fontWeight: '600' }}>
                        {likesCount > 0 ? likesCount : 'Like'}
                      </span>
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}