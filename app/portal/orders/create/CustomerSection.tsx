'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  UserCircle,
  Phone,
  Crown,
  Star,
  X,
  Loader2,
  ShoppingBag,
  Utensils,
  Plus,
  RotateCcw,
  Check,
  Mail,
  MapPin,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { RegisteredCustomer, Table, LOYALTY_TIER_CONFIG } from './types';

interface CustomerSectionProps {
  // Customer state
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  registeredCustomer: RegisteredCustomer | null;
  customerSearchResults: RegisteredCustomer[];
  showSearchResults: boolean;
  isSearchingCustomer: boolean;
  isNewCustomer: boolean;
  
  // Order state
  orderType: 'walk-in' | 'dine-in';
  selectedTables: string[];
  tables: Table[];
  isRefreshingTables: boolean;
  
  // Handlers
  onCustomerSearch: (value: string, field: 'name' | 'phone' | 'email') => void;
  onSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSelectCustomer: (customer: RegisteredCustomer) => void;
  onClearCustomer: () => void;
  onAddressChange: (address: string) => void;
  onOrderTypeChange: (type: 'walk-in' | 'dine-in') => void;
  onRemoveTable: (tableId: string) => void;
  onClearTables: () => void;
  onRefreshTables: () => void;
  onOpenTableSelector: () => void;
}

