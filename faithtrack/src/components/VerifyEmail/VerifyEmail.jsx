import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { API_BASE_URL } from '../../config/api';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('Verifying your email...');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const token = (searchParams.get('token') || '').trim();
    if (!token) {
      setMessage('Verification token is missing. Please use the link from your email.');
      setSuccess(false);
      setLoading(false);
      return;
    }

    const verify = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/members/verify_email.php?token=${encodeURIComponent(token)}`);
        const result = await response.json();

        if (response.ok && result.success) {
          setSuccess(true);
          setMessage(result.message || 'Email verified successfully.');
        } else {
          setSuccess(false);
          setMessage(result.message || 'Unable to verify email.');
        }
      } catch (error) {
        setSuccess(false);
        setMessage('Unable to connect to verification service. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [searchParams]);

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px', background: '#f8fafc' }}>
      <div style={{ width: '100%', maxWidth: '560px', background: '#fff', borderRadius: '14px', boxShadow: '0 8px 30px rgba(15, 23, 42, 0.08)', padding: '28px' }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', color: '#0f172a' }}>Email Verification</h1>
        <p style={{ margin: 0, color: success ? '#166534' : '#475569' }}>
          {loading ? 'Please wait while we verify your email...' : message}
        </p>
        <div style={{ marginTop: '18px' }}>
          <Link to="/login" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>
            Go to Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;

