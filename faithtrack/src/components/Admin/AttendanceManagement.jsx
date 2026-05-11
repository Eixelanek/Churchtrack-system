import React, { useState, useEffect, useMemo } from 'react';
import './AttendanceManagement.css';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { API_BASE_URL } from '../../config/api';
import { offlineStorage } from '../../utils/offlineStorage';

const AttendanceManagement = ({
  dateFormat = 'mm/dd/yyyy',
  onEventsChange = null,
  isManager = false,
  onManualCheckInClick = null,
  onGuestCheckInClick = null
}) => {
  const [activeTab, setActiveTab] = useState('today_events');
  const [selectedEvents, setSelectedEvents] = useState(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [showMarkAttendanceModal, setShowMarkAttendanceModal] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [currentEvent, setCurrentEvent] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editEventData, setEditEventData] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [eventToAction, setEventToAction] = useState(null);
  const [showViewDetailsModal, setShowViewDetailsModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [timeError, setTimeError] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // Modal mouse tracking state
  const [modalMouseDownTarget, setModalMouseDownTarget] = useState(null);
  
  // New state for linked events
  const [showLinkEventsModal, setShowLinkEventsModal] = useState(false);
  const [linkedEvents, setLinkedEvents] = useState({});
  const [selectedEventForLinking, setSelectedEventForLinking] = useState(null);
  
  // Add this new state variable near the other state declarations
  const [attendanceTimestamps, setAttendanceTimestamps] = useState({});
  
  // Custom alert modal state
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  
  // Function to show custom alert
  const showCustomAlert = (message) => {
    setAlertMessage(message);
    setShowAlertModal(true);
  };
  
  // Function to check if a date is today
  const isToday = (dateString) => {
    const today = new Date();
    const eventDate = new Date(dateString);
    return today.getFullYear() === eventDate.getFullYear() &&
           today.getMonth() === eventDate.getMonth() &&
           today.getDate() === eventDate.getDate();
  };
  
  // Get today's date in YYYY-MM-DD format for the sample event
  const getTodayString = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  };
  
  // Get a future date X days from today in YYYY-MM-DD format
  const getFutureDateString = (daysFromToday) => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysFromToday);
    return `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}-${String(futureDate.getDate()).padStart(2, '0')}`;
  };

  const formatStatusLabel = (status) => {
    if (!status) return 'Unknown';
    return status
      .toString()
      .toLowerCase()
      .split('_')
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  };

  const formatDateTimeDisplay = (dateString, startTime) => {
    let dateLabel = 'Date not set';
    let timeLabel = 'Time not set';

    if (dateString) {
      const date = new Date(dateString);
      if (!Number.isNaN(date.getTime())) {
        dateLabel = date.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });
      }
    }

    const formatTime = (timeStr) => {
      if (!timeStr) return null;
      const [hours, minutes] = timeStr.split(':');
      if (hours === undefined || minutes === undefined) return null;
      const time = new Date();
      time.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0);
      return time.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    };

    const startLabel = formatTime(startTime);

    if (startLabel) {
      timeLabel = startLabel;
    }

    return { dateLabel, timeLabel };
  };

  const splitDisplayName = (name = '') => {
    const trimmed = name.trim();
    if (!trimmed) {
      return { primary: 'Unknown', secondary: '' };
    }

    const parts = trimmed.split(/\s+/);
    if (parts.length <= 2) {
      return { primary: trimmed, secondary: '' };
    }

    const primaryParts = parts.slice(0, 2);
    const secondaryParts = parts.slice(2);
    return {
      primary: primaryParts.join(' '),
      secondary: secondaryParts.join(' '),
    };
  };

  // Add this function to check if events are on the same day
  const areEventsOnSameDay = (date1, date2) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };
  
  const [events, setEvents] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attendanceEvents, setAttendanceEvents] = useState([]);
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState('all');
  const [attendanceStats, setAttendanceStats] = useState({
    totalRecords: 0,
    averagePerService: 0,
    attendanceRate: 0
  });

  // Load events and members on component mount
  useEffect(() => {
    loadEvents();
    loadMembers();
    loadAttendanceEvents();
  }, []);

  // Load attendance events
  const loadAttendanceEvents = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/attendance/get_all_events.php?status=all`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAttendanceEvents(data.events || []);
        }
      }
    } catch (error) {

    }
  };

  const [eventDetailsMap, setEventDetailsMap] = useState({});
  const [eventDetailsLoading, setEventDetailsLoading] = useState({});

  const computeAttendanceStats = (eventsList = [], membersList = []) => {
    const safeEvents = Array.isArray(eventsList) ? eventsList : [];
    const safeMembers = Array.isArray(membersList) ? membersList : [];

    const activeCompletedEvents = safeEvents.filter((event) => {
      const status = (event.status || '').toLowerCase();
      return status === 'active' || status === 'completed';
    });

    const totalRecords = activeCompletedEvents.length;
    const totalAttendees = activeCompletedEvents.reduce((sum, event) => {
      const attendeesArrayCount = Array.isArray(event.attendees) ? event.attendees.length : 0;
      const count = event.totalAttendees ?? event.total_attendees ?? attendeesArrayCount;
      return sum + (Number.isFinite(count) ? Number(count) : 0);
    }, 0);

    const averagePerService = totalRecords > 0 ? totalAttendees / totalRecords : 0;

    const totalActiveMembers = safeMembers.length;
    let attendanceRate = 0;
    if (totalRecords > 0 && totalActiveMembers > 0) {
      const expectedAttendance = totalRecords * totalActiveMembers;
      if (expectedAttendance > 0) {
        attendanceRate = (totalAttendees / expectedAttendance) * 100;
      }
    }

    if (!Number.isFinite(averagePerService) || averagePerService < 0) {
      setAttendanceStats({ totalRecords, averagePerService: 0, attendanceRate: 0 });
      return;
    }

    if (!Number.isFinite(attendanceRate) || attendanceRate < 0) {
      attendanceRate = 0;
    }

    attendanceRate = Math.min(attendanceRate, 100);

    setAttendanceStats({
      totalRecords,
      averagePerService,
      attendanceRate
    });
  };

  const filteredAttendanceEvents = useMemo(() => {
    const normalizedFilter = attendanceStatusFilter.toLowerCase();
    if (normalizedFilter === 'all') {
      return attendanceEvents;
    }

    return attendanceEvents.filter((event) => (event.status || '').toLowerCase() === normalizedFilter);
  }, [attendanceEvents, attendanceStatusFilter]);

  useEffect(() => {
    const activeMembers = members.filter((member) => {
      const statusValue = (member.status || member.member_status || '').toLowerCase();
      if (!statusValue) {
        return true; // API already returns active members only
      }
      return statusValue === 'active';
    });
    computeAttendanceStats(attendanceEvents, activeMembers);
  }, [attendanceEvents, members]);

  // Load event details with attendees
  const loadEventDetails = async (eventId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/attendance/get_event_details.php?event_id=${eventId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          return data;
        }
      }
    } catch (error) {

    }
    return null;
  };

  // Load linked events for all events when events are loaded
  useEffect(() => {
    if (events.length > 0) {
      const loadAllLinkedEvents = async () => {
        for (const event of events) {
          await loadLinkedEventsForEvent(event.id);
        }
        // After loading linked events, load merged attendance counts
        await loadMergedAttendanceCounts();
      };
      loadAllLinkedEvents();
    }
  }, [events]);

  const loadEvents = async () => {
    // Check if online
    const isOnline = navigator.onLine;

    // If offline, load from cache
    if (!isOnline) {
      try {
        const cachedEvents = await offlineStorage.getAllData('events');
        if (cachedEvents && cachedEvents.length > 0) {
          setEvents(cachedEvents);
          setLoading(false);
          return;
        }
      } catch (error) {
        console.error('Error loading cached events:', error);
      }
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/events/get_all.php?limit=100&include_attendees=true`);
      if (response.ok) {
        const data = await response.json();
        // Handle both old format (array) and new format (object with events array)
        const eventsData = Array.isArray(data) ? data : (data.events || []);
        
        // Cache events for offline use
        if (isOnline && eventsData.length > 0) {
          try {
            await offlineStorage.cacheEvents(eventsData);
          } catch (error) {
            console.error('Error caching events:', error);
          }
        }
        
        setEvents(eventsData); // Default to empty array if no data
      } else {

        setEvents([]); // Set empty array instead of error
      }
    } catch (error) {

      setEvents([]); // Set empty array instead of error
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/members/get_active.php`);
      if (response.ok) {
        const data = await response.json();
        setMembers(data || []); // Default to empty array if no data
      } else {

        setMembers([]); // Set empty array instead of error
      }
    } catch (error) {

      setMembers([]); // Set empty array instead of error
    }
  };
  const [attendanceStatus, setAttendanceStatus] = useState({});
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [mergedAttendanceCounts, setMergedAttendanceCounts] = useState({});
  const [expandedServiceId, setExpandedServiceId] = useState(null);
  const [showEventDetailsModal, setShowEventDetailsModal] = useState(false);
  const [selectedEventDetails, setSelectedEventDetails] = useState(null);

  const INLINE_PREVIEW_LIMIT = 5;

  /** Guests used to receive time-only strings from the API; JS Date cannot parse "HH:mm". */
  const formatModalCheckInClock = (raw) => {
    if (raw == null || raw === '') return '';
    const s = String(raw).trim();
    const parsed = new Date(s);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
    const hm = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
    if (hm) {
      const dt = new Date();
      dt.setHours(parseInt(hm[1], 10, 10), parseInt(hm[2], 10, 10), hm[3] ? parseInt(hm[3], 10, 10) : 0, 0);
      return dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
    return s;
  };

  // Format date for display (Sep 29)
  const formatDateDisplay = (date) => {
    const options = { month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  // Format day (Sunday)
  const formatDayDisplay = (date) => {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  };

  // Get day number
  const getDayNumberDisplay = (date) => {
    return date.getDate();
  };

  // Navigate to previous/next week
  const changeWeekDisplay = (direction) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (direction * 7));
    setSelectedDate(newDate);
  };

  // Format date using the dateFormat prop (original function)
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    switch(dateFormat.toLowerCase()) {
      case 'dd/mm/yyyy':
        return date.toLocaleDateString('en-GB');
      case 'yyyy-mm-dd':
        return date.toLocaleDateString('en-CA');
      default: // mm/dd/yyyy
        return date.toLocaleDateString('en-US');
    }
  };

  useEffect(() => {
    let scanner;
    if (showQRScanner) {
      scanner = new Html5QrcodeScanner("qr-reader", {
        qrbox: {
          width: 250,
          height: 250,
        },
        fps: 5,
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA, Html5QrcodeScanType.SCAN_TYPE_FILE],
      });
      
      scanner.render((decodedText) => {
        const memberId = parseInt(decodedText);
        if (!isNaN(memberId)) {
          // Check if member exists
          const member = members.find(m => m.id === memberId);
          if (member) {
            handleStatusChange(memberId, 'present');
            const isOnline = navigator.onLine;
            if (isOnline) {
              showCustomAlert(`Marked ${member.name} as present!`);
            } else {
              showCustomAlert(`Marked ${member.name} as present! (Offline - will sync when online)`);
            }
          } else {
            showCustomAlert('Member not found!');
          }
          scanner.clear();
          setShowQRScanner(false);
        } else {
          showCustomAlert('Invalid QR code format!');
        }
      }, (error) => {

      });
    }
    
    return () => {
      if (scanner) {
        scanner.clear();
      }
    };
  }, [showQRScanner, members]);

  useEffect(() => {
    // Sync events data with parent Admin component
    if (onEventsChange && typeof onEventsChange === 'function') {
      onEventsChange(events);
    }
  }, [events, onEventsChange]);

  const handleAddEvent = () => {
    setShowAddEventModal(true);
  };

  const handleMarkAttendance = async (event) => {
    setCurrentEvent(event);
    setShowMarkAttendanceModal(true);
    // Reset modal state to initial view
    setShowQRScanner(false);
    setIsManualEntry(false);
    setMemberSearchQuery('');
    
    // Initialize attendance status for this event
    const initialStatus = {};
    const initialTimestamps = {};
    
    try {
      // Get merged attendance data for linked events
      const response = await fetch(`${API_BASE_URL}/api/events/get_merged_attendance.php?event_id=${event.id}`);
      if (response.ok) {
        const mergedAttendance = await response.json();
        
        // Pre-fill status for members already marked in linked events
        mergedAttendance.forEach(attendee => {
          initialStatus[attendee.member_id] = attendee.status.toLowerCase();
          initialTimestamps[attendee.member_id] = attendee.check_in_time || '';
        });
      } else {
        // Fallback to original event attendees if API fails
        if (event.attendees && event.attendees.length > 0) {
          event.attendees.forEach(attendee => {
            initialStatus[attendee.id] = attendee.status.toLowerCase();
            initialTimestamps[attendee.id] = attendee.time || '';
          });
        }
      }
    } catch (error) {

      // Fallback to original event attendees
      if (event.attendees && event.attendees.length > 0) {
        event.attendees.forEach(attendee => {
          initialStatus[attendee.id] = attendee.status.toLowerCase();
          initialTimestamps[attendee.id] = attendee.time || '';
        });
      }
    }
    
    const formatAttendees = (attendees = [], guests = []) => {
      const normalizedMembers = Array.isArray(attendees) ? attendees : [];
      const normalizedGuests = Array.isArray(guests) ? guests : [];

      const formattedMembers = normalizedMembers.map((attendee) => {
        const id = attendee.id ?? attendee.member_id ?? attendee.memberId ?? attendee.memberID ?? null;
        const name = attendee.name || attendee.full_name || attendee.fullName || 'Member';
        const rawStatus = (attendee.status_code || attendee.status || attendee.attendance_status || '').toString().toLowerCase();
        const status = rawStatus ? (rawStatus === 'present' || rawStatus === 'late' || rawStatus === 'checked in' ? 'Checked in' : rawStatus.replace(/(^|\s)\S/g, (s) => s.toUpperCase())) : 'Checked in';
        const statusCode = rawStatus || 'checked_in';
        const time = attendee.time || attendee.check_in_time || attendee.checkInTime || '';

        return {
          id,
          name,
          status,
          statusCode: statusCode.replace(/\s+/g, '_'),
          time
        };
      });

      const formattedGuests = normalizedGuests.map((guest) => {
        const id = guest.id ?? guest.guest_id ?? guest.guestId ?? `guest-${guest.session_id || guest.sessionId || Math.random()}`;
        const name = guest.full_name || guest.name || guest.display_name || 'Guest Attendee';
        const rawStatus = (guest.status_code || guest.status || guest.attendance_status || '').toString().toLowerCase();
        const status = rawStatus ? (rawStatus === 'present' || rawStatus === 'late' || rawStatus === 'checked in' ? 'Checked in' : rawStatus.replace(/(^|\s)\S/g, (s) => s.toUpperCase())) : 'Checked in';
        const statusCode = rawStatus || 'checked_in';
        const time = guest.time || guest.check_in_time || guest.checkInTime || '';

        return {
          id: `guest-${id}`,
          name,
          status,
          statusCode: statusCode.replace(/\s+/g, '_'),
          time,
          isGuest: true
        };
      });

      return [...formattedMembers, ...formattedGuests].sort((a, b) => {
        const timeA = a.time || '';
        const timeB = b.time || '';
        if (!timeA && !timeB) return 0;
        if (!timeA) return 1;
        if (!timeB) return -1;
        return timeA.localeCompare(timeB);
      });
    };

    const attendees = formatAttendees(event.attendees, event.guests);
    attendees.forEach(attendee => {
      initialStatus[attendee.id] = attendee.status;
      initialTimestamps[attendee.id] = attendee.time || '';
    });

    setAttendanceStatus(initialStatus);
    setAttendanceTimestamps(initialTimestamps);
  };

  const handleStatusChange = (memberId, status) => {
    // Get current time when status is changed (hour:minute only)
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    setAttendanceStatus(prev => {
      // If the same status is clicked again, toggle it off
      if (prev[memberId] === status) {
        const newState = { ...prev };
        delete newState[memberId]; // Remove the status completely
        
        // Also remove the timestamp
        setAttendanceTimestamps(prevTimestamps => {
          const newTimestamps = { ...prevTimestamps };
          delete newTimestamps[memberId];
          return newTimestamps;
        });
        
        return newState;
      } else {
        // Only update timestamp if it doesn't already exist or is being changed
        setAttendanceTimestamps(prevTimestamps => {
          // If no previous timestamp or status is changing, update the timestamp
          if (!prevTimestamps[memberId] || prev[memberId] !== status) {
            return {
              ...prevTimestamps,
              [memberId]: currentTime
            };
          }
          return prevTimestamps;
        });
        
        // Set the new status
        const newState = {
          ...prev,
          [memberId]: status
        };
        return newState;
      }
    });
  };

  const handleModalMouseDown = (e) => {
    setModalMouseDownTarget(e.target);
  };

  const handleModalClose = (e) => {
    if (e.target.className === 'modal-overlay' && modalMouseDownTarget === e.target) {
      setShowAddEventModal(false);
      setShowMarkAttendanceModal(false);
      setShowQRScanner(false);
      setIsManualEntry(false);
      setMemberSearchQuery('');
      setAttendanceStatus({});
      setCurrentEvent(null);
      setIsEditing(false);
      setEditEventData(null);
      setShowConfirmModal(false);
      setConfirmAction(null);
      setEventToAction(null);
      setShowViewDetailsModal(false);
      setSelectedEvent(null);
      setTimeError('');
      setModalMouseDownTarget(null);
    }
  };

  const handleDeleteEvent = (eventId) => {
    setConfirmAction('delete');
    setConfirmMessage('Are you sure you want to delete this event?');
    setEventToAction(eventId);
    setShowConfirmModal(true);
  };

  // Multi-select handlers
  const toggleEventSelection = (eventId) => {
    setSelectedEvents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  };

  const selectAllEvents = (events) => {
    setSelectedEvents(new Set(events.map(e => e.id)));
  };

  const clearEventSelection = () => {
    setSelectedEvents(new Set());
  };

  const handleBulkDeleteEvents = () => {
    if (selectedEvents.size === 0) return;
    setShowBulkDeleteModal(true);
  };

  const confirmBulkDeleteEvents = async () => {
    if (bulkDeleteLoading) return;
    setBulkDeleteLoading(true);

    try {
      const ids = Array.from(selectedEvents);
      let successCount = 0;
      let failCount = 0;

      for (const id of ids) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/events/delete.php`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
          });
          if (response.ok) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          failCount++;
        }
      }

      setShowBulkDeleteModal(false);
      setSelectedEvents(new Set());
      
      await loadEvents();
      
      const message = failCount === 0 
        ? `Successfully deleted ${successCount} event(s).`
        : `Deleted ${successCount} event(s), ${failCount} failed.`;
      
      showCustomAlert(message);
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  const handleEditEvent = (event) => {
    // Set editing mode and populate form with event data
    setIsEditing(true);
    setEditEventData({
      id: event.id,
      title: event.title,
      date: event.date,
      time: event.time,
      endTime: event.endTime || '', // Ensure endTime is included, default to empty string if not present
      location: event.location,
      status: event.status,
      attendees: event.attendees
    });
    // Clear any previous errors
    setTimeError('');
    setShowAddEventModal(true);
  };

  // Convert time from 24-hour to 12-hour format with AM/PM
  const formatTimeTo12Hour = (timeString) => {
    if (!timeString || !timeString.includes(':')) return timeString;
    
    // Handle if already in 12-hour format
    if (timeString.includes('AM') || timeString.includes('PM')) {
      return timeString;
    }
    
    try {
      const [hours, minutes] = timeString.split(':').map(part => parseInt(part, 10));
      
      const period = hours >= 12 ? 'PM' : 'AM';
      const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      
      return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`;
    } catch (error) {

      return timeString;
    }
  };

  // Validate that end time is after start time
  const validateEventTimes = (startTime, endTime) => {
    if (!startTime || !endTime) return { valid: false, message: 'Both start and end times are required' };
    
    if (startTime === endTime) {
      return { valid: false, message: 'Start time and end time cannot be the same' };
    }
    
    // Convert times to comparable format (minutes since midnight)
    const getTimeMinutes = (timeString) => {
      const [hours, minutes] = timeString.split(':').map(num => parseInt(num, 10));
      return hours * 60 + minutes;
    };
    
    const startMinutes = getTimeMinutes(startTime);
    const endMinutes = getTimeMinutes(endTime);
    
    if (endMinutes <= startMinutes) {
      return { valid: false, message: 'End time must be after start time' };
    }
    
    return { valid: true, message: '' };
  };

  const handleEditEventSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    // Get the date from the form in YYYY-MM-DD format
    const dateValue = formData.get('date');
    const startTime = formData.get('time');
    const endTime = formData.get('endTime');
    
    // Validate start and end times
    const validation = validateEventTimes(startTime, endTime);
    if (!validation.valid) {
      setTimeError(validation.message);
      return;
    }
    
    setTimeError(''); // Clear any previous error
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/events/update.php`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: editEventData.id,
          title: formData.get('title'),
          date: dateValue,
          start_time: startTime,
          end_time: endTime,
          location: formData.get('location')
        })
      });

      if (response.ok) {
        // Update the existing event with new data
        setEvents(prev => prev.map(event => 
          event.id === editEventData.id 
            ? {
                ...event,
                title: formData.get('title'),
                date: dateValue,
                time: formatTimeTo12Hour(startTime),
                endTime: formatTimeTo12Hour(endTime),
                location: formData.get('location')
              }
            : event
        ));
        
        // Reset editing state
        setShowAddEventModal(false);
        setIsEditing(false);
        setEditEventData(null);
        e.target.reset();
      } else {
        const errorData = await response.json();
        setTimeError(errorData.message || 'Failed to update event');
      }
    } catch (error) {

      setTimeError('Failed to update event');
    }
  };

  const handleAddEventSubmit = async (e) => {
    e.preventDefault();
    
    // If in editing mode, use edit handler instead
    if (isEditing && editEventData) {
      handleEditEventSubmit(e);
      return;
    }
    
    const formData = new FormData(e.target);
    const dateValue = formData.get('date'); // Get date in YYYY-MM-DD format
    const startTime = formData.get('time');
    const endTime = formData.get('endTime');
    
    // Validate start and end times
    const validation = validateEventTimes(startTime, endTime);
    if (!validation.valid) {
      setTimeError(validation.message);
      return;
    }
    
    setTimeError(''); // Clear any previous error
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/events/create.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.get('title'),
          date: dateValue,
          start_time: startTime,
          end_time: endTime,
          location: formData.get('location')
        })
      });

      if (response.ok) {
        const newEvent = await response.json();
        setEvents(prev => [...prev, {
          ...newEvent,
          time: formatTimeTo12Hour(startTime),
          endTime: formatTimeTo12Hour(endTime),
          attendees: []
        }]);
        setShowAddEventModal(false);
        e.target.reset();
      } else {
        const errorData = await response.json();
        setTimeError(errorData.message || 'Failed to create event');
      }
    } catch (error) {

      setTimeError('Failed to create event');
    }
  };

  const handleMarkAttendanceSubmit = async (e) => {
    e.preventDefault();
    if (!currentEvent) return;
    
    // Send ALL members with their current status (including null for unmarked)
    const attendanceData = members.map(member => {
      const status = attendanceStatus[member.id] || null; // null means no status (will be removed)
      const now = new Date();
      const defaultTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const timestamp = attendanceTimestamps[member.id] || defaultTime;
      
      return {
        member_id: member.id,
        status: status,
        check_in_time: timestamp
      };
    });
    
    // Check if offline
    const isOnline = navigator.onLine;
    
    if (!isOnline) {
      // Save to IndexedDB for later sync
      try {
        await offlineStorage.saveAttendanceOffline(
          currentEvent.id,
          {
            event_title: currentEvent.title,
            event_date: currentEvent.date,
            attendance_data: attendanceData.filter(a => a.status !== null) // Only save marked attendance
          }
        );
        
        showCustomAlert('Saved offline! Attendance will sync when you\'re back online.');
        
        setShowMarkAttendanceModal(false);
        setAttendanceStatus({});
        setAttendanceTimestamps({});
        setCurrentEvent(null);
        setShowQRScanner(false);
        setIsManualEntry(false);
        setMemberSearchQuery('');
      } catch (error) {
        console.error('Error saving offline attendance:', error);
        showCustomAlert('Failed to save offline attendance. Please try again.');
      }
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/attendance/record.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_id: currentEvent.id,
          attendance_data: attendanceData
        })
      });

      if (response.ok) {
        const result = await response.json();

        // Reload events to get updated attendance data
        await loadEvents();
        // Reload merged attendance counts for real-time update
        await loadMergedAttendanceCounts();
        
        setShowMarkAttendanceModal(false);
        setAttendanceStatus({});
        setAttendanceTimestamps({});
        setCurrentEvent(null);
        setShowQRScanner(false);
        setIsManualEntry(false);
        setMemberSearchQuery('');
      } else {
        const errorData = await response.json();

        // You might want to show this error to the user
      }
    } catch (error) {

      // You might want to show this error to the user
    }
  };

  const handleEndEvent = (eventId) => {
    setConfirmAction('end');
    setConfirmMessage('Are you sure you want to end this event? It will be moved to history.');
    setEventToAction(eventId);
    setShowConfirmModal(true);
  };

  const handleConfirmAction = async () => {
    if (confirmAction === 'delete' && eventToAction) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/events/delete.php`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id: eventToAction })
        });

        if (response.ok) {
          setEvents(events.filter(event => event.id !== eventToAction));
        } else {
          const errorData = await response.json();

        }
      } catch (error) {

      }
    } else if (confirmAction === 'end' && eventToAction) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/events/end_event.php`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id: eventToAction, autoEnded: false })
        });

        if (response.ok) {
          // Reload events to get updated attendance data with absent members
          await loadEvents();
        } else {
          const errorData = await response.json();

        }
      } catch (error) {

      }
    } else if (confirmAction === 'unlink' && eventToAction) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/events/unlink.php`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ event_id: eventToAction })
        });

        if (response.ok) {
          // Get the linked event IDs
          const linkedEventIds = linkedEvents[eventToAction] || [];
          
          // Update the linkedEvents state
          setLinkedEvents(prev => {
            const newLinks = { ...prev };
            
            // Remove links from this event
            delete newLinks[eventToAction];
            
                      // Remove links pointing to this event from the other events
          linkedEventIds.forEach(linkedId => {
            if (newLinks[linkedId]) {
              newLinks[linkedId] = newLinks[linkedId].filter(event => event.id !== eventToAction);
              
              // If no more links, remove the entry
              if (newLinks[linkedId].length === 0) {
                delete newLinks[linkedId];
              }
            }
          });
          
          return newLinks;
        });
        
        // Reload events and merged attendance counts after unlinking
        await loadEvents();
        await loadMergedAttendanceCounts();
        } else {
          const errorData = await response.json();

        }
      } catch (error) {

      }
    }
    
    setShowConfirmModal(false);
    setConfirmAction(null);
    setEventToAction(null);
  };

  // Helper function to get date/time as a comparable value for sorting
  const getEventDateTime = (event) => {
    const date = new Date(event.date);
    const [hours, minutes] = event.time.replace(/\s*(AM|PM)\s*$/i, '').split(':');
    const isPM = /PM/i.test(event.time);
    
    // Convert to 24-hour format
    let hour = parseInt(hours, 10);
    if (isPM && hour < 12) hour += 12;
    if (!isPM && hour === 12) hour = 0;
    
    date.setHours(hour, parseInt(minutes, 10), 0, 0);
    return date;
  };

  // Sort events by date and time
  const sortEventsByDateTime = (events) => {
    return [...events].sort((a, b) => {
      const dateTimeA = getEventDateTime(a);
      const dateTimeB = getEventDateTime(b);
      return dateTimeA - dateTimeB;
    });
  };

  const filteredEvents = events.filter(event => {
    const searchLower = searchQuery.toLowerCase();
    return (
      event.title.toLowerCase().includes(searchLower) ||
      event.location.toLowerCase().includes(searchLower) ||
      (event.date && event.date.toLowerCase().includes(searchLower)) ||
      (event.time && event.time.toLowerCase().includes(searchLower))
    );
  });

  const filteredMembers = (members || []).filter(member => {
    // Only require name to be present (API already filters by active status)
    if (!member || !member.name) {
      return false;
    }
    
    // If no search query, show all members
    if (!memberSearchQuery.trim()) {
      return true;
    }
    
    // Search by name or email (if email exists)
    const searchLower = memberSearchQuery.toLowerCase();
    return (
      member.name.toLowerCase().includes(searchLower) ||
      (member.email && member.email.toLowerCase().includes(searchLower))
    );
  });

  // Format date for input field (YYYY-MM-DD)
  const formatDateForInput = (dateString) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  // Format time for input field (HH:MM)
  const formatTimeForInput = (timeString) => {
    if (!timeString) return '';
    
    let hours = 0;
    let minutes = 0;
    
    try {
      // Parse "8:00 AM" or "08:00 AM" format
      if (timeString.includes('AM') || timeString.includes('PM')) {
        const timeParts = timeString.replace(/\s*(AM|PM)\s*$/i, '').split(':');
        hours = parseInt(timeParts[0], 10);
        minutes = parseInt(timeParts[1], 10);
        
        if (timeString.includes('PM') && hours < 12) {
          hours += 12;
        }
        if (timeString.includes('AM') && hours === 12) {
          hours = 0;
        }
      } else {
        // Parse "08:00" format
        const timeParts = timeString.split(':');
        hours = parseInt(timeParts[0], 10);
        minutes = parseInt(timeParts[1], 10);
      }
      
      if (isNaN(hours) || isNaN(minutes)) {

        return '';
      }
      
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    } catch (error) {

      return '';
    }
  };

  // Format attendance time to show only hours and minutes in 12-hour format
  const formatAttendanceTime = (timeString) => {
    if (!timeString) return '';
    
    try {
      // If time is in HH:MM:SS format, convert to 12-hour format
      if (timeString.includes(':') && timeString.split(':').length === 3) {
        const [hours, minutes] = timeString.split(':');
        const hour = parseInt(hours, 10);
        const period = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        return `${hour12}:${minutes} ${period}`;
      }
      
      // If already in HH:MM format, convert to 12-hour format
      if (timeString.includes(':') && timeString.split(':').length === 2) {
        const [hours, minutes] = timeString.split(':');
        const hour = parseInt(hours, 10);
        const period = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        return `${hour12}:${minutes} ${period}`;
      }
      
      // If it's a timestamp, try to parse it
      const date = new Date(timeString);
      if (!isNaN(date.getTime())) {
        const hour = date.getHours();
        const period = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        return `${hour12}:${String(date.getMinutes()).padStart(2, '0')} ${period}`;
      }
      
      return timeString;
    } catch (error) {

      return timeString;
    }
  };

  // Helper function to check if attendance marking is available for an event
  const canMarkAttendance = (event) => {
    const now = new Date();
    const eventDateTime = getEventDateTime(event);
    
    // Allow marking attendance 15 minutes before the event starts
    const fifteenMinutesBeforeEvent = new Date(eventDateTime);
    fifteenMinutesBeforeEvent.setMinutes(fifteenMinutesBeforeEvent.getMinutes() - 15);
    
    return now >= fifteenMinutesBeforeEvent;
  };

  const handleViewDetails = (event) => {
    setSelectedEvent(event);
    setShowViewDetailsModal(true);
  };

  // Calculate event statistics
  const getEventStats = (event) => {
    if (!event) return { total: 0, present: 0, late: 0, absent: 0 };

    // For completed events, count all active members
    if (event.status === 'completed') {
      const allAttendees = [...(event.attendees || []), ...(event.guests || [])];
      const present = allAttendees.filter(a => a.status === 'Present').length;
      const late = allAttendees.filter(a => a.status === 'Late').length;
      const absent = event.attendees ? event.attendees.filter(a => a.status === 'Absent').length : 0;
      const total = present + late + absent;

      return { total, present, late, absent };
    } else {
      // For active/upcoming events, only count those who attended
      const memberAttendees = event.attendees || [];
      const guestAttendees = event.guests || [];
      const combined = [...memberAttendees, ...guestAttendees];

      const total = combined.length;
      const present = combined.filter(a => a.status === 'Present').length;
      const late = combined.filter(a => a.status === 'Late').length;
      const absent = event.attendees ? event.attendees.filter(a => a.status === 'Absent').length : 0;

      return { total, present, late, absent };
    }
  };

  // Add function to check if event should be automatically ended
  const checkEventEndTime = () => {
    const now = new Date();
    let hasChanges = false;
    
    events.forEach(event => {
      // Skip events that aren't active or upcoming
      if (event.status !== 'active' && event.status !== 'upcoming') {
        return;
      }
      
      // Check if event date is in the past (regardless of end time)
      const eventDate = new Date(event.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      eventDate.setHours(0, 0, 0, 0);
      
      if (eventDate < today) {
        handleAutoEndEvent(event.id);
        hasChanges = true;
        return;
      }
      
      // If event has an end time, check if it's passed (this is for auto-ending completed events)
      if (event.endTime) {
        try {
          const eventEndDateTime = new Date(event.date);
          
          // Parse end time with better error handling
          let endHour = 0;
          let endMinutes = 0;
          
          if (event.endTime.includes('AM') || event.endTime.includes('PM')) {
            // Parse "8:00 AM" format
            const timeParts = event.endTime.replace(/\s*(AM|PM)\s*$/i, '').split(':');
            endHour = parseInt(timeParts[0], 10);
            endMinutes = parseInt(timeParts[1], 10);
            
            // Convert to 24-hour
            if (event.endTime.includes('PM') && endHour < 12) {
              endHour += 12;
            }
            if (event.endTime.includes('AM') && endHour === 12) {
              endHour = 0;
            }
          } else if (event.endTime.includes(':')) {
            // Parse "14:00" format
            const timeParts = event.endTime.split(':');
            endHour = parseInt(timeParts[0], 10);
            endMinutes = parseInt(timeParts[1], 10);
          }
          
          eventEndDateTime.setHours(endHour, endMinutes, 0, 0);
          
          // If current time is past end time, auto-end the event
          if (now > eventEndDateTime) {
            // Auto-end the event and mark absent members
            handleAutoEndEvent(event.id);
            hasChanges = true;
          }
        } catch (error) {

        }
      }
    });
    
    // If we made changes, reload events to get updated data from server
    if (hasChanges) {
      setTimeout(() => {
        loadEvents();
      }, 1000); // Wait 1 second for the API call to complete
    }
  };
  
  // Run end time check every 30 seconds for more responsive auto-ending
  useEffect(() => {
    checkEventEndTime(); // Check immediately on mount
    
    const interval = setInterval(() => {
      checkEventEndTime();
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, []); // Remove events dependency to prevent interval restart

  // Track events that are being auto-ended to prevent duplicate calls
  const [autoEndingEvents, setAutoEndingEvents] = useState(new Set());

  // Handle auto-ending events and marking absent members
  const handleAutoEndEvent = async (eventId) => {
    // Prevent duplicate calls for the same event
    if (autoEndingEvents.has(eventId)) {
      return;
    }

    setAutoEndingEvents(prev => new Set(prev).add(eventId));

    try {
      const response = await fetch(`${API_BASE_URL}/api/events/end_event.php`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: eventId, autoEnded: true })
      });

      if (response.ok) {

      } else {

      }
    } catch (error) {

    } finally {
      // Remove from auto-ending set after a delay
      setTimeout(() => {
        setAutoEndingEvents(prev => {
          const newSet = new Set(prev);
          newSet.delete(eventId);
          return newSet;
        });
      }, 5000); // 5 second cooldown
    }
  };

  // Add the function to handle linking events
  const handleLinkEvents = (eventId) => {
    const eventToLink = events.find(e => e.id === eventId);
    if (eventToLink) {
      setSelectedEventForLinking(eventToLink);
      setShowLinkEventsModal(true);
      // Load linked events data for this event
      loadLinkedEventsForEvent(eventId);
    }
  };

  // Load linked events for a specific event
  const loadLinkedEventsForEvent = async (eventId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/events/get_linked.php?event_id=${eventId}`);
      if (response.ok) {
        const linkedEvents = await response.json();
        // Store linked events data for use in the modal
        setLinkedEvents(prev => ({
          ...prev,
          [eventId]: linkedEvents
        }));
      }
    } catch (error) {

    }
  };
  
  // Function to handle confirming linked events
  const handleLinkEventsSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const linkTo = parseInt(formData.get('linkToEvent'));
    
    if (linkTo && selectedEventForLinking) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/events/link.php`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            event_id_1: selectedEventForLinking.id,
            event_id_2: linkTo
          })
        });

        if (response.ok) {
          // Reload linked events data for both events
          await loadLinkedEventsForEvent(selectedEventForLinking.id);
          await loadLinkedEventsForEvent(linkTo);
          
          // Reload events to get updated data
          await loadEvents();
          
          // Reload merged attendance counts
          await loadMergedAttendanceCounts();
        } else {
          const errorData = await response.json();

        }
      } catch (error) {

      }
    }
    
    setShowLinkEventsModal(false);
    setSelectedEventForLinking(null);
  };
  
  // Function to get linked events text for display
  const getLinkedEventsText = (eventId) => {
    if (!linkedEvents[eventId] || linkedEvents[eventId].length === 0) {
      return null;
    }
    
    const linkedNames = linkedEvents[eventId].map(event => event.title).filter(Boolean);
    
    if (linkedNames.length === 0) return null;
    
    return `Linked with: ${linkedNames.join(', ')}`;
  };

  // Function to load merged attendance counts for all events
  const loadMergedAttendanceCounts = async () => {
    const counts = {};
    for (const event of events) {
      if (linkedEvents[event.id] && linkedEvents[event.id].length > 0) {
        // For linked events, fetch from API
        try {
          const response = await fetch(`${API_BASE_URL}/api/events/get_merged_attendance.php?event_id=${event.id}`);
          if (response.ok) {
            const mergedAttendance = await response.json();
            counts[event.id] = mergedAttendance.length;
          } else {
            // Fallback to local calculation
            const linkedEventIds = [event.id, ...linkedEvents[event.id].map(e => e.id)];
            const uniqueMembers = new Set();
            linkedEventIds.forEach(id => {
              const eventData = events.find(e => e.id === id);
              if (eventData && eventData.attendees) {
                eventData.attendees.forEach(attendee => {
                  uniqueMembers.add(attendee.id);
                });
              }
            });
            counts[event.id] = uniqueMembers.size;
          }
        } catch (error) {

          // Fallback to local calculation
          const linkedEventIds = [event.id, ...linkedEvents[event.id].map(e => e.id)];
          const uniqueMembers = new Set();
          linkedEventIds.forEach(id => {
            const eventData = events.find(e => e.id === id);
            if (eventData && eventData.attendees) {
              eventData.attendees.forEach(attendee => {
                uniqueMembers.add(attendee.id);
              });
            }
          });
          counts[event.id] = uniqueMembers.size;
        }
      } else {
        // For non-linked events, use original count
        counts[event.id] = event.attendees.length;
      }
    }
    setMergedAttendanceCounts(counts);
  };

  // Function to get merged attendance count for an event (synchronous version for display)
  const getMergedAttendanceCount = (eventId) => {
    if (!linkedEvents[eventId] || linkedEvents[eventId].length === 0) {
      // No linked events, return original count
      const event = events.find(e => e.id === eventId);
      return event ? event.attendees.length : 0;
    }
    
    // For linked events, use the cached count from state
    return mergedAttendanceCounts[eventId] || 0;
  };

  // Add this function after handleLinkEvents
  const handleUnlinkEvents = (eventId) => {
    // Check if this event has any linked events
    if (!linkedEvents[eventId] || linkedEvents[eventId].length === 0) {
      return;
    }
    
    setConfirmAction('unlink');
    setConfirmMessage('Are you sure you want to remove ALL links for this event? This will not affect existing attendance records but future attendance will not be synchronized.');
    setEventToAction(eventId);
    setShowConfirmModal(true);
  };

  // Function to unlink a single event
  const handleUnlinkSingleEvent = async (eventId, linkedEventId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/events/unlink.php`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          event_id: eventId,
          linked_event_id: linkedEventId 
        })
      });

      if (response.ok) {
        // Update linked events state immediately
        setLinkedEvents(prev => {
          const newLinks = { ...prev };
          
          // Remove the unlinked event from the current event's linked list
          if (newLinks[eventId]) {
            newLinks[eventId] = newLinks[eventId].filter(event => event.id !== linkedEventId);
            // If no more linked events, remove the entry
            if (newLinks[eventId].length === 0) {
              delete newLinks[eventId];
            }
          }
          
          // Remove the current event from the unlinked event's linked list
          if (newLinks[linkedEventId]) {
            newLinks[linkedEventId] = newLinks[linkedEventId].filter(event => event.id !== eventId);
            // If no more linked events, remove the entry
            if (newLinks[linkedEventId].length === 0) {
              delete newLinks[linkedEventId];
            }
          }
          
          return newLinks;
        });
        
        // Reload all events to update the UI
        await loadEvents();
        
        // Reload merged attendance counts
        await loadMergedAttendanceCounts();
        showCustomAlert('Event unlinked successfully! Synced attendance has been removed from the unlinked event.');
      } else {
        const errorData = await response.json();
        showCustomAlert('Failed to unlink event: ' + errorData.message);
      }
    } catch (error) {

      showCustomAlert('Error unlinking event. Please try again.');
    }
  };

  if (error) {
    return (
      <div className="attendance-management">
        <div className="error-container">
          <p className="error-message">{error}</p>
          <button onClick={() => { setError(''); loadEvents(); loadMembers(); }}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="attendance-management">
      <div className="members-directory-header">
        <div className="header-text">
          <h1>Attendance Records</h1>
          <p className="directory-subtitle">Track and view detailed attendance history</p>
        </div>
        {isManager && (onManualCheckInClick || onGuestCheckInClick) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', alignItems: 'center', justifyContent: 'flex-end' }}>
            {onManualCheckInClick && (
              <button
                type="button"
                onClick={onManualCheckInClick}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  whiteSpace: 'nowrap'
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="8.5" cy="7" r="4"></circle>
                  <line x1="20" y1="8" x2="14" y2="14"></line>
                  <line x1="14" y1="8" x2="20" y2="14"></line>
                </svg>
                Manual Check-In
              </button>
            )}
            {onGuestCheckInClick && (
              <button
                type="button"
                onClick={onGuestCheckInClick}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#7c3aed',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  whiteSpace: 'nowrap'
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                Guest Check-In
              </button>
            )}
          </div>
        )}
      </div>

      {/* Stats Cards - New Design */}
      <div className="stats-cards-grid">
        <div className="stat-card-new blue">
          <div className="stat-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-label-small">This Week</div>
            <div className="stat-value-large">{loading ? '...' : attendanceStats.totalRecords}</div>
            <div className="stat-sublabel">Total Records</div>
          </div>
        </div>

        <div className="stat-card-new green">
          <div className="stat-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-label-small">Average</div>
            <div className="stat-value-large">{loading ? '...' : (attendanceStats.averagePerService.toFixed ? attendanceStats.averagePerService.toFixed(1) : attendanceStats.averagePerService)}</div>
            <div className="stat-sublabel">Per Service</div>
          </div>
        </div>

        <div className="stat-card-new purple">
          <div className="stat-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-label-small">Rate</div>
            <div className="stat-value-large">{loading ? '...' : (attendanceStats.attendanceRate.toFixed ? attendanceStats.attendanceRate.toFixed(1) : attendanceStats.attendanceRate)}%</div>
            <div className="stat-sublabel">Attendance</div>
          </div>
        </div>
      </div>

      <div className="attendance-status-toggle">
        <div className="attendance-tabs">
          <button
            type="button"
            className={`attendance-tab ${attendanceStatusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setAttendanceStatusFilter('all')}
          >
            All
          </button>
          <button
            type="button"
            className={`attendance-tab ${attendanceStatusFilter === 'active' ? 'active' : ''}`}
            onClick={() => setAttendanceStatusFilter('active')}
          >
            Active
          </button>
          <button
            type="button"
            className={`attendance-tab ${attendanceStatusFilter === 'completed' ? 'active' : ''}`}
            onClick={() => setAttendanceStatusFilter('completed')}
          >
            Completed
          </button>
          
          {/* Multi-Select Button in Tab Header */}
          <button
            onClick={() => {
              setMultiSelectMode(!multiSelectMode);
              if (multiSelectMode) {
                setSelectedEvents(new Set());
              }
            }}
            className="multi-select-tab-btn"
            style={{
              marginLeft: 'auto',
              padding: '0.75rem 1.5rem',
              border: 'none',
              borderRadius: '8px',
              background: multiSelectMode ? '#3b82f6' : '#e5e7eb',
              color: multiSelectMode ? 'white' : '#374151',
              cursor: 'pointer',
              fontSize: '0.95rem',
              fontWeight: '500',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
          >
            {multiSelectMode ? '✓ Multi-Select On' : 'Multi-Select'}
          </button>
        </div>
      </div>

      {/* Events List Cards */}

      {multiSelectMode && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          backgroundColor: '#f0f9ff',
          borderRadius: '8px',
          marginBottom: '16px',
          border: '1px solid #bfdbfe'
        }}>
          <span style={{ fontSize: '0.875rem', color: '#1e40af', fontWeight: '500' }}>
            {selectedEvents.size} selected
          </span>
          <button
            onClick={clearEventSelection}
            style={{
              padding: '6px 12px',
              border: '1px solid #bfdbfe',
              borderRadius: '4px',
              background: 'white',
              color: '#1e40af',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            Clear
          </button>
          <button
            onClick={() => selectAllEvents(filteredAttendanceEvents)}
            style={{
              padding: '6px 12px',
              border: '1px solid #bfdbfe',
              borderRadius: '4px',
              background: 'white',
              color: '#1e40af',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            Select All
          </button>
          {selectedEvents.size > 0 && (
            <div style={{ marginLeft: 'auto' }}>
              <button
                onClick={handleBulkDeleteEvents}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  background: '#ef4444',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}
              >
                Delete Selected
              </button>
            </div>
          )}
        </div>
      )}

      <div className="members-cards-container">
        {filteredAttendanceEvents.length === 0 ? (
          <div className="no-events-message">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
            </svg>
            <h3>No attendance records yet</h3>
            <p>Events will appear here once they have attendance activity.</p>
          </div>
        ) : (
          filteredAttendanceEvents.map((event) => {
            const eventDate = new Date(event.date);
            const dayNumber = eventDate.getDate();
            const monthDay = eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const dayName = eventDate.toLocaleDateString('en-US', { weekday: 'long' });
            
            return (
              <div key={event.id} className={`member-card-wrapper ${expandedServiceId === event.id ? 'expanded' : ''}`}>
                <div
                  className="member-card"
                  onClick={() => {
                    const isCurrentlyExpanded = expandedServiceId === event.id;
                    const nextExpandedId = isCurrentlyExpanded ? null : event.id;
                    setExpandedServiceId(nextExpandedId);

                    if (!isCurrentlyExpanded && !eventDetailsMap[event.id]) {
                      setEventDetailsLoading((prev) => ({ ...prev, [event.id]: true }));
                      loadEventDetails(event.id)
                        .then((data) => {
                          if (data) {
                            setEventDetailsMap((prev) => ({ ...prev, [event.id]: data }));
                          }
                        })
                        .finally(() => {
                          setEventDetailsLoading((prev) => ({ ...prev, [event.id]: false }));
                        });
                    }
                  }}
                >
                  {multiSelectMode && (
                    <input 
                      type="checkbox" 
                      className="member-card-checkbox"
                      checked={selectedEvents.has(event.id)}
                      onChange={() => toggleEventSelection(event.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                  <div className="event-date-box">
                    <div className="date-number">{dayNumber}</div>
                  </div>
                  <div className="member-details">
                    <div className="member-name">{monthDay}</div>
                    <div className="member-email">{dayName}</div>
                  </div>
                  <div className="member-badges">
                    <div className="total-attendees">
                      <span className="total-label">TOTAL</span>
                      <span className="total-number">
                        {(() => {
                          // Use event details count if available (most accurate), otherwise use event totalAttendees from backend
                          const detailsData = eventDetailsMap[event.id];
                          if (detailsData?.attendees) {
                            return detailsData.attendees.length;
                          }
                          // Backend now correctly calculates totalAttendees including guests
                          return event.totalAttendees || 0;
                        })()}
                      </span>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="people-icon">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                  </div>
                </div>
                {expandedServiceId === event.id && (
                  <div className="event-details-expanded">
                    {eventDetailsLoading[event.id] && (
                      <div className="event-details-loading">Loading event details...</div>
                    )}

                    {!eventDetailsLoading[event.id] && (
                      (() => {
                        const detailsData = eventDetailsMap[event.id];
                        const detailsEvent = detailsData?.event || {};
                        const resolvedTitle = detailsEvent.title || event.title || 'Untitled Event';
                        const statusLabel = formatStatusLabel(detailsEvent.status || event.status);
                        const { dateLabel, timeLabel } = formatDateTimeDisplay(
                          detailsEvent.date || event.date,
                          detailsEvent.startTime || detailsEvent.start_time || event.startTime || event.start_time
                        );

                        const allAttendees = detailsData?.attendees || [];
                        const allAbsentees = detailsData?.absentees || [];
                        const attendeesList = allAttendees;
                        const absenteesList = allAbsentees;
                        const attendeesPreview = attendeesList.slice(0, INLINE_PREVIEW_LIMIT);
                        const absenteesPreview = absenteesList.slice(0, INLINE_PREVIEW_LIMIT);
                        const attendeesCount = detailsEvent.totalAttendees ?? attendeesList.length ?? event.totalAttendees ?? 0;
                        const absenteesCount = detailsEvent.absentCount ?? absenteesList.length;
                        const hasQrSessions = (detailsEvent.qrSessionCount ?? 0) > 0;
                        const locationLabel = detailsEvent.location || event.location || 'Not specified';

                        const openFullListsModal = (initialTab = 'attendees') => {
                          setSelectedEventDetails({
                            title: resolvedTitle,
                            dateLabel,
                            timeLabel,
                            location: locationLabel,
                            attendees: attendeesList,
                            absentees: absenteesList,
                            activeTab: initialTab,
                          });
                          setShowEventDetailsModal(true);
                        };

                        return (
                          <>
                            <div className="event-overview-row">
                              <div>
                                <h3 className="event-overview-title">{resolvedTitle}</h3>
                                <div className="event-overview-meta">
                                  <div className="meta-item">
                                    <span className="meta-label">Date</span>
                                    <span className="meta-value">{dateLabel}</span>
                                  </div>
                                  <div className="meta-item">
                                    <span className="meta-label">Time</span>
                                    <span className="meta-value">{timeLabel}</span>
                                  </div>
                                </div>
                              </div>
                              <span className={`status-pill status-${(detailsEvent.status || event.status || '').toLowerCase()}`}>
                                {statusLabel}
                              </span>
                            </div>

                            {/* Event Summary Stats */}
                            {hasQrSessions && (
                              <div className="event-summary-stats">
                                <h3 className="summary-title">≡ƒôè Event Summary</h3>
                                <div className="summary-stats-grid">
                                  <div className="summary-stat-item">
                                    <div className="summary-stat-label">Total Attendees</div>
                                    <div className="summary-stat-value">{attendeesCount}</div>
                                  </div>
                                  <div className="summary-stat-item">
                                    <div className="summary-stat-label">Members</div>
                                    <div className="summary-stat-value">
                                      {attendeesList.filter(a => a.memberId).length}
                                      <span className="summary-stat-percentage">
                                        ({attendeesCount > 0 ? Math.round((attendeesList.filter(a => a.memberId).length / attendeesCount) * 100) : 0}%)
                                      </span>
                                    </div>
                                  </div>
                                  <div className="summary-stat-item">
                                    <div className="summary-stat-label">Guests</div>
                                    <div className="summary-stat-value">
                                      {attendeesList.filter(a => !a.memberId).length}
                                      <span className="summary-stat-percentage">
                                        ({attendeesCount > 0 ? Math.round((attendeesList.filter(a => !a.memberId).length / attendeesCount) * 100) : 0}%)
                                      </span>
                                    </div>
                                  </div>
                                  <div className="summary-stat-item">
                                    <div className="summary-stat-label">Attendance Rate</div>
                                    <div className="summary-stat-value">
                                      {members.length > 0 ? Math.round((attendeesList.filter(a => a.memberId).length / members.length) * 100) : 0}%
                                      <span className="summary-stat-subtext">of active members</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {hasQrSessions ? (
                              <>
                                <div className="attendees-section">
                                  <div className="attendees-header-row">
                                    <div className="attendees-header-left">
                                      <h3>Attendees</h3>
                                      <span className="section-count">{attendeesCount}</span>
                                    </div>
                                    {attendeesList.length > INLINE_PREVIEW_LIMIT && (
                                      <button
                                        type="button"
                                        className="view-all-btn"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openFullListsModal('attendees');
                                        }}
                                      >
                                        View All
                                      </button>
                                    )}
                                  </div>
                                  <div className="attendees-grid">
                                    {attendeesList.length === 0 ? (
                                      <div className="empty-state">No QR attendees recorded yet.</div>
                                    ) : (
                                      attendeesPreview.map((attendee) => {
                                        const { primary, secondary } = splitDisplayName(attendee.name || 'Checked-in Guest');
                                        const statusLabel = (attendee.status === 'Present' || attendee.status === 'present' ? 'CHECKED IN' : (attendee.status || 'Checked in').toUpperCase());
                                        const attendeeKey = `attendee-${attendee.memberId ?? 'guest'}-${attendee.checkInTime ?? 'time'}`;
                                        return (
                                          <div className="attendee-item-small checked" key={attendeeKey}>
                                            <div className="attendee-avatar-small">
                                              {attendee.profile_picture ? (
                                                <img 
                                                  src={`${API_BASE_URL}/api/uploads/get_profile_picture.php?path=${attendee.profile_picture.replace('/uploads/profile_pictures/', '')}`} 
                                                  alt={attendee.name} 
                                                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} 
                                                  onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.textContent = attendee.initials; }}
                                                />
                                              ) : attendee.initials}
                                            </div>
                                            <div className="attendee-main">
                                              <div className="attendee-name-line">
                                                <span className="attendee-name-primary">{primary}</span>
                                                {secondary && <span className="attendee-name-secondary">{secondary}</span>}
                                              </div>
                                            </div>
                                            <span className="attendee-status status-checked">{statusLabel}</span>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                </div>

                                <div className="attendees-section">
                                  <div className="attendees-header-row">
                                    <div className="attendees-header-left">
                                      <h3>Absentees</h3>
                                      <span className="section-count">{absenteesCount}</span>
                                    </div>
                                    {absenteesList.length > INLINE_PREVIEW_LIMIT && (
                                      <button
                                        type="button"
                                        className="view-all-btn"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openFullListsModal('absentees');
                                        }}
                                      >
                                        View All
                                      </button>
                                    )}
                                  </div>
                                  <div className="attendees-grid">
                                    {absenteesList.length === 0 ? (
                                      <div className="empty-state">No absentees recorded.</div>
                                    ) : (
                                      absenteesPreview.map((absentee) => {
                                        const { primary, secondary } = splitDisplayName(absentee.name || 'Member');
                                        return (
                                          <div className="attendee-item-small absent" key={`absent-${absentee.id}`}>
                                            <div className="attendee-avatar-small absentee-avatar">
                                              {absentee.profile_picture ? (
                                                <img 
                                                  src={`${API_BASE_URL}/api/uploads/get_profile_picture.php?path=${absentee.profile_picture.replace('/uploads/profile_pictures/', '')}`} 
                                                  alt={absentee.name} 
                                                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} 
                                                  onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.textContent = absentee.initials; }}
                                                />
                                              ) : absentee.initials}
                                            </div>
                                            <div className="attendee-main">
                                              <div className="attendee-name-line">
                                                <span className="attendee-name-primary">{primary}</span>
                                                {secondary && <span className="attendee-name-secondary">{secondary}</span>}
                                              </div>
                                            </div>
                                            <span className="attendee-status status-absent">ABSENT</span>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="empty-state">No QR session was recorded for this event.</div>
                            )}
                          </>
                        );
                      })()
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

      </div>

      {/* OLD PLACEHOLDER - HIDDEN */}
      {false && (
        <div>
          <div className={`member-card-wrapper ${expandedServiceId === 1 ? 'expanded' : ''}`}>
          <div className="member-card" onClick={() => setExpandedServiceId(expandedServiceId === 1 ? null : 1)}>
            <div className="event-date-box">
              <div className="date-number">29</div>
            </div>
            <div className="member-details">
              <div className="member-name">Sep 29</div>
              <div className="member-email">Sunday</div>
            </div>
            <div className="member-badges">
              <div className="total-attendees">
                <span className="total-label">TOTAL</span>
                <span className="total-number">125</span>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="people-icon">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
          </div>

          {expandedServiceId === 1 && (
            <div className="event-details-expanded">
              <div className="event-info-section">
                <h3>Event Details</h3>
                <div className="event-info-grid">
                  <div className="info-item">
                    <span className="info-label">Title:</span>
                    <span className="info-value">Sunday Morning Service</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Type:</span>
                    <span className="info-value">Worship Service</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Time:</span>
                    <span className="info-value">9:00 AM - 11:00 AM</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Location:</span>
                    <span className="info-value">Main Sanctuary</span>
                  </div>
                </div>
              </div>

              <div className="attendees-section">
                <div className="attendees-header-row">
                  <h3>Attendees (125)</h3>
                  <button 
                    className="view-all-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEventDetails({
                        id: 1,
                        date: 'Sep 29',
                        day: 'Sunday',
                        title: 'Sunday Morning Service',
                        type: 'Worship Service',
                        time: '9:00 AM - 11:00 AM',
                        location: 'Main Sanctuary',
                        totalAttendees: 125
                      });
                      setShowEventDetailsModal(true);
                    }}
                  >
                    View All Attendees
                  </button>
                </div>
                <div className="attendees-grid">
                  <div className="attendee-item-small">
                    <div className="attendee-avatar-small">JD</div>
                    <span>John Doe</span>
                  </div>
                  <div className="attendee-item-small">
                    <div className="attendee-avatar-small">MS</div>
                    <span>Maria Santos</span>
                  </div>
                  <div className="attendee-item-small">
                    <div className="attendee-avatar-small">JW</div>
                    <span>James Wilson</span>
                  </div>
                  <div className="attendee-item-small">
                    <div className="attendee-avatar-small">SC</div>
                    <span>Sarah Chen</span>
                  </div>
                  <div className="attendee-item-small">
                    <div className="attendee-avatar-small">RJ</div>
                    <span>Robert Johnson</span>
                  </div>
                  <div className="attendee-item-small more-attendees">
                    <div className="more-count">+119</div>
                    <span>more attendees</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sample Event Card 2 */}
        <div className={`member-card-wrapper ${expandedServiceId === 2 ? 'expanded' : ''}`}>
          <div className="member-card" onClick={() => setExpandedServiceId(expandedServiceId === 2 ? null : 2)}>
            <div className="event-date-box">
              <div className="date-number">22</div>
            </div>
            <div className="member-details">
              <div className="member-name">Sep 22</div>
              <div className="member-email">Sunday</div>
            </div>
            <div className="member-badges">
              <div className="total-attendees">
                <span className="total-label">TOTAL</span>
                <span className="total-number">118</span>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="people-icon">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
          </div>

          {expandedServiceId === 2 && (
            <div className="event-details-expanded">
              <div className="event-info-section">
                <h3>Event Details</h3>
                <div className="event-info-grid">
                  <div className="info-item">
                    <span className="info-label">Title:</span>
                    <span className="info-value">Sunday Morning Service</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Type:</span>
                    <span className="info-value">Worship Service</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Time:</span>
                    <span className="info-value">9:00 AM - 11:00 AM</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Location:</span>
                    <span className="info-value">Main Sanctuary</span>
                  </div>
                </div>
              </div>

              <div className="attendees-section">
                <div className="attendees-header-row">
                  <h3>Attendees (118)</h3>
                  <button 
                    className="view-all-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEventDetails({
                        id: 2,
                        date: 'Sep 22',
                        day: 'Sunday',
                        title: 'Sunday Morning Service',
                        type: 'Worship Service',
                        time: '9:00 AM - 11:00 AM',
                        location: 'Main Sanctuary',
                        totalAttendees: 118
                      });
                      setShowEventDetailsModal(true);
                    }}
                  >
                    View All Attendees
                  </button>
                </div>
                <div className="attendees-grid">
                  <div className="attendee-item-small">
                    <div className="attendee-avatar-small">AB</div>
                    <span>Anna Brown</span>
                  </div>
                  <div className="attendee-item-small">
                    <div className="attendee-avatar-small">CD</div>
                    <span>Chris Davis</span>
                  </div>
                  <div className="attendee-item-small">
                    <div className="attendee-avatar-small">EF</div>
                    <span>Emma Foster</span>
                  </div>
                  <div className="attendee-item-small">
                    <div className="attendee-avatar-small">GH</div>
                    <span>George Harris</span>
                  </div>
                  <div className="attendee-item-small">
                    <div className="attendee-avatar-small">IJ</div>
                    <span>Iris Jackson</span>
                  </div>
                  <div className="attendee-item-small more-attendees">
                    <div className="more-count">+113</div>
                    <span>more attendees</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sample Event Card 3 */}
        <div className={`member-card-wrapper ${expandedServiceId === 3 ? 'expanded' : ''}`}>
          <div className="member-card" onClick={() => setExpandedServiceId(expandedServiceId === 3 ? null : 3)}>
            <div className="event-date-box">
              <div className="date-number">15</div>
            </div>
            <div className="member-details">
              <div className="member-name">Sep 15</div>
              <div className="member-email">Sunday</div>
            </div>
            <div className="member-badges">
              <div className="total-attendees">
                <span className="total-label">TOTAL</span>
                <span className="total-number">132</span>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="people-icon">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
          </div>

          {expandedServiceId === 3 && (
            <div className="event-details-expanded">
              <div className="event-info-section">
                <h3>Event Details</h3>
                <div className="event-info-grid">
                  <div className="info-item">
                    <span className="info-label">Title:</span>
                    <span className="info-value">Sunday Morning Service</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Type:</span>
                    <span className="info-value">Worship Service</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Time:</span>
                    <span className="info-value">9:00 AM - 11:00 AM</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Location:</span>
                    <span className="info-value">Main Sanctuary</span>
                  </div>
                </div>
              </div>

              <div className="attendees-section">
                <div className="attendees-header-row">
                  <h3>Attendees (132)</h3>
                  <button 
                    className="view-all-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEventDetails({
                        id: 3,
                        date: 'Sep 15',
                        day: 'Sunday',
                        title: 'Sunday Morning Service',
                        type: 'Worship Service',
                        time: '9:00 AM - 11:00 AM',
                        location: 'Main Sanctuary',
                        totalAttendees: 132
                      });
                      setShowEventDetailsModal(true);
                    }}
                  >
                    View All Attendees
                  </button>
                </div>
                <div className="attendees-grid">
                  <div className="attendee-item-small">
                    <div className="attendee-avatar-small">KL</div>
                    <span>Kevin Lee</span>
                  </div>
                  <div className="attendee-item-small">
                    <div className="attendee-avatar-small">MN</div>
                    <span>Michelle Nelson</span>
                  </div>
                  <div className="attendee-item-small">
                    <div className="attendee-avatar-small">OP</div>
                    <span>Oliver Parker</span>
                  </div>
                  <div className="attendee-item-small">
                    <div className="attendee-avatar-small">QR</div>
                    <span>Quinn Roberts</span>
                  </div>
                  <div className="attendee-item-small">
                    <div className="attendee-avatar-small">ST</div>
                    <span>Sophie Turner</span>
                  </div>
                  <div className="attendee-item-small more-attendees">
                    <div className="more-count">+127</div>
                    <span>more attendees</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        </div>
      )}

      {/* Keep old events list hidden for now */}
      {false && activeTab === 'today_events' && (
        <div className="events-list">
          {sortEventsByDateTime(filteredEvents
            .filter(event => {
              if (!isToday(event.date) || (event.status !== 'active' && event.status !== 'upcoming')) {
                return false;
              }
              const now = new Date();
              const eventStartTime = event.time ? new Date(`${event.date} ${event.time}`) : new Date(`${event.date} 00:00`);
              const eventEndTime = event.endTime ? new Date(`${event.date} ${event.endTime}`) : new Date(`${event.date} 23:59`);
              return now >= eventStartTime && now <= eventEndTime;
            }))
            .map((event) => (
              <div key={event.id} className="event-card">
                <div className="event-card-header">
                  <div className="event-header-content">
                    <h3>{event.title}</h3>
                    <p className="event-date">{formatDate(event.date)}</p>
                  </div>
                  <div className="event-header-triangle"></div>
                </div>
                <div className="event-info">
                  <div className="event-detail">
                    <span className="event-icon">≡ƒòÉ</span>
                    <span>Time: {event.time} {event.endTime ? `- ${event.endTime}` : ''}</span>
                  </div>
                  <div className="event-detail">
                    <span className="event-icon">≡ƒôì</span>
                    <span>{event.location}</span>
                  </div>
                  <div className="event-detail">
                    <span className="event-icon">≡ƒæÑ</span>
                    <span>Expected: {getMergedAttendanceCount(event.id)} members</span>
                  </div>
                  {event.attendees.length > 0 && (
                    <div className="attendees-preview">
                      <div className="attendees-header">
                        <span className="attendees-title">Recent Attendees</span>
                        <span className="attendees-badge">{event.attendees.length}</span>
                      </div>
                      <div className="attendees-list">
                        {event.attendees.slice(0, 3).map(attendee => (
                          <div key={attendee.id} className="attendee-item">
                            <div className="attendee-avatar">
                              {attendee.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </div>
                            <div className="attendee-info">
                              <span className="attendee-name">{attendee.name}</span>
                              <span className="attendee-status">{attendee.status} at {formatAttendanceTime(attendee.time)}</span>
                            </div>
                          </div>
                        ))}
                        {event.attendees.length > 3 && (
                          <div className="attendee-item">
                            <div className="attendee-avatar">+</div>
                            <div className="attendee-info">
                              <span className="attendee-name">+ {event.attendees.length - 3} more</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="event-actions">
                  <button 
                    className={`action-btn mark-attendance ${!canMarkAttendance(event) ? 'disabled' : ''}`} 
                    onClick={() => canMarkAttendance(event) && handleMarkAttendance(event)}
                    disabled={!canMarkAttendance(event)}
                  >
                    Mark Attendance
                  </button>
                  <div className="secondary-actions">
                    <button 
                      className={`action-btn end-event ${!canMarkAttendance(event) ? 'disabled' : ''}`} 
                      onClick={() => canMarkAttendance(event) && handleEndEvent(event.id)}
                      disabled={!canMarkAttendance(event)}
                    >
                      End Event
                    </button>
                    <button className="action-btn edit" onClick={() => handleEditEvent(event)}>
                      Edit
                    </button>
                    <button className="action-btn delete" onClick={() => handleDeleteEvent(event.id)}>
                      Delete
                    </button>
                  </div>
                  <div className="secondary-actions">
                    {linkedEvents[event.id] && linkedEvents[event.id].length > 0 ? (
                      <button className="action-btn unlink" onClick={() => handleUnlinkEvents(event.id)}>
                        Unlink Events
                      </button>
                    ) : (
                      <button className="action-btn link" onClick={() => handleLinkEvents(event.id)}>
                        Link Events
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          {filteredEvents.filter(event => (event.status === 'active' || event.status === 'upcoming') && isToday(event.date)).length === 0 && (
            <div className="no-events-message">No events scheduled for today</div>
          )}
        </div>
      )}

      {activeTab === 'today' && (
        <div className="events-list">
          {sortEventsByDateTime(filteredEvents.filter(event => {
            // Only show events that are active/upcoming AND have a future START time
            const eventDate = new Date(event.date);
            const eventStartTime = event.time ? new Date(`${event.date} ${event.time}`) : new Date(`${event.date} 00:00`);
            const now = new Date();
            
            return (event.status === 'active' || event.status === 'upcoming') && eventStartTime > now;
          }))
            .map((event) => (
              <div key={event.id} className="event-card">
                <div className="event-card-header">
                  <div className="event-header-content">
                    <h3>{event.title}</h3>
                    <p className="event-date">{formatDate(event.date)}</p>
                  </div>
                  <div className="event-header-triangle"></div>
                </div>
                <div className="event-info">
                  <div className="event-detail">
                    <span className="event-icon">≡ƒòÉ</span>
                    <span>Time: {event.time} {event.endTime ? `- ${event.endTime}` : ''}</span>
                  </div>
                  <div className="event-detail">
                    <span className="event-icon">≡ƒôì</span>
                    <span>{event.location}</span>
                  </div>
                  <div className="event-detail">
                    <span className="event-icon">≡ƒæÑ</span>
                    <span>Expected: {getMergedAttendanceCount(event.id)} members</span>
                  </div>
                  {event.attendees.length > 0 && (
                    <div className="attendees-preview">
                      <div className="attendees-header">
                        <span className="attendees-title">Recent Attendees</span>
                        <span className="attendees-badge">{event.attendees.length}</span>
                      </div>
                      <div className="attendees-list">
                        {event.attendees.slice(0, 3).map(attendee => (
                          <div key={attendee.id} className="attendee-item">
                            <div className="attendee-avatar">
                              {attendee.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </div>
                            <div className="attendee-info">
                              <span className="attendee-name">{attendee.name}</span>
                              <span className="attendee-status">{attendee.status} at {formatAttendanceTime(attendee.time)}</span>
                            </div>
                          </div>
                        ))}
                        {event.attendees.length > 3 && (
                          <div className="attendee-item">
                            <div className="attendee-avatar">+</div>
                            <div className="attendee-info">
                              <span className="attendee-name">+ {event.attendees.length - 3} more</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="event-actions">
                  <button 
                    className={`action-btn mark-attendance ${!canMarkAttendance(event) ? 'disabled' : ''}`} 
                    onClick={() => canMarkAttendance(event) && handleMarkAttendance(event)}
                    disabled={!canMarkAttendance(event)}
                  >
                    Mark Attendance
                  </button>
                  <div className="secondary-actions">
                    <button 
                      className={`action-btn end-event ${!canMarkAttendance(event) ? 'disabled' : ''}`} 
                      onClick={() => canMarkAttendance(event) && handleEndEvent(event.id)}
                      disabled={!canMarkAttendance(event)}
                    >
                      End Event
                    </button>
                    <button className="action-btn edit" onClick={() => handleEditEvent(event)}>
                      Edit
                    </button>
                    <button className="action-btn delete" onClick={() => handleDeleteEvent(event.id)}>
                      Delete
                    </button>
                  </div>
                  <div className="secondary-actions">
                    {linkedEvents[event.id] && linkedEvents[event.id].length > 0 ? (
                      <button className="action-btn unlink" onClick={() => handleUnlinkEvents(event.id)}>
                        Unlink Events
                      </button>
                    ) : (
                      <button className="action-btn link" onClick={() => handleLinkEvents(event.id)}>
                        Link Events
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="events-list">
          {sortEventsByDateTime(filteredEvents.filter(event => event.status === 'completed'))
            .map((event) => (
              <div key={event.id} className="event-card">
                <div className="event-card-header">
                  <div className="event-header-content">
                    <h3>{event.title}</h3>
                    <p className="event-date">{formatDate(event.date)}</p>
                  </div>
                  <div className="event-header-triangle"></div>
                </div>
                <div className="event-info">
                  <div className="event-detail">
                    <span className="event-icon">≡ƒòÉ</span>
                    <span>Time: {event.time} - {event.endTime || 'N/A'}</span>
                  </div>
                  <div className="event-detail">
                    <span className="event-icon">≡ƒôì</span>
                    <span>{event.location}</span>
                  </div>
                  <div className="event-detail">
                    <span className="event-icon">≡ƒæÑ</span>
                    <span>Attendees: {getMergedAttendanceCount(event.id)}</span>
                  </div>
                  {linkedEvents[event.id] && linkedEvents[event.id].length > 0 && (
                    <div className="event-detail">
                      <span className="event-icon">≡ƒöù</span>
                      <span>Linked with {linkedEvents[event.id].length} event{linkedEvents[event.id].length > 1 ? 's' : ''}</span>
                    </div>
                  )}
                  {event.auto_ended && (
                    <div className="event-detail">
                      <span className="event-icon">ΓÅ░</span>
                      <span>Auto-ended</span>
                    </div>
                  )}
                  {event.manually_ended && (
                    <div className="event-detail">
                      <span className="event-icon">Γ£ï</span>
                      <span>Manually ended</span>
                    </div>
                  )}
                </div>
                <div className="event-actions">
                  <button 
                    className="action-btn view"
                    onClick={() => handleViewDetails(event)}
                  >
                    View Details
                  </button>
                  <div className="secondary-actions">
                    <button 
                      className="action-btn delete" 
                      onClick={() => handleDeleteEvent(event.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          {filteredEvents.filter(event => event.status === 'completed').length === 0 && (
            <div className="no-events-message">No completed events found</div>
          )}
        </div>
      )}

      {showAddEventModal && (
        <div className="modal-overlay" onMouseDown={handleModalMouseDown} onClick={handleModalClose}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>{isEditing ? 'Edit Event' : 'Add New Event'}</h3>
            <form onSubmit={handleAddEventSubmit}>
              <div className="form-group">
                <label>Event Title</label>
                <input 
                  type="text" 
                  name="title" 
                  required 
                  defaultValue={isEditing ? editEventData.title : ''} 
                />
              </div>
              <div className="form-group">
                <label>Date</label>
                <input 
                  type="date" 
                  name="date" 
                  required 
                  defaultValue={isEditing ? formatDateForInput(editEventData.date) : ''} 
                />
              </div>
              <div className="form-group">
                <label>Start Time</label>
                <input 
                  type="time" 
                  name="time" 
                  required 
                  defaultValue={isEditing ? formatTimeForInput(editEventData.time) : ''} 
                  onChange={() => setTimeError('')}
                />
              </div>
              <div className="form-group">
                <label>End Time</label>
                <input 
                  type="time" 
                  name="endTime"
                  required
                  defaultValue={isEditing ? formatTimeForInput(editEventData.endTime) : ''} 
                  onChange={() => setTimeError('')}
                />
              </div>
              {timeError && <div className="error-message">{timeError}</div>}
              <div className="form-group">
                <label>Location</label>
                <input 
                  type="text" 
                  name="location" 
                  required 
                  defaultValue={isEditing ? editEventData.location : ''} 
                />
              </div>
              <div className="modal-actions">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowAddEventModal(false);
                    setIsEditing(false);
                    setEditEventData(null);
                    setTimeError('');
                  }}
                >
                  Cancel
                </button>
                <button type="submit">
                  {isEditing ? 'Save Changes' : 'Add Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showMarkAttendanceModal && (
        <div className="modal-overlay" onMouseDown={handleModalMouseDown} onClick={handleModalClose}>
          <div className="modal-content attendance-modal">
            <h3>Mark Attendance</h3>
            {currentEvent && (
              <div className="event-details">
                <h4>{currentEvent.title}</h4>
                <p>{formatDate(currentEvent.date)} at {currentEvent.time}</p>
              </div>
            )}
            <div className="attendance-options">
              <button 
                className={`manual-btn ${!showQRScanner && isManualEntry ? 'active' : ''}`}
                onClick={() => {
                  setShowQRScanner(false);
                  setIsManualEntry(true);
                }}
              >
                Manual Entry
              </button>
              <button 
                className={`qr-btn ${showQRScanner ? 'active' : ''}`}
                onClick={() => {
                  setShowQRScanner(true);
                  setIsManualEntry(false);
                }}
              >
                Scan QR Code
              </button>
            </div>

            {showQRScanner ? (
              <div className="qr-scanner">
                <div className="qr-scanner-header">
                  <h4>QR Code Scanner</h4>
                  <p>Scan member's QR code or upload QR image to mark attendance</p>
                </div>
                <div id="qr-reader"></div>
                <div className="qr-scanner-info">
                  <p>ΓÇó Point camera at QR code or click to upload image</p>
                  <p>ΓÇó QR code should contain member ID number</p>
                  <p>ΓÇó Member will be automatically marked as present</p>
                </div>
              </div>
            ) : (
              <div className={`manual-entry-content ${isManualEntry ? 'active' : ''}`}>
                {isManualEntry && (
                  <form onSubmit={handleMarkAttendanceSubmit} className="attendance-form">
                    <div className="member-search">
                      <input
                        type="text"
                        placeholder="Search members..."
                        value={memberSearchQuery}
                        onChange={(e) => setMemberSearchQuery(e.target.value)}
                      />
                    </div>
                    <div className="members-list">
                      {loading ? (
                        <div className="loading-message">Loading members...</div>
                      ) : error ? (
                        <div className="error-message">Error loading members: {error}</div>
                      ) : filteredMembers.length === 0 ? (
                        <div className="no-members-message">
                          {memberSearchQuery ? 'No members found matching your search.' : 'No members available.'}
                        </div>
                      ) : (
                        filteredMembers.map(member => (
                          <div key={member.id} className="member-item">
                            <div className="member-info">
                              <span className="member-name">{member.name}</span>
                              <span className="member-email">{member.email}</span>
                            </div>
                            <div className="status-options">
                              <button
                                type="button"
                                className={`status-btn present ${attendanceStatus[member.id] === 'present' ? 'active' : ''}`}
                                onClick={() => handleStatusChange(member.id, 'present')}
                              >
                                Present
                              </button>
                              <button
                                type="button"
                                className={`status-btn late ${attendanceStatus[member.id] === 'late' ? 'active' : ''}`}
                                onClick={() => handleStatusChange(member.id, 'late')}
                              >
                                Late
                              </button>
                              {attendanceStatus[member.id] && (
                                <button
                                  type="button"
                                  className="status-btn remove"
                                  onClick={() => handleStatusChange(member.id, attendanceStatus[member.id])}
                                  title="Remove status"
                                >
                                  Γ£ò
                                </button>
                              )}
                            </div>
                            {attendanceStatus[member.id] && attendanceTimestamps[member.id] && (
                              <div className="status-timestamp">
                                Marked as {attendanceStatus[member.id]} at {attendanceTimestamps[member.id]}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                    <div className="modal-actions">
                      <button type="button" onClick={() => setShowMarkAttendanceModal(false)}>
                        Cancel
                      </button>
                      <button 
                        type="submit"
                      >
                        Save Attendance
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
            
            {!isManualEntry && !showQRScanner && (
              <div className="modal-actions">
                <button type="button" onClick={() => setShowMarkAttendanceModal(false)}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div className="modal-overlay" onMouseDown={handleModalMouseDown} onClick={handleModalClose}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="confirm-header">
              <h3>CLCC ChurchTrack says</h3>
            </div>
            <div className="confirm-content">
              <p>{confirmMessage}</p>
            </div>
            <div className="confirm-actions">
              <button 
                className="cancel-btn"
                onClick={() => setShowConfirmModal(false)}
              >
                Cancel
              </button>
              <button 
                className="ok-btn"
                onClick={handleConfirmAction}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {showViewDetailsModal && selectedEvent && (
        <div className="modal-overlay" onMouseDown={handleModalMouseDown} onClick={handleModalClose}>
          <div className="modal-content view-details-modal" onClick={e => e.stopPropagation()}>
            <h3>Event Details</h3>
            
            <div className="event-summary">
              <div className="event-header">
                <h4>{selectedEvent.title}</h4>
                <span className="event-status completed">
                  {selectedEvent.autoEnded ? 'Auto-Ended' : selectedEvent.manuallyEnded ? 'Manually Ended' : 'Completed'}
                </span>
              </div>
              
              <div className="event-meta">
                <div className="meta-item">
                  <span className="meta-label">Date:</span>
                  <span className="meta-value">{formatDate(selectedEvent.date)}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Time:</span>
                  <span className="meta-value">{selectedEvent.time} - {selectedEvent.endTime || 'N/A'}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Location:</span>
                  <span className="meta-value">{selectedEvent.location}</span>
                </div>
              </div>
            </div>
            
            <div className="attendance-stats">
              <h4>Attendance Summary</h4>
              <div className="stats-grid">
                <div className="stat-item">
                  <div className="stat-value">{getEventStats(selectedEvent).total}</div>
                  <div className="stat-label">Total Attendees</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{getEventStats(selectedEvent).present}</div>
                  <div className="stat-label">Present</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{getEventStats(selectedEvent).late}</div>
                  <div className="stat-label">Late</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{getEventStats(selectedEvent).absent}</div>
                  <div className="stat-label">Absent</div>
                </div>
              </div>
            </div>
            
            <div className="attendees-list">
              <h4>Attendees</h4>
              {(() => {
                const combinedAttendees = [
                  ...(selectedEvent.attendees || []),
                  ...(selectedEvent.guests || []).map(guest => ({
                    ...guest,
                    id: `guest-${guest.id}`,
                    isGuest: true
                  }))
                ];
                if (combinedAttendees.length === 0) {
                  return <p className="no-attendees">No attendance was recorded for this event.</p>;
                }
                return (
                <table className="attendees-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Status</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {combinedAttendees.map(attendee => (
                      <tr key={attendee.id} className={attendee.isGuest ? 'guest-row' : ''}>
                        <td>
                          <span>{attendee.name}</span>
                          {attendee.isGuest && <span className="guest-label">Guest</span>}
                        </td>
                        <td>
                          <span className={`status-badge ${attendee.status.toLowerCase()}`}>
                            {attendee.status}
                          </span>
                        </td>
                        <td>{attendee.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                );
              })()}
            </div>
            
            <div className="modal-actions">
              <button 
                type="button" 
                onClick={() => {
                  setShowViewDetailsModal(false);
                  setSelectedEvent(null);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showLinkEventsModal && selectedEventForLinking && (
        <div className="modal-overlay" onMouseDown={handleModalMouseDown} onClick={handleModalClose}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Link Events</h3>
            <p>Link <strong>{selectedEventForLinking.title}</strong> with another event on the same day. Members that attend either event will be counted present for both.</p>
            
            {/* Show current linked events */}
            {linkedEvents[selectedEventForLinking.id] && linkedEvents[selectedEventForLinking.id].length > 0 && (
              <div className="current-links">
                <h4>Currently Linked Events:</h4>
                <ul>
                  {linkedEvents[selectedEventForLinking.id].map(linkedEvent => (
                    <li key={linkedEvent.id}>
                      {linkedEvent.title} ({linkedEvent.time} - {linkedEvent.endTime})
                      <button 
                        type="button"
                        className="unlink-single-btn"
                        onClick={() => handleUnlinkSingleEvent(selectedEventForLinking.id, linkedEvent.id)}
                        title="Unlink this event"
                      >
                        Γ£ò
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <form onSubmit={handleLinkEventsSubmit}>
              <div className="form-group">
                <label>Link with Event</label>
                <select 
                  name="linkToEvent"
                  required
                >
                  <option value="">Select an event</option>
                  {events
                    .filter(event => {
                      // Exclude the current event
                      if (event.id === selectedEventForLinking.id) return false;
                      
                      // Exclude events not on the same day
                      if (!areEventsOnSameDay(event.date, selectedEventForLinking.date)) return false;
                      
                      // Exclude events that are already linked
                      const currentLinkedIds = linkedEvents[selectedEventForLinking.id]?.map(e => e.id) || [];
                      if (currentLinkedIds.includes(event.id)) return false;
                      
                      return true;
                    })
                    .map(event => (
                      <option key={event.id} value={event.id}>
                        {event.title} ({event.time} - {event.endTime})
                      </option>
                    ))
                  }
                </select>
                {events.filter(event => 
                  event.id !== selectedEventForLinking.id && 
                  areEventsOnSameDay(event.date, selectedEventForLinking.date) &&
                  !(linkedEvents[selectedEventForLinking.id]?.map(e => e.id) || []).includes(event.id)
                ).length === 0 && (
                  <p className="no-events-message">No available events to link with on this day.</p>
                )}
              </div>
              
              <div className="modal-actions">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowLinkEventsModal(false);
                    setSelectedEventForLinking(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit">
                  Link Events
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Event Details Modal */}
      {showEventDetailsModal && selectedEventDetails && (
        <div className="modal-overlay" onClick={() => setShowEventDetailsModal(false)}>
          <div className="modal-content event-details-modal-large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedEventDetails.title}</h2>
              <button className="modal-close-btn" onClick={() => setShowEventDetailsModal(false)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="modal-body">
              <div className="event-summary-large redesigned">
                <div className="summary-block schedule">
                  <div className="summary-heading">Schedule</div>
                  <div className="summary-line">
                    {selectedEventDetails.dateLabel}
                    <span className="dot" aria-hidden="true"></span>
                    {selectedEventDetails.timeLabel}
                  </div>
                </div>
                <div className="summary-block participation">
                  <div className="summary-heading">Participation</div>
                  <div className="summary-row">
                    <span className="summary-chip attendees">
                      <span className="chip-count">{selectedEventDetails.attendees.length}</span>
                      <span className="chip-label">Attendees</span>
                    </span>
                    <span className="summary-chip absentees">
                      <span className="chip-count">{selectedEventDetails.absentees.length}</span>
                      <span className="chip-label">Absentees</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="full-list-tabs">
                <button
                  type="button"
                  className={`full-list-tab ${selectedEventDetails.activeTab === 'attendees' ? 'active' : ''}`}
                  onClick={() => setSelectedEventDetails((prev) => ({ ...prev, activeTab: 'attendees' }))}
                >
                  Attendees ({selectedEventDetails.attendees.length})
                </button>
                <button
                  type="button"
                  className={`full-list-tab ${selectedEventDetails.activeTab === 'absentees' ? 'active' : ''}`}
                  onClick={() => setSelectedEventDetails((prev) => ({ ...prev, activeTab: 'absentees' }))}
                >
                  Absentees ({selectedEventDetails.absentees.length})
                </button>
              </div>

              <div className="full-list-container">
                {(selectedEventDetails.activeTab === 'attendees' ? selectedEventDetails.attendees : selectedEventDetails.absentees).length === 0 ? (
                  <div className="empty-state">{selectedEventDetails.activeTab === 'attendees' ? 'No QR attendees recorded yet.' : 'No absentees recorded.'}</div>
                ) : (
                  <ul className="full-list">
                    {(selectedEventDetails.activeTab === 'attendees' ? selectedEventDetails.attendees : selectedEventDetails.absentees).map((person, idx) => {
                      const { primary, secondary } = splitDisplayName(person.name || (selectedEventDetails.activeTab === 'attendees' ? 'Checked-in Guest' : 'Member'));
                      const statusLabel = selectedEventDetails.activeTab === 'attendees'
                        ? (person.status === 'Present' || person.status === 'present' ? 'CHECKED IN' : (person.status || 'Checked in').toUpperCase())
                        : 'ABSENT';
                      return (
                        <li className={`full-list-item ${selectedEventDetails.activeTab === 'attendees' ? 'checked' : 'absent'}`} key={`${selectedEventDetails.activeTab}-${person.memberId ?? person.id ?? idx}`}>
                          <div className={`full-list-accent ${selectedEventDetails.activeTab === 'attendees' ? 'checked' : 'absent'}`}></div>
                          <div className={`full-list-avatar ${selectedEventDetails.activeTab === 'attendees' ? 'checked' : 'absent'}`}>
                            {person.initials || '??'}
                          </div>
                          <div className="full-list-main">
                            <div className="full-list-name">
                              <span className="full-list-primary">{primary}</span>
                              {secondary && <span className="full-list-secondary">{secondary}</span>}
                            </div>
                            {selectedEventDetails.activeTab === 'attendees' && person.checkInTime && (
                              <div className="full-list-subtext">
                                Checked in at {formatModalCheckInClock(person.checkInTime)}
                              </div>
                            )}
                          </div>
                          <span className={`full-list-status ${selectedEventDetails.activeTab === 'attendees' ? 'status-checked' : 'status-absent'}`}>{statusLabel}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Modal */}
      {showBulkDeleteModal && (
        <div className="modal-overlay" onMouseDown={handleModalMouseDown} onClick={() => !bulkDeleteLoading && setShowBulkDeleteModal(false)}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="confirm-header">
              <h3>Delete Events?</h3>
            </div>
            <div className="confirm-content">
              <p>
                Are you sure you want to delete {selectedEvents.size} event(s) permanently? This action cannot be undone.
              </p>
            </div>
            <div className="confirm-actions">
              <button 
                onClick={() => setShowBulkDeleteModal(false)}
                disabled={bulkDeleteLoading}
                className="cancel-btn"
              >
                Cancel
              </button>
              <button 
                onClick={confirmBulkDeleteEvents}
                disabled={bulkDeleteLoading}
                className="ok-btn"
                style={{ background: '#ef4444' }}
              >
                {bulkDeleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert Modal */}
      {showAlertModal && (
        <div className="modal-overlay" onClick={() => setShowAlertModal(false)}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="confirm-header">
              <h3>churchtrack-system.vercel.app says</h3>
            </div>
            <div className="confirm-content">
              <p>{alertMessage}</p>
            </div>
            <div className="confirm-actions">
              <button 
                onClick={() => setShowAlertModal(false)}
                className="ok-btn"
                style={{ background: '#3b82f6', marginLeft: 'auto' }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceManagement; 
