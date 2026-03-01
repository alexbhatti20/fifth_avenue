'use client';

import { useState, useCallback, useEffect } from 'react';
import { 
  Keyboard, 
  RotateCcw, 
  Power, 
  PowerOff, 
  Edit3, 
  Check, 
  X,
  AlertCircle,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  getStoredShortcuts,
  saveShortcuts,
  updateShortcut,
  resetShortcut,
  resetAllShortcuts,
  formatKeyCombo,
  isValidKeyCombo,
  areShortcutsEnabled,
  setShortcutsEnabled,
  findConflictingShortcut,
  eventToKeyCombo,
  type KeyboardShortcut,
  type ShortcutConfig,
} from '@/lib/keyboard-shortcuts';
import { cn } from '@/lib/utils';

// Get all available shortcuts
function getAllShortcuts(): KeyboardShortcut[] {
  // This is a static version for settings - matches useKeyboardShortcuts
  return [
    // Navigation
    { id: 'nav_dashboard', name: 'Dashboard', description: 'Go to dashboard', defaultKey: 'Ctrl+H', category: 'navigation', action: () => {} },
    { id: 'nav_orders', name: 'Orders', description: 'Go to orders page', defaultKey: 'Ctrl+O', category: 'navigation', action: () => {} },
    { id: 'nav_menu', name: 'Menu', description: 'Go to menu management', defaultKey: 'Ctrl+M', category: 'navigation', action: () => {} },
    { id: 'nav_kitchen', name: 'Kitchen', description: 'Go to kitchen', defaultKey: 'Ctrl+K', category: 'navigation', action: () => {} },
    { id: 'nav_delivery', name: 'Delivery', description: 'Go to delivery', defaultKey: 'Ctrl+D', category: 'navigation', action: () => {} },
    { id: 'nav_tables', name: 'Tables', description: 'Go to table management', defaultKey: 'Ctrl+T', category: 'navigation', action: () => {} },
    { id: 'nav_billing', name: 'Billing', description: 'Go to billing', defaultKey: 'Ctrl+B', category: 'navigation', action: () => {} },
    { id: 'nav_inventory', name: 'Inventory', description: 'Go to inventory', defaultKey: 'Ctrl+I', category: 'navigation', action: () => {} },
    { id: 'nav_employees', name: 'Employees', description: 'Go to employees', defaultKey: 'Ctrl+E', category: 'navigation', action: () => {} },
    { id: 'nav_attendance', name: 'Attendance', description: 'Go to attendance', defaultKey: 'Ctrl+Shift+A', category: 'navigation', action: () => {} },
    { id: 'nav_payroll', name: 'Payroll', description: 'Go to payroll', defaultKey: 'Ctrl+P', category: 'navigation', action: () => {} },
    { id: 'nav_reports', name: 'Reports', description: 'Go to reports', defaultKey: 'Ctrl+R', category: 'navigation', action: () => {} },
    { id: 'nav_perks', name: 'Perks', description: 'Go to perks/deals', defaultKey: 'Ctrl+Shift+P', category: 'navigation', action: () => {} },
    { id: 'nav_reviews', name: 'Reviews', description: 'Go to reviews', defaultKey: 'Ctrl+Shift+R', category: 'navigation', action: () => {} },
    { id: 'nav_messages', name: 'Messages', description: 'Go to messages', defaultKey: 'Ctrl+Shift+M', category: 'navigation', action: () => {} },
    { id: 'nav_backup', name: 'Backup', description: 'Go to backup', defaultKey: 'Ctrl+Shift+B', category: 'navigation', action: () => {} },
    { id: 'nav_notifications', name: 'Notifications', description: 'Go to notifications', defaultKey: 'Ctrl+N', category: 'navigation', action: () => {} },
    { id: 'nav_settings', name: 'Settings', description: 'Go to settings', defaultKey: 'Ctrl+,', category: 'navigation', action: () => {} },
    // Actions
    { id: 'action_refresh', name: 'Refresh Page', description: 'Refresh current page', defaultKey: 'F5', category: 'actions', action: () => {} },
    { id: 'orders_new', name: 'Create Order', description: 'Create new order from anywhere', defaultKey: 'Ctrl+Shift+N', category: 'actions', action: () => {} },
    { id: 'orders_refresh', name: 'Refresh/Go to Orders', description: 'Go to orders and refresh', defaultKey: 'Alt+O', category: 'actions', action: () => {} },
    { id: 'orders_filter', name: 'Search Orders', description: 'Go to orders and focus search', defaultKey: 'Ctrl+Shift+O', category: 'actions', action: () => {} },
    { id: 'menu_add_item', name: 'Add Menu Item', description: 'Add menu item from anywhere', defaultKey: 'Ctrl+Alt+M', category: 'actions', action: () => {} },
    { id: 'inventory_add', name: 'Add Inventory Item', description: 'Add inventory item from anywhere', defaultKey: 'Ctrl+Shift+I', category: 'actions', action: () => {} },
    { id: 'tables_add', name: 'Add Table', description: 'Add table from anywhere', defaultKey: 'Ctrl+Shift+T', category: 'actions', action: () => {} },
    { id: 'employees_add', name: 'Add Employee', description: 'Add employee from anywhere', defaultKey: 'Ctrl+Shift+E', category: 'actions', action: () => {} },
    { id: 'customers_add', name: 'Customers', description: 'Go to customers / add new customer', defaultKey: 'Ctrl+U', category: 'actions', action: () => {} },
    // Search
    { id: 'search_global', name: 'Global Search', description: 'Open global search', defaultKey: 'Ctrl+Shift+F', category: 'search', action: () => {} },
    // General
    { id: 'general_help', name: 'Help', description: 'Show keyboard shortcuts', defaultKey: 'Ctrl+/', category: 'general', action: () => {} },
    { id: 'general_back', name: 'Go Back', description: 'Navigate to previous page', defaultKey: 'Alt+ArrowLeft', category: 'general', action: () => {} },
  ];
}

