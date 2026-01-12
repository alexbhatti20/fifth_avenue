'use client';

import { motion } from 'framer-motion';
import { Plus, Minus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CartItem } from './types';

// ==========================================
// CART ITEM ROW COMPONENT
// ==========================================

interface CartItemRowProps {
  item: CartItem;
  onIncrease: () => void;
  onDecrease: () => void;
  onRemove: () => void;
}

export function CartItemRow({
  item,
  onIncrease,
  onDecrease,
  onRemove,
}: CartItemRowProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50"
    >
      <div className="flex-1">
        <p className="font-medium text-sm">{item.name}</p>
        <p className="text-xs text-muted-foreground">
          Rs. {item.price} × {item.quantity}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          className="h-7 w-7 p-0"
          onClick={onDecrease}
        >
          <Minus className="h-3 w-3" />
        </Button>
        <span className="w-8 text-center font-medium">{item.quantity}</span>
        <Button
          size="sm"
          variant="outline"
          className="h-7 w-7 p-0"
          onClick={onIncrease}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      <span className="font-bold text-sm w-20 text-right">
        Rs. {(item.price * item.quantity).toLocaleString()}
      </span>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"
        onClick={onRemove}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </motion.div>
  );
}
