'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Receipt,
  Search,
  Utensils,
  ShoppingBag,
  User,
  Clock,
  CheckCircle,
  Phone,
  Star,
  Crown,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import type { BillableOrder } from './types';

const supabase = createClient();

const ORDER_TYPE_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  'dine-in': { color: 'bg-blue-500/10 text-blue-600', icon: <Utensils className="h-3 w-3" />, label: 'Dine-in' },
  'dine_in': { color: 'bg-blue-500/10 text-blue-600', icon: <Utensils className="h-3 w-3" />, label: 'Dine-in' },
  'online': { color: 'bg-purple-500/10 text-purple-600', icon: <ShoppingBag className="h-3 w-3" />, label: 'Online' },
  'walk-in': { color: 'bg-amber-500/10 text-amber-600', icon: <User className="h-3 w-3" />, label: 'Walk-in' },
};

// ==========================================
// BILLABLE ORDER CARD
// ==========================================

interface BillableOrderCardProps {
  order: BillableOrder;
  onGenerateBill: (orderId: string) => void;
}

function BillableOrderCard({ order, onGenerateBill }: BillableOrderCardProps) {
  const [isNavigating, setIsNavigating] = useState(false);
  const typeConfig = ORDER_TYPE_CONFIG[order.order_type] || ORDER_TYPE_CONFIG['walk-in'];
  
  const handleGenerateBill = () => {
    setIsNavigating(true);
    onGenerateBill(order.id);
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
    >
      <Card
        className={cn(
          'transition-all duration-200 hover:shadow-md',
          'border-2 hover:border-red-500/50',
          order.has_invoice && 'opacity-60 border-green-500/30'
        )}
      >
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
            {/* Left Side - Order Info */}
            <div className="flex items-start gap-2 sm:gap-3 flex-1">
              <div className={cn(
                'w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0',
                'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg'
              )}>
                <Receipt className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <span className="font-bold text-base sm:text-lg">#{order.order_number}</span>
                  <Badge className={cn('gap-1 text-[10px] sm:text-xs px-1.5 sm:px-2', typeConfig.color)}>
                    {typeConfig.icon}
                    <span className="hidden xs:inline">{typeConfig.label}</span>
                  </Badge>
                  {/* Online Order Badge */}
                  {(order as any).transaction_id && (
                    <Badge className="bg-purple-500/10 text-purple-600 gap-1 text-[10px] sm:text-xs border border-purple-200">
                      🌐 Online
                    </Badge>
                  )}
                  {order.has_invoice && (
                    <Badge className="bg-green-500/10 text-green-600 gap-1 text-[10px] sm:text-xs">
                      <CheckCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                      Billed
                    </Badge>
                  )}
                </div>
                
                <div className="mt-0.5 sm:mt-1 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                  <User className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{order.customer_name}</span>
                  {order.is_registered_customer && (
                    <span title="Registered Customer">
                      <Crown className="h-3 w-3 text-amber-500 flex-shrink-0" />
                    </span>
                  )}
                </div>
                
                {order.customer_phone && (
                  <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
                    <Phone className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    {order.customer_phone}
                  </div>
                )}
                
                {order.table_number && (
                  <div className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs flex items-center gap-1.5 flex-wrap">
                    <Badge variant="outline" className="text-[10px] sm:text-xs">
                      Table {order.table_number}
                    </Badge>
                    {order.waiter_name && (
                      <span className="text-muted-foreground">• {order.waiter_name}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {/* Right Side - Amount & Time */}
            <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 sm:gap-0 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0">
              <div className="flex items-center gap-2 sm:block sm:text-right">
                <p className="text-lg sm:text-xl font-bold text-red-600">
                  Rs. {order.total.toLocaleString()}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  {order.items_count} items
                </p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground sm:mt-1 justify-end">
                  <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  {new Date(order.created_at).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
                {order.customer_loyalty_points && order.customer_loyalty_points > 0 && (
                  <div className="flex items-center gap-1 text-[10px] sm:text-xs text-amber-600 mt-0.5 sm:mt-1 justify-end">
                    <Star className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    {order.customer_loyalty_points} pts
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Items Preview */}
          <div className="mt-3 pt-3 border-t">
            <div className="flex flex-wrap gap-1">
              {order.items.slice(0, 3).map((item, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {item.quantity}x {item.name}
                </Badge>
              ))}
              {order.items.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{order.items.length - 3} more
                </Badge>
              )}
            </div>
          </div>

          {/* Transaction ID for online payments */}
          {(order as any).transaction_id && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs bg-purple-500/10 text-purple-600 px-2 py-1.5 rounded border border-purple-200">
              <div className="flex items-center gap-1">
                <Receipt className="h-3 w-3" />
                <span className="font-bold">Online Payment</span>
                <span className="text-[10px] bg-green-500 text-white px-1.5 py-0.5 rounded-full font-bold">✓ VERIFIED</span>
              </div>
              <div className="flex items-center gap-1 w-full sm:w-auto">
                <span className="font-medium">TXN:</span>
                <span className="font-mono">{(order as any).transaction_id}</span>
              </div>
              {(order as any).online_payment_details?.method_name && (
                <span className="text-muted-foreground">via {(order as any).online_payment_details.method_name}</span>
              )}
            </div>
          )}
          
          {/* Generate Bill Button */}
          {!order.has_invoice && (
            <div className="mt-3 pt-3 border-t">
              <motion.div whileTap={{ scale: 0.95 }}>
                <Button 
                  className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg hover:shadow-red-500/25 transition-all duration-300"
                  onClick={handleGenerateBill}
                  disabled={isNavigating}
                >
                  {isNavigating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Receipt className="h-4 w-4 mr-2" />
                  )}
                  {isNavigating ? 'Loading...' : 'Generate Bill'}
                </Button>
              </motion.div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ==========================================
// PENDING ORDERS LIST
// ==========================================

interface PendingOrdersListProps {
  onSelectOrder: (order: BillableOrder) => void;
}

export function PendingOrdersList({ onSelectOrder }: PendingOrdersListProps) {
  const [orders, setOrders] = useState<BillableOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [orderTypeFilter, setOrderTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('pending_bill');

  useEffect(() => {
    fetchOrders();
  }, [orderTypeFilter, statusFilter]);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_billable_orders', {
        p_order_type: orderTypeFilter === 'all' ? null : orderTypeFilter,
        p_status_filter: statusFilter,
        p_limit: 50,
        p_offset: 0,
      });

      if (error) throw error;
      
      if (data?.success) {
        setOrders(data.orders || []);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleGenerateBill = (orderId: string) => {
    // Use window.location for reliable navigation
    window.location.href = `/portal/billing/${orderId}`;
  };

  const filteredOrders = orders.filter(order => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      order.order_number.toLowerCase().includes(query) ||
      order.customer_name.toLowerCase().includes(query) ||
      order.customer_phone?.includes(query)
    );
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-red-500" />
              Orders Awaiting Billing
            </CardTitle>
            <CardDescription>
              Click on an order to generate invoice
            </CardDescription>
          </div>
          <Button onClick={fetchOrders} variant="outline" size="sm">
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by order #, customer, phone..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={orderTypeFilter} onValueChange={setOrderTypeFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Order Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="dine-in">Dine-in</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="walk-in">Walk-in</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Orders</SelectItem>
              <SelectItem value="pending_bill">Pending Bill</SelectItem>
              <SelectItem value="billed">Already Billed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Orders List */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <div className="w-12 h-12 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-32" />
                      <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-48" />
                    </div>
                    <div className="text-right space-y-2">
                      <div className="h-6 bg-zinc-200 dark:bg-zinc-800 rounded w-24" />
                      <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-16" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">No orders awaiting billing</p>
          </div>
        ) : (
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-3">
              {filteredOrders.map((order) => (
                <BillableOrderCard
                  key={order.id}
                  order={order}
                  onGenerateBill={handleGenerateBill}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

export { BillableOrderCard };
