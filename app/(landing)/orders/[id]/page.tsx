"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
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
  DollarSign,
  Receipt,
  User,
  Calendar,
  FileText,
  Download,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/custom/Navbar";
import Footer from "@/components/custom/Footer";

interface OrderDetail {
  id: string;
  order_number: string;
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
  paid: { color: "text-green-700", bg: "bg-green-100", label: "Paid" },
  failed: { color: "text-red-700", bg: "bg-red-100", label: "Failed" },
  refunded: { color: "text-gray-700", bg: "bg-gray-100", label: "Refunded" },
};

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user, isLoading: authLoading } = useAuth();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && params.id) {
      fetchOrderDetails();
    }
  }, [user, params.id]);

  const fetchOrderDetails = async () => {
    if (!user || !params.id) return;

    try {
      const { data, error } = await supabase.rpc("get_order_details", {
        p_order_id: params.id,
        p_customer_id: user.id,
      });

      if (error) throw error;

      if (data && data.length > 0) {
        setOrder(data[0]);
      }
    } catch (error) {
      } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `Rs. ${amount.toLocaleString()}`;
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

  if (authLoading || isLoading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-yellow-50 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-orange-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading order details...</p>
          </div>
        </div>
      </>
    );
  }

  if (!order) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-yellow-50 flex items-center justify-center">
          <div className="text-center">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Order Not Found</h2>
            <p className="text-gray-600 mb-6">
              The order you're looking for doesn't exist or you don't have permission to view it.
            </p>
            <Button onClick={() => router.push("/orders")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Orders
            </Button>
          </div>
        </div>
      </>
    );
  }

  const statusInfo = statusConfig[order.status] || statusConfig.pending;
  const StatusIcon = statusInfo.icon;
  const paymentInfo = paymentStatusConfig[order.payment_status] || paymentStatusConfig.pending;

  return (
    <>
      <Navbar />
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
                <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-600 via-red-500 to-yellow-600 bg-clip-text text-transparent animate-gradient bg-[length:200%_auto] tracking-tight">
                  Order Details
                </h1>
                <p className="text-base text-gray-600 mt-2 font-normal">Order #{order.order_number}</p>
              </div>
              <div className="flex gap-3">
                <Badge className={`${statusInfo.bg} ${statusInfo.color} border px-4 py-2`}>
                  <StatusIcon className="w-4 h-4 mr-2" />
                  {statusInfo.label}
                </Badge>
                <Badge className={`${paymentInfo.bg} ${paymentInfo.color} px-4 py-2`}>
                  <CreditCard className="w-4 h-4 mr-2" />
                  {paymentInfo.label}
                </Badge>
              </div>
            </div>
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
                    <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-800 tracking-wide">
                      <Package className="w-6 h-6 text-orange-600" />
                      Order Items
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {order.items.map((item: any, index: number) => (
                      <div key={index} className="flex gap-4 p-4 bg-gray-50 rounded-lg">
                        <div className="w-20 h-20 bg-white rounded-lg overflow-hidden shadow-sm flex-shrink-0">
                          <img
                            src={item.image || "/assets/placeholder-food.png"}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-grow">
                          <h4 className="font-medium text-gray-900 text-base">{item.name}</h4>
                          <p className="text-sm text-gray-500 mt-1.5 font-normal">Quantity: {item.quantity}</p>
                          <p className="text-sm text-gray-500 font-normal">
                            Unit Price: {formatCurrency(item.price)}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-semibold text-orange-600 text-lg">
                            {formatCurrency(item.price * item.quantity)}
                          </p>
                        </div>
                      </div>
                    ))}
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
                    <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-800 tracking-wide">
                      <Clock className="w-6 h-6 text-orange-600" />
                      Order Timeline
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {order.status_history && order.status_history.length > 0 ? (
                        order.status_history.map((history: any, index: number) => {
                          const historyStatus = statusConfig[history.status] || statusConfig.pending;
                          const HistoryIcon = historyStatus.icon;
                          return (
                            <div key={index} className="flex gap-4">
                              <div className="flex flex-col items-center">
                                <div
                                  className={`w-10 h-10 rounded-full ${historyStatus.bg} border-2 flex items-center justify-center`}
                                >
                                  <HistoryIcon className={`w-5 h-5 ${historyStatus.color}`} />
                                </div>
                                {index < order.status_history.length - 1 && (
                                  <div className="w-0.5 h-12 bg-gray-200 my-1"></div>
                                )}
                              </div>
                              <div className="flex-grow pb-8">
                                <p className="font-medium text-gray-900 text-base">
                                  {historyStatus.label}
                                </p>
                                <p className="text-sm text-gray-500 font-normal">
                                  {formatDate(history.created_at)}
                                </p>
                                {history.notes && (
                                  <p className="text-sm text-gray-500 mt-1">{history.notes}</p>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-gray-500 text-center py-4">No timeline data available</p>
                      )}
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
                    <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-800 tracking-wide">
                      <Receipt className="w-6 h-6 text-orange-600" />
                      Order Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 font-normal">Subtotal</span>
                      <span className="text-gray-900 font-medium">{formatCurrency(order.subtotal)}</span>
                    </div>
                    {order.discount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600 font-normal">Discount</span>
                        <span className="text-green-600 font-medium">-{formatCurrency(order.discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 font-normal">Delivery Fee</span>
                      <span className="text-gray-900 font-medium">{formatCurrency(order.delivery_fee)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 font-normal">Tax</span>
                      <span className="text-gray-900 font-medium">{formatCurrency(order.tax)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-base pt-1">
                      <span className="font-semibold text-gray-900">Total</span>
                      <span className="font-semibold text-orange-600">{formatCurrency(order.total)}</span>
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
                    <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-800 tracking-wide">
                      <User className="w-6 h-6 text-orange-600" />
                      Customer Info
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-3">
                      <User className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-0.5">Name</p>
                        <p className="font-medium text-gray-900">{order.customer_name}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-0.5">Phone</p>
                        <p className="font-medium text-gray-900">{order.customer_phone}</p>
                      </div>
                    </div>
                    {order.customer_email && (
                      <div className="flex items-start gap-3">
                        <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-0.5">Email</p>
                          <p className="font-medium text-gray-900">{order.customer_email}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-0.5">Delivery Address</p>
                        <p className="font-medium text-gray-900">{order.customer_address}</p>
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
                    <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-800 tracking-wide">
                      <CreditCard className="w-6 h-6 text-orange-600" />
                      Payment Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500 font-medium">Method</span>
                      <Badge variant="outline" className="capitalize">
                        {order.payment_method.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500 font-medium">Status</span>
                      <Badge className={`${paymentInfo.bg} ${paymentInfo.color}`}>
                        {paymentInfo.label}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500 font-medium">Order Date</span>
                      <span className="text-sm font-medium text-gray-900">
                        {new Date(order.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    
                    {/* Online Payment Transaction Details */}
                    {(order.payment_method === 'online' || order.transaction_id || order.online_payment_details) && (
                      <>
                        <Separator />
                        <div className="p-3 rounded-lg bg-purple-50 border border-purple-200 space-y-2">
                          <div className="flex items-center gap-2 text-purple-700 mb-2">
                            <Receipt className="w-4 h-4" />
                            <span className="font-semibold text-sm">Online Payment Details</span>
                          </div>
                          {order.transaction_id ? (
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-purple-600">Transaction ID</span>
                              <span className="text-xs font-mono font-medium text-purple-800 bg-purple-100 px-2 py-0.5 rounded">
                                {order.transaction_id}
                              </span>
                            </div>
                          ) : (
                            <p className="text-xs text-purple-600 italic">No transaction ID recorded</p>
                          )}
                          {order.online_payment_details?.method_name && (
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-purple-600">Payment Via</span>
                              <span className="text-xs font-medium text-purple-800">
                                {order.online_payment_details.method_name}
                              </span>
                            </div>
                          )}
                          {order.online_payment_details?.account_title && (
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-purple-600">Account Title</span>
                              <span className="text-xs font-medium text-purple-800">
                                {order.online_payment_details.account_title}
                              </span>
                            </div>
                          )}
                          {order.online_payment_details?.account_number && (
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-purple-600">Account No.</span>
                              <span className="text-xs font-medium text-purple-800">
                                {order.online_payment_details.account_number}
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
                      <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-800 tracking-wide">
                        <Truck className="w-6 h-6 text-orange-600" />
                        Delivery Person
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-3">
                        <User className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-0.5">Name</p>
                          <p className="font-medium text-gray-900">{order.assigned_to_name}</p>
                        </div>
                      </div>
                      {order.assigned_to_phone && (
                        <div className="flex items-center gap-3">
                          <Phone className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-0.5">Contact</p>
                            <p className="font-medium text-gray-900">{order.assigned_to_phone}</p>
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
                      <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-800 tracking-wide">
                        <FileText className="w-6 h-6 text-orange-600" />
                        Order Notes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
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
              >
                <Button
                  className="w-full bg-gradient-to-r from-orange-600 to-yellow-600 hover:from-orange-700 hover:to-yellow-700"
                  onClick={() => router.push(`/orders/track?id=${order.id}`)}
                >
                  <Truck className="w-4 h-4 mr-2" />
                  Track Order
                </Button>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
