'use client';

import { Plus, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { MenuItem } from './types';

// ==========================================
// MENU ITEM CARD FOR ORDER DIALOG
// Mobile-optimized with touch-friendly interactions
// ==========================================

interface MenuItemCardProps {
  item: MenuItem;
  onAdd: (item: MenuItem) => void;
}

export function MenuItemCard({ item, onAdd }: MenuItemCardProps) {
  return (
    <div
      className="cursor-pointer active:scale-[0.97] transition-transform"
      onClick={() => onAdd(item)}
    >
      <Card className="h-full overflow-hidden border hover:border-red-500/50 hover:shadow-lg transition-all bg-white dark:bg-zinc-800">
        {item.image_url && (
          <div className="relative h-20 sm:h-24 overflow-hidden">
            <img
              src={item.image_url}
              alt={item.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {item.is_featured && (
              <Badge className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 bg-gradient-to-r from-amber-500 to-orange-500 border-0 text-[10px] sm:text-xs px-1.5 py-0.5">
                <Sparkles className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                Featured
              </Badge>
            )}
          </div>
        )}
        <CardContent className="p-2.5 sm:p-3">
          <h4 className="font-medium text-xs sm:text-sm line-clamp-1">{item.name}</h4>
          <div className="flex items-center justify-between mt-1.5 sm:mt-2">
            <span className="font-bold text-red-600 text-sm sm:text-base">Rs. {item.price}</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 sm:h-8 sm:w-8 p-0 rounded-full bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30"
            >
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-500" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
