import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const ProtectedRoute = ({ children, allowedUserType }) => {
  const location = useLocation();
  const token = localStorage.getItem('token');
  const userType = localStorage.getItem('userType');
  
  // Redirect to login if not authenticated
  if (!token || !userType) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if user has the required user type
  if (allowedUserType && userType !== allowedUserType) {
    // Redirect to appropriate dashboard based on user type
    if (userType === 'admin') {
      return <Navigate to="/admin" replace />;
    } else if (userType === 'manager') {
      return <Navigate to="/manager" replace />;
    } else if (userType === 'member') {
      return <Navigate to="/member" replace />;
    }
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

export default ProtectedRoute;