'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Receipt,
  Tag,
  CreditCard,
  Banknote,
  QrCode,
  Star,
  User,
  Phone,
  Mail,
  Crown,
  Percent,
  Gift,
  Calculator,
  Check,
  X,
  Loader2,
  Sparkles,
  AlertCircle,
  ArrowLeft,
  Printer,
  ChefHat,
  MapPin,
  ShoppingBag,
  Utensils,
  Truck,
  Store,
  Table,
  Plus,
  Minus,
  Trash2,
  Search,
  ChevronsUpDown,
  PackagePlus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { SectionHeader } from '@/components/portal/PortalProvider';
import {
  validatePromoCodeForBilling,
  generateFullBill,
  getInvoiceDetails,
  getTaxSettingsAction,
} from '@/lib/actions';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { usePortalAuth } from '@/hooks/usePortal';
import { InvoicePrintView } from '@/components/portal/billing';
import type { MenuDataForSSR } from '@/lib/server-queries';

// ─── Types ────────────────────────────────────────────────────────────────────

const ALLOWED_ROLES = ['admin', 'manager', 'billing_staff', 'reception'];

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  variant?: string;
  addons?: string[];
}

interface PromoValidation {
  valid: boolean;
  error?: string;
  promo?: {
    id: string;
    code: string;
    name: string;
    promo_type: string;
    value: number;
    discount_amount: number;
  };
  discount_amount?: number;
}

interface Props {
  orderId: string;
  initialOrderData: any | null;
  initialMenuData: MenuDataForSSR;
}

// ─── Quick-Add Combobox ───────────────────────────────────────────────────────

