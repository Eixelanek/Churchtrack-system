import { useState, useEffect, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { API_BASE_URL } from '../../config/api';
import './MyQRCode.css';

// ─────────────────────────────────────────────

const QRDisplay = ({ value, size = 220, label }) => {
  if (!value) return null;
  return (
    <QRCodeCanvas
      value={value}
      size={size}
      bgColor="#ffffff"
      fgColor="#1e293b"
      level="M"
      marginSize={2}
      aria-label={label ? `QR code for ${label}` : 'QR code'}
    />
  );
};

// ─────────────────────────────────────────────

const MyQRCode = ({ dashboardStats, recentAttendance }) => {
  const [activeTab, setActiveTab] = useState('mine'); // 'mine' | 'children'
  const [myToken, setMyToken] = useState(null);
  const [myName, setMyName] = useState('');
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [childrenLoading, setChildrenLoading] = useState(false);
  const [error, setError] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenData, setFullscreenData] = useState(null); // { token, name }

  const sessionId = localStorage.getItem('sessionId');
  const memberId  = localStorage.getItem('userId');

  // ── Fetch my QR token ──────────────────────────────────────
  const fetchMyQR = useCallback(async () => {
    if (!sessionId || !memberId) {
      setError('Session expired. Please log in again.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/members/get_member_qr.php?session_id=${encodeURIComponent(sessionId)}&member_id=${encodeURIComponent(memberId)}`
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to load your QR code.');
      }
      setMyToken(data.qr_token);
      setMyName(data.name || localStorage.getItem('memberName') || 'Member');
    } catch (err) {
      setError(err.message || 'Unable to load QR code.');
    } finally {
      setLoading(false);
    }
  }, [sessionId, memberId]);

  // ── Fetch children QR tokens ───────────────────────────────
  const fetchChildrenQR = useCallback(async () => {
    if (!sessionId || !memberId) return;

    setChildrenLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/members/get_children_qr.php?session_id=${encodeURIComponent(sessionId)}&member_id=${encodeURIComponent(memberId)}`
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setChildren(data.children || []);
      }
    } catch {
      // non-critical — just show empty
    } finally {
      setChildrenLoading(false);
    }
  }, [sessionId, memberId]);

  useEffect(() => {
    fetchMyQR();
    fetchChildrenQR();
  }, [fetchMyQR, fetchChildrenQR]);

  // ── Download QR as PNG ─────────────────────────────────────
  // qrcode.react renders to a canvas — grab that canvas and save it
  const handleDownload = (token, name) => {
    // Find the canvas rendered by QRCodeCanvas for this token
    // We render a hidden off-screen canvas temporarily
    const size = 400;
    const tempDiv = document.createElement('div');
    tempDiv.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
    document.body.appendChild(tempDiv);

    // Dynamically create a React root, render QRCodeCanvas, grab canvas data
    import('react-dom/client').then(({ createRoot }) => {
      import('react').then((ReactModule) => {
        const React = ReactModule.default;
        import('qrcode.react').then(({ QRCodeCanvas }) => {
          const root = createRoot(tempDiv);
          root.render(
            React.createElement(QRCodeCanvas, {
              value: token,
              size,
              bgColor: '#ffffff',
              fgColor: '#1e293b',
              level: 'M',
              marginSize: 2
            })
          );

          // Give React one tick to render
          setTimeout(() => {
            const canvas = tempDiv.querySelector('canvas');
            if (canvas) {
              const url = canvas.toDataURL('image/png');
              const a = document.createElement('a');
              a.href = url;
              a.download = `${name.replace(/\s+/g, '_')}_QR.png`;
              a.click();
            }
            root.unmount();
            document.body.removeChild(tempDiv);
          }, 100);
        });
      });
    }).catch(() => {
      document.body.removeChild(tempDiv);
      // Last resort fallback via external API
      const encoded = encodeURIComponent(token);
      window.open(
        `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encoded}&margin=2`,
        '_blank'
      );
    });
  };

  // ── Open fullscreen ────────────────────────────────────────
  const openFullscreen = (token, name) => {
    setFullscreenData({ token, name });
    setFullscreen(true);
  };

  const closeFullscreen = () => {
    setFullscreen(false);
    setFullscreenData(null);
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="myqr-page">
      {/* Header */}
      <div className="myqr-header">
        <h1>My QR Code</h1>
        <p>Show this QR code to the staff at the entrance to record your attendance.</p>
      </div>

      {/* Tab bar — only show children tab if there are children */}
      <div className="myqr-tabs">
        <button
          className={`myqr-tab ${activeTab === 'mine' ? 'active' : ''}`}
          onClick={() => setActiveTab('mine')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          My QR Code
        </button>
        <button
          className={`myqr-tab ${activeTab === 'children' ? 'active' : ''}`}
          onClick={() => setActiveTab('children')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          Children's QR
          {children.length > 0 && (
            <span className="myqr-tab-badge">{children.length}</span>
          )}
        </button>
      </div>

      {/* ── MY QR TAB ─────────────────────────────────────── */}
      {activeTab === 'mine' && (
        <div className="myqr-content">
          {loading ? (
            <div className="myqr-loading">
              <div className="myqr-spinner" />
              <p>Loading your QR code…</p>
            </div>
          ) : error ? (
            <div className="myqr-error">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              <p>{error}</p>
              <button className="myqr-retry-btn" onClick={fetchMyQR}>Try Again</button>
            </div>
          ) : (
            <div className="myqr-grid">
              {/* QR Card */}
              <div className="myqr-card">
                <div className="myqr-card-inner">
                  <div className="myqr-canvas-wrap">
                    <QRDisplay value={myToken} size={220} label={myName} />
                  </div>
                  <div className="myqr-name">{myName}</div>
                  <div className="myqr-label">Personal Attendance QR</div>
                </div>

                <div className="myqr-actions">
                  <button
                    className="myqr-action-btn primary"
                    onClick={() => openFullscreen(myToken, myName)}
                    title="Show fullscreen"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                    </svg>
                    Fullscreen
                  </button>
                  <button
                    className="myqr-action-btn secondary"
                    onClick={() => handleDownload(myToken, myName)}
                    title="Download QR code"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Download
                  </button>
                </div>
              </div>

              {/* How it works */}
              <div className="myqr-instructions">
                <h3>How it works</h3>
                <div className="myqr-steps">
                  <div className="myqr-step">
                    <div className="myqr-step-num">1</div>
                    <div>
                      <strong>Open your QR code</strong>
                      <p>Tap "Fullscreen" for the largest display, or simply show this screen to the staff.</p>
                    </div>
                  </div>
                  <div className="myqr-step">
                    <div className="myqr-step-num">2</div>
                    <div>
                      <strong>Let the staff scan it</strong>
                      <p>A church staff member will scan your QR code using the Manager app.</p>
                    </div>
                  </div>
                  <div className="myqr-step">
                    <div className="myqr-step-num">3</div>
                    <div>
                      <strong>Attendance recorded</strong>
                      <p>Your attendance is instantly recorded. You'll see it in your Attendance History.</p>
                    </div>
                  </div>
                </div>

                {/* Stats sidebar */}
                {dashboardStats && dashboardStats.length > 0 && (
                  <div className="myqr-stats">
                    <h4>Your Stats</h4>
                    <div className="myqr-stat-list">
                      {dashboardStats.map((stat, i) => (
                        <div key={stat.key || i} className="myqr-stat-item">
                          <span className="myqr-stat-label">{stat.label}</span>
                          <span className="myqr-stat-value">{stat.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent attendance */}
                {recentAttendance && recentAttendance.length > 0 && (
                  <div className="myqr-recent">
                    <h4>Recent Attendance</h4>
                    <div className="myqr-recent-list">
                      {recentAttendance.slice(0, 3).map((item) => (
                        <div key={item.id} className="myqr-recent-item">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span className="myqr-recent-service">{item.service}</span>
                          <span className="myqr-recent-date">{item.date}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CHILDREN TAB ──────────────────────────────────── */}
      {activeTab === 'children' && (
        <div className="myqr-content">
          {childrenLoading ? (
            <div className="myqr-loading">
              <div className="myqr-spinner" />
              <p>Loading children's QR codes…</p>
            </div>
          ) : children.length === 0 ? (
            <div className="myqr-empty">
              <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <h3>No children linked</h3>
              <p>
                Children 12 years old and below who are linked to your family circle will appear here.
                Add them via the Family Circle section in your profile.
              </p>
            </div>
          ) : (
            <div className="myqr-children-grid">
              {children.map((child) => (
                <div key={child.member_id} className="myqr-child-card">
                  <div className="myqr-card-inner">
                    <div className="myqr-canvas-wrap">
                      <QRDisplay value={child.qr_token} size={180} label={child.name} />
                    </div>
                    <div className="myqr-name">{child.name}</div>
                    <div className="myqr-label">
                      {child.age !== null ? `Age ${child.age}` : ''}
                      {child.relationship_type ? ` · ${child.relationship_type}` : ''}
                    </div>
                  </div>

                  <div className="myqr-actions">
                    <button
                      className="myqr-action-btn primary"
                      onClick={() => openFullscreen(child.qr_token, child.name)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                      </svg>
                      Fullscreen
                    </button>
                    <button
                      className="myqr-action-btn secondary"
                      onClick={() => handleDownload(child.qr_token, child.name)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── FULLSCREEN OVERLAY ────────────────────────────── */}
      {fullscreen && fullscreenData && (
        <div
          className="myqr-fullscreen-overlay"
          onClick={closeFullscreen}
          role="dialog"
          aria-modal="true"
          aria-label="Fullscreen QR code"
        >
          <div
            className="myqr-fullscreen-card"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="myqr-fullscreen-close"
              onClick={closeFullscreen}
              aria-label="Close fullscreen"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="myqr-fullscreen-qr">
              <QRDisplay value={fullscreenData.token} size={300} label={fullscreenData.name} />
            </div>
            <div className="myqr-fullscreen-name">{fullscreenData.name}</div>
            <div className="myqr-fullscreen-hint">Present this to the staff at the entrance</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyQRCode;
