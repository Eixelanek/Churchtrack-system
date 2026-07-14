import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './ForgotPassword.css';
import logoImage from '../../assets/logo.png';
import { API_BASE_URL } from '../../config/api';

const ForgotPassword = () => {
  const [username, setUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusType, setStatusType] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) {
      setStatusType('error');
      setStatusMessage('Please enter your username.');
      return;
    }

    setIsSubmitting(true);
    setStatusType('');
    setStatusMessage('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/members/request_password_reset.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmed }),
      });
      let data = null;
      try { data = await res.json(); } catch (_) {}

      if (res.ok && data?.success) {
        setStatusType('success');
        setStatusMessage(data.message || 'Your request has been sent to the administrator.');
        setRequestSubmitted(true);
        setCountdown(0);
      } else if (res.status === 429 && data?.waitMinutes) {
        setStatusType('error');
        setStatusMessage(data.message || `Too many requests. Please try again in ${data.waitMinutes} minutes.`);
        setRequestSubmitted(false);
        setCountdown(data.waitMinutes * 60);
      } else {
        setStatusType('error');
        setStatusMessage(data?.message || 'We were unable to submit your request. Please try again.');
        setRequestSubmitted(false);
      }
    } catch {
      setStatusType('error');
      setStatusMessage('Unable to reach the server. Please check your connection and try again.');
      setRequestSubmitted(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
          <polyline points="22,6 12,13 2,6"/>
        </svg>
      ),
      label: 'Email sent',
      desc: 'A password reset link is sent to your registered email address.',
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
      ),
      label: 'Click the link',
      desc: 'Open the email and click the reset link inside.',
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      ),
      label: 'New password',
      desc: 'Create a new password and sign in right away.',
    },
  ];

  return (
    <div className="fp-page">

      {/* ── LEFT PANEL ── */}
      <div className="fp-left">
        <Link to="/login" className="fp-back-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
          </svg>
          Back to Sign In
        </Link>

        <div className="fp-left-content">
          <img src={logoImage} alt="Church Logo" className="fp-logo" />
          <h1 className="fp-brand">ChurchTrack</h1>
          <p className="fp-brand-desc">
            We'll help you regain access to your account in just a few steps.
          </p>

          {/* Steps */}
          <div className="fp-steps">
            {steps.map((s, i) => (
              <div key={i} className={`fp-step ${requestSubmitted ? 'fp-step--done' : ''}`}>
                <div className="fp-step-icon">{s.icon}</div>
                <div className="fp-step-body">
                  <span className="fp-step-label">{s.label}</span>
                  <span className="fp-step-desc">{s.desc}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="fp-hint">
            The reset link expires in 24 hours. Check your spam folder if you don't see the email.
          </div>
        </div>

        <p className="fp-left-footer">© {new Date().getFullYear()} Christ-Like Christian Church</p>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="fp-right">
        <div className="fp-form-wrap">
          <h2 className="fp-title">Forgot your password?</h2>
          <p className="fp-subtitle">Enter your username and we'll send a reset link to your registered email.</p>

          {statusMessage && (
            <div className={`fp-alert fp-alert--${statusType || 'info'}`}>
              <div className="fp-alert-icon">
                {statusType === 'success' ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                )}
              </div>
              <span>{statusMessage}</span>
            </div>
          )}

          <form className="fp-form" onSubmit={handleSubmit}>
            <div className="fp-field">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                placeholder="e.g. juan_delacruz"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                disabled={isSubmitting}
              />
            </div>

            <button
              type="submit"
              className="fp-submit-btn"
              disabled={isSubmitting || countdown > 0}
            >
              {isSubmitting ? (
                <>
                  <svg className="fp-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                  Sending…
                </>
              ) : countdown > 0 ? (
                `Try again in ${countdown}s`
              ) : (
                <>
                  Send reset link
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          <p className="fp-login-prompt">
            Remembered your password?{' '}
            <Link to="/login" className="fp-login-link">Sign in here</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
