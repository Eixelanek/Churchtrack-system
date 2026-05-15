import React, { useState, useEffect } from 'react';
import './ContactMessages.css';
import { API_BASE_URL } from '../../config/api';

const ContactMessages = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all'); // all, new, read, replied
  const [searchTerm, setSearchTerm] = useState('');
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState(null);

  useEffect(() => {
    loadMessages();
  }, [filterStatus]);

  const loadMessages = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/contact/get_messages.php?status=${filterStatus}`);
      const data = await response.json();

      if (data.success) {
        setMessages(data.messages || []);
      } else {
        setError(data.message || 'Failed to load messages');
      }
    } catch (err) {
      setError('Unable to reach the server');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (messageId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/contact/mark_message_read.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: messageId })
      });

      const data = await response.json();
      if (data.success) {
        loadMessages();
      }
    } catch (err) {
      console.error('Error marking message as read:', err);
    }
  };

  const deleteMessage = async (messageId) => {
    setMessageToDelete(messageId);
    setShowDeleteConfirmModal(true);
  };

  const confirmDeleteMessage = async () => {
    if (!messageToDelete) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/contact/delete_message.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: messageToDelete })
      });

      const data = await response.json();
      if (data.success) {
        setSelectedMessage(null);
        loadMessages();
      }
    } catch (err) {
      console.error('Error deleting message:', err);
    } finally {
      setShowDeleteConfirmModal(false);
      setMessageToDelete(null);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim()) {
      alert('Please enter a reply message');
      return;
    }

    setIsSendingReply(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/contact/send_reply.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: selectedMessage.id,
          reply_text: replyText
        })
      });

      const data = await response.json();
      if (data.success) {
        setShowReplyModal(false);
        setReplyText('');
        loadMessages();
        // Update selected message to show new status
        setSelectedMessage(prev => prev ? { ...prev, status: 'replied' } : null);
      } else {
        alert('Error sending reply: ' + (data.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error sending reply:', err);
      alert('Unable to send reply. Please try again.');
    } finally {
      setIsSendingReply(false);
    }
  };

  const filteredMessages = messages.filter(msg =>
    msg.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status) => {
    const badges = {
      new: { label: 'New', color: '#3B82F6' },
      read: { label: 'Read', color: '#1095D2' },
      replied: { label: 'Replied', color: '#0049AF' }
    };
    return badges[status] || badges.new;
  };

  return (
    <div className="contact-messages-container">
      <div className="messages-header">
        <h2>Contact Messages</h2>
        <div className="messages-stats">
          <span className="stat-badge">Total: {messages.length}</span>
          <span className="stat-badge new">New: {messages.filter(m => m.status === 'new').length}</span>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="messages-controls">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <div className="filter-buttons">
          {['all', 'new', 'read', 'replied'].map(status => (
            <button
              key={status}
              className={`filter-btn ${filterStatus === status ? 'active' : ''}`}
              onClick={() => setFilterStatus(status)}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="messages-layout">
        <div className="messages-list">
          {loading ? (
            <div className="loading">Loading messages...</div>
          ) : filteredMessages.length === 0 ? (
            <div className="no-messages">No messages found</div>
          ) : (
            filteredMessages.map(msg => (
              <div
                key={msg.id}
                className={`message-item ${selectedMessage?.id === msg.id ? 'active' : ''} ${msg.status === 'new' ? 'unread' : ''}`}
                onClick={() => {
                  setSelectedMessage(msg);
                  if (msg.status === 'new') {
                    markAsRead(msg.id);
                  }
                }}
              >
                <div className="message-item-header">
                  <div className="message-sender">
                    <strong>{msg.first_name} {msg.last_name}</strong>
                    <span className="message-status" style={{ backgroundColor: getStatusBadge(msg.status).color }}>
                      {getStatusBadge(msg.status).label}
                    </span>
                  </div>
                  <span className="message-date">
                    {new Date(msg.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="message-preview">
                  {msg.message.substring(0, 60)}...
                </div>
              </div>
            ))
          )}
        </div>

        <div className="message-detail">
          {selectedMessage ? (
            <>
              <div className="detail-header">
                <h3>{selectedMessage.first_name} {selectedMessage.last_name}</h3>
                <div className="detail-actions">
                  <button
                    className="btn-reply"
                    onClick={() => setShowReplyModal(true)}
                  >
                    ✉️ Reply
                  </button>
                  <button
                    className="btn-delete"
                    onClick={() => deleteMessage(selectedMessage.id)}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>

              <div className="detail-info">
                <div className="info-row">
                  <label>Email:</label>
                  <a href={`mailto:${selectedMessage.email}`}>{selectedMessage.email}</a>
                </div>
                {selectedMessage.phone && (
                  <div className="info-row">
                    <label>Phone:</label>
                    <a href={`tel:${selectedMessage.phone}`}>{selectedMessage.phone}</a>
                  </div>
                )}
                <div className="info-row">
                  <label>Date:</label>
                  <span>{new Date(selectedMessage.created_at).toLocaleString()}</span>
                </div>
                <div className="info-row">
                  <label>Status:</label>
                  <span
                    className="status-badge"
                    style={{ backgroundColor: getStatusBadge(selectedMessage.status).color }}
                  >
                    {getStatusBadge(selectedMessage.status).label}
                  </span>
                </div>
              </div>

              <div className="detail-message">
                <h4>Message:</h4>
                <p>{selectedMessage.message}</p>
              </div>
            </>
          ) : (
            <div className="no-selection">
              Select a message to view details
            </div>
          )}
        </div>
      </div>

      {showReplyModal && (
        <div className="modal-overlay" onClick={() => !isSendingReply && setShowReplyModal(false)}>
          <div className="reply-modal" onClick={(e) => e.stopPropagation()}>

            {/* Left sidebar */}
            <div className="reply-sidebar">
              <div className="reply-sidebar-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              </div>
              <div className="reply-sidebar-line" />
              <div className="reply-sidebar-avatar">
                {selectedMessage?.email?.charAt(0).toUpperCase()}
              </div>
              <div className="reply-sidebar-line" />
              <div className="reply-sidebar-send">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </div>
            </div>

            {/* Right content */}
            <div className="reply-body">
              {/* Header */}
              <div className="reply-header-row">
                <div>
                  <h3 className="reply-title">Send reply</h3>
                  <p className="reply-subtitle">Sent via email</p>
                </div>
                <button
                  className="reply-close-btn"
                  onClick={() => !isSendingReply && setShowReplyModal(false)}
                  disabled={isSendingReply}
                >✕</button>
              </div>

              {/* To row */}
              <div className="reply-to-row">
                <span className="reply-to-arrow">→</span>
                <span className="reply-to-label">To</span>
                <span className="reply-to-email">{selectedMessage?.email}</span>
              </div>

              {/* Message area */}
              <div className="reply-message-area">
                <div className="reply-message-label">MESSAGE</div>
                <textarea
                  className="reply-textarea"
                  placeholder="Write your reply..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  disabled={isSendingReply}
                />
              </div>

              {/* Footer */}
              <div className="reply-footer">
                <p className="reply-footer-hint">Keep replies professional and helpful.</p>
                <div className="reply-footer-actions">
                  <button className="btn-cancel" onClick={() => setShowReplyModal(false)} disabled={isSendingReply}>
                    Cancel
                  </button>
                  <button className="btn-send" onClick={handleSendReply} disabled={isSendingReply || !replyText.trim()}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                    {isSendingReply ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {showDeleteConfirmModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirmModal(false)}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-header">
              <h3>Delete Message</h3>
            </div>
            <div className="confirm-content">
              <p>Are you sure you want to delete this message? This action cannot be undone.</p>
            </div>
            <div className="confirm-actions">
              <button
                className="cancel-btn"
                onClick={() => setShowDeleteConfirmModal(false)}
              >
                Cancel
              </button>
              <button
                className="ok-btn"
                onClick={confirmDeleteMessage}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactMessages;
