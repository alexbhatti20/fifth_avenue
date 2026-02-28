// Keyboard Shortcuts Manager
// Allows users to configure custom shortcuts saved in localStorage

export interface KeyboardShortcut {
  id: string;
  name: string;
  description: string;
  defaultKey: string;
  category: 'navigation' | 'actions' | 'search' | 'general' | 'page-specific';
  page?: string; // Optional: page path where this shortcut is active (e.g., '/portal/billing')
  action: () => void;
}

export interface ShortcutConfig {
  id: string;
  key: string;
}

export interface ShortcutsSettings {
  enabled: boolean;
  shortcuts: ShortcutConfig[];
}

const SHORTCUTS_STORAGE_KEY = 'zoiro_keyboard_shortcuts';
const SHORTCUTS_ENABLED_KEY = 'zoiro_keyboard_shortcuts_enabled';

// Get stored shortcuts settings from localStorage
export function getStoredShortcutsSettings(): ShortcutsSettings {
  if (typeof window === 'undefined') return { enabled: true, shortcuts: [] };
  
  try {
    const shortcuts = localStorage.getItem(SHORTCUTS_STORAGE_KEY);
    const enabled = localStorage.getItem(SHORTCUTS_ENABLED_KEY);
    
    return {
      enabled: enabled ? JSON.parse(enabled) : true,
      shortcuts: shortcuts ? JSON.parse(shortcuts) : [],
    };
  } catch {
    return { enabled: true, shortcuts: [] };
  }
}

// Get stored shortcuts from localStorage
export function getStoredShortcuts(): ShortcutConfig[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(SHORTCUTS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Check if shortcuts are enabled
export function areShortcutsEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  
  try {
    const enabled = localStorage.getItem(SHORTCUTS_ENABLED_KEY);
    return enabled ? JSON.parse(enabled) : true;
  } catch {
    return true;
  }
}

// Enable/disable shortcuts globally
export function setShortcutsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(SHORTCUTS_ENABLED_KEY, JSON.stringify(enabled));
    // Dispatch event for reactivity
    window.dispatchEvent(new CustomEvent('shortcuts-enabled-changed', { detail: { enabled } }));
  } catch (error) {
    console.error('Failed to update shortcuts enabled state:', error);
  }
}

// Save shortcuts to localStorage
export function saveShortcuts(shortcuts: ShortcutConfig[]): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(shortcuts));
  } catch (error) {
    console.error('Failed to save shortcuts:', error);
  }
}

// Get the configured key for a shortcut
export function getShortcutKey(shortcutId: string, defaultKey: string): string {
  const stored = getStoredShortcuts();
  const config = stored.find(s => s.id === shortcutId);
  return config?.key || defaultKey;
}

// Update a single shortcut
export function updateShortcut(shortcutId: string, newKey: string): void {
  const shortcuts = getStoredShortcuts();
  const index = shortcuts.findIndex(s => s.id === shortcutId);
  
  if (index >= 0) {
    shortcuts[index].key = newKey;
  } else {
    shortcuts.push({ id: shortcutId, key: newKey });
  }
  
  saveShortcuts(shortcuts);
}

// Reset a shortcut to default
export function resetShortcut(shortcutId: string): void {
  const shortcuts = getStoredShortcuts();
  const filtered = shortcuts.filter(s => s.id !== shortcutId);
  saveShortcuts(filtered);
}

// Reset all shortcuts to defaults
export function resetAllShortcuts(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SHORTCUTS_STORAGE_KEY);
}

// Parse key combination (e.g., "Ctrl+O" -> { ctrl: true, key: 'o' })
export function parseKeyCombo(combo: string): {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  key: string;
} {
  const parts = combo.toLowerCase().split('+');
  const key = parts[parts.length - 1];
  
  return {
    ctrl: parts.includes('ctrl') || parts.includes('control'),
    alt: parts.includes('alt'),
    shift: parts.includes('shift'),
    meta: parts.includes('meta') || parts.includes('cmd') || parts.includes('command'),
    key,
  };
}

// Check if keyboard event matches a key combination
export function matchesKeyCombo(event: KeyboardEvent, combo: string): boolean {
  const parsed = parseKeyCombo(combo);
  
  // Normalize event key for better matching
  const eventKey = event.key.toLowerCase();
  const targetKey = parsed.key.toLowerCase();
  
  // Special key mappings for better compatibility
  const keyMap: Record<string, string[]> = {
    ',': [',', 'comma'],
    '/': ['/', 'slash'],
    ' ': [' ', 'space'],
    'arrowleft': ['arrowleft', 'left'],
    'arrowright': ['arrowright', 'right'],
    'arrowup': ['arrowup', 'up'],
    'arrowdown': ['arrowdown', 'down'],
  };
  
  const targetKeys = keyMap[targetKey] || [targetKey];
  const keysMatch = targetKeys.includes(eventKey);
  
  return (
    event.ctrlKey === parsed.ctrl &&
    event.altKey === parsed.alt &&
    event.shiftKey === parsed.shift &&
    event.metaKey === parsed.meta &&
    keysMatch
  );
}

