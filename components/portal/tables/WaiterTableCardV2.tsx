'use client';

import { memo, useMemo, useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Timer, ShoppingCart, Star, User, Receipt, Sparkles, Zap, Clock,
  Edit2, Trash2, MoreVertical, CheckCircle2, AlertCircle, Coffee, Send
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { STATUS_CONFIG } from './status-config';
import type { WaiterTable } from './types';

// ==========================================
// WAITER TABLE CARD V2 - REALISTIC TABLE DESIGN
// Modern glassmorphism with real table appearance
// Animated status indicators with soft red/green gradients
// ==========================================

interface WaiterTableCardProps {
  table: WaiterTable;
  onClaimTable: (tableId: string) => void;
  onTakeOrder: (table: WaiterTable) => void;
  onViewDetails: (table: WaiterTable) => void;
  onGenerateBill?: (orderId: string) => void;
  onEditTable?: (table: WaiterTable) => void;
  onDeleteTable?: (tableId: string) => void;
  onUpdateStatus?: (tableId: string, status: string) => void;
  onReleaseTable?: (tableId: string, setToCleaning?: boolean) => void;
  onViewOrderDetails?: (table: WaiterTable) => void;
  onSendToBilling?: (table: WaiterTable) => void;
  isWaiter: boolean;
  isAdmin?: boolean;
  userRole?: string;
  index?: number;
}

// Animated pulse colors for different states
const STATUS_STYLES = {
  available: {
    tableBg: 'bg-gradient-to-br from-emerald-100 via-green-50 to-teal-100 dark:from-emerald-900/60 dark:via-green-900/40 dark:to-teal-900/50',
    tableRing: 'ring-emerald-400/50 dark:ring-emerald-500/40',
    tableShadow: 'shadow-emerald-200/60 dark:shadow-emerald-900/40',
    pulse: 'bg-emerald-400',
    glow: '0 0 20px rgba(16, 185, 129, 0.3)',
    numberBg: 'bg-gradient-to-br from-emerald-500 to-green-600',
    accent: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-300/60 dark:border-emerald-600/40',
  },
  occupied: {
    tableBg: 'bg-gradient-to-br from-rose-100 via-red-50 to-orange-100 dark:from-rose-900/60 dark:via-red-900/40 dark:to-orange-900/50',
    tableRing: 'ring-rose-400/50 dark:ring-rose-500/40',
    tableShadow: 'shadow-rose-200/60 dark:shadow-rose-900/40',
    pulse: 'bg-rose-400',
    glow: '0 0 20px rgba(239, 68, 68, 0.3)',
    numberBg: 'bg-gradient-to-br from-rose-500 to-red-600',
    accent: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-300/60 dark:border-rose-600/40',
  },
  reserved: {
    tableBg: 'bg-gradient-to-br from-amber-100 via-yellow-50 to-orange-100 dark:from-amber-900/60 dark:via-yellow-900/40 dark:to-orange-900/50',
    tableRing: 'ring-amber-400/50 dark:ring-amber-500/40',
    tableShadow: 'shadow-amber-200/60 dark:shadow-amber-900/40',
    pulse: 'bg-amber-400',
    glow: '0 0 20px rgba(245, 158, 11, 0.3)',
    numberBg: 'bg-gradient-to-br from-amber-500 to-orange-600',
    accent: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-300/60 dark:border-amber-600/40',
  },
  cleaning: {
    tableBg: 'bg-gradient-to-br from-sky-100 via-blue-50 to-cyan-100 dark:from-sky-900/60 dark:via-blue-900/40 dark:to-cyan-900/50',
    tableRing: 'ring-sky-400/50 dark:ring-sky-500/40',
    tableShadow: 'shadow-sky-200/60 dark:shadow-sky-900/40',
    pulse: 'bg-sky-400',
    glow: '0 0 20px rgba(14, 165, 233, 0.3)',
    numberBg: 'bg-gradient-to-br from-sky-500 to-blue-600',
    accent: 'text-sky-600 dark:text-sky-400',
    border: 'border-sky-300/60 dark:border-sky-600/40',
  },
  out_of_service: {
    tableBg: 'bg-gradient-to-br from-slate-200 via-gray-100 to-zinc-200 dark:from-slate-800/60 dark:via-gray-800/40 dark:to-zinc-800/50',
    tableRing: 'ring-slate-400/50 dark:ring-slate-500/40',
    tableShadow: 'shadow-slate-200/60 dark:shadow-slate-900/40',
    pulse: 'bg-slate-400',
    glow: '0 0 10px rgba(100, 116, 139, 0.2)',
    numberBg: 'bg-gradient-to-br from-slate-500 to-gray-600',
    accent: 'text-slate-600 dark:text-slate-400',
    border: 'border-slate-300/60 dark:border-slate-600/40',
  },
};

// Chair positions for visual representation
const CHAIR_POSITIONS = {
  2: [{ top: '-8px', left: '50%', transform: 'translateX(-50%)' }, { bottom: '-8px', left: '50%', transform: 'translateX(-50%)' }],
  4: [
    { top: '-8px', left: '50%', transform: 'translateX(-50%)' },
    { bottom: '-8px', left: '50%', transform: 'translateX(-50%)' },
    { left: '-8px', top: '50%', transform: 'translateY(-50%)' },
    { right: '-8px', top: '50%', transform: 'translateY(-50%)' },
  ],
  6: [
    { top: '-8px', left: '30%' }, { top: '-8px', left: '70%', transform: 'translateX(-100%)' },
    { bottom: '-8px', left: '30%' }, { bottom: '-8px', left: '70%', transform: 'translateX(-100%)' },
    { left: '-8px', top: '50%', transform: 'translateY(-50%)' },
    { right: '-8px', top: '50%', transform: 'translateY(-50%)' },
  ],
};

function WaiterTableCardV2Component({
  table,
  onClaimTable,
  onTakeOrder,
  onViewDetails,
  onGenerateBill,
  onEditTable,
  onDeleteTable,
  onUpdateStatus,
  onReleaseTable,
  onViewOrderDetails,
  onSendToBilling,
  isWaiter,
  isAdmin = false,
  userRole = 'waiter',
  index = 0,
}: WaiterTableCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPending, startTransition] = useTransition();
  
  const config = STATUS_CONFIG[table.status];
  const style = STATUS_STYLES[table.status] || STATUS_STYLES.available;
  const isMyTable = table.is_my_table;
  const isAvailable = table.status === 'available';
  const isOccupied = table.status === 'occupied';
  const isAdminOrManager = userRole === 'admin' || userRole === 'manager';
  const hasOrder = !!table.current_order;

  // Get chair count based on capacity
  const chairCount = Math.min(table.capacity, 6);
  const chairPositions = CHAIR_POSITIONS[chairCount as keyof typeof CHAIR_POSITIONS] || CHAIR_POSITIONS[4];

  // Memoize duration calculation
  const occupiedDuration = useMemo(() => {
    if (!table.current_order?.created_at) return 0;
    return Math.floor((Date.now() - new Date(table.current_order.created_at).getTime()) / 60000);
  }, [table.current_order?.created_at]);

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
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ 
        duration: 0.4, 
        delay: index * 0.05,
        type: 'spring',
        stiffness: 200,
        damping: 20
      }}
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="relative"
    >
      {/* My Table Glow Ring */}
      <AnimatePresence>
        {isMyTable && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute -inset-1 rounded-2xl opacity-80 z-0"
            style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 50%, #f59e0b 100%)',
              backgroundSize: '200% 200%',
              animation: 'gradient-shift 3s ease infinite',
            }}
          />
        )}
      </AnimatePresence>

      <Card
        className={cn(
          'relative overflow-visible cursor-pointer z-10',
          'bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl',
          'border-2 shadow-xl',
          style.border,
          isMyTable && 'border-transparent'
        )}
        style={{ boxShadow: isHovered ? style.glow : undefined }}
        onClick={handleCardClick}
      >
        {/* Three-Dot Menu — Available to ALL roles with role-based options */}
        <div className="absolute top-2 right-2 z-20">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 bg-white/80 dark:bg-slate-800/80 shadow-sm hover:bg-white dark:hover:bg-slate-800"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {/* View Order Details — if table has an active order */}
              {hasOrder && onViewOrderDetails && (
                <>
                  <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); setTimeout(() => onViewOrderDetails(table), 80); }}
                  >
                    <Receipt className="h-4 w-4 mr-2 text-violet-500" />
                    View Order Details
                  </DropdownMenuItem>
                  {onSendToBilling && (
                    <DropdownMenuItem
                      onClick={(e) => { e.stopPropagation(); setTimeout(() => onSendToBilling(table), 80); }}
                    >
                      <Send className="h-4 w-4 mr-2 text-purple-500" />
                      Send Bill to Billing
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                </>
              )}

              {/* Status Changes — waiter can't set out_of_service */}
              {onUpdateStatus && (
                <>
                  <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); onUpdateStatus(table.id, 'available'); }}
                    disabled={table.status === 'available' || isOccupied}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-500" />
                    Set Available
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); onUpdateStatus(table.id, 'reserved'); }}
                    disabled={table.status === 'reserved' || isOccupied}
                  >
                    <Clock className="h-4 w-4 mr-2 text-amber-500" />
                    Set Reserved
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); onUpdateStatus(table.id, 'cleaning'); }}
                    disabled={table.status === 'cleaning'}
                  >
                    <Coffee className="h-4 w-4 mr-2 text-sky-500" />
                    Set Cleaning
                  </DropdownMenuItem>
                  {isAdminOrManager && (
                    <DropdownMenuItem
                      onClick={(e) => { e.stopPropagation(); onUpdateStatus(table.id, 'out_of_service'); }}
                      disabled={table.status === 'out_of_service'}
                    >
                      <AlertCircle className="h-4 w-4 mr-2 text-slate-500" />
                      Out of Service
                    </DropdownMenuItem>
                  )}
                </>
              )}

              {/* Admin / Manager Only — Edit & Delete */}
              {isAdminOrManager && (onEditTable || onDeleteTable) && (
                <>
                  <DropdownMenuSeparator />
                  {onEditTable && (
                    <DropdownMenuItem
                      onClick={(e) => { e.stopPropagation(); setTimeout(() => onEditTable(table), 80); }}
                    >
                      <Edit2 className="h-4 w-4 mr-2 text-blue-500" />
                      Edit Table
                    </DropdownMenuItem>
                  )}
                  {onDeleteTable && (
                    <DropdownMenuItem
                      onClick={(e) => { e.stopPropagation(); setTimeout(() => onDeleteTable(table.id), 80); }}
                      className="text-red-600 focus:text-red-600 dark:text-red-400"
                      disabled={isOccupied}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {isOccupied ? 'Cannot Delete (Occupied)' : 'Delete Table'}
                    </DropdownMenuItem>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* My Table Badge */}
        {isMyTable && (
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-2 left-1/2 -translate-x-1/2 z-20"
          >
            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-lg gap-1 px-2.5 py-1 text-[10px]">
              <Star className="h-3 w-3 fill-current" />
              MY TABLE
            </Badge>
          </motion.div>
        )}

        <CardContent className="p-3 sm:p-4">
          {/* Realistic Table Visualization */}
          <div className="relative flex justify-center mb-3">
            {/* Table Surface */}
            <motion.div
              animate={{
                boxShadow: isOccupied 
                  ? ['0 4px 20px rgba(239, 68, 68, 0.2)', '0 4px 30px rgba(239, 68, 68, 0.4)', '0 4px 20px rgba(239, 68, 68, 0.2)']
                  : isAvailable
                    ? ['0 4px 20px rgba(16, 185, 129, 0.2)', '0 4px 30px rgba(16, 185, 129, 0.4)', '0 4px 20px rgba(16, 185, 129, 0.2)']
                    : undefined
              }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className={cn(
                'relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl sm:rounded-2xl',
                'ring-2 shadow-lg',
                style.tableBg,
                style.tableRing,
                style.tableShadow
              )}
            >
              {/* Table Number */}
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  animate={isAvailable ? { scale: [1, 1.05, 1] } : {}}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className={cn(
                    'w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center',
                    'text-white font-bold text-lg sm:text-xl shadow-inner',
                    style.numberBg
                  )}
                >
                  {table.table_number}
                </motion.div>
              </div>

              {/* Chairs around table */}
              {chairPositions.slice(0, Math.min(table.current_customers || 0, chairCount) || chairCount).map((pos, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                  className={cn(
                    'absolute w-3 h-3 sm:w-4 sm:h-4 rounded-full',
                    'border-2 shadow-sm',
                    i < (table.current_customers || 0)
                      ? 'bg-slate-600 border-slate-700' // Occupied chair
                      : 'bg-slate-200 border-slate-300 dark:bg-slate-700 dark:border-slate-600' // Empty chair
                  )}
                  style={pos as any}
                />
              ))}

              {/* Status Pulse Indicator */}
              {(isAvailable || isOccupied) && (
                <motion.div
                  animate={{
                    scale: [1, 1.5, 1],
                    opacity: [0.7, 0, 0.7],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className={cn(
                    'absolute -top-1 -right-1 w-3 h-3 rounded-full',
                    style.pulse
                  )}
                />
              )}
            </motion.div>
          </div>

          {/* Table Info */}
          <div className="text-center space-y-1.5">
            <h3 className="font-bold text-base sm:text-lg text-slate-800 dark:text-slate-100">
              Table {table.table_number}
            </h3>
            
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
              <Users className="h-3.5 w-3.5" />
              <span>{table.current_customers || 0}/{table.capacity}</span>
              {table.section && (
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                  {table.section}
                </Badge>
              )}
            </div>

            {/* Status Badge */}
            <motion.div
              animate={isOccupied ? { scale: [1, 1.02, 1] } : {}}
              transition={{ duration: 1, repeat: Infinity }}
            >
              <Badge className={cn(
                'gap-1 px-2.5 py-1 text-[10px] sm:text-[11px] font-semibold text-white border-0 shadow',
                style.numberBg
              )}>
                {config.icon}
                {config.label}
              </Badge>
            </motion.div>

            {/* Duration Timer */}
            {isOccupied && occupiedDuration > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'flex items-center justify-center gap-1.5 text-xs font-medium',
                  occupiedDuration > 45 ? 'text-red-600' : style.accent
                )}
              >
                <Clock className="h-3.5 w-3.5" />
                <span>
                  {occupiedDuration < 60 
                    ? `${occupiedDuration}m` 
                    : `${Math.floor(occupiedDuration / 60)}h ${occupiedDuration % 60}m`}
                </span>
                {occupiedDuration > 45 && (
                  <Badge variant="destructive" className="text-[8px] px-1 py-0 h-4 animate-pulse">
                    Long
                  </Badge>
                )}
              </motion.div>
            )}
          </div>

          {/* Current Order Card */}
          <AnimatePresence>
            {table.current_order && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3"
              >
                <div className={cn(
                  'p-2.5 rounded-lg border bg-white/60 dark:bg-black/20 backdrop-blur-sm',
                  style.border
                )}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Zap className={cn('h-3.5 w-3.5', style.accent)} />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        #{table.current_order.order_number}
                      </span>
                    </div>
                    <span className={cn('text-sm font-bold', style.accent)}>
                      Rs. {table.current_order.total?.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                    {table.current_order.items_count} items
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Assigned Waiter */}
          {table.assigned_waiter && !isMyTable && (
            <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-slate-500">
              <User className="h-3 w-3" />
              <span>{table.assigned_waiter.name}</span>
            </div>
          )}
        </CardContent>

        <CardFooter className="pt-0 pb-3 px-3 flex-col gap-1.5">
          {/* Take Table Button */}
          {isAvailable && isWaiter && (
            <motion.div 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full"
            >
              <Button
                size="sm"
                className={cn(
                  'w-full h-9 text-xs font-semibold text-white shadow-lg',
                  'bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500',
                  'hover:from-emerald-600 hover:via-green-600 hover:to-teal-600'
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onClaimTable(table.id);
                }}
              >
                <Sparkles className="h-4 w-4 mr-1.5" />
                Take Table
              </Button>
            </motion.div>
          )}

          {/* My Table Actions */}
          {isMyTable && (
            <div className="w-full space-y-1.5">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  size="sm"
                  className={cn(
                    'w-full h-9 text-xs font-semibold text-white shadow-lg',
                    'bg-gradient-to-r from-amber-500 via-orange-500 to-red-500',
                    'hover:from-amber-600 hover:via-orange-600 hover:to-red-600'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTakeOrder(table);
                  }}
                >
                  <ShoppingCart className="h-4 w-4 mr-1.5" />
                  {table.current_order ? 'Add Items' : 'Take Order'}
                </Button>
              </motion.div>

              {table.current_order && onGenerateBill && (
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-8 text-xs font-semibold border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (table.current_order?.id) {
                        onGenerateBill(table.current_order.id);
                      }
                    }}
                  >
                    <Receipt className="h-3.5 w-3.5 mr-1.5" />
                    Generate Bill
                  </Button>
                </motion.div>
              )}

              {onReleaseTable && !table.current_order && (
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-8 text-xs font-semibold border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/30 dark:text-sky-400"
                    onClick={(e) => {
                      e.stopPropagation();
                      onReleaseTable(table.id, true);
                    }}
                  >
                    <Coffee className="h-3.5 w-3.5 mr-1.5" />
                    Release Table
                  </Button>
                </motion.div>
              )}
            </div>
          )}
        </CardFooter>
      </Card>

      {/* CSS for gradient animation */}
      <style jsx global>{`
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </motion.div>
  );
}

// Export memoized component
export const WaiterTableCardV2 = memo(WaiterTableCardV2Component);
