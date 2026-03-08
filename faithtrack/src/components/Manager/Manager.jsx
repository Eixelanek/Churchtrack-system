import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import AttendanceManagement from '../Admin/AttendanceManagement';
import MembersManagement from '../Admin/MembersManagement';
import './Manager.css';
import logoImage from '../../assets/logo2.png';
import { loadChurchSettingsFromAPI } from '../../utils/churchSettings';
import { API_BASE_URL } from '../../config/api';

const PRESET_SERVICE_CONFIG = {
  'sunday-service': { name: 'Sunday Service', displayTime: '8:00 AM', defaultTime: '08:00', expirationHours: 4 },
  'prayer-meeting': { name: 'Prayer Meeting', displayTime: '7:00 PM', defaultTime: '19:00', expirationHours: 2 }
};

const QUICK_QR_PRESETS = [
  {
    id: 'sunday-service',
    serviceName: 'Sunday Service',
    label: 'Sunday Service',
    description: 'Weekly • 8:00 AM',
    defaultTime: '08:00',
    dayOfWeek: 0
  },
  {
    id: 'prayer-meeting',
    serviceName: 'Prayer Meeting',
    label: 'Prayer Meeting',
    description: 'Weekly • 7:00 PM',
    defaultTime: '19:00',
    dayOfWeek: 3
  }
];

const DEFAULT_MANAGER_PROFILE = {
  firstName: 'Manager',
  lastName: 'Manager',
  email: 'manager@churchtrack.ph',
  birthday: '1992-12-31',
  profilePicture: null,
  id: null
};

const computeNextOccurrenceForPreset = (dayOfWeek, timeString) => {
  const now = new Date();
  const next = new Date(now);

  const [hours = '0', minutes = '0'] = (timeString || '00:00').split(':');
  next.setHours(Number.parseInt(hours, 10), Number.parseInt(minutes, 10), 0, 0);

  let diff = (dayOfWeek - now.getDay() + 7) % 7;
  if (diff === 0 && next <= now) {
    diff = 7;
  }

  next.setDate(now.getDate() + diff);

  const date = next.toISOString().slice(0, 10);
  const time = next.toTimeString().slice(0, 5);

  return { date, time };
};

const DEFAULT_DASHBOARD_STATS = {
  totalMembers: 0,
  activeMembers: 0,
  todayAttendance: 0,
  todayRate: 0,
  weekAttendance: 0,
  weeklyAttendanceRate: 0,
  totalQrGenerated: 0,
  monthQrGenerated: 0,
  activeQrSessions: 0
};

const LOGIN_HISTORY_PAGE_SIZE = 5;

const computeBackendBaseUrl = () => API_BASE_URL;

const formatEventDateTime = (dateTimeString) => {
  if (!dateTimeString) return '';

  const normalized = typeof dateTimeString === 'string'
    ? dateTimeString.replace(' ', 'T')
    : dateTimeString;

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return typeof dateTimeString === 'string' ? dateTimeString : '';
  }

  const datePart = date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  const timePart = date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  return `${datePart} • ${timePart}`;
};

const buildExpirationLabel = (hours) => {
  if (hours === null || hours === undefined) {
    return '';
  }

  const parsedHours = Number(hours);
  if (Number.isNaN(parsedHours)) {
    return '';
  }

  const clamped = Math.max(parsedHours, 0);
  const unit = clamped === 1 ? 'hour' : 'hours';
  return `Active for ${clamped} ${unit} after start`;
};