function QuickAddDropdown({
  menuData,
  onAdd,
  disabled,
}: {
  menuData: MenuDataForSSR;
  onAdd: (item: OrderItem) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredItems = useMemo(() => {
    const q = search.toLowerCase();
    const items = menuData.items.filter(
      (i: any) =>
        (i.is_available !== false) &&
        (i.name.toLowerCase().includes(q) ||
          (i.category_name || '').toLowerCase().includes(q))
    );
    const deals = menuData.deals.filter(
      (d: any) =>
        (d.is_active !== false) &&
        d.name.toLowerCase().includes(q)
    );
    return { items, deals };
  }, [search, menuData]);

  const handleSelectItem = useCallback(
    (item: any, isDeal: boolean) => {
      const price = isDeal
        ? (item.deal_price ?? item.discounted_price ?? item.original_price ?? 0)
        : (item.price ?? 0);
      const newItem: OrderItem = {
        name: isDeal ? `🎁 ${item.name}` : item.name,
        quantity: 1,
        price: Number(price),
      };
      onAdd(newItem);
      setOpen(false);
      setSearch('');
      toast.success(`Added: ${newItem.name}`);
    },
    [onAdd]
  );

  const hasResults =
    filteredItems.items.length > 0 || filteredItems.deals.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="gap-2 border-dashed border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
        >
          <PackagePlus className="h-4 w-4" />
          Quick Add Item
          <ChevronsUpDown className="h-3 w-3 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        {/* Search Input */}
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Search menu items & deals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto py-1">
          {!hasResults && (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              No items found.
            </p>
          )}

          {/* Menu Items */}
          {filteredItems.items.length > 0 && (
            <>
              <div className="px-3 py-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Menu Items
                </p>
              </div>
              {filteredItems.items.map((item: any) => (
                <button
                  key={item.id}
                  onClick={() => handleSelectItem(item, false)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{item.name}</span>
                    {item.category_name && (
                      <span className="text-xs text-muted-foreground">{item.category_name}</span>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-red-600 ml-2 shrink-0">
                    Rs. {Number(item.price).toLocaleString()}
                  </span>
                </button>
              ))}
            </>
          )}

          {/* Deals */}
          {filteredItems.deals.length > 0 && (
            <>
              <div className="px-3 py-1.5 mt-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Deals
                </p>
              </div>
              {filteredItems.deals.map((deal: any) => {
                const price = deal.deal_price ?? deal.discounted_price ?? deal.original_price ?? 0;
                return (
                  <button
                    key={deal.id}
                    onClick={() => handleSelectItem(deal, true)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <div className="flex flex-col items-start">
                      <span className="font-medium">🎁 {deal.name}</span>
                      {deal.original_price && deal.discounted_price && deal.original_price !== deal.discounted_price && (
                        <span className="text-xs text-muted-foreground line-through">
                          Rs. {Number(deal.original_price).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-green-600 ml-2 shrink-0">
                      Rs. {Number(price).toLocaleString()}
                    </span>
                  </button>
                );
              })}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Editable Item Row ────────────────────────────────────────────────────────

function EditableItemRow({
  item,
  index,
  onQtyChange,
  onDelete,
  disabled,
}: {
  item: OrderItem;
  index: number;
  onQtyChange: (index: number, qty: number) => void;
  onDelete: (index: number) => void;
  disabled: boolean;
}) {
  return (
    <motion.div
      key={index}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10, height: 0 }}
      transition={{ delay: index * 0.03 }}
      className="flex items-center gap-2 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900"
    >
      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{item.name}</p>
        {item.variant && (
          <p className="text-xs text-muted-foreground">Variant: {item.variant}</p>
        )}
        {item.addons && item.addons.length > 0 && (
          <p className="text-xs text-muted-foreground">+ {item.addons.join(', ')}</p>
        )}
        <p className="text-xs text-muted-foreground">@ Rs. {item.price.toLocaleString()} each</p>
      </div>

      {/* Qty controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          disabled={disabled || item.quantity <= 1}
          onClick={() => onQtyChange(index, item.quantity - 1)}
        >
          <Minus className="h-3 w-3" />
        </Button>
        <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          disabled={disabled}
          onClick={() => onQtyChange(index, item.quantity + 1)}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      {/* Line total */}
      <span className="text-sm font-semibold w-20 text-right">
        Rs. {(item.price * item.quantity).toLocaleString()}
      </span>

      {/* Delete */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
        disabled={disabled}
        onClick={() => onDelete(index)}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GenerateInvoiceClient({
  orderId,
  initialOrderData,
  initialMenuData,
}: Props) {
  const router = useRouter();
  const { employee, isLoading: isAuthLoading } = usePortalAuth();

  // Auth
  useEffect(() => {
    if (!isAuthLoading && employee) {
      const hasAccess = ALLOWED_ROLES.includes(employee.role || '');
      if (!hasAccess) {
        toast.error('Access denied. You do not have permission to access billing.');
        router.push('/portal/billing');
      }
    }
  }, [employee, isAuthLoading, router]);

  // Billing data comes from SSR — no client fetch needed
  const billingData = initialOrderData;

  // Editable items — initialised from order items
  const [editableItems, setEditableItems] = useState<OrderItem[]>(() =>
    billingData?.order?.items ? [...billingData.order.items] : []
  );

  // Track original subtotal for adjustment when calling generateFullBill
  const originalSubtotal: number = billingData?.order?.subtotal ?? 0;

  // Form state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [promoCode, setPromoCode] = useState('');
  const [promoValidation, setPromoValidation] = useState<PromoValidation | null>(null);
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);
  const [manualDiscount, setManualDiscount] = useState(0);
  const [serviceCharge, setServiceCharge] = useState(0);
  const [tip, setTip] = useState(0);
  const [loyaltyPointsToUse, setLoyaltyPointsToUse] = useState(0);
  const [notes, setNotes] = useState('');

  // Tax settings (fetched from system_settings)
  const [taxRate, setTaxRate] = useState<number>(0);
  const [taxEnabled, setTaxEnabled] = useState<boolean>(false);
  const [taxLabel, setTaxLabel] = useState<string>('GST');

  useEffect(() => {
    getTaxSettingsAction().then((r) => {
      if (r.success && r.settings) {
        setTaxRate(r.settings.rate);
        setTaxEnabled(r.settings.enabled);
        setTaxLabel(r.settings.label);
      }
    });
  }, []);

  // Generated invoice state
  const [generatedInvoice, setGeneratedInvoice] = useState<any>(null);
  const [showPrintView, setShowPrintView] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // ── Item manipulation ──────────────────────────────────────────────────────

  const handleAddItem = useCallback((item: OrderItem) => {
    setEditableItems((prev) => {
      // If item with same name already exists, increment qty
      const existing = prev.findIndex(
        (i) => i.name === item.name && i.price === item.price
      );
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = {
          ...updated[existing],
          quantity: updated[existing].quantity + 1,
        };
        return updated;
      }
      return [...prev, item];
    });
  }, []);

  const handleQtyChange = useCallback((index: number, qty: number) => {
    if (qty < 1) return;
    setEditableItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], quantity: qty };
      return updated;
    });
  }, []);

  const handleDeleteItem = useCallback((index: number) => {
    setEditableItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ── Totals ─────────────────────────────────────────────────────────────────

  // Live subtotal from editable items
  const subtotal = useMemo(
    () => editableItems.reduce((sum, i) => sum + i.price * i.quantity, 0),
    [editableItems]
  );

  const promoDiscount = promoValidation?.valid
    ? promoValidation.discount_amount || 0
    : 0;
  const pointsDiscount = loyaltyPointsToUse * 0.1;
  const totalDiscount = manualDiscount + promoDiscount + pointsDiscount;
  const taxableAmount = Math.max(0, subtotal - totalDiscount);
  const tax = taxEnabled ? Math.round(taxableAmount * (taxRate / 100) * 100) / 100 : 0;
  const deliveryFee = billingData?.order?.delivery_fee || 0;
  const finalTotal = taxableAmount + tax + serviceCharge + deliveryFee + tip;

  // ── Promo ──────────────────────────────────────────────────────────────────

  const validatePromoCode = async () => {
    if (!promoCode.trim() || !billingData?.order) return;
    setIsValidatingPromo(true);
    try {
      const result = await validatePromoCodeForBilling(
        promoCode.trim(),
        billingData?.customer?.id || undefined,
        subtotal
      );
      if (result.success) {
        setPromoValidation(result.data);
        if (result.data?.valid) {
          toast.success(`Promo applied! Rs. ${result.data.discount_amount} off`);
        } else {
          toast.error(result.data?.error || 'Invalid promo code');
        }
      } else {
        toast.error(result.error || 'Failed to validate promo code');
        setPromoValidation(null);
      }
    } catch (error: any) {
      toast.error(error.message);
      setPromoValidation(null);
    } finally {
      setIsValidatingPromo(false);
    }
  };

  const clearPromo = () => {
    setPromoCode('');
    setPromoValidation(null);
  };

  // ── Generate Invoice ───────────────────────────────────────────────────────

  const handleGenerateInvoice = async (withEmail: boolean = false) => {
    if (!billingData?.order) return;
    if (editableItems.length === 0) {
      toast.error('Cannot generate invoice with no items.');
      return;
    }

    setIsSubmitting(true);
    if (withEmail) setIsSendingEmail(true);

    try {
      // Compute item-level adjustment so DB invoice total matches local total
      // generate_advanced_invoice uses originalSubtotal from DB.
      // We compensate via manualDiscount:
      //   effectiveManualDiscount = userManualDiscount + (originalSubtotal - editedSubtotal)
      const itemAdjustment = originalSubtotal - subtotal;
      const effectiveManualDiscount = manualDiscount + itemAdjustment;

      const result = await generateFullBill({
        orderId,
        paymentMethod: paymentMethod as 'cash' | 'card' | 'online' | 'wallet',
        manualDiscount: effectiveManualDiscount,
        tip,
        serviceCharge,
        promoCode: promoValidation?.valid ? promoCode : undefined,
        loyaltyPointsUsed: loyaltyPointsToUse,
        notes: notes || undefined,
        billerId: employee?.id || undefined,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to generate invoice');
      }

      const data = result.data;

      if (data?.success) {
        toast.success(`Invoice #${data.invoice_number} generated!`);

        // Loyalty promo notification
        if (data?.reward_promo?.generated && data?.reward_promo?.code) {
          toast.success(`🎉 Customer awarded loyalty promo: ${data.reward_promo.code}`, {
            duration: 8000,
            description: billingData?.customer?.name
              ? `${billingData.customer.name} earned a reward for reaching loyalty milestone!`
              : 'Customer earned a reward for reaching loyalty milestone!',
          });
        }

        // Send invoice email
        if (withEmail && billingData?.customer?.email) {
          try {
            const token = localStorage.getItem('auth_token');
            const emailResponse = await fetch('/api/customer/invoice-email', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token && { Authorization: `Bearer ${token}` }),
              },
              body: JSON.stringify({
                customerEmail: billingData.customer.email,
                customerName: billingData.customer.name || 'Valued Customer',
                invoiceNumber: data.invoice_number,
                invoiceDate: new Date().toISOString(),
                orderType: billingData.order.order_type || 'dine-in',
                items: editableItems.map((item) => ({
                  name: item.name,
                  quantity: item.quantity,
                  price: item.price,
                  total: item.quantity * item.price,
                })),
                subtotal,
                discount: totalDiscount,
                tax,
                serviceCharge,
                deliveryFee,
                tip,
                total: finalTotal,
                paymentMethod,
                tableNumber: billingData.order.table_number || null,
                pointsEarned: data.points_earned || data.customer?.points_earned || 0,
                rewardPromoCode: data.reward_promo?.code || null,
              }),
            });

            if (emailResponse.ok) {
              const promoIncluded = data?.reward_promo?.code ? ' (includes reward promo!)' : '';
              toast.success(`Invoice sent to ${billingData.customer.email}!${promoIncluded}`);
            } else {
              toast.error('Invoice generated but email failed to send');
            }
          } catch {
            toast.error('Invoice generated but email failed to send');
          }
        }

        // Load invoice for print view
        const invoiceResult = await getInvoiceDetails(data.invoice_id);
        if (invoiceResult.success && invoiceResult.data?.success) {
          const invoiceWithDetails = {
            ...invoiceResult.data.invoice,
            customer: invoiceResult.data.customer,
            order: invoiceResult.data.order,
            waiter: invoiceResult.data.waiter,
            billed_by: invoiceResult.data.billed_by,
          };
          setGeneratedInvoice(invoiceWithDetails);
          setShowPrintView(true);
        } else {
          router.push('/portal/billing?tab=invoices');
        }
      } else {
        toast.error(data?.error || 'Failed to generate invoice');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
      setIsSendingEmail(false);
    }
  };

  // ── Guards ─────────────────────────────────────────────────────────────────

  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-red-500 mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (showPrintView && generatedInvoice) {
    return (
      <div className="space-y-6 pb-8">
        <div className="flex items-center justify-between">
          <SectionHeader
            title="Invoice Generated"
            description={`Invoice #${generatedInvoice.invoice_number} created successfully`}
          />
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push('/portal/billing')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Billing
            </Button>
            <Button onClick={() => window.print()} className="bg-red-500 hover:bg-red-600">
              <Printer className="h-4 w-4 mr-2" />
              Print Invoice
            </Button>
          </div>
        </div>
        <InvoicePrintView invoice={generatedInvoice} />
      </div>
    );
  }

  if (!billingData?.order) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Order Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The order you're looking for doesn't exist.
            </p>
            <Button onClick={() => router.push('/portal/billing')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Billing
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const order = billingData.order;
  const customer = billingData.customer;
  const table = billingData.table;
  const waiter = billingData.waiter;
  const brandInfo = billingData.brand_info;
  const maxLoyaltyPoints = customer?.loyalty_points || 0;
  const hasExistingInvoice = !!billingData.existing_invoice;

  const getOrderTypeIcon = (type: string) => {
    switch (type) {
      case 'dine-in':  return <Utensils className="h-4 w-4" />;
      case 'takeaway': return <ShoppingBag className="h-4 w-4" />;
      case 'delivery': return <Truck className="h-4 w-4" />;
      case 'walk-in':  return <Store className="h-4 w-4" />;
      default:         return <Receipt className="h-4 w-4" />;
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <SectionHeader
          title="Generate Invoice"
          description={`Order #${order.order_number} • ${customer?.name || 'Walk-in Customer'}`}
        />
        <Button variant="outline" onClick={() => router.push('/portal/billing')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Billing
        </Button>
      </div>

      {hasExistingInvoice && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800"
        >
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">
              This order already has an invoice: #{billingData.existing_invoice.invoice_number}
            </span>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left Column ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {getOrderTypeIcon(order.order_type)}
                Order Details
                <Badge variant="outline" className="ml-auto capitalize">
                  {order.order_type}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Order Meta */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Order #</span>
                  <p className="font-medium">{order.order_number}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <p className="font-medium capitalize">{order.status}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Created</span>
                  <p className="font-medium">{new Date(order.created_at).toLocaleString()}</p>
                </div>
                {table && (
                  <div>
                    <span className="text-muted-foreground">Table</span>
                    <p className="font-medium flex items-center gap-1">
                      <Table className="h-3 w-3" />
                      {table.table_number}
                    </p>
                  </div>
                )}
              </div>

              {waiter && (
                <div className="flex items-center gap-2 text-sm">
                  <ChefHat className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Served by:</span>
                  <span className="font-medium">{waiter.name}</span>
                </div>
              )}

              {/* Online Payment Info */}
              {((order as any).transaction_id || (order as any).online_payment_details) && (
                <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="bg-purple-500 text-white">🌐 Online Order</Badge>
                    <Badge className="bg-green-500 text-white">✓ Payment Verified</Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    {(order as any).transaction_id && (
                      <div>
                        <span className="text-purple-600 dark:text-purple-400">Transaction ID:</span>
                        <p className="font-mono font-bold">{(order as any).transaction_id}</p>
                      </div>
                    )}
                    {(order as any).online_payment_details?.method_name && (
                      <div>
                        <span className="text-purple-600 dark:text-purple-400">Payment Method:</span>
                        <p className="font-medium">{(order as any).online_payment_details.method_name}</p>
                      </div>
                    )}
                    {(order as any).online_payment_details?.account_holder_name && (
                      <div>
                        <span className="text-purple-600 dark:text-purple-400">Account Holder:</span>
                        <p className="font-medium">{(order as any).online_payment_details.account_holder_name}</p>
                      </div>
                    )}
                    {(order as any).online_payment_details?.account_number && (
                      <div>
                        <span className="text-purple-600 dark:text-purple-400">Account #:</span>
                        <p className="font-mono">{(order as any).online_payment_details.account_number}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <Separator />

              {/* ── Editable Item List ── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">
                    Items
                    <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                      ({editableItems.length})
                    </span>
                  </h4>
                  <QuickAddDropdown
                    menuData={initialMenuData}
                    onAdd={handleAddItem}
                    disabled={hasExistingInvoice || isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <AnimatePresence initial={false}>
                    {editableItems.map((item, index) => (
                      <EditableItemRow
                        key={`${item.name}-${index}`}
                        item={item}
                        index={index}
                        onQtyChange={handleQtyChange}
                        onDelete={handleDeleteItem}
                        disabled={hasExistingInvoice || isSubmitting}
                      />
                    ))}
                  </AnimatePresence>

                  {editableItems.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                      <ShoppingBag className="h-8 w-8 mb-2 opacity-40" />
                      <p className="text-sm">No items. Use Quick Add to add items.</p>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              <div className="flex justify-between text-lg font-semibold">
                <span>Subtotal</span>
                <motion.span
                  key={subtotal}
                  initial={{ scale: 1.05, color: '#ef4444' }}
                  animate={{ scale: 1, color: 'inherit' }}
                  transition={{ duration: 0.25 }}
                >
                  Rs. {subtotal.toLocaleString()}
                </motion.span>
              </div>
            </CardContent>
          </Card>

          {/* Customer Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={cn(
                  'p-4 rounded-lg',
                  customer?.id
                    ? 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800'
                    : 'bg-zinc-50 dark:bg-zinc-900'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-12 h-12 rounded-full flex items-center justify-center',
                        customer?.id
                          ? 'bg-amber-500 text-white'
                          : 'bg-zinc-300 dark:bg-zinc-700'
                      )}
                    >
                      {customer?.id ? (
                        <Crown className="h-6 w-6" />
                      ) : (
                        <User className="h-6 w-6" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-lg">
                        {customer?.name || 'Walk-in Customer'}
                      </p>
                      {customer?.phone && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {customer.phone}
                        </p>
                      )}
                      {customer?.email && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {customer.email}
                        </p>
                      )}
                      {customer?.address && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {customer.address}
                        </p>
                      )}
                    </div>
                  </div>
                  {customer?.id && (
                    <div className="text-right">
                      <Badge className="bg-amber-500">
                        <Star className="h-3 w-3 mr-1" />
                        {customer.loyalty_tier || 'Bronze'}
                      </Badge>
                      <p className="text-sm mt-2">
                        <span className="text-amber-600 font-bold text-lg">
                          {customer.loyalty_points || 0}
                        </span>
                        <span className="text-muted-foreground"> points</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Right Column ── */}
        <div className="space-y-6">
          {/* Billing Options */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Billing Options
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Promo Code */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Promo Code
                </Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter code"
                    value={promoCode}
                    onChange={(e) => {
                      setPromoCode(e.target.value.toUpperCase());
                      if (promoValidation) setPromoValidation(null);
                    }}
                    disabled={promoValidation?.valid || hasExistingInvoice}
                    className={cn(promoValidation?.valid && 'border-green-500 bg-green-50')}
                  />
                  {promoValidation?.valid ? (
                    <Button variant="outline" size="icon" onClick={clearPromo}>
                      <X className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={validatePromoCode}
                      disabled={!promoCode.trim() || isValidatingPromo || hasExistingInvoice}
                    >
                      {isValidatingPromo ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
                {promoValidation && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'p-2 rounded text-sm',
                      promoValidation.valid
                        ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
                        : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                    )}
                  >
                    {promoValidation.valid ? (
                      <span className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        {promoValidation.promo?.name}: Rs. {promoValidation.discount_amount} off!
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        {promoValidation.error}
                      </span>
                    )}
                  </motion.div>
                )}
              </div>

              {/* Loyalty Points */}
              {customer?.id && maxLoyaltyPoints > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-amber-500" />
                    Use Loyalty Points
                    <span className="text-xs text-muted-foreground">(10 pts = Rs. 1)</span>
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={maxLoyaltyPoints}
                      value={loyaltyPointsToUse}
                      onChange={(e) =>
                        setLoyaltyPointsToUse(
                          Math.min(Number(e.target.value) || 0, maxLoyaltyPoints)
                        )
                      }
                      disabled={hasExistingInvoice}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLoyaltyPointsToUse(maxLoyaltyPoints)}
                      disabled={hasExistingInvoice}
                    >
                      Max
                    </Button>
                  </div>
                  {loyaltyPointsToUse > 0 && (
                    <p className="text-sm text-green-600">
                      Discount: Rs. {pointsDiscount.toFixed(2)}
                    </p>
                  )}
                </div>
              )}

              {/* Manual Discount & Service Charge */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1 text-sm">
                    <Percent className="h-3 w-3" />
                    Discount
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={manualDiscount}
                    onChange={(e) => setManualDiscount(Number(e.target.value) || 0)}
                    disabled={hasExistingInvoice}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1 text-sm">
                    <Gift className="h-3 w-3" />
                    Service
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={serviceCharge}
                    onChange={(e) => setServiceCharge(Number(e.target.value) || 0)}
                    disabled={hasExistingInvoice}
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Tip */}
              <div className="space-y-2">
                <Label>Tip</Label>
                <div className="grid grid-cols-4 gap-2">
                  {[0, 50, 100, 200].map((amount) => (
                    <Button
                      key={amount}
                      variant={tip === amount ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTip(amount)}
                      disabled={hasExistingInvoice}
                      className={cn('text-xs', tip === amount && 'bg-red-500 hover:bg-red-600')}
                    >
                      {amount === 0 ? 'None' : `${amount}`}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select
                  value={paymentMethod}
                  onValueChange={setPaymentMethod}
                  disabled={hasExistingInvoice}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">
                      <span className="flex items-center gap-2">
                        <Banknote className="h-4 w-4" /> Cash
                      </span>
                    </SelectItem>
                    <SelectItem value="card">
                      <span className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" /> Card
                      </span>
                    </SelectItem>
                    <SelectItem value="online">
                      <span className="flex items-center gap-2">
                        <QrCode className="h-4 w-4" /> Online
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Optional notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={hasExistingInvoice}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* ── Bill Summary ── */}
          <Card className="border-red-200 dark:border-red-900">
            <CardHeader className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30">
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-red-500" />
                Bill Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <motion.span key={subtotal} initial={{ scale: 1.08 }} animate={{ scale: 1 }}>
                  Rs. {subtotal.toLocaleString()}
                </motion.span>
              </div>

              {totalDiscount > 0 && (
                <>
                  {manualDiscount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Manual Discount</span>
                      <span>- Rs. {manualDiscount.toLocaleString()}</span>
                    </div>
                  )}
                  {promoDiscount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Promo ({promoCode})</span>
                      <span>- Rs. {promoDiscount.toLocaleString()}</span>
                    </div>
                  )}
                  {pointsDiscount > 0 && (
                    <div className="flex justify-between text-sm text-amber-600">
                      <span>Loyalty Points</span>
                      <span>- Rs. {pointsDiscount.toFixed(2)}</span>
                    </div>
                  )}
                </>
              )}

              {taxEnabled && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{taxLabel} ({taxRate}%)</span>
                  <span>Rs. {tax.toLocaleString()}</span>
                </div>
              )}
              {serviceCharge > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Service Charge</span>
                  <span>Rs. {serviceCharge.toLocaleString()}</span>
                </div>
              )}
              {deliveryFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Delivery Fee</span>
                  <span>Rs. {deliveryFee.toLocaleString()}</span>
                </div>
              )}
              {tip > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tip</span>
                  <span>Rs. {tip.toLocaleString()}</span>
                </div>
              )}

              <Separator />

              <div className="flex justify-between text-xl font-bold">
                <span>Total</span>
                <motion.span
                  key={finalTotal}
                  initial={{ scale: 1.08, color: '#ef4444' }}
                  animate={{ scale: 1, color: '#dc2626' }}
                  transition={{ duration: 0.25 }}
                  className="text-red-600"
                >
                  Rs. {finalTotal.toLocaleString()}
                </motion.span>
              </div>

              {/* Generate buttons */}
              <div className="flex flex-col gap-2 mt-4">
                <Button
                  onClick={() => handleGenerateInvoice(false)}
                  disabled={isSubmitting || isSendingEmail || hasExistingInvoice}
                  variant="outline"
                  className="w-full h-12 text-lg border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                >
                  {isSubmitting && !isSendingEmail ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : hasExistingInvoice ? (
                    <>
                      <AlertCircle className="h-5 w-5 mr-2" />
                      Invoice Already Exists
                    </>
                  ) : (
                    <>
                      <Receipt className="h-5 w-5 mr-2" />
                      Generate Bill
                    </>
                  )}
                </Button>

                {billingData?.customer?.email && (
                  <Button
                    onClick={() => handleGenerateInvoice(true)}
                    disabled={isSubmitting || isSendingEmail || hasExistingInvoice}
                    className="w-full h-12 text-lg bg-red-500 hover:bg-red-600"
                  >
                    {isSubmitting || isSendingEmail ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        {isSendingEmail ? 'Sending Email...' : 'Generating...'}
                      </>
                    ) : hasExistingInvoice ? (
                      <>
                        <AlertCircle className="h-5 w-5 mr-2" />
                        Invoice Already Exists
                      </>
                    ) : (
                      <>
                        <Mail className="h-5 w-5 mr-2" />
                        Generate & Send Email
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Brand Info */}
          {brandInfo && (
            <Card className="bg-zinc-50 dark:bg-zinc-900">
              <CardContent className="pt-4 text-center text-sm text-muted-foreground">
                <p className="font-bold text-foreground">{brandInfo.name}</p>
                <p className="italic">{brandInfo.tagline}</p>
                <p className="mt-1">{brandInfo.phone}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
