'use client';

import { useState, useCallback, useEffect } from 'react';
import { 
  Keyboard, 
  RotateCcw, 
  Power, 
  Edit3, 
  Check, 
  X,
  AlertCircle,
  Info,
  HelpCircle,
  Search
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  getStoredShortcuts,
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
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface EditDialogState {
  open: boolean;
  shortcut: KeyboardShortcut | null;
  currentKey: string;
  recording: boolean;
  error: string | null;
  conflict: KeyboardShortcut | null;
  previewKey: string; // Shows keys being pressed in real-time
}

export default function KeyboardShortcutsSettings() {
  const { shortcuts, enabled } = useKeyboardShortcuts();
  const [localEnabled, setLocalEnabled] = useState(enabled);
  const [customShortcuts, setCustomShortcuts] = useState<ShortcutConfig[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editDialog, setEditDialog] = useState<EditDialogState>({
    open: false,
    shortcut: null,
    currentKey: '',
    recording: false,
    error: null,
    conflict: null,
    previewKey: '',
  });
  const [filter, setFilter] = useState<string>('all');

  // Load settings
  useEffect(() => {
    setLocalEnabled(areShortcutsEnabled());
    setCustomShortcuts(getStoredShortcuts());
  }, []);

  // Update local enabled state when it changes
  useEffect(() => {
    setLocalEnabled(enabled);
  }, [enabled]);

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
    const newEnabled = !localEnabled;
    setShortcutsEnabled(newEnabled);
    setLocalEnabled(newEnabled);
    toast.success(newEnabled ? 'Keyboard shortcuts enabled' : 'Keyboard shortcuts disabled');
  }, [localEnabled]);

  // Open edit dialog
  const handleEdit = useCallback((shortcut: KeyboardShortcut) => {
    setEditDialog({
      open: true,
      shortcut,
      currentKey: getConfiguredKey(shortcut),
      recording: false,
      error: null,
      conflict: null,
      previewKey: '',
    });
  }, [getConfiguredKey]);

  // Start recording key combo
  const handleStartRecording = useCallback(() => {
    setEditDialog(prev => ({ ...prev, recording: true, error: null, conflict: null, previewKey: '' }));
  }, []);

  // Handle key press during recording
  useEffect(() => {
    if (!editDialog.recording) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
// Build preview of current key combo
      const parts: string[] = [];
      if (event.ctrlKey) parts.push('Ctrl');
      if (event.altKey) parts.push('Alt');
      if (event.shiftKey) parts.push('Shift');
      if (event.metaKey) parts.push('Meta');
      
      // Don't process modifier-only keys
      const modifierKeys = ['Control', 'Alt', 'Shift', 'Meta', 'OS'];
      if (modifierKeys.includes(event.key)) {
        // Just show the modifiers being pressed
        setEditDialog(prev => ({
          ...prev,
          previewKey: parts.join('+') || 'Press a key...',
        }));
        return;
      }

      // Add the actual key
      let key = event.key;
      if (key === ' ') key = 'Space';
      if (key.length === 1) key = key.toUpperCase();
      parts.push(key);
      
      const keyCombo = parts.join('+');

      // Check if valid
      if (!isValidKeyCombo(keyCombo)) {
        setEditDialog(prev => ({
          ...prev,
          previewKey: keyCombo,
          error: 'Invalid shortcut. Must include at least one modifier key (Ctrl, Alt, Shift, or Meta).',
        }));
        return;
      }

      // Check for conflicts
      const conflict = findConflictingShortcut(keyCombo, editDialog.shortcut?.id || '', shortcuts);

      setEditDialog(prev => ({
        ...prev,
        currentKey: keyCombo,
        previewKey: keyCombo,
        recording: false,
        error: null,
        conflict,
      }));
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editDialog.recording, editDialog.shortcut, shortcuts]);

  // Save shortcut
  const handleSave = useCallback(() => {
    if (!editDialog.shortcut || !editDialog.currentKey) return;

    updateShortcut(editDialog.shortcut.id, editDialog.currentKey);
    setCustomShortcuts(getStoredShortcuts());
    setEditDialog({ open: false, shortcut: null, currentKey: '', recording: false, error: null, conflict: null, previewKey: '' });
    toast.success(`Shortcut updated to ${formatKeyCombo(editDialog.currentKey)}`);
  }, [editDialog]);

  // Reset single shortcut
  const handleReset = useCallback((shortcut: KeyboardShortcut) => {
    resetShortcut(shortcut.id);
    setCustomShortcuts(getStoredShortcuts());
    toast.success('Shortcut reset to default');
  }, []);

  // Reset all shortcuts
  const handleResetAll = useCallback(() => {
    if (confirm('Are you sure you want to reset all keyboard shortcuts to their defaults?')) {
      resetAllShortcuts();
      setCustomShortcuts([]);
      toast.success('All shortcuts reset to defaults');
    }
  }, []);

  // Page display names (defined before usage)
  const pageNames: Record<string, string> = {
    '/portal': 'Dashboard',
    '/portal/orders': 'Orders',
    '/portal/billing': 'Billing',
    '/portal/menu': 'Menu',
    '/portal/kitchen': 'Kitchen',
    '/portal/inventory': 'Inventory',
    '/portal/tables': 'Tables',
    '/portal/employees': 'Employees',
    '/portal/customers': 'Customers',
    '/portal/delivery': 'Delivery',
    '/portal/attendance': 'Attendance',
    '/portal/payroll': 'Payroll',
    '/portal/reports': 'Reports',
    '/portal/perks': 'Perks/Loyalty',
    '/portal/reviews': 'Reviews',
    '/portal/messages': 'Messages',
    '/portal/backup': 'Backup',
    '/portal/notifications': 'Notifications',
    '/portal/settings': 'Settings',
  };

  // Filter shortcuts
  const filteredShortcuts = shortcuts.filter(s => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        s.name.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query) ||
        getConfiguredKey(s).toLowerCase().includes(query) ||
        (s.page && pageNames[s.page]?.toLowerCase().includes(query))
      );
    }
    return true;
  });

  // Group shortcuts by page for page-specific organization
  const pageGroups: Record<string, KeyboardShortcut[]> = {};
  const globalShortcuts: KeyboardShortcut[] = [];

  filteredShortcuts.forEach(shortcut => {
    if (shortcut.category === 'page-specific' && shortcut.page) {
      if (!pageGroups[shortcut.page]) {
        pageGroups[shortcut.page] = [];
      }
      pageGroups[shortcut.page].push(shortcut);
    } else if (shortcut.category === 'navigation' || shortcut.category === 'actions' || shortcut.category === 'search') {
      // Group global/navigation shortcuts by related page
      const id = shortcut.id;
      if (id === 'nav_dashboard' || id.startsWith('dashboard_')) {
        if (!pageGroups['/portal']) pageGroups['/portal'] = [];
        pageGroups['/portal'].push(shortcut);
      } else if (id.startsWith('nav_orders') || id.startsWith('orders_')) {
        if (!pageGroups['/portal/orders']) pageGroups['/portal/orders'] = [];
        pageGroups['/portal/orders'].push(shortcut);
      } else if (id.startsWith('nav_menu') || id.startsWith('menu_')) {
        if (!pageGroups['/portal/menu']) pageGroups['/portal/menu'] = [];
        pageGroups['/portal/menu'].push(shortcut);
      } else if (id.startsWith('nav_kitchen') || id.startsWith('kitchen_')) {
        if (!pageGroups['/portal/kitchen']) pageGroups['/portal/kitchen'] = [];
        pageGroups['/portal/kitchen'].push(shortcut);
      } else if (id.startsWith('nav_delivery') || id.startsWith('delivery_')) {
        if (!pageGroups['/portal/delivery']) pageGroups['/portal/delivery'] = [];
        pageGroups['/portal/delivery'].push(shortcut);
      } else if (id.startsWith('nav_billing') || id.startsWith('billing_')) {
        if (!pageGroups['/portal/billing']) pageGroups['/portal/billing'] = [];
        pageGroups['/portal/billing'].push(shortcut);
      } else if (id.startsWith('nav_inventory') || id.startsWith('inventory_')) {
        if (!pageGroups['/portal/inventory']) pageGroups['/portal/inventory'] = [];
        pageGroups['/portal/inventory'].push(shortcut);
      } else if (id.startsWith('nav_tables') || id.startsWith('tables_')) {
        if (!pageGroups['/portal/tables']) pageGroups['/portal/tables'] = [];
        pageGroups['/portal/tables'].push(shortcut);
      } else if (id.startsWith('nav_employees') || id.startsWith('employees_')) {
        if (!pageGroups['/portal/employees']) pageGroups['/portal/employees'] = [];
        pageGroups['/portal/employees'].push(shortcut);
      } else if (id.startsWith('nav_customers') || id.startsWith('customers_')) {
        if (!pageGroups['/portal/customers']) pageGroups['/portal/customers'] = [];
        pageGroups['/portal/customers'].push(shortcut);
      } else if (id.startsWith('nav_attendance') || id === 'nav_attendance') {
        if (!pageGroups['/portal/attendance']) pageGroups['/portal/attendance'] = [];
        pageGroups['/portal/attendance'].push(shortcut);
      } else if (id.startsWith('nav_payroll') || id === 'nav_payroll') {
        if (!pageGroups['/portal/payroll']) pageGroups['/portal/payroll'] = [];
        pageGroups['/portal/payroll'].push(shortcut);
      } else if (id.startsWith('nav_reports') || id === 'nav_reports') {
        if (!pageGroups['/portal/reports']) pageGroups['/portal/reports'] = [];
        pageGroups['/portal/reports'].push(shortcut);
      } else if (id.startsWith('nav_perks') || id === 'nav_perks') {
        if (!pageGroups['/portal/perks']) pageGroups['/portal/perks'] = [];
        pageGroups['/portal/perks'].push(shortcut);
      } else if (id.startsWith('nav_reviews') || id === 'nav_reviews') {
        if (!pageGroups['/portal/reviews']) pageGroups['/portal/reviews'] = [];
        pageGroups['/portal/reviews'].push(shortcut);
      } else if (id.startsWith('nav_messages') || id === 'nav_messages') {
        if (!pageGroups['/portal/messages']) pageGroups['/portal/messages'] = [];
        pageGroups['/portal/messages'].push(shortcut);
      } else if (id.startsWith('nav_backup') || id === 'nav_backup') {
        if (!pageGroups['/portal/backup']) pageGroups['/portal/backup'] = [];
        pageGroups['/portal/backup'].push(shortcut);
      } else if (id.startsWith('nav_notifications') || id === 'nav_notifications') {
        if (!pageGroups['/portal/notifications']) pageGroups['/portal/notifications'] = [];
        pageGroups['/portal/notifications'].push(shortcut);
      } else if (id.startsWith('nav_settings') || id === 'nav_settings') {
        if (!pageGroups['/portal/settings']) pageGroups['/portal/settings'] = [];
        pageGroups['/portal/settings'].push(shortcut);
      } else {
        globalShortcuts.push(shortcut);
      }
    } else {
      globalShortcuts.push(shortcut);
    }
  });

  // Sort pages alphabetically
  const sortedPages = Object.keys(pageGroups).sort((a, b) => {
    const nameA = pageNames[a] || a;
    const nameB = pageNames[b] || b;
    return nameA.localeCompare(nameB);
  });

  return (
    <>
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
                    checked={localEnabled}
                    onCheckedChange={handleToggleEnabled}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setHelpOpen(true)}
                >
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Help
                </Button>
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
                {!localEnabled && ' Shortcuts are currently disabled.'}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue={sortedPages[0] || 'global'} className="w-full">
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            {/* Search Bar */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search shortcuts by name, description, key, or page..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <TabsList className="flex flex-wrap h-auto justify-start gap-1 bg-transparent p-0">
            {globalShortcuts.length > 0 && (
              <TabsTrigger value="global" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Global ({globalShortcuts.length})
              </TabsTrigger>
            )}
            {sortedPages.map(page => (
              <TabsTrigger 
                key={page} 
                value={page}
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {pageNames[page] || page} ({pageGroups[page].length})
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Global Shortcuts Tab */}
          {globalShortcuts.length > 0 && (
            <TabsContent value="global">
              <Card>
                <CardHeader>
                  <CardTitle>Global Shortcuts</CardTitle>
                  <CardDescription>
                    These shortcuts work from anywhere in the application
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {globalShortcuts.map((shortcut) => {
                      const configuredKey = getConfiguredKey(shortcut);
                      const modified = isModified(shortcut);

                      return (
                        <div
                          key={shortcut.id}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors",
                            !localEnabled && "opacity-50"
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
                              <Badge variant="outline" className="text-xs">
                                {shortcut.category}
                              </Badge>
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
                              disabled={!localEnabled}
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            {modified && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleReset(shortcut)}
                                disabled={!localEnabled}
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
            </TabsContent>
          )}

          {/* Page-Specific Tabs */}
          {sortedPages.map(page => (
            <TabsContent key={page} value={page}>
              <Card>
                <CardHeader>
                  <CardTitle>{pageNames[page] || page} Shortcuts</CardTitle>
                  <CardDescription>
                    {pageGroups[page].length} shortcut{pageGroups[page].length !== 1 ? 's' : ''} for {pageNames[page] || page} page
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {pageGroups[page].map((shortcut) => {
                      const configuredKey = getConfiguredKey(shortcut);
                      const modified = isModified(shortcut);

                      return (
                        <div
                          key={shortcut.id}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors",
                            !localEnabled && "opacity-50"
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
                              {shortcut.category === 'navigation' && (
                                <Badge variant="outline" className="text-xs">
                                  Navigate
                                </Badge>
                              )}
                              {shortcut.category === 'actions' && (
                                <Badge variant="outline" className="text-xs">
                                  Action
                                </Badge>
                              )}
                              {shortcut.category === 'page-specific' && (
                                <Badge variant="outline" className="text-xs">
                                  Page Only
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
                              disabled={!localEnabled}
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            {modified && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleReset(shortcut)}
                                disabled={!localEnabled}
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
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialog.open} onOpenChange={(open) => !open && setEditDialog({ open: false, shortcut: null, currentKey: '', recording: false, error: null, conflict: null, previewKey: '' })}>
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
              <div className={cn(
                "mt-2 p-4 border-2 rounded-lg font-mono text-center text-lg transition-colors",
                editDialog.recording 
                  ? "bg-primary/10 border-primary animate-pulse" 
                  : "bg-muted border-border"
              )}>
                {editDialog.recording ? (
                  <span className="text-primary font-semibold">
                    {editDialog.previewKey || 'Press keys...'}
                  </span>
                ) : (
                  <span className="font-semibold">
                    {formatKeyCombo(editDialog.currentKey)}
                  </span>
                )}
              </div>
              {editDialog.recording && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Watching for key combination... Press Ctrl, Alt, Shift, or Meta + another key
                </p>
              )}
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
              onClick={() => setEditDialog({ open: false, shortcut: null, currentKey: '', recording: false, error: null, conflict: null, previewKey: '' })}
            >
              Cancel
            </Button>
            {editDialog.recording && (
              <Button
                variant="outline"
                onClick={() => setEditDialog(prev => ({ ...prev, recording: false, previewKey: '' }))}
              >
                <X className="h-4 w-4 mr-2" />
                Stop Recording
              </Button>
            )}
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

      {/* Help Dialog */}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Keyboard Shortcuts Help</DialogTitle>
            <DialogDescription>
              Learn how to use and customize keyboard shortcuts
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">How to Edit Shortcuts</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>Click the edit icon next to any shortcut</li>
                <li>Click "Record New Shortcut" button</li>
                <li>Press your desired key combination</li>
                <li>Click "Save Shortcut" to confirm</li>
              </ol>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Shortcut Requirements</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Must include at least one modifier (Ctrl, Alt, Shift, Meta)</li>
                <li>Avoid system shortcuts (e.g., Ctrl+W, Ctrl+T)</li>
                <li>Each shortcut must be unique</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Modifier Keys</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <code className="px-2 py-1 bg-muted rounded font-semibold">Ctrl</code>
                  <span className="text-muted-foreground">Control</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="px-2 py-1 bg-muted rounded font-semibold">Alt</code>
                  <span className="text-muted-foreground">Alternate</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="px-2 py-1 bg-muted rounded font-semibold">Shift</code>
                  <span className="text-muted-foreground">Shift</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="px-2 py-1 bg-muted rounded font-semibold">Meta</code>
                  <span className="text-muted-foreground">Windows/Cmd</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Tips</h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Use the toggle switch to temporarily disable all shortcuts</li>
                <li>Click the reset icon to restore a shortcut to its default</li>
                <li>Use "Reset All" to restore all shortcuts at once</li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
