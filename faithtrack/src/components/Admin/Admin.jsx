import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import './Admin.css';
import { useNavigate } from 'react-router-dom';
import logoImage from '../../assets/logo2.png';
import AttendanceManagement from './AttendanceManagement';
import MembersManagement from './MembersManagement';
import { updateFavicon } from '../../utils/churchSettings';
import { API_BASE_URL } from '../../config/api';

const LOGIN_HISTORY_PAGE_SIZE = 5;
const SESSION_PAGE_SIZE = 5;

const TEMP_PASSWORD_STORAGE_KEY = 'adminGeneratedPasswords';

const Admin = () => {
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showProfileView, setShowProfileView] = useState(false);
  const [activeTab, setActiveTab] = useState('account');
  const [previousTab, setPreviousTab] = useState('account');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success'); // success or error
  const [profileData, setProfileData] = useState({
    id: 1,
    firstName: '',
    lastName: '',
    email: '',
    avatar: 'JD',
    role: 'Admin',
    joinedDate: '',
    linkedAccounts: {
      facebook: false,
      tiktok: false,
      youtube: false
    }
  });

  const isAdmin = useMemo(() => (profileData?.role || 'Admin').toLowerCase() === 'admin', [profileData?.role]);

  // Session & login history state
  const [loginHistory, setLoginHistory] = useState([]);
  const [showLoginHistoryModal, setShowLoginHistoryModal] = useState(false);
  const [loginHistoryPage, setLoginHistoryPage] = useState(0);
  const [sessions, setSessions] = useState([]);
  const [showSessionsModal, setShowSessionsModal] = useState(false);
  const [sessionsPage, setSessionsPage] = useState(0);
  const [endingSessionId, setEndingSessionId] = useState(null);
  const [currentSessionId] = useState(() => localStorage.getItem('sessionId'));

  // Notification functionality
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const notificationRef = useRef(null);
  const [passwordResetRequests, setPasswordResetRequests] = useState([]);
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);
  const [passwordResetError, setPasswordResetError] = useState('');
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const [selectedPasswordReset, setSelectedPasswordReset] = useState(null);
  const [isGeneratingTempPassword, setIsGeneratingTempPassword] = useState(false);
  const [generatedTempPassword, setGeneratedTempPassword] = useState(null);
  const [generatedTempExpiry, setGeneratedTempExpiry] = useState(null);
  const [passwordResetModalError, setPasswordResetModalError] = useState('');
  const manageUsersSectionRef = useRef(null);
  const [passwordResetExpiryHours, setPasswordResetExpiryHours] = useState(24);
  const [showAllPasswordResets, setShowAllPasswordResets] = useState(false);
  const [generatedPasswordsMap, setGeneratedPasswordsMap] = useState(() => {
    if (typeof window === 'undefined') return {};
    try {
      const stored = window.sessionStorage.getItem(TEMP_PASSWORD_STORAGE_KEY);
      if (!stored) return {};
      const parsed = JSON.parse(stored);
      const now = new Date();
      return Object.keys(parsed).reduce((acc, key) => {
        const entry = parsed[key];
        if (entry?.expiresAt && new Date(entry.expiresAt) > now && entry.password) {
          acc[key] = entry;
        }
        return acc;
      }, {});
    } catch (error) {
      console.error('Failed to parse stored temp passwords:', error);
      return {};
    }
  });

  const persistGeneratedPasswords = useCallback((map) => {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(TEMP_PASSWORD_STORAGE_KEY, JSON.stringify(map));
    } catch (error) {
      console.error('Failed to persist temp passwords:', error);
    }
  }, []);

  // Load profile data from backend
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const userId = localStorage.getItem('userId') || '1';
        const response = await fetch(`${API_BASE_URL}/api/admin/get_profile.php?admin_id=${userId}`);
        const result = await response.json();
        if (result.success) {
          setProfileData(prev => ({
            ...prev,
            ...result.data
          }));
          setOriginalData(result.data);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      }
    };

    loadProfile();
  }, []);

  useEffect(() => {
    persistGeneratedPasswords(generatedPasswordsMap);
  }, [generatedPasswordsMap, persistGeneratedPasswords]);

  // Load church settings from backend
  useEffect(() => {
    const loadChurchSettings = async () => {
      // First try to load from localStorage for instant display
      const stored = localStorage.getItem('churchSettings');
      if (stored) {
        try {
          const cachedSettings = JSON.parse(stored);
          if (cachedSettings.churchName) setChurchName(cachedSettings.churchName);
          if (cachedSettings.churchAddress) setChurchAddress(cachedSettings.churchAddress);
          if (cachedSettings.churchPhone) setChurchPhone(cachedSettings.churchPhone);
          if (cachedSettings.churchEmail) setChurchEmail(cachedSettings.churchEmail);
          if (cachedSettings.dateFormat) setDateFormat(cachedSettings.dateFormat);
          if (cachedSettings.churchLogo) {
            setChurchLogo(cachedSettings.churchLogo);
            updateFavicon(cachedSettings.churchLogo);
          }
          setHeaderLogo(cachedSettings.headerLogo ?? null);
          setHelpCenterEmail(cachedSettings.helpCenterEmail || '');
          setHelpCenterPhone(cachedSettings.helpCenterPhone || '');
          setHelpCenterUrl(cachedSettings.helpCenterUrl || '');
          setHomepageImage1(cachedSettings.homepage_image_1 ?? null);
          setHomepageImage2(cachedSettings.homepage_image_2 ?? null);
          setHomepageImage3(cachedSettings.homepage_image_3 ?? null);
          setHomepageImage4(cachedSettings.homepage_image_4 ?? null);
          setHomepageImage5(cachedSettings.homepage_image_5 ?? null);
          setHomepageImage6(cachedSettings.homepage_image_6 ?? null);
          setHomepageHeroTitle(cachedSettings.homepage_hero_title || 'SHAPING FUTURES\nWITH FAITH');
          setHomepageHeroSubtitle(cachedSettings.homepage_hero_subtitle || 'Join us for an uplifting experience');
        } catch (error) {
          console.error('Error parsing cached church settings:', error);
        }
      }
      
      // Then fetch from backend to ensure we have the latest
      try {
        const response = await fetch(`${API_BASE_URL}/api/admin/get_church_settings.php`);
        const result = await response.json();
        console.log('Church settings from API:', result);
        if (result.success) {
          setChurchName(result.data.churchName);
          setChurchAddress(result.data.churchAddress || '');
          setChurchPhone(result.data.churchPhone || '');
          setChurchEmail(result.data.churchEmail || '');
          setDateFormat(result.data.dateFormat);
          // Set church logo if it exists, otherwise use default
          if (result.data.churchLogo) {
            console.log('Church logo length:', result.data.churchLogo?.length);
            console.log('Church logo preview:', result.data.churchLogo?.substring(0, 50));
            setChurchLogo(result.data.churchLogo);
            // Update favicon
            updateFavicon(result.data.churchLogo);
          }
          setHeaderLogo(result.data.headerLogo ?? null);
          setHelpCenterEmail(result.data.helpCenterEmail || '');
          setHelpCenterPhone(result.data.helpCenterPhone || '');
          setHelpCenterUrl(result.data.helpCenterUrl || '');
          setHomepageImage1(result.data.homepage_image_1 ?? null);
          setHomepageImage2(result.data.homepage_image_2 ?? null);
          setHomepageImage3(result.data.homepage_image_3 ?? null);
          setHomepageImage4(result.data.homepage_image_4 ?? null);
          setHomepageImage5(result.data.homepage_image_5 ?? null);
          setHomepageImage6(result.data.homepage_image_6 ?? null);
          setHomepageHeroTitle(result.data.homepage_hero_title || 'SHAPING FUTURES\nWITH FAITH');
          setHomepageHeroSubtitle(result.data.homepage_hero_subtitle || 'Join us for an uplifting experience');
          
          // Also save to localStorage
          localStorage.setItem('churchSettings', JSON.stringify(result.data));
          
          // Update originalChurchData with loaded settings
          setOriginalChurchData({
            churchLogo: result.data.churchLogo,
            headerLogo: result.data.headerLogo ?? null,
            churchName: result.data.churchName,
            churchAddress: result.data.churchAddress || '',
            churchPhone: result.data.churchPhone || '',
            churchEmail: result.data.churchEmail || '',
            dateFormat: result.data.dateFormat,
            helpCenterEmail: result.data.helpCenterEmail || '',
            helpCenterPhone: result.data.helpCenterPhone || '',
            helpCenterUrl: result.data.helpCenterUrl || '',
            homepage_image_1: result.data.homepage_image_1 ?? null,
            homepage_image_2: result.data.homepage_image_2 ?? null,
            homepage_image_3: result.data.homepage_image_3 ?? null,
            homepage_image_4: result.data.homepage_image_4 ?? null,
            homepage_image_5: result.data.homepage_image_5 ?? null,
            homepage_image_6: result.data.homepage_image_6 ?? null,
            homepage_hero_title: result.data.homepage_hero_title || 'SHAPING FUTURES\nWITH FAITH',
            homepage_hero_subtitle: result.data.homepage_hero_subtitle || 'Join us for an uplifting experience'
          });
        }
      } catch (error) {
        console.error('Error loading church settings:', error);
      }
    };
    loadChurchSettings();
  }, []);

  // Load login history when security tab is active
  useEffect(() => {
    const loadLoginHistory = async () => {
      if (activeTab === 'security' && showProfileView) {
        try {
          const userId = localStorage.getItem('userId') || '1';
          const response = await fetch(`${API_BASE_URL}/api/admin/get_login_history.php?admin_id=${userId}`);
          const result = await response.json();
          if (result.success) {
            setLoginHistory(result.data);
            setLoginHistoryPage(0);
            setShowLoginHistoryModal(false);
          }
        } catch (error) {
          console.error('Error loading login history:', error);
        }
      }
    };

    loadLoginHistory();
  }, [activeTab, showProfileView]);

  const fetchPasswordResetRequests = useCallback(async () => {
    if (!isAdmin) return;

    setPasswordResetLoading(true);
    setPasswordResetError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/get_password_reset_requests.php?status=all`);
      const result = await response.json();
      if (response.ok && result.success) {
        setPasswordResetRequests(result.data || []);
      } else {
        setPasswordResetError(result.message || 'Failed to load password reset requests.');
        setPasswordResetRequests([]);
      }
    } catch (error) {
      console.error('Error fetching password reset requests:', error);
      setPasswordResetError('Unable to load password reset requests. Please try again.');
      setPasswordResetRequests([]);
    } finally {
      setPasswordResetLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      fetchPasswordResetRequests();
    }
  }, [isAdmin, fetchPasswordResetRequests]);

  const openPasswordResetModal = (request) => {
    setSelectedPasswordReset(request);
    setPasswordResetExpiryHours(24);
    setGeneratedTempPassword(null);
    setGeneratedTempExpiry(null);
    setPasswordResetModalError('');
    const saved = generatedPasswordsMap[request.id];
    if (saved && saved.expiresAt && new Date(saved.expiresAt) > new Date()) {
      setGeneratedTempPassword(saved.password);
      setGeneratedTempExpiry(saved.expiresAt);
    }
    setShowPasswordResetModal(true);
  };

  const closePasswordResetModal = () => {
    setShowPasswordResetModal(false);
    setSelectedPasswordReset(null);
    setIsGeneratingTempPassword(false);
    setGeneratedTempPassword(null);
    setGeneratedTempExpiry(null);
    setPasswordResetModalError('');
  };

  const handleGenerateTemporaryPassword = async () => {
    if (!selectedPasswordReset) return;

    setIsGeneratingTempPassword(true);
    setPasswordResetModalError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/reset_member_password.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          admin_id: profileData.id,
          request_id: selectedPasswordReset.id,
          expires_in_hours: passwordResetExpiryHours
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to generate temporary password.');
      }

      setGeneratedTempPassword(result.temporary_password);
      setGeneratedTempExpiry(result.expires_at);
      setGeneratedPasswordsMap((prev) => {
        const updated = {
          ...prev,
          [selectedPasswordReset.id]: {
            password: result.temporary_password,
            expiresAt: result.expires_at
          }
        };
        persistGeneratedPasswords(updated);
        return updated;
      });
      setSelectedPasswordReset((prev) => prev ? {
        ...prev,
        status: 'completed',
        processed_at: result.expires_at,
        processed_by_admin_id: profileData.id,
        temporary_password_expires_at: result.expires_at
      } : prev);
      setShowToast(true);
      setToastMessage('Temporary password generated successfully.');
      setToastType('success');
      setTimeout(() => setShowToast(false), 3000);

      await fetchPasswordResetRequests();
    } catch (error) {
      console.error('Error generating temporary password:', error);
      setPasswordResetModalError(error.message || 'Unable to generate temporary password.');
      setShowToast(true);
      setToastMessage(error.message || 'Failed to generate temporary password.');
      setToastType('error');
      setTimeout(() => setShowToast(false), 4000);
    } finally {
      setIsGeneratingTempPassword(false);
    }
  };

  const handleCopyTempPassword = async () => {
    if (!generatedTempPassword) {
      return;
    }

    try {
      await navigator.clipboard.writeText(generatedTempPassword);
      setToastMessage('Temporary password copied to clipboard.');
      setToastType('success');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    } catch (error) {
      console.error('Failed to copy temporary password:', error);
      setToastMessage('Unable to copy password automatically.');
      setToastType('error');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  };

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(loginHistory.length / LOGIN_HISTORY_PAGE_SIZE) - 1);
    if (loginHistoryPage > maxPage) {
      setLoginHistoryPage(maxPage);
    }
  }, [loginHistory, loginHistoryPage]);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(sessions.length / SESSION_PAGE_SIZE) - 1);
    if (sessionsPage > maxPage) {
      setSessionsPage(maxPage);
    }
  }, [sessions, sessionsPage]);

  const [originalData, setOriginalData] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const fileInputRef = useRef(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const profileRef = useRef(null);
  const [showSettingsView, setShowSettingsView] = useState(false);
  const [churchLogo, setChurchLogo] = useState(logoImage);
  const [headerLogo, setHeaderLogo] = useState(null);
  const [churchName, setChurchName] = useState('Christ-Like Christian Church');
  const [churchAddress, setChurchAddress] = useState('');
  const [churchPhone, setChurchPhone] = useState('');
  const [churchEmail, setChurchEmail] = useState('');
  const [helpCenterEmail, setHelpCenterEmail] = useState('');
  const [helpCenterPhone, setHelpCenterPhone] = useState('');
  const [helpCenterUrl, setHelpCenterUrl] = useState('');
  const [isMaintenanceRunning, setIsMaintenanceRunning] = useState(false);
  const [maintenanceResult, setMaintenanceResult] = useState(null);
  const [maintenanceError, setMaintenanceError] = useState(null);
  const logoInputRef = useRef(null);
  const headerLogoInputRef = useRef(null);
  const homepageImage1Ref = useRef(null);
  const homepageImage2Ref = useRef(null);
  const homepageImage3Ref = useRef(null);
  const homepageImage4Ref = useRef(null);
  const homepageImage5Ref = useRef(null);
  const homepageImage6Ref = useRef(null);
  const [homepageImage1, setHomepageImage1] = useState(null);
  const [homepageImage2, setHomepageImage2] = useState(null);
  const [homepageImage3, setHomepageImage3] = useState(null);
  const [homepageImage4, setHomepageImage4] = useState(null);
  const [homepageImage5, setHomepageImage5] = useState(null);
  const [homepageImage6, setHomepageImage6] = useState(null);
  const [homepageHeroTitle, setHomepageHeroTitle] = useState('SHAPING FUTURES\nWITH FAITH');
  const [homepageHeroSubtitle, setHomepageHeroSubtitle] = useState('Join us for an uplifting experience');
  const [originalChurchData, setOriginalChurchData] = useState(null);
  const [hasChurchChanges, setHasChurchChanges] = useState(false);
  const [showSettingsSaveModal, setShowSettingsSaveModal] = useState(false);
  const [showSettingsCancelModal, setShowSettingsCancelModal] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [dateFormat, setDateFormat] = useState('mm/dd/yyyy');
  const [showAttendanceView, setShowAttendanceView] = useState(false);
  const [showMembersView, setShowMembersView] = useState(false);
  const [showBirthdayView, setShowBirthdayView] = useState(false);
  const [upcomingServices, setUpcomingServices] = useState([]);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Password change state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const computeTimeAgo = (timestamp) => {
    if (!timestamp) return '';

    let loginDate = new Date(timestamp.replace(' ', 'T'));
    if (Number.isNaN(loginDate.getTime())) {
      loginDate = new Date(timestamp);
    }
    if (Number.isNaN(loginDate.getTime())) {
      return timestamp;
    }

    const now = new Date();
    const diffMs = now - loginDate;

    if (diffMs < 60 * 1000) {
      return 'Just now';
    }

    const diffMinutes = Math.floor(diffMs / (60 * 1000));
    if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    }

    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    }

    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    if (diffDays === 1) {
      return 'Yesterday';
    }
    if (diffDays < 7) {
      return `${diffDays} days ago`;
    }

    return loginDate.toLocaleDateString();
  };

  const totalLoginHistoryPages = Math.max(1, Math.ceil(loginHistory.length / LOGIN_HISTORY_PAGE_SIZE));
  const totalSessionsPages = Math.max(1, Math.ceil(sessions.length / SESSION_PAGE_SIZE));

  const paginatedLoginHistory = useMemo(() => {
    const start = loginHistoryPage * LOGIN_HISTORY_PAGE_SIZE;
    return loginHistory.slice(start, start + LOGIN_HISTORY_PAGE_SIZE);
  }, [loginHistory, loginHistoryPage]);

  const paginatedSessions = useMemo(() => {
    const start = sessionsPage * SESSION_PAGE_SIZE;
    return sessions.slice(start, start + SESSION_PAGE_SIZE);
  }, [sessions, sessionsPage]);

  useEffect(() => {
    const loadSessions = async () => {
      if (activeTab === 'security' && showProfileView) {
        try {
          const userId = localStorage.getItem('userId') || '1';
          const response = await fetch(`${API_BASE_URL}/api/admin/get_sessions.php?admin_id=${userId}`);
          const result = await response.json();
          if (result.success) {
            setSessions(result.data);
            setSessionsPage(0);
          }
        } catch (error) {
          console.error('Error loading sessions:', error);
        }
      }
    };
    loadSessions();
  }, [activeTab, showProfileView, showSessionsModal]);

  useEffect(() => {
    // Wait 30 seconds before starting session validation to allow login to complete
    const initialDelay = setTimeout(() => {
      const interval = setInterval(async () => {
        const sessionId = localStorage.getItem('sessionId');
        const userId = localStorage.getItem('userId');
        if (!sessionId || !userId) return;

        try {
          const response = await fetch(`${API_BASE_URL}/api/admin/get_sessions.php?admin_id=${userId}`);
          
          // Only process if response is ok
          if (!response.ok) {
            console.error('Session check failed with status:', response.status);
            return;
          }
          
          const result = await response.json();
          if (result.success && result.data) {
            const currentSession = result.data.find(session => session.sessionId === sessionId);
            
            // Only logout if we're sure the session is invalid
            if (currentSession && !currentSession.isActive) {
              console.log('Session is inactive, logging out');
              localStorage.removeItem('token');
              localStorage.removeItem('userType');
              localStorage.removeItem('userId');
              localStorage.removeItem('username');
              localStorage.removeItem('sessionId');
              navigate('/login', { replace: true });
            }
            // If session not found but we have other active sessions, keep logged in
            // This prevents logout during session creation
          }
        } catch (error) {
          console.error('Error polling session status:', error);
          // Don't logout on network errors
        }
      }, 30000); // Check every 30 seconds instead of 15

      return () => clearInterval(interval);
    }, 30000); // Wait 30 seconds before first check

    return () => clearTimeout(initialDelay);
  }, [navigate]);

  // Function to add birthday notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const adminId = localStorage.getItem('adminId') || localStorage.getItem('userId') || profileData.id;
        
        if (!adminId) {
          console.warn('No admin ID available for fetching notifications');
          return;
        }
        
        const res = await fetch(`${API_BASE_URL}/api/admin/notifications.php?user_id=${adminId}&user_type=admin`);
        const data = await res.json();
        // Map backend notifications to frontend format
        setNotifications(data.map((n) => ({
          id: n.id,
          title: n.type === 'pending_request' ? '👤 New Member Request' : 
                 n.type === 'password_reset_request' ? '🔐 Password Reset Request' :
                 n.type === 'birthday' ? '🎂 Birthday Today!' :
                 n.type === 'event_reminder' ? '⏰ Event Reminder' :
                 n.type === 'attendance_needed' ? '✅ Attendance Needed' :
                 n.type === 'low_attendance' ? '⚠️ Low Attendance Alert' :
                 n.type === 'family_circle_created' ? '👨‍👩‍👧 Family Circle Created' :
                 n.type === 'family_circle_removed' ? '✂️ Family Circle Removed' : 'Notification',
          message: n.message,
          time: formatNotificationTime(n.timestamp),
          read: n.is_read,
          type: n.type,
          event_id: n.event_id,
          member_id: n.member_id
        })));
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    };
    fetchNotifications();
    // Refresh notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatNotificationTime = (timestamp) => {
    const now = new Date();
    const notifTime = new Date(timestamp);
    const diffMs = now - notifTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return notifTime.toLocaleDateString();
  };

  const handleNotificationClick = () => {
    // Refresh notifications to ensure any new birthday members are detected
    // The backend fetch already handles this, so no need to call a ref function here
    
    // Toggle notification panel
    setShowNotifications(!showNotifications);
    setShowProfileMenu(false);
  };

  const handleNotificationItemClick = (notification) => {
    // Mark notification as read
    markAsRead(notification.id);
    
    // Hide the notifications dropdown
    setShowNotifications(false);
    
    // Navigate to the appropriate section based on notification type
    switch(notification.type) {
      case 'password_reset_request':
        handleManageUsers();
        break;
      case 'pending_request':
        // Navigate to Members Management page with pending requests tab active
        setShowProfileView(false);
        setShowSettingsView(false);
        setShowAttendanceView(false);
        setShowMembersView(true);
        // This will be processed by the MembersManagement component to show pending requests
        if (window.sessionStorage) {
          window.sessionStorage.setItem('activeTab', 'pending_requests');
        }
        break;
      case 'event_reminder':
      case 'attendance_needed':
      case 'low_attendance':
        // Navigate to Attendance Management page
        setShowProfileView(false);
        setShowSettingsView(false);
        setShowMembersView(false);
        setShowAttendanceView(true);
        // Store event_id for potential highlighting
        if (notification.event_id && window.sessionStorage) {
          window.sessionStorage.setItem('highlightEventId', notification.event_id);
        }
        break;
      case 'birthday':
        // Navigate to Members Management page with birthdays tab active
        setShowProfileView(false);
        setShowSettingsView(false);
        setShowAttendanceView(false);
        setShowMembersView(true);
        // Set tab to birthdays
        if (window.sessionStorage) {
          window.sessionStorage.setItem('activeTab', 'birthdays');
        }
        break;
      case 'family_circle_created':
      case 'family_circle_removed':
        setShowProfileView(false);
        setShowSettingsView(false);
        setShowAttendanceView(false);
        setShowMembersView(true);
        if (window.sessionStorage) {
          window.sessionStorage.setItem('activeTab', 'all_members');
        }
        break;
      default:
        // Default to dashboard
        setShowProfileView(false);
        setShowSettingsView(false);
        setShowMembersView(false);
        setShowAttendanceView(false);
    }
  };

  const formatReportTimestampLabel = (timestamp = '') => {
    if (!timestamp) {
      return '—';
    }
    const normalized = timestamp.includes('T') ? timestamp : timestamp.replace(' ', 'T');
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) {
      return timestamp;
    }
    return `${date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })} ${date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })}`;
  };

  const computePercentLabel = (part = 0, total = 0) => {
    if (!total || total <= 0) {
      return '—';
    }
    const percentage = Math.round((part / total) * 100);
    return `${percentage}%`;
  };

  const renderCountPill = (value = 0, variant = 'total') => (
    <span className={`count-pill count-pill--${variant}`}>
      {Number.isFinite(value) ? value : 0}
    </span>
  );

  const formatLastCheckinDisplay = (record) => {
    const name = record?.lastCheckinName && record.lastCheckinName !== '—' ? record.lastCheckinName : '';
    const timestamp = formatReportTimestampLabel(record?.lastCheckinAt);

    if (name && timestamp && timestamp !== '—') {
      return { name, timestamp };
    }

    if (name) {
      return { name, timestamp: '' };
    }

    return { name: timestamp, timestamp: '' };
  };

  const formatLastCheckinCsvValue = (record) => {
    const { name, timestamp } = formatLastCheckinDisplay(record);
    if (name && timestamp) {
      return `${name} (${timestamp})`;
    }
    return name || timestamp || '—';
  };

  const handleEndSession = async (sessionId) => {
    setEndingSessionId(sessionId);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/end_session.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          adminId: profileData.id
        })
      });
      const result = await response.json();
      if (result.success) {
        setSessions(prev => prev.map(session =>
          session.sessionId === sessionId ? { ...session, isActive: false, lastActivity: new Date().toISOString().slice(0, 19).replace('T', ' ') } : session
        ));
        setToastMessage('Session ended successfully.');
        setToastType('success');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      } else {
        throw new Error(result.message || 'Failed to end session');
      }
    } catch (error) {
      console.error('Error ending session:', error);
      setToastMessage('Unable to end session. Please try again.');
      setToastType('error');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } finally {
      setEndingSessionId(null);
    }
  };

  const markAsRead = async (id) => {
    try {
      const adminId = localStorage.getItem('adminId') || localStorage.getItem('userId') || profileData.id;
      
      if (!adminId) {
        console.warn('No admin ID available for marking notification as read');
        return;
      }
      
      // Call backend API to mark notification as read
      const response = await fetch(`${API_BASE_URL}/api/admin/mark_notification_read.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          notification_id: id,
          user_id: adminId,
          user_type: 'admin'
        })
      });
      
      if (response.ok) {
        // Update local state immediately
        setNotifications(prevNotifications => 
          prevNotifications.map(notification => 
            notification.id === id ? {...notification, read: true} : notification
          )
        );
      } else {
        console.error('Failed to mark notification as read:', await response.text());
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      // Mark all unread notifications as read in the backend
      const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
      
      if (unreadIds.length === 0) return;
      
      const adminId = localStorage.getItem('adminId') || localStorage.getItem('userId') || profileData.id;
      
      if (!adminId) {
        console.warn('No admin ID available for marking notifications as read');
        return;
      }
      
      // Mark all in parallel
      await Promise.all(
        unreadIds.map(id =>
          fetch(`${API_BASE_URL}/api/admin/mark_notification_read.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              notification_id: id,
              user_id: adminId,
              user_type: 'admin'
            })
          })
        )
      );
      
      // Update local state
      setNotifications(prevNotifications => 
        prevNotifications.map(notification => ({...notification, read: true}))
      );
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (id) => {
    try {
      // Delete from backend
      await fetch(`${API_BASE_URL}/api/admin/delete_notification.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_id: id })
      });
      
      // Update local state
      setNotifications(notifications.filter(notification => notification.id !== id));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const unreadCount = notifications.filter(notification => !notification.read).length;

  // Add an effect to close notifications dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Check for active tab from session storage (for notifications navigation)
  useEffect(() => {
    if (window.sessionStorage && showMembersView) {
      const activeTab = window.sessionStorage.getItem('activeTab');
      if (activeTab) {
        // This will be used by MembersManagement component
        window.sessionStorage.removeItem('activeTab');
      }
    }
  }, [showMembersView]);

  // Dashboard stats state
  const [stats, setStats] = useState({
    totalMembers: 0,
    activeMembers: 0,
    todayAttendance: 0,
    todayRate: 0,
    weeksttendance: 0,
    weeklyAttendance: 0,
    monthlyDonations: 25000
  });

  const [upcomingBirthdays, setUpcomingBirthdays] = useState([]);
  const [weeklyAttendanceData, setWeeklyAttendanceData] = useState([]);
  const [memberGrowthData, setMemberGrowthData] = useState([]);
  const [growthStats, setGrowthStats] = useState({ newMembers: 0, growthRate: 0 });
  const [serviceAttendanceData, setServiceAttendanceData] = useState([]);
  const [recentRecords, setRecentRecords] = useState([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [reportStartDate, setReportStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [reportEndDate, setReportEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const reportRecords = useMemo(() => reportData?.records ?? [], [reportData]);

  const reportGeneratedLabel = useMemo(() => {
    if (!reportData?.generatedAt) {
      return '';
    }
    const generatedDate = new Date(reportData.generatedAt);
    if (Number.isNaN(generatedDate.getTime())) {
      return reportData.generatedAt;
    }
    return generatedDate.toLocaleString();
  }, [reportData]);

  const formatSummaryDateSegment = (dateStr = '') => {
    if (!dateStr) return '—';
    const parsed = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return dateStr;
    }
    return parsed.toLocaleDateString(undefined, {
      month: '2-digit',
      day: '2-digit'
    });
  };

  const reportPeriodLabel = useMemo(() => {
    if (!reportData?.dateRange) {
      return '';
    }
    const { start, end } = reportData.dateRange;
    const startSegment = formatSummaryDateSegment(start);
    const endSegment = formatSummaryDateSegment(end);
    return `${startSegment}-${endSegment}`;
  }, [reportData]);

  const reportAveragePerEvent = useMemo(() => {
    if (!reportData?.totalEvents) {
      return 0;
    }
    if (reportData.totalEvents === 0) {
      return 0;
    }
    return Number((reportData.totalAttendance / reportData.totalEvents).toFixed(1));
  }, [reportData]);

  const reportSummaryMetrics = useMemo(() => {
    if (!reportData) return [];
    return [
      { label: 'Period', value: reportPeriodLabel },
      { label: 'Events', value: reportData.totalEvents },
      { label: 'Check-ins', value: reportData.totalAttendance },
      { label: 'Avg', value: reportAveragePerEvent },
      { label: 'Members', value: reportData.totalMemberCheckins },
      { label: 'Guests', value: reportData.totalGuestCheckins },
      { label: 'Member %', value: computePercentLabel(reportData.totalMemberCheckins, reportData.totalAttendance) },
      { label: 'Guest %', value: computePercentLabel(reportData.totalGuestCheckins, reportData.totalAttendance) }
    ];
  }, [reportData, reportPeriodLabel, reportAveragePerEvent]);

  const formatReportDateLabel = (isoDate = '') => {
    if (!isoDate) {
      return '—';
    }
    const date = new Date(`${isoDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return isoDate;
    }
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatReportTimeLabel = (time = '') => {
    if (!time) {
      return '—';
    }
    const [hours, minutes] = time.split(':');
    if (Number.isNaN(Number(hours))) {
      return time;
    }
    const date = new Date();
    date.setHours(Number(hours), Number(minutes) || 0, 0, 0);
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Load calendar events when month/year changes
  useEffect(() => {
    if (showScheduleModal) {
      loadCalendarEvents();
    }
  }, [currentMonth, currentYear, showScheduleModal]);

  const loadCalendarEvents = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/schedule/get_calendar_events.php?month=${currentMonth}&year=${currentYear}`);
      const data = await response.json();
      if (data.success) {
        setCalendarEvents(data.events);
      }
    } catch (error) {
      console.error('Error loading calendar:', error);
    }
  };

  const generateReport = async () => {
    try {
      // Direct API call to Render backend
      const formData = new FormData();
      formData.append('format', 'json');
      formData.append('startDate', reportStartDate);
      formData.append('endDate', reportEndDate);

      const response = await fetch(`${API_BASE_URL}/api/reports/export_attendance.php`, {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      if (data.success) {
        setReportData(data.data);
      } else {
        console.error('Report generation failed:', data.message);
        alert('Failed to generate report: ' + (data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Error generating report. Please try again.');
    }
  };

  const exportReportXlsx = async () => {
    try {
      // Use form POST to bypass InfinityFree anti-bot protection
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = `${API_BASE_URL}/api/reports/export_attendance.php`;
      form.target = '_blank';
      
      const formatInput = document.createElement('input');
      formatInput.type = 'hidden';
      formatInput.name = 'format';
      formatInput.value = 'xlsx';
      form.appendChild(formatInput);
      
      const startInput = document.createElement('input');
      startInput.type = 'hidden';
      startInput.name = 'startDate';
      startInput.value = reportStartDate;
      form.appendChild(startInput);
      
      const endInput = document.createElement('input');
      endInput.type = 'hidden';
      endInput.name = 'endDate';
      endInput.value = reportEndDate;
      form.appendChild(endInput);
      
      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);
    } catch (error) {
      console.error('Error exporting report:', error);
    }
  };

  const exportReportPdf = async () => {
    try {
      // Use form POST to bypass InfinityFree anti-bot protection
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = `${API_BASE_URL}/api/reports/export_attendance.php`;
      form.target = '_blank';
      
      const formatInput = document.createElement('input');
      formatInput.type = 'hidden';
      formatInput.name = 'format';
      formatInput.value = 'pdf';
      form.appendChild(formatInput);
      
      const startInput = document.createElement('input');
      startInput.type = 'hidden';
      startInput.name = 'startDate';
      startInput.value = reportStartDate;
      form.appendChild(startInput);
      
      const endInput = document.createElement('input');
      endInput.type = 'hidden';
      endInput.name = 'endDate';
      endInput.value = reportEndDate;
      form.appendChild(endInput);
      
      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);
    } catch (error) {
      console.error('Error exporting PDF report:', error);
    }
  };

  useEffect(() => {
    const loadDashboardStats = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/dashboard/get_stats.php`);
        console.log('Stats response status:', response.status);

        const data = await response.json();
        console.log('Stats data:', data);

        if (response.ok && data.success) {
          setStats(prev => ({
            ...prev,
            totalMembers: data.stats.totalMembers,
            activeMembers: data.stats.activeMembers,
            todayAttendance: data.stats.todayAttendance,
            todayRate: data.stats.todayRate,
            weekAttendance: data.stats.weekAttendance,
            weeklyAttendance: data.stats.weeklyAttendanceRate
          }));
        } else {
          console.error('API returned error:', data.message);
        }
      } catch (error) {
        console.error('Error loading dashboard stats:', error);
      }
    };

    const loadUpcomingBirthdays = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/dashboard/get_upcoming_birthdays.php?limit=3`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setUpcomingBirthdays(data.birthdays);
          }
        }
      } catch (error) {
        console.error('Error loading birthdays:', error);
      }
    };

    const loadWeeklyAttendance = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/dashboard/get_weekly_attendance.php`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setWeeklyAttendanceData(data.data);
          }
        }
      } catch (error) {
        console.error('Error loading weekly attendance:', error);
      }
    };

    const loadMemberGrowth = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/dashboard/get_member_growth.php`);
        if (response.ok) {
          const data = await response.json();
          console.log('Member growth data:', data);
          if (data.success) {
            setMemberGrowthData(data.data);
            setGrowthStats({
              newMembers: data.newMembers,
              growthRate: data.growthRate
            });
          }
        }
      } catch (error) {
        console.error('Error loading member growth:', error);
      }
    };

    const loadServiceAttendance = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/dashboard/get_service_attendance.php`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setServiceAttendanceData(data.data);
          }
        }
      } catch (error) {
        console.error('Error loading service attendance:', error);
      }
    };

    const loadRecentRecords = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/dashboard/get_recent_records.php?limit=5`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setRecentRecords(data.records);
          }
        }
      } catch (error) {
        console.error('Error loading recent records:', error);
      }
    };

    loadDashboardStats();
    loadUpcomingBirthdays();
    loadWeeklyAttendance();
    loadMemberGrowth();
    loadServiceAttendance();
    loadRecentRecords();
  }, []);

  const adminProfile = {
    name: "John Doe",
    email: "john.doe@example.com",
    lastLogin: "March 20, 2024 9:30 AM"
  };

  const topMembers = [
    { name: 'John Doe', score: 100, rank: 1 },
    { name: 'Maria Santos', score: 95, rank: 2 },
    { name: 'James Wilson', score: 92, rank: 3 },
    { name: 'Sarah Lee', score: 88, rank: 4 },
    { name: 'Michael Chen', score: 85, rank: 5 }
  ];

  // Add more members data for the full leaderboard
  const allMembers = [
    { name: 'John Doe', score: 100, rank: 1 },
    { name: 'Maria Santos', score: 95, rank: 2 },
    { name: 'James Wilson', score: 92, rank: 3 },
    { name: 'Sarah Lee', score: 88, rank: 4 },
    { name: 'Michael Chen', score: 85, rank: 5 },
    { name: 'Emily Brown', score: 82, rank: 6 },
    { name: 'David Kim', score: 80, rank: 7 },
    { name: 'Lisa Wang', score: 78, rank: 8 },
    { name: 'Robert Taylor', score: 75, rank: 9 },
    { name: 'Anna Garcia', score: 73, rank: 10 },
    { name: 'Kevin Park', score: 70, rank: 11 },
    { name: 'Michelle Lee', score: 68, rank: 12 },
    { name: 'Thomas Anderson', score: 65, rank: 13 },
    { name: 'Jessica Martinez', score: 63, rank: 14 },
    { name: 'Daniel Wilson', score: 60, rank: 15 }
  ];

  const getInitials = (name) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('');
  };

  const handleProfileClick = () => {
    setShowProfileMenu(false);
    setShowProfileView(true);
    setOriginalData({
      ...profileData,
      previewImage: previewImage
    });
    setHasChanges(false);
  };

  const handleProfileSettingsClick = () => {
    setShowProfileMenu(false);
    setShowProfileView(true);
    setOriginalData({
      ...profileData,
      previewImage: previewImage
    });
    setHasChanges(false);
  };

  const handleCancel = () => {
    // Restore original data
    if (originalData) {
      setProfileData(originalData);
      setPreviewImage(originalData.previewImage);
    }
    setShowProfileView(false);
    setActiveTab('account');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result);
        setHasChanges(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProfileChange = (field, value) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
    checkForChanges({
      ...profileData,
      [field]: value
    });
  };

  const checkForChanges = (currentData) => {
    if (!originalData) return;
    
    const hasDataChanges = JSON.stringify(originalData) !== JSON.stringify({
      ...currentData,
      previewImage: previewImage
    });
    
    setHasChanges(hasDataChanges);
  };

  const handleSave = async () => {
    try {
      const profilePic = previewImage || profileData.profilePicture || null;
      console.log('Saving profile data:', profileData);
      console.log('Profile picture length:', profilePic ? profilePic.length : 0);
      
      // Save to backend
      const response = await fetch(`${API_BASE_URL}/api/admin/update_profile.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_id: profileData.id,
          firstName: profileData.firstName,
          lastName: profileData.lastName,
          birthday: profileData.birthday,
          email: profileData.email,
          profilePicture: profilePic
        })
      });
      
      console.log('Response status:', response.status);
      const responseText = await response.text();
      console.log('Response text:', responseText);
      const result = JSON.parse(responseText);
      console.log('Response data:', result);
      
      if (result.status === 'success') {
        // Update the avatar initials if name changed
        const newAvatar = `${profileData.firstName[0]}${profileData.lastName[0]}`;
        const updatedData = {
          ...profileData,
          avatar: previewImage || profileData.profilePicture || newAvatar,
          profilePicture: previewImage || profileData.profilePicture
        };
        setProfileData(updatedData);
        setOriginalData(updatedData);
        setPreviewImage(null);
        setHasChanges(false);
        
        // Show success toast
        setToastMessage('Profile updated successfully!');
        setToastType('success');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      } else {
        // Show error toast
        setToastMessage('Error updating profile: ' + result.message);
        setToastType('error');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      // Show error toast
      setToastMessage('Error saving profile. Please try again.');
      setToastType('error');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  };

  const handleSaveClick = () => {
    console.log('Save button clicked!');
    setShowSaveModal(true);
  };

  const handleCancelClick = () => {
    // Only show confirmation if there are changes
    const hasChanges = JSON.stringify(originalData) !== JSON.stringify({
      ...profileData,
      previewImage: previewImage
    });
    
    if (hasChanges) {
      setShowCancelModal(true);
    } else {
      setShowProfileView(false);
    }
  };

  const handleConfirmSave = async () => {
    console.log('Confirm button clicked in modal!');
    await handleSave();
    setShowSaveModal(false);
    // Don't close profile view, just hide the modal
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.scrollTop = 0;
    }
  };

  const handleConfirmCancel = () => {
    if (originalData) {
      setProfileData(originalData);
      setPreviewImage(originalData.previewImage);
    }
    setShowCancelModal(false);
    setShowProfileView(false);
    setActiveTab('account');
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.scrollTop = 0;
    }
  };

  const handleSocialConnect = (platform) => {
    setProfileData(prev => ({
      ...prev,
      linkedAccounts: {
        ...prev.linkedAccounts,
        [platform]: !prev.linkedAccounts[platform]
      }
    }));
    setHasChanges(true);
  };

  const handleTabChange = (tab) => {
    const tabs = ['account', 'security'];
    const currentIndex = tabs.indexOf(activeTab);
    const newIndex = tabs.indexOf(tab);
    const direction = newIndex > currentIndex ? 'left' : 'right';
    
    document.documentElement.style.setProperty('--slide-direction', direction);
    setPreviousTab(activeTab);
    setActiveTab(tab);
  };

  // Password change handlers
  const handlePasswordChange = (field, value) => {
    setPasswordData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePasswordUpdate = async () => {
    // Validation
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      setToastMessage('Please fill in all password fields.');
      setToastType('error');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setToastMessage('New passwords do not match.');
      setToastType('error');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setToastMessage('Password must be at least 6 characters long.');
      setToastType('error');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      return;
    }

    setShowPasswordModal(true);
  };

  const handleConfirmPasswordUpdate = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/change_password.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_id: profileData.id,
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      });

      const responseText = await response.text();
      const result = JSON.parse(responseText);

      if (result.status === 'success') {
        setToastMessage('Password updated successfully!');
        setToastType('success');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
        
        // Clear password fields
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      } else {
        setToastMessage(result.message || 'Error updating password.');
        setToastType('error');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      }
    } catch (error) {
      console.error('Error updating password:', error);
      setToastMessage('Error updating password. Please try again.');
      setToastType('error');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } finally {
      setShowPasswordModal(false);
    }
  };

  const handleSettingsClick = () => {
    setShowSettingsView(true);
    setOriginalChurchData(getCurrentChurchSettingsSnapshot());
    setHasChurchChanges(false);
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check if file is an image
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }

      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size should be less than 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setChurchLogo(reader.result);
        checkChurchChanges({ churchLogo: reader.result });
      };
      reader.onerror = () => {
        alert('Error reading file');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    if (window.confirm('Are you sure you want to remove the logo?')) {
      setChurchLogo(logoImage);
      checkChurchChanges({ churchLogo: logoImage });
    }
  };

  const handleHeaderLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert('File size should be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setHeaderLogo(reader.result);
        checkChurchChanges({ headerLogo: reader.result });
      };
      reader.onerror = () => {
        alert('Error reading file');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveHeaderLogo = () => {
    if (window.confirm('Are you sure you want to remove the header logo?')) {
      setHeaderLogo(null);
      checkChurchChanges({ headerLogo: null });
    }
  };

  // Homepage image handlers
  const handleHomepageImageChange = (imageIndex, e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert('File size should be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const setters = [setHomepageImage1, setHomepageImage2, setHomepageImage3, setHomepageImage4, setHomepageImage5, setHomepageImage6];
        setters[imageIndex](reader.result);
        const imageKeys = ['homepage_image_1', 'homepage_image_2', 'homepage_image_3', 'homepage_image_4', 'homepage_image_5', 'homepage_image_6'];
        checkChurchChanges({ [imageKeys[imageIndex]]: reader.result });
      };
      reader.onerror = () => {
        alert('Error reading file');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveHomepageImage = (imageIndex) => {
    if (window.confirm('Are you sure you want to remove this homepage image?')) {
      const setters = [setHomepageImage1, setHomepageImage2, setHomepageImage3, setHomepageImage4, setHomepageImage5, setHomepageImage6];
      setters[imageIndex](null);
      const imageKeys = ['homepage_image_1', 'homepage_image_2', 'homepage_image_3', 'homepage_image_4', 'homepage_image_5', 'homepage_image_6'];
      checkChurchChanges({ [imageKeys[imageIndex]]: null });
    }
  };

  const handleHomepageHeroTitleChange = (e) => {
    const value = e.target.value;
    setHomepageHeroTitle(value);
    checkChurchChanges({ homepage_hero_title: value });
  };

  const handleHomepageHeroSubtitleChange = (e) => {
    const value = e.target.value;
    setHomepageHeroSubtitle(value);
    checkChurchChanges({ homepage_hero_subtitle: value });
  };

  const handleChurchNameChange = (e) => {
    setChurchName(e.target.value);
    checkChurchChanges({ churchName: e.target.value });
  };

  const handleHelpCenterEmailChange = (e) => {
    const value = e.target.value;
    setHelpCenterEmail(value);
    checkChurchChanges({ helpCenterEmail: value });
  };

  const handleHelpCenterPhoneChange = (e) => {
    const value = e.target.value;
    setHelpCenterPhone(value);
    checkChurchChanges({ helpCenterPhone: value });
  };

  const handleHelpCenterUrlChange = (e) => {
    const value = e.target.value;
    setHelpCenterUrl(value);
    checkChurchChanges({ helpCenterUrl: value });
  };

  const handleRunMaintenance = async () => {
    if (isMaintenanceRunning) return;

    setMaintenanceError(null);
    setIsMaintenanceRunning(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/run_system_maintenance.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setMaintenanceResult(result.data || null);
        setMaintenanceError(null);
        setToastMessage(result.message || 'System maintenance completed successfully.');
        setToastType('success');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      } else {
        const errorMessage = result.message || 'System maintenance failed.';
        setMaintenanceError(errorMessage);
        setToastMessage(errorMessage);
        setToastType('error');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      }
    } catch (error) {
      console.error('Error running system maintenance:', error);
      const errorMessage = 'Unable to run maintenance. Please try again.';
      setMaintenanceError(errorMessage);
      setToastMessage(errorMessage);
      setToastType('error');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } finally {
      setIsMaintenanceRunning(false);
    }
  };

  const formatMaintenanceTimestamp = (value) => {
    if (!value) {
      return 'Just now';
    }

    const normalized = value.includes('T') ? value : value.replace(' ', 'T');
    const parsed = new Date(normalized);

    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return parsed.toLocaleString();
  };

  const getCurrentChurchSettingsSnapshot = (overrides = {}) => ({
    churchLogo: Object.prototype.hasOwnProperty.call(overrides, 'churchLogo') ? overrides.churchLogo : churchLogo,
    headerLogo: Object.prototype.hasOwnProperty.call(overrides, 'headerLogo') ? overrides.headerLogo : headerLogo,
    churchName: Object.prototype.hasOwnProperty.call(overrides, 'churchName') ? overrides.churchName : churchName,
    churchAddress: Object.prototype.hasOwnProperty.call(overrides, 'churchAddress') ? overrides.churchAddress : churchAddress,
    churchPhone: Object.prototype.hasOwnProperty.call(overrides, 'churchPhone') ? overrides.churchPhone : churchPhone,
    churchEmail: Object.prototype.hasOwnProperty.call(overrides, 'churchEmail') ? overrides.churchEmail : churchEmail,
    dateFormat: Object.prototype.hasOwnProperty.call(overrides, 'dateFormat') ? overrides.dateFormat : dateFormat,
    helpCenterEmail: Object.prototype.hasOwnProperty.call(overrides, 'helpCenterEmail') ? overrides.helpCenterEmail : helpCenterEmail,
    helpCenterPhone: Object.prototype.hasOwnProperty.call(overrides, 'helpCenterPhone') ? overrides.helpCenterPhone : helpCenterPhone,
    helpCenterUrl: Object.prototype.hasOwnProperty.call(overrides, 'helpCenterUrl') ? overrides.helpCenterUrl : helpCenterUrl,
    homepage_image_1: Object.prototype.hasOwnProperty.call(overrides, 'homepage_image_1') ? overrides.homepage_image_1 : homepageImage1,
    homepage_image_2: Object.prototype.hasOwnProperty.call(overrides, 'homepage_image_2') ? overrides.homepage_image_2 : homepageImage2,
    homepage_image_3: Object.prototype.hasOwnProperty.call(overrides, 'homepage_image_3') ? overrides.homepage_image_3 : homepageImage3,
    homepage_image_4: Object.prototype.hasOwnProperty.call(overrides, 'homepage_image_4') ? overrides.homepage_image_4 : homepageImage4,
    homepage_image_5: Object.prototype.hasOwnProperty.call(overrides, 'homepage_image_5') ? overrides.homepage_image_5 : homepageImage5,
    homepage_image_6: Object.prototype.hasOwnProperty.call(overrides, 'homepage_image_6') ? overrides.homepage_image_6 : homepageImage6,
    homepage_hero_title: Object.prototype.hasOwnProperty.call(overrides, 'homepage_hero_title') ? overrides.homepage_hero_title : homepageHeroTitle,
    homepage_hero_subtitle: Object.prototype.hasOwnProperty.call(overrides, 'homepage_hero_subtitle') ? overrides.homepage_hero_subtitle : homepageHeroSubtitle
  });

  const checkChurchChanges = (overrides = {}) => {
    if (!originalChurchData) return;

    const snapshot = getCurrentChurchSettingsSnapshot(overrides);
    const hasChanges = Object.keys(originalChurchData).some((key) => {
      const originalValue = originalChurchData[key] ?? '';
      const currentValue = snapshot[key] ?? '';
      return originalValue !== currentValue;
    });

    setHasChurchChanges(hasChanges);
  };

  const handleChurchSave = async () => {
    try {
      const payload = {
        churchName,
        churchAddress,
        churchPhone,
        churchEmail,
        churchLogo,
        headerLogo,
        helpCenterEmail,
        helpCenterPhone,
        helpCenterUrl,
        dateFormat,
        homepage_image_1: homepageImage1,
        homepage_image_2: homepageImage2,
        homepage_image_3: homepageImage3,
        homepage_image_4: homepageImage4,
        homepage_image_5: homepageImage5,
        homepage_image_6: homepageImage6,
        homepage_hero_title: homepageHeroTitle,
        homepage_hero_subtitle: homepageHeroSubtitle
      };
      
      const response = await fetch(`${API_BASE_URL}/api/admin/update_church_settings.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (result.success) {
        // Save to localStorage for global access
        localStorage.setItem('churchSettings', JSON.stringify(payload));
        
        // Update favicon with new logo
        if (churchLogo) {
          updateFavicon(churchLogo);
        }
        
        setOriginalChurchData(payload);
        setHasChurchChanges(false);
        setToastMessage('Church settings updated successfully.');
        setToastType('success');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      } else {
        throw new Error(result.message || 'Failed to update church settings');
      }
    } catch (error) {
      console.error('Error updating church settings:', error);
      setToastMessage('Unable to update church settings. Please try again.');
      setToastType('error');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  };

  const handleChurchCancel = () => {
    if (originalChurchData) {
      setChurchLogo(originalChurchData.churchLogo ?? logoImage);
      setHeaderLogo(Object.prototype.hasOwnProperty.call(originalChurchData, 'headerLogo') ? originalChurchData.headerLogo : null);
      setChurchName(originalChurchData.churchName ?? 'Christ-Like Christian Church');
      setChurchAddress(originalChurchData.churchAddress || '');
      setChurchPhone(originalChurchData.churchPhone || '');
      setChurchEmail(originalChurchData.churchEmail || '');
      setHelpCenterEmail(originalChurchData.helpCenterEmail || '');
      setHelpCenterPhone(originalChurchData.helpCenterPhone || '');
      setHelpCenterUrl(originalChurchData.helpCenterUrl || '');
      setDateFormat(originalChurchData.dateFormat ?? 'mm/dd/yyyy');
      setHomepageHeroTitle(originalChurchData.homepage_hero_title || 'SHAPING FUTURES\nWITH FAITH');
      setHomepageHeroSubtitle(originalChurchData.homepage_hero_subtitle || 'Join us for an uplifting experience');
    }
    setHasChurchChanges(false);
  };

  const handleSettingsBackClick = () => {
    if (hasChurchChanges) {
      setShowSettingsCancelModal(true);
    } else {
      setShowSettingsView(false);
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        mainContent.scrollTop = 0;
      }
    }
  };

  const handleSettingsSaveClick = () => {
    setShowSettingsSaveModal(true);
  };

  const handleConfirmSettingsSave = () => {
    handleChurchSave();
    setShowSettingsSaveModal(false);
    setShowSettingsView(false);
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.scrollTop = 0;
    }
  };

  const handleConfirmSettingsCancel = () => {
    handleChurchCancel();
    setShowSettingsCancelModal(false);
    setShowSettingsView(false);
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.scrollTop = 0;
    }
  };

  const handleProfileBackClick = () => {
    if (hasChanges) {
      setShowCancelModal(true);
    } else {
      setShowProfileView(false);
      setActiveTab('account');
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        mainContent.scrollTop = 0;
      }
    }
  };

  const handleCancelModalClose = () => {
    setShowCancelModal(false);
  };

  const handleSaveModalClose = () => {
    setShowSaveModal(false);
  };

  const handleSettingsSaveModalClose = () => {
    setShowSettingsSaveModal(false);
  };

  const handleSettingsCancelModalClose = () => {
    setShowSettingsCancelModal(false);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    switch(dateFormat) {
      case 'dd/mm/yyyy':
        return date.toLocaleDateString('en-GB');
      case 'yyyy-mm-dd':
        return date.toLocaleDateString('en-CA');
      default: // mm/dd/yyyy
        return date.toLocaleDateString('en-US');
    }
  };

  const formatDateTime = (value) => {
    if (!value) {
      return '—';
    }

    const normalized = value.includes('T') ? value : value.replace(' ', 'T');
    const parsed = new Date(normalized);

    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return parsed.toLocaleString();
  };

  const handleManageUsers = () => {
    if (!isAdmin) {
      setShowToast(true);
      setToastMessage('Only administrators can manage user password resets.');
      setToastType('error');
      setTimeout(() => setShowToast(false), 3000);
      return;
    }

    setShowProfileView(false);
    setShowAttendanceView(false);
    setShowMembersView(false);
    setShowSettingsView(true);

    fetchPasswordResetRequests('pending');

    setTimeout(() => {
      manageUsersSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
  };

  const handleResetSettings = () => {
    if (window.confirm('Are you sure you want to reset all settings to default? This action cannot be undone.')) {
      setChurchLogo(logoImage);
      setChurchName('Christ-Like Christian Church');
      setDateFormat('mm/dd/yyyy');
      alert('All settings have been reset to default values.');
    }
  };

  const handleCleanupCodes = () => {
    if (window.confirm('Clean up old verification codes? This will delete expired and used codes.')) {
      fetch(`${API_BASE_URL}/api/verification/cleanup_codes.php`)
        .then(res => res.json())
        .then(data => {
          alert(`Cleanup completed!\nExpired codes cleaned: ${data.expired_codes_cleaned}\nUsed codes cleaned: ${data.used_codes_cleaned}`);
        })
        .catch(err => {
          alert('Cleanup failed. Please try again.');
        });
    }
  };



  const handleLeaderboardModalClose = (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      setShowLeaderboardModal(false);
    }
  };

  const handleSignOutClick = () => {
    setShowProfileMenu(false);
    setShowSignOutModal(true);
  };

  const handleConfirmSignOut = async () => {
    setShowSignOutModal(false);
    const sessionId = localStorage.getItem('sessionId');
    try {
      await fetch(`${API_BASE_URL}/api/admin/logout.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_id: profileData.id,
          session_id: sessionId
        })
      });
    } catch (error) {
      console.error('Error logging out session:', error);
    }

    localStorage.removeItem('token');
    localStorage.removeItem('userType');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    localStorage.removeItem('sessionId');
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Function to check if a date is today
  const isToday = (dateString) => {
    const today = new Date();
    const eventDate = new Date(dateString);
    return today.getFullYear() === eventDate.getFullYear() &&
           today.getMonth() === eventDate.getMonth() &&
           today.getDate() === eventDate.getDate();
  };
  
  // Get a future date X days from today in YYYY-MM-DD format
  const getFutureDateString = (daysFromToday) => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysFromToday);
    return `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}-${String(futureDate.getDate()).padStart(2, '0')}`;
  };
  
  // Initialize sample events data
  const [events, setEvents] = useState([
    {
      id: 1,
      title: 'Sunday Service',
      date: getFutureDateString(4), // Next Sunday
      time: '08:00 AM',
      endTime: '10:00 AM',
      location: 'Main Hall',
      status: 'active',
      attendees: [
        { id: 1, name: 'John Doe', status: 'Present', time: '08:30 AM' },
        { id: 2, name: 'Jane Smith', status: 'Present', time: '08:45 AM' }
      ]
    },
    {
      id: 2,
      title: 'Bible Study',
      date: getFutureDateString(7), // A week from today
      time: '07:00 PM',
      endTime: '08:30 PM',
      location: 'Room 101',
      status: 'active',
      attendees: []
    },
    {
      id: 3,
      title: "Today's Prayer Meeting",
      date: getFutureDateString(0), // Today
      time: '09:00 AM',
      endTime: '10:00 AM',
      location: 'Prayer Room',
      status: 'active',
      attendees: []
    }
  ]);
  
  useEffect(() => {
    // Update upcoming services based on events
    const activeEvents = events.filter(event => event.status === 'active' || event.status === 'upcoming');
    // Sort events by date
    const sortedEvents = [...activeEvents].sort((a, b) => new Date(a.date) - new Date(b.date));
    // Convert to the format expected by the dashboard
    const formattedServices = sortedEvents.map(event => ({
      title: event.title,
      date: event.date,
      time: event.time,
      endTime: event.endTime || '', // Add default endTime if not present
      location: event.location
    }));
    setUpcomingServices(formattedServices);
  }, [events]);

  // Listen for refresh events from other components
  useEffect(() => {
    // Function to handle refresh notification events
    const handleRefreshNotifications = () => {
      console.log('Refresh notifications event received');
      // The backend fetch already handles this, so no need to call a ref function here
    };
    
    // Add event listener for custom refresh event
    window.addEventListener('refreshNotifications', handleRefreshNotifications);
    
    // Check for session storage flag
    const checkSessionStorage = () => {
      if (window.sessionStorage && window.sessionStorage.getItem('refreshNotifications')) {
        console.log('Refresh notifications flag found in session storage');
        // The backend fetch already handles this, so no need to call a ref function here
        window.sessionStorage.removeItem('refreshNotifications');
      }
    };
    
    // Check on mount and periodically
    checkSessionStorage();
    const storageCheckInterval = setInterval(checkSessionStorage, 2000);
    
    // Clean up
    return () => {
      window.removeEventListener('refreshNotifications', handleRefreshNotifications);
      clearInterval(storageCheckInterval);
    };
  }, []);

  // Remove drawer/sidebar and hamburger menu logic
  // Add top bar navigation with logo, nav links, notifications, and profile
  return (
    <div className="admin-container">
      <header className="topbar-nav">
        <div className="topbar-left">
          <button className="mobile-menu-btn" onClick={() => setShowMobileMenu(!showMobileMenu)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <img src={headerLogo || churchLogo} alt="Church Logo" className="topbar-logo" />
          <span className="topbar-church-name">{churchName}</span>
        </div>
        <nav className="topbar-menu">
          <button className={`nav-item ${!showAttendanceView && !showMembersView && !showBirthdayView ? 'active' : ''}`} onClick={() => { setShowAttendanceView(false); setShowMembersView(false); setShowBirthdayView(false); setShowProfileView(false); setShowSettingsView(false); }}>Dashboard</button>
          <button className={`nav-item ${showAttendanceView ? 'active' : ''}`} onClick={() => { setShowAttendanceView(true); setShowMembersView(false); setShowBirthdayView(false); setShowProfileView(false); setShowSettingsView(false); }}>Attendance</button>
          <button className={`nav-item ${showMembersView ? 'active' : ''}`} onClick={() => { setShowAttendanceView(false); setShowMembersView(true); setShowProfileView(false); setShowSettingsView(false); }}>Members</button>
        </nav>
        
        {/* Mobile Menu Dropdown */}
        {showMobileMenu && (
          <div className="mobile-menu-dropdown">
            <button className={`mobile-menu-item ${!showAttendanceView && !showMembersView && !showBirthdayView ? 'active' : ''}`} onClick={() => { setShowAttendanceView(false); setShowMembersView(false); setShowBirthdayView(false); setShowProfileView(false); setShowSettingsView(false); setShowMobileMenu(false); }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
              Dashboard
            </button>
            <button className={`mobile-menu-item ${showAttendanceView ? 'active' : ''}`} onClick={() => { setShowAttendanceView(true); setShowMembersView(false); setShowBirthdayView(false); setShowProfileView(false); setShowSettingsView(false); setShowMobileMenu(false); }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="8.5" cy="7" r="4"></circle>
                <polyline points="17 11 19 13 23 9"></polyline>
              </svg>
              Attendance
            </button>
            <button className={`mobile-menu-item ${showMembersView ? 'active' : ''}`} onClick={() => { setShowAttendanceView(false); setShowMembersView(true); setShowProfileView(false); setShowSettingsView(false); setShowMobileMenu(false); }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              Members
            </button>
          </div>
        )}
        
        <div className="topbar-right">
          <div className="topbar-notifications" ref={notificationRef} onClick={handleNotificationClick}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
            {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
            {showNotifications && (
              <div className="notifications-dropdown">
                <div className="notifications-header">
                  <h3>Notifications</h3>
                  {unreadCount > 0 && (
                    <button className="mark-all-read" onClick={markAllAsRead}>Mark all as read</button>
                  )}
                </div>
                <div className="notifications-list">
                  {notifications.length > 0 ? (
                    notifications.map(notification => (
                      <div key={notification.id} className={`notification-item ${!notification.read ? 'unread' : ''}`} onClick={() => handleNotificationItemClick(notification)} data-type={notification.type}>
                        <div className="notification-content">
                          <div className="notification-title">{notification.title}</div>
                          <div className="notification-message">{notification.message}</div>
                          <div className="notification-time">{notification.time}</div>
                        </div>
                        <button className="delete-notification" onClick={e => { e.stopPropagation(); deleteNotification(notification.id); }}>×</button>
                      </div>
                    ))
                  ) : (
                    <div className="no-notifications">No notifications</div>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="topbar-profile" ref={profileRef}>
            <div className="profile-avatar" onClick={() => setShowProfileMenu(v => !v)} style={{cursor: 'pointer'}}>
              {previewImage ? (
                <img src={previewImage} alt="Profile" className="avatar-image" />
              ) : profileData.profilePicture ? (
                <img src={profileData.profilePicture} alt="Profile" className="avatar-image" />
              ) : profileData.avatar}
            </div>
            <div className="profile-info-texts" onClick={() => setShowProfileMenu(v => !v)} style={{cursor: 'pointer'}}>
              <span style={{ color: '#fff' }}>{`${profileData.firstName} ${profileData.lastName}`}</span>
            </div>
            {showProfileMenu && (
              <div className="profile-dropdown-menu">
                <div className="profile-dropdown-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', paddingBottom: 0, borderBottom: '1px solid #e5e7eb', marginBottom: '0.25rem' }}>
                  <div className="profile-avatar" style={{ width: 40, height: 40, minWidth: 40, minHeight: 40, maxWidth: 40, maxHeight: 40, fontSize: '1.1rem' }}>
                    {previewImage ? (
                      <img src={previewImage} alt="Profile" className="avatar-image" />
                    ) : profileData.profilePicture ? (
                      <img src={profileData.profilePicture} alt="Profile" className="avatar-image" />
                    ) : profileData.avatar}
                  </div>
                  <div className="profile-dropdown-info" style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="profile-dropdown-name" style={{ fontWeight: 700, fontSize: '0.98rem', color: '#1e293b' }}>{`${profileData.firstName} ${profileData.lastName}`}</span>
                    <span className="profile-dropdown-email" style={{ fontSize: '0.85rem', color: '#64748b' }}>{profileData.email}</span>
                  </div>
                </div>
                <div className="profile-menu" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.5rem 1rem 1rem 1rem' }}>
                  <button className="profile-menu-item" onClick={handleProfileSettingsClick} style={{display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: 8, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.95rem', width: '100%', textAlign: 'left'}}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    Profile Settings
                  </button>
                  <button className="profile-menu-item" onClick={() => { setShowProfileMenu(false); handleSettingsClick(); }} style={{display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: 8, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.95rem', width: '100%', textAlign: 'left'}}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 5 15.4a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8 5.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 16 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 8c.14.31.22.65.22 1s-.08.69-.22 1a1.65 1.65 0 0 0-.33 1.82z"></path></svg>
                    Settings
                  </button>
                  <button className="profile-menu-item" onClick={handleSignOutClick} style={{display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: 8, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.95rem', width: '100%', textAlign: 'left'}}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
      <div className={`main-content main-content-topbar ${showProfileView ? 'profile-mode' : showSettingsView ? 'settings-mode' : ''}`}> 
        <div className="content-wrapper">
          <div className="dashboard-content">
            {!showProfileView && !showSettingsView && (
              <>
                <div className="top-nav">
                  <nav className="nav-menu-horizontal">
                    <button 
                      className={`nav-item ${!showAttendanceView && !showMembersView && !showBirthdayView ? 'active' : ''}`}
                      onClick={() => {
                        setShowAttendanceView(false);
                        setShowMembersView(false);
                        setShowBirthdayView(false);
                      }}
                    >
                      Dashboard
                    </button>

                    <button 
                      className={`nav-item ${showAttendanceView ? 'active' : ''}`}
                      onClick={() => {
                        setShowAttendanceView(true);
                        setShowMembersView(false);
                        setShowBirthdayView(false);
                      }}
                    >
                      Attendance
                    </button>

                    <button 
                      className={`nav-item ${showMembersView ? 'active' : ''}`}
                      onClick={() => {
                        setShowAttendanceView(false);
                        setShowMembersView(true);
                      }}
                    >
                      Members
                    </button>
                  </nav>
                </div>
              </>
            )}

            {showProfileView ? (
              <div className="profile-view">
                <div className="profile-settings-header">
                  <button 
                    className="back-button"
                    onClick={handleProfileBackClick}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 12H5M12 19l-7-7 7-7"/>
                    </svg>
                    <span>Back</span>
                  </button>
                  <h1 className="profile-settings-title">Profile Settings</h1>
                </div>
                
                <div className="profile-tabs">
                  <button 
                    className={`tab ${activeTab === 'account' ? 'active' : ''}`}
                    onClick={() => handleTabChange('account')}
                  >
                    Account
                  </button>
                  <button 
                    className={`tab ${activeTab === 'security' ? 'active' : ''}`}
                    onClick={() => handleTabChange('security')}
                  >
                    Security
                  </button>
                </div>

                <div className="profile-content">
                  {activeTab === 'account' && (
                    <div className="profile-section">
                      <div className="account-section">
                        <div className="account-card">
                          <h2>Profile Picture</h2>
                          <div className="avatar-section">
                            <div className="profile-avatar large">
                              {previewImage ? (
                                <img src={previewImage} alt="Profile" className="avatar-image" />
                              ) : profileData.profilePicture ? (
                                <img src={profileData.profilePicture} alt="Profile" className="avatar-image" />
                              ) : profileData.avatar}
                            </div>
                            <button 
                              className="change-avatar-btn"
                              onClick={() => fileInputRef.current.click()}
                            >
                              Change
                            </button>
                            <input
                              type="file"
                              ref={fileInputRef}
                              onChange={handleFileChange}
                              accept="image/*"
                              style={{ display: 'none' }}
                            />
                          </div>
                        </div>

                        <div className="account-card">
                          <h2>Personal Information</h2>
                          <div className="form-group">
                            <label>First Name</label>
                            <input
                              type="text"
                              value={profileData.firstName}
                              onChange={(e) => handleProfileChange('firstName', e.target.value)}
                              className="form-input"
                            />
                          </div>

                          <div className="form-group">
                            <label>Last Name</label>
                            <input
                              type="text"
                              value={profileData.lastName}
                              onChange={(e) => handleProfileChange('lastName', e.target.value)}
                              className="form-input"
                            />
                          </div>

                          <div className="form-group">
                            <label>Email Address</label>
                            <input
                              type="email"
                              value={profileData.email}
                              onChange={(e) => handleProfileChange('email', e.target.value)}
                              className="form-input"
                            />
                          </div>

                          <div className="form-group">
                            <label>Birthday</label>
                            <input
                              type="date"
                              value={profileData.birthday || ''}
                              onChange={(e) => handleProfileChange('birthday', e.target.value)}
                              className="form-input"
                            />
                          </div>
                        </div>

                        {hasChanges && (
                          <div className="button-group">
                            <button className="cancel-btn" onClick={handleCancelClick}>
                              Cancel
                            </button>
                            <button className="save-btn" onClick={handleSaveClick}>
                              Save
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'security' && (
                    <div className="profile-section">
                      <div className="security-section">
                        <div className="security-card">
                          <h2>Change Password</h2>
                          <div className="form-group">
                            <label>Current Password</label>
                            <div style={{ position: 'relative' }}>
                              <input
                                type={showCurrentPassword ? "text" : "password"}
                                className="form-input"
                                placeholder="Enter current password"
                                value={passwordData.currentPassword}
                                onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
                                style={{ paddingRight: '40px' }}
                              />
                              <button
                                type="button"
                                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                style={{
                                  position: 'absolute',
                                  right: '10px',
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: '#64748b',
                                  padding: '5px',
                                  display: 'flex',
                                  alignItems: 'center'
                                }}
                              >
                                {showCurrentPassword ? (
                                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                    <line x1="1" y1="1" x2="23" y2="23"></line>
                                  </svg>
                                ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                    <circle cx="12" cy="12" r="3"></circle>
                                  </svg>
                                )}
                              </button>
                            </div>
                          </div>
                          <div className="form-group">
                            <label>New Password</label>
                            <div style={{ position: 'relative' }}>
                              <input
                                type={showNewPassword ? "text" : "password"}
                                className="form-input"
                                placeholder="Enter new password"
                                value={passwordData.newPassword}
                                onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
                                style={{ paddingRight: '40px' }}
                              />
                              <button
                                type="button"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                style={{
                                  position: 'absolute',
                                  right: '10px',
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: '#64748b',
                                  padding: '5px',
                                  display: 'flex',
                                  alignItems: 'center'
                                }}
                              >
                                {showNewPassword ? (
                                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                    <line x1="1" y1="1" x2="23" y2="23"></line>
                                  </svg>
                                ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                    <circle cx="12" cy="12" r="3"></circle>
                                  </svg>
                                )}
                              </button>
                            </div>
                          </div>
                          <div className="form-group">
                            <label>Confirm New Password</label>
                            <div style={{ position: 'relative' }}>
                              <input
                                type={showConfirmPassword ? "text" : "password"}
                                className="form-input"
                                placeholder="Confirm new password"
                                value={passwordData.confirmPassword}
                                onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
                                style={{ paddingRight: '40px' }}
                              />
                              <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                style={{
                                  position: 'absolute',
                                  right: '10px',
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: '#64748b',
                                  padding: '5px',
                                  display: 'flex',
                                  alignItems: 'center'
                                }}
                              >
                                {showConfirmPassword ? (
                                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                    <line x1="1" y1="1" x2="23" y2="23"></line>
                                  </svg>
                                ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                    <circle cx="12" cy="12" r="3"></circle>
                                  </svg>
                                )}
                              </button>
                            </div>
                          </div>
                          <button className="save-btn" onClick={handlePasswordUpdate}>Update Password</button>
                        </div>

                        <div className="security-card">
                          <h2>Recent Login Activity</h2>
                          <div className="activity-list">
                            {loginHistory.length > 0 ? (
                              loginHistory.slice(0, 3).map((login) => {
                                const timeAgo = computeTimeAgo(login.loginTime || login.timeAgo);
                                return (
                                  <div key={login.id} className="activity-item">
                                    <div className="activity-info">
                                      <span className="activity-device">{login.device} - {login.browser}</span>
                                      <span className="activity-location">{login.location}</span>
                                      <span className="activity-time">{timeAgo}</span>
                                    </div>
                                    {login.isCurrent ? (
                                      <span className="activity-status current">Current Session</span>
                                    ) : (
                                      <span className="activity-status">Last active {timeAgo}</span>
                                    )}
                                  </div>
                                );
                              })
                            ) : (
                              <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>
                                No login history available
                              </div>
                            )}
                            {loginHistory.length > 3 && (
                              <button
                                style={{
                                  marginTop: '1rem',
                                  padding: '0.5rem 1rem',
                                  borderRadius: '8px',
                                  border: '1px solid #cbd5f5',
                                  backgroundColor: '#f8fafc',
                                  color: '#0f172a',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                                onClick={() => setShowLoginHistoryModal(true)}
                              >
                                {`See More (${loginHistory.length - 3} more)`}
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="security-card">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2>Session Management</h2>
                            {sessions.length > 2 && (
                              <button
                                style={{
                                  padding: '0.4rem 0.85rem',
                                  borderRadius: 20,
                                  border: '1px solid #cbd5f5',
                                  background: '#f1f5f9',
                                  color: '#0f172a',
                                  fontSize: '0.85rem',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                                onClick={() => setShowSessionsModal(true)}
                              >
                                View All Sessions
                              </button>
                            )}
                          </div>
                          <div className="session-list">
                            {sessions.length > 0 ? (
                              sessions.slice(0, 2).map(session => {
                                const timeAgo = computeTimeAgo(session.lastActivity || session.createdAt);
                                const isCurrent = session.sessionId === currentSessionId;
                                return (
                                  <div key={session.sessionId} className="session-item">
                                    <div className="session-info">
                                      <span className="session-device">{session.device}</span>
                                      <span className="session-location">{session.location}</span>
                                      <span className="session-time">{session.isActive ? (isCurrent ? 'Current Session' : 'Active now') : `Last active ${timeAgo}`}</span>
                                      <span className="session-ip">IP: {session.ipAddress}</span>
                                    </div>
                                    <button
                                      className="session-btn"
                                      disabled={!session.isActive || isCurrent || endingSessionId === session.sessionId}
                                      onClick={() => handleEndSession(session.sessionId)}
                                    >
                                      {endingSessionId === session.sessionId ? 'Ending…' : session.isActive ? 'End Session' : 'Inactive'}
                                    </button>
                                  </div>
                                );
                              })
                            ) : (
                              <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>
                                No other sessions detected
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            ) : showSettingsView ? (
              <div className="profile-view">
                <div className="profile-settings-header">
                  <button 
                    className="back-button"
                    onClick={handleSettingsBackClick}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 12H5M12 19l-7-7 7-7"/>
                    </svg>
                    <span>Back</span>
                  </button>
                  <h1 className="profile-settings-title">Settings</h1>
                </div>
                
                <div className="profile-content">
                  <div className="profile-section">
                    <div className="account-section">
                      <div className="account-card">
                        <h2>Church Identity</h2>
                        <div className="form-group">
                          <label>Church Logo</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
                            <div className="profile-avatar large">
                              <img src={churchLogo} alt="Church Logo" className="avatar-image" />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <button 
                                className="change-avatar-btn"
                                onClick={() => logoInputRef.current.click()}
                              >
                                Change Logo
                              </button>
                              <button 
                                className="cancel-btn"
                                onClick={handleRemoveLogo}
                                style={{ 
                                  backgroundColor: '#ef4444', 
                                  color: 'white',
                                  padding: '0.5rem 1rem',
                                  borderRadius: '8px',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontSize: '0.875rem'
                                }}
                              >
                                Remove
                              </button>
                            </div>
                            <input
                              type="file"
                              ref={logoInputRef}
                              onChange={handleLogoChange}
                              accept="image/*"
                              style={{ display: 'none' }}
                            />
                          </div>
                        </div>

                        <div className="form-group" style={{ marginTop: '1.5rem' }}>
                          <label>Header Logo (used in Admin/Manager/Member headers)</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
                            <div className="profile-avatar large">
                              <img src={headerLogo || churchLogo} alt="Header Logo" className="avatar-image" />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <button 
                                className="change-avatar-btn"
                                onClick={() => headerLogoInputRef.current.click()}
                              >
                                Change Header Logo
                              </button>
                              <button 
                                className="cancel-btn"
                                onClick={handleRemoveHeaderLogo}
                                style={{ 
                                  backgroundColor: '#ef4444', 
                                  color: 'white',
                                  padding: '0.5rem 1rem',
                                  borderRadius: '8px',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontSize: '0.875rem'
                                }}
                              >
                                Remove
                              </button>
                            </div>
                            <input
                              type="file"
                              ref={headerLogoInputRef}
                              onChange={handleHeaderLogoChange}
                              accept="image/*"
                              style={{ display: 'none' }}
                            />
                          </div>
                        </div>

                        <div className="form-group" style={{ marginTop: '1.5rem' }}>
                          <label>Church Name</label>
                          <input
                            type="text"
                            value={churchName}
                            onChange={handleChurchNameChange}
                            className="form-input"
                            placeholder="Enter church name"
                          />
                        </div>

                        <div className="form-group" style={{ marginTop: '1.5rem' }}>
                          <label>Church Address</label>
                          <textarea
                            value={churchAddress}
                            onChange={(e) => {
                              setChurchAddress(e.target.value);
                              checkChurchChanges({ churchAddress: e.target.value });
                            }}
                            className="form-input"
                            placeholder="Enter church address"
                            rows="3"
                            style={{ resize: 'vertical', fontFamily: 'inherit' }}
                          />
                        </div>

                        <div className="form-group" style={{ marginTop: '1.5rem' }}>
                          <label>Church Phone</label>
                          <input
                            type="text"
                            value={churchPhone}
                            onChange={(e) => {
                              setChurchPhone(e.target.value);
                              checkChurchChanges({ churchPhone: e.target.value });
                            }}
                            className="form-input"
                            placeholder="Enter church phone number"
                          />
                        </div>

                        <div className="form-group" style={{ marginTop: '1.5rem' }}>
                          <label>Church Email</label>
                          <input
                            type="email"
                            value={churchEmail}
                            onChange={(e) => {
                              setChurchEmail(e.target.value);
                              checkChurchChanges({ churchEmail: e.target.value });
                            }}
                            className="form-input"
                            placeholder="Enter church email"
                          />
                        </div>
                      </div>

                      <div className="account-card" style={{ marginTop: '1.5rem' }}>
                        <h2>Homepage Images</h2>
                        <p style={{ marginTop: '0.5rem', color: '#64748b', fontSize: '0.9rem' }}>
                          Customize the floating images displayed on your church homepage.
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem', marginTop: '1.5rem' }}>
                          {[0, 1, 2, 3, 4, 5].map((index) => {
                            const imageValues = [homepageImage1, homepageImage2, homepageImage3, homepageImage4, homepageImage5, homepageImage6];
                            const imageRefs = [homepageImage1Ref, homepageImage2Ref, homepageImage3Ref, homepageImage4Ref, homepageImage5Ref, homepageImage6Ref];
                            const imageValue = imageValues[index];
                            const imageRef = imageRefs[index];
                            return (
                              <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#1e293b' }}>
                                  Image {index + 1}
                                </label>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                                  <div className="profile-avatar large">
                                    <img 
                                      src={imageValue || `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Crect fill='%23e2e8f0' width='120' height='120'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2394a3b8' font-size='14'%3ENo Image%3C/text%3E%3C/svg%3E`} 
                                      alt={`Homepage Image ${index + 1}`} 
                                      className="avatar-image" 
                                    />
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                                    <button 
                                      className="change-avatar-btn"
                                      onClick={() => imageRef.current?.click()}
                                    >
                                      Change Image
                                    </button>
                                    <button 
                                      className="cancel-btn"
                                      onClick={() => handleRemoveHomepageImage(index)}
                                      disabled={!imageValue}
                                      style={{ 
                                        backgroundColor: '#ef4444', 
                                        color: 'white',
                                        padding: '0.5rem 1rem',
                                        borderRadius: '8px',
                                        border: 'none',
                                        cursor: imageValue ? 'pointer' : 'not-allowed',
                                        fontSize: '0.875rem',
                                        opacity: imageValue ? 1 : 0.5
                                      }}
                                    >
                                      Remove
                                    </button>
                                    <input
                                      type="file"
                                      ref={imageRef}
                                      onChange={(e) => handleHomepageImageChange(index, e)}
                                      accept="image/*"
                                      style={{ display: 'none' }}
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="account-card" style={{ marginTop: '1.5rem' }}>
                        <h2>Homepage Hero Text</h2>
                        <p style={{ marginTop: '0.5rem', color: '#64748b', fontSize: '0.9rem' }}>
                          Set the main headline and supporting message shown on your homepage hero section.
                        </p>
                        <div className="form-group" style={{ marginTop: '1rem' }}>
                          <label>Hero Title</label>
                          <textarea
                            value={homepageHeroTitle}
                            onChange={handleHomepageHeroTitleChange}
                            className="form-input"
                            placeholder="Enter homepage hero title"
                            rows={3}
                            style={{ resize: 'vertical' }}
                          />
                          <small style={{ display: 'block', marginTop: '0.5rem', color: '#64748b' }}>
                            Tip: Use <code>Shift + Enter</code> for line breaks.
                          </small>
                        </div>
                        <div className="form-group" style={{ marginTop: '1rem' }}>
                          <label>Hero Subtitle</label>
                          <textarea
                            value={homepageHeroSubtitle}
                            onChange={handleHomepageHeroSubtitleChange}
                            className="form-input"
                            placeholder="Enter homepage hero subtitle"
                            rows={2}
                            style={{ resize: 'vertical' }}
                          />
                        </div>
                      </div>

                      <div className="account-card" style={{ marginTop: '1.5rem' }}>
                        <h2>Help Center</h2>
                        <p style={{ marginTop: '0.5rem', color: '#64748b', fontSize: '0.9rem' }}>
                          Provide contact details members can use when they need assistance.
                        </p>
                        <div className="form-group" style={{ marginTop: '1rem' }}>
                          <label>Support Email</label>
                          <input
                            type="email"
                            value={helpCenterEmail}
                            onChange={handleHelpCenterEmailChange}
                            className="form-input"
                            placeholder="support@yourchurch.com"
                          />
                        </div>
                        <div className="form-group" style={{ marginTop: '1rem' }}>
                          <label>Contact Number</label>
                          <input
                            type="tel"
                            value={helpCenterPhone}
                            onChange={handleHelpCenterPhoneChange}
                            className="form-input"
                            placeholder="(+63) 900 000 0000"
                          />
                        </div>
                        <div className="form-group" style={{ marginTop: '1rem' }}>
                          <label>Help Center Link</label>
                          <input
                            type="url"
                            value={helpCenterUrl}
                            onChange={handleHelpCenterUrlChange}
                            className="form-input"
                            placeholder="https://yourchurch.com/help"
                          />
                        </div>
                      </div>

                      {isAdmin && (
                        <div ref={manageUsersSectionRef} className="account-card password-reset-card">
                          <div className="password-reset-card-header">
                            <div className="password-reset-header-text">
                              <h2>Manage User Password Resets</h2>
                              <p>
                                Review pending reset requests submitted by members, generate temporary passwords, and keep track of completed resets.
                              </p>
                            </div>
                            <div className="password-reset-actions">
                              <button
                                type="button"
                                className="password-reset-refresh"
                                disabled={passwordResetLoading}
                                onClick={() => fetchPasswordResetRequests()}
                              >
                                {passwordResetLoading ? 'Refreshing…' : 'Refresh'}
                              </button>
                            </div>
                          </div>

                          {passwordResetError && (
                            <div className="password-reset-error">
                              {passwordResetError}
                            </div>
                          )}

                          <div className="password-reset-list">
                            {passwordResetRequests.length === 0 ? (
                              <div className="password-reset-empty-card">
                                {passwordResetLoading ? 'Loading requests…' : 'No password reset requests found.'}
                              </div>
                            ) : (
                              passwordResetRequests.slice(0, 3).map((request) => (
                                <div key={request.id} className="password-reset-item">
                                  <div className="password-reset-item-header">
                                    <div className="password-reset-item-primary">
                                      <span className="password-reset-member-name">{request.member_name || `Member #${request.member_id}`}</span>
                                      {request.email && <span className="password-reset-member-email">{request.email}</span>}
                                    </div>
                                    <span className={`status-pill status-${request.status}`}>
                                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                                    </span>
                                  </div>

                                  <div className="password-reset-item-details">
                                    <div>
                                      <span className="password-reset-detail-label">Username</span>
                                      <span className="password-reset-detail-value">{request.username}</span>
                                    </div>
                                    <div>
                                      <span className="password-reset-detail-label">Contact</span>
                                      <span className="password-reset-detail-value">{request.contact_number || '—'}</span>
                                    </div>
                                    <div>
                                      <span className="password-reset-detail-label">Requested</span>
                                      <span className="password-reset-detail-value">{formatDateTime(request.requested_at)}</span>
                                    </div>
                                    <div>
                                      <span className="password-reset-detail-label">Processed</span>
                                      <span className="password-reset-detail-value">{request.processed_at ? formatDateTime(request.processed_at) : '—'}</span>
                                    </div>
                                  </div>

                                  <div className="password-reset-item-actions">
                                    {request.status === 'pending' ? (
                                      <button
                                        type="button"
                                        className="password-reset-primary"
                                        onClick={() => openPasswordResetModal(request)}
                                      >
                                        Generate Temp Password
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        className="password-reset-secondary"
                                        onClick={() => openPasswordResetModal(request)}
                                      >
                                        View Details
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>

                          {passwordResetRequests.length > 3 && (
                            <button
                              type="button"
                              className="password-reset-view-all"
                              onClick={() => setShowAllPasswordResets(true)}
                            >
                              View all requests
                            </button>
                          )}
                        </div>
                      )}

                      <div className="account-card" style={{ marginTop: '1.5rem' }}>
                        <h2>System Maintenance</h2>
                        <p style={{ marginTop: '0.5rem', color: '#64748b', fontSize: '0.9rem' }}>
                          Run a manual cleanup to remove expired verification codes, stale sessions, and outdated logs.
                        </p>
                        <div className="maintenance-actions">
                          <button
                            className={`save-btn maintenance-run-btn${isMaintenanceRunning ? ' loading' : ''}`}
                            onClick={handleRunMaintenance}
                            disabled={isMaintenanceRunning}
                          >
                            {isMaintenanceRunning ? 'Running Maintenance…' : 'Run Maintenance'}
                          </button>
                          <p className="maintenance-note">This operation is safe to run anytime.</p>
                        </div>
                        {maintenanceError && (
                          <div className="maintenance-status maintenance-status-error">
                            {maintenanceError}
                          </div>
                        )}
                        {maintenanceResult && (
                          <div className="maintenance-summary">
                            <div className="maintenance-summary-header">
                              Last run: {formatMaintenanceTimestamp(maintenanceResult.ranAt)}
                            </div>
                            {Array.isArray(maintenanceResult.tasks) && maintenanceResult.tasks.length > 0 && (
                              <ul>
                                {maintenanceResult.tasks.map((task) => (
                                  <li key={task.name}>
                                    {task.name}:&nbsp;
                                    {task.skipped ? (
                                      <span className="maintenance-task-skipped">Skipped</span>
                                    ) : (
                                      <span className="maintenance-task-count">{task.deleted} removed</span>
                                    )}
                                    {task.message && (
                                      <span className="maintenance-task-note"> — {task.message}</span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                            <div className="maintenance-summary-total">
                              Total removed: <strong>{maintenanceResult.totalDeleted ?? 0}</strong>
                            </div>
                          </div>
                        )}
                      </div>

                      {hasChurchChanges && (
                        <div className="button-group" style={{ marginTop: '1.5rem' }}>
                          <button className="cancel-btn" onClick={handleChurchCancel}>
                            Cancel
                          </button>
                          <button className="save-btn" onClick={handleChurchSave}>
                            Save Changes
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="dashboard-content">
                {showAttendanceView ? (
                  <AttendanceManagement dateFormat={dateFormat} onEventsChange={setEvents} />
                ) : showMembersView ? (
                  <MembersManagement dateFormat={dateFormat} />
                ) : (
                  <>
                    <div className="new-dashboard-container">
                      {/* Top Stats Cards */}
                      <div className="new-stats-grid">
                        <div className="new-stat-card">
                          <div className="stat-icon users-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                              <circle cx="9" cy="7" r="4"></circle>
                              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                            </svg>
                          </div>
                          <div className="stat-content">
                            <div className="stat-title">Total Members</div>
                            <div className="stat-number">{stats.totalMembers}</div>
                            <div className="stat-subtitle">Active: {stats.activeMembers}</div>
                          </div>
                        </div>

                        <div className="new-stat-card">
                          <div className="stat-icon clock-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10"></circle>
                              <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                          </div>
                          <div className="stat-content">
                            <div className="stat-title">Today's Attendance</div>
                            <div className="stat-number">{stats.todayAttendance}</div>
                            <div className="stat-subtitle stat-positive">↑{stats.todayRate}% Rate</div>
                          </div>
                        </div>

                        <div className="new-stat-card">
                          <div className="stat-icon trending-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                              <polyline points="17 6 23 6 23 12"></polyline>
                            </svg>
                          </div>
                          <div className="stat-content">
                            <div className="stat-title">Weekly Average</div>
                            <div className="stat-number">{stats.weeklyAttendance}%</div>
                            <div className="stat-subtitle">Stable</div>
                          </div>
                        </div>

                        <div className="new-stat-card">
                          <div className="stat-icon calendar-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                              <line x1="16" y1="2" x2="16" y2="6"></line>
                              <line x1="8" y1="2" x2="8" y2="6"></line>
                              <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                          </div>
                          <div className="stat-content">
                            <div className="stat-title">This Week</div>
                            <div className="stat-number">{stats.weekAttendance}</div>
                            <div className="stat-subtitle">Total</div>
                          </div>
                        </div>
                      </div>

                      {/* Main Content Grid - Simple 2 Column */}
                      <div className="dashboard-simple-grid">
                        {/* Left Column */}
                        <div className="dashboard-left">
                          {/* Upcoming Birthdays */}
                          <div className="chart-card-new">
                            <div className="card-header-with-link">
                              <h3>🎂 Upcoming Birthdays</h3>
                              <button className="view-all-link" onClick={() => {
                                setShowMembersView(true);
                                // Set birthdays tab in session storage
                                if (window.sessionStorage) {
                                  window.sessionStorage.setItem('activeTab', 'birthdays');
                                }
                              }}>View All ›</button>
                            </div>
                            <div className="birthdays-list">
                              {upcomingBirthdays.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748B' }}>
                                  No upcoming birthdays
                                </div>
                              ) : (
                                upcomingBirthdays.map((birthday) => {
                                  const profilePath = birthday.profilePicture || birthday.profile_picture;
                                  const avatarUrl = profilePath
                                    ? `${window.location.origin}/api/uploads/get_profile_picture.php?path=${profilePath.replace('/uploads/profile_pictures/', '')}`
                                    : null;
                                  return (
                                    <div key={birthday.id} className="birthday-item">
                                      <div className="birthday-avatar">
                                        {avatarUrl ? (
                                          <img
                                            src={avatarUrl}
                                            alt={birthday.name}
                                            onError={(e) => {
                                              e.currentTarget.style.display = 'none';
                                              e.currentTarget.parentElement.classList.add('fallback');
                                              e.currentTarget.parentElement.textContent = birthday.initials;
                                            }}
                                          />
                                        ) : (
                                          <span>{birthday.initials}</span>
                                        )}
                                      </div>
                                      <div className="birthday-info">
                                        <div className="birthday-name">{birthday.name}</div>
                                        <div className="birthday-date">{birthday.date}</div>
                                      </div>
                                      <div className="birthday-badge">
                                        {birthday.daysUntil === 0 ? 'Today' : `${birthday.daysUntil} ${birthday.daysUntil === 1 ? 'day' : 'days'}`}
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>

                          {/* Member Growth Trend */}
                          <div className="chart-card-new">
                            <h3>Member Growth Trend</h3>
                            <div className="growth-chart-container">
                              <div className="growth-chart-wrapper">
                                <div className="growth-line-chart">
                                  <svg viewBox="0 0 400 200" className="line-chart-svg">
                                    <defs>
                                      <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                        <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3"/>
                                        <stop offset="100%" stopColor="#3B82F6" stopOpacity="0"/>
                                      </linearGradient>
                                    </defs>
                                    {memberGrowthData.length > 0 && (() => {
                                      const maxCount = Math.max(...memberGrowthData.map(d => d.count), 1);
                                      const numPoints = memberGrowthData.length;
                                      const segmentWidth = 400 / (numPoints - 1);
                                      const points = memberGrowthData.map((d, i) => {
                                        const x = i * segmentWidth;
                                        const y = 180 - ((d.count / maxCount) * 160);
                                        return { x, y, count: d.count };
                                      });
                                      
                                      const linePath = points.map((p, i) => 
                                        `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
                                      ).join(' ');
                                      
                                      const lastPoint = points[points.length - 1];
                                      const firstPoint = points[0];
                                      const areaPath = `${linePath} L ${lastPoint.x} 200 L ${firstPoint.x} 200 Z`;
                                      
                                      return (
                                        <>
                                          <path d={areaPath} fill="url(#lineGradient)"/>
                                          <path d={linePath} stroke="#3B82F6" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                                          {points.map((p, i) => (
                                            <circle key={i} cx={p.x} cy={p.y} r="5" fill="#3B82F6"/>
                                          ))}
                                        </>
                                      );
                                    })()}
                                  </svg>
                                </div>
                                <div className="growth-chart-labels">
                                  {memberGrowthData.map((d, i) => (
                                    <span key={i}>{d.month}</span>
                                  ))}
                                </div>
                              </div>
                              <div className="growth-stats">
                                <div className="growth-stat-item">
                                  <div className="growth-stat-value">+{growthStats.newMembers}</div>
                                  <div className="growth-stat-label">New Members</div>
                                </div>
                                <div className="growth-stat-item">
                                  <div className="growth-stat-value">{growthStats.growthRate}%</div>
                                  <div className="growth-stat-label">Growth Rate</div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Quick Actions */}
                          <div className="chart-card-new">
                            <h3>Quick Actions</h3>
                            <div className="quick-actions-grid">
                              <button className="action-btn member-btn" onClick={() => setShowMembersView(true)}>
                                <span>+ Member</span>
                              </button>
                              <button className="action-btn report-btn" onClick={() => {
                                setShowReportModal(true);
                                generateReport();
                              }}>
                                <span>📊 Report</span>
                              </button>
                              <button className="action-btn schedule-btn" onClick={() => {
                                setShowScheduleModal(true);
                              }}>
                                <span>📅 Schedule</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Right Column */}
                        <div className="dashboard-right">
                          {/* Weekly Attendance Trend */}
                          <div className="chart-card-new">
                            <h3>Weekly Attendance Trend</h3>
                            <div className="bar-chart-container">
                              <div className="bar-chart-wrapper">
                                {weeklyAttendanceData.length > 0 ? (
                                  weeklyAttendanceData.map((day, index) => {
                                    const maxCount = Math.max(...weeklyAttendanceData.map(d => d.count), 1);
                                    const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
                                    return (
                                      <div key={index} className="bar-item">
                                        <div className="bar" style={{ height: `${height}%` }}></div>
                                        <span className="bar-label">{day.day}</span>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <>
                                    <div className="bar-item">
                                      <div className="bar" style={{ height: '0%' }}></div>
                                      <span className="bar-label">Sun</span>
                                    </div>
                                    <div className="bar-item">
                                      <div className="bar" style={{ height: '0%' }}></div>
                                      <span className="bar-label">Mon</span>
                                    </div>
                                    <div className="bar-item">
                                      <div className="bar" style={{ height: '0%' }}></div>
                                      <span className="bar-label">Tue</span>
                                    </div>
                                    <div className="bar-item">
                                      <div className="bar" style={{ height: '0%' }}></div>
                                      <span className="bar-label">Wed</span>
                                    </div>
                                    <div className="bar-item">
                                      <div className="bar" style={{ height: '0%' }}></div>
                                      <span className="bar-label">Thu</span>
                                    </div>
                                    <div className="bar-item">
                                      <div className="bar" style={{ height: '0%' }}></div>
                                      <span className="bar-label">Fri</span>
                                    </div>
                                    <div className="bar-item">
                                      <div className="bar" style={{ height: '0%' }}></div>
                                      <span className="bar-label">Sat</span>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Service Attendance */}
                          <div className="chart-card-new">
                            <h3>Service Attendance</h3>
                            <div className="donut-chart-container">
                              {serviceAttendanceData.length > 0 ? (
                                <>
                                  <svg viewBox="0 0 200 200" className="donut-chart">
                                    {(() => {
                                      const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
                                      const circumference = 2 * Math.PI * 80;
                                      let currentOffset = 0;
                                      
                                      return serviceAttendanceData.map((service, index) => {
                                        const dashArray = (service.percentage / 100) * circumference;
                                        const offset = -currentOffset;
                                        currentOffset += dashArray;
                                        
                                        return (
                                          <circle
                                            key={index}
                                            cx="100"
                                            cy="100"
                                            r="80"
                                            fill="none"
                                            stroke={colors[index % colors.length]}
                                            strokeWidth="30"
                                            strokeDasharray={`${dashArray} ${circumference}`}
                                            strokeDashoffset={offset}
                                          />
                                        );
                                      });
                                    })()}
                                  </svg>
                                  <div className="donut-legend">
                                    {serviceAttendanceData.map((service, index) => {
                                      const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
                                      return (
                                        <div key={index} className="legend-item-new">
                                          <span className="legend-dot" style={{ backgroundColor: colors[index % colors.length] }}></span>
                                          <span className="legend-text">{service.type}</span>
                                          <span className="legend-percent">{service.percentage}%</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </>
                              ) : (
                                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748B' }}>
                                  No service attendance data yet
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Recent Records */}
                          <div className="chart-card-new">
                            <div className="card-header-with-link">
                              <h3>Recent Records</h3>
                              <button className="view-all-link" onClick={() => setShowAttendanceView(true)}>View All ›</button>
                            </div>
                            <div className="records-list">
                              {recentRecords.length > 0 ? (
                                recentRecords.map((record) => (
                                  <div key={record.id} className="record-item">
                                    <div className="record-info">
                                      <div className="record-date">{record.date}</div>
                                      <div className="record-service">{record.title}</div>
                                    </div>
                                    <div className="record-count">{record.attendeeCount}</div>
                                  </div>
                                ))
                              ) : (
                                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748B' }}>
                                  No recent records yet
                                </div>
                              )}
                            </div>
                          </div>

                        </div>
                      </div>

                    </div>
                  </>
                )}
              </div>
            )}
          </div> {/* dashboard-content */}
        </div> {/* content-wrapper */}
      </div> {/* main-content */}

      {showSaveModal && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1010
        }}>
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '400px'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h3 style={{ margin: 0 }}>Save Changes</h3>
            </div>
            <p style={{ marginBottom: '20px', color: '#666', textAlign: 'center' }}>
              Are you sure you want to save these changes to your profile?
            </p>
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button
                onClick={handleSaveModalClose}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  background: 'white',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSave}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  background: '#10b981',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1010
        }}>
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '400px'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h3 style={{ margin: 0 }}>Discard Changes</h3>
            </div>
            <p style={{ marginBottom: '20px', color: '#666', textAlign: 'center' }}>
              Are you sure you want to discard all changes? This action cannot be undone.
            </p>
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button
                onClick={handleCancelModalClose}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  background: 'white',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCancel}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  background: '#10b981',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1010
        }}>
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '400px'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h3 style={{ margin: 0 }}>Update Password</h3>
            </div>
            <p style={{ marginBottom: '20px', color: '#666', textAlign: 'center' }}>
              Are you sure you want to update your password?
            </p>
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button
                onClick={() => setShowPasswordModal(false)}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  background: 'white',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPasswordUpdate}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  background: '#10b981',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {showLoginHistoryModal && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1010
        }}
        onClick={() => setShowLoginHistoryModal(false)}
        >
          <div style={{
            background: 'white',
            padding: '24px',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '560px',
            maxHeight: '75vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 40px rgba(15, 23, 42, 0.25)'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>Full Login History</h3>
              <button
                onClick={() => setShowLoginHistoryModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  color: '#64748b'
                }}
              >
                ×
              </button>
            </div>
            <div style={{ overflowY: 'auto', paddingRight: '0.5rem', gap: '0.75rem', display: 'flex', flexDirection: 'column' }}>
              {paginatedLoginHistory.length > 0 ? (
                paginatedLoginHistory.map((login) => {
                  const timeAgo = computeTimeAgo(login.loginTime || login.timeAgo);
                  return (
                    <div key={login.id} style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '0.9rem 1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem',
                      background: '#f8fafc'
                    }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{login.device} • {login.browser}</div>
                      <div style={{ fontSize: '0.9rem', color: '#475569' }}>{login.location}</div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{login.loginTime}</div>
                      <div style={{ fontSize: '0.85rem', color: login.isCurrent ? '#10b981' : '#64748b' }}>
                        {login.isCurrent ? 'Current Session' : `Last active ${timeAgo}`}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>
                  No login history available.
                </div>
              )}
            </div>

            {totalLoginHistoryPages > 1 && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '1rem'
              }}>
                <span style={{ color: '#64748b', fontSize: '0.9rem' }}>
                  Page {loginHistoryPage + 1} of {totalLoginHistoryPages}
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => setLoginHistoryPage((prev) => Math.max(0, prev - 1))}
                    disabled={loginHistoryPage === 0}
                    style={{
                      padding: '0.4rem 0.9rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5f5',
                      background: loginHistoryPage === 0 ? '#e2e8f0' : '#f8fafc',
                      color: '#0f172a',
                      fontWeight: 600,
                      cursor: loginHistoryPage === 0 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setLoginHistoryPage((prev) => Math.min(totalLoginHistoryPages - 1, prev + 1))}
                    disabled={loginHistoryPage >= totalLoginHistoryPages - 1}
                    style={{
                      padding: '0.4rem 0.9rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5f5',
                      background: loginHistoryPage >= totalLoginHistoryPages - 1 ? '#e2e8f0' : '#f8fafc',
                      color: '#0f172a',
                      fontWeight: 600,
                      cursor: loginHistoryPage >= totalLoginHistoryPages - 1 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showSessionsModal && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1010
        }}
        onClick={() => setShowSessionsModal(false)}
        >
          <div style={{
            background: 'white',
            padding: '24px',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '520px',
            maxHeight: '70vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 40px rgba(15, 23, 42, 0.25)'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>All Sessions</h3>
              <button
                onClick={() => setShowSessionsModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  color: '#64748b'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ overflowY: 'auto', paddingRight: '0.5rem', gap: '0.75rem', display: 'flex', flexDirection: 'column' }}>
              {paginatedSessions.length > 0 ? (
                paginatedSessions.map(session => {
                  const timeAgo = computeTimeAgo(session.lastActivity || session.createdAt);
                  const isCurrent = session.sessionId === currentSessionId;
                  return (
                    <div key={session.sessionId} style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '1rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '1rem',
                      background: '#f8fafc'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{session.device}</div>
                        <div style={{ fontSize: '0.9rem', color: '#475569' }}>{session.location} • IP: {session.ipAddress}</div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{session.createdAt}</div>
                        <div style={{ fontSize: '0.85rem', color: session.isActive ? '#10b981' : '#64748b' }}>
                          {session.isActive ? (isCurrent ? 'Current Session' : 'Active now') : `Last active ${timeAgo}`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <button
                          className="session-btn"
                          disabled={!session.isActive || isCurrent || endingSessionId === session.sessionId}
                          onClick={() => handleEndSession(session.sessionId)}
                          style={{ minWidth: '120px' }}
                        >
                          {isCurrent ? 'Current' : endingSessionId === session.sessionId ? 'Ending…' : session.isActive ? 'End Session' : 'Inactive'}
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b' }}>
                  No sessions found.
                </div>
              )}
            </div>

            {totalSessionsPages > 1 && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '1rem'
              }}>
                <span style={{ color: '#64748b', fontSize: '0.9rem' }}>
                  Page {sessionsPage + 1} of {totalSessionsPages}
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => setSessionsPage((prev) => Math.max(0, prev - 1))}
                    disabled={sessionsPage === 0}
                    style={{
                      padding: '0.4rem 0.9rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5f5',
                      background: sessionsPage === 0 ? '#e2e8f0' : '#f8fafc',
                      color: '#0f172a',
                      fontWeight: 600,
                      cursor: sessionsPage === 0 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setSessionsPage((prev) => Math.min(totalSessionsPages - 1, prev + 1))}
                    disabled={sessionsPage >= totalSessionsPages - 1}
                    style={{
                      padding: '0.4rem 0.9rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5f5',
                      background: sessionsPage >= totalSessionsPages - 1 ? '#e2e8f0' : '#f8fafc',
                      color: '#0f172a',
                      fontWeight: 600,
                      cursor: sessionsPage >= totalSessionsPages - 1 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showLeaderboardModal && (
        <div className="modal-overlay" onClick={handleLeaderboardModalClose}>
          <div className="modal-content leaderboard-modal">
            <div className="modal-header">
              <h2 className="modal-title">Church Engagement Leaderboard</h2>
              <button 
                className="modal-close-btn"
                onClick={() => setShowLeaderboardModal(false)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"></path>
                </svg>
              </button>
            </div>
            <div className="leaderboard-list">
              {allMembers.map((member, index) => (
                <div key={index} className="leaderboard-item">
                  <div className="rank">{getInitials(member.name)}</div>
                  <div className="member-info">
                    <span className="member-name">{member.name}</span>
                    <span className="score-value">{member.score}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showAllPasswordResets && (
        <div className="modal-overlay" onClick={() => setShowAllPasswordResets(false)}>
          <div className="modal-content-large password-reset-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>All Password Reset Requests</h2>
              <button className="modal-close" onClick={() => setShowAllPasswordResets(false)}>×</button>
            </div>
            <div className="password-reset-modal-body">
              <div className="password-reset-list password-reset-list--modal">
                {passwordResetRequests.length === 0 ? (
                  <div className="password-reset-empty-card">
                    {passwordResetLoading ? 'Loading requests…' : 'No password reset requests found.'}
                  </div>
                ) : (
                  passwordResetRequests.map((request) => (
                    <div key={request.id} className="password-reset-item">
                      <div className="password-reset-item-header">
                        <div className="password-reset-item-primary">
                          <span className="password-reset-member-name">{request.member_name || `Member #${request.member_id}`}</span>
                          {request.email && <span className="password-reset-member-email">{request.email}</span>}
                        </div>
                        <span className={`status-pill status-${request.status}`}>
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </span>
                      </div>

                      <div className="password-reset-item-details">
                        <div>
                          <span className="password-reset-detail-label">Username</span>
                          <span className="password-reset-detail-value">{request.username}</span>
                        </div>
                        <div>
                          <span className="password-reset-detail-label">Contact</span>
                          <span className="password-reset-detail-value">{request.contact_number || '—'}</span>
                        </div>
                        <div>
                          <span className="password-reset-detail-label">Requested</span>
                          <span className="password-reset-detail-value">{formatDateTime(request.requested_at)}</span>
                        </div>
                        <div>
                          <span className="password-reset-detail-label">Processed</span>
                          <span className="password-reset-detail-value">{request.processed_at ? formatDateTime(request.processed_at) : '—'}</span>
                        </div>
                      </div>

                      <div className="password-reset-item-actions">
                        {request.status === 'pending' ? (
                          <button
                            type="button"
                            className="password-reset-primary"
                            onClick={() => {
                              setShowAllPasswordResets(false);
                              openPasswordResetModal(request);
                            }}
                          >
                            Generate Temp Password
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="password-reset-secondary"
                            onClick={() => {
                              setShowAllPasswordResets(false);
                              openPasswordResetModal(request);
                            }}
                          >
                            View Details
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showPasswordResetModal && selectedPasswordReset && (
        <div className="modal-overlay" onClick={closePasswordResetModal}>
          <div className="modal-content-large password-reset-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Password Reset Request</h2>
              <button className="modal-close" onClick={closePasswordResetModal}>×</button>
            </div>
            <div className="password-reset-modal-body">
              {passwordResetModalError && (
                <div className="password-reset-alert password-reset-alert--error">
                  {passwordResetModalError}
                </div>
              )}

              <section className="password-reset-section password-reset-section--request">
                <div className="password-reset-request-header">
                  <div className="password-reset-request-info">
                    <span className="password-reset-chip">Member</span>
                    <h3 className="password-reset-request-name">{selectedPasswordReset.member_name || `Member #${selectedPasswordReset.member_id}`}</h3>
                    <span className="password-reset-request-username">@{selectedPasswordReset.username}</span>
                  </div>
                  <div className="password-reset-request-status">
                    <span className={`status-pill status-${selectedPasswordReset.status}`}>
                      {selectedPasswordReset.status.charAt(0).toUpperCase() + selectedPasswordReset.status.slice(1)}
                    </span>
                  </div>
                </div>

                <div className="password-reset-meta-grid">
                  <div className="password-reset-meta-item">
                    <span className="password-reset-meta-label">Contact</span>
                    <span className="password-reset-meta-value">{selectedPasswordReset.contact_number || '—'}</span>
                  </div>
                  <div className="password-reset-meta-item">
                    <span className="password-reset-meta-label">Requested</span>
                    <span className="password-reset-meta-value">{formatDateTime(selectedPasswordReset.requested_at)}</span>
                  </div>
                  <div className="password-reset-meta-item">
                    <span className="password-reset-meta-label">Processed</span>
                    <span className="password-reset-meta-value">{selectedPasswordReset.processed_at ? formatDateTime(selectedPasswordReset.processed_at) : '—'}</span>
                  </div>
                </div>
              </section>

              <section className="password-reset-section password-reset-section--response">
                <div className="password-reset-section-header">
                  <h3>Admin Response</h3>
                  <p>Set how long the temporary password will remain valid.</p>
                </div>

                <div className="password-reset-field-group password-reset-field-group--inline">
                  <label htmlFor="password-reset-expiry">Temporary password expiry (hours)</label>
                  <input
                    id="password-reset-expiry"
                    type="number"
                    min={1}
                    max={168}
                    value={passwordResetExpiryHours}
                    onChange={(e) => setPasswordResetExpiryHours(Math.max(1, Number(e.target.value) || 1))}
                  />
                </div>
              </section>

              {generatedTempPassword && (
                <section className="password-reset-section password-reset-section--generated">
                  <div className="password-reset-generated-card">
                    <div className="password-reset-generated-header">Temporary password generated</div>
                    <div className="password-reset-generated-value">{generatedTempPassword}</div>
                    <div className="password-reset-generated-meta">
                      Expires at {generatedTempExpiry ? formatDateTime(generatedTempExpiry) : '—'}
                    </div>
                    <div className="password-reset-generated-actions">
                      <button type="button" className="password-reset-primary" onClick={handleCopyTempPassword}>
                        Copy password
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {selectedPasswordReset.status !== 'pending' && (
                <div className="password-reset-processed-note">
                  This reset request has already been processed. Generate is disabled.
                </div>
              )}

              <div className="password-reset-modal-actions">
                <button type="button" className="cancel-btn" onClick={closePasswordResetModal}>
                  Close
                </button>
                {selectedPasswordReset.status === 'pending' && (
                  <button
                    type="button"
                    className="save-btn"
                    onClick={handleGenerateTemporaryPassword}
                    disabled={isGeneratingTempPassword}
                  >
                    {isGeneratingTempPassword ? 'Generating…' : 'Generate Temp Password'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showSignOutModal && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '400px'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h3 style={{ margin: 0 }}>Sign Out</h3>
            </div>
            <p style={{ marginBottom: '20px', color: '#666', textAlign: 'center' }}>
              Are you sure you want to sign out?
            </p>
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button
                onClick={() => setShowSignOutModal(false)}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  background: 'white',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSignOut}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  background: '#10b981',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="modal-content-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📊 Attendance Report</h2>
              <button className="modal-close" onClick={() => setShowReportModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {/* Date Range Picker */}
              <div className="date-range-picker">
                <div className="date-input-group">
                  <label>Start Date:</label>
                  <input 
                    type="date" 
                    value={reportStartDate}
                    onChange={(e) => setReportStartDate(e.target.value)}
                  />
                </div>
                <div className="date-input-group">
                  <label>End Date:</label>
                  <input 
                    type="date" 
                    value={reportEndDate}
                    onChange={(e) => setReportEndDate(e.target.value)}
                  />
                </div>
                <button className="btn-primary" onClick={generateReport}>
                  🔄 Generate
                </button>
              </div>

              {reportData && (
                <>
                  <div className="report-summary">
                    {reportSummaryMetrics.map((metric) => (
                      <div key={metric.label} className="report-summary-metric">
                        <span className="report-summary-metric-label">{metric.label}:</span>
                        <span className="report-summary-metric-value">{metric.value}</span>
                      </div>
                    ))}
                  </div>
              
              <div className="report-table-container">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Service</th>
                      <th className="numeric-col">Total</th>
                      <th className="numeric-col">Members</th>
                      <th className="numeric-col">Guests</th>
                      <th className="numeric-col">Member %</th>
                      <th className="numeric-col">Guest %</th>
                      <th className="wide-col">Last Check-in</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.records.map((record) => (
                      <tr key={record.eventId}>
                        <td>{formatReportDateLabel(record.date)}</td>
                        <td>{formatReportTimeLabel(record.time)}</td>
                        <td>{record.title}</td>
                        <td className="numeric-col">{renderCountPill(record.totalCheckins, 'total')}</td>
                        <td className="numeric-col">{renderCountPill(record.memberCheckins, 'member')}</td>
                        <td className="numeric-col">{renderCountPill(record.guestCheckins, 'guest')}</td>
                        <td className="numeric-col">{computePercentLabel(record.memberCheckins, record.totalCheckins)}</td>
                        <td className="numeric-col">{computePercentLabel(record.guestCheckins, record.totalCheckins)}</td>
                        <td className="wide-col">
                          {(() => {
                            const { name, timestamp } = formatLastCheckinDisplay(record);
                            return (
                              <div className="last-checkin-cell">
                                <span className="last-checkin-name">{name || '—'}</span>
                                {timestamp && <span className="last-checkin-time">{timestamp}</span>}
                              </div>
                            );
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
                  <div className="report-actions">
                    <button className="btn-primary" onClick={exportReportXlsx}>
                      📥 Download XLSX
                    </button>
                    <button className="btn-primary" onClick={exportReportPdf} style={{ marginLeft: '10px' }}>
                      📄 Download PDF
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="modal-overlay" onClick={() => setShowScheduleModal(false)}>
          <div className="modal-content-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📅 Event Schedule</h2>
              <button className="modal-close" onClick={() => setShowScheduleModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="calendar-header">
                <button onClick={() => {
                  const newMonth = currentMonth === 1 ? 12 : currentMonth - 1;
                  const newYear = currentMonth === 1 ? currentYear - 1 : currentYear;
                  setCurrentMonth(newMonth);
                  setCurrentYear(newYear);
                }}>← Prev</button>
                <h3>{new Date(currentYear, currentMonth - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
                <button onClick={() => {
                  const newMonth = currentMonth === 12 ? 1 : currentMonth + 1;
                  const newYear = currentMonth === 12 ? currentYear + 1 : currentYear;
                  setCurrentMonth(newMonth);
                  setCurrentYear(newYear);
                }}>Next →</button>
              </div>
              
              <div className="events-list-calendar">
                {calendarEvents.length > 0 ? (
                  calendarEvents.map((event) => {
                    const eventDate = event.eventDateTime ? new Date(event.eventDateTime) : (event.date ? new Date(`${event.date}T00:00:00`) : null);
                    const now = new Date();
                    const statusLabel = (() => {
                      const rawStatus = event.status ? event.status.toLowerCase() : '';
                      if (rawStatus === 'active') {
                        return 'Active';
                      }
                      if (rawStatus === 'completed') {
                        return 'Completed';
                      }
                      if (!eventDate) {
                        return event.status || 'Scheduled';
                      }
                      if (eventDate.getTime() < now.getTime()) {
                        return rawStatus === 'cancelled' ? 'Cancelled' : 'Past';
                      }
                      return 'Upcoming';
                    })();

                    return (
                      <div key={event.id} className="calendar-event-item">
                        <div className="event-date-badge">{eventDate ? eventDate.getDate() : '—'}</div>
                        <div className="event-details">
                          <div className="event-title">{event.title}</div>
                          <div className="event-meta">
                            {event.startTime || '—'} • {event.type} • {event.location}
                          </div>
                        </div>
                        <div className={`event-status-badge status-${statusLabel.toLowerCase()}`}>{statusLabel}</div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#64748B' }}>
                    No events scheduled for this month
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {showToast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: toastType === 'success' ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)' : 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)',
          color: 'white',
          padding: '1rem 1.5rem',
          borderRadius: '12px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          minWidth: '300px',
          animation: 'slideIn 0.3s ease-out'
        }}>
          <span style={{ fontSize: '1.5rem' }}>
            {toastType === 'success' ? '✓' : '✕'}
          </span>
          <span style={{ fontWeight: '600', fontSize: '0.95rem' }}>
            {toastMessage}
          </span>
        </div>
      )}
    </div>
  );
};

export default Admin;