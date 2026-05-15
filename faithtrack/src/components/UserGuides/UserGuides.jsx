import React, { useState } from 'react';
import './UserGuides.css';

const UserGuides = () => {
  const [expandedSection, setExpandedSection] = useState(null);

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const guides = [
    {
      id: 'getting-started',
      title: '🚀 Getting Started',
      content: [
        {
          subtitle: 'How to Register',
          text: 'Click "Register" on the login page. Fill in your details including name, email, and birthday. Create a username and password. You\'ll receive a verification email - click the link to confirm your account.'
        },
        {
          subtitle: 'How to Login',
          text: 'Go to the login page and enter your username and password. If you forgot your password, click "Forgot Password" and follow the email instructions to reset it.'
        },
        {
          subtitle: 'Setting Up Your Profile',
          text: 'After logging in, go to "Profile Settings" to add your photo, contact number, and address. This helps the church stay connected with you.'
        }
      ]
    },
    {
      id: 'attendance',
      title: '✅ Attendance & Check-in',
      content: [
        {
          subtitle: 'How to Check In',
          text: 'On the Dashboard, click "Scan QR Code" then scan the QR code displayed by the manager using your phone camera.'
        },
        {
          subtitle: 'View Your Attendance',
          text: 'Go to "My Attendance" to see all your check-ins. You can view attendance by month and see which events you attended.'
        },
        {
          subtitle: 'Attendance Statistics',
          text: 'Your dashboard shows your attendance percentage and recent check-ins. This helps you track your participation in church activities.'
        }
      ]
    },
    {
      id: 'family',
      title: '👨‍👩‍👧‍👦 Family & Relationships',
      content: [
        {
          subtitle: 'Adding Family Members',
          text: 'Go to "Family" and click "Add Family Member". Enter their details and select your relationship (Parent, Child, Sibling, Spouse, or Other). They\'ll receive an invitation to join.'
        },
        {
          subtitle: 'Managing Family Connections',
          text: 'In your Family section, you can see all connected family members. You can view their profiles and manage relationships from here.'
        },
        {
          subtitle: 'Parent Approval (For Minors)',
          text: 'If you\'re under 18, a parent must approve your account. They\'ll receive an email with an approval link. Once approved, your account is fully active.'
        }
      ]
    },
    {
      id: 'account',
      title: '⚙️ Account Settings',
      content: [
        {
          subtitle: 'Update Your Profile',
          text: 'Go to "Profile Settings" to change your name, email, phone number, address, or profile picture. Click "Save" after making changes.'
        },
        {
          subtitle: 'Change Your Password',
          text: 'In "Profile Settings", click "Change Password". Enter your current password and your new password twice to confirm.'
        },
        {
          subtitle: 'Reset Forgotten Password',
          text: 'On the login page, click "Forgot Password". Enter your email and follow the instructions sent to your inbox to reset your password.'
        }
      ]
    },
    {
      id: 'dashboard',
      title: '📊 Dashboard & Statistics',
      content: [
        {
          subtitle: 'Understanding Your Dashboard',
          text: 'Your dashboard shows your attendance percentage, recent check-ins, upcoming events, and birthday reminders. It\'s your quick overview of church activities.'
        },
        {
          subtitle: 'Viewing Statistics',
          text: 'See your attendance trends, most attended events, and monthly participation. This helps you understand your involvement in the church.'
        },
        {
          subtitle: 'Upcoming Events',
          text: 'Check the "Upcoming Events" section to see what\'s coming up. You can view event details and check in when they happen.'
        }
      ]
    },
    {
      id: 'troubleshooting',
      title: '🆘 Troubleshooting',
      content: [
        {
          subtitle: 'Can\'t Login?',
          text: 'Make sure you\'re using the correct username and password. If you forgot your password, use the "Forgot Password" option. If you haven\'t verified your email yet, check your inbox for the verification link.'
        },
        {
          subtitle: 'QR Code Not Working?',
          text: 'Make sure your camera has permission to access. Try refreshing the page or using a different browser. If the issue persists, ask the manager to manually check you in.'
        },
        {
          subtitle: 'Still Having Issues?',
          text: 'Contact us through the Help Center or use the Contact Us form. Our support team will help you as soon as possible.'
        }
      ]
    }
  ];

  return (
    <section className="user-guides-section">
      <div className="guides-container">
        <div className="guides-header">
          <h1>User Guides</h1>
          <p>Learn how to use ChurchTrack. Click on any topic to expand.</p>
        </div>

        <div className="guides-content">
          {guides.map((guide) => (
            <div key={guide.id} className="guide-card">
              <button
                className="guide-header-btn"
                onClick={() => toggleSection(guide.id)}
              >
                <span className="guide-title">{guide.title}</span>
                <span className={`expand-icon ${expandedSection === guide.id ? 'expanded' : ''}`}>
                  ▼
                </span>
              </button>

              {expandedSection === guide.id && (
                <div className="guide-body">
                  {guide.content.map((item, idx) => (
                    <div key={idx} className="guide-item">
                      <h3 className="guide-subtitle">{item.subtitle}</h3>
                      <p className="guide-text">{item.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="guides-footer">
          <p>Still need help? <a href="/contact">Contact us here</a></p>
        </div>
      </div>
    </section>
  );
};

export default UserGuides;
