import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './AttendanceHistory.css';
import { fetchMemberAttendanceSummary } from '../../api/memberAttendance';
import { fetchFamilyTree } from '../../api/familyTree';
import { API_BASE_URL } from '../../config/api';

const AttendanceHistory = () => {
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('All');
  const [availableMonths, setAvailableMonths] = useState(['All']);
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState({
    totalServices: 0,
    rate: 0,
    streak: 0,
    monthVisits: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [isLoadingFamily, setIsLoadingFamily] = useState(true);
  const [familyError, setFamilyError] = useState(null);
  const [familyAttendance, setFamilyAttendance] = useState([]); // Track family member attendance

  const getInitials = useCallback((fullName) => {
    if (!fullName || typeof fullName !== 'string') {
      return '??';
    }
    const cleaned = fullName.trim();
    if (!cleaned) {
      return '??';
    }
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return parts
      .slice(0, 2)
      .map((segment) => segment.charAt(0).toUpperCase())
      .join('');
  }, []);

  const getRelationColor = useCallback((relation) => {
    if (!relation) {
      return '#6366f1';
    }
    const relationKey = relation.toLowerCase();
    const colorMap = {
      father: '#4f46e5',
      mother: '#a855f7',
      spouse: '#f97316',
      brother: '#22c55e',
      sister: '#ec4899',
      son: '#0ea5e9',
      daughter: '#f472b6',
      guardian: '#14b8a6',
      other: '#64748b'
    };
    return colorMap[relationKey] || '#6366f1';
  }, []);

  useEffect(() => {
    const loadAttendance = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const memberId = localStorage.getItem('memberId') || localStorage.getItem('userId');
        if (!memberId) {
          setError('Member ID not found. Please sign in again.');
          setIsLoading(false);
          return;
        }

        const data = await fetchMemberAttendanceSummary(memberId);

        const formattedRecords = (data.attendance_records || [])
          .map((record) => {
            if (!record) {
              return null;
            }

            const rawDate = record.checkin_datetime ? new Date(record.checkin_datetime) : null;
            const validDate = rawDate && !Number.isNaN(rawDate.getTime()) ? rawDate : null;

            const monthLabel = validDate
              ? validDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })
              : 'Unknown Month';

            return {
              id: record.id ?? `attendance-${record.checkin_datetime}`,
              service: record.service_name || 'QR Attendance',
              date: validDate
                ? validDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : 'Unknown Date',
              time: validDate
                ? validDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                : '',
              status: record.status || 'Present',
              monthLabel,
              sortValue: validDate ? validDate.getTime() : 0
            };
          })
          .filter(Boolean)
          .sort((a, b) => (b.sortValue || 0) - (a.sortValue || 0));

        const uniqueMonths = Array.from(
          new Set(
            formattedRecords
              .map((record) => record.monthLabel)
              .filter((label) => label && label !== 'Unknown Month')
          )
        );

        setRecords(formattedRecords);
        setAvailableMonths(['All', ...uniqueMonths]);

        setSummary({
          totalServices: data.total_visits ?? formattedRecords.length,
          rate: data.attendance_rate ?? 0,
          streak: data.attendance_streak ?? 0,
          monthVisits: data.month_visits ?? 0
        });
      } catch (fetchError) {
        console.error('Failed to load attendance records:', fetchError);
        setError('Unable to load your attendance history right now.');
      } finally {
        setIsLoading(false);
      }
    };

    loadAttendance();
  }, []);

  useEffect(() => {
    const memberId = localStorage.getItem('memberId') || localStorage.getItem('userId');

    if (!memberId) {
      setIsLoadingFamily(false);
      setFamilyMembers([]);
      setFamilyError('Member ID not found. Please sign in again.');
      return;
    }

    const loadFamilyCircle = async () => {
      setIsLoadingFamily(true);
      setFamilyError(null);

      try {
        const response = await fetchFamilyTree(Number(memberId));
        const tree = response?.tree ?? {};
        const apiBaseUrl = API_BASE_URL;

        let selfPhotoUrl = null;
        try {
          const selfResponse = await fetch(`${apiBaseUrl}/api/members/get.php?id=${memberId}`);
          if (selfResponse.ok) {
            const selfData = await selfResponse.json();
            const picturePath = selfData?.member?.profile_picture;
            if (picturePath && typeof picturePath === 'string') {
              const fileName = picturePath.replace('/uploads/profile_pictures/', '').replace(/^\/+/, '');
              selfPhotoUrl = `${apiBaseUrl}/api/uploads/get_profile_picture.php?path=${fileName}`;
            }
          }
        } catch (selfError) {
          console.error('Failed to load member profile picture for family circle:', selfError);
        }

        const storedName = localStorage.getItem('memberName') || 'You';
        const membersList = [];
        const seenKeys = new Set();

        const pushMember = (memberData, options = {}) => {
          if (!memberData) {
            return;
          }

          const { isYou = false, fallbackRelation = 'Family' } = options;
          const name = memberData.name || storedName;
          const relation = isYou ? 'You' : (memberData.relation || fallbackRelation || 'Family');
          const key = isYou ? 'self' : `${memberData.id || memberData.name}-${relation.toLowerCase()}`;

          if (!name || seenKeys.has(key)) {
            return;
          }

          seenKeys.add(key);

          const rawPhoto = memberData.profile_picture || memberData.photo || memberData.avatar || memberData.photoUrl || null;
          let photoUrl = null;

          if (rawPhoto) {
            if (typeof rawPhoto === 'string') {
              if (rawPhoto.startsWith('http://') || rawPhoto.startsWith('https://') || rawPhoto.startsWith('data:')) {
                photoUrl = rawPhoto;
              } else if (rawPhoto.includes('/uploads/profile_pictures/')) {
                const fileName = rawPhoto.replace('/uploads/profile_pictures/', '').replace(/^\/+/, '');
                photoUrl = `${apiBaseUrl}/api/uploads/get_profile_picture.php?path=${fileName}`;
              } else if (rawPhoto.startsWith('/')) {
                photoUrl = `${apiBaseUrl}${rawPhoto}`;
              } else {
                photoUrl = `${apiBaseUrl}/${rawPhoto}`;
              }
            }
          } else if (isYou && selfPhotoUrl) {
            photoUrl = selfPhotoUrl;
          }

          membersList.push({
            key,
            name,
            role: relation,
            color: isYou ? '#3b82f6' : getRelationColor(relation),
            initials: getInitials(name),
            isYou,
            photoUrl
          });
        };

        pushMember({ id: memberId, name: storedName }, { isYou: true, fallbackRelation: 'You' });

        const appendGroup = (group, fallbackRelation) => {
          if (!Array.isArray(group)) {
            return;
          }
          group.forEach((relative) => {
            if (!relative) {
              return;
            }
            pushMember(relative, { fallbackRelation });
          });
        };

        appendGroup(tree.parents);
        appendGroup(tree.couple);
        appendGroup(tree.siblings, 'Sibling');
        appendGroup(tree.children);
        appendGroup(tree.other, 'Family');

        setFamilyMembers(membersList);
        setFamilyError(null);
        
        // Fetch attendance for family members
        const familyIds = membersList
          .filter(m => !m.isYou && m.key.includes('-'))
          .map(m => m.key.split('-')[0])
          .filter(id => !isNaN(id));
        
        if (familyIds.length > 0) {
          try {
            const familyAttendancePromises = familyIds.map(async (id) => {
              try {
                const data = await fetchMemberAttendanceSummary(id);
                return (data.attendance_records || []).map(record => ({
                  memberId: id,
                  eventDate: record.checkin_datetime ? new Date(record.checkin_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null,
                  serviceName: record.service_name || 'QR Attendance'
                }));
              } catch {
                return [];
              }
            });
            
            const allFamilyAttendance = await Promise.all(familyAttendancePromises);
            setFamilyAttendance(allFamilyAttendance.flat());
          } catch (err) {
            console.error('Failed to load family attendance:', err);
          }
        }
      } catch (loadError) {
        console.error('Family circle load failed:', loadError);
        setFamilyMembers([]);
        setFamilyError('Unable to load your family circle right now.');
      } finally {
        setIsLoadingFamily(false);
      }
    };

    loadFamilyCircle();
  }, [getInitials, getRelationColor]);

  const handleFilterChange = (filter) => {
    setSelectedFilter(filter);
  };

  const filteredRecords = useMemo(() => {
    let list = records;

    // Filter by month
    if (selectedMonth !== 'All') {
      list = list.filter((record) => record.monthLabel === selectedMonth);
    }

    // Filter by attendance type
    if (selectedFilter === 'me') {
      // Only Me - show only records where no family members attended the same event
      list = list.filter((record) => {
        const hasFamilyAtEvent = familyAttendance.some(
          (fa) => fa.eventDate === record.date && fa.serviceName === record.service
        );
        return !hasFamilyAtEvent;
      });
    } else if (selectedFilter === 'family') {
      // With Family - show only records where at least one family member also attended
      list = list.filter((record) => {
        const hasFamilyAtEvent = familyAttendance.some(
          (fa) => fa.eventDate === record.date && fa.serviceName === record.service
        );
        return hasFamilyAtEvent;
      });
    }

    return list;
  }, [records, selectedMonth, selectedFilter, familyAttendance]);

  const totalRecords = filteredRecords.length;
  const displayMonth = selectedMonth === 'All' ? 'All Months' : selectedMonth;

  return (
    <div className="my-attendance-page">
      {/* Header */}
      <div className="my-attendance-header">
        <h1>My Attendance</h1>
        <p>View your complete attendance history</p>
      </div>

      <div className="my-attendance-content">
        {/* Main Content */}
        <div className="attendance-main">
          {/* Filters */}
          <div className="attendance-filters">
            <div className="filter-group">
              <span className="filter-label">Filter:</span>
              <button
                className={`filter-btn ${selectedFilter === 'all' ? 'active' : ''}`}
                onClick={() => handleFilterChange('all')}
              >
                All Records
              </button>
              <button
                className={`filter-btn ${selectedFilter === 'me' ? 'active' : ''}`}
                onClick={() => handleFilterChange('me')}
              >
                Only Me
              </button>
              <button
                className={`filter-btn ${selectedFilter === 'family' ? 'active' : ''}`}
                onClick={() => handleFilterChange('family')}
              >
                With Family
              </button>
            </div>
            <select className="month-selector" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
              {availableMonths.map((monthOption) => (
                <option key={monthOption} value={monthOption}>
                  {monthOption}
                </option>
              ))}
            </select>
          </div>

          {/* Attendance Records */}
          <div className="attendance-records">
            <h3>Attendance Records ({totalRecords})</h3>
            <p className="records-subtitle">Showing {displayMonth}</p>

            {isLoading ? (
              <div className="records-placeholder">Loading attendance records...</div>
            ) : error ? (
              <div className="records-placeholder error">{error}</div>
            ) : filteredRecords.length === 0 ? (
              <div className="records-placeholder">No attendance records found for this filter.</div>
            ) : (
              <div className="records-list">
                {filteredRecords.map((record) => (
                  <div key={record.id} className="attendance-record-card">
                    <div className="record-header">
                      <h4>{record.service}</h4>
                      <span className="record-status">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        {record.status}
                      </span>
                    </div>
                    <div className="record-datetime">
                      {record.date} {record.time && `• ${record.time}`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="attendance-sidebar">
          {/* Monthly Summary */}
          <div className="summary-card">
            <h3>Monthly Summary</h3>
            <div className="summary-stats">
              <div className="summary-stat">
                <div className="stat-value-large">{summary.totalServices}</div>
                <div className="stat-label-small">Total Services</div>
              </div>
              <div className="summary-stat">
                <div className="stat-value-large" style={{ color: '#10b981' }}>{`${summary.rate}%`}</div>
                <div className="stat-label-small">Attendance Rate</div>
              </div>
              <div className="summary-stat">
                <div className="stat-value-large" style={{ color: '#f59e0b' }}>{summary.streak}</div>
                <div className="stat-label-small">Current Streak (days)</div>
              </div>
            </div>
          </div>

          {/* Family Circle */}
          <div className="family-card">
            <div className="family-header">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              <h3>Family Circle</h3>
            </div>
            {isLoadingFamily ? (
              <div className="family-placeholder">Loading family circle...</div>
            ) : familyError ? (
              <div className="family-placeholder error">{familyError}</div>
            ) : familyMembers.length > 0 ? (
              <>
                <div className="family-members">
                  {familyMembers.map((member) => (
                    <div key={member.key} className="family-member">
                      <div className={`member-avatar${member.photoUrl ? '' : ' fallback'}`} style={{ backgroundColor: member.color }}>
                        {member.photoUrl ? (
                          <img
                            src={member.photoUrl}
                            alt={`${member.name} avatar`}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.parentElement.classList.add('fallback');
                              e.currentTarget.parentElement.textContent = member.initials;
                            }}
                          />
                        ) : (
                          member.initials
                        )}
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
        </div>
      </div>
    </div>
  );
};

export default AttendanceHistory;