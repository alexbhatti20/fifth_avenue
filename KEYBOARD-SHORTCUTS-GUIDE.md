# Custom Keyboard Shortcuts System

## Overview

The Zoiro Broast Hub portal includes a comprehensive keyboard shortcuts system with **aggressive browser shortcut blocking** for an uninterrupted app experience. All shortcuts are fully customizable and settings are stored in localStorage.

## Key Features

### 🚀 **Fast Execution & Performance**
- Optimized event handling with throttling (300ms) to prevent duplicate executions
- RequestAnimationFrame for smooth UI updates
- Concurrent execution prevention
- Smart input field detection (doesn't interfere with typing)

### 🛡️ **Aggressive Browser Shortcut Blocking**
- **Blocks ALL browser default shortcuts** (Ctrl+T, Ctrl+N, Ctrl+W, etc.)
- Site-wide protection - browser shortcuts disabled across entire portal
- Prevents accidental tab closures, new windows, and unwanted navigation
- Whitelist for essential shortcuts (Ctrl+C, Ctrl+V, Ctrl+X for copy/paste)
- Function key blocking (F1-F12) with app-level handling
- Pattern-based blocking for tab switching (Ctrl+1-9)

### 1. **Global Enable/Disable Toggle**
- Quickly enable or disable all keyboard shortcuts with a single switch
- State is persisted in localStorage
- Changes take effect immediately across the portal

### 2. **Customizable Shortcuts**
- Edit any keyboard shortcut to match your workflow
- Real-time conflict detection prevents duplicate shortcuts
- Visual feedback during key recording

### 3. **localStorage Persistence**
- All custom shortcuts and settings are saved to localStorage
- Settings persist across browser sessions
- No server-side storage required

### 4. **Comprehensive Coverage**
Navigate to any portal page with keyboard shortcuts:

| Page | Default Shortcut | Action ID |
|------|-----------------|-----------|
| Dashboard | `Ctrl+H` | nav_dashboard |
| Orders | `Ctrl+O` | nav_orders |
| Menu | `Ctrl+M` | nav_menu |
| Kitchen | `Ctrl+K` | nav_kitchen |
| Delivery | `Ctrl+D` | nav_delivery |
| Tables | `Ctrl+T` | nav_tables |
| Billing | `Ctrl+B` | nav_billing |
| Inventory | `Ctrl+I` | nav_inventory |
| Employees | `Ctrl+E` | nav_employees |
| Customers | `Ctrl+U` | nav_customers |
| Attendance | `Ctrl+Shift+A` | nav_attendance |
| Payroll | `Ctrl+P` | nav_payroll |
| Reports | `Ctrl+R` | nav_reports |
| Perks | `Ctrl+Shift+P` | nav_perks |
| Reviews | `Ctrl+Shift+R` | nav_reviews |
| Messages | `Ctrl+Shift+M` | nav_messages |
| Backup | `Ctrl+Shift+B` | nav_backup |
| Notifications | `Ctrl+N` | nav_notifications |
| Settings | `Ctrl+,` | nav_settings |

### 5. **Action Shortcuts**
| Action | Default Shortcut | Action ID |
|--------|-----------------|-----------|
| Refresh Page | `F5` | action_refresh |
| Print Page | `Ctrl+Shift+P` | action_print |
| Global Search | `Ctrl+Shift+F` | search_global |
| Help/Shortcuts | `Ctrl+/` | general_help |
| Go Back | `Alt+ArrowLeft` | general_back |

### 6. **Browser Shortcuts Blocked**
The following browser shortcuts are completely disabled in the portal:
- **Window/Tab**: Ctrl+N, Ctrl+T, Ctrl+W, Ctrl+Shift+T, Ctrl+Tab, Ctrl+1-9
- **Navigation**: Ctrl+H, Ctrl+D, Ctrl+L, Alt+D
- **Search/Find**: Ctrl+F, Ctrl+K, Ctrl+E
- **Dev Tools**: F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
- **Page Actions**: Ctrl+S, Ctrl+O, Ctrl+U, Ctrl+P (handled by app)
- **Zoom**: Ctrl++, Ctrl+-, Ctrl+0
- **And many more...**

**Note**: Copy (Ctrl+C), Paste (Ctrl+V), and Cut (Ctrl+X) still work normally in input fields.

## Usage

### Accessing Settings
1. Navigate to **Settings** → **Keyboard Shortcuts** tab
2. Or press `Ctrl+,` to open settings

### Customizing a Shortcut
1. Click the **Edit** icon next to any shortcut
2. Click the **"Click to Record New Shortcut"** button
3. Press your desired key combination
4. System automatically:
   - Validates the combination
   - Checks for conflicts
   - Shows warnings if needed
5. Click **"Save Shortcut"** to apply

### Resetting Shortcuts
- **Single Shortcut**: Click the reset icon next to a modified shortcut
- **All Shortcuts**: Click the "Reset All" button in the header

### Disabling Shortcuts
- Toggle the **"Shortcuts Enabled"** switch in the settings header
- Shortcuts are temporarily disabled but custom configurations are preserved

## Technical Implementation

### Files Structure

```
hooks/
  └── useKeyboardShortcuts.tsx    # Main hook for keyboard shortcuts logic

lib/
  └── keyboard-shortcuts.ts        # Core utilities and localStorage management

components/portal/
  ├── PortalProvider.tsx          # Global shortcuts integration
  └── KeyboardShortcutsSettings.tsx  # Settings UI component
```

### Key Functions

#### `useKeyboardShortcuts()`
- Main hook that registers global keyboard event listeners
- Automatically loads shortcuts from localStorage
- Checks enabled state before executing actions
- Returns: `{ shortcuts, enabled }`

#### localStorage Keys
- `zoiro_keyboard_shortcuts`: Stores custom shortcut configurations
- `zoiro_keyboard_shortcuts_enabled`: Stores enabled/disabled state

#### Shortcut Configuration Format
```typescript
interface ShortcutConfig {
  id: string;   // Unique identifier (e.g., 'nav_orders')
  key: string;  // Key combination (e.g., 'Ctrl+O')
}
```

### Validation Rules

1. **Modifier Requirement**: All shortcuts must include at least one modifier key (Ctrl, Alt, Shift, Meta)
2. **Uniqueness**: Each key combination must be unique across all shortcuts
3. **System Keys**: Avoid browser/system shortcuts (though some may still be intercepted)

### Event Handling

Shortcuts are **disabled** when:
- User is typing in an input field
- User is typing in a textarea
- User is editing contentEditable elements
- The keyboard shortcuts system is globally disabled

**Exception**: Help shortcut (`Ctrl+/`) works everywhere

## Troubleshooting

### Shortcuts Not Working
1. Check if shortcuts are enabled (toggle in settings)
2. Ensure no input field has focus
3. Check browser console for errors
4. Try resetting to defaults

### Conflicts with Browser Shortcuts
- Some browser shortcuts (e.g., `Ctrl+T`, `Ctrl+W`) cannot be overridden
- Choose alternative combinations
- Use Shift or Alt modifiers to avoid conflicts

### localStorage Issues
- Clear browser data may reset custom shortcuts
- Check localStorage quota if experiencing issues
- Export/backup settings before clearing browser data

## Future Enhancements

Potential additions:
- Export/import shortcut configurations
- Shortcut profiles (different sets for different roles)
- Context-aware shortcuts (different shortcuts per page)
- Visual shortcut cheat sheet overlay
- Shortcut search/filtering in settings

## Browser Compatibility

- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari
- ✅ Opera

Requires modern browser with localStorage support.

## Performance

- Minimal overhead: Single event listener on window
- Efficient key matching algorithm
- No network requests required
- Instant response time

---

**Note**: This feature is available to all portal users. Customizations are stored per-browser and do not sync across devices.
