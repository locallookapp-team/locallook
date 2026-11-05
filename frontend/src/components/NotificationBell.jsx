import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useTheme } from '../components/ThemeContext'; 
import { 
  MdNotificationsNone, 
  MdNotificationsActive, 
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

export default function NotificationBell({ session, isSidebarMode = false, onInviteAccepted }) {
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const { isDarkMode } = useTheme(); 

  const [isOpen, setIsOpen] = useState(false);
  const [invitations, setInvitations] = useState([]);
  const [systemNotes, setSystemNotes] = useState([]);
  const [unreadNotesCount, setUnreadNotesCount] = useState(0);

  const totalUnread = invitations.length + unreadNotesCount;

  const theme = {
    bgPrimary: isDarkMode ? '#1E293B' : '#FFFFFF',
    bgSecondary: isDarkMode ? '#0F172A' : '#F8FAFC',
    border: isDarkMode ? '#334155' : '#E2E8F0',
    textMain: isDarkMode ? '#F8FAFC' : '#0F172A',
    textMuted: isDarkMode ? '#94A3B8' : '#475569',
    divider: isDarkMode ? '#334155' : '#F1F5F9',
    hover: isDarkMode ? '#334155' : '#F1F5F9',
    inviteBg: isDarkMode ? '#1E3A8A' : '#EFF6FF',
    inviteBorder: isDarkMode ? '#1D4ED8' : '#BFDBFE',
    inviteText: isDarkMode ? '#60A5FA' : '#1E3A8A'
  };

  const getNotificationStyle = (type) => {
    switch (type) {
      case 'moderation':
        return { color: '#DC2626', bg: isDarkMode ? 'rgba(220, 38, 38, 0.15)' : '#FEF2F2', icon: <MdWarning size={16} color="#DC2626" /> };
      case 'success':
        return { color: '#10B981', bg: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#F0FDF4', icon: <MdCheckCircle size={16} color="#10B981" /> };
      case 'announcement':
        return { color: '#3B82F6', bg: isDarkMode ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF', icon: <MdCampaign size={16} color="#3B82F6" /> };
      case 'social_like': 
        return { color: '#2563EB', bg: isDarkMode ? 'rgba(37, 99, 235, 0.15)' : '#EFF6FF', icon: <FaThumbsUp size={16} color="#2563EB" /> };
      case 'owner_reply': 
        return { color: '#F59E0B', bg: isDarkMode ? 'rgba(245, 158, 11, 0.15)' : '#FFFBEB', icon: <MdStorefront size={16} color="#F59E0B" /> };
      default:
        return { color: '#64748B', bg: isDarkMode ? theme.bgSecondary : '#F8FAFC', icon: <MdNotifications size={16} color="#64748B" /> };
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
      
      {/* 🚀 Dynamic Responsive Styles for the Notification Bell */}
      <style>{`
        .responsive-bell-btn {
          width: 42px; 
          height: 42px;
          display: flex; 
          justify-content: center; 
          align-items: center;
          border-radius: 50%; 
          cursor: pointer; 
          position: relative;
          background-color: ${theme.bgPrimary};
          border: 1px solid ${theme.border};
          box-shadow: ${isDarkMode ? '0 4px 15px rgba(0,0,0,0.2)' : '0 4px 15px rgba(0,0,0,0.08)'};
          transition: all 0.2s;
        }
        .responsive-bell-icon { color: ${theme.textMuted}; }
        .responsive-bell-active { color: var(--brand-primary, #2563EB); }

        /* Mobile override: Transparent background, white icon for blue header */
        @media (max-width: 768px) {
          .responsive-bell-btn {
            background-color: transparent !important;
            border: none !important;
            box-shadow: none !important;
            width: 36px; height: 36px;
          }
          .responsive-bell-icon, .responsive-bell-active {
            color: #FFFFFF !important;
          }
        }
      `}</style>

      {isSidebarMode ? (
        <div onClick={handleToggleMenu} className={`nav-item ${isOpen ? 'active' : ''}`} style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: isOpen ? 'var(--primary)' : theme.textMuted }}>
               {totalUnread > 0 ? <MdNotificationsActive size={20} /> : <MdNotificationsNone size={20} />}
            </span> Notifications
          </div>
          {totalUnread > 0 && (
            <span style={{ backgroundColor: 'var(--danger, #EF4444)', color: 'white', fontSize: '10px', fontWeight: '900', padding: '2px 6px', borderRadius: '10px' }}>{totalUnread}</span>
          )}
        </div>
      ) : (
        <div onClick={handleToggleMenu} className="responsive-bell-btn">
          {totalUnread > 0 ? <MdNotificationsActive size={24} className="responsive-bell-active" /> : <MdNotificationsNone size={24} className="responsive-bell-icon" />}
          {totalUnread > 0 && (
            <div style={{ position: 'absolute', top: '-2px', right: '-2px', backgroundColor: 'var(--danger, #EF4444)', color: 'white', fontSize: '9px', fontWeight: '900', padding: '2px 5px', borderRadius: '10px', border: '1px solid #1E40AF' }}>{totalUnread}</div>
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
          backgroundColor: theme.bgPrimary, 
          border: `1px solid ${theme.border}`, 
          borderRadius: '12px', 
          boxShadow: isDarkMode ? '0 10px 35px rgba(0,0,0,0.4)' : '0 10px 35px rgba(0,0,0,0.15)', 
          zIndex: 999999, 
          overflow: 'hidden' 
        }}>
          
          {invitations.length > 0 && (
            <div>
              <div style={{ padding: '12px 16px', backgroundColor: theme.inviteBg, borderBottom: `1px solid ${theme.inviteBorder}`, fontWeight: '800', fontSize: '12px', color: theme.inviteText }}>
                Action Required: Pending Invites
              </div>
              <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                {invitations.map(invite => (
                  <div key={invite.id} style={{ padding: '12px 16px', borderBottom: `1px solid ${theme.divider}` }}>
                    <p style={{ margin: '0 0 8px 0', fontSize: '12.5px', color: theme.textMuted, lineHeight: '1.4' }}>
                      You were invited to manage <strong style={{ color: theme.textMain }}>{invite.stores?.store_name}</strong>.
                    </p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => handleAcceptInvite(invite.id)} style={{ flex: 1, padding: '8px', backgroundColor: '#10B981', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <MdCheck size={16} /> Accept
                      </button>
                      <button onClick={() => handleDeclineInvite(invite.id)} style={{ padding: '8px', backgroundColor: isDarkMode ? 'rgba(220, 38, 38, 0.2)' : '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <MdClear size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div style={{ padding: '12px 16px', backgroundColor: theme.bgSecondary, borderBottom: `1px solid ${theme.divider}`, borderTop: invitations.length > 0 ? `1px solid ${theme.border}` : 'none', fontWeight: '800', fontSize: '12px', color: theme.textMain }}>
              System Alerts
            </div>
            <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
              {systemNotes.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: theme.textMuted, fontWeight: '500' }}>You're all caught up!</div>
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
                      onMouseEnter={(e) => {
                        if(note.is_read) e.currentTarget.style.backgroundColor = theme.hover;
                      }}
                      onMouseLeave={(e) => {
                        if(note.is_read) e.currentTarget.style.backgroundColor = theme.bgPrimary;
                      }}
                      style={{ 
                        padding: '14px 16px', 
                        borderBottom: `1px solid ${theme.divider}`, 
                        backgroundColor: note.is_read ? theme.bgPrimary : style.bg,
                        cursor: note.action_url ? 'pointer' : 'default',
                        transition: 'background-color 0.2s'
                      }}
                    >
                      <div style={{ fontWeight: '800', fontSize: '13px', color: theme.textMain, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {!note.is_read && <div style={{ width: '6px', height: '6px', backgroundColor: '#10B981', borderRadius: '50%', flexShrink: 0 }}></div>}
                        {style.icon}
                        {note.title}
                      </div>
                      <div style={{ fontSize: '12.5px', color: theme.textMuted, marginTop: '4px', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>{note.message}</div>
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