import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import './ResetPassword.css';
import { API_BASE_URL } from '../../config/api';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusType, setStatusType] = useState(''); // success | error | ''
  const [statusMessage, setStatusMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatusType('error');
      setStatusMessage('Invalid reset link. Please request a new password reset.');
    }
  }, [token]);

  const validatePassword = () => {
    if (!newPassword.trim()) {
      setStatusType('error');
      setStatusMessage('Please enter a new password.');
      return false;
    }

    if (newPassword.length < 8) {
      setStatusType('error');
      setStatusMessage('Password must be at least 8 characters long.');
      return false;
    }

    if (newPassword !== confirmPassword) {
      setStatusType('error');
      setStatusMessage('Passwords do not match.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validatePassword()) {
      return;
    }

    setIsSubmitting(true);
    setStatusType('');
    setStatusMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/members/reset_password.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token,
          newPassword
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStatusType('success');
        setStatusMessage(data.message || 'Password reset successfully!');
        setNewPassword('');
        setConfirmPassword('');
        
        // Redirect to login after 2 seconds
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        setStatusType('error');
        setStatusMessage(data.message || 'Failed to reset password. Please try again.');
      }
    } catch (error) {
      setStatusType('error');
      setStatusMessage('Unable to reach the server. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackClick = (event) => {
    event.preventDefault();
    navigate('/login');
  };

  return (
    <div className="reset-wrapper">
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

      <div className="reset-card">
        <div className="reset-card__left">
          <header className="reset-card__header">
            <div className="reset-card__badge">Reset Password</div>
            <h1>Create a new password</h1>
            <p>Enter a strong password to secure your account.</p>
          </header>

          {statusMessage && (
            <div className={`reset-card__status reset-card__status--${statusType || 'info'}`}>
              <div className="reset-card__status-icon">
                {statusType === 'success' ? '✓' : statusType === 'error' ? '⚠️' : 'ℹ️'}
              </div>
              <div>{statusMessage}</div>
            </div>
          )}

          {!token ? (
            <div className="reset-card__error-box">
              <p>Invalid or missing reset token. Please request a new password reset.</p>
              <Link to="/forgot-password" className="reset-card__link">
                Request Password Reset
              </Link>
            </div>
          ) : statusType !== 'success' ? (
            <form onSubmit={handleSubmit} className="reset-card__form">
              <div className="form-group">
                <label htmlFor="newPassword" className="reset-card__label">New Password</label>
                <div className="reset-card__input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="newPassword"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isSubmitting}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex="-1"
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword" className="reset-card__label">Confirm Password</label>
                <div className="reset-card__input-wrapper">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isSubmitting}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex="-1"
                  >
                    {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              <div className="password-requirements">
                <p>Password must:</p>
                <ul>
                  <li className={newPassword.length >= 8 ? 'met' : ''}>Be at least 8 characters long</li>
                </ul>
              </div>

              <button type="submit" disabled={isSubmitting} className="reset-card__submit">
                {isSubmitting ? 'Resetting password…' : 'Reset Password'}
              </button>
            </form>
          ) : null}

          <footer className="reset-card__footer">
            <Link to="/login">Back to login</Link>
          </footer>
        </div>

        <div className="reset-card__right">
          <section className="reset-card__info">
            <h2>Password Security Tips</h2>
            <ul>
              <li>Use a mix of uppercase and lowercase letters</li>
              <li>Include numbers and special characters</li>
              <li>Avoid using personal information</li>
              <li>Don't reuse old passwords</li>
              <li>Keep your password confidential</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
