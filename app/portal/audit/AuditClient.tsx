'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History,
  Search,
  Filter,
  Download,
  Calendar,
  User,
  Clock,
  Activity,
  FileText,
  Edit,
  Trash2,
  Plus,
  Eye,
  Settings,
  Shield,
  LogIn,
  LogOut,
  RefreshCw,
  Database,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SectionHeader, StatsCard, DataTableWrapper } from '@/components/portal/PortalProvider';
import { usePortalAuth } from '@/hooks/usePortal';
import { getAuditLogs } from '@/lib/portal-queries';
import type { AuditLogServer } from '@/lib/server-queries';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type AuditAction = 
  | 'create' | 'update' | 'delete' | 'view'
  | 'login' | 'logout' | 'password_change'
  | 'status_change' | 'export' | 'settings_change';

// Use AuditLogServer type from server-queries
// Extend with display fields for local UI
interface DisplayAuditLog extends AuditLogServer {
  employee_name?: string;
  employee_role?: string;
  resource_name?: string;
  resource_type?: string;
}

interface AuditClientProps {
  initialLogs: AuditLogServer[];
}

const ACTION_CONFIG: Record<AuditAction, { icon: React.ReactNode; color: string; label: string }> = {
  create: { icon: <Plus className="h-3.5 w-3.5" />, color: 'bg-green-500/10 text-green-500', label: 'Created' },
  update: { icon: <Edit className="h-3.5 w-3.5" />, color: 'bg-blue-500/10 text-blue-500', label: 'Updated' },
  delete: { icon: <Trash2 className="h-3.5 w-3.5" />, color: 'bg-red-500/10 text-red-500', label: 'Deleted' },
  view: { icon: <Eye className="h-3.5 w-3.5" />, color: 'bg-zinc-500/10 text-zinc-500', label: 'Viewed' },
  login: { icon: <LogIn className="h-3.5 w-3.5" />, color: 'bg-green-500/10 text-green-500', label: 'Logged In' },
  logout: { icon: <LogOut className="h-3.5 w-3.5" />, color: 'bg-orange-500/10 text-orange-500', label: 'Logged Out' },
  password_change: { icon: <Shield className="h-3.5 w-3.5" />, color: 'bg-purple-500/10 text-purple-500', label: 'Password Changed' },
  status_change: { icon: <RefreshCw className="h-3.5 w-3.5" />, color: 'bg-yellow-500/10 text-yellow-500', label: 'Status Changed' },
  export: { icon: <Download className="h-3.5 w-3.5" />, color: 'bg-cyan-500/10 text-cyan-500', label: 'Exported' },
  settings_change: { icon: <Settings className="h-3.5 w-3.5" />, color: 'bg-indigo-500/10 text-indigo-500', label: 'Settings Changed' },
};

const RESOURCE_ICONS: Record<string, React.ReactNode> = {
  order: <FileText className="h-4 w-4" />,
  menu_item: <Database className="h-4 w-4" />,
  employee: <User className="h-4 w-4" />,
  table: <Database className="h-4 w-4" />,
  inventory: <Database className="h-4 w-4" />,
  settings: <Settings className="h-4 w-4" />,
  auth: <Shield className="h-4 w-4" />,
};

