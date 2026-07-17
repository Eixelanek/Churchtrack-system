import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import Login from './components/Login/Login';
import Register from './components/Register/Register';
import Home from './components/Home/Home';
import Admin from './components/Admin/Admin';
import ForgotPassword from './components/ForgotPassword/ForgotPassword';
import ResetPassword from './components/ResetPassword/ResetPassword';
import About from './components/About/About';
import Contact from './components/Contact/Contact';
import UserGuides from './components/UserGuides/UserGuides';
import ReferralSelection from './components/ReferralSelection/ReferralSelection';
import Member from './components/Members/Member';
import GuestCheckIn from './components/GuestCheckIn/GuestCheckIn';
import Manager from './components/Manager/Manager';
import VerifyEmail from './components/VerifyEmail/VerifyEmail';
import RegisterSuccess from './components/RegisterSuccess/RegisterSuccess';
import PublicNav from './components/common/PublicNav';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';
import OfflineIndicator from './components/OfflineIndicator/OfflineIndicator';
import SyncStatus from './components/SyncStatus/SyncStatus';
import Toast from './components/Toast/Toast';
import logoImage from './assets/logo.png';
import { syncManager } from './utils/syncManager';
import { initPullToRefresh } from './utils/pullToRefresh';

const App = () => {
  // Add state to track if app is ready
  const [appReady, setAppReady] = React.useState(false);

  React.useEffect(() => {
    if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
      const newUrl = `https://${window.location.host}${window.location.pathname}${window.location.search}`;
      window.location.replace(newUrl);
    }
  }, []);

  // Ensure app is interactive after reload (fixes "preview mode" issue)
  React.useEffect(() => {
    // Force service worker to update
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.update();
        });
      });
    }

    // Check if localStorage is accessible
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, 'test');
      const testValue = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      
      if (testValue !== 'test') {
        throw new Error('localStorage read/write failed');
      }
      
      console.log('localStorage is accessible, app is ready');
      setAppReady(true);
    } catch (e) {
      console.error('localStorage is not accessible:', e);
      // Still mark as ready - app should work even without localStorage
      console.warn('Continuing without localStorage access');
      setAppReady(true);
    }
  }, []);

  // Start auto-sync
  React.useEffect(() => {
    if (!appReady) return;
    
    console.log('App mounted, starting auto-sync...');
    syncManager.startAutoSync();
    
    // Initialize pull-to-refresh
    const cleanup = initPullToRefresh();
    
    // Also trigger immediate sync if online and has pending records
    if (navigator.onLine) {
      console.log('Online detected, will sync in 2 seconds...');
      setTimeout(() => {
        console.log('Triggering immediate sync...');
        syncManager.syncAttendance();
      }, 2000); // Wait 2 seconds after app loads
    } else {
      console.log('Offline detected, sync will wait for online event');
    }
    
    return cleanup;
  }, [appReady]);

  // Add outside click functionality for hamburger menu
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      const menuToggle = document.getElementById('menu-toggle');
      const menuBtn = document.querySelector('.menu-btn');
      const mobileMenu = document.querySelector('.mobile-menu');
      
      // Check if menu is open and click is outside the menu and menu button
      if (menuToggle && menuToggle.checked && 
          mobileMenu && !mobileMenu.contains(event.target) &&
          menuBtn && !menuBtn.contains(event.target)) {
        menuToggle.checked = false;
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  return (
    <Router>
      <OfflineIndicator />
      <SyncStatus />
      <Toast />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/referral-selection" element={<ReferralSelection />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/register-success" element={<RegisterSuccess />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/checkin" element={<Navigate to="/" replace />} />
        <Route path="/guest-checkin" element={<GuestCheckIn />} />
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute allowedUserType="admin">
              <Admin />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/member" 
          element={
            <ProtectedRoute allowedUserType="member">
              <Member />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/manager" 
          element={
            <ProtectedRoute allowedUserType="manager">
              <Manager />
            </ProtectedRoute>
          }
        />
        <Route path="/members/:memberId" element={<Member />} />
        {/* Home is now public landing page */}
        <Route path="/home" element={<Home />} />
        <Route path="/about" element={
          <><PublicNav /><About /></>
        } />
        <Route path="/contact" element={
          <><PublicNav /><Contact /></>
        } />
        <Route path="/guides" element={
          <><PublicNav /><UserGuides /></>
        } />
        <Route path="/" element={<Home />} />
      </Routes>
    </Router>
  );
};

export default App;
