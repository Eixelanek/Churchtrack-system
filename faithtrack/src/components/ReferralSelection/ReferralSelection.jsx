import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './ReferralSelection.css';
import '../transitions.css';
import logoImage from '../../assets/logo.png';

const ReferralSelection = () => {
  const navigate = useNavigate();
  const [isExiting, setIsExiting] = useState(false);
  const [isEntering, setIsEntering] = useState(true);

  useEffect(() => {
    // Clear any transition classes from body when component mounts
    document.body.classList.remove('page-transitioning', 'page-transition-exit-active');
    
    // Add entering animation
    setTimeout(() => {
      setIsEntering(false);
    }, 100);
  }, []);

  const handleBackClick = (e) => {
    e.preventDefault();
    setIsExiting(true);
    
    // Apply the transition class to the entire page
    document.body.classList.add('page-transitioning');
    
    // Delay navigation to allow transition to complete
    setTimeout(() => {
      navigate('/login');
    }, 300);
  };

  const handleReferralOption = (hasReferral) => {
    // Navigate to register page with referral preference
    navigate('/register', { 
      state: { 
        hasReferral: hasReferral 
      } 
    });
  };

  return (
    <div className={`referral-container ${isExiting ? 'page-transition-exit-active' : ''} ${isEntering ? 'page-transition-enter-active' : ''}`}>
      <button 
        onClick={handleBackClick} 
        className="back-button animate-fade-in"
        aria-label="Back to login"
        title="Back to Sign In"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5"></path>
          <path d="M12 19l-7-7 7-7"></path>
        </svg>
        <span>Back to Sign In</span>
      </button>

      <div className="logo-section">
        <img src={logoImage} alt="ChurchTrack Logo" className="logo" />
        <h1 className="brand-name">ChurchTrack</h1>
      </div>

      <div className="referral-card">
        <h2 className="referral-title">Create Your Account</h2>
        <p className="referral-subtitle">Please select how you would like to register.</p>

        <div className="referral-options">
          <div 
            className="referral-option"
            onClick={() => handleReferralOption(true)}
          >
            <div className="option-icon">🤝</div>
            <h3 className="option-title">I Was Referred By Someone</h3>
            <p className="option-description">Register and indicate who referred you to ChurchTrack.</p>
          </div>

          <div 
            className="referral-option"
            onClick={() => handleReferralOption(false)}
          >
            <div className="option-icon">👤</div>
            <h3 className="option-title">I Was Not Referred</h3>
            <p className="option-description">Register directly without a referral.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReferralSelection;
