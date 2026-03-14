import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import logoImage from '../../assets/logo.png';
import './Home.css';
import '../transitions.css';
import { loadChurchSettingsFromAPI, updateFavicon } from '../../utils/churchSettings';

// Placeholder images, replace with your own
import img1 from '../../assets/floating1.png';
import img2 from '../../assets/floating2.png';
import img3 from '../../assets/floating3.png';
import img4 from '../../assets/floating4.png';
import img5 from '../../assets/floating5.png';
import img6 from '../../assets/floating6.png';

function Home() {
  const navigate = useNavigate();
  const [isExiting, setIsExiting] = useState(false);
  const buttonRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const [churchLogo, setChurchLogo] = useState(logoImage);
  const [churchName, setChurchName] = useState('Christ-Like Christian Church');
  const [homepageImages, setHomepageImages] = useState([img1, img2, img3, img4, img5, img6]);
  const [homepageHeroTitle, setHomepageHeroTitle] = useState('SHAPING FUTURES\nWITH FAITH');
  const [homepageHeroSubtitle, setHomepageHeroSubtitle] = useState('Join us for an uplifting experience');
  
  useEffect(() => {
    let isMounted = true;

    const applySettings = (settings) => {
      if (!isMounted || !settings) return;

      if (settings.churchLogo) {
        setChurchLogo(settings.churchLogo);
        updateFavicon(settings.churchLogo);
      } else {
        setChurchLogo(logoImage);
      }

      setChurchName(settings.churchName || 'Christ-Like Christian Church');
      setHomepageHeroTitle(settings.homepage_hero_title || 'SHAPING FUTURES\nWITH FAITH');
      setHomepageHeroSubtitle(settings.homepage_hero_subtitle || 'Join us for an uplifting experience');
      setHomepageImages([
        settings.homepage_image_1 || img1,
        settings.homepage_image_2 || img2,
        settings.homepage_image_3 || img3,
        settings.homepage_image_4 || img4,
        settings.homepage_image_5 || img5,
        settings.homepage_image_6 || img6
      ]);
    };

    const loadChurchSettings = async () => {
      const stored = localStorage.getItem('churchSettings');
      if (stored) {
        try {
          const settings = JSON.parse(stored);
          applySettings(settings);
        } catch (error) {
          console.error('Error parsing church settings:', error);
        }
      }

      const freshSettings = await loadChurchSettingsFromAPI();
      if (freshSettings) {
        applySettings(freshSettings);
      }
    };

    loadChurchSettings();

    return () => {
      isMounted = false;
    };
  }, []);
  
  useEffect(() => {
    // Add event listener to close mobile menu when clicking outside
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
  
  useEffect(() => {
    // Add event listener to the entire document to capture clicks outside our component
    const handleClickOutside = (event) => {
      if (isExiting && buttonRef.current && !buttonRef.current.contains(event.target)) {
        // If we're exiting and click is outside our button, cancel the transition
        setIsExiting(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExiting]);
  
  const handleJoinUsClick = (e) => {
    e.preventDefault();
    setIsExiting(true);
    
    // Apply the transition class to the entire page
    document.body.classList.add('page-transitioning');
    
    // Delay navigation to allow transition to complete
    setTimeout(() => {
      navigate('/login');
    }, 300);
  };
  
  return (
    <div className="home-minimal-wrapper">
      <div className="home-bg-decoration"></div>
      {/* Top Navigation */}
      <nav className="minimal-nav">
        <div className="nav-logo">
          <img src={churchLogo} alt="Church Logo" />
          <span className="nav-church-name">
            <span className="full-name">{churchName}</span>
            <span className="short-name">CLCC</span>
          </span>
        </div>
        {/* Desktop Navigation Links */}
        <div className="nav-links desktop-nav">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>Home</NavLink>
          <NavLink to="/about" className={({ isActive }) => isActive ? 'active' : ''}>About</NavLink>
          <NavLink to="/contact" className={({ isActive }) => isActive ? 'active' : ''}>Contact</NavLink>
        </div>
        {/* Mobile Hamburger Menu */}
        <div className="hamburger-menu">
          <input type="checkbox" id="menu-toggle" />
          <label htmlFor="menu-toggle" className="menu-btn">
            <span></span>
          </label>
          <div className="mobile-menu">
            <NavLink to="/" end>Home</NavLink>
            <NavLink to="/about">About</NavLink>
            <NavLink to="/contact">Contact</NavLink>
          </div>
        </div>
      </nav>

      {/* Floating Images */}
      <img src={homepageImages[0]} className="floating-img floating-img-1" alt="homepage1" />
      <img src={homepageImages[1]} className="floating-img floating-img-2" alt="homepage2" />
      <img src={homepageImages[2]} className="floating-img floating-img-3" alt="homepage3" />
      <img src={homepageImages[3]} className="floating-img floating-img-4" alt="homepage4" />
      <img src={homepageImages[4]} className="floating-img floating-img-5" alt="homepage5" />
      <img src={homepageImages[5]} className="floating-img floating-img-6" alt="homepage6" />

      {/* Central Hero Section */}
      <div className="hero-container">
        <main className="minimal-hero">
          <div className="hero-content">
            <h1 className="minimal-title">
              {homepageHeroTitle.split('\n').map((line, index) => (
                <React.Fragment key={index}>
                  {line}
                  {index !== homepageHeroTitle.split('\n').length - 1 && <br />}
                </React.Fragment>
              ))}
            </h1>
            <p className="minimal-subtext">{homepageHeroSubtitle}</p>
            <NavLink 
              to="/login" 
              ref={buttonRef}
              className={`minimal-cta-btn ${isExiting ? 'page-transition-exit-active' : ''}`}
              onClick={handleJoinUsClick}
            >
              Join Us
            </NavLink>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Home;