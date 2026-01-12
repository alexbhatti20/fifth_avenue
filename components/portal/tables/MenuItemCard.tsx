'use client';

import { motion } from 'framer-motion';
import { Plus, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { MenuItem } from './types';

// ==========================================
// MENU ITEM CARD FOR ORDER DIALOG
// ==========================================

interface MenuItemCardProps {
  item: MenuItem;
  onAdd: (item: MenuItem) => void;
}

export function MenuItemCard({ item, onAdd }: MenuItemCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="cursor-pointer"
      onClick={() => onAdd(item)}
    >
      <Card className="h-full overflow-hidden border hover:border-red-500/50 hover:shadow-lg transition-all">
        {item.image_url && (
          <div className="relative h-24 overflow-hidden">
            <img
              src={item.image_url}
              alt={item.name}
              className="w-full h-full object-cover"
            />
            {item.is_featured && (
              <Badge className="absolute top-2 left-2 bg-gradient-to-r from-amber-500 to-orange-500 border-0">
                <Sparkles className="h-3 w-3 mr-1" />
                Featured
              </Badge>
            )}
          </div>
        )}
        <CardContent className="p-3">
          <h4 className="font-medium text-sm line-clamp-1">{item.name}</h4>
          <div className="flex items-center justify-between mt-2">
            <span className="font-bold text-red-600">Rs. {item.price}</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 rounded-full bg-red-500/10 hover:bg-red-500/20"
            >
              <Plus className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
