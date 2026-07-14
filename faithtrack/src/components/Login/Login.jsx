import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import './Login.css';
import logoImage from '../../assets/logo.png';
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userType = localStorage.getItem('userType');
    if (token) {
      if (userType === 'admin') navigate('/admin', { replace: true });
      else if (userType === 'member') navigate('/member', { replace: true });
      else if (userType === 'manager') navigate('/manager', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setShowResendVerification(false);
    setResendMessage('');
    setIsLoading(true);

    try {
      // Try admin
      const adminRes = await fetch(`${API_BASE_URL}/api/admin/login.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (adminRes.ok) {
        const adminData = await adminRes.json();
        if (adminData.id) {
          localStorage.setItem('token', adminData.token || '');
          localStorage.setItem('userType', 'admin');
          localStorage.setItem('userId', adminData.id);
          localStorage.setItem('username', adminData.username);
          if (adminData.session_id) localStorage.setItem('sessionId', adminData.session_id);
          else localStorage.removeItem('sessionId');
          navigate('/admin', { replace: true });
          return;
        }
      } else {
        const adminData = await adminRes.json().catch(() => ({}));
        if (adminData.message?.toLowerCase().includes('invalid password')) {
          setError('Invalid username or password.');
          setIsLoading(false);
          return;
        }
      }

      // Try manager
      const managerRes = await fetch(`${API_BASE_URL}/api/manager/login.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (managerRes.ok) {
        const managerData = await managerRes.json();
        if (managerData.id) {
          localStorage.setItem('token', managerData.token || managerData.session_id || '');
          localStorage.setItem('userType', 'manager');
          localStorage.setItem('userId', managerData.id);
          localStorage.setItem('username', managerData.username);
          if (managerData.session_id) localStorage.setItem('sessionId', managerData.session_id);
          else localStorage.removeItem('sessionId');
          navigate('/manager', { replace: true });
          return;
        }
      } else {
        const managerData = await managerRes.json().catch(() => ({}));
        if (managerData.message?.toLowerCase().includes('invalid password')) {
          setError('Invalid username or password.');
          setIsLoading(false);
          return;
        }
      }

      // Try member
      const memberRes = await fetch(`${API_BASE_URL}/api/members/login.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const memberData = await memberRes.json();

      if (memberRes.ok) {
        localStorage.setItem('token', memberData.token || memberData.session_id || '');
        localStorage.setItem('userType', 'member');
        localStorage.setItem('userId', memberData.id);
        localStorage.setItem('username', memberData.username);
        if (memberData.session_id) localStorage.setItem('sessionId', memberData.session_id);
        else localStorage.removeItem('sessionId');
        localStorage.setItem('memberName', memberData.name);
        localStorage.setItem('memberStatus', memberData.status || 'active');
        if (memberData.email?.trim()) localStorage.setItem('memberEmail', memberData.email);
        else localStorage.removeItem('memberEmail');
        localStorage.setItem('memberBirthday', memberData.birthday);

        if (memberData.requires_email_verification) {
          localStorage.setItem('requiresEmailVerification', 'true');
          window.sessionStorage.setItem('memberLastLoginPassword', password);
        } else {
          localStorage.removeItem('requiresEmailVerification');
          window.sessionStorage.removeItem('memberLastLoginPassword');
        }
        if (memberData.requires_email_setup) {
          localStorage.setItem('requiresEmailSetup', 'true');
          if (memberData.is_adult_email_setup) localStorage.setItem('isAdultEmailSetup', 'true');
          window.sessionStorage.setItem('memberLastLoginPassword', password);
        } else {
          localStorage.removeItem('requiresEmailSetup');
          localStorage.removeItem('isAdultEmailSetup');
        }

        const redirect = safeMemberRedirectPath(searchParams.get('redirect'));
        navigate(redirect || '/member', { replace: true });
      } else {
        if (memberData?.code === 'EMAIL_NOT_VERIFIED') setShowResendVerification(true);
        const msg = memberData.message || '';
        const isGeneric = msg.toLowerCase().includes('user not found') || msg.toLowerCase().includes('invalid password');
        setError(isGeneric ? 'Invalid username or password.' : msg || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        setError('Server is starting up. Please wait a moment and try again.');
      } else {
        setError(`Network error: ${err.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResendMessage('');
    setResendLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/members/resend_verification_email.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || 'Unable to resend verification email.');
      setResendMessage(data.message || 'Verification email sent. Check your inbox.');
    } catch (err) {
      setResendMessage(err.message || 'Unable to resend verification email.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="login-page">

      {/* ── LEFT PANEL ── */}
      <div className="login-left">
        <Link to="/" className="login-back-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
          </svg>
          Back
        </Link>

        <div className="login-left-content">
          <img src={logoImage} alt="Church Logo" className="login-logo" />
          <h1 className="login-brand">ChurchTrack</h1>
          <p className="login-brand-desc">
            Attendance monitoring and membership management for Christ-Like Christian Church.
          </p>
          <div className="login-left-badges">
            <span className="login-badge">Secure</span>
            <span className="login-badge">Fast</span>
            <span className="login-badge">Reliable</span>
          </div>
        </div>

        <p className="login-left-footer">© {new Date().getFullYear()} Christ-Like Christian Church</p>
      </div>

      {/* ── RIGHT PANEL (form) ── */}
      <div className="login-right">
        <div className="login-form-wrap">
          <h2 className="login-form-title">Sign in</h2>
          <p className="login-form-sub">Enter your credentials to access your account.</p>

          {/* Error */}
          {error && (
            <div className="login-alert login-alert--error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Resend verification */}
          {showResendVerification && (
            <div className="login-alert login-alert--info">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
              </svg>
              <div>
                <p>Your email is not verified yet.</p>
                <button
                  type="button"
                  className="resend-link-btn"
                  onClick={handleResendVerification}
                  disabled={resendLoading}
                >
                  {resendLoading ? 'Sending…' : 'Resend verification email'}
                </button>
                {resendMessage && <p className="resend-msg">{resendMessage}</p>}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-field">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                placeholder="e.g. juan_delacruz"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="username"
              />
            </div>

            <div className="login-field">
              <div className="login-field-header">
                <label htmlFor="password">Password</label>
                <Link to="/forgot-password" className="login-forgot">Forgot password?</Link>
              </div>
              <div className="login-password-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="login-eye-btn"
                  onClick={() => setShowPassword(p => !p)}
                  tabIndex="-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button type="submit" className="login-submit-btn" disabled={isLoading}>
              {isLoading ? (
                <>
                  <svg className="login-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                  Signing in…
                </>
              ) : 'Sign in'}
            </button>
          </form>

          <p className="login-register-prompt">
            Don't have an account?{' '}
            <Link to="/referral-selection" className="login-register-link">Register here</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
