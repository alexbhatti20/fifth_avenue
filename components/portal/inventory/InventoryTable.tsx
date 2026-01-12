'use client';

import { useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreVertical,
  Edit,
  Trash2,
  History,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MapPin,
  Barcode,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getStatusColor,
  getStatusLabel,
  calculateStockPercentage,
  getCategoryIcon,
} from '@/lib/inventory-queries';
import type { InventoryItem } from '@/lib/inventory-queries';

type SortField = 'name' | 'category' | 'current_stock' | 'status' | 'cost_per_unit' | 'total_value';
type SortDirection = 'asc' | 'desc';

interface InventoryTableProps {
  items: InventoryItem[];
  isLoading?: boolean;
  onEdit: (item: InventoryItem) => void;
  onAdjust: (item: InventoryItem) => void;
  onViewHistory: (item: InventoryItem) => void;
  onDelete?: (item: InventoryItem) => void;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
}

export function InventoryTable({
  items,
  isLoading,
  onEdit,
  onAdjust,
  onViewHistory,
  onDelete,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
}: InventoryTableProps) {
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
        case 'current_stock':
          comparison = a.current_stock - b.current_stock;
          break;
        case 'status':
          const statusOrder = { out_of_stock: 0, low_stock: 1, in_stock: 2 };
          comparison = statusOrder[a.status] - statusOrder[b.status];
          break;
        case 'cost_per_unit':
          comparison = a.cost_per_unit - b.cost_per_unit;
          break;
        case 'total_value':
          comparison = a.total_value - b.total_value;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [items, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === items.length) {
      onSelectionChange?.([]);
    } else {
      onSelectionChange?.(items.map((i) => i.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange?.(selectedIds.filter((i) => i !== id));
    } else {
      onSelectionChange?.([...selectedIds, id]);
    }
  };

  const SortHeader = ({
    field,
    children,
  }: {
    field: SortField;
    children: React.ReactNode;
  }) => (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 font-medium"
      onClick={() => handleSort(field)}
    >
      {children}
      {sortField === field ? (
        sortDirection === 'asc' ? (
          <ArrowUp className="ml-1 h-3 w-3" />
        ) : (
          <ArrowDown className="ml-1 h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
      )}
    </Button>
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 bg-muted/50 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="p-4 rounded-full bg-muted/50 mb-4">
          <Barcode className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-lg">No items found</h3>
        <p className="text-muted-foreground text-sm mt-1">
          Try adjusting your filters or add a new item
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {selectable && (
              <TableHead className="w-10">
                <Checkbox
                  checked={selectedIds.length === items.length}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
            )}
            <TableHead>
              <SortHeader field="name">Item</SortHeader>
            </TableHead>
            <TableHead>
              <SortHeader field="category">Category</SortHeader>
            </TableHead>
            <TableHead>
              <SortHeader field="current_stock">Stock Level</SortHeader>
            </TableHead>
            <TableHead>
              <SortHeader field="status">Status</SortHeader>
            </TableHead>
            <TableHead>
              <SortHeader field="cost_per_unit">Cost/Unit</SortHeader>
            </TableHead>
            <TableHead>
              <SortHeader field="total_value">Value</SortHeader>
            </TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedItems.map((item) => {
            const stockPercentage = calculateStockPercentage(
              item.current_stock,
              item.max_stock
            );
            const isSelected = selectedIds.includes(item.id);

            return (
              <TableRow
                key={item.id}
                className={cn(
                  'group',
                  isSelected && 'bg-primary/5',
                  item.status === 'out_of_stock' && 'bg-red-500/5'
                )}
              >
                {selectable && (
                  <TableCell>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelect(item.id)}
                    />
                  </TableCell>
                )}
                <TableCell>
                  <div className="min-w-[200px]">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getCategoryIcon(item.category)}</span>
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.sku}</p>
                      </div>
                    </div>
                    {(item.location || item.barcode) && (
                      <div className="flex gap-2 mt-1">
                        {item.location && (
                          <span className="inline-flex items-center text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 mr-0.5" />
                            {item.location}
                          </span>
                        )}
                        {item.barcode && (
                          <span className="inline-flex items-center text-xs text-muted-foreground">
                            <Barcode className="h-3 w-3 mr-0.5" />
                            {item.barcode}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {item.category}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="space-y-1 min-w-[120px]">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">
                        {item.current_stock} {item.unit}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {stockPercentage}%
                      </span>
                    </div>
                    <Progress
                      value={stockPercentage}
                      className={cn(
                        'h-2',
                        stockPercentage < 25 && '[&>div]:bg-red-500',
                        stockPercentage >= 25 && stockPercentage < 50 && '[&>div]:bg-yellow-500',
                        stockPercentage >= 50 && '[&>div]:bg-green-500'
                      )}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Min: {item.min_stock}</span>
                      <span>Max: {item.max_stock}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={getStatusColor(item.status)}>
                    {getStatusLabel(item.status)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="font-medium">Rs. {item.cost_per_unit.toLocaleString()}</span>
                </TableCell>
                <TableCell>
                  <span className="font-medium">Rs. {item.total_value.toLocaleString()}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm">{item.supplier || '-'}</span>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onAdjust(item)}>
                        <ArrowUpDown className="h-4 w-4 mr-2" />
                        Adjust Stock
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onViewHistory(item)}>
                        <History className="h-4 w-4 mr-2" />
                        View History
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onEdit(item)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Item
                      </DropdownMenuItem>
                      {onDelete && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onDelete(item)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export default InventoryTable;
