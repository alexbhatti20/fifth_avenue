'use client'

import { useState, useCallback, useMemo, useTransition } from 'react'
import {
  Package, Plus, Search, Download,
  RefreshCw, BarChart3, X, Grid3X3, List
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { usePortalAuth } from '@/hooks/usePortal'

// Import server actions
import {
  createInventoryItemServer,
  updateInventoryItemServer,
  deleteInventoryItemServer,
  adjustInventoryStockServer,
  refreshInventoryServer,
  refreshInventorySummaryServer,
} from '@/lib/actions'

// Import modular components
import {
  ItemDialog,
  StockAdjustmentDialog,
  TransactionHistoryDialog,
  LowStockAlertsCard,
  ReorderSuggestionsCard,
  InventoryAlertsCard,
  InventoryStatsCards,
  InventoryExtendedStats,
  CategoryValueCard,
  InventoryTable
} from '@/components/portal/inventory'

// Import types and utilities
import type {
  InventoryItem,
  InventorySummary,
  InventoryAlert,
  LowStockItem,
  CreateItemData,
  StockAdjustmentData,
  CategoryValue
} from '@/lib/inventory-queries'

import { CATEGORIES } from '@/lib/inventory-queries'

// ============================================================================
// PROPS FOR SSR SUPPORT
// ============================================================================

interface InventoryClientProps {
  initialItems: InventoryItem[];
  initialSummary: InventorySummary | null;
  initialLowStockItems: LowStockItem[];
  initialAlerts: InventoryAlert[];
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function InventoryClient({
  initialItems,
  initialSummary,
  initialLowStockItems,
  initialAlerts,
}: InventoryClientProps) {
  const { toast } = useToast()
  const { employee } = usePortalAuth()
  
  // Core state - use SSR data as initial
  const [items, setItems] = useState<InventoryItem[]>(initialItems)
  const [summary, setSummary] = useState<InventorySummary | null>(initialSummary)
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>(initialLowStockItems)
  const [alerts, setAlerts] = useState<InventoryAlert[]>(initialAlerts)
  // Cast through unknown for category type mismatch (server returns different shape)
  const [categories, setCategories] = useState<CategoryValue[]>((initialSummary?.categories || []) as unknown as CategoryValue[])
  
  // UI state
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState('inventory')
  
  // Dialog state
  const [showItemDialog, setShowItemDialog] = useState(false)
  const [showStockDialog, setShowStockDialog] = useState(false)
  const [showTransactionHistory, setShowTransactionHistory] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null)
  const [viewingTransactions, setViewingTransactions] = useState<InventoryItem | null>(null)
  
  // Use transition to prevent UI blocking
  const [isPending, startTransition] = useTransition()

  // ============================================================================
  // DATA FETCHING (for refresh/updates)
  // ============================================================================

  const fetchInventory = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true)
    else setLoading(true)
    
    try {
      // Use server actions for data fetching
      const [itemsRes, summaryRes] = await Promise.all([
        refreshInventoryServer(),
        refreshInventorySummaryServer(),
      ])

      if (itemsRes.success && itemsRes.data) {
        setItems(Array.isArray(itemsRes.data) ? itemsRes.data : [])
      }

      if (summaryRes.success && summaryRes.data) {
        setSummary(summaryRes.data)
        if (summaryRes.data?.categories) {
          setCategories(summaryRes.data.categories)
        }
      }

    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load inventory data',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [toast])

  // ============================================================================
  // CRUD OPERATIONS
  // ============================================================================

  const handleSaveItem = async (data: CreateItemData) => {
    try {
      let result;
      
      if (editingItem) {
        // Update existing item
        result = await updateInventoryItemServer(editingItem.id, {
          name: data.name,
          sku: data.sku,
          category: data.category,
          unit: data.unit,
          min_quantity: data.min_quantity,
          max_quantity: data.max_quantity,
          cost_per_unit: data.cost_per_unit,
          supplier: data.supplier,
          notes: data.notes,
          location: data.location,
          barcode: data.barcode,
          expiry_date: data.expiry_date,
        });
      } else {
        // Create new item
        result = await createInventoryItemServer({
          name: data.name,
          sku: data.sku,
          category: data.category,
          unit: data.unit,
          quantity: data.quantity,
          min_quantity: data.min_quantity,
          max_quantity: data.max_quantity,
          cost_per_unit: data.cost_per_unit,
          supplier: data.supplier,
          notes: data.notes,
          location: data.location,
          barcode: data.barcode,
          expiry_date: data.expiry_date,
        });
      }

      if (!result.success) {
        throw new Error(result.error || 'Failed to save item');
      }

      toast({ 
        title: 'Success', 
        description: editingItem ? 'Item updated successfully' : 'Item created successfully' 
      })
      setShowItemDialog(false)
      setEditingItem(null)
      fetchInventory(true)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save item',
        variant: 'destructive'
      })
    }
  }

  const handleDeleteItem = async (item: InventoryItem) => {
    if (!confirm(`Are you sure you want to delete "${item.name}"?`)) return

    try {
      const result = await deleteInventoryItemServer(item.id);

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete item');
      }

      toast({ title: 'Success', description: 'Item deleted successfully' })
      fetchInventory(true)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete item',
        variant: 'destructive'
      })
    }
  }

  const handleAdjustStock = async (data: StockAdjustmentData) => {
    if (!adjustingItem) return

    try {
      const result = await adjustInventoryStockServer({
        itemId: data.itemId || adjustingItem.id,
        transactionType: data.transactionType,
        quantity: data.quantity,
        reason: data.reason,
        unitCost: data.unitCost,
        referenceNumber: data.referenceNumber,
        batchNumber: data.batchNumber
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to adjust stock');
      }

      toast({ title: 'Success', description: 'Stock adjusted successfully' })
      setShowStockDialog(false)
      setAdjustingItem(null)
      fetchInventory(true)
    } catch (error: any) {
      console.error('Stock adjustment error:', error)
      toast({
        title: 'Error',
        description: error?.message || 'Failed to adjust stock',
        variant: 'destructive'
      })
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return
    if (!confirm(`Delete ${selectedIds.length} selected items?`)) return

    try {
      const results = await Promise.all(
        selectedIds.map(id => deleteInventoryItemServer(id))
      );
      
      const failedCount = results.filter(r => !r.success).length;
      
      if (failedCount > 0) {
        toast({
          title: 'Partial Success',
          description: `Deleted ${selectedIds.length - failedCount} items, ${failedCount} failed`,
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Success',
          description: `Deleted ${selectedIds.length} items`
        });
      }
      setSelectedIds([])
      fetchInventory(true)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete some items',
        variant: 'destructive'
      })
    }
  }

  // ============================================================================
  // FILTERING & SORTING
  // ============================================================================

  const filteredItems = useMemo(() => {
    if (!Array.isArray(items)) return []
    let result = [...items]

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      result = result.filter(item =>
        item.name.toLowerCase().includes(search) ||
        item.sku?.toLowerCase().includes(search) ||
        item.category?.toLowerCase().includes(search) ||
        item.location?.toLowerCase().includes(search)
      )
    }

    // Category filter
    if (categoryFilter && categoryFilter !== 'all') {
      result = result.filter(item => item.category === categoryFilter)
    }

    // Status filter
    if (statusFilter && statusFilter !== 'all') {
      result = result.filter(item => item.status === statusFilter)
    }

    return result
  }, [items, searchTerm, categoryFilter, statusFilter])

  // ============================================================================
  // EXPORT FUNCTIONALITY
  // ============================================================================

  const exportToCSV = () => {
    const headers = ['Name', 'SKU', 'Category', 'Current Stock', 'Unit', 'Min Stock', 'Cost Per Unit', 'Total Value', 'Location', 'Status']
    const rows = filteredItems.map(item => [
      item.name,
      item.sku || '',
      item.category || '',
      item.current_stock,
      item.unit,
      item.min_stock,
      item.cost_per_unit,
      item.total_value,
      item.location || '',
      item.status
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inventory_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Package className="w-6 h-6 sm:w-8 sm:h-8 text-orange-500" />
            <span className="truncate">Inventory</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1 hidden sm:block">
            Track stock levels, manage supplies, and optimize inventory
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchInventory(true)}
            disabled={refreshing}
            className="text-xs sm:text-sm h-8 sm:h-9"
          >
            <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCSV}
            className="text-xs sm:text-sm h-8 sm:h-9"
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Button
            onClick={() => {
              setEditingItem(null)
              setShowItemDialog(true)
            }}
            className="bg-orange-500 hover:bg-orange-600 text-xs sm:text-sm h-8 sm:h-9 flex-1 sm:flex-none"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <InventoryStatsCards summary={summary} />

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3 sm:space-y-4">
        <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
          <TabsList className="w-auto inline-flex">
            <TabsTrigger value="inventory" className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4">
              <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Inventory</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4">
              <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Analytics</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="inventory" className="space-y-3 sm:space-y-4">
          {/* Filters Bar */}
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col gap-3 sm:gap-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search items..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-9 sm:h-10 text-sm"
                  />
                </div>

                {/* Filters Row */}
                <div className="flex flex-wrap gap-2">
                  {/* Category Filter */}
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-full sm:w-40 h-8 sm:h-9 text-xs sm:text-sm">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.icon} {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Status Filter */}
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-36 h-8 sm:h-9 text-xs sm:text-sm">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="in_stock">🟢 In Stock</SelectItem>
                      <SelectItem value="low_stock">🟠 Low Stock</SelectItem>
                      <SelectItem value="out_of_stock">🔴 Out of Stock</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* View Mode Toggle */}
                  <div className="flex items-center border rounded-md ml-auto">
                    <Button
                      variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('table')}
                      className="rounded-r-none h-8 sm:h-9 px-2 sm:px-3"
                    >
                      <List className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('grid')}
                      className="rounded-l-none h-8 sm:h-9 px-2 sm:px-3"
                    >
                      <Grid3X3 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Active Filters */}
              {(searchTerm || categoryFilter !== 'all' || statusFilter !== 'all') && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t flex-wrap">
                  <span className="text-xs text-gray-500">Filters:</span>
                  {searchTerm && (
                    <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                      {searchTerm.slice(0, 10)}{searchTerm.length > 10 && '...'}
                      <X
                        className="w-3 h-3 cursor-pointer"
                        onClick={() => setSearchTerm('')}
                      />
                    </Badge>
                  )}
                  {categoryFilter !== 'all' && (
                    <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                      {categoryFilter}
                      <X
                        className="w-3 h-3 cursor-pointer"
                        onClick={() => setCategoryFilter('all')}
                      />
                    </Badge>
                  )}
                  {statusFilter !== 'all' && (
                    <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                      {statusFilter.replace('_', ' ')}
                      <X
                        className="w-3 h-3 cursor-pointer"
                        onClick={() => setStatusFilter('all')}
                      />
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() => {
                      setSearchTerm('')
                      setCategoryFilter('all')
                      setStatusFilter('all')
                    }}
                  >
                    Clear
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results Info & Bulk Actions */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              {filteredItems.length} of {items.length} items
            </p>
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-xs">{selectedIds.length} selected</Badge>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleBulkDelete}
                >
                  Delete
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSelectedIds([])}
                >
                  Clear
                </Button>
              </div>
            )}
          </div>

          {/* Inventory Table */}
          <InventoryTable
            items={filteredItems}
            selectable={true}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            onEdit={(item) => {
              startTransition(() => {
                setEditingItem(item)
                setShowItemDialog(true)
              })
            }}
            onAdjust={(item) => {
              startTransition(() => {
                setAdjustingItem(item)
                setShowStockDialog(true)
              })
            }}
            onViewHistory={(item) => {
              startTransition(() => {
                setViewingTransactions(item)
                setShowTransactionHistory(true)
              })
            }}
            onDelete={handleDeleteItem}
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4 sm:space-y-6">
          {/* Extended Stats */}
          <InventoryExtendedStats summary={summary} />

          {/* Alerts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <LowStockAlertsCard 
              items={items}
              onItemClick={(item) => {
                setAdjustingItem(item)
                setShowStockDialog(true)
              }}
            />
            <ReorderSuggestionsCard 
              items={lowStockItems}
            />
            <InventoryAlertsCard alerts={alerts} />
          </div>

          {/* Category Value Distribution */}
          <CategoryValueCard categories={categories} />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ItemDialog
        open={showItemDialog}
        onOpenChange={(open) => {
          setShowItemDialog(open)
          if (!open) setEditingItem(null)
        }}
        item={editingItem}
        onSave={handleSaveItem}
      />

      <StockAdjustmentDialog
        open={showStockDialog}
        onOpenChange={(open) => {
          setShowStockDialog(open)
          if (!open) setAdjustingItem(null)
        }}
        item={adjustingItem}
        onSubmit={handleAdjustStock}
      />

      <TransactionHistoryDialog
        open={showTransactionHistory}
        onOpenChange={(open) => {
          setShowTransactionHistory(open)
          if (!open) setViewingTransactions(null)
        }}
        item={viewingTransactions}
        onTransactionDeleted={() => fetchInventory(true)}
      />
    </div>
  )
}
