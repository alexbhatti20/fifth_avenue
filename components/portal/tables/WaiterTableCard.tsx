'use client';

import { motion } from 'framer-motion';
import { Users, Timer, Utensils, ShoppingCart, Star, User, Receipt } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { STATUS_CONFIG } from './status-config';
import type { WaiterTable } from './types';

// ==========================================
// WAITER TABLE CARD COMPONENT
// Advanced UI with animated lava gradients
// ==========================================

interface WaiterTableCardProps {
  table: WaiterTable;
  onClaimTable: (tableId: string) => void;
  onTakeOrder: (table: WaiterTable) => void;
  onViewDetails: (table: WaiterTable) => void;
  onGenerateBill?: (orderId: string) => void;
  isWaiter: boolean;
}

export function WaiterTableCard({
  table,
  onClaimTable,
  onTakeOrder,
  onViewDetails,
  onGenerateBill,
  isWaiter,
}: WaiterTableCardProps) {
  const config = STATUS_CONFIG[table.status];
  const isMyTable = table.is_my_table;
  const isAvailable = table.status === 'available';
  const isOccupied = table.status === 'occupied';
  const occupiedDuration = table.current_order?.created_at
    ? Math.floor((Date.now() - new Date(table.current_order.created_at).getTime()) / 60000)
    : 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ scale: 1.03, y: -5 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="relative group"
    >
      {/* Animated Glow Border - RED & BLACK */}
      <div
        className={cn(
          'absolute -inset-[2px] rounded-xl opacity-75 blur-sm transition-all duration-500',
          'group-hover:opacity-100 group-hover:blur-md'
        )}
        style={{
          background: 'linear-gradient(90deg, #C8102E, #1a1a1a, #dc2626, #141414, #C8102E)',
          backgroundSize: '300% 300%',
          animation: 'lavaFlow 3s ease-in-out infinite',
        }}
      />
      
      {/* Secondary glow layer for depth */}
      <div
        className="absolute -inset-[1px] rounded-xl opacity-50"
        style={{
          background: 'linear-gradient(45deg, #C8102E, transparent, #dc2626, transparent, #C8102E)',
          backgroundSize: '400% 400%',
          animation: 'shimmer 2s linear infinite',
        }}
      />

      <Card
        className={cn(
          'relative overflow-hidden border-0 transition-all duration-300 cursor-pointer',
          isMyTable && 'ring-2 ring-red-500 ring-offset-2 ring-offset-zinc-100'
        )}
        style={{
          background: isMyTable 
            ? 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 30%, #fecaca 60%, #fef2f2 100%)'
            : 'linear-gradient(135deg, #fafafa 0%, #f5f5f5 30%, #e5e5e5 60%, #fafafa 100%)',
        }}
        onClick={() => {
          if (isAvailable && isWaiter) {
            onClaimTable(table.id);
          } else if (isMyTable) {
            onTakeOrder(table);
          } else {
            onViewDetails(table);
          }
        }}
      >
        {/* Animated Gradient Top Bar - RED */}
        <motion.div
          className="absolute top-0 left-0 right-0 h-2 overflow-hidden"
          initial={{ opacity: 0.8 }}
          animate={{ opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div
            className="h-full w-[200%]"
            style={{
              background: 'linear-gradient(90deg, #C8102E, #dc2626, #ef4444, #C8102E, #991b1b, #C8102E)',
              backgroundSize: '200% 100%',
              animation: 'slideGradient 2s linear infinite',
            }}
          />
        </motion.div>

        {/* My Table Badge - RED */}
        {isMyTable && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-3 right-2 z-10"
          >
            <Badge 
              className="text-white border-0 shadow-lg"
              style={{
                background: 'linear-gradient(90deg, #C8102E, #dc2626, #ef4444)',
                backgroundSize: '200% 200%',
                animation: 'lavaFlow 2s ease-in-out infinite',
              }}
            >
              <Star className="h-3 w-3 mr-1 animate-pulse" />
              My Table
            </Badge>
          </motion.div>
        )}

        <CardHeader className="pb-2 pt-5">
          <div className="flex items-center gap-3">
            {/* Animated Table Number Badge - RED/BLACK */}
            <motion.div
              className={cn(
                'w-14 h-14 rounded-xl flex items-center justify-center font-bold text-xl shadow-lg relative overflow-hidden',
                'text-white'
              )}
              whileHover={{ rotate: [0, -5, 5, 0] }}
              style={{
                background: 'linear-gradient(135deg, #C8102E, #dc2626, #ef4444, #C8102E)',
                backgroundSize: '300% 300%',
                animation: 'lavaFlow 3s ease-in-out infinite',
              }}
            >
              {/* Inner shimmer effect */}
              <div 
                className="absolute inset-0 opacity-40"
                style={{
                  background: 'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)',
                  backgroundSize: '200% 200%',
                  animation: 'shimmer 1.5s linear infinite',
                }}
              />
              <span className="relative z-10 drop-shadow-md">{table.table_number}</span>
            </motion.div>
            <div>
              <CardTitle className="text-lg font-bold bg-gradient-to-r from-zinc-900 to-red-700 bg-clip-text text-transparent">
                TABLE {table.table_number}
              </CardTitle>
              <CardDescription className="flex items-center gap-1 text-zinc-600">
                <Users className="h-3 w-3" />
                {table.capacity} seats
                {table.section && (
                  <span className="text-xs ml-2 px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-700">
                    {table.section}
                  </span>
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pb-3 space-y-2">
          {/* Animated Status Badge - RED */}
          <motion.div
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Badge
              className="gap-1.5 px-3 py-1 font-medium text-white border-0 shadow-md"
              style={{
                background: 'linear-gradient(90deg, #C8102E, #ef4444, #C8102E)',
                backgroundSize: '200% 100%',
                animation: 'slideGradient 2s linear infinite',
              }}
            >
              {config.icon}
              {config.label}
            </Badge>
          </motion.div>

          {/* Occupied Duration */}
          {table.status === 'occupied' && occupiedDuration > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 text-sm"
            >
              <Timer className="h-4 w-4 text-red-600" />
              <span
                className={cn(
                  'font-medium',
                  occupiedDuration > 60 ? 'text-red-600' : 'text-red-500'
                )}
              >
                {occupiedDuration} min
              </span>
            </motion.div>
          )}

          {/* Current Order Info - RED */}
          {table.current_order && (
            <motion.div 
              className="p-2 rounded-lg relative overflow-hidden"
              animate={{ boxShadow: ['0 0 10px rgba(200,16,46,0.2)', '0 0 15px rgba(200,16,46,0.3)', '0 0 10px rgba(200,16,46,0.2)'] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{
                background: 'linear-gradient(135deg, rgba(254,226,226,0.8), rgba(254,242,242,0.9), rgba(254,226,226,0.8))',
              }}
            >
              {/* Animated border */}
              <div 
                className="absolute inset-0 rounded-lg"
                style={{
                  background: 'linear-gradient(90deg, #C8102E, #ef4444, #C8102E, #dc2626, #C8102E)',
                  backgroundSize: '300% 100%',
                  animation: 'slideGradient 3s linear infinite',
                  padding: '1px',
                  mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                  maskComposite: 'exclude',
                  WebkitMaskComposite: 'xor',
                }}
              />
              <div className="flex items-center justify-between relative z-10">
                <span className="text-xs font-bold text-red-700">
                  #{table.current_order.order_number}
                </span>
                <span className="text-xs font-bold bg-gradient-to-r from-red-700 to-red-500 bg-clip-text text-transparent">
                  Rs. {table.current_order.total?.toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-zinc-600 mt-1 relative z-10">
                {table.current_order.items_count} items
              </p>
            </motion.div>
          )}

          {/* Assigned Waiter */}
          {table.assigned_waiter && !isMyTable && (
            <div className="flex items-center gap-2 text-xs text-zinc-600">
              <User className="h-3 w-3" />
              {table.assigned_waiter.name}
            </div>
          )}
        </CardContent>

        <CardFooter className="pt-0 flex-col gap-2">
          {isAvailable && isWaiter && (
            <motion.div className="w-full" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                className="w-full relative overflow-hidden text-white shadow-lg border-0 font-semibold"
                style={{
                  background: 'linear-gradient(90deg, #C8102E, #dc2626, #ef4444, #dc2626, #C8102E)',
                  backgroundSize: '300% 100%',
                  animation: 'lavaFlow 3s ease-in-out infinite',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onClaimTable(table.id);
                }}
              >
                <Utensils className="h-4 w-4 mr-2" />
                Take This Table
              </Button>
            </motion.div>
          )}
          {isMyTable && (
            <div className="w-full space-y-2">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  className="w-full relative overflow-hidden text-white shadow-lg border-0 font-semibold"
                  style={{
                    background: 'linear-gradient(90deg, #C8102E, #dc2626, #ef4444, #dc2626, #C8102E)',
                    backgroundSize: '300% 100%',
                    animation: 'lavaFlow 3s ease-in-out infinite',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTakeOrder(table);
                  }}
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  {table.current_order ? 'Add Items' : 'Take Order'}
                </Button>
              </motion.div>
              
              {/* Generate Bill Button - Only show when table has active order */}
              {table.current_order && onGenerateBill && (
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    variant="outline"
                    className="w-full bg-green-50 hover:bg-green-100 border-green-500 text-green-700 font-semibold"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (table.current_order?.id) {
                        onGenerateBill(table.current_order.id);
                      }
                    }}
                  >
                    <Receipt className="h-4 w-4 mr-2" />
                    Generate Bill
                  </Button>
                </motion.div>
              )}
            </div>
          )}
        </CardFooter>
      </Card>
      
      {/* CSS Keyframes */}
      <style jsx global>{`
        @keyframes lavaFlow {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes slideGradient {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </motion.div>
  );
}
