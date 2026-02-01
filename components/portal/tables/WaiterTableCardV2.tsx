'use client';

import { memo, useMemo } from 'react';
import { Users, Timer, ShoppingCart, Star, User, Receipt, Sparkles, Zap, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { STATUS_CONFIG } from './status-config';
import type { WaiterTable } from './types';

// ==========================================
// WAITER TABLE CARD V2 - MOBILE OPTIMIZED
// Modern glassmorphism design with status-based colors
// Memoized for performance, touch-friendly
// ==========================================

interface WaiterTableCardProps {
  table: WaiterTable;
  onClaimTable: (tableId: string) => void;
  onTakeOrder: (table: WaiterTable) => void;
  onViewDetails: (table: WaiterTable) => void;
  onGenerateBill?: (orderId: string) => void;
  isWaiter: boolean;
  index?: number;
}

// Status-specific gradient configurations
const STATUS_GRADIENTS = {
  available: {
    card: 'from-emerald-50 via-green-50 to-teal-50 dark:from-emerald-950/40 dark:via-green-950/30 dark:to-teal-950/40',
    border: 'border-emerald-200/60 dark:border-emerald-700/40',
    glow: 'rgba(16, 185, 129, 0.15)',
    badge: 'bg-gradient-to-r from-emerald-500 to-green-500',
    number: 'bg-gradient-to-br from-emerald-500 via-green-500 to-teal-500',
    accent: 'text-emerald-600 dark:text-emerald-400',
  },
  occupied: {
    card: 'from-rose-50 via-red-50 to-orange-50 dark:from-rose-950/40 dark:via-red-950/30 dark:to-orange-950/40',
    border: 'border-rose-200/60 dark:border-rose-700/40',
    glow: 'rgba(239, 68, 68, 0.15)',
    badge: 'bg-gradient-to-r from-rose-500 to-red-500',
    number: 'bg-gradient-to-br from-rose-500 via-red-500 to-orange-500',
    accent: 'text-rose-600 dark:text-rose-400',
  },
  reserved: {
    card: 'from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-950/40 dark:via-yellow-950/30 dark:to-orange-950/40',
    border: 'border-amber-200/60 dark:border-amber-700/40',
    glow: 'rgba(245, 158, 11, 0.15)',
    badge: 'bg-gradient-to-r from-amber-500 to-yellow-500',
    number: 'bg-gradient-to-br from-amber-500 via-yellow-500 to-orange-500',
    accent: 'text-amber-600 dark:text-amber-400',
  },
  cleaning: {
    card: 'from-sky-50 via-blue-50 to-cyan-50 dark:from-sky-950/40 dark:via-blue-950/30 dark:to-cyan-950/40',
    border: 'border-sky-200/60 dark:border-sky-700/40',
    glow: 'rgba(14, 165, 233, 0.15)',
    badge: 'bg-gradient-to-r from-sky-500 to-blue-500',
    number: 'bg-gradient-to-br from-sky-500 via-blue-500 to-cyan-500',
    accent: 'text-sky-600 dark:text-sky-400',
  },
  out_of_service: {
    card: 'from-slate-50 via-gray-50 to-zinc-50 dark:from-slate-950/40 dark:via-gray-950/30 dark:to-zinc-950/40',
    border: 'border-slate-200/60 dark:border-slate-700/40',
    glow: 'rgba(100, 116, 139, 0.15)',
    badge: 'bg-gradient-to-r from-slate-500 to-gray-500',
    number: 'bg-gradient-to-br from-slate-500 via-gray-500 to-zinc-500',
    accent: 'text-slate-600 dark:text-slate-400',
  },
};

// Memoized card component for better performance
function WaiterTableCardV2Component({
  table,
  onClaimTable,
  onTakeOrder,
  onViewDetails,
  onGenerateBill,
  isWaiter,
  index = 0,
}: WaiterTableCardProps) {
  const config = STATUS_CONFIG[table.status];
  const gradient = STATUS_GRADIENTS[table.status] || STATUS_GRADIENTS.available;
  const isMyTable = table.is_my_table;
  const isAvailable = table.status === 'available';

  // Memoize duration calculation
  const occupiedDuration = useMemo(() => {
    if (!table.current_order?.created_at) return 0;
    return Math.floor((Date.now() - new Date(table.current_order.created_at).getTime()) / 60000);
  }, [table.current_order?.created_at]);

  // Memoize click handler
  const handleCardClick = () => {
    if (isAvailable && isWaiter) {
      onClaimTable(table.id);
    } else if (isMyTable) {
      onTakeOrder(table);
    } else {
      onViewDetails(table);
    }
  };

  return (
    <div className="relative group">
      {/* My Table Ring */}
      {isMyTable && (
        <div
          className="absolute -inset-[2px] sm:-inset-[3px] rounded-xl sm:rounded-2xl opacity-80"
          style={{
            background: 'linear-gradient(135deg, #f59e0b, #ef4444, #f59e0b)',
          }}
        />
      )}

      <Card
        className={cn(
          'relative overflow-hidden cursor-pointer transition-all duration-200',
          'bg-gradient-to-br backdrop-blur-sm',
          'border shadow-sm active:scale-[0.98]',
          gradient.card,
          gradient.border,
          isMyTable && 'ring-0'
        )}
        onClick={handleCardClick}
      >
        {/* Top Accent Line */}
        <div className={cn('absolute top-0 inset-x-0 h-0.5 sm:h-1', gradient.badge)} />

        {/* My Table Badge */}
        {isMyTable && (
          <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 z-10">
            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-lg gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px]">
              <Star className="h-2.5 w-2.5 sm:h-3 sm:w-3 fill-current" />
              <span className="font-bold">MINE</span>
            </Badge>
          </div>
        )}

        <CardHeader className="pb-1.5 sm:pb-2 pt-3 sm:pt-4 px-2.5 sm:px-3">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Table Number Badge */}
            <div
              className={cn(
                'w-9 h-9 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center',
                'font-bold text-sm sm:text-lg text-white shadow-md',
                'relative overflow-hidden shrink-0',
                gradient.number
              )}
            >
              <span className="relative z-10 drop-shadow">{table.table_number}</span>
            </div>

            <div className="min-w-0 flex-1">
              <CardTitle className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 truncate">
                Table {table.table_number}
              </CardTitle>
              <CardDescription className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs">
                <Users className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" />
                <span>{table.capacity} seats</span>
                {table.section && (
                  <Badge variant="outline" className="ml-0.5 sm:ml-1 text-[8px] sm:text-[9px] px-1 sm:px-1.5 py-0 h-3.5 sm:h-4">
                    {table.section}
                  </Badge>
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pb-1.5 sm:pb-2 px-2.5 sm:px-3 space-y-1.5 sm:space-y-2">
          {/* Status Badge */}
          <Badge
            className={cn(
              'gap-0.5 sm:gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-semibold text-white border-0 shadow',
              gradient.badge
            )}
          >
            {config.icon}
            {config.label}
          </Badge>

          {/* Duration Timer */}
          {table.status === 'occupied' && occupiedDuration > 0 && (
            <div className="flex items-center gap-1 sm:gap-1.5">
              <Clock className={cn('h-3 w-3 sm:h-3.5 sm:w-3.5', occupiedDuration > 45 ? 'text-red-500' : gradient.accent)} />
              <span className={cn(
                'text-[10px] sm:text-xs font-medium',
                occupiedDuration > 45 ? 'text-red-600' : gradient.accent
              )}>
                {occupiedDuration < 60 
                  ? `${occupiedDuration}m` 
                  : `${Math.floor(occupiedDuration / 60)}h ${occupiedDuration % 60}m`
                }
              </span>
              {occupiedDuration > 45 && (
                <Badge variant="destructive" className="text-[8px] sm:text-[9px] px-1 py-0 h-3.5 sm:h-4">Long</Badge>
              )}
            </div>
          )}

          {/* Current Order */}
          {table.current_order && (
            <div
              className={cn(
                'p-1.5 sm:p-2 rounded-md sm:rounded-lg border bg-white/60 dark:bg-black/20',
                'backdrop-blur-sm',
                gradient.border
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-0.5 sm:gap-1">
                  <Zap className={cn('h-2.5 w-2.5 sm:h-3 sm:w-3', gradient.accent)} />
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 dark:text-slate-200">
                    #{table.current_order.order_number}
                  </span>
                </div>
                <span className={cn('text-[10px] sm:text-xs font-bold', gradient.accent)}>
                  Rs. {table.current_order.total?.toLocaleString()}
                </span>
              </div>
              <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                {table.current_order.items_count} items
              </p>
            </div>
          )}

          {/* Assigned Waiter */}
          {table.assigned_waiter && !isMyTable && (
            <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400">
              <User className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              <span className="truncate">{table.assigned_waiter.name}</span>
            </div>
          )}
        </CardContent>

        <CardFooter className="pt-0.5 sm:pt-1 pb-2.5 sm:pb-3 px-2.5 sm:px-3 flex-col gap-1 sm:gap-1.5">
          {/* Take Table Button */}
          {isAvailable && isWaiter && (
            <Button
              size="sm"
              className={cn(
                'w-full h-7 sm:h-8 text-[10px] sm:text-xs font-semibold text-white shadow-md',
                'transition-all duration-200 active:scale-95',
                gradient.badge
              )}
              onClick={(e) => {
                e.stopPropagation();
                onClaimTable(table.id);
              }}
            >
              <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 sm:mr-1.5" />
              Take Table
            </Button>
          )}

          {/* My Table Actions */}
          {isMyTable && (
            <div className="w-full space-y-1 sm:space-y-1.5">
              <Button
                size="sm"
                className={cn(
                  'w-full h-7 sm:h-8 text-[10px] sm:text-xs font-semibold text-white shadow-md',
                  'transition-all duration-200 active:scale-95',
                  'bg-gradient-to-r from-amber-500 via-orange-500 to-red-500'
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onTakeOrder(table);
                }}
              >
                <ShoppingCart className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 sm:mr-1.5" />
                {table.current_order ? 'Add Items' : 'Take Order'}
              </Button>

              {table.current_order && onGenerateBill && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-7 sm:h-8 text-[10px] sm:text-xs font-semibold border-emerald-300 bg-emerald-50 text-emerald-700 active:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (table.current_order?.id) {
                      onGenerateBill(table.current_order.id);
                    }
                  }}
                >
                  <Receipt className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 sm:mr-1.5" />
                  Generate Bill
                </Button>
              )}
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

// Export memoized component
export const WaiterTableCardV2 = memo(WaiterTableCardV2Component);
