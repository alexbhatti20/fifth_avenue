'use client';

import { CheckCircle, ChefHat, List, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface SuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber: string;
  orderId: string | null;
  orderType?: 'walk-in' | 'dine-in';
  onCreateAnother: () => void;
  onViewInKitchen?: () => void;
  onViewOrders?: () => void;
}

export function SuccessDialog({
  open,
  onOpenChange,
  orderNumber,
  orderId,
  orderType = 'walk-in',
  onCreateAnother,
  onViewInKitchen,
  onViewOrders,
}: SuccessDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-left">
          <DialogTitle className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-2 text-green-600">
            <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-2">
              <CheckCircle className="h-6 w-6" />
            </div>
            <span>Order Created Successfully!</span>
          </DialogTitle>
          <DialogDescription className="text-center sm:text-left">
            Order has been created and sent to the kitchen.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-6 space-y-4">
          {/* Order Number Display */}
          <div className="relative overflow-hidden rounded-xl border-2 border-green-500/20 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 p-6">
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full -mr-16 -mt-16" />
            <div className="relative text-center">
              <p className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">Order Number</p>
              <p className="text-3xl font-bold text-green-700 dark:text-green-300 tracking-tight">
                {orderNumber}
              </p>
            </div>
          </div>
          
          {/* Kitchen Info Card */}
          <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-4">
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <div className="rounded-lg bg-blue-100 dark:bg-blue-900/40 p-2">
                  <ChefHat className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div className="flex-1 space-y-1">
                <p className="font-semibold text-sm text-blue-900 dark:text-blue-100">
                  Order is now in Kitchen
                </p>
                <p className="text-xs text-blue-700/80 dark:text-blue-300/80 leading-relaxed">
                  {orderType === 'dine-in' 
                    ? 'Kitchen will prepare the order. Generate bill when customer is ready to pay.' 
                    : 'Kitchen will prepare the order. Customer can collect when ready.'}
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-2">
          <Button 
            variant="outline" 
            onClick={onCreateAnother} 
            className="w-full sm:flex-1"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Another
          </Button>
          
          <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
            {onViewInKitchen && (
              <Button 
                variant="outline" 
                onClick={onViewInKitchen}
                className="text-blue-600 border-blue-300 hover:bg-blue-50 dark:border-blue-700 dark:hover:bg-blue-950"
              >
                <ChefHat className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Kitchen</span>
              </Button>
            )}
            {onViewOrders && (
              <Button 
                onClick={onViewOrders}
                className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white"
              >
                <List className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Orders</span>
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
