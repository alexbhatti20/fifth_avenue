"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  ChefHat,
  MapPin,
  Phone,
  Mail,
  CreditCard,
  Receipt,
  User,
  FileText,
  Loader2,
  RefreshCw,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect, useCallback } from "react";
import { generateOrderInvoicePDF } from "@/lib/order-invoice-pdf";

// ─── Animated red gradient text helpers ───────────────────────────────────────
const GRADIENT_LABEL =
  "bg-gradient-to-r from-red-600 via-rose-500 to-red-400 bg-clip-text text-transparent animate-gradient bg-[length:200%_auto] font-bold tracking-wider";

const CARD_TITLE_CLASS =
  "bg-gradient-to-r from-red-600 via-orange-500 to-red-500 bg-clip-text text-transparent animate-gradient bg-[length:200%_auto] font-extrabold tracking-widest uppercase text-lg";

const FIELD_LABEL_CLASS =
  "bg-gradient-to-r from-red-500 via-rose-400 to-orange-400 bg-clip-text text-transparent animate-gradient bg-[length:200%_auto] font-semibold tracking-widest text-xs uppercase";

interface OrderDetail {
  id: string;
  order_number: string;
  order_type: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  items: any[];
  subtotal: number;
  tax: number;
  delivery_fee: number;
  discount: number;
  total: number;
  payment_method: string;
  payment_status: string;
  status: string;
  notes: string;
  assigned_to_name: string;
  assigned_to_phone: string;
  waiter_name?: string | null;
  created_at: string;
  delivered_at: string;
  status_history: any[];
  transaction_id?: string;
  online_payment_method_id?: string;
  online_payment_details?: {
    method_name?: string;
    method_type?: string;
    account_title?: string;
    account_number?: string;
    [key: string]: any;
  };
}

const statusConfig: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  pending: {
    icon: Clock,
    color: "text-yellow-600",
    bg: "bg-yellow-50 border-yellow-200",
    label: "Pending",
  },
  confirmed: {
    icon: CheckCircle,
    color: "text-blue-600",
    bg: "bg-blue-50 border-blue-200",
    label: "Confirmed",
  },
  preparing: {
    icon: ChefHat,
    color: "text-orange-600",
    bg: "bg-orange-50 border-orange-200",
    label: "Preparing",
  },
  ready: {
    icon: Package,
    color: "text-purple-600",
    bg: "bg-purple-50 border-purple-200",
    label: "Ready",
  },
  delivering: {
    icon: Truck,
    color: "text-indigo-600",
    bg: "bg-indigo-50 border-indigo-200",
    label: "Out for Delivery",
  },
  delivered: {
    icon: CheckCircle,
    color: "text-green-600",
    bg: "bg-green-50 border-green-200",
    label: "Delivered",
  },
  cancelled: {
    icon: XCircle,
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
    label: "Cancelled",
  },
};

const paymentStatusConfig: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: "text-yellow-700", bg: "bg-yellow-100", label: "Pending" },
  pending_verification: { color: "text-orange-700", bg: "bg-orange-100", label: "Pending Verification" },
  paid: { color: "text-green-700", bg: "bg-green-100", label: "Paid" },
  failed: { color: "text-red-700", bg: "bg-red-100", label: "Failed" },
  refunded: { color: "text-gray-700", bg: "bg-gray-100", label: "Refunded" },
};

interface OrderDetailClientProps {
  initialOrder: OrderDetail | null;
}

