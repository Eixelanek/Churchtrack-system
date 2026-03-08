import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Login.css';
import '../transitions.css';
import logoImage from '../../assets/logo.png';
import { loadChurchSettingsFromAPI, updateFavicon } from '../../utils/churchSettings';
import { API_BASE_URL } from '../../config/api';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEntering, setIsEntering] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const [churchLogo, setChurchLogo] = useState(logoImage);
  const navigate = useNavigate();
  const apiBaseUrl = API_BASE_URL;
  
  // Debug: log the API URL
  console.log('API Base URL:', apiBaseUrl);

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
    if (localStorage.getItem('token') && localStorage.getItem('userType') === 'admin') {
      navigate('/admin', { replace: true });
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
        // If no ID but response is OK, check if it's "User not found" - if so, continue to member login
        // Otherwise it's a malformed response
        if (!adminData.message || !adminData.message.includes('not found')) {
          setError('Invalid login response. Please check your credentials and try again.');
          return;
        }
        // User not found in admin, continue to try manager and member
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
          localStorage.setItem('token', 'manager-token');
          localStorage.setItem('userType', 'manager');
          localStorage.setItem('userId', managerData.id);
          localStorage.setItem('username', managerData.username);
          navigate('/manager', { replace: true });
          return;
        }
        // If no ID, continue to member login (user not found as manager)
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
        localStorage.setItem('token', 'member-token');
        localStorage.setItem('userType', 'member');
        localStorage.setItem('userId', memberData.id);
        localStorage.setItem('username', memberData.username);
        localStorage.setItem('memberName', memberData.name);
        localStorage.setItem('memberEmail', memberData.email);
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

        navigate('/member', { replace: true });
      } else {
        setError(memberData.message || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      console.error('Login error:', err);
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
            className="submit-button"
            style={{ width: '105%', marginLeft: '-2.5%' }}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="loading-spinner"></span>
                Signing In...
              </>
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
