import React, { useState, useCallback, useRef } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { API_BASE_URL } from '../../config/api';

const COLORS = ['#4F46E5', '#7C3AED', '#2563EB', '#0891B2', '#059669', '#D97706', '#DC2626', '#BE185D'];

const StatCard = ({ label, value, color = '#4F46E5' }) => (
  <div style={{
    background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
    padding: '14px 18px', minWidth: 130, flex: '1 1 130px',
    borderTop: `3px solid ${color}`,
  }}>
    <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
    <div style={{ fontSize: 12, color: '#374151', fontWeight: 600, marginTop: 2 }}>{label}</div>
  </div>
);

const SectionTitle = ({ children }) => (
  <div style={{
    fontWeight: 700, fontSize: 14, color: '#1e293b',
    marginBottom: 10, marginTop: 20,
    borderLeft: '3px solid #4F46E5', paddingLeft: 8
  }}>
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

  // ── fetch ─────────────────────────────────────────────────────────────────
  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`${API_BASE_URL}/api/reports/get_analytics.php?startDate=${startDate}&endDate=${endDate}`);
      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        const match = text.match(/<b>([^<]+)<\/b>/);
        throw new Error(match ? match[1] : 'Server error — check PHP logs.');
      }
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
    if (!printRef.current) return;

    // Collect SVG chart content + data tables from the printable div
    const svgCharts = Array.from(printRef.current.querySelectorAll('svg'))
      .map(svg => svg.outerHTML).join('');

    // Build structured print HTML manually so charts appear properly
    const summary = data.summary;
    const genTime = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });

    const summaryRows = [
      ['Total Events', summary.totalEvents],
      ['Total Check-ins', summary.totalCheckins],
      ['Avg / Event', summary.avgPerEvent],
      [`Active Members`, `${summary.activeMembers} / ${summary.totalMembers}`],
      ['Guests (period)', summary.guestTotal],
      ...(summary.convertedCount > 0 ? [['Converted to Member', summary.convertedCount]] : []),
    ];

    const makeTable = (headers, rows) => `
      <table>
        <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>`;

    const attendanceTable = data.attendanceTrend?.length
      ? makeTable(['Week', 'Total', 'Members', 'Guests'],
          data.attendanceTrend.map(r => [r.week, r.total, r.members, r.guests]))
      : '';

    const growthTable = data.memberGrowth?.length
      ? makeTable(['Month', 'Total Members'],
          data.memberGrowth.map(r => [r.month, r.count]))
      : '';

    const serviceTable = data.serviceBreakdown?.length
      ? makeTable(['Service', 'Check-ins', '%'],
          data.serviceBreakdown.map(r => [r.name, r.total, r.percentage + '%']))
      : '';

    const genderTable = data.genderBreakdown?.length
      ? makeTable(['Gender', 'Count', '%'],
          data.genderBreakdown.map(r => [r.name, r.value, r.percentage + '%']))
      : '';

    const statusTable = data.statusBreakdown?.length
      ? makeTable(['Status', 'Count', '%'],
          data.statusBreakdown.map(r => [r.name, r.value, r.percentage + '%']))
      : '';

    const topTable = data.topMembers?.length
      ? makeTable(['#', 'Name', 'Attendance Days'],
          data.topMembers.map((m, i) => [i + 1, m.name, m.days]))
      : '';

    const win = window.open('', '_blank', 'width=1100,height=800');
    if (!win) {
      alert('Pop-up blocked. Please allow pop-ups for this site and try again.');
      return;
    }

    win.document.write(`<!DOCTYPE html><html><head>
      <title>${churchName} – Analytics Report</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; padding: 28px; }
        .header { text-align: center; margin-bottom: 20px; }
        .header h1 { font-size: 20px; }
        .header h2 { font-size: 14px; color: #64748b; margin-top: 4px; }
        .header p  { font-size: 11px; color: #94a3b8; margin-top: 4px; }
        .section-title { font-weight: 700; font-size: 12px; border-left: 3px solid #4F46E5;
          padding-left: 6px; margin: 18px 0 8px; }
        .stat-grid { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; }
        .stat-card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 14px;
          flex: 1 1 120px; }
        .stat-val  { font-size: 18px; font-weight: 700; color: #4F46E5; }
        .stat-lbl  { font-size: 11px; color: #374151; font-weight: 600; margin-top: 2px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 14px; }
        th { background: #4F46E5; color: #fff; padding: 6px 8px; text-align: left; }
        td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; }
        tr:nth-child(even) td { background: #f8fafc; }
        .two-col { display: flex; gap: 16px; }
        .two-col > div { flex: 1 1 45%; }
        @media print { body { padding: 12px; } }
      </style>
    </head><body>
      <div class="header">
        <h1>${churchName}</h1>
        <h2>Analytics Report &nbsp;|&nbsp; ${startDate} &nbsp;to&nbsp; ${endDate}</h2>
        <p>Generated: ${genTime}</p>
      </div>

      <div class="section-title">Summary</div>
      <div class="stat-grid">
        ${summaryRows.map(([l, v]) => `
          <div class="stat-card">
            <div class="stat-val">${v}</div>
            <div class="stat-lbl">${l}</div>
          </div>`).join('')}
      </div>

      ${attendanceTable ? `<div class="section-title">Attendance Trend (by Week)</div>${attendanceTable}` : ''}
      ${growthTable     ? `<div class="section-title">Member Growth (Last 7 Months)</div>${growthTable}` : ''}

      <div class="two-col">
        <div>
          ${serviceTable ? `<div class="section-title">Service Breakdown</div>${serviceTable}` : ''}
        </div>
        <div>
          ${genderTable ? `<div class="section-title">Gender Distribution</div>${genderTable}` : ''}
          ${statusTable ? `<div class="section-title">Member Status</div>${statusTable}` : ''}
        </div>
      </div>

      ${topTable ? `<div class="section-title">Top Active Members</div>${topTable}` : ''}
    </body></html>`);

    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
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
          style={{ padding: '8px 18px', background: loading ? '#a5b4fc' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13 }}>
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
        <div ref={printRef}>

          {/* SUMMARY */}
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

          {/* ATTENDANCE TREND */}
          {data.attendanceTrend?.length > 0 && (
            <>
              <SectionTitle>Attendance Trend (by Week)</SectionTitle>
              <div style={{ width: '100%', height: 220, marginBottom: 8 }}>
                <ResponsiveContainer>
                  <BarChart data={data.attendanceTrend} margin={{ top: 4, right: 10, left: -10, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="members" name="Members" fill="#4F46E5" radius={[3,3,0,0]} />
                    <Bar dataKey="guests"  name="Guests"  fill="#7C3AED" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {/* MEMBER GROWTH */}
          {data.memberGrowth?.length > 0 && (
            <>
              <SectionTitle>Member Growth (Last 7 Months)</SectionTitle>
              <div style={{ width: '100%', height: 200, marginBottom: 8 }}>
                <ResponsiveContainer>
                  <LineChart data={data.memberGrowth} margin={{ top: 4, right: 10, left: -10, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="count" name="Total Members" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {/* SERVICE + DEMOGRAPHICS side by side */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {data.serviceBreakdown?.length > 0 && (
              <div style={{ flex: '1 1 280px' }}>
                <SectionTitle>Service Attendance Breakdown</SectionTitle>
                <div style={{ width: '100%', height: 220 }}>
                  <ResponsiveContainer>
                    <BarChart data={data.serviceBreakdown} layout="vertical" margin={{ top: 4, right: 40, left: 10, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
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

            <div style={{ flex: '1 1 260px' }}>
              {data.genderBreakdown?.length > 0 && (
                <>
                  <SectionTitle>Gender Distribution</SectionTitle>
                  <div style={{ width: '100%', height: 180 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={data.genderBreakdown}
                          dataKey="value"
                          nameKey="name"
                          cx="50%" cy="50%"
                          outerRadius={65}
                          label={({ name, percentage }) => `${name} ${percentage}%`}
                          labelLine
                        >
                          {data.genderBreakdown.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v, n) => [v, n]} />
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

          {/* TOP ACTIVE MEMBERS */}
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
                      <span style={{ width: 160, fontSize: 12, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
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

          {!data.attendanceTrend?.length && !data.topMembers?.length && (
            <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>
              No data found for the selected period.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AnalyticsReport;