export default function OrderDetailClient({ initialOrder }: OrderDetailClientProps) {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [order, setOrder] = useState<OrderDetail | null>(initialOrder);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Ensure client-side only rendering to prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setHasCheckedAuth(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (hasCheckedAuth && !authLoading && !user) {
      router.push("/auth");
    }
  }, [user, authLoading, router, hasCheckedAuth]);

  const downloadInvoice = async () => {
    if (!order) return;
    await generateOrderInvoicePDF({
      order_number: order.order_number,
      order_type: order.order_type,
      status: order.status,
      created_at: order.created_at,
      delivered_at: order.delivered_at ?? null,
      customer_name: order.customer_name ?? null,
      customer_email: order.customer_email ?? null,
      customer_phone: order.customer_phone ?? null,
      customer_address: order.customer_address ?? null,
      items: Array.isArray(order.items)
        ? order.items.map((i: any) => ({
            name: i.name || 'Item',
            quantity: i.quantity || 1,
            price: i.price ?? i.unit_price ?? 0,
            variant: i.variant,
          }))
        : [],
      subtotal: order.subtotal ?? order.total,
      tax: order.tax ?? 0,
      delivery_fee: order.delivery_fee ?? 0,
      discount: order.discount ?? 0,
      total: order.total,
      payment_method: order.payment_method ?? null,
      payment_status: order.payment_status ?? null,
      transaction_id: order.transaction_id ?? null,
      online_payment_details: order.online_payment_details ?? null,
      notes: order.notes ?? null,
      assigned_to_name: order.assigned_to_name ?? null,
      waiter_name: order.waiter_name ?? null,
    });
  };

  // Live polling — refresh order data every 30 s
  const refreshOrder = useCallback(async (silent = true) => {
    if (!initialOrder?.id) return;
    if (!silent) setIsRefreshing(true);
    try {
      const res = await fetch(`/api/customer/orders/${initialOrder.id}`, { cache: "no-store" });
      const json = await res.json();
      if (json.data) {
        setOrder(json.data);
        setLastUpdated(new Date());
      }
    } catch {
      // silently fail — show stale data
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  }, [initialOrder?.id]);

  useEffect(() => {
    const interval = setInterval(() => refreshOrder(true), 30_000);
    return () => clearInterval(interval);
  }, [refreshOrder]);

  const formatCurrency = (amount: number) => {
    return `Rs. ${amount?.toLocaleString() || 0}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Resolve item image from multiple possible field names
  const getItemImage = (item: any): string => {
    return (
      item.image_url ||
      (Array.isArray(item.images) ? item.images[0] : item.images) ||
      item.image ||
      item.thumbnail ||
      ""
    );
  };

  if (!mounted || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-yellow-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-red-500 mx-auto mb-4" />
          <p className={FIELD_LABEL_CLASS}>Loading order details…</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-yellow-50 flex items-center justify-center">
        <div className="text-center">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className={`text-2xl mb-2 ${GRADIENT_LABEL}`}>Order Not Found</h2>
          <p className="text-gray-600 mb-6">
            The order you&apos;re looking for doesn&apos;t exist or you don&apos;t have permission to view it.
          </p>
          <Button onClick={() => router.push("/orders")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Orders
          </Button>
        </div>
      </div>
    );
  }

  const statusInfo = statusConfig[order.status] || statusConfig.pending;
  const StatusIcon = statusInfo.icon;
  const paymentInfo = paymentStatusConfig[order.payment_status] || paymentStatusConfig.pending;

  // Build timeline — use status_history if available, otherwise synthesise from current status
  const timeline: { status: string; notes?: string; created_at: string }[] =
    order.status_history && order.status_history.length > 0
      ? order.status_history
      : [{ status: order.status, notes: "Order placed", created_at: order.created_at }];

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-yellow-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Button
            variant="ghost"
            onClick={() => router.push("/orders")}
            className="mb-4 hover:bg-orange-100"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Orders
          </Button>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-extrabold bg-gradient-to-r from-red-600 via-rose-500 to-orange-500 bg-clip-text text-transparent animate-gradient bg-[length:200%_auto] tracking-tight uppercase">
                Order Details
              </h1>
              <p className={`mt-2 text-base ${FIELD_LABEL_CLASS}`}>
                Order&nbsp;#{order.order_number}
              </p>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <Badge className={`${statusInfo.bg} ${statusInfo.color} border px-4 py-2`}>
                <StatusIcon className="w-4 h-4 mr-2" />
                {statusInfo.label}
              </Badge>
              <Badge className={`${paymentInfo.bg} ${paymentInfo.color} px-4 py-2`}>
                <CreditCard className="w-4 h-4 mr-2" />
                {paymentInfo.label}
              </Badge>
              <button
                onClick={() => refreshOrder(false)}
                disabled={isRefreshing}
                title="Refresh order"
                className="ml-1 p-2 rounded-full hover:bg-red-50 text-red-500 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Last updated: {lastUpdated.toLocaleTimeString()} · auto-refreshes every 30 s
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Items */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="border-2 shadow-lg">
                <CardHeader className="pb-4 border-b">
                  <CardTitle className="flex items-center gap-3">
                    <Package className="w-6 h-6 text-red-500 flex-shrink-0" />
                    <span className={CARD_TITLE_CLASS}>Order Items</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  {order.items?.map((item: any, index: number) => {
                    const imgSrc = getItemImage(item);
                    return (
                      <div key={index} className="flex gap-4 p-4 bg-gray-50 rounded-lg">
                        <div className="w-20 h-20 bg-white rounded-lg overflow-hidden shadow-sm flex-shrink-0 border border-gray-100">
                          {imgSrc ? (
                            <img
                              src={imgSrc}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.currentTarget as HTMLImageElement;
                                target.style.display = "none";
                                const parent = target.parentElement;
                                if (parent) {
                                  parent.innerHTML =
                                    '<div class="w-full h-full flex items-center justify-center bg-orange-50"><span class="text-2xl">🍗</span></div>';
                                }
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-orange-50">
                              <span className="text-2xl">🍗</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-grow">
                          <h4 className={`text-base mb-1 ${GRADIENT_LABEL}`}>{item.name}</h4>
                          <p className="text-sm text-gray-500 mt-1">
                            <span className={FIELD_LABEL_CLASS}>Qty:</span>{" "}
                            <span className="font-semibold text-gray-700">{item.quantity}</span>
                          </p>
                          <p className="text-sm text-gray-500">
                            <span className={FIELD_LABEL_CLASS}>Unit&nbsp;Price:</span>{" "}
                            <span className="font-semibold text-gray-700">{formatCurrency(item.price)}</span>
                          </p>
                          {item.size && (
                            <p className="text-sm text-gray-500">
                              <span className={FIELD_LABEL_CLASS}>Size:</span>{" "}
                              <span className="font-semibold text-gray-700 capitalize">{item.size}</span>
                            </p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-red-600 text-lg">
                            {formatCurrency(item.price * item.quantity)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </motion.div>

            {/* Order Timeline */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="border-2 shadow-lg">
                <CardHeader className="pb-4 border-b">
                  <CardTitle className="flex items-center gap-3">
                    <Clock className="w-6 h-6 text-red-500 flex-shrink-0" />
                    <span className={CARD_TITLE_CLASS}>Order Timeline</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-4">
                    {timeline.map((entry: any, index: number) => {
                      const entryStatus = statusConfig[entry.status] || statusConfig.pending;
                      const EntryIcon = entryStatus.icon;
                      const isLatest = index === timeline.length - 1;
                      return (
                        <div key={index} className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div
                              className={`w-10 h-10 rounded-full border-2 flex items-center justify-center ${
                                isLatest
                                  ? "bg-gradient-to-br from-red-100 to-orange-100 border-red-400 shadow-md"
                                  : entryStatus.bg
                              }`}
                            >
                              <EntryIcon
                                className={`w-5 h-5 ${isLatest ? "text-red-500" : entryStatus.color}`}
                              />
                            </div>
                            {index < timeline.length - 1 && (
                              <div className="w-0.5 h-12 bg-gradient-to-b from-red-200 to-gray-200 my-1" />
                            )}
                          </div>
                          <div className="flex-grow pb-8">
                            <p className={`text-base ${
                              isLatest ? GRADIENT_LABEL : "font-medium text-gray-700"
                            }`}>
                              {entryStatus.label}
                              {isLatest && (
                                <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold tracking-wide">
                                  CURRENT
                                </span>
                              )}
                            </p>
                            <p className={`text-sm mt-0.5 ${FIELD_LABEL_CLASS}`}>{formatDate(entry.created_at)}</p>
                            {entry.notes && (
                              <p className="text-sm text-gray-500 mt-1">{entry.notes}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Order Summary */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="border-2 shadow-lg">
                <CardHeader className="pb-4 border-b">
                  <CardTitle className="flex items-center gap-3">
                    <Receipt className="w-6 h-6 text-red-500 flex-shrink-0" />
                    <span className={CARD_TITLE_CLASS}>Order Summary</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  <div className="flex justify-between text-sm">
                    <span className={FIELD_LABEL_CLASS}>Subtotal</span>
                    <span className="font-semibold text-gray-800">{formatCurrency(order.subtotal)}</span>
                  </div>
                  {order.discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-xs font-semibold text-green-600 uppercase tracking-widest">Discount</span>
                      <span className="font-semibold text-green-600">-{formatCurrency(order.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className={FIELD_LABEL_CLASS}>Delivery Fee</span>
                    <span className="font-semibold text-gray-800">{formatCurrency(order.delivery_fee)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={FIELD_LABEL_CLASS}>Tax</span>
                    <span className="font-semibold text-gray-800">{formatCurrency(order.tax)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-base pt-1">
                    <span className={`text-base ${GRADIENT_LABEL}`}>Total</span>
                    <span className="font-bold text-red-600 text-lg">{formatCurrency(order.total)}</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Customer Info */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="border-2 shadow-lg">
                <CardHeader className="pb-4 border-b">
                  <CardTitle className="flex items-center gap-3">
                    <User className="w-6 h-6 text-red-500 flex-shrink-0" />
                    <span className={CARD_TITLE_CLASS}>Customer Info</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  <div className="flex items-start gap-3">
                    <User className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className={`mb-0.5 ${FIELD_LABEL_CLASS}`}>Name</p>
                      <p className="font-semibold text-gray-800">{order.customer_name}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className={`mb-0.5 ${FIELD_LABEL_CLASS}`}>Phone</p>
                      <p className="font-semibold text-gray-800">{order.customer_phone}</p>
                    </div>
                  </div>
                  {order.customer_email && (
                    <div className="flex items-start gap-3">
                      <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className={`mb-0.5 ${FIELD_LABEL_CLASS}`}>Email</p>
                        <p className="font-semibold text-gray-800">{order.customer_email}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className={`mb-0.5 ${FIELD_LABEL_CLASS}`}>Delivery Address</p>
                      <p className="font-semibold text-gray-800">{order.customer_address}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Payment Info */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="border-2 shadow-lg">
                <CardHeader className="pb-4 border-b">
                  <CardTitle className="flex items-center gap-3">
                    <CreditCard className="w-6 h-6 text-red-500 flex-shrink-0" />
                    <span className={CARD_TITLE_CLASS}>Payment Details</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  <div className="flex items-center justify-between">
                    <span className={FIELD_LABEL_CLASS}>Method</span>
                    <Badge variant="outline" className="capitalize font-semibold">
                      {order.payment_method?.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={FIELD_LABEL_CLASS}>Status</span>
                    <Badge className={`${paymentInfo.bg} ${paymentInfo.color} font-semibold`}>
                      {paymentInfo.label}
                    </Badge>
                  </div>
                  {order.payment_method === "cash" && order.payment_status === "pending" && (
                    <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-md px-3 py-2">
                      💵 Cash payment will be collected upon delivery / pickup.
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className={FIELD_LABEL_CLASS}>Order Date</span>
                    <span className="text-sm font-semibold text-gray-800">
                      {new Date(order.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  
                  {/* Online Payment Transaction Details */}
                  {(order.payment_method === "online" || order.transaction_id || order.online_payment_details) && (
                    <>
                      <Separator />
                      <div className="p-3 rounded-lg bg-purple-50 border border-purple-200 space-y-2">
                        <div className="flex items-center gap-2 text-purple-700 mb-2">
                          <Receipt className="w-4 h-4" />
                          <span className="font-semibold text-sm">Online Payment Details</span>
                        </div>
                        {order.transaction_id ? (
                          <div className="flex items-center justify-between">
                            <span className={`${FIELD_LABEL_CLASS} !text-purple-500`}>Transaction ID</span>
                            <span className="text-xs font-mono font-medium text-purple-800 bg-purple-100 px-2 py-0.5 rounded">
                              {order.transaction_id}
                            </span>
                          </div>
                        ) : (
                          <p className="text-xs text-purple-600 italic">No transaction ID recorded</p>
                        )}
                        {order.online_payment_details?.method_name && (
                          <div className="flex items-center justify-between">
                            <span className={`${FIELD_LABEL_CLASS} !text-purple-500`}>Payment Via</span>
                            <span className="text-xs font-semibold text-purple-800">
                              {order.online_payment_details.method_name}
                            </span>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Delivery Person (if assigned) */}
            {order.assigned_to_name && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Card className="border-2 shadow-lg bg-gradient-to-br from-orange-50 to-yellow-50">
                  <CardHeader className="pb-4 border-b">
                    <CardTitle className="flex items-center gap-3">
                      <Truck className="w-6 h-6 text-red-500 flex-shrink-0" />
                      <span className={CARD_TITLE_CLASS}>Delivery Person</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-4">
                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className={`mb-0.5 ${FIELD_LABEL_CLASS}`}>Name</p>
                        <p className="font-semibold text-gray-800">{order.assigned_to_name}</p>
                      </div>
                    </div>
                    {order.assigned_to_phone && (
                      <div className="flex items-center gap-3">
                        <Phone className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className={`mb-0.5 ${FIELD_LABEL_CLASS}`}>Contact</p>
                          <p className="font-semibold text-gray-800">{order.assigned_to_phone}</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Notes */}
            {order.notes && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Card className="border-2 shadow-lg">
                  <CardHeader className="pb-4 border-b">
                    <CardTitle className="flex items-center gap-3">
                      <FileText className="w-6 h-6 text-red-500 flex-shrink-0" />
                      <span className={CARD_TITLE_CLASS}>Order Notes</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <p className="text-gray-700 leading-relaxed">{order.notes}</p>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
              className="flex flex-col gap-3"
            >
              {order.order_type === 'online' && (
                <Button
                  className="w-full bg-gradient-to-r from-red-600 via-rose-500 to-orange-500 hover:from-red-700 hover:to-orange-600 font-bold tracking-wider uppercase text-white shadow-lg"
                  onClick={() => router.push(`/orders/track?id=${order.id}`)}
                >
                  <Truck className="w-4 h-4 mr-2" />
                  Track Order
                </Button>
              )}
              <Button
                variant="outline"
                className="w-full border-red-200 text-red-600 hover:bg-red-50 font-semibold tracking-wide"
                onClick={downloadInvoice}
              >
                <Download className="w-4 h-4 mr-2" />
                Download Invoice (PDF)
              </Button>
              <Button
                variant="outline"
                className="w-full border-red-200 text-red-600 hover:bg-red-50 font-semibold tracking-wide"
                onClick={() => refreshOrder(false)}
                disabled={isRefreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                Refresh Status
              </Button>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
