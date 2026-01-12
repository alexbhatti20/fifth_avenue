'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Package, MapPin, Barcode } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { InventoryItem, CreateItemData } from '@/lib/inventory-queries';

// Categories with icons
const CATEGORIES = [
  { value: 'meat', label: 'Meat & Poultry', icon: '🍖' },
  { value: 'vegetables', label: 'Vegetables', icon: '🥬' },
  { value: 'dairy', label: 'Dairy', icon: '🥛' },
  { value: 'spices', label: 'Spices', icon: '🌶️' },
  { value: 'oils', label: 'Oils & Fats', icon: '🫒' },
  { value: 'packaging', label: 'Packaging', icon: '📦' },
  { value: 'beverages', label: 'Beverages', icon: '🥤' },
  { value: 'grains', label: 'Grains & Rice', icon: '🌾' },
  { value: 'sauces', label: 'Sauces', icon: '🥫' },
  { value: 'frozen', label: 'Frozen Items', icon: '❄️' },
  { value: 'other', label: 'Other', icon: '📋' },
];

const UNITS = [
  { value: 'kg', label: 'Kilograms (kg)' },
  { value: 'g', label: 'Grams (g)' },
  { value: 'l', label: 'Liters (L)' },
  { value: 'ml', label: 'Milliliters (mL)' },
  { value: 'pcs', label: 'Pieces' },
  { value: 'box', label: 'Boxes' },
  { value: 'pack', label: 'Packs' },
  { value: 'dozen', label: 'Dozen' },
  { value: 'bag', label: 'Bags' },
  { value: 'can', label: 'Cans' },
  { value: 'bottle', label: 'Bottles' },
];

interface ItemDialogProps {
  item?: InventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: CreateItemData) => Promise<void>;
  suppliers?: string[];
}

