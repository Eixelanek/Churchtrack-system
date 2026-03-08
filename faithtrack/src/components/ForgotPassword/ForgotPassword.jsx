import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './ForgotPassword.css';
import { API_BASE_URL } from '../../config/api';

const ForgotPassword = () => {
  const [username, setUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusType, setStatusType] = useState(''); // success | error | ''
  const [statusMessage, setStatusMessage] = useState('');
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setStatusType('error');
      setStatusMessage('Please enter your username.');
      setRequestSubmitted(false);
      return;
    }

    setIsSubmitting(true);
    setStatusType('');
    setStatusMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/members/request_password_reset.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: trimmedUsername })
      });

      let data = null;
      try {
        data = await response.json();
      } catch (jsonError) {
        data = null;
      }

      if (response.ok && data?.success) {
        setStatusType('success');
        setStatusMessage(data.message || 'Your request has been sent to the administrator.');
        setRequestSubmitted(true);
      } else {
        const errorMessage = data?.message || 'We were unable to submit your request. Please try again.';
        setStatusType('error');
        setStatusMessage(errorMessage);
        setRequestSubmitted(false);
      }
    } catch (error) {
      setStatusType('error');
      setStatusMessage('Unable to reach the server. Please check your connection and try again.');
      setRequestSubmitted(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackClick = (event) => {
    event.preventDefault();
    document.body.classList.add('page-transitioning');
    setTimeout(() => {
      document.body.classList.remove('page-transitioning');
      navigate('/login');
    }, 200);
  };

  return (
    <div className="forgot-wrapper">
      <button
        onClick={handleBackClick}
        className="back-button animate-fade-in"
        aria-label="Back to login"
        title="Back to Sign In"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
        <span>Back to Sign In</span>
      </button>
      <div className="forgot-card">
        <div className="forgot-card__left">
          <header className="forgot-card__header">
            <div className="forgot-card__badge">Forgot Password</div>
            <h1>We'll help you get back in.</h1>
            <p>Enter your username and an administrator will generate a temporary password for you.</p>
          </header>

          {statusMessage && (
            <div className={`forgot-card__status forgot-card__status--${statusType || 'info'}`}>
              <div className="forgot-card__status-icon">
                {statusType === 'success' ? '✓' : statusType === 'error' ? '⚠️' : 'ℹ️'}
              </div>
              <div>{statusMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="forgot-card__form">
            <label htmlFor="username" className="forgot-card__label">Username</label>
            <div className="forgot-card__input">
              <span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </span>
              <input
                type="text"
                id="username"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                disabled={isSubmitting}
              />
            </div>

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Sending request…' : 'Send reset request'}
            </button>
          </form>

          <footer className="forgot-card__footer">
            <Link to="/login">Back to login</Link>
          </footer>
        </div>

        <div className="forgot-card__right">
          <section className={`forgot-card__steps${requestSubmitted ? ' submitted' : ''}`}>
            <h2>What happens next?</h2>
            <ul>
              <li>
                <strong>Notify.</strong> We alert the administrator that you requested a password reset.
              </li>
              <li>
                <strong>Generate.</strong> The admin will create a temporary password and contact you.
              </li>
              <li>
                <strong>Sign in.</strong> Use the temporary password, then set a new one immediately after logging in.
              </li>
            </ul>
            <div className="forgot-card__hint">
              Need help urgently? Reach out to your church administrator so they can prioritise your request.
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;