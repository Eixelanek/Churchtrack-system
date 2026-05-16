import { API_BASE_URL } from '../config/api';

/**
 * Resolves a profile_picture value to a usable <img src> URL.
 * Handles:
 *  - Cloudinary / any full https:// URL → returned as-is
 *  - base64 data URIs → returned as-is
 *  - Legacy local paths (/uploads/profile_pictures/...) → proxied through get_profile_picture.php
 *  - null / empty → returns null
 */
export function resolveProfilePicUrl(value) {
  if (!value || typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;

  // Already a full URL or data URI — use directly
  if (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('data:')) {
    return v;
  }

  // Legacy local path — proxy through PHP endpoint
  const filename = v.replace('/uploads/profile_pictures/', '').replace(/^\/+/, '');
  return `${API_BASE_URL}/api/uploads/get_profile_picture.php?path=${encodeURIComponent(filename)}`;
}
