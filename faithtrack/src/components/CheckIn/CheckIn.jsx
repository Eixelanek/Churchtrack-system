import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import './CheckIn.css';
import '../GuestCheckIn/GuestCheckIn.css';
import logoImage from '../../assets/logo2.png';
import { getHeaderLogo as loadStoredHeaderLogo } from '../../utils/churchSettings';
import { fetchFamilyTree } from '../../api/familyTree';

const suffixOptions = ['None', 'Jr.', 'Sr.', 'II', 'III', 'IV'];

const makeSafeSuffix = (value = '') => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'none') {
    return '';
  }
  return trimmed;
};

const resolveInitialHeaderLogo = () => {
  if (typeof window === 'undefined') {
    return logoImage;
  }
  const stored = loadStoredHeaderLogo();
  return stored || logoImage;
};

const createInitialGuestFormData = () => ({
  first_name: '',
  middle_name: '',
  surname: '',
  suffix: 'None',
  contact_number: '',
  email: ''
});

const createInitialMemberFormData = () => ({
  surname: '',
  firstName: '',
  middleName: '',
  suffix: 'None',
  birthday: '',
  gender: '',
  email: '',
  contactNumber: '',
  street: '',
  barangay: '',
  city: '',
  province: '',
  zipCode: '',
  username: '',
  password: '',
  confirmPassword: '',
  guardianSurname: '',
  guardianFirstName: '',
  guardianMiddleName: '',
  guardianSuffix: 'None',
  relationshipToGuardian: ''
});

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
  const apiBaseUrl = window.location.origin;

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
  const [checkinType, setCheckinType] = useState(null); // 'member' or 'guest'
  // Guest form fields
  const [guestFormData, setGuestFormData] = useState(() => createInitialGuestFormData());
  const [guestFormErrors, setGuestFormErrors] = useState({});
  const [guestSuccessData, setGuestSuccessData] = useState(null);
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [memberConverted, setMemberConverted] = useState(false);
  const [memberFormData, setMemberFormData] = useState(() => createInitialMemberFormData());
  const [memberFormErrors, setMemberFormErrors] = useState({});
  const [convertingMember, setConvertingMember] = useState(false);

  const resetGuestForm = () => {
    setGuestFormData(createInitialGuestFormData());
    setGuestFormErrors({});
  };

  const resetMembershipFlow = () => {
    setGuestSuccessData(null);
    setShowMemberForm(false);
    setMemberConverted(false);
    setMemberFormData(createInitialMemberFormData());
    setMemberFormErrors({});
    setConvertingMember(false);
  };

  const validateGuestForm = () => {
    const errors = {};
    if (!guestFormData.first_name.trim()) {
      errors.first_name = 'First name is required';
    }
    if (!guestFormData.surname.trim()) {
      errors.surname = 'Surname is required';
    }
    const contact = guestFormData.contact_number.trim();
    if (contact === '') {
      errors.contact_number = 'Contact number is required';
    } else {
      const digits = contact.replace(/\D+/g, '');
      if (digits.length !== 11) {
        errors.contact_number = 'Contact number must be 11 digits';
      }
    }
    if (guestFormData.email.trim() !== '') {
      const emailRegex = /^\S+@\S+\.\S+$/;
      if (!emailRegex.test(guestFormData.email.trim())) {
        errors.email = 'Please enter a valid email address';
      }
    }

    setGuestFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleGuestInputChange = (field, value) => {
    setGuestFormData((prev) => ({ ...prev, [field]: value }));
    setGuestFormErrors((prev) => ({ ...prev, [field]: '' }));
    if (guestSuccessData) {
      setGuestSuccessData(null);
    }
  };

  const validateMemberForm = () => {
    const errors = {};

    if (!memberFormData.surname.trim()) errors.surname = 'Surname is required';
    if (!memberFormData.firstName.trim()) errors.firstName = 'First name is required';
    if (!memberFormData.birthday) errors.birthday = 'Birthday is required';
    if (!memberFormData.gender) errors.gender = 'Gender is required';

    const contact = memberFormData.contactNumber.trim().replace(/\D+/g, '');
    if (contact.length !== 11) errors.contactNumber = 'Contact number must be 11 digits';

    if (memberFormData.email.trim() && !/^\S+@\S+\.\S+$/.test(memberFormData.email.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    if (!memberFormData.street.trim()) errors.street = 'Street is required';
    if (!memberFormData.barangay.trim()) errors.barangay = 'Barangay is required';
    if (!memberFormData.city.trim()) errors.city = 'City is required';
    if (!memberFormData.province.trim()) errors.province = 'Province is required';
    if (!/^\d{4}$/.test(memberFormData.zipCode.trim())) errors.zipCode = 'ZIP code must be 4 digits';

    if (!memberFormData.username.trim()) errors.username = 'Username is required';
    if (memberFormData.password.length < 8) errors.password = 'Password must be at least 8 characters';
    if (memberFormData.password !== memberFormData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (memberFormData.birthday) {
      const birthDate = new Date(memberFormData.birthday);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) ? age - 1 : age;

      if (Number.isFinite(actualAge) && actualAge <= 17) {
        if (!memberFormData.guardianSurname.trim()) errors.guardianSurname = 'Guardian surname is required';
        if (!memberFormData.guardianFirstName.trim()) errors.guardianFirstName = 'Guardian first name is required';
        if (!memberFormData.relationshipToGuardian.trim()) errors.relationshipToGuardian = 'Relationship to guardian is required';
      }
    }

    setMemberFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleMemberInputChange = (field, value) => {
    setMemberFormData((prev) => ({ ...prev, [field]: value }));
    setMemberFormErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleMemberFormSubmit = async (event) => {
    event.preventDefault();
    if (!guestSuccessData?.guest_id) {
      setError('Missing guest information for membership conversion.');
      return;
    }

    if (!validateMemberForm()) {
      return;
    }

    setConvertingMember(true);
    setError('');

    try {
      const payload = {
        guest_id: guestSuccessData.guest_id,
        surname: memberFormData.surname.trim(),
        firstName: memberFormData.firstName.trim(),
        middleName: memberFormData.middleName.trim(),
        suffix: memberFormData.suffix === 'None' ? '' : memberFormData.suffix,
        birthday: memberFormData.birthday,
        gender: memberFormData.gender,
        email: memberFormData.email.trim(),
        contactNumber: memberFormData.contactNumber.trim().replace(/\D+/g, ''),
        street: memberFormData.street.trim(),
        barangay: memberFormData.barangay.trim(),
        city: memberFormData.city.trim(),
        province: memberFormData.province.trim(),
        zipCode: memberFormData.zipCode.trim(),
        username: memberFormData.username.trim(),
        password: memberFormData.password,
        guardianSurname: memberFormData.guardianSurname.trim(),
        guardianFirstName: memberFormData.guardianFirstName.trim(),
        guardianMiddleName: memberFormData.guardianMiddleName.trim(),
        guardianSuffix: memberFormData.guardianSuffix === 'None' ? '' : memberFormData.guardianSuffix,
        relationshipToGuardian: memberFormData.relationshipToGuardian.trim()
      };

      const response = await fetch(`${apiBaseUrl}/api/guest/convert_to_member.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to convert to member');
      }

      setMemberConverted(true);
      setShowMemberForm(false);
    } catch (err) {
      console.error('Member conversion failed:', err);
      setError(err.message || 'Failed to convert to member');
    } finally {
      setConvertingMember(false);
    }
  };

  const handleNewCheckIn = () => {
    resetGuestForm();
    resetMembershipFlow();
    setError('');
    setSuccess(false);
    setAlreadyCheckedIn(false);
    setCheckinType('guest');
  };

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
    const hasMemberSession = Boolean(fallbackName);

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
        const response = await fetch(`${apiBaseUrl}/api/admin/get_church_settings.php`);
        if (!response.ok) {
          return;
        }
        const result = await response.json();
        if (result?.success && result.data) {
          if (typeof window !== 'undefined') {
            try {
              window.localStorage.setItem('churchSettings', JSON.stringify(result.data));
            } catch (storageError) {
              console.warn('Unable to cache church settings:', storageError);
            }
          }

          if (result.data.headerLogo) {
            setHeaderLogo(result.data.headerLogo);
          } else if (result.data.churchLogo) {
            setHeaderLogo(result.data.churchLogo);
          }
        }
      } catch (err) {
        console.warn('Failed to load header logo for check-in:', err);
      }
    };

    fetchHeaderLogo();
  }, [apiBaseUrl]);

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
                const res = await fetch(`${apiBaseUrl}/api/qr_sessions/get_session.php?${params.toString()}`);
                if (!res.ok) {
                  return false;
                }
                const payload = await res.json();
                return Boolean(payload?.success && payload?.data?.already_checked_in);
              } catch (statusErr) {
                console.error('Unable to verify family attendance:', statusErr);
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
        console.error('Error fetching family members:', error);
        setFamilyMembers([]);
        setCheckedInFamilyIds([]);
      } finally {
        setLoadingFamily(false);
      }
    };

    loadFamilyMembers();
  }, [detectedMember, sessionToken, apiBaseUrl]);

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
    try {
      const params = new URLSearchParams({ token: sessionToken });

      const storedMemberId = localStorage.getItem('userId');
      const storedMemberName = localStorage.getItem('memberName') || localStorage.getItem('username');

      if (storedMemberId) {
        params.append('member_id', storedMemberId);
      } else if (storedMemberName) {
        params.append('member_name', storedMemberName);
      }

      const response = await fetch(`${apiBaseUrl}/api/qr_sessions/get_session.php?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setSessionData(result.data);
        setAlreadyCheckedIn(Boolean(result.data?.already_checked_in));
        // Auto-detect check-in type based on session response
        setCheckinType(result.data?.checkin_type || (storedMemberId || storedMemberName ? 'member' : 'guest'));
      } else {
        setError(result.message || 'Failed to load session data');
      }
    } catch (err) {
      console.error('Error fetching session:', err);
      setError('Unable to connect to server. Please try again.');
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

        const response = await fetch(`${apiBaseUrl}/api/members/get.php?id=${memberId}`);
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
        console.error('Error checking member age:', error);
        setIsMinorRestricted(false);
      }
    };

    checkMemberAge();
  }, [detectedMember, sessionToken, apiBaseUrl]);

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

        resetMembershipFlow();

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

        // Check in primary member
        const response = await fetch(`${apiBaseUrl}/api/qr_sessions/checkin.php`, {
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
                await fetch(`${apiBaseUrl}/api/qr_sessions/checkin.php`, {
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
                console.error(`Failed to check in family member ${familyMember.name}:`, err);
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
        if (!validateGuestForm()) {
          setSubmitting(false);
          return;
        }

        setGuestSuccessData(null);
        setShowMemberForm(false);
        setMemberConverted(false);

        const numericContact = guestFormData.contact_number.replace(/\D+/g, '');

        const response = await fetch(`${apiBaseUrl}/api/guest/checkin.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_token: sessionToken,
            first_name: guestFormData.first_name.trim(),
            middle_name: guestFormData.middle_name.trim(),
            surname: guestFormData.surname.trim(),
            suffix: makeSafeSuffix(guestFormData.suffix),
            contact_number: numericContact,
            email: guestFormData.email.trim(),
            notes: guestFormData.notes.trim(),
            source: 'qr',
            status: 'present'
          })
        });

        const result = await response.json();

        if (response.status === 409) {
          setError(result.message || 'Guest already checked in.');
          setSubmitting(false);
          return;
        }

        if (!response.ok || !result.success) {
          setError(result.message || 'Guest check-in failed. Please try again.');
          setSubmitting(false);
          return;
        }

        const data = result.data || null;
        setGuestSuccessData(data);

        const currentFormData = { ...guestFormData };

        if (data?.ready_for_membership) {
          setMemberFormData({
            surname: currentFormData.surname || '',
            firstName: currentFormData.first_name || '',
            middleName: currentFormData.middle_name || '',
            suffix: currentFormData.suffix || 'None',
            birthday: '',
            gender: '',
            email: currentFormData.email || '',
            contactNumber: currentFormData.contact_number || '',
            street: '',
            barangay: '',
            city: '',
            province: '',
            zipCode: '',
            username: '',
            password: '',
            confirmPassword: '',
            guardianSurname: '',
            guardianFirstName: '',
            guardianMiddleName: '',
            guardianSuffix: 'None',
            relationshipToGuardian: ''
          });
          setShowMemberForm(true);
        } else {
          setShowMemberForm(false);
        }

        resetGuestForm();
        setSuccess(false);
      }
    } catch (err) {
      console.error('Check-in error:', err);
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

  // No longer show error for non-members - they'll use guest form instead

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

  const renderGuestPostCheckIn = () => {
    if (memberConverted) {
      return (
        <section className="guest-success-panel">
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <h2>Congratulations! You're Now a Member!</h2>
          <p>Welcome to the church family! Your membership has been created successfully.</p>
          <p className="guest-success-hint">You can now log in with your username and password to access member features.</p>
          <div className="guest-success-actions">
            <button className="guest-success-btn" onClick={() => navigate('/login')}>Go to Login</button>
            <button className="guest-success-secondary" onClick={handleNewCheckIn}>Check-In Another Guest</button>
          </div>
        </section>
      );
    }

    if (showMemberForm && guestSuccessData?.ready_for_membership) {
      return (
        <section className="guest-member-form-panel">
          <div className="guest-member-form-header">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <h2>Congratulations! You're Ready to Become a Member!</h2>
            <p>You've attended 4 consecutive Sunday services. Please complete the form below to become a member.</p>
          </div>

          {error && (
            <div className="guest-error-banner" style={{ marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <form className="guest-member-form" onSubmit={handleMemberFormSubmit}>
            <div className="guest-form-section">
              <h3>Personal Information</h3>
              <div className="guest-form-grid">
                <div className="guest-form-group">
                  <label>
                    Surname <span className="required-asterisk">*</span>
                  </label>
                  <input
                    type="text"
                    value={memberFormData.surname}
                    onChange={(e) => handleMemberInputChange('surname', e.target.value)}
                    disabled={convertingMember}
                  />
                  {memberFormErrors.surname && <span className="guest-field-error">{memberFormErrors.surname}</span>}
                </div>
                <div className="guest-form-group">
                  <label>
                    First Name <span className="required-asterisk">*</span>
                  </label>
                  <input
                    type="text"
                    value={memberFormData.firstName}
                    onChange={(e) => handleMemberInputChange('firstName', e.target.value)}
                    disabled={convertingMember}
                  />
                  {memberFormErrors.firstName && <span className="guest-field-error">{memberFormErrors.firstName}</span>}
                </div>
              </div>
              <div className="guest-form-grid">
                <div className="guest-form-group">
                  <label>Middle Name</label>
                  <input
                    type="text"
                    value={memberFormData.middleName}
                    onChange={(e) => handleMemberInputChange('middleName', e.target.value)}
                    disabled={convertingMember}
                  />
                </div>
                <div className="guest-form-group">
                  <label>Suffix</label>
                  <select
                    value={memberFormData.suffix}
                    onChange={(e) => handleMemberInputChange('suffix', e.target.value)}
                    disabled={convertingMember}
                  >
                    {suffixOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              </div>
              <div className="guest-form-grid">
                <div className="guest-form-group">
                  <label>
                    Birthday <span className="required-asterisk">*</span>
                  </label>
                  <input
                    type="date"
                    value={memberFormData.birthday}
                    onChange={(e) => handleMemberInputChange('birthday', e.target.value)}
                    max={new Date(new Date().setFullYear(new Date().getFullYear() - 5)).toISOString().split('T')[0]}
                    min={new Date(new Date().setFullYear(new Date().getFullYear() - 120)).toISOString().split('T')[0]}
                    disabled={convertingMember}
                  />
                  {memberFormErrors.birthday && <span className="guest-field-error">{memberFormErrors.birthday}</span>}
                </div>
                <div className="guest-form-group">
                  <label>
                    Gender <span className="required-asterisk">*</span>
                  </label>
                  <select
                    value={memberFormData.gender}
                    onChange={(e) => handleMemberInputChange('gender', e.target.value)}
                    disabled={convertingMember}
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                  {memberFormErrors.gender && <span className="guest-field-error">{memberFormErrors.gender}</span>}
                </div>
              </div>
            </div>

            <div className="guest-form-section">
              <h3>Contact Information</h3>
              <div className="guest-form-grid">
                <div className="guest-form-group">
                  <label>
                    Contact Number <span className="required-asterisk">*</span>
                  </label>
                  <input
                    type="tel"
                    value={memberFormData.contactNumber}
                    onChange={(e) => handleMemberInputChange('contactNumber', e.target.value.replace(/[^0-9]/g, '').slice(0, 11))}
                    placeholder="09123456789"
                    disabled={convertingMember}
                  />
                  {memberFormErrors.contactNumber && <span className="guest-field-error">{memberFormErrors.contactNumber}</span>}
                </div>
                <div className="guest-form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    value={memberFormData.email}
                    onChange={(e) => handleMemberInputChange('email', e.target.value)}
                    disabled={convertingMember}
                  />
                  {memberFormErrors.email && <span className="guest-field-error">{memberFormErrors.email}</span>}
                </div>
              </div>
            </div>

            <div className="guest-form-section">
              <h3>Address Information</h3>
              <div className="guest-form-group">
                <label>
                  Street <span className="required">*</span>
                </label>
                <input
                  type="text"
                  value={memberFormData.street}
                  onChange={(e) => handleMemberInputChange('street', e.target.value)}
                  disabled={convertingMember}
                />
                {memberFormErrors.street && <span className="guest-field-error">{memberFormErrors.street}</span>}
              </div>
              <div className="guest-form-grid">
                <div className="guest-form-group">
                  <label>
                    Barangay <span className="required-asterisk">*</span>
                  </label>
                  <input
                    type="text"
                    value={memberFormData.barangay}
                    onChange={(e) => handleMemberInputChange('barangay', e.target.value)}
                    disabled={convertingMember}
                  />
                  {memberFormErrors.barangay && <span className="guest-field-error">{memberFormErrors.barangay}</span>}
                </div>
                <div className="guest-form-group">
                  <label>
                    City <span className="required-asterisk">*</span>
                  </label>
                  <input
                    type="text"
                    value={memberFormData.city}
                    onChange={(e) => handleMemberInputChange('city', e.target.value)}
                    disabled={convertingMember}
                  />
                  {memberFormErrors.city && <span className="guest-field-error">{memberFormErrors.city}</span>}
                </div>
              </div>
              <div className="guest-form-grid">
                <div className="guest-form-group">
                  <label>
                    Province <span className="required-asterisk">*</span>
                  </label>
                  <input
                    type="text"
                    value={memberFormData.province}
                    onChange={(e) => handleMemberInputChange('province', e.target.value)}
                    disabled={convertingMember}
                  />
                  {memberFormErrors.province && <span className="guest-field-error">{memberFormErrors.province}</span>}
                </div>
                <div className="guest-form-group">
                  <label>
                    ZIP Code <span className="required-asterisk">*</span>
                  </label>
                  <input
                    type="text"
                    value={memberFormData.zipCode}
                    onChange={(e) => handleMemberInputChange('zipCode', e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                    placeholder="1234"
                    maxLength="4"
                    disabled={convertingMember}
                  />
                  {memberFormErrors.zipCode && <span className="guest-field-error">{memberFormErrors.zipCode}</span>}
                </div>
              </div>
            </div>

            {memberFormData.birthday && (() => {
              const birthDate = new Date(memberFormData.birthday);
              const today = new Date();
              const age = today.getFullYear() - birthDate.getFullYear();
              const monthDiff = today.getMonth() - birthDate.getMonth();
              const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) ? age - 1 : age;
              return actualAge <= 17 ? (
                <div className="guest-form-section">
                  <h3>Guardian Information (Required for members 17 years old and below)</h3>
                  <div className="guest-form-grid">
                    <div className="guest-form-group">
                      <label>
                        Guardian Surname <span className="required-asterisk">*</span>
                      </label>
                      <input
                        type="text"
                        value={memberFormData.guardianSurname}
                        onChange={(e) => handleMemberInputChange('guardianSurname', e.target.value)}
                        disabled={convertingMember}
                      />
                      {memberFormErrors.guardianSurname && <span className="guest-field-error">{memberFormErrors.guardianSurname}</span>}
                    </div>
                    <div className="guest-form-group">
                      <label>
                        Guardian First Name <span className="required-asterisk">*</span>
                      </label>
                      <input
                        type="text"
                        value={memberFormData.guardianFirstName}
                        onChange={(e) => handleMemberInputChange('guardianFirstName', e.target.value)}
                        disabled={convertingMember}
                      />
                      {memberFormErrors.guardianFirstName && <span className="guest-field-error">{memberFormErrors.guardianFirstName}</span>}
                    </div>
                  </div>
                  <div className="guest-form-grid">
                    <div className="guest-form-group">
                      <label>Guardian Middle Name</label>
                      <input
                        type="text"
                        value={memberFormData.guardianMiddleName}
                        onChange={(e) => handleMemberInputChange('guardianMiddleName', e.target.value)}
                        disabled={convertingMember}
                      />
                    </div>
                    <div className="guest-form-group">
                      <label>Relationship to Guardian <span>*</span></label>
                      <input
                        type="text"
                        value={memberFormData.relationshipToGuardian}
                        onChange={(e) => handleMemberInputChange('relationshipToGuardian', e.target.value)}
                        placeholder="e.g. Father, Mother, Guardian"
                        disabled={convertingMember}
                      />
                      {memberFormErrors.relationshipToGuardian && <span className="guest-field-error">{memberFormErrors.relationshipToGuardian}</span>}
                    </div>
                  </div>
                </div>
              ) : null;
            })()}

            <div className="guest-form-section">
              <h3>Account Information</h3>
              <div className="guest-form-grid">
                <div className="guest-form-group">
                  <label>Username <span>*</span></label>
                  <input
                    type="text"
                    value={memberFormData.username}
                    onChange={(e) => handleMemberInputChange('username', e.target.value)}
                    disabled={convertingMember}
                  />
                  {memberFormErrors.username && <span className="guest-field-error">{memberFormErrors.username}</span>}
                </div>
              </div>
              <div className="guest-form-grid">
                <div className="guest-form-group">
                  <label>Password <span>*</span></label>
                  <input
                    type="password"
                    value={memberFormData.password}
                    onChange={(e) => handleMemberInputChange('password', e.target.value)}
                    disabled={convertingMember}
                  />
                  {memberFormErrors.password && <span className="guest-field-error">{memberFormErrors.password}</span>}
                </div>
                <div className="guest-form-group">
                  <label>Confirm Password <span>*</span></label>
                  <input
                    type="password"
                    value={memberFormData.confirmPassword}
                    onChange={(e) => handleMemberInputChange('confirmPassword', e.target.value)}
                    disabled={convertingMember}
                  />
                  {memberFormErrors.confirmPassword && <span className="guest-field-error">{memberFormErrors.confirmPassword}</span>}
                </div>
              </div>
            </div>

            <button type="submit" className="guest-submit-btn" disabled={convertingMember}>
              {convertingMember ? (
                <>
                  <div className="guest-btn-spinner" />
                  Creating membership...
                </>
              ) : (
                'Complete Membership Registration'
              )}
            </button>
          </form>
        </section>
      );
    }

    if (guestSuccessData) {
      return (
        <section className="guest-success-panel">
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <h2>Welcome, {guestSuccessData.guest_name}!</h2>
          <p>We've recorded your attendance for {guestSuccessData.service_name}.</p>
          <div className="guest-success-actions">
            <button className="guest-success-btn" onClick={handleNewCheckIn}>Check-In Another Guest</button>
            <button className="guest-success-secondary" onClick={() => navigate('/home')}>Back to Home</button>
          </div>
        </section>
      );
    }

    return null;
  };

  const guestPostCheckInContent = renderGuestPostCheckIn();
  const showSessionInfo = !(showMemberForm && guestSuccessData?.ready_for_membership) && !memberConverted;

  return (
    <div className="checkin-container">
      <div className={`checkin-card ${showMemberForm || guestSuccessData ? 'guest-checkin-card-expanded' : ''}`}>
        {showSessionInfo && (
          <div className="checkin-header">
            <img src={headerLogo || logoImage} alt="Church Logo" className="checkin-logo" />
            <h1>Event Check-In</h1>
          </div>
        )}
        {showSessionInfo && (
          <div className="checkin-event-info">
            <h2>{sessionData.service_name}</h2>
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
          </div>
        )}
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

        {guestPostCheckInContent ? (
          <div className="guest-post-checkin-wrapper">
            {guestPostCheckInContent}
          </div>
        ) : !isMinorRestricted ? (
          <form onSubmit={handleSubmit} className="checkin-form">
            {checkinType === 'guest' || (!detectedMember && checkinType !== 'member') ? (
            // Guest check-in form
            <>
              <div className="form-group">
                <label htmlFor="guestFirstName">
                  First Name <span className="required-asterisk">*</span>
                </label>
                <input
                  type="text"
                  id="guestFirstName"
                  value={guestFormData.first_name}
                  onChange={(e) => handleGuestInputChange('first_name', e.target.value)}
                  placeholder="Enter your first name"
                  required
                  disabled={submitting}
                />
                {guestFormErrors.first_name && <span className="field-error">{guestFormErrors.first_name}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="guestMiddleName">Middle Name</label>
                <input
                  type="text"
                  id="guestMiddleName"
                  value={guestFormData.middle_name}
                  onChange={(e) => handleGuestInputChange('middle_name', e.target.value)}
                  placeholder="Enter your middle name (optional)"
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="guestSurname">
                  Surname <span className="required-asterisk">*</span>
                </label>
                <input
                  type="text"
                  id="guestSurname"
                  value={guestFormData.surname}
                  onChange={(e) => handleGuestInputChange('surname', e.target.value)}
                  placeholder="Enter your surname"
                  required
                  disabled={submitting}
                />
                {guestFormErrors.surname && <span className="field-error">{guestFormErrors.surname}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="guestSuffix">Suffix</label>
                <select
                  id="guestSuffix"
                  value={guestFormData.suffix}
                  onChange={(e) => handleGuestInputChange('suffix', e.target.value)}
                  disabled={submitting}
                >
                  <option value="None">None</option>
                  <option value="Jr">Jr</option>
                  <option value="Sr">Sr</option>
                  <option value="II">II</option>
                  <option value="III">III</option>
                  <option value="IV">IV</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="guestContact">
                  Contact Number <span className="required-asterisk">*</span>
                </label>
                <input
                  type="tel"
                  id="guestContact"
                  value={guestFormData.contact_number}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 11);
                    handleGuestInputChange('contact_number', value);
                  }}
                  placeholder="e.g., 09123456789"
                  required
                  disabled={submitting}
                />
                {guestFormErrors.contact_number && <span className="field-error">{guestFormErrors.contact_number}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="guestEmail">Email Address <span style={{color: '#94a3b8', fontWeight: 500}}>(optional)</span></label>
                <input
                  type="email"
                  id="guestEmail"
                  value={guestFormData.email}
                  onChange={(e) => handleGuestInputChange('email', e.target.value)}
                  placeholder="you@example.com"
                  disabled={submitting}
                />
              </div>

            </>
          ) : (
            // Member check-in form (simplified - name is auto-filled)
            !detectedMember && (
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
            )
          )}

          {error && (
            <div className="checkin-error-message">
              {error}
            </div>
          )}

          {expiryInfo && showSessionInfo && (
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
                {checkinType === 'guest' ? 'Check In as Guest' : submitButtonLabel}
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
