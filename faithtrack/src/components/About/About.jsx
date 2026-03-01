import React, { useState } from 'react';
import './About.css';
import '../transitions.css';

const About = () => {
  const [activeTab, setActiveTab] = useState('church');
  
  return (
    <section className="about-section">
      <div className="about-bg-decoration"></div>
      <div className="about-centered-content">
        <h1 className="about-main-title">ABOUT US</h1>
        <hr className="about-divider" />
        <p className="about-subtitle">Learn more about our church and system</p>
        
        <div className="about-tabs">
          <button 
            className={`tab-button ${activeTab === 'church' ? 'active' : ''}`}
            onClick={() => setActiveTab('church')}
          >
            <span className="tab-icon">🏛️</span> Our Church
          </button>
          <button 
            className={`tab-button ${activeTab === 'system' ? 'active' : ''}`}
            onClick={() => setActiveTab('system')}
          >
            <span className="tab-icon">💻</span> Our System
          </button>
        </div>
        
        <div className="about-content-wrapper">
          {activeTab === 'church' && (
            <div className="about-block church-block animate-fade-in">
              <div className="about-block-header">
                <span className="block-icon">🏛️</span>
                <h2 className="about-block-title">About the Church</h2>
              </div>
              
              <div className="about-block-content">
                <p className="about-block-desc">
                  Christ-Like Christian Church is a Christ-centered church located in Biñan, Laguna, Philippines. Our mission is to preach the Gospel, disciple believers, and build a strong, prayerful community.
                </p>
                
                <div className="about-info-list">
                  <div className="about-info-item">
                    <h3><span className="info-icon">📍</span> Address</h3>
                    <p>Phase 2 Block 48 Lot 43 Southville 5A Brgy. Langkiwa, Biñan, Laguna, Philippines</p>
                  </div>
                  
                  <div className="about-info-item">
                    <h3><span className="info-icon">🕊</span> Mission</h3>
                    <p>To Glorify the Lord and make Christ-Like Christians who will strive to make Christ-Like Christians</p>
                  </div>
                  
                  <div className="about-info-item">
                    <h3><span className="info-icon">📖</span> Vision</h3>
                    <p>To have a wonderful future together with the Christian, who will do the will of the God just as Christ Jesus did, to follow the will of His Father</p>
                  </div>
                  
                  <div className="about-info-item">
                    <h3><span className="info-icon">📅</span> Statement of Faith</h3>
                    <p>We believe that Jesus Christ is our Lord and Savior sent by God the Father that nothing can save us except through Him and that the Holy Spirit was sent by Him to guide us as we walk our path with God</p>
                  </div>
                </div>
                
              </div>
            </div>
          )}
          
          {activeTab === 'system' && (
            <div className="about-block system-block animate-fade-in">
              <div className="about-block-header">
                <span className="block-icon">💻</span>
                <h2 className="about-block-title">About CHURCHTRACK</h2>
              </div>
              
              <div className="about-block-content">
                <p className="about-block-desc">
                  CHURCHTRACK: A Membership System for Christ-Like Christian Church with Attendance Monitoring.
                  It supports our mission by enabling accurate attendance tracking and organized member records.
                </p>
                
                <div className="about-info-item purpose-item">
                  <h3><span className="info-icon">🌟</span> Purpose</h3>
                  <p>Provide attendance monitoring and membership management tailored for Christ-Like Christian Church.</p>
                </div>
                
                <h3 className="features-heading"><span className="info-icon">✨</span> Features</h3>
                <div className="about-features-list">
                  <div className="about-feature">
                    <span className="feature-icon">🔳</span>
                    <span>QR Code Attendance System</span>
                    <p className="feature-description">Fast, reliable check-in using scannable QR codes</p>
                  </div>
                  <div className="about-feature">
                    <span className="feature-icon">🌳</span>
                    <span>Family Tree Connection</span>
                    <p className="feature-description">Link households and relatives to visualize family relationships</p>
                  </div>
                  
                  <div className="about-feature">
                    <span className="feature-icon">📋</span>
                    <span>Member Records</span>
                    <p className="feature-description">Maintain comprehensive records of all church members</p>
                  </div>
                  <div className="about-feature">
                    <span className="feature-icon">📊</span>
                    <span>Attendance Reports</span>
                    <p className="feature-description">Generate detailed reports on church attendance and participation</p>
                  </div>
                </div>
                
                <div className="about-info-list system-info">
                  <div className="about-info-item">
                    <h3><span className="info-icon">👤</span> Users</h3>
                    <p>Super Admin, Manager, Members</p>
                  </div>
                  
                  <div className="about-info-item">
                    <h3><span className="info-icon">👨‍💻</span> Developer</h3>
                    <p>Developed as a capstone project by CKM, with guidance and prayer.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default About;
