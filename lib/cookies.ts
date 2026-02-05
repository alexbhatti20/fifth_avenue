// Cookie utilities for auth and consent management
// This file provides centralized cookie handling with consent awareness

const AUTH_COOKIE_NAME = 'auth_token';
const COOKIE_CONSENT_KEY = 'zoiro_cookie_consent';
const COOKIE_PREFERENCES_KEY = 'zoiro_cookie_preferences';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export interface CookiePreferences {
  necessary: boolean;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}

// Check if user has given consent for functional cookies (auth)
export function hasFunctionalCookieConsent(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    const prefsString = localStorage.getItem(COOKIE_PREFERENCES_KEY);
    if (!prefsString) {
      // No preferences saved yet - check if they've consented at all
      const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
      // If no consent given, default to allowing functional (essential for login)
      return consent === null ? true : true; // Always allow functional by default
    }
    
    const prefs: CookiePreferences = JSON.parse(prefsString);
    return prefs.functional !== false; // Default to true if not explicitly false
  } catch {
    return true; // Default to allowing on error
  }
}

// Check if user has given consent for analytics cookies
export function hasAnalyticsCookieConsent(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    const prefsString = localStorage.getItem(COOKIE_PREFERENCES_KEY);
    if (!prefsString) return false; // Default to no analytics
    
    const prefs: CookiePreferences = JSON.parse(prefsString);
    return prefs.analytics === true;
  } catch {
    return false;
  }
}

// Check if user has given consent for marketing cookies
export function hasMarketingCookieConsent(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    const prefsString = localStorage.getItem(COOKIE_PREFERENCES_KEY);
    if (!prefsString) return false; // Default to no marketing
    
    const prefs: CookiePreferences = JSON.parse(prefsString);
    return prefs.marketing === true;
  } catch {
    return false;
  }
}

// Check if user has given any cookie consent
export function hasCookieConsent(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(COOKIE_CONSENT_KEY) !== null;
}

// Get cookie preferences
export function getCookiePreferences(): CookiePreferences {
  if (typeof window === 'undefined') {
    return { necessary: true, functional: true, analytics: false, marketing: false };
  }
  
  try {
    const prefsString = localStorage.getItem(COOKIE_PREFERENCES_KEY);
    if (prefsString) {
      return JSON.parse(prefsString);
    }
  } catch {}
  
  return { necessary: true, functional: true, analytics: false, marketing: false };
}

// Set a cookie (respects consent for non-necessary cookies)
export function setCookie(name: string, value: string, maxAge: number = COOKIE_MAX_AGE): boolean {
  if (typeof document === 'undefined') return false;
  
  // Always allow necessary cookies (auth is necessary for login functionality)
  // Auth cookies are considered "functional" but necessary for core app functionality
  const isAuthCookie = name === AUTH_COOKIE_NAME;
  
  // For auth cookies, we set them regardless of preference since login is core functionality
  // Users who reject functional cookies simply won't be able to stay logged in across sessions
  if (!isAuthCookie && !hasFunctionalCookieConsent()) {
    console.warn(`Cookie "${name}" not set - user has not consented to functional cookies`);
    return false;
  }
  
  try {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
    return true;
  } catch {
    return false;
  }
}

// Get a cookie value
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  
  try {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  } catch {
    return null;
  }
}

// Delete a cookie
export function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return;
  
  try {
    document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
  } catch {}
}

// Get auth token - tries cookie first (for consistency with SSR), then localStorage
export function getAuthToken(): string | null {
  // Try cookie first (server can also read this)
  const cookieToken = getCookie(AUTH_COOKIE_NAME);
  if (cookieToken) return cookieToken;
  
  // Fallback to localStorage (check all token locations)
  if (typeof localStorage !== 'undefined') {
    try {
      // Check sb_access_token first (used by portal), then auth_token
      return localStorage.getItem('sb_access_token') || localStorage.getItem('auth_token');
    } catch {}
  }
  
  return null;
}

// Set auth token - stores in both cookie and localStorage
export function setAuthToken(token: string): void {
  // Always try to set cookie (for SSR)
  setCookie(AUTH_COOKIE_NAME, token);
  
  // Also store in localStorage (both keys for portal compatibility)
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('auth_token', token);
      localStorage.setItem('sb_access_token', token);
    } catch {}
  }
}

// Clear auth token from both cookie and localStorage
export function clearAuthToken(): void {
  // Delete both cookie naming conventions (for backward compatibility)
  deleteCookie(AUTH_COOKIE_NAME); // auth_token
  deleteCookie('auth-token');     // old name with hyphen
  deleteCookie('sb-access-token');
  
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('sb_access_token');
    } catch {}
  }
}

// Export constants
export { AUTH_COOKIE_NAME, COOKIE_CONSENT_KEY, COOKIE_PREFERENCES_KEY, COOKIE_MAX_AGE };
