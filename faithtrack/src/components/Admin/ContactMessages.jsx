import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

  const MAX_REPLY_LENGTH = 2000;

  const replyModal = showReplyModal ? (
    <div
      className="reply-modal-overlay"
      onClick={() => !isSendingReply && setShowReplyModal(false)}
      role="presentation"
    >
      <div
        className="reply-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reply-modal-title"
      >
        {/* Header */}
        <div className="reply-modal-header">
          <div className="reply-modal-header-main">
            <div>
              <h3 id="reply-modal-title" className="reply-modal-header-title">Reply to Message</h3>
              <p className="reply-modal-header-sub">
                {selectedMessage?.first_name} {selectedMessage?.last_name}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="reply-modal-close-box"
            onClick={() => !isSendingReply && setShowReplyModal(false)}
            disabled={isSendingReply}
            aria-label="Close reply modal"
          >
            ×
          </button>
        </div>

        {/* Original message thread */}
        <div className="reply-modal-thread">
          <div className="reply-thread-label">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Original message
          </div>
          <p className="reply-thread-text">
            {selectedMessage?.message?.length > 160
              ? selectedMessage.message.substring(0, 160) + '…'
              : selectedMessage?.message}
          </p>
        </div>

        {/* Body */}
        <div className="reply-modal-body">
          {/* To field */}
          <div className="reply-compose-row">
            <span className="reply-compose-row-label">To</span>
            <div className="reply-to-chip">
              <span className="reply-to-avatar" aria-hidden="true">
                {(selectedMessage?.first_name || '?').charAt(0).toUpperCase()}
              </span>
              <span className="reply-to-name">{selectedMessage?.first_name} {selectedMessage?.last_name}</span>
              <span className="reply-to-email-text">&lt;{selectedMessage?.email}&gt;</span>
            </div>
          </div>

          <div className="reply-compose-divider" />

          {/* Message textarea */}
          <div className="reply-compose-message-wrap">
            <textarea
              id="reply-message-textarea"
              className="reply-textarea--modal"
              placeholder="Write your reply here…"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value.slice(0, MAX_REPLY_LENGTH))}
              disabled={isSendingReply}
              rows={6}
              aria-label="Reply message"
            />
            <div className={`reply-char-counter ${replyText.length >= MAX_REPLY_LENGTH ? 'reply-char-counter--limit' : ''}`}>
              {replyText.length} / {MAX_REPLY_LENGTH}
            </div>
          </div>

          {/* Actions — inside body so always visible */}
          <div className="reply-modal-actions">
            <button
              type="button"
              className="reply-modal-btn reply-modal-btn--cancel"
              onClick={() => { setShowReplyModal(false); setReplyText(''); }}
              disabled={isSendingReply}
            >
              Discard
            </button>
            <button
              type="button"
              className="reply-modal-btn reply-modal-btn--send"
              onClick={handleSendReply}
              disabled={isSendingReply || !replyText.trim()}
            >
              {isSendingReply ? (
                <>
                  <span className="reply-spinner" aria-hidden="true" />
                  Sending…
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Send Reply
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  ) : null;

  return (
    <>
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
    {replyModal && createPortal(replyModal, document.body)}
    </>
  );
};

export default ContactMessages;
