import React, { useState, useCallback, useRef } from 'react';
import html2canvas from 'html2canvas';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { API_BASE_URL } from '../../config/api';

const COLORS = ['#4F46E5', '#7C3AED', '#2563EB', '#0891B2', '#059669', '#D97706', '#DC2626', '#BE185D'];

const SectionTitle = ({ children, icon }) => (
  <div style={{
    fontWeight: 700, fontSize: 13, color: '#1e293b',
    marginBottom: 8, marginTop: 0,
    display: 'flex', alignItems: 'center', gap: 6
  }}>
    {icon && <span>{icon}</span>}
    {children}
  </div>
);

const Card = ({ children, style = {}, className = '', ...rest }) => (
  <div className={className} style={{
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    padding: '14px 16px',
    ...style
  }} {...rest}>
    {children}
  </div>
);

const StatCard = ({ label, value, color = '#4F46E5', icon }) => (
  <div style={{
    background: '#fff', border: '1px solid #e5e7eb',
    borderRadius: 10, padding: '12px 14px',
    borderTop: `3px solid ${color}`,
    minWidth: 110, flex: '1 1 110px',
  }}>
    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>{icon} {label}</div>
    <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', fontSize: 11, boxShadow: '0 4px 12px rgba(0,0,0,.08)' }}>
      <p style={{ fontWeight: 700, marginBottom: 4, color: '#1e293b', fontSize: 12 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color, margin: '2px 0' }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

const AnalyticsReport = ({ churchName = 'Church', churchLogo = null }) => {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const todayStr = today.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate,   setEndDate]   = useState(todayStr);
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [printing,  setPrinting]  = useState(false);
  const printRef = useRef(null);

  // ── fetch ─────────────────────────────────────────────────────────────────
  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`${API_BASE_URL}/api/reports/get_analytics.php?startDate=${startDate}&endDate=${endDate}`);
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); }
      catch {
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

  // ── print — captures charts, injects hidden print div, calls window.print() ─
  const handlePrint = async () => {
    if (!data || !printRef.current) return;

    setPrinting(true);
    try {
      // Capture each chart card as a PNG image
      const chartCards = printRef.current.querySelectorAll('.analytics-chart-card');
      const chartImages = {};
      for (const card of chartCards) {
        const canvas = await html2canvas(card, { scale: 1.5, useCORS: true, backgroundColor: '#ffffff' });
        chartImages[card.dataset.chartId] = canvas.toDataURL('image/png');
      }

      const summary = data.summary;
      const genTime = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });

      const makeTable = (headers, rows) => `
        <table class="print-table">
          <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c ?? ''}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>`;

      const logoHtml = churchLogo
        ? `<img src="${churchLogo}" class="print-logo" alt="logo" />`
        : '';

      const chartImg = (id) => chartImages[id]
        ? `<img src="${chartImages[id]}" class="chart-img" />`
        : '';

      const printContent = `
        <div class="print-header">
          ${logoHtml}
          <h1>${churchName}</h1>
          <h2>Analytics Report &nbsp;|&nbsp; ${startDate} to ${endDate}</h2>
          <p>Generated: ${genTime}</p>
        </div>

        <div class="section-title">Summary</div>
        <div class="stat-grid">
          ${[
            ['Total Events', summary.totalEvents, '#4F46E5'],
            ['Total Check-ins', summary.totalCheckins, '#2563EB'],
            ['Avg / Event', summary.avgPerEvent, '#0891B2'],
            ['Active Members', `${summary.activeMembers} / ${summary.totalMembers}`, '#059669'],
            ['Guests (period)', summary.guestTotal, '#D97706'],
            ...(summary.convertedCount > 0 ? [['Converted', summary.convertedCount, '#7C3AED']] : []),
          ].map(([l, v, c]) => `<div class="stat-card"><div class="stat-val" style="color:${c}">${v}</div><div class="stat-lbl">${l}</div></div>`).join('')}
        </div>

        ${chartImg('attendance-trend')}

        <div class="two-col">
          <div>${chartImg('member-growth')}</div>
          <div>${chartImg('service-breakdown')}</div>
        </div>

        <div class="two-col">
          <div>${chartImg('gender-pie')}</div>
          <div>
            ${data.statusBreakdown?.length ? `<div class="section-title">Member Status</div>${makeTable(['Status','Count','%'], data.statusBreakdown.map(r => [r.name, r.value, r.percentage + '%']))}` : ''}
          </div>
        </div>

        ${data.topMembers?.length ? `<div class="section-title">Top Active Members</div>${makeTable(['#','Name','Attendance Days'], data.topMembers.map((m, i) => [i + 1, m.name, m.days]))}` : ''}
      `;

      // Inject hidden print container into current document
      let printDiv = document.getElementById('analytics-print-container');
      if (printDiv) printDiv.remove();
      printDiv = document.createElement('div');
      printDiv.id = 'analytics-print-container';
      printDiv.innerHTML = printContent;
      document.body.appendChild(printDiv);

      // Inject print styles
      let styleEl = document.getElementById('analytics-print-style');
      if (styleEl) styleEl.remove();
      styleEl = document.createElement('style');
      styleEl.id = 'analytics-print-style';
      styleEl.textContent = `
        @media print {
          html, body {
            overflow: visible !important;
            height: auto !important;
          }
          body > *:not(#analytics-print-container) { display: none !important; }
          #analytics-print-container {
            display: block !important;
            position: relative !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
          }
        }
        #analytics-print-container {
          display: none;
          font-family: Arial, sans-serif;
          font-size: 12px;
          color: #1e293b;
          padding: 20px;
          overflow: visible;
          height: auto;
        }
        #analytics-print-container .print-header { text-align: center; margin-bottom: 16px; }
        #analytics-print-container .print-logo { height: 60px; object-fit: contain; margin-bottom: 6px; display: block; margin-left: auto; margin-right: auto; }
        #analytics-print-container h1 { font-size: 20px; font-weight: 700; margin: 0; }
        #analytics-print-container h2 { font-size: 13px; color: #64748b; margin: 4px 0 0; font-weight: 400; }
        #analytics-print-container p  { font-size: 11px; color: #94a3b8; margin: 4px 0 0; }
        #analytics-print-container .section-title { font-weight: 700; font-size: 12px; border-left: 3px solid #4F46E5; padding-left: 6px; margin: 14px 0 6px; }
        #analytics-print-container .stat-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
        #analytics-print-container .stat-card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 12px; flex: 1 1 100px; }
        #analytics-print-container .stat-val { font-size: 17px; font-weight: 700; }
        #analytics-print-container .stat-lbl { font-size: 10px; color: #374151; font-weight: 600; margin-top: 2px; }
        #analytics-print-container .chart-img { width: 100%; border-radius: 6px; margin-bottom: 10px; display: block; }
        #analytics-print-container .two-col { display: flex; gap: 12px; }
        #analytics-print-container .two-col > div { flex: 1 1 45%; }
        #analytics-print-container .print-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 12px; }
        #analytics-print-container .print-table th { background: #4F46E5; color: #fff; padding: 5px 7px; text-align: left; }
        #analytics-print-container .print-table td { padding: 4px 7px; border-bottom: 1px solid #f1f5f9; }
        #analytics-print-container .print-table tr:nth-child(even) td { background: #f8fafc; }
      `;
      document.head.appendChild(styleEl);

      // Trigger print
      window.print();

      // Cleanup after print dialog closes
      setTimeout(() => {
        printDiv.remove();
        styleEl.remove();
      }, 2000);

    } catch (e) {
      alert('Print failed: ' + e.message);
    } finally {
      setPrinting(false);
    }
  };

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '4px 0', minHeight: 0 }}>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>Start Date</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12 }} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>End Date</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12 }} />
        </div>
        <button onClick={fetchAnalytics} disabled={loading}
          style={{ padding: '7px 16px', background: loading ? '#a5b4fc' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 12 }}>
          {loading ? '⏳ Loading…' : '🔄 Generate'}
        </button>
        {data && (
          <button onClick={handlePrint} disabled={printing}
            style={{ padding: '7px 16px', background: printing ? '#6ee7b7' : '#059669', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 600, cursor: printing ? 'not-allowed' : 'pointer', fontSize: 12 }}>
            {printing ? '⏳ Preparing…' : '🖨️ Print / Save PDF'}
          </button>
        )}
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 12, marginBottom: 12 }}>
          ⚠️ {error}
        </div>
      )}

      {!data && !loading && (
        <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>
          <div style={{ fontSize: 36 }}>📈</div>
          <p style={{ marginTop: 6, fontSize: 13 }}>Set a date range and click Generate.</p>
        </div>
      )}

      {data && (
        <div ref={printRef}>

          {/* ── ROW 1: Summary stat cards ── */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <StatCard icon="📅" label="Total Events"    value={data.summary.totalEvents}   color="#4F46E5" />
            <StatCard icon="✅" label="Total Check-ins" value={data.summary.totalCheckins} color="#2563EB" />
            <StatCard icon="📊" label="Avg / Event"     value={data.summary.avgPerEvent}   color="#0891B2" />
            <StatCard icon="👥" label="Active Members"  value={`${data.summary.activeMembers}/${data.summary.totalMembers}`} color="#059669" />
            <StatCard icon="🙋" label="Guests"          value={data.summary.guestTotal}    color="#D97706" />
            {data.summary.convertedCount > 0 && (
              <StatCard icon="⭐" label="Converted"     value={data.summary.convertedCount} color="#7C3AED" />
            )}
          </div>

          {/* ── ROW 2: Attendance Trend (full width) ── */}
          {data.attendanceTrend?.length > 0 && (
            <Card style={{ marginBottom: 12 }} className="analytics-chart-card" data-chart-id="attendance-trend">
              <SectionTitle icon="📅">Attendance Trend (by Week)</SectionTitle>
              <div style={{ width: '100%', height: 180 }}>
                <ResponsiveContainer>
                  <BarChart data={data.attendanceTrend} margin={{ top: 4, right: 10, left: -10, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="members" name="Members" stackId="a" fill="#4F46E5" radius={[0,0,0,0]} />
                    <Bar dataKey="guests"  name="Guests"  stackId="a" fill="#7C3AED" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* ── ROW 3: Member Growth + Service Breakdown side by side ── */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>

            {data.memberGrowth?.length > 0 && (
              <Card style={{ flex: '1 1 280px' }} className="analytics-chart-card" data-chart-id="member-growth">
                <SectionTitle icon="📈">Member Growth (Last 7 Months)</SectionTitle>
                <div style={{ width: '100%', height: 155 }}>
                  <ResponsiveContainer>
                    <AreaChart data={data.memberGrowth} margin={{ top: 4, right: 10, left: -10, bottom: 4 }}>
                      <defs>
                        <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#059669" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="count" name="Total Members" stroke="#059669" strokeWidth={2} fill="url(#growthGrad)" dot={{ r: 3 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}

            {data.serviceBreakdown?.length > 0 && (
              <Card style={{ flex: '1 1 280px' }} className="analytics-chart-card" data-chart-id="service-breakdown">
                <SectionTitle icon="🏛️">Service Breakdown</SectionTitle>
                <div style={{ width: '100%', height: 155 }}>
                  <ResponsiveContainer>
                    <BarChart data={data.serviceBreakdown} layout="vertical" margin={{ top: 4, right: 30, left: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={100} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="total" name="Check-ins" radius={[0,3,3,0]}>
                        {data.serviceBreakdown.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}
          </div>

          {/* ── ROW 4: Gender pie + Member Status + Top Members ── */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>

            {data.genderBreakdown?.length > 0 && (
              <Card style={{ flex: '1 1 200px' }} className="analytics-chart-card" data-chart-id="gender-pie">
                <SectionTitle icon="⚧">Gender Distribution</SectionTitle>
                <div style={{ width: '100%', height: 155 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={data.genderBreakdown}
                        dataKey="value" nameKey="name"
                        cx="50%" cy="50%"
                        innerRadius={35} outerRadius={65}
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
              </Card>
            )}

            {data.statusBreakdown?.length > 0 && (
              <Card style={{ flex: '0 1 160px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <SectionTitle icon="🔵">Member Status</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                  {data.statusBreakdown.map((s, i) => (
                    <div key={i} style={{
                      background: s.name === 'Active' ? '#ecfdf5' : '#fffbeb',
                      border: `1px solid ${s.name === 'Active' ? '#6ee7b7' : '#fcd34d'}`,
                      borderRadius: 8, padding: '10px 14px', textAlign: 'center'
                    }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: s.name === 'Active' ? '#059669' : '#D97706' }}>{s.value}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{s.percentage}%</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {data.topMembers?.length > 0 && (
              <Card style={{ flex: '2 1 280px' }}>
                <SectionTitle icon="🏆">Top Active Members</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4 }}>
                  {data.topMembers.map((m, i) => {
                    const maxDays = data.topMembers[0]?.days || 1;
                    const pct = Math.round((m.days / maxDays) * 100);
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 16, fontSize: 10, color: '#94a3b8', textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                        <span style={{ width: 150, fontSize: 11, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{m.name}</span>
                        <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 4, height: 10, minWidth: 40 }}>
                          <div style={{ width: `${pct}%`, background: COLORS[i % COLORS.length], borderRadius: 4, height: 10, transition: 'width .4s' }} />
                        </div>
                        <span style={{ width: 50, fontSize: 11, color: '#64748b', textAlign: 'right', flexShrink: 0 }}>{m.days}d</span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>

          {/* Empty state */}
          {!data.attendanceTrend?.length && !data.topMembers?.length && !data.memberGrowth?.length && (
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
