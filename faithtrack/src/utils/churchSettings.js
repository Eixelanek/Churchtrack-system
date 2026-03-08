// Church Settings Utility
import { API_BASE_URL } from '../config/api';

export const getChurchSettings = () => {
  try {
    const stored = localStorage.getItem('churchSettings');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error loading church settings from localStorage:', error);
  }
  return null;
};

export const loadChurchSettingsFromAPI = async () => {
  try {
    // Direct API call to Render backend
    const response = await fetch(`${API_BASE_URL}/api/admin/get_church_settings.php`);
    const result = await response.json();
    
    if (result && result.success) {
      localStorage.setItem('churchSettings', JSON.stringify(result.data));
      return result.data;
    }
    
    // Fallback to defaults
    console.warn('Using default church settings');
    const defaultSettings = {
      churchName: 'Christ-Like Christian Church',
      churchAddress: null,
      churchPhone: null,
      churchEmail: null,
      churchLogo: null,
      headerLogo: null,
      helpCenterEmail: null,
      helpCenterPhone: null,
      helpCenterUrl: null,
      dateFormat: 'mm/dd/yyyy',
      homepage_image_1: null,
      homepage_image_2: null,
      homepage_image_3: null,
      homepage_image_4: null,
      homepage_image_5: null,
      homepage_image_6: null,
      homepage_hero_title: "SHAPING FUTURES\nWITH FAITH",
      homepage_hero_subtitle: "Join us for an uplifting experience"
    };
    localStorage.setItem('churchSettings', JSON.stringify(defaultSettings));
    return defaultSettings;
  } catch (error) {
    console.error('Error loading church settings from API:', error);
    const defaultSettings = {
      churchName: 'Christ-Like Christian Church',
      churchAddress: null,
      churchPhone: null,
      churchEmail: null,
      churchLogo: null,
      headerLogo: null,
      helpCenterEmail: null,
      helpCenterPhone: null,
      helpCenterUrl: null,
      dateFormat: 'mm/dd/yyyy',
      homepage_image_1: null,
      homepage_image_2: null,
      homepage_image_3: null,
      homepage_image_4: null,
      homepage_image_5: null,
      homepage_image_6: null,
      homepage_hero_title: "SHAPING FUTURES\nWITH FAITH",
      homepage_hero_subtitle: "Join us for an uplifting experience"
    };
    return defaultSettings;
  }
};

export const getChurchLogo = () => {
  const settings = getChurchSettings();
  if (settings && settings.churchLogo) {
    return settings.churchLogo;
  }
  // Return default logo if no settings found
  return null;
};

export const getHeaderLogo = () => {
  const settings = getChurchSettings();
  if (settings && settings.headerLogo) {
    return settings.headerLogo;
  }
  return null;
};

export const getHelpCenterInfo = () => {
  const settings = getChurchSettings();
  if (!settings) return null;

  const info = {
    email: settings.helpCenterEmail || '',
    phone: settings.helpCenterPhone || '',
    url: settings.helpCenterUrl || ''
  };

  if (info.email || info.phone || info.url) {
    return info;
  }

  return null;
};

export const getChurchName = () => {
  const settings = getChurchSettings();
  if (settings && settings.churchName) {
    return settings.churchName;
  }
  return 'Christ-Like Christian Church';
};

export const updateFavicon = (logoData) => {
  if (!logoData) return;
  
  // Remove existing favicon links
  const existingLinks = document.querySelectorAll('link[rel*="icon"]');
  existingLinks.forEach(link => link.remove());
  
  // Create new favicon link
  const link = document.createElement('link');
  link.rel = 'shortcut icon';
  link.type = 'image/png';
  link.href = logoData;
  document.head.appendChild(link);
  
  // Also update apple-touch-icon if on mobile
  const appleLink = document.createElement('link');
  appleLink.rel = 'apple-touch-icon';
  appleLink.href = logoData;
  document.head.appendChild(appleLink);
};
