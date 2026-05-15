import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import './AttendanceHistory.css';
import { fetchMemberAttendanceSummary, fetchMonthlyAttendance } from '../../api/memberAttendance';
import { fetchFamilyTree } from '../../api/familyTree';
import { API_BASE_URL } from '../../config/api';

/* ─── helpers ─────────────────────────────────────────────────────────────── */

const getInitials = (fullName) => {
  if (!fullName || typeof fullName !== 'string') return '??';
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return parts.slice(0, 2).map((s) => s.charAt(0).toUpperCase()).join('');
};

const RELATION_COLORS = {
  father: '#4f46e5', mother: '#a855f7', spouse: '#f97316',
  brother: '#22c55e', sister: '#ec4899', son: '#0ea5e9',
  daughter: '#f472b6', guardian: '#14b8a6', other: '#64748b',
};
const getRelationColor = (relation) =>
  RELATION_COLORS[(relation || '').toLowerCase()] || '#6366f1';

/* ─── mini bar chart ──────────────────────────────────────────────────────── */const MonthlyChart = ({ data }) => {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="monthly-chart" aria-label="Monthly attendance chart">
      {data.map((d) => (
        <div key={d.year_month} className="chart-col">
          <span className="chart-count">{d.count}</span>
          <div
            className="chart-bar"
            style={{ height: `${Math.max(4, (d.count / max) * 80)}px` }}
            title={`${d.month}: ${d.count} check-in${d.count !== 1 ? 's' : ''}`}
          />
          <span className="chart-label">{d.month.slice(0, 3)}</span>
        </div>
      ))}
    </div>
  );
};

