import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import './Admin.css';
import { useNavigate } from 'react-router-dom';
import logoImage from '../../assets/logo2.png';
import AttendanceManagement from './AttendanceManagement';
import MembersManagement from './MembersManagement';
import ContactMessages from './ContactMessages';
import AnalyticsReport from './AnalyticsReport';
import { updateFavicon } from '../../utils/churchSettings';
import { API_BASE_URL } from '../../config/api';
import { resolveProfilePicUrl } from '../../utils/profilePicture';

const LOGIN_HISTORY_PAGE_SIZE = 5;
const SESSION_PAGE_SIZE = 5;

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

      }
    };

    loadProfile();
  }, []);

  // Default T&C and Privacy Policy content (used as fallback when admin hasn't customized)
  const DEFAULT_TERMS = `Purpose of the System
ChurchTrack exists to manage Christ-Like Christian Church membership and attendance. Access is provided to members approved by church leadership.

Accurate Information
Submit truthful and current personal, contact, and household details. Update your profile promptly when your information changes.

Attendance & Participation
Worship services and ministry events you attend may be logged for follow-up and care. Attendance insights help pastors plan discipleship, visitation, and resource allocation.

Responsible Use
Keep your login credentials private and do not misuse system data. Interact respectfully with church staff and fellow members when using ChurchTrack.

Reviews & Support
Administrators may review your account to ensure compliance with these terms. Contact the church office if you need assistance or have questions about your membership record.`;

  const DEFAULT_PRIVACY = `Information We Collect
Profile details such as name, birthday, contact information, and address. Attendance history for worship services and ministry events. Household or guardian information for members under 18. Account credentials used to access the ChurchTrack system.

How We Use Your Information
To maintain accurate membership and pastoral care records. To monitor attendance and plan follow-ups or ministry support. To send official announcements, reminders, and ministry invitations. To generate internal reports that help improve church programs.

Information Sharing
Only authorized pastors, staff, and ministry leaders can view your records. We do not sell or trade personal data with outside organizations. We may share limited data when required by law or for urgent safety concerns.

Retention & Security
Data is stored on secured systems with access controls and regular monitoring. We retain records while your membership is active and for a reasonable period afterward. Backups and updates are performed to safeguard against loss or misuse.

Your Choices
Request to view or update the information we hold about you. Ask for corrections or removal of outdated details, subject to legal obligations. Manage your communication preferences through church administrators.

Contact
For privacy questions or requests, please reach out to the CLCC administrative office.`;

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
          setTermsAndConditions(cachedSettings.termsAndConditions || DEFAULT_TERMS);
          setPrivacyPolicy(cachedSettings.privacyPolicy || DEFAULT_PRIVACY);
        } catch (error) {

        }
      }
      
      // Then fetch from backend to ensure we have the latest
      try {
        const response = await fetch(`${API_BASE_URL}/api/admin/get_church_settings.php`);
        const result = await response.json();

        if (result.success) {
          setChurchName(result.data.churchName);
          setChurchAddress(result.data.churchAddress || '');
          setChurchPhone(result.data.churchPhone || '');
          setChurchEmail(result.data.churchEmail || '');
          setDateFormat(result.data.dateFormat);
          // Set church logo if it exists, otherwise use default
          if (result.data.churchLogo) {

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
          setTermsAndConditions(result.data.termsAndConditions || DEFAULT_TERMS);
          setPrivacyPolicy(result.data.privacyPolicy || DEFAULT_PRIVACY);
          
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
            homepage_hero_subtitle: result.data.homepage_hero_subtitle || 'Join us for an uplifting experience',
            termsAndConditions: result.data.termsAndConditions || '',
            privacyPolicy: result.data.privacyPolicy || ''
          });
        }
      } catch (error) {

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

        }
      }
    };

    loadLoginHistory();
  }, [activeTab, showProfileView]);


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
  const [settingsTab, setSettingsTab] = useState('identity');
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

  const [termsAndConditions, setTermsAndConditions] = useState(DEFAULT_TERMS);
  const [privacyPolicy, setPrivacyPolicy] = useState(DEFAULT_PRIVACY);
  const [originalChurchData, setOriginalChurchData] = useState(null);
  const [hasChurchChanges, setHasChurchChanges] = useState(false);
  const [showSettingsSaveModal, setShowSettingsSaveModal] = useState(false);
  const [showSettingsCancelModal, setShowSettingsCancelModal] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [dateFormat, setDateFormat] = useState('mm/dd/yyyy');
  const [showAttendanceView, setShowAttendanceView] = useState(false);
  const [showMembersView, setShowMembersView] = useState(false);
  const [showContactView, setShowContactView] = useState(false);
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

            return;
          }
          
          const result = await response.json();
          if (result.success && result.data) {
            const currentSession = result.data.find(session => session.sessionId === sessionId);
            
            // Only logout if we're sure the session is invalid
            if (currentSession && !currentSession.isActive) {

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

          return;
        }
        
        const res = await fetch(`${API_BASE_URL}/api/admin/notifications.php?user_id=${adminId}&user_type=admin`);
        const data = await res.json();
        // Map backend notifications to frontend format
        setNotifications(data.map((n) => ({
          id: n.id,
          title: n.type === 'pending_request' ? '👤 New Member Request' : 
                 n.type === 'birthday' ? '🎂 Birthday Today!' :
                 n.type === 'guest_ready_for_conversion' ? '⭐ Guest Ready for Membership' :
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
      case 'guest_ready_for_conversion':
        setShowProfileView(false);
        setShowSettingsView(false);
        setShowAttendanceView(false);
        setShowMembersView(true);
        if (window.sessionStorage) {
          window.sessionStorage.setItem('activeTab', 'guests');
          if (notification.member_id) {
            window.sessionStorage.setItem('highlightGuestId', String(notification.member_id));
          }
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

      }
    } catch (error) {

    }
  };

  const markAllAsRead = async () => {
    try {
      // Mark all unread notifications as read in the backend
      const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
      
      if (unreadIds.length === 0) return;
      
      const adminId = localStorage.getItem('adminId') || localStorage.getItem('userId') || profileData.id;
      
      if (!adminId) {

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
  const [reportType, setReportType] = useState('attendance'); // 'attendance' or 'membership'
  const [membershipStatus, setMembershipStatus] = useState('all'); // 'all', 'active', 'inactive'
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

    }
  };

  const exportMembershipXlsx = async () => {
    try {
      window.open(`${API_BASE_URL}/api/reports/export_membership.php?status=${membershipStatus}&format=xlsx`, '_blank');
    } catch (error) {
      console.error('Error exporting membership report:', error);
    }
  };

  const printMembershipReport = async () => {
    try {
      // Fetch member data as JSON
      const res = await fetch(`${API_BASE_URL}/api/reports/export_membership.php?status=${membershipStatus}&format=json`);
      const result = await res.json();
      if (!result.success) { alert('Failed to load membership data.'); return; }
      const members = result.data ?? result.members ?? [];

      const activeCount   = members.filter(m => (m.status || '').toLowerCase() === 'active').length;
      const inactiveCount = members.filter(m => (m.status || '').toLowerCase() === 'inactive').length;
      const genTime = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
      const logoHtml = churchLogo ? `<img src="${churchLogo}" class="p-logo" alt="logo" />` : '';

      const rows = members.map((m, i) => {
        const bday = m.birthday ? new Date(m.birthday).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
        const joined = m.created_at ? new Date(m.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
        const statusColor = (m.status || '').toLowerCase() === 'active' ? '#059669' : '#D97706';
        return `<tr>
          <td>${i + 1}</td>
          <td>${m.name ?? ''}</td>
          <td>${m.email ?? ''}</td>
          <td>${m.contact_number ?? ''}</td>
          <td>${bday}</td>
          <td>${m.gender ?? ''}</td>
          <td style="color:${statusColor};font-weight:600">${m.status ? m.status.charAt(0).toUpperCase() + m.status.slice(1).toLowerCase() : ''}</td>
          <td>${joined}</td>
        </tr>`;
      }).join('');

      const printContent = `
        <div class="p-header">${logoHtml}<h1>${churchName}</h1><h2>Membership Report</h2><p>Generated: ${genTime}</p></div>
        <div class="p-summary">
          <div class="p-stat"><div class="p-val">${members.length}</div><div class="p-lbl">Total Members</div></div>
          <div class="p-stat" style="border-top-color:#059669"><div class="p-val" style="color:#059669">${activeCount}</div><div class="p-lbl">Active</div></div>
          <div class="p-stat" style="border-top-color:#D97706"><div class="p-val" style="color:#D97706">${inactiveCount}</div><div class="p-lbl">Inactive</div></div>
        </div>
        <table class="p-table">
          <thead><tr><th>#</th><th>Name</th><th>Email</th><th>Contact</th><th>Birthday</th><th>Gender</th><th>Status</th><th>Joined</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;

      injectAndPrint(printContent);
    } catch (e) {
      alert('Print failed: ' + e.message);
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

        alert('Failed to generate report: ' + (data.message || 'Unknown error'));
      }
    } catch (error) {

      alert('Error generating report. Please try again.');
    }
  };

  const exportReportXlsx = async () => {
    try {
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

    }
  };

  // ── shared print helper ──────────────────────────────────────────────────
  const injectAndPrint = (printContent) => {
    // Remove old elements if any
    document.getElementById('report-print-container')?.remove();
    document.getElementById('report-print-style')?.remove();

    const div = document.createElement('div');
    div.id = 'report-print-container';
    div.innerHTML = printContent;
    document.body.appendChild(div);

    const style = document.createElement('style');
    style.id = 'report-print-style';
    style.textContent = `
      @media print {
        html, body {
          overflow: visible !important;
          height: auto !important;
        }
        body > *:not(#report-print-container) { display: none !important; }
        #report-print-container {
          display: block !important;
          position: relative !important;
          overflow: visible !important;
          height: auto !important;
          max-height: none !important;
        }
      }
      #report-print-container {
        display: none;
        font-family: Arial, sans-serif;
        font-size: 12px;
        color: #1e293b;
        padding: 24px;
        overflow: visible;
        height: auto;
      }
      #report-print-container .p-header { text-align: center; margin-bottom: 16px; }
      #report-print-container .p-logo { height: 60px; object-fit: contain; margin-bottom: 6px; display: block; margin-left: auto; margin-right: auto; }
      #report-print-container h1 { font-size: 20px; font-weight: 700; margin: 0; }
      #report-print-container h2 { font-size: 14px; color: #64748b; margin: 4px 0 0; font-weight: 400; }
      #report-print-container p  { font-size: 11px; color: #94a3b8; margin: 4px 0 0; }
      #report-print-container .p-summary { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
      #report-print-container .p-stat { border: 1px solid #e5e7eb; border-top: 3px solid #4F46E5; border-radius: 6px; padding: 8px 14px; flex: 1 1 120px; }
      #report-print-container .p-val { font-size: 18px; font-weight: 700; color: #4F46E5; }
      #report-print-container .p-lbl { font-size: 10px; font-weight: 600; color: #374151; margin-top: 2px; }
      #report-print-container .p-section { font-weight: 700; font-size: 12px; border-left: 3px solid #4F46E5; padding-left: 6px; margin: 14px 0 6px; }
      #report-print-container .p-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 12px; }
      #report-print-container .p-table th { background: #4F46E5; color: #fff; padding: 5px 7px; text-align: left; font-size: 11px; }
      #report-print-container .p-table td { padding: 4px 7px; border-bottom: 1px solid #f1f5f9; }
      #report-print-container .p-table tr:nth-child(even) td { background: #f8fafc; }
    `;
    document.head.appendChild(style);

    window.print();

    setTimeout(() => {
      div.remove();
      style.remove();
    }, 2000);
  };

  const printAttendanceReport = () => {
    if (!reportData) return;
    const genTime = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
    const logoHtml = churchLogo ? `<img src="${churchLogo}" class="p-logo" alt="logo" />` : '';

    const rows = reportData.records.map(r => {
      const date = r.date ? new Date(`${r.date}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
      const time = r.time ? formatReportTimeLabel(r.time) : '—';
      return `<tr>
        <td>${date}</td>
        <td>${time}</td>
        <td>${r.title ?? ''}</td>
        <td style="text-align:center">${r.totalCheckins ?? 0}</td>
        <td style="text-align:center">${r.memberCheckins ?? 0}</td>
        <td style="text-align:center">${r.guestCheckins ?? 0}</td>
      </tr>`;
    }).join('');

    const printContent = `
      <div class="p-header">${logoHtml}<h1>${churchName}</h1><h2>Attendance Report</h2>
        <p>Period: ${reportData.dateRange?.start ?? reportStartDate} to ${reportData.dateRange?.end ?? reportEndDate}</p>
        <p>Generated: ${genTime}</p>
      </div>
      <div class="p-summary">
        <div class="p-stat"><div class="p-val">${reportData.totalEvents ?? 0}</div><div class="p-lbl">Total Events</div></div>
        <div class="p-stat" style="border-top-color:#2563EB"><div class="p-val" style="color:#2563EB">${reportData.totalAttendance ?? 0}</div><div class="p-lbl">Total Check-ins</div></div>
        <div class="p-stat" style="border-top-color:#0891B2"><div class="p-val" style="color:#0891B2">${reportAveragePerEvent}</div><div class="p-lbl">Avg / Event</div></div>
        <div class="p-stat" style="border-top-color:#059669"><div class="p-val" style="color:#059669">${reportData.totalMemberCheckins ?? 0}</div><div class="p-lbl">Member Check-ins</div></div>
        <div class="p-stat" style="border-top-color:#D97706"><div class="p-val" style="color:#D97706">${reportData.totalGuestCheckins ?? 0}</div><div class="p-lbl">Guest Check-ins</div></div>
      </div>
      <table class="p-table">
        <thead><tr><th>Date</th><th>Time</th><th>Service</th><th>Total</th><th>Members</th><th>Guests</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr style="font-weight:700;background:#f1f5f9">
          <td colspan="3" style="text-align:right;padding:5px 7px">Totals</td>
          <td style="text-align:center">${reportData.totalAttendance ?? 0}</td>
          <td style="text-align:center">${reportData.totalMemberCheckins ?? 0}</td>
          <td style="text-align:center">${reportData.totalGuestCheckins ?? 0}</td>
        </tr></tfoot>
      </table>`;

    injectAndPrint(printContent);
  };

  useEffect(() => {
    const loadDashboardStats = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/dashboard/get_stats.php`);

        const data = await response.json();

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

        }
      } catch (error) {

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

      }
    };

    const loadMemberGrowth = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/dashboard/get_member_growth.php`);
        if (response.ok) {
          const data = await response.json();

          if (data.success) {
            setMemberGrowthData(data.data);
            setGrowthStats({
              newMembers: data.newMembers,
              growthRate: data.growthRate
            });
          }
        }
      } catch (error) {

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

      const responseText = await response.text();

      const result = JSON.parse(responseText);

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

      // Show error toast
      setToastMessage('Error saving profile. Please try again.');
      setToastType('error');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  };

  const handleSaveClick = () => {

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
    setSettingsTab('identity');
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
    homepage_hero_subtitle: Object.prototype.hasOwnProperty.call(overrides, 'homepage_hero_subtitle') ? overrides.homepage_hero_subtitle : homepageHeroSubtitle,
    termsAndConditions: Object.prototype.hasOwnProperty.call(overrides, 'termsAndConditions') ? overrides.termsAndConditions : termsAndConditions,
    privacyPolicy: Object.prototype.hasOwnProperty.call(overrides, 'privacyPolicy') ? overrides.privacyPolicy : privacyPolicy,
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
        homepage_hero_subtitle: homepageHeroSubtitle,
        termsAndConditions,
        privacyPolicy,
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
      setTermsAndConditions(originalChurchData.termsAndConditions || DEFAULT_TERMS);
      setPrivacyPolicy(originalChurchData.privacyPolicy || DEFAULT_PRIVACY);
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

      // The backend fetch already handles this, so no need to call a ref function here
    };
    
    // Add event listener for custom refresh event
    window.addEventListener('refreshNotifications', handleRefreshNotifications);
    
    // Check for session storage flag
    const checkSessionStorage = () => {
      if (window.sessionStorage && window.sessionStorage.getItem('refreshNotifications')) {

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
      <header className={`topbar-nav${showSettingsView || showProfileView ? ' topbar-nav--hidden' : ''}`}>
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
          <button className={`nav-item ${!showAttendanceView && !showMembersView && !showContactView && !showBirthdayView ? 'active' : ''}`} onClick={() => { setShowAttendanceView(false); setShowMembersView(false); setShowContactView(false); setShowBirthdayView(false); setShowProfileView(false); setShowSettingsView(false); }}>Dashboard</button>
          <button className={`nav-item ${showAttendanceView ? 'active' : ''}`} onClick={() => { setShowAttendanceView(true); setShowMembersView(false); setShowContactView(false); setShowBirthdayView(false); setShowProfileView(false); setShowSettingsView(false); }}>Attendance</button>
          <button className={`nav-item ${showMembersView ? 'active' : ''}`} onClick={() => { setShowAttendanceView(false); setShowMembersView(true); setShowContactView(false); setShowProfileView(false); setShowSettingsView(false); }}>Members</button>
          <button className={`nav-item ${showContactView ? 'active' : ''}`} onClick={() => { setShowAttendanceView(false); setShowMembersView(false); setShowContactView(true); setShowBirthdayView(false); setShowProfileView(false); setShowSettingsView(false); }}>Contact</button>
        </nav>
        
        {/* Mobile Menu Dropdown */}
        {showMobileMenu && (
          <div className="mobile-menu-dropdown">
            <button className={`mobile-menu-item ${!showAttendanceView && !showMembersView && !showContactView && !showBirthdayView ? 'active' : ''}`} onClick={() => { setShowAttendanceView(false); setShowMembersView(false); setShowContactView(false); setShowBirthdayView(false); setShowProfileView(false); setShowSettingsView(false); setShowMobileMenu(false); }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
              Dashboard
            </button>
            <button className={`mobile-menu-item ${showAttendanceView ? 'active' : ''}`} onClick={() => { setShowAttendanceView(true); setShowMembersView(false); setShowContactView(false); setShowBirthdayView(false); setShowProfileView(false); setShowSettingsView(false); setShowMobileMenu(false); }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="8.5" cy="7" r="4"></circle>
                <polyline points="17 11 19 13 23 9"></polyline>
              </svg>
              Attendance
            </button>
            <button className={`mobile-menu-item ${showMembersView ? 'active' : ''}`} onClick={() => { setShowAttendanceView(false); setShowMembersView(true); setShowContactView(false); setShowProfileView(false); setShowSettingsView(false); setShowMobileMenu(false); }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              Members
            </button>
            <button className={`mobile-menu-item ${showContactView ? 'active' : ''}`} onClick={() => { setShowAttendanceView(false); setShowMembersView(false); setShowContactView(true); setShowBirthdayView(false); setShowProfileView(false); setShowSettingsView(false); setShowMobileMenu(false); }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              Contact
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
              <div className="stg-page">

                {/* ── Page Header ── */}
                <div className="stg-header">
                  <div className="stg-header-left">
                    <button className="stg-back-btn" onClick={handleSettingsBackClick} title="Back">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#0049AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px', display: 'block', flexShrink: 0 }}>
                        <path d="M19 12H5M12 19l-7-7 7-7"/>
                      </svg>
                    </button>
                    <div>
                      <h1 className="stg-title">Settings</h1>
                      <p className="stg-subtitle">Manage your church configuration</p>
                    </div>
                  </div>
                  {hasChurchChanges && (
                    <div className="stg-header-actions">
                      <button className="stg-btn stg-btn--ghost" onClick={handleChurchCancel}>Discard</button>
                      <button className="stg-btn stg-btn--primary" onClick={handleChurchSave}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>
                        Save Changes
                      </button>
                    </div>
                  )}
                </div>

                {/* ── Tabs + Content ── */}
                <div className="stg-layout">
                  <div className="stg-tabs-wrap">
                  <div className="stg-tabs">
                  {[
                    { id: 'identity', label: 'Church Identity', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
                    { id: 'homepage', label: 'Homepage', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg> },
                    { id: 'helpcenter', label: 'Help Center', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
                    { id: 'legal', label: 'Legal', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
                    { id: 'system', label: 'System', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93A10 10 0 0 0 4.93 19.07M19.07 4.93l-1.41 1.41M4.93 19.07l1.41-1.41"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg> },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      className={`stg-tab ${settingsTab === tab.id ? 'active' : ''}`}
                      onClick={() => setSettingsTab(tab.id)}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                  </div>
                  </div>

                  {/* ── Tab Panels ── */}
                  <div className="stg-body">

                  {/* CHURCH IDENTITY */}
                  {settingsTab === 'identity' && (
                    <div className="stg-panel">

                      <div className="stg-card">
                        <div className="stg-card-header">
                          <div className="stg-card-icon stg-card-icon--blue">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                          </div>
                          <div>
                            <h3 className="stg-card-title">Church Logo</h3>
                            <p className="stg-card-desc">Used in reports, PDFs, and the admin sidebar</p>
                          </div>
                        </div>
                        <div className="stg-media-row">
                          <div className="stg-logo-preview">
                            <img src={churchLogo} alt="Church Logo" />
                          </div>
                          <div className="stg-media-actions">
                            <button className="stg-btn stg-btn--outline" onClick={() => logoInputRef.current.click()}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                              Upload Logo
                            </button>
                            <button className="stg-btn stg-btn--danger-ghost" onClick={handleRemoveLogo}>Remove</button>
                          </div>
                          <input type="file" ref={logoInputRef} onChange={handleLogoChange} accept="image/*" style={{ display: 'none' }} />
                        </div>
                      </div>

                      <div className="stg-card">
                        <div className="stg-card-header">
                          <div className="stg-card-icon stg-card-icon--indigo">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>
                          </div>
                          <div>
                            <h3 className="stg-card-title">Header Logo</h3>
                            <p className="stg-card-desc">Shown in the Admin, Manager, and Member navigation bars</p>
                          </div>
                        </div>
                        <div className="stg-media-row">
                          <div className="stg-logo-preview">
                            <img src={headerLogo || churchLogo} alt="Header Logo" />
                          </div>
                          <div className="stg-media-actions">
                            <button className="stg-btn stg-btn--outline" onClick={() => headerLogoInputRef.current.click()}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                              Upload Logo
                            </button>
                            <button className="stg-btn stg-btn--danger-ghost" onClick={handleRemoveHeaderLogo}>Remove</button>
                          </div>
                          <input type="file" ref={headerLogoInputRef} onChange={handleHeaderLogoChange} accept="image/*" style={{ display: 'none' }} />
                        </div>
                      </div>

                      <div className="stg-card">
                        <div className="stg-card-header">
                          <div className="stg-card-icon stg-card-icon--green">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                          </div>
                          <div>
                            <h3 className="stg-card-title">Church Information</h3>
                            <p className="stg-card-desc">Basic details about your church</p>
                          </div>
                        </div>
                        <div className="stg-fields">
                          <div className="stg-field">
                            <label className="stg-label">Church Name</label>
                            <input type="text" value={churchName} onChange={handleChurchNameChange} className="stg-input" placeholder="Enter church name" />
                          </div>
                          <div className="stg-field">
                            <label className="stg-label">Address</label>
                            <textarea value={churchAddress} onChange={(e) => { setChurchAddress(e.target.value); checkChurchChanges({ churchAddress: e.target.value }); }} className="stg-input stg-textarea" placeholder="Enter church address" rows="3" />
                          </div>
                          <div className="stg-fields-row">
                            <div className="stg-field">
                              <label className="stg-label">Phone</label>
                              <input type="text" value={churchPhone} onChange={(e) => { setChurchPhone(e.target.value); checkChurchChanges({ churchPhone: e.target.value }); }} className="stg-input" placeholder="(+63) 900 000 0000" />
                            </div>
                            <div className="stg-field">
                              <label className="stg-label">Email</label>
                              <input type="email" value={churchEmail} onChange={(e) => { setChurchEmail(e.target.value); checkChurchChanges({ churchEmail: e.target.value }); }} className="stg-input" placeholder="church@email.com" />
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  )}

                  {/* HOMEPAGE */}
                  {settingsTab === 'homepage' && (
                    <div className="stg-panel">

                      <div className="stg-card">
                        <div className="stg-card-header">
                          <div className="stg-card-icon stg-card-icon--purple">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
                          </div>
                          <div>
                            <h3 className="stg-card-title">Hero Text</h3>
                            <p className="stg-card-desc">Main headline and supporting message on the homepage banner</p>
                          </div>
                        </div>
                        <div className="stg-fields">
                          <div className="stg-field">
                            <label className="stg-label">Hero Title</label>
                            <textarea value={homepageHeroTitle} onChange={handleHomepageHeroTitleChange} className="stg-input stg-textarea" placeholder="SHAPING FUTURES WITH FAITH" rows={3} />
                            <span className="stg-hint">Use Shift + Enter for line breaks</span>
                          </div>
                          <div className="stg-field">
                            <label className="stg-label">Hero Subtitle</label>
                            <textarea value={homepageHeroSubtitle} onChange={handleHomepageHeroSubtitleChange} className="stg-input stg-textarea" placeholder="Join us for an uplifting experience" rows={2} />
                          </div>
                        </div>
                      </div>

                      <div className="stg-card">
                        <div className="stg-card-header">
                          <div className="stg-card-icon stg-card-icon--orange">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                          </div>
                          <div>
                            <h3 className="stg-card-title">Floating Images</h3>
                            <p className="stg-card-desc">Photos displayed in the animated grid on the homepage</p>
                          </div>
                        </div>
                        <div className="stg-image-grid">
                          {[0,1,2,3,4,5].map((index) => {
                            const imageValues = [homepageImage1, homepageImage2, homepageImage3, homepageImage4, homepageImage5, homepageImage6];
                            const imageRefs = [homepageImage1Ref, homepageImage2Ref, homepageImage3Ref, homepageImage4Ref, homepageImage5Ref, homepageImage6Ref];
                            const imageValue = imageValues[index];
                            const imageRef = imageRefs[index];
                            return (
                              <div key={index} className="stg-image-slot">
                                <div className="stg-image-preview">
                                  {imageValue
                                    ? <img src={imageValue} alt={`Homepage Image ${index + 1}`} />
                                    : <div className="stg-image-empty">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="28" height="28"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                      </div>
                                  }
                                </div>
                                <span className="stg-image-label">Image {index + 1}</span>
                                <div className="stg-image-actions">
                                  <button className="stg-btn stg-btn--xs stg-btn--outline" onClick={() => imageRef.current?.click()}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="11" height="11"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                    Upload
                                  </button>
                                  {imageValue && (
                                    <button className="stg-btn stg-btn--xs stg-btn--danger-ghost" onClick={() => handleRemoveHomepageImage(index)}>Remove</button>
                                  )}
                                </div>
                                <input type="file" ref={imageRef} onChange={(e) => handleHomepageImageChange(index, e)} accept="image/*" style={{ display: 'none' }} />
                              </div>
                            );
                          })}
                        </div>
                      </div>

                    </div>
                  )}

                  {/* HELP CENTER */}
                  {settingsTab === 'helpcenter' && (
                    <div className="stg-panel">
                      <div className="stg-card">
                        <div className="stg-card-header">
                          <div className="stg-card-icon stg-card-icon--teal">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                          </div>
                          <div>
                            <h3 className="stg-card-title">Support Contact</h3>
                            <p className="stg-card-desc">Contact details shown to members when they need assistance</p>
                          </div>
                        </div>
                        <div className="stg-fields">
                          <div className="stg-field">
                            <label className="stg-label">Support Email</label>
                            <div className="stg-input-icon-wrap">
                              <svg className="stg-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                              <input type="email" value={helpCenterEmail} onChange={handleHelpCenterEmailChange} className="stg-input stg-input--icon" placeholder="support@yourchurch.com" />
                            </div>
                          </div>
                          <div className="stg-field">
                            <label className="stg-label">Contact Number</label>
                            <div className="stg-input-icon-wrap">
                              <svg className="stg-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.77a16 16 0 0 0 6.29 6.29l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                              <input type="tel" value={helpCenterPhone} onChange={handleHelpCenterPhoneChange} className="stg-input stg-input--icon" placeholder="(+63) 900 000 0000" />
                            </div>
                          </div>
                          <div className="stg-field">
                            <label className="stg-label">Help Center Link</label>
                            <div className="stg-input-icon-wrap">
                              <svg className="stg-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                              <input type="url" value={helpCenterUrl} onChange={handleHelpCenterUrlChange} className="stg-input stg-input--icon" placeholder="https://yourchurch.com/help" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* LEGAL */}
                  {settingsTab === 'legal' && (
                    <div className="stg-panel">
                      <div className="stg-card">
                        <div className="stg-card-header">
                          <div className="stg-card-icon stg-card-icon--blue">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                          </div>
                          <div>
                            <h3 className="stg-card-title">Terms and Conditions</h3>
                            <p className="stg-card-desc">Displayed to members during registration. Leave blank to use the default built-in text.</p>
                          </div>
                        </div>
                        <div className="stg-fields">
                          <div className="stg-field">
                            <label className="stg-label">Content</label>
                            <textarea
                              value={termsAndConditions}
                              onChange={(e) => { setTermsAndConditions(e.target.value); checkChurchChanges({ termsAndConditions: e.target.value }); }}
                              className="stg-input stg-textarea stg-textarea--legal"
                              placeholder="Enter your Terms and Conditions here. Each section can be written as plain text. Members will see this in the registration modal."
                              rows={14}
                            />
                            <span className="stg-hint">Plain text. Use line breaks to separate sections.</span>
                          </div>
                        </div>
                      </div>

                      <div className="stg-card">
                        <div className="stg-card-header">
                          <div className="stg-card-icon stg-card-icon--green">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
                          </div>
                          <div>
                            <h3 className="stg-card-title">Privacy Policy</h3>
                            <p className="stg-card-desc">Displayed to members during registration. Leave blank to use the default built-in text.</p>
                          </div>
                        </div>
                        <div className="stg-fields">
                          <div className="stg-field">
                            <label className="stg-label">Content</label>
                            <textarea
                              value={privacyPolicy}
                              onChange={(e) => { setPrivacyPolicy(e.target.value); checkChurchChanges({ privacyPolicy: e.target.value }); }}
                              className="stg-input stg-textarea stg-textarea--legal"
                              placeholder="Enter your Privacy Policy here. Describe how member data is collected, used, and protected."
                              rows={14}
                            />
                            <span className="stg-hint">Plain text. Use line breaks to separate sections.</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SYSTEM */}
                  {settingsTab === 'system' && (
                    <div className="stg-panel">
                      <div className="stg-card">
                        <div className="stg-card-header">
                          <div className="stg-card-icon stg-card-icon--red">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                          </div>
                          <div>
                            <h3 className="stg-card-title">System Maintenance</h3>
                            <p className="stg-card-desc">Remove stale sessions, login logs, rejected applications, and outdated guardian data</p>
                          </div>
                        </div>
                        <div className="stg-maintenance">
                          <button
                            className={`stg-btn stg-btn--primary stg-btn--maintenance${isMaintenanceRunning ? ' loading' : ''}`}
                            onClick={handleRunMaintenance}
                            disabled={isMaintenanceRunning}
                          >
                            {isMaintenanceRunning ? (
                              <>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" style={{ animation: 'spin 1s linear infinite' }}><polyline points="23 4 23 10 17 10"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                                Running Maintenance…
                              </>
                            ) : (
                              <>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                                Run Maintenance
                              </>
                            )}
                          </button>
                          <p className="stg-maintenance-note">This operation is safe to run anytime and will not affect member data.</p>
                        </div>
                        {maintenanceError && (
                          <div className="stg-alert stg-alert--error">{maintenanceError}</div>
                        )}
                        {maintenanceResult && (
                          <div className="stg-maintenance-result">
                            <div className="stg-maintenance-result-header">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>
                              Last run: {formatMaintenanceTimestamp(maintenanceResult.ranAt)}
                            </div>
                            {Array.isArray(maintenanceResult.tasks) && maintenanceResult.tasks.length > 0 && (
                              <div className="stg-task-list">
                                {maintenanceResult.tasks.map((task) => (
                                  <div key={task.name} className="stg-task-item">
                                    <span className="stg-task-name">{task.name}</span>
                                    {task.skipped ? (
                                      <span className="stg-task-badge stg-task-badge--skip">Skipped</span>
                                    ) : task.deleted > 0 ? (
                                      <span className="stg-task-badge stg-task-badge--removed">{task.deleted} removed</span>
                                    ) : (
                                      <span className="stg-task-badge stg-task-badge--clean">Clean</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="stg-maintenance-total">
                              Total removed: <strong>{maintenanceResult.totalDeleted ?? 0}</strong>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                </div>
                </div>
              </div>
            ) : (
              <div className="dashboard-content">
                {showAttendanceView ? (
                  <AttendanceManagement dateFormat={dateFormat} onEventsChange={setEvents} />
                ) : showMembersView ? (
                  <MembersManagement dateFormat={dateFormat} />
                ) : showContactView ? (
                  <ContactMessages />
                ) : (
                  <>
                    <div className="adm-dashboard">
                      {/* ── STAT CARDS ── */}
                      <div className="adm-stats">
                        <div className="adm-stat-card">
                          <div className="adm-stat-icon adm-stat-icon--blue">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                            </svg>
                          </div>
                          <div className="adm-stat-body">
                            <span className="adm-stat-label">Total Members</span>
                            <span className="adm-stat-value">{stats.totalMembers}</span>
                            <span className="adm-stat-sub">{stats.activeMembers} active</span>
                          </div>
                        </div>

                        <div className="adm-stat-card">
                          <div className="adm-stat-icon adm-stat-icon--green">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          </div>
                          <div className="adm-stat-body">
                            <span className="adm-stat-label">Today's Check-ins</span>
                            <span className="adm-stat-value">{stats.todayAttendance}</span>
                            <span className="adm-stat-sub">{stats.todayRate}% attendance rate</span>
                          </div>
                        </div>

                        <div className="adm-stat-card">
                          <div className="adm-stat-icon adm-stat-icon--violet">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
                            </svg>
                          </div>
                          <div className="adm-stat-body">
                            <span className="adm-stat-label">Weekly Average</span>
                            <span className="adm-stat-value">{stats.weeklyAttendance}%</span>
                            <span className="adm-stat-sub">attendance rate</span>
                          </div>
                        </div>

                        <div className="adm-stat-card">
                          <div className="adm-stat-icon adm-stat-icon--amber">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                            </svg>
                          </div>
                          <div className="adm-stat-body">
                            <span className="adm-stat-label">This Week</span>
                            <span className="adm-stat-value">{stats.weekAttendance}</span>
                            <span className="adm-stat-sub">total check-ins</span>
                          </div>
                        </div>
                      </div>

                      {/* ── MAIN GRID ── */}
                      <div className="adm-grid">
                        {/* LEFT COLUMN */}
                        <div className="adm-col-left">

                          {/* Weekly Attendance Bar Chart */}
                          <div className="adm-card">
                            <div className="adm-card-head">
                              <span className="adm-card-title">Weekly Attendance</span>
                            </div>
                            <div className="adm-bar-chart">
                              {(weeklyAttendanceData.length > 0 ? weeklyAttendanceData : [
                                {day:'Sun',count:0},{day:'Mon',count:0},{day:'Tue',count:0},{day:'Wed',count:0},
                                {day:'Thu',count:0},{day:'Fri',count:0},{day:'Sat',count:0}
                              ]).map((day, index) => {
                                const maxCount = Math.max(...(weeklyAttendanceData.length > 0 ? weeklyAttendanceData : [{count:1}]).map(d => d.count), 1);
                                const height = maxCount > 0 ? Math.max((day.count / maxCount) * 100, day.count > 0 ? 4 : 0) : 0;
                                return (
                                  <div key={index} className="adm-bar-col">
                                    <span className="adm-bar-count">{day.count > 0 ? day.count : ''}</span>
                                    <div className="adm-bar-track">
                                      <div className="adm-bar-fill" style={{ height: `${height}%` }} />
                                    </div>
                                    <span className="adm-bar-label">{day.day}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Member Growth */}
                          <div className="adm-card">
                            <div className="adm-card-head">
                              <span className="adm-card-title">Member Growth</span>
                              <div className="adm-card-pills">
                                <span className="adm-pill adm-pill--blue">+{growthStats.newMembers} new</span>
                                <span className="adm-pill adm-pill--green">{growthStats.growthRate}% growth</span>
                              </div>
                            </div>
                            <div className="adm-line-chart-wrap">
                              <svg viewBox="0 0 400 120" preserveAspectRatio="none" className="adm-line-svg">
                                <defs>
                                  <linearGradient id="admGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#0049AF" stopOpacity="0.18"/>
                                    <stop offset="100%" stopColor="#0049AF" stopOpacity="0"/>
                                  </linearGradient>
                                </defs>
                                {memberGrowthData.length > 1 && (() => {
                                  const maxCount = Math.max(...memberGrowthData.map(d => d.count), 1);
                                  const n = memberGrowthData.length;
                                  const sw = 400 / (n - 1);
                                  const pts = memberGrowthData.map((d, i) => ({
                                    x: i * sw,
                                    y: 100 - ((d.count / maxCount) * 90)
                                  }));
                                  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
                                  const area = `${line} L${pts[pts.length-1].x},120 L0,120 Z`;
                                  return (
                                    <>
                                      <path d={area} fill="url(#admGrad)"/>
                                      <path d={line} stroke="#0049AF" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                                      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="4" fill="#fff" stroke="#0049AF" strokeWidth="2"/>)}
                                    </>
                                  );
                                })()}
                              </svg>
                              <div className="adm-line-labels">
                                {memberGrowthData.map((d, i) => <span key={i}>{d.month}</span>)}
                              </div>
                            </div>
                          </div>

                          {/* Quick Actions */}
                          <div className="adm-card">
                            <div className="adm-card-head">
                              <span className="adm-card-title">Quick Actions</span>
                            </div>
                            <div className="adm-quick-actions">
                              <button className="adm-action-btn" onClick={() => setShowMembersView(true)}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
                                </svg>
                                Add Member
                              </button>
                              <button className="adm-action-btn" onClick={() => { setShowReportModal(true); generateReport(); }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                                  <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                                </svg>
                                Generate Report
                              </button>
                              <button className="adm-action-btn" onClick={() => setShowScheduleModal(true)}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                  <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                                </svg>
                                Schedule
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* RIGHT COLUMN */}
                        <div className="adm-col-right">

                          {/* Upcoming Birthdays */}
                          <div className="adm-card">
                            <div className="adm-card-head">
                              <span className="adm-card-title">Upcoming Birthdays</span>
                              <button className="adm-view-all" onClick={() => {
                                setShowMembersView(true);
                                if (window.sessionStorage) window.sessionStorage.setItem('activeTab', 'birthdays');
                              }}>View all</button>
                            </div>
                            <div className="adm-birthday-list">
                              {upcomingBirthdays.length === 0 ? (
                                <div className="adm-empty">No upcoming birthdays</div>
                              ) : (
                                upcomingBirthdays.map((birthday) => {
                                  const profilePath = birthday.profilePicture || birthday.profile_picture;
                                  const avatarUrl = resolveProfilePicUrl(profilePath);
                                  return (
                                    <div key={birthday.id} className="adm-birthday-row">
                                      <div className="adm-avatar">
                                        {avatarUrl ? (
                                          <img src={avatarUrl} alt={birthday.name}
                                            onError={(e) => { e.currentTarget.style.display='none'; e.currentTarget.parentElement.classList.add('fallback'); e.currentTarget.parentElement.textContent = birthday.initials; }}
                                          />
                                        ) : <span>{birthday.initials}</span>}
                                      </div>
                                      <div className="adm-birthday-info">
                                        <span className="adm-birthday-name">{birthday.name}</span>
                                        <span className="adm-birthday-date">{birthday.date}</span>
                                      </div>
                                      <span className={`adm-days-badge ${birthday.daysUntil === 0 ? 'adm-days-badge--today' : ''}`}>
                                        {birthday.daysUntil === 0 ? 'Today' : `${birthday.daysUntil}d`}
                                      </span>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>

                          {/* Service Breakdown */}
                          <div className="adm-card">
                            <div className="adm-card-head">
                              <span className="adm-card-title">Service Breakdown</span>
                            </div>
                            <div className="adm-donut-wrap">
                              {serviceAttendanceData.length > 0 ? (
                                <>
                                  <svg viewBox="0 0 200 200" className="adm-donut-svg">
                                    {(() => {
                                      const colors = ['#0049AF','#1095D2','#10B981','#F59E0B','#8B5CF6','#EC4899'];
                                      const circ = 2 * Math.PI * 70;
                                      let offset = 0;
                                      return serviceAttendanceData.map((s, i) => {
                                        const dash = (s.percentage / 100) * circ;
                                        const el = (
                                          <circle key={i} cx="100" cy="100" r="70" fill="none"
                                            stroke={colors[i % colors.length]} strokeWidth="28"
                                            strokeDasharray={`${dash} ${circ}`} strokeDashoffset={-offset}/>
                                        );
                                        offset += dash;
                                        return el;
                                      });
                                    })()}
                                    <circle cx="100" cy="100" r="56" fill="#fff"/>
                                  </svg>
                                  <div className="adm-donut-legend">
                                    {serviceAttendanceData.map((s, i) => {
                                      const colors = ['#0049AF','#1095D2','#10B981','#F59E0B','#8B5CF6','#EC4899'];
                                      return (
                                        <div key={i} className="adm-legend-row">
                                          <span className="adm-legend-dot" style={{ background: colors[i % colors.length] }}/>
                                          <span className="adm-legend-name">{s.type}</span>
                                          <span className="adm-legend-pct">{s.percentage}%</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </>
                              ) : (
                                <div className="adm-empty">No service data yet</div>
                              )}
                            </div>
                          </div>

                          {/* Recent Records */}
                          <div className="adm-card">
                            <div className="adm-card-head">
                              <span className="adm-card-title">Recent Records</span>
                              <button className="adm-view-all" onClick={() => setShowAttendanceView(true)}>View all</button>
                            </div>
                            <div className="adm-records-list">
                              {recentRecords.length > 0 ? (
                                recentRecords.map((record) => (
                                  <div key={record.id} className="adm-record-row">
                                    <div className="adm-record-dot"/>
                                    <div className="adm-record-body">
                                      <span className="adm-record-title">{record.title}</span>
                                      <span className="adm-record-date">{record.date}</span>
                                    </div>
                                    <span className="adm-record-count">{record.attendeeCount}</span>
                                  </div>
                                ))
                              ) : (
                                <div className="adm-empty">No recent records yet</div>
                              )}
                            </div>
                          </div>

                        </div>
                      </div>
                    </div>
                          {/* Weekly Attendance Trend */}
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

      {/* Report Modal — Redesigned */}
      {showReportModal && (
        <div className="rpt-overlay" onClick={() => setShowReportModal(false)}>
          <div className="rpt-modal" onClick={(e) => e.stopPropagation()}>

            {/* ── Header ── */}
            <div className="rpt-header">
              <div className="rpt-header-left">
                <div className="rpt-header-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                  </svg>
                </div>
                <div>
                  <h2 className="rpt-title">Reports</h2>
                  <p className="rpt-subtitle">Generate and export church records</p>
                </div>
              </div>
              <button className="rpt-close" onClick={() => setShowReportModal(false)} aria-label="Close">
                &#x2715;
              </button>
            </div>

            {/* ── Tab bar ── */}
            <div className="rpt-tabs">
              <button className={`rpt-tab ${reportType === 'attendance' ? 'rpt-tab--active' : ''}`} onClick={() => setReportType('attendance')}>
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Attendance
              </button>
              <button className={`rpt-tab ${reportType === 'membership' ? 'rpt-tab--active' : ''}`} onClick={() => setReportType('membership')}>
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                Membership
              </button>
              <button className={`rpt-tab ${reportType === 'analytics' ? 'rpt-tab--active' : ''}`} onClick={() => setReportType('analytics')}>
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
                </svg>
                Analytics
              </button>
            </div>

            {/* ── Body ── */}
            <div className="rpt-body">

              {/* ── ATTENDANCE TAB ── */}
              {reportType === 'attendance' && (
                <div className="rpt-section">
                  {/* Date controls */}
                  <div className="rpt-controls">
                    <div className="rpt-field">
                      <label className="rpt-label">Start Date</label>
                      <input className="rpt-input" type="date" value={reportStartDate} onChange={(e) => setReportStartDate(e.target.value)} />
                    </div>
                    <div className="rpt-field">
                      <label className="rpt-label">End Date</label>
                      <input className="rpt-input" type="date" value={reportEndDate} onChange={(e) => setReportEndDate(e.target.value)} />
                    </div>
                    <button className="rpt-btn rpt-btn--primary" onClick={generateReport}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                      </svg>
                      Generate
                    </button>
                  </div>

                  {reportData && (
                    <>
                      {/* Summary metrics strip */}
                      <div className="rpt-metrics">
                        <div className="rpt-metric">
                          <span className="rpt-metric-value">{reportData.totalEvents ?? 0}</span>
                          <span className="rpt-metric-label">Events</span>
                        </div>
                        <div className="rpt-metric rpt-metric--blue">
                          <span className="rpt-metric-value">{reportData.totalAttendance ?? 0}</span>
                          <span className="rpt-metric-label">Total Check-ins</span>
                        </div>
                        <div className="rpt-metric rpt-metric--slate">
                          <span className="rpt-metric-value">{reportAveragePerEvent}</span>
                          <span className="rpt-metric-label">Avg / Event</span>
                        </div>
                        <div className="rpt-metric rpt-metric--green">
                          <span className="rpt-metric-value">{reportData.totalMemberCheckins ?? 0}</span>
                          <span className="rpt-metric-label">Members</span>
                        </div>
                        <div className="rpt-metric rpt-metric--amber">
                          <span className="rpt-metric-value">{reportData.totalGuestCheckins ?? 0}</span>
                          <span className="rpt-metric-label">Guests</span>
                        </div>
                      </div>

                      {/* Table */}
                      <div className="rpt-table-wrap">
                        <table className="rpt-table">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Time</th>
                              <th>Event</th>
                              <th className="rpt-col-num">Total</th>
                              <th className="rpt-col-num">Members</th>
                              <th className="rpt-col-num">Guests</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportRecords.map((record) => (
                              <tr key={record.eventId}>
                                <td>{formatReportDateLabel(record.date)}</td>
                                <td>{formatReportTimeLabel(record.time)}</td>
                                <td>{record.title}</td>
                                <td className="rpt-col-num">{renderCountPill(record.totalCheckins, 'total')}</td>
                                <td className="rpt-col-num">{renderCountPill(record.memberCheckins, 'member')}</td>
                                <td className="rpt-col-num">{renderCountPill(record.guestCheckins, 'guest')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Export actions */}
                      <div className="rpt-actions">
                        <button className="rpt-btn rpt-btn--outline" onClick={exportReportXlsx}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                          </svg>
                          Download Excel
                        </button>
                        <button className="rpt-btn rpt-btn--outline" onClick={printAttendanceReport}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                            <rect x="6" y="14" width="12" height="8"/>
                          </svg>
                          Print / Save PDF
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── MEMBERSHIP TAB ── */}
              {reportType === 'membership' && (
                <div className="rpt-section">
                  <div className="rpt-info-box">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <p>Export a complete list of members with contact information, status, and join dates.</p>
                  </div>

                  <div className="rpt-controls">
                    <div className="rpt-field">
                      <label className="rpt-label">Filter by Status</label>
                      <select className="rpt-input rpt-select" value={membershipStatus} onChange={(e) => setMembershipStatus(e.target.value)}>
                        <option value="all">All Members</option>
                        <option value="active">Active Only</option>
                        <option value="inactive">Inactive Only</option>
                      </select>
                    </div>
                  </div>

                  <div className="rpt-actions">
                    <button className="rpt-btn rpt-btn--outline" onClick={exportMembershipXlsx}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      Download Excel
                    </button>
                    <button className="rpt-btn rpt-btn--outline" onClick={printMembershipReport}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                        <rect x="6" y="14" width="12" height="8"/>
                      </svg>
                      Print / Save PDF
                    </button>
                  </div>
                </div>
              )}

              {/* ── ANALYTICS TAB ── */}
              {reportType === 'analytics' && (
                <div className="rpt-section">
                  <AnalyticsReport churchName={churchName} churchLogo={churchLogo} />
                </div>
              )}

            </div>
          </div>
        </div>
      )}
      {showScheduleModal && (
        <div className="sch-overlay" onClick={() => setShowScheduleModal(false)}>
          <div className="sch-modal" onClick={(e) => e.stopPropagation()}>

            {/* ── Header ── */}
            <div className="sch-header">
              <div className="sch-header-left">
                <div className="sch-header-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </div>
                <div>
                  <h2 className="sch-title">Event Schedule</h2>
                  <p className="sch-subtitle">Browse events by month</p>
                </div>
              </div>
              <button className="sch-close" onClick={() => setShowScheduleModal(false)} aria-label="Close">&#x2715;</button>
            </div>

            {/* ── Month navigator ── */}
            <div className="sch-nav">
              <button className="sch-nav-btn" aria-label="Previous month" onClick={() => {
                const newMonth = currentMonth === 1 ? 12 : currentMonth - 1;
                const newYear  = currentMonth === 1 ? currentYear - 1 : currentYear;
                setCurrentMonth(newMonth);
                setCurrentYear(newYear);
              }}>&#8249;</button>

              <span className="sch-month-label">
                {new Date(currentYear, currentMonth - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>

              <button className="sch-nav-btn" aria-label="Next month" onClick={() => {
                const newMonth = currentMonth === 12 ? 1 : currentMonth + 1;
                const newYear  = currentMonth === 12 ? currentYear + 1 : currentYear;
                setCurrentMonth(newMonth);
                setCurrentYear(newYear);
              }}>&#8250;</button>
            </div>

            {/* ── Event list ── */}
            <div className="sch-body">
              {calendarEvents.length > 0 ? (
                <div className="sch-event-list">
                  {calendarEvents.map((event) => {
                    const eventDate = event.eventDateTime
                      ? new Date(event.eventDateTime)
                      : event.date ? new Date(`${event.date}T00:00:00`) : null;
                    const now = new Date();
                    const rawStatus = event.status ? event.status.toLowerCase() : '';
                    const statusLabel = rawStatus === 'active' ? 'Active'
                      : rawStatus === 'completed' ? 'Completed'
                      : !eventDate ? (event.status || 'Scheduled')
                      : eventDate.getTime() < now.getTime()
                        ? (rawStatus === 'cancelled' ? 'Cancelled' : 'Past')
                        : 'Upcoming';

                    return (
                      <div key={event.id} className="sch-event-row">
                        <div className="sch-date-chip">
                          <span className="sch-date-day">{eventDate ? eventDate.getDate() : '—'}</span>
                          <span className="sch-date-mon">{eventDate ? eventDate.toLocaleDateString('en-US', { month: 'short' }) : ''}</span>
                        </div>
                        <div className="sch-event-body">
                          <span className="sch-event-title">{event.title}</span>
                          <span className="sch-event-meta">
                            {[event.startTime, event.type, event.location].filter(Boolean).join(' · ') || '—'}
                          </span>
                        </div>
                        <span className={`sch-status-badge sch-status--${statusLabel.toLowerCase()}`}>
                          {statusLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="sch-empty">
                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  <p>No events scheduled for this month</p>
                </div>
              )}
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