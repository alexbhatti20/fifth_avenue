'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Receipt,
  Search,
  Calendar,
  Filter,
  ChevronRight,
  User,
  Clock,
  CreditCard,
  Banknote,
  QrCode,
  Star,
  Printer,
  Eye,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { InvoicePrintView, CompactInvoiceCard } from './InvoicePrintView';
import type { InvoiceDetails } from './types';
// Server Actions for all database calls (hidden from Network tab)
import { getRecentInvoices, getInvoiceDetails, voidInvoice, markInvoicePrinted } from '@/lib/actions';

// ==========================================
// INVOICES LIST COMPONENT
// ==========================================

interface InvoicesListProps {
  className?: string;
  initialInvoices?: InvoiceDetails[];
}

export function InvoicesList({ className, initialInvoices }: InvoicesListProps) {
  const [invoices, setInvoices] = useState<InvoiceDetails[]>(initialInvoices || []);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('week');
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDetails | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isVoidDialogOpen, setIsVoidDialogOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);
  // SSR provides data for 'today' + 'all', so mark that as already fetched
  const fetchedFiltersRef = useRef<string | null>(
    initialInvoices !== undefined ? 'today|all' : null
  );

  const fetchInvoices = useCallback(async () => {
    setIsLoading(true);
    try {
      // Calculate date range based on filter
      let startDate = new Date();
      let endDate = new Date();
      
      switch (dateFilter) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'yesterday':
          startDate.setDate(startDate.getDate() - 1);
          startDate.setHours(0, 0, 0, 0);
          endDate.setDate(endDate.getDate() - 1);
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'week':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'all':
          startDate = new Date('2020-01-01');
          break;
      }

      // Server Action - hidden from Network tab
      const result = await getRecentInvoices(
        startDate.toISOString(),
        endDate.toISOString(),
        paymentFilter === 'all' ? undefined : paymentFilter,
        100
      );

      if (!result.success) throw new Error(result.error);
      setInvoices(result.data || []);
    } catch (error: any) {
      toast.error('Failed to load invoices');
    } finally {
      setIsLoading(false);
    }
  }, [dateFilter, paymentFilter]);

  // Only fetch when filter combination changes from what we have
  useEffect(() => {
    const currentKey = `${dateFilter}|${paymentFilter}`;
    
    // Skip if we already have data for this filter combination
    if (fetchedFiltersRef.current === currentKey) {
      return;
    }
    
    fetchedFiltersRef.current = currentKey;
    fetchInvoices();
  }, [dateFilter, paymentFilter, fetchInvoices]);

  const handleViewInvoice = async (invoice: InvoiceDetails) => {
    try {
      // Server Action - hidden from Network tab
      const result = await getInvoiceDetails(invoice.id);

      if (!result.success) throw new Error(result.error);
      
      const data = result.data;
      if (data?.success) {
        // Merge invoice with customer and order data from RPC response (include billed_by for invoice print)
        const invoiceWithDetails = {
          ...data.invoice,
          customer: data.customer,
          order: data.order,
          waiter: data.waiter,
          billed_by: data.billed_by,
        };
        setSelectedInvoice(invoiceWithDetails);
        setIsViewDialogOpen(true);
      } else {
        toast.error(data?.error || 'Failed to load invoice details');
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleVoidInvoice = async () => {
    if (!selectedInvoice || !voidReason.trim()) return;
    
    setIsVoiding(true);
    try {
      // Server Action - hidden from Network tab
      const result = await voidInvoice(selectedInvoice.id, voidReason);

      if (!result.success) throw new Error(result.error);
      
      const data = result.data;
      if (data?.success) {
        toast.success('Invoice voided successfully');
        setIsVoidDialogOpen(false);
        setIsViewDialogOpen(false);
        setVoidReason('');
        fetchInvoices();
      } else {
        toast.error(data?.error || 'Failed to void invoice');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsVoiding(false);
    }
  };

  const handleMarkPrinted = async (invoiceId: string) => {
    try {
      // Server Action - hidden from Network tab
      const result = await markInvoicePrinted(invoiceId);

      if (!result.success) throw new Error(result.error);
      
      const data = result.data;
      if (data?.success) {
        toast.success('Invoice marked as printed');
        fetchInvoices();
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // Filter invoices by search
  const filteredInvoices = invoices.filter((inv) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      inv.invoice_number?.toLowerCase().includes(query) ||
      inv.order?.order_number?.toLowerCase().includes(query) ||
      inv.customer?.name?.toLowerCase().includes(query) ||
      inv.customer?.phone?.includes(query)
    );
  });

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-PK', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('en-PK', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case 'cash':
        return <Banknote className="h-4 w-4 text-green-500" />;
      case 'card':
        return <CreditCard className="h-4 w-4 text-blue-500" />;
      case 'online':
        return <QrCode className="h-4 w-4 text-purple-500" />;
      default:
        return <CreditCard className="h-4 w-4" />;
    }
  };

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-red-500" />
            Generated Invoices
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchInvoices}
            disabled={isLoading}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by invoice, order, customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Select value={paymentFilter} onValueChange={setPaymentFilter}>
            <SelectTrigger className="w-[150px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Payments</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="card">Card</SelectItem>
              <SelectItem value="online">Online</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-red-500" />
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="text-center py-12">
            <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">No invoices found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {searchQuery
                ? 'Try adjusting your search or filters'
                : 'Generate invoices from pending orders'}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {filteredInvoices.map((invoice, index) => (
                  <motion.div
                    key={invoice.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <div
                      className={cn(
                        'p-4 rounded-lg border bg-white dark:bg-zinc-900 hover:shadow-md transition-all',
                        invoice.is_voided && 'opacity-60 bg-red-50 dark:bg-red-950/20'
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              'w-10 h-10 rounded-full flex items-center justify-center',
                              invoice.is_voided
                                ? 'bg-red-100 dark:bg-red-900/30'
                                : 'bg-green-100 dark:bg-green-900/30'
                            )}
                          >
                            {invoice.is_voided ? (
                              <XCircle className="h-5 w-5 text-red-500" />
                            ) : (
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold">{invoice.invoice_number}</p>
                              {invoice.is_voided && (
                                <Badge variant="destructive" className="text-xs">
                                  VOIDED
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Order #{invoice.order?.order_number}
                            </p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatDate(invoice.created_at)} at {formatTime(invoice.created_at)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className={cn(
                              'font-bold text-lg',
                              invoice.is_voided ? 'text-red-500 line-through' : 'text-green-600'
                            )}
                          >
                            Rs. {invoice.total.toLocaleString()}
                          </p>
                          <div className="flex items-center justify-end gap-1 mt-1">
                            {getPaymentIcon(invoice.payment_method)}
                            <span className="text-xs uppercase">
                              {invoice.payment_method}
                            </span>
                            {invoice.payment_method === 'online' && (
                              <Badge className="ml-1 bg-purple-500/10 text-purple-600 text-[10px] px-1.5 py-0.5">
                                🌐
                              </Badge>
                            )}
                          </div>
                          {/* Transaction ID for online payments */}
                          {(invoice.order?.transaction_id || (invoice as any).transaction_id) && (
                            <div className="mt-1 text-[10px] text-purple-600 flex items-center justify-end gap-1">
                              <span className="bg-green-500 text-white px-1 py-0.5 rounded text-[8px] font-bold">✓</span>
                              <span className="font-mono">TXN: {invoice.order?.transaction_id || (invoice as any).transaction_id}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Customer & Badges */}
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        {invoice.customer && (
                          <div className="flex items-center gap-1 text-sm">
                            {invoice.customer.is_registered ? (
                              <Star className="h-3 w-3 text-amber-500" />
                            ) : (
                              <User className="h-3 w-3 text-gray-400" />
                            )}
                            <span>{invoice.customer.name}</span>
                          </div>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {invoice.order?.order_type?.replace('_', ' ')}
                        </Badge>
                        {invoice.promo_code && (
                          <Badge className="bg-green-500 text-xs">
                            PROMO: {invoice.promo_code.code}
                          </Badge>
                        )}
                        {invoice.is_printed && (
                          <Badge variant="secondary" className="text-xs">
                            <Printer className="h-3 w-3 mr-1" />
                            Printed
                          </Badge>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="mt-3 flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewInvoice(invoice)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            handleViewInvoice(invoice);
                            handleMarkPrinted(invoice.id);
                          }}
                        >
                          <Printer className="h-4 w-4 mr-1" />
                          Print
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </ScrollArea>
        )}
      </CardContent>

      {/* View Invoice Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
            <DialogDescription>
              {selectedInvoice?.invoice_number}
            </DialogDescription>
          </DialogHeader>
          {selectedInvoice && (
            <InvoicePrintView
              invoice={selectedInvoice}
              onPrint={() => handleMarkPrinted(selectedInvoice.id)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Void Invoice Dialog */}
      <AlertDialog open={isVoidDialogOpen} onOpenChange={setIsVoidDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Void Invoice
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will void invoice {selectedInvoice?.invoice_number}. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label>Reason for voiding *</Label>
            <Textarea
              placeholder="Enter reason for voiding this invoice..."
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleVoidInvoice}
              disabled={isVoiding || !voidReason.trim()}
              className="bg-red-500 hover:bg-red-600"
            >
              {isVoiding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Voiding...
                </>
              ) : (
                'Void Invoice'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
