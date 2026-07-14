import React, { useState } from 'react';
import './About.css';
import '../transitions.css';

const churchInfo = [
  {
    label: 'Address',
    value: 'Phase 2 Block 48 Lot 43 Southville 5A Brgy. Langkiwa, Biñan, Laguna, Philippines',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
      </svg>
    ),
  },
  {
    label: 'Mission',
    value: 'To Glorify the Lord and make Christ-Like Christians who will strive to make Christ-Like Christians.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ),
  },
  {
    label: 'Vision',
    value: 'To have a wonderful future together with the Christian, who will do the will of God just as Christ Jesus did, to follow the will of His Father.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
      </svg>
    ),
  },
  {
    label: 'Statement of Faith',
    value: 'We believe that Jesus Christ is our Lord and Savior sent by God the Father — that nothing can save us except through Him — and that the Holy Spirit was sent by Him to guide us as we walk our path with God.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      </svg>
    ),
  },
];

const systemFeatures = [
  {
    label: 'QR Code Attendance',
    value: 'Fast, reliable check-in using scannable QR codes assigned to each member.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
        <line x1="14" y1="14" x2="14" y2="14"/><line x1="18" y1="14" x2="21" y2="14"/><line x1="14" y1="18" x2="14" y2="21"/><line x1="18" y1="18" x2="21" y2="21"/>
      </svg>
    ),
  },
  {
    label: 'Family Tree Connection',
    value: 'Link households and relatives to visualize and manage family relationships within the church.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    label: 'Member Records',
    value: 'Maintain comprehensive and organized records of all church members in one place.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
  },
  {
    label: 'Attendance Reports',
    value: 'Generate detailed PDF and Excel reports on church attendance and member participation.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
];

const About = () => {
  const [activeTab, setActiveTab] = useState('church');

  return (
    <section className="about-section">

      {/* ── PAGE HEADER ── */}
      <div className="about-header">
        <span className="about-eyebrow">Who We Are</span>
        <h1 className="about-title">About Us</h1>
        <p className="about-desc">
          Learn more about Christ-Like Christian Church and the ChurchTrack system that serves our community.
        </p>

        {/* Tab switcher */}
        <div className="about-tabs">
          <button
            className={`about-tab ${activeTab === 'church' ? 'active' : ''}`}
            onClick={() => setActiveTab('church')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            Our Church
          </button>
          <button
            className={`about-tab ${activeTab === 'system' ? 'active' : ''}`}
            onClick={() => setActiveTab('system')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
            Our System
          </button>
        </div>
      </div>

      {/* ── CHURCH TAB ── */}
      {activeTab === 'church' && (
        <div className="about-body animate-tab-in">

          {/* Intro banner */}
          <div className="about-banner">
            <div className="about-banner-text">
              <h2>Christ-Like Christian Church</h2>
              <p>
                A Christ-centered church located in Biñan, Laguna, Philippines. Our mission is to preach the Gospel, disciple believers, and build a strong, prayerful community rooted in God's Word.
              </p>
            </div>
            <div className="about-banner-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
              </svg>
              <span>Est. Biñan, Laguna</span>
            </div>
          </div>

          {/* Info grid */}
          <div className="about-info-grid">
            {churchInfo.map((item) => (
              <div className="about-info-card" key={item.label}>
                <div className="info-card-icon">{item.icon}</div>
                <div className="info-card-body">
                  <h3>{item.label}</h3>
                  <p>{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SYSTEM TAB ── */}
      {activeTab === 'system' && (
        <div className="about-body animate-tab-in">

          {/* Intro banner */}
          <div className="about-banner">
            <div className="about-banner-text">
              <h2>ChurchTrack System</h2>
              <p>
                A membership and attendance monitoring system built specifically for Christ-Like Christian Church. It supports the church's mission by enabling accurate tracking and organized records.
              </p>
            </div>
            <div className="about-banner-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
              <span>Capstone Project</span>
            </div>
          </div>

          {/* Purpose strip */}
          <div className="about-purpose">
            <div className="purpose-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <div>
              <h3>Purpose</h3>
              <p>Provide attendance monitoring and membership management tailored for Christ-Like Christian Church — making administration simpler so the community can focus on what matters.</p>
            </div>
          </div>

          {/* Features grid */}
          <h3 className="about-features-heading">Features</h3>
          <div className="about-features-grid">
            {systemFeatures.map((f) => (
              <div className="about-feature-card" key={f.label}>
                <div className="feature-card-icon">{f.icon}</div>
                <h4>{f.label}</h4>
                <p>{f.value}</p>
              </div>
            ))}
          </div>

          {/* Meta info */}
          <div className="about-meta">
            <div className="about-meta-item">
              <span className="meta-label">Users</span>
              <span className="meta-value">Super Admin · Manager · Members</span>
            </div>
            <div className="about-meta-divider"></div>
            <div className="about-meta-item">
              <span className="meta-label">Developer</span>
              <span className="meta-value">Developed as a capstone project by CKM, with guidance and prayer.</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default About;
