import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
  MdNotificationsNone, 
  MdCheck, 
  MdClear,
  MdWarning, 
  MdCheckCircle, 
  MdCampaign, 
  MdNotifications,
  MdStorefront 
} from 'react-icons/md';
import { FaThumbsUp } from 'react-icons/fa';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://locallook-api.onrender.com';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const [systemNotes, setSystemNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  const getNotificationStyle = (type) => {
    switch (type) {
      case 'moderation': return { bg: 'rgba(220, 38, 38, 0.1)', icon: <MdWarning size={20} color="#DC2626" /> };
      case 'success': return { bg: 'rgba(16, 185, 129, 0.1)', icon: <MdCheckCircle size={20} color="#10B981" /> };
      case 'announcement': return { bg: 'rgba(59, 130, 246, 0.1)', icon: <MdCampaign size={20} color="#3B82F6" /> };
      case 'social_like': return { bg: 'rgba(37, 99, 235, 0.1)', icon: <FaThumbsUp size={18} color="#2563EB" /> };
      case 'owner_reply': return { bg: 'rgba(245, 158, 11, 0.1)', icon: <MdStorefront size={20} color="#F59E0B" /> };
      default: return { bg: 'var(--surface-hover)', icon: <MdNotifications size={20} color="var(--text-muted)" /> };
    }
  };

  const getAuthHeaders = async (isJson = false) => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    const headers = { 'Authorization': `Bearer ${currentSession?.access_token}` };
    if (isJson) headers['Content-Type'] = 'application/json';
    return headers;
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
  }, []);

  useEffect(() => {
    if (!session) return;

    const fetchAllNotifications = async () => {
      try {
        const headers = await getAuthHeaders();
        const inviteRes = await fetch(`${API_BASE_URL}/api/invitations/pending`, { headers });
        if (inviteRes.ok) setInvitations(await inviteRes.json());
      } catch (err) {
        console.error("Failed to fetch pending invites:", err);
      }

      const { data: noteData } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(50); 
      
      if (noteData) {
        setSystemNotes(noteData);
        // Mark all as read when opening the page
        const unreadIds = noteData.filter(n => !n.is_read).map(n => n.id);
        if (unreadIds.length > 0) {
          supabase.from('notifications').update({ is_read: true }).in('id', unreadIds).then();
        }
      }
      setLoading(false);
    };

    fetchAllNotifications();

    const CHANNEL_NAME = `public-notifications-page`;
    const channel = supabase.channel(CHANNEL_NAME);

    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` }, (payload) => {
      if (payload.eventType === 'INSERT') {
        // Auto-mark as read if they are on the page
        supabase.from('notifications').update({ is_read: true }).eq('id', payload.new.id).then();
        setSystemNotes(prev => [{...payload.new, is_read: true}, ...prev]);
      }
      if (payload.eventType === 'UPDATE') {
        setSystemNotes(prev => prev.map(note => note.id === payload.new.id ? payload.new : note).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
      }
      if (payload.eventType === 'DELETE') {
        setSystemNotes(prev => prev.filter(note => note.id !== payload.old.id));
      }
    });

    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session]);

  const handleAcceptInvite = async (inviteId) => {
    try {
      const headers = await getAuthHeaders(true);
      const res = await fetch(`${API_BASE_URL}/api/invitations/${inviteId}/accept`, {
        method: 'POST', headers,
        body: JSON.stringify({ user_id: session.user.id, email: session.user.email })
      });
      if (res.ok) {
        setInvitations(prev => prev.filter(inv => inv.id !== inviteId));
        alert("Invitation accepted! You now have store access.");
        navigate('/dashboard');
      } else {
        const errorData = await res.json(); alert(errorData.error || "Failed to accept invite.");
      }
    } catch (err) { alert("An error occurred while accepting."); }
  };

  const handleDeclineInvite = async (inviteId) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/invitations/${inviteId}/decline`, { method: 'POST', headers });
      if (res.ok) setInvitations(prev => prev.filter(inv => inv.id !== inviteId));
    } catch (err) { console.error(err); }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', backgroundColor: 'var(--bg-color)', padding: '30px' }}>
        <div style={{ height: '40px', width: '200px', backgroundColor: 'var(--border-color)', borderRadius: '12px', animation: 'pulse 1.5s infinite', marginBottom: '30px' }} />
        <div style={{ height: '100px', width: '100%', maxWidth: '800px', backgroundColor: 'var(--border-color)', borderRadius: '16px', animation: 'pulse 1.5s infinite', marginBottom: '15px' }} />
        <div style={{ height: '100px', width: '100%', maxWidth: '800px', backgroundColor: 'var(--border-color)', borderRadius: '16px', animation: 'pulse 1.5s infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', backgroundColor: 'var(--bg-color)', fontFamily: 'var(--font-main)', overflowY: 'auto' }}>
      
      {/* Header */}
      <div style={{ height: '70px', flexShrink: 0, backgroundColor: 'var(--surface-color)', padding: '0 30px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 40 }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '900', color: 'var(--text-main)' }}>Notifications</h1>
      </div>

      <div style={{ flexGrow: 1, padding: '30px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '25px' }}>
          
          {invitations.length > 0 && (
            <div style={{ backgroundColor: 'var(--surface-color)', borderRadius: '20px', border: '1px solid var(--brand-primary)', overflow: 'hidden', boxShadow: '0 8px 20px rgba(37,99,235,0.1)' }}>
              <div style={{ padding: '16px 24px', backgroundColor: 'rgba(37,99,235,0.05)', borderBottom: '1px solid rgba(37,99,235,0.1)', fontWeight: '900', fontSize: '15px', color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MdWarning size={20} /> Action Required: Store Invitations
              </div>
              <div>
                {invitations.map(invite => (
                  <div key={invite.id} style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', borderBottom: '1px solid var(--border-color)' }}>
                    <p style={{ margin: 0, fontSize: '15px', color: 'var(--text-main)', lineHeight: '1.5' }}>
                      You were invited to manage <strong style={{ fontWeight: '900' }}>{invite.stores?.store_name}</strong>.
                    </p>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={() => handleDeclineInvite(invite.id)} style={{ padding: '10px 20px', backgroundColor: 'var(--surface-hover)', color: 'var(--text-muted)', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MdClear size={18} /> Decline
                      </button>
                      <button onClick={() => handleAcceptInvite(invite.id)} style={{ padding: '10px 20px', backgroundColor: '#10B981', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 10px rgba(16,185,129,0.2)' }}>
                        <MdCheck size={18} /> Accept Invite
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ backgroundColor: 'var(--surface-color)', borderRadius: '20px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
            {systemNotes.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <MdNotificationsNone size={64} style={{ color: 'var(--border-color)', marginBottom: '15px' }} />
                <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-main)', fontWeight: '800' }}>You're all caught up!</h3>
                <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: 'var(--text-muted)' }}>You don't have any new notifications right now.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {systemNotes.map((note, idx) => {
                  const style = getNotificationStyle(note.type);
                  return (
                    <div 
                      key={note.id} 
                      onClick={() => { if (note.action_url) navigate(note.action_url); }}
                      style={{ 
                        padding: '20px 24px', 
                        borderBottom: idx === systemNotes.length - 1 ? 'none' : '1px solid var(--border-color)', 
                        backgroundColor: 'var(--bg-color)',
                        cursor: note.action_url ? 'pointer' : 'default',
                        display: 'flex',
                        gap: '16px',
                        alignItems: 'flex-start',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => { if(note.action_url) e.currentTarget.style.backgroundColor = 'var(--surface-hover)'; }}
                      onMouseLeave={(e) => { if(note.action_url) e.currentTarget.style.backgroundColor = 'var(--bg-color)'; }}
                    >
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: style.bg, display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                        {style.icon}
                      </div>
                      <div style={{ flexGrow: 1 }}>
                        <div style={{ fontWeight: '800', fontSize: '15px', color: 'var(--text-main)', marginBottom: '4px' }}>
                          {note.title}
                        </div>
                        <div style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                          {note.message}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', fontWeight: '600', opacity: 0.7 }}>
                          {new Date(note.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}