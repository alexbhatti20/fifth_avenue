'use client';

import { useState, useEffect, useMemo, useCallback, startTransition } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Plus,
  Search,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Ban,
  Unlock,
  Shield,
  LayoutGrid,
  LayoutList,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
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
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SectionHeader, StatsCard } from '@/components/portal/PortalProvider';
import { 
  EmployeeCard,
  EmployeeRow, 
  DeleteEmployeeDialog,
  BlockUnblockDialog,
  ROLE_LABELS 
} from '@/components/portal/employees';
// NOTE: data is now fetched via the authenticated API route (/api/portal/employees)
// instead of the deprecated direct-RPC helper to avoid browser-side permission errors.
import { usePortalAuth } from '@/hooks/usePortal';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Employee, EmployeeStatus } from '@/types/portal';
import type { EmployeesPaginatedResponse } from '@/lib/server-queries';

// Loading Skeleton for Card View
function EmployeesCardSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {[...Array(8)].map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <div className="h-20 bg-gradient-to-br from-primary/20 to-orange-500/20" />
          <CardContent className="pt-0 -mt-8">
            <div className="flex flex-col items-center">
              <Skeleton className="h-16 w-16 rounded-full mb-3" />
              <Skeleton className="h-5 w-32 mb-2" />
              <Skeleton className="h-4 w-24 mb-3" />
              <div className="flex gap-2 mb-3">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="h-8 w-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Loading Skeleton for Table View
function EmployeesTableSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-[200px]" />
            <Skeleton className="h-3 w-[150px]" />
          </div>
          <Skeleton className="h-6 w-[80px]" />
          <Skeleton className="h-6 w-[60px]" />
        </div>
      ))}
    </div>
  );
}

// Props for SSR
interface EmployeesClientProps {
  initialData?: EmployeesPaginatedResponse;
}

