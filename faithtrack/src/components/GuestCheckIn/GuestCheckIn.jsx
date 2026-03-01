import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import './GuestCheckIn.css';
import logoImage from '../../assets/logo2.png';

const suffixOptions = ['None', 'Jr.', 'Sr.', 'II', 'III', 'IV'];

const makeSafeSuffix = (value = '') => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'none') {
    return '';
  }
  return trimmed;
};

const GuestCheckIn = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionToken = searchParams.get('session') || '';
  const apiBaseUrl = window.location.origin;

  const [loading, setLoading] = useState(true);
  const [sessionData, setSessionData] = useState(null);
  const [error, setError] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [duplicateInfo, setDuplicateInfo] = useState(null);
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [memberConverted, setMemberConverted] = useState(false);
  const [convertingMember, setConvertingMember] = useState(false);

  const [formData, setFormData] = useState({
    first_name: '',
    middle_name: '',
    surname: '',
    suffix: 'None',
    contact_number: '',
    email: '',
    notes: ''
  });

  const [memberFormData, setMemberFormData] = useState({
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

  const [memberFormErrors, setMemberFormErrors] = useState({});

  const formattedEventDate = useMemo(() => {
    if (!sessionData?.event_datetime) return '';
    const eventDate = new Date(sessionData.event_datetime.replace(' ', 'T'));
    if (Number.isNaN(eventDate.getTime())) return sessionData.event_datetime;
    return eventDate.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }, [sessionData]);

  const formattedEventTime = useMemo(() => {
    if (!sessionData?.event_datetime) return '';
    const eventDate = new Date(sessionData.event_datetime.replace(' ', 'T'));
    if (Number.isNaN(eventDate.getTime())) return '';
    return eventDate.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }, [sessionData]);

  useEffect(() => {
    const fetchSession = async () => {
      setLoading(true);
      setError('');
      try {
        if (!sessionToken) {
          throw new Error('Missing guest session token.');
        }

        const response = await fetch(`${apiBaseUrl}/api/qr_sessions/get_guest_session.php?token=${encodeURIComponent(sessionToken)}`);
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Unable to load guest session.');
        }

        setSessionData(result.data || null);
      } catch (err) {
        console.error('Guest session fetch failed:', err);
        setError(err.message || 'Unable to load guest session.');
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [apiBaseUrl, sessionToken]);

  const validateForm = () => {
    const errors = {};
    if (!formData.first_name.trim()) {
      errors.first_name = 'First name is required';
    }
    if (!formData.surname.trim()) {
      errors.surname = 'Surname is required';
    }
    const contact = formData.contact_number.trim();
    if (contact === '') {
      errors.contact_number = 'Contact number is required';
    } else {
      const digits = contact.replace(/\D+/g, '');
      if (digits.length !== 11) {
        errors.contact_number = 'Contact number must be 11 digits';
      }
    }
    if (formData.email.trim() !== '') {
      const emailRegex = /^\S+@\S+\.\S+$/;
      if (!emailRegex.test(formData.email.trim())) {
        errors.email = 'Please enter a valid email address';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFormErrors((prev) => ({ ...prev, [field]: '' }));
    setDuplicateInfo(null);
  };

  const resetForm = () => {
    setFormData({
      first_name: '',
      middle_name: '',
      surname: '',
      suffix: 'None',
      contact_number: '',
      email: '',
      notes: ''
    });
    setFormErrors({});
    setDuplicateInfo(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    setError('');
    setDuplicateInfo(null);

    try {
      const payload = {
        session_token: sessionToken,
        first_name: formData.first_name.trim(),
        middle_name: formData.middle_name.trim(),
        surname: formData.surname.trim(),
        suffix: makeSafeSuffix(formData.suffix),
        contact_number: formData.contact_number.trim().replace(/\D+/g, ''),
        email: formData.email.trim(),
        notes: formData.notes.trim(),
        source: 'qr',
        status: 'present'
      };

      const response = await fetch(`${apiBaseUrl}/api/guest/checkin.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (response.status === 409) {
        setDuplicateInfo(result.data || { duplicate: true });
        throw new Error(result.message || 'Guest already checked in.');
      }

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Unable to record guest attendance.');
      }

      const data = result.data || null;
      setSuccessData(data);
      
      // Debug logging
      console.log('Guest check-in response:', {
        ready_for_membership: data?.ready_for_membership,
        sunday_streak: data?.sunday_streak,
        effective_streak: data?.effective_sunday_streak,
        remaining: data?.remaining_for_membership,
        debug_info: data?.debug_info
      });
      
      // If ready for membership, show member registration form
      if (data?.ready_for_membership) {
        // Pre-fill member form with guest data from the form that was just submitted
        // Save form data before resetting
        const currentFormData = { ...formData };
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
        // Reset guest form after saving data
        resetForm();
      } else {
      resetForm();
      }
    } catch (err) {
      console.error('Guest check-in failed:', err);
      setError(err.message || 'Unable to record guest attendance.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNewCheckIn = () => {
    setSuccessData(null);
    setDuplicateInfo(null);
    setError('');
    setShowMemberForm(false);
    setMemberConverted(false);
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
    
    // Check if minor (age <= 17) - requires guardian info
    if (memberFormData.birthday) {
      const birthDate = new Date(memberFormData.birthday);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) ? age - 1 : age;
      
      if (actualAge <= 17) {
        if (!memberFormData.guardianSurname.trim()) errors.guardianSurname = 'Guardian surname is required';
        if (!memberFormData.guardianFirstName.trim()) errors.guardianFirstName = 'Guardian first name is required';
        if (!memberFormData.relationshipToGuardian.trim()) errors.relationshipToGuardian = 'Relationship to guardian is required';
      }
    }
    
    setMemberFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleMemberInputChange = (field, value) => {
    setMemberFormData(prev => ({ ...prev, [field]: value }));
    setMemberFormErrors(prev => ({ ...prev, [field]: '' }));
  };

  const handleMemberFormSubmit = async (e) => {
    e.preventDefault();
    if (!validateMemberForm()) return;
    
    setConvertingMember(true);
    setError('');
    
    try {
      const payload = {
        guest_id: successData.guest_id,
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

  if (loading) {
    return (
      <div className="guest-checkin-container">
        <div className="guest-checkin-card">
          <div className="guest-checkin-loading">
            <div className="guest-loading-spinner" />
            <p>Loading guest session…</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !sessionData) {
    return (
      <div className="guest-checkin-container">
        <div className="guest-checkin-card">
          <div className="guest-checkin-error">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 8v4"></path>
              <path d="M12 16h.01"></path>
            </svg>
            <h2>We couldn’t open this guest check-in</h2>
            <p>{error}</p>
            <button onClick={() => navigate('/home')} className="guest-checkin-home-btn">Back to Home</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="guest-checkin-container">
      <div className={`guest-checkin-card ${showMemberForm ? 'guest-checkin-card-expanded' : ''}`}>
        <header className="guest-checkin-header">
          <img src={logoImage} alt="Church Logo" className="guest-checkin-logo" />
          <div>
            <h1>Guest Check-In</h1>
            <p>Thank you for joining us! Please fill out the form so we can welcome you properly.</p>
          </div>
        </header>

        {sessionData && (
          <section className="guest-event-info">
            <h2>{sessionData.service_name}</h2>
            <p className="guest-event-datetime">
              {formattedEventDate}
              {formattedEventTime && <span> at {formattedEventTime}</span>}
            </p>
            <p className="guest-event-note">This guest QR link expires {sessionData.expiration_hours} {sessionData.expiration_hours === 1 ? 'hour' : 'hours'} after the start time.</p>
          </section>
        )}

        {memberConverted ? (
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
        ) : showMemberForm && successData?.ready_for_membership ? (
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
                    <label>Surname <span>*</span></label>
                    <input
                      type="text"
                      value={memberFormData.surname}
                      onChange={(e) => handleMemberInputChange('surname', e.target.value)}
                      disabled={convertingMember}
                    />
                    {memberFormErrors.surname && <span className="guest-field-error">{memberFormErrors.surname}</span>}
                  </div>
                  <div className="guest-form-group">
                    <label>First Name <span>*</span></label>
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
                    <label>Birthday <span>*</span></label>
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
                    <label>Gender <span>*</span></label>
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
                    <label>Contact Number <span>*</span></label>
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
                  <label>Street <span>*</span></label>
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
                    <label>Barangay <span>*</span></label>
                    <input
                      type="text"
                      value={memberFormData.barangay}
                      onChange={(e) => handleMemberInputChange('barangay', e.target.value)}
                      disabled={convertingMember}
                    />
                    {memberFormErrors.barangay && <span className="guest-field-error">{memberFormErrors.barangay}</span>}
                  </div>
                  <div className="guest-form-group">
                    <label>City <span>*</span></label>
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
                    <label>Province <span>*</span></label>
                    <input
                      type="text"
                      value={memberFormData.province}
                      onChange={(e) => handleMemberInputChange('province', e.target.value)}
                      disabled={convertingMember}
                    />
                    {memberFormErrors.province && <span className="guest-field-error">{memberFormErrors.province}</span>}
                  </div>
                  <div className="guest-form-group">
                    <label>ZIP Code <span>*</span></label>
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
                        <label>Guardian Surname <span>*</span></label>
                        <input
                          type="text"
                          value={memberFormData.guardianSurname}
                          onChange={(e) => handleMemberInputChange('guardianSurname', e.target.value)}
                          disabled={convertingMember}
                        />
                        {memberFormErrors.guardianSurname && <span className="guest-field-error">{memberFormErrors.guardianSurname}</span>}
                      </div>
                      <div className="guest-form-group">
                        <label>Guardian First Name <span>*</span></label>
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
        ) : successData ? (
          <section className="guest-success-panel">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <h2>Welcome, {successData.guest_name}!</h2>
            <p>We've recorded your attendance for {successData.service_name}.</p>
            <div className="guest-success-summary">
              <div>
                <span className="guest-summary-label">Total Visits</span>
                <span className="guest-summary-value">{successData.total_visits}</span>
              </div>
              <div>
                <span className="guest-summary-label">Sunday Streak</span>
                <span className="guest-summary-value">{successData.sunday_streak}</span>
              </div>
              <div>
                <span className="guest-summary-label">Until Membership</span>
                <span className="guest-summary-value">{successData.remaining_for_membership}</span>
              </div>
            </div>
            {successData.remaining_for_membership > 0 ? (
              <p className="guest-success-hint">Visit {successData.remaining_for_membership === 1 ? 'one more Sunday service' : `${successData.remaining_for_membership} more Sunday services`} to become a member automatically.</p>
            ) : (
              <p className="guest-success-hint">You've reached the required Sunday services! A leader will help you with the next steps.</p>
            )}
            <div className="guest-success-actions">
              <button className="guest-success-btn" onClick={handleNewCheckIn}>Check-In Another Guest</button>
              <button className="guest-success-secondary" onClick={() => navigate('/home')}>Back to Home</button>
            </div>
          </section>
        ) : (
          <form className="guest-form" onSubmit={handleSubmit}>
            <div className="guest-form-grid">
              <div className="guest-form-group">
                <label>First Name <span>*</span></label>
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => handleInputChange('first_name', e.target.value)}
                  placeholder="e.g. Juan"
                  disabled={submitting}
                />
                {formErrors.first_name && <span className="guest-field-error">{formErrors.first_name}</span>}
              </div>
              <div className="guest-form-group">
                <label>Middle Name</label>
                <input
                  type="text"
                  value={formData.middle_name}
                  onChange={(e) => handleInputChange('middle_name', e.target.value)}
                  placeholder="Optional"
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="guest-form-grid">
              <div className="guest-form-group">
                <label>Surname <span>*</span></label>
                <input
                  type="text"
                  value={formData.surname}
                  onChange={(e) => handleInputChange('surname', e.target.value)}
                  placeholder="e.g. Dela Cruz"
                  disabled={submitting}
                />
                {formErrors.surname && <span className="guest-field-error">{formErrors.surname}</span>}
              </div>
              <div className="guest-form-group">
                <label>Suffix</label>
                <select
                  value={formData.suffix}
                  onChange={(e) => handleInputChange('suffix', e.target.value)}
                  disabled={submitting}
                >
                  {suffixOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="guest-form-grid">
              <div className="guest-form-group">
                <label>Contact Number <span>*</span></label>
                <input
                  type="tel"
                  value={formData.contact_number}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 11);
                    handleInputChange('contact_number', value);
                  }}
                  placeholder="e.g. 09123456789"
                  disabled={submitting}
                />
                {formErrors.contact_number && <span className="guest-field-error">{formErrors.contact_number}</span>}
              </div>
              <div className="guest-form-group">
                <label>Email Address <span style={{ color: '#94a3b8', fontWeight: 500 }}>(optional)</span></label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="you@example.com"
                  disabled={submitting}
                />
                {formErrors.email && <span className="guest-field-error">{formErrors.email}</span>}
              </div>
            </div>

            <div className="guest-form-group">
              <label>Notes</label>
              <textarea
                rows="3"
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Anything we should know before connecting with you?"
                disabled={submitting}
              />
            </div>

            {duplicateInfo?.duplicate && (
              <div className="guest-duplicate-warning">
                <p>This guest has already been checked in for this event.</p>
              </div>
            )}

            {error && (
              <div className="guest-error-banner">
                {error}
              </div>
            )}

            <button type="submit" className="guest-submit-btn" disabled={submitting}>
              {submitting ? (
                <>
                  <div className="guest-btn-spinner" />
                  Recording attendance…
                </>
              ) : (
                'Confirm Guest Attendance'
              )}
            </button>
          </form>
        )}

        <footer className="guest-checkin-footer">
          <p>Powered by ChurchTrack • We respect your privacy and will never share your information without permission.</p>
        </footer>
      </div>
    </div>
  );
};

export default GuestCheckIn;