export function CustomerSection({
  customerName,
  customerPhone,
  customerEmail,
  customerAddress,
  registeredCustomer,
  customerSearchResults,
  showSearchResults,
  isSearchingCustomer,
  isNewCustomer,
  orderType,
  selectedTables,
  tables,
  isRefreshingTables,
  onCustomerSearch,
  onSearchKeyDown,
  onSelectCustomer,
  onClearCustomer,
  onAddressChange,
  onOrderTypeChange,
  onRemoveTable,
  onClearTables,
  onRefreshTables,
  onOpenTableSelector,
}: CustomerSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <User className="h-5 w-5" />
          Customer Information
        </CardTitle>
        <CardDescription>
          Search by name, phone or email - auto-fills if customer exists
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Selected Customer Banner */}
        {registeredCustomer && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-gradient-to-r from-primary/10 via-orange-500/10 to-primary/10 rounded-xl border border-primary/20"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium text-primary uppercase tracking-wide">Registered Customer</span>
                  <Badge 
                    className={cn(
                      "text-xs",
                      LOYALTY_TIER_CONFIG[registeredCustomer.loyalty_tier].bg,
                      LOYALTY_TIER_CONFIG[registeredCustomer.loyalty_tier].color
                    )}
                  >
                    {LOYALTY_TIER_CONFIG[registeredCustomer.loyalty_tier].label}
                  </Badge>
                </div>
                <p className="font-semibold text-lg">{registeredCustomer.name}</p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {registeredCustomer.phone}
                  </span>
                  {registeredCustomer.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {registeredCustomer.email}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm mt-1">
                  <span className="flex items-center gap-1 text-amber-600">
                    <Star className="h-3 w-3 fill-current" />
                    {registeredCustomer.loyalty_points} points
                  </span>
                  <span className="text-muted-foreground">{registeredCustomer.total_orders} orders</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClearCustomer}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* New Customer Indicator */}
        {isNewCustomer && !registeredCustomer && customerName && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20 flex items-center gap-2"
          >
            <UserCircle className="h-5 w-5 text-blue-500" />
            <span className="text-sm font-medium text-blue-600">New walk-in customer</span>
          </motion.div>
        )}

        {/* Customer Input Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Name Field with Search */}
          <div className="relative md:col-span-2">
            <Label htmlFor="customerName">Customer Name *</Label>
            <div className="relative mt-1">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="customerName"
                placeholder="Type & press Enter to search..."
                value={customerName}
                onChange={(e) => onCustomerSearch(e.target.value, 'name')}
                onKeyDown={onSearchKeyDown}
                className={cn(
                  "pl-10",
                  registeredCustomer && "bg-muted/50"
                )}
                disabled={!!registeredCustomer}
              />
              {isSearchingCustomer && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            
            {/* Search Results Dropdown */}
            <AnimatePresence>
              {showSearchResults && customerSearchResults.length > 0 && !registeredCustomer && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute left-0 right-0 top-full mt-1 z-50 border rounded-xl shadow-lg bg-card overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-2 bg-muted/50 border-b">
                    <p className="text-xs font-medium text-muted-foreground px-2">
                      Found {customerSearchResults.length} matching customer{customerSearchResults.length > 1 ? 's' : ''}
                    </p>
                  </div>
                  <ScrollArea className="max-h-60">
                    {customerSearchResults.map((customer) => (
                      <button
                        key={customer.id}
                        className="w-full p-3 text-left hover:bg-primary/5 transition-colors border-b last:border-0"
                        onClick={() => onSelectCustomer(customer)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{customer.name}</p>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {customer.phone}
                              </span>
                              {customer.email && (
                                <span className="flex items-center gap-1 truncate">
                                  <Mail className="h-3 w-3" />
                                  {customer.email}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            <Badge 
                              className={cn(
                                "text-xs",
                                LOYALTY_TIER_CONFIG[customer.loyalty_tier].bg,
                                LOYALTY_TIER_CONFIG[customer.loyalty_tier].color
                              )}
                            >
                              {LOYALTY_TIER_CONFIG[customer.loyalty_tier].label}
                            </Badge>
                            <span className="text-xs text-amber-600 flex items-center gap-0.5">
                              <Star className="h-3 w-3 fill-current" />
                              {customer.loyalty_points}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </ScrollArea>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Phone Field */}
          <div className="relative">
            <Label htmlFor="customerPhone">Phone Number</Label>
            <div className="relative mt-1">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="customerPhone"
                placeholder="03XX-XXXXXXX (Enter to search)"
                value={customerPhone}
                onChange={(e) => onCustomerSearch(e.target.value, 'phone')}
                onKeyDown={onSearchKeyDown}
                className={cn(
                  "pl-10",
                  registeredCustomer && "bg-muted/50"
                )}
                disabled={!!registeredCustomer}
              />
            </div>
          </div>

          {/* Email Field */}
          <div className="relative">
            <Label htmlFor="customerEmail">Email</Label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="customerEmail"
                placeholder="customer@email.com (Enter to search)"
                type="email"
                value={customerEmail}
                onChange={(e) => onCustomerSearch(e.target.value, 'email')}
                onKeyDown={onSearchKeyDown}
                className={cn(
                  "pl-10",
                  registeredCustomer && "bg-muted/50"
                )}
                disabled={!!registeredCustomer}
              />
            </div>
          </div>

          {/* Address Field */}
          <div className="md:col-span-2">
            <Label htmlFor="customerAddress">Delivery Address</Label>
            <div className="relative mt-1">
              <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Textarea
                id="customerAddress"
                placeholder="Enter delivery address (optional for dine-in)"
                value={customerAddress}
                onChange={(e) => onAddressChange(e.target.value)}
                className={cn(
                  "pl-10 min-h-[60px]",
                  registeredCustomer && "bg-muted/50"
                )}
                disabled={!!registeredCustomer}
              />
            </div>
          </div>
        </div>

        {/* Order Type */}
        <div className="pt-4 border-t">
          <Label>Order Type</Label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <Button
              variant={orderType === 'walk-in' ? 'default' : 'outline'}
              onClick={() => onOrderTypeChange('walk-in')}
              className="justify-start"
            >
              <ShoppingBag className="h-4 w-4 mr-2" />
              Takeaway
            </Button>
            <Button
              variant={orderType === 'dine-in' ? 'default' : 'outline'}
              onClick={() => onOrderTypeChange('dine-in')}
              className="justify-start"
            >
              <Utensils className="h-4 w-4 mr-2" />
              Dine-in
            </Button>
          </div>

          {orderType === 'dine-in' && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Select Tables {selectedTables.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {selectedTables.length} selected
                    </Badge>
                  )}
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRefreshTables}
                  disabled={isRefreshingTables}
                  className="h-7 text-xs"
                >
                  {isRefreshingTables ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <RotateCcw className="h-3 w-3 mr-1" />
                  )}
                  Refresh
                </Button>
              </div>

              {/* Selected Tables Display */}
              {selectedTables.length > 0 && (
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="p-4 rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50"
                >
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-emerald-700">
                      {selectedTables.length} Table{selectedTables.length > 1 ? 's' : ''} Selected
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onClearTables}
                      className="h-6 text-xs text-red-600 hover:bg-red-100"
                    >
                      Clear All
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedTables.map(tableId => {
                      const table = tables.find(t => t.id === tableId);
                      if (!table) return null;
                      return (
                        <motion.div
                          key={tableId}
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-emerald-200 shadow-sm"
                        >
                          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                            <span className="text-sm font-bold text-white">{table.table_number}</span>
                          </div>
                          <div className="text-xs">
                            <p className="font-medium text-emerald-800">Table {table.table_number}</p>
                            <p className="text-emerald-600">{table.capacity} guests</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onRemoveTable(tableId)}
                            className="h-6 w-6 p-0 ml-1 hover:bg-red-100 hover:text-red-600"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </motion.div>
                      );
                    })}
                  </div>
                  <div className="mt-3 pt-3 border-t border-emerald-200 flex items-center justify-between">
                    <span className="text-sm text-emerald-600">
                      Total Capacity: {selectedTables.reduce((sum, id) => {
                        const table = tables.find(t => t.id === id);
                        return sum + (table?.capacity || 0);
                      }, 0)} guests
                    </span>
                    <Badge className="bg-emerald-500 text-white">
                      <Check className="h-3 w-3 mr-1" />
                      Ready
                    </Badge>
                  </div>
                </motion.div>
              )}

              {/* Add More Tables Button */}
              <Button
                variant="outline"
                onClick={onOpenTableSelector}
                className={cn(
                  "w-full border-dashed border-2 hover:border-primary hover:bg-primary/5",
                  selectedTables.length > 0 ? "h-10" : "h-14"
                )}
              >
                <Plus className="h-4 w-4 mr-2 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {selectedTables.length > 0 ? 'Add More Tables' : 'Click to select tables'}
                </span>
              </Button>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-100">
                  <p className="text-lg font-bold text-emerald-600">
                    {tables.filter(t => t.status === 'available').length}
                  </p>
                  <p className="text-xs text-emerald-500">Available</p>
                </div>
                <div className="p-2 rounded-lg bg-red-50 border border-red-100">
                  <p className="text-lg font-bold text-red-600">
                    {tables.filter(t => t.status === 'occupied').length}
                  </p>
                  <p className="text-xs text-red-500">Occupied</p>
                </div>
                <div className="p-2 rounded-lg bg-amber-50 border border-amber-100">
                  <p className="text-lg font-bold text-amber-600">
                    {tables.filter(t => t.status === 'reserved').length}
                  </p>
                  <p className="text-xs text-amber-500">Reserved</p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