// Main Employee Management Page
export default function EmployeesClient({ initialData }: EmployeesClientProps) {
  const router = useRouter();
  const { employee: currentEmployee, isLoading: authLoading } = usePortalAuth();
  
  // Data state - use SSR data if available
  const [employees, setEmployees] = useState<Employee[]>((initialData?.employees || []) as Employee[]);
  const [isLoading, setIsLoading] = useState(!initialData);
  
  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  // View mode: 'card' or 'row'
  const [viewMode, setViewMode] = useState<'card' | 'row'>('card');
  
  // Dialog states
  const [deleteDialogEmployee, setDeleteDialogEmployee] = useState<Employee | null>(null);
  const [blockDialogEmployee, setBlockDialogEmployee] = useState<Employee | null>(null);
  const [blockDialogMode, setBlockDialogMode] = useState<'block' | 'unblock'>('block');

  // Get current admin ID
  const currentAdminId = useMemo(() => {
    if (currentEmployee?.id) return currentEmployee.id;
    if (typeof window !== 'undefined') {
      const userData = localStorage.getItem('user_data');
      if (userData) {
        try {
          return JSON.parse(userData).id;
        } catch {}
      }
    }
    return undefined;
  }, [currentEmployee]);

  // Check if current user is admin
  const isAdmin = useMemo(() => {
    if (currentEmployee?.role === 'admin') return true;
    if (typeof window !== 'undefined') {
      const userType = localStorage.getItem('user_type');
      const userData = localStorage.getItem('user_data');
      if (userType === 'admin') return true;
      if (userData) {
        try {
          const parsed = JSON.parse(userData);
          return parsed.role === 'admin';
        } catch {}
      }
    }
    return false;
  }, [currentEmployee]);

  // Sync state whenever Next.js delivers a fresh RSC payload (after router.refresh())
  useEffect(() => {
    if (initialData?.employees) {
      setEmployees(initialData.employees as Employee[]);
      setIsLoading(false);
    }
  }, [initialData]);

  // Refresh: triggers SSR re-fetch on the server — response comes back as an opaque
  // RSC payload (the ?_rsc=… request) so NO plain JSON is visible in the Network tab.
  const fetchEmployees = useCallback(() => {
    setIsLoading(true);
    router.refresh();
    // Loading spinner is cleared by the initialData useEffect above when RSC arrives.
    // Safety fallback in case RSC update doesn't change initialData reference:
    const t = setTimeout(() => setIsLoading(false), 5000);
    return () => clearTimeout(t);
  }, [router]);

  // Initial auth guard (no data fetch needed — SSR already provides initialData)
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      toast.error('Access denied. Admin only area.');
      router.push('/portal');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAdmin]);

  // All filtering is done client-side from the full SSR dataset — no extra network calls.
  const filteredEmployees = useMemo(() => {
    let list = employees as Employee[];

    // Exclude current admin from the list
    if (currentAdminId) list = list.filter(emp => emp.id !== currentAdminId);

    // Search: name, email, employee_id
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(emp =>
        emp.name?.toLowerCase().includes(q) ||
        emp.email?.toLowerCase().includes(q) ||
        (emp as any).employee_id?.toLowerCase().includes(q)
      );
    }

    // Role filter
    if (roleFilter !== 'all') list = list.filter(emp => emp.role === roleFilter);

    // Status filter
    if (statusFilter !== 'all') list = list.filter(emp => emp.status === statusFilter);

    return list;
  }, [employees, currentAdminId, debouncedSearch, roleFilter, statusFilter]);

  // Stats from filtered employees (excluding current admin)
  const stats = useMemo(() => ({
    total: filteredEmployees.length,
    active: filteredEmployees.filter(e => e.status === 'active').length,
    pending: filteredEmployees.filter(e => e.status === 'pending').length,
    blocked: filteredEmployees.filter(e => !e.portal_enabled).length,
    portalEnabled: filteredEmployees.filter(e => e.portal_enabled).length,
  }), [filteredEmployees]);

  // Handlers
  const handleTogglePortal = useCallback((id: string, enabled: boolean) => {
    // Find the employee and show confirmation dialog
    const employee = employees.find(e => e.id === id);
    if (employee) {
      requestAnimationFrame(() => {
        setBlockDialogMode(enabled ? 'unblock' : 'block');
        setBlockDialogEmployee(employee);
      });
    }
  }, [employees]);

  const handleBlockUnblockSuccess = useCallback((updatedEmployee: Partial<Employee>) => {
    // Defer state update to avoid race condition with dialog closing
    requestAnimationFrame(() => {
      startTransition(() => {
        setEmployees((prev) => prev.map((emp) =>
          emp.id === updatedEmployee.id ? { ...emp, ...updatedEmployee } : emp
        ));
      });
    });
  }, []);

  const handleViewDetails = (employee: Employee) => {
    router.push(`/portal/employees/${employee.id}`);
  };

  const handleDelete = (employee: Employee) => {
    setDeleteDialogEmployee(employee);
  };

  const handleSuccess = () => {
    fetchEmployees();
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-xl bg-primary flex items-center justify-center mb-4 mx-auto animate-pulse">
            <span className="text-3xl font-bebas text-white">Z</span>
          </div>
          <p className="text-sm text-muted-foreground">Checking access...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Shield className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold">Admin Access Required</h2>
          <p className="text-muted-foreground mt-2">
            Only administrators can access employee management.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SectionHeader
        title="Employee Management"
        description="Manage your restaurant staff, roles, and portal access"
        action={
          <Button onClick={() => router.push('/portal/employees/add')} size="sm" className="w-full sm:w-auto">
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Add Employee</span>
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4 sm:grid-cols-3 lg:grid-cols-5 mb-4 sm:mb-6">
        <StatsCard
          title="Total Employees"
          value={stats.total}
          icon={<Users className="h-4 w-4 sm:h-5 sm:w-5" />}
        />
        <StatsCard
          title="Active"
          value={stats.active}
          change={`${Math.round((stats.active / stats.total) * 100) || 0}%`}
          changeType="positive"
          icon={<CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />}
        />
        <StatsCard
          title="Pending Activation"
          value={stats.pending}
          icon={<AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />}
        />
        <StatsCard
          title="Blocked"
          value={stats.blocked}
          changeType="negative"
          icon={<Ban className="h-4 w-4 sm:h-5 sm:w-5" />}
        />
        <StatsCard
          title="Portal Access"
          value={stats.portalEnabled}
          icon={<Unlock className="h-4 w-4 sm:h-5 sm:w-5" />}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-4 mb-4 sm:mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-9 sm:h-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[calc(50%-4px)] sm:w-32 h-9 sm:h-10 text-xs sm:text-sm">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {Object.entries(ROLE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[calc(50%-4px)] sm:w-32 h-9 sm:h-10 text-xs sm:text-sm">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex gap-2">
          {/* View Toggle */}
          <ToggleGroup 
            type="single" 
            value={viewMode} 
            onValueChange={(value) => value && setViewMode(value as 'card' | 'row')}
            className="border rounded-md"
          >
            <ToggleGroupItem value="card" aria-label="Card View" className="px-2 sm:px-3">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="row" aria-label="Row View" className="px-2 sm:px-3">
              <LayoutList className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
          
          <Button variant="outline" size="icon" onClick={fetchEmployees} disabled={isLoading}>
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        viewMode === 'card' ? <EmployeesCardSkeleton /> : (
          <Card>
            <CardContent className="p-0">
              <EmployeesTableSkeleton />
            </CardContent>
          </Card>
        )
      ) : filteredEmployees.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold">No employees found</h3>
              <p className="text-muted-foreground text-sm mt-1">
                {searchQuery || roleFilter !== 'all' || statusFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Add your first employee to get started'}
              </p>
              {!searchQuery && roleFilter === 'all' && statusFilter === 'all' && (
                <Button 
                  className="mt-4" 
                  onClick={() => router.push('/portal/employees/add')}
                >
                  <Plus className="h-4 w-4 mr-2" /> Add Employee
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : viewMode === 'card' ? (
        /* Card View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence>
            {filteredEmployees.map((employee, index) => (
              <motion.div
                key={employee.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.05 }}
              >
                <EmployeeCard
                  employee={employee}
                  onView={handleViewDetails}
                  onTogglePortal={handleTogglePortal}
                  onDelete={handleDelete}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        /* Row/Table View */
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Employee</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Portal</TableHead>
                  <TableHead>Hired</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence>
                  {filteredEmployees.map((employee) => (
                    <EmployeeRow
                      key={employee.id}
                      employee={employee}
                      onView={handleViewDetails}
                      onTogglePortal={handleTogglePortal}
                      onDelete={handleDelete}
                    />
                  ))}
                </AnimatePresence>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Delete Employee Dialog */}
      <DeleteEmployeeDialog
        employee={deleteDialogEmployee}
        open={!!deleteDialogEmployee}
        onOpenChange={(open) => !open && setDeleteDialogEmployee(null)}
        onSuccess={handleSuccess}
        adminId={currentAdminId}
      />

      {/* Block/Unblock Employee Dialog */}
      <BlockUnblockDialog
        employee={blockDialogEmployee}
        mode={blockDialogMode}
        open={!!blockDialogEmployee}
        onOpenChange={(open) => !open && requestAnimationFrame(() => setBlockDialogEmployee(null))}
        onSuccess={handleBlockUnblockSuccess}
      />
    </>
  );
}