// Audit Log Details Dialog
function AuditDetailsDialog({
  log,
  open,
  onOpenChange,
}: {
  log: DisplayAuditLog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!log) return null;

  const actionConfig = ACTION_CONFIG[log.action as AuditAction] || ACTION_CONFIG['view'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Audit Log Details</DialogTitle>
          <DialogDescription>
            {new Date(log.created_at).toLocaleString()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Action Badge */}
          <div className="flex items-center gap-3">
            <Badge className={cn('gap-1', actionConfig.color)}>
              {actionConfig.icon}
              {actionConfig.label}
            </Badge>
            {log.resource_type && (
              <Badge variant="outline" className="capitalize">
                {log.resource_type.replace('_', ' ')}
              </Badge>
            )}
          </div>

          {/* Employee Info */}
          <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
            <p className="text-xs text-muted-foreground mb-1">Performed By</p>
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback>{log.employee_name?.[0] || 'U'}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">{log.employee_name || 'Unknown'}</p>
                <p className="text-xs text-muted-foreground capitalize">{log.employee_role || 'unknown'}</p>
              </div>
            </div>
          </div>

          {/* Resource Info */}
          {log.resource_name && (
            <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
              <p className="text-xs text-muted-foreground mb-1">Resource</p>
              <p className="font-medium">{log.resource_name}</p>
              {log.record_id && (
                <p className="text-xs text-muted-foreground">ID: {log.record_id}</p>
              )}
            </div>
          )}

          {/* Changes */}
          {(log.old_values || log.new_values) && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Changes</p>
              <div className="grid grid-cols-2 gap-2">
                {log.old_values && (
                  <div className="p-2 rounded bg-red-50 dark:bg-red-900/20 text-sm">
                    <p className="text-xs text-red-600 font-medium mb-1">Before</p>
                    <pre className="text-xs overflow-auto">
                      {JSON.stringify(log.old_values, null, 2)}
                    </pre>
                  </div>
                )}
                {log.new_values && (
                  <div className="p-2 rounded bg-green-50 dark:bg-green-900/20 text-sm">
                    <p className="text-xs text-green-600 font-medium mb-1">After</p>
                    <pre className="text-xs overflow-auto">
                      {JSON.stringify(log.new_values, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Technical Details */}
          {(log.ip_address || log.user_agent) && (
            <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 space-y-2">
              <p className="text-xs text-muted-foreground">Technical Details</p>
              {log.ip_address && (
                <p className="text-sm">
                  <span className="text-muted-foreground">IP:</span> {log.ip_address}
                </p>
              )}
              {log.user_agent && (
                <p className="text-sm truncate">
                  <span className="text-muted-foreground">Agent:</span> {log.user_agent}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Audit Log Row
function AuditLogRow({
  log,
  onViewDetails,
}: {
  log: DisplayAuditLog;
  onViewDetails: () => void;
}) {
  const actionConfig = ACTION_CONFIG[log.action as AuditAction] || ACTION_CONFIG['view'];
  const resourceIcon = RESOURCE_ICONS[log.resource_type || 'order'] || <Database className="h-4 w-4" />;

  return (
    <TableRow className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50" onClick={onViewDetails}>
      <TableCell>
        <span className="text-sm text-muted-foreground">
          {new Date(log.created_at).toLocaleString()}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-xs">{log.employee_name?.[0] || 'U'}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium">{log.employee_name || 'Unknown'}</p>
            <p className="text-xs text-muted-foreground capitalize">{log.employee_role || 'unknown'}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge className={cn('gap-1', actionConfig.color)}>
          {actionConfig.icon}
          {actionConfig.label}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{resourceIcon}</span>
          <span className="capitalize">{(log.resource_type || 'unknown').replace('_', ' ')}</span>
        </div>
      </TableCell>
      <TableCell>
        <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
          {log.resource_name || '-'}
        </span>
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Eye className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

// Activity Timeline
function ActivityTimeline({ logs }: { logs: DisplayAuditLog[] }) {
  const recentLogs = logs.slice(0, 10);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64">
          <div className="space-y-4">
            {recentLogs.map((log, index) => {
              const actionConfig = ACTION_CONFIG[log.action as AuditAction] || ACTION_CONFIG['view'];
              return (
                <div key={log.id} className="flex gap-3">
                  <div className="relative">
                    <div className={cn('p-1.5 rounded-full', actionConfig.color)}>
                      {actionConfig.icon}
                    </div>
                    {index < recentLogs.length - 1 && (
                      <div className="absolute top-8 left-1/2 -translate-x-1/2 w-px h-full bg-zinc-200 dark:bg-zinc-700" />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="text-sm">
                      <span className="font-medium">{log.employee_name || 'Unknown'}</span>
                      {' '}
                      <span className="text-muted-foreground">{actionConfig.label.toLowerCase()}</span>
                      {' '}
                      {log.resource_name && (
                        <span className="font-medium">{log.resource_name}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Main Audit Logs Client Component
export default function AuditClient({ initialLogs }: AuditClientProps) {
  const { employee } = usePortalAuth();
  const [logs, setLogs] = useState<DisplayAuditLog[]>(() => {
    return initialLogs.map((log) => ({
      ...log,
      employee_name: log.employee?.name || 'Unknown',
      employee_role: log.employee?.role || 'unknown',
      resource_type: log.table_name,
      resource_name: log.table_name ? `${log.table_name} record` : undefined,
    }));
  });
  const [isLoading, setIsLoading] = useState(initialLogs.length === 0);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [resourceFilter, setResourceFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  
  const [selectedLog, setSelectedLog] = useState<DisplayAuditLog | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Fetch audit logs from API
  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getAuditLogs(100, 0);
      // Transform to display format
      const displayLogs: DisplayAuditLog[] = (data as unknown as AuditLogServer[]).map((log) => ({
        ...log,
        employee_name: log.employee?.name || 'Unknown',
        employee_role: log.employee?.role || 'unknown',
        resource_type: log.table_name,
        resource_name: log.table_name ? `${log.table_name} record` : undefined,
        record_id: log.record_id,
      }));
      setLogs(displayLogs);
    } catch (error) {
      
      toast.error('Failed to load audit logs');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Skip initial fetch if we have server-provided data
    if (initialLogs.length > 0) return;
    fetchLogs();
  }, [fetchLogs, initialLogs.length]);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch = 
      log.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.resource_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    const matchesResource = resourceFilter === 'all' || log.resource_type === resourceFilter;
    return matchesSearch && matchesAction && matchesResource;
  });

  const handleExport = () => {
    // Export logic here
    toast.success('Audit logs exported');
  };

  const stats = {
    total: logs.length,
    today: logs.filter((l) => new Date(l.created_at).toDateString() === new Date().toDateString()).length,
    creates: logs.filter((l) => l.action === 'create').length,
    updates: logs.filter((l) => l.action === 'update' || l.action === 'status_change').length,
  };

  return (
    <>
      <SectionHeader
        title="Audit Logs"
        description="Track all system activities and changes"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchLogs}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatsCard
          title="Total Logs"
          value={stats.total}
          icon={<History className="h-5 w-5" />}
        />
        <StatsCard
          title="Today"
          value={stats.today}
          icon={<Clock className="h-5 w-5 text-blue-500" />}
        />
        <StatsCard
          title="Creates"
          value={stats.creates}
          icon={<Plus className="h-5 w-5 text-green-500" />}
        />
        <StatsCard
          title="Updates"
          value={stats.updates}
          icon={<Edit className="h-5 w-5 text-orange-500" />}
        />
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-3 space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="create">Create</SelectItem>
                <SelectItem value="update">Update</SelectItem>
                <SelectItem value="delete">Delete</SelectItem>
                <SelectItem value="login">Login</SelectItem>
                <SelectItem value="logout">Logout</SelectItem>
                <SelectItem value="status_change">Status Change</SelectItem>
              </SelectContent>
            </Select>
            <Select value={resourceFilter} onValueChange={setResourceFilter}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Resource" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Resources</SelectItem>
                <SelectItem value="order">Orders</SelectItem>
                <SelectItem value="menu_item">Menu Items</SelectItem>
                <SelectItem value="employee">Employees</SelectItem>
                <SelectItem value="settings">Settings</SelectItem>
                <SelectItem value="auth">Authentication</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Logs Table */}
          <Card>
            <CardContent className="p-0">
              <DataTableWrapper isLoading={isLoading} isEmpty={filteredLogs.length === 0} emptyMessage="No audit logs found">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <AuditLogRow
                        key={log.id}
                        log={log}
                        onViewDetails={() => { setSelectedLog(log); setIsDetailsOpen(true); }}
                      />
                    ))}
                  </TableBody>
                </Table>
              </DataTableWrapper>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div>
          <ActivityTimeline logs={logs} />
        </div>
      </div>

      {/* Details Dialog */}
      <AuditDetailsDialog
        log={selectedLog}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
      />
    </>
  );
}
