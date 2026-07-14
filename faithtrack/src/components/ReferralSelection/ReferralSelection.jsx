import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './ReferralSelection.css';
import logoImage from '../../assets/logo.png';

const ReferralSelection = () => {
  const navigate = useNavigate();

  const handleReferralOption = (hasReferral) => {
    navigate('/register', { state: { hasReferral } });
  };

  return (
    <div className="referral-page">

      {/* ── LEFT PANEL ── */}
      <div className="referral-left">
        <Link to="/login" className="referral-back-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
          </svg>
          Back to Sign In
        </Link>

        <div className="referral-left-content">
          <img src={logoImage} alt="Church Logo" className="referral-logo" />
          <h1 className="referral-brand">ChurchTrack</h1>
          <p className="referral-brand-desc">
            Join our community. Register as a member of Christ-Like Christian Church.
          </p>
          <div className="referral-left-badges">
            <span className="referral-badge">Step 1 of 2</span>
            <span className="referral-badge">Free</span>
          </div>
        </div>

        <p className="referral-left-footer">© {new Date().getFullYear()} Christ-Like Christian Church</p>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="referral-right">
        <div className="referral-form-wrap">
          <h2 className="referral-title">Create your account</h2>
          <p className="referral-subtitle">Were you referred by an existing member of the church?</p>

          <div className="referral-options">

            <button
              className="referral-option"
              onClick={() => handleReferralOption(true)}
            >
              <div className="referral-option-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <div className="referral-option-body">
                <h3>Yes, I was referred</h3>
                <p>Someone from the church introduced me and I'd like to indicate who referred me.</p>
              </div>
              <svg className="referral-option-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>

            <button
              className="referral-option"
              onClick={() => handleReferralOption(false)}
            >
              <div className="referral-option-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <div className="referral-option-body">
                <h3>No, I wasn't referred</h3>
                <p>I found the church on my own and would like to register directly.</p>
              </div>
              <svg className="referral-option-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>

          <p className="referral-login-prompt">
            Already have an account?{' '}
            <Link to="/login" className="referral-login-link">Sign in here</Link>
          </p>
        </div>
      </div>

    </div>
  );
};

export default ReferralSelection;
