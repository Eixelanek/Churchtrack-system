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
  const [statusType, setStatusType] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusType('');
    setStatusMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/contact/send_message.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await response.json();

      if (response.ok && data.success) {
        setStatusType('success');
        setStatusMessage(data.message || 'Thank you for your message! We will get back to you soon.');
        setFormData({ firstName: '', lastName: '', email: '', phone: '', message: '' });
      } else {
        setStatusType('error');
        setStatusMessage(data.message || 'Failed to send message. Please try again.');
      }
    } catch {
      setStatusType('error');
      setStatusMessage('Unable to reach the server. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="contact-section">

      {/* ── PAGE HEADER ── */}
      <div className="contact-header">
        <span className="contact-eyebrow">Get in Touch</span>
        <h1 className="contact-title">Contact Us</h1>
        <p className="contact-desc">
          We are here to support you on your spiritual journey. Reach out for questions, prayer requests, or to learn more about our church.
        </p>
      </div>

      {/* ── BODY ── */}
      <div className="contact-body">

        {/* Left: info cards */}
        <div className="contact-info-col">
          <div className="contact-info-card">
            <div className="contact-info-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
            <div>
              <h3>Address</h3>
              <p>Phase 2 Block 48 Lot 43 Southville 5A Brgy. Langkiwa, Biñan, Laguna, Philippines</p>
            </div>
          </div>

          <div className="contact-info-card">
            <div className="contact-info-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.62 3.38 2 2 0 0 1 3.6 1.2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.69 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6.13 6.13l1.32-.91a2 2 0 0 1 2.11-.45c.91.33 1.85.56 2.81.69A2 2 0 0 1 22 16.92z"/>
              </svg>
            </div>
            <div>
              <h3>Phone</h3>
              <p>09293487310</p>
            </div>
          </div>

          <div className="contact-info-card">
            <div className="contact-info-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
              </svg>
            </div>
            <div>
              <h3>Email</h3>
              <p>admin@clcc.life</p>
            </div>
          </div>

          <div className="contact-note">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p>We typically respond within 1–2 business days. For urgent matters, please call us directly.</p>
          </div>
        </div>

        {/* Right: form */}
        <div className="contact-form-col">
          <div className="contact-form-card">
            <h2>Send us a message</h2>
            <p className="form-card-desc">Fill out the form below and we'll get back to you as soon as possible.</p>

            {statusMessage && (
              <div className={`contact-status contact-status--${statusType || 'info'}`}>
                <div className="contact-status-icon">
                  {statusType === 'success' ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><polyline points="20 6 9 17 4 12"/></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  )}
                </div>
                <span>{statusMessage}</span>
              </div>
            )}

            <form className="contact-form" onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="firstName">First name <span className="req">*</span></label>
                  <input type="text" id="firstName" name="firstName" value={formData.firstName} onChange={handleChange} required placeholder="Juan" />
                </div>
                <div className="form-field">
                  <label htmlFor="lastName">Last name <span className="req">*</span></label>
                  <input type="text" id="lastName" name="lastName" value={formData.lastName} onChange={handleChange} required placeholder="Dela Cruz" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="email">Email <span className="req">*</span></label>
                  <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} required placeholder="juan@email.com" />
                </div>
                <div className="form-field">
                  <label htmlFor="phone">Phone <span className="optional">(optional)</span></label>
                  <input type="tel" id="phone" name="phone" value={formData.phone} onChange={handleChange} pattern="[0-9\-\+\s\(\)]*" placeholder="09XX XXX XXXX" />
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="message">Message <span className="req">*</span></label>
                <textarea id="message" name="message" value={formData.message} onChange={handleChange} rows="5" required placeholder="Write your message here…"></textarea>
              </div>

              <button type="submit" className="contact-submit-btn" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <svg className="btn-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                    </svg>
                    Sending…
                  </>
                ) : (
                  <>
                    Send Message
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

    </section>
  );
};

export default Contact;
