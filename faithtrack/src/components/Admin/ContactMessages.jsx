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
          <div className="reply-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="reply-modal-title">
            <div className="reply-modal-header">
              <div className="reply-modal-header-main">
                <span className="reply-modal-header-icon-box" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M22 6l-10 7L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <h3 id="reply-modal-title" className="reply-modal-header-title">Send reply</h3>
              </div>
              <button
                type="button"
                className="reply-modal-close-box"
                onClick={() => !isSendingReply && setShowReplyModal(false)}
                disabled={isSendingReply}
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="reply-modal-body">
              <div className="reply-field-label" id="reply-to-label">TO</div>
              <div className="reply-to-field" role="group" aria-labelledby="reply-to-label">
                <span className="reply-to-avatar" aria-hidden="true">
                  {(selectedMessage?.email || '?').charAt(0).toUpperCase()}
                </span>
                <span className="reply-to-email-text">{selectedMessage?.email}</span>
              </div>

              <label className="reply-field-label" htmlFor="reply-message-textarea">MESSAGE</label>
              <textarea
                id="reply-message-textarea"
                className="reply-textarea reply-textarea--modal"
                placeholder="Type your reply here..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                disabled={isSendingReply}
                rows={6}
              />

              <div className="reply-info-banner" role="status">
                <span className="reply-info-banner-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4M12 8h.01" />
                  </svg>
                </span>
                <p className="reply-info-banner-text">
                  Keep your reply professional and helpful. The recipient will receive this via email.
                </p>
              </div>
            </div>

            <div className="reply-modal-footer">
              <button type="button" className="btn-cancel" onClick={() => setShowReplyModal(false)} disabled={isSendingReply}>
                Cancel
              </button>
              <button type="button" className="btn-send" onClick={handleSendReply} disabled={isSendingReply || !replyText.trim()}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                {isSendingReply ? 'Sending...' : 'Send reply'}
              </button>
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
