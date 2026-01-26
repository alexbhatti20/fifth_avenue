'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Search,
  RefreshCw,
  Ban,
  UserCheck,
  Shield,
  ShoppingBag,
  Wallet,
  Star,
  Trophy,
  Calendar,
  Mail,
  Phone,
  MapPin,
  Eye,
  MoreVertical,
  ChevronRight,
  ChevronDown,
  X,
  TrendingUp,
  ArrowUpRight,
  FileText,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { SectionHeader, StatsCard } from '@/components/portal/PortalProvider';
import { supabase } from '@/lib/supabase';
import { usePortalAuth } from '@/hooks/usePortal';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { 
  CUSTOMER_BAN_REASONS, 
  CUSTOMER_UNBAN_REASONS
} from '@/lib/brevo';
import { format, formatDistanceToNow } from 'date-fns';

// Types
interface Customer {
  customer_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  is_verified: boolean;
  is_banned: boolean;
  ban_reason: string | null;
  banned_at: string | null;
  created_at: string;
  total_orders: number;
  total_spending: number;
  online_orders: number;
  dine_in_orders: number;
  takeaway_orders: number;
  last_order_date: string | null;
  loyalty_points: number;
  total_invoices: number;
  total_invoice_amount: number;
}

interface CustomerStats {
  total_customers: number;
  active_customers: number;
  banned_customers: number;
  verified_customers: number;
  customers_this_month: number;
  total_spending: number;
  average_order_value: number;
}

// Loading Skeletons
function CustomerCardSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-[200px]" />
                <Skeleton className="h-4 w-[150px]" />
              </div>
              <Skeleton className="h-6 w-[80px]" />
              <Skeleton className="h-6 w-[100px]" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Customer Row Component
