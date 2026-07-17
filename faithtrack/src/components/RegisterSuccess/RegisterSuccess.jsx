import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './RegisterSuccess.css';
import logoImage from '../../assets/logo.png';

const RegisterSuccess = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const name = location.state?.name || 'Applicant';

  const steps = [
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
          <polyline points="22,6 12,13 2,6"/>
        </svg>
      ),
      label: 'Verify Your Email',
      desc: 'Check your inbox for a verification link and click it to confirm your email address.',
      color: 'blue',
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
      label: 'Manager Review',
      desc: 'A church manager will review your application first and forward it for final approval.',
      color: 'purple',
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      ),
      label: 'Admin Approval',
      desc: 'After the manager approves, an administrator gives the final sign-off on your membership.',
      color: 'green',
    },
    {
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      ),
      label: "You're In!",
      desc: "Once approved, you'll receive a notification and can log in to your member account.",
      color: 'amber',
    },
  ];

  return (
    <div className="rs-page">
      {/* Top bar */}
      <div className="rs-topbar">
        <div className="rs-topbar-brand">
          <img src={logoImage} alt="logo" />
          <span>FaithTrack</span>
        </div>
      </div>

      <div className="rs-body">
        {/* Hero */}
        <div className="rs-hero">
          <div className="rs-checkmark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h1 className="rs-title">Application Submitted!</h1>
          <p className="rs-subtitle">
            Thank you, <strong>{name}</strong>. Your membership application has been received.
            Here's what happens next.
          </p>
        </div>

        {/* Steps */}
        <div className="rs-steps">
          {steps.map((step, i) => (
            <div key={i} className={`rs-step rs-step--${step.color}`}>
              <div className="rs-step-num">{i + 1}</div>
              <div className="rs-step-icon">
                {step.icon}
              </div>
              <div className="rs-step-body">
                <div className="rs-step-label">{step.label}</div>
                <div className="rs-step-desc">{step.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Note */}
        <div className="rs-note">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p>
            The approval process typically takes 1–3 business days. You will be notified via email
            once your account is fully activated. Make sure to verify your email first — applications
            with unverified emails may be delayed.
          </p>
        </div>

        {/* CTA */}
        <button className="rs-btn" onClick={() => navigate('/login')}>
          Go to Login
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
            <line x1="5" y1="12" x2="19" y2="12"/>
            <polyline points="12 5 19 12 12 19"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default RegisterSuccess;
