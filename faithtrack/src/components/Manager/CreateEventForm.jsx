import { useState, useCallback, useEffect } from 'react';
import { API_BASE_URL } from '../../config/api';

const PRESETS = [
  { key: 'sunday-service',  name: 'Sunday Service',  startTime: '09:00', durationHours: 4 },
  { key: 'prayer-meeting',  name: 'Prayer Meeting',   startTime: '18:00', durationHours: 2 },
];

const addHours = (timeStr, hours) => {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + hours * 60;
  const newH = Math.floor(total / 60) % 24;
  const newM = total % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
};

const getTodayDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const CreateEventForm = () => {
  const [formType,       setFormType]       = useState('preset');
  const [selectedPreset, setSelectedPreset] = useState('');
  const [customName,     setCustomName]     = useState('');
  const [eventDate,      setEventDate]      = useState('');
  const [startTime,      setStartTime]      = useState('');
  const [endTime,        setEndTime]        = useState('');
  const [isCreating,     setIsCreating]     = useState(false);
  const [message,        setMessage]        = useState('');
  const [messageType,    setMessageType]    = useState('success');

  // ── events list ────────────────────────────────────────────
  const [events,         setEvents]         = useState([]);
  const [eventsLoading,  setEventsLoading]  = useState(true);

  const fetchEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/events/get_all.php?include_attendees=false&limit=50`);
      const data = await res.json();
      setEvents(data.events || []);
    } catch {
      // non-critical
    } finally {
      setEventsLoading(false);
    }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const handlePresetClick = useCallback((preset) => {
    setFormType('preset');
    setSelectedPreset(preset.key);
    setEventDate(getTodayDate());
    setStartTime(preset.startTime);
    setEndTime(addHours(preset.startTime, preset.durationHours));
    setCustomName('');
    setMessage('');
  }, []);

  const handleCreate = useCallback(async () => {
    const preset = PRESETS.find(p => p.key === selectedPreset);
    const title = formType === 'preset' ? (preset?.name || '') : customName.trim();

    if (!title) {
      setMessage(formType === 'preset' ? 'Please select a service.' : 'Please enter an event name.');
      setMessageType('error');
      return;
    }
    if (!eventDate || !startTime || !endTime) {
      setMessage('Please fill in date, start time, and end time.');
      setMessageType('error');
      return;
    }
    if (startTime >= endTime) {
      setMessage('End time must be after start time.');
      setMessageType('error');
      return;
    }

    setIsCreating(true);
    setMessage('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/events/create.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          date:       eventDate,
          start_time: startTime,
          end_time:   endTime,
          location:   'Church',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create event.');

      setMessage(`✓ Event "${title}" created successfully.`);
      setMessageType('success');
      setCustomName('');
      setEventDate('');
      setStartTime('');
      setEndTime('');
      setSelectedPreset('');
      fetchEvents(); // refresh list
    } catch (err) {
      setMessage(err.message || 'Unable to create event.');
      setMessageType('error');
    } finally {
      setIsCreating(false);
    }
  }, [formType, selectedPreset, customName, eventDate, startTime, endTime]);

  return (
    <div className="manager-generate-qr-module">
      <div className="qr-module-header">
        <h2>Events</h2>
        <p>Create events for attendance tracking</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '520px 1fr', gap: '2rem', alignItems: 'start' }}>
        {/* ── Left: Create form ─────────────────────────── */}
        <div className="qr-form-panel">
        {/* Quick preset buttons */}
        <div className="qr-quick-generate">
          <h4>Quick Create</h4>
          <div className="qr-quick-grid">
            {PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                className="qr-quick-card"
                onClick={() => handlePresetClick(preset)}
              >
                <div className="qr-quick-info">
                  <span className="qr-quick-name">{preset.name}</span>
                </div>
                <div className="qr-quick-icon">+</div>
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <div className="qr-form-card">
          <h3>New Event</h3>

          <div className="qr-form-tabs">
            <button
              type="button"
              className={`qr-tab ${formType === 'preset' ? 'active' : ''}`}
              onClick={() => { setFormType('preset'); setCustomName(''); setMessage(''); }}
            >
              Preset Service
            </button>
            <button
              type="button"
              className={`qr-tab ${formType === 'custom' ? 'active' : ''}`}
              onClick={() => { setFormType('custom'); setSelectedPreset(''); setMessage(''); }}
            >
              Custom Event
            </button>
          </div>

          <div className="qr-form-body">
            {formType === 'preset' ? (
              <div className="qr-form-group">
                <label>Select Service</label>
                <select
                  value={selectedPreset}
                  onChange={(e) => {
                    const key = e.target.value;
                    setSelectedPreset(key);
                    const preset = PRESETS.find(p => p.key === key);
                    if (preset) {
                      setStartTime(preset.startTime);
                      setEndTime(addHours(preset.startTime, preset.durationHours));
                    }
                  }}
                  className="qr-form-select"
                >
                  <option value="">Choose a service…</option>
                  {PRESETS.map(p => (
                    <option key={p.key} value={p.key}>{p.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="qr-form-group">
                <label>Event Name</label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="qr-form-input"
                  placeholder="Enter event name"
                />
              </div>
            )}

            <div className="qr-form-group">
              <label>Date</label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="qr-form-input"
              />
            </div>

            <div className="qr-form-group">
              <label>Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => {
                  const newStart = e.target.value;
                  setStartTime(newStart);
                  // Auto-compute end time: preset duration or 2h default for custom
                  const preset = PRESETS.find(p => p.key === selectedPreset);
                  const hours = preset ? preset.durationHours : 2;
                  setEndTime(addHours(newStart, hours));
                }}
                className="qr-form-input"
              />
            </div>

            <div className="qr-form-group">
              <label>End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="qr-form-input"
              />
            </div>

            <button
              type="button"
              className="qr-generate-btn"
              onClick={handleCreate}
              disabled={isCreating}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {isCreating ? 'Creating…' : 'Create Event'}
            </button>
          </div>
        </div>

        {message && (
          <div className={`qr-message qr-message-${messageType}`}>
            {message}
          </div>
        )}
        </div>{/* end left col */}

        {/* ── Right: Events list ────────────────────────── */}
        <div className="qr-list-panel">
          <div className="qr-list-card">
            <div className="qr-list-header">
              <div className="qr-header-left">
                <h3>All Events</h3>
              </div>
              <div className="qr-header-right">
                <button
                  type="button"
                  className="manager-card-action"
                  onClick={fetchEvents}
                  style={{ fontSize: '0.85rem' }}
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="qr-table-wrapper">
              <table className="qr-table">
                <thead>
                  <tr>
                    <th>EVENT</th>
                    <th>DATE</th>
                    <th>TIME</th>
                    <th>STATUS</th>
                    <th>ATTENDEES</th>
                  </tr>
                </thead>
                <tbody>
                  {eventsLoading ? (
                    <tr><td colSpan="5" style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b' }}>Loading events…</td></tr>
                  ) : events.length === 0 ? (
                    <tr><td colSpan="5" style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b' }}>No events yet.</td></tr>
                  ) : (
                    events.map((event) => (
                      <tr key={event.id}>
                        <td style={{ fontWeight: 600 }}>{event.title}</td>
                        <td>{event.date ? new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                        <td>{event.time}{event.endTime ? ` – ${event.endTime}` : ''}</td>
                        <td>
                          <span style={{
                            padding: '2px 10px',
                            borderRadius: '9999px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            background: event.status === 'active' ? '#dcfce7' : event.status === 'completed' ? '#f1f5f9' : '#fef9c3',
                            color: event.status === 'active' ? '#16a34a' : event.status === 'completed' ? '#64748b' : '#ca8a04',
                          }}>
                            {(event.status || 'upcoming').toUpperCase()}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>{event.totalAttendees ?? 0}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>{/* end right col */}
      </div>
    </div>
  );
};

export default CreateEventForm;
