import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { API_BASE_URL } from '../../config/api';

const ProtectedRoute = ({ children, allowedUserType }) => {
  const location = useLocation();
  const token = localStorage.getItem('token');
  const userType = localStorage.getItem('userType');
  const userId = localStorage.getItem('userId');
  const sessionId = localStorage.getItem('sessionId');

  const [validating, setValidating] = useState(false);
  const [sessionValid, setSessionValid] = useState(null);

  // Only validate server-side for user types that have real session tokens
  const needsServerValidation = userType === 'admin' || userType === 'member' || userType === 'manager';

  useEffect(() => {
    if (!token || !userType || !needsServerValidation) return;

    // Skip validation if no sessionId stored (legacy fallback)
    if (!sessionId) {
      setSessionValid(true);
      return;
    }

    setValidating(true);

    const endpoint = userType === 'member'
      ? `${API_BASE_URL}/api/members/validate_session.php`
      : `${API_BASE_URL}/api/admin/validate_session.php`;

    const body = userType === 'member'
      ? { sessionId, memberId: parseInt(userId) }
      : { sessionId, adminId: parseInt(userId) };

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.active) {
          setSessionValid(true);
        } else {
          // Session invalidated — clear storage and redirect to login
          localStorage.clear();
          setSessionValid(false);
        }
      })
      .catch(() => {
        // On network error, allow access (offline tolerance)
        setSessionValid(true);
      })
      .finally(() => setValidating(false));
  }, [token, userType, sessionId, userId]);

  // Not authenticated at all
  if (!token || !userType) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Wrong user type
  if (allowedUserType && userType !== allowedUserType) {
    if (userType === 'admin') return <Navigate to="/admin" replace />;
    if (userType === 'manager') return <Navigate to="/manager" replace />;
    if (userType === 'member') return <Navigate to="/member" replace />;
    return <Navigate to="/login" replace />;
  }

  // Waiting for server validation
  if (needsServerValidation && sessionId && validating) return null;

  // Session was invalidated by server
  if (sessionValid === false) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;
