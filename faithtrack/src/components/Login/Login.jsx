import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import './Login.css';
import '../transitions.css';
import logoImage from '../../assets/logo.png';
import { loadChurchSettingsFromAPI, updateFavicon } from '../../utils/churchSettings';
import { API_BASE_URL } from '../../config/api';

const safeMemberRedirectPath = (raw) => {
  if (raw == null || typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t.startsWith('/') || t.startsWith('//')) return null;
  return t;
};

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isEntering, setIsEntering] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const [churchLogo, setChurchLogo] = useState(logoImage);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const apiBaseUrl = API_BASE_URL;

  useEffect(() => {
    // Simple logo setup - no API calls
    setChurchLogo(logoImage);
  }, []);
  
  useEffect(() => {
    setIsEntering(true);
    document.body.classList.remove('page-transitioning');
    document.body.classList.remove('page-transition-exit-active');
    document.body.classList.add('page-transition-enter-active');

    const timer = setTimeout(() => {
      setIsEntering(false);
      document.body.classList.remove('page-transition-enter-active');
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userType = localStorage.getItem('userType');
    if (token) {
      if (userType === 'admin') navigate('/admin', { replace: true });
      else if (userType === 'member') navigate('/member', { replace: true });
      else if (userType === 'manager') navigate('/manager', { replace: true });
    }
  }, [navigate]);

  const handleBackClick = (e) => {
    e.preventDefault();
    setIsExiting(true);
    document.body.classList.add('page-transitioning');
    setTimeout(() => {
      navigate('/');
    }, 300);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setShowResendVerification(false);
    setResendMessage('');
    setIsLoading(true);

    try {
      const adminResponse = await fetch(`${apiBaseUrl}/api/admin/login.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password
        })
      });

      if (adminResponse.ok) {
        const adminData = await adminResponse.json();
        // Only treat as successful admin login if we have an ID
        // If "User not found", continue to try other login types
        if (adminData.id) {
          localStorage.setItem('token', adminData.token || '');
          localStorage.setItem('userType', 'admin');
          localStorage.setItem('userId', adminData.id);
          localStorage.setItem('username', adminData.username);
          if (adminData.session_id) {
            localStorage.setItem('sessionId', adminData.session_id);
          } else {
            localStorage.removeItem('sessionId');
          }
          navigate('/admin', { replace: true });
          return;
        }
      } else {
        // Non-OK response from admin login
        const adminData = await adminResponse.json().catch(() => ({}));
        // If password was wrong (user exists but wrong password), stop here
        if (adminData.message && adminData.message.toLowerCase().includes('invalid password')) {
          setError('Incorrect password. Please try again.');
          setIsLoading(false);
          return;
        }
        // "User not found" in admin — continue to try manager and member
      }

      const managerResponse = await fetch(`${apiBaseUrl}/api/manager/login.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password
        })
      });

      if (managerResponse.ok) {
        const managerData = await managerResponse.json();
        // Only treat as successful manager login if we have an ID
        if (managerData.id) {
          localStorage.setItem('token', managerData.token || managerData.session_id || '');
          localStorage.setItem('userType', 'manager');
          localStorage.setItem('userId', managerData.id);
          localStorage.setItem('username', managerData.username);
          if (managerData.session_id) {
            localStorage.setItem('sessionId', managerData.session_id);
          } else {
            localStorage.removeItem('sessionId');
          }
          navigate('/manager', { replace: true });
          return;
        }
        // If no ID, continue to member login (user not found as manager)
      } else {
        // Non-OK response from manager login
        const managerData = await managerResponse.json().catch(() => ({}));
        // If password was wrong (user exists as manager but wrong password), stop here
        if (managerData.message && managerData.message.toLowerCase().includes('invalid')) {
          setError('Incorrect password. Please try again.');
          setIsLoading(false);
          return;
        }
        // Not found as manager — continue to member login
      }

      const memberResponse = await fetch(`${apiBaseUrl}/api/members/login.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password
        })
      });

      const memberData = await memberResponse.json();

      if (memberResponse.ok) {
        localStorage.setItem('token', memberData.token || memberData.session_id || '');
        localStorage.setItem('userType', 'member');
        localStorage.setItem('userId', memberData.id);
        localStorage.setItem('username', memberData.username);
        if (memberData.session_id) {
          localStorage.setItem('sessionId', memberData.session_id);
        } else {
          localStorage.removeItem('sessionId');
        }
        localStorage.setItem('memberName', memberData.name);
        localStorage.setItem('memberStatus', memberData.status || 'active');
        if (memberData.email != null && String(memberData.email).trim() !== '') {
          localStorage.setItem('memberEmail', memberData.email);
        } else {
          localStorage.removeItem('memberEmail');
        }
        localStorage.setItem('memberBirthday', memberData.birthday);

        if (memberData.must_change_password) {
          localStorage.setItem('mustChangePassword', 'true');
          if (memberData.temp_password_expires_at) {
            localStorage.setItem('tempPasswordExpiresAt', memberData.temp_password_expires_at);
          } else {
            localStorage.removeItem('tempPasswordExpiresAt');
          }
          if (typeof window !== 'undefined') {
            window.sessionStorage.setItem('memberLastLoginPassword', password);
          }
        } else {
          localStorage.removeItem('mustChangePassword');
          localStorage.removeItem('tempPasswordExpiresAt');
          if (typeof window !== 'undefined') {
            window.sessionStorage.removeItem('memberLastLoginPassword');
          }
        }

        if (memberData.requires_email_verification) {
          localStorage.setItem('requiresEmailVerification', 'true');
          if (typeof window !== 'undefined') {
            window.sessionStorage.setItem('memberLastLoginPassword', password);
          }
        } else {
          localStorage.removeItem('requiresEmailVerification');
          if (!memberData.must_change_password && typeof window !== 'undefined') {
            window.sessionStorage.removeItem('memberLastLoginPassword');
          }
        }

        if (memberData.requires_email_setup) {
          localStorage.setItem('requiresEmailSetup', 'true');
          if (memberData.is_adult_email_setup) {
            localStorage.setItem('isAdultEmailSetup', 'true');
          }
          if (typeof window !== 'undefined') {
            window.sessionStorage.setItem('memberLastLoginPassword', password);
          }
        } else {
          localStorage.removeItem('requiresEmailSetup');
          localStorage.removeItem('isAdultEmailSetup');
        }

        const redirectAfterLogin = safeMemberRedirectPath(searchParams.get('redirect'));
        navigate(redirectAfterLogin || '/member', { replace: true });
      } else {
        if (memberData?.code === 'EMAIL_NOT_VERIFIED') {
          setShowResendVerification(true);
        }
        setError(memberData.message || 'Login failed. Please check your credentials.');
      }
    } catch (err) {

      if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        setError('Server is starting up (this takes 30 seconds on first use). Please wait a moment and try again.');
      } else {
        setError(`Network error: ${err.message}. Please check if the server is running.`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  const handleResendVerification = async () => {
    setResendMessage('');
    setResendLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/members/resend_verification_email.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to resend verification email.');
      }
      setResendMessage(data.message || 'Verification email sent. Check your inbox and spam folder.');
    } catch (err) {
      setResendMessage(err.message || 'Unable to resend verification email.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className={`login-container ${isEntering ? 'page-transition-enter-active' : ''} ${isExiting ? 'page-transition-exit-active' : ''}`}>
      <button
        onClick={handleBackClick}
        className="back-button animate-fade-in"
        aria-label="Back to home"
        title="Back to Home"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
        <span className="back-button-text">Back to Home</span>
      </button>
      <div className="logo-section">
        <img src={churchLogo} alt="ChurchTrack Logo" className="logo" />
        <h1 className="brand-name">ChurchTrack</h1>
      </div>

      <div className="login-box">
        <h2 className="welcome-text">
          Welcome to
          <br />
          ChurchTrack
        </h2>

        {error && (
          <div className="error-message">
            <div className="error-icon">⚠️</div>
            <div className="error-text">{error}</div>
          </div>
        )}
        {showResendVerification && (
          <div className="resend-verification-box">
            <div className="resend-verification-label">
              Need a new link?
            </div>
            <button
              type="button"
              className="resend-verification-btn"
              onClick={handleResendVerification}
              disabled={resendLoading || isLoading}
            >
              {resendLoading ? 'Sending new link...' : 'Resend verification email'}
            </button>
            {resendMessage && <div className="resend-verification-message">{resendMessage}</div>}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <div className="input-container">
              <input
                type="text"
                id="username"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-container">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={togglePasswordVisibility}
                tabIndex="-1"
                disabled={isLoading}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="helper-links">
            <Link to="/forgot-password" className="forgot-link">Forgot Password?</Link>
            <Link to="/referral-selection" className="register-link">Register Now</Link>
          </div>

          <button
            type="submit"
            className={`submit-button ${isLoading ? 'loading' : ''}`}
            style={{ width: '105%', marginLeft: '-2.5%' }}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="button-loading-content">
                <span className="spinner"></span>
                <span className="loading-text">Signing In...</span>
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
