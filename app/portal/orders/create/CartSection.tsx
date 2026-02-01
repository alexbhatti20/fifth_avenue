'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Receipt,
  Loader2,
  Gift,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { CartItem, RegisteredCustomer } from './types';

interface CartSectionProps {
  cart: CartItem[];
  orderNotes: string;
  registeredCustomer: RegisteredCustomer | null;
  isSubmitting: boolean;
  onUpdateQuantity: (cartId: string, delta: number) => void;
  onRemoveItem: (cartId: string) => void;
  onNotesChange: (notes: string) => void;
  onSubmitOrder: () => void;
}

export function CartSection({
  cart,
  orderNotes,
  registeredCustomer,
  isSubmitting,
  onUpdateQuantity,
  onRemoveItem,
  onNotesChange,
  onSubmitOrder,
}: CartSectionProps) {
  // Calculate totals
  const cartTotal = cart.reduce((sum, item) => {
    const price = item.variantPrice || item.menuItem.price;
    return sum + (price * item.quantity);
  }, 0);

  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Card className="sticky top-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Order Cart
          </span>
          <Badge variant="secondary">{cartItemsCount} items</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {cart.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Cart is empty</p>
            <p className="text-sm">Add items from the menu</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-3">
              <AnimatePresence>
                {cart.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.menuItem.name}</p>
                      {item.variant && (
                        <p className="text-xs text-muted-foreground">{item.variant}</p>
                      )}
                      <p className="text-sm font-semibold text-red-600">
                        Rs. {((item.variantPrice || item.menuItem.price) * item.quantity).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onUpdateQuantity(item.id, -1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center text-sm font-medium">
                        {item.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onUpdateQuantity(item.id, 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500"
                        onClick={() => onRemoveItem(item.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </ScrollArea>
        )}

        <Separator className="my-4" />

        {/* Order Notes */}
        <div className="mb-4">
          <Label htmlFor="orderNotes">Order Notes (Optional)</Label>
          <Textarea
            id="orderNotes"
            placeholder="Special instructions..."
            value={orderNotes}
            onChange={(e) => onNotesChange(e.target.value)}
            className="mt-1"
            rows={2}
          />
        </div>

        {/* Totals */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Subtotal</span>
            <span>Rs. {cartTotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Tax (5%)</span>
            <span>Rs. {Math.round(cartTotal * 0.05).toLocaleString()}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-bold text-lg">
            <span>Total</span>
            <span className="text-red-600">
              Rs. {Math.round(cartTotal * 1.05).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Loyalty Points Info for Registered Customer */}
        {registeredCustomer && (
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <Gift className="h-4 w-4" />
              <span className="text-sm font-medium">
                Customer will earn {Math.floor(Math.round(cartTotal * 1.05) / 100)} loyalty points
              </span>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <motion.div className="mt-4" whileTap={{ scale: 0.98 }}>
          <Button
            className="w-full h-12 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg text-lg font-semibold"
            onClick={onSubmitOrder}
            disabled={isSubmitting || cart.length === 0}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Creating Order...
              </>
            ) : (
              <>
                <Receipt className="h-5 w-5 mr-2" />
                Create Order
              </>
            )}
          </Button>
        </motion.div>
      </CardContent>
    </Card>
  );
}
