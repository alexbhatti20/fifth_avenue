'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  RotateCcw,
  ArrowDownLeft,
  ArrowUpRight,
  ClipboardCheck,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { InventoryItem, TransactionType, StockAdjustmentData } from '@/lib/inventory-queries';

const TRANSACTION_TYPES: {
  value: TransactionType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  direction: 'add' | 'remove' | 'set';
}[] = [
  {
    value: 'purchase',
    label: 'Purchase',
    description: 'Add stock from purchase',
    icon: <TrendingUp className="h-4 w-4" />,
    color: 'text-green-500 bg-green-500/10',
    direction: 'add',
  },
  {
    value: 'usage',
    label: 'Usage',
    description: 'Remove stock for kitchen use',
    icon: <TrendingDown className="h-4 w-4" />,
    color: 'text-red-500 bg-red-500/10',
    direction: 'remove',
  },
  {
    value: 'waste',
    label: 'Waste',
    description: 'Record spoilage or damage',
    icon: <Trash2 className="h-4 w-4" />,
    color: 'text-orange-500 bg-orange-500/10',
    direction: 'remove',
  },
  {
    value: 'return',
    label: 'Return',
    description: 'Return stock from usage',
    icon: <RotateCcw className="h-4 w-4" />,
    color: 'text-purple-500 bg-purple-500/10',
    direction: 'add',
  },
  {
    value: 'transfer_in',
    label: 'Transfer In',
    description: 'Receive from another location',
    icon: <ArrowDownLeft className="h-4 w-4" />,
    color: 'text-cyan-500 bg-cyan-500/10',
    direction: 'add',
  },
  {
    value: 'transfer_out',
    label: 'Transfer Out',
    description: 'Send to another location',
    icon: <ArrowUpRight className="h-4 w-4" />,
    color: 'text-pink-500 bg-pink-500/10',
    direction: 'remove',
  },
  {
    value: 'count',
    label: 'Physical Count',
    description: 'Set exact quantity from count',
    icon: <ClipboardCheck className="h-4 w-4" />,
    color: 'text-indigo-500 bg-indigo-500/10',
    direction: 'set',
  },
  {
    value: 'adjustment',
    label: 'Adjustment',
    description: 'Manual stock correction',
    icon: <ArrowUpDown className="h-4 w-4" />,
    color: 'text-blue-500 bg-blue-500/10',
    direction: 'set',
  },
];

interface StockAdjustmentDialogProps {
  item: InventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: StockAdjustmentData) => Promise<void>;
}

export function StockAdjustmentDialog({
  item,
  open,
  onOpenChange,
  onSubmit,
}: StockAdjustmentDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [transactionType, setTransactionType] = useState<TransactionType>('purchase');
  const [quantity, setQuantity] = useState(0);
  const [reason, setReason] = useState('');
  const [unitCost, setUnitCost] = useState<number | undefined>();
  const [referenceNumber, setReferenceNumber] = useState('');
  const [batchNumber, setBatchNumber] = useState('');

  const selectedType = TRANSACTION_TYPES.find((t) => t.value === transactionType);

  const calculateNewStock = (): number => {
    if (!item) return 0;

    switch (selectedType?.direction) {
      case 'add':
        return item.current_stock + quantity;
      case 'remove':
        return item.current_stock - quantity;
      case 'set':
        return quantity;
      default:
        return item.current_stock;
    }
  };

  const handleSubmit = async () => {
    if (!item) return;

    if (quantity <= 0 && selectedType?.direction !== 'set') {
      toast.error('Please enter a valid quantity');
      return;
    }

    if (!reason.trim()) {
      toast.error('Please provide a reason for this adjustment');
      return;
    }

    const newStock = calculateNewStock();
    if (newStock < 0 && transactionType !== 'adjustment' && transactionType !== 'count') {
      toast.error(`Insufficient stock. Cannot remove ${quantity} ${item.unit}`);
      return;
    }

    setIsLoading(true);
    try {
      await onSubmit({
        itemId: item.id,
        transactionType,
        quantity,
        reason,
        unitCost: transactionType === 'purchase' ? unitCost : undefined,
        referenceNumber: referenceNumber || undefined,
        batchNumber: batchNumber || undefined,
      });

      // Reset form
      setQuantity(0);
      setReason('');
      setUnitCost(undefined);
      setReferenceNumber('');
      setBatchNumber('');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to adjust stock');
    } finally {
      setIsLoading(false);
    }
  };

  if (!item) return null;

  const newStock = calculateNewStock();
  const stockChange = newStock - item.current_stock;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Stock Adjustment</DialogTitle>
          <DialogDescription>
            Adjust stock for <strong>{item.name}</strong> ({item.sku})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Stock Display */}
          <div className="p-4 rounded-lg bg-zinc-100 dark:bg-zinc-800/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current Stock</p>
                <p className="text-3xl font-bold">
                  {item.current_stock} <span className="text-base font-normal">{item.unit}</span>
                </p>
              </div>
              <Badge
                className={cn(
                  item.status === 'in_stock' && 'bg-green-500/10 text-green-500',
                  item.status === 'low_stock' && 'bg-yellow-500/10 text-yellow-500',
                  item.status === 'out_of_stock' && 'bg-red-500/10 text-red-500'
                )}
              >
                {item.status.replace('_', ' ')}
              </Badge>
            </div>
          </div>

          {/* Transaction Type Selection */}
          <div className="space-y-2">
            <Label>Transaction Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {TRANSACTION_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setTransactionType(type.value)}
                  className={cn(
                    'flex items-center gap-2 p-3 rounded-lg border transition-all text-left',
                    transactionType === type.value
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  )}
                >
                  <span className={cn('p-1.5 rounded', type.color)}>{type.icon}</span>
                  <div>
                    <p className="font-medium text-sm">{type.label}</p>
                    <p className="text-xs text-muted-foreground">{type.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Quantity Input */}
          <div className="space-y-2">
            <Label htmlFor="quantity">
              {selectedType?.direction === 'set' ? 'New Quantity' : 'Quantity'} ({item.unit})
            </Label>
            <Input
              id="quantity"
              type="number"
              min="0"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
              className="text-lg"
            />
            {selectedType?.direction !== 'set' && (
              <p className="text-xs text-muted-foreground">
                {selectedType?.direction === 'add' ? 'Adding' : 'Removing'} {quantity} {item.unit}
              </p>
            )}
          </div>

          {/* Unit Cost (for purchases) */}
          {transactionType === 'purchase' && (
            <div className="space-y-2">
              <Label htmlFor="unitCost">Cost per Unit (Rs.)</Label>
              <Input
                id="unitCost"
                type="number"
                min="0"
                step="0.01"
                value={unitCost || item.cost_per_unit}
                onChange={(e) => setUnitCost(parseFloat(e.target.value) || undefined)}
                placeholder={`Default: Rs. ${item.cost_per_unit}`}
              />
              {quantity > 0 && (
                <p className="text-sm text-muted-foreground">
                  Total Cost: Rs. {((unitCost || item.cost_per_unit) * quantity).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {/* Reference & Batch Numbers */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reference">Reference #</Label>
              <Input
                id="reference"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="PO, Invoice #"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch">Batch #</Label>
              <Input
                id="batch"
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                placeholder="Batch number"
              />
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe the reason for this adjustment..."
              rows={2}
            />
          </div>

          {/* Preview */}
          {quantity > 0 && (
            <div className="p-4 rounded-lg border bg-muted/30">
              <p className="text-sm font-medium mb-2">Stock Preview</p>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-lg font-bold">{item.current_stock}</p>
                  <p className="text-xs text-muted-foreground">Current</p>
                </div>
                <div className={cn('text-lg font-bold', stockChange >= 0 ? 'text-green-500' : 'text-red-500')}>
                  {stockChange >= 0 ? '+' : ''}{stockChange.toFixed(2)}
                </div>
                <div className="text-center">
                  <p className={cn('text-lg font-bold', newStock < item.min_stock && 'text-yellow-500', newStock <= 0 && 'text-red-500')}>
                    {newStock.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">New</p>
                </div>
              </div>
              {newStock <= 0 && (
                <p className="text-xs text-red-500 mt-2">⚠️ Item will be out of stock</p>
              )}
              {newStock > 0 && newStock <= item.min_stock && (
                <p className="text-xs text-yellow-500 mt-2">⚠️ Stock will be below minimum level</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || quantity <= 0}>
            {isLoading ? 'Processing...' : 'Confirm Adjustment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default StockAdjustmentDialog;
