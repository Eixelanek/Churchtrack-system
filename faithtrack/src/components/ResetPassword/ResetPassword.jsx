import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import './ResetPassword.css';
import { API_BASE_URL } from '../../config/api';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
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
          window.location.href = '/login';
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

  return (
    <div className="reset-wrapper">
      <div className="reset-container">
        <Link to="/login" className="reset-back-link">← Back to login</Link>

        <div className="reset-form-box">
          <h1>Reset Password</h1>
          <p>Enter a new password for your account</p>

          {statusMessage && (
            <div className={`reset-alert reset-alert--${statusType || 'info'}`}>
              {statusMessage}
            </div>
          )}

          {!token ? (
            <div className="reset-error">
              <p>Invalid or missing reset link. Please request a new password reset.</p>
              <Link to="/forgot-password" className="reset-btn">Request New Link</Link>
            </div>
          ) : statusType !== 'success' ? (
            <form onSubmit={handleSubmit} className="reset-form">
              <div className="form-group">
                <label htmlFor="newPassword">New Password</label>
                <div className="input-wrapper">
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
                    className="toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex="-1"
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <div className="input-wrapper">
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
                    className="toggle-btn"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex="-1"
                  >
                    {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={isSubmitting} className="reset-btn reset-btn--primary">
                {isSubmitting ? 'Resetting…' : 'Reset Password'}
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
