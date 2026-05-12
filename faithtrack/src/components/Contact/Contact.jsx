import React, { useState } from 'react';
import './Contact.css';
import '../transitions.css';
import { API_BASE_URL } from '../../config/api';

const Contact = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusType, setStatusType] = useState(''); // success | error | ''
  const [statusMessage, setStatusMessage] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusType('');
    setStatusMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/contact/send_message.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStatusType('success');
        setStatusMessage(data.message || 'Thank you for your message! We will get back to you soon.');
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          message: ''
        });
      } else {
        setStatusType('error');
        setStatusMessage(data.message || 'Failed to send message. Please try again.');
      }
    } catch (error) {
      setStatusType('error');
      setStatusMessage('Unable to reach the server. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="contact-section">
      <div className="contact-bg-decoration"></div>
      <div className="contact-centered-content">
        <h1 className="contact-main-title">CONNECT</h1>
        <hr className="contact-divider" />
        <div className="contact-subtitle">Reach Out to Us Today</div>
        <hr className="contact-divider" />
        <p className="contact-description">
          We are here to support you on your spiritual journey. Feel free to contact us for any questions, prayer requests, or to learn more about our church.
        </p>

        {statusMessage && (
          <div className={`contact-status contact-status--${statusType || 'info'}`}>
            <div className="contact-status-icon">
              {statusType === 'success' ? '✓' : statusType === 'error' ? '⚠️' : 'ℹ️'}
            </div>
            <div>{statusMessage}</div>
          </div>
        )}

        <form className="contact-form-modern" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="firstName">
                First name <span className="contact-required-asterisk">*</span>
              </label>

              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="lastName">
                Last name <span className="contact-required-asterisk">*</span>
              </label>

              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                required
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="email">
                Email <span className="contact-required-asterisk">*</span>
              </label>

              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="phone">Phone</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                pattern="[0-9\-\+\s\(\)]*"
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="message">
              Message <span className="contact-required-asterisk">*</span>
            </label>

            <textarea
              id="message"
              name="message"
              value={formData.message}
              onChange={handleChange}
              rows="5"
              required
            ></textarea>
          </div>
          <button type="submit" className="submit-btn-modern" disabled={isSubmitting}>
            {isSubmitting ? 'Sending message…' : 'Send Message'}
          </button>
        </form>
        
        <div className="admin-contact-info-wrapper">
          <div className="admin-contact-info">
            <div className="contact-info-item">
              <i className="fas fa-location-dot"></i>
              <p>Phase 2 Block 48 Lot 43 Southville 5A Brgy. Langkiwa, Biñan, Laguna, Philippines</p>
            </div>
            <div className="contact-info-item">
              <i className="fas fa-phone"></i>
              <p>09263124498 / 09293487310</p>
            </div>
            <div className="contact-info-item">
              <i className="fas fa-envelope"></i>
              <p>admin@clcc.life</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact; 