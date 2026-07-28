import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
  MdNotificationsNone, 
  MdNotificationsActive, 
  MdCheck, 
  MdClear,
  MdWarning, 
  MdCheckCircle, 
  MdCampaign, 
  MdNotifications,
  MdThumbUp, // Replaced Heart with Thumb Up
  MdStorefront 
} from 'react-icons/md';
import { FaThumbsUp } from 'react-icons/fa';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://locallook-api.onrender.com';

export default function NotificationBell({ session, isSidebarMode = false, onInviteAccepted }) {
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  const [isOpen, setIsOpen] = useState(false);
  const [invitations, setInvitations] = useState([]);
  const [systemNotes, setSystemNotes] = useState([]);
  const [unreadNotesCount, setUnreadNotesCount] = useState(0);

  const totalUnread = invitations.length + unreadNotesCount;

  const getNotificationStyle = (type) => {
    switch (type) {
      case 'moderation':
        return { color: '#DC2626', bg: '#FEF2F2', icon: <MdWarning size={16} color="#DC2626" /> };
      case 'success':
        return { color: '#10B981', bg: '#F0FDF4', icon: <MdCheckCircle size={16} color="#10B981" /> };
      case 'announcement':
        return { color: '#3B82F6', bg: '#EFF6FF', icon: <MdCampaign size={16} color="#3B82F6" /> };
      case 'social_like': 
        return { color: '#2563EB', bg: '#EFF6FF', icon: <FaThumbsUp size={16} color="#2563EB" /> };
      case 'owner_reply': 
        return { color: '#F59E0B', bg: '#FFFBEB', icon: <MdStorefront size={16} color="#F59E0B" /> };
      default:
        return { color: '#64748B', bg: '#F8FAFC', icon: <MdNotifications size={16} color="#64748B" /> };
    }
  };

  const getAuthHeaders = async (isJson = false) => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    const headers = { 'Authorization': `Bearer ${currentSession?.access_token}` };
    if (isJson) headers['Content-Type'] = 'application/json';
    return headers;
  };

  useEffect(() => {
    if (!session) return;

    const fetchAllNotifications = async () => {
      try {
        const headers = await getAuthHeaders();
        const inviteRes = await fetch(`${API_BASE_URL}/api/invitations/pending`, { headers });
        if (inviteRes.ok) {
          const inviteData = await inviteRes.json();
          setInvitations(inviteData);
        }
      } catch (err) {
        console.error("Failed to fetch pending invites:", err);
      }

      const { data: noteData } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(15); 
      
      if (noteData) {
        setSystemNotes(noteData);
        setUnreadNotesCount(noteData.filter(n => !n.is_read).length);
      }
    };

    fetchAllNotifications();

    const CHANNEL_NAME = `public-notifications-${isSidebarMode ? 'sidebar' : 'topnav'}`;
    const existingChannels = supabase.getChannels();
    existingChannels.forEach(c => {
      if (c.topic === `realtime:${CHANNEL_NAME}`) {
        supabase.removeChannel(c);
      }
    });

    const channel = supabase.channel(CHANNEL_NAME);

    channel.on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'notifications', 
      filter: `user_id=eq.${session.user.id}` 
    }, (payload) => {
      
      if (payload.eventType === 'INSERT') {
        setSystemNotes(prev => {
          const newNotes = [payload.new, ...prev];
          setUnreadNotesCount(newNotes.filter(n => !n.is_read).length);
          return newNotes;
        });
      }
      
      if (payload.eventType === 'UPDATE') {
        setSystemNotes(prev => {
          const updatedNotes = prev.map(note => note.id === payload.new.id ? payload.new : note);
          setUnreadNotesCount(updatedNotes.filter(n => !n.is_read).length);
          return updatedNotes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        });
      }
      
      if (payload.eventType === 'DELETE') {
        setSystemNotes(prev => {
          const filteredNotes = prev.filter(note => note.id !== payload.old.id);
          setUnreadNotesCount(filteredNotes.filter(n => !n.is_read).length);
          return filteredNotes;
        });
      }
    });

    channel.subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session]);

  const markAsRead = () => {
    if (systemNotes.some(n => !n.is_read)) {
      setSystemNotes(prev => prev.map(n => ({ ...n, is_read: true })));
      supabase.from('notifications')
        .update({ is_read: true })
        .eq('user_id', session.user.id)
        .eq('is_read', false)
        .then();
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        if (isOpen) {
          setIsOpen(false);
          markAsRead(); 
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, systemNotes, session]);

  const handleToggleMenu = async () => {
    if (!isOpen) {
      setIsOpen(true);
      setUnreadNotesCount(0); 
    } else {
      setIsOpen(false);
      markAsRead(); 
    }
  };

  const handleAcceptInvite = async (inviteId) => {
    try {
      const headers = await getAuthHeaders(true);
      const res = await fetch(`${API_BASE_URL}/api/invitations/${inviteId}/accept`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ user_id: session.user.id, email: session.user.email })
      });
      if (res.ok) {
        setInvitations(prev => prev.filter(inv => inv.id !== inviteId));
        if (onInviteAccepted) onInviteAccepted();
        alert("Invitation accepted! You now have store access.");
        navigate('/dashboard');
        setIsOpen(false);
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Failed to accept invite.");
      }
    } catch (err) {
      alert("An error occurred while accepting.");
    }
  };

  const handleDeclineInvite = async (inviteId) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/invitations/${inviteId}/decline`, { method: 'POST', headers });
      if (res.ok) setInvitations(prev => prev.filter(inv => inv.id !== inviteId));
    } catch (err) { console.error(err); }
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: isSidebarMode ? '100%' : 'auto' }}>
      {isSidebarMode ? (
        <div onClick={handleToggleMenu} className={`nav-item ${isOpen ? 'active' : ''}`} style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: isOpen ? '#2563EB' : '#94A3B8' }}>
               {totalUnread > 0 ? <MdNotificationsActive size={20} /> : <MdNotificationsNone size={20} />}
            </span> Notifications
          </div>
          {totalUnread > 0 && (
            <span style={{ backgroundColor: '#EF4444', color: 'white', fontSize: '10px', fontWeight: '900', padding: '2px 6px', borderRadius: '10px' }}>{totalUnread}</span>
          )}
        </div>
      ) : (
        <div onClick={handleToggleMenu} style={{ width: '40px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid #E2E8F0', borderRadius: '50%', cursor: 'pointer', backgroundColor: '#FFFFFF', position: 'relative' }}>
          {totalUnread > 0 ? <MdNotificationsActive size={20} color="#2563EB" /> : <MdNotificationsNone size={20} color="#475569" />}
          {totalUnread > 0 && (
            <div style={{ position: 'absolute', top: '-2px', right: '-2px', backgroundColor: '#EF4444', color: 'white', fontSize: '10px', fontWeight: '900', padding: '2px 6px', borderRadius: '10px' }}>{totalUnread}</div>
          )}
        </div>
      )}

      {isOpen && (
        <div style={{ 
          position: 'absolute', 
          top: isSidebarMode ? 'auto' : '100%', 
          bottom: isSidebarMode ? '100%' : 'auto', 
          left: isSidebarMode ? '0' : 'auto', 
          right: isSidebarMode ? 'auto' : '0', 
          marginTop: isSidebarMode ? '0' : '10px',
          marginBottom: isSidebarMode ? '8px' : '0',
          width: '300px', 
          backgroundColor: 'white', 
          border: '1px solid #E2E8F0', 
          borderRadius: '12px', 
          boxShadow: '0 10px 35px rgba(0,0,0,0.15)', 
          zIndex: 999999, 
          overflow: 'hidden' 
        }}>
          
          {invitations.length > 0 && (
            <div>
              <div style={{ padding: '12px 16px', backgroundColor: '#EFF6FF', borderBottom: '1px solid #BFDBFE', fontWeight: '800', fontSize: '12px', color: '#1E3A8A' }}>
                Action Required: Pending Invites
              </div>
              <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                {invitations.map(invite => (
                  <div key={invite.id} style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9' }}>
                    <p style={{ margin: '0 0 8px 0', fontSize: '12.5px', color: '#475569', lineHeight: '1.4' }}>
                      You were invited to manage <strong style={{ color: '#0F172A' }}>{invite.stores?.store_name}</strong>.
                    </p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => handleAcceptInvite(invite.id)} style={{ flex: 1, padding: '8px', backgroundColor: '#10B981', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <MdCheck size={16} /> Accept
                      </button>
                      <button onClick={() => handleDeclineInvite(invite.id)} style={{ padding: '8px', backgroundColor: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <MdClear size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div style={{ padding: '12px 16px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #F1F5F9', borderTop: invitations.length > 0 ? '1px solid #E2E8F0' : 'none', fontWeight: '800', fontSize: '12px', color: '#0F172A' }}>
              System Alerts
            </div>
            <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
              {systemNotes.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: '#94A3B8', fontWeight: '500' }}>You're all caught up!</div>
              ) : (
                systemNotes.map(note => {
                  const style = getNotificationStyle(note.type);
                  return (
                    <div 
                      key={note.id} 
                      onClick={() => {
                        if (note.action_url) {
                          navigate(note.action_url);
                          setIsOpen(false);
                          markAsRead(); 
                        }
                      }}
                      style={{ 
                        padding: '14px 16px', 
                        borderBottom: '1px solid #F1F5F9', 
                        backgroundColor: note.is_read ? '#FFFFFF' : style.bg,
                        cursor: note.action_url ? 'pointer' : 'default',
                        transition: 'background-color 0.2s'
                      }}
                    >
                      <div style={{ fontWeight: '800', fontSize: '13px', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {!note.is_read && <div style={{ width: '6px', height: '6px', backgroundColor: '#10B981', borderRadius: '50%', flexShrink: 0 }}></div>}
                        {style.icon}
                        {note.title}
                      </div>
                      <div style={{ fontSize: '12.5px', color: '#475569', marginTop: '4px', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>{note.message}</div>
                      <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '6px', fontWeight: '600' }}>
                        {new Date(note.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}