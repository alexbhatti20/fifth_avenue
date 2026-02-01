'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  RotateCcw,
  ArrowDownLeft,
  ArrowUpRight,
  ClipboardCheck,
  Trash2,
  Package,
  History,
  Calendar,
  User,
  Hash,
  FileText,
  Loader2,
  Search,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  PlayCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getInventoryTransactionsServer, deleteInventoryTransactionServer } from '@/lib/actions';
import type { InventoryItem, StockTransaction, TransactionType } from '@/lib/inventory-queries';

// Transaction type configuration - same as StockAdjustmentDialog
const TRANSACTION_CONFIG: Record<TransactionType, { label: string; icon: React.ElementType; color: string; direction: string }> = {
  purchase: { label: 'Purchase', icon: TrendingUp, color: 'text-green-500 bg-green-500/10', direction: 'in' },
  usage: { label: 'Usage', icon: TrendingDown, color: 'text-red-500 bg-red-500/10', direction: 'out' },
  waste: { label: 'Waste', icon: Trash2, color: 'text-orange-500 bg-orange-500/10', direction: 'out' },
  return: { label: 'Return', icon: RotateCcw, color: 'text-purple-500 bg-purple-500/10', direction: 'in' },
  transfer_in: { label: 'Transfer In', icon: ArrowDownLeft, color: 'text-cyan-500 bg-cyan-500/10', direction: 'in' },
  transfer_out: { label: 'Transfer Out', icon: ArrowUpRight, color: 'text-pink-500 bg-pink-500/10', direction: 'out' },
  count: { label: 'Physical Count', icon: ClipboardCheck, color: 'text-indigo-500 bg-indigo-500/10', direction: 'set' },
  adjustment: { label: 'Adjustment', icon: ArrowUpDown, color: 'text-blue-500 bg-blue-500/10', direction: 'set' },
  initial: { label: 'Initial Stock', icon: PlayCircle, color: 'text-slate-500 bg-slate-500/10', direction: 'set' },
};

interface TransactionHistoryDialogProps {
  item: InventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransactionDeleted?: () => void;
}

// Format date for display
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

// Format relative time
function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateString);
}

