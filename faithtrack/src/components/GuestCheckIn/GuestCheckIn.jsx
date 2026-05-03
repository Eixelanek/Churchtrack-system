import React from 'react';
import { useNavigate } from 'react-router-dom';
import './GuestCheckIn.css';
import logoImage from '../../assets/logo2.png';

/**
 * Standalone guest QR self-check-in was removed. Guests are checked in by managers/staff.
 * This route remains so old links fail gracefully.
 */
const GuestCheckIn = () => {
  const navigate = useNavigate();

  return (
    <div className="guest-checkin-container">
      <div className="guest-checkin-card">
        <header className="guest-checkin-header">
          <img src={logoImage} alt="Church Logo" className="guest-checkin-logo" />
          <h1>Guest check-in</h1>
          <p style={{ maxWidth: '28rem', margin: '0.75rem auto 0', lineHeight: 1.55, color: '#475569' }}>
            Visitor check-in is handled by church staff at the registration desk. If you are a member, use the main QR link and sign in on your device.
          </p>
        </header>
        <div style={{ padding: '0 1.5rem 1.5rem', textAlign: 'center' }}>
          <button type="button" className="guest-checkin-home-btn" onClick={() => navigate('/')}>
            Back to home
          </button>
        </div>
      </div>
    </div>
  );
};

export default GuestCheckIn;