// Format key combination for display
export function formatKeyCombo(combo: string): string {
  const parts = combo.split('+').map(part => {
    const p = part.trim();
    if (p.toLowerCase() === 'ctrl' || p.toLowerCase() === 'control') return 'Ctrl';
    if (p.toLowerCase() === 'alt') return 'Alt';
    if (p.toLowerCase() === 'shift') return 'Shift';
    if (p.toLowerCase() === 'meta' || p.toLowerCase() === 'cmd') return 'Meta';
    return p.toUpperCase();
  });
  
  return parts.join(' + ');
}

// Validate key combination
export function isValidKeyCombo(combo: string): boolean {
  if (!combo || typeof combo !== 'string') return false;
  
  const parts = combo.toLowerCase().split('+');
  if (parts.length === 0) return false;
  
  // Must have at least one modifier
  const hasModifier = parts.some(p => 
    ['ctrl', 'control', 'alt', 'shift', 'meta', 'cmd', 'command'].includes(p)
  );
  
  return hasModifier && parts.length >= 2;
}

// Check if a key combo conflicts with an existing shortcut
export function findConflictingShortcut(
  newCombo: string,
  currentShortcutId: string,
  allShortcuts: KeyboardShortcut[]
): KeyboardShortcut | null {
  const stored = getStoredShortcuts();
  
  for (const shortcut of allShortcuts) {
    if (shortcut.id === currentShortcutId) continue;
    
    const configuredKey = getShortcutKey(shortcut.id, shortcut.defaultKey);
    
    if (configuredKey.toLowerCase() === newCombo.toLowerCase()) {
      return shortcut;
    }
  }
  
  return null;
}

// Record keyboard event as key combo string
export function eventToKeyCombo(event: KeyboardEvent): string {
  const parts: string[] = [];
  
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  if (event.metaKey) parts.push('Meta');
  
  // Normalize key name
  let key = event.key;
  if (key === ' ') key = 'Space';
  if (key.length === 1) key = key.toUpperCase();
  
  parts.push(key);
  
  return parts.join('+');
}

// Check if a shortcut is active on the current page
export function isShortcutActiveOnPage(shortcut: KeyboardShortcut, currentPath: string): boolean {
  // If no page specified, it's a global shortcut
  if (!shortcut.page) return true;
  
  // Check if current path matches the shortcut's page
  return currentPath.startsWith(shortcut.page);
}

// Get all Chrome/Browser default shortcuts to prevent
export const CHROME_DEFAULTS_TO_PREVENT = [
  // Window/Tab Management
  'Ctrl+N', // New window
  'Ctrl+Shift+N', // New incognito window
  'Ctrl+T', // New tab
  'Ctrl+W', // Close tab
  'Ctrl+Shift+W', // Close window
  'Ctrl+Shift+T', // Reopen closed tab
  'Ctrl+Tab', // Next tab
  'Ctrl+Shift+Tab', // Previous tab
  'Ctrl+1', 'Ctrl+2', 'Ctrl+3', 'Ctrl+4', 'Ctrl+5',
  'Ctrl+6', 'Ctrl+7', 'Ctrl+8', 'Ctrl+9', 'Ctrl+0', // Switch to tab
  'Alt+Home', // Go to home page
  
  // Navigation
  'Ctrl+D', // Bookmark
  'Ctrl+H', // History
  'Ctrl+J', // Downloads
  'Ctrl+L', // Focus address bar
  'Alt+D', // Focus address bar
  'Ctrl+Shift+Delete', // Clear browsing data
  'Ctrl+Shift+B', // Toggle bookmarks bar
  'Ctrl+Shift+O', // Bookmarks manager
  'Backspace', // Go back (in some browsers)
  
  // Search/Find
  'Ctrl+F', // Find
  'Ctrl+G', // Find next
  'Ctrl+Shift+G', // Find previous
  'Ctrl+E', // Search
  'Ctrl+K', // Search in address bar
  
  // Page Actions
  'Ctrl+P', // Print
  'Ctrl+S', // Save
  'Ctrl+O', // Open file
  'Ctrl+U', // View source
  'Ctrl+Shift+I', // DevTools
  'Ctrl+Shift+J', // Console
  'Ctrl+Shift+C', // Inspect element
  'F12', // DevTools
  
  // Page Navigation
  'F5', // Reload
  'Ctrl+R', // Reload
  'Ctrl+Shift+R', // Hard reload
  'Ctrl+F5', // Hard reload
  'F11', // Fullscreen
  'Esc', // Exit fullscreen (in fullscreen mode)
  
  // Zoom
  'Ctrl++', // Zoom in
  'Ctrl+=', // Zoom in
  'Ctrl+-', // Zoom out
  'Ctrl+0', // Reset zoom
  
  // Text Editing (browser-level)
  'Ctrl+A', // Select all (we'll handle this in the app)
  'Ctrl+Z', // Undo (we'll handle this in the app)
  'Ctrl+Y', // Redo (we'll handle this in the app)
  'Ctrl+Shift+Z', // Redo
  
  // Misc
  'Ctrl+Shift+M', // Switch user
  'Ctrl+Shift+A', // Search tabs
  'Alt+F4', // Close window
  'F1', // Help
  'F3', // Find next
  'Shift+F3', // Find previous
  'F6', // Focus address bar
  'Shift+F10', // Context menu
];

