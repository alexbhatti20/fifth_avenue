'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
  AlertTriangle,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { InventoryItem, TransactionType, StockAdjustmentData } from '@/lib/inventory-queries';

// Transaction type configuration
const TRANSACTION_TYPES = [
  { value: 'purchase', label: 'Purchase', desc: 'Add stock from supplier', icon: TrendingUp, color: 'text-green-500 bg-green-500/10', direction: 'add' },
  { value: 'usage', label: 'Usage', desc: 'Remove for kitchen use', icon: TrendingDown, color: 'text-red-500 bg-red-500/10', direction: 'remove' },
  { value: 'waste', label: 'Waste', desc: 'Spoilage or damage', icon: Trash2, color: 'text-orange-500 bg-orange-500/10', direction: 'remove' },
  { value: 'return', label: 'Return', desc: 'Return unused stock', icon: RotateCcw, color: 'text-purple-500 bg-purple-500/10', direction: 'add' },
  { value: 'transfer_in', label: 'Transfer In', desc: 'From another location', icon: ArrowDownLeft, color: 'text-cyan-500 bg-cyan-500/10', direction: 'add' },
  { value: 'transfer_out', label: 'Transfer Out', desc: 'To another location', icon: ArrowUpRight, color: 'text-pink-500 bg-pink-500/10', direction: 'remove' },
  { value: 'count', label: 'Physical Count', desc: 'Set exact quantity', icon: ClipboardCheck, color: 'text-indigo-500 bg-indigo-500/10', direction: 'set' },
  { value: 'adjustment', label: 'Adjustment', desc: 'Manual correction', icon: ArrowUpDown, color: 'text-blue-500 bg-blue-500/10', direction: 'set' },
] as const;

interface StockAdjustmentDialogProps {
  item: InventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: StockAdjustmentData) => Promise<void>;
}

// Memoized type selector button
const TypeButton = memo(function TypeButton({
  type,
  isSelected,
  onClick,
}: {
  type: typeof TRANSACTION_TYPES[number];
  isSelected: boolean;
  onClick: () => void;
}) {
  const Icon = type.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 p-2.5 rounded-lg border text-left transition-colors',
        isSelected
          ? 'border-primary bg-primary/5 ring-1 ring-primary'
          : 'border-border hover:border-primary/50 hover:bg-muted/50'
      )}
    >
      <span className={cn('p-1.5 rounded', type.color)}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <p className="font-medium text-sm truncate">{type.label}</p>
        <p className="text-xs text-muted-foreground truncate">{type.desc}</p>
      </div>
    </button>
  );
});

