import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import './Register.css';
import logoImage from '../../assets/logo.png';
import Notification from '../Notification/Notification';
import '../transitions.css';
import { API_BASE_URL } from '../../config/api';
import { findZipCode } from '../../utils/philippinesZipLookup';

// SVG icons for step headers — no emojis
const StepIcons = {
  referrer: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  personal: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  contact: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  ),
  address: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  ),
  security: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  guardian: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
};

const FAMILY_LINK_RELATIONSHIPS = [
  'Brother',
  'Sister',
  'Father',
  'Mother',
  'Son',
  'Daughter',
  'Spouse',
  'Other'
];

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
    gender: 'Male',
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
    confirmPassword: '',
    referralCode: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
  const [familyLinks, setFamilyLinks] = useState([]);
  const [familyLinkSearch, setFamilyLinkSearch] = useState('');
  const [familyLinkResults, setFamilyLinkResults] = useState([]);
  const [showFamilyLinkResults, setShowFamilyLinkResults] = useState(false);
  const [searchingFamilyLink, setSearchingFamilyLink] = useState(false);
  const [guardianLookupLoading, setGuardianLookupLoading] = useState(false);
  const [guardianFound, setGuardianFound] = useState(false);

  // Calculate the max allowed birthday (5 years ago from today)
  const today = new Date();
  const maxAllowedBirthday = new Date(today.getFullYear() - 12, today.getMonth(), today.getDate());
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
      const response = await fetch(`${API_BASE_URL}/api/members/get_active.php`);
      const members = await response.json();
      
      const filtered = members.filter(member => 
        member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.username.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      setReferrerSearchResults(filtered.slice(0, 10)); // Limit to 10 results
      setShowReferrerResults(true);
    } catch (error) {
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
    navigate('/referral-selection');
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
    
    // Check if age is at least 12 for self-registration
    let ageValid = true;
    if (formData.birthday) {
      const birthDate = new Date(formData.birthday);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      const dayDiff = today.getDate() - birthDate.getDate();
      
      const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;
      ageValid = actualAge >= 12;
    }
    
    return surnameValid && firstNameValid && genderValid && birthdayValid && ageValid;
  };

  const validateStep2 = () => {
    const trimmedEmail = (formData.email || '').trim();
    const emailValid = /^\S+@\S+\.\S+$/.test(trimmedEmail);
    const trimmedContact = (formData.contactNumber || '').trim();
    const contactValid = trimmedContact === '' || /^09\d{9}$/.test(trimmedContact);
    
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
    const confirmOk =
      (formData.confirmPassword || '').length > 0 &&
      formData.password === formData.confirmPassword;
    return usernameValid && passwordValid && confirmOk;
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
        setMessage({ type: 'error', text: 'Please enter a valid email address (contact number is optional)' });
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
      const res = await fetch(`${API_BASE_URL}/api/members/check_username.php?username=${encodeURIComponent(username)}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      setUsernameAvailable(data.available);
      setUsernameCheckMessage(data.message);
    } catch (err) {
      setUsernameAvailable(null);
      setUsernameCheckMessage('Unable to verify username. Please try again.');
    } finally {
      setCheckingUsername(false);
    }
  };

  const checkEmailAvailability = async (email) => {
    if (!(email || '').trim()) {
      setEmailAvailable(null);
      setEmailCheckMessage('');
      setCheckingEmail(false);
      setGuardianFound(false);
      return;
    }
    
    // For 12-17 year olds, allow duplicate emails (parent's email) - just validate format
    if (formData.birthday) {
      const birthDate = new Date(formData.birthday);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      const dayDiff = today.getDate() - birthDate.getDate();
      const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;
      
      if (actualAge >= 12 && actualAge < 18) {
        // For 12-17, just validate email format, no API call
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        setCheckingEmail(false);
        if (emailRegex.test(email)) {
          setEmailAvailable(true);
          setEmailCheckMessage('');
          // Try to lookup guardian by email immediately
          await lookupGuardianByEmail(email);
        } else {
          setEmailAvailable(false);
          setEmailCheckMessage('Please enter a valid email address');
          setGuardianFound(false);
        }
        return;
      }
    }
    
    // For 18+, check for duplicates
    setCheckingEmail(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/members/check_email.php?email=${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      setEmailAvailable(data.available);
      setEmailCheckMessage(data.message);
    } catch (err) {
      setEmailAvailable(null);
      setEmailCheckMessage('Unable to verify email. Please try again.');
    } finally {
      setCheckingEmail(false);
    }
  };

  const lookupGuardianByEmail = async (email) => {
    if (!(email || '').trim()) {
      setGuardianFound(false);
      return;
    }

    setGuardianLookupLoading(true);
    try {
      // Fetch all members (without pagination limit to get all members)
      const res = await fetch(`${API_BASE_URL}/api/members/get_all.php?limit=1000`);
      if (!res.ok) throw new Error('Failed to fetch members');
      
      const data = await res.json();
      const members = data.members || [];
      
      // Find guardian: must match email AND be 18+ years old (not a minor)
      const guardian = members.find(m => {
        if (!m.email || m.email.toLowerCase() !== email.toLowerCase()) {
          return false;
        }
        
        // Check if member is 18+ (adult, not a minor)
        if (m.birthday) {
          const birthDate = new Date(m.birthday);
          const today = new Date();
          const age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          const dayDiff = today.getDate() - birthDate.getDate();
          const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;
          
          // Only accept members 18 or older as guardians
          return actualAge >= 18;
        }
        
        return false;
      });
      
      if (guardian) {
        // Auto-fill guardian information
        setFormData(prev => ({
          ...prev,
          guardianSurname: guardian.surname || '',
          guardianFirstName: guardian.first_name || '',
          guardianMiddleName: guardian.middle_name || '',
          guardianSuffix: guardian.suffix || 'None',
          relationshipToGuardian: 'Parent' // Default relationship
        }));
        setGuardianFound(true);
      } else {
        setGuardianFound(false);
      }
    } catch (err) {
      console.error('Guardian lookup error:', err);
      setGuardianFound(false);
    } finally {
      setGuardianLookupLoading(false);
    }
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
      setGuardianFound(false);
      return;
    }

    // Check if user is 12-17 (minor)
    let isMinor = false;
    if (formData.birthday) {
      const birthDate = new Date(formData.birthday);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      const dayDiff = today.getDate() - birthDate.getDate();
      const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;
      isMinor = actualAge >= 12 && actualAge < 18;
    }

    // For minors, don't show checking state
    if (!isMinor) {
      setCheckingEmail(true);
    }

    const handler = setTimeout(() => {
      checkEmailAvailability(formData.email);
    }, 800);
    return () => clearTimeout(handler);
    // eslint-disable-next-line
  }, [formData.email, formData.birthday]);

  useEffect(() => {
    if (parseInt(formData.age, 10) > 17) {
      setFamilyLinks([]);
      setFamilyLinkSearch('');
      setFamilyLinkResults([]);
      setShowFamilyLinkResults(false);
    }
  }, [formData.age]);

  useEffect(() => {
    const q = familyLinkSearch.trim();
    if (q.length < 2) {
      setFamilyLinkResults([]);
      setShowFamilyLinkResults(false);
      return undefined;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      (async () => {
        setSearchingFamilyLink(true);
        try {
          const res = await fetch(
            `${API_BASE_URL}/api/family/search_members.php?q=${encodeURIComponent(q)}`
          );
          const data = await res.json();
          if (cancelled) return;
          const members = data.members || [];
          setFamilyLinkResults(members.slice(0, 12));
          setShowFamilyLinkResults(true);
        } catch {
          if (!cancelled) setFamilyLinkResults([]);
        } finally {
          if (!cancelled) setSearchingFamilyLink(false);
        }
      })();
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [familyLinkSearch]);

  const addFamilyMemberLink = (member) => {
    if (familyLinks.length >= 5) return;
    if (familyLinks.some((f) => f.id === member.id)) return;
    const name = member.full_name || member.name || member.email || `Member #${member.id}`;
    setFamilyLinks((prev) => [
      ...prev,
      { id: member.id, name, relationship: 'Brother' }
    ]);
    setFamilyLinkSearch('');
    setFamilyLinkResults([]);
    setShowFamilyLinkResults(false);
  };

  const removeFamilyMemberLink = (id) => {
    setFamilyLinks((prev) => prev.filter((f) => f.id !== id));
  };

  const updateFamilyMemberLinkRelationship = (id, relationship) => {
    setFamilyLinks((prev) =>
      prev.map((f) => (f.id === id ? { ...f, relationship } : f))
    );
  };

  useEffect(() => {
    const city = (formData.city || '').trim();
    const province = (formData.province || '').trim();
    if (!city || !province) return undefined;

    const t = setTimeout(() => {
      const zip = findZipCode(city, province);
      if (zip) {
        setFormData((prev) => (prev.zipCode === zip ? prev : { ...prev, zipCode: zip }));
      }
    }, 400);
    return () => clearTimeout(t);
  }, [formData.city, formData.province]);

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

    const trimmedEmail = (formData.email || '').trim();
    if (!trimmedEmail) {
      setMessage({ type: 'error', text: 'Please enter your email address' });
      return;
    }

    // For minors, just validate email format. For 18+, check availability
    const isMinor = parseInt(formData.age) <= 17;
    if (isMinor) {
      // For minors, just validate format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        setMessage({ type: 'error', text: 'Please enter a valid email address' });
        return;
      }
    } else {
      // For 18+, check availability
      if (emailAvailable !== true) {
        setMessage({ type: 'error', text: 'Please use an available email address' });
        return;
      }
    }

    if (formData.password.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters long' });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
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
        if (familyLinks.length > 0) {
          payload.familyLinks = familyLinks.map((f) => ({
            relativeId: f.id,
            relationship: f.relationship
          }));
        }
      }

      if (hasReferral && formData.referrerId) {
        payload.referrerId = formData.referrerId;
        payload.relationshipToReferrer = formData.relationshipToReferrer || null;
      }

      // Detect mobile device
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const endpoint = isMobile ? '/api/members/register_mobile.php' : '/api/members/register.php';
      
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      // Check response status first before parsing JSON
      if (response.status === 201) {
        // Registration successful
        setMessage({ type: 'success', text: 'Registration successful!' });
        setNotificationMessage('Registration successful! Please verify your email from the link we sent, then wait for admin approval.');
        setShowNotification(true);

        setTimeout(() => {
          navigate('/login');
        }, 2000);
        return;
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        throw new Error('Server returned invalid response. Please try again.');
      }

      if (response.ok) {
        setMessage({ type: 'success', text: 'Registration successful!' });
        setNotificationMessage('Registration successful! Please verify your email from the link we sent, then wait for admin approval.');
        setShowNotification(true);

        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to submit registration. Please try again.' });
      }
    } catch (error) {
      // For mobile devices, if it's a CORS/fetch error but registration might have succeeded
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      if (isMobile && (error.message.includes('Failed to fetch') || error.message.includes('CORS'))) {
        // On mobile, CORS errors often occur even when registration succeeds
        // Show success message and let user proceed
        setMessage({ type: 'success', text: 'Registration submitted! Please check with admin for approval status.' });
        setNotificationMessage('Registration submitted! Please verify your email from the link we sent, then wait for admin approval.');
        setShowNotification(true);

        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else {
        setMessage({ type: 'error', text: 'Failed to submit registration. Please try again.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const stepLabels = hasReferral
    ? ['Referrer', 'Personal', 'Contact', 'Address', 'Security']
    : ['Personal', 'Contact', 'Address', 'Security'];

  const togglePasswordVisibility = () => setShowPassword(!showPassword);
  const toggleConfirmPasswordVisibility = () => setShowConfirmPassword(!showConfirmPassword);

  return (
    <div className="register-container">
      {showNotification && (
        <Notification
          message={notificationMessage}
          type="info"
          onClose={() => setShowNotification(false)}
        />
      )}

      {/* ── BLUE TOP BAR ── */}
      <div className="reg-topbar">
        <button
          onClick={activeStep === 1 ? navigateToLogin : goToPrevStep}
          className="reg-topbar-back"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
          </svg>
          Back
        </button>
        <div className="reg-topbar-brand">
          <img src={logoImage} alt="Church Logo" />
          <span>ChurchTrack</span>
        </div>
        <div className="reg-topbar-step">
          {stepLabels[activeStep - 1]}
        </div>
      </div>

      <div className="register-box">

        <div className="register-header">
          <h1>Create Your Account</h1>
        </div>
        <p className="register-description">
          Create an account to access the ChurchTrack system. Your registration will be reviewed by an admin.
        </p>

        <div className="data-notice">
          <div className="data-notice-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
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

        <form onSubmit={handleSubmitRegistration}>
          <div className="registration-steps">
            {/* Step 1: Referrer Information (only for referred registration) */}
            {hasReferral && (
              <div className={`step-content ${activeStep === 1 ? 'active' : ''}`}>
                <div className="step-header">
                  <div className="step-icon-wrap">{StepIcons.referrer}</div>
                  <h2>Referrer Information</h2>
                  <p>Tell us who invited you to join the church.</p>
                </div>

                <div className="referrer-info-note">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <p>A referrer is an existing church member who personally invited or introduced you to Christ-Like Christian Church.</p>
                </div>

                <div className="form-group referrer-group">
                  <label htmlFor="referrerSearch">
                    Search Referrer Name
                    <span className="required-asterisk">*</span>
                  </label>
                  <input
                    type="text"
                    id="referrerSearch"
                    placeholder="Type at least 2 characters to search..."
                    value={formData.referrerName}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, referrerName: e.target.value, referrerId: '' }));
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
                  {/* Selected referrer confirmation */}
                  {formData.referrerId && (
                    <div className="referrer-selected">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      <span>{formData.referrerName} selected as your referrer.</span>
                    </div>
                  )}
                  <p className="field-hint">Search by full name or username. Select from the list to confirm your referrer.</p>
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
                <div className="step-icon-wrap">{StepIcons.personal}</div>
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
                    placeholder="e.g. Dela Cruz"
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
                    placeholder="e.g. Juan"
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
                    placeholder="e.g. Santos"
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
                    Sex
                    <span className="required-asterisk">*</span>
                  </label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
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
                    {formData.birthday && (() => {
                      const birthDate = new Date(formData.birthday);
                      const today = new Date();
                      const age = today.getFullYear() - birthDate.getFullYear();
                      const monthDiff = today.getMonth() - birthDate.getMonth();
                      const dayDiff = today.getDate() - birthDate.getDate();
                      const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;
                      
                      if (actualAge < 12) {
                        return (
                          <div style={{
                            marginTop: '0.5rem',
                            padding: '0.75rem',
                            backgroundColor: '#fef3c7',
                            color: '#b45309',
                            borderRadius: '6px',
                            fontSize: '0.875rem',
                            fontWeight: '500'
                          }}>
                            ℹ️ Self-registration is only available for ages 12 and above. If you're under 12, please ask an admin to create your account.
                          </div>
                        );
                      }
                      return null;
                    })()}
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
                <div className="step-icon-wrap">{StepIcons.contact}</div>
                <h2 className="step-title">Contact Information</h2>
                <p className="step-subtitle">How can we reach you?</p>
              </div>
              <div className="form-groups">
                <div className="form-group">
                  <label>Email Address <span className="required-asterisk">*</span></label>
                  <input
                    type="email"
                    name="email"
                    placeholder="your.email@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                    className={
                      emailAvailable === false
                        ? 'input-error'
                        : emailAvailable === true
                          ? 'input-success'
                          : ''
                    }
                  />
                  {(() => {
                    if (formData.birthday) {
                      const birthDate = new Date(formData.birthday);
                      const today = new Date();
                      const age = today.getFullYear() - birthDate.getFullYear();
                      const monthDiff = today.getMonth() - birthDate.getMonth();
                      const dayDiff = today.getDate() - birthDate.getDate();
                      const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;
                      
                      if (actualAge >= 12 && actualAge < 18) {
                        return (
                          <div style={{
                            marginTop: '0.5rem',
                            padding: '0.75rem',
                            backgroundColor: '#dbeafe',
                            color: '#1d4ed8',
                            borderRadius: '6px',
                            fontSize: '0.875rem',
                            fontWeight: '500'
                          }}>
                            💡 Please enter your parent's or guardian's email address
                          </div>
                        );
                      }
                    }
                    return null;
                  })()}
                  {checkingEmail && (
                    <div className="field-message info">
                      Checking email availability...
                    </div>
                  )}
                  {!checkingEmail && emailCheckMessage && (
                    <div className={`field-message ${emailAvailable === true ? 'success' : emailAvailable === false ? 'error' : 'info'}`}>
                      {emailCheckMessage}
                    </div>
                  )}
                </div>


                <div className="form-group">
                  <label>
                    Contact Number <span style={{ color: '#94a3b8', fontWeight: 500 }}>(optional)</span>
                  </label>
                  <div className="phone-input-container">
                    <span className="phone-prefix">09</span>
                    <input
                      type="tel"
                      name="contactNumber"
                      placeholder="XX XXX XXXX"
                      value={formData.contactNumber.startsWith('09') ? formData.contactNumber.slice(2) : formData.contactNumber}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 9);
                        handleChange({ target: { name: 'contactNumber', value: '09' + value } });
                      }}
                      disabled={isLoading}
                      inputMode="numeric"
                      minLength={9}
                      maxLength={9}
                      title="Enter the remaining 9 digits of your Philippine mobile number"
                    />
                  </div>
                  {formData.contactNumber && formData.contactNumber.length !== 11 && (
                    <div className="field-message error">
                      Please enter a complete 11-digit mobile number
                    </div>
                  )}
                </div>
              </div>

              {/* Guardian Information Section - Only show if age is 17 and below */}
              {parseInt(formData.age) <= 17 && (
                <div className="guardian-section">
                  <div className="step-header">
                    <div className="step-icon-wrap">{StepIcons.guardian}</div>
                    <h2 className="step-title">Guardian Information</h2>
                    <p className="step-subtitle">Please provide your guardian's details</p>
                  </div>
                  
                  {guardianFound && (
                    <div className="success-message" style={{ marginBottom: '20px' }}>
                      <svg className="message-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 2 6"/>
                      </svg>
                      Guardian information found and auto-filled!
                    </div>
                  )}
                  
                  <div className="form-groups">
                    <div className="form-group">
                      <label>
                      Guardian Surname
                      <span className="required-asterisk">*</span>
                    </label>
                      <input
                        type="text"
                        name="guardianSurname"
                        placeholder="e.g. Dela Cruz"
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
                        placeholder="e.g. Maria"
                        value={formData.guardianFirstName}
                        onChange={handleChange}
                        required
                        disabled={isLoading}
                      />
                    </div>
                    
                    <div className="form-group">
                      <label>Guardian Middle Name (optional)</label>
                      <input
                        type="text"
                        name="guardianMiddleName"
                        placeholder="e.g. Santos"
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

                    {!guardianFound && (
                      <div className="form-group family-registration-links">
                        <label>Link church members to your family circle (optional)</label>
                        <p className="field-hint">
                          If a parent or sibling already has an account, you can link them now. Skip this if no one in your household is registered yet.
                        </p>
                        <div className="form-group referrer-group">
                          <input
                            type="text"
                            placeholder="Search by name or email..."
                            value={familyLinkSearch}
                            onChange={(e) => setFamilyLinkSearch(e.target.value)}
                            onFocus={() => {
                              if (familyLinkResults.length > 0) setShowFamilyLinkResults(true);
                            }}
                            disabled={isLoading || familyLinks.length >= 5}
                            autoComplete="off"
                          />
                          {searchingFamilyLink && (
                            <div className="searching-indicator">Searching...</div>
                          )}
                          {showFamilyLinkResults &&
                            familyLinkResults.filter((m) => !familyLinks.some((f) => f.id === m.id))
                              .length > 0 && (
                              <div className="search-results">
                                {familyLinkResults
                                  .filter((m) => !familyLinks.some((f) => f.id === m.id))
                                  .map((m) => (
                                    <div
                                      key={m.id}
                                      className="search-result-item"
                                      role="button"
                                      tabIndex={0}
                                      onClick={() => addFamilyMemberLink(m)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                          e.preventDefault();
                                          addFamilyMemberLink(m);
                                        }
                                      }}
                                    >
                                      <div className="referrer-name">{m.full_name || m.name}</div>
                                      {m.email && (
                                        <div className="referrer-username">{m.email}</div>
                                      )}
                                    </div>
                                  ))}
                              </div>
                            )}
                        </div>
                        {familyLinks.length > 0 && (
                          <ul className="family-registration-link-list">
                            {familyLinks.map((fl) => (
                              <li key={fl.id} className="family-registration-link-row">
                                <span className="family-registration-link-name">{fl.name}</span>
                                <select
                                  value={fl.relationship}
                                  onChange={(e) =>
                                    updateFamilyMemberLinkRelationship(fl.id, e.target.value)
                                  }
                                  disabled={isLoading}
                                  aria-label={`Relationship to ${fl.name}`}
                                >
                                  {FAMILY_LINK_RELATIONSHIPS.map((r) => (
                                    <option key={r} value={r}>
                                      {r}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className="family-registration-link-remove"
                                onClick={() => removeFamilyMemberLink(fl.id)}
                                disabled={isLoading}
                              >
                                Remove
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      </div>
                    )}
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
                <div className="step-icon-wrap">{StepIcons.address}</div>
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
                    placeholder="e.g. Phase 2 Blk 48 Lot 43"
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
                    placeholder="e.g. Brgy. Langkiwa"
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
                      placeholder="e.g. Biñan"
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
                      placeholder="e.g. Laguna"
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
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="Filled from city & province when known"
                    value={formData.zipCode}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                  />
                  <p className="field-hint">
                    Enter city and province first — ZIP fills automatically when recognized. You can edit it if needed.
                  </p>
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
                <div className="step-icon-wrap">{StepIcons.security}</div>
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
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                  />
                  {checkingUsername && (
                    <div className="field-message info">
                      Checking username availability...
                    </div>
                  )}
                  {!checkingUsername && usernameCheckMessage && (
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
                      autoComplete="new-password"
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

                <div className="form-group">
                  <label>
                    Confirm password
                    <span className="required-asterisk">*</span>
                  </label>
                  <div className="password-input">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      placeholder="Re-enter your password"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      required
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={toggleConfirmPasswordVisibility}
                      disabled={isLoading}
                    >
                      {showConfirmPassword ? (
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
                  {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                    <div className="field-message error">Passwords do not match</div>
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
        <div className="policy-modal-overlay" onClick={() => setShowTermsModal(false)}>
          <div className="policy-modal" onClick={(e) => e.stopPropagation()}>
            <div className="policy-modal-header">
              <div className="policy-modal-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
              </div>
              <div className="policy-modal-title-wrap">
                <h3>Terms and Conditions</h3>
                <p>ChurchTrack Membership Agreement</p>
              </div>
              <button 
                className="policy-modal-close" 
                onClick={() => setShowTermsModal(false)}
                disabled={isLoading}
              >
                ×
              </button>
            </div>
            
            <div className="policy-modal-body">
              <div className="policy-intro">
                <p>By creating a ChurchTrack account, you acknowledge and agree to the following guidelines for membership and attendance management:</p>
              </div>
              
              <div className="policy-sections">
                <div className="policy-section">
                  <div className="policy-section-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                      <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                  </div>
                  <div className="policy-section-content">
                    <h5>Purpose of the System</h5>
                    <ul>
                      <li>ChurchTrack exists to manage Christ-Like Christian Church membership and attendance.</li>
                      <li>Access is provided to members approved by church leadership.</li>
                    </ul>
                  </div>
                </div>
                
                <div className="policy-section">
                  <div className="policy-section-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                  </div>
                  <div className="policy-section-content">
                    <h5>Accurate Information</h5>
                    <ul>
                      <li>Submit truthful and current personal, contact, and household details.</li>
                      <li>Update your profile promptly when your information changes.</li>
                    </ul>
                  </div>
                </div>
                
                <div className="policy-section">
                  <div className="policy-section-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z"/>
                    </svg>
                  </div>
                  <div className="policy-section-content">
                    <h5>Attendance & Participation</h5>
                    <ul>
                      <li>Worship services and ministry events you attend may be logged for follow-up and care.</li>
                      <li>Attendance insights help pastors plan discipleship, visitation, and resource allocation.</li>
                    </ul>
                  </div>
                </div>
                
                <div className="policy-section">
                  <div className="policy-section-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <path d="M9 12h6"/>
                      <path d="M12 9v6"/>
                    </svg>
                  </div>
                  <div className="policy-section-content">
                    <h5>Responsible Use</h5>
                    <ul>
                      <li>Keep your login credentials private and do not misuse system data.</li>
                      <li>Interact respectfully with church staff and fellow members when using ChurchTrack.</li>
                    </ul>
                  </div>
                </div>
                
                <div className="policy-section">
                  <div className="policy-section-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                      <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                  </div>
                  <div className="policy-section-content">
                    <h5>Reviews & Support</h5>
                    <ul>
                      <li>Administrators may review your account to ensure compliance with these terms.</li>
                      <li>Contact the church office if you need assistance or have questions about your membership record.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="policy-modal-footer">
              <button 
                className="policy-modal-button" 
                onClick={() => setShowTermsModal(false)}
                disabled={isLoading}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Policy Modal */}
      {showPrivacyModal && (
        <div className="policy-modal-overlay" onClick={() => setShowPrivacyModal(false)}>
          <div className="policy-modal privacy-policy-modal" onClick={(e) => e.stopPropagation()}>
            <div className="policy-modal-header">
              <div className="policy-modal-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  <path d="M9 12l2 2 4-4"/>
                </svg>
              </div>
              <div className="policy-modal-title-wrap">
                <h3>Privacy Policy</h3>
                <p>ChurchTrack Privacy Notice</p>
              </div>
              <button 
                className="policy-modal-close" 
                onClick={() => setShowPrivacyModal(false)}
                disabled={isLoading}
              >
                ×
              </button>
            </div>
            
            <div className="policy-modal-body">
              <div className="policy-intro">
                <p>This notice explains how we handle your information for CLCC membership and attendance management:</p>
              </div>
              
              <div className="policy-sections">
                <div className="policy-section">
                  <div className="policy-section-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  </div>
                  <div className="policy-section-content">
                    <h5>Information We Collect</h5>
                    <ul>
                      <li>Profile details such as name, birthday, contact information, and address.</li>
                      <li>Attendance history for worship services and ministry events.</li>
                      <li>Household or guardian information for members under 18.</li>
                      <li>Account credentials used to access the ChurchTrack system.</li>
                    </ul>
                  </div>
                </div>
                
                <div className="policy-section">
                  <div className="policy-section-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3"/>
                      <path d="M12 1v6m0 6v6m4.22-13.22l4.24 4.24M1.54 1.54l4.24 4.24M20.46 20.46l-4.24-4.24M1.54 20.46l4.24-4.24"/>
                    </svg>
                  </div>
                  <div className="policy-section-content">
                    <h5>How We Use Your Information</h5>
                    <ul>
                      <li>To maintain accurate membership and pastoral care records.</li>
                      <li>To monitor attendance and plan follow-ups or ministry support.</li>
                      <li>To send official announcements, reminders, and ministry invitations.</li>
                      <li>To generate internal reports that help improve church programs.</li>
                    </ul>
                  </div>
                </div>
                
                <div className="policy-section">
                  <div className="policy-section-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                    </svg>
                  </div>
                  <div className="policy-section-content">
                    <h5>Information Sharing</h5>
                    <ul>
                      <li>Only authorized pastors, staff, and ministry leaders can view your records.</li>
                      <li>We do not sell or trade personal data with outside organizations.</li>
                      <li>We may share limited data when required by law or for urgent safety concerns.</li>
                    </ul>
                  </div>
                </div>
                
                <div className="policy-section">
                  <div className="policy-section-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </div>
                  <div className="policy-section-content">
                    <h5>Retention & Security</h5>
                    <ul>
                      <li>Data is stored on secured systems with access controls and regular monitoring.</li>
                      <li>We retain records while your membership is active and for a reasonable period afterward.</li>
                      <li>Backups and updates are performed to safeguard against loss or misuse.</li>
                    </ul>
                  </div>
                </div>
                
                <div className="policy-section">
                  <div className="policy-section-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 11l3 3L22 4"/>
                      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                    </svg>
                  </div>
                  <div className="policy-section-content">
                    <h5>Your Choices</h5>
                    <ul>
                      <li>Request to view or update the information we hold about you.</li>
                      <li>Ask for corrections or removal of outdated details, subject to legal obligations.</li>
                      <li>Manage your communication preferences through church administrators.</li>
                    </ul>
                  </div>
                </div>
                
                <div className="policy-section">
                  <div className="policy-section-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                  </div>
                  <div className="policy-section-content">
                    <h5>Contact</h5>
                    <p>For privacy questions or requests, please reach out to the CLCC administrative office.</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="policy-modal-footer">
              <button 
                className="policy-modal-button" 
                onClick={() => setShowPrivacyModal(false)}
                disabled={isLoading}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
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
