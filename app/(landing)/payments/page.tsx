"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  CreditCard,
  Banknote,
  Smartphone,
  Clock,
  CheckCircle,
  XCircle,
  ArrowLeft,
  RefreshCw,
  Download,
  Eye,
  Calendar,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/custom/Navbar";
import Footer from "@/components/custom/Footer";

interface Payment {
  id: string;
  order_id: string;
  order_number: string;
  amount: number;
  payment_method: string;
  payment_status: "pending" | "completed" | "failed" | "refunded" | "pending_verification";
  transaction_id: string | null;
  proof_url: string | null;
  created_at: string;
  online_payment_details?: {
    method_name?: string;
    account_holder_name?: string;
    account_number?: string;
    bank_name?: string;
    submitted_at?: string;
  } | null;
}

const paymentMethodIcons = {
  cash_on_delivery: Banknote,
  bank_transfer: CreditCard,
  jazzcash: Smartphone,
  easypaisa: Smartphone,
};

const statusConfig = {
  pending: { color: "text-yellow-500", bg: "bg-yellow-500/10", label: "Pending" },
  completed: { color: "text-green-500", bg: "bg-green-500/10", label: "Completed" },
  failed: { color: "text-red-500", bg: "bg-red-500/10", label: "Failed" },
  refunded: { color: "text-blue-500", bg: "bg-blue-500/10", label: "Refunded" },
  pending_verification: { color: "text-orange-500", bg: "bg-orange-500/10", label: "Verifying" },
} as const;

const defaultStatus = { color: "text-gray-500", bg: "bg-gray-500/10", label: "Unknown" };

