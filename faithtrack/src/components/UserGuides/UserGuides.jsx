import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import './UserGuides.css';

const guides = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg>
    ),
    items: [
      {
        subtitle: 'How to Register',
        text: "Click \"Register\" on the login page. Fill in your details including name, email, and birthday. Create a username and password. You'll receive a verification email — click the link to confirm your account.",
      },
      {
        subtitle: 'How to Login',
        text: 'Go to the login page and enter your username and password. If you forgot your password, click "Forgot Password" and follow the email instructions to reset it.',
      },
      {
        subtitle: 'Setting Up Your Profile',
        text: 'After logging in, go to "Profile Settings" to add your photo, contact number, and address. This helps the church stay connected with you.',
      },
    ],
  },
  {
    id: 'attendance',
    title: 'Attendance & Check-in',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    ),
    items: [
      {
        subtitle: 'How to Check In',
        text: 'On the Dashboard, click "Scan QR Code" then scan the QR code displayed by the manager using your phone camera.',
      },
      {
        subtitle: 'View Your Attendance',
        text: 'Go to "My Attendance" to see all your check-ins. You can view attendance by month and see which events you attended.',
      },
      {
        subtitle: 'Attendance Statistics',
        text: 'Your dashboard shows your attendance percentage and recent check-ins. This helps you track your participation in church activities.',
      },
    ],
  },
  {
    id: 'family',
    title: 'Family & Relationships',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    items: [
      {
        subtitle: 'Adding Family Members',
        text: "Go to \"Family\" and click \"Add Family Member\". Enter their details and select your relationship (Parent, Child, Sibling, Spouse, or Other). They'll receive an invitation to join.",
      },
      {
        subtitle: 'Managing Family Connections',
        text: 'In your Family section, you can see all connected family members. You can view their profiles and manage relationships from here.',
      },
      {
        subtitle: 'Parent Approval (For Minors)',
        text: "If you're under 18, a parent must approve your account. They'll receive an email with an approval link. Once approved, your account is fully active.",
      },
    ],
  },
  {
    id: 'account',
    title: 'Account Settings',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
    items: [
      {
        subtitle: 'Update Your Profile',
        text: 'Go to "Profile Settings" to change your name, email, phone number, address, or profile picture. Click "Save" after making changes.',
      },
      {
        subtitle: 'Change Your Password',
        text: 'In "Profile Settings", click "Change Password". Enter your current password and your new password twice to confirm.',
      },
      {
        subtitle: 'Reset Forgotten Password',
        text: 'On the login page, click "Forgot Password". Enter your email and follow the instructions sent to your inbox to reset your password.',
      },
    ],
  },
  {
    id: 'dashboard',
    title: 'Dashboard & Statistics',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
    items: [
      {
        subtitle: 'Understanding Your Dashboard',
        text: "Your dashboard shows your attendance percentage, recent check-ins, upcoming events, and birthday reminders. It's your quick overview of church activities.",
      },
      {
        subtitle: 'Viewing Statistics',
        text: 'See your attendance trends, most attended events, and monthly participation. This helps you understand your involvement in the church.',
      },
      {
        subtitle: 'Upcoming Events',
        text: "Check the \"Upcoming Events\" section to see what's coming up. You can view event details and check in when they happen.",
      },
    ],
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ),
    items: [
      {
        subtitle: "Can't Login?",
        text: "Make sure you're using the correct username and password. If you forgot your password, use the \"Forgot Password\" option. If you haven't verified your email yet, check your inbox for the verification link.",
      },
      {
        subtitle: 'QR Code Not Working?',
        text: 'Make sure your camera has permission to access. Try refreshing the page or using a different browser. If the issue persists, ask the manager to manually check you in.',
      },
      {
        subtitle: 'Still Having Issues?',
        text: 'Contact us through the Help Center or use the Contact Us form. Our support team will help you as soon as possible.',
      },
    ],
  },
];

const UserGuides = () => {
  const [activeId, setActiveId] = useState(null);

  const toggle = (id) => setActiveId(activeId === id ? null : id);

  return (
    <section className="guides-section">

      {/* ── PAGE HEADER ── */}
      <div className="guides-header">
        <span className="guides-eyebrow">Documentation</span>
        <h1 className="guides-title">User Guides</h1>
        <p className="guides-desc">
          Everything you need to know about using ChurchTrack. Select a topic to get started.
        </p>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="guides-body">

        {/* Left: topic list — on mobile this becomes a full accordion */}
        <nav className="guides-sidebar">
          {guides.map((g) => (
            <React.Fragment key={g.id}>
              <button
                className={`sidebar-item ${activeId === g.id ? 'active' : ''}`}
                onClick={() => toggle(g.id)}
              >
                <span className="sidebar-icon">{g.icon}</span>
                <span className="sidebar-label">{g.title}</span>
                <svg className={`sidebar-chevron ${activeId === g.id ? 'open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
              {/* Inline panel — visible only on mobile via CSS */}
              {activeId === g.id && (
                <div className="mobile-inline-panel">
                  <div className="panel-items">
                    {g.items.map((item, i) => (
                      <div key={i} className="panel-item">
                        <div className="panel-item-number">{i + 1}</div>
                        <div className="panel-item-body">
                          <h3>{item.subtitle}</h3>
                          <p>{item.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </React.Fragment>
          ))}
        </nav>

        {/* Right: desktop content panel */}
        <div className="guides-panel">
          {activeId === null ? (
            <div className="guides-placeholder">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
              <p>Select a topic on the left to view its guide.</p>
            </div>
          ) : (
            guides.filter(g => g.id === activeId).map((g) => (
              <div key={g.id} className="guides-content animate-panel-in">
                <div className="panel-header">
                  <div className="panel-icon">{g.icon}</div>
                  <h2>{g.title}</h2>
                </div>
                <div className="panel-items">
                  {g.items.map((item, i) => (
                    <div key={i} className="panel-item">
                      <div className="panel-item-number">{i + 1}</div>
                      <div className="panel-item-body">
                        <h3>{item.subtitle}</h3>
                        <p>{item.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── FOOTER CTA ── */}
      <div className="guides-footer">
        <p>Still need help?</p>
        <NavLink to="/contact" className="guides-footer-link">Contact us</NavLink>
      </div>

    </section>
  );
};

export default UserGuides;
