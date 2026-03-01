import React from 'react';
import './ScanQR.css';

const ScanQR = ({ onOpenScanner, dashboardStats, recentAttendance }) => {
  return (
    <div className="scan-qr-page">
      <div className="scan-qr-header">
        <h1>Scan QR Code</h1>
        <p>Mark your attendance by scanning the service QR code</p>
      </div>

      <div className="scan-qr-content">
        {/* Main Scanner Card */}
        <div className="scanner-main-card">
          <div className="scanner-visual">
            <div className="scanner-frame-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                <rect x="3" y="3" width="7" height="7" rx="1"></rect>
                <rect x="14" y="3" width="7" height="7" rx="1"></rect>
                <rect x="14" y="14" width="7" height="7" rx="1"></rect>
                <rect x="3" y="14" width="7" height="7" rx="1"></rect>
              </svg>
            </div>
          </div>
          <div className="scanner-info">
            <h2>Ready to Mark Attendance</h2>
            <p>Tap the button below to open your camera and scan the QR code displayed at the service</p>
            <button className="open-scanner-btn" onClick={onOpenScanner}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                <circle cx="12" cy="13" r="4"></circle>
              </svg>
              Open Camera Scanner
            </button>
          </div>
        </div>

        {/* How to Scan Section */}
        <div className="how-to-scan">
          <h3>How to Scan</h3>
          <p className="scan-instructions-intro">
            Follow these quick steps to successfully record your attendance using the QR code displayed at the service.
          </p>
          <div className="scan-steps">
            <div className="scan-step">
              <div className="step-number">1</div>
              <div className="scan-step-content">
                <h4>Click "Open Camera Scanner"</h4>
                <p>This will activate your device's camera and prepare it to read the QR code.</p>
              </div>
            </div>
            <div className="scan-step">
              <div className="step-number">2</div>
              <div className="scan-step-content">
                <h4>Point at the QR Code</h4>
                <p>Hold your phone steady and center the QR code inside the frame for a clear scan.</p>
              </div>
            </div>
            <div className="scan-step">
              <div className="step-number">3</div>
              <div className="scan-step-content">
                <h4>Wait for Confirmation</h4>
                <p>Once detected, your attendance will be marked automatically and you will see a success message.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="scan-qr-sidebar">
        {/* Stats Card */}
        <div className="stats-card">
          <h3>Your Stats</h3>
          <div className="stat-items">
            {dashboardStats.map((stat, index) => (
              <div key={stat.key} className="stat-item">
                <div className="stat-item-icon" style={{ color: ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b'][index] }}>
                  {index === 0 && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                  )}
                  {index === 1 && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                      <polyline points="17 6 23 6 23 12"></polyline>
                    </svg>
                  )}
                  {index === 2 && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="8" r="7"></circle>
                      <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
                    </svg>
                  )}
                  {index === 3 && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                  )}
                </div>
                <div className="stat-item-info">
                  <div className="stat-item-label">{stat.label}</div>
                  <div className="stat-item-value">{stat.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Scans */}
        <div className="recent-scans-card">
          <h3>Recent Scans</h3>
          <div className="recent-scans-list">
            {recentAttendance.slice(0, 3).map((item) => (
              <div key={item.id} className="recent-scan-item">
                <div className="scan-check-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <div className="scan-item-info">
                  <div className="scan-service">{item.service}</div>
                  <div className="scan-datetime">
                    {item.date}
                    <br />
                    {item.time}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScanQR;