interface EditDialogState {
  open: boolean;
  shortcut: KeyboardShortcut | null;
  currentKey: string;
  recording: boolean;
  error: string | null;
  conflict: KeyboardShortcut | null;
}

export function KeyboardShortcutsSettings() {
  const [enabled, setEnabled] = useState(true);
  const [customShortcuts, setCustomShortcuts] = useState<ShortcutConfig[]>([]);
  const [editDialog, setEditDialog] = useState<EditDialogState>({
    open: false,
    shortcut: null,
    currentKey: '',
    recording: false,
    error: null,
    conflict: null,
  });
  const [filter, setFilter] = useState<string>('all');

  const allShortcuts = getAllShortcuts();

  // Load settings
  useEffect(() => {
    setEnabled(areShortcutsEnabled());
    setCustomShortcuts(getStoredShortcuts());
  }, []);

  // Get configured key for a shortcut
  const getConfiguredKey = useCallback((shortcut: KeyboardShortcut): string => {
    const custom = customShortcuts.find(s => s.id === shortcut.id);
    return custom?.key || shortcut.defaultKey;
  }, [customShortcuts]);

  // Check if shortcut is modified
  const isModified = useCallback((shortcut: KeyboardShortcut): boolean => {
    return customShortcuts.some(s => s.id === shortcut.id);
  }, [customShortcuts]);

  // Toggle enabled state
  const handleToggleEnabled = useCallback(() => {
    const newEnabled = !enabled;
    setShortcutsEnabled(newEnabled);
    setEnabled(newEnabled);
  }, [enabled]);

  // Open edit dialog
  const handleEdit = useCallback((shortcut: KeyboardShortcut) => {
    setEditDialog({
      open: true,
      shortcut,
      currentKey: getConfiguredKey(shortcut),
      recording: false,
      error: null,
      conflict: null,
    });
  }, [getConfiguredKey]);

  // Start recording key combo
  const handleStartRecording = useCallback(() => {
    setEditDialog(prev => ({ ...prev, recording: true, error: null, conflict: null }));
  }, []);

  // Handle key press during recording
  useEffect(() => {
    if (!editDialog.recording) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Capture the full combo BEFORE any other handler can intercept it
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      // Ignore modifier-only keydown events
      const modifierKeys = ['Control', 'Alt', 'Shift', 'Meta', 'OS', 'AltGraph'];
      if (modifierKeys.includes(event.key)) return;

      const keyCombo = eventToKeyCombo(event);

      // Check if valid
      if (!isValidKeyCombo(keyCombo)) {
        setEditDialog(prev => ({
          ...prev,
          error: 'Invalid shortcut. Must include at least one modifier key (Ctrl, Alt, Shift, or Meta) and another key.',
        }));
        return;
      }

      // Check for conflicts
      const conflict = findConflictingShortcut(keyCombo, editDialog.shortcut?.id || '', allShortcuts);

      setEditDialog(prev => ({
        ...prev,
        currentKey: keyCombo,
        recording: false,
        error: null,
        conflict,
      }));
    };

    // Use capture phase so we run BEFORE useKeyboardShortcuts and browser defaults
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [editDialog.recording, editDialog.shortcut, allShortcuts]);

  // Save shortcut
  const handleSave = useCallback(() => {
    if (!editDialog.shortcut || !editDialog.currentKey) return;

    updateShortcut(editDialog.shortcut.id, editDialog.currentKey);
    setCustomShortcuts(getStoredShortcuts());
    setEditDialog({ open: false, shortcut: null, currentKey: '', recording: false, error: null, conflict: null });
  }, [editDialog]);

  // Reset single shortcut
  const handleReset = useCallback((shortcut: KeyboardShortcut) => {
    resetShortcut(shortcut.id);
    setCustomShortcuts(getStoredShortcuts());
  }, []);

  // Reset all shortcuts
  const handleResetAll = useCallback(() => {
    if (confirm('Are you sure you want to reset all keyboard shortcuts to their defaults?')) {
      resetAllShortcuts();
      setCustomShortcuts([]);
    }
  }, []);

  // Filter shortcuts
  const filteredShortcuts = allShortcuts.filter(s => {
    if (filter === 'all') return true;
    return s.category === filter;
  });

  // Group by category
  const categories = [
    { id: 'navigation', label: 'Navigation', icon: Keyboard },
    { id: 'actions', label: 'Actions', icon: Keyboard },
    { id: 'search', label: 'Search', icon: Keyboard },
    { id: 'general', label: 'General', icon: Keyboard },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Keyboard className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Keyboard Shortcuts</CardTitle>
                <CardDescription>
                  Customize keyboard shortcuts to navigate faster
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="shortcuts-enabled" className="text-sm font-medium">
                  Shortcuts Enabled
                </Label>
                <Switch
                  id="shortcuts-enabled"
                  checked={enabled}
                  onCheckedChange={handleToggleEnabled}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetAll}
                disabled={customShortcuts.length === 0}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Click on any shortcut to customize it. Press the key combination you want to use.
              {!enabled && ' Shortcuts are currently disabled.'}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Filter tabs */}
      <div className="flex gap-2">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          All ({allShortcuts.length})
        </Button>
        {categories.map(cat => {
          const count = allShortcuts.filter(s => s.category === cat.id).length;
          return (
            <Button
              key={cat.id}
              variant={filter === cat.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(cat.id)}
            >
              {cat.label} ({count})
            </Button>
          );
        })}
      </div>

      {/* Shortcuts list */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-2">
            {filteredShortcuts.map((shortcut) => {
              const configuredKey = getConfiguredKey(shortcut);
              const modified = isModified(shortcut);

              return (
                <div
                  key={shortcut.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors",
                    !enabled && "opacity-50"
                  )}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{shortcut.name}</h4>
                      {modified && (
                        <Badge variant="secondary" className="text-xs">
                          Modified
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {shortcut.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs px-3 py-1">
                      {formatKeyCombo(configuredKey)}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(shortcut)}
                      disabled={!enabled}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    {modified && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReset(shortcut)}
                        disabled={!enabled}
                        title="Reset to default"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialog.open} onOpenChange={(open) => !open && setEditDialog({ open: false, shortcut: null, currentKey: '', recording: false, error: null, conflict: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Keyboard Shortcut</DialogTitle>
            <DialogDescription>
              {editDialog.shortcut?.name} - {editDialog.shortcut?.description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Current Shortcut</Label>
              <div className="mt-2 p-4 border rounded-lg bg-muted font-mono text-center text-lg">
                {editDialog.recording ? (
                  <span className="text-muted-foreground animate-pulse">
                    Press keys...
                  </span>
                ) : (
                  formatKeyCombo(editDialog.currentKey)
                )}
              </div>
            </div>

            {editDialog.error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{editDialog.error}</AlertDescription>
              </Alert>
            )}

            {editDialog.conflict && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This shortcut is already used by <strong>{editDialog.conflict.name}</strong>
                </AlertDescription>
              </Alert>
            )}

            {!editDialog.recording && (
              <Button
                onClick={handleStartRecording}
                className="w-full"
                variant="outline"
              >
                <Keyboard className="h-4 w-4 mr-2" />
                Click to Record New Shortcut
              </Button>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialog({ open: false, shortcut: null, currentKey: '', recording: false, error: null, conflict: null })}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!editDialog.currentKey || !!editDialog.error || !!editDialog.conflict || editDialog.recording}
            >
              <Check className="h-4 w-4 mr-2" />
              Save Shortcut
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
