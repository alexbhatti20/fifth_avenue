'use client';

import { useState, useTransition } from 'react';
import { motion } from 'framer-motion';
import { Plus, Hash, Users, MapPin, Layers } from 'lucide-react';
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
import { createRestaurantTableAction } from '@/lib/actions';

// ==========================================
// ADD TABLE DIALOG COMPONENT
// For admins/managers to create new tables
// ==========================================

interface AddTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTableCreated: () => void;
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

export function AddTableDialog({
  open,
  onOpenChange,
  onTableCreated,
}: AddTableDialogProps) {
  const [tableNumber, setTableNumber] = useState('');
  const [capacity, setCapacity] = useState('4');
  const [section, setSection] = useState('main');
  const [floor, setFloor] = useState('1');
  const [isPending, startTransition] = useTransition();

  const resetForm = () => {
    setTableNumber('');
    setCapacity('4');
    setSection('main');
    setFloor('1');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tableNumber || isNaN(parseInt(tableNumber))) {
      toast.error('Please enter a valid table number');
      return;
    }

    if (!capacity || isNaN(parseInt(capacity))) {
      toast.error('Please select a valid capacity');
      return;
    }

    startTransition(async () => {
      const result = await createRestaurantTableAction({
        table_number: parseInt(tableNumber),
        capacity: parseInt(capacity),
        section: section || undefined,
        floor: parseInt(floor) || 1,
      });

      if (result.success) {
        toast.success(`Table ${result.table_number} created successfully!`);
        resetForm();
        onOpenChange(false);
        onTableCreated();
      } else {
        toast.error(result.error || 'Failed to create table');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg">
              <Plus className="h-5 w-5 text-white" />
            </div>
            Add New Table
          </DialogTitle>
          <DialogDescription>
            Create a new restaurant table for your floor plan
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Table Number */}
          <div className="space-y-2">
            <Label htmlFor="tableNumber" className="flex items-center gap-2 text-sm font-medium">
              <Hash className="h-4 w-4 text-slate-500" />
              Table Number
            </Label>
            <Input
              id="tableNumber"
              type="number"
              min="1"
              max="999"
              placeholder="Enter table number (e.g., 1, 2, 3...)"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              className="h-11"
              autoFocus
            />
          </div>

          {/* Capacity */}
          <div className="space-y-2">
            <Label htmlFor="capacity" className="flex items-center gap-2 text-sm font-medium">
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

          {/* Section */}
          <div className="space-y-2">
            <Label htmlFor="section" className="flex items-center gap-2 text-sm font-medium">
              <MapPin className="h-4 w-4 text-slate-500" />
              Section
            </Label>
            <Select value={section} onValueChange={setSection}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select section" />
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

          {/* Floor */}
          <div className="space-y-2">
            <Label htmlFor="floor" className="flex items-center gap-2 text-sm font-medium">
              <Layers className="h-4 w-4 text-slate-500" />
              Floor
            </Label>
            <Select value={floor} onValueChange={setFloor}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select floor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Ground Floor</SelectItem>
                <SelectItem value="2">1st Floor</SelectItem>
                <SelectItem value="3">2nd Floor</SelectItem>
                <SelectItem value="4">3rd Floor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !tableNumber}
              className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-lg"
            >
              {isPending ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full mr-2"
                  />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Table
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
