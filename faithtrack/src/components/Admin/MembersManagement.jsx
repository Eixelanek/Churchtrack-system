import React, { useState, useEffect, useRef, useMemo } from 'react';
import './MembersManagement.css';
import { fetchFamilyTree } from '../../api/familyTree';

const MANAGER_REVIEW_STORAGE_KEY = 'managerMemberReview';

const computeBackendBaseUrl = () => {
  if (typeof window === 'undefined' || !window.location) {
    return '';
  }

  const { hostname } = window.location;
  
  // For localhost, use http://localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost';
  }
  
  // For network IP addresses, use http://hostname (no port, no https)
  // Backend API is on port 80 (default HTTP) or configured port
  return `http://${hostname}`;
};

const loadManagerReviewMap = () => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(MANAGER_REVIEW_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.error('Failed to parse manager review cache:', error);
    return {};
  }
};

const writeManagerReviewMap = (map) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MANAGER_REVIEW_STORAGE_KEY, JSON.stringify(map));
  } catch (error) {
    console.error('Failed to persist manager review cache:', error);
  }
};

const MembersManagement = ({ dateFormat = 'mm/dd/yyyy', allowMemberMutations = true, reviewScope = 'admin' }) => {
  const backendBaseUrl = useMemo(() => computeBackendBaseUrl(), []);
  
  const isManagerScope = reviewScope === 'manager';
  const canManageGuests = allowMemberMutations && !isManagerScope;
  const [activeTab, setActiveTab] = useState('all_members');
  const [searchQuery, setSearchQuery] = useState('');
  const [birthdayFilter, setBirthdayFilter] = useState('all');
  const [referralFilter, setReferralFilter] = useState('all'); // 'all', 'referred', 'not_referred'
  const [referredMembers, setReferredMembers] = useState({}); // Map of memberId -> array of referred members
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [userToAction, setUserToAction] = useState(null);
  const [newUserCredentials, setNewUserCredentials] = useState(null);
  const [generatePassword, setGeneratePassword] = useState(true);
  const [showConfirmActionSuccess, setShowConfirmActionSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [members, setMembers] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [rejectedRequests, setRejectedRequests] = useState([]);
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [addUserMessage, setAddUserMessage] = useState('');
  const [addUserMessageType, setAddUserMessageType] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [rejectReasonError, setRejectReasonError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({
    surname: '',
    firstName: '',
    username: '',
    email: '',
    birthday: '',
    password: ''
  });
  const [formData, setFormData] = useState({
    surname: '',
    firstName: '',
    middleName: '',
    suffix: 'None',
    username: '',
    email: '',
    birthday: '',
    password: ''
  });
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [usernameCheckMessage, setUsernameCheckMessage] = useState('');
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState(null);
  const [emailCheckMessage, setEmailCheckMessage] = useState('');
  const [expandedMemberId, setExpandedMemberId] = useState(null);
  const [familyMembers, setFamilyMembers] = useState({});
  const [familyLoading, setFamilyLoading] = useState({});
  const [familyErrors, setFamilyErrors] = useState({});
  const [expandedGuestId, setExpandedGuestId] = useState(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [managerModeration, setManagerModeration] = useState(() => loadManagerReviewMap());

  const updateManagerModeration = (updater) => {
    setManagerModeration((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      writeManagerReviewMap(next);
      return next;
    });
  };

  // Fetch referred members for a specific member
  const fetchReferredMembers = async (memberId) => {
    if (referredMembers[memberId]) {
      return; // Already fetched
    }
    
    try {
      const response = await fetch(`${backendBaseUrl}/api/members/get_referred_by.php?referrer_id=${memberId}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        setReferredMembers(prev => ({
          ...prev,
          [memberId]: result.data
        }));
      }
    } catch (error) {
      console.error('Error fetching referred members:', error);
    }
  };

  // Toggle member expand and fetch referred members and family if needed
  const toggleMemberExpand = (member) => {
    if (!member || !member.id) {
      return;
    }

    const memberId = member.id;
    if (expandedMemberId === memberId) {
      setExpandedMemberId(null);
    } else {
      setExpandedMemberId(memberId);
      // Fetch referred members and family when expanding
      fetchReferredMembers(memberId);
      fetchFamilyMembers(member);
    }
  };

  const toggleGuestExpand = (guestId) => {
    setExpandedGuestId((prev) => (prev === guestId ? null : guestId));
  };

  const handleDeleteGuestClick = (guest) => {
    if (!canManageGuests) return;
    setConfirmAction('delete_guest');
    setConfirmMessage(`Delete guest record for ${guest.name}? This cannot be undone.`);
    setUserToAction(guest);
    setShowConfirmModal(true);
  };

  const overlayMouseDownTarget = useRef(null);

  // Mark relevant notifications as read based on active tab
  const markTabNotificationsAsRead = async (tab) => {
    try {
      // Fetch all notifications
      const res = await fetch('http://localhost/api/admin/notifications.php');
      const notifications = await res.json();
      
      // Determine which notification types to mark based on tab
      let notificationTypes = [];
      if (tab === 'pending_requests') {
        notificationTypes = ['pending_request'];
      } else if (tab === 'birthdays') {
        notificationTypes = ['birthday'];
      } else if (tab === 'all_members' || tab === 'inactive' || tab === 'guests') {
        // Mark any member-related notifications
        notificationTypes = ['pending_request', 'birthday'];
      }
      
      // Find unread notifications of the relevant types
      const unreadNotifications = notifications.filter(n => 
        notificationTypes.includes(n.type) && !n.is_read
      );
      
      // Mark each as read
      for (const notification of unreadNotifications) {
        await fetch('http://localhost/api/admin/mark_notification_read.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notification_id: notification.id })
        });
      }
    } catch (error) {
      console.error('Error marking tab notifications as read:', error);
    }
  };

  // Check if notification directed to specific tab
  useEffect(() => {
    if (window.sessionStorage) {
      const tabFromNotification = window.sessionStorage.getItem('activeTab');
      if (tabFromNotification === 'pending_requests') {
        setActiveTab('pending_requests');
        window.sessionStorage.removeItem('activeTab');
      } else if (tabFromNotification === 'birthdays') {
        setActiveTab('birthdays');
        window.sessionStorage.removeItem('activeTab');
      } else if (tabFromNotification === 'birthdays') {
        setActiveTab('birthdays');
        window.sessionStorage.removeItem('activeTab');
      }
    }
  }, []);

  // Mark notifications as read when changing tabs
  useEffect(() => {
    if (activeTab) {
      markTabNotificationsAsRead(activeTab);
    }
  }, [activeTab]);

  // Fetch members from backend with polling
  const fetchData = () => {
    if (!backendBaseUrl) {
      console.warn('Backend base URL not available yet');
      return;
    }

    setLoading(true);
    const pendingScope = isManagerScope ? 'manager' : 'admin';
    const apiBase = `${backendBaseUrl}/api/members`;
    const guestApiBase = `${backendBaseUrl}/api/guest`;

    Promise.all([
      fetch(`${apiBase}/get_all.php`)
        .then(async res => {
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
            throw new Error(errorData.message || `HTTP ${res.status}`);
          }
          return res.json();
        })
        .then(data => ({ status: 'fulfilled', value: data }))
        .catch((error) => {
          console.error('Error fetching members:', error);
          return { status: 'rejected', reason: error };
        }),
      fetch(`${apiBase}/get_pending.php?scope=${pendingScope}`).then(res => res.json()).then(data => ({ status: 'fulfilled', value: data })).catch((error) => ({ status: 'rejected', reason: error })),
      fetch(`${apiBase}/get_rejected.php`).then(res => res.json()).then(data => ({ status: 'fulfilled', value: data })).catch((error) => ({ status: 'rejected', reason: error })),
      fetch(`${guestApiBase}/list.php`).then(res => res.json()).then(data => ({ status: 'fulfilled', value: data })).catch((error) => ({ status: 'rejected', reason: error }))
    ])
      .then(([membersResult, pendingResult, rejectedResult, guestsResult]) => {
        if (membersResult.status === 'rejected') {
          console.error('Failed to fetch members:', membersResult.reason);
        }
        setMembers(membersResult.status === 'fulfilled' && Array.isArray(membersResult.value) ? membersResult.value : []);

        const latestModeration = loadManagerReviewMap();
        if (JSON.stringify(latestModeration) !== JSON.stringify(managerModeration)) {
          updateManagerModeration(latestModeration);
        }

        const pendingData = pendingResult.status === 'fulfilled' && Array.isArray(pendingResult.value)
          ? pendingResult.value.map((item) => {
              const managerDecision = latestModeration[item.id];
              const derivedStatus = managerDecision?.status || item.manager_status || 'pending';
              return {
                ...item,
                manager_status: derivedStatus,
                manager_decision: managerDecision || null
              };
            })
          : [];

        setPendingRequests(pendingData);
        setRejectedRequests(rejectedResult.status === 'fulfilled' && Array.isArray(rejectedResult.value) ? rejectedResult.value : []);
        if (guestsResult.status === 'fulfilled' && guestsResult.value?.success && Array.isArray(guestsResult.value.data)) {
          setGuests(guestsResult.value.data);
        } else {
          setGuests([]);
        }
      })
      .catch((error) => {
        console.error('Failed to fetch member data:', error);
        setMembers([]);
        setPendingRequests([]);
        setRejectedRequests([]);
        setGuests([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let isMounted = true;
    const safeFetch = () => isMounted && fetchData();
    safeFetch(); // Initial fetch
    const interval = setInterval(safeFetch, 2000); // Poll every 2 seconds
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [backendBaseUrl]);

  // Fetch family data for all members when members list changes
  useEffect(() => {
    if (members.length > 0) {
      members.forEach(member => {
        if (member.id && !familyMembers[member.id] && !familyLoading[member.id]) {
          fetchFamilyMembers(member);
        }
      });
    }
  }, [members]);

  // Format date according to the specified format
  const formatDate = (dateString) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    
    switch(dateFormat) {
      case 'dd/mm/yyyy':
        return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
      case 'yyyy-mm-dd':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      case 'mm/dd/yyyy':
      default:
        return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
    }
  };

  // Check if today is someone's birthday
  const isBirthday = (birthdayString) => {
    if (!birthdayString) return false;
    
    const today = new Date();
    const birthday = new Date(birthdayString);
    
    return today.getMonth() === birthday.getMonth() && 
           today.getDate() === birthday.getDate();
  };
  
  // Check if birthday is coming up in the next 7 days
  const isUpcomingBirthday = (birthdayString) => {
    if (!birthdayString) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const birthday = new Date(birthdayString);
    
    // Set birthday to this year
    birthday.setFullYear(today.getFullYear());
    birthday.setHours(0, 0, 0, 0);
    
    // If birthday has already passed this year, set it to next year
    if (birthday < today) {
      birthday.setFullYear(today.getFullYear() + 1);
    }
    
    // Calculate days difference
    const diffTime = birthday.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Return true if birthday is within the next 7 days and not today
    return diffDays > 0 && diffDays <= 7 && !isBirthday(birthdayString);
  };
  
  // Check if birthday was recent (within the last 7 days, not including today)
  const isRecentBirthday = (birthdayString) => {
    if (!birthdayString) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const birthday = new Date(birthdayString);
    
    // Set to this year
    birthday.setFullYear(today.getFullYear());
    birthday.setHours(0, 0, 0, 0);
    
    // If birthday would be in the future this year, it must have been last year
    if (birthday > today) {
      birthday.setFullYear(today.getFullYear() - 1);
    }
    
    // Calculate days difference
    const diffTime = today.getTime() - birthday.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Return true if birthday was within the last 7 days and not today
    return diffDays > 0 && diffDays <= 7 && !isBirthday(birthdayString);
  };
  
  // Format birthday (month and day only)
  const formatBirthdayDisplay = (birthdayString) => {
    if (!birthdayString) return '';
    
    const birthday = new Date(birthdayString);
    const month = birthday.toLocaleString('default', { month: 'short' });
    const day = birthday.getDate();
    
    return `${month} ${day}`;
  };
  
  // Calculate age from birthday
  const calculateAge = (birthdayString) => {
    if (!birthdayString) return '';
    
    const birthday = new Date(birthdayString);
    const today = new Date();
    let age = today.getFullYear() - birthday.getFullYear();
    
    // Adjust age if birthday hasn't occurred yet this year
    const monthDiff = today.getMonth() - birthday.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthday.getDate())) {
      age--;
    }
    
    return age;
  };

  const formatDateTimeDisplay = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Handle sort header click
  const handleSort = (column) => {
    // If clicking the same column, toggle direction
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // If clicking a new column, set it as sort column with ascending direction
      setSortBy(column);
      setSortDirection('asc');
    }
  };

  // Sort function for any collection
  const sortItems = (items) => {
    return [...items].sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      // Handle nulls or undefined values
      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';
      
      // For date fields, convert to Date objects before comparison
      if (sortBy === 'created_at' || sortBy === 'birthday') {
        const dateA = new Date(aValue);
        const dateB = new Date(bValue);
        const comparison = dateA - dateB;
        return sortDirection === 'asc' ? comparison : -comparison;
      }
      
      // String comparison for text fields
      if (typeof aValue === 'string') {
        const comparison = aValue.localeCompare(bValue);
        return sortDirection === 'asc' ? comparison : -comparison;
      }
      
      // Numeric comparison
      const comparison = aValue - bValue;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  };

  // Global search function
  const searchInData = (item) => {
    if (!searchQuery.trim()) return true;
    try {
      const searchLower = searchQuery.toLowerCase();
      return (
        (item.name && item.name.toLowerCase().includes(searchLower)) ||
        (item.email && item.email.toLowerCase().includes(searchLower)) ||
        (item.phone && item.phone.includes(searchQuery)) ||
        (item.rejection_reason && item.rejection_reason.toLowerCase().includes(searchLower))
      );
    } catch (error) {
      console.error('Error searching item:', item, error);
      return false;
    }
  };

  const totalMembersCount = members.length;
  const activeMembersCount = members.filter(member => member.status === 'active').length;
  const inactiveMembers = members.filter(member => member.status === 'inactive');
  const inactiveMembersCount = inactiveMembers.length;
  const guestCount = guests.length;

  // Filter members based on search query and referral filter
  const filteredMembers = members.filter(member => {
    if (!searchInData(member)) return false;
    
    if (referralFilter === 'referred') {
      return member.is_referred === true;
    } else if (referralFilter === 'not_referred') {
      return !member.is_referred || member.is_referred === false;
    }
    
    return true; // 'all' - show all members
  });
  
  // Sort filtered members
  const sortedMembers = sortItems(filteredMembers);

  // Derive inactive list with search applied
  const filteredInactiveMembers = inactiveMembers.filter(searchInData);
  const sortedInactiveMembers = sortItems(filteredInactiveMembers);

  // Filter pending requests based on search query
  const filteredRequests = pendingRequests.filter(searchInData);
  const remapGuest = (guest) => ({
    ...guest,
    name: guest.full_name || guest.first_name || 'Guest',
    email: guest.email,
    phone: guest.contact_number,
    created_at: guest.created_at,
    last_attended: guest.last_attended,
    status: guest.status || 'active'
  });

  const filteredGuestsRaw = guests.map(remapGuest).filter(searchInData);
  const sortedGuests = sortItems(filteredGuestsRaw);
  
  // Sort filtered requests
  const sortedRequests = sortItems(filteredRequests);

  // Filter rejected requests based on search query
  const filteredRejected = rejectedRequests.filter(searchInData);
  
  // Sort filtered rejected requests
  const getRejectionTimestamp = (item) => {
    if (item.manager_status === 'rejected') {
      return item.manager_reviewed_at || item.updated_at || item.created_at || null;
    }
    return item.updated_at || item.created_at || item.manager_reviewed_at || null;
  };

  const sortedRejected = [...filteredRejected].sort((a, b) => {
    const aTime = getRejectionTimestamp(a) ? new Date(getRejectionTimestamp(a)).getTime() : 0;
    const bTime = getRejectionTimestamp(b) ? new Date(getRejectionTimestamp(b)).getTime() : 0;
    return bTime - aTime;
  });

  // Global search results - combine all filtered results
  const globalSearchResults = searchQuery.trim() ? {
    members: filteredMembers,
    inactiveMembers: filteredInactiveMembers,
    pendingRequests: filteredRequests,
    rejectedRequests: filteredRejected,
    guests: filteredGuestsRaw,
    totalResults: filteredMembers.length + filteredInactiveMembers.length + filteredRequests.length + filteredRejected.length + filteredGuestsRaw.length
  } : null;

  // Generate sort icon based on column and current sort state
  const renderSortIcon = (column) => {
    if (sortBy !== column) {
      return <span className="sort-icon">↕</span>;
    }
    return sortDirection === 'asc' 
      ? <span className="sort-icon active asc">↑</span> 
      : <span className="sort-icon active desc">↓</span>;
  };

  // Check for members with birthdays today, upcoming, or recent
  const birthdaysToday = members.filter(member => isBirthday(member.birthday));

  // Get upcoming birthdays and sort them by upcoming date
  const upcomingBirthdays = members
    .filter(member => !isBirthday(member.birthday) && isUpcomingBirthday(member.birthday))
    .sort((a, b) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dateA = new Date(a.birthday);
      const dateB = new Date(b.birthday);
      
      // Set to current year
      dateA.setFullYear(today.getFullYear());
      dateA.setHours(0, 0, 0, 0);
      dateB.setFullYear(today.getFullYear());
      dateB.setHours(0, 0, 0, 0);
      
      // If already passed, set to next year
      if (dateA < today) dateA.setFullYear(today.getFullYear() + 1);
      if (dateB < today) dateB.setFullYear(today.getFullYear() + 1);
      
      // Sort by closest date
      return dateA - dateB;
    });

  // Get recent birthdays and sort them by most recent first
  const recentBirthdays = members
    .filter(member => !isBirthday(member.birthday) && isRecentBirthday(member.birthday))
    .sort((a, b) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dateA = new Date(a.birthday);
      const dateB = new Date(b.birthday);
      
      // Set to current year
      dateA.setFullYear(today.getFullYear());
      dateA.setHours(0, 0, 0, 0);
      dateB.setFullYear(today.getFullYear());
      dateB.setHours(0, 0, 0, 0);
      
      // If would be in future this year, it was last year
      if (dateA > today) dateA.setFullYear(today.getFullYear() - 1);
      if (dateB > today) dateB.setFullYear(today.getFullYear() - 1);
      
      // Sort by most recent first (closest to today)
      return dateB - dateA;
    });

  // Generate random password
  const generateRandomPassword = () => {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
    let password = '';
    
    // Ensure at least one uppercase letter
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.charAt(Math.floor(Math.random() * 26));
    
    // Ensure at least one number
    password += '0123456789'.charAt(Math.floor(Math.random() * 10));
    
    // Ensure at least one special character
    password += '!@#$%^&*()'.charAt(Math.floor(Math.random() * 10));
    
    // Fill the rest with random characters to make it 12 characters long
    for (let i = 0; i < 9; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    // Shuffle the password
    return password.split('').sort(() => 0.5 - Math.random()).join('');
  };

  // Username availability check
  const checkUsernameAvailability = async (username) => {
    if (!username.trim()) {
      setUsernameAvailable(null);
      setUsernameCheckMessage('');
      return;
    }
    setCheckingUsername(true);
    try {
      const res = await fetch(`${backendBaseUrl}/api/members/check_username.php?username=${encodeURIComponent(username)}`);
      const data = await res.json();
      setUsernameAvailable(data.available);
      setUsernameCheckMessage(data.message);
    } catch (err) {
      setUsernameAvailable(null);
      setUsernameCheckMessage('Error checking username');
    }
    setCheckingUsername(false);
  };

  // Email availability check
  const checkEmailAvailability = async (email) => {
    if (!email.trim()) {
      setEmailAvailable(null);
      setEmailCheckMessage('');
      return;
    }
    setCheckingEmail(true);
    try {
      const res = await fetch(`${backendBaseUrl}/api/members/check_email.php?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      setEmailAvailable(data.available);
      setEmailCheckMessage(data.message);
    } catch (err) {
      setEmailAvailable(null);
      setEmailCheckMessage('Error checking email');
    }
    setCheckingEmail(false);
  };

  // Debounced username check
  useEffect(() => {
    if (formData.username.trim() === '') {
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
  }, [formData.username]);

  // Debounced email check
  useEffect(() => {
    if (formData.email.trim() === '') {
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
  }, [formData.email]);

  // Real-time validation functions
  const validateField = (fieldName, value) => {
    let error = '';
    
    switch (fieldName) {
      case 'name':
        if (value.trim() === '') {
          error = 'Name is required';
        } else if (!isValidFullName(value)) {
          error = 'Please enter full name (first and last, letters only, at least 4 characters)';
        }
        break;
      case 'username':
        if (value.trim() === '') {
          error = 'Username is required';
        } else if (usernameAvailable === false) {
          error = 'Username is already taken';
        }
        break;
      case 'email':
        if (value.trim() !== '') {
          if (!/^\S+@\S+\.\S+$/.test(value)) {
            error = 'Please enter a valid email address';
          } else if (emailAvailable === false) {
            error = 'Email is already taken';
          }
        }
        break;
      case 'birthday':
        if (value) {
          const birthDate = new Date(value);
          if (birthDate < minAllowedBirthday || birthDate > maxAllowedBirthday) {
            error = 'Birthday must be between 5 and 120 years ago';
          }
        }
        break;
      case 'password':
        if (!generatePassword && value.length > 0 && value.length < 8) {
          error = 'Password must be at least 8 characters long';
        }
        break;
      default:
        break;
    }
    
    return error;
  };

  const handleFieldChange = (fieldName, value) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
    
    // Clear general error message when user starts typing
    setAddUserMessage('');
    setAddUserMessageType('');
    
    // Debounced validation
    setTimeout(() => {
      const error = validateField(fieldName, value);
      setFieldErrors(prev => ({ ...prev, [fieldName]: error }));
    }, 500);
  };

  const handlePasswordToggle = () => {
    setGeneratePassword(!generatePassword);
    // Clear password error when toggling
    setFieldErrors(prev => ({ ...prev, password: '' }));
  };

  // Add member via backend
  const handleAddUser = (e) => {
    e.preventDefault();
    setAddUserMessage('');
    setAddUserMessageType('');
    
    // Validate all fields
    const surnameError = formData.surname.trim() === '' ? 'Surname is required' : '';
    const firstNameError = formData.firstName.trim() === '' ? 'First name is required' : '';
    const usernameError = validateField('username', formData.username);
    const emailError = validateField('email', formData.email);
    const birthdayError = validateField('birthday', formData.birthday);
    const passwordError = validateField('password', formData.password);
    
    setFieldErrors({
      surname: surnameError,
      firstName: firstNameError,
      username: usernameError,
      email: emailError,
      birthday: birthdayError,
      password: passwordError
    });
    
    // If any field has errors, don't submit
    if (surnameError || firstNameError || usernameError || emailError || birthdayError || passwordError) {
      setAddUserMessage('Please fix the errors above before creating the member');
      setAddUserMessageType('error');
      return;
    }
    
    const surname = formData.surname;
    const firstName = formData.firstName;
    const middleName = formData.middleName || '';
    const suffix = formData.suffix || 'None';
    const username = formData.username;
    const email = formData.email || '';
    const birthday = formData.birthday || null;
    let password = formData.password;
    if (generatePassword || !password) {
      password = generateRandomPassword();
    }
    
    const fullName = `${firstName} ${middleName} ${surname} ${suffix !== 'None' ? suffix : ''}`.replace(/\s+/g, ' ').trim();
    
    fetch(`${backendBaseUrl}/api/members/add.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ surname, firstName, middleName, suffix, username, email, birthday, password })
    })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) {
          setAddUserMessage(data.message || 'Failed to add member');
          setAddUserMessageType('error');
          return;
        }
        // Success
        fetchData();
        setShowAddUserModal(false);
        setNewUserCredentials({ name: fullName, username, email, password });
        setShowCredentialsModal(true);
        setAddUserMessage('');
        setAddUserMessageType('');
        setFormData({ surname: '', firstName: '', middleName: '', suffix: 'None', username: '', email: '', birthday: '', password: '' });
        setFieldErrors({ surname: '', firstName: '', username: '', email: '', birthday: '', password: '' });
        setUsernameAvailable(null);
        setUsernameCheckMessage('');
        setEmailAvailable(null);
        setEmailCheckMessage('');
        e.target.reset();
      })
      .catch(() => {
        setAddUserMessage('Failed to add member. Please try again.');
        setAddUserMessageType('error');
      });
    if (birthday) {
      const today = new Date();
      const birthDate = new Date(birthday);
      if (today.getMonth() === birthDate.getMonth() && today.getDate() === birthDate.getDate()) {
        if (window.sessionStorage) {
          window.sessionStorage.setItem('refreshNotifications', 'true');
        }
        const refreshEvent = new CustomEvent('refreshNotifications');
        window.dispatchEvent(refreshEvent);
      }
    }
  };

  // Delete member via backend
  const handleDeleteUser = (user) => {
    setConfirmAction('delete');
    setConfirmMessage(`Are you sure you want to delete ${user.name}'s account? This action cannot be undone.`);
    setUserToAction(user);
    setShowConfirmModal(true);
  };

  // Handle approve request
  const handleApproveRequest = (request) => {
    setConfirmAction('approve');
    setConfirmMessage(
      isManagerScope
        ? `Forward ${request.name}'s registration to admin?`
        : `Are you sure you want to approve ${request.name}'s registration?`
    );
    setUserToAction(request);
    setShowConfirmModal(true);
  };

  // Handle reject request
  const handleRejectRequest = (request) => {
    setConfirmAction('reject');
    setConfirmMessage(
      isManagerScope
        ? `Reject ${request.name}'s registration?`
        : `Are you sure you want to reject ${request.name}'s registration?`
    );
    setUserToAction(request);
    setRejectReason('');
    setRejectReasonError('');
    setShowConfirmModal(true);
  };

  const closeConfirmModal = () => {
    setShowConfirmModal(false);
    setConfirmAction(null);
    setUserToAction(null);
    setRejectReason('');
    setRejectReasonError('');
  };

  const handleConfirmAction = () => {
    if (confirmLoading) return;
    let actionMessage = '';
    if (confirmAction === 'reject') {
      if (!rejectReason.trim()) {
        setRejectReasonError('Please provide a rejection reason.');
        return;
      }
    }

    setShowConfirmModal(false);
    setGlobalLoading(true);
    setConfirmLoading(true);

    const finishAction = (message) => {
      fetchData();
      setConfirmAction(null);
      setUserToAction(null);
      if (message) {
        setSuccessMessage(message);
        setShowConfirmActionSuccess(true);
        setTimeout(() => {
          setShowConfirmActionSuccess(false);
        }, 3000);
      }
      setConfirmLoading(false);
      setGlobalLoading(false);
      setRejectReason('');
      setRejectReasonError('');
    };

    if (isManagerScope && userToAction && (confirmAction === 'approve' || confirmAction === 'reject')) {
      const decisionStatus = confirmAction === 'approve' ? 'approved' : 'rejected';
      const decisionReason = confirmAction === 'reject' ? rejectReason.trim() : undefined;

      fetch(`${backendBaseUrl}/api/members/update_manager_status.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: userToAction.id,
          manager_status: decisionStatus,
          manager_note: decisionReason || null
        })
      })
        .then(res => {
          if (!res.ok) {
            throw new Error('Failed to update manager status');
          }
          return res.json();
        })
        .then(() => {
          updateManagerModeration((prev) => ({
            ...prev,
            [userToAction.id]: {
              status: decisionStatus,
              ...(decisionReason ? { reason: decisionReason } : {}),
              timestamp: new Date().toISOString()
            }
          }));

          const msg = confirmAction === 'approve'
            ? `${userToAction.name}'s request was forwarded to the admin.`
            : `${userToAction.name}'s request was rejected and logged for the admin.`;
          finishAction(msg);
        })
        .catch((error) => {
          console.error('Manager update failed:', error);
          finishAction('Something went wrong. Please try again.');
        });
      return;
    } else if (confirmAction === 'delete' && userToAction) {
      fetch(`${backendBaseUrl}/api/members/delete.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userToAction.id })
      })
        .then(res => res.json())
        .then(() => {
          actionMessage = `${userToAction.name}'s account has been deleted`;
          finishAction(actionMessage);
        })
        .finally(() => {
          if (confirmAction !== 'delete') {
            setConfirmLoading(false);
            setGlobalLoading(false);
            setRejectReason('');
            setRejectReasonError('');
          }
        });
    } else if (confirmAction === 'delete_guest' && userToAction) {
      fetch(`${backendBaseUrl}/api/guest/delete.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userToAction.id })
      })
        .then(res => res.json())
        .then((data) => {
          if (!data.success) {
            throw new Error(data.message || 'Failed to delete guest');
          }
          actionMessage = `${userToAction.name} has been removed from guest records`;
          finishAction(actionMessage);
        })
        .catch((error) => {
          console.error('Guest deletion failed:', error);
          finishAction('Failed to delete guest. Please try again.');
        })
        .finally(() => {
          setConfirmLoading(false);
          setGlobalLoading(false);
        });
    } else if (confirmAction === 'approve' && userToAction) {
      fetch(`${backendBaseUrl}/api/members/update_status.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: userToAction.id,
          status: 'active'
        })
      })
        .then(res => res.json())
        .then(data => {
          actionMessage = `${userToAction.name}'s account has been approved`;
          finishAction(actionMessage);
        })
        .catch(() => {
          finishAction('Failed to approve member. Please try again.');
        });
    } else if (confirmAction === 'reject' && userToAction) {
      fetch(`${backendBaseUrl}/api/members/update_status.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: userToAction.id,
          status: 'rejected',
          reason: rejectReason.trim()
        })
      })
        .then(res => res.json())
        .then(data => {
          actionMessage = `${userToAction.name}'s request has been rejected`;
          finishAction(actionMessage);
        })
        .catch(() => {
          finishAction('Failed to reject member. Please try again.');
        });
    } else {
      finishAction('');
    }
  };

  const handleModalMouseDown = (e) => {
    overlayMouseDownTarget.current = e.target;
  };
  const handleModalClose = (e) => {
    // Check if clicked on overlay (not modal content)
    if (
      e.target.classList.contains('modal-overlay') || 
      e.target.classList.contains('modal-overlay-new')
    ) {
      setShowAddUserModal(false);
      setShowCredentialsModal(false);
      setShowConfirmModal(false);
      setNewUserCredentials(null);
      setAddUserMessage('');
      setAddUserMessageType('');
      setFormData({ surname: '', firstName: '', middleName: '', suffix: 'None', username: '', email: '', birthday: '', password: '' });
      setFieldErrors({ surname: '', firstName: '', username: '', email: '', birthday: '', password: '' });
      setUsernameAvailable(null);
      setUsernameCheckMessage('');
      setEmailAvailable(null);
      setEmailCheckMessage('');
      setRejectReason('');
      setRejectReasonError('');
      setConfirmAction(null);
      setUserToAction(null);
    }
  };

  const handleCopyCredentials = () => {
    if (!newUserCredentials) return;
    
    const text = `=== New Member Account ===

Name: ${newUserCredentials.name}
Username: ${newUserCredentials.username}
Password: ${newUserCredentials.password}
${newUserCredentials.email ? `Email: ${newUserCredentials.email}` : ''}

Please change your password after first login.

---
Christ-Like Christian Church
ChurchTrack System`;
    
    navigator.clipboard.writeText(text.trim())
      .then(() => {
        alert('Credentials copied to clipboard!');
      })
      .catch(err => {
        console.error('Failed to copy credentials: ', err);
      });
  };

  // Validation helpers (copied from Register)
  const isValidFullName = (name) => {
    return /^[A-Za-z][A-Za-z'\- ]+[A-Za-z]$/.test(name.trim()) && name.trim().split(' ').length >= 2 && name.trim().length >= 4;
  };
  const today = new Date();
  const maxAllowedBirthday = new Date(today.getFullYear() - 5, today.getMonth(), today.getDate());
  const minAllowedBirthday = new Date(today.getFullYear() - 120, today.getMonth(), today.getDate());

  // Get initials from name
  const getInitials = (name) => {
    if (!name || typeof name !== 'string') {
      return '??';
    }
    return name
      .trim()
      .split(/\s+/)
      .map((word) => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Get family member count from backend data
  const getFamilyCount = (member) => {
    if (Array.isArray(familyMembers[member.id])) {
      return familyMembers[member.id].length;
    }
    return member.family_count || 0;
  };

  // Fetch family members for a specific member using family tree API
  const fetchFamilyMembers = async (member) => {
    const memberId = member?.id;

    if (!memberId || familyMembers[memberId] || familyLoading[memberId]) {
      return; // Already fetched or currently loading
    }

    setFamilyLoading((prev) => ({ ...prev, [memberId]: true }));
    setFamilyErrors((prev) => ({ ...prev, [memberId]: null }));

    try {
      const response = await fetchFamilyTree(Number(memberId));
      const tree = response?.tree ?? {};

      const transformed = [];

      const appendGroup = (group, fallbackRelation) => {
        if (!Array.isArray(group)) {
          return;
        }

        group.forEach((relative) => {
          if (!relative) {
            return;
          }

          const relation = relative.relation || fallbackRelation || 'Family';
          const name = relative.name || 'Family Member';
          const id = relative.id ?? `${relation}-${name}`;

          transformed.push({
            id,
            full_name: name,
            relationship_type: relation,
            contact_number: relative.contact || relative.phone || null,
            email: relative.email || null,
            initials: getInitials(name),
            photoUrl: relative.photo || relative.avatar || null,
          });
        });
      };

      appendGroup(tree.parents, 'Parent');
      appendGroup(tree.couple, 'Spouse');
      appendGroup(tree.siblings, 'Sibling');
      appendGroup(tree.children, 'Child');
      appendGroup(tree.other, 'Family');

      setFamilyMembers((prev) => ({
        ...prev,
        [memberId]: transformed,
      }));
    } catch (error) {
      console.error('Error fetching family members:', error);
      setFamilyErrors((prev) => ({
        ...prev,
        [memberId]: 'Unable to load family tree right now.',
      }));
      setFamilyMembers((prev) => ({
        ...prev,
        [memberId]: [],
      }));
    } finally {
      setFamilyLoading((prev) => ({
        ...prev,
        [memberId]: false,
      }));
    }
  };


  return (
    <div className="members-management">
      <div className="members-directory-header">
        <div className="header-text">
          <h1>Members Directory</h1>
          <p className="directory-subtitle">View members and their family connections</p>
        </div>
        {allowMemberMutations && (
          <button className="add-member-btn" onClick={() => setShowAddUserModal(true)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="8.5" cy="7" r="4"></circle>
              <line x1="20" y1="8" x2="20" y2="14"></line>
              <line x1="23" y1="11" x2="17" y2="11"></line>
            </svg>
            Add Member
          </button>
        )}
      </div>

      {/* New Stat Cards Row */}
      <div className="members-new-stat-cards">
        <div className="new-stat-card blue">
          <div className="stat-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-number">{totalMembersCount}</div>
            <div className="stat-text">Total Members</div>
          </div>
        </div>
        
        <div className="new-stat-card green">
          <div className="stat-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="8.5" cy="7" r="4"></circle>
              <polyline points="17 11 19 13 23 9"></polyline>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-number">{activeMembersCount}</div>
            <div className="stat-text">Active</div>
          </div>
        </div>
        
        <div className="new-stat-card orange">
          <div className="stat-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-number">{inactiveMembersCount}</div>
            <div className="stat-text">Inactive</div>
          </div>
        </div>
        
        <div className="new-stat-card purple">
          <div className="stat-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="8.5" cy="7" r="4"></circle>
              <line x1="20" y1="8" x2="20" y2="14"></line>
              <line x1="23" y1="11" x2="17" y2="11"></line>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-number">{pendingRequests.length}</div>
            <div className="stat-text">Pending Requests</div>
          </div>
        </div>
      </div>

      {/* Search Bar and Tabs Row */}
      <div className="members-search-tabs-row">
        {/* Search Bar */}
        <div className="members-search-bar">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <input
            type="text"
            placeholder="Search across all tabs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {globalSearchResults && globalSearchResults.totalResults > 0 && (
            <div className="search-results-indicator">
              Found {globalSearchResults.totalResults} result{globalSearchResults.totalResults !== 1 ? 's' : ''}:
              {globalSearchResults.members.length > 0 && ` ${globalSearchResults.members.length} in All Members`}
              {globalSearchResults.pendingRequests.length > 0 && `, ${globalSearchResults.pendingRequests.length} in Requests`}
              {globalSearchResults.rejectedRequests.length > 0 && `, ${globalSearchResults.rejectedRequests.length} in Rejected`}
            </div>
          )}
        </div>

        {/* New Tabs Design */}
        <div className="members-new-tabs">
          <button 
            className={`new-tab ${activeTab === 'all_members' ? 'active' : ''}`}
            onClick={() => setActiveTab('all_members')}
          >
            All Members
          </button>
          <button 
            className={`new-tab ${activeTab === 'inactive' ? 'active' : ''}`}
            onClick={() => setActiveTab('inactive')}
          >
            Inactive
          </button>
          <button 
            className={`new-tab ${activeTab === 'guests' ? 'active' : ''}`}
            onClick={() => setActiveTab('guests')}
          >
            Guests
          </button>
          <button 
            className={`new-tab ${activeTab === 'pending_requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending_requests')}
          >
            Requests
            {pendingRequests.length > 0 && <span className="tab-badge">{pendingRequests.length}</span>}
          </button>
          <button 
            className={`new-tab ${activeTab === 'rejected' ? 'active' : ''}`}
            onClick={() => setActiveTab('rejected')}
          >
            Rejected
          </button>
          <button 
            className={`new-tab ${activeTab === 'birthdays' ? 'active' : ''}`}
            onClick={() => setActiveTab('birthdays')}
          >
            Birthdays
          </button>
        </div>

        {activeTab === 'all_members' && (
          <div className="referral-filter">
            <label htmlFor="referral-filter-select">Filter by Referral:</label>
            <select
              id="referral-filter-select"
              className="referral-filter-select"
              value={referralFilter}
              onChange={(e) => setReferralFilter(e.target.value)}
            >
              <option value="all">All Members</option>
              <option value="referred">Referred Members</option>
              <option value="not_referred">Not Referred</option>
            </select>
          </div>
        )}
      </div>

      <div className="top-controls">
      </div>

      {showConfirmActionSuccess && (
        <div className="success-message">
          {successMessage}
        </div>
      )}

      {activeTab === 'all_members' && (
        <>
          <div className="members-cards-container">
          {sortedMembers.map(member => {
            const familyCount = getFamilyCount(member);
            const isExpanded = expandedMemberId === member.id;
            return (
              <div key={member.id} className={`member-card-wrapper ${isExpanded ? 'expanded' : ''}`}>
                <div className="member-card">
                  <div className="member-avatar" onClick={() => toggleMemberExpand(member)}>
                    {member.profile_picture ? (
                      <img 
                        src={`${window.location.origin}/api/uploads/get_profile_picture.php?path=${member.profile_picture.replace('/uploads/profile_pictures/', '')}`} 
                        alt={member.name} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} 
                        onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.textContent = getInitials(member.name); }}
                      />
                    ) : getInitials(member.name)}
                  </div>
                  <div className="member-details" onClick={() => toggleMemberExpand(member)}>
                    <div className="member-name">{member.name}</div>
                    <div className="member-email">{member.email || 'No email'}</div>
                  </div>
                  <div className="member-badges">
                    <span className={`status-badge-new ${member.status}`}>
                      {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                    </span>
                    {member.is_referred && member.referrer_name && (
                      <span className="referral-badge" title={`Referred by: ${member.referrer_name}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                          <circle cx="8.5" cy="7" r="4"></circle>
                          <path d="M20 8v6M23 11h-6"></path>
                        </svg>
                        Referred
                      </span>
                    )}
                    {member.referral_count > 0 && (
                      <span className="referral-count-badge" title={`Referred ${member.referral_count} member(s)`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                          <circle cx="9" cy="7" r="4"></circle>
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                        {member.referral_count}
                      </span>
                    )}
                    {familyCount > 0 && (
                      <span className="family-badge">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                        </svg>
                        {familyCount} Family
                      </span>
                    )}
                    {allowMemberMutations && (
                      <button 
                        className="delete-member-btn" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteUser(member);
                        }}
                        title="Delete Member"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          <line x1="10" y1="11" x2="10" y2="17"></line>
                          <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="member-details-expanded">
                    <div className="expanded-layout">
                      {/* Left Side - Info Sections */}
                      <div className="info-sections">
                        <div className="details-section">
                          <h4 className="section-header">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M20 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                              <circle cx="8.5" cy="7" r="4"></circle>
                              <path d="M20 8v6M23 11h-6"></path>
                            </svg>
                            Personal Information
                          </h4>
                          <div className="info-item">
                            <span className="info-icon">👤</span>
                            <div>
                              <div className="info-label">Username</div>
                              <div className="info-text">{member.username}</div>
                            </div>
                          </div>
                          {member.birthday && (
                            <div className="info-item">
                              <span className="info-icon">🎂</span>
                              <div>
                                <div className="info-label">Birthday</div>
                                <div className="info-text">{formatDate(member.birthday)} ({calculateAge(member.birthday)} years old)</div>
                              </div>
                            </div>
                          )}
                          {member.is_minor && member.has_guardian && (
                            <div className="info-item">
                              <span className="info-icon">🛡️</span>
                              <div>
                                <div className="info-label">Guardian</div>
                                <div className="info-text">
                                  {member.guardian_full_name}
                                  {member.relationship_to_guardian && (
                                    <span style={{ marginLeft: '0.5rem', color: '#94a3b8' }}>
                                      ({member.relationship_to_guardian})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                          {member.gender && (
                            <div className="info-item">
                              <span className="info-icon">⚧</span>
                              <div>
                                <div className="info-label">Gender</div>
                                <div className="info-text">{member.gender}</div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="details-section">
                          <h4 className="section-header">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                            </svg>
                            Contact Information
                          </h4>
                          <div className="info-item">
                            <span className="info-icon">📧</span>
                            <div>
                              <div className="info-label">Email</div>
                              <div className="info-text">{member.email || 'Not provided'}</div>
                            </div>
                          </div>
                          {member.contact_number && (
                            <div className="info-item">
                              <span className="info-icon">📞</span>
                              <div>
                                <div className="info-label">Phone</div>
                                <div className="info-text">{member.contact_number}</div>
                              </div>
                            </div>
                          )}
                          <div className="info-item">
                            <span className="info-icon">📍</span>
                            <div>
                              <div className="info-label">Address</div>
                              <div className="info-text">{member.address || 'Not provided'}</div>
                            </div>
                          </div>
                        </div>

                        <div className="details-section">
                          <h4 className="section-header">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                              <line x1="16" y1="2" x2="16" y2="6"></line>
                              <line x1="8" y1="2" x2="8" y2="6"></line>
                              <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                            Membership Details
                          </h4>
                          <div className="info-row">
                            <div className="info-col">
                              <div className="info-label">Join Date</div>
                              <div className="info-value">{member.created_at ? formatDate(member.created_at) : 'N/A'}</div>
                            </div>
                            <div className="info-col">
                              <div className="info-label">Status</div>
                              <div className="info-value">{member.status.charAt(0).toUpperCase() + member.status.slice(1)}</div>
                            </div>
                          </div>
                          <div className="info-row">
                            <div className="info-col">
                              <div className="info-label">Last Attended</div>
                              <div className="info-value">{member.last_attended ? formatDate(member.last_attended) : 'Never'}</div>
                            </div>
                            <div className="info-col">
                              <div className="info-label">Total Visits</div>
                              <div className="info-value">{member.total_visits || 0}</div>
                            </div>
                          </div>
                        </div>

                        <div className="details-section">
                          <h4 className="section-header">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                              <circle cx="8.5" cy="7" r="4"></circle>
                              <path d="M20 8v6M23 11h-6"></path>
                            </svg>
                            Referral Information
                          </h4>
                          {member.is_referred && member.referrer_name ? (
                            <>
                              <div className="info-item">
                                <span className="info-icon">👤</span>
                                <div>
                                  <div className="info-label">Referred By</div>
                                  <div className="info-text">
                                    {member.referrer_name}
                                    {!member.referrer_id && (
                                      <span style={{ 
                                        marginLeft: '0.5rem', 
                                        fontSize: '0.8rem', 
                                        color: '#ef4444',
                                        fontStyle: 'italic'
                                      }}>
                                        (Deleted Member)
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {member.relationship_to_referrer && (
                                <div className="info-item">
                                  <span className="info-icon">🔗</span>
                                  <div>
                                    <div className="info-label">Relationship</div>
                                    <div className="info-text">{member.relationship_to_referrer}</div>
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="info-item">
                              <span className="info-icon">ℹ️</span>
                              <div>
                                <div className="info-label">Referral Status</div>
                                <div className="info-text">Not referred</div>
                              </div>
                            </div>
                          )}
                          {member.referral_count > 0 && (
                            <div className="info-item">
                              <span className="info-icon">📊</span>
                              <div>
                                <div className="info-label">Referred Members</div>
                                <div className="info-text">{member.referral_count} member(s)</div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Referred Members Section */}
                        {member.referral_count > 0 && (
                          <div className="details-section">
                            <h4 className="section-header">
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="9" cy="7" r="4"></circle>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                              </svg>
                              Referred Members ({referredMembers[member.id]?.length || member.referral_count})
                            </h4>
                            {referredMembers[member.id] && referredMembers[member.id].length > 0 ? (
                              <div className="referred-members-list">
                                {referredMembers[member.id].map((referred) => (
                                  <div key={referred.id} className="referred-member-item">
                                    <div className="referred-member-avatar">{getInitials(referred.name)}</div>
                                    <div className="referred-member-info">
                                      <div className="referred-member-name">{referred.name}</div>
                                      <div className="referred-member-meta">
                                        <span className={`referred-member-status ${referred.status}`}>
                                          {referred.status.charAt(0).toUpperCase() + referred.status.slice(1)}
                                        </span>
                                        {referred.relationship_to_referrer && (
                                          <span className="referred-member-relationship">
                                            • {referred.relationship_to_referrer}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="no-referred-message">
                                <p>Loading referred members...</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Right Side - Family Tree */}
                      <div className="family-tree-section">
                        <div className="family-circle-section">
                          <h4 className="section-header">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                            </svg>
                            Family Tree {familyCount > 0 && `(${familyCount} ${familyCount === 1 ? 'Member' : 'Members'})`}
                          </h4>
                          
                          {familyLoading[member.id] ? (
                            <div className="family-loading">
                              <p>Loading family tree...</p>
                            </div>
                          ) : familyErrors[member.id] ? (
                            <div className="family-error">
                              <p>Error loading family tree</p>
                            </div>
                          ) : familyCount > 0 ? (
                            <div className="family-tree-visual-admin">
                              <div className="family-tree-graph">
                                {/* Parents Row */}
                                {familyMembers[member.id] && familyMembers[member.id].filter(f => f.relationship_type === 'Father' || f.relationship_type === 'Mother').length > 0 && (
                                  <div className="tree-row">
                                    {familyMembers[member.id].filter(f => f.relationship_type === 'Father' || f.relationship_type === 'Mother').map((familyMember) => (
                                      <div key={familyMember.id} className="family-tree-node">
                                        <div className="node-avatar">{getInitials(familyMember.full_name)}</div>
                                        <div className="node-text">
                                          <span className="node-label">{familyMember.relationship_type}</span>
                                          <span className="node-name">{familyMember.full_name}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                
                                {/* Connector */}
                                {familyMembers[member.id] && familyMembers[member.id].filter(f => f.relationship_type === 'Father' || f.relationship_type === 'Mother').length > 0 && (
                                  <div className="tree-connector vertical" />
                                )}
                                
                                {/* Couple Row (Member + Spouse) */}
                                <div className="tree-row couple">
                                  <div className="family-tree-node highlight">
                                    <div className="node-avatar">{getInitials(member.name)}</div>
                                    <div className="node-text">
                                      <span className="node-label">Member</span>
                                      <span className="node-name">{member.name}</span>
                                    </div>
                                  </div>
                                  {familyMembers[member.id] && familyMembers[member.id].filter(f => f.relationship_type === 'Spouse').map((familyMember) => (
                                    <div key={familyMember.id} className="family-tree-node">
                                      <div className="node-avatar">{getInitials(familyMember.full_name)}</div>
                                      <div className="node-text">
                                        <span className="node-label">Spouse</span>
                                        <span className="node-name">{familyMember.full_name}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                
                                {/* Siblings Row */}
                                {familyMembers[member.id] && familyMembers[member.id].filter(f => f.relationship_type === 'Brother' || f.relationship_type === 'Sister').length > 0 && (
                                  <>
                                    <div className="tree-connector vertical" />
                                    <div className="tree-row">
                                      {familyMembers[member.id].filter(f => f.relationship_type === 'Brother' || f.relationship_type === 'Sister').map((familyMember) => (
                                        <div key={familyMember.id} className="family-tree-node">
                                          <div className="node-avatar">{getInitials(familyMember.full_name)}</div>
                                          <div className="node-text">
                                            <span className="node-label">{familyMember.relationship_type}</span>
                                            <span className="node-name">{familyMember.full_name}</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </>
                                )}
                                
                                {/* Children Row */}
                                {familyMembers[member.id] && familyMembers[member.id].filter(f => f.relationship_type === 'Son' || f.relationship_type === 'Daughter').length > 0 && (
                                  <>
                                    <div className="tree-connector vertical" />
                                    <div className="tree-row">
                                      {familyMembers[member.id].filter(f => f.relationship_type === 'Son' || f.relationship_type === 'Daughter').map((familyMember) => (
                                        <div key={familyMember.id} className="family-tree-node">
                                          <div className="node-avatar">{getInitials(familyMember.full_name)}</div>
                                          <div className="node-text">
                                            <span className="node-label">{familyMember.relationship_type}</span>
                                            <span className="node-name">{familyMember.full_name}</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="no-family-message">
                              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="9" cy="7" r="4"></circle>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                              </svg>
                              <p>No family members added yet</p>
                              <span>Family members can be added later</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {sortedMembers.length === 0 && (
            <div className="empty-state">
              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              <h3>No Members Found</h3>
              <p>{searchQuery ? 'Try adjusting your search query' : 'No active members in the system'}</p>
            </div>
          )}
          </div>
        </>
      )}

      {activeTab === 'inactive' && (
        <>
          {sortedInactiveMembers.length === 0 ? (
            <div className="members-cards-container">
              <div className="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                </svg>
                <h3>No Inactive Members</h3>
                <p>Members who haven't attended for 4 consecutive Sundays will appear here</p>
              </div>
            </div>
          ) : (
            <div className="members-cards-container">
              {sortedInactiveMembers.map(member => {
                const familyCount = getFamilyCount(member);
                const isExpanded = expandedMemberId === member.id;
                return (
                  <div key={member.id} className={`member-card-wrapper ${isExpanded ? 'expanded' : ''}`}>
                    <div className="member-card">
                      <div className="member-avatar" onClick={() => toggleMemberExpand(member)}>
                        {member.profile_picture ? (
                          <img 
                            src={`${window.location.origin}/api/uploads/get_profile_picture.php?path=${member.profile_picture.replace('/uploads/profile_pictures/', '')}`} 
                            alt={member.name} 
                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} 
                            onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.textContent = getInitials(member.name); }}
                          />
                        ) : getInitials(member.name)}
                      </div>
                      <div className="member-details" onClick={() => toggleMemberExpand(member)}>
                        <div className="member-name">{member.name}</div>
                        <div className="member-email">{member.email || 'No email'}</div>
                      </div>
                      <div className="member-badges">
                        <span className="status-badge-new inactive">Inactive</span>
                        {member.is_referred && member.referrer_name && (
                          <span className="referral-badge" title={`Referred by: ${member.referrer_name}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                              <circle cx="8.5" cy="7" r="4"></circle>
                              <path d="M20 8v6M23 11h-6"></path>
                            </svg>
                            Referred
                          </span>
                        )}
                        {member.referral_count > 0 && (
                          <span className="referral-count-badge" title={`Referred ${member.referral_count} member(s)`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                              <circle cx="9" cy="7" r="4"></circle>
                              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                            </svg>
                            {member.referral_count}
                          </span>
                        )}
                        {familyCount > 0 && (
                          <span className="family-badge">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                            </svg>
                            {familyCount} Family
                          </span>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="member-details-expanded">
                        <div className="expanded-layout">
                          <div className="info-sections">
                            <div className="details-section">
                              <h4 className="section-header">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M20 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                  <circle cx="8.5" cy="7" r="4"></circle>
                                  <path d="M20 8v6M23 11h-6"></path>
                                </svg>
                                Personal Information
                              </h4>
                              <div className="info-item">
                                <span className="info-icon">👤</span>
                                <div>
                                  <div className="info-label">Username</div>
                                  <div className="info-text">{member.username}</div>
                                </div>
                              </div>
                              <div className="info-item">
                                <span className="info-icon">📧</span>
                                <div>
                                  <div className="info-label">Email</div>
                                  <div className="info-text">{member.email || 'No email provided'}</div>
                                </div>
                              </div>
                              <div className="info-item">
                                <span className="info-icon">📍</span>
                                <div>
                                  <div className="info-label">Address</div>
                                  <div className="info-text">{member.address}</div>
                                </div>
                              </div>
                              <div className="info-item">
                                <span className="info-icon">📅</span>
                                <div>
                                  <div className="info-label">Joined</div>
                                  <div className="info-text">{formatDate(member.created_at)}</div>
                                </div>
                              </div>
                            </div>

                            {typeof renderFamilySection === 'function' && renderFamilySection(member, familyCount)}
                            {typeof renderReferredMembersSection === 'function' && renderReferredMembersSection(member)}
                          </div>

                          <div className="expanded-actions">
                            <div className="member-status-indicator inactive">
                              <span className="status-dot"></span>
                              Inactive Member
                            </div>
                            <button
                              className="primary-action"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleConfirmAction('activate', member);
                              }}
                            >
                              Reinstate Member
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === 'guests' && (
        <div className="members-cards-container">
          {sortedGuests.length > 0 ? (
            sortedGuests.map((guest) => {
              const membershipRemaining = Number.isFinite(guest.remaining_for_membership)
                ? guest.remaining_for_membership
              : null;
              const statusLabel = guest.status ? guest.status.charAt(0).toUpperCase() + guest.status.slice(1) : 'Active';
              const isExpanded = expandedGuestId === guest.id;
              return (
                <div key={guest.id || guest.full_name} className={`member-card-wrapper ${isExpanded ? 'expanded' : ''}`}>
                  <div className="member-card guest-card" onClick={() => toggleGuestExpand(guest.id)}>
                    <div className="member-avatar guest">
                      {getInitials(guest.name)}
                    </div>
                    <div className="member-details">
                      <div className="member-name">{guest.name}</div>
                      <div className="member-email">{guest.email || 'No email provided'}</div>
                    </div>
                    <div className="member-badges">
                      <span className={`status-badge-new ${guest.status || 'active'} guest`}>
                        {statusLabel}
                      </span>
                      <span className="guest-visit-badge">
                        Visits: {guest.total_visits || 0}
                      </span>
                      {canManageGuests && (
                        <button
                          type="button"
                          className="delete-member-btn guest"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteGuestClick(guest);
                          }}
                          title="Delete Guest"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="guest-details-expanded">
                      <div className="guest-expanded-row">
                        <div className="guest-expanded-info">
                          <div className="guest-info-item">
                            <span className="guest-info-label">Contact Number</span>
                            <span className="guest-info-value">{guest.phone || 'Not provided'}</span>
                          </div>
                          <div className="guest-info-item">
                            <span className="guest-info-label">Invited By</span>
                            <span className="guest-info-value">{guest.invited_by_name || guest.invited_by_text || '—'}</span>
                          </div>
                          <div className="guest-info-item">
                            <span className="guest-info-label">First Visit</span>
                            <span className="guest-info-value">{guest.first_visit_date ? formatDate(guest.first_visit_date) : '—'}</span>
                          </div>
                          <div className="guest-info-item">
                            <span className="guest-info-label">Last Visit</span>
                            <span className="guest-info-value">{formatDateTimeDisplay(guest.last_attended)}</span>
                          </div>
                        </div>
                        <div className="guest-expanded-stats">
                          <div className="guest-stat">
                            <span className="guest-stat-label">Sunday Streak</span>
                            <span className="guest-stat-value">{guest.sunday_visit_count || 0}</span>
                          </div>
                          {membershipRemaining !== null && (
                            <div className="guest-stat">
                              <span className="guest-stat-label">Until Membership</span>
                              <span className="guest-stat-value">
                                {membershipRemaining === 0 ? 'Completed' : `${membershipRemaining} more`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="empty-state">
              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="8.5" cy="7" r="4"></circle>
                <polyline points="17 11 19 13 23 9"></polyline>
              </svg>
              <h3>No Guest Members</h3>
              <p>Guest members and visitors will be listed here</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'rejected' && (
        <div className="members-cards-container">
          {sortedRejected.map(request => {
            const rejectedByManager = request.manager_status === 'rejected';
            const rejectedLabel = rejectedByManager ? 'Rejected by Manager' : 'Rejected by Admin';
            const reviewerTimestamp = request.manager_reviewed_at && rejectedByManager
              ? new Date(request.manager_reviewed_at).toLocaleString()
              : request.updated_at
                ? new Date(request.updated_at).toLocaleString()
                : null;

            return (
            <div key={request.id} className="member-card">
              <div className="member-avatar rejected">
                {getInitials(request.name)}
              </div>
              <div className="member-details">
                <div className="member-name">{request.name}</div>
                <div className="member-email">{request.email || 'No email'}</div>
                {request.rejection_reason && (
                  <div className="member-reason" style={{ marginTop: '0.4rem', color: '#ef4444', fontWeight: 600 }}>
                    Reason: <span style={{ fontWeight: 500, color: '#991b1b' }}>{request.rejection_reason}</span>
                  </div>
                )}
                <div className="member-meta" style={{ marginTop: '0.25rem', fontSize: '0.85rem', color: '#475569' }}>
                  {rejectedLabel}
                  {reviewerTimestamp && (
                    <span style={{ color: '#64748b', marginLeft: '0.35rem' }}>
                      • {reviewerTimestamp}
                    </span>
                  )}
                </div>
              </div>
              <div className="member-badges">
                <span className="status-badge-new rejected">
                  Rejected
                </span>
                <button 
                  className="delete-member-btn" 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteUser(request);
                  }}
                  title="Delete Request"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                </button>
              </div>
            </div>
          );})}
          {sortedRejected.length === 0 && (
            <div className="empty-state">
              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
              <h3>No Rejected Requests</h3>
              <p>Rejected membership requests will appear here</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'pending_requests' && (
        <div className="members-cards-container">
          {sortedRequests.map(request => {
            const awaitingManager = request.manager_status !== 'approved';
            const statusNote = !awaitingManager
              ? (isManagerScope ? null : null)
              : (isManagerScope ? null : 'Waiting for manager approval.');
            return (
            <div key={request.id} className="member-card">
              <div className="member-avatar pending">
                {getInitials(request.name)}
              </div>
              <div className="member-details">
                <div className="member-name">{request.name}</div>
                <div className="member-email">{request.email || 'No email'}</div>
                {request.is_referred && request.referrer_name && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#64748b' }}>
                    <span style={{ fontWeight: 500 }}>Referred by:</span> {request.referrer_name}
                    {!request.referrer_id && (
                      <span style={{ marginLeft: '0.5rem', color: '#ef4444', fontStyle: 'italic' }}>
                        (Deleted Member)
                      </span>
                    )}
                    {request.relationship_to_referrer && (
                      <span style={{ marginLeft: '0.5rem', color: '#94a3b8' }}>
                        ({request.relationship_to_referrer})
                      </span>
                    )}
                  </div>
                )}
                {!request.is_referred && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>
                    Not referred
                  </div>
                )}
              </div>
              <div className="request-actions">
                {statusNote && (
                  <div className={`request-status-note ${awaitingManager ? 'pending' : 'forwarded'} ${isManagerScope ? 'manager' : 'admin'}`}>
                    {statusNote}
                  </div>
                )}

                <div className="request-action-buttons">
                  {(!awaitingManager || isManagerScope) && (
                    <>
                      <button 
                        className="request-action-btn approve" 
                        onClick={() => handleApproveRequest(request)}
                        title="Approve Request"
                        disabled={!isManagerScope && awaitingManager}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        Approve
                      </button>
                      <button 
                        className="request-action-btn reject" 
                        onClick={() => handleRejectRequest(request)}
                        title="Reject Request"
                        disabled={!isManagerScope && awaitingManager}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );})}
          {sortedRequests.length === 0 && (
            <div className="empty-state">
              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="8.5" cy="7" r="4"></circle>
                <line x1="20" y1="8" x2="20" y2="14"></line>
                <line x1="23" y1="11" x2="17" y2="11"></line>
              </svg>
              <h3>No Pending Requests</h3>
              <p>New membership requests will appear here for approval</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'birthdays' && (
        <div className="birthday-tab-content">
          {/* Filter and search the birthday lists */}
          {(() => {
            // Apply search filter to all birthday lists
            const searchFilter = member => 
              searchQuery === '' || 
              member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              (member.email && member.email.toLowerCase().includes(searchQuery.toLowerCase()));
            
            const filteredTodayBirthdays = birthdaysToday.filter(searchFilter);
            const filteredUpcomingBirthdays = upcomingBirthdays.filter(searchFilter);
            const filteredRecentBirthdays = recentBirthdays.filter(searchFilter);
            // NEW: All birthdays (all active members with a birthday), sorted by next occurrence from today
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const currentMonth = today.getMonth();
            const currentDay = today.getDate();
            const filteredAllBirthdays = members
              .filter(member => member.birthday && member.birthday !== '' && searchFilter(member))
              .sort((a, b) => {
                const aDate = new Date(a.birthday);
                const bDate = new Date(b.birthday);
                let aMonthDay = aDate.getMonth() * 100 + aDate.getDate();
                let bMonthDay = bDate.getMonth() * 100 + bDate.getDate();
                let todayMonthDay = currentMonth * 100 + currentDay;
                if (aMonthDay < todayMonthDay) aMonthDay += 1200;
                if (bMonthDay < todayMonthDay) bMonthDay += 1200;
                return aMonthDay - bMonthDay;
              });
            
            // Always show all birthdays (filter removed)
            const showAll = true;
            const showToday = false;
            const showUpcoming = false;
            const showRecent = false;
            
            // Check if there's any data to show after filtering
            const hasAnyData = (
              (showAll && filteredAllBirthdays.length > 0) ||
              (showToday && filteredTodayBirthdays.length > 0) ||
              (showUpcoming && filteredUpcomingBirthdays.length > 0) ||
              (showRecent && filteredRecentBirthdays.length > 0)
            );
            
            return (
              <>
                {/* NEW: All Birthdays Section - Members Card Style */}
                {showAll && filteredAllBirthdays.length > 0 && (
                  <div className="birthday-section">
                    <div className="members-cards-container">
                      {filteredAllBirthdays.map(member => {
                        const initials = member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                        const birthDate = new Date(member.birthday);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const nextBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
                        nextBirthday.setHours(0, 0, 0, 0);
                        if (nextBirthday < today) {
                          nextBirthday.setFullYear(today.getFullYear() + 1);
                        }
                        const diffMs = nextBirthday.getTime() - today.getTime();
                        const daysUntil = Math.round(diffMs / (1000 * 60 * 60 * 24));
                        
                        return (
                          <div key={member.id} className="member-card">
                            <div className="member-avatar">{initials}</div>
                            <div className="member-details">
                              <div className="member-name">{member.name}</div>
                              <div className="member-email">{formatDate(member.birthday)}</div>
                            </div>
                            <div className="member-badges">
                              <span className="status-badge-new active">
                                {daysUntil === 0 ? 'Today!' : `${daysUntil} ${daysUntil === 1 ? 'day' : 'days'}`}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {/* Existing sections for today, upcoming, recent... */}
                {showToday && filteredTodayBirthdays.length > 0 && (
                  <div className="birthday-section">
                    <h3 className="birthday-heading">🎂 Today's Birthdays</h3>
                    <div className="birthday-cards">
                      {filteredTodayBirthdays.map(member => (
                        <div key={member.id} className="birthday-card today">
                          <div className="birthday-card-header">
                            <span className="birthday-emoji">🎂</span>
                            <h4>{member.name}</h4>
                          </div>
                          <div className="birthday-card-info">
                            <p className="birthday-age">{calculateAge(member.birthday)} years old today</p>
                            <p className="birthday-date">Born: {formatDate(member.birthday)}</p>
                            <p className="member-email">{member.email || 'No email'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {showUpcoming && filteredUpcomingBirthdays.length > 0 && (
                  <div className="birthday-section">
                    <h3 className="birthday-heading">🎈 Upcoming Birthdays</h3>
                    <div className="birthday-cards">
                      {filteredUpcomingBirthdays.map(member => (
                        <div key={member.id} className="birthday-card upcoming">
                          <div className="birthday-card-header">
                            <span className="birthday-emoji">🎈</span>
                            <h4>{member.name}</h4>
                          </div>
                          <div className="birthday-card-info">
                            <p className="birthday-date-display">{formatBirthdayDisplay(member.birthday)}</p>
                            <p className="birthday-age">Turning {calculateAge(member.birthday) + 1}</p>
                            <p className="member-email">{member.email || 'No email'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {showRecent && filteredRecentBirthdays.length > 0 && (
                  <div className="birthday-section">
                    <h3 className="birthday-heading">🎊 Recent Celebrants</h3>
                    <div className="birthday-cards">
                      {filteredRecentBirthdays.map(member => (
                        <div key={member.id} className="birthday-card recent">
                          <div className="birthday-card-header">
                            <span className="birthday-emoji">🎊</span>
                            <h4>{member.name}</h4>
                          </div>
                          <div className="birthday-card-info">
                            <p className="birthday-date-display">{formatBirthdayDisplay(member.birthday)}</p>
                            <p className="birthday-age">{calculateAge(member.birthday)} years old</p>
                            <p className="member-email">{member.email || 'No email'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {!hasAnyData && (
                  <div className="no-data-message centered">
                    {searchQuery ? 'No birthdays found for your search' : 'No birthdays to display'}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="modal-overlay-new" onClick={handleModalClose}>
          <div className="modal-content-new" onClick={e => e.stopPropagation()}>
            <div className="modal-header-new">
              <h2>Add New Member</h2>
              <button className="modal-close-btn-new" onClick={() => setShowAddUserModal(false)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            {addUserMessage && (
              <div className={`add-user-message-new ${addUserMessageType}`}>
                {addUserMessage}
              </div>
            )}
            
            <form className="add-member-form" onSubmit={handleAddUser} onChange={() => { setAddUserMessage(''); setAddUserMessageType(''); }}>
              <div className="form-section">
                <h3 className="section-title">Personal Information</h3>
                
                <div className="form-row-two">
                  <div className="form-group-new">
                    <label>Surname <span className="required">*</span></label>
                    <input 
                      type="text" 
                      name="surname" 
                      required 
                      placeholder="e.g., Dela Cruz"
                      value={formData.surname}
                      onChange={(e) => handleFieldChange('surname', e.target.value)}
                      className={fieldErrors.surname ? 'error' : ''}
                    />
                    {fieldErrors.surname && <div className="field-error-new">{fieldErrors.surname}</div>}
                  </div>
                  
                  <div className="form-group-new">
                    <label>First Name <span className="required">*</span></label>
                    <input 
                      type="text" 
                      name="firstName" 
                      required 
                      placeholder="e.g., Juan"
                      value={formData.firstName}
                      onChange={(e) => handleFieldChange('firstName', e.target.value)}
                      className={fieldErrors.firstName ? 'error' : ''}
                    />
                    {fieldErrors.firstName && <div className="field-error-new">{fieldErrors.firstName}</div>}
                  </div>
                </div>

                <div className="form-row-two">
                  <div className="form-group-new">
                    <label>Middle Name</label>
                    <input 
                      type="text" 
                      name="middleName" 
                      placeholder="e.g., Santos"
                      value={formData.middleName}
                      onChange={(e) => handleFieldChange('middleName', e.target.value)}
                    />
                  </div>
                  
                  <div className="form-group-new">
                    <label>Suffix</label>
                    <select 
                      name="suffix"
                      value={formData.suffix}
                      onChange={(e) => handleFieldChange('suffix', e.target.value)}
                    >
                      <option value="None">None</option>
                      <option value="Jr.">Jr.</option>
                      <option value="Sr.">Sr.</option>
                      <option value="II">II</option>
                      <option value="III">III</option>
                      <option value="IV">IV</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group-new">
                    <label>Birthday <span className="required">*</span></label>
                    <input 
                      type="date" 
                      name="birthday" 
                      min={minAllowedBirthday.toISOString().split('T')[0]}
                      max={maxAllowedBirthday.toISOString().split('T')[0]}
                      value={formData.birthday}
                      onChange={(e) => handleFieldChange('birthday', e.target.value)}
                      className={fieldErrors.birthday ? 'error' : ''}
                    />
                    {fieldErrors.birthday && <div className="field-error-new">{fieldErrors.birthday}</div>}
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3 className="section-title">Contact Information</h3>
                
                <div className="form-row">
                  <div className="form-group-new">
                    <label>Email Address</label>
                    <input 
                      type="email" 
                      name="email" 
                      placeholder="email@example.com"
                      value={formData.email}
                      onChange={(e) => handleFieldChange('email', e.target.value)}
                      className={fieldErrors.email ? 'error' : ''}
                    />
                    {checkingEmail && <div className="field-status-new checking">Checking...</div>}
                    {!checkingEmail && emailAvailable === true && <div className="field-status-new available">✓ Available</div>}
                    {!checkingEmail && emailAvailable === false && <div className="field-status-new unavailable">✗ Already taken</div>}
                    {fieldErrors.email && <div className="field-error-new">{fieldErrors.email}</div>}
                    <small className="field-hint">Optional - Leave blank to send credentials manually</small>
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3 className="section-title">Account Security</h3>
                
                <div className="form-row">
                  <div className="form-group-new">
                    <label>Username <span className="required">*</span></label>
                    <input 
                      type="text" 
                      name="username" 
                      required 
                      placeholder="Choose a username"
                      value={formData.username}
                      onChange={(e) => handleFieldChange('username', e.target.value)}
                      className={fieldErrors.username ? 'error' : ''}
                    />
                    {checkingUsername && <div className="field-status-new checking">Checking...</div>}
                    {!checkingUsername && usernameAvailable === true && <div className="field-status-new available">✓ Available</div>}
                    {!checkingUsername && usernameAvailable === false && <div className="field-status-new unavailable">✗ Already taken</div>}
                    {fieldErrors.username && <div className="field-error-new">{fieldErrors.username}</div>}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group-new">
                    <div className="password-header-new">
                      <label>Password <span className="required">*</span></label>
                      <label className="checkbox-label-new">
                        <input 
                          type="checkbox"
                          checked={generatePassword}
                          onChange={handlePasswordToggle}
                        />
                        <span>Auto-generate secure password</span>
                      </label>
                    </div>
                    <input 
                      type="text" 
                      name="password" 
                      placeholder={generatePassword ? "Will be auto-generated" : "Enter password (min. 8 characters)"}
                      disabled={generatePassword}
                      value={formData.password}
                      onChange={(e) => handleFieldChange('password', e.target.value)}
                      className={fieldErrors.password ? 'error' : ''}
                    />
                    {fieldErrors.password && <div className="field-error-new">{fieldErrors.password}</div>}
                  </div>
                </div>
              </div>

              <div className="modal-actions-new">
                <button 
                  type="button" 
                  className="btn-cancel-new"
                  onClick={() => setShowAddUserModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-submit-new">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="8.5" cy="7" r="4"></circle>
                    <line x1="20" y1="8" x2="20" y2="14"></line>
                    <line x1="23" y1="11" x2="17" y2="11"></line>
                  </svg>
                  Create Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credentials Modal */}
      {showCredentialsModal && newUserCredentials && (
        <div className="modal-overlay" onClick={handleModalClose}>
          <div className="modal-content credentials-modal" onClick={e => e.stopPropagation()}>
            <div className="credentials-header">
              <h3>Member Created Successfully</h3>
              <div className="success-icon">✅</div>
            </div>
            <div className="credentials-content">
              <div className="credential-item">
                <span className="credential-label">Name:</span>
                <span className="credential-value">{newUserCredentials.name}</span>
              </div>
              <div className="credential-item">
                <span className="credential-label">Username:</span>
                <span className="credential-value">{newUserCredentials.username}</span>
              </div>
              <div className="credential-item password-item">
                <span className="credential-label">Temporary Password:</span>
                <span className="credential-value">{newUserCredentials.password}</span>
              </div>
              {!newUserCredentials.email && (
                <div className="credentials-warning">
                  ⚠️ No email provided. Please send credentials manually.
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button 
                className="copy-btn" 
                onClick={handleCopyCredentials}
              >
                Copy to Clipboard
              </button>
              <button 
                onClick={() => {
                  setShowCredentialsModal(false);
                  setNewUserCredentials(null);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="modal-overlay" onClick={handleModalClose}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()} style={{ minHeight: '220px', minWidth: '360px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1rem' }}>
            <div className="confirm-header">
              <h3>Confirm Action</h3>
            </div>
            <div className="confirm-content" style={{ width: '100%', textAlign: 'center' }}>
              <p>{confirmMessage}</p>
              {confirmAction === 'reject' && (
                <div style={{ marginTop: '1rem', textAlign: 'left' }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>Rejection Reason <span style={{ color: '#dc2626' }}>*</span></label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => {
                      setRejectReason(e.target.value);
                      if (rejectReasonError) setRejectReasonError('');
                    }}
                    placeholder="Explain why this request is being rejected..."
                    rows={4}
                    style={{ width: '100%', borderRadius: '8px', border: rejectReasonError ? '1px solid #dc2626' : '1px solid #cbd5f5', padding: '0.75rem', resize: 'vertical' }}
                  />
                  {rejectReasonError && (
                    <div style={{ color: '#dc2626', marginTop: '0.4rem', fontSize: '0.85rem' }}>{rejectReasonError}</div>
                  )}
                </div>
              )}
              <div className="confirm-actions" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                <button 
                  className="cancel-btn"
                  onClick={closeConfirmModal}
                  disabled={confirmLoading}
                >
                  Cancel
                </button>
                <button 
                  className="ok-btn"
                  onClick={handleConfirmAction}
                  disabled={confirmLoading}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Global loading spinner overlay */}
      {globalLoading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(255,255,255,0.6)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div className="spinner" style={{ position: 'relative', width: '32px', height: '32px' }}>
            <div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MembersManagement; 