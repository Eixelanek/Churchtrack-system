import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

// This is a simplified example of a protected route
// In a real app, you would check for an auth token or session
const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const location = useLocation();
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  if (!token) {
    // Redirect to login if not authenticated
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // Check if admin access is required
  if (requireAdmin && user.role !== 'admin') {
    // Redirect to home if admin access is required but user is not an admin
    return <Navigate to="/home" replace />;
  }

  // If admin access is not required and user is an admin, redirect to admin dashboard
  if (!requireAdmin && user.role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }
  
  return children;
};

export default ProtectedRoute;