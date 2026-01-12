'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  RotateCcw,
  ArrowDownLeft,
  ArrowUpRight,
  ClipboardCheck,
  Trash2,
  Plus,
  History,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { InventoryItem, StockTransaction, TransactionType } from '@/lib/inventory-queries';

const getTransactionIcon = (type: TransactionType) => {
  const icons: Record<TransactionType, React.ReactNode> = {
    purchase: <TrendingUp className="h-3.5 w-3.5" />,
    usage: <TrendingDown className="h-3.5 w-3.5" />,
    waste: <Trash2 className="h-3.5 w-3.5" />,
    adjustment: <ArrowUpDown className="h-3.5 w-3.5" />,
    return: <RotateCcw className="h-3.5 w-3.5" />,
    transfer_in: <ArrowDownLeft className="h-3.5 w-3.5" />,
    transfer_out: <ArrowUpRight className="h-3.5 w-3.5" />,
    count: <ClipboardCheck className="h-3.5 w-3.5" />,
    initial: <Plus className="h-3.5 w-3.5" />,
  };
  return icons[type] || <ArrowUpDown className="h-3.5 w-3.5" />;
};

const getTransactionColor = (type: TransactionType): string => {
  const colors: Record<TransactionType, string> = {
    purchase: 'bg-green-500/10 text-green-500',
    usage: 'bg-red-500/10 text-red-500',
    waste: 'bg-orange-500/10 text-orange-500',
    adjustment: 'bg-blue-500/10 text-blue-500',
    return: 'bg-purple-500/10 text-purple-500',
    transfer_in: 'bg-cyan-500/10 text-cyan-500',
    transfer_out: 'bg-pink-500/10 text-pink-500',
    count: 'bg-indigo-500/10 text-indigo-500',
    initial: 'bg-gray-500/10 text-gray-500',
  };
  return colors[type] || 'bg-gray-500/10 text-gray-500';
};

interface TransactionHistoryDialogProps {
  item: InventoryItem | null;
  transactions: StockTransaction[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransactionHistoryDialog({
  item,
  transactions,
  open,
  onOpenChange,
}: TransactionHistoryDialogProps) {
  if (!item) return null;

  // Filter transactions for this item
  const itemTransactions = (Array.isArray(transactions) ? transactions : []).filter((t) => t.item_id === item.id);

  // Calculate totals
  const totals = itemTransactions.reduce(
    (acc, t) => {
      if (t.quantity > 0) acc.totalIn += t.quantity;
      if (t.quantity < 0) acc.totalOut += Math.abs(t.quantity);
      return acc;
    },
    { totalIn: 0, totalOut: 0 }
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Transaction History
          </DialogTitle>
          <DialogDescription>
            {item.name} ({item.sku})
          </DialogDescription>
        </DialogHeader>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 py-2">
          <div className="p-3 rounded-lg bg-green-500/10">
            <p className="text-xs text-green-600 dark:text-green-400">Total In</p>
            <p className="text-lg font-bold text-green-600 dark:text-green-400">
              +{totals.totalIn.toFixed(2)} {item.unit}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-red-500/10">
            <p className="text-xs text-red-600 dark:text-red-400">Total Out</p>
            <p className="text-lg font-bold text-red-600 dark:text-red-400">
              -{totals.totalOut.toFixed(2)} {item.unit}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-blue-500/10">
            <p className="text-xs text-blue-600 dark:text-blue-400">Net Change</p>
            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
              {(totals.totalIn - totals.totalOut).toFixed(2)} {item.unit}
            </p>
          </div>
        </div>

        <ScrollArea className="h-[400px] pr-4">
          {itemTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <History className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No transactions recorded</p>
              <p className="text-sm text-muted-foreground/70">
                Stock adjustments will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {itemTransactions.map((tx, index) => (
                <div
                  key={tx.id}
                  className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'p-2 rounded-lg',
                          getTransactionColor(tx.type)
                        )}
                      >
                        {getTransactionIcon(tx.type)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge className={cn('text-xs', getTransactionColor(tx.type))}>
                            {tx.type.replace('_', ' ')}
                          </Badge>
                          <span
                            className={cn(
                              'font-bold',
                              tx.quantity > 0 ? 'text-green-500' : 'text-red-500'
                            )}
                          >
                            {tx.quantity > 0 ? '+' : ''}
                            {tx.quantity} {tx.unit || item.unit}
                          </span>
                        </div>
                        <p className="text-sm mt-1">{tx.reason}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                          <span>By: {tx.performed_by}</span>
                          {tx.reference_number && (
                            <span>Ref: {tx.reference_number}</span>
                          )}
                          {tx.batch_number && (
                            <span>Batch: {tx.batch_number}</span>
                          )}
                          {tx.total_cost && tx.total_cost !== 0 && (
                            <span>
                              Cost: Rs. {Math.abs(tx.total_cost).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground whitespace-nowrap">
                      <p>{format(new Date(tx.created_at), 'MMM d, yyyy')}</p>
                      <p>{format(new Date(tx.created_at), 'h:mm a')}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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

export default TransactionHistoryDialog;