export function StockAdjustmentDialog({
  item,
  open,
  onOpenChange,
  onSubmit,
}: StockAdjustmentDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [transactionType, setTransactionType] = useState<TransactionType>('purchase');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [batchNumber, setBatchNumber] = useState('');

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setTransactionType('purchase');
      setQuantity('');
      setReason('');
      setUnitCost('');
      setReferenceNumber('');
      setBatchNumber('');
      setIsLoading(false);
      setShowConfirmDialog(false);
    }
  }, [open]);

  const selectedType = TRANSACTION_TYPES.find(t => t.value === transactionType);
  const qty = parseFloat(quantity) || 0;
  const cost = parseFloat(unitCost) || 0;

  const calculateNewStock = useCallback(() => {
    if (!item) return 0;
    switch (selectedType?.direction) {
      case 'add': return item.current_stock + qty;
      case 'remove': return item.current_stock - qty;
      case 'set': return qty;
      default: return item.current_stock;
    }
  }, [item, selectedType, qty]);

  // Validate and show confirmation
  const handleShowConfirm = () => {
    if (!item) return;

    if (qty <= 0 && selectedType?.direction !== 'set') {
      toast.error('Please enter a valid quantity');
      return;
    }

    if (!reason.trim()) {
      toast.error('Please provide a reason');
      return;
    }

    const newStock = calculateNewStock();
    if (newStock < 0 && selectedType?.direction === 'remove') {
      toast.error(`Insufficient stock. Current: ${item.current_stock} ${item.unit}`);
      return;
    }

    setShowConfirmDialog(true);
  };

  // Actually submit after confirmation
  const handleConfirmedSubmit = async () => {
    if (!item) return;

    setIsLoading(true);
    setShowConfirmDialog(false);
    
    try {
      await onSubmit({
        itemId: item.id,
        transactionType,
        quantity: qty,
        reason: reason.trim(),
        unitCost: transactionType === 'purchase' && cost > 0 ? cost : undefined,
        referenceNumber: referenceNumber.trim() || undefined,
        batchNumber: batchNumber.trim() || undefined,
      });
      // Don't show toast here - let the parent handle it
      onOpenChange(false); // Close dialog on success
    } catch (error: any) {
      toast.error(error.message || 'Failed to adjust stock');
      setIsLoading(false);
    }
  };

  if (!item) return null;

  const newStock = calculateNewStock();
  const stockChange = newStock - item.current_stock;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl sm:w-[90vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-orange-500" />
            Stock Adjustment
          </DialogTitle>
          <DialogDescription>
            Adjust stock for <strong>{item.name}</strong> (SKU: {item.sku})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Current Stock & Item Info - Horizontal Layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-gradient-to-br from-zinc-100 to-zinc-50 dark:from-zinc-800 dark:to-zinc-900">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Current Stock</p>
              <p className="text-4xl font-bold mt-1">
                {item.current_stock.toLocaleString()}
                <span className="text-lg font-normal ml-1">{item.unit}</span>
              </p>
              <Badge
                variant="outline"
                className={cn(
                  'mt-2',
                  item.status === 'in_stock' && 'border-green-500 text-green-600',
                  item.status === 'low_stock' && 'border-yellow-500 text-yellow-600',
                  item.status === 'out_of_stock' && 'border-red-500 text-red-600'
                )}
              >
                {item.status === 'in_stock' && <CheckCircle className="h-3 w-3 mr-1" />}
                {item.status === 'low_stock' && <AlertTriangle className="h-3 w-3 mr-1" />}
                {item.status.replace('_', ' ')}
              </Badge>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Category:</span>
                <span className="font-medium">{item.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Min Stock:</span>
                <span className="font-medium">{item.min_stock} {item.unit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cost/Unit:</span>
                <span className="font-medium">Rs. {item.cost_per_unit.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Value:</span>
                <span className="font-medium">Rs. {item.total_value.toLocaleString()}</span>
              </div>
            </div>
            {/* Stock Preview - Always visible on right */}
            <div className="p-4 rounded-lg border-2 border-dashed bg-muted/30">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Stock Preview</p>
              <div className="flex items-center justify-between gap-2">
                <div className="text-center">
                  <p className="text-xl font-bold">{item.current_stock.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Current</p>
                </div>
                <div className={cn(
                  'text-xl font-bold',
                  stockChange >= 0 ? 'text-green-500' : 'text-red-500'
                )}>
                  {qty > 0 ? (stockChange >= 0 ? '+' : '') + stockChange.toFixed(1) : '→'}
                </div>
                <div className="text-center">
                  <p className={cn(
                    'text-xl font-bold',
                    qty > 0 && newStock < item.min_stock && 'text-yellow-500',
                    qty > 0 && newStock <= 0 && 'text-red-500'
                  )}>
                    {qty > 0 ? newStock.toFixed(1) : '?'}
                  </p>
                  <p className="text-xs text-muted-foreground">New</p>
                </div>
              </div>
              {qty > 0 && newStock <= 0 && (
                <p className="text-xs text-red-500 mt-2 text-center">Out of stock!</p>
              )}
              {qty > 0 && newStock > 0 && newStock <= item.min_stock && (
                <p className="text-xs text-yellow-600 mt-2 text-center">Below min level</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Transaction Type Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Transaction Type</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TRANSACTION_TYPES.map((type) => (
                <TypeButton
                  key={type.value}
                  type={type}
                  isSelected={transactionType === type.value}
                  onClick={() => setTransactionType(type.value as TransactionType)}
                />
              ))}
            </div>
          </div>

          {/* Quantity, Cost, Reference & Batch - All Horizontal */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">
                {selectedType?.direction === 'set' ? 'New Quantity' : 'Quantity'} *
              </Label>
              <Input
                id="quantity"
                type="number"
                min="0"
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={`Enter ${item.unit}`}
                className="text-lg h-11"
              />
              {qty > 0 && selectedType?.direction !== 'set' && (
                <p className="text-xs text-muted-foreground">
                  {selectedType?.direction === 'add' ? 'Adding' : 'Removing'} {qty} {item.unit}
                </p>
              )}
            </div>

            {transactionType === 'purchase' ? (
              <div className="space-y-2">
                <Label htmlFor="unitCost">Cost/Unit (Rs.)</Label>
                <Input
                  id="unitCost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  placeholder={`${item.cost_per_unit}`}
                  className="h-11"
                />
                {qty > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Total: Rs. {((cost || item.cost_per_unit) * qty).toLocaleString()}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="reference">Reference # (Optional)</Label>
                <Input
                  id="reference"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="PO, Invoice..."
                  className="h-11"
                />
              </div>
            )}

            {transactionType === 'purchase' ? (
              <div className="space-y-2">
                <Label htmlFor="reference">Reference # (Optional)</Label>
                <Input
                  id="reference"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="PO, Invoice..."
                  className="h-11"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="batch">Batch # (Optional)</Label>
                <Input
                  id="batch"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  placeholder="Batch number..."
                  className="h-11"
                />
              </div>
            )}

            {transactionType === 'purchase' && (
              <div className="space-y-2">
                <Label htmlFor="batch">Batch # (Optional)</Label>
                <Input
                  id="batch"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  placeholder="Batch number..."
                  className="h-11"
                />
              </div>
            )}
          </div>

          {/* Reason - Full Width */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason *</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe why you're making this adjustment..."
              className="h-11"
            />
          </div>

        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleShowConfirm} 
            disabled={isLoading || qty <= 0 || !reason.trim()}
            className="min-w-[120px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : 'Adjust Stock'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Confirmation Dialog */}
    <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Confirm Stock Adjustment
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>Are you sure you want to make this adjustment?</p>
              <div className="p-3 rounded-lg bg-muted space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Item:</span>
                  <span className="font-medium">{item?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type:</span>
                  <span className="font-medium">{selectedType?.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Stock:</span>
                  <span className="font-medium">{item?.current_stock} {item?.unit}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Change:</span>
                  <span className={cn(
                    'font-bold',
                    stockChange >= 0 ? 'text-green-600' : 'text-red-600'
                  )}>
                    {stockChange >= 0 ? '+' : ''}{stockChange.toFixed(1)} {item?.unit}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-muted-foreground">New Stock:</span>
                  <span className={cn(
                    'font-bold',
                    newStock <= 0 && 'text-red-600',
                    newStock > 0 && newStock <= (item?.min_stock || 0) && 'text-yellow-600'
                  )}>
                    {newStock.toFixed(1)} {item?.unit}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Reason: {reason}
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirmedSubmit}
            disabled={isLoading}
            className="bg-primary"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : 'Confirm Adjustment'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

export default StockAdjustmentDialog;
