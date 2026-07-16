import { useState, useCallback, useEffect } from 'react';
import { API_BASE_URL } from '../../config/api';
import './CreateEventForm.css';

const PRESETS = [
  { key: 'sunday-service', name: 'Sunday Service', startTime: '09:00', durationHours: 4 },
  { key: 'prayer-meeting', name: 'Prayer Meeting', startTime: '18:00', durationHours: 2 },
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

const fmt12 = (t) => {
  if (!t) return '';
  const s = String(t).trim();
  // Already formatted (e.g. "2:00 PM") — return as-is
  if (/[AaPp][Mm]/.test(s)) return s;
  const parts = s.split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return s;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
};

const CreateEventForm = () => {
  const [formType, setFormType]             = useState('preset');
  const [selectedPreset, setSelectedPreset] = useState('');
  const [customName, setCustomName]         = useState('');
  const [eventDate, setEventDate]           = useState('');
  const [startTime, setStartTime]           = useState('');
  const [endTime, setEndTime]               = useState('');
  const [isCreating, setIsCreating]         = useState(false);
  const [message, setMessage]               = useState('');
  const [messageType, setMessageType]       = useState('success');
  const [events, setEvents]                 = useState([]);
  const [eventsLoading, setEventsLoading]   = useState(true);
  const [searchQuery, setSearchQuery]       = useState('');

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
        body: JSON.stringify({ title, date: eventDate, start_time: startTime, end_time: endTime, location: 'Church' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create event.');

      setMessage(`Event "${title}" created successfully.`);
      setMessageType('success');
      setCustomName('');
      setEventDate('');
      setStartTime('');
      setEndTime('');
      setSelectedPreset('');
      fetchEvents();
    } catch (err) {
      setMessage(err.message || 'Unable to create event.');
      setMessageType('error');
    } finally {
      setIsCreating(false);
    }
  }, [formType, selectedPreset, customName, eventDate, startTime, endTime, fetchEvents]);

  return (
    <div className="ev-page">

      {/* ── HEADER ── */}
      <div className="ev-header">
        <h1>Events</h1>
        <p>Create and manage church events for attendance tracking.</p>
      </div>

      <div className="ev-layout">

        {/* ── LEFT: CREATE FORM ── */}
        <div className="ev-form-col">

          {/* Quick presets */}
          <div className="ev-card">
            <p className="ev-section-label">Quick Create</p>
            <div className="ev-preset-grid">
              {PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  className={`ev-preset-btn ${selectedPreset === preset.key ? 'active' : ''}`}
                  onClick={() => handlePresetClick(preset)}
                >
                  <div className="ev-preset-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                  </div>
                  <div className="ev-preset-info">
                    <span>{preset.name}</span>
                    <small>{fmt12(preset.startTime)}</small>
                  </div>
                  <svg className="ev-preset-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
              ))}
            </div>
          </div>

          {/* Form card */}
          <div className="ev-card">
            <p className="ev-section-label">New Event</p>

            {/* Tabs */}
            <div className="ev-tabs">
              <button
                type="button"
                className={`ev-tab ${formType === 'preset' ? 'active' : ''}`}
                onClick={() => { setFormType('preset'); setCustomName(''); setMessage(''); }}
              >Preset Service</button>
              <button
                type="button"
                className={`ev-tab ${formType === 'custom' ? 'active' : ''}`}
                onClick={() => { setFormType('custom'); setSelectedPreset(''); setMessage(''); }}
              >Custom Event</button>
            </div>

            <div className="ev-form-body">
              {formType === 'preset' ? (
                <div className="ev-form-field">
                  <label>Service</label>
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
                  >
                    <option value="">Choose a service…</option>
                    {PRESETS.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
                  </select>
                </div>
              ) : (
                <div className="ev-form-field">
                  <label>Event Name</label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. Youth Camp, Bible Study"
                  />
                </div>
              )}

              <div className="ev-form-field">
                <label>Date</label>
                <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
              </div>

              <div className="ev-form-row">
                <div className="ev-form-field">
                  <label>Start Time</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => {
                      const newStart = e.target.value;
                      setStartTime(newStart);
                      const preset = PRESETS.find(p => p.key === selectedPreset);
                      const hours = preset ? preset.durationHours : 2;
                      setEndTime(addHours(newStart, hours));
                    }}
                  />
                </div>
                <div className="ev-form-field">
                  <label>End Time</label>
                  <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
              </div>

              {message && (
                <div className={`ev-alert ev-alert--${messageType}`}>
                  {messageType === 'success' ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                  )}
                  <span>{message}</span>
                </div>
              )}

              <button
                type="button"
                className="ev-create-btn"
                onClick={handleCreate}
                disabled={isCreating}
              >
                {isCreating ? (
                  <>
                    <svg className="ev-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                    </svg>
                    Creating…
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Create Event
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT: EVENTS LIST ── */}
        <div className="ev-list-col">
          <div className="ev-card ev-list-card">
            <div className="ev-list-top">
              <div className="ev-list-top-left">
                <p className="ev-section-label" style={{ margin: 0 }}>All Events</p>
                {!eventsLoading && <span className="ev-count-badge">{events.length}</span>}
              </div>
              <div className="ev-list-top-right">
                <div className="ev-search-wrap">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input
                    type="text"
                    placeholder="Search events…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="ev-search-input"
                  />
                </div>
                <button type="button" className="ev-refresh-btn" onClick={fetchEvents}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                  </svg>
                  Refresh
                </button>
              </div>
            </div>

            <div className="ev-table-wrap">
              <table className="ev-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Event</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Status</th>
                    <th>Attendees</th>
                  </tr>
                </thead>
                <tbody>
                  {eventsLoading ? (
                    <tr>
                      <td colSpan="6" className="ev-table-empty">
                        <div className="ev-loading">
                          <div className="ev-spinner-sm"/>
                          <span>Loading events…</span>
                        </div>
                      </td>
                    </tr>
                  ) : events.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="ev-table-empty">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="32" height="32">
                          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                        <p>No events yet.</p>
                        <span>Create your first event using the form on the left.</span>
                      </td>
                    </tr>
                  ) : (() => {
                    const filtered = events.filter(e =>
                      e.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      e.date?.includes(searchQuery) ||
                      (e.status || '').toLowerCase().includes(searchQuery.toLowerCase())
                    );
                    if (filtered.length === 0) return (
                      <tr>
                        <td colSpan="6" className="ev-table-empty">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
                            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                          </svg>
                          <p>No results for "{searchQuery}"</p>
                          <span>Try a different search term.</span>
                        </td>
                      </tr>
                    );
                    return filtered.map((event, idx) => (
                      <tr key={event.id}>
                        <td className="ev-td-num">{idx + 1}</td>
                        <td className="ev-td-title">{event.title}</td>
                        <td className="ev-td-meta">
                          {event.date
                            ? new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            : '—'}
                        </td>
                        <td className="ev-td-meta">
                          {event.time ? fmt12(event.time) : '—'}
                          {event.endTime ? ` – ${fmt12(event.endTime)}` : ''}
                        </td>
                        <td>
                          <span className={`ev-status-badge ev-status--${event.status || 'upcoming'}`}>
                            {(event.status || 'upcoming').charAt(0).toUpperCase() + (event.status || 'upcoming').slice(1)}
                          </span>
                        </td>
                        <td className="ev-td-center">{event.totalAttendees ?? 0}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateEventForm;
