import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import Login from './components/Login/Login';
import Register from './components/Register/Register';
import Home from './components/Home/Home';
import Admin from './components/Admin/Admin';
import ForgotPassword from './components/ForgotPassword/ForgotPassword';
import About from './components/About/About';
import Contact from './components/Contact/Contact';
import ReferralSelection from './components/ReferralSelection/ReferralSelection';
import Member from './components/Members/Member';
import GuestCheckIn from './components/GuestCheckIn/GuestCheckIn';
import Manager from './components/Manager/Manager';
import CheckIn from './components/CheckIn/CheckIn';
import logoImage from './assets/logo.png';

// Protected Route component with session validation
const ProtectedRoute = ({ children, allowedUserType }) => {
  const [isValidating, setIsValidating] = React.useState(true);
  const [isValid, setIsValid] = React.useState(false);
  const [shouldRedirect, setShouldRedirect] = React.useState(false);

  React.useEffect(() => {
    const validateSession = async () => {
      const token = localStorage.getItem('token');
      const userType = localStorage.getItem('userType');
      const sessionId = localStorage.getItem('sessionId');
      const adminId = localStorage.getItem('userId');

      if (!token || (allowedUserType && userType !== allowedUserType)) {
        setIsValid(false);
        if (!token) {
          setShouldRedirect(true);
        }
        setIsValidating(false);
        return;
      }

      if (sessionId && adminId && userType === 'admin') {
        const baseUrl = window.location.origin;
        try {
          const response = await fetch(`${baseUrl}/api/admin/validate_session.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, adminId })
          });
          const result = await response.json();
          if (!result.success || !result.active) {
            localStorage.removeItem('token');
            localStorage.removeItem('userType');
            localStorage.removeItem('userId');
            localStorage.removeItem('username');
            localStorage.removeItem('sessionId');
            setIsValid(false);
            setIsValidating(false);
            setShouldRedirect(true);
            return;
          }
        } catch (error) {
          console.error('Session validation failed:', error);
        }
      }

      setIsValid(true);
      setIsValidating(false);
    };

    validateSession();
  }, [allowedUserType]);

  if (isValidating) {
    return null;
  }

  if (!isValid || shouldRedirect) {
    return <Navigate to="/login" />;
  }

  return children;
};

const App = () => {
  React.useEffect(() => {
    if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
      const newUrl = `https://${window.location.host}${window.location.pathname}${window.location.search}`;
      window.location.replace(newUrl);
    }
  }, []);

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
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/referral-selection" element={<ReferralSelection />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/checkin" element={<CheckIn />} />
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
          <>
            <div className="home-minimal-wrapper">
              <div className="header-bg-decoration"></div>
              <nav className="minimal-nav">
                <div className="nav-logo">
                  <img src={logoImage} alt="Church Logo" />
                  <span className="nav-church-name">
                    <span className="full-name">Christ-Like Christian Church</span>
                    <span className="short-name">CLCC</span>
                  </span>
                </div>
                <div className="nav-links desktop-nav">
                  <Link to="/">Home</Link>
                  <Link to="/about">About</Link>
                  <Link to="/contact">Contact</Link>
                </div>
                <div className="hamburger-menu">
                  <input type="checkbox" id="menu-toggle" />
                  <label htmlFor="menu-toggle" className="menu-btn">
                    <span></span>
                  </label>
                  <div className="mobile-menu">
                    <Link to="/" onClick={() => { const t = document.getElementById('menu-toggle'); if (t) t.checked = false; }}>Home</Link>
                    <Link to="/about" onClick={() => { const t = document.getElementById('menu-toggle'); if (t) t.checked = false; }}>About</Link>
                    <Link to="/contact" onClick={() => { const t = document.getElementById('menu-toggle'); if (t) t.checked = false; }}>Contact</Link>
                  </div>
                </div>
              </nav>
              <About />
            </div>
          </>
        } />
        <Route path="/contact" element={
          <>
            <div className="home-minimal-wrapper">
              <div className="header-bg-decoration"></div>
              <nav className="minimal-nav">
                <div className="nav-logo">
                  <img src={logoImage} alt="Church Logo" />
                  <span className="nav-church-name">
                    <span className="full-name">Christ-Like Christian Church</span>
                    <span className="short-name">CLCC</span>
                  </span>
                </div>
                <div className="nav-links desktop-nav">
                  <Link to="/">Home</Link>
                  <Link to="/about">About</Link>
                  <Link to="/contact">Contact</Link>
                </div>
                <div className="hamburger-menu">
                  <input type="checkbox" id="menu-toggle" />
                  <label htmlFor="menu-toggle" className="menu-btn">
                    <span></span>
                  </label>
                  <div className="mobile-menu">
                    <Link to="/" onClick={() => { const t = document.getElementById('menu-toggle'); if (t) t.checked = false; }}>Home</Link>
                    <Link to="/about" onClick={() => { const t = document.getElementById('menu-toggle'); if (t) t.checked = false; }}>About</Link>
                    <Link to="/contact" onClick={() => { const t = document.getElementById('menu-toggle'); if (t) t.checked = false; }}>Contact</Link>
                  </div>
                </div>
              </nav>
              <Contact />
            </div>
          </>
        } />
        <Route path="/" element={<Home />} />
      </Routes>
    </Router>
  );
};

export default App;