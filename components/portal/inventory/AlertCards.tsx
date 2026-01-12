'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  AlertTriangle,
  Package,
  TrendingDown,
  ShoppingCart,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { InventoryItem, LowStockItem, InventoryAlert } from '@/lib/inventory-queries';

// Low Stock Alerts Card
export function LowStockAlertsCard({
  items,
  onItemClick,
}: {
  items: InventoryItem[];
  onItemClick?: (item: InventoryItem) => void;
}) {
  const lowStockItems = (Array.isArray(items) ? items : []).filter(
    (i) => i.status === 'low_stock' || i.status === 'out_of_stock'
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          Stock Alerts
          {lowStockItems.length > 0 && (
            <Badge variant="destructive" className="ml-auto">
              {lowStockItems.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {lowStockItems.length === 0 ? (
          <div className="text-center py-6">
            <Package className="h-10 w-10 text-green-500/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">All items well-stocked!</p>
          </div>
        ) : (
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {lowStockItems.map((item) => {
                const isOutOfStock = item.status === 'out_of_stock';
                const percentage = Math.round(
                  (item.current_stock / item.min_stock) * 100
                );

                return (
                  <button
                    key={item.id}
                    onClick={() => onItemClick?.(item)}
                    className={cn(
                      'w-full p-3 rounded-lg flex items-center justify-between text-left transition-colors',
                      isOutOfStock
                        ? 'bg-red-500/10 hover:bg-red-500/20'
                        : 'bg-yellow-500/10 hover:bg-yellow-500/20'
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Progress
                          value={Math.min(percentage, 100)}
                          className={cn(
                            'h-1.5 w-20',
                            isOutOfStock ? 'bg-red-200' : 'bg-yellow-200'
                          )}
                        />
                        <span className="text-xs text-muted-foreground">
                          {item.current_stock}/{item.min_stock} {item.unit}
                        </span>
                      </div>
                    </div>
                    <Badge
                      className={cn(
                        'ml-2 shrink-0',
                        isOutOfStock
                          ? 'bg-red-500/10 text-red-500'
                          : 'bg-yellow-500/10 text-yellow-500'
                      )}
                    >
                      {isOutOfStock ? 'Out' : 'Low'}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

// Reorder Suggestions Card
export function ReorderSuggestionsCard({
  items,
  onViewAll,
  onCreatePO,
}: {
  items: LowStockItem[];
  onViewAll?: () => void;
  onCreatePO?: (items: LowStockItem[]) => void;
}) {
  const safeItems = Array.isArray(items) ? items : [];
  const totalEstimatedCost = safeItems.reduce((sum, i) => sum + i.estimated_cost, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-blue-500" />
          Reorder Suggestions
        </CardTitle>
      </CardHeader>
      <CardContent>
        {safeItems.length === 0 ? (
          <div className="text-center py-6">
            <TrendingDown className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No items need reordering</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-blue-500/10">
              <div className="flex items-center justify-between">
                <span className="text-sm">Items to Reorder</span>
                <span className="font-bold">{safeItems.length}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm">Estimated Cost</span>
                <span className="font-bold">Rs. {totalEstimatedCost.toLocaleString()}</span>
              </div>
            </div>

            <ScrollArea className="h-40">
              <div className="space-y-2">
                {safeItems.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      'p-2 rounded flex items-center justify-between text-sm',
                      item.priority === 'critical'
                        ? 'bg-red-500/10'
                        : item.priority === 'high'
                        ? 'bg-orange-500/10'
                        : 'bg-yellow-500/10'
                    )}
                  >
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Order: {item.suggested_order_qty} {item.unit}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        item.priority === 'critical' && 'border-red-500 text-red-500',
                        item.priority === 'high' && 'border-orange-500 text-orange-500',
                        item.priority === 'medium' && 'border-yellow-500 text-yellow-500'
                      )}
                    >
                      {item.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex gap-2">
              {onViewAll && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={onViewAll}
                >
                  View All
                </Button>
              )}
              {onCreatePO && (
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => onCreatePO(items)}
                >
                  Create PO
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Inventory Alerts Card (from alerts table)
export function InventoryAlertsCard({
  alerts,
  onMarkRead,
  onResolve,
}: {
  alerts: InventoryAlert[];
  onMarkRead?: (alertId: string) => void;
  onResolve?: (alertId: string) => void;
}) {
  const alertColors: Record<string, string> = {
    low_stock: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
    out_of_stock: 'bg-red-500/10 text-red-500 border-red-500/30',
    expiring: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
    expired: 'bg-red-500/10 text-red-500 border-red-500/30',
    overstock: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          System Alerts
          {(Array.isArray(alerts) ? alerts : []).filter((a) => !a.is_read).length > 0 && (
            <Badge className="ml-auto bg-orange-500">
              {(Array.isArray(alerts) ? alerts : []).filter((a) => !a.is_read).length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {(Array.isArray(alerts) ? alerts : []).length === 0 ? (
          <div className="text-center py-6">
            <AlertTriangle className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No active alerts</p>
          </div>
        ) : (
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {(Array.isArray(alerts) ? alerts : []).map((alert) => (
                <div
                  key={alert.id}
                  className={cn(
                    'p-3 rounded-lg border transition-colors',
                    alertColors[alert.alert_type],
                    !alert.is_read && 'ring-1 ring-offset-1'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Badge variant="outline" className="text-xs mb-1">
                        {alert.alert_type.replace('_', ' ')}
                      </Badge>
                      <p className="text-sm">{alert.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(alert.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      {!alert.is_read && onMarkRead && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => onMarkRead(alert.id)}
                        >
                          Mark read
                        </Button>
                      )}
                      {!alert.is_resolved && onResolve && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => onResolve(alert.id)}
                        >
                          Resolve
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

export default LowStockAlertsCard;
