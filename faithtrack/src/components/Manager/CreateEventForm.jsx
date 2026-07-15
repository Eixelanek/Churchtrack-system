import { useState, useCallback } from 'react';
import { API_BASE_URL } from '../../config/api';

const PRESETS = [
  { key: 'sunday-service',  name: 'Sunday Service',  startTime: '09:00', endTime: '12:00' },
  { key: 'prayer-meeting',  name: 'Prayer Meeting',   startTime: '18:00', endTime: '20:00' },
];

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

  const handlePresetClick = useCallback((preset) => {
    setFormType('preset');
    setSelectedPreset(preset.key);
    setEventDate(getTodayDate());
    setStartTime(preset.startTime);
    setEndTime(preset.endTime);
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

      <div className="qr-form-panel" style={{ maxWidth: 520 }}>
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
                  onChange={(e) => setSelectedPreset(e.target.value)}
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
                onChange={(e) => setStartTime(e.target.value)}
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
      </div>
    </div>
  );
};

export default CreateEventForm;
