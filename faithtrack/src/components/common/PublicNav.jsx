import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import logoImage from '../../assets/logo.png';
import './PublicNav.css';

const PublicNav = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="pub-nav">
      <div className="pub-nav-logo">
        <img src={logoImage} alt="Church Logo" />
        <span className="pub-nav-name">
          <span className="pub-nav-full">Christ-Like Christian Church</span>
          <span className="pub-nav-short">CLCC</span>
        </span>
      </div>

      {/* Desktop links */}
      <div className="pub-nav-links">
        <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>Home</NavLink>
        <NavLink to="/about" className={({ isActive }) => isActive ? 'active' : ''}>About</NavLink>
        <NavLink to="/guides" className={({ isActive }) => isActive ? 'active' : ''}>Guides</NavLink>
        <NavLink to="/contact" className={({ isActive }) => isActive ? 'active' : ''}>Contact</NavLink>
      </div>

      {/* Mobile hamburger */}
      <div className="pub-hamburger">
        <button
          className={`pub-hamburger-btn ${menuOpen ? 'open' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
        {menuOpen && (
          <div className="pub-mobile-drawer">
            <NavLink to="/" end onClick={() => setMenuOpen(false)}>Home</NavLink>
            <NavLink to="/about" onClick={() => setMenuOpen(false)}>About</NavLink>
            <NavLink to="/guides" onClick={() => setMenuOpen(false)}>Guides</NavLink>
            <NavLink to="/contact" onClick={() => setMenuOpen(false)}>Contact</NavLink>
          </div>
        )}
      </div>
    </nav>
  );
};

export default PublicNav;