function CustomerRow({ 
  customer, 
  onViewDetails, 
  onBan, 
  onUnban 
}: { 
  customer: Customer; 
  onViewDetails: () => void;
  onBan: () => void;
  onUnban: () => void;
}) {
  return (
    <>
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className={cn(
              "font-medium",
              customer.is_banned ? "bg-red-100 text-red-600" : "bg-primary/10 text-primary"
            )}>
              {customer.customer_name?.charAt(0)?.toUpperCase() || 'C'}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium flex items-center gap-2">
              {customer.customer_name}
              {customer.is_verified && (
                <Badge variant="secondary" className="h-5 px-1.5 text-xs bg-blue-100 text-blue-700">
                  Verified
                </Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground">{customer.customer_email}</div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="text-sm">{customer.customer_phone || '-'}</div>
      </TableCell>
      <TableCell>
        <Badge variant={customer.is_banned ? "destructive" : "secondary"} className="capitalize">
          {customer.is_banned ? (
            <><Ban className="h-3 w-3 mr-1" />Banned</>
          ) : (
            <><UserCheck className="h-3 w-3 mr-1" />Active</>
          )}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="text-sm font-medium">{customer.total_orders}</div>
        <div className="text-xs text-muted-foreground">
          Rs. {customer.total_spending?.toLocaleString() || 0}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Star className="h-4 w-4 text-amber-500" />
          <span className="font-medium">{customer.loyalty_points || 0}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="text-sm">
          {customer.last_order_date 
            ? formatDistanceToNow(new Date(customer.last_order_date), { addSuffix: true })
            : 'Never'}
        </div>
      </TableCell>
      <TableCell>
        <div className="text-sm text-muted-foreground">
          {format(new Date(customer.created_at), 'MMM d, yyyy')}
        </div>
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onViewDetails()}>
              <Eye className="h-4 w-4 mr-2" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {customer.is_banned ? (
              <DropdownMenuItem onSelect={() => onUnban()} className="text-green-600">
                <UserCheck className="h-4 w-4 mr-2" />
                Unban Customer
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => onBan()} className="text-red-600">
                <Ban className="h-4 w-4 mr-2" />
                Ban Customer
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </>
  );
}

// Inline Ban/Unban Section Component (replaces dialog)
function BanUnbanSection({
  customer,
  mode,
  onSuccess,
  onCancel,
  adminId,
}: {
  customer: Customer;
  mode: 'ban' | 'unban';
  onSuccess: () => void;
  onCancel: () => void;
  adminId?: string;
}) {
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reasons = mode === 'ban' ? CUSTOMER_BAN_REASONS : CUSTOMER_UNBAN_REASONS;
  const finalReason = reason === 'custom' ? customReason : reason;

  const handleSubmit = async () => {
    if (!customer || !adminId || isSubmitting) return;
    if (mode === 'ban' && !finalReason) {
      toast.error('Please select or enter a reason');
      return;
    }

    setIsSubmitting(true);

    try {
      const rpcName = mode === 'ban' ? 'ban_customer' : 'unban_customer';
      const rpcParams = mode === 'ban' 
        ? { p_customer_id: customer.customer_id, p_reason: finalReason, p_banned_by: adminId }
        : { p_customer_id: customer.customer_id, p_unbanned_by: adminId };

      const { data, error } = await supabase.rpc(rpcName, rpcParams);

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || `Failed to ${mode} customer`);

      // Send email in background (fire and forget)
      if (sendEmail && customer.customer_email) {
        fetch('/api/customer/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: mode,
            email: customer.customer_email,
            name: customer.customer_name,
            reason: finalReason || undefined,
          }),
        }).catch(() => {});
      }

      toast.success(`${customer.customer_name} has been ${mode === 'ban' ? 'banned' : 'unbanned'}`);
      onSuccess();
      
    } catch (error: any) {
      
      toast.error(error.message || `Failed to ${mode} customer`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <TableRow className={cn(
      "bg-muted/30",
      mode === 'ban' ? "border-l-4 border-l-red-500" : "border-l-4 border-l-green-500"
    )}>
      <TableCell colSpan={8}>
        <div className="py-4 px-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {mode === 'ban' ? (
                <Ban className="h-5 w-5 text-red-600" />
              ) : (
                <UserCheck className="h-5 w-5 text-green-600" />
              )}
              <span className={cn(
                "font-semibold",
                mode === 'ban' ? "text-red-600" : "text-green-600"
              )}>
                {mode === 'ban' ? 'Ban' : 'Unban'} {customer.customer_name}
              </span>
            </div>
            <Button variant="ghost" size="icon" onClick={onCancel} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Reason Selection */}
            <div className="space-y-2">
              <Label>Reason {mode === 'ban' && <span className="text-red-500">*</span>}</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={5}>
                  {reasons.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                  <SelectItem value="custom">Custom reason...</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Reason */}
            {reason === 'custom' && (
              <div className="space-y-2">
                <Label>Custom Reason</Label>
                <Input
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder={`Enter ${mode} reason...`}
                />
              </div>
            )}

            {/* Send Email Option */}
            <div className="flex items-center space-x-2">
              <Checkbox 
                id={`send-email-${customer.customer_id}`}
                checked={sendEmail} 
                onCheckedChange={(checked) => setSendEmail(checked === true)}
              />
              <label htmlFor={`send-email-${customer.customer_id}`} className="text-sm cursor-pointer">
                Send notification email
              </label>
            </div>
          </div>

          {mode === 'ban' && customer.total_orders > 0 && (
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-400">
                <strong>Note:</strong> This customer has {customer.total_orders} orders and Rs. {customer.total_spending?.toLocaleString()} in total spending.
              </p>
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={onCancel} 
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              size="sm"
              onClick={handleSubmit}
              disabled={isSubmitting || (mode === 'ban' && !finalReason)}
              variant={mode === 'ban' ? 'destructive' : 'default'}
              className={mode === 'unban' ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              {isSubmitting ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : mode === 'ban' ? (
                <Ban className="h-4 w-4 mr-2" />
              ) : (
                <UserCheck className="h-4 w-4 mr-2" />
              )}
              {mode === 'ban' ? 'Confirm Ban' : 'Confirm Unban'}
            </Button>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

// Customer Detail Dialog
function CustomerDetailDialog({
  open,
  onOpenChange,
  customerId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string | null;
}) {
  const [customer, setCustomer] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function fetchCustomerDetail() {
      if (!customerId) return;
      setIsLoading(true);

      try {
        const { data, error } = await supabase.rpc('get_customer_detail_admin', {
          p_customer_id: customerId,
        });

        if (error) throw error;
        setCustomer(data?.[0] || null);
      } catch (error) {
        
        toast.error('Failed to load customer details');
      } finally {
        setIsLoading(false);
      }
    }
    
    if (open && customerId) {
      fetchCustomerDetail();
    } else if (!open) {
      // Reset when closing
      setCustomer(null);
    }
  }, [open, customerId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Customer Details</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : customer && (
          <div className="space-y-6">
            {/* Customer Header */}
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className={cn(
                  "text-2xl",
                  customer.is_banned ? "bg-red-100 text-red-600" : "bg-primary/10 text-primary"
                )}>
                  {customer.customer_name?.charAt(0)?.toUpperCase() || 'C'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  {customer.customer_name}
                  {customer.is_verified && (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700">Verified</Badge>
                  )}
                  {customer.is_banned && (
                    <Badge variant="destructive">Banned</Badge>
                  )}
                </h3>
                <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    {customer.customer_email}
                  </span>
                  {customer.customer_phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-4 w-4" />
                      {customer.customer_phone}
                    </span>
                  )}
                </div>
                {customer.customer_address && (
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {customer.customer_address}
                  </p>
                )}
              </div>
            </div>

            {/* Ban Info */}
            {customer.is_banned && (
              <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
                <h4 className="font-medium text-red-700 dark:text-red-400 mb-2">Ban Information</h4>
                <p className="text-sm text-red-600 dark:text-red-300">{customer.ban_reason}</p>
                {customer.banned_at && (
                  <p className="text-xs text-red-500 mt-2">
                    Banned on {format(new Date(customer.banned_at), 'PPpp')}
                    {customer.banned_by_name && ` by ${customer.banned_by_name}`}
                  </p>
                )}
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <ShoppingBag className="h-4 w-4" />
                    <span className="text-xs">Total Orders</span>
                  </div>
                  <p className="text-2xl font-bold">{customer.total_orders}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Wallet className="h-4 w-4" />
                    <span className="text-xs">Total Spent</span>
                  </div>
                  <p className="text-2xl font-bold">Rs. {customer.total_spending?.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Star className="h-4 w-4 text-amber-500" />
                    <span className="text-xs">Loyalty Points</span>
                  </div>
                  <p className="text-2xl font-bold">{customer.loyalty_points || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <FileText className="h-4 w-4" />
                    <span className="text-xs">Total Invoices</span>
                  </div>
                  <p className="text-2xl font-bold">{customer.total_invoices}</p>
                </CardContent>
              </Card>
            </div>

            {/* Order Breakdown */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Order Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">{customer.online_orders}</p>
                    <p className="text-xs text-muted-foreground">Online Orders</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{customer.dine_in_orders}</p>
                    <p className="text-xs text-muted-foreground">Dine-In</p>
                  </div>
                  <div className="text-center p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
                    <p className="text-2xl font-bold text-orange-600">{customer.takeaway_orders}</p>
                    <p className="text-xs text-muted-foreground">Takeaway</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Orders */}
            {customer.recent_orders && customer.recent_orders.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Recent Orders</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {customer.recent_orders.map((order: any) => (
                      <div key={order.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <div>
                          <p className="font-medium text-sm">#{order.order_number}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(order.created_at), 'MMM d, yyyy')} • {order.order_type}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">Rs. {order.total?.toLocaleString()}</p>
                          <Badge variant="outline" className="text-xs">{order.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Member Info */}
            <div className="text-sm text-muted-foreground pt-2 border-t">
              Customer since {format(new Date(customer.created_at), 'MMMM d, yyyy')}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Main Customer Management Page
export default function CustomersPage() {
  const router = useRouter();
  const { employee: currentEmployee, role } = usePortalAuth();
  
  // Data state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  // Inline ban/unban state
  const [expandedBanCustomerId, setExpandedBanCustomerId] = useState<string | null>(null);
  const [banMode, setBanMode] = useState<'ban' | 'unban'>('ban');
  
  // Dialog states
  const [detailDialogCustomerId, setDetailDialogCustomerId] = useState<string | null>(null);

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

  // Check authorization
  const isAuthorized = role === 'admin' || role === 'manager';

  // Fetch customers function (not memoized to avoid dependency issues)
  const fetchCustomers = async (search?: string, filter?: string) => {
    if (!isAuthorized) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_all_customers_admin', {
        p_limit: 100,
        p_offset: 0,
        p_search: search || null,
        p_filter: filter || 'all',
      });

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      
      toast.error('Failed to load customers');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch stats function
  const fetchStats = async () => {
    if (!isAuthorized) return;
    
    try {
      const { data, error } = await supabase.rpc('get_customers_stats');
      if (error) throw error;
      setStats(data?.[0] || null);
    } catch (error) {
      
    }
  };

  // Load data on mount and when filters change
  useEffect(() => {
    if (isAuthorized) {
      fetchCustomers(debouncedSearch, statusFilter);
      fetchStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, statusFilter, isAuthorized]);

  // Handle ban/unban - expand inline section
  const handleBan = (customer: Customer) => {
    setExpandedBanCustomerId(customer.customer_id);
    setBanMode('ban');
  };

  const handleUnban = (customer: Customer) => {
    setExpandedBanCustomerId(customer.customer_id);
    setBanMode('unban');
  };

  const handleBanUnbanSuccess = () => {
    setExpandedBanCustomerId(null);
    // Refresh data
    fetchCustomers(debouncedSearch, statusFilter);
    fetchStats();
  };

  const handleBanUnbanCancel = () => {
    setExpandedBanCustomerId(null);
  };

  // Unauthorized view
  if (!isAuthorized && !isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Access Restricted</h3>
            <p className="text-muted-foreground">
              Only administrators and managers can access customer management.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
        {/* Header */}
        <SectionHeader
          title="Customer Management"
          description="View and manage all registered customers"
        />

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <StatsCard
              title="Total Customers"
              value={stats.total_customers.toString()}
              icon={<Users className="h-4 w-4 sm:h-5 sm:w-5" />}
              change={stats.customers_this_month > 0 ? `+${stats.customers_this_month} this month` : undefined}
              changeType="positive"
            />
            <StatsCard
              title="Active"
              value={stats.active_customers.toString()}
              icon={<UserCheck className="h-4 w-4 sm:h-5 sm:w-5" />}
              className="bg-green-50 dark:bg-green-950/30 border-green-200"
            />
            <StatsCard
              title="Banned"
              value={stats.banned_customers.toString()}
              icon={<Ban className="h-4 w-4 sm:h-5 sm:w-5" />}
              className="bg-red-50 dark:bg-red-950/30 border-red-200"
            />
            <StatsCard
              title="Verified"
              value={stats.verified_customers.toString()}
              icon={<Shield className="h-4 w-4 sm:h-5 sm:w-5" />}
              className="bg-blue-50 dark:bg-blue-950/30 border-blue-200"
            />
            <StatsCard
              title="Total Spending"
              value={`Rs. ${(stats.total_spending / 1000).toFixed(0)}K`}
              icon={<Wallet className="h-4 w-4 sm:h-5 sm:w-5" />}
            />
            <StatsCard
              title="Avg Order"
              value={`Rs. ${stats.average_order_value?.toFixed(0) || 0}`}
              icon={<TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />}
            />
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="banned">Banned Only</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => { fetchCustomers(); fetchStats(); }}>
                <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Customers Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <CustomerCardSkeleton />
            ) : customers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-1">No Customers Found</h3>
                <p className="text-muted-foreground text-sm">
                  {debouncedSearch 
                    ? 'Try adjusting your search query'
                    : 'No customers have registered yet'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Points</TableHead>
                    <TableHead>Last Order</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                    {customers.map((customer) => (
                      <Fragment key={customer.customer_id}>
                        <TableRow className="group">
                          <CustomerRow
                            customer={customer}
                            onViewDetails={() => setDetailDialogCustomerId(customer.customer_id)}
                            onBan={() => handleBan(customer)}
                            onUnban={() => handleUnban(customer)}
                          />
                        </TableRow>
                        {expandedBanCustomerId === customer.customer_id && (
                          <BanUnbanSection
                            customer={customer}
                            mode={banMode}
                            onSuccess={handleBanUnbanSuccess}
                            onCancel={handleBanUnbanCancel}
                            adminId={currentAdminId}
                          />
                        )}
                      </Fragment>
                    ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Dialogs */}
        <CustomerDetailDialog
          open={!!detailDialogCustomerId}
          onOpenChange={(open) => !open && setDetailDialogCustomerId(null)}
          customerId={detailDialogCustomerId}
        />
    </div>
  );
}
