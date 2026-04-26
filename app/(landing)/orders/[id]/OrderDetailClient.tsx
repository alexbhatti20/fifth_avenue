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

const CARD_TITLE_CLASS = "font-bebas text-3xl tracking-widest uppercase text-black";
const FIELD_LABEL_CLASS = "font-bebas tracking-[0.2em] text-[10px] uppercase text-black/50";

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
    color: "text-black",
    bg: "bg-[#FFD200]/40 border-black/20",
    label: "PENDING",
  },
  confirmed: {
    icon: CheckCircle,
    color: "text-[#FFD200]",
    bg: "bg-black border-black",
    label: "CONFIRMED",
  },
  preparing: {
    icon: ChefHat,
    color: "text-black",
    bg: "bg-[#F28C00]/35 border-[#F28C00]/40",
    label: "PREPARING",
  },
  ready: {
    icon: Package,
    color: "text-black",
    bg: "bg-[#FFD200]/35 border-black/20",
    label: "READY",
  },
  delivering: {
    icon: Truck,
    color: "text-white",
    bg: "bg-[#1E1E1E] border-black",
    label: "OUT FOR DELIVERY",
  },
  delivered: {
    icon: CheckCircle,
    color: "text-white",
    bg: "bg-[#008A45] border-[#006B35]",
    label: "DELIVERED",
  },
  cancelled: {
    icon: XCircle,
    color: "text-white",
    bg: "bg-[#ED1C24] border-[#B2151A]",
    label: "CANCELLED",
  },
};

