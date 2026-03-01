import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import './Register.css';
import logoImage from '../../assets/logo.png';
import Notification from '../Notification/Notification';
import '../transitions.css';

const Register = () => {
  const navigate = useNavigate();
  const location = useLocation();
  // Remove registrationType state - will use hasReferral from location.state
  const [formData, setFormData] = useState({
    // Referrer Information (Step 0 - only for referred registration)
    referrerId: '',
    referrerName: '',
    relationshipToReferrer: '',
    // Personal Information (Step 1)
    surname: '',
    firstName: '',
    middleName: '',
    suffix: 'None',
    birthday: '',
    age: '',
    // Contact Information (Step 2)
    email: '',
    confirmEmail: '',
    contactNumber: '',
    gender: '',
    // Guardian Information (Step 2 - conditional)
    guardianSurname: '',
    guardianFirstName: '',
    guardianMiddleName: '',
    guardianSuffix: 'None',
    relationshipToGuardian: '',
    // Address Information (Step 3)
    street: '',
    barangay: '',
    city: '',
    province: '',
    zipCode: '',
    // Security
    username: '',
    password: '',
    referralCode: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [message, setMessage] = useState(null);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [activeStep, setActiveStep] = useState(1); // Start from 1 (Personal Information)
  const [referrerSearchResults, setReferrerSearchResults] = useState([]);
  const [showReferrerResults, setShowReferrerResults] = useState(false);
  const [searchingReferrers, setSearchingReferrers] = useState(false);
  const [hasReferral, setHasReferral] = useState(false);
  const [animateForm, setAnimateForm] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  // State for tracking user input and validation
  const [usernameAvailable, setUsernameAvailable] = useState(null); // null, true, or false
  const [usernameCheckMessage, setUsernameCheckMessage] = useState('');
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState(null); // null, true, or false
  const [emailCheckMessage, setEmailCheckMessage] = useState('');
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [captchaChecked, setCaptchaChecked] = useState(false);

  // Calculate the max allowed birthday (5 years ago from today)
  const today = new Date();
  const maxAllowedBirthday = new Date(today.getFullYear() - 5, today.getMonth(), today.getDate());
  const maxAllowedBirthdayStr = maxAllowedBirthday.toISOString().split('T')[0];
  
  // Set minimum allowed birthday (120 years ago)
  const minAllowedBirthday = new Date(today.getFullYear() - 120, today.getMonth(), today.getDate());
  const minAllowedBirthdayStr = minAllowedBirthday.toISOString().split('T')[0];
  
  // Add animation effect when component mounts
  useEffect(() => {
    setAnimateForm(true);
    // Check if user came from referral selection
    if (location.state?.hasReferral !== undefined) {
      setHasReferral(location.state.hasReferral);
    }
    
    // Check for referral code from URL
    const urlParams = new URLSearchParams(location.search);
    const code = urlParams.get('referral');
    if (code) {
      setFormData(prev => ({ ...prev, referralCode: code }));
      setHasReferral(true);
    }
  }, [location.state, location.search]);

  // Search for referrers
  const searchReferrers = async (searchTerm) => {
    if (searchTerm.length < 2) {
      setReferrerSearchResults([]);
      setShowReferrerResults(false);
      return;
    }

    setSearchingReferrers(true);
    try {
      const apiBaseUrl = window.location.origin;
      const response = await fetch(`${apiBaseUrl}/api/members/get_active.php`);
      const members = await response.json();
      
      const filtered = members.filter(member => 
        member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.username.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      setReferrerSearchResults(filtered.slice(0, 10)); // Limit to 10 results
      setShowReferrerResults(true);
    } catch (error) {
      console.error('Error searching referrers:', error);
      setReferrerSearchResults([]);
    }
    setSearchingReferrers(false);
  };

  // Select referrer
  const selectReferrer = (referrer) => {
    setFormData(prev => ({
      ...prev,
      referrerId: referrer.id,
      referrerName: referrer.name
    }));
    setShowReferrerResults(false);
  };
  
  // Function to navigate back to referral selection page
  const navigateToLogin = () => {
    // Apply transition effect before navigation
    setAnimateForm(false);
    document.body.classList.add('page-transition-exit-active');
    document.body.classList.add('page-transitioning');
    
    // Delay navigation to allow transition effect to complete
    setTimeout(() => {
      // Always go back to referral selection since register is only accessed from there
      navigate('/referral-selection');
    }, 300);
  };
  
  // Validation functions
  const isValidFullName = (name) => {
    // At least two words, only letters, spaces, hyphens, apostrophes, min 4 chars
    return /^[A-Za-z][A-Za-z'\- ]+[A-Za-z]$/.test(name.trim()) && name.trim().split(' ').length >= 2 && name.trim().length >= 4;
  };

  const validateStep1 = () => {
    const surnameValid = (formData.surname || '').trim() !== '';
    const firstNameValid = (formData.firstName || '').trim() !== '';
    const genderValid = (formData.gender || '').trim() !== '';
    const birthdayValid =
      formData.birthday &&
      formData.birthday.split('-').length === 3 &&
      formData.birthday.split('-').every(part => part.length > 0) &&
      new Date(formData.birthday) >= minAllowedBirthday &&
      new Date(formData.birthday) <= maxAllowedBirthday;
    return surnameValid && firstNameValid && genderValid && birthdayValid;
  };

  const validateStep2 = () => {
    const trimmedEmail = (formData.email || '').trim();
    const emailProvided = trimmedEmail !== '';
    const emailValid = !emailProvided || /^\S+@\S+\.\S+$/.test(trimmedEmail);
    const contactValid = /^09\d{9}$/.test((formData.contactNumber || '').trim());
    
    // Check if guardian information is required (age 17 and below)
    const isMinor = parseInt(formData.age) <= 17;
    if (isMinor) {
      const guardianSurnameValid = (formData.guardianSurname || '').trim() !== '';
      const guardianFirstNameValid = (formData.guardianFirstName || '').trim() !== '';
      const relationshipValid = (formData.relationshipToGuardian || '').trim() !== '';
      return emailValid && contactValid && guardianSurnameValid && guardianFirstNameValid && relationshipValid;
    }
    
    return emailValid && contactValid;
  };

  const validateStep3 = () => {
    const streetValid = (formData.street || '').trim() !== '';
    const barangayValid = (formData.barangay || '').trim() !== '';
    const cityValid = (formData.city || '').trim() !== '';
    const provinceValid = (formData.province || '').trim() !== '';
    const zipValid = /^\d{4}$/.test((formData.zipCode || '').trim());
    return streetValid && barangayValid && cityValid && provinceValid && zipValid;
  };

  const validateStep4 = () => {
    const usernameValid = (formData.username || '').trim() !== '' && usernameAvailable === true;
    const passwordValid = formData.password.length >= 8;
    return usernameValid && passwordValid;
  };

  // Handle step navigation
  const goToNextStep = () => {
    // Validate current step before proceeding
    if (activeStep === 1 && hasReferral) {
      // Validate referrer selection for referred registration
      if (!formData.referrerId || !formData.relationshipToReferrer) {
        setMessage({ type: 'error', text: 'Please select a referrer and specify your relationship' });
        return;
      }
    } else if ((activeStep === 1 && !hasReferral) || (activeStep === 2 && hasReferral)) {
      // Personal Information step
      if (!validateStep1()) {
        setMessage({ type: 'error', text: 'Please fill in all required fields correctly' });
        return;
      }
    } else if ((activeStep === 2 && !hasReferral) || (activeStep === 3 && hasReferral)) {
      // Contact Information step
      if (!validateStep2()) {
        setMessage({ type: 'error', text: 'Please enter a valid contact number (and matching email if provided)' });
        return;
      }
    } else if ((activeStep === 3 && !hasReferral) || (activeStep === 4 && hasReferral)) {
      // Address Information step
      if (!validateStep3()) {
        setMessage({ type: 'error', text: 'Please fill in all address fields' });
        return;
      }
    }

    // Clear any error messages when moving to next step
    setMessage(null);
    setError('');
    
    const maxSteps = hasReferral ? 5 : 4;
    if (activeStep < maxSteps) {
      setActiveStep(prev => prev + 1);
      
      // Scroll to top smoothly after step change
      setTimeout(() => {
        const container = document.querySelector('.register-container');
        if (container) {
          container.scrollTo({
            top: 0,
            behavior: 'smooth'
          });
        } else {
          // Fallback to window scroll
          window.scrollTo({
            top: 0,
            behavior: 'smooth'
          });
        }
      }, 100);
    }
  };
  
  const goToPrevStep = () => {
    // Clear any error messages when going back
    setMessage(null);
    setError('');
    
    if (activeStep > 1) {
      setActiveStep(prev => prev - 1);
    } else if (activeStep === 1 && hasReferral) {
      // If on referrer step (step 1 with referral), go back to referral selection
      navigate('/referral-selection');
    }
  };

  const checkUsernameAvailability = async (username) => {
    if (!(username || '').trim()) {
      setUsernameAvailable(null);
      setUsernameCheckMessage('');
      return;
    }
    setCheckingUsername(true);
    try {
      const apiBaseUrl = window.location.origin;
      const res = await fetch(`${apiBaseUrl}/api/members/check_username.php?username=${encodeURIComponent(username)}`);
      const data = await res.json();
      setUsernameAvailable(data.available);
      setUsernameCheckMessage(data.message);
    } catch (err) {
      setUsernameAvailable(null);
      setUsernameCheckMessage('Error checking username');
    }
    setCheckingUsername(false);
  };

  const checkEmailAvailability = async (email) => {
    if (!(email || '').trim()) {
      setEmailAvailable(null);
      setEmailCheckMessage('');
      return;
    }
    setCheckingEmail(true);
    try {
      const apiBaseUrl = window.location.origin;
      const res = await fetch(`${apiBaseUrl}/api/members/check_email.php?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      setEmailAvailable(data.available);
      setEmailCheckMessage(data.message);
    } catch (err) {
      setEmailAvailable(null);
      setEmailCheckMessage('Error checking email');
    }
    setCheckingEmail(false);
  };

  // Debounce username check
  useEffect(() => {
    if ((formData.username || '').trim() === '') {
      setUsernameAvailable(null);
      setUsernameCheckMessage('');
      setCheckingUsername(false);
      return;
    }
    setCheckingUsername(true);
    const handler = setTimeout(() => {
      checkUsernameAvailability(formData.username);
    }, 800);
    return () => clearTimeout(handler);
    // eslint-disable-next-line
  }, [formData.username]);

  // Debounce email check
  useEffect(() => {
    if ((formData.email || '').trim() === '') {
      setEmailAvailable(null);
      setEmailCheckMessage('');
      setCheckingEmail(false);
      return;
    }
    setCheckingEmail(true);
    const handler = setTimeout(() => {
      checkEmailAvailability(formData.email);
    }, 800);
    return () => clearTimeout(handler);
    // eslint-disable-next-line
  }, [formData.email]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let sanitizedValue = value;

    if (name === 'contactNumber') {
      sanitizedValue = value.replace(/\D/g, '').slice(0, 11);
    } else if (name === 'zipCode') {
      sanitizedValue = value.replace(/\D/g, '').slice(0, 4);
    }

    setFormData((prev) => {
      const newState = {
        ...prev,
        [name]: sanitizedValue
      };

      // Calculate age when birthday changes
      if (name === 'birthday' && value) {
        const today = new Date();
        const birthDate = new Date(value);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        newState.age = age.toString();
      }



      return newState;
    });
  };

  const handleSubmitRegistration = async (e) => {
    e.preventDefault();

    if (!termsAccepted) {
      setMessage({ type: 'error', text: 'Please accept the terms and conditions' });
      return;
    }

    if (!formData.username || formData.username.trim() === '') {
      setMessage({ type: 'error', text: 'Please enter a username' });
      return;
    }

    if (usernameAvailable !== true) {
      setMessage({ type: 'error', text: 'Please choose an available username' });
      return;
    }

    if (formData.password.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters long' });
      return;
    }

    if (!formData.birthday) {
      setMessage({ type: 'error', text: 'Please enter your birthday' });
      return;
    }

    try {
      setIsLoading(true);
      setMessage(null);
      setError('');

      const isMinor = parseInt(formData.age) <= 17;
      const trimmedEmail = (formData.email || '').trim();
      
      const payload = {
        surname: formData.surname,
        firstName: formData.firstName,
        middleName: formData.middleName || null,
        suffix: formData.suffix || 'None',
        gender: formData.gender,
        birthday: formData.birthday,
        contactNumber: formData.contactNumber,
        street: formData.street,
        barangay: formData.barangay,
        city: formData.city,
        province: formData.province,
        zipCode: formData.zipCode,
        username: formData.username,
        password: formData.password,
      };

      if (trimmedEmail) {
        payload.email = trimmedEmail;
      }

      if (isMinor) {
        payload.guardianSurname = formData.guardianSurname;
        payload.guardianFirstName = formData.guardianFirstName;
        payload.guardianMiddleName = formData.guardianMiddleName || null;
        payload.guardianSuffix = formData.guardianSuffix || 'None';
        payload.relationshipToGuardian = formData.relationshipToGuardian;
      }

      if (hasReferral && formData.referrerId) {
        payload.referrerId = formData.referrerId;
        payload.relationshipToReferrer = formData.relationshipToReferrer || null;
      }

      const apiBaseUrl = window.location.origin;
      const response = await fetch(`${apiBaseUrl}/api/members/register.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Registration successful!' });
        setNotificationMessage('Registration successful! Please wait for admin approval. We will notify you via email if you provided one.');
        setShowNotification(true);

        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to submit registration. Please try again.' });
      }
    } catch (error) {
      console.error('Registration error:', error);
      setMessage({ type: 'error', text: 'Failed to submit registration. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="register-container">
      {showNotification && (
        <Notification
          message={notificationMessage}
          type="info"
          onClose={() => setShowNotification(false)}
        />
      )}
      
      
      <div className="register-box">
        {/* Back button to referral selection - only show in Step 1 */}
        {activeStep === 1 && (
          <button 
            onClick={navigateToLogin} 
            className="back-link animate-fade-in"
            aria-label="Back to referral selection"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            <span>Back</span>
          </button>
        )}
        
        {/* Back button for Personal section - only show in Step 2 when hasReferral */}
        {activeStep === 2 && hasReferral && (
          <button 
            onClick={goToPrevStep} 
            className="back-link animate-fade-in"
            aria-label="Back to referrer information"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            <span>Back</span>
          </button>
        )}
        
        {/* Back button for Contact section */}
        {activeStep === (hasReferral ? 3 : 2) && (
          <button 
            onClick={goToPrevStep} 
            className="back-link animate-fade-in"
            aria-label="Back to previous step"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            <span>Back</span>
          </button>
        )}
        
        {/* Back button for Address section */}
        {activeStep === (hasReferral ? 4 : 3) && (
          <button 
            onClick={goToPrevStep} 
            className="back-link animate-fade-in"
            aria-label="Back to previous step"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            <span>Back</span>
          </button>
        )}
        
        {/* Back button for Security section */}
        {activeStep === (hasReferral ? 5 : 4) && (
          <button 
            onClick={goToPrevStep} 
            className="back-link animate-fade-in"
            aria-label="Back to previous step"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            <span>Back</span>
          </button>
        )}
        
        <div className="register-header">
          <h1>Create Your Account</h1>
        </div>
        <p className="register-description">
          Create an account to access the ChurchTrack system. Your registration will be reviewed by an admin.
        </p>

        <div className="data-notice">
          <span className="data-notice-icon" aria-hidden="true">ℹ️</span>
          <div className="data-notice-text">
            <p>
              ChurchTrack uses your details for membership and attendance. See our{' '}
              <button
                type="button"
                className="inline-link"
                onClick={() => setShowPrivacyModal(true)}
                disabled={isLoading}
              >
                Privacy Policy
              </button>
              .
            </p>
          </div>
        </div>

        {message && (
          <div className={`message-${message.type.toLowerCase()} animate-fade-in`}>
            {message.type === 'error' && (
              <svg className="message-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            )}
            {message.type === 'success' && (
              <svg className="message-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 2 6"/>
              </svg>
            )}
            {message.text}
          </div>
        )}

        

        {/* Step Progress Indicator */}
        <div className="step-progress">
          {hasReferral && (
            <>
              <div className="step-item">
                <div className={`step-circle ${activeStep >= 1 ? 'active' : ''}`}>1</div>
                <span className="step-label">Referrer</span>
              </div>
              <div className="step-connector"></div>
            </>
          )}
          <div className="step-item">
            <div className={`step-circle ${activeStep >= (hasReferral ? 2 : 1) ? 'active' : ''}`}>
              {hasReferral ? '2' : '1'}
            </div>
            <span className="step-label">Personal</span>
          </div>
          <div className="step-connector"></div>
          <div className="step-item">
            <div className={`step-circle ${activeStep >= (hasReferral ? 3 : 2) ? 'active' : ''}`}>
              {hasReferral ? '3' : '2'}
            </div>
            <span className="step-label">Contact</span>
          </div>
          <div className="step-connector"></div>
          <div className="step-item">
            <div className={`step-circle ${activeStep >= (hasReferral ? 4 : 3) ? 'active' : ''}`}>
              {hasReferral ? '4' : '3'}
            </div>
            <span className="step-label">Address</span>
          </div>
          <div className="step-connector"></div>
          <div className="step-item">
            <div className={`step-circle ${activeStep >= (hasReferral ? 5 : 4) ? 'active' : ''}`}>
              {hasReferral ? '5' : '4'}
            </div>
            <span className="step-label">Security</span>
          </div>
        </div>

        <form onSubmit={handleSubmitRegistration}>
          <div className="registration-steps">
            {/* Step 1: Referrer Information (only for referred registration) */}
            {hasReferral && (
              <div className={`step-content ${activeStep === 1 ? 'active' : ''}`}>
                <div className="step-header">
                  <div className="step-icon">🔍</div>
                  <h2>Referrer Information</h2>
                  <p>Who referred you to ChurchTrack?</p>
                </div>
                
                <div className="form-group referrer-group">
                  <label htmlFor="referrerSearch">
                    Search Referrer Name
                    <span className="required-asterisk">*</span>
                  </label>
                  <input
                    type="text"
                    id="referrerSearch"
                    placeholder="Start typing name..."
                    value={formData.referrerName}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, referrerName: e.target.value }));
                      searchReferrers(e.target.value);
                    }}
                    onFocus={() => {
                      if (referrerSearchResults.length > 0) {
                        setShowReferrerResults(true);
                      }
                    }}
                  />
                  {searchingReferrers && <div className="searching-indicator">Searching...</div>}
                  {showReferrerResults && referrerSearchResults.length > 0 && (
                    <div className="search-results">
                      {referrerSearchResults.map((referrer) => (
                        <div 
                          key={referrer.id}
                          className="search-result-item"
                          onClick={() => selectReferrer(referrer)}
                        >
                          <div className="referrer-name">{referrer.name}</div>
                          <div className="referrer-username">@{referrer.username}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="relationshipToReferrer">
                    Relationship to Referrer
                    <span className="required-asterisk">*</span>
                  </label>
                  <select
                    id="relationshipToReferrer"
                    value={formData.relationshipToReferrer}
                    onChange={(e) => setFormData(prev => ({ ...prev, relationshipToReferrer: e.target.value }))}
                  >
                    <option value="">Select relationship</option>
                    <option value="Friend">Friend</option>
                    <option value="Family Member">Family Member</option>
                    <option value="Colleague">Colleague</option>
                    <option value="Neighbor">Neighbor</option>
                    <option value="Acquaintance">Acquaintance</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="step-navigation">
                  <button 
                    type="button" 
                    className="next-button" 
                    onClick={goToNextStep}
                    disabled={!formData.referrerId || !formData.relationshipToReferrer}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {/* Step 1/2: Personal Information */}
            <div className={`step-content ${activeStep === (hasReferral ? 2 : 1) ? 'active' : ''}`}>
              <div className="step-header">
                <div className="step-icon">👤</div>
                <h2 className="step-title">Registrant Information</h2>
                <p className="step-subtitle">Tell us about yourself</p>
              </div>
              <div className="form-groups">
                <div className="form-group">
                  <label>
                    Surname
                    <span className="required-asterisk">*</span>
                  </label>
                    <input
                      type="text"
                    name="surname"
                    placeholder="Enter surname"
                    value={formData.surname}
                      onChange={handleChange}
                      required
                    disabled={isLoading}
                    />
                </div>
                
                <div className="form-group">
                  <label>
                    First Name
                    <span className="required-asterisk">*</span>
                  </label>
                    <input
                      type="text"
                    name="firstName"
                    placeholder="Enter first name"
                    value={formData.firstName}
                      onChange={handleChange}
                      required
                      disabled={isLoading}
                  />
                </div>
                
                <div className="form-group">
                  <label>Middle Name (optional)</label>
                  <input
                    type="text"
                    name="middleName"
                    placeholder="Enter middle name"
                    value={formData.middleName}
                    onChange={handleChange}
                    disabled={isLoading}
                    />
                  </div>

                <div className="form-group">
                  <label>Suffix</label>
                  <select
                    name="suffix"
                    value={formData.suffix}
                    onChange={handleChange}
                    disabled={isLoading}
                  >
                    <option value="None">None</option>
                    <option value="Jr.">Jr.</option>
                    <option value="Sr.">Sr.</option>
                    <option value="II">II</option>
                    <option value="III">III</option>
                    <option value="IV">IV</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label>
                    Gender
                    <span className="required-asterisk">*</span>
                  </label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>
                      Birthday
                      <span className="required-asterisk">*</span>
                    </label>
                    <input
                      type="date"
                      name="birthday"
                      value={formData.birthday}
                      onChange={handleChange}
                      required
                      disabled={isLoading}
                      min={minAllowedBirthdayStr}
                      max={maxAllowedBirthdayStr}
                    />
                  </div>

                  <div className="form-group">
                    <label>Age</label>
                    <input
                      type="text"
                      name="age"
                      value={formData.age}
                      readOnly
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>
              <div className="step-navigation">
                <button 
                  type="button" 
                  className="next-button" 
                  onClick={goToNextStep}
                  disabled={!validateStep1()}
                >
                  Next
                </button>
              </div>
            </div>

            {/* Step 2/3: Contact Information */}
            <div className={`step-content ${activeStep === (hasReferral ? 3 : 2) ? 'active' : ''}`}>
              <div className="step-header">
                <div className="step-icon">📧</div>
                <h2 className="step-title">Contact Information</h2>
                <p className="step-subtitle">How can we reach you?</p>
              </div>
              <div className="form-groups">
                <div className="form-group">
                  <label>Email Address (optional)</label>
                  <input
                    type="email"
                    name="email"
                    placeholder="your.email@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    disabled={isLoading}
                    className={
                      emailAvailable === false
                        ? 'input-error'
                        : emailAvailable === true
                          ? 'input-success'
                          : ''
                    }
                  />
                </div>


                <div className="form-group">
                  <label>
                    Contact Number
                    <span className="required-asterisk">*</span>
                  </label>
                  <input
                    type="tel"
                    name="contactNumber"
                    placeholder="09XX XXX XXXX"
                    value={formData.contactNumber}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                    inputMode="numeric"
                    pattern="09[0-9]{9}"
                    minLength={11}
                    maxLength={11}
                    title="Enter a valid 11-digit Philippine mobile number starting with 09"
                  />
                </div>
              </div>

              {/* Guardian Information Section - Only show if age is 17 and below */}
              {parseInt(formData.age) <= 17 && (
                <div className="guardian-section">
                  <div className="step-header">
                    <div className="step-icon">👥</div>
                    <h2 className="step-title">Guardian Information</h2>
                    <p className="step-subtitle">Please provide your guardian's details</p>
                  </div>
                  <div className="form-groups">
                    <div className="form-group">
                      <label>
                      Guardian Surname
                      <span className="required-asterisk">*</span>
                    </label>
                      <input
                        type="text"
                        name="guardianSurname"
                        placeholder="Enter guardian surname"
                        value={formData.guardianSurname}
                        onChange={handleChange}
                        required
                        disabled={isLoading}
                      />
                    </div>
                    
                    <div className="form-group">
                      <label>
                      Guardian First Name
                      <span className="required-asterisk">*</span>
                    </label>
                      <input
                        type="text"
                        name="guardianFirstName"
                        placeholder="Enter guardian first name"
                        value={formData.guardianFirstName}
                        onChange={handleChange}
                        required
                        disabled={isLoading}
                      />
                    </div>
                    
                    <div className="form-group">
                      <label>Guardian Middle Name</label>
                      <input
                        type="text"
                        name="guardianMiddleName"
                        placeholder="Enter guardian middle name"
                        value={formData.guardianMiddleName}
                        onChange={handleChange}
                        disabled={isLoading}
                      />
                    </div>
                    
                    <div className="form-group">
                      <label>Guardian Suffix</label>
                      <select
                        name="guardianSuffix"
                        value={formData.guardianSuffix}
                        onChange={handleChange}
                        disabled={isLoading}
                      >
                        <option value="None">None</option>
                        <option value="Jr.">Jr.</option>
                        <option value="Sr.">Sr.</option>
                        <option value="II">II</option>
                        <option value="III">III</option>
                        <option value="IV">IV</option>
                      </select>
                    </div>
                    
                    <div className="form-group">
                      <label>
                      Relationship to Guardian
                      <span className="required-asterisk">*</span>
                    </label>
                      <select
                        name="relationshipToGuardian"
                        value={formData.relationshipToGuardian}
                        onChange={handleChange}
                        required
                        disabled={isLoading}
                      >
                        <option value="">Select relationship</option>
                        <option value="Parent">Parent</option>
                        <option value="Legal Guardian">Legal Guardian</option>
                        <option value="Grandparent">Grandparent</option>
                        <option value="Uncle/Aunt">Uncle/Aunt</option>
                        <option value="Sibling">Sibling</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
              <div className="step-navigation">
                <button 
                  type="button" 
                  className="next-button" 
                  onClick={goToNextStep}
                  disabled={!validateStep2()}
                >
                  Next
                </button>
              </div>
            </div>

            {/* Step 3/4: Address Information */}
            <div className={`step-content ${activeStep === (hasReferral ? 4 : 3) ? 'active' : ''}`}>
              <div className="step-header">
                <div className="step-icon">🏠</div>
                <h2 className="step-title">Address Information</h2>
                <p className="step-subtitle">Where do you currently live?</p>
              </div>
              <div className="form-groups">
                <div className="form-group">
                  <label>
                    Street / House No.
                    <span className="required-asterisk">*</span>
                  </label>
                  <input
                    type="text"
                    name="street"
                    placeholder="Enter street address"
                    value={formData.street}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                  />
                </div>
                
                <div className="form-group">
                  <label>
                    Barangay
                    <span className="required-asterisk">*</span>
                  </label>
                  <input
                    type="text"
                    name="barangay"
                    placeholder="Enter barangay"
                    value={formData.barangay}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                  />
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>
                      City / Municipality
                      <span className="required-asterisk">*</span>
                    </label>
                    <input
                      type="text"
                      name="city"
                      placeholder="Enter city"
                      value={formData.city}
                      onChange={handleChange}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>
                      Province
                      <span className="required-asterisk">*</span>
                    </label>
                    <input
                      type="text"
                      name="province"
                      placeholder="Enter province"
                      value={formData.province}
                      onChange={handleChange}
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label>
                    ZIP Code
                    <span className="required-asterisk">*</span>
                  </label>
                  <input
                    type="text"
                    name="zipCode"
                    placeholder="Enter ZIP code"
                    value={formData.zipCode}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>
              <div className="step-navigation">
                <button 
                  type="button" 
                  className="next-button" 
                  onClick={goToNextStep}
                  disabled={!validateStep3()}
                >
                  Next
                </button>
              </div>
            </div>

            {/* Step 4/5: Security Information */}
            <div className={`step-content ${activeStep === (hasReferral ? 5 : 4) ? 'active' : ''}`}>
              <div className="step-header">
                <div className="step-icon">🔒</div>
                <h2 className="step-title">Account Security</h2>
                <p className="step-subtitle">Create your login credentials</p>
              </div>
              <div className="form-groups">
                <div className="form-group">
                  <label>
                    Username
                    <span className="required-asterisk">*</span>
                  </label>
                  <input
                    type="text"
                    name="username"
                    placeholder="Choose a unique username"
                    value={formData.username}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                  />
                  {usernameCheckMessage && (
                    <div className={`field-message ${usernameAvailable === true ? 'success' : usernameAvailable === false ? 'error' : 'info'}`}>
                      {usernameCheckMessage}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>
                    Password
                    <span className="required-asterisk">*</span>
                  </label>
                  <div className="password-input">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      placeholder="Minimum 8 characters"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={togglePasswordVisibility}
                      disabled={isLoading}
                    >
                      {showPassword ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      )}
                    </button>
                  </div>
                  {formData.password && formData.password.length < 8 && (
                    <div className="field-message error">
                      Password must be at least 8 characters long
                    </div>
                  )}
                </div>

                {/* Email verification removed */}
              </div>

              {/* Terms and Conditions Section */}
              <div className="terms-section">
                <div className="terms-checkbox">
                  <input
                    type="checkbox"
                    id="termsAccepted"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    disabled={isLoading}
                    required
                  />
                  <label htmlFor="termsAccepted">
                    I agree to the{' '}
                    <button 
                      type="button" 
                      className="terms-link"
                      onClick={() => setShowTermsModal(true)}
                      disabled={isLoading}
                    >
                      Terms and Conditions
                    </button>
                    {' '}and{' '}
                    <button 
                      type="button" 
                      className="privacy-link"
                      onClick={() => setShowPrivacyModal(true)}
                      disabled={isLoading}
                    >
                      Privacy Policy
                    </button>
                  </label>
                </div>
              </div>

              <div className="step-navigation">
                <button 
                  type="submit" 
                  className="submit-button"
                  disabled={!validateStep4() || !termsAccepted || isLoading}
                >
                  {isLoading ? 'Submitting...' : 'Submit Registration'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Terms and Conditions Modal */}
      {showTermsModal && (
        <div className="modal-overlay" onClick={() => setShowTermsModal(false)}>
          <div className="modal-content terms-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📋 Terms and Conditions</h3>
              <button 
                className="modal-close" 
                onClick={() => setShowTermsModal(false)}
                disabled={isLoading}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="terms-intro">
                <h4>ChurchTrack Membership Terms</h4>
                <p>By creating a ChurchTrack account, you acknowledge and agree to the following guidelines:</p>
              </div>
              
              <div className="terms-section-item">
                <h5>1. Purpose of the System</h5>
                <ul>
                  <li>ChurchTrack exists to manage Christ-Like Christian Church membership and attendance.</li>
                  <li>Access is provided to members approved by church leadership.</li>
                </ul>
              </div>
              
              <div className="terms-section-item">
                <h5>2. Accurate Information</h5>
                <ul>
                  <li>Submit truthful and current personal, contact, and household details.</li>
                  <li>Update your profile promptly when your information changes.</li>
                </ul>
              </div>
              
              <div className="terms-section-item">
                <h5>3. Attendance & Participation</h5>
                <ul>
                  <li>Worship services and ministry events you attend may be logged for follow-up and care.</li>
                  <li>Attendance insights help pastors plan discipleship, visitation, and resource allocation.</li>
                </ul>
              </div>
              
              <div className="terms-section-item">
                <h5>4. Responsible Use</h5>
                <ul>
                  <li>Keep your login credentials private and do not misuse system data.</li>
                  <li>Interact respectfully with church staff and fellow members when using ChurchTrack.</li>
                </ul>
              </div>
              
              <div className="terms-section-item">
                <h5>5. Reviews & Support</h5>
                <ul>
                  <li>Administrators may review your account to ensure compliance with these terms.</li>
                  <li>Contact the church office if you need assistance or have questions about your membership record.</li>
                </ul>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="modal-button" 
                onClick={() => setShowTermsModal(false)}
                disabled={isLoading}
              >
                ✓ I Understand
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Policy Modal */}
      {showPrivacyModal && (
        <div className="modal-overlay" onClick={() => setShowPrivacyModal(false)}>
          <div className="modal-content privacy-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🔒 Privacy Policy</h3>
              <button 
                className="modal-close" 
                onClick={() => setShowPrivacyModal(false)}
                disabled={isLoading}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="terms-intro">
                <h4>ChurchTrack Privacy Notice</h4>
                <p>This notice explains how we handle your information for CLCC membership and attendance management.</p>
              </div>
              
              <div className="terms-section-item">
                <h5>Information We Collect</h5>
                <ul>
                  <li>Profile details such as name, birthday, contact information, and address.</li>
                  <li>Attendance history for worship services and ministry events.</li>
                  <li>Household or guardian information for members under 18.</li>
                  <li>Account credentials used to access the ChurchTrack system.</li>
                </ul>
              </div>
              
              <div className="terms-section-item">
                <h5>How We Use Your Information</h5>
                <ul>
                  <li>To maintain accurate membership and pastoral care records.</li>
                  <li>To monitor attendance and plan follow-ups or ministry support.</li>
                  <li>To send official announcements, reminders, and ministry invitations.</li>
                  <li>To generate internal reports that help improve church programs.</li>
                </ul>
              </div>
              
              <div className="terms-section-item">
                <h5>Information Sharing</h5>
                <ul>
                  <li>Only authorized pastors, staff, and ministry leaders can view your records.</li>
                  <li>We do not sell or trade personal data with outside organizations.</li>
                  <li>We may share limited data when required by law or for urgent safety concerns.</li>
                </ul>
              </div>
              
              <div className="terms-section-item">
                <h5>Retention & Security</h5>
                <ul>
                  <li>Data is stored on secured systems with access controls and regular monitoring.</li>
                  <li>We retain records while your membership is active and for a reasonable period afterward.</li>
                  <li>Backups and updates are performed to safeguard against loss or misuse.</li>
                </ul>
              </div>
              
              <div className="terms-section-item">
                <h5>Your Choices</h5>
                <ul>
                  <li>Request to view or update the information we hold about you.</li>
                  <li>Ask for corrections or removal of outdated details, subject to legal obligations.</li>
                  <li>Manage your communication preferences through church administrators.</li>
                </ul>
              </div>
              
              <div className="terms-section-item">
                <h5>Contact</h5>
                <p>For privacy questions or requests, please reach out to the CLCC administrative office.</p>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="modal-button" 
                onClick={() => setShowPrivacyModal(false)}
                disabled={isLoading}
              >
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Register; 
