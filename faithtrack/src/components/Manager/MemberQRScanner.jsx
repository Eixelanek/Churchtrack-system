import { useState, useEffect, useRef, useCallback } from 'react';import { API_BASE_URL } from '../../config/api';
import './MemberQRScanner.css';

// ── helpers ───────────────────────────────────────────────────
const getInitials = (name = '') =>
  name.split(' ').filter(Boolean).map((p) => p[0]?.toUpperCase() || '').join('').slice(0, 2);

// ── component ─────────────────────────────────────────────────
const MemberQRScanner = ({ checkedInList, setCheckedInList }) => {
  // ── auth ────────────────────────────────────────────────────
  const sessionId = localStorage.getItem('sessionId');
  const managerId = localStorage.getItem('managerId') || localStorage.getItem('userId');

  // ── step: 'select' | 'scanning' ─────────────────────────────
  const [step, setStep] = useState(() =>
    // Restore scanning state if we have a selected event and items in the list
    'select'
  );

  // ── events ──────────────────────────────────────────────────
  const [events, setEvents]               = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError]     = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const selectedEvent = events.find((e) => String(e.id) === String(selectedEventId)) || null;

  // ── scanner ─────────────────────────────────────────────────
  const videoRef            = useRef(null);
  const streamRef           = useRef(null);
  const detectorRef         = useRef(null);
  const scanningRef         = useRef(false);
  const lastScannedRef      = useRef('');        // debounce same token
  const lastScannedTime     = useRef(0);

  const [lastResult, setLastResult]       = useState(null);
  const resultTimerRef = useRef(null);

  // ── result feedback ─────────────────────────────────────────
  const [scanError, setScanError]         = useState('');
  const [isScanning, setIsScanning]       = useState(false);

  // ── fetch active events ──────────────────────────────────────
  const fetchEvents = useCallback(async () => {
    if (!sessionId || !managerId) {
      setEventsError('Session expired. Please log in again.');
      setEventsLoading(false);
      return;
    }
    setEventsLoading(true);
    setEventsError('');
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/manager/get_active_events.php?session_id=${encodeURIComponent(sessionId)}&manager_id=${encodeURIComponent(managerId)}`
      );
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to load events.');
      setEvents(data.events || []);
      if (data.events?.length === 1) setSelectedEventId(String(data.events[0].id));
    } catch (err) {
      setEventsError(err.message || 'Unable to load events.');
    } finally {
      setEventsLoading(false);
    }
  }, [sessionId, managerId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // ── load existing attendees when event is selected ────────────
  const fetchEventAttendees = useCallback(async (eventId) => {
    if (!eventId || !sessionId || !managerId) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/attendance/get_event_details.php?event_id=${encodeURIComponent(eventId)}`
      );
      const data = await res.json();
      if (!res.ok || !data.success) return;
      const attendees = (data.attendees || [])
        .filter((a) => a.memberId)
        .map((a) => ({
          id: a.memberId,
          name: a.name,
          profile_picture: a.profile_picture || null,
          checkin_status: (a.status || 'present').toLowerCase() === 'late' ? 'late' : 'present',
          time: a.checkInTime || ''
        }));
      setCheckedInList(attendees);
    } catch {
      // non-critical — list just starts empty
    }
  }, [sessionId, managerId, setCheckedInList]);

  // When event selection changes, load its attendees
  const prevEventIdRef = useRef('');
  useEffect(() => {
    if (selectedEventId && selectedEventId !== prevEventIdRef.current) {
      prevEventIdRef.current = selectedEventId;
      fetchEventAttendees(selectedEventId);
    }
  }, [selectedEventId, fetchEventAttendees]);
  const stopScanner = useCallback(() => {
    scanningRef.current = false;
    setIsScanning(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
  }, []);

  const processToken = useCallback(async (rawToken) => {
    if (!rawToken || !selectedEventId) return;

    // Debounce: skip if same token scanned within 3 seconds
    const now = Date.now();
    if (rawToken === lastScannedRef.current && now - lastScannedTime.current < 3000) return;
    lastScannedRef.current = rawToken;
    lastScannedTime.current = now;

    // Extract QR token — value encoded is the raw token string
    let qrToken = rawToken.trim();

    try {
      const res = await fetch(`${API_BASE_URL}/api/manager/scan_member_qr.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          manager_id: parseInt(managerId, 10),
          qr_token: qrToken,
          event_id: parseInt(selectedEventId, 10)
        })
      });
      const data = await res.json();

      const result = {
        success: data.success,
        alreadyCheckedIn: data.already_checked_in || false,
        member: data.member || null,
        message: data.message || (data.success ? 'Checked in!' : 'Scan failed.'),
        status: data.status || null
      };

      setLastResult(result);

      // Add to running list (avoid duplicates for already-checked-in)
      if (data.success && !data.already_checked_in && data.member) {
        setCheckedInList((prev) => {
          const exists = prev.find((m) => m.id === data.member.id);
          if (exists) return prev;
          return [{ ...data.member, checkin_status: data.status, time: data.check_in_time || new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) }, ...prev];
        });
        // Update attendee count on selected event
        setEvents((prev) =>
          prev.map((e) =>
            String(e.id) === String(selectedEventId)
              ? { ...e, attendee_count: (e.attendee_count || 0) + 1 }
              : e
          )
        );
      }

      // Auto-clear result card after 3 seconds
      if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
      resultTimerRef.current = setTimeout(() => setLastResult(null), 3000);

    } catch {
      setLastResult({ success: false, message: 'Network error. Check your connection.', member: null });
      if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
      resultTimerRef.current = setTimeout(() => setLastResult(null), 3000);
    }
  }, [sessionId, managerId, selectedEventId]);

  const scanLoop = useCallback(() => {
    if (!scanningRef.current || !videoRef.current || !detectorRef.current) return;
    detectorRef.current
      .detect(videoRef.current)
      .then((barcodes) => {
        if (!scanningRef.current) return;
        if (barcodes?.length > 0) {
          const raw = barcodes[0]?.rawValue;
          if (raw) processToken(raw);
        }
        requestAnimationFrame(scanLoop);
      })
      .catch(() => {
        if (scanningRef.current) requestAnimationFrame(scanLoop);
      });
  }, [processToken]);

  const startScanner = useCallback(async () => {
    if (scanningRef.current) return;
    setScanError('');

    if (!navigator?.mediaDevices?.getUserMedia) {
      setScanError('Camera access is not supported on this device.');
      return;
    }
    if (!('BarcodeDetector' in window)) {
      setScanError('QR scanning is not supported on this browser. Try Chrome on Android or desktop.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      if (!detectorRef.current) {
        detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] });
      }

      scanningRef.current = true;
      setIsScanning(true);
      requestAnimationFrame(scanLoop);
    } catch {
      setScanError('Unable to access camera. Check browser permissions.');
      stopScanner();
    }
  }, [scanLoop, stopScanner]);

  // Cleanup on unmount
  useEffect(() => () => {
    stopScanner();
    if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
  }, [stopScanner]);

  // Auto-start camera when step becomes 'scanning'
  useEffect(() => {
    if (step === 'scanning') startScanner();
    else stopScanner();
  }, [step, startScanner, stopScanner]);

  // ── handlers ─────────────────────────────────────────────────
  const handleStartScanning = () => {
    if (!selectedEventId) return;
    // Don't reset checkedInList — preserve scans across step transitions
    setLastResult(null);
    setStep('scanning');
  };

  const handleStopScanning = () => {
    setStep('select');
  };

  // ── render: event selector ────────────────────────────────────
  if (step === 'select') {
    return (
      <div className="mqrs-page">
        <div className="mqrs-header">
          <h1>Scan Attendance</h1>
          <p>Select an active event, then scan members' QR codes to record attendance.</p>
        </div>

        <div className="mqrs-select-layout">
          {/* Left: event selector */}
          <div className="mqrs-selector-col">
            <div className="mqrs-selector-card">
              <div className="mqrs-selector-top">
                <div className="mqrs-selector-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </div>
                <div>
                  <h2>Select Event</h2>
                  <p className="mqrs-selector-sub">Choose the event to record attendance for.</p>
                </div>
              </div>

              {eventsLoading ? (
                <div className="mqrs-events-loading">
                  <div className="mqrs-spinner" />
                  <span>Loading events…</span>
                </div>
              ) : eventsError ? (
                <div className="mqrs-events-error">
                  <p>{eventsError}</p>
                  <button className="mqrs-retry-btn" onClick={fetchEvents}>Retry</button>
                </div>
              ) : events.length === 0 ? (
                <div className="mqrs-no-events">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="36" height="36">
                    <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
                  </svg>
                  <p>No active events right now.</p>
                  <span>Create an event first before scanning attendance.</span>
                  <button className="mqrs-retry-btn" onClick={fetchEvents}>Refresh</button>
                </div>
              ) : (
                <div className="mqrs-event-list">
                  {events.map((event) => (
                    <label
                      key={event.id}
                      className={`mqrs-event-option ${String(selectedEventId) === String(event.id) ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="event"
                        value={event.id}
                        checked={String(selectedEventId) === String(event.id)}
                        onChange={() => setSelectedEventId(String(event.id))}
                      />
                      <div className="mqrs-event-info">
                        <div className="mqrs-event-title">{event.title}</div>
                        <div className="mqrs-event-meta">
                          {event.date && new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          {event.start_time && ` · ${new Date(`1970-01-01T${event.start_time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`}
                        </div>
                      </div>
                      <div className="mqrs-event-count">
                        <span>{event.attendee_count}</span>
                        <small>scanned</small>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              <button
                className="mqrs-start-btn"
                disabled={!selectedEventId || eventsLoading}
                onClick={handleStartScanning}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
                </svg>
                Start Scanning
              </button>
            </div>
          </div>

          {/* Right: checked-in list */}
          <div className="mqrs-list-col">
            <div className="mqrs-list-card">
              <div className="mqrs-list-header">
                <h3>Checked In</h3>
                <span className="mqrs-list-count">{checkedInList.length}</span>
              </div>
              {checkedInList.length === 0 ? (
                <div className="mqrs-list-empty">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="36" height="36">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  <p>No attendees yet.</p>
                  <span>Select an event and start scanning to see check-ins here.</span>
                </div>
              ) : (
                <div className="mqrs-list-items">
                  {checkedInList.map((member, i) => (
                    <div key={`${member.id}-${i}`} className="mqrs-list-item">
                      <span className="mqrs-list-num">{i + 1}</span>
                      <div className="mqrs-list-avatar">
                        {member.profile_picture
                          ? <img src={member.profile_picture} alt={member.name} />
                          : <span>{getInitials(member.name)}</span>}
                      </div>
                      <div className="mqrs-list-info">
                        <div className="mqrs-list-name">{member.name}</div>
                        <div className="mqrs-list-time">{member.time}</div>
                      </div>
                      <div className={`mqrs-list-badge ${member.checkin_status}`}>
                        {member.checkin_status === 'late' ? 'Late' : 'Present'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── render: scanning mode ─────────────────────────────────────
  return (
    <div className="mqrs-page">
      <div className="mqrs-scanning-header">
        <div className="mqrs-scanning-title">
          <h1>Scanning Attendance</h1>
          <div className="mqrs-event-badge">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            {selectedEvent?.title}
          </div>
        </div>
        <button className="mqrs-stop-btn" onClick={handleStopScanning}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
          Stop Scanning
        </button>
      </div>

      <div className="mqrs-scanning-layout">
        {/* Camera column */}
        <div className="mqrs-camera-col">
          <div className="mqrs-camera-card">
            {scanError ? (
              <div className="mqrs-camera-error">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M12 8v4M12 16h.01"></path>
                </svg>
                <p>{scanError}</p>
                <button className="mqrs-retry-btn" onClick={startScanner}>Try Again</button>
              </div>
            ) : (
              <>
                <div className="mqrs-viewfinder">
                  <video
                    ref={videoRef}
                    className="mqrs-video"
                    playsInline
                    muted
                    autoPlay
                  />
                  <div className="mqrs-scan-frame">
                    <span className="mqrs-frame-corner tl" />
                    <span className="mqrs-frame-corner tr" />
                    <span className="mqrs-frame-corner bl" />
                    <span className="mqrs-frame-corner br" />
                    {isScanning && <div className="mqrs-scan-line" />}
                  </div>
                </div>
                <p className="mqrs-camera-hint">
                  {isScanning ? 'Point camera at a member\'s QR code' : 'Starting camera…'}
                </p>
              </>
            )}
          </div>

          {/* Live result feedback */}
          {lastResult && (
            <div className={`mqrs-result-card ${lastResult.success ? (lastResult.alreadyCheckedIn ? 'already' : 'success') : 'fail'}`}>
              {lastResult.member ? (
                <div className="mqrs-result-member">
                  <div className="mqrs-result-avatar">
                    {lastResult.member.profile_picture ? (
                      <img src={lastResult.member.profile_picture} alt={lastResult.member.name} />
                    ) : (
                      <span>{getInitials(lastResult.member.name)}</span>
                    )}
                  </div>
                  <div className="mqrs-result-info">
                    <div className="mqrs-result-name">{lastResult.member.name}</div>
                    <div className="mqrs-result-msg">{lastResult.message}</div>
                    {lastResult.status && !lastResult.alreadyCheckedIn && (
                      <div className={`mqrs-result-status ${lastResult.status}`}>
                        {lastResult.status === 'late' ? 'Late' : 'Present'}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mqrs-result-text">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    {lastResult.success
                      ? <polyline points="20 6 9 17 4 12" />
                      : <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
                    }
                  </svg>
                  {lastResult.message}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Attendance list column */}
        <div className="mqrs-list-col">
          <div className="mqrs-list-card">
            <div className="mqrs-list-header">
              <h3>Checked In</h3>
              <span className="mqrs-list-count">{(selectedEvent?.attendee_count || 0)}</span>
            </div>

            {checkedInList.length === 0 ? (
              <div className="mqrs-list-empty">
                <p>No scans yet this session.</p>
                <span>Scanned members will appear here.</span>
              </div>
            ) : (
              <div className="mqrs-list-items">
                {checkedInList.map((member, i) => (
                  <div key={`${member.id}-${i}`} className="mqrs-list-item">
                    <div className="mqrs-list-avatar">
                      {member.profile_picture ? (
                        <img src={member.profile_picture} alt={member.name} />
                      ) : (
                        <span>{getInitials(member.name)}</span>
                      )}
                    </div>
                    <div className="mqrs-list-info">
                      <div className="mqrs-list-name">{member.name}</div>
                      <div className="mqrs-list-time">{member.time}</div>
                    </div>
                    <div className={`mqrs-list-badge ${member.checkin_status}`}>
                      {member.checkin_status === 'late' ? 'Late' : 'Present'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemberQRScanner;
