import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { API_BASE_URL } from '../../config/api';

const COLORS = ['#4F46E5', '#7C3AED', '#2563EB', '#0891B2', '#059669', '#D97706', '#DC2626', '#BE185D'];

// ── Chart components for offscreen rendering ──────────────────────────────
const AttendanceTrendChart = ({ data }) => (
  <div style={{ width: 700, height: 220, background: '#fff', padding: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}>
    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, borderLeft: '3px solid #4F46E5', paddingLeft: 8 }}>Attendance Trend (by Week)</div>
    <BarChart width={680} height={180} data={data} margin={{ top: 4, right: 10, left: -10, bottom: 4 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
      <XAxis dataKey="week" tick={{ fontSize: 11 }} />
      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
      <Tooltip />
      <Legend wrapperStyle={{ fontSize: 12 }} />
      <Bar dataKey="members" name="Members" stackId="a" fill="#4F46E5" />
      <Bar dataKey="guests"  name="Guests"  stackId="a" fill="#7C3AED" radius={[3,3,0,0]} />
    </BarChart>
  </div>
);

const MemberGrowthChart = ({ data }) => (
  <div style={{ width: 340, height: 200, background: '#fff', padding: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}>
    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, borderLeft: '3px solid #4F46E5', paddingLeft: 8 }}>Member Growth (Last 7 Months)</div>
    <AreaChart width={316} height={158} data={data} margin={{ top: 4, right: 10, left: -10, bottom: 4 }}>
      <defs>
        <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#059669" stopOpacity={0.2} />
          <stop offset="95%" stopColor="#059669" stopOpacity={0} />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
      <XAxis dataKey="month" tick={{ fontSize: 9 }} />
      <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
      <Tooltip />
      <Area type="monotone" dataKey="count" name="Members" stroke="#059669" strokeWidth={2} fill="url(#g2)" dot={{ r: 3 }} />
    </AreaChart>
  </div>
);

const ServiceBreakdownChart = ({ data }) => (
  <div style={{ width: 340, height: 200, background: '#fff', padding: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}>
    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, borderLeft: '3px solid #4F46E5', paddingLeft: 8 }}>Service Breakdown</div>
    <BarChart width={316} height={158} data={data} layout="vertical" margin={{ top: 4, right: 30, left: 4, bottom: 4 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
      <XAxis type="number" tick={{ fontSize: 9 }} allowDecimals={false} />
      <YAxis type="category" dataKey="name" tick={{ fontSize: 8 }} width={90} />
      <Tooltip />
      <Bar dataKey="total" name="Check-ins" radius={[0,3,3,0]}>
        {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
      </Bar>
    </BarChart>
  </div>
);

const GenderPieChart = ({ data }) => (
  <div style={{ width: 340, height: 200, background: '#fff', padding: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}>
    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, borderLeft: '3px solid #4F46E5', paddingLeft: 8 }}>Gender Distribution</div>
    <PieChart width={316} height={158}>
      <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%"
        outerRadius={55} innerRadius={25}
        label={({ name, percentage }) => `${name} ${percentage}%`} labelLine>
        {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
      </Pie>
      <Tooltip formatter={(v, n) => [v, n]} />
    </PieChart>
  </div>
);

// ── Offscreen capture helper ───────────────────────────────────────────────
const captureChart = (ChartComponent, props) => new Promise((resolve) => {
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;background:#fff;';
  document.body.appendChild(container);

  const root = createRoot(container);
  root.render(<ChartComponent {...props} />);

  // Wait for React + Recharts to render fully
  setTimeout(async () => {
    try {
      const canvas = await html2canvas(container.firstChild, {
        scale: 1.5, useCORS: true, backgroundColor: '#ffffff', logging: false,
      });
      resolve(canvas.toDataURL('image/png'));
    } catch {
      resolve(null);
    } finally {
      root.unmount();
      container.remove();
    }
  }, 400);
});

// ── UI helpers ────────────────────────────────────────────────────────────
const SectionTitle = ({ children }) => (
  <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 8, marginTop: 0 }}>
    {children}
  </div>
);

