'use client';

import { Plus, Minus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CartItem } from './types';

// ==========================================
// CART ITEM ROW COMPONENT
// Mobile-optimized with touch-friendly controls
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
    <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg sm:rounded-xl bg-white dark:bg-zinc-800/50 shadow-sm border border-border/50">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-xs sm:text-sm truncate">{item.name}</p>
        <p className="text-[10px] sm:text-xs text-muted-foreground">
          Rs. {item.price} × {item.quantity}
        </p>
      </div>
      <div className="flex items-center gap-0.5 sm:gap-1">
        <Button
          size="sm"
          variant="outline"
          className="h-7 w-7 sm:h-8 sm:w-8 p-0 rounded-full active:scale-90 transition-transform"
          onClick={onDecrease}
        >
          <Minus className="h-3 w-3" />
        </Button>
        <span className="w-6 sm:w-8 text-center font-bold text-xs sm:text-sm">{item.quantity}</span>
        <Button
          size="sm"
          variant="outline"
          className="h-7 w-7 sm:h-8 sm:w-8 p-0 rounded-full active:scale-90 transition-transform"
          onClick={onIncrease}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      <span className="font-bold text-xs sm:text-sm w-16 sm:w-20 text-right text-primary">
        Rs. {(item.price * item.quantity).toLocaleString()}
      </span>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 w-7 sm:h-8 sm:w-8 p-0 rounded-full text-red-500 hover:text-red-600 hover:bg-red-500/10 active:scale-90 transition-transform"
        onClick={onRemove}
      >
        <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      </Button>
    </div>
  );
}