// Additional patterns to block (regex-based)
export const BROWSER_SHORTCUT_PATTERNS = [
  /^Ctrl\+\d+$/, // Ctrl+Number (tab switching)
  /^Ctrl\+Shift\+\d+$/, // Ctrl+Shift+Number
  /^F\d+$/, // Function keys (F1-F12)
  /^Ctrl\+F\d+$/, // Ctrl+Function keys
];

// Check if a key combo matches browser shortcut patterns
export function matchesBrowserPattern(combo: string): boolean {
  return BROWSER_SHORTCUT_PATTERNS.some(pattern => pattern.test(combo));
}

// Check if a key combo is a Chrome default that should be prevented
export function isChromDefaultShortcut(combo: string): boolean {
  // Check exact matches
  const exactMatch = CHROME_DEFAULTS_TO_PREVENT.some(
    defaultCombo => defaultCombo.toLowerCase() === combo.toLowerCase()
  );
  
  if (exactMatch) return true;
  
  // Check pattern matches
  return matchesBrowserPattern(combo);
}

// Check if event should be completely blocked (aggressive blocking)
export function shouldBlockBrowserDefault(event: KeyboardEvent): boolean {
  // Guard against synthetic events with no key
  if (!event.key) return false;

  // Create combo string for this event
  const parts: string[] = [];
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  if (event.metaKey) parts.push('Meta');
  parts.push(event.key);
  const combo = parts.join('+');
  
  // Check if in blocked list
  if (isChromDefaultShortcut(combo)) {
    // Check if it's in input field and is a text edit shortcut
    const target = event.target as HTMLElement;
    const isInputField = 
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable;
    
    if (isInputField) {
      const key = event.key.toLowerCase();
      // Allow copy/paste/cut/select all/undo/redo in input fields
      const allowedInInput = ['c', 'v', 'x', 'a', 'z', 'y'];
      if (event.ctrlKey && !event.altKey && !event.shiftKey && allowedInInput.includes(key)) {
        return false; // Don't block
      }
      // Allow bare Backspace and Delete for character deletion
      if (!event.ctrlKey && !event.altKey && !event.metaKey &&
          (event.key === 'Backspace' || event.key === 'Delete')) {
        return false; // Don't block
      }
    }
    
    // Block everything else
    return true;
  }
  
  // Block Ctrl+N explicitly (new window) - extra safety
  if (event.ctrlKey && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'n') {
    return true;
  }
  
  // Block Ctrl+T explicitly (new tab) - extra safety
  if (event.ctrlKey && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 't') {
    return true;
  }
  
  // Block Ctrl+W explicitly (close tab) - extra safety
  if (event.ctrlKey && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'w') {
    return true;
  }
  
  return false;
}

// Helper to dispatch keyboard shortcut events efficiently
export function dispatchShortcutEvent(action: string, data?: any): void {
  try {
    const event = new CustomEvent('keyboard-shortcut', {
      detail: { action, ...data },
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);
  } catch (error) {
    console.error('Error dispatching shortcut event:', error);
  }
}

// Helper to safely focus and select an input
export function focusAndSelectInput(selector: string): boolean {
  try {
    const input = document.querySelector(selector) as HTMLInputElement;
    if (input && input instanceof HTMLInputElement) {
      input.focus();
      input.select();
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error focusing input:', error);
    return false;
  }
}

// Helper to find the best search input on the page
export function findSearchInput(): HTMLInputElement | null {
  const selectors = [
    'input[type="search"]',
    'input[placeholder*="search" i]',
    'input[placeholder*="filter" i]',
    'input[name="search"]',
    'input[aria-label*="search" i]',
  ];
  
  for (const selector of selectors) {
    const input = document.querySelector(selector) as HTMLInputElement;
    if (input && input instanceof HTMLInputElement && !input.disabled && input.offsetParent !== null) {
      return input;
    }
  }
  
  return null;
}