export function ItemDialog({
  item,
  open,
  onOpenChange,
  onSave,
  suppliers = [],
}: ItemDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [expiryDate, setExpiryDate] = useState<Date | undefined>();

  const [formData, setFormData] = useState<CreateItemData>({
    name: '',
    sku: '',
    category: 'other',
    unit: 'pcs',
    quantity: 0,
    min_quantity: 10,
    max_quantity: 100,
    cost_per_unit: 0,
    supplier: '',
    notes: '',
    location: '',
    barcode: '',
  });

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name,
        sku: item.sku,
        category: item.category,
        unit: item.unit,
        quantity: item.current_stock,
        min_quantity: item.min_stock,
        max_quantity: item.max_stock,
        cost_per_unit: item.cost_per_unit,
        supplier: item.supplier,
        notes: item.notes || '',
        location: item.location || '',
        barcode: item.barcode || '',
      });
      if (item.expiry_date) {
        setExpiryDate(new Date(item.expiry_date));
      }
    } else {
      setFormData({
        name: '',
        sku: '',
        category: 'other',
        unit: 'pcs',
        quantity: 0,
        min_quantity: 10,
        max_quantity: 100,
        cost_per_unit: 0,
        supplier: '',
        notes: '',
        location: '',
        barcode: '',
      });
      setExpiryDate(undefined);
    }
    setActiveTab('basic');
  }, [item, open]);

  const handleSubmit = async () => {
    if (!formData.name) {
      toast.error('Item name is required');
      return;
    }

    setIsLoading(true);
    try {
      await onSave({
        ...formData,
        expiry_date: expiryDate?.toISOString().split('T')[0],
      });
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save item');
    } finally {
      setIsLoading(false);
    }
  };

  const updateField = <K extends keyof CreateItemData>(
    field: K,
    value: CreateItemData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl font-bold">
            <Package className="h-6 w-6 text-orange-500 animate-pulse" />
            <span className="bg-gradient-to-r from-red-500 via-orange-500 to-red-600 bg-clip-text text-transparent animate-gradient-x tracking-widest uppercase">
              {item ? 'Edit Inventory Item' : 'Add New Inventory Item'}
            </span>
          </DialogTitle>
          <DialogDescription className="tracking-wide">
            {item
              ? 'Update the details of this inventory item'
              : 'Fill in the details to add a new item to inventory'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="stock">Stock Settings</TabsTrigger>
            <TabsTrigger value="details">Additional</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" variant="gradient" required>Item Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="e.g., Chicken Breast"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sku" variant="gradientSubtle">SKU</Label>
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) => updateField('sku', e.target.value)}
                  placeholder="Auto-generated if empty"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label variant="gradientSubtle">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => updateField('category', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        <span className="flex items-center gap-2">
                          <span>{cat.icon}</span>
                          <span>{cat.label}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label variant="gradientSubtle">Unit</Label>
                <Select
                  value={formData.unit}
                  onValueChange={(value) => updateField('unit', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((unit) => (
                      <SelectItem key={unit.value} value={unit.value}>
                        {unit.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cost" variant="gradient">Cost per Unit (Rs.)</Label>
                <Input
                  id="cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.cost_per_unit || ''}
                  onChange={(e) =>
                    updateField('cost_per_unit', e.target.value === '' ? 0 : parseFloat(e.target.value))
                  }
                  placeholder="Enter cost"
                />
              </div>
              <div className="space-y-2">
                <Label variant="gradientSubtle">Supplier</Label>
                {suppliers.length > 0 ? (
                  <Select
                    value={formData.supplier}
                    onValueChange={(value) => updateField('supplier', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={formData.supplier}
                    onChange={(e) => updateField('supplier', e.target.value)}
                    placeholder="Enter supplier name"
                  />
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="stock" className="space-y-4 mt-4">
            {!item && (
              <div className="space-y-2">
                <Label htmlFor="quantity" variant="gradient">Initial Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  value={formData.quantity || ''}
                  onChange={(e) =>
                    updateField('quantity', e.target.value === '' ? 0 : parseFloat(e.target.value))
                  }
                  placeholder="Enter quantity"
                />
                <p className="text-xs text-muted-foreground">
                  This will create an initial stock entry transaction
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min_quantity" variant="gradientSubtle">Minimum Stock Level</Label>
                <Input
                  id="min_quantity"
                  type="number"
                  min="0"
                  value={formData.min_quantity || ''}
                  onChange={(e) =>
                    updateField('min_quantity', e.target.value === '' ? 0 : parseFloat(e.target.value))
                  }
                  placeholder="e.g., 10"
                />
                <p className="text-xs text-muted-foreground">
                  Alert when stock falls below this level
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_quantity" variant="gradientSubtle">Maximum Stock Level</Label>
                <Input
                  id="max_quantity"
                  type="number"
                  min="0"
                  value={formData.max_quantity || ''}
                  onChange={(e) =>
                    updateField('max_quantity', e.target.value === '' ? 0 : parseFloat(e.target.value))
                  }
                  placeholder="e.g., 100"
                />
                <p className="text-xs text-muted-foreground">
                  Target stock level for reordering
                </p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted/50">
              <h4 className="font-medium mb-2">Stock Thresholds Preview</h4>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span>Out: 0</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span>Low: 1-{formData.min_quantity}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span>OK: {Number(formData.min_quantity) + 1}+</span>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="details" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="location" variant="gradientSubtle" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Storage Location
                </Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => updateField('location', e.target.value)}
                  placeholder="e.g., Shelf A3, Cold Storage"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="barcode" variant="gradientSubtle" className="flex items-center gap-2">
                  <Barcode className="h-4 w-4" />
                  Barcode
                </Label>
                <Input
                  id="barcode"
                  value={formData.barcode}
                  onChange={(e) => updateField('barcode', e.target.value)}
                  placeholder="Enter barcode number"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label variant="gradientSubtle">Expiry Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !expiryDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {expiryDate ? format(expiryDate, 'PPP') : 'No expiry date set'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={expiryDate}
                    onSelect={setExpiryDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" variant="gradientSubtle">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder="Additional notes about this item..."
                rows={3}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Saving...' : item ? 'Update Item' : 'Add Item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ItemDialog;
