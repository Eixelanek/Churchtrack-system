import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import './CheckIn.css';
import logoImage from '../../assets/logo2.png';
import { getHeaderLogo as loadStoredHeaderLogo } from '../../utils/churchSettings';
import { fetchFamilyTree } from '../../api/familyTree';
import { API_BASE_URL } from '../../config/api';
import { offlineStorage } from '../../utils/offlineStorage';
import { showToast } from '../Toast/Toast';

const resolveInitialHeaderLogo = () => {
  if (typeof window === 'undefined') {
    return logoImage;
  }
  const stored = loadStoredHeaderLogo();
  return stored || logoImage;
};

const getInitials = (name = '') => {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 2);
};

const CheckIn = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionToken = searchParams.get('session');
  const memberIdentifier = searchParams.get('member');

  const [headerLogo, setHeaderLogo] = useState(resolveInitialHeaderLogo);

  const [loading, setLoading] = useState(true);
  const [sessionData, setSessionData] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [detectedMember, setDetectedMember] = useState(null);
  const [isNameLocked, setIsNameLocked] = useState(false);
  const [primarySelected, setPrimarySelected] = useState(false);
  const [hasMemberAccess, setHasMemberAccess] = useState(false);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [loadingFamily, setLoadingFamily] = useState(false);
  const [selectedFamilyIds, setSelectedFamilyIds] = useState([]);
  const [checkedInFamilyIds, setCheckedInFamilyIds] = useState([]);
  const [isMinorRestricted, setIsMinorRestricted] = useState(false);
  const [memberBirthday, setMemberBirthday] = useState(null);

  // Form fields
  const [memberName, setMemberName] = useState('');
  const [memberContact, setMemberContact] = useState('');
  const [checkinType, setCheckinType] = useState(null); // 'member' | 'members_only'

  useEffect(() => {
    if (!sessionToken) {
      setError('Invalid QR code - no session token provided');
      setLoading(false);
      return;
    }

    const storedMemberId = localStorage.getItem('userId');
    const storedMemberName = localStorage.getItem('memberName');
    const storedUsername = localStorage.getItem('username');
    const fallbackName = storedMemberName || storedUsername || '';
    const hasMemberSession =
      localStorage.getItem('userType') === 'member' && Boolean(storedMemberId) && Boolean(fallbackName);

    if (hasMemberSession) {
      setMemberName(fallbackName);
      setDetectedMember({ id: storedMemberId || 'member-self', name: fallbackName });
      setIsNameLocked(true);
      setPrimarySelected(true);
    } else {
      setDetectedMember(null);
      setIsNameLocked(false);
      setPrimarySelected(false);
    }

    setHasMemberAccess(hasMemberSession);

  }, [sessionToken, memberIdentifier]);

  useEffect(() => {
    const fetchHeaderLogo = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/admin/get_church_settings.php`);
        if (!response.ok) {
          return;
        }
        const result = await response.json();
        if (result?.success && result.data) {
          if (typeof window !== 'undefined') {
            try {
              window.localStorage.setItem('churchSettings', JSON.stringify(result.data));
            } catch (storageError) {

            }
          }

          if (result.data.headerLogo) {
            setHeaderLogo(result.data.headerLogo);
          } else if (result.data.churchLogo) {
            setHeaderLogo(result.data.churchLogo);
          }
        }
      } catch (err) {

      }
    };

    fetchHeaderLogo();
  }, []);

  // Helper function to calculate age from birthday
  const calculateAge = (birthday) => {
    if (!birthday) return null;
    try {
      const birthDate = new Date(birthday);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    } catch (error) {
      return null;
    }
  };

  // Fetch family members when detectedMember changes
  useEffect(() => {
    const loadFamilyMembers = async () => {
      if (!detectedMember?.id || detectedMember.id === 'member-self' || !sessionToken) {
        setFamilyMembers([]);
        setCheckedInFamilyIds([]);
        return;
      }

      setLoadingFamily(true);
      try {
        const response = await fetchFamilyTree(Number(detectedMember.id));
        const tree = response?.tree ?? {};
        
        const allFamily = [];
        
        // Collect all family members from tree structure
        const addMembers = (group) => {
          if (Array.isArray(group)) {
            group.forEach(member => {
              if (member && member.id) {
                allFamily.push({
                  id: member.id,
                  name: member.name,
                  relation: member.relation,
                  birthday: member.birthday || null
                });
              }
            });
          }
        };
        
        addMembers(tree.parents);
        addMembers(tree.couple);
        addMembers(tree.siblings);
        addMembers(tree.children);
        addMembers(tree.other);
        
        // Filter family members: only show those 12 years old and below
        const filteredFamily = allFamily.filter(member => {
          const age = calculateAge(member.birthday);
          // If no birthday, exclude them (to be safe)
          // If age is 12 or below, include them
          return age !== null && age <= 12;
        });
        
        setFamilyMembers(filteredFamily);

        if (filteredFamily.length > 0) {
          const statusResults = await Promise.all(
            filteredFamily.map(async (relative) => {
              try {
                const params = new URLSearchParams({ token: sessionToken, member_id: String(relative.id) });
                const res = await fetch(`${API_BASE_URL}/api/qr_sessions/get_session.php?${params.toString()}`);
                if (!res.ok) {
                  return false;
                }
                const payload = await res.json();
                return Boolean(payload?.success && payload?.data?.already_checked_in);
              } catch (statusErr) {

                return false;
              }
            })
          );

          const alreadyChecked = filteredFamily
            .filter((_, index) => statusResults[index])
            .map((member) => member.id);

          setCheckedInFamilyIds(alreadyChecked);
          setSelectedFamilyIds((prev) => prev.filter((id) => !alreadyChecked.includes(id)));
        } else {
          setCheckedInFamilyIds([]);
        }
      } catch (error) {

        setFamilyMembers([]);
        setCheckedInFamilyIds([]);
      } finally {
        setLoadingFamily(false);
      }
    };

    loadFamilyMembers();
  }, [detectedMember, sessionToken]);

  const primaryInitials = detectedMember ? getInitials(detectedMember.name) : '';
  const selectedCount = (primarySelected ? 1 : 0) + selectedFamilyIds.length;
  const submitButtonLabel = detectedMember ? 'Confirm Attendance' : 'Check In';

  // Toggle family member selection
  const toggleFamilyMember = (memberId) => {
    if (checkedInFamilyIds.includes(memberId)) {
      return;
    }

    setSelectedFamilyIds(prev => {
      if (prev.includes(memberId)) {
        return prev.filter(id => id !== memberId);
      } else {
        return [...prev, memberId];
      }
    });
  };

  const expiryInfo = useMemo(() => {
    if (!sessionData?.event_datetime) return null;
    const start = new Date(sessionData.event_datetime);
    if (Number.isNaN(start.getTime())) return null;

    const expirationHours = Number(sessionData?.expiration_hours);
    const fallbackHours = sessionData?.service_name?.trim()?.toLowerCase() === 'sunday service' ? 4 : 2;
    const hoursToUse = Number.isFinite(expirationHours) && expirationHours > 0 ? expirationHours : fallbackHours;

    const expiry = new Date(start.getTime() + hoursToUse * 60 * 60 * 1000);
    return {
      expirationHours: hoursToUse,
      dateLabel: expiry.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      timeLabel: expiry.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    };
  }, [sessionData?.event_datetime, sessionData?.expiration_hours, sessionData?.service_name]);

  const fetchSessionData = async () => {
    setError('');
    setLoading(true);

    const isOnline = navigator.onLine;
    const storedMemberId = localStorage.getItem('userId');
    const storedMemberName = localStorage.getItem('memberName') || localStorage.getItem('username');
    const isLoggedInMember = localStorage.getItem('userType') === 'member' && Boolean(storedMemberId);

    const fallbackCheckinType = () => (isLoggedInMember ? 'member' : 'members_only');

    const normalizeCachedSession = (raw) => {
      if (!raw || typeof raw !== 'object') return raw;
      const next = { ...raw };
      if (next.checkin_type === 'guest') next.checkin_type = 'members_only';
      return next;
    };

    try {
      const params = new URLSearchParams({ token: sessionToken });

      if (isLoggedInMember && storedMemberId) {
        params.append('member_id', storedMemberId);
      } else if (isLoggedInMember && storedMemberName) {
        params.append('member_name', storedMemberName);
      }

      // Try to load from cache first if offline
      if (!isOnline) {
        try {
          const cachedSession = localStorage.getItem(`session_${sessionToken}`);
          if (cachedSession) {
            const parsed = normalizeCachedSession(JSON.parse(cachedSession));
            setSessionData(parsed);
            setAlreadyCheckedIn(false); // Allow offline check-in even if previously checked in
            setCheckinType(parsed?.checkin_type || fallbackCheckinType());
            setLoading(false);
            return;
          }
          const minimalSessionData = {
            session_token: sessionToken,
            service_name: 'Event Check-In',
            status: 'active',
            event_datetime: new Date().toISOString(),
            checkin_type: fallbackCheckinType(),
            offline_mode: true
          };
          setSessionData(minimalSessionData);
          setAlreadyCheckedIn(false);
          setCheckinType(minimalSessionData.checkin_type);
          setLoading(false);
          return;
        } catch (cacheError) {
          console.error('Error loading cached session:', cacheError);
          const minimalSessionData = {
            session_token: sessionToken,
            service_name: 'Event Check-In',
            status: 'active',
            event_datetime: new Date().toISOString(),
            checkin_type: fallbackCheckinType(),
            offline_mode: true
          };
          setSessionData(minimalSessionData);
          setAlreadyCheckedIn(false);
          setCheckinType(minimalSessionData.checkin_type);
          setLoading(false);
          return;
        }
      }

      const response = await fetch(`${API_BASE_URL}/api/qr_sessions/get_session.php?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        const data = result.data?.checkin_type === 'guest' ? { ...result.data, checkin_type: 'members_only' } : result.data;
        setSessionData(data);
        setAlreadyCheckedIn(Boolean(data?.already_checked_in));
        setCheckinType(data?.checkin_type || fallbackCheckinType());
        
        // Cache session data for offline use
        try {
          localStorage.setItem(`session_${sessionToken}`, JSON.stringify(data));
        } catch (storageError) {
          console.error('Error caching session:', storageError);
        }
      } else {
        setError(result.message || 'Failed to load session data');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      
      // If offline, allow check-in with minimal data
      if (!isOnline) {
        const sid = localStorage.getItem('userId');
        const isMember = localStorage.getItem('userType') === 'member' && Boolean(sid);
        const minimalSessionData = {
          session_token: sessionToken,
          service_name: 'Event Check-In',
          status: 'active',
          event_datetime: new Date().toISOString(),
          checkin_type: isMember ? 'member' : 'members_only',
          offline_mode: true
        };
        setSessionData(minimalSessionData);
        setAlreadyCheckedIn(false);
        setCheckinType(minimalSessionData.checkin_type);
      } else {
        setError('Unable to connect to server. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionToken) {
      return;
    }
    fetchSessionData();
  }, [sessionToken]);

  // Fetch member birthday and check if member is 12 and below
  useEffect(() => {
    const checkMemberAge = async () => {
      if (!detectedMember?.id || detectedMember.id === 'member-self' || !sessionToken) {
        setIsMinorRestricted(false);
        setMemberBirthday(null);
        return;
      }

      try {
        const memberId = Number(detectedMember.id);
        if (Number.isNaN(memberId)) {
          setIsMinorRestricted(false);
          return;
        }

        const response = await fetch(`${API_BASE_URL}/api/members/get.php?id=${memberId}`);
        if (!response.ok) {
          setIsMinorRestricted(false);
          return;
        }

        const result = await response.json();
        if (result.success && result.member) {
          const birthday = result.member.birthday;
          setMemberBirthday(birthday);
          
          if (birthday) {
            const age = calculateAge(birthday);
            // Block self check-in if member is 12 years old and below
            setIsMinorRestricted(age !== null && age <= 12);
          } else {
            // If no birthday, don't restrict (to be safe)
            setIsMinorRestricted(false);
          }
        } else {
          setIsMinorRestricted(false);
        }
      } catch (error) {

        setIsMinorRestricted(false);
      }
    };

    checkMemberAge();
  }, [detectedMember, sessionToken]);

  useEffect(() => {
    if (!alreadyCheckedIn) {
      return undefined;
    }

    const timer = setTimeout(() => {
      navigate('/member');
    }, 2500);

    return () => clearTimeout(timer);
  }, [alreadyCheckedIn, navigate]);

  useEffect(() => {
    if (!success) {
      return undefined;
    }

    const redirectTimer = setTimeout(() => {
      navigate('/member');
    }, 2500);

    return () => clearTimeout(redirectTimer);
  }, [success, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Block submission if member is 12 and below
    if (isMinorRestricted) {
      setError('Members who are 12 years old and below cannot check in themselves. Please see a church staff member for assistance.');
      return;
    }

    if (alreadyCheckedIn) {
      setError('You have already checked in for this event.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const isMemberCheckin = checkinType === 'member' || detectedMember;

      if (isMemberCheckin) {
        if (!memberName.trim()) {
          setError('Please enter your name');
          setSubmitting(false);
          return;
        }

        let memberIdPayload = null;
        if (detectedMember?.id && detectedMember.id !== 'member-self') {
          const parsedId = Number(detectedMember.id);
          if (!Number.isNaN(parsedId)) {
            memberIdPayload = parsedId;
          }
        }

        const storedMemberIdValue = localStorage.getItem('userId');
        const storedMemberIdNumber = storedMemberIdValue ? Number(storedMemberIdValue) : null;
        const primaryCheckerId = !Number.isNaN(memberIdPayload) && memberIdPayload !== null
          ? memberIdPayload
          : (!Number.isNaN(storedMemberIdNumber) && storedMemberIdNumber !== null ? storedMemberIdNumber : null);

        // Check if online
        const isOnline = navigator.onLine;

        if (!isOnline) {
          // Save offline for later sync
          try {
            // Prepare family members data
            const familyIdsToCheck = selectedFamilyIds.filter((id) => !checkedInFamilyIds.includes(id));
            const familyMembersData = familyIdsToCheck.map(familyMemberId => {
              const familyMember = familyMembers.find(m => m.id === familyMemberId);
              return familyMember ? {
                member_id: familyMemberId,
                member_name: familyMember.name,
                member_contact: null,
                checked_in_by: primaryCheckerId
              } : null;
            }).filter(Boolean);

            // Save primary member check-in
            await offlineStorage.saveMemberCheckinOffline({
              session_token: sessionToken,
              member_id: memberIdPayload,
              member_name: memberName.trim(),
              member_contact: memberContact.trim() || null,
              checked_in_by: null,
              family_members: familyMembersData,
              event_id: sessionData?.event_id || null
            });

            console.log('Offline check-in saved:', {
              session_token: sessionToken,
              member_id: memberIdPayload,
              member_name: memberName.trim(),
              family_count: familyMembersData.length
            });

            // Show success message
            setSuccess(true);
            setMemberName('');
            setMemberContact('');
            setSelectedFamilyIds([]);
            
            // Show offline notification
            showToast('Checked in offline! Your attendance will sync when you\'re back online.', 'success');
            
            setSubmitting(false);
            return;
          } catch (error) {
            console.error('Error saving offline check-in:', error);
            setError('Failed to save offline check-in. Please try again.');
            setSubmitting(false);
            return;
          }
        }

        // Online - proceed with normal API call
        const response = await fetch(`${API_BASE_URL}/api/qr_sessions/checkin.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_token: sessionToken,
            member_id: memberIdPayload,
            member_name: memberName.trim(),
            member_contact: memberContact.trim() || null
          })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          setError(result.message || 'Check-in failed. Please try again.');
          setSubmitting(false);
          return;
        }

        // Check in selected family members
        const familyIdsToCheck = selectedFamilyIds.filter((id) => !checkedInFamilyIds.includes(id));

        if (familyIdsToCheck.length > 0) {
          for (const familyMemberId of familyIdsToCheck) {
            const familyMember = familyMembers.find(m => m.id === familyMemberId);
            if (familyMember) {
              try {
                await fetch(`${API_BASE_URL}/api/qr_sessions/checkin.php`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    session_token: sessionToken,
                    member_id: familyMemberId,
                    member_name: familyMember.name,
                    member_contact: null,
                    checked_in_by: primaryCheckerId
                  })
                });
              } catch (err) {

              }
            }
          }
          setCheckedInFamilyIds((prev) => Array.from(new Set([...prev, ...familyIdsToCheck])));
        }

        setSuccess(true);
        setMemberName('');
        setMemberContact('');
        setSelectedFamilyIds([]);
      } else {
        setError('This link is for members only. Visitors can check in with staff at the registration desk.');
        setSubmitting(false);
      }
    } catch (err) {

      setError(err.message || 'Unable to submit check-in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="checkin-container">
        <div className="checkin-card">
          <div className="checkin-loading">
            <div className="loading-spinner"></div>
            <p>Loading event details...</p>
          </div>
        </div>
      </div>
    );
  }

  const checkinLoginRedirect = `/login?redirect=${encodeURIComponent(`/checkin?session=${encodeURIComponent(sessionToken || '')}`)}`;

  if (
    sessionData &&
    checkinType === 'members_only' &&
    !detectedMember &&
    localStorage.getItem('userType') !== 'member'
  ) {
    return (
      <div className="checkin-container">
        <div className="checkin-card">
          <div className="checkin-header">
            <img src={headerLogo || logoImage} alt="Church Logo" className="checkin-logo" />
            <h1>Event Check-In</h1>
          </div>
          <div className="checkin-error" style={{ textAlign: 'center', padding: '1.5rem 1rem 2rem' }}>
            <h2 style={{ marginBottom: '0.75rem' }}>Members only</h2>
            <p style={{ maxWidth: '26rem', margin: '0 auto 1rem', lineHeight: 1.55 }}>
              This QR check-in is for church members signed in on this device. Please log in with your member account, then scan again or open this link again.
            </p>
            <p style={{ fontSize: '0.9rem', color: '#64748b', maxWidth: '26rem', margin: '0 auto 1.25rem', lineHeight: 1.5 }}>
              Visitors can check in with staff at the registration desk.
            </p>
            <button type="button" className="checkin-home-btn" onClick={() => navigate(checkinLoginRedirect)}>
              Member login
            </button>
            <button
              type="button"
              className="checkin-home-btn"
              style={{ marginTop: '0.65rem', background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' }}
              onClick={() => navigate('/')}
            >
              Back to home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="checkin-container">
        <div className="checkin-card">
          <div className="checkin-error">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 8v4"></path>
              <path d="M12 16h.01"></path>
            </svg>
            <h2>Unable to load event</h2>
            <p>{error || 'We could not load the event details. Please refresh and try again.'}</p>
            <button onClick={() => navigate('/member')} className="checkin-home-btn">Back to Dashboard</button>
          </div>
        </div>
      </div>
    );
  }

  if (alreadyCheckedIn) {
    return (
      <div className="checkin-container">
        <div className="checkin-card">
          <div className="checkin-success already-message">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <h2>You’re Already Checked In</h2>
            <p>Thank you! Redirecting you back to your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="checkin-container">
        <div className="checkin-card">
          <div className="checkin-success">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <h2>Check-In Successful!</h2>
            <p>Thank you for attending {sessionData?.service_name || 'the service'}. Redirecting you back to your dashboard…</p>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="checkin-container">
      <div className="checkin-card">
        <div className="checkin-header">
          <img src={headerLogo || logoImage} alt="Church Logo" className="checkin-logo" />
          <h1>Event Check-In</h1>
        </div>
        <div className="checkin-event-info">
            <h2>
              {sessionData.service_name}
              {sessionData.offline_mode && (
                <span style={{
                  marginLeft: '0.5rem',
                  fontSize: '0.8rem',
                  padding: '0.25rem 0.75rem',
                  backgroundColor: '#fbbf24',
                  color: '#78350f',
                  borderRadius: '9999px',
                  fontWeight: '600'
                }}>
                  Offline Mode
                </span>
              )}
            </h2>
            {!sessionData.offline_mode ? (
              <>
                <p className="event-datetime">
                  {new Date(sessionData.event_datetime).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                  {' at '}
                  {new Date(sessionData.event_datetime).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })}
                </p>
                <div className="event-stats">
                  <span className="stat-badge">{sessionData.scan_count} attendees</span>
                </div>
                {expiryInfo && (
                  <p className="event-expiry-note">
                    QR check-in closes at {expiryInfo.timeLabel} ({expiryInfo.dateLabel}).
                    Please complete your check-in before then; QR codes automatically expire {expiryInfo.expirationHours} {expiryInfo.expirationHours === 1 ? 'hour' : 'hours'} after the scheduled start.
                  </p>
                )}
              </>
            ) : (
              <p className="event-datetime" style={{ color: '#78350f', fontWeight: '500' }}>
                You are offline. Your attendance will be recorded and synced when you reconnect.
              </p>
            )}
          </div>
        {isMinorRestricted && detectedMember && (
          <div className="minor-restriction-message" style={{
            padding: '2rem',
            textAlign: 'center',
            backgroundColor: '#fef3c7',
            border: '2px solid #f59e0b',
            borderRadius: '12px',
            margin: '1.5rem 0'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👤</div>
            <h2 style={{ color: '#92400e', marginBottom: '0.5rem', fontSize: '1.5rem' }}>
              Staff Assistance Required
            </h2>
            <p style={{ color: '#78350f', fontSize: '1rem', lineHeight: '1.6', marginBottom: '1rem' }}>
              Members who are 12 years old and below cannot check in themselves.
            </p>
            <p style={{ color: '#78350f', fontSize: '1rem', lineHeight: '1.6', fontWeight: '600' }}>
              Please see a church staff member at the registration desk to check you in.
            </p>
            <button 
              onClick={() => navigate('/member')} 
              style={{
                marginTop: '1.5rem',
                padding: '0.75rem 1.5rem',
                backgroundColor: '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#d97706'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#f59e0b'}
            >
              Back to Dashboard
            </button>
          </div>
        )}
        {!isMinorRestricted && detectedMember && (
          <div className="attendance-selector">
            <div className="selector-heading">
              <h3>Mark Attendance</h3>
              <p>Select who is attending this service.</p>
            </div>

            <div className={`attendance-member-card primary ${primarySelected ? 'selected' : ''}`}>
              <div className="member-card-left">
                <div className="member-avatar primary-avatar">{primaryInitials}</div>
                <div className="member-info">
                  <span className="member-name">{detectedMember.name}</span>
                  <span className="member-role">You</span>
                </div>
              </div>
              <div className="member-card-right">
                <span className="member-chip">Auto-selected</span>
                <span className="member-check-icon" aria-hidden="true">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </span>
              </div>
            </div>

            <div className="family-section">
              <div className="family-header">
                <span>Family Circle</span>
                {loadingFamily ? (
                  <span className="family-count">Loading...</span>
                ) : (
                  <span className="family-count">{familyMembers.length} {familyMembers.length === 1 ? 'member' : 'members'}</span>
                )}
              </div>
              {loadingFamily ? (
                <div className="family-loading-message">Loading family members...</div>
              ) : familyMembers.length > 0 ? (
                <div className="family-list">
                  {familyMembers.map((member) => {
                    const alreadyChecked = checkedInFamilyIds.includes(member.id);
                    const isSelected = selectedFamilyIds.includes(member.id);
                    const cardClasses = ['attendance-member-card'];
                    if (isSelected) {
                      cardClasses.push('selected');
                    }
                    if (alreadyChecked) {
                      cardClasses.push('already-checked');
                    }

                    return (
                      <div 
                        className={cardClasses.join(' ')}
                        key={member.id}
                        onClick={() => toggleFamilyMember(member.id)}
                        style={{ cursor: alreadyChecked ? 'not-allowed' : 'pointer' }}
                      >
                        <div className="member-card-left">
                          <div className="member-avatar">{getInitials(member.name)}</div>
                          <div className="member-info">
                            <span className="member-name">{member.name}</span>
                            <span className="member-role">{member.relation}</span>
                          </div>
                        </div>
                        <div className="member-card-right">
                          {alreadyChecked && (
                            <span className="member-chip already">
                              Already checked in
                            </span>
                          )}
                          <span className={`member-check-icon ${isSelected ? '' : 'unchecked'}`} aria-hidden="true">
                            {isSelected ? (
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="4" y="4" width="16" height="16" rx="4"></rect>
                              </svg>
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="family-empty-note">No family members found.</div>
              )}
            </div>

            <div className="attendance-summary">
              <span>{selectedCount} member{selectedCount === 1 ? '' : 's'} selected</span>
            </div>
          </div>
        )}

        {!isMinorRestricted ? (
          <form onSubmit={handleSubmit} className="checkin-form">
            {!detectedMember && (
              <>
                <div className="form-group">
                  <div className="checkin-label-row">
                    <label htmlFor="memberName">
                      Full Name <span className="required-asterisk">*</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    id="memberName"
                    value={memberName}
                    onChange={(e) => setMemberName(e.target.value)}
                    placeholder="Enter your full name"
                    required
                    disabled={submitting}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="memberContact">Contact Number (Optional)</label>
                  <input
                    type="tel"
                    id="memberContact"
                    value={memberContact}
                    onChange={(e) => setMemberContact(e.target.value)}
                    placeholder="e.g., 09123456789"
                    disabled={submitting}
                  />
                </div>
              </>
            )}

          {error && (
            <div className="checkin-error-message">
              {error}
            </div>
          )}

          {expiryInfo && (
            <p className="checkin-expiry-hint">
              Tip: If you refresh this page after {expiryInfo.timeLabel}, the QR link will be inactive.
            </p>
          )}

          <button type="submit" className="checkin-submit-btn" disabled={submitting}>
            {submitting ? (
              <>
                <div className="btn-spinner"></div>
                Submitting...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                {submitButtonLabel}
              </>
            )}
          </button>
        </form>
        ) : null}
        <div className="checkin-footer">
          <p>Powered by ChurchTrack</p>
        </div>
      </div>
    </div>
  );
};

export default CheckIn;