export function TransactionHistoryDialog({
  item,
  open,
  onOpenChange,
  onTransactionDeleted,
}: TransactionHistoryDialogProps) {
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTransaction, setDeleteTransaction] = useState<StockTransaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load transactions when dialog opens
  useEffect(() => {
    if (open && item) {
      const loadTransactions = async () => {
        setIsLoading(true);
        setSearchTerm('');
        setExpandedId(null);
        try {
          const data = await getInventoryTransactionsServer(item.id);
          setTransactions(Array.isArray(data) ? data : []);
        } catch (error: any) {
          toast.error('Failed to load transaction history');
          setTransactions([]);
        } finally {
          setIsLoading(false);
        }
      };
      loadTransactions();
    }
  }, [open, item]);

  // Calculate summary stats
  const summary = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    let totalCost = 0;

    transactions.forEach((t) => {
      const config = TRANSACTION_CONFIG[t.type];
      if (config?.direction === 'in') {
        totalIn += t.quantity;
        if (t.unit_cost) totalCost += t.quantity * t.unit_cost;
      } else if (config?.direction === 'out') {
        totalOut += Math.abs(t.quantity);
      }
    });

    return { totalIn, totalOut, netChange: totalIn - totalOut, totalCost };
  }, [transactions]);

  // Filter transactions by search
  const filteredTransactions = useMemo(() => {
    if (!searchTerm.trim()) return transactions;
    const term = searchTerm.toLowerCase();
    return transactions.filter(
      (t) =>
        t.reason?.toLowerCase().includes(term) ||
        t.reference_number?.toLowerCase().includes(term) ||
        t.batch_number?.toLowerCase().includes(term) ||
        TRANSACTION_CONFIG[t.type]?.label.toLowerCase().includes(term)
    );
  }, [transactions, searchTerm]);

  // Handle delete
  const handleDelete = async () => {
    if (!deleteTransaction) return;
    setIsDeleting(true);
    try {
      await deleteInventoryTransactionServer(deleteTransaction.id, item!.id);
      setTransactions((prev) => prev.filter((t) => t.id !== deleteTransaction.id));
      toast.success('Transaction deleted');
      onTransactionDeleted?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete transaction');
    } finally {
      setIsDeleting(false);
      setDeleteTransaction(null);
    }
  };

  if (!item) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="pb-0">
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-blue-500" />
              Transaction History
            </DialogTitle>
            <DialogDescription>
              All stock movements for <strong>{item.name}</strong> (SKU: {item.sku})
            </DialogDescription>
          </DialogHeader>

          {/* Item Summary Card */}
          <div className="p-4 rounded-lg bg-gradient-to-br from-zinc-100 to-zinc-50 dark:from-zinc-800 dark:to-zinc-900 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase">Current Stock</p>
              <p className="text-xl font-bold text-primary">{item.current_stock.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{item.unit}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase">Total In</p>
              <p className="text-xl font-bold text-green-500">+{summary.totalIn.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{item.unit}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase">Total Out</p>
              <p className="text-xl font-bold text-red-500">-{summary.totalOut.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{item.unit}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase">Net Change</p>
              <p className={cn(
                'text-xl font-bold',
                summary.netChange >= 0 ? 'text-green-500' : 'text-red-500'
              )}>
                {summary.netChange >= 0 ? '+' : ''}{summary.netChange.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">{item.unit}</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by reason, reference, batch..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <XCircle className="h-4 w-4" />
              </button>
            )}
          </div>

          <Separator />

          {/* Transaction List */}
          <div className="flex-1 min-h-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <Package className="h-12 w-12 mb-3 opacity-30" />
                <p className="font-medium">
                  {searchTerm ? 'No matching transactions' : 'No transactions yet'}
                </p>
                <p className="text-sm">
                  {searchTerm ? 'Try a different search term' : 'Stock adjustments will appear here'}
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[320px] pr-4">
                <div className="space-y-2">
                  {filteredTransactions.map((transaction) => {
                    const config = TRANSACTION_CONFIG[transaction.type];
                    const Icon = config?.icon || ArrowUpDown;
                    const isExpanded = expandedId === transaction.id;

                    return (
                      <div
                        key={transaction.id}
                        className={cn(
                          'border rounded-lg overflow-hidden transition-colors',
                          isExpanded && 'border-primary/50 bg-muted/30'
                        )}
                      >
                        {/* Transaction Row */}
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : transaction.id)}
                          className="w-full p-3 flex items-center gap-3 text-left hover:bg-muted/50"
                        >
                          <span className={cn('p-2 rounded-lg', config?.color)}>
                            <Icon className="h-4 w-4" />
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{config?.label || transaction.type}</span>
                              <Badge variant="outline" className="text-xs">
                                {transaction.quantity >= 0 ? '+' : ''}{transaction.quantity} {item.unit}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{transaction.reason || 'No reason'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">{getRelativeTime(transaction.created_at)}</p>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>

                        {/* Expanded Details */}
                        {isExpanded && (
                          <div className="p-3 pt-0 border-t bg-muted/20 space-y-3">
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">Date:</span>
                                <span>{formatDate(transaction.created_at)}</span>
                              </div>
                              {transaction.unit_cost && (
                                <div className="flex items-center gap-2">
                                  <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-muted-foreground">Cost:</span>
                                  <span>Rs. {transaction.unit_cost}/unit</span>
                                </div>
                              )}
                              {transaction.reference_number && (
                                <div className="flex items-center gap-2">
                                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-muted-foreground">Ref:</span>
                                  <span className="truncate">{transaction.reference_number}</span>
                                </div>
                              )}
                              {transaction.batch_number && (
                                <div className="flex items-center gap-2">
                                  <Package className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-muted-foreground">Batch:</span>
                                  <span className="truncate">{transaction.batch_number}</span>
                                </div>
                              )}
                              {transaction.performed_by && (
                                <div className="flex items-center gap-2">
                                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-muted-foreground">By:</span>
                                  <span className="truncate">{transaction.performed_by}</span>
                                </div>
                              )}
                              {transaction.total_cost && (
                                <div className="flex items-center gap-2">
                                  <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-muted-foreground">Total:</span>
                                  <span>Rs. {transaction.total_cost.toLocaleString()}</span>
                                </div>
                              )}
                            </div>

                            {transaction.reason && (
                              <div className="p-2 rounded bg-background border text-sm">
                                <p className="text-muted-foreground text-xs mb-1">Reason:</p>
                                <p>{transaction.reason}</p>
                              </div>
                            )}

                            <div className="flex justify-end">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteTransaction(transaction);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Footer Stats */}
          {!isLoading && filteredTransactions.length > 0 && (
            <div className="pt-2 text-xs text-muted-foreground text-center">
              Showing {filteredTransactions.length} of {transactions.length} transactions
              {summary.totalCost > 0 && (
                <span className="ml-2">• Total purchase cost: Rs. {summary.totalCost.toLocaleString()}</span>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTransaction} onOpenChange={() => setDeleteTransaction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete Transaction
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will reverse the stock change. The current stock of <strong>{item?.current_stock} {item?.unit}</strong> will be adjusted.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Transaction'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default TransactionHistoryDialog;
