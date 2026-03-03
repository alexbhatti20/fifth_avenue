'use client';

import { useState, useTransition, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Edit2, Hash, Users, MapPin, Layers, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { updateRestaurantTableAction } from '@/lib/actions';
import type { WaiterTable } from './types';

// ==========================================
// EDIT TABLE DIALOG COMPONENT
// For admins/managers to edit existing tables
// Preserves full order history on 'delete'
// ==========================================

interface EditTableDialogProps {
  table: WaiterTable | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTableUpdated: () => void;
}

const SECTIONS = [
  { value: 'main', label: 'Main Hall' },
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'vip', label: 'VIP Section' },
  { value: 'private', label: 'Private Room' },
  { value: 'bar', label: 'Bar Area' },
  { value: 'rooftop', label: 'Rooftop' },
];

const CAPACITY_OPTIONS = [2, 4, 6, 8, 10, 12];

const STATUS_OPTIONS = [
  { value: 'available', label: 'Available', color: 'text-emerald-600' },
  { value: 'occupied', label: 'Occupied', color: 'text-rose-600' },
  { value: 'reserved', label: 'Reserved', color: 'text-amber-600' },
  { value: 'cleaning', label: 'Cleaning', color: 'text-sky-600' },
  { value: 'out_of_service', label: 'Out of Service', color: 'text-slate-600' },
];

export function EditTableDialog({
  table,
  open,
  onOpenChange,
  onTableUpdated,
}: EditTableDialogProps) {
  const [tableNumber, setTableNumber] = useState('');
  const [capacity, setCapacity] = useState('4');
  const [section, setSection] = useState('main');
  const [floor, setFloor] = useState('1');
  const [status, setStatus] = useState('available');
  const [isPending, startTransition] = useTransition();

  // Sync form with selected table
  useEffect(() => {
    if (table) {
      setTableNumber(String(table.table_number));
      setCapacity(String(table.capacity));
      setSection(table.section || 'main');
      setFloor(String((table as any).floor || 1));
      setStatus(table.status || 'available');
    }
  }, [table]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!table) return;

    if (!tableNumber || isNaN(parseInt(tableNumber))) {
      toast.error('Please enter a valid table number');
      return;
    }

    startTransition(async () => {
      const result = await updateRestaurantTableAction({
        table_id: table.id,
        table_number: parseInt(tableNumber),
        capacity: parseInt(capacity),
        section: section || undefined,
        floor: parseInt(floor) || 1,
        status,
      });

      if (result.success) {
        toast.success(`Table ${tableNumber} updated successfully!`);
        onOpenChange(false);
        onTableUpdated();
      } else {
        toast.error(result.error || 'Failed to update table');
      }
    });
  };

  const isOccupied = table?.status === 'occupied';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Edit2 className="h-5 w-5 text-white" />
            </div>
            Edit Table {table?.table_number}
          </DialogTitle>
          <DialogDescription>
            Update table details. Order history is always preserved.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Occupied Warning */}
          {isOccupied && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-3">
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                ⚠️ Table is currently occupied. Status will remain occupied while an active order exists.
              </p>
            </div>
          )}

          {/* Table Number */}
          <div className="space-y-2">
            <Label htmlFor="editTableNumber" className="flex items-center gap-2 text-sm font-medium">
              <Hash className="h-4 w-4 text-slate-500" />
              Table Number
            </Label>
            <Input
              id="editTableNumber"
              type="number"
              min="1"
              max="999"
              placeholder="Table number"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              className="h-11"
              autoFocus
            />
          </div>

          {/* Capacity */}
          <div className="space-y-2">
            <Label htmlFor="editCapacity" className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4 text-slate-500" />
              Seating Capacity
            </Label>
            <Select value={capacity} onValueChange={setCapacity}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select capacity" />
              </SelectTrigger>
              <SelectContent>
                {CAPACITY_OPTIONS.map((cap) => (
                  <SelectItem key={cap} value={cap.toString()}>
                    {cap} seats
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Settings2 className="h-4 w-4 text-slate-500" />
              Status
            </Label>
            <Select value={status} onValueChange={setStatus} disabled={isOccupied}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className={cn('font-medium', opt.color)}>{opt.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Section & Floor Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="editSection" className="flex items-center gap-2 text-sm font-medium">
                <MapPin className="h-4 w-4 text-slate-500" />
                Section
              </Label>
              <Select value={section} onValueChange={setSection}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Section" />
                </SelectTrigger>
                <SelectContent>
                  {SECTIONS.map((sec) => (
                    <SelectItem key={sec.value} value={sec.value}>
                      {sec.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editFloor" className="flex items-center gap-2 text-sm font-medium">
                <Layers className="h-4 w-4 text-slate-500" />
                Floor
              </Label>
              <Input
                id="editFloor"
                type="number"
                min="1"
                max="10"
                placeholder="Floor"
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                className="h-11"
              />
            </div>
          </div>
        </form>

        <DialogFooter className="gap-2 mt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-md"
          >
            {isPending ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"
              />
            ) : (
              <Edit2 className="h-4 w-4 mr-2" />
            )}
            {isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
