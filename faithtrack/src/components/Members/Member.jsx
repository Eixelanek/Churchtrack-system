// COPY OF ADMIN.JSX, just renamed to Member.jsx for member dashboard mockup
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import jsQR from 'jsqr';
import './Member.css';
import './MemberDashboard.css';
import { useNavigate } from 'react-router-dom';
import logoImage from '../../assets/logo2.png';
import AttendanceHistory from './AttendanceHistory';
import SpiritualGrowth from './SpiritualGrowth';
import ScanQR from './ScanQR';
import { loadChurchSettingsFromAPI, updateFavicon } from '../../utils/churchSettings';
import { fetchMemberAttendanceSummary, fetchMonthlyAttendance } from '../../api/memberAttendance';
import { fetchFamilyTree, searchMembers, sendFamilyInvite, respondToInvite, removeFamilyRelationship } from '../../api/familyTree';
import { API_BASE_URL } from '../../config/api';

// --- LAYOUT, LOGIC, AND STYLES COPIED FROM ADMIN.JSX ---

const Member = () => {
  // All state, layout, and logic copied from Admin.jsx, except:
  // - Use './Member.css' for styles
  // - Use member-specific mock data if needed (optional, not required by user)
  // - Keep component name as 'Member'

  // Notification state
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const notificationRef = useRef(null);
  const helpCenterRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const barcodeDetectorRef = useRef(null);
  const uploadInputRef = useRef(null);
  const isScanningRef = useRef(false);
  const unreadCount = notifications.filter((n) => !n.read).length;
  
  // Church settings state
  const [churchLogo, setChurchLogo] = useState(logoImage);
  const [headerLogo, setHeaderLogo] = useState(null);
  const [churchName, setChurchName] = useState('Christ-Like Christian Church');
  const [helpCenterEmail, setHelpCenterEmail] = useState('');
  const [helpCenterPhone, setHelpCenterPhone] = useState('');
  const [helpCenterUrl, setHelpCenterUrl] = useState('');
  const [showHelpCenter, setShowHelpCenter] = useState(false);
  const [showScannerPanel, setShowScannerPanel] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [showForcePasswordModal, setShowForcePasswordModal] = useState(false);
  const [forcePasswordError, setForcePasswordError] = useState('');
  const [forcePasswordLoading, setForcePasswordLoading] = useState(false);
  const [forcePasswordForm, setForcePasswordForm] = useState({ newPassword: '', confirmPassword: '' });
  const passwordRequirements = 'Password must be at least 8 characters long.';
  const navigate = useNavigate();

  // Get member info from localStorage
  const [user, setUser] = useState({});
  useEffect(() => {
    const memberName = localStorage.getItem('memberName');
    const memberId = localStorage.getItem('userId');
    const memberUsername = localStorage.getItem('username');
    const memberEmail = localStorage.getItem('memberEmail');
    const memberBirthday = localStorage.getItem('memberBirthday');
    
    if (memberName) {
      // Split the full name into first and last name
      const nameParts = memberName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      setUser({
        id: memberId,
        firstName: firstName,
        lastName: lastName,
        username: memberUsername,
        email: memberEmail,
        birthday: memberBirthday
      });
    }
  }, []);

  useEffect(() => {
    const mustChange = localStorage.getItem('mustChangePassword') === 'true';
    if (mustChange) {
      setShowForcePasswordModal(true);
    }
  }, []);

  const handleForcePasswordChange = (field, value) => {
    setForcePasswordForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleForcePasswordSubmit = async (event) => {
    event.preventDefault();
    setForcePasswordError('');

    const trimmedNew = forcePasswordForm.newPassword.trim();
    const trimmedConfirm = forcePasswordForm.confirmPassword.trim();

    if (trimmedNew.length < 8) {
      setForcePasswordError('Your new password must be at least 8 characters long.');
      return;
    }

    if (trimmedNew !== trimmedConfirm) {
      setForcePasswordError('New password and confirmation do not match.');
      return;
    }

    const memberId = localStorage.getItem('userId');
    const sessionPassword = typeof window !== 'undefined' ? window.sessionStorage.getItem('memberLastLoginPassword') : null;

    if (!memberId || !sessionPassword) {
      setForcePasswordError('Unable to verify your session. Please log in again.');
      return;
    }

    try {
      setForcePasswordLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/members/change_password.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          member_id: memberId,
          current_password: sessionPassword,
          new_password: trimmedNew
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Password update failed.');
      }

      localStorage.removeItem('mustChangePassword');
      localStorage.removeItem('tempPasswordExpiresAt');
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem('memberLastLoginPassword');
      }

      setShowForcePasswordModal(false);
      setForcePasswordForm({ newPassword: '', confirmPassword: '' });
      triggerToast('Password updated successfully. You can continue.', 'success');
    } catch (error) {
      console.error('Forced password update failed:', error);
      setForcePasswordError(error.message || 'Unable to update password.');
    } finally {
      setForcePasswordLoading(false);
    }
  };

  // Fetch member notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      const memberId = localStorage.getItem('userId');
      if (!memberId) return;

      try {
        const res = await fetch(`${API_BASE_URL}/api/members/notifications.php?member_id=${memberId}`);
        const data = await res.json();
        
        // Map backend notifications to frontend format
        setNotifications(data.map((n) => ({
          id: n.id,
          title: n.type === 'birthday' ? '🎂 Happy Birthday!' :
                 n.type === 'birthday_other' ? '🎂 Birthday Today' :
                 n.type === 'event_reminder' ? '⏰ Event Reminder' :
                 n.type === 'profile_incomplete' ? '📝 Complete Your Profile' :
                 n.type === 'streak_milestone' ? '🔥 Streak Milestone!' :
                 n.type === 'family_checkin' ? '👨‍👩‍👧‍👦 Family Check-in' :
                 n.type === 'family_invite' ? '👥 Family Circle Invite' : 'Notification',
          message: n.message,
          time: formatNotificationTime(n.timestamp),
          read: n.is_read,
          type: n.type,
          event_id: n.event_id,
          related_member_id: n.related_member_id
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
  
  // Load church settings
  useEffect(() => {
    const applySettings = (settings) => {
      if (!settings) return;
      if (settings.churchLogo) {
        setChurchLogo(settings.churchLogo);
        updateFavicon(settings.churchLogo);
      }
      if (settings.headerLogo) {
        setHeaderLogo(settings.headerLogo);
      }
      if (settings.churchName) {
        setChurchName(settings.churchName);
      }
      setHelpCenterEmail(settings.helpCenterEmail || '');
      setHelpCenterPhone(settings.helpCenterPhone || '');
      setHelpCenterUrl(settings.helpCenterUrl || '');
    };

    const loadChurchSettings = async () => {
      const stored = localStorage.getItem('churchSettings');
      if (stored) {
        try {
          applySettings(JSON.parse(stored));
        } catch (error) {
          console.error('Error parsing church settings:', error);
        }
      }

      const fresh = await loadChurchSettingsFromAPI();
      if (fresh) {
        applySettings(fresh);
      }
    };

    loadChurchSettings();
  }, []);

  const displayName = user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : (localStorage.getItem('memberName') || 'Member');
  const avatar = user.firstName && user.lastName ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : 'M';
  const hasHelpCenterDetails = Boolean(helpCenterEmail || helpCenterPhone || helpCenterUrl);
  const helpCenterPhoneHref = useMemo(() => {
    if (!helpCenterPhone) {
      return '';
    }
    const sanitized = helpCenterPhone.replace(/[^0-9+]/g, '');
    return sanitized ? `tel:${sanitized}` : '';
  }, [helpCenterPhone]);
  const normalizedHelpCenterUrl = useMemo(() => {
    if (!helpCenterUrl) {
      return '';
    }
    return /^https?:\/\//i.test(helpCenterUrl) ? helpCenterUrl : `https://${helpCenterUrl}`;
  }, [helpCenterUrl]);


  const stopScanner = useCallback(() => {
    isScanningRef.current = false;
    setIsScanning(false);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      const video = videoRef.current;
      video.pause();
      video.srcObject = null;
    }
  }, []);

  const handleScanResult = useCallback((rawValue) => {
    if (!rawValue) {
      return;
    }

    let sessionToken = '';

    try {
      const parsedUrl = new URL(rawValue);
      sessionToken = parsedUrl.searchParams.get('session') || '';
    } catch (err) {
      const match = rawValue.match(/session=([a-zA-Z0-9]+)/);
      if (match && match[1]) {
        sessionToken = match[1];
      } else if (/^[a-f0-9]{16,}$/i.test(rawValue)) {
        sessionToken = rawValue;
      }
    }

    if (!sessionToken) {
      setScanError('Scanned code is not a valid ChurchTrack QR. Please try again.');
      return;
    }

    stopScanner();
    setScanError('');
    setShowScannerPanel(false);

    const params = new URLSearchParams();
    params.set('session', sessionToken);

    const storedMemberId = localStorage.getItem('userId');
    if (storedMemberId) {
      params.set('member', storedMemberId);
    } else if (user?.id) {
      params.set('member', String(user.id));
    }

    navigate(`/checkin?${params.toString()}`);
  }, [navigate, stopScanner, user?.id]);

  const scanLoop = useCallback(() => {
    if (!isScanningRef.current) {
      return;
    }

    const video = videoRef.current;
    if (!video) {
      requestAnimationFrame(scanLoop);
      return;
    }

    if (!barcodeDetectorRef.current) {
      requestAnimationFrame(scanLoop);
      return;
    }

    barcodeDetectorRef.current
      .detect(video)
      .then((barcodes) => {
        if (!isScanningRef.current) {
          return;
        }

        if (barcodes && barcodes.length > 0) {
          const detected = barcodes[0]?.rawValue;
          if (detected) {
            handleScanResult(detected);
            return;
          }
        }

        requestAnimationFrame(scanLoop);
      })
      .catch((error) => {
        console.error('QR detect error:', error);
        requestAnimationFrame(scanLoop);
      });
  }, [handleScanResult]);

  const processImageFile = useCallback(async (file) => {
    if (!file) {
      return;
    }

    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);

      let decoded = null;

      if ('BarcodeDetector' in window) {
        try {
          if (!barcodeDetectorRef.current) {
            barcodeDetectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] });
          }
          const detections = await barcodeDetectorRef.current.detect(bitmap);
          if (detections && detections.length > 0) {
            decoded = detections[0]?.rawValue || null;
          }
        } catch (detectorError) {
          console.warn('BarcodeDetector failed, falling back to jsQR', detectorError);
        }
      }

      if (!decoded) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const jsQrResult = jsQR(imageData.data, canvas.width, canvas.height, {
          inversionAttempts: 'dontInvert',
        });
        decoded = jsQrResult?.data || null;
      }

      if (decoded) {
        handleScanResult(decoded);
      } else {
        setScanError('Unable to read a QR code from that image. Please try a clearer photo.');
      }
    } catch (error) {
      console.error('QR image processing error:', error);
      setScanError('Unable to process the selected image.');
    }
  }, [handleScanResult]);

  const startScanner = useCallback(async () => {
    if (isScanningRef.current) {
      return;
    }

    setScanError('');
    setShowScannerPanel(true);

    if (!navigator?.mediaDevices?.getUserMedia) {
      setScanError('Camera access is not supported on this device.');
      // Keep panel open so user can upload instead
      return;
    }

    if (!('BarcodeDetector' in window)) {
      setScanError('QR scanning is not supported on this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });

      streamRef.current = stream;

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }

      if (!barcodeDetectorRef.current) {
        barcodeDetectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] });
      }

      isScanningRef.current = true;
      setIsScanning(true);
      requestAnimationFrame(scanLoop);
    } catch (error) {
      console.error('Unable to start scanner:', error);
      setScanError('Unable to access the camera. Please check browser permissions.');
      stopScanner();
    }
  }, [scanLoop, stopScanner]);

  const handleCloseScanner = useCallback(() => {
    stopScanner();
    setShowScannerPanel(false);
    setScanError('');
  }, [stopScanner]);

  const handleUploadClick = useCallback(() => {
    if (uploadInputRef.current) {
      uploadInputRef.current.value = '';
      uploadInputRef.current.click();
    }
  }, []);

  const handleFileSelected = useCallback((event) => {
    const file = event.target?.files?.[0];
    if (!file) {
      return;
    }

    stopScanner();
    setScanError('');
    processImageFile(file);
  }, [processImageFile, stopScanner]);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  useEffect(() => {
    if (!showScannerPanel) {
      stopScanner();
    }
  }, [showScannerPanel, stopScanner]);

  const handleNotificationClick = () => {
    setShowHelpCenter(false);
    setShowProfileMenu(false);
    setShowNotifications(!showNotifications);
  };

  const handleHelpCenterClick = () => {
    setShowNotifications(false);
    setShowProfileMenu(false);
    setShowHelpCenter((prev) => !prev);
  };

  const handleHelpCenterKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleHelpCenterClick();
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await fetch(`${API_BASE_URL}/api/members/mark_notification_read.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ notification_id: notificationId })
      });
      
      // Update local state
      setNotifications(notifications.map(notification => 
        notification.id === notificationId ? {...notification, read: true} : notification
      ));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await fetch(`${API_BASE_URL}/api/members/delete_notification.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ notification_id: notificationId })
      });
      
      // Update local state
      setNotifications(notifications.filter(notification => notification.id !== notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleNotificationItemClick = (notification) => {
    // Mark notification as read
    markAsRead(notification.id);
    
    // Hide the notifications dropdown
    setShowNotifications(false);
    
    // Navigate based on notification type
    switch(notification.type) {
      case 'event_reminder':
        // Navigate to attendance/events
        setActiveView('attendance');
        break;
      case 'profile_incomplete':
        // Open profile settings
        handleProfileSettingsClick();
        break;
      case 'family_checkin':
        // Navigate to attendance history
        setActiveView('attendance');
        break;
      case 'family_invite':
        // Open family tree modal to manage invite
        handleFamilyTreeClick();
        break;
      default:
        // Do nothing for other types
        break;
    }
  };

  const handleNotificationDelete = (notification) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
    );
    setShowNotifications(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
      if (helpCenterRef.current && !helpCenterRef.current.contains(event.target)) {
        setShowHelpCenter(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Mobile menu state (must be declared before useEffects that use it)
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  
  // Close mobile menu on window resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 767) {
        setShowMobileMenu(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (showMobileMenu) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showMobileMenu]);

  // Leaderboard modal state
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // Mock leaderboard data (replace with backend data in future)
  const mockLeaderboard = [
    { rank: 1, name: 'Juan Dela Cruz', score: 100 },
    { rank: 2, name: 'Maria Santos', score: 97 },
    { rank: 3, name: 'Pedro Reyes', score: 95 },
    { rank: 4, name: 'Ana Lopez', score: 93 },
    { rank: 5, name: 'Jose Ramos', score: 90 },
    { rank: 6, name: 'Liza Cruz', score: 88 },
    { rank: 7, name: 'Mark Tan', score: 85 },
    { rank: 8, name: 'Grace Lim', score: 83 },
    { rank: 9, name: 'Paul Ong', score: 80 },
    { rank: 10, name: 'Rhea Sy', score: 78 },
  ];

  const DAILY_VERSES = [
    { text: "\"For I know the plans I have for you,\" declares the Lord, \"plans to prosper you and not to harm you, plans to give you hope and a future.\"", reference: "Jeremiah 29:11 (NIV)" },
    { text: "\"Trust in the Lord with all your heart and lean not on your own understanding.\"", reference: "Proverbs 3:5 (NIV)" },
    { text: "\"I can do all things through Christ who strengthens me.\"", reference: "Philippians 4:13 (NIV)" },
    // Add more verses as needed
  ];

  const [dailyVerse, setDailyVerse] = useState({ text: '', reference: '' });

  useEffect(() => {
    // Get day of year (0-365)
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now - start;
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    // Select verse based on day of year
    const verseIndex = dayOfYear % DAILY_VERSES.length;
    setDailyVerse(DAILY_VERSES[verseIndex]);
  }, []);

  // Add profile dropdown state
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileRef = useRef(null);

  // Add profile dropdown handlers
  const handleProfileClick = () => {
    setShowNotifications(false);
    setShowHelpCenter(false);
    setShowProfileMenu(!showProfileMenu);
  };

  // Add profile view state
  const [showProfileView, setShowProfileView] = useState(false);
  const [activeTab, setActiveTab] = useState('account');
  const [previousTab, setPreviousTab] = useState('account');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showFamilyTree, setShowFamilyTree] = useState(false);
  const [familyTreeData, setFamilyTreeData] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedRelationship, setSelectedRelationship] = useState('Son');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [isRemovingFamily, setIsRemovingFamily] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [profileData, setProfileData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    suffix: 'None',
    email: '',
    contactNumber: '',
    gender: '',
    birthday: '',
    age: '',
    street: '',
    barangay: '',
    city: '',
    province: '',
    zipCode: '',
    guardianFirstName: '',
    guardianMiddleName: '',
    guardianSurname: '',
    guardianSuffix: 'None',
    relationshipToGuardian: '',
    avatar: '',
    profilePicture: null
  });
  const [originalData, setOriginalData] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const fileInputRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordVisibility, setPasswordVisibility] = useState({
    current: false,
    new: false,
    confirm: false
  });

  // Load profile data from user state
  useEffect(() => {
    if (user.firstName || user.lastName || user.email) {
      setProfileData(prev => ({
        ...prev,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        avatar: avatar,
        profilePicture: prev.profilePicture
      }));
    }
  }, [user, avatar]);

  // Fetch member profile picture from API
  useEffect(() => {
    const loadProfilePicture = async () => {
      const memberId = localStorage.getItem('userId');
      if (!memberId) return;

      try {
        const response = await fetch(`${API_BASE_URL}/api/members/get.php?id=${memberId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.member) {
            const member = data.member;
            
            // Calculate age from birthday
            let calculatedAge = '';
            if (member.birthday) {
              const birthDate = new Date(member.birthday);
              const today = new Date();
              let age = today.getFullYear() - birthDate.getFullYear();
              const monthDiff = today.getMonth() - birthDate.getMonth();
              if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
              }
              calculatedAge = age.toString();
            }
            
            // Update profile data with API data
            setProfileData(prev => ({
              ...prev,
              firstName: member.first_name || prev.firstName,
              middleName: member.middle_name || '',
              lastName: member.surname || prev.lastName,
              suffix: member.suffix || 'None',
              email: member.email || prev.email,
              contactNumber: member.contact_number || '',
              gender: member.gender || '',
              birthday: member.birthday || '',
              age: calculatedAge,
              street: member.street || '',
              barangay: member.barangay || '',
              city: member.city || '',
              province: member.province || '',
              zipCode: member.zip_code || '',
              guardianFirstName: member.guardian_first_name || '',
              guardianMiddleName: member.guardian_middle_name || '',
              guardianSurname: member.guardian_surname || '',
              guardianSuffix: member.guardian_suffix || 'None',
              relationshipToGuardian: member.relationship_to_guardian || '',
              profilePicture: member.profile_picture || null
            }));
            
            // Set preview image if profile picture exists
            if (member.profile_picture) {
              const imagePath = member.profile_picture.replace('/uploads/profile_pictures/', '');
              const imageUrl = `${API_BASE_URL}/api/uploads/get_profile_picture.php?path=${imagePath}`;
              setPreviewImage(imageUrl);
            }
          }
        }
      } catch (error) {
        console.error('Error loading profile picture:', error);
      }
    };

    loadProfilePicture();
  }, []); // Run once on component mount

  // Profile settings handlers
  const handleProfileSettingsClick = () => {
    setShowProfileMenu(false);
    setShowProfileView(true);
    setOriginalData({
      ...profileData,
      previewImage: previewImage
    });
    setHasChanges(false);
  };

  const handleFamilyTreeClick = async () => {
    setShowProfileMenu(false);
    setShowFamilyTree(true);
    // Fetch family tree data
    const memberId = localStorage.getItem('userId');
    if (memberId) {
      try {
        const data = await fetchFamilyTree(parseInt(memberId));
        setFamilyTreeData(data);
      } catch (error) {
        console.error('Error fetching family tree:', error);
      }
    }
  };

  const handleQRModalClose = () => {
    setShowQRModal(false);
  };

  const handleFamilyTreeClose = () => {
    setShowFamilyTree(false);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedRelationship('Son');
    setRemoveTarget(null);
    setShowRemoveConfirm(false);
  };

  const triggerToast = useCallback((message, type = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setToastVisible(false);
      toastTimeoutRef.current = null;
    }, 3200);
  }, []);

  const handleToastClose = useCallback(() => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
    setToastVisible(false);
  }, []);

  useEffect(() => () => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
  }, []);

  const handleSearchMembers = async (query) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    
    const memberId = localStorage.getItem('userId');
    if (!memberId) return;

    setIsSearching(true);
    try {
      const results = await searchMembers(query, parseInt(memberId));
      const normalizedResults = results.map((member) => {
        if (!member || typeof member !== 'object') {
          return member;
        }

        const status = member.relationship_status;
        const isRemoved = typeof status === 'string' && status.toLowerCase() === 'removed';

        return {
          ...member,
          relationship_status: isRemoved ? null : status,
        };
      });

      setSearchResults(normalizedResults);
    } catch (error) {
      console.error('Error searching members:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendInvite = async (relativeId) => {
    const memberId = localStorage.getItem('userId');
    if (!memberId) return;

    setInviteLoading(true);
    try {
      await sendFamilyInvite(
        parseInt(memberId),
        relativeId,
        selectedRelationship
      );
      // Refresh family tree data
      const data = await fetchFamilyTree(parseInt(memberId));
      setFamilyTreeData(data);
      // Clear search
      setSearchQuery('');
      setSearchResults([]);
      triggerToast('Invitation sent successfully!', 'success');
    } catch (error) {
      console.error('Error sending invite:', error);
      triggerToast(error.message || 'Failed to send invitation', 'error');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRespondToInvite = async (inviteId, action) => {
    const memberId = localStorage.getItem('userId');
    if (!memberId) return;

    try {
      await respondToInvite(inviteId, parseInt(memberId), action);
      // Refresh family tree data
      const data = await fetchFamilyTree(parseInt(memberId));
      setFamilyTreeData(data);
      triggerToast(`Invitation ${action === 'accept' ? 'accepted' : 'declined'}!`, 'success');
    } catch (error) {
      console.error('Error responding to invite:', error);
      triggerToast(error.message || 'Failed to respond to invitation', 'error');
    }
  };

  const handleOpenRemoveFamily = (familyMember) => {
    setRemoveTarget(familyMember);
    setShowRemoveConfirm(true);
  };

  const handleCloseRemoveConfirm = () => {
    if (isRemovingFamily) return;
    setShowRemoveConfirm(false);
    setRemoveTarget(null);
  };

  const handleConfirmRemoveFamily = async () => {
    const memberId = localStorage.getItem('userId');
    if (!memberId || !removeTarget) return;

    setIsRemovingFamily(true);
    try {
      await removeFamilyRelationship(parseInt(memberId), removeTarget.member_id || removeTarget.id);
      const updatedTree = await fetchFamilyTree(parseInt(memberId));
      setFamilyTreeData(updatedTree);
      triggerToast(`${removeTarget.member_name || removeTarget.name || 'Family member'} removed from your circle.`, 'success');
      setShowRemoveConfirm(false);
      setRemoveTarget(null);
    } catch (error) {
      console.error('Error removing family member:', error);
      triggerToast(error.message || 'Failed to remove family member', 'error');
    } finally {
      setIsRemovingFamily(false);
    }
  };

  const handleProfileCancel = () => {
    if (originalData) {
      setProfileData(originalData);
      setPreviewImage(originalData.previewImage);
    }
    setHasChanges(false);
    setShowCancelModal(false);
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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => {
      const newData = {
      ...prev,
      [name]: value
      };

      // Calculate age automatically when birthday changes
      if (name === 'birthday') {
        if (value) {
          const today = new Date();
          const birthDate = new Date(value);
          let age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
          newData.age = age.toString();
        } else {
          // Clear age if birthday is cleared
          newData.age = '';
        }
      }

      return newData;
    });
    setHasChanges(true);
  };

  const handleSaveClick = () => {
    setShowSaveModal(true);
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const togglePasswordVisibility = (field) => {
    setPasswordVisibility(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handlePasswordUpdate = async () => {
    // Validation
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      triggerToast('Please fill in all password fields', 'error');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      triggerToast('New passwords do not match', 'error');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      triggerToast('New password must be at least 6 characters', 'error');
      return;
    }

    const memberId = localStorage.getItem('userId');
    if (!memberId) {
      triggerToast('Member ID not found', 'error');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/members/change_password.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          member_id: memberId,
          current_password: passwordData.currentPassword,
          new_password: passwordData.newPassword
        })
      });

      const data = await response.json();

      if (data.success) {
        triggerToast('Password updated successfully!', 'success');
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      } else {
        triggerToast(data.message || 'Failed to update password', 'error');
      }
    } catch (error) {
      console.error('Error updating password:', error);
      triggerToast('Error updating password', 'error');
    }
  };

  const handleConfirmSave = async () => {
    const memberId = localStorage.getItem('userId');
    if (!memberId) {
      triggerToast('Member ID not found', 'error');
      return;
    }

    try {
      
      // Prepare data to send
      const updateData = {
        member_id: memberId,
        first_name: profileData.firstName,
        middle_name: profileData.middleName,
        last_name: profileData.lastName,
        suffix: profileData.suffix,
        email: profileData.email,
        contact_number: profileData.contactNumber,
        gender: profileData.gender,
        birthday: profileData.birthday,
        street: profileData.street,
        barangay: profileData.barangay,
        city: profileData.city,
        province: profileData.province,
        zip_code: profileData.zipCode,
        guardian_first_name: profileData.guardianFirstName,
        guardian_middle_name: profileData.guardianMiddleName,
        guardian_surname: profileData.guardianSurname,
        guardian_suffix: profileData.guardianSuffix,
        relationship_to_guardian: profileData.relationshipToGuardian
      };

      // Include profile picture if it was changed
      if (previewImage && previewImage !== originalData?.previewImage) {
        updateData.profile_picture = previewImage;
      }

      const response = await fetch(`${API_BASE_URL}/api/members/update_profile.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      const data = await response.json();

      if (data.success) {
        // Update profile data with the response from server
        const updatedProfileData = {
          ...profileData,
          profilePicture: data.member?.profile_picture || profileData.profilePicture
        };
        
        setProfileData(updatedProfileData);
        
        // Update original data
        const savedImagePath = data.member?.profile_picture ? data.member.profile_picture.replace('/uploads/profile_pictures/', '') : null;
        setOriginalData({
          ...updatedProfileData,
          previewImage: savedImagePath ? `${API_BASE_URL}/api/uploads/get_profile_picture.php?path=${savedImagePath}` : previewImage
        });
        
        // Update preview image with the saved path
        if (savedImagePath) {
          setPreviewImage(`${API_BASE_URL}/api/uploads/get_profile_picture.php?path=${savedImagePath}`);
        }
        
        setHasChanges(false);
        
        // Update user display
        setUser(prev => ({
          ...prev,
          firstName: profileData.firstName,
          lastName: profileData.lastName,
          email: profileData.email
        }));

        // Update localStorage
        const fullName = `${profileData.firstName} ${profileData.lastName}`;
        localStorage.setItem('memberName', fullName);
        if (profileData.email) {
          localStorage.setItem('memberEmail', profileData.email);
        }

        setShowSaveModal(false);
        setShowProfileView(false);
        triggerToast('Profile updated successfully!', 'success');
      } else {
        triggerToast(data.message || 'Failed to update profile', 'error');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      triggerToast('Error saving profile changes', 'error');
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
  };

  const handleSaveModalClose = () => {
    setShowSaveModal(false);
  };

  const handleCancelModalClose = () => {
    setShowCancelModal(false);
  };

  // Add sign out handler
  const handleSignOut = () => {
    // Clear all authentication data
    localStorage.removeItem('token');
    localStorage.removeItem('userType');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    localStorage.removeItem('memberName');
    localStorage.removeItem('memberEmail');
    localStorage.removeItem('memberBirthday');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const [activeView, setActiveView] = useState('dashboard');

  const handleNavigation = (view) => {
    console.log("Navigation clicked:", view);
    setActiveView(view);
    setShowMobileMenu(false); // Close mobile menu when navigating
  };
  
  const toggleMobileMenu = () => {
    setShowMobileMenu(!showMobileMenu);
  };
  
  const closeMobileMenu = () => {
    setShowMobileMenu(false);
  };

  const [attendanceSummary, setAttendanceSummary] = useState({
    total_visits: null,
    attendance_rate: null,
    last_attended: null,
    month_visits: null,
    attendance_streak: null,
    recent_scans: [],
  });
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);
  const [attendanceError, setAttendanceError] = useState(null);
  const [monthlyAttendanceData, setMonthlyAttendanceData] = useState([]);

  useEffect(() => {
    const storedMemberId = localStorage.getItem('memberId') || localStorage.getItem('userId');
    const effectiveMemberId = storedMemberId || user?.id;
    if (!effectiveMemberId) {
      return;
    }

    const loadAttendanceSummary = async () => {
      setIsLoadingAttendance(true);
      setAttendanceError(null);
      try {
        const data = await fetchMemberAttendanceSummary(effectiveMemberId);
        setAttendanceSummary({
          total_visits: data?.total_visits ?? 0,
          attendance_rate: data?.attendance_rate ?? 0,
          last_attended: data?.last_attended ?? null,
          month_visits: data?.month_visits ?? 0,
          attendance_streak: data?.attendance_streak ?? 0,
          recent_scans: Array.isArray(data?.recent_scans) ? data.recent_scans : [],
        });
        setAttendanceError(null);
      } catch (error) {
        console.error('Attendance summary load failed:', error);
        setAttendanceSummary({
          total_visits: 0,
          attendance_rate: 0,
          last_attended: null,
          month_visits: 0,
          attendance_streak: 0,
          recent_scans: [],
        });
        setAttendanceError('Attendance summary unavailable');
      } finally {
        setIsLoadingAttendance(false);
      }
    };

    const loadMonthlyAttendance = async () => {
      try {
        const data = await fetchMonthlyAttendance(effectiveMemberId);
        setMonthlyAttendanceData(data);
      } catch (error) {
        console.error('Monthly attendance load failed:', error);
        setMonthlyAttendanceData([]);
      }
    };

    loadAttendanceSummary();
    loadMonthlyAttendance();
  }, [user?.id]);

  // Member dashboard data
  const dashboardStats = useMemo(() => ([
    {
      key: 'total',
      label: 'Total Attendance',
      value: attendanceSummary.total_visits !== null ? attendanceSummary.total_visits : '—',
      subtitle: attendanceSummary.last_attended ? `Last: ${new Date(attendanceSummary.last_attended).toLocaleDateString()}` : 'All time',
      icon: 'calendar',
    },
    {
      key: 'month',
      label: 'This Month',
      value: attendanceSummary.month_visits !== null ? attendanceSummary.month_visits : '—',
      subtitle: attendanceSummary.month_visits === 0 ? 'No scans yet' : 'Great job!',
      icon: 'trending',
    },
    {
      key: 'rate',
      label: 'Attendance Rate',
      value: attendanceSummary.attendance_rate !== null ? `${attendanceSummary.attendance_rate}%` : '—',
      subtitle: 'Lifetime',
      icon: 'award',
    },
    {
      key: 'streak',
      label: 'Current Streak',
      value: attendanceSummary.attendance_streak !== null ? attendanceSummary.attendance_streak : '—',
      subtitle: attendanceSummary.attendance_streak === 1 ? 'Keep it going!' : 'Consecutive days',
      icon: 'clock',
    }
  ]), [attendanceSummary]);

  const monthlyData = useMemo(() => {
    // Generate last 7 months
    const months = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthName = monthNames[date.getMonth()];
      const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      // Find matching data from API
      const apiData = monthlyAttendanceData.find(item => item.year_month === yearMonth);
      
      months.push({
        month: monthName,
        count: apiData ? apiData.count : 0
      });
    }
    
    return months;
  }, [monthlyAttendanceData]);

  const recentAttendance = useMemo(() => ([
    ...(attendanceSummary.recent_scans || [])
      .map((scan, index) => {
        if (!scan) {
          return null;
        }

        let formattedDate = '—';
        let formattedTime = '';

        if (scan.checkin_datetime) {
          const dateObj = new Date(scan.checkin_datetime);
          if (!Number.isNaN(dateObj.getTime())) {
            formattedDate = dateObj.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });
            formattedTime = dateObj.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit'
            });
          }
        }

        return {
          id: scan.id ?? `recent-scan-${index}`,
          service: scan.service_name || 'QR Attendance',
          date: formattedDate,
          time: formattedTime,
          status: 'Present'
        };
      })
      .filter(Boolean)
  ]), [attendanceSummary.recent_scans]);

  const familyTreePreview = useMemo(() => {
    if (!familyTreeData || !familyTreeData.tree) {
      return {
        parents: [],
        couple: [{ name: displayName, relation: 'You' }],
        siblings: [],
        children: []
      };
    }
    
    return {
      parents: familyTreeData.tree.parents || [],
      couple: [
        { name: displayName, relation: 'You' },
        ...(familyTreeData.tree.couple || [])
      ],
      siblings: familyTreeData.tree.siblings || [],
      children: familyTreeData.tree.children || []
    };
  }, [familyTreeData, displayName]);

  const getInitials = useCallback((fullName) => {
    if (!fullName) return '';
    const parts = fullName.trim().split(/\s+/).slice(0, 2);
    return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
  }, []);

  const maxMonthlyCount = useMemo(() => {
    if (monthlyData.length === 0) return 1;
    return Math.max(...monthlyData.map(d => d.count), 1);
  }, [monthlyData]);


  const renderStatIcon = useCallback((type) => {
    switch (type) {
      case 'calendar':
        return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>;
      case 'trending':
        return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>;
      case 'award':
        return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>;
      case 'clock':
        return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>;
      default:
        return null;
    }
  }, []);

  return (
    <div className="member-root">
      {showForcePasswordModal && (
        <div className="modal-overlay forced-password-modal" onClick={(e) => {
          e.stopPropagation();
        }}>
          <div className="forced-password-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="forced-password-header">
              <h2>Update Your Password</h2>
            </div>
            <div className="forced-password-body">
              <div className="forced-password-description">
                <p>A temporary password was used to log in. Please set a permanent password before proceeding.</p>
                <p className="forced-password-requirements">{passwordRequirements}</p>
              </div>
              {forcePasswordError && (
                <div className="forced-password-error">{forcePasswordError}</div>
              )}
              <form onSubmit={handleForcePasswordSubmit} className="forced-password-form">
                <label htmlFor="forced-new-password">New password</label>
                <input
                  id="forced-new-password"
                  type="password"
                  value={forcePasswordForm.newPassword}
                  onChange={(e) => handleForcePasswordChange('newPassword', e.target.value)}
                  minLength={8}
                  placeholder="Enter new password"
                  disabled={forcePasswordLoading}
                  required
                />
                <label htmlFor="forced-confirm-password">Confirm password</label>
                <input
                  id="forced-confirm-password"
                  type="password"
                  value={forcePasswordForm.confirmPassword}
                  onChange={(e) => handleForcePasswordChange('confirmPassword', e.target.value)}
                  minLength={8}
                  placeholder="Repeat new password"
                  disabled={forcePasswordLoading}
                  required
                />
                <button
                  type="submit"
                  className="forced-password-submit"
                  disabled={forcePasswordLoading}
                >
                  {forcePasswordLoading ? 'Saving…' : 'Save New Password'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* Save Changes Confirmation Modal */}
      {showSaveModal && (
        <div className="modal-overlay" onClick={handleSaveModalClose} style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            width: '90%',
            maxWidth: '400px',
            textAlign: 'center',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            border: '2px solid #0046a5'
          }}>
            <h3 style={{ 
              margin: '0 0 8px 0',
              fontSize: '1.25rem',
              color: '#1a1a1a'
            }}>Save Changes</h3>
            <p style={{
              margin: '0 0 24px 0',
              color: '#666',
              fontSize: '0.875rem'
            }}>Are you sure you want to save these changes to your profile?</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={handleSaveModalClose} style={{
                padding: '10px 24px',
                border: '1px solid #D9D9D9',
                borderRadius: '4px',
                background: 'white',
                color: 'black',
                cursor: 'pointer',
                fontSize: '0.875rem',
                minWidth: '100px'
              }}>
                Cancel
              </button>
              <button onClick={handleConfirmSave} style={{
                padding: '10px 24px',
                border: 'none',
                borderRadius: '4px',
                background: '#00C389',
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.875rem',
                minWidth: '100px'
              }}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {toastVisible && (
        <div className={`member-toast member-toast-${toastType}`} role="status" aria-live="polite">
          <div className="toast-indicator" aria-hidden="true" />
          <div className="toast-content">
            <strong>{toastType === 'success' ? 'Success' : 'Notice'}</strong>
            <span>{toastMessage}</span>
          </div>
          <button type="button" className="toast-close" onClick={handleToastClose} aria-label="Close notification">
            ×
          </button>
        </div>
      )}

      {showRemoveConfirm && (
        <div className="modal-overlay" onClick={handleCloseRemoveConfirm} style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10000
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            width: '90%',
            maxWidth: '420px',
            textAlign: 'center',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
            border: '2px solid #ba1a1a'
          }}>
            <h3 style={{
              margin: '0 0 8px 0',
              fontSize: '1.25rem',
              color: '#1a1a1a'
            }}>Remove Family Member</h3>
            <p style={{
              margin: '0 0 24px 0',
              color: '#666',
              fontSize: '0.9rem'
            }}>
              Are you sure you want to remove{' '}
              <strong>{removeTarget?.member_name || removeTarget?.name || 'this member'}</strong>{' '}
              from your family circle? They will no longer appear in your family list or be able to check you in.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={handleCloseRemoveConfirm} style={{
                padding: '10px 24px',
                border: '1px solid #D9D9D9',
                borderRadius: '4px',
                background: 'white',
                color: 'black',
                cursor: isRemovingFamily ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                minWidth: '100px'
              }} disabled={isRemovingFamily}>
                Cancel
              </button>
              <button onClick={handleConfirmRemoveFamily} style={{
                padding: '10px 24px',
                border: 'none',
                borderRadius: '4px',
                background: '#ba1a1a',
                color: 'white',
                cursor: isRemovingFamily ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                minWidth: '100px'
              }} disabled={isRemovingFamily}>
                {isRemovingFamily ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Family Tree Overlay */}
      {showFamilyTree && (
        <div className="family-tree-overlay">
          <div className="family-tree-panel">
            <header className="family-tree-header">
              <div>
                <h2>Family Tree</h2>
                <p>Manage your family connections for quick check-ins.</p>
              </div>
              <button className="family-tree-close" onClick={handleFamilyTreeClose}>
                <span aria-hidden="true">×</span>
              </button>
            </header>

            <section className="family-tree-section">
              <h3>Your Family Circle</h3>
              {familyTreeData?.family?.length > 0 ? (
                <div className="family-tree-list">
                  {familyTreeData.family.map((member) => (
                    <div key={member.id || member.member_id} className="family-invite-item">
                      <div className="invite-info">
                        <span className="invite-name">{member.member_name}</span>
                        <span className="invite-relation">{member.relationship_type}</span>
                      </div>
                      <div className="invite-actions">
                        <button
                          className="invite-btn decline"
                          onClick={() => handleOpenRemoveFamily(member)}
                          disabled={isRemovingFamily && removeTarget?.member_id === member.member_id}
                        >
                          {isRemovingFamily && removeTarget?.member_id === member.member_id ? 'Removing…' : 'Remove'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="family-tree-placeholder">No family members yet.</p>
              )}
            </section>

            <section className="family-tree-section">
              <h3>Family Tree Preview</h3>
              <div className="family-tree-visual">
                <div className="family-tree-graph">
                  <div className="tree-row">
                    {familyTreePreview.parents.map((member) => (
                      <div key={`${member.name}-${member.relation}`} className="family-tree-node">
                        <div className="node-avatar">{getInitials(member.name)}</div>
                        <div className="node-text">
                          <span className="node-label">{member.relation}</span>
                          <span className="node-name">{member.name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="tree-connector vertical" />
                  <div className="tree-row couple">
                    {familyTreePreview.couple.map((member) => (
                      <div key={`${member.name}-${member.relation}`} className={`family-tree-node ${member.relation === 'You' ? 'highlight' : ''}`}>
                        <div className="node-avatar">{getInitials(member.name)}</div>
                        <div className="node-text">
                          <span className="node-label">{member.relation}</span>
                          <span className="node-name">{member.name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {familyTreePreview.siblings.length > 0 && (
                    <>
                      <div className="tree-connector vertical" />
                      <div className="tree-row">
                        {familyTreePreview.siblings.map((member) => (
                          <div key={`${member.name}-${member.relation}`} className="family-tree-node">
                            <div className="node-avatar">{getInitials(member.name)}</div>
                            <div className="node-text">
                              <span className="node-label">{member.relation}</span>
                              <span className="node-name">{member.name}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {familyTreePreview.children.length > 0 && (
                    <>
                      <div className="tree-connector vertical" />
                      <div className="tree-row">
                        {familyTreePreview.children.map((member) => (
                      <div key={`${member.name}-${member.relation}`} className="family-tree-node">
                        <div className="node-avatar">{getInitials(member.name)}</div>
                        <div className="node-text">
                          <span className="node-label">{member.relation}</span>
                          <span className="node-name">{member.name}</span>
                        </div>
                      </div>
                    ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </section>

            <section className="family-tree-section">
              <h3>Invite Family Member</h3>
              <div className="family-tree-invite-form">
                <div className="invite-search-wrapper">
                  <input 
                    type="text" 
                    placeholder="Search member name or email"
                    value={searchQuery}
                    onChange={(e) => handleSearchMembers(e.target.value)}
                  />
                  <select 
                    value={selectedRelationship}
                    onChange={(e) => setSelectedRelationship(e.target.value)}
                    className="relationship-select"
                  >
                    <option value="Father">Father</option>
                    <option value="Mother">Mother</option>
                    <option value="Spouse">Spouse</option>
                    <option value="Son">Son</option>
                    <option value="Daughter">Daughter</option>
                    <option value="Brother">Brother</option>
                    <option value="Sister">Sister</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                {isSearching && <p className="search-loading">Searching...</p>}
                {searchResults.length > 0 && (
                  <div className="search-results">
                    {searchResults.map((member) => (
                      <div key={member.id} className="search-result-item">
                        <div className="result-info">
                          <span className="result-name">{member.full_name}</span>
                          <span className="result-email">{member.email}</span>
                        </div>
                        {member.relationship_status ? (
                          <span className="result-status">{member.relationship_status}</span>
                        ) : (
                          <button 
                            className="invite-btn send"
                            onClick={() => handleSendInvite(member.id)}
                            disabled={inviteLoading}
                          >
                            {inviteLoading ? 'Sending...' : 'Invite'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <small className="family-tree-note">Search for members and send invitations. They need to approve before appearing in your family tree.</small>
            </section>

            <section className="family-tree-section">
              <h3>Pending Invitations Received</h3>
              {familyTreeData?.pending_received?.length > 0 ? (
                <div className="family-tree-list">
                  {familyTreeData.pending_received.map((invite) => (
                    <div key={invite.id} className="family-invite-item">
                      <div className="invite-info">
                        <span className="invite-name">{invite.member_name}</span>
                        <span className="invite-relation">{invite.relationship_type}</span>
                      </div>
                      <div className="invite-actions">
                        <button 
                          className="invite-btn accept"
                          onClick={() => handleRespondToInvite(invite.id, 'accept')}
                        >
                          Accept
                        </button>
                        <button 
                          className="invite-btn decline"
                          onClick={() => handleRespondToInvite(invite.id, 'decline')}
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="family-tree-placeholder">No pending invitations.</p>
              )}
            </section>

            <section className="family-tree-section">
              <h3>Pending Invitations Sent</h3>
              {familyTreeData?.pending_sent?.length > 0 ? (
                <div className="family-tree-list">
                  {familyTreeData.pending_sent.map((invite) => (
                    <div key={invite.id} className="family-invite-item">
                      <div className="invite-info">
                        <span className="invite-name">{invite.member_name}</span>
                        <span className="invite-relation">{invite.relationship_type}</span>
                      </div>
                      <span className="invite-status">Pending</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="family-tree-placeholder">No pending sent invitations.</p>
              )}
            </section>
          </div>
          <div className="family-tree-backdrop" onClick={handleFamilyTreeClose} />
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && (
        <div className="modal-overlay" onClick={handleQRModalClose} style={{
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
          <div className="modal-content qr-modal" onClick={e => e.stopPropagation()} style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '500px',
            overflow: 'hidden',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.1)',
            animation: 'modalFadeIn 0.3s ease-out'
          }}>
            <div className="qr-header" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid #e0f2fe'
            }}>
              <h3 style={{
                margin: 0,
                color: '#0046a5',
                fontSize: '1.5rem'
              }}>My QR Code</h3>
              <button className="close-btn" onClick={handleQRModalClose} style={{
                background: 'none',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: '#94a3b8',
                transition: 'color 0.2s'
              }}>×</button>
            </div>
            <div className="qr-content" style={{
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1.5rem'
            }}>
              <div className="member-info" style={{
                textAlign: 'center',
                width: '100%'
              }}>
                <h4 style={{
                  margin: '0 0 0.5rem',
                  fontSize: '1.25rem',
                  color: '#0f172a'
                }}>{displayName}</h4>
                <p style={{
                  margin: '0.25rem 0',
                  color: '#64748b',
                  fontSize: '0.95rem'
                }}>Member ID: {user.id || '12345'}</p>
              </div>
              <div className="qr-code-container" style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem',
                width: '100%'
              }}>
                {/* Real QR Code Image */}
                <div className="qr-code-container" style={{
                  width: '220px',
                  height: '220px',
                  backgroundColor: 'white',
                  border: '1px solid #e0f2fe',
                  borderRadius: '12px',
                  padding: '10px',
                  position: 'relative',
                  boxShadow: '0 10px 25px rgba(0, 70, 165, 0.1)',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  overflow: 'hidden'
                }}>
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`FAITHTRACK-MEMBER-${user.id || '12345'}-${displayName}`)}&color=0046a5&bgcolor=FFFFFF`} 
                    alt="Member QR Code"
                    style={{
                      width: '200px',
                      height: '200px',
                      objectFit: 'contain'
                    }}
                  />
                </div>
                <p style={{
                  color: '#64748b',
                  fontSize: '0.9rem',
                  margin: 0
                }}>Scan for member check-in</p>
              </div>
              <div className="qr-actions" style={{
                display: 'flex',
                gap: '1rem',
                width: '100%',
                justifyContent: 'center',
                marginTop: '0.5rem'
              }}>
                <button style={{
                  padding: '0.75rem 1.25rem',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.3s ease',
                  backgroundColor: '#0046a5',
                  color: 'white'
                }}>
                  <span style={{ fontSize: '1.1rem' }}>⬇️</span> Download QR Code
                </button>
                <button style={{
                  padding: '0.75rem 1.25rem',
                  border: '1px solid #e0f2fe',
                  borderRadius: '10px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.3s ease',
                  backgroundColor: '#f8faff',
                  color: '#0046a5'
                }}>
                  <span style={{ fontSize: '1.1rem' }}>🖨️</span> Print QR Code
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Changes Confirmation Modal */}
      {showCancelModal && (
        <div className="modal-overlay" onClick={handleCancelModalClose} style={{
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
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            width: '90%',
            maxWidth: '400px',
            textAlign: 'center'
          }}>
            <h3 style={{ 
              margin: '0 0 8px 0',
              fontSize: '1.25rem',
              color: '#1a1a1a'
            }}>Discard Changes</h3>
            <p style={{
              margin: '0 0 24px 0',
              color: '#666',
              fontSize: '0.875rem'
            }}>Are you sure you want to discard all changes? This action cannot be undone.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={handleCancelModalClose} style={{
                padding: '10px 24px',
                border: '1px solid #D9D9D9',
                borderRadius: '4px',
                background: 'white',
                color: 'black',
                cursor: 'pointer',
                fontSize: '0.875rem',
                minWidth: '100px'
              }}>
                Cancel
              </button>
              <button onClick={handleConfirmCancel} style={{
                padding: '10px 24px',
                border: 'none',
                borderRadius: '4px',
                background: '#00C389',
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.875rem',
                minWidth: '100px'
              }}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {showProfileView ? (
        <div className="profile-view">
          <div className="profile-settings-header">
            <button className="back-button" onClick={handleProfileCancel}>
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
              onClick={() => setActiveTab('account')}
            >
              Account
            </button>
            <button 
              className={`tab ${activeTab === 'security' ? 'active' : ''}`}
              onClick={() => setActiveTab('security')}
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
                        <div className="form-row">
                          <div className="form-group">
                            <label>First Name</label>
                            <input
                              type="text"
                              name="firstName"
                              value={profileData.firstName}
                              onChange={handleInputChange}
                              className="form-input"
                            />
                          </div>
                          <div className="form-group">
                            <label>Middle Name</label>
                            <input
                              type="text"
                              name="middleName"
                              value={profileData.middleName}
                              onChange={handleInputChange}
                              className="form-input"
                            />
                          </div>
                        </div>
                        <div className="form-row">
                          <div className="form-group">
                            <label>Last Name</label>
                            <input
                              type="text"
                              name="lastName"
                              value={profileData.lastName}
                              onChange={handleInputChange}
                              className="form-input"
                            />
                          </div>
                          <div className="form-group">
                            <label>Suffix</label>
                            <select
                              name="suffix"
                              value={profileData.suffix}
                              onChange={handleInputChange}
                              className="form-input"
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
                          <div className="form-group">
                            <label>Gender</label>
                            <select
                              name="gender"
                              value={profileData.gender}
                              onChange={handleInputChange}
                              className="form-input"
                            >
                              <option value="">Select Gender</option>
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                              <option value="Prefer not to say">Prefer not to say</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label>Birthday</label>
                            <input
                              type="date"
                              name="birthday"
                              value={profileData.birthday}
                              onChange={handleInputChange}
                              className="form-input"
                            />
                          </div>
                        </div>
                        {profileData.age && (
                          <div className="form-group">
                            <label>Age</label>
                            <input
                              type="text"
                              value={profileData.age}
                              className="form-input"
                              disabled
                            />
                          </div>
                        )}
                      </div>
                      
                      <div className="account-card">
                        <h2>Contact Information</h2>
                        <div className="form-group">
                          <label>Email Address</label>
                          <input
                            type="email"
                            name="email"
                            value={profileData.email}
                            onChange={handleInputChange}
                            className="form-input"
                          />
                        </div>
                        <div className="form-group">
                          <label>Contact Number</label>
                          <input
                            type="text"
                            name="contactNumber"
                            value={profileData.contactNumber}
                            onChange={handleInputChange}
                            className="form-input"
                            placeholder="09XXXXXXXXX"
                          />
                        </div>
                      </div>
                      
                      <div className="account-card">
                        <h2>Address Information</h2>
                        <div className="form-group">
                          <label>Street</label>
                          <input
                            type="text"
                            name="street"
                            value={profileData.street}
                            onChange={handleInputChange}
                            className="form-input"
                          />
                        </div>
                        <div className="form-row">
                          <div className="form-group">
                            <label>Barangay</label>
                            <input
                              type="text"
                              name="barangay"
                              value={profileData.barangay}
                              onChange={handleInputChange}
                              className="form-input"
                            />
                          </div>
                          <div className="form-group">
                            <label>City</label>
                            <input
                              type="text"
                              name="city"
                              value={profileData.city}
                              onChange={handleInputChange}
                              className="form-input"
                            />
                          </div>
                        </div>
                        <div className="form-row">
                          <div className="form-group">
                            <label>Province</label>
                            <input
                              type="text"
                              name="province"
                              value={profileData.province}
                              onChange={handleInputChange}
                              className="form-input"
                            />
                          </div>
                          <div className="form-group">
                            <label>Zip Code</label>
                            <input
                              type="text"
                              name="zipCode"
                              value={profileData.zipCode}
                              onChange={handleInputChange}
                              className="form-input"
                              maxLength="4"
                            />
                          </div>
                        </div>
                      </div>
                      
                      {parseInt(profileData.age) <= 17 && profileData.age && (
                        <div className="account-card">
                          <h2>Guardian Information</h2>
                          <div className="form-row">
                            <div className="form-group">
                              <label>Guardian First Name</label>
                              <input
                                type="text"
                                name="guardianFirstName"
                                value={profileData.guardianFirstName}
                                onChange={handleInputChange}
                                className="form-input"
                              />
                            </div>
                            <div className="form-group">
                              <label>Guardian Middle Name</label>
                              <input
                                type="text"
                                name="guardianMiddleName"
                                value={profileData.guardianMiddleName}
                                onChange={handleInputChange}
                                className="form-input"
                              />
                            </div>
                          </div>
                          <div className="form-row">
                            <div className="form-group">
                              <label>Guardian Last Name</label>
                              <input
                                type="text"
                                name="guardianSurname"
                                value={profileData.guardianSurname}
                                onChange={handleInputChange}
                                className="form-input"
                              />
                            </div>
                            <div className="form-group">
                              <label>Guardian Suffix</label>
                              <select
                                name="guardianSuffix"
                                value={profileData.guardianSuffix}
                                onChange={handleInputChange}
                                className="form-input"
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
                          <div className="form-group">
                            <label>Relationship to Guardian</label>
                            <input
                              type="text"
                              name="relationshipToGuardian"
                              value={profileData.relationshipToGuardian}
                              onChange={handleInputChange}
                              className="form-input"
                              placeholder="e.g., Son, Daughter, Ward"
                            />
                          </div>
                        </div>
                      )}
                      {hasChanges && (
                        <div className="button-group">
                          <button className="cancel-btn" onClick={handleProfileCancel}>
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
                          <div className="password-input">
                            <input
                              type={passwordVisibility.current ? 'text' : 'password'}
                              name="currentPassword"
                              value={passwordData.currentPassword}
                              onChange={handlePasswordChange}
                              className="form-input"
                              placeholder="Enter current password"
                            />
                            <button
                              type="button"
                              className="password-toggle"
                              onClick={() => togglePasswordVisibility('current')}
                            >
                              {passwordVisibility.current ? (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                  <line x1="1" y1="1" x2="23" y2="23" />
                                </svg>
                              ) : (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                  <circle cx="12" cy="12" r="3" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="form-group">
                          <label>New Password</label>
                          <div className="password-input">
                            <input
                              type={passwordVisibility.new ? 'text' : 'password'}
                              name="newPassword"
                              value={passwordData.newPassword}
                              onChange={handlePasswordChange}
                              className="form-input"
                              placeholder="Enter new password"
                            />
                            <button
                              type="button"
                              className="password-toggle"
                              onClick={() => togglePasswordVisibility('new')}
                            >
                              {passwordVisibility.new ? (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                  <line x1="1" y1="1" x2="23" y2="23" />
                                </svg>
                              ) : (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                  <circle cx="12" cy="12" r="3" />
                                </svg>
                              )}
                            </button>
                          </div>
                          <div className="password-hint">
                            Must be at least 8 characters long
                          </div>
                          {passwordData.newPassword && passwordData.newPassword.length < 8 && (
                            <div className="field-message error">
                              Password must be at least 8 characters long
                            </div>
                          )}
                        </div>
                        <div className="form-group">
                          <label>Confirm New Password</label>
                          <div className="password-input">
                            <input
                              type={passwordVisibility.confirm ? 'text' : 'password'}
                              name="confirmPassword"
                              value={passwordData.confirmPassword}
                              onChange={handlePasswordChange}
                              className="form-input"
                              placeholder="Confirm new password"
                            />
                            <button
                              type="button"
                              className="password-toggle"
                              onClick={() => togglePasswordVisibility('confirm')}
                            >
                              {passwordVisibility.confirm ? (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                  <line x1="1" y1="1" x2="23" y2="23" />
                                </svg>
                              ) : (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                  <circle cx="12" cy="12" r="3" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>
                        <button className="save-btn" onClick={handlePasswordUpdate}>Update Password</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
        </div>
      ) : (
        <div className="admin-container">
          <header className="topbar-nav">
            <div className="topbar-left">
              {/* Mobile Menu Toggle Button - Shows on mobile, replaces logo position */}
              <button 
                className="mobile-menu-toggle" 
                onClick={toggleMobileMenu}
                aria-label="Toggle menu"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
              </button>
              
              {/* Logo - Shows on desktop, moves to center on mobile */}
              <img src={headerLogo || churchLogo} alt="Church Logo" className="topbar-logo" />
              
              {/* Church Name - Hidden on mobile */}
              <span className="topbar-church-name">{churchName}</span>
            </div>
            <nav className="topbar-menu">
              <button 
                className={`nav-item ${activeView === 'dashboard' ? 'active' : ''}`} 
                onClick={() => handleNavigation('dashboard')}
              >
                Dashboard
              </button>
              <button 
                className={`nav-item ${activeView === 'scan' ? 'active' : ''}`} 
                onClick={() => handleNavigation('scan')}
              >
                Scan QR
              </button>
              <button 
                className={`nav-item ${activeView === 'attendance' ? 'active' : ''}`} 
                onClick={() => handleNavigation('attendance')}
              >
                My Attendance
              </button>
            </nav>
            <div className="topbar-right">
              <button 
                className="help-button"
                onClick={handleHelpCenterClick}
                onKeyDown={handleHelpCenterKeyDown}
                aria-label="Help Center"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.2s',
                  color: 'white',
                  fontSize: '18px',
                  fontWeight: '500'
                }}
              >
                ?
              </button>
              {showHelpCenter && (
                <div
                  className="help-center-dropdown"
                  ref={helpCenterRef}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: '60px',
                    right: '120px',
                    background: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 10px 20px rgba(0, 0, 0, 0.1)',
                    padding: '1rem',
                    zIndex: 1000,
                    minWidth: '250px'
                  }}
                >
                  <div className="help-center-title" style={{ fontWeight: 600, marginBottom: '0.75rem' }}>Need help?</div>
                  {hasHelpCenterDetails ? (
                    <div className="help-center-content">
                      {helpCenterEmail && (
                        <a className="help-center-link" href={`mailto:${helpCenterEmail}`}>
                          <span className="help-center-icon" aria-hidden="true">📧</span>
                          <div className="help-center-details">
                            <span className="help-center-link-title">Email Support</span>
                            <span className="help-center-link-subtitle">{helpCenterEmail}</span>
                          </div>
                        </a>
                      )}
                      {helpCenterPhone && helpCenterPhoneHref && (
                        <a className="help-center-link" href={helpCenterPhoneHref}>
                          <span className="help-center-icon" aria-hidden="true">📞</span>
                          <div className="help-center-details">
                            <span className="help-center-link-title">Call Support</span>
                            <span className="help-center-link-subtitle">{helpCenterPhone}</span>
                          </div>
                        </a>
                      )}
                      {helpCenterUrl && (
                        <a className="help-center-link" href={normalizedHelpCenterUrl} target="_blank" rel="noopener noreferrer">
                          <span className="help-center-icon" aria-hidden="true">🌐</span>
                          <div className="help-center-details">
                            <span className="help-center-link-title">Visit Help Center</span>
                            <span className="help-center-link-subtitle">{helpCenterUrl}</span>
                          </div>
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="help-center-empty" style={{ color: '#64748b', fontSize: '0.875rem' }}>Help center details are not set yet.</div>
                  )}
                </div>
              )}
              <div className="topbar-notifications" ref={notificationRef} onClick={handleNotificationClick}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
                {showNotifications && (
                  <div className="notifications-dropdown">
                    <div className="notifications-header">
                      <h3>Notifications</h3>
                    </div>
                    <div className="notifications-list">
                      {notifications.length > 0 ? (
                        notifications.map((notification) => (
                          <div
                            key={notification.id}
                            className={`notification-item ${!notification.read ? 'unread' : ''}`}
                            onClick={() => handleNotificationItemClick(notification)}
                            data-type={notification.type}
                          >
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
                  ) : avatar}
                </div>
                <div className="profile-info-texts" onClick={() => setShowProfileMenu(v => !v)} style={{cursor: 'pointer'}}>
                  <span style={{ color: '#fff' }}>{displayName}</span>
                </div>
                {showProfileMenu && (
                  <div className="profile-dropdown-menu">
                    <div className="profile-dropdown-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', paddingBottom: 0, borderBottom: '1px solid #e5e7eb', marginBottom: '0.25rem' }}>
                      <div className="profile-avatar" style={{ width: 40, height: 40, minWidth: 40, minHeight: 40, maxWidth: 40, maxHeight: 40, fontSize: '1.1rem' }}>
                        {previewImage ? (
                          <img src={previewImage} alt="Profile" className="avatar-image" />
                        ) : avatar}
                      </div>
                      <div className="profile-dropdown-info" style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="profile-dropdown-name" style={{ fontWeight: 700, fontSize: '0.98rem', color: '#1e293b' }}>{displayName}</span>
                        <span className="profile-dropdown-email" style={{ fontSize: '0.85rem', color: '#64748b' }}>{profileData?.email || user?.email || '—'}</span>
                      </div>
                    </div>
                    <div style={{ padding: '0.5rem' }}>
                      <button className="profile-menu-item" onClick={handleProfileSettingsClick}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                          <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                        <span>Profile Settings</span>
                      </button>
                      <button className="profile-menu-item" onClick={handleFamilyTreeClick}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                          <circle cx="9" cy="7" r="4"></circle>
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                        <span>Family Tree</span>
                      </button>
                      <button className="profile-menu-item" onClick={handleSignOut}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                          <polyline points="16 17 21 12 16 7"></polyline>
                          <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                        <span>Sign out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>
          
          {/* Sidebar Overlay for Mobile */}
          {showMobileMenu && (
            <div 
              className={`sidebar-overlay ${showMobileMenu ? 'active' : ''}`}
              onClick={closeMobileMenu}
            />
          )}
          
          <div className="main-content main-content-topbar">
            <div className={`sidebar ${showMobileMenu ? 'mobile-open' : ''}`}>
              {/* Mobile Close Button */}
              <button 
                className="mobile-sidebar-close" 
                onClick={closeMobileMenu}
                aria-label="Close menu"
              >
                ×
              </button>
              
              <div className="main-menu">
                <h3>Main Menu</h3>
                <nav className="nav-menu">
                  <button 
                    className={`nav-item ${activeView === 'dashboard' ? 'active' : ''}`}
                    onClick={() => handleNavigation('dashboard')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7"></rect>
                      <rect x="14" y="3" width="7" height="7"></rect>
                      <rect x="14" y="14" width="7" height="7"></rect>
                      <rect x="3" y="14" width="7" height="7"></rect>
                    </svg>
                    Dashboard
                  </button>
                  <button 
                    className={`nav-item ${activeView === 'scan' ? 'active' : ''}`}
                    onClick={() => handleNavigation('scan')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="3" y1="9" x2="21" y2="9"></line>
                      <line x1="9" y1="21" x2="9" y2="9"></line>
                    </svg>
                    Scan QR
                  </button>
                  <button 
                    className={`nav-item ${activeView === 'attendance' ? 'active' : ''}`}
                    onClick={() => handleNavigation('attendance')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    My Attendance
                  </button>
                </nav>
              </div>
            </div>
            <div className="content-wrapper">
              {activeView === 'dashboard' ? (
                <div className="dashboard-content">
                  <div className="member-new-dashboard">
                    {/* Welcome Header */}
                    <div className="welcome-header">
                      <h1>Welcome back, {user && user.firstName ? user.firstName : 'Juan'}!</h1>
                      <p>Track your attendance and stay connected with your church family</p>
                    </div>

                    {/* Stats Cards */}
                    <div className="stats-grid">
                      {dashboardStats.map((stat, index) => (
                        <div key={stat.key} className={`stat-card gradient-${index + 1}`}>
                          <div className="stat-icon">
                            {renderStatIcon(stat.icon)}
                          </div>
                          <div className="stat-content">
                            <div className="stat-label">{stat.label}</div>
                            <div className="stat-value">{stat.value}</div>
                            <div className="stat-subtitle">{stat.subtitle}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Main Grid */}
                    <div className="dashboard-grid">
                      {/* Left Column */}
                      <div className="dashboard-left">
                        {/* Mark Attendance Card */}
                        <div className="mark-attendance-card">
                          <div className="mark-attendance-content">
                            <h2>Mark Your Attendance</h2>
                            <p>Scan the QR code displayed at the service</p>
                            <button className="scan-qr-btn" onClick={() => handleNavigation('scan')}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                                <circle cx="12" cy="13" r="4"></circle>
                              </svg>
                              Scan QR Code
                            </button>
                          </div>
                          <div className="qr-illustration">
                            <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <rect x="3" y="3" width="7" height="7" rx="1"></rect>
                              <rect x="14" y="3" width="7" height="7" rx="1"></rect>
                              <rect x="14" y="14" width="7" height="7" rx="1"></rect>
                              <rect x="3" y="14" width="7" height="7" rx="1"></rect>
                            </svg>
                          </div>
                        </div>

                        {/* Monthly Breakdown */}
                        <div className="monthly-chart-card">
                          <h3>Monthly Breakdown</h3>
                          <div className="horizontal-chart-container">
                            {monthlyData.length > 0 ? (
                              monthlyData.map((item, index) => {
                                // Calculate width percentage
                                const barWidth = maxMonthlyCount > 0 ? (item.count / maxMonthlyCount) * 100 : 0;
                                
                                return (
                                  <div key={`${item.month}-${index}`} className="horizontal-bar-row">
                                    <div className="month-label">{item.month}</div>
                                    <div className="horizontal-bar-track">
                                      <div 
                                        className={`horizontal-bar ${item.count > 0 ? 'has-value' : 'empty'}`}
                                        style={{ width: `${barWidth}%` }}
                                      >
                                        {item.count > 0 && <span className="bar-value-inside">{item.count}</span>}
                                      </div>
                                    </div>
                                    <div className="count-label">{item.count}</div>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="chart-empty-state">
                                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                  <line x1="12" y1="20" x2="12" y2="10"></line>
                                  <line x1="18" y1="20" x2="18" y2="4"></line>
                                  <line x1="6" y1="20" x2="6" y2="16"></line>
                                </svg>
                                <p>No attendance data yet</p>
                                <span>Start attending services to see your monthly breakdown</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Column - Recent Attendance */}
                      <div className="dashboard-right">
                        <div className="recent-attendance-card">
                          <div className="card-header">
                            <h3>Recent Attendance</h3>
                          </div>
                          <div className="attendance-list">
                            {recentAttendance.map((item) => (
                              <div key={item.id} className="attendance-item">
                                <div className="attendance-info">
                                  <div className="service-name">{item.service}</div>
                                  <div className="service-datetime">
                                    {item.date}<br />
                                    {item.time}
                                  </div>
                                </div>
                                <div className="attendance-status">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                  </svg>
                                  <span>{item.status}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : activeView === 'scan' ? (
                <ScanQR 
                  onOpenScanner={startScanner}
                  dashboardStats={dashboardStats}
                  recentAttendance={recentAttendance}
                />
              ) : activeView === 'attendance' ? (
                <AttendanceHistory />
              ) : activeView === 'spiritual' ? (
                <SpiritualGrowth />
              ) : null}
            </div>
          </div>
        </div>
      )}

      {showScannerPanel && (
        <div
          className="member-scanner-overlay"
          role="dialog"
          aria-modal="true"
          onClick={handleCloseScanner}
        >
          <div className="member-scanner-panel" onClick={(e) => e.stopPropagation()}>
            <div className="scanner-header">
              <div>
                <h3>Scan Event QR</h3>
                <span>Select the QR code shown by the usher or on the screen.</span>
              </div>
              <button type="button" className="scanner-close-btn" onClick={handleCloseScanner} aria-label="Close scanner">
                ×
              </button>
            </div>
            <div className="scanner-body">
              <div className="scanner-video-wrapper">
                <video ref={videoRef} className="scanner-video" playsInline muted autoPlay />
                <div className="scanner-frame"></div>
              </div>
              <p className="scanner-hint">Align the QR within the square. We'll open the check-in form automatically.</p>
              {scanError && <div className="scanner-error">{scanError}</div>}
              <button type="button" className="scanner-upload-btn" onClick={handleUploadClick}>
                Upload QR Image
              </button>
              <input
                type="file"
                ref={uploadInputRef}
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileSelected}
              />
            </div>
            <div className="scanner-actions">
              <button type="button" className="scanner-cancel-btn" onClick={handleCloseScanner}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Member;
