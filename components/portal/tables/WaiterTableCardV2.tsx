'use client';

import { memo, useMemo, useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Timer, ShoppingCart, Star, User, Receipt, ReceiptText, Sparkles, Zap, Clock,
  Edit2, Trash2, MoreVertical, CheckCircle2, AlertCircle, Coffee, Send,
  Phone, StickyNote, CalendarDays, Loader2, CheckCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { sendOrderToBillingAction } from '@/lib/actions';

/** Convert HH:MM or HH:MM:SS (24-h) string → 12-h h:mm AM/PM */
function fmt12h(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`;
}
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
  onCompleteOrder?: (orderId: string, tableId: string) => void;
  onViewDetails: (table: WaiterTable) => void;
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
    tableBg: 'bg-white',
    tableRing: 'ring-black',
    tableShadow: 'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]',
    pulse: 'bg-[#008A45]',
    glow: 'none',
    numberBg: 'bg-black',
    accent: 'text-[#008A45]',
    border: 'border-black',
  },
  occupied: {
    tableBg: 'bg-[#FFD200]',
    tableRing: 'ring-black',
    tableShadow: 'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]',
    pulse: 'bg-[#ED1C24]',
    glow: 'none',
    numberBg: 'bg-black',
    accent: 'text-[#ED1C24]',
    border: 'border-black',
  },
  reserved: {
    tableBg: 'bg-[#FFD200]/20',
    tableRing: 'ring-black',
    tableShadow: 'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]',
    pulse: 'bg-[#FFD200]',
    glow: 'none',
    numberBg: 'bg-black',
    accent: 'text-[#FFD200]',
    border: 'border-black',
  },
  cleaning: {
    tableBg: 'bg-black/5',
    tableRing: 'ring-black',
    tableShadow: 'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]',
    pulse: 'bg-[#008A45]',
    glow: 'none',
    numberBg: 'bg-black',
    accent: 'text-black',
    border: 'border-black',
  },
  out_of_service: {
    tableBg: 'bg-black/10',
    tableRing: 'ring-black',
    tableShadow: 'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]',
    pulse: 'bg-black/40',
    glow: 'none',
    numberBg: 'bg-black/40',
    accent: 'text-black/40',
    border: 'border-black',
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
  onCompleteOrder,
  onViewDetails,
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
  const [isSendingBill, setIsSendingBill] = useState(false);
  const [billSentThisSession, setBillSentThisSession] = useState(false);
  
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
          'bg-white border-4 border-black rounded-none shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]',
          'transition-all',
          isMyTable && 'ring-4 ring-[#FFD200]'
        )}
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

        {/* My Table Badge — bottom-left corner, away from the three-dot menu */}
        {isMyTable && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute bottom-2 left-2 z-20"
          >
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500 text-white shadow-md">
              <Star className="h-2.5 w-2.5 fill-current" />
              MINE
            </span>
          </motion.div>
        )}

        <CardContent className="p-3 sm:p-4">
          {/* Realistic Table Visualization */}
          <div className="relative flex justify-center mb-3">
            {/* Table Surface */}
            <motion.div
              className={cn(
                'relative w-20 h-20 sm:w-24 sm:h-24 border-4 border-black rounded-none',
                style.tableBg,
                style.tableShadow
              )}
            >
              {/* Table Number */}
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  className={cn(
                    'w-10 h-10 sm:w-12 sm:h-12 border-2 border-[#FFD200] flex items-center justify-center',
                    'text-[#FFD200] font-bebas text-2xl sm:text-3xl bg-black',
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
                    'absolute w-3 h-3 sm:w-4 sm:h-4 border-2 border-black rounded-none',
                    i < (table.current_customers || 0)
                      ? 'bg-black' // Occupied chair
                      : 'bg-white' // Empty chair
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
                'gap-1 px-3 py-1 font-bebas text-lg tracking-widest text-white rounded-none border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]',
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

            {/* Reservation Info — shown when status is reserved */}
            {table.status === 'reserved' && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-1.5 px-2 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/50 text-left space-y-1"
              >
                {table.reserved_by_name && (
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                    <User className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{table.reserved_by_name}</span>
                  </div>
                )}
                {/* Phone — stored in reserved_by field for some RPCs */}
                {(table as any).reserved_by_phone && (
                  <div className="flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-500">
                    <Phone className="h-3 w-3 flex-shrink-0" />
                    <span>{(table as any).reserved_by_phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-[10px] text-amber-600 dark:text-amber-500">
                  {(table.reservation_arrival_time ?? table.reservation_time) && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {table.reservation_arrival_time
                        ? fmt12h(table.reservation_arrival_time)
                        : new Date(table.reservation_time!).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </span>
                  )}
                  {table.reservation_party_size && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {table.reservation_party_size} guests
                    </span>
                  )}
                </div>
                {(table as any).reservation_date && (
                  <div className="flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-500">
                    <CalendarDays className="h-3 w-3 flex-shrink-0" />
                    <span>{(table as any).reservation_date}</span>
                  </div>
                )}
                {table.reservation_notes && (
                  <div className="flex items-start gap-1.5 text-[10px] text-amber-600 dark:text-amber-500">
                    <StickyNote className="h-3 w-3 flex-shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{table.reservation_notes}</span>
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {/* Current Order Card — only shown when table is occupied */}
          <AnimatePresence>
            {table.status === 'occupied' && table.current_order && (() => {
              const ord = table.current_order;
              // Extract short ref: last segment of ORD-YYYYMMDD-000043 → #43
              const shortRef = (() => {
                const parts = (ord.order_number ?? '').split('-');
                const last = parts[parts.length - 1];
                return '#' + (last ? String(parseInt(last, 10)) : ord.order_number);
              })();
              const elapsed = occupiedDuration;
              const elapsedLabel = elapsed < 60
                ? `${elapsed}m ago`
                : `${Math.floor(elapsed / 60)}h ${elapsed % 60}m ago`;
              // Status badge colour
              const statusCfg: Record<string, { bg: string; text: string; dot: string; label: string }> = {
                pending:    { bg: 'bg-amber-100 dark:bg-amber-900/40',    text: 'text-amber-700 dark:text-amber-400',   dot: 'bg-amber-500',   label: 'Pending' },
                confirmed:  { bg: 'bg-blue-100 dark:bg-blue-900/40',     text: 'text-blue-700 dark:text-blue-400',    dot: 'bg-blue-500',    label: 'Confirmed' },
                preparing:  { bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-700 dark:text-orange-400',dot: 'bg-orange-500',  label: 'Preparing' },
                ready:      { bg: 'bg-emerald-100 dark:bg-emerald-900/40',text: 'text-emerald-700 dark:text-emerald-400',dot: 'bg-emerald-500',label: 'Ready' },
                delivered:  { bg: 'bg-teal-100 dark:bg-teal-900/40',    text: 'text-teal-700 dark:text-teal-400',    dot: 'bg-teal-500',    label: 'Delivered' },
                completed:  { bg: 'bg-slate-100 dark:bg-slate-800',      text: 'text-slate-600 dark:text-slate-400',  dot: 'bg-slate-400',   label: 'Completed' },
                cancelled:  { bg: 'bg-red-100 dark:bg-red-900/40',       text: 'text-red-700 dark:text-red-400',      dot: 'bg-red-500',     label: 'Cancelled' },
              };
              const sc = statusCfg[ord.status as string] ?? statusCfg.confirmed;
              return (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3"
                >
                  <div className={cn(
                    'border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                  )}>
                    {/* Header row */}
                    <div className="flex items-center justify-between px-2.5 pt-2 pb-1.5 bg-black text-[#FFD200]">
                      <div className="flex items-center gap-1.5">
                        <Zap className="h-3 w-3 flex-shrink-0" />
                        <span className="text-sm font-bebas tracking-wider">{shortRef}</span>
                      </div>
                      <span className="text-lg font-bebas tracking-tighter">
                        RS.&nbsp;{ord.total?.toLocaleString()}
                      </span>
                    </div>
                    {/* Detail row */}
                    <div className="flex items-center justify-between px-2.5 pb-2 bg-white gap-2">
                      {/* Status badge */}
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 border border-black font-bebas text-xs tracking-widest uppercase', sc.bg, sc.text)}>
                        {sc.label}
                      </span>
                      {/* Items */}
                      <span className="flex items-center gap-1 text-[10px] font-source-sans font-black text-black uppercase">
                        <ShoppingCart className="h-3 w-3" />{ord.items_count} ITEMS
                      </span>
                      {/* Elapsed */}
                      {elapsed > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-source-sans font-black text-black/60 uppercase">
                          <Timer className="h-3 w-3" />{elapsedLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })()}
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
          {/* Take Table Button — only when not already assigned to me */}
          {isAvailable && isWaiter && !isMyTable && (
            <motion.div 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full"
            >
              <Button
                size="sm"
                className="w-full h-10 font-bebas text-lg tracking-widest text-black bg-[#FFD200] border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
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
                    'w-full h-10 font-bebas text-lg tracking-widest border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all',
                    table.current_order
                      ? 'bg-black text-[#FFD200]'
                      : 'bg-[#FFD200] text-black'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTakeOrder(table);
                  }}
                >
                  {table.current_order ? (
                    <Edit2 className="h-4 w-4 mr-1.5" />
                  ) : (
                    <ShoppingCart className="h-4 w-4 mr-1.5" />
                  )}
                  {table.current_order ? 'Edit Order' : 'Take Order'}
                </Button>
              </motion.div>

              {/* Send to Billing — self-contained, no redirect, idempotent */}
              {(() => {
                const ord = table.current_order;
                if (!ord) return null;
                const invoiceStatus = ord.invoice_payment_status;
                // Already paid / cancelled / refunded → hide entirely
                if (invoiceStatus === 'paid' || invoiceStatus === 'cancelled' || invoiceStatus === 'refunded') return null;
                // Invoice exists and is pending → already in billing queue
                const alreadyInBilling = (ord.has_invoice || billSentThisSession) && invoiceStatus !== 'paid';
                return (
                  <motion.div whileHover={{ scale: alreadyInBilling ? 1 : 1.02 }} whileTap={{ scale: alreadyInBilling ? 1 : 0.98 }}>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={alreadyInBilling || isSendingBill}
                      className={
                        alreadyInBilling
                          ? 'w-full h-8 text-xs font-semibold border-slate-300 bg-slate-50 text-slate-400 dark:bg-slate-800/40 dark:text-slate-500 cursor-default'
                          : 'w-full h-8 text-xs font-semibold border-emerald-400 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400'
                      }
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (alreadyInBilling || isSendingBill || !ord.id) return;
                        setIsSendingBill(true);
                        try {
                          const result = await sendOrderToBillingAction(ord.id);
                          if (!result.success) {
                            toast.error(result.error || 'Failed to send bill');
                          } else if (result.already_exists) {
                            toast.info(`Bill already in billing queue (${result.invoice_number})`);
                            setBillSentThisSession(true);
                          } else {
                            toast.success(`Bill sent to billing! (${result.invoice_number})`, {
                              description: 'Billing staff can now process payment',
                              duration: 4000,
                            });
                            setBillSentThisSession(true);
                          }
                        } catch {
                          toast.error('Failed to send bill to billing');
                        } finally {
                          setIsSendingBill(false);
                        }
                      }}
                    >
                      {isSendingBill ? (
                        <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Sending…</>
                      ) : alreadyInBilling ? (
                        <><CheckCheck className="h-3.5 w-3.5 mr-1.5" />Bill Sent to Billing</>
                      ) : (
                        <><ReceiptText className="h-3.5 w-3.5 mr-1.5" />Send to Billing</>
                      )}
                    </Button>
                  </motion.div>
                );
              })()}

              {table.current_order && onCompleteOrder && (
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-8 text-xs font-semibold border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:bg-violet-950/30 dark:text-violet-400"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (table.current_order?.id) {
                        onCompleteOrder(table.current_order.id, table.id);
                      }
                    }}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                    Complete Order
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
