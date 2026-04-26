"use client";

import { useState, useEffect, useRef } from "react";
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
import type { PaymentServer } from "@/lib/server-queries";

const paymentMethodIcons = {
  cash_on_delivery: Banknote,
  bank_transfer: CreditCard,
  jazzcash: Smartphone,
  easypaisa: Smartphone,
};

const statusConfig = {
  pending: { color: "text-black", bg: "bg-[#FFD200]/40", label: "Pending" },
  completed: { color: "text-[#008A45]", bg: "bg-[#008A45]/12", label: "Completed" },
  failed: { color: "text-[#ED1C24]", bg: "bg-[#ED1C24]/10", label: "Failed" },
  refunded: { color: "text-[#1E1E1E]", bg: "bg-black/10", label: "Refunded" },
  pending_verification: { color: "text-black", bg: "bg-[#F28C00]/20", label: "Verifying" },
} as const;

const defaultStatus = { color: "text-gray-500", bg: "bg-gray-500/10", label: "Unknown" };

interface PaymentsClientProps {
  initialPayments: PaymentServer[];
}

export default function PaymentsClient({ initialPayments }: PaymentsClientProps) {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  // Track if SSR provided data - prevents client refetch
  const hasSSRData = initialPayments.length > 0;
  const hasFetchedRef = useRef(hasSSRData);
  
  const [payments, setPayments] = useState<PaymentServer[]>(initialPayments);
  const [isLoading, setIsLoading] = useState(!hasSSRData);
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
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);

  // Delay auth check to allow localStorage to be read
  useEffect(() => {
    const timer = setTimeout(() => setHasCheckedAuth(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (hasCheckedAuth && !authLoading && !user) {
      router.push("/auth");
    }
  }, [user, authLoading, router, hasCheckedAuth]);

  // Only fetch if no SSR data provided - uses API route
  useEffect(() => {
    // Skip if server already provided data
    if (initialPayments.length > 0 || hasFetchedRef.current || !user) return;
    
    hasFetchedRef.current = true;
    
    const fetchPayments = async () => {
      try {
        const res = await fetch('/api/customer/orders?limit=100&offset=0');
        const { data: orders, error } = await res.json();
        
        if (error) throw new Error(error);

        const paymentRecords: PaymentServer[] = (orders || []).map((order: any) => ({
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
        hasFetchedRef.current = true;
      } catch (error) {
        // Silently handle error - SSR data already provides initial state
        console.error('Error fetching payments:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPayments();
  }, [user]);

  const filteredPayments = payments.filter((payment) => {
    if (statusFilter === "all") return true;
    return payment.payment_status === statusFilter;
  });

  const totalPaid = payments
    .filter((p) => p.payment_status === "completed")
    .reduce((sum, p) => sum + p.amount, 0);

  const totalPending = payments
    .filter((p) => p.payment_status === "pending")
    .reduce((sum, p) => sum + p.amount, 0);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F8F8]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <RefreshCw className="w-8 h-8 text-[#FFD200]" />
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen pt-32 pb-16 bg-[#F8F8F8]">
        <div className="container-custom max-w-4xl">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="mb-8 border-2 border-black rounded-none font-bebas text-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            BACK
          </Button>

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 border-l-8 border-black pl-6"
          >
            <div>
              <h1 className="font-bebas text-6xl md:text-7xl tracking-tighter leading-[0.85] uppercase text-black mb-2 flex items-center gap-3">
                <CreditCard className="h-10 w-10 text-[#ED1C24]" />
                PAYMENT HISTORY
              </h1>
              <p className="font-caveat text-2xl text-black/50 italic">
                Every payment run in one place.
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
              className="bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-4 md:p-6 relative overflow-hidden"
              whileHover={{ scale: 1.05, boxShadow: "0 20px 50px rgba(0, 255, 0, 0.2)" }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="absolute top-0 right-0 w-20 h-20 bg-[#008A45]/20 rounded-full blur-2xl" />
              <p className="text-sm text-black/50 mb-1 relative z-10 font-bebas tracking-widest">TOTAL PAID</p>
              <p className="text-2xl md:text-3xl font-bebas text-[#008A45] relative z-10">
                Rs. {totalPaid.toLocaleString()}
              </p>
            </motion.div>
            <motion.div 
              className="bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-4 md:p-6 relative overflow-hidden"
              whileHover={{ scale: 1.05, boxShadow: "0 20px 50px rgba(255, 255, 0, 0.2)" }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="absolute top-0 right-0 w-20 h-20 bg-[#FFD200]/30 rounded-full blur-2xl" />
              <p className="text-sm text-black/50 mb-1 relative z-10 font-bebas tracking-widest">PENDING</p>
              <p className="text-2xl md:text-3xl font-bebas text-black relative z-10">
                Rs. {totalPending.toLocaleString()}
              </p>
            </motion.div>
            <motion.div 
              className="bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-4 md:p-6 col-span-2 md:col-span-1 relative overflow-hidden"
              whileHover={{ scale: 1.05, boxShadow: "0 20px 50px rgba(0, 100, 255, 0.2)" }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="absolute top-0 right-0 w-20 h-20 bg-black/10 rounded-full blur-2xl" />
              <p className="text-sm text-black/50 mb-1 relative z-10 font-bebas tracking-widest">TOTAL ORDERS</p>
              <p className="text-2xl md:text-3xl font-bebas text-black relative z-10">
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
              <SelectTrigger className="w-[180px] border-2 border-black rounded-none font-bebas text-base h-12 bg-white">
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
              <h3 className="font-bebas text-5xl tracking-tighter uppercase text-black mb-2">NO PAYMENTS FOUND</h3>
              <p className="font-caveat text-2xl text-black/50 italic">
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
              {filteredPayments.map((payment) => {
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
                    className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-4 md:p-6 relative overflow-hidden cursor-pointer"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#FFD200]/20 rounded-full blur-2xl" />
                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-none bg-black text-[#FFD200] border-2 border-black flex items-center justify-center">
                          <PaymentIcon className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="font-bebas text-2xl leading-none">ORDER #{payment.order_number}</p>
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
                          <p className="font-bebas text-3xl leading-none">RS. {payment.amount}</p>
                          <div
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-none border border-black/20 text-xs font-bebas tracking-wider uppercase ${status.bg} ${status.color}`}
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

                        {payment.proof_url && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProof(payment.proof_url);
                            }}
                            className="rounded-none border-2 border-black font-bebas"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Proof
                          </Button>
                        )}

                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>

                    {payment.transaction_id && (
                      <div className="mt-4 pt-4 border-t-2 border-black/10 text-sm text-muted-foreground">
                        <span className="font-medium">Transaction ID:</span>{" "}
                        <span className="font-mono bg-[#FFF4CC] border border-black/20 px-2 py-0.5 rounded-none">{payment.transaction_id}</span>
                      </div>
                    )}

                    {payment.online_payment_details && (
                      <div className="mt-3 pt-3 border-t-2 border-black/10 text-sm space-y-1">
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

                    <div className="mt-4 pt-4 border-t">
                      <Button 
                        variant="outline" 
                        className="w-full rounded-none border-2 border-black font-bebas text-lg group"
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
      </div>

      <Dialog open={!!selectedProof} onOpenChange={() => setSelectedProof(null)}>
        <DialogContent className="max-w-lg border-4 border-black rounded-none">
          <DialogHeader>
            <DialogTitle className="font-bebas text-4xl tracking-tight">PAYMENT PROOF</DialogTitle>
          </DialogHeader>
          {selectedProof && (
            <div className="relative aspect-video border-2 border-black overflow-hidden bg-[#FFF4CC]">
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
            className="w-full rounded-none border-2 border-black font-bebas text-lg"
          >
            <Download className="h-4 w-4 mr-2" />
            Download Image
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
