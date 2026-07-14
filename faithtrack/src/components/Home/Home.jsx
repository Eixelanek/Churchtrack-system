import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import logoImage from '../../assets/logo.png';
import './Home.css';
import '../transitions.css';
import { loadChurchSettingsFromAPI, updateFavicon } from '../../utils/churchSettings';

import img1 from '../../assets/floating1.png';
import img2 from '../../assets/floating2.png';
import img3 from '../../assets/floating3.png';
import img4 from '../../assets/floating4.png';
import img5 from '../../assets/floating5.png';
import img6 from '../../assets/floating6.png';

function Home() {
  const navigate = useNavigate();
  const [isExiting, setIsExiting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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
        settings.homepage_image_6 || img6,
      ]);
    };

    const loadChurchSettings = async () => {
      const stored = localStorage.getItem('churchSettings');
      if (stored) {
        try { applySettings(JSON.parse(stored)); } catch (_) {}
      }
      const freshSettings = await loadChurchSettingsFromAPI();
      if (freshSettings) applySettings(freshSettings);
    };

    loadChurchSettings();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuOpen && !e.target.closest('.hamburger-menu')) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [menuOpen]);

  const handleJoinUsClick = (e) => {
    e.preventDefault();
    setIsExiting(true);
    setTimeout(() => navigate('/login'), 300);
  };

  const titleLines = homepageHeroTitle.split('\n');

  return (
    <div className={`home-wrapper ${isExiting ? 'page-transition-exit-active' : ''}`}>

      {/* ── NAVBAR ── */}
      <nav className="home-nav">
        <div className="home-nav-logo">
          <img src={churchLogo} alt="Church Logo" />
          <span className="home-nav-church-name">
            <span className="home-nav-full">{churchName}</span>
            <span className="home-nav-short">CLCC</span>
          </span>
        </div>

        <div className="home-nav-links">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>Home</NavLink>
          <NavLink to="/about" className={({ isActive }) => isActive ? 'active' : ''}>About</NavLink>
          <NavLink to="/guides" className={({ isActive }) => isActive ? 'active' : ''}>Guides</NavLink>
          <NavLink to="/contact" className={({ isActive }) => isActive ? 'active' : ''}>Contact</NavLink>
        </div>

        <div className="hamburger-menu">
          <button
            className={`hamburger-btn ${menuOpen ? 'open' : ''}`}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
          {menuOpen && (
            <div className="mobile-drawer">
              <NavLink to="/" end onClick={() => setMenuOpen(false)}>Home</NavLink>
              <NavLink to="/about" onClick={() => setMenuOpen(false)}>About</NavLink>
              <NavLink to="/guides" onClick={() => setMenuOpen(false)}>Guides</NavLink>
              <NavLink to="/contact" onClick={() => setMenuOpen(false)}>Contact</NavLink>
            </div>
          )}
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="home-hero">
        {/* Left: text content */}
        <div className="hero-left">
          <span className="hero-eyebrow">Welcome to {churchName}</span>
          <h1 className="hero-title">
            {titleLines.map((line, i) => (
              <React.Fragment key={i}>
                {line}{i < titleLines.length - 1 && <br />}
              </React.Fragment>
            ))}
          </h1>
          <p className="hero-subtitle">{homepageHeroSubtitle}</p>
          <div className="hero-actions">
            <NavLink to="/login" className="btn-primary" onClick={handleJoinUsClick}>
              Join Us
            </NavLink>
            <NavLink to="/about" className="btn-secondary">
              Learn More
            </NavLink>
          </div>
          <div className="hero-stats">
            <div className="stat-item">
              <span className="stat-number">✝</span>
              <span className="stat-label">Faith-Centered</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-number">🤝</span>
              <span className="stat-label">Community Driven</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-number">🌱</span>
              <span className="stat-label">Growing Together</span>
            </div>
          </div>
        </div>

        {/* Right: image mosaic */}
        <div className="hero-right">
          <div className="img-mosaic">
            <div className="mosaic-col mosaic-col-left">
              <div className="mosaic-img tall">
                <img src={homepageImages[0]} alt="Community 1" />
              </div>
              <div className="mosaic-img short">
                <img src={homepageImages[1]} alt="Community 2" />
              </div>
            </div>
            <div className="mosaic-col mosaic-col-mid">
              <div className="mosaic-img short">
                <img src={homepageImages[2]} alt="Community 3" />
              </div>
              <div className="mosaic-img tall">
                <img src={homepageImages[3]} alt="Community 4" />
              </div>
            </div>
            <div className="mosaic-col mosaic-col-right">
              <div className="mosaic-img medium">
                <img src={homepageImages[4]} alt="Community 5" />
              </div>
              <div className="mosaic-img medium">
                <img src={homepageImages[5]} alt="Community 6" />
              </div>
            </div>
          </div>
          {/* Decorative accent */}
          <div className="mosaic-accent"></div>
        </div>
      </section>

      {/* ── FEATURES STRIP ── */}
      <section className="home-features">
        <div className="feature-card">
          <div className="feature-icon-wrap">📋</div>
          <h3>Member Management</h3>
          <p>Easily register, track, and manage your congregation members in one place.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon-wrap">📅</div>
          <h3>Event Attendance</h3>
          <p>QR-based check-in system for fast and accurate attendance tracking.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon-wrap">📊</div>
          <h3>Reports & Insights</h3>
          <p>Generate detailed reports and gain insights into your church's growth.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon-wrap">🙏</div>
          <h3>Guest Check-In</h3>
          <p>Welcome visitors with a simple guest check-in that connects them to the community.</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="home-footer">
        <p>© {new Date().getFullYear()} {churchName}. Powered by ChurchTrack.</p>
      </footer>
    </div>
  );
}

export default Home;