/* ─── main component ──────────────────────────────────────────────────────── */
const AttendanceHistory = () => {
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('All');
  const [availableMonths, setAvailableMonths] = useState(['All']);
  const [searchTerm, setSearchTerm] = useState('');
  const [records, setRecords] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [summary, setSummary] = useState({ totalServices: 0, rate: 0, streak: 0, monthVisits: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [isLoadingFamily, setIsLoadingFamily] = useState(true);
  const [familyError, setFamilyError] = useState(null);
  const [familyAttendance, setFamilyAttendance] = useState([]);

  // Event detail modal
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [sessionDetail, setSessionDetail] = useState(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  /* ── load attendance ── */
  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const memberId = localStorage.getItem('memberId') || localStorage.getItem('userId');
        if (!memberId) { setError('Member ID not found. Please sign in again.'); return; }

        const [data, monthly] = await Promise.all([
          fetchMemberAttendanceSummary(memberId),
          fetchMonthlyAttendance(memberId).catch(() => []),
        ]);

        const formatted = (data.attendance_records || [])
          .map((r) => {
            if (!r) return null;
            const raw = r.checkin_datetime ? new Date(r.checkin_datetime) : null;
            const d = raw && !isNaN(raw) ? raw : null;
            return {
              id: r.id ?? `att-${r.checkin_datetime}`,
              service: r.service_name || 'QR Attendance',
              date: d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown Date',
              time: d ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '',
              status: r.status || 'Present',
              monthLabel: d ? d.toLocaleString('en-US', { month: 'long', year: 'numeric' }) : 'Unknown Month',
              sortValue: d ? d.getTime() : 0,
              sessionId: r.session_id ?? null,
            };          })
          .filter(Boolean)
          .sort((a, b) => b.sortValue - a.sortValue);

        const months = Array.from(new Set(formatted.map((r) => r.monthLabel).filter((l) => l !== 'Unknown Month')));
        setRecords(formatted);
        setAvailableMonths(['All', ...months]);
        setSummary({
          totalServices: data.total_visits ?? formatted.length,
          rate: data.attendance_rate ?? 0,
          streak: data.attendance_streak ?? 0,
          monthVisits: data.month_visits ?? 0,
        });
        setMonthlyData(monthly.slice().reverse()); // oldest → newest for chart
      } catch {
        setError('Unable to load your attendance history right now.');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  /* ── load family ── */
  useEffect(() => {
    const memberId = localStorage.getItem('memberId') || localStorage.getItem('userId');
    if (!memberId) { setIsLoadingFamily(false); setFamilyError('Member ID not found.'); return; }

    const load = async () => {
      setIsLoadingFamily(true);
      try {
        const response = await fetchFamilyTree(Number(memberId));
        const tree = response?.tree ?? {};

        let selfPhotoUrl = null;
        try {
          const sr = await fetch(`${API_BASE_URL}/api/members/get.php?id=${memberId}`);
          if (sr.ok) {
            const sd = await sr.json();
            const pic = sd?.member?.profile_picture;
            if (pic) {
              const fn = pic.replace('/uploads/profile_pictures/', '').replace(/^\/+/, '');
              selfPhotoUrl = `${API_BASE_URL}/api/uploads/get_profile_picture.php?path=${fn}`;
            }
          }
        } catch { /* ignore */ }

        const storedName = localStorage.getItem('memberName') || 'You';
        const list = [];
        const seen = new Set();

        const push = (m, { isYou = false, fallbackRelation = 'Family' } = {}) => {
          if (!m) return;
          const name = m.name || storedName;
          const relation = isYou ? 'You' : (m.relation || fallbackRelation);
          const key = isYou ? 'self' : `${m.id || m.name}-${relation.toLowerCase()}`;
          if (!name || seen.has(key)) return;
          seen.add(key);
          const raw = m.profile_picture || m.photo || m.avatar || null;
          let photoUrl = null;
          if (raw) {
            if (raw.startsWith('http') || raw.startsWith('data:')) photoUrl = raw;
            else if (raw.includes('/uploads/profile_pictures/')) {
              const fn = raw.replace('/uploads/profile_pictures/', '').replace(/^\/+/, '');
              photoUrl = `${API_BASE_URL}/api/uploads/get_profile_picture.php?path=${fn}`;
            } else photoUrl = `${API_BASE_URL}/${raw.replace(/^\//, '')}`;
          } else if (isYou && selfPhotoUrl) photoUrl = selfPhotoUrl;
          list.push({ key, name, role: relation, color: isYou ? '#3b82f6' : getRelationColor(relation), initials: getInitials(name), isYou, photoUrl });
        };

        push({ id: memberId, name: storedName }, { isYou: true });
        [tree.parents, tree.couple, tree.siblings, tree.children, tree.other].forEach((g, i) => {
          if (!Array.isArray(g)) return;
          g.forEach((rel) => push(rel, { fallbackRelation: ['Parent', 'Spouse', 'Sibling', 'Child', 'Family'][i] }));
        });

        setFamilyMembers(list);

        const ids = list.filter((m) => !m.isYou && m.key.includes('-')).map((m) => m.key.split('-')[0]).filter((id) => !isNaN(id));
        if (ids.length > 0) {
          const all = await Promise.all(ids.map(async (id) => {
            try {
              const d = await fetchMemberAttendanceSummary(id);
              return (d.attendance_records || []).map((r) => ({
                memberId: id,
                eventDate: r.checkin_datetime ? new Date(r.checkin_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null,
                serviceName: r.service_name || 'QR Attendance',
              }));
            } catch { return []; }
          }));
          setFamilyAttendance(all.flat());
        }
      } catch {
        setFamilyMembers([]);
        setFamilyError('Unable to load your family circle right now.');
      } finally {
        setIsLoadingFamily(false);
      }
    };
    load();
  }, []);

  /* ── filtered records ── */
  const filteredRecords = useMemo(() => {
    let list = records;
    if (selectedMonth !== 'All') list = list.filter((r) => r.monthLabel === selectedMonth);
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter((r) => r.service.toLowerCase().includes(q) || r.date.toLowerCase().includes(q));
    }
    if (selectedFilter === 'me') {
      list = list.filter((r) => !familyAttendance.some((fa) => fa.eventDate === r.date && fa.serviceName === r.service));
    } else if (selectedFilter === 'family') {
      list = list.filter((r) => familyAttendance.some((fa) => fa.eventDate === r.date && fa.serviceName === r.service));
    }
    return list;
  }, [records, selectedMonth, searchTerm, selectedFilter, familyAttendance]);

  /* ── open event detail ── */
  const openDetail = useCallback(async (record) => {
    setSelectedRecord(record);
    setSessionDetail(null);
    if (record.sessionId) {
      setIsLoadingDetail(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/qr_sessions/get_by_id.php?id=${record.sessionId}`);
        const json = await res.json();
        if (json.success) setSessionDetail(json.data);
      } catch { /* show what we have */ }
      finally { setIsLoadingDetail(false); }
    }
  }, []);

  const closeDetail = useCallback(() => {
    setSelectedRecord(null);
    setSessionDetail(null);
  }, []);

  /* ── export CSV ── */
  const handleExport = useCallback(() => {
    if (filteredRecords.length === 0) return;
    const header = 'Service,Date,Time,Status';
    const rows = filteredRecords.map((r) => `"${r.service}","${r.date}","${r.time}","${r.status}"`);
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-attendance-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportMsg('Downloaded!');
    clearTimeout(exportTimerRef.current);
    exportTimerRef.current = setTimeout(() => setExportMsg(''), 2500);
  }, [filteredRecords]);

  const rateColor = summary.rate >= 75 ? '#10b981' : summary.rate >= 50 ? '#f59e0b' : '#ef4444';

  /* ── detail modal ── */
  const detailModal = selectedRecord ? createPortal(
    <div className="ah-modal-overlay" onClick={closeDetail} role="presentation">
      <div className="ah-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="ah-modal-title">
        {/* Header */}
        <div className="ah-modal-header">
          <div className="ah-modal-header-main">
            <div className="ah-modal-icon-box" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div>
              <h3 id="ah-modal-title" className="ah-modal-title">{selectedRecord.service}</h3>
              <p className="ah-modal-sub">Attendance Record</p>
            </div>
          </div>
          <button className="ah-modal-close" onClick={closeDetail} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="ah-modal-body">
          {/* Status pill */}
          <div className="ah-modal-status-row">
            <span className="ah-modal-status-pill">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              {selectedRecord.status}
            </span>
          </div>

          {/* Info rows */}
          <div className="ah-modal-info-grid">
            <div className="ah-modal-info-item">
              <span className="ah-modal-info-label">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Date
              </span>
              <span className="ah-modal-info-value">{selectedRecord.date}</span>
            </div>
            {selectedRecord.time && (
              <div className="ah-modal-info-item">
                <span className="ah-modal-info-label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  Check-in Time
                </span>
                <span className="ah-modal-info-value">{selectedRecord.time}</span>
              </div>
            )}
            <div className="ah-modal-info-item">
              <span className="ah-modal-info-label">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                Service
              </span>
              <span className="ah-modal-info-value">{selectedRecord.service}</span>
            </div>

            {/* Extra session details if loaded */}
            {isLoadingDetail ? (
              <div className="ah-modal-loading">
                <span className="ah-modal-spinner" />
                Loading event details…
              </div>
            ) : sessionDetail ? (
              <>
                {sessionDetail.event_type && (
                  <div className="ah-modal-info-item">
                    <span className="ah-modal-info-label">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      Event Type
                    </span>
                    <span className="ah-modal-info-value ah-modal-info-value--cap">{sessionDetail.event_type}</span>
                  </div>
                )}
                {sessionDetail.event_location && (
                  <div className="ah-modal-info-item">
                    <span className="ah-modal-info-label">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      Location
                    </span>
                    <span className="ah-modal-info-value">{sessionDetail.event_location}</span>
                  </div>
                )}
                {sessionDetail.scan_count != null && (
                  <div className="ah-modal-info-item">
                    <span className="ah-modal-info-label">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                      Total Attendees
                    </span>
                    <span className="ah-modal-info-value">{sessionDetail.scan_count}</span>
                  </div>
                )}
                {sessionDetail.status && (
                  <div className="ah-modal-info-item">
                    <span className="ah-modal-info-label">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                      Session Status
                    </span>
                    <span className={`ah-modal-session-status ah-modal-session-status--${sessionDetail.status}`}>
                      {sessionDetail.status}
                    </span>
                  </div>
                )}
                {sessionDetail.event_description && (
                  <div className="ah-modal-info-item ah-modal-info-item--full">
                    <span className="ah-modal-info-label">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                      Description
                    </span>
                    <span className="ah-modal-info-value ah-modal-info-value--desc">{sessionDetail.event_description}</span>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>

        <div className="ah-modal-footer">
          <button className="ah-modal-close-btn" onClick={closeDetail}>Close</button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
    <div className="my-attendance-page">
      {/* Header */}
      <div className="my-attendance-header">
        <h1>My Attendance</h1>
        <p>Track your service attendance and stay consistent in your faith journey.</p>
      </div>

      <div className="my-attendance-content">
        {/* ── Main ── */}
        <div className="attendance-main">

          {/* Stats row */}
          <div className="ah-stats-row">
            <div className="ah-stat-card ah-stat--blue">
              <div className="ah-stat-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <div>
                <div className="ah-stat-value">{summary.totalServices}</div>
                <div className="ah-stat-label">Total Services</div>
              </div>
            </div>
            <div className="ah-stat-card ah-stat--green">
              <div className="ah-stat-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              </div>
              <div>
                <div className="ah-stat-value" style={{ color: rateColor }}>{summary.rate}%</div>
                <div className="ah-stat-label">Attendance Rate</div>
              </div>
            </div>
            <div className="ah-stat-card ah-stat--amber">
              <div className="ah-stat-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              </div>
              <div>
                <div className="ah-stat-value" style={{ color: '#f59e0b' }}>{summary.streak}</div>
                <div className="ah-stat-label">Day Streak</div>
              </div>
            </div>
            <div className="ah-stat-card ah-stat--purple">
              <div className="ah-stat-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <div>
                <div className="ah-stat-value" style={{ color: '#8b5cf6' }}>{summary.monthVisits}</div>
                <div className="ah-stat-label">This Month</div>
              </div>
            </div>
          </div>

          {/* Monthly chart */}
          {monthlyData.length > 0 && (
            <div className="ah-chart-card">
              <div className="ah-chart-header">
                <span className="ah-chart-title">Monthly Attendance</span>
                <span className="ah-chart-sub">Last {monthlyData.length} months</span>
              </div>
              <MonthlyChart data={monthlyData} />
            </div>
          )}

          {/* Filters + search + export */}
          <div className="attendance-filters">
            <div className="filter-group">
              <span className="filter-label">Filter:</span>
              {[['all', 'All Records'], ['me', 'Only Me'], ['family', 'With Family']].map(([val, label]) => (
                <button key={val} className={`filter-btn ${selectedFilter === val ? 'active' : ''}`} onClick={() => setSelectedFilter(val)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="ah-right-controls">
              <div className="ah-search-wrap">
                <svg className="ah-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                  className="ah-search-input"
                  type="text"
                  placeholder="Search service…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  aria-label="Search attendance records"
                />
                {searchTerm && (
                  <button className="ah-search-clear" onClick={() => setSearchTerm('')} aria-label="Clear search">×</button>
                )}
              </div>
              <select className="month-selector" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                {availableMonths.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* Records list */}
          <div className="attendance-records">
            <div className="ah-records-header">
              <h3>Attendance Records <span className="ah-count-badge">{filteredRecords.length}</span></h3>
            </div>

            {isLoading ? (
              <div className="ah-skeleton-list">
                {[1, 2, 3].map((i) => <div key={i} className="ah-skeleton-card" />)}
              </div>
            ) : error ? (
              <div className="records-placeholder error">{error}</div>
            ) : filteredRecords.length === 0 ? (
              <div className="ah-empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <p>No records found for this filter.</p>
                {(selectedMonth !== 'All' || searchTerm || selectedFilter !== 'all') && (
                  <button className="ah-reset-btn" onClick={() => { setSelectedMonth('All'); setSearchTerm(''); setSelectedFilter('all'); }}>
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className="records-list">
                {filteredRecords.map((record) => (
                  <button
                    key={record.id}
                    className="attendance-record-card"
                    onClick={() => openDetail(record)}
                    aria-label={`View details for ${record.service} on ${record.date}`}
                  >
                    <div className="record-left">
                      <div className="record-dot" />
                      <div>
                        <div className="record-header">
                          <h4>{record.service}</h4>
                        </div>
                        <div className="record-datetime">{record.date}{record.time && ` · ${record.time}`}</div>
                      </div>
                    </div>
                    <div className="record-right">
                      <span className="record-status">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        {record.status}
                      </span>
                      <svg className="record-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div className="attendance-sidebar">
          {/* Family Circle */}
          <div className="family-card">
            <div className="family-header">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <h3>Family Circle</h3>
            </div>
            {isLoadingFamily ? (
              <div className="family-placeholder">Loading family circle…</div>
            ) : familyError ? (
              <div className="family-placeholder error">{familyError}</div>
            ) : familyMembers.length > 0 ? (
              <>
                <div className="family-members">
                  {familyMembers.map((member) => (
                    <div key={member.key} className="family-member">
                      <div className="member-avatar" style={{ backgroundColor: member.color }}>
                        {member.photoUrl ? (
                          <img src={member.photoUrl} alt={`${member.name} avatar`}
                            onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement.textContent = member.initials; }} />
                        ) : member.initials}
                      </div>
                      <div className="member-info">
                        <div className="member-name">{member.name}</div>
                        <div className="member-role">{member.role}</div>
                      </div>
                      {member.isYou && <span className="you-badge">You</span>}
                    </div>
                  ))}
                </div>
                {familyMembers.length === 1 && (
                  <p className="family-empty-note">Invite family members from your Family Tree to see them here.</p>
                )}
              </>
            ) : (
              <div className="family-placeholder">No family members connected yet.</div>
            )}
          </div>

          {/* Attendance tips */}
          <div className="ah-tips-card">
            <div className="ah-tips-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Tips
            </div>
            <ul className="ah-tips-list">
              <li>Use <strong>With Family</strong> to see services you attended together.</li>
              <li>Search by service name to find a specific event.</li>
              <li>Export your records to keep a personal copy.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
    {detailModal}
    </>
  );
};

export default AttendanceHistory;