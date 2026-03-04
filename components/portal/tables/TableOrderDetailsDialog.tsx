'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Receipt, User, Phone, Mail, ShoppingCart, Clock, X, RefreshCw,
  Send, Calculator, Tag, Package, ChevronRight, Star,
  AlertTriangle, Loader2, CheckCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getTableCurrentOrderAction, sendOrderToBillingAction, updatePendingInvoiceAction } from '@/lib/actions';
import type { TableOrderDetails } from '@/lib/actions';
import type { WaiterTable } from './types';

// ==========================================
// TABLE ORDER DETAILS DIALOG
// Shows full order breakdown for a table
// Auto-calculates bill total
// Option to send bill to billing counter
// ==========================================

interface TableOrderDetailsDialogProps {
  table: WaiterTable | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MEMBERSHIP_COLORS: Record<string, string> = {
  bronze: 'text-orange-700 bg-orange-100 border-orange-200',
  silver: 'text-slate-600 bg-slate-100 border-slate-200',
  gold: 'text-yellow-700 bg-yellow-100 border-yellow-200',
  platinum: 'text-purple-700 bg-purple-100 border-purple-200',
};

function formatDuration(createdAt: string): string {
  const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function TableOrderDetailsDialog({
  table,
  open,
  onOpenChange,
}: TableOrderDetailsDialogProps) {
  const [order, setOrder] = useState<TableOrderDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingBill, setIsSendingBill] = useState(false);
  const [isUpdatingBill, setIsUpdatingBill] = useState(false);
  const [billSentThisSession, setBillSentThisSession] = useState(false);
  const [billUpdatedThisSession, setBillUpdatedThisSession] = useState(false);

  const fetchOrderDetails = useCallback(async () => {
    if (!table?.id || !table.current_order) return;
    setIsLoading(true);
    try {
      const result = await getTableCurrentOrderAction(table.id);
      if (result.success && result.order) {
        setOrder(result.order);
      } else {
        toast.error(result.error || 'Failed to load order details');
      }
    } catch {
      toast.error('Failed to load order details');
    } finally {
      setIsLoading(false);
    }
  }, [table?.id, table?.current_order]);

  useEffect(() => {
    if (open && table) {
      fetchOrderDetails();
      setBillSentThisSession(false);
      setBillUpdatedThisSession(false);
    } else {
      setOrder(null);
    }
  }, [open, table, fetchOrderDetails]);

  const handleSendToBilling = async () => {
    if (!order?.order_id || isSendingBill) return;
    setIsSendingBill(true);
    try {
      const result = await sendOrderToBillingAction(order.order_id);
      if (result.success) {
        setBillSentThisSession(true);
        if (result.already_exists) {
          toast.info('Bill already in billing queue', {
            description: 'This order already has an active invoice.',
          });
        } else {
          toast.success('Bill sent to billing counter!', {
            description: 'The billing team will process the payment.',
          });
        }
      } else {
        toast.error(result.error || 'Failed to send to billing');
      }
    } catch {
      toast.error('Failed to send to billing');
    } finally {
      setIsSendingBill(false);
    }
  };

  const handleUpdateBill = async () => {
    if (!order?.order_id || isUpdatingBill) return;
    setIsUpdatingBill(true);
    try {
      const result = await updatePendingInvoiceAction(order.order_id);
      if (result.success) {
        setBillUpdatedThisSession(true);
        toast.success(`Invoice ${result.invoice_number} updated!`, {
          description: 'Billing counter will see the latest items and totals.',
        });
        // Refresh order details to show updated invoice state
        await fetchOrderDetails();
      } else {
        toast.error(result.error || 'Failed to update invoice');
      }
    } catch {
      toast.error('Failed to update invoice');
    } finally {
      setIsUpdatingBill(false);
    }
  };

  // Auto-calculate bill totals from items if server values are 0
  const computedSubtotal = order?.items?.reduce(
    (sum, item) => sum + item.total_price,
    0
  ) ?? 0;
  const subtotal = order?.subtotal || computedSubtotal;
  const taxAmount = order?.tax_amount || 0;
  const discountAmount = order?.discount_amount || 0;
  const grandTotal = order?.total || (subtotal + taxAmount - discountAmount);

  const hasOrder = !!table?.current_order;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto" side="right">
          <SheetHeader className="pb-4 border-b border-slate-200 dark:border-slate-700">
            <SheetTitle className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg flex-shrink-0">
                <Receipt className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="text-lg font-bold">Table {table?.table_number} — Order Details</div>
                {order && (
                  <div className="text-sm font-normal text-slate-500">
                    #{order.order_number} · Started {formatTime(order.created_at)}
                  </div>
                )}
              </div>
            </SheetTitle>
            <SheetDescription className="sr-only">
              Full order breakdown for Table {table?.table_number}
            </SheetDescription>
          </SheetHeader>

          <div className="py-4 space-y-5">
            {/* Loading State */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="h-8 w-8 border-2 border-violet-500 border-t-transparent rounded-full mb-3"
                />
                <p className="text-sm">Loading order details...</p>
              </div>
            )}

            {/* No Order State */}
            {!isLoading && !hasOrder && (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <ShoppingCart className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm font-medium">No active order on this table</p>
              </div>
            )}

            {/* Order Content */}
            {!isLoading && order && (
              <AnimatePresence>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-5"
                >
                  {/* Order Meta */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Duration</p>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-amber-500" />
                        <span className="font-bold text-slate-800 dark:text-slate-100">
                          {formatDuration(order.created_at)}
                        </span>
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Guests</p>
                      <div className="flex items-center gap-1.5">
                        <User className="h-4 w-4 text-blue-500" />
                        <span className="font-bold text-slate-800 dark:text-slate-100">
                          {order.customer_count} {order.customer_count === 1 ? 'person' : 'people'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Customer Info */}
                  {order.customer && (order.customer.name || order.customer.phone) && (
                    <div className="rounded-xl border border-blue-100 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-900/10 p-4 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                          <User className="h-4 w-4 text-blue-500" />
                          Customer
                        </h4>
                        {order.customer.membership_tier && (
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] capitalize',
                              MEMBERSHIP_COLORS[order.customer.membership_tier] || 'text-slate-600 bg-slate-100'
                            )}
                          >
                            <Star className="h-2.5 w-2.5 mr-1" />
                            {order.customer.membership_tier}
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        {order.customer.name && (
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                            {order.customer.name}
                          </p>
                        )}
                        {order.customer.phone && (
                          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                            <Phone className="h-3.5 w-3.5" />
                            {order.customer.phone}
                          </div>
                        )}
                        {order.customer.email && (
                          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                            <Mail className="h-3.5 w-3.5" />
                            {order.customer.email}
                          </div>
                        )}
                        {order.customer.loyalty_points !== undefined && order.customer.loyalty_points > 0 && (
                          <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 font-medium">
                            <Star className="h-3.5 w-3.5" />
                            {order.customer.loyalty_points.toLocaleString()} loyalty points
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Order Items */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                      <Package className="h-4 w-4 text-violet-500" />
                      Order Items
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                      </Badge>
                    </h4>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                      {order.items.map((item, idx) => (
                        <div
                          key={item.id}
                          className={cn(
                            'flex items-start gap-3 p-3',
                            idx < order.items.length - 1 && 'border-b border-slate-100 dark:border-slate-800'
                          )}
                        >
                          <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                            <span className="text-xs font-bold text-violet-600 dark:text-violet-400">
                              {item.quantity}×
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                              {item.name}
                            </p>
                            {item.size_variant && (
                              <p className="text-[11px] text-slate-500">{item.size_variant}</p>
                            )}
                            {item.notes && (
                              <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-0.5">
                                <Tag className="h-3 w-3" />
                                {item.notes}
                              </p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                              Rs. {item.total_price.toLocaleString()}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              @{item.unit_price.toLocaleString()} each
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  {order.notes && !order.notes.includes('[BILLING REQUESTED') && (
                    <div className="rounded-xl border border-amber-100 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-900/10 p-3">
                      <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                        <Tag className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                        {order.notes}
                      </p>
                    </div>
                  )}

                  {/* Bill Summary — Auto-Calculated */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 flex items-center gap-2">
                      <Calculator className="h-4 w-4 text-slate-500" />
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        Bill Summary
                      </span>
                    </div>
                    <div className="p-4 space-y-2.5">
                      <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                        <span>Subtotal ({order.items.length} items)</span>
                        <span className="font-medium">Rs. {subtotal.toLocaleString()}</span>
                      </div>
                      {taxAmount > 0 && (
                        <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                          <span>Tax / Service Charge</span>
                          <span className="font-medium">Rs. {taxAmount.toLocaleString()}</span>
                        </div>
                      )}
                      {discountAmount > 0 && (
                        <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400">
                          <span>Discount</span>
                          <span className="font-medium">−Rs. {discountAmount.toLocaleString()}</span>
                        </div>
                      )}
                      <Separator />
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-800 dark:text-slate-100 text-base">
                          Total
                        </span>
                        <span className="font-bold text-xl text-violet-600 dark:text-violet-400">
                          Rs. {grandTotal.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Billing Requested Badge */}
                  {order.notes?.includes('[BILLING REQUESTED') && (
                    <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3 flex items-center gap-2">
                      <Send className="h-4 w-4 text-green-600" />
                      <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                        Bill already sent to billing counter
                      </p>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </div>

          {/* Actions Footer */}
          {!isLoading && order && (() => {
            const invoiceStatus = order.invoice_payment_status ?? null;
            const isPaidOrClosed = ['paid', 'cancelled', 'refunded'].includes(invoiceStatus ?? '');
            const hasPendingInvoice = order.has_invoice && ['pending', 'draft'].includes(invoiceStatus ?? '') && !billSentThisSession;
            const hasNoInvoice = !order.has_invoice || billSentThisSession;

            return (
              <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4 space-y-2">

                {/* Paid / closed — show badge only */}
                {isPaidOrClosed && (
                  <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 h-11">
                    <CheckCheck className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                      {invoiceStatus === 'paid' ? 'Bill Paid' : invoiceStatus === 'cancelled' ? 'Invoice Cancelled' : 'Invoice Refunded'}
                    </span>
                  </div>
                )}

                {/* Pending invoice → Update Bill */}
                {hasPendingInvoice && (
                  <Button
                    className={`w-full h-11 shadow-md ${
                      billUpdatedThisSession
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white'
                    }`}
                    onClick={handleUpdateBill}
                    disabled={isUpdatingBill || billUpdatedThisSession}
                  >
                    {isUpdatingBill ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : billUpdatedThisSession ? (
                      <CheckCheck className="h-4 w-4 mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    {isUpdatingBill ? 'Updating Bill...' : billUpdatedThisSession ? 'Bill Updated' : 'Update Bill'}
                  </Button>
                )}

                {/* No invoice → Send to Billing */}
                {hasNoInvoice && !isPaidOrClosed && (
                  <Button
                    className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-md h-11"
                    onClick={handleSendToBilling}
                    disabled={isSendingBill}
                  >
                    {isSendingBill ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    {isSendingBill ? 'Sending...' : 'Send to Billing'}
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-slate-500 h-9"
                  onClick={fetchOrderDetails}
                  disabled={isLoading}
                >
                  <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', isLoading && 'animate-spin')} />
                  Refresh
                </Button>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>
    </>
  );
}