const Card = ({ children, style = {}, className = '', ...rest }) => (
  <div className={className} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px', ...style }} {...rest}>
    {children}
  </div>
);

const StatCard = ({ label, value, color = '#4F46E5' }) => (
  <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px', borderTop: `3px solid ${color}`, minWidth: 110, flex: '1 1 110px' }}>
    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', fontSize: 11, boxShadow: '0 4px 12px rgba(0,0,0,.08)' }}>
      <p style={{ fontWeight: 700, marginBottom: 4, color: '#1e293b', fontSize: 12 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color, margin: '2px 0' }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────
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

  const fetchAnalytics = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`${API_BASE_URL}/api/reports/get_analytics.php?startDate=${startDate}&endDate=${endDate}`);
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); }
      catch { const m = text.match(/<b>([^<]+)<\/b>/); throw new Error(m ? m[1] : 'Server error.'); }
      if (!json.success) throw new Error(json.message || 'Failed to load analytics');
      setData(json);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [startDate, endDate]);

  const handlePrint = async () => {
    if (!data) return;
    setPrinting(true);
    try {
      // Render each chart offscreen and capture as image
      const [imgTrend, imgGrowth, imgService, imgGender] = await Promise.all([
        data.attendanceTrend?.length  ? captureChart(AttendanceTrendChart,   { data: data.attendanceTrend })  : Promise.resolve(null),
        data.memberGrowth?.length     ? captureChart(MemberGrowthChart,      { data: data.memberGrowth })     : Promise.resolve(null),
        data.serviceBreakdown?.length ? captureChart(ServiceBreakdownChart,  { data: data.serviceBreakdown }) : Promise.resolve(null),
        data.genderBreakdown?.length  ? captureChart(GenderPieChart,         { data: data.genderBreakdown })  : Promise.resolve(null),
      ]);

      const sum = data.summary;
      const genTime = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
      const logo = churchLogo ? `<img src="${churchLogo}" style="height:60px;object-fit:contain;display:block;margin:0 auto 6px;" />` : '';
      const img  = (src) => src ? `<img src="${src}" style="width:100%;border-radius:6px;margin-bottom:10px;display:block;" />` : '';
      const tbl  = (headers, rows) => `<table class="pt"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c??''}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      const sec  = (t) => `<div class="ps">${t}</div>`;

      const html = `
        <div style="text-align:center;margin-bottom:16px">${logo}<h1 style="font-size:20px;font-weight:700;margin:0">${churchName}</h1>
          <h2 style="font-size:13px;color:#64748b;font-weight:400;margin:4px 0 0">Analytics Report &nbsp;|&nbsp; ${startDate} to ${endDate}</h2>
          <p style="font-size:11px;color:#94a3b8;margin:4px 0 0">Generated: ${genTime}</p></div>
        ${sec('Summary')}
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">
          ${[['Total Events',sum.totalEvents,'#4F46E5'],['Total Check-ins',sum.totalCheckins,'#2563EB'],['Avg/Event',sum.avgPerEvent,'#0891B2'],['Active Members',`${sum.activeMembers}/${sum.totalMembers}`,'#059669'],['Guests',sum.guestTotal,'#D97706'],...(sum.convertedCount>0?[['Converted',sum.convertedCount,'#7C3AED']]:[])].map(([l,v,c])=>`<div class="sc"><div style="font-size:17px;font-weight:700;color:${c}">${v}</div><div style="font-size:10px;font-weight:600;color:#374151">${l}</div></div>`).join('')}
        </div>
        ${imgTrend ? img(imgTrend) : ''}
        <div style="display:flex;gap:12px;margin-bottom:10px">
          <div style="flex:1">${img(imgGrowth)}</div>
          <div style="flex:1">${img(imgService)}</div>
        </div>
        <div style="display:flex;gap:12px;margin-bottom:10px">
          <div style="flex:1">${img(imgGender)}</div>
          <div style="flex:1">${data.statusBreakdown?.length ? sec('Member Status')+tbl(['Status','Count','%'],data.statusBreakdown.map(r=>[r.name,r.value,r.percentage+'%'])) : ''}</div>
        </div>
        ${data.topMembers?.length ? sec('Top Active Members')+tbl(['#','Name','Days'],data.topMembers.map((m,i)=>[i+1,m.name,m.days])) : ''}`;

      document.getElementById('rpt-print-div')?.remove();
      document.getElementById('rpt-print-sty')?.remove();
      const div = document.createElement('div'); div.id='rpt-print-div'; div.innerHTML=html;
      document.body.appendChild(div);
      const sty = document.createElement('style'); sty.id='rpt-print-sty';
      sty.textContent=`
        @media print{html,body{overflow:visible!important;height:auto!important}body>*:not(#rpt-print-div){display:none!important}#rpt-print-div{display:block!important;position:relative!important;overflow:visible!important;height:auto!important;max-height:none!important}}
        #rpt-print-div{display:none;font-family:Arial,sans-serif;font-size:12px;color:#1e293b;padding:24px}
        #rpt-print-div .ps{font-weight:700;font-size:12px;border-left:3px solid #4F46E5;padding-left:6px;margin:14px 0 6px}
        #rpt-print-div .sc{border:1px solid #e5e7eb;border-radius:6px;padding:8px 12px;flex:1 1 100px}
        #rpt-print-div .pt{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:12px}
        #rpt-print-div .pt th{background:#4F46E5;color:#fff;padding:5px 7px;text-align:left}
        #rpt-print-div .pt td{padding:4px 7px;border-bottom:1px solid #f1f5f9}
        #rpt-print-div .pt tr:nth-child(even) td{background:#f8fafc}`;
      document.head.appendChild(sty);
      setTimeout(() => { window.print(); setTimeout(()=>{div.remove();sty.remove();},2000); }, 100);
    } catch(e) { alert('Print failed: '+e.message); }
    finally { setPrinting(false); }
  };

  return (
    <div style={{ padding: '4px 0', minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>Start Date</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12 }} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>End Date</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12 }} />
        </div>
        <button onClick={fetchAnalytics} disabled={loading} style={{ padding: '7px 16px', background: loading ? '#a5b4fc' : '#4F46E5', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 12 }}>
          {loading ? 'Loading…' : 'Generate'}
        </button>
        {data && (
          <button onClick={handlePrint} disabled={printing} style={{ padding: '7px 16px', background: printing ? '#6ee7b7' : '#059669', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 600, cursor: printing ? 'not-allowed' : 'pointer', fontSize: 12 }}>
            {printing ? 'Preparing…' : 'Print / Save PDF'}
          </button>
        )}
      </div>

      {error && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 12, marginBottom: 12 }}>{error}</div>}

      {!data && !loading && (
        <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>
          <p style={{ marginTop: 6, fontSize: 13 }}>Set a date range and click Generate.</p>
        </div>
      )}

      {data && (
        <div ref={printRef}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <StatCard label="Total Events"    value={data.summary.totalEvents}   color="#4F46E5" />
            <StatCard label="Total Check-ins" value={data.summary.totalCheckins} color="#2563EB" />
            <StatCard label="Avg / Event"     value={data.summary.avgPerEvent}   color="#0891B2" />
            <StatCard label="Active Members"  value={`${data.summary.activeMembers}/${data.summary.totalMembers}`} color="#059669" />
            <StatCard label="Guests"          value={data.summary.guestTotal}    color="#D97706" />
            {data.summary.convertedCount > 0 && <StatCard label="Converted" value={data.summary.convertedCount} color="#7C3AED" />}
          </div>

          {data.attendanceTrend?.length > 0 && (
            <Card style={{ marginBottom: 12 }} className="analytics-chart-card" data-chart-id="attendance-trend">
              <SectionTitle>Attendance Trend (by Week)</SectionTitle>
              <div style={{ width: '100%', height: 180 }}>
                <ResponsiveContainer>
                  <BarChart data={data.attendanceTrend} margin={{ top: 4, right: 10, left: -10, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="members" name="Members" stackId="a" fill="#4F46E5" />
                    <Bar dataKey="guests"  name="Guests"  stackId="a" fill="#7C3AED" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            {data.memberGrowth?.length > 0 && (
              <Card style={{ flex: '1 1 280px' }} className="analytics-chart-card" data-chart-id="member-growth">
                <SectionTitle>Member Growth (Last 7 Months)</SectionTitle>
                <div style={{ width: '100%', height: 155 }}>
                  <ResponsiveContainer>
                    <AreaChart data={data.memberGrowth} margin={{ top: 4, right: 10, left: -10, bottom: 4 }}>
                      <defs><linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#059669" stopOpacity={0.2} /><stop offset="95%" stopColor="#059669" stopOpacity={0} /></linearGradient></defs>
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
                <SectionTitle>Service Breakdown</SectionTitle>
                <div style={{ width: '100%', height: 155 }}>
                  <ResponsiveContainer>
                    <BarChart data={data.serviceBreakdown} layout="vertical" margin={{ top: 4, right: 40, left: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={100} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="total" name="Check-ins" radius={[0,3,3,0]}>
                        {data.serviceBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            {data.genderBreakdown?.length > 0 && (
              <Card style={{ flex: '1 1 200px' }} className="analytics-chart-card" data-chart-id="gender-pie">
                <SectionTitle>Gender Distribution</SectionTitle>
                <div style={{ width: '100%', height: 155 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={data.genderBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={65} label={({ name, percentage }) => `${name} ${percentage}%`} labelLine>
                        {data.genderBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v, n) => [v, n]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}
            {data.statusBreakdown?.length > 0 && (
              <Card style={{ flex: '0 1 160px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <SectionTitle>Member Status</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                  {data.statusBreakdown.map((s, i) => (
                    <div key={i} style={{ background: s.name==='Active'?'#ecfdf5':'#fffbeb', border:`1px solid ${s.name==='Active'?'#6ee7b7':'#fcd34d'}`, borderRadius:8, padding:'10px 14px', textAlign:'center' }}>
                      <div style={{ fontSize:24, fontWeight:700, color:s.name==='Active'?'#059669':'#D97706' }}>{s.value}</div>
                      <div style={{ fontSize:11, fontWeight:600, color:'#374151' }}>{s.name}</div>
                      <div style={{ fontSize:11, color:'#9ca3af' }}>{s.percentage}%</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            {data.topMembers?.length > 0 && (
              <Card style={{ flex: '2 1 280px' }}>
                <SectionTitle>Top Active Members</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4 }}>
                  {data.topMembers.map((m, i) => {
                    const pct = Math.round((m.days / (data.topMembers[0]?.days || 1)) * 100);
                    return (
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ width:16, fontSize:10, color:'#94a3b8', textAlign:'right', flexShrink:0 }}>{i+1}</span>
                        <span style={{ width:160, fontSize:11, fontWeight:600, color:'#1e293b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flexShrink:0 }}>{m.name}</span>
                        <div style={{ flex:1, background:'#f1f5f9', borderRadius:4, height:10, minWidth:40 }}>
                          <div style={{ width:`${pct}%`, background:COLORS[i%COLORS.length], borderRadius:4, height:10, transition:'width .4s' }} />
                        </div>
                        <span style={{ width:50, fontSize:11, color:'#64748b', textAlign:'right', flexShrink:0 }}>{m.days}d</span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>

          {!data.attendanceTrend?.length && !data.topMembers?.length && !data.memberGrowth?.length && (
            <div style={{ textAlign:'center', padding:'30px 0', color:'#94a3b8' }}>No data found for the selected period.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default AnalyticsReport;
