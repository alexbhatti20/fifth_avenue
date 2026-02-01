'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Utensils,
  CheckCircle,
  Users,
  Clock,
  Sparkles,
  AlertCircle,
  RotateCcw,
  Check,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Table, TABLE_STATUS_CONFIG } from './types';
import { toast } from 'sonner';

// Icon mapping for table statuses
const STATUS_ICONS = {
  available: CheckCircle,
  occupied: Users,
  reserved: Clock,
  cleaning: Sparkles,
  out_of_service: AlertCircle,
};

interface TableSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tables: Table[];
  selectedTables: string[];
  tableFilter: 'all' | 'available';
  isRefreshingTables: boolean;
  onSelectTable: (table: Table) => void;
  onFilterChange: (filter: 'all' | 'available') => void;
  onRefresh: () => void;
  onConfirm: () => void;
}

export function TableSelectorDialog({
  open,
  onOpenChange,
  tables,
  selectedTables,
  tableFilter,
  isRefreshingTables,
  onSelectTable,
  onFilterChange,
  onRefresh,
  onConfirm,
}: TableSelectorDialogProps) {
  const handleSelectTable = (table: Table) => {
    if (table.status !== 'available') {
      toast.error(`Table ${table.table_number} is ${TABLE_STATUS_CONFIG[table.status].label.toLowerCase()}`);
      return;
    }
    onSelectTable(table);
  };

  const filteredTables = tables
    .filter(t => tableFilter === 'all' || t.status === 'available')
    .sort((a, b) => a.table_number - b.table_number);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Utensils className="h-5 w-5 text-primary" />
            Select Tables
          </DialogTitle>
          <DialogDescription>
            Choose available tables for dine-in order
          </DialogDescription>
        </DialogHeader>
        
        {/* Filter Tabs */}
        <div className="flex items-center gap-2 border-b pb-3">
          <Button
            variant={tableFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onFilterChange('all')}
          >
            All Tables ({tables.length})
          </Button>
          <Button
            variant={tableFilter === 'available' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onFilterChange('available')}
            className={tableFilter === 'available' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
          >
            <CheckCircle className="h-3 w-3 mr-1" />
            Available ({tables.filter(t => t.status === 'available').length})
          </Button>
          <div className="ml-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshingTables}
            >
              {isRefreshingTables ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Status Legend */}
        <div className="flex flex-wrap gap-3 px-1">
          {Object.entries(TABLE_STATUS_CONFIG).map(([status, config]) => (
            <div key={status} className="flex items-center gap-1.5 text-xs">
              <div className={cn("w-2.5 h-2.5 rounded-full", config.activeBg)} />
              <span className="text-muted-foreground">{config.label}</span>
            </div>
          ))}
        </div>

        {/* Tables Grid */}
        <ScrollArea className="flex-1 h-[400px] pr-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 py-2">
            <AnimatePresence mode="popLayout">
              {filteredTables.map((table, index) => {
                const config = TABLE_STATUS_CONFIG[table.status];
                const StatusIcon = STATUS_ICONS[table.status];
                const isAvailable = table.status === 'available';
                const isSelected = selectedTables.includes(table.id);

                return (
                  <motion.button
                    key={table.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: index * 0.03 }}
                    onClick={() => handleSelectTable(table)}
                    disabled={!isAvailable}
                    className={cn(
                      "relative p-4 rounded-xl border-2 transition-all duration-200",
                      "flex flex-col items-center justify-center gap-2",
                      "hover:shadow-lg",
                      isSelected ? "border-primary bg-primary/10" : config.bg,
                      isAvailable && "cursor-pointer hover:scale-105 hover:border-primary",
                      !isAvailable && "opacity-60 cursor-not-allowed",
                      isSelected && "ring-2 ring-primary ring-offset-2"
                    )}
                  >
                    {/* Selected Check Badge */}
                    {isSelected && (
                      <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-lg">
                        <Check className="h-4 w-4 text-white" />
                      </div>
                    )}
                    
                    {/* Status Badge - only show if not selected */}
                    {!isSelected && (
                      <div className={cn(
                        "absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center",
                        config.activeBg
                      )}>
                        <StatusIcon className="h-3 w-3 text-white" />
                      </div>
                    )}

                    {/* Table Number */}
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold shadow-md",
                      isSelected ? "bg-primary text-white" : isAvailable ? "bg-white text-emerald-600" : "bg-white/80",
                      !isSelected && config.color
                    )}>
                      {table.table_number}
                    </div>

                    {/* Capacity */}
                    <div className="flex items-center gap-1 text-xs">
                      <Users className={cn("h-3 w-3", config.color)} />
                      <span className={config.color}>{table.capacity}</span>
                    </div>

                    {/* Status Label */}
                    <p className={cn("text-[10px] font-medium", config.color)}>
                      {config.label}
                    </p>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>

          {filteredTables.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No tables found</p>
              <p className="text-sm">
                {tableFilter === 'available' 
                  ? 'All tables are currently occupied or reserved' 
                  : 'No tables configured in the system'}
              </p>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="border-t pt-4 flex items-center justify-between sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {selectedTables.length > 0 ? (
              <span className="flex items-center gap-2">
                <Badge className="bg-primary">{selectedTables.length}</Badge>
                table{selectedTables.length > 1 ? 's' : ''} selected
              </span>
            ) : (
              <span>Click on tables to select</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={onConfirm}
              disabled={selectedTables.length === 0}
              className="bg-gradient-to-r from-primary to-orange-500"
            >
              <Check className="h-4 w-4 mr-1" />
              Confirm ({selectedTables.length})
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
