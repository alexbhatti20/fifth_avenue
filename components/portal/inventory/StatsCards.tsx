'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Package,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Clock,
  BarChart3,
  Boxes,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { InventorySummary, CategoryValue } from '@/lib/inventory-queries';

interface StatsCardsProps {
  summary: InventorySummary | null;
  isLoading?: boolean;
}

export function InventoryStatsCards({ summary, isLoading }: StatsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 w-20 bg-muted rounded mb-2" />
              <div className="h-8 w-24 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const stats = [
    {
      title: 'Total Items',
      value: summary?.total_items || 0,
      icon: Package,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Total Value',
      value: `Rs. ${(summary?.total_value || 0).toLocaleString()}`,
      icon: DollarSign,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Low Stock',
      value: summary?.low_stock_count || 0,
      icon: AlertTriangle,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      alert: (summary?.low_stock_count || 0) > 0,
    },
    {
      title: 'Out of Stock',
      value: summary?.out_of_stock_count || 0,
      icon: TrendingDown,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      alert: (summary?.out_of_stock_count || 0) > 0,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.title} className={cn('relative overflow-hidden', stat.alert && 'ring-1 ring-offset-1')}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
                <p className="text-2xl font-bold mt-1">{stat.value}</p>
              </div>
              <div className={cn('p-3 rounded-lg', stat.bgColor)}>
                <stat.icon className={cn('h-5 w-5', stat.color)} />
              </div>
            </div>
            {stat.alert && (
              <div className="absolute top-2 right-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Extended Stats Row
export function InventoryExtendedStats({ summary }: { summary: InventorySummary | null }) {
  if (!summary) return null;

  const healthScore = Math.round(
    ((summary.in_stock_count || 0) / (summary.total_items || 1)) * 100
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <TrendingUp className="h-4 w-4 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">In Stock</p>
              <p className="text-lg font-bold">{summary.in_stock_count}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Boxes className="h-4 w-4 text-purple-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Overstock</p>
              <p className="text-lg font-bold">{summary.overstock_count}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Clock className="h-4 w-4 text-orange-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Expiring Soon</p>
              <p className="text-lg font-bold">{summary.expiring_soon}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Expired</p>
              <p className="text-lg font-bold">{summary.expired}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <BarChart3 className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Health Score</p>
              <p className="text-lg font-bold">{healthScore}%</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Category Value Card
export function CategoryValueCard({
  categories,
  isLoading,
}: {
  categories: CategoryValue[];
  isLoading?: boolean;
}) {
  const safeCategories = Array.isArray(categories) ? categories : [];
  const totalValue = safeCategories.reduce((sum, c) => sum + c.total_value, 0);

  const categoryColors: Record<string, string> = {
    meat: 'bg-red-500',
    vegetables: 'bg-green-500',
    dairy: 'bg-blue-500',
    spices: 'bg-orange-500',
    oils: 'bg-yellow-500',
    packaging: 'bg-gray-500',
    beverages: 'bg-cyan-500',
    grains: 'bg-purple-500',
    sauces: 'bg-pink-500',
    frozen: 'bg-sky-500',
    other: 'bg-slate-500',
  };

  const categoryIcons: Record<string, string> = {
    meat: '🍖',
    vegetables: '🥬',
    dairy: '🥛',
    spices: '🌶️',
    oils: '🫒',
    packaging: '📦',
    beverages: '🥤',
    grains: '🌾',
    sauces: '🥫',
    frozen: '❄️',
    other: '📋',
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inventory by Category</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Inventory by Category</span>
          <Badge variant="outline">
            Rs. {totalValue.toLocaleString()}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {safeCategories.map((category) => {
            const categoryValue = category.total_value || 0;
            const percentage = totalValue > 0
              ? Math.round((categoryValue / totalValue) * 100)
              : 0;

            return (
              <div key={category.category || 'unknown'} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span>{categoryIcons[(category.category || '').toLowerCase()] || '📋'}</span>
                    <span className="capitalize">{category.category || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>{category.items_count || 0} items</span>
                    <span className="font-medium text-foreground">
                      Rs. {categoryValue.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Progress
                    value={percentage}
                    className={cn('h-2 flex-1', categoryColors[(category.category || '').toLowerCase()] || 'bg-slate-500')}
                  />
                  <span className="text-xs text-muted-foreground w-8">{percentage}%</span>
                </div>
                {((category.low_stock_items || 0) > 0 || (category.out_of_stock_items || 0) > 0) && (
                  <div className="flex gap-2 text-xs">
                    {(category.low_stock_items || 0) > 0 && (
                      <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">
                        {category.low_stock_items} low
                      </Badge>
                    )}
                    {(category.out_of_stock_items || 0) > 0 && (
                      <Badge variant="outline" className="text-red-500 border-red-500/30">
                        {category.out_of_stock_items} out
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default InventoryStatsCards;
