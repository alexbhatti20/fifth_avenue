'use client';

import { motion } from 'framer-motion';
import { Search, Utensils, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { MenuItem } from './types';

interface MenuSectionProps {
  menuItems: MenuItem[];
  categories: string[];
  selectedCategory: string;
  menuSearch: string;
  isLoadingMenu: boolean;
  onSearchChange: (value: string) => void;
  onCategoryChange: (category: string) => void;
  onAddToCart: (item: MenuItem, variant?: string, variantPrice?: number) => void;
}

export function MenuSection({
  menuItems,
  categories,
  selectedCategory,
  menuSearch,
  isLoadingMenu,
  onSearchChange,
  onCategoryChange,
  onAddToCart,
}: MenuSectionProps) {
  // Filter menu items
  const filteredMenu = menuItems.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch = !menuSearch || 
      item.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
      item.description?.toLowerCase().includes(menuSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Utensils className="h-5 w-5" />
          Menu Items
        </CardTitle>
        <CardDescription>Select items to add to the order</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search menu items..."
              value={menuSearch}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedCategory} onValueChange={onCategoryChange}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Menu Grid */}
        {isLoadingMenu ? (
          <div className="h-48 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredMenu.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "p-3 border rounded-lg cursor-pointer transition-all hover:border-primary/50 hover:shadow-sm",
                    !item.is_available && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={() => {
                    if (item.is_available) {
                      onAddToCart(item);
                    }
                  }}
                >
                  <div className="flex gap-3">
                    {item.image_url && (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{item.category}</p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="font-semibold text-red-600">Rs. {item.price.toLocaleString()}</p>
                        {!item.is_available && (
                          <Badge variant="secondary">Unavailable</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  {item.variants && item.variants.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.variants.map((v, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className="text-xs cursor-pointer hover:bg-primary/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (item.is_available) {
                              onAddToCart(item, v.name, v.price);
                            }
                          }}
                        >
                          {v.name}: Rs. {v.price}
                        </Badge>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
