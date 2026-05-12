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
    if (!window.confirm('Are you sure you want to delete this message?')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/contact/delete_message.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: messageId })
      });

      const data = await response.json();
      if (data.success) {
        setSelectedMessage(null);
        loadMessages();
      }
    } catch (err) {
      console.error('Error deleting message:', err);
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
    </div>
  );
};

export default ContactMessages;
