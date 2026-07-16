import React, { useState, useCallback, useRef } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { API_BASE_URL } from '../../config/api';

// ── palette ─────────────────────────────────────────────────────────────────
const COLORS = ['#4F46E5', '#7C3AED', '#2563EB', '#0891B2', '#059669', '#D97706', '#DC2626', '#BE185D'];

// ── tiny helpers ─────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, color = '#4F46E5' }) => (
  <div style={{
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    padding: '14px 18px',
    minWidth: 130,
    flex: '1 1 130px',
    borderTop: `3px solid ${color}`,
  }}>
    <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
    <div style={{ fontSize: 12, color: '#374151', fontWeight: 600, marginTop: 2 }}>{label}</div>
    {sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{sub}</div>}
  </div>
);

const SectionTitle = ({ children }) => (
  <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 10, marginTop: 20, borderLeft: '3px solid #4F46E5', paddingLeft: 8 }}>
    {children}
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      <p style={{ fontWeight: 700, marginBottom: 4, color: '#1e293b' }}>{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color, margin: '2px 0' }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

// ── main component ────────────────────────────────────────────────────────────
const AnalyticsReport = ({ churchName = 'Church' }) => {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const todayStr = today.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate,   setEndDate]   = useState(todayStr);
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);

  const printRef = useRef(null);

  // ── fetch ────────────────────────────────────────────────────────────────
  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`${API_BASE_URL}/api/reports/get_analytics.php?startDate=${startDate}&endDate=${endDate}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Failed to load analytics');
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  // ── print ─────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    const printContents = printRef.current?.innerHTML;
    if (!printContents) return;

    const win = window.open('', '_blank', 'width=1024,height=768');
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${churchName} – Analytics Report</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; padding: 24px; }
            h1  { font-size: 20px; text-align: center; color: #1e293b; }
            h2  { font-size: 13px; text-align: center; color: #64748b; margin-bottom: 16px; }
            .print-header { text-align: center; margin-bottom: 20px; }
            .stat-row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
            .stat-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 14px; flex: 1 1 120px; }
            .stat-val { font-size: 20px; font-weight: 700; }
            .stat-lbl { font-size: 11px; color: #374151; font-weight: 600; }
            .section-title { font-weight: 700; font-size: 12px; color: #1e293b; border-left: 3px solid #4F46E5; padding-left: 6px; margin: 16px 0 8px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 12px; }
            th { background: #4F46E5; color: #fff; padding: 6px 8px; text-align: left; }
            td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; }
            tr:nth-child(even) td { background: #f8fafc; }
            .bar-wrap { margin-bottom: 6px; }
            .bar-label { font-size: 11px; margin-bottom: 2px; display: flex; justify-content: space-between; }
            .bar-track { background: #e5e7eb; border-radius: 4px; height: 10px; }
            .bar-fill  { background: #4F46E5; border-radius: 4px; height: 10px; }
            .pill-row  { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
            .pill      { padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; }
            @media print { body { padding: 12px; } }
          </style>
        </head>
        <body>
          <div class="print-header">
            <h1>${churchName}</h1>
            <h2>Analytics Report &nbsp;|&nbsp; ${startDate} to ${endDate}</h2>
            <p style="font-size:11px;color:#64748b;">Generated: ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</p>
          </div>
          ${printContents}
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '4px 0' }}>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Start Date</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>End Date</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }} />
        </div>
        <button onClick={fetchAnalytics} disabled={loading}
          style={{ padding: '8px 18px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
          {loading ? '⏳ Loading…' : '🔄 Generate'}
        </button>
        {data && (
          <button onClick={handlePrint}
            style={{ padding: '8px 18px', background: '#059669', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
            🖨️ Print / Save PDF
          </button>
        )}
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 12 }}>
          ⚠️ {error}
        </div>
      )}

      {!data && !loading && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
          <div style={{ fontSize: 40 }}>📈</div>
          <p style={{ marginTop: 8, fontSize: 14 }}>Set a date range and click Generate to view analytics.</p>
        </div>
      )}

      {data && (
        /* ── printable area ── */
        <div ref={printRef}>

          {/* ── SUMMARY CARDS ── */}
          <SectionTitle>Summary</SectionTitle>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
            <StatCard label="Total Events"    value={data.summary.totalEvents}   color="#4F46E5" />
            <StatCard label="Total Check-ins" value={data.summary.totalCheckins} color="#2563EB" />
            <StatCard label="Avg / Event"     value={data.summary.avgPerEvent}   color="#0891B2" />
            <StatCard label="Active Members"  value={`${data.summary.activeMembers} / ${data.summary.totalMembers}`} color="#059669" />
            <StatCard label="Guests (period)" value={data.summary.guestTotal}    color="#D97706" />
            {data.summary.convertedCount > 0 && (
              <StatCard label="Converted to Member" value={data.summary.convertedCount} color="#7C3AED" />
            )}
          </div>

          {/* ── ATTENDANCE TREND ── */}
          {data.attendanceTrend?.length > 0 && (
            <>
              <SectionTitle>Attendance Trend (by Week)</SectionTitle>
              <div style={{ width: '100%', height: 220, marginBottom: 8 }}>
                <ResponsiveContainer>
                  <BarChart data={data.attendanceTrend} margin={{ top: 4, right: 10, left: -10, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="members" name="Members"  fill="#4F46E5" radius={[3,3,0,0]} />
                    <Bar dataKey="guests"  name="Guests"   fill="#7C3AED" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Print-friendly table version (hidden on screen via @media print — but we include it always so print window picks it up) */}
              <table className="analytics-print-only" style={{ display: 'none' }}>
                <thead><tr><th>Week</th><th>Total</th><th>Members</th><th>Guests</th></tr></thead>
                <tbody>
                  {data.attendanceTrend.map((r, i) => (
                    <tr key={i}><td>{r.week}</td><td>{r.total}</td><td>{r.members}</td><td>{r.guests}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* ── MEMBER GROWTH ── */}
          {data.memberGrowth?.length > 0 && (
            <>
              <SectionTitle>Member Growth (Last 7 Months)</SectionTitle>
              <div style={{ width: '100%', height: 200, marginBottom: 8 }}>
                <ResponsiveContainer>
                  <LineChart data={data.memberGrowth} margin={{ top: 4, right: 10, left: -10, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="count" name="Total Members" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {/* ── SERVICE BREAKDOWN + GENDER side by side ── */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>

            {/* Service Breakdown */}
            {data.serviceBreakdown?.length > 0 && (
              <div style={{ flex: '1 1 280px' }}>
                <SectionTitle>Service Attendance Breakdown</SectionTitle>
                <div style={{ width: '100%', height: 220 }}>
                  <ResponsiveContainer>
                    <BarChart data={data.serviceBreakdown} layout="vertical" margin={{ top: 4, right: 30, left: 10, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="total" name="Check-ins" radius={[0,3,3,0]}>
                        {data.serviceBreakdown.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Gender + Status pie */}
            <div style={{ flex: '1 1 260px' }}>
              {data.genderBreakdown?.length > 0 && (
                <>
                  <SectionTitle>Gender Distribution</SectionTitle>
                  <div style={{ width: '100%', height: 160 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={data.genderBreakdown} dataKey="value" nameKey="name"
                          cx="50%" cy="50%" outerRadius={60} label={({ name, percentage }) => `${name} ${percentage}%`}
                          labelLine={false}>
                          {data.genderBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v, n) => [`${v}`, n]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}

              {data.statusBreakdown?.length > 0 && (
                <>
                  <SectionTitle>Member Status</SectionTitle>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {data.statusBreakdown.map((s, i) => (
                      <div key={i} style={{
                        flex: '1 1 100px',
                        background: s.name === 'Active' ? '#ecfdf5' : '#fffbeb',
                        border: `1px solid ${s.name === 'Active' ? '#6ee7b7' : '#fcd34d'}`,
                        borderRadius: 8, padding: '10px 14px', textAlign: 'center'
                      }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: s.name === 'Active' ? '#059669' : '#D97706' }}>{s.value}</div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{s.percentage}%</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── TOP ACTIVE MEMBERS ── */}
          {data.topMembers?.length > 0 && (
            <>
              <SectionTitle>Top Active Members (by Attendance Days)</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.topMembers.map((m, i) => {
                  const maxDays = data.topMembers[0]?.days || 1;
                  const pct = Math.round((m.days / maxDays) * 100);
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 20, fontSize: 11, color: '#94a3b8', textAlign: 'right' }}>{i + 1}</span>
                      <span style={{ width: 150, fontSize: 12, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                      <div style={{ flex: 1, background: '#e5e7eb', borderRadius: 4, height: 12 }}>
                        <div style={{ width: `${pct}%`, background: COLORS[i % COLORS.length], borderRadius: 4, height: 12, transition: 'width .4s' }} />
                      </div>
                      <span style={{ width: 60, fontSize: 12, color: '#374151', textAlign: 'right' }}>{m.days} day{m.days !== 1 ? 's' : ''}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── empty state ── */}
          {!data.attendanceTrend?.length && !data.topMembers?.length && (
            <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>
              No data found for the selected period.
            </div>
          )}
        </div>
        /* end printable area */
      )}
    </div>
  );
};

export default AnalyticsReport;
