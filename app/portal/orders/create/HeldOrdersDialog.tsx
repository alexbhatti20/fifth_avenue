'use client';

import { motion } from 'framer-motion';
import {
  Pause,
  Play,
  Trash2,
  ShoppingCart,
  Crown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { HeldOrder } from './types';

interface HeldOrdersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  heldOrders: HeldOrder[];
  onRestore: (order: HeldOrder) => void;
  onDelete: (orderId: string) => void;
}

export function HeldOrdersDialog({
  open,
  onOpenChange,
  heldOrders,
  onRestore,
  onDelete,
}: HeldOrdersDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <Pause className="h-6 w-6" />
            Held Orders ({heldOrders.length})
          </DialogTitle>
          <DialogDescription>
            Select an order to restore or delete it
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-3 py-4">
            {heldOrders.map((order) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 border rounded-xl hover:border-primary/50 transition-all bg-card"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">
                        {order.customerName || 'Walk-in Customer'}
                      </p>
                      {order.registeredCustomer && (
                        <Badge variant="secondary" className="text-xs">
                          <Crown className="h-3 w-3 mr-1" />
                          Registered
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <ShoppingCart className="h-3 w-3" />
                        {order.cart?.length || 0} items
                      </span>
                      <span className="font-medium text-foreground">
                        Rs. {order.cartTotal?.toLocaleString() || 0}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Held at {new Date(order.timestamp).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => onDelete(order.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => onRestore(order)}
                      className="bg-gradient-to-r from-primary to-orange-500"
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Restore
                    </Button>
                  </div>
                </div>
                {/* Cart Preview */}
                {order.cart && order.cart.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex flex-wrap gap-1">
                      {order.cart.slice(0, 3).map((item, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {item.quantity}x {item.menuItem?.name?.substring(0, 15)}
                          {item.menuItem?.name?.length > 15 ? '...' : ''}
                        </Badge>
                      ))}
                      {order.cart.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{order.cart.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
            {heldOrders.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Pause className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No held orders</p>
              </div>
            )}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