const Manager = () => {
  const [churchName, setChurchName] = useState('Christ-Like Christian Church');
  const [churchLogo, setChurchLogo] = useState(null);
  const [headerLogo, setHeaderLogo] = useState(null);
  const [helpCenterEmail, setHelpCenterEmail] = useState('');
  const [helpCenterPhone, setHelpCenterPhone] = useState('');
  const [helpCenterUrl, setHelpCenterUrl] = useState('');

  const navigate = useNavigate();

  const [activeView, setActiveView] = useState('dashboard');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showProfileView, setShowProfileView] = useState(false);
  const [profileTab, setProfileTab] = useState('account');
  const [managerProfile, setManagerProfile] = useState(() => ({ ...DEFAULT_MANAGER_PROFILE }));
  const [originalProfile, setOriginalProfile] = useState(() => ({ ...DEFAULT_MANAGER_PROFILE }));
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [hasProfileChanges, setHasProfileChanges] = useState(false);
  const [previewImage, setPreviewImage] = useState(DEFAULT_MANAGER_PROFILE.profilePicture || null);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileMessageType, setProfileMessageType] = useState('success');
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [loginHistory, setLoginHistory] = useState([]);
  const [isLoginHistoryLoading, setIsLoginHistoryLoading] = useState(false);
  const [loginHistoryPage, setLoginHistoryPage] = useState(0);
  const [showLoginHistoryModal, setShowLoginHistoryModal] = useState(false);
  const [dashboardStats, setDashboardStats] = useState(() => ({ ...DEFAULT_DASHBOARD_STATS }));
  const [isDashboardStatsLoading, setIsDashboardStatsLoading] = useState(true);
  const [weeklyTrendRaw, setWeeklyTrendRaw] = useState([]);
  const [isWeeklyTrendLoading, setIsWeeklyTrendLoading] = useState(false);
  const [isQrStatsLoading, setIsQrStatsLoading] = useState(false);
  const [quickQrSessions, setQuickQrSessions] = useState([]);
  const [isQuickQrLoading, setIsQuickQrLoading] = useState(false);
  const [recentAttendanceRaw, setRecentAttendanceRaw] = useState([]);
  const [isRecentAttendanceLoading, setIsRecentAttendanceLoading] = useState(false);
  const [topActiveMembersRaw, setTopActiveMembersRaw] = useState([]);
  const [isTopActiveMembersLoading, setIsTopActiveMembersLoading] = useState(false);
  const [quickQrModalData, setQuickQrModalData] = useState(null);

  const backendBaseUrl = useMemo(() => computeBackendBaseUrl(), []);
  const frontendBaseUrl = useMemo(() => {
    if (typeof window === 'undefined' || !window.location) {
      return '';
    }
    return window.location.origin.replace(/\/$/, '');
  }, []);

  const notificationRef = useRef(null);
  const profileRef = useRef(null);
  const avatarInputRef = useRef(null);

  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const initialiseProfile = async () => {
      const storedRole = localStorage.getItem('userType');
      const storedId = localStorage.getItem('userId');
      const storedName = localStorage.getItem('username');

      if (storedRole !== 'manager' || !storedId) {
        setIsProfileLoading(false);
        return;
      }

      localStorage.setItem('managerId', storedId);

      const nameParts = storedName ? storedName.split(' ') : [];
      const baseProfile = {
        ...DEFAULT_MANAGER_PROFILE,
        firstName: nameParts[0] || DEFAULT_MANAGER_PROFILE.firstName,
        lastName: nameParts.slice(1).join(' ') || DEFAULT_MANAGER_PROFILE.lastName,
        id: storedId
      };

      try {
        const response = await fetch(`${backendBaseUrl}/api/admin/get_profile.php?admin_id=${storedId}`);

        if (!response.ok) {
          throw new Error(`Profile fetch failed: ${response.status}`);
        }

        const data = await response.json();
        const profile = data.data || data.profile || {};

        const mergedProfile = {
          ...baseProfile,
          firstName: profile.firstName || profile.first_name || baseProfile.firstName,
          lastName: profile.lastName || profile.last_name || baseProfile.lastName,
          email: profile.email || baseProfile.email,
          birthday: profile.birthday || baseProfile.birthday,
          profilePicture: profile.profilePicture || profile.profile_picture || null,
          id: profile.id || profile.admin_id || baseProfile.id
        };

        setManagerProfile(mergedProfile);
        setOriginalProfile(mergedProfile);
        setPreviewImage(mergedProfile.profilePicture || null);
        localStorage.setItem('managerProfile', JSON.stringify(mergedProfile));
        if (mergedProfile.id) {
          localStorage.setItem('managerId', mergedProfile.id);
        }
      } catch (error) {
        console.error('Failed to load manager profile:', error);
        setManagerProfile(baseProfile);
        setOriginalProfile(baseProfile);
        setPreviewImage(baseProfile.profilePicture || null);
      } finally {
        setIsProfileLoading(false);
      }
    };

    initialiseProfile();
  }, []);

  const resolveManagerId = useCallback(() => {
    return localStorage.getItem('managerId')
      || localStorage.getItem('userId')
      || managerProfile.id
      || null;
  }, [managerProfile.id]);

  useEffect(() => {
    const init = async () => {
      const stored = localStorage.getItem('churchSettings');
      if (stored) {
        try {
          const s = JSON.parse(stored);
          if (s.churchName) setChurchName(s.churchName);
          if (s.churchLogo) setChurchLogo(s.churchLogo);
          if (s.headerLogo) setHeaderLogo(s.headerLogo);
          setHelpCenterEmail(s.helpCenterEmail || '');
          setHelpCenterPhone(s.helpCenterPhone || '');
          setHelpCenterUrl(s.helpCenterUrl || '');
          return;
        } catch (error) {
          console.warn('Unable to parse cached church settings', error);
        }
      }

      const settings = await loadChurchSettingsFromAPI();
      if (settings) {
        if (settings.churchName) setChurchName(settings.churchName);
        if (settings.churchLogo) setChurchLogo(settings.churchLogo);
        if (settings.headerLogo) setHeaderLogo(settings.headerLogo);
        setHelpCenterEmail(settings.helpCenterEmail || '');
        setHelpCenterPhone(settings.helpCenterPhone || '');
        setHelpCenterUrl(settings.helpCenterUrl || '');
      }
    };

    init();
  }, []);

  useEffect(() => {
    const fetchDashboardStats = async () => {
      setIsDashboardStatsLoading(true);
      try {
        const response = await fetch(`${backendBaseUrl}/api/dashboard/get_stats.php`);
        const responseText = await response.text();
        const result = responseText ? JSON.parse(responseText) : null;

        if (!response.ok || !result?.success) {
          throw new Error(result?.message || 'Failed to load dashboard stats');
        }

        const stats = result.stats || {};
        setDashboardStats((prev) => ({
          ...prev,
          totalMembers: Number(stats.totalMembers) || 0,
          activeMembers: Number(stats.activeMembers) || 0,
          todayAttendance: Number(stats.todayAttendance) || 0,
          todayRate: Number(stats.todayRate) || 0,
          weekAttendance: Number(stats.weekAttendance) || 0,
          weeklyAttendanceRate: Number(stats.weeklyAttendanceRate) || 0
        }));
      } catch (error) {
        console.error('Failed to load dashboard stats:', error);
        // Don't reset stats on error, keep previous values (including QR stats)
      } finally {
        setIsDashboardStatsLoading(false);
      }
    };

    fetchDashboardStats();
  }, [backendBaseUrl]);

  useEffect(() => {
    const fetchQrStats = async () => {
      setIsQrStatsLoading(true);
      try {
        const response = await fetch(`${backendBaseUrl}/api/dashboard/get_qr_stats.php`);
        const responseText = await response.text();
        const result = responseText ? JSON.parse(responseText) : null;

        if (!response.ok || !result?.success || !result?.data) {
          throw new Error(result?.message || 'Failed to load QR stats');
        }

        setDashboardStats((prev) => ({
          ...prev,
          totalQrGenerated: Number(result.data.totalGenerated) || 0,
          monthQrGenerated: Number(result.data.monthGenerated) || 0,
          activeQrSessions: Number(result.data.activeSessions) || 0
        }));
      } catch (error) {
        console.error('Failed to load QR stats:', error);
        setDashboardStats((prev) => ({
          ...prev,
          totalQrGenerated: 0,
          monthQrGenerated: 0,
          activeQrSessions: 0
        }));
      } finally {
        setIsQrStatsLoading(false);
      }
    };

    fetchQrStats();
  }, [backendBaseUrl]);

  useEffect(() => {
    const fetchWeeklyTrend = async () => {
      setIsWeeklyTrendLoading(true);
      try {
        const response = await fetch(`${backendBaseUrl}/api/dashboard/get_weekly_attendance.php`);
        const responseText = await response.text();
        const result = responseText ? JSON.parse(responseText) : null;

        if (!response.ok || !result?.success || !Array.isArray(result.data)) {
          throw new Error(result?.message || 'Failed to load weekly attendance');
        }

        setWeeklyTrendRaw(result.data.map((item) => ({
          day: item.day,
          count: Number(item.count) || 0
        })));
      } catch (error) {
        console.error('Failed to load weekly attendance trend:', error);
        setWeeklyTrendRaw([]);
      } finally {
        setIsWeeklyTrendLoading(false);
      }
    };

    fetchWeeklyTrend();
  }, [backendBaseUrl]);

  const fetchQuickQrSessions = useCallback(async () => {
    setIsQuickQrLoading(true);
    try {
      const response = await fetch(`${backendBaseUrl}/api/qr_sessions/list.php?limit=12`);
      const responseText = await response.text();
      const result = responseText ? JSON.parse(responseText) : null;

      if (!response.ok || !result?.success || !Array.isArray(result.data)) {
        throw new Error(result?.message || 'Failed to load quick QR sessions');
      }

      const sessions = result.data
        .map((session) => ({
          ...session,
          scan_count: Number(session.scan_count) || 0
        }))
        .sort((a, b) => {
          const aTime = new Date(a.event_datetime || a.created_at || 0).getTime();
          const bTime = new Date(b.event_datetime || b.created_at || 0).getTime();
          return bTime - aTime;
        });

      setQuickQrSessions(sessions.slice(0, 4));
    } catch (error) {
      console.error('Failed to load quick QR sessions:', error);
      setQuickQrSessions([]);
    } finally {
      setIsQuickQrLoading(false);
    }
  }, [backendBaseUrl]);

  useEffect(() => {
    fetchQuickQrSessions();
    const interval = setInterval(fetchQuickQrSessions, 20000);
    return () => clearInterval(interval);
  }, [fetchQuickQrSessions]);

  useEffect(() => {
    const fetchRecentAttendance = async () => {
      setIsRecentAttendanceLoading(true);
      try {
        const response = await fetch(`${backendBaseUrl}/api/dashboard/get_recent_records.php?limit=5`);
        const responseText = await response.text();
        const result = responseText ? JSON.parse(responseText) : null;

        if (!response.ok || !result?.success || !Array.isArray(result.records)) {
          throw new Error(result?.message || 'Failed to load recent attendance');
        }

        setRecentAttendanceRaw(result.records);
      } catch (error) {
        console.error('Failed to load recent attendance:', error);
        setRecentAttendanceRaw([]);
      } finally {
        setIsRecentAttendanceLoading(false);
      }
    };

    fetchRecentAttendance();
  }, [backendBaseUrl]);

  useEffect(() => {
    const fetchTopActiveMembers = async () => {
      setIsTopActiveMembersLoading(true);
      try {
        const response = await fetch(`${backendBaseUrl}/api/dashboard/get_top_active_members.php?limit=5`);
        const responseText = await response.text();
        const result = responseText ? JSON.parse(responseText) : null;

        if (!response.ok || !result?.success || !Array.isArray(result.data)) {
          throw new Error(result?.message || 'Failed to load top active members');
        }

        setTopActiveMembersRaw(result.data);
      } catch (error) {
        console.error('Failed to load top active members:', error);
        setTopActiveMembersRaw([]);
      } finally {
        setIsTopActiveMembersLoading(false);
      }
    };

    fetchTopActiveMembers();
  }, [backendBaseUrl]);

  const downloadSvgAsPng = useCallback((elementId, filename) => {
    const svg = document.getElementById(elementId);
    if (!svg) {
      return;
    }

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width || 512;
      canvas.height = img.height || 512;
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(img, 0, 0);
      URL.revokeObjectURL(svgUrl);

      canvas.toBlob((blob) => {
        if (!blob) {
          return;
        }
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `${filename}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(svgUrl);
    };

    img.src = svgUrl;
  }, []);

  const handleQuickQrClick = useCallback((session) => {
    if (!session?.session_token) {
      return;
    }

    const qrUrl = `${frontendBaseUrl}/checkin?session=${session.session_token}`;
    setQuickQrModalData({ session, qrUrl });
  }, [frontendBaseUrl]);

  const handleQuickQrKeyDown = useCallback((event, session) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleQuickQrClick(session);
    }
  }, [handleQuickQrClick]);

  const closeQuickQrModal = useCallback(() => {
    setQuickQrModalData(null);
  }, []);

  const handleQuickQrDownload = useCallback(() => {
    if (!quickQrModalData?.session?.session_token) {
      return;
    }
    const elementId = `quick-qr-svg-${quickQrModalData.session.session_token}`;
    const filename = quickQrModalData.session.service_name || 'qr-session';
    downloadSvgAsPng(elementId, filename.replace(/\s+/g, '-').toLowerCase());
  }, [downloadSvgAsPng, quickQrModalData]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showNotifications && notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (showProfileMenu && profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications, showProfileMenu]);

  useEffect(() => {
    if (!profileMessage) return undefined;

    const timeout = setTimeout(() => setProfileMessage(''), 3000);
    return () => clearTimeout(timeout);
  }, [profileMessage]);

  const computeTimeAgo = useCallback((timestamp) => {
    if (!timestamp) return '';

    const date = new Date(timestamp.replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) return '';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);

    if (diffSeconds < 60) return 'Just now';
    if (diffSeconds < 3600) {
      const minutes = Math.floor(diffSeconds / 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    }
    if (diffSeconds < 86400) {
      const hours = Math.floor(diffSeconds / 3600);
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    }
    if (diffSeconds < 172800) {
      return `Yesterday, ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    }
    if (diffSeconds < 604800) {
      const days = Math.floor(diffSeconds / 86400);
      return `${days} day${days !== 1 ? 's' : ''} ago`;
    }

    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }, []);

  useEffect(() => {
    const fetchLoginHistory = async () => {
      if (!showProfileView || profileTab !== 'security' || !managerProfile.id) return;

      try {
        setIsLoginHistoryLoading(true);
        const response = await fetch(`${backendBaseUrl}/api/admin/get_login_history.php?admin_id=${managerProfile.id}`);
        const result = await response.json();

        if (result.success && Array.isArray(result.data)) {
          setLoginHistory(result.data);
          setLoginHistoryPage(0);
        } else {
          setLoginHistory([]);
          if (result.message) {
            setProfileMessage(result.message);
            setProfileMessageType('error');
          }
        }
      } catch (error) {
        console.error('Failed to load login history:', error);
        setLoginHistory([]);
        setProfileMessage('Unable to load recent login activity.');
        setProfileMessageType('error');
      } finally {
        setIsLoginHistoryLoading(false);
      }
    };

    fetchLoginHistory();
  }, [showProfileView, profileTab, managerProfile.id]);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(loginHistory.length / LOGIN_HISTORY_PAGE_SIZE) - 1);
    if (loginHistoryPage > maxPage) {
      setLoginHistoryPage(maxPage);
    }
  }, [loginHistory, loginHistoryPage]);

  const totalLoginHistoryPages = useMemo(() => Math.max(1, Math.ceil(loginHistory.length / LOGIN_HISTORY_PAGE_SIZE)), [loginHistory]);

  const paginatedLoginHistory = useMemo(() => {
    const start = loginHistoryPage * LOGIN_HISTORY_PAGE_SIZE;
    return loginHistory.slice(start, start + LOGIN_HISTORY_PAGE_SIZE);
  }, [loginHistory, loginHistoryPage]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const formatNotificationTime = useCallback((timestamp) => {
    if (!timestamp) return '';
    const now = new Date();
    const notifTime = new Date(timestamp.replace(' ', 'T'));
    if (Number.isNaN(notifTime.getTime())) {
      return '';
    }

    const diffMs = now.getTime() - notifTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return notifTime.toLocaleDateString();
  }, []);

  const transformNotification = useCallback((raw) => {
    const type = raw.type;
    const title = type === 'pending_request'
      ? '👤 New Member Request'
      : type === 'birthday'
        ? '🎂 Birthday Today!'
        : type === 'event_reminder'
          ? '⏰ Event Reminder'
          : type === 'attendance_needed'
            ? '✅ Attendance Needed'
            : type === 'low_attendance'
              ? '⚠️ Low Attendance Alert'
              : type === 'family_circle_created'
                ? '👨‍👩‍👧 Family Circle Created'
                : type === 'family_circle_removed'
                  ? '✂️ Family Circle Removed'
                  : 'Notification';

    return {
      id: raw.id,
      title,
      message: raw.message,
      time: formatNotificationTime(raw.timestamp),
      read: Boolean(raw.is_read),
      type,
      event_id: raw.event_id,
      member_id: raw.member_id,
      timestamp: raw.timestamp,
    };
  }, [formatNotificationTime]);

  const fetchNotifications = useCallback(async () => {
    try {
      const managerId = resolveManagerId();
      if (!managerId) {
        return;
      }
      const response = await fetch(`${backendBaseUrl}/api/admin/notifications.php?user_id=${managerId}&user_type=manager`);
      if (!response.ok) {
        throw new Error(`Failed to load notifications: ${response.status}`);
      }
      const data = await response.json();
      setNotifications(Array.isArray(data) ? data.map(transformNotification) : []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, [backendBaseUrl, resolveManagerId, transformNotification]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAsRead = useCallback(async (id) => {
    try {
      const managerId = resolveManagerId();
      if (!managerId) {
        return;
      }
      await fetch(`${backendBaseUrl}/api/admin/mark_notification_read.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          notification_id: id,
          user_id: managerId,
          user_type: 'manager'
        }),
      });

      setNotifications((prev) => prev.map((notification) => (
        notification.id === id ? { ...notification, read: true } : notification
      )));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [backendBaseUrl, resolveManagerId]);

  const markAllAsRead = useCallback(async () => {
    const managerId = resolveManagerId();
    if (!managerId) {
      return;
    }

    const hasUnread = notifications.some((n) => !n.read);
    if (!hasUnread) {
      return;
    }

    try {
      const response = await fetch(`${backendBaseUrl}/api/admin/mark_all_notifications_read.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: managerId,
          user_type: 'manager'
        })
      });

      const resultText = await response.text();
      const result = resultText ? JSON.parse(resultText) : null;

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Failed to mark notifications as read');
      }

      setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }, [backendBaseUrl, notifications, resolveManagerId]);

  const deleteNotification = useCallback(async (id) => {
    try {
      const managerId = resolveManagerId();
      if (!managerId) {
        return;
      }
      await fetch(`${backendBaseUrl}/api/admin/delete_notification.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_id: id, user_id: managerId, user_type: 'manager' }),
      });

      setNotifications((prev) => prev.filter((notification) => notification.id !== id));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }, [backendBaseUrl, resolveManagerId]);

  const handleNotificationItemClick = useCallback((notification) => {
    markAsRead(notification.id);
    setShowNotifications(false);

    switch (notification.type) {
      case 'event_reminder':
      case 'attendance_needed':
      case 'low_attendance':
        setActiveView('attendance');
        if (notification.event_id && window.sessionStorage) {
          window.sessionStorage.setItem('highlightEventId', notification.event_id);
        }
        break;
      case 'pending_request':
        setActiveView('members');
        if (window.sessionStorage) {
          window.sessionStorage.setItem('activeTab', 'pending_requests');
        }
        break;
      case 'birthday':
        setActiveView('members');
        if (window.sessionStorage) {
          window.sessionStorage.setItem('activeTab', 'birthdays');
        }
        break;
      default:
        break;
    }
  }, [markAsRead, setActiveView]);

  const managerInitials = useMemo(() => {
    const first = managerProfile.firstName?.[0] || '';
    const last = managerProfile.lastName?.[0] || '';
    return `${first}${last}`.toUpperCase() || 'MG';
  }, [managerProfile.firstName, managerProfile.lastName]);

  const navItems = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'generate-qr', label: 'Generate QR' },
    { key: 'attendance', label: 'Attendance' },
    { key: 'members', label: 'Members' }
  ];

  const dashboardSummary = useMemo(() => {
    const placeholder = isDashboardStatsLoading || isQrStatsLoading ? '...' : null;
    const formatNumber = (value) => (typeof value === 'number' ? value.toLocaleString() : '0');
    const formatPercent = (value) => `${typeof value === 'number' ? value : 0}%`;

    return [
      {
        key: 'members',
        label: 'Total Members',
        value: placeholder ?? formatNumber(dashboardStats.totalMembers),
        meta: placeholder ? 'Loading...' : `Active: ${formatNumber(dashboardStats.activeMembers)}`,
        icon: 'users'
      },
      {
        key: 'attendance',
        label: "Today's Attendance",
        value: placeholder ?? formatNumber(dashboardStats.todayAttendance),
        meta: placeholder ? 'Loading...' : `Rate: ${formatPercent(dashboardStats.todayRate)}`,
        icon: 'clock'
      },
      {
        key: 'average',
        label: 'Weekly Average',
        value: placeholder ?? formatPercent(dashboardStats.weeklyAttendanceRate),
        meta: placeholder ? 'Loading...' : `${formatNumber(dashboardStats.weekAttendance)} check-ins`,
        icon: 'trend'
      },
      {
        key: 'qr',
        label: 'QR Generated',
        value: placeholder ?? formatNumber(dashboardStats.monthQrGenerated),
        meta: placeholder ? 'Loading...' : `${formatNumber(dashboardStats.totalQrGenerated)} total • ${formatNumber(dashboardStats.activeQrSessions)} active`,
        icon: 'qr'
      }
    ];
  }, [dashboardStats, isDashboardStatsLoading, isQrStatsLoading]);

  const quickQrCards = useMemo(() => {
    if (quickQrSessions.length === 0) {
      return QUICK_QR_PRESETS.map((preset) => ({ ...preset, preset: true }));
    }

    return quickQrSessions.map((session) => {
      const eventDate = session.event_datetime ? new Date(session.event_datetime.replace(' ', 'T')) : null;
      const dateLabel = eventDate
        ? eventDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : undefined;
      const timeLabel = eventDate
        ? eventDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })
        : undefined;

      return {
        id: session.session_token || `session-${session.id}`,
        title: session.service_name || 'QR Session',
        metric: `${session.scan_count || 0} check-ins`,
        date: dateLabel,
        timeLabel,
        session
      };
    });
  }, [quickQrSessions]);


  const recentAttendance = useMemo(() => {
    if (!recentAttendanceRaw.length) {
      return [];
    }

    return recentAttendanceRaw.map((record) => {
      // Use event_datetime if available, otherwise fall back to formatted date
      let dateLabel = 'No date';
      if (record.event_datetime) {
        try {
          const eventDate = new Date(record.event_datetime.replace(' ', 'T'));
          if (!isNaN(eventDate.getTime())) {
            dateLabel = eventDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          }
        } catch (e) {
          // Fall back to formatted date
          if (record.date) {
            dateLabel = record.date.split(',')[0]; // Get "Sep 29" from "Sep 29, 2024"
          }
        }
      } else if (record.date) {
        dateLabel = record.date.split(',')[0]; // Get "Sep 29" from "Sep 29, 2024"
      }

      return {
        id: `recent-att-${record.id}`,
        dateLabel: dateLabel,
        service: record.title || 'Unnamed Service',
        value: record.attendeeCount || 0
      };
    });
  }, [recentAttendanceRaw]);

  const topActiveMembers = useMemo(() => {
    if (!topActiveMembersRaw.length) {
      return [];
    }

    return topActiveMembersRaw.map((member) => ({
      id: `member-${member.id}`,
      name: member.name,
      percentage: member.percentage || 0
    }));
  }, [topActiveMembersRaw]);

  const weeklyTrendData = useMemo(() => {
    if (!weeklyTrendRaw.length) {
      return [];
    }

    const maxCount = Math.max(...weeklyTrendRaw.map((item) => item.count), 1);
    return weeklyTrendRaw.map((item) => {
      const percent = maxCount > 0 ? Math.round((item.count / maxCount) * 100) : 0;
      return {
        ...item,
        percent: Math.max(percent, 0) // Ensure percent is at least 0
      };
    });
  }, [weeklyTrendRaw]);

  const renderSummaryIcon = useCallback((type) => {
    switch (type) {
      case 'users':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
        );
      case 'clock':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9"></circle>
            <polyline points="12 7 12 12 16 14"></polyline>
          </svg>
        );
      case 'trend':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
            <polyline points="17 6 23 6 23 12"></polyline>
          </svg>
        );
      case 'qr':
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="6" height="6"></rect>
            <rect x="15" y="3" width="6" height="6"></rect>
            <rect x="15" y="15" width="6" height="6"></rect>
            <line x1="3" y1="15" x2="3" y2="21"></line>
            <line x1="3" y1="21" x2="9" y2="21"></line>
            <line x1="9" y1="21" x2="9" y2="18"></line>
            <line x1="9" y1="18" x2="6" y2="18"></line>
            <line x1="12" y1="12" x2="12" y2="12"></line>
          </svg>
        );
    }
  }, []);

  const handleSignOutClick = () => {
    setShowProfileMenu(false);
    setShowSignOutModal(true);
  };

  const handleConfirmSignOut = () => {
    setShowSignOutModal(false);

    localStorage.removeItem('token');
    localStorage.removeItem('userType');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    localStorage.removeItem('sessionId');

    navigate('/login', { replace: true });
  };

  const handleOpenProfileSettings = (tab = 'account') => {
    setShowProfileMenu(false);
    setProfileTab(tab);
    setOriginalProfile({ ...managerProfile });
    setPreviewImage(managerProfile.profilePicture || null);
    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setShowProfileView(true);
    setHasProfileChanges(false);
    setProfileMessage('');
    setProfileMessageType('success');
    setShowSaveModal(false);
    setShowCancelModal(false);
    document.body.style.overflow = 'hidden';
  };

  const handleCloseProfileSettings = () => {
    setManagerProfile({ ...originalProfile });
    setPreviewImage(originalProfile.profilePicture || null);
    setHasProfileChanges(false);
    setShowProfileView(false);
    setProfileMessage('');
    setShowSaveModal(false);
    setShowCancelModal(false);
    document.body.style.overflow = '';
  };

  const handleProfileFieldChange = (field, value) => {
    setManagerProfile((prev) => {
      const updated = { ...prev, [field]: value };
      setHasProfileChanges(
        updated.firstName !== originalProfile.firstName ||
          updated.lastName !== originalProfile.lastName ||
          updated.email !== originalProfile.email ||
          (updated.birthday || '') !== (originalProfile.birthday || '')
      );
      return updated;
    });
  };

  const handleCancelProfileChanges = () => {
    if (hasProfileChanges) {
      setShowCancelModal(true);
    } else {
      handleCloseProfileSettings();
    }
  };

  const handleConfirmCancelChanges = () => {
    setManagerProfile({ ...originalProfile });
    setPreviewImage(originalProfile.profilePicture || null);
    setHasProfileChanges(false);
    setShowCancelModal(false);
    handleCloseProfileSettings();
  };

  const handleSaveProfileClick = () => {
    if (!managerProfile.id || isProfileSaving) return;
    if (!hasProfileChanges && previewImage === (originalProfile.profilePicture || null)) {
      return;
    }
    setShowSaveModal(true);
  };

  const performProfileSave = async () => {
    if (!managerProfile.id || isProfileSaving) return;

    setShowSaveModal(false);

    try {
      setIsProfileSaving(true);
      setProfileMessage('');

      const payload = {
        admin_id: managerProfile.id,
        firstName: managerProfile.firstName,
        lastName: managerProfile.lastName,
        birthday: managerProfile.birthday,
        email: managerProfile.email,
        profilePicture: previewImage || managerProfile.profilePicture || null
      };

      const response = await fetch(`${backendBaseUrl}/api/admin/update_profile.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const text = await response.text();
      const result = text ? JSON.parse(text) : {};

      if (!response.ok || result.status !== 'success') {
        throw new Error(result.message || 'Failed to save profile');
      }

      const updatedProfile = {
        ...managerProfile,
        profilePicture: previewImage || managerProfile.profilePicture,
        avatar: previewImage ? undefined : managerInitials
      };

      setManagerProfile(updatedProfile);
      setOriginalProfile(updatedProfile);
      setPreviewImage(updatedProfile.profilePicture || null);
      localStorage.setItem('managerProfile', JSON.stringify(updatedProfile));
      setHasProfileChanges(false);
      setProfileMessage('Profile updated successfully!');
      setProfileMessageType('success');
    } catch (error) {
      console.error('Failed to save manager profile:', error);
      setProfileMessage(error.message || 'Error saving profile. Please try again.');
      setProfileMessageType('error');
    } finally {
      setIsProfileSaving(false);
      if (!showProfileView) {
        setProfileMessage('');
      }
    }
  };

  const handleAvatarUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      setPreviewImage(result);
      setManagerProfile((prev) => ({ ...prev, profilePicture: result }));
      setHasProfileChanges(true);
    };
    reader.readAsDataURL(file);
  };

  const handlePasswordChange = (field, value) => {
    setPasswordData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePasswordUpdate = () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      setProfileMessage('Please fill in all password fields.');
      setProfileMessageType('error');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setProfileMessage('New passwords do not match.');
      setProfileMessageType('error');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setProfileMessage('Password must be at least 6 characters long.');
      setProfileMessageType('error');
      return;
    }

    setProfileMessage('');
    setShowPasswordModal(true);
  };

  const performPasswordUpdate = async () => {
    if (!managerProfile.id) return;

    try {
      const response = await fetch(`${backendBaseUrl}/api/admin/change_password.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_id: managerProfile.id,
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      });

      const responseText = await response.text();
      const result = responseText ? JSON.parse(responseText) : {};

      if (!response.ok || result.status !== 'success') {
        throw new Error(result.message || 'Error updating password.');
      }

      setProfileMessage('Password updated successfully!');
      setProfileMessageType('success');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    } catch (error) {
      console.error('Failed to update password:', error);
      setProfileMessage(error.message || 'Error updating password. Please try again.');
      setProfileMessageType('error');
    } finally {
      setShowPasswordModal(false);
    }
  };

  const renderDashboard = () => (
    <div className="manager-dashboard">
      <section className="manager-summary-grid">
        {dashboardSummary.map((card, index) => (
          <article key={card.key} className={`manager-summary-card gradient-${index + 1}`}>
            <div className="manager-summary-icon">
              {renderSummaryIcon(card.icon)}
            </div>
            <div className="manager-summary-body">
              <span className="manager-summary-label">{card.label}</span>
              <span className="manager-summary-value">{card.value}</span>
              <span className={`manager-summary-meta ${card.icon === 'attendance' ? 'positive' : ''}`}>{card.meta}</span>
            </div>
          </article>
        ))}
      </section>

      <div className="manager-dashboard-grid">
        <div className="manager-dashboard-left">
          <section className="manager-card manager-qr-generator">
            <header className="manager-card-header">
              <div className="manager-card-title">
                <span className="emoji">🧾</span>
                <h3>Recent QR Sessions</h3>
              </div>
              <button
                type="button"
                className="manager-card-action"
                onClick={() => fetchQuickQrSessions()}
              >
                Refresh list
              </button>
            </header>
            {isQuickQrLoading ? (
              <div className="manager-empty-state">Loading quick QR sessions…</div>
            ) : (
              <div className="manager-qr-grid">
                {quickQrCards.map((card) => {
                  const isInteractive = Boolean(card.session || card.preset);
                  const handleClick = () => {
                    if (isInteractive) {
                      if (card.session) {
                        handleQuickQrClick(card.session);
                      } else if (card.preset) {
                        const matchedPreset = QUICK_QR_PRESETS.find((preset) => preset.id === card.id);
                        if (matchedPreset) {
                          handleQuickGeneratePreset(matchedPreset);
                        }
                      }
                    }
                  };

                  const handleKeyDown = (event) => {
                    if (isInteractive) {
                      if (card.session) {
                        handleQuickQrKeyDown(event, card.session);
                      } else if (card.preset) {
                        handleQuickGeneratePresetKey(event, card.id);
                      }
                    }
                  };

                  return (
                    <div
                      key={card.id}
                      className={`manager-qr-item${isInteractive ? '' : ' manager-qr-item--fallback'}`}
                      role={isInteractive ? 'button' : undefined}
                      tabIndex={isInteractive ? 0 : -1}
                      onClick={handleClick}
                      onKeyDown={handleKeyDown}
                    >
                      <div className="qr-info">
                        <h4>{card.title || card.label}</h4>
                        <span>{card.metric || card.description}</span>
                        {card.date && (
                          <span className="qr-subinfo">{card.date}{card.timeLabel ? ` • ${card.timeLabel}` : ''}</span>
                        )}
                        {card.preset && !card.date && card.description && (
                          <span className="qr-subinfo">{card.description}</span>
                        )}
                      </div>
                      <div className="qr-icon" aria-hidden="true">QR</div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="manager-card manager-trend-card">
            <header className="manager-card-header">
              <h3>Weekly Attendance Trend</h3>
            </header>
            {isWeeklyTrendLoading ? (
              <div className="manager-empty-state">Loading attendance trend...</div>
            ) : weeklyTrendData.length === 0 ? (
              <div className="manager-empty-state">No attendance data available</div>
            ) : (
              <div className="manager-bars">
                {weeklyTrendData.map((day) => (
                  <div key={day.day} className="manager-bar-item">
                    <div className="manager-bar-wrapper">
                      <div className="manager-bar" style={{ height: `${day.percent}%` }} />
                      <span className="manager-bar-value">{day.count}</span>
                    </div>
                    <span className="manager-bar-label">{day.day}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="manager-dashboard-right">
          <section className="manager-card manager-list-card">
            <header className="manager-card-header">
              <h3>Top Active Members</h3>
            </header>
            {isTopActiveMembersLoading ? (
              <div className="manager-empty-state">Loading top active members...</div>
            ) : topActiveMembers.length === 0 ? (
              <div className="manager-empty-state">No active members data available</div>
            ) : (
              <div className="manager-live-rankings">
                {topActiveMembers.map((member, index) => {
                  // Different styles for each rank
                  const rankStyles = [
                    { 
                      bgColor: '#fef3c7', 
                      medalColor: '#fbbf24', 
                      textColor: '#f59e0b',
                      icon: '👑',
                      medalIcon: '🥇'
                    }, // Rank 1: Gold
                    { 
                      bgColor: '#f3f4f6', 
                      medalColor: '#9ca3af', 
                      textColor: '#4b5563',
                      icon: '∞',
                      medalIcon: '🥈'
                    }, // Rank 2: Silver
                    { 
                      bgColor: '#fed7aa', 
                      medalColor: '#fb923c', 
                      textColor: '#f97316',
                      icon: '⭐',
                      medalIcon: '🥉'
                    }  // Rank 3: Bronze
                  ];
                  const style = rankStyles[index] || rankStyles[0];
                  
                  // Calculate dots (5 dots total, filled based on percentage)
                  const totalDots = 5;
                  const filledDots = Math.round((member.percentage / 100) * totalDots);
                  
                  return (
                    <div key={member.id} className="manager-ranking-card" style={{ background: style.bgColor }}>
                      <div className="manager-medal-section">
                        <span className="manager-rank-icon">{style.icon}</span>
                        <div className="manager-medal" style={{ color: style.medalColor }}>
                          {style.medalIcon}
                          <span className="manager-medal-number">{index + 1}</span>
                        </div>
                      </div>
                      <div className="manager-member-info">
                        <h4>{member.name}</h4>
                        <span className="manager-engagement-label">
                          <span className="manager-dot" style={{ background: '#10b981' }}></span>
                          • Engagement score
                        </span>
                      </div>
                      <div className="manager-score-section">
                        <span className="manager-score-percentage" style={{ color: style.textColor }}>
                          {member.percentage}%
                        </span>
                        <div className="manager-score-dots">
                          {Array.from({ length: totalDots }).map((_, dotIndex) => (
                            <span
                              key={dotIndex}
                              className={`manager-dot ${dotIndex < filledDots ? 'filled' : ''}`}
                              style={{ 
                                background: dotIndex < filledDots ? style.textColor : 'transparent',
                                borderColor: style.textColor
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="manager-rankings-footer">
                  <span className="manager-live-indicator">
                    <span className="manager-dot" style={{ background: '#10b981' }}></span>
                    • Live Rankings
                  </span>
                  <span className="manager-updated-text">Updated just now</span>
                </div>
              </div>
            )}
          </section>

          <section className="manager-card manager-list-card">
            <header className="manager-card-header">
              <h3>Recent Attendance</h3>
              <button 
                type="button" 
                className="manager-card-action"
                onClick={() => setActiveView('attendance')}
              >
                View All
              </button>
            </header>
            {isRecentAttendanceLoading ? (
              <div className="manager-empty-state">Loading recent attendance...</div>
            ) : recentAttendance.length === 0 ? (
              <div className="manager-empty-state">No recent attendance records</div>
            ) : (
              <div className="manager-list">
                {recentAttendance.map((item) => (
                  <div key={item.id} className="manager-list-item">
                    <div>
                      <span className="manager-list-date">{item.dateLabel}</span>
                      <h4>{item.service}</h4>
                    </div>
                    <span className="manager-list-value">{item.value}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {quickQrModalData && quickQrModalData.session && (
        <div className="qr-modal-overlay" onClick={closeQuickQrModal}>
          <div className="qr-modal-content single" onClick={(event) => event.stopPropagation()}>
            <div className="qr-modal-hero">
              <div className="qr-modal-hero-copy">
                <h3>{quickQrModalData.session.service_name || 'QR Session'}</h3>
                <p>{formatEventDateTime(quickQrModalData.session.event_datetime)}</p>
              </div>
              <button className="qr-modal-close" onClick={closeQuickQrModal} aria-label="Close quick QR preview">×</button>
            </div>
            <div className="qr-modal-body single">
              <div className="qr-modal-card single-layout">
                <div className="qr-visual">
                  <div className="qr-display">
                    <QRCodeSVG
                      id={`quick-qr-svg-${quickQrModalData.session.session_token}`}
                      value={quickQrModalData.qrUrl}
                      size={220}
                      includeMargin
                    />
                  </div>
                </div>
                <div className="qr-meta">
                  <span className="qr-meta-label">Status:</span>
                  <span className="qr-meta-value">{(quickQrModalData.session.status || 'active').toUpperCase()}</span>
                  <button
                    type="button"
                    className="qr-download-modal-btn"
                    onClick={handleQuickQrDownload}
                  >
                    Download QR
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderGenerateQr = () => {
    const [qrFormType, setQrFormType] = useState('preset');
    const [selectedService, setSelectedService] = useState('');
    const [customServiceName, setCustomServiceName] = useState('');
    const [qrDate, setQrDate] = useState('');
    const [qrTime, setQrTime] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [sessionStatusFilter, setSessionStatusFilter] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedQrData, setGeneratedQrData] = useState(null);
    const [showQrModal, setShowQrModal] = useState(false);
    const [qrMessage, setQrMessage] = useState('');
    const [qrMessageType, setQrMessageType] = useState('success');
    const [qrSessions, setQrSessions] = useState([]);
    const [sessionsLoading, setSessionsLoading] = useState(false);
    const [sessionsError, setSessionsError] = useState('');
    const [sessionsMessage, setSessionsMessage] = useState('');
    const [sessionsMessageType, setSessionsMessageType] = useState('success');
    const [deletingSessionId, setDeletingSessionId] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [sessionPendingDelete, setSessionPendingDelete] = useState(null);
    const [sessionsLastUpdated, setSessionsLastUpdated] = useState(null);
    const [autoDownloadOnOpen, setAutoDownloadOnOpen] = useState(false);
    const frontendBaseUrl = window.location.origin;

    const getExpirationHoursForService = useCallback((serviceName = '') => {
      return serviceName.trim().toLowerCase() === 'sunday service' ? 4 : 2;
    }, []);

    const handleDownloadQr = useCallback((session, filenameSuffix = '') => {
      if (!session?.qr_url) return;

      // Unified QR uses .qr-display in modal, legacy uses .qr-display-member or .qr-display-guest
      let svg;
      if (filenameSuffix === 'unified') {
        // For unified QR, look in the modal first (most specific)
        svg = document.querySelector('.qr-modal-body .qr-display svg') ||
              document.querySelector('.qr-modal-content .qr-display svg') ||
              document.querySelector('.qr-display svg');
      } else if (filenameSuffix === 'guest') {
        svg = document.querySelector('.qr-display-guest svg');
      } else {
        svg = document.querySelector('.qr-display-member svg');
      }

      if (!svg) {
        console.error('QR SVG element not found for', filenameSuffix || 'member');
        // Try a more general search as last resort
        const allSvgs = document.querySelectorAll('.qr-modal-body svg, .qr-display svg');
        if (allSvgs.length > 0) {
          svg = allSvgs[0];
          console.warn('Using fallback SVG element');
        } else {
          return;
        }
      }

      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svg);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        canvas.toBlob((blob) => {
          if (!blob) {
            console.error('Failed to create PNG blob from canvas');
            URL.revokeObjectURL(url);
            return;
          }

          const downloadUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = downloadUrl;
          const safeService = (session.service_name || 'qr-session').toString().replace(/\s+/g, '-');
          // Don't add suffix for 'unified' - it's the default QR code
          const suffix = (filenameSuffix && filenameSuffix !== 'unified') ? `-${filenameSuffix}` : '';
          link.download = `${safeService}${suffix}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(downloadUrl);
          URL.revokeObjectURL(url);
        }, 'image/png');
      };

      img.onerror = (error) => {
        console.error('Failed to load SVG for conversion', error);
        URL.revokeObjectURL(url);
      };

      img.src = url;
    }, []);

    const getTodayIsoDate = () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const quickServices = useMemo(() => QUICK_QR_PRESETS.map((preset) => ({
      key: preset.id,
      name: preset.serviceName,
      displayTime: preset.description,
      defaultTime: preset.defaultTime,
      expirationHours: preset.id === 'sunday-service' ? 4 : 2,
      dayOfWeek: preset.dayOfWeek
    })), []);

    const reminderText = useMemo(() => {
      if (qrFormType === 'preset') {
        if (selectedService) {
          const config = PRESET_SERVICE_CONFIG[selectedService];
          if (config) {
            const hours = config.expirationHours;
            return `Reminder: ${config.name} QR sessions remain active for ${hours} ${hours === 1 ? 'hour' : 'hours'} after the event time.`;
          }
        }
        return 'Reminder: Sunday Service QR sessions remain active for 4 hours; other events expire 2 hours after the event time.';
      }
      return 'Reminder: Custom QR sessions expire 2 hours after the event time.';
    }, [qrFormType, selectedService]);

    const filteredSessions = useMemo(() => {
      let filtered = qrSessions;
      
      // Filter by status
      if (sessionStatusFilter) {
        filtered = filtered.filter((session) => {
          // Check both event_status and session status
          const eventStatus = session.event_status?.toLowerCase() || '';
          const sessionStatus = session.status?.toLowerCase() || '';
          
          // Also check if session should be completed based on time
          const eventDateTime = session.event_datetime ? new Date(session.event_datetime.replace(' ', 'T')) : null;
          const now = new Date();
          const isPrayerMeeting = session.service_name?.toLowerCase().includes('prayer meeting');
          const hoursToComplete = isPrayerMeeting ? 2 : 4;
          const shouldBeCompleted = eventDateTime && (now - eventDateTime) > (hoursToComplete * 60 * 60 * 1000);
          
          // If filtering for 'completed', show if either event or session is completed, OR if it should be completed based on time
          if (sessionStatusFilter === 'completed') {
            return eventStatus === 'completed' || sessionStatus === 'completed' || shouldBeCompleted;
          }
          
          // If filtering for 'active', show if event is active/upcoming or session is active, AND not completed
          if (sessionStatusFilter === 'active') {
            return (eventStatus === 'active' || eventStatus === 'upcoming' || sessionStatus === 'active') 
                   && eventStatus !== 'completed' && sessionStatus !== 'completed' && !shouldBeCompleted;
          }
          
          return eventStatus === sessionStatusFilter;
        });
      }
      
      // Filter by search query
      const query = searchQuery.trim().toLowerCase();
      if (query) {
        filtered = filtered.filter((session) => {
          const serviceName = session.service_name?.toLowerCase() || '';
          const eventType = session.event_type?.toLowerCase() || '';
          const eventDateTime = session.event_datetime?.toLowerCase() || '';
          return (
            serviceName.includes(query) ||
            eventType.includes(query) ||
            eventDateTime.includes(query)
          );
        });
      }
      
      return filtered;
    }, [qrSessions, searchQuery, sessionStatusFilter]);

    const formatSessionDateTime = useCallback((dateTimeString) => {
      if (!dateTimeString) {
        return { dateLabel: '—', timeLabel: '' };
      }

      const normalized = dateTimeString.replace(' ', 'T');
      const date = new Date(normalized);

      if (Number.isNaN(date.getTime())) {
        return { dateLabel: dateTimeString, timeLabel: '' };
      }

      const dateLabel = date.toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric'
      });

      const timeLabel = date.toLocaleTimeString(undefined, {
        hour: 'numeric', minute: '2-digit', hour12: true
      });

      return { dateLabel, timeLabel };
    }, []);

    const fetchSessions = useCallback(async () => {
      setSessionsLoading(true);
      setSessionsError('');
      setSessionsMessage('');

      try {
        const params = new URLSearchParams();
        if (sessionStatusFilter) {
          params.append('status', sessionStatusFilter);
        }
        // No longer filter by session_type - unified QR works for both
        const response = await fetch(`${backendBaseUrl}/api/qr_sessions/list.php?${params.toString()}`);

        if (!response.ok) {
          throw new Error(`Failed to load sessions (${response.status})`);
        }

        const result = await response.json();

        if (result.success) {
          // Unified QR - no longer need to pair member/guest sessions
          const sessions = result.data || [];
          setQrSessions(sessions);
          setSessionsLastUpdated(new Date().toISOString());
        } else {
          throw new Error(result.message || 'Failed to load sessions');
        }
      } catch (error) {
        console.error('Error fetching QR sessions:', error);
        setSessionsError(error.message || 'Unable to load sessions');
      } finally {
        setSessionsLoading(false);
      }
    }, [backendBaseUrl, sessionStatusFilter]);

    const handleRequestDelete = useCallback((session) => {
      if (!session) return;
      setSessionPendingDelete(session);
      setShowDeleteModal(true);
    }, []);

    const handleCancelDelete = useCallback(() => {
      setShowDeleteModal(false);
      setSessionPendingDelete(null);
    }, []);

    const handleDeleteSession = useCallback(async () => {
      if (!sessionPendingDelete) return;

      setDeletingSessionId(sessionPendingDelete.id);
      setSessionsMessage('');
      setSessionsError('');

      setShowDeleteModal(false);

      try {
        const response = await fetch(`${backendBaseUrl}/api/qr_sessions/delete.php`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ session_id: sessionPendingDelete.id })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Failed to delete session');
        }

        await fetchSessions();
        setSessionsMessage('QR session deleted successfully.');
        setSessionsMessageType('success');
      } catch (error) {
        console.error('Error deleting QR session:', error);
        setSessionsMessage(error.message || 'Unable to delete session');
        setSessionsMessageType('error');
      } finally {
        setDeletingSessionId(null);
        setSessionPendingDelete(null);
      }
    }, [backendBaseUrl, fetchSessions, sessionPendingDelete]);

    useEffect(() => {
      fetchSessions();
    }, [fetchSessions]);

    useEffect(() => {
      const interval = setInterval(() => {
        fetchSessions();
      }, 15000);

      return () => clearInterval(interval);
    }, [fetchSessions]);

    const lastUpdatedLabel = useMemo(() => {
      if (!sessionsLastUpdated) return '—';
      const date = new Date(sessionsLastUpdated);
      if (Number.isNaN(date.getTime())) return '—';
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    }, [sessionsLastUpdated]);

    useEffect(() => {
      if (showQrModal && generatedQrData && autoDownloadOnOpen) {
        const timer = setTimeout(() => {
          // Unified QR - single download
          const activeSession = generatedQrData.unified || generatedQrData.member || generatedQrData.guest;
          if (activeSession) {
            handleDownloadQr(activeSession, 'unified');
          }
          setAutoDownloadOnOpen(false);
        }, 150);

        return () => clearTimeout(timer);
      }
    }, [showQrModal, generatedQrData, autoDownloadOnOpen, handleDownloadQr]);

    useEffect(() => {
      if (!sessionsMessage) return undefined;

      const timeout = setTimeout(() => setSessionsMessage(''), 3500);
      return () => clearTimeout(timeout);
    }, [sessionsMessage]);

    const handleViewSession = useCallback((session, shouldDownload = false, type = 'member') => {
      if (!session) return;

      const normalize = (item) => {
        if (!item) return null;
        const expirationHours = Number.isFinite(Number(item.expiration_hours)) && Number(item.expiration_hours) > 0
          ? Number(item.expiration_hours)
          : getExpirationHoursForService(item.service_name);
        // Unified QR - always use /checkin route
        const routePath = '/checkin';
        return {
          ...item,
          expiration_hours: expirationHours,
          qr_url: `${frontendBaseUrl}${routePath}?session=${item.session_token}`
        };
      };

      // Unified QR - single session for both members and guests
      const normalized = normalize(session);
      if (!normalized) return;

      const serviceName = normalized.service_name || session.service_name;
      const eventDatetime = normalized.event_datetime || session.event_datetime;
      const expirationHours = normalized.expiration_hours || session.expiration_hours;

      setGeneratedQrData({
        unified: normalized,
        service_name: serviceName,
        event_datetime: eventDatetime,
        expiration_hours: expirationHours
      });
      setShowQrModal(true);

      if (shouldDownload) {
        setAutoDownloadOnOpen(true);
      }
    }, [frontendBaseUrl, getExpirationHoursForService]);

    const modalExpirationHours = useMemo(() => {
      if (!generatedQrData) {
        return 2;
      }
      const parsed = Number(generatedQrData.expiration_hours);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
      return getExpirationHoursForService(generatedQrData.service_name);
    }, [generatedQrData, getExpirationHoursForService]);

    return (
      <div className="manager-generate-qr-module">
        <div className="qr-module-header">
          <h2>Generate QR Code</h2>
          <p>Create QR codes for attendance tracking</p>
        </div>

        <div className="qr-module-grid">
          <div className="qr-form-panel">
            <div className="qr-quick-generate">
              <h4>Quick Generate</h4>
              <div className="qr-quick-grid">
                {quickServices.map((service, index) => (
                  <button
                    key={index}
                    type="button"
                    className="qr-quick-card"
                    onClick={() => {
                      setQrFormType('preset');
                      setSelectedService(service.key);
                      const occurrence = computeNextOccurrenceForPreset(service.dayOfWeek, service.defaultTime);
                      setCustomServiceName('');
                      setQrDate(occurrence.date);
                      setQrTime(occurrence.time);
                      setQrMessage('Preset filled in. You can adjust date/time before generating.');
                      setQrMessageType('success');
                      setTimeout(() => setQrMessage(''), 3000);
                    }}
                  >
                    <div className="qr-quick-info">
                      <span className="qr-quick-name">{service.name}</span>
                      <span className="qr-quick-time">{service.displayTime}</span>
                    </div>
                    <div className="qr-quick-icon">+</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="qr-form-card">
              <h3>New QR Code</h3>
              <p className="qr-expiry-note">
                {reminderText}
              </p>

              <div className="qr-form-tabs">
                <button
                  type="button"
                  className={`qr-tab ${qrFormType === 'preset' ? 'active' : ''}`}
                  onClick={() => {
                    setQrFormType('preset');
                    setCustomServiceName('');
                  }}
                >
                  Preset Service
                </button>
                <button
                  type="button"
                  className={`qr-tab ${qrFormType === 'custom' ? 'active' : ''}`}
                  onClick={() => {
                    setQrFormType('custom');
                    setSelectedService('');
                  }}
                >
                  Custom Event
                </button>
              </div>

              <div className="qr-form-body">
                <div className="qr-form-group">
                  <label>{qrFormType === 'preset' ? 'Select Service' : 'Event Name'}</label>
                  {qrFormType === 'preset' ? (
                    <select
                      value={selectedService}
                      onChange={(e) => setSelectedService(e.target.value)}
                      className="qr-form-select"
                    >
                      <option value="">Choose a service...</option>
                      <option value="sunday-service">Sunday Service</option>
                      <option value="prayer-meeting">Prayer Meeting</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={customServiceName}
                      onChange={(e) => setCustomServiceName(e.target.value)}
                      className="qr-form-input"
                      placeholder="Enter event name"
                    />
                  )}
                </div>

                <div className="qr-form-group">
                  <label>Date</label>
                  <input
                    type="date"
                    value={qrDate}
                    onChange={(e) => setQrDate(e.target.value)}
                    className="qr-form-input"
                  />
                </div>

                <div className="qr-form-group">
                  <label>Time</label>
                  <input
                    type="time"
                    value={qrTime}
                    onChange={(e) => setQrTime(e.target.value)}
                    className="qr-form-input"
                  />
                </div>

                <button type="button" className="qr-generate-btn" onClick={handleGenerateQr} disabled={isGenerating}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="6" height="6"></rect>
                    <rect x="15" y="3" width="6" height="6"></rect>
                    <rect x="15" y="15" width="6" height="6"></rect>
                    <rect x="3" y="15" width="6" height="6"></rect>
                  </svg>
                  {isGenerating ? 'Generating...' : 'Generate QR Code'}
                </button>
              </div>
            </div>

            {qrMessage && (
              <div className={`qr-message qr-message-${qrMessageType}`}>
                {qrMessage}
              </div>
            )}
          </div>

          <div className="qr-list-panel">
            <div className="qr-list-card">
              <div className="qr-list-header">
                <div className="qr-header-left">
                  <div className="qr-title-row">
                    <h3>Generated QR Codes</h3>
                  </div>
                  <p className="qr-last-updated">Last updated: {lastUpdatedLabel}</p>
                  <div className="qr-status-toggle">
                    <button
                      type="button"
                      className={!sessionStatusFilter ? 'active' : ''}
                      onClick={() => setSessionStatusFilter('')}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      className={sessionStatusFilter === 'active' ? 'active' : ''}
                      onClick={() => setSessionStatusFilter('active')}
                    >
                      Active
                    </button>
                    <button
                      type="button"
                      className={sessionStatusFilter === 'completed' ? 'active' : ''}
                      onClick={() => setSessionStatusFilter('completed')}
                    >
                      Completed
                    </button>
                  </div>
                </div>
                <div className="qr-header-right">
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="qr-search-input"
                  />
                </div>
              </div>

              {sessionsError && (
                <div className="qr-message qr-message-error">
                  {sessionsError}
                </div>
              )}

              {sessionsMessage && !sessionsError && (
                <div className={`qr-message qr-message-${sessionsMessageType}`}>
                  {sessionsMessage}
                </div>
              )}

              <div className="qr-table-wrapper">
                <table className="qr-table">
                  <thead>
                    <tr>
                      <th>SERVICE/EVENT</th>
                      <th>DATE & TIME</th>
                      <th>SCANS</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionsLoading ? (
                      <tr>
                        <td colSpan="4" style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b' }}>
                          Loading sessions...
                        </td>
                      </tr>
                    ) : filteredSessions.length === 0 ? (
                      <tr>
                        <td colSpan="4" style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b' }}>
                          {searchQuery ? 'No sessions match your search.' : 'No QR sessions generated yet.'}
                        </td>
                      </tr>
                    ) : (
                      filteredSessions.map((session) => {
                        const { dateLabel, timeLabel } = formatSessionDateTime(session.event_datetime);
                        const totalScans = (session.scan_count ?? 0) + (session.paired_guest?.scan_count ?? 0);

                        return (
                          <tr key={session.id}>
                            <td className="qr-service-cell">{session.service_name}</td>
                            <td className="qr-datetime-cell">
                              <div>{dateLabel}</div>
                              <div className="qr-time-sub">{timeLabel}</div>
                            </td>
                            <td>
                              <span className="qr-scan-badge">{totalScans}</span>
                            </td>
                            <td>
                              <div className="qr-action-buttons">
                                <button
                                  type="button"
                                  className="qr-action-btn qr-view-btn member-action"
                                  title="View QR"
                                  onClick={() => handleViewSession(session, false, 'member')}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="3" width="6" height="6"></rect>
                                    <rect x="15" y="3" width="6" height="6"></rect>
                                    <rect x="15" y="15" width="6" height="6"></rect>
                                    <rect x="3" y="15" width="6" height="6"></rect>
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  className="qr-action-btn qr-download-btn member-action"
                                  title="Download"
                                  onClick={() => handleViewSession(session, true, 'member')}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                  </svg>
                                </button>
                                {session.paired_guest && (
                                  <button
                                    type="button"
                                    className="qr-action-btn qr-view-btn guest-action"
                                    title="View Guest QR"
                                    onClick={() => handleViewSession({ ...session.paired_guest, paired_member: session }, false, 'guest')}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <rect x="3" y="3" width="6" height="6"></rect>
                                      <rect x="15" y="3" width="6" height="6"></rect>
                                      <rect x="15" y="15" width="6" height="6"></rect>
                                      <rect x="3" y="15" width="6" height="6"></rect>
                                    </svg>
                                  </button>
                                )}
                                {session.paired_guest && (
                                  <button
                                    type="button"
                                    className="qr-action-btn qr-download-btn guest-action"
                                    title="Download Guest QR"
                                    onClick={() => handleViewSession({ ...session.paired_guest, paired_member: session }, true, 'guest')}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                      <polyline points="7 10 12 15 17 10"></polyline>
                                      <line x1="12" y1="15" x2="12" y2="3"></line>
                                    </svg>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="qr-action-btn qr-delete-btn"
                                  title="Delete"
                                  disabled={deletingSessionId === session.id}
                                  onClick={() => handleRequestDelete(session)}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                    <path d="M10 11v6" />
                                    <path d="M14 11v6" />
                                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {showQrModal && generatedQrData && (
          <div className="qr-modal-overlay" onClick={() => setShowQrModal(false)}>
            <div className="qr-modal-content single" onClick={(e) => e.stopPropagation()}>
              <div className="qr-modal-hero">
                <div className="qr-modal-hero-copy">
                  <h3>QR Code Ready</h3>
                  <p>Your QR code has been generated (works for both members and guests)</p>
                </div>
                <button className="qr-modal-close" onClick={() => setShowQrModal(false)}>×</button>
              </div>
              <div className="qr-modal-body landscape">
                {(() => {
                  // Unified QR - single session for both members and guests
                  const activeSession = generatedQrData.unified || generatedQrData.member || generatedQrData.guest;
                  if (!activeSession) {
                    return null;
                  }

                  return (
                    <div className="qr-modal-card single-layout">
                      <div className="qr-visual">
                        <div className="qr-display">
                          <QRCodeSVG
                            value={activeSession.qr_url}
                            size={190}
                            level="H"
                            includeMargin={true}
                          />
                        </div>
                        <span className="qr-type-label">QR Code (Member & Guest)</span>
                      </div>

                      <div className="qr-details enhanced">
                        <div className="qr-info-pair">
                          <div className="qr-info-card">
                            <span className="qr-info-label">Service</span>
                            <span className="qr-info-value">{activeSession.service_name}</span>
                          </div>
                          <div className="qr-info-card">
                            <span className="qr-info-label">Date &amp; Time</span>
                            <span className="qr-info-value">{formatEventDateTime(activeSession.event_datetime)}</span>
                          </div>
                        </div>
                        <div className="qr-info-card token">
                          <span className="qr-info-label">Session Token</span>
                          <span className="qr-info-value">{activeSession.session_token}</span>
                        </div>
                        <div className="qr-expiry-pill">
                          <span className="qr-expiry-indicator" />
                          <span>{buildExpirationLabel(activeSession.expiration_hours)}</span>
                        </div>
                        <button
                          className="qr-download-modal-btn enhanced"
                          onClick={() => handleDownloadQr(activeSession, 'unified')}
                        >
                          ⬇ Download QR
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {showDeleteModal && sessionPendingDelete && (
          <div className="qr-delete-modal-overlay" onClick={handleCancelDelete}>
            <div className="qr-delete-modal" onClick={(e) => e.stopPropagation()}>
              <div className="qr-delete-header">
                <h3>Delete QR Session</h3>
                <button type="button" className="qr-delete-close" onClick={handleCancelDelete} aria-label="Close delete confirmation">×</button>
              </div>
              <div className="qr-delete-body">
                <p>Are you sure you want to delete <strong>{sessionPendingDelete.service_name}</strong>?</p>
                <p className="qr-delete-subtext">This action cannot be undone.</p>
              </div>
              <div className="qr-delete-actions">
                <button type="button" className="qr-delete-cancel" onClick={handleCancelDelete}>Cancel</button>
                <button
                  type="button"
                  className="qr-delete-confirm"
                  onClick={handleDeleteSession}
                  disabled={deletingSessionId === sessionPendingDelete.id}
                >
                  {deletingSessionId === sessionPendingDelete.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );

    async function handleGenerateQr() {
      if ((qrFormType === 'preset' && !selectedService) || (qrFormType === 'custom' && !customServiceName.trim()) || !qrDate || !qrTime) {
        setQrMessage('Please fill in all fields');
        setQrMessageType('error');
        setTimeout(() => setQrMessage(''), 3000);
        return;
      }

      setIsGenerating(true);
      setQrMessage('');

      try {
        const presetConfig = PRESET_SERVICE_CONFIG[selectedService] || null;

        const serviceNameToSend = qrFormType === 'custom'
          ? customServiceName.trim()
          : (presetConfig?.name || selectedService);

        const response = await fetch(`${backendBaseUrl}/api/qr_sessions/create.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_name: serviceNameToSend,
            event_date: qrDate,
            event_time: qrTime,
            event_type: qrFormType,
            created_by: managerProfile.id
          })
        });

        const result = await response.json();

        if (result.success) {
          const payload = result.data || {};
          
          // Unified QR - single session for both members and guests
          const unifiedSession = payload;

          const normalizeSession = (session) => {
            if (!session) return null;
            const expirationHours = getExpirationHoursForService(session.service_name);
            let expiresAt = session.expires_at;

            if (!expiresAt && session.event_datetime) {
              const normalizedStart = new Date(session.event_datetime.replace(' ', 'T'));
              if (!Number.isNaN(normalizedStart.getTime())) {
                const expiryDate = new Date(normalizedStart.getTime() + expirationHours * 60 * 60 * 1000);
                expiresAt = expiryDate.toISOString().slice(0, 19).replace('T', ' ');
              }
            }

            // Unified QR always uses /checkin route
            const routePath = '/checkin';

            return {
              ...session,
              expiration_hours: expirationHours,
              expires_at: expiresAt,
              qr_url: `${frontendBaseUrl}${routePath}?session=${session.session_token}`
            };
          };

          const normalizedSession = normalizeSession(unifiedSession);

          setGeneratedQrData({
            unified: normalizedSession,
            service_name: normalizedSession?.service_name,
            event_datetime: normalizedSession?.event_datetime
          });
          setShowQrModal(true);
          setQrMessage('QR Code generated successfully!');
          setQrMessageType('success');
          // Reset form
          setSelectedService('');
          setCustomServiceName('');
          setQrDate('');
          setQrTime('');
          fetchSessions();
        } else {
          throw new Error(result.message || 'Failed to generate QR code');
        }
      } catch (error) {
        console.error('QR generation error:', error);
        setQrMessage(error.message || 'Error generating QR code');
        setQrMessageType('error');
      } finally {
        setIsGenerating(false);
        setTimeout(() => setQrMessage(''), 5000);
      }
    }

  };

  // Manual Check-In State
  const [showManualCheckIn, setShowManualCheckIn] = useState(false);
  const [manualCheckInSearch, setManualCheckInSearch] = useState('');
  const [allMembers, setAllMembers] = useState([]); // All members list
  const [filteredMembers, setFilteredMembers] = useState([]); // Filtered members for display
  const [selectedMembers, setSelectedMembers] = useState([]); // Changed to array for multiple selection
  const [activeSessions, setActiveSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [checkInMessage, setCheckInMessage] = useState({ type: '', text: '' });
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  // Fetch active QR sessions
  const fetchActiveSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    try {
      const response = await fetch(`${backendBaseUrl}/api/qr_sessions/list.php?status=active&limit=50`);
      if (!response.ok) {
        console.error('Failed to fetch sessions:', response.status);
        setActiveSessions([]);
        setIsLoadingSessions(false);
        return;
      }

      const result = await response.json();
      console.log('Sessions API response:', result); // Debug log
      
      if (result.success && Array.isArray(result.data)) {
        // Filter to only active sessions and sort by event_datetime
        const active = result.data
          .filter(session => session.status === 'active')
          .sort((a, b) => new Date(b.event_datetime) - new Date(a.event_datetime));
        console.log('Active sessions:', active); // Debug log
        setActiveSessions(active);
      } else {
        console.log('No active sessions or invalid response format');
        setActiveSessions([]);
      }
    } catch (error) {
      console.error('Error fetching active sessions:', error);
      setActiveSessions([]);
    } finally {
      setIsLoadingSessions(false);
    }
  }, [backendBaseUrl]);

  // Load all members for manual check-in
  const loadAllMembers = useCallback(async () => {
    setIsLoadingMembers(true);
    try {
      const response = await fetch(`${backendBaseUrl}/api/members/get_all.php`);
      if (!response.ok) {
        console.error('Failed to fetch members:', response.status);
        setAllMembers([]);
        setFilteredMembers([]);
        setIsLoadingMembers(false);
        return;
      }

      const result = await response.json();

      if (Array.isArray(result) && result.length > 0) {
        // Sort members alphabetically by name
        const sorted = result.sort((a, b) => {
          const nameA = (a.name || '').toLowerCase();
          const nameB = (b.name || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });
        setAllMembers(sorted);
        setFilteredMembers(sorted);
      } else {
        setAllMembers([]);
        setFilteredMembers([]);
      }
    } catch (error) {
      console.error('Error loading members:', error);
      setAllMembers([]);
      setFilteredMembers([]);
    } finally {
      setIsLoadingMembers(false);
    }
  }, [backendBaseUrl]);

  // Filter members based on search query
  useEffect(() => {
    if (!showManualCheckIn || allMembers.length === 0) {
      return;
    }

    const searchTerm = manualCheckInSearch.trim().toLowerCase();
    if (!searchTerm) {
      setFilteredMembers(allMembers);
      return;
    }

    const filtered = allMembers.filter(member => {
      const name = (member.name || '').toLowerCase();
      const email = (member.email || '').toLowerCase();
      const username = (member.username || '').toLowerCase();
      return name.includes(searchTerm) || email.includes(searchTerm) || username.includes(searchTerm);
    });

    // Sort filtered results alphabetically
    const sorted = filtered.sort((a, b) => {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

    setFilteredMembers(sorted);
  }, [manualCheckInSearch, allMembers, showManualCheckIn]);

  // Handle manual check-in (supports multiple members)
  const handleManualCheckIn = async () => {
    if (selectedMembers.length === 0 || !selectedSession) {
      setCheckInMessage({ type: 'error', text: 'Please select at least one member and a session' });
      return;
    }

    setIsCheckingIn(true);
    setCheckInMessage({ type: '', text: '' });

    try {
      // Check in all selected members
      const checkInPromises = selectedMembers.map(member =>
        fetch(`${backendBaseUrl}/api/qr_sessions/checkin.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_token: selectedSession.session_token,
            member_id: member.id,
            member_name: member.name,
            member_contact: member.contact_number || null
          })
        }).then(res => res.json())
      );

      const results = await Promise.all(checkInPromises);
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      if (successful.length === selectedMembers.length) {
        // All successful
        const names = selectedMembers.map(m => m.name).join(', ');
        setCheckInMessage({ 
          type: 'success', 
          text: `${successful.length} member${successful.length > 1 ? 's' : ''} checked in successfully: ${names}` 
        });
        setSelectedMembers([]);
        setSelectedSession(null);
        setManualCheckInSearch('');
        fetchActiveSessions();
        loadAllMembers(); // Refresh members list
      } else if (successful.length > 0) {
        // Partial success
        const names = successful.map((_, i) => selectedMembers[i].name).join(', ');
        setCheckInMessage({ 
          type: 'error', 
          text: `${successful.length} of ${selectedMembers.length} members checked in. Failed: ${failed.length} member(s).` 
        });
        // Remove successfully checked in members
        const failedIds = failed.map((_, i) => {
          const failedIndex = results.findIndex((r, idx) => !r.success && idx === i);
          return selectedMembers[failedIndex]?.id;
        }).filter(Boolean);
        setSelectedMembers(prev => prev.filter(m => !failedIds.includes(m.id)));
      } else {
        // All failed
        const errorMsg = failed[0]?.message || 'Failed to check in members';
        setCheckInMessage({ type: 'error', text: errorMsg });
      }
    } catch (error) {
      console.error('Error checking in members:', error);
      setCheckInMessage({ type: 'error', text: 'An error occurred while checking in members' });
    } finally {
      setIsCheckingIn(false);
    }
  };

  // Load active sessions and members when manual check-in is opened
  useEffect(() => {
    if (showManualCheckIn) {
      fetchActiveSessions();
      loadAllMembers();
    }
  }, [showManualCheckIn, fetchActiveSessions, loadAllMembers]);

  const handleCloseManualCheckIn = () => {
    setShowManualCheckIn(false);
    setSelectedMembers([]);
    setSelectedSession(null);
    setManualCheckInSearch('');
    setAllMembers([]);
    setFilteredMembers([]);
    setCheckInMessage({ type: '', text: '' });
  };

  const toggleMemberSelection = (member) => {
    setSelectedMembers(prev => {
      const exists = prev.find(m => m.id === member.id);
      if (exists) {
        return prev.filter(m => m.id !== member.id);
      } else {
        return [...prev, member];
      }
    });
  };

  const removeSelectedMember = (memberId) => {
    setSelectedMembers(prev => prev.filter(m => m.id !== memberId));
  };

  const renderManualCheckIn = () => (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2010
      }}
      onClick={handleCloseManualCheckIn}
    >
      <div
        style={{
          background: '#ffffff',
          padding: '0',
          borderRadius: '12px',
          width: '95%',
          maxWidth: '1000px',
          maxHeight: '90vh',
          overflow: 'hidden',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '1.5rem 2rem',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #2563eb, #0ea5e9)',
          color: 'white'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '600', color: 'white' }}>Attendance Check-In</h2>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.9)' }}>Mark members present</p>
          </div>
          <button
            onClick={handleCloseManualCheckIn}
            style={{
              padding: '0.5rem',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '1.5rem',
              lineHeight: '1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            }}
          >
            ×
          </button>
        </div>

        {/* Content - Two Column Layout */}
        <div style={{
          padding: '2rem',
          overflowY: 'auto',
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '2rem'
        }}>

          {/* Left Column - Select Members */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ 
              display: 'block', 
              fontWeight: '600', 
              color: '#1f2937',
              fontSize: '1rem',
              marginBottom: '1rem'
            }}>
              Select Members
            </label>
            
            {/* Search Input */}
            <input
              type="text"
              value={manualCheckInSearch}
              onChange={(e) => setManualCheckInSearch(e.target.value)}
              placeholder="Search members..."
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '0.875rem',
                backgroundColor: '#fff',
                color: '#1f2937',
                marginBottom: '1rem',
                transition: 'all 0.2s'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#3b82f6';
                e.target.style.outline = 'none';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#d1d5db';
              }}
            />

            {/* Members List */}
            {isLoadingMembers ? (
              <div style={{
                padding: '2rem',
                textAlign: 'center',
                color: '#6b7280',
                fontSize: '0.875rem',
                backgroundColor: '#f9fafb',
                borderRadius: '8px'
              }}>
                Loading members...
              </div>
            ) : filteredMembers.length > 0 ? (
              <div style={{
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                maxHeight: '450px',
                overflowY: 'auto',
                backgroundColor: '#fff'
              }}>
                {filteredMembers.map((member) => {
                  const isSelected = selectedMembers.some(m => m.id === member.id);
                  const birthDate = member.birthday ? new Date(member.birthday) : null;
                  const today = new Date();
                  let age = null;
                  if (birthDate) {
                    age = today.getFullYear() - birthDate.getFullYear();
                    const monthDiff = today.getMonth() - birthDate.getMonth();
                    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                      age--;
                    }
                  }
                  return (
                    <div
                      key={member.id}
                      onClick={() => toggleMemberSelection(member)}
                      style={{
                        padding: '0.875rem 1rem',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f3f4f6',
                        backgroundColor: isSelected ? '#eff6ff' : '#fff',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.75rem',
                        transition: 'background-color 0.15s'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = '#f9fafb';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = '#fff';
                        }
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleMemberSelection(member)}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          width: '18px',
                          height: '18px',
                          marginTop: '2px',
                          cursor: 'pointer',
                          accentColor: '#667eea',
                          flexShrink: 0
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ 
                          fontWeight: '600', 
                          color: '#1f2937',
                          fontSize: '0.875rem',
                          marginBottom: '0.25rem'
                        }}>
                          {member.name}
                        </div>
                        {age !== null && age <= 12 && (
                          <div style={{ 
                            display: 'inline-block',
                            fontSize: '0.75rem', 
                            color: '#ea580c', 
                            fontWeight: '600',
                            backgroundColor: '#ffedd5',
                            padding: '0.125rem 0.5rem',
                            borderRadius: '12px',
                            marginBottom: '0.25rem'
                          }}>
                            Minor ({age})
                          </div>
                        )}
                        {member.email && (
                          <div style={{ 
                            fontSize: '0.75rem', 
                            color: '#6b7280',
                            marginTop: '0.125rem'
                          }}>
                            {member.email}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{
                padding: '2rem',
                textAlign: 'center',
                color: '#6b7280',
                fontSize: '0.875rem',
                backgroundColor: '#f9fafb',
                borderRadius: '8px'
              }}>
                {manualCheckInSearch.trim() 
                  ? `No members found matching "${manualCheckInSearch}"`
                  : 'No members available'
                }
              </div>
            )}
          </div>

          {/* Right Column - Select Session */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <label style={{ 
                display: 'block', 
                fontWeight: '600', 
                color: '#1f2937',
                fontSize: '1rem'
              }}>
                Select Session
              </label>
              {selectedMembers.length > 0 && (
                <span style={{
                  fontSize: '0.75rem',
                  color: '#6b7280',
                  backgroundColor: '#f3f4f6',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '12px'
                }}>
                  {selectedMembers.length} selected
                </span>
              )}
            </div>

            {/* Sessions List */}
            {isLoadingSessions ? (
              <div style={{
                padding: '2rem',
                textAlign: 'center',
                color: '#6b7280',
                fontSize: '0.875rem',
                backgroundColor: '#f9fafb',
                borderRadius: '8px'
              }}>
                Loading sessions...
              </div>
            ) : activeSessions.length === 0 ? (
              <div style={{
                padding: '2rem',
                textAlign: 'center',
                color: '#6b7280',
                fontSize: '0.875rem',
                backgroundColor: '#f9fafb',
                borderRadius: '8px'
              }}>
                No active sessions available
              </div>
            ) : (
              <div style={{
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                maxHeight: '300px',
                overflowY: 'auto',
                backgroundColor: '#fff',
                marginBottom: '1rem'
              }}>
                {activeSessions.map((session) => {
                  const isSelected = selectedSession?.session_token === session.session_token;
                  const eventDate = new Date(session.event_datetime);
                  const dateStr = eventDate.toLocaleDateString('en-GB', { 
                    day: '2-digit', 
                    month: '2-digit', 
                    year: 'numeric' 
                  });
                  const timeStr = eventDate.toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit',
                    hour12: true 
                  });
                  
                  return (
                    <div
                      key={session.id}
                      onClick={() => setSelectedSession(session)}
                      style={{
                        padding: '0.875rem 1rem',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f3f4f6',
                        backgroundColor: isSelected ? '#eff6ff' : '#fff',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.75rem',
                        transition: 'background-color 0.15s'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = '#f9fafb';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = '#fff';
                        }
                      }}
                    >
                      <input
                        type="radio"
                        checked={isSelected}
                        onChange={() => setSelectedSession(session)}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          width: '18px',
                          height: '18px',
                          marginTop: '2px',
                          cursor: 'pointer',
                          accentColor: '#667eea',
                          flexShrink: 0
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ 
                          fontWeight: '600', 
                          color: '#1f2937',
                          fontSize: '0.875rem',
                          marginBottom: '0.25rem'
                        }}>
                          {session.service_name}
                        </div>
                        <div style={{ 
                          fontSize: '0.75rem', 
                          color: '#6b7280'
                        }}>
                          {dateStr} • {timeStr}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Summary Section */}
            {selectedMembers.length > 0 && (
              <div style={{
                padding: '1rem',
                background: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)',
                borderRadius: '8px',
                border: '2px solid #c4b5fd',
                boxShadow: '0 2px 4px rgba(102, 126, 234, 0.1)',
                marginBottom: '1.5rem'
              }}>
                <div style={{ 
                  fontWeight: '600', 
                  color: '#5b21b6',
                  fontSize: '0.875rem',
                  marginBottom: '0.5rem'
                }}>
                  Summary
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                  Members: <span style={{ fontWeight: '600', color: '#667eea' }}>{selectedMembers.length}</span>
                </div>
                {selectedSession && (
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    Session: <span style={{ fontWeight: '600', color: '#667eea' }}>{selectedSession.service_name}</span>
                  </div>
                )}
              </div>
            )}

            {/* Message Display */}
            {checkInMessage.text && (
              <div style={{
                padding: '0.75rem 1rem',
                marginBottom: '1rem',
                borderRadius: '6px',
                backgroundColor: checkInMessage.type === 'success' ? '#d1fae5' : '#fee2e2',
                color: checkInMessage.type === 'success' ? '#065f46' : '#991b1b',
                fontSize: '0.875rem'
              }}>
                {checkInMessage.text}
              </div>
            )}

            {/* Action Buttons - Inside Content */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'flex-end',
              gap: '0.75rem',
              marginTop: '1.5rem'
            }}>
              <button
                type="button"
                onClick={handleCloseManualCheckIn}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#e5e7eb';
                  e.target.style.borderColor = '#d1d5db';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#f3f4f6';
                  e.target.style.borderColor = '#e5e7eb';
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleManualCheckIn}
                disabled={selectedMembers.length === 0 || !selectedSession || isCheckingIn}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: (selectedMembers.length === 0 || !selectedSession || isCheckingIn) 
                    ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)'
                    : 'linear-gradient(135deg, #2563eb, #0ea5e9)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: (selectedMembers.length === 0 || !selectedSession || isCheckingIn) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: (selectedMembers.length === 0 || !selectedSession || isCheckingIn) 
                    ? 'none' 
                    : '0 2px 8px rgba(37, 99, 235, 0.3)'
                }}
                onMouseEnter={(e) => {
                  if (!(selectedMembers.length === 0 || !selectedSession || isCheckingIn)) {
                    e.target.style.transform = 'translateY(-1px)';
                    e.target.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!(selectedMembers.length === 0 || !selectedSession || isCheckingIn)) {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 2px 8px rgba(37, 99, 235, 0.3)';
                  }
                }}
              >
                {isCheckingIn 
                  ? `Checking In ${selectedMembers.length}...` 
                  : `Check In (${selectedMembers.length > 0 ? selectedMembers.length : 0})`
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAttendance = () => (
    <div className="manager-attendance-module">
      <AttendanceManagement 
        dateFormat="mm/dd/yyyy" 
        isManager={true}
        onManualCheckInClick={() => setShowManualCheckIn(true)}
      />
      {showManualCheckIn && renderManualCheckIn()}
    </div>
  );

  const renderMembers = () => (
    <div className="manager-members-module">
      <MembersManagement dateFormat="mm/dd/yyyy" allowMemberMutations={false} reviewScope="manager" />
    </div>
  );

  const activeContent = {
    dashboard: renderDashboard(),
    'generate-qr': renderGenerateQr(),
    attendance: renderAttendance(),
    members: renderMembers()
  }[activeView];

  return (
    <div className="manager-container">
      <header className="manager-topbar">
        <div className="manager-topbar-left">
          <button
            className="manager-mobile-menu"
            onClick={() => setShowMobileMenu((prev) => !prev)}
            aria-label="Toggle navigation"
            type="button"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <img
            src={headerLogo || churchLogo || logoImage}
            alt="Church logo"
            className="manager-logo"
          />
          <span className="manager-church-name">{churchName}</span>
        </div>

        <nav className="manager-topbar-menu">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={`manager-nav-item ${activeView === item.key ? 'active' : ''}`}
              onClick={() => {
                setActiveView(item.key);
                setShowMobileMenu(false);
              }}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>

        {showMobileMenu && (
          <div className="manager-mobile-menu-dropdown">
            {navItems.map((item) => (
              <button
                key={item.key}
                className={`manager-mobile-item ${activeView === item.key ? 'active' : ''}`}
                onClick={() => {
                  setActiveView(item.key);
                  setShowMobileMenu(false);
                }}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        <div className="manager-topbar-right">
          <div
            className="manager-notifications"
            onClick={() => {
              setShowNotifications((prev) => !prev);
              setShowProfileMenu(false);
            }}
            ref={notificationRef}
            role="button"
            tabIndex={0}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            {unreadCount > 0 && <span className="manager-notification-badge">{unreadCount}</span>}
            {showNotifications && (
              <div className="notifications-dropdown manager-notifications-dropdown">
                <div className="notifications-header">
                  <h3>Notifications</h3>
                  {unreadCount > 0 && (
                    <button type="button" className="mark-all-read" onClick={(event) => { event.stopPropagation(); markAllAsRead(); }}>
                      Mark all as read
                    </button>
                  )}
                </div>
                <div className="notifications-list">
                  {notifications.length > 0 ? (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`notification-item ${notif.read ? '' : 'unread'}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleNotificationItemClick(notif);
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="notification-content">
                          <div className="notification-title">{notif.title}</div>
                          <div className="notification-message">{notif.message}</div>
                          <div className="notification-time">{notif.time}</div>
                        </div>
                        <button
                          type="button"
                          className="delete-notification"
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteNotification(notif.id);
                          }}
                          aria-label="Delete notification"
                        >
                          ×
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="no-notifications">No notifications</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="manager-profile" ref={profileRef}>
            <button className="manager-avatar" onClick={() => setShowProfileMenu((prev) => !prev)} type="button">
              {previewImage ? (
                <img src={previewImage} alt="Manager avatar" />
              ) : (
                managerInitials
              )}
            </button>
            <div className="manager-profile-info" onClick={() => setShowProfileMenu((prev) => !prev)} role="button" tabIndex={0}>
              <span>{`${managerProfile.firstName} ${managerProfile.lastName}`}</span>
            </div>
            {showProfileMenu && (
              <div className="manager-profile-dropdown">
                <div className="manager-dropdown-header">
                  <div className="manager-avatar dropdown">
                    {previewImage ? (
                      <img src={previewImage} alt="Manager avatar" />
                    ) : (
                      managerInitials
                    )}
                  </div>
                  <div className="manager-dropdown-info">
                    <span className="manager-dropdown-name">{`${managerProfile.firstName} ${managerProfile.lastName}`}</span>
                    <span className="manager-dropdown-email">{managerProfile.email}</span>
                  </div>
                </div>
                <div className="manager-dropdown-menu">
                  <button type="button" className="manager-dropdown-item" onClick={() => handleOpenProfileSettings('account')}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    <span>Profile Settings</span>
                  </button>
                  <button type="button" className="manager-dropdown-item danger" onClick={handleSignOutClick}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    <span>Sign out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="manager-main">
        <div className="manager-content">
          <div className="manager-content-body">
            {activeContent}
          </div>
        </div>
      </main>

      {showProfileView && (
        <div className="profile-view">
          <div className="profile-settings-header">
            <button type="button" className="back-button" onClick={handleCancelProfileChanges}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              <span>Back</span>
            </button>
            <h1 className="profile-settings-title">Profile Settings</h1>
          </div>

          <div className="profile-tabs">
            <button type="button" className={`tab ${profileTab === 'account' ? 'active' : ''}`} onClick={() => setProfileTab('account')}>
              Account
            </button>
            <button type="button" className={`tab ${profileTab === 'security' ? 'active' : ''}`} onClick={() => setProfileTab('security')}>
              Security
            </button>
          </div>

          <div className="profile-content">
            {profileTab === 'account' && (
              <div className="profile-section">
                <div className="account-section">
                  <div className="account-card">
                    <h2>Profile Picture</h2>
                    <div className="avatar-section">
                      <div className="profile-avatar large">
                        {previewImage ? (
                          <img src={previewImage} alt="Profile" className="avatar-image" />
                        ) : (
                          <span>{managerInitials}</span>
                        )}
                      </div>
                      <button type="button" className="change-avatar-btn" onClick={() => avatarInputRef.current?.click()}>
                        Change
                      </button>
                      <input type="file" ref={avatarInputRef} accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
                    </div>
                  </div>

                  <div className="account-card">
                    <h2>Personal Information</h2>
                    <div className="form-group">
                      <label>First Name</label>
                      <input type="text" className="form-input" value={managerProfile.firstName} onChange={(event) => handleProfileFieldChange('firstName', event.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Last Name</label>
                      <input type="text" className="form-input" value={managerProfile.lastName} onChange={(event) => handleProfileFieldChange('lastName', event.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Email Address</label>
                      <input type="email" className="form-input" value={managerProfile.email} onChange={(event) => handleProfileFieldChange('email', event.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Birthday</label>
                      <input type="date" className="form-input" value={managerProfile.birthday || ''} onChange={(event) => handleProfileFieldChange('birthday', event.target.value)} />
                    </div>
                  </div>

                  {hasProfileChanges && (
                    <div className="button-group">
                      <button type="button" className="cancel-btn" onClick={handleCancelProfileChanges}>Cancel</button>
                      <button type="button" className="save-btn" onClick={handleSaveProfileClick} disabled={isProfileSaving}>
                        {isProfileSaving ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {profileTab === 'security' && (
              <div className="profile-section">
                <div className="security-section">
                  <div className="security-card">
                    <h2>Change Password</h2>
                    <div className="form-group">
                      <label>Current Password</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showCurrentPassword ? 'text' : 'password'}
                          className="form-input"
                          placeholder="Enter current password"
                          value={passwordData.currentPassword}
                          onChange={(event) => handlePasswordChange('currentPassword', event.target.value)}
                          style={{ paddingRight: '40px' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword((prev) => !prev)}
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
                          type={showNewPassword ? 'text' : 'password'}
                          className="form-input"
                          placeholder="Enter new password"
                          value={passwordData.newPassword}
                          onChange={(event) => handlePasswordChange('newPassword', event.target.value)}
                          style={{ paddingRight: '40px' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword((prev) => !prev)}
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
                          type={showConfirmPassword ? 'text' : 'password'}
                          className="form-input"
                          placeholder="Confirm new password"
                          value={passwordData.confirmPassword}
                          onChange={(event) => handlePasswordChange('confirmPassword', event.target.value)}
                          style={{ paddingRight: '40px' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((prev) => !prev)}
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
                    <button type="button" className="save-btn" onClick={handlePasswordUpdate}>Update Password</button>
                  </div>

                  <div className="security-card">
                    <h2>Recent Login Activity</h2>
                    <div className="activity-list">
                      {isLoginHistoryLoading ? (
                        <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>Loading recent activity…</div>
                      ) : loginHistory.length > 0 ? (
                        loginHistory.slice(0, 3).map((entry) => {
                          const timeAgo = computeTimeAgo(entry.loginTime || entry.timeAgo);
                          const deviceLabel = [entry.device || 'Unknown Device', entry.browser || null].filter(Boolean).join(' - ');
                          const statusText = entry.isCurrent
                            ? 'Current Session'
                            : timeAgo
                              ? `Last active ${timeAgo}`
                              : 'Previous session';
                          const statusClassName = `activity-status${entry.isCurrent ? ' current' : ''}`;
                          return (
                            <div key={entry.id} className="activity-item">
                              <div className="activity-info">
                                <span className="activity-device">{deviceLabel}</span>
                                <span className="activity-location">{entry.location || 'Unknown Location'}</span>
                                <span className="activity-time">{timeAgo || '—'}</span>
                              </div>
                              <span className={statusClassName}>{statusText}</span>
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>No login history available.</div>
                      )}
                    </div>
                    {loginHistory.length > 3 && (
                      <button
                        type="button"
                        onClick={() => setShowLoginHistoryModal(true)}
                        style={{
                          marginTop: '1rem',
                          padding: '0.5rem 1rem',
                          borderRadius: '8px',
                          border: '1px solid #cbd5f5',
                          backgroundColor: '#f8fafc',
                          color: '#0f172a',
                          fontWeight: 600,
                          cursor: 'pointer',
                          width: '100%'
                        }}
                      >
                        {`See More (${loginHistory.length - 3} more)`}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showLoginHistoryModal && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2010
          }}
          onClick={() => setShowLoginHistoryModal(false)}
        >
          <div
            style={{
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
                type="button"
                onClick={() => setShowLoginHistoryModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  color: '#64748b'
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div style={{ overflowY: 'auto', paddingRight: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {loginHistory.length > 0 ? (
                paginatedLoginHistory.map((entry) => {
                  const timeAgo = computeTimeAgo(entry.loginTime || entry.timeAgo);
                  const deviceLabel = [entry.device || 'Unknown Device', entry.browser || null].filter(Boolean).join(' • ');
                  const statusText = entry.isCurrent
                    ? 'Current Session'
                    : timeAgo
                      ? `Last active ${timeAgo}`
                      : 'Previous session';
                  const statusColor = entry.isCurrent ? '#10b981' : '#64748b';
                  return (
                    <div
                      key={entry.id}
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        padding: '0.9rem 1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem',
                        background: '#f8fafc'
                      }}
                    >
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{deviceLabel}</div>
                      <div style={{ fontSize: '0.9rem', color: '#475569' }}>{entry.location || 'Unknown Location'}</div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{entry.loginTime || '—'}</div>
                      <div style={{ fontSize: '0.85rem', color: statusColor }}>{statusText}</div>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>No login history available.</div>
              )}
            </div>

            {totalLoginHistoryPages > 1 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '1rem'
                }}
              >
                <span style={{ color: '#64748b', fontSize: '0.9rem' }}>
                  Page {loginHistoryPage + 1} of {totalLoginHistoryPages}
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
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
                    type="button"
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

      {profileMessage && (
        <div className={`manager-toast ${profileMessageType}`}>
          <span className="manager-toast-icon">{profileMessageType === 'success' ? '✓' : '✕'}</span>
          <span>{profileMessage}</span>
        </div>
      )}

      {showSaveModal && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2010
          }}
        >
          <div
            style={{
              background: 'white',
              padding: '20px',
              borderRadius: '8px',
              width: '90%',
              maxWidth: '400px'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: '20px'
              }}
            >
              <h3 style={{ margin: 0 }}>Save Changes</h3>
            </div>
            <p style={{ marginBottom: '20px', color: '#666', textAlign: 'center' }}>
              Are you sure you want to save these changes to your profile?
            </p>
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px'
              }}
            >
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
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
                type="button"
                onClick={performProfileSave}
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
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2010
          }}
        >
          <div
            style={{
              background: 'white',
              padding: '20px',
              borderRadius: '8px',
              width: '90%',
              maxWidth: '400px'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: '20px'
              }}
            >
              <h3 style={{ margin: 0 }}>Discard Changes</h3>
            </div>
            <p style={{ marginBottom: '20px', color: '#666', textAlign: 'center' }}>
              Are you sure you want to discard all changes? This action cannot be undone.
            </p>
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px'
              }}
            >
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
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
                type="button"
                onClick={handleConfirmCancelChanges}
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

      {showSignOutModal && (
        <div
          className="manager-modal-overlay"
          onClick={(event) => {
            if (event.target.classList.contains('manager-modal-overlay')) {
              setShowSignOutModal(false);
            }
          }}
        >
          <div className="manager-modal">
            <h3>Sign Out</h3>
            <p>Are you sure you want to sign out?</p>
            <div className="manager-modal-actions">
              <button type="button" onClick={() => setShowSignOutModal(false)}>Cancel</button>
              <button type="button" className="confirm" onClick={handleConfirmSignOut}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2010
          }}
        >
          <div
            style={{
              background: 'white',
              padding: '20px',
              borderRadius: '8px',
              width: '90%',
              maxWidth: '400px'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: '20px'
              }}
            >
              <h3 style={{ margin: 0 }}>Confirm Password Change</h3>
            </div>
            <p style={{ marginBottom: '20px', color: '#666', textAlign: 'center' }}>
              Are you sure you want to update your password?
            </p>
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px'
              }}
            >
              <button
                type="button"
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
                type="button"
                onClick={performPasswordUpdate}
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
    </div>
  );
};

export default Manager;
