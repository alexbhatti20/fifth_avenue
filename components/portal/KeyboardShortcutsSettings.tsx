'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Keyboard,
  RotateCcw,
  Edit3,
  Check,
  X,
  AlertCircle,
  Info,
  HelpCircle,
  Search,
  ChevronDown,
  ShieldCheck,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { usePortalAuthContext } from '@/components/portal/PortalProvider';
import { ROLE_DEFAULT_PERMISSIONS, ALL_PAGES, type PageKey } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface EditDialogState {
  open: boolean;
  shortcut: KeyboardShortcut | null;
  currentKey: string;
  recording: boolean;
  error: string | null;
  conflict: KeyboardShortcut | null;
  previewKey: string;
}

// Human-readable page names
const PAGE_NAMES: Record<string, string> = {
  global: 'Global',
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
  '/portal/perks': 'Perks / Loyalty',
  '/portal/reviews': 'Reviews',
  '/portal/messages': 'Messages',
  '/portal/backup': 'Backup',
  '/portal/notifications': 'Notifications',
  '/portal/settings': 'Settings',
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  manager: 'Manager',
  waiter: 'Waiter',
  cashier: 'Cashier',
  chef: 'Chef',
  delivery: 'Delivery',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  manager: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  waiter: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  cashier: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  chef: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  delivery: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

// Map shortcut id prefix â†’ canonical page path
function shortcutPageBucket(shortcut: KeyboardShortcut): string {
  const navMap: Record<string, string> = {
    'nav_dashboard': '/portal',
    'nav_orders': '/portal/orders',
    'nav_menu': '/portal/menu',
    'nav_kitchen': '/portal/kitchen',
    'nav_delivery': '/portal/delivery',
    'nav_tables': '/portal/tables',
    'nav_billing': '/portal/billing',
    'nav_inventory': '/portal/inventory',
    'nav_employees': '/portal/employees',
    'nav_attendance': '/portal/attendance',
    'nav_payroll': '/portal/payroll',
    'nav_reports': '/portal/reports',
    'nav_perks': '/portal/perks',
    'nav_reviews': '/portal/reviews',
    'nav_messages': '/portal/messages',
    'nav_backup': '/portal/backup',
    'nav_notifications': '/portal/notifications',
    'nav_settings': '/portal/settings',
    'nav_customers': '/portal/customers',
  };
  if (navMap[shortcut.id]) return navMap[shortcut.id];
  // page-specific shortcuts already carry their page
  if (shortcut.page) return shortcut.page;
  // prefix-based fallback
  for (const [prefix, path] of Object.entries(navMap)) {
    const base = shortcut.id.split('_').slice(0, 2).join('_');
    if (base === prefix || shortcut.id.startsWith(prefix.replace('nav_', '') + '_')) return path;
  }
  return 'global';
}

export default function KeyboardShortcutsSettings() {
  const { shortcuts, enabled } = useKeyboardShortcuts();
  const { role } = usePortalAuthContext();
  const [localEnabled, setLocalEnabled] = useState(enabled);
  const [customShortcuts, setCustomShortcuts] = useState<ShortcutConfig[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageFilter, setPageFilter] = useState<string>('all');
  const [editDialog, setEditDialog] = useState<EditDialogState>({
    open: false,
    shortcut: null,
    currentKey: '',
    recording: false,
    error: null,
    conflict: null,
    previewKey: '',
  });

  // â”€â”€ Role-based page access â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const accessiblePagePaths = useMemo(() => {
    if (!role || role === 'admin' || role === 'manager') return null; // null = no restriction
    const perms = ROLE_DEFAULT_PERMISSIONS[role];
    if (!perms) return new Set<string>();
    const paths = new Set<string>();
    (perms.pages as PageKey[]).forEach((pageKey) => {
      const page = ALL_PAGES[pageKey];
      if (page) paths.add(page.path);
    });
    paths.add('/portal/settings'); // always
    return paths;
  }, [role]);

  const isPageAccessible = useCallback(
    (pagePath: string) => {
      if (!accessiblePagePaths) return true; // admin/manager see all
      if (pagePath === 'global') return true;
      return accessiblePagePaths.has(pagePath);
    },
    [accessiblePagePaths]
  );

  // â”€â”€ Filter shortcuts to role-accessible pages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const roleFilteredShortcuts = useMemo(() => {
    return shortcuts.filter((s) => isPageAccessible(shortcutPageBucket(s)));
  }, [shortcuts, isPageAccessible]);

  // â”€â”€ Build the set of page buckets available after role filtering â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const availablePageBuckets = useMemo(() => {
    const buckets = new Set<string>();
    roleFilteredShortcuts.forEach((s) => buckets.add(shortcutPageBucket(s)));
    return Array.from(buckets).sort((a, b) => {
      if (a === 'global') return -1;
      if (b === 'global') return 1;
      return (PAGE_NAMES[a] || a).localeCompare(PAGE_NAMES[b] || b);
    });
  }, [roleFilteredShortcuts]);

  // â”€â”€ Combined filter: role + search + page dropdown â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const filteredShortcuts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return roleFilteredShortcuts.filter((s) => {
      const bucket = shortcutPageBucket(s);
      if (pageFilter !== 'all' && bucket !== pageFilter) return false;
      if (!q) return true;
      const key = customShortcuts.find((c) => c.id === s.id)?.key || s.defaultKey;
      return (
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        key.toLowerCase().includes(q) ||
        (PAGE_NAMES[bucket] || bucket).toLowerCase().includes(q)
      );
    });
  }, [roleFilteredShortcuts, pageFilter, searchQuery, customShortcuts]);

  // â”€â”€ Load from localStorage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    setLocalEnabled(areShortcutsEnabled());
    setCustomShortcuts(getStoredShortcuts());
  }, []);
  useEffect(() => setLocalEnabled(enabled), [enabled]);

  const getConfiguredKey = useCallback(
    (shortcut: KeyboardShortcut) =>
      customShortcuts.find((s) => s.id === shortcut.id)?.key || shortcut.defaultKey,
    [customShortcuts]
  );
  const isModified = useCallback(
    (shortcut: KeyboardShortcut) => customShortcuts.some((s) => s.id === shortcut.id),
    [customShortcuts]
  );

  // â”€â”€ Handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleToggleEnabled = useCallback(() => {
    const next = !localEnabled;
    setShortcutsEnabled(next);
    setLocalEnabled(next);
    toast.success(next ? 'Keyboard shortcuts enabled' : 'Keyboard shortcuts disabled');
  }, [localEnabled]);

  const handleEdit = useCallback(
    (shortcut: KeyboardShortcut) =>
      setEditDialog({ open: true, shortcut, currentKey: getConfiguredKey(shortcut), recording: false, error: null, conflict: null, previewKey: '' }),
    [getConfiguredKey]
  );

  const handleStartRecording = useCallback(
    () => setEditDialog((p) => ({ ...p, recording: true, error: null, conflict: null, previewKey: '' })),
    []
  );

  useEffect(() => {
    if (!editDialog.recording) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const parts: string[] = [];
      if (event.ctrlKey) parts.push('Ctrl');
      if (event.altKey) parts.push('Alt');
      if (event.shiftKey) parts.push('Shift');
      if (event.metaKey) parts.push('Meta');
      const modifierKeys = ['Control', 'Alt', 'Shift', 'Meta', 'OS', 'AltGraph'];
      if (modifierKeys.includes(event.key)) {
        setEditDialog((p) => ({ ...p, previewKey: parts.join('+') || 'Press a key...' }));
        return;
      }
      let key = event.key;
      if (key === ' ') key = 'Space';
      if (key.length === 1) key = key.toUpperCase();
      parts.push(key);
      const keyCombo = parts.join('+');
      if (!isValidKeyCombo(keyCombo)) {
        setEditDialog((p) => ({ ...p, previewKey: keyCombo, error: 'Must include at least one modifier key (Ctrl, Alt, Shift, or Meta).' }));
        return;
      }
      const conflict = findConflictingShortcut(keyCombo, editDialog.shortcut?.id || '', shortcuts);
      setEditDialog((p) => ({ ...p, currentKey: keyCombo, previewKey: keyCombo, recording: false, error: null, conflict }));
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [editDialog.recording, editDialog.shortcut, shortcuts]);

  const handleSave = useCallback(() => {
    if (!editDialog.shortcut || !editDialog.currentKey) return;
    updateShortcut(editDialog.shortcut.id, editDialog.currentKey);
    setCustomShortcuts(getStoredShortcuts());
    setEditDialog({ open: false, shortcut: null, currentKey: '', recording: false, error: null, conflict: null, previewKey: '' });
    toast.success(`Shortcut updated to ${formatKeyCombo(editDialog.currentKey)}`);
  }, [editDialog]);

  const handleReset = useCallback((shortcut: KeyboardShortcut) => {
    resetShortcut(shortcut.id);
    setCustomShortcuts(getStoredShortcuts());
    toast.success('Shortcut reset to default');
  }, []);

  const handleResetAll = useCallback(() => {
    if (confirm('Reset all keyboard shortcuts to their defaults?')) {
      resetAllShortcuts();
      setCustomShortcuts([]);
      toast.success('All shortcuts reset to defaults');
    }
  }, []);

  // â”€â”€ Shortcut row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function ShortcutRow({ shortcut }: { shortcut: KeyboardShortcut }) {
    const configuredKey = getConfiguredKey(shortcut);
    const modified = isModified(shortcut);
    const bucket = shortcutPageBucket(shortcut);
    const pageName = PAGE_NAMES[bucket] || bucket;

    return (
      <div
        className={cn(
          'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-xl border bg-card hover:bg-accent/40 transition-colors',
          !localEnabled && 'opacity-50'
        )}
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium text-sm">{shortcut.name}</span>
            {modified && <Badge variant="secondary" className="text-[10px]">Modified</Badge>}
            {pageFilter === 'all' && bucket !== 'global' && (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">{pageName}</Badge>
            )}
            <Badge variant="outline" className="text-[10px] capitalize">{shortcut.category}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{shortcut.description}</p>
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-2">
          <code className="font-mono text-xs px-2.5 py-1 rounded-md border bg-muted/60 whitespace-nowrap">
            {formatKeyCombo(configuredKey)}
          </code>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(shortcut)} disabled={!localEnabled} title="Edit shortcut">
            <Edit3 className="h-3.5 w-3.5" />
          </Button>
          {modified && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleReset(shortcut)} disabled={!localEnabled} title="Reset to default">
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  const selectedLabel = pageFilter === 'all' ? 'All Pages' : (PAGE_NAMES[pageFilter] || pageFilter);

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Keyboard className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Keyboard Shortcuts</CardTitle>
                  <CardDescription className="text-xs">Customize bindings â€” role-specific</CardDescription>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {role && (
                  <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold', ROLE_COLORS[role] || 'bg-zinc-100 text-zinc-600')}>
                    <ShieldCheck className="h-3 w-3" />
                    {ROLE_LABELS[role] || role}
                  </span>
                )}
                <div className="flex items-center gap-1.5">
                  <Switch id="shortcuts-enabled" checked={localEnabled} onCheckedChange={handleToggleEnabled} />
                  <Label htmlFor="shortcuts-enabled" className="text-xs cursor-pointer">Enabled</Label>
                </div>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setHelpOpen(true)}>
                  <HelpCircle className="h-3.5 w-3.5 mr-1" />Help
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleResetAll} disabled={customShortcuts.length === 0}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />Reset All
                </Button>
              </div>
            </div>
            {!localEnabled && (
              <Alert className="mt-3">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">Keyboard shortcuts are currently disabled globally.</AlertDescription>
              </Alert>
            )}
          </CardHeader>
        </Card>

        {/* Search + Page Dropdown */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, key, or pageâ€¦"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          {/* Page filter dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-9 gap-1.5 text-sm min-w-[140px] justify-between">
                <span className="truncate">{selectedLabel}</span>
                <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 max-h-72 overflow-y-auto">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Filter by Page</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className={cn('text-sm', pageFilter === 'all' && 'font-semibold bg-accent')}
                onClick={() => setPageFilter('all')}
              >
                All Pages
                <Badge variant="secondary" className="ml-auto text-[10px]">{roleFilteredShortcuts.length}</Badge>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {availablePageBuckets.map((bucket) => {
                const count = roleFilteredShortcuts.filter((s) => shortcutPageBucket(s) === bucket).length;
                return (
                  <DropdownMenuItem
                    key={bucket}
                    className={cn('text-sm', pageFilter === bucket && 'font-semibold bg-accent')}
                    onClick={() => setPageFilter(bucket)}
                  >
                    {PAGE_NAMES[bucket] || bucket}
                    <Badge variant="secondary" className="ml-auto text-[10px]">{count}</Badge>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Results info */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground px-0.5">
          <span>
            Showing <strong>{filteredShortcuts.length}</strong> of <strong>{roleFilteredShortcuts.length}</strong> shortcuts
            {accessiblePagePaths && ` Â· restricted to ${ROLE_LABELS[role!] || role} pages`}
          </span>
          {(searchQuery || pageFilter !== 'all') && (
            <button className="underline text-primary text-[11px]" onClick={() => { setSearchQuery(''); setPageFilter('all'); }}>
              Clear filters
            </button>
          )}
        </div>

        {/* Shortcuts list */}
        <Card>
          <CardContent className="pt-4">
            {filteredShortcuts.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No shortcuts found matching your search.
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredShortcuts.map((shortcut) => (
                  <ShortcutRow key={shortcut.id} shortcut={shortcut} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog
        open={editDialog.open}
        onOpenChange={(open) =>
          !open && setEditDialog({ open: false, shortcut: null, currentKey: '', recording: false, error: null, conflict: null, previewKey: '' })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Keyboard Shortcut</DialogTitle>
            <DialogDescription>{editDialog.shortcut?.name} â€” {editDialog.shortcut?.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Shortcut Key</Label>
              <div
                className={cn(
                  'mt-2 p-4 border-2 rounded-lg font-mono text-center text-lg transition-colors select-none',
                  editDialog.recording ? 'bg-primary/10 border-primary animate-pulse' : 'bg-muted border-border'
                )}
              >
                {editDialog.recording ? (
                  <span className="text-primary font-semibold">{editDialog.previewKey || 'Press keysâ€¦'}</span>
                ) : (
                  <span className="font-semibold">{formatKeyCombo(editDialog.currentKey)}</span>
                )}
              </div>
              {editDialog.recording && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Press Ctrl / Alt / Shift / Meta + another key
                </p>
              )}
            </div>
            {editDialog.error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">{editDialog.error}</AlertDescription>
              </Alert>
            )}
            {editDialog.conflict && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Already used by <strong>{editDialog.conflict.name}</strong>
                </AlertDescription>
              </Alert>
            )}
            {!editDialog.recording && (
              <Button onClick={handleStartRecording} className="w-full" variant="outline">
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
              <Button variant="outline" onClick={() => setEditDialog((p) => ({ ...p, recording: false, previewKey: '' }))}>
                <X className="h-4 w-4 mr-2" />Stop
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={!editDialog.currentKey || !!editDialog.error || !!editDialog.conflict || editDialog.recording}
            >
              <Check className="h-4 w-4 mr-2" />Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Help Dialog */}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Keyboard Shortcuts Help</DialogTitle>
            <DialogDescription>How to use and customize keyboard shortcuts</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-semibold mb-1.5">How to edit</h4>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Click the <Edit3 className="inline h-3 w-3" /> icon next to any shortcut</li>
                <li>Click "Record New Shortcut"</li>
                <li>Press your desired key combination</li>
                <li>Click Save</li>
              </ol>
            </div>
            <div>
              <h4 className="font-semibold mb-1.5">Requirements</h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Must include at least one modifier (Ctrl, Alt, Shift, Meta)</li>
                <li>Avoid browser defaults (Ctrl+W, Ctrl+T, etc.)</li>
                <li>Each shortcut must be unique</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-1.5">Role-based access</h4>
              <p className="text-muted-foreground text-xs">
                Only shortcuts for pages your role can access are shown and active. Admins and Managers see all shortcuts.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {['Ctrl', 'Alt', 'Shift', 'Meta'].map((k) => (
                <div key={k} className="flex items-center gap-2">
                  <code className="px-2 py-1 bg-muted rounded text-xs font-semibold">{k}</code>
                  <span className="text-muted-foreground text-xs">{k === 'Meta' ? 'Windows / Cmd' : k}</span>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