const paymentStatusConfig: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: "text-black", bg: "bg-[#FFD200]/40 border-black/20", label: "PENDING" },
  pending_verification: { color: "text-black", bg: "bg-[#F28C00]/20 border-[#F28C00]/30", label: "VERIFYING" },
  paid: { color: "text-white", bg: "bg-[#008A45] border-[#006B35]", label: "PAID" },
  completed: { color: "text-white", bg: "bg-[#008A45] border-[#006B35]", label: "PAID" },
  failed: { color: "text-white", bg: "bg-[#ED1C24] border-[#B2151A]", label: "FAILED" },
  refunded: { color: "text-black", bg: "bg-black/10 border-black/20", label: "REFUNDED" },
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
            name: i.name || "Item",
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
      // Keep current order data if refresh fails.
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
      <div className="min-h-screen bg-[#F8F8F8] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[#FFD200] mx-auto mb-4" />
          <p className={FIELD_LABEL_CLASS}>Loading order details...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#F8F8F8] flex items-center justify-center px-4">
        <div className="text-center">
          <Package className="w-16 h-16 text-black/20 mx-auto mb-4" />
          <h2 className="font-bebas text-5xl tracking-tighter text-black mb-2">ORDER NOT FOUND</h2>
          <p className="font-caveat text-2xl text-black/50 italic mb-6">
            The order you're looking for doesn't exist or you don't have permission to view it.
          </p>
          <Button
            variant="outline"
            onClick={() => router.push("/orders")}
            className="border-4 border-black rounded-none bg-black text-[#FFD200] font-bebas text-2xl h-14 px-8 shadow-[6px_6px_0px_0px_rgba(255,210,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            BACK TO ORDERS
          </Button>
        </div>
      </div>
    );
  }

  const statusInfo = statusConfig[order.status] || statusConfig.pending;
  const StatusIcon = statusInfo.icon;
  const paymentInfo = paymentStatusConfig[order.payment_status] || paymentStatusConfig.pending;

  const timeline: { status: string; notes?: string; created_at: string }[] =
    order.status_history && order.status_history.length > 0
      ? order.status_history
      : [{ status: order.status, notes: "Order placed", created_at: order.created_at }];

  return (
    <div className="min-h-screen bg-[#F8F8F8] pt-32 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Button
            variant="outline"
            onClick={() => router.push("/orders")}
            className="mb-6 border-2 border-black rounded-none font-bebas text-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            BACK TO ORDERS
          </Button>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="font-bebas text-6xl md:text-7xl tracking-[0.12em] sm:tracking-tighter leading-[0.85] uppercase text-black">
                ORDER DETAILS
              </h1>
              <p className="font-caveat text-2xl text-black/50 italic mt-1">
                Street ticket #{order.order_number}
              </p>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <Badge className={`${statusInfo.bg} ${statusInfo.color} border-2 px-4 py-2 rounded-none font-bebas tracking-wider`}>
                <StatusIcon className="w-4 h-4 mr-2" />
                {statusInfo.label}
              </Badge>
              <Badge className={`${paymentInfo.bg} ${paymentInfo.color} border-2 px-4 py-2 rounded-none font-bebas tracking-wider`}>
                <CreditCard className="w-4 h-4 mr-2" />
                {paymentInfo.label}
              </Badge>
              <button
                onClick={() => refreshOrder(false)}
                disabled={isRefreshing}
                title="Refresh order"
                className="ml-1 p-2 border-2 border-black bg-white text-black hover:bg-black hover:text-[#FFD200] transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
          <p className="text-xs text-black/40 mt-2 font-source-sans font-semibold uppercase tracking-wider">
            Last updated: {lastUpdated.toLocaleTimeString()} · auto-refreshes every 30 s
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="border-4 border-black rounded-none shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white">
                <CardHeader className="pb-4 border-b-2 border-black/10">
                  <CardTitle className="flex items-center gap-3">
                    <Package className="w-6 h-6 text-[#ED1C24] flex-shrink-0" />
                    <span className={CARD_TITLE_CLASS}>Order Items</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  {order.items?.map((item: any, index: number) => {
                    const imgSrc = getItemImage(item);
                    return (
                      <div key={index} className="flex gap-4 p-4 bg-[#F8F8F8] border-2 border-black/10">
                        <div className="w-20 h-20 bg-white overflow-hidden shadow-sm flex-shrink-0 border-2 border-black/20">
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
                                    '<div class="w-full h-full flex items-center justify-center bg-[#FFD200]/20"><span class="text-2xl">🍗</span></div>';
                                }
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-[#FFD200]/20">
                              <span className="text-2xl">🍗</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-grow">
                          <h4 className="font-bebas text-2xl text-black leading-none mb-1">{item.name}</h4>
                          <p className="text-sm text-black/60 mt-1">
                            <span className={FIELD_LABEL_CLASS}>Qty:</span>{" "}
                            <span className="font-semibold text-black">{item.quantity}</span>
                          </p>
                          <p className="text-sm text-black/60">
                            <span className={FIELD_LABEL_CLASS}>Unit Price:</span>{" "}
                            <span className="font-semibold text-black">{formatCurrency(item.price)}</span>
                          </p>
                          {item.size && (
                            <p className="text-sm text-black/60">
                              <span className={FIELD_LABEL_CLASS}>Size:</span>{" "}
                              <span className="font-semibold text-black capitalize">{item.size}</span>
                            </p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-bebas text-3xl text-black leading-none">
                            {formatCurrency(item.price * item.quantity)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="border-4 border-black rounded-none shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white">
                <CardHeader className="pb-4 border-b-2 border-black/10">
                  <CardTitle className="flex items-center gap-3">
                    <Clock className="w-6 h-6 text-[#ED1C24] flex-shrink-0" />
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
                              className={`w-10 h-10 border-2 flex items-center justify-center ${
                                isLatest
                                  ? "bg-[#FFD200] border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                                  : entryStatus.bg
                              }`}
                            >
                              <EntryIcon className={`w-5 h-5 ${isLatest ? "text-black" : entryStatus.color}`} />
                            </div>
                            {index < timeline.length - 1 && (
                              <div className="w-1 h-12 bg-black/20 my-1" />
                            )}
                          </div>
                          <div className="flex-grow pb-8">
                            <p className={`${isLatest ? "font-bebas text-2xl" : "font-bebas text-xl"} tracking-wide text-black`}>
                              {entryStatus.label}
                              {isLatest && (
                                <span className="ml-2 text-xs bg-black text-[#FFD200] px-2 py-0.5 font-bebas tracking-wider">
                                  CURRENT
                                </span>
                              )}
                            </p>
                            <p className={`text-sm mt-0.5 ${FIELD_LABEL_CLASS}`}>{formatDate(entry.created_at)}</p>
                            {entry.notes && (
                              <p className="text-sm text-black/60 mt-1">{entry.notes}</p>
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

          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="border-4 border-black rounded-none shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white">
                <CardHeader className="pb-4 border-b-2 border-black/10">
                  <CardTitle className="flex items-center gap-3">
                    <Receipt className="w-6 h-6 text-[#ED1C24] flex-shrink-0" />
                    <span className={CARD_TITLE_CLASS}>Order Summary</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  <div className="flex justify-between text-sm">
                    <span className={FIELD_LABEL_CLASS}>Subtotal</span>
                    <span className="font-semibold text-black">{formatCurrency(order.subtotal)}</span>
                  </div>
                  {order.discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="font-bebas tracking-widest text-[10px] uppercase text-[#008A45]">Discount</span>
                      <span className="font-semibold text-[#008A45]">-{formatCurrency(order.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className={FIELD_LABEL_CLASS}>Delivery Fee</span>
                    <span className="font-semibold text-black">{formatCurrency(order.delivery_fee)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={FIELD_LABEL_CLASS}>Tax</span>
                    <span className="font-semibold text-black">{formatCurrency(order.tax)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-base pt-1">
                    <span className="font-bebas text-2xl tracking-wider uppercase text-black">Total</span>
                    <span className="font-bebas text-3xl text-black leading-none">{formatCurrency(order.total)}</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="border-4 border-black rounded-none shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white">
                <CardHeader className="pb-4 border-b-2 border-black/10">
                  <CardTitle className="flex items-center gap-3">
                    <User className="w-6 h-6 text-[#ED1C24] flex-shrink-0" />
                    <span className={CARD_TITLE_CLASS}>Customer Info</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  <div className="flex items-start gap-3">
                    <User className="w-5 h-5 text-black/30 mt-0.5" />
                    <div>
                      <p className={`mb-0.5 ${FIELD_LABEL_CLASS}`}>Name</p>
                      <p className="font-semibold text-black">{order.customer_name}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-black/30 mt-0.5" />
                    <div>
                      <p className={`mb-0.5 ${FIELD_LABEL_CLASS}`}>Phone</p>
                      <p className="font-semibold text-black">{order.customer_phone}</p>
                    </div>
                  </div>
                  {order.customer_email && (
                    <div className="flex items-start gap-3">
                      <Mail className="w-5 h-5 text-black/30 mt-0.5" />
                      <div>
                        <p className={`mb-0.5 ${FIELD_LABEL_CLASS}`}>Email</p>
                        <p className="font-semibold text-black">{order.customer_email}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-black/30 mt-0.5" />
                    <div>
                      <p className={`mb-0.5 ${FIELD_LABEL_CLASS}`}>Delivery Address</p>
                      <p className="font-semibold text-black">{order.customer_address}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="border-4 border-black rounded-none shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white">
                <CardHeader className="pb-4 border-b-2 border-black/10">
                  <CardTitle className="flex items-center gap-3">
                    <CreditCard className="w-6 h-6 text-[#ED1C24] flex-shrink-0" />
                    <span className={CARD_TITLE_CLASS}>Payment Details</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  <div className="flex items-center justify-between">
                    <span className={FIELD_LABEL_CLASS}>Method</span>
                    <Badge variant="outline" className="capitalize font-semibold rounded-none border-2 border-black">
                      {order.payment_method?.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={FIELD_LABEL_CLASS}>Status</span>
                    <Badge className={`${paymentInfo.bg} ${paymentInfo.color} border-2 rounded-none font-bebas tracking-wider`}>
                      {paymentInfo.label}
                    </Badge>
                  </div>
                  {order.payment_method === "cash" && order.payment_status === "pending" && (
                    <p className="text-xs text-black bg-[#FFD200]/25 border-2 border-black/20 px-3 py-2 font-source-sans font-semibold">
                      Cash payment will be collected upon delivery or pickup.
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className={FIELD_LABEL_CLASS}>Order Date</span>
                    <span className="text-sm font-semibold text-black">
                      {new Date(order.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {(order.payment_method === "online" || order.transaction_id || order.online_payment_details) && (
                    <>
                      <Separator />
                      <div className="p-3 bg-[#FFF4CC] border-2 border-black/20 space-y-2">
                        <div className="flex items-center gap-2 text-black mb-2">
                          <Receipt className="w-4 h-4" />
                          <span className="font-bebas text-xl tracking-wider">ONLINE PAYMENT DETAILS</span>
                        </div>
                        {order.transaction_id ? (
                          <div className="flex items-center justify-between">
                            <span className={FIELD_LABEL_CLASS}>Transaction ID</span>
                            <span className="text-xs font-mono font-medium text-black bg-white border border-black/20 px-2 py-0.5">
                              {order.transaction_id}
                            </span>
                          </div>
                        ) : (
                          <p className="text-xs text-black/50 italic">No transaction ID recorded</p>
                        )}
                        {order.online_payment_details?.method_name && (
                          <div className="flex items-center justify-between">
                            <span className={FIELD_LABEL_CLASS}>Payment Via</span>
                            <span className="text-xs font-semibold text-black">
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

            {order.assigned_to_name && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Card className="border-4 border-black rounded-none shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-[#FFF4CC]">
                  <CardHeader className="pb-4 border-b-2 border-black/10">
                    <CardTitle className="flex items-center gap-3">
                      <Truck className="w-6 h-6 text-[#ED1C24] flex-shrink-0" />
                      <span className={CARD_TITLE_CLASS}>Delivery Person</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-4">
                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-black/30" />
                      <div>
                        <p className={`mb-0.5 ${FIELD_LABEL_CLASS}`}>Name</p>
                        <p className="font-semibold text-black">{order.assigned_to_name}</p>
                      </div>
                    </div>
                    {order.assigned_to_phone && (
                      <div className="flex items-center gap-3">
                        <Phone className="w-5 h-5 text-black/30" />
                        <div>
                          <p className={`mb-0.5 ${FIELD_LABEL_CLASS}`}>Contact</p>
                          <p className="font-semibold text-black">{order.assigned_to_phone}</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {order.notes && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Card className="border-4 border-black rounded-none shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white">
                  <CardHeader className="pb-4 border-b-2 border-black/10">
                    <CardTitle className="flex items-center gap-3">
                      <FileText className="w-6 h-6 text-[#ED1C24] flex-shrink-0" />
                      <span className={CARD_TITLE_CLASS}>Order Notes</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <p className="text-black leading-relaxed font-source-sans">{order.notes}</p>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
              className="flex flex-col gap-3"
            >
              {order.order_type === "online" && (
                <Button
                  className="w-full rounded-none border-4 border-black bg-black text-[#FFD200] font-bebas text-2xl tracking-widest h-14 shadow-[6px_6px_0px_0px_rgba(255,210,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                  onClick={() => router.push(`/orders/track?id=${order.id}`)}
                >
                  <Truck className="w-4 h-4 mr-2" />
                  TRACK ORDER
                </Button>
              )}
              <Button
                variant="outline"
                className="w-full rounded-none border-4 border-black bg-white text-black font-bebas text-xl tracking-widest h-14 hover:bg-[#FFD200]"
                onClick={downloadInvoice}
              >
                <Download className="w-4 h-4 mr-2" />
                DOWNLOAD INVOICE (PDF)
              </Button>
              <Button
                variant="outline"
                className="w-full rounded-none border-4 border-black bg-white text-black font-bebas text-xl tracking-widest h-14 hover:bg-[#FFD200]"
                onClick={() => refreshOrder(false)}
                disabled={isRefreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                REFRESH STATUS
              </Button>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