export default function PaymentsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedProof, setSelectedProof] = useState<string | null>(null);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.15 },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { type: "spring" as const, stiffness: 300, damping: 25 }
    },
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchPayments();
    }
  }, [user]);

  const fetchPayments = async () => {
    if (!user) return;

    try {
      // Use RPC for optimized query
      const { data: orders, error: ordersError } = await supabase.rpc("get_customer_orders_paginated", {
        p_customer_id: user.id,
        p_limit: 100,
        p_offset: 0,
        p_status: null
      });

      if (ordersError) throw ordersError;

      // Transform orders into payment records
      const paymentRecords: Payment[] = (orders || []).map((order: any) => ({
        id: order.id,
        order_id: order.id,
        order_number: order.order_number,
        amount: order.total,
        payment_method: order.payment_method,
        payment_status: order.payment_status || "pending",
        transaction_id: order.transaction_id || null,
        proof_url: null,
        created_at: order.created_at,
        online_payment_details: order.online_payment_details || null,
      }));

      setPayments(paymentRecords);
    } catch (error) {
      } finally {
      setIsLoading(false);
    }
  };

  const filteredPayments = payments.filter((payment) => {
    if (statusFilter === "all") return true;
    return payment.payment_status === statusFilter;
  });

  // Calculate totals
  const totalPaid = payments
    .filter((p) => p.payment_status === "completed")
    .reduce((sum, p) => sum + p.amount, 0);

  const totalPending = payments
    .filter((p) => p.payment_status === "pending")
    .reduce((sum, p) => sum + p.amount, 0);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <RefreshCw className="w-8 h-8 text-primary" />
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-32 pb-16 bg-gradient-to-b from-background to-secondary/20">
        <div className="container-custom max-w-4xl">
          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 via-green-500/10 to-primary/10 p-6 border"
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent"
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
            />
            <div className="relative z-10">
              <h1 className="text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
                <CreditCard className="h-8 w-8 text-primary" />
                Payment History
              </h1>
              <p className="text-muted-foreground">
                View all your payments and transaction history
              </p>
            </div>
          </motion.div>

          {/* Summary Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8"
          >
            <motion.div 
              className="bg-gradient-to-br from-green-500/10 via-card to-card rounded-2xl border shadow-lg p-4 md:p-6 relative overflow-hidden"
              whileHover={{ scale: 1.05, boxShadow: "0 20px 50px rgba(0, 255, 0, 0.2)" }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/20 rounded-full blur-2xl" />
              <p className="text-sm text-muted-foreground mb-1 relative z-10">Total Paid</p>
              <p className="text-2xl md:text-3xl font-bold text-green-500 relative z-10">
                Rs. {totalPaid.toLocaleString()}
              </p>
            </motion.div>
            <motion.div 
              className="bg-gradient-to-br from-yellow-500/10 via-card to-card rounded-2xl border shadow-lg p-4 md:p-6 relative overflow-hidden"
              whileHover={{ scale: 1.05, boxShadow: "0 20px 50px rgba(255, 255, 0, 0.2)" }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="absolute top-0 right-0 w-20 h-20 bg-yellow-500/20 rounded-full blur-2xl" />
              <p className="text-sm text-muted-foreground mb-1 relative z-10">Pending</p>
              <p className="text-2xl md:text-3xl font-bold text-yellow-500 relative z-10">
                Rs. {totalPending.toLocaleString()}
              </p>
            </motion.div>
            <motion.div 
              className="bg-gradient-to-br from-primary/10 via-card to-card rounded-2xl border shadow-lg p-4 md:p-6 col-span-2 md:col-span-1 relative overflow-hidden"
              whileHover={{ scale: 1.05, boxShadow: "0 20px 50px rgba(0, 100, 255, 0.2)" }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="absolute top-0 right-0 w-20 h-20 bg-primary/20 rounded-full blur-2xl" />
              <p className="text-sm text-muted-foreground mb-1 relative z-10">Total Orders</p>
              <p className="text-2xl md:text-3xl font-bold relative z-10">
                {payments.length}
              </p>
            </motion.div>
          </motion.div>

          {/* Filter */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex justify-end mb-6"
          >
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
          </motion.div>

          {/* Payments List */}
          {filteredPayments.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <CreditCard className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No payments found</h3>
              <p className="text-muted-foreground">
                {statusFilter !== "all"
                  ? "Try changing the filter"
                  : "Your payment history will appear here"}
              </p>
            </motion.div>
          ) : (
            <motion.div 
              className="space-y-4"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {filteredPayments.map((payment, index) => {
                const status = statusConfig[payment.payment_status as keyof typeof statusConfig] || defaultStatus;
                const PaymentIcon =
                  paymentMethodIcons[payment.payment_method as keyof typeof paymentMethodIcons] ||
                  CreditCard;

                return (
                  <motion.div
                    key={payment.id}
                    variants={cardVariants}
                    whileHover={{ 
                      scale: 1.02, 
                      boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
                      transition: { type: "spring", stiffness: 400, damping: 25 }
                    }}
                    onClick={() => router.push(`/orders/${payment.order_id}`)}
                    className="bg-gradient-to-br from-card via-card to-primary/5 rounded-2xl border shadow-lg p-4 md:p-6 relative overflow-hidden cursor-pointer"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl" />
                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                          <PaymentIcon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold">Order #{payment.order_number}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(payment.created_at).toLocaleDateString()}
                            <span>•</span>
                            <span className="capitalize">
                              {payment.payment_method?.replace("_", " ")}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold text-lg">Rs. {payment.amount}</p>
                          <div
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${status.bg} ${status.color}`}
                          >
                            {payment.payment_status === "completed" ? (
                              <CheckCircle className="h-3 w-3" />
                            ) : payment.payment_status === "failed" ? (
                              <XCircle className="h-3 w-3" />
                            ) : (
                              <Clock className="h-3 w-3" />
                            )}
                            {status.label}
                          </div>
                        </div>

                        {/* View Proof Button */}
                        {payment.proof_url && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProof(payment.proof_url);
                            }}
                            className="rounded-full"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Proof
                          </Button>
                        )}

                        {/* View Details Arrow */}
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>

                    {/* Transaction ID */}
                    {payment.transaction_id && (
                      <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
                        <span className="font-medium">Transaction ID:</span>{" "}
                        <span className="font-mono bg-muted px-2 py-0.5 rounded">{payment.transaction_id}</span>
                      </div>
                    )}

                    {/* Online Payment Details */}
                    {payment.online_payment_details && (
                      <div className="mt-3 pt-3 border-t text-sm space-y-1">
                        {payment.online_payment_details.method_name && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <span className="font-medium">Payment Method:</span>
                            <span>{payment.online_payment_details.method_name}</span>
                          </div>
                        )}
                        {payment.online_payment_details.account_holder_name && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <span className="font-medium">Paid To:</span>
                            <span>{payment.online_payment_details.account_holder_name}</span>
                          </div>
                        )}
                        {payment.online_payment_details.account_number && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <span className="font-medium">Account:</span>
                            <span className="font-mono">{payment.online_payment_details.account_number}</span>
                          </div>
                        )}
                        {payment.online_payment_details.bank_name && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <span className="font-medium">Bank:</span>
                            <span>{payment.online_payment_details.bank_name}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* View Order Details Button */}
                    <div className="mt-4 pt-4 border-t">
                      <Button 
                        variant="outline" 
                        className="w-full rounded-xl group"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/orders/${payment.order_id}`);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Order Details
                        <ChevronRight className="h-4 w-4 ml-auto group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>
      </main>
      <Footer />

      {/* Proof Image Modal */}
      <Dialog open={!!selectedProof} onOpenChange={() => setSelectedProof(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Payment Proof</DialogTitle>
          </DialogHeader>
          {selectedProof && (
            <div className="relative aspect-video rounded-lg overflow-hidden bg-secondary">
              <img
                src={selectedProof}
                alt="Payment proof"
                className="w-full h-full object-contain"
              />
            </div>
          )}
          <Button
            variant="outline"
            onClick={() => selectedProof && window.open(selectedProof, "_blank")}
            className="w-full rounded-xl"
          >
            <Download className="h-4 w-4 mr-2" />
            Download Image
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
