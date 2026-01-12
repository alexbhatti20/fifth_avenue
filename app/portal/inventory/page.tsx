'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Package, Plus, Search, Filter, Download, Upload,
  RefreshCw, AlertTriangle, TrendingUp, TrendingDown,
  BarChart3, Settings, Bell, X, ChevronDown,
  Layers, Grid3X3, List, SlidersHorizontal
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
  StockTransaction,
  InventoryAlert,
  LowStockItem,
  CreateItemData,
  StockAdjustmentData,
  CategoryValue
} from '@/lib/inventory-queries'

import { CATEGORIES } from '@/lib/inventory-queries'

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function InventoryPage() {
  const { toast } = useToast()
  const { employee } = usePortalAuth()
  
  // Core state
  const [items, setItems] = useState<InventoryItem[]>([])
  const [summary, setSummary] = useState<InventorySummary | null>(null)
  const [transactions, setTransactions] = useState<StockTransaction[]>([])
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([])
  const [alerts, setAlerts] = useState<InventoryAlert[]>([])
  const [categories, setCategories] = useState<CategoryValue[]>([])
  
  // UI state
  const [loading, setLoading] = useState(true)
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

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchInventory = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true)
    else setLoading(true)
    
    try {
      const [itemsRes, summaryRes, lowStockRes, alertsRes] = await Promise.all([
        fetch('/api/inventory?action=list'),
        fetch('/api/inventory?action=summary'),
        fetch('/api/inventory?action=low-stock'),
        fetch('/api/inventory?action=alerts')
      ])

      if (itemsRes.ok) {
        const json = await itemsRes.json()
        // API returns { success: true, data: items[] }
        const items = json.data || json.items || json || []
        setItems(Array.isArray(items) ? items : [])
      }

      if (summaryRes.ok) {
        const json = await summaryRes.json()
        // API returns { success: true, data: summary }
        const summary = json.data || json
        setSummary(summary)
        // Set categories from summary
        if (summary?.categories) {
          setCategories(summary.categories)
        }
      }

      if (lowStockRes.ok) {
        const json = await lowStockRes.json()
        // API returns { success: true, data: lowStockItems[] }
        const items = json.data || json.items || json || []
        setLowStockItems(Array.isArray(items) ? items : [])
      }

      if (alertsRes.ok) {
        const json = await alertsRes.json()
        // API returns { success: true, data: alerts[] }
        const alerts = json.data || json.alerts || json || []
        setAlerts(Array.isArray(alerts) ? alerts : [])
      }

    } catch (error) {
      console.error('Failed to fetch inventory:', error)
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

  const fetchItemTransactions = useCallback(async (itemId: string) => {
    try {
      const response = await fetch(`/api/inventory/${itemId}?action=transactions`)
      if (response.ok) {
        const json = await response.json()
        // API returns { success: true, data: transactions[] }
        const txns = json.data || json.transactions || json || []
        setTransactions(Array.isArray(txns) ? txns : [])
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error)
    }
  }, [])

  useEffect(() => {
    fetchInventory()
  }, [fetchInventory])

  // ============================================================================
  // CRUD OPERATIONS
  // ============================================================================

  const handleSaveItem = async (data: CreateItemData) => {
    try {
      const url = editingItem 
        ? `/api/inventory/${editingItem.id}` 
        : '/api/inventory'
      const method = editingItem ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          created_by: employee?.id
        })
      })

      if (!response.ok) throw new Error('Failed to save item')

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
      const response = await fetch(`/api/inventory/${item.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete item')

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
      const response = await fetch('/api/inventory/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: data.itemId || adjustingItem.id,
          transactionType: data.transactionType,
          quantity: data.quantity,
          reason: data.reason,
          unitCost: data.unitCost,
          referenceNumber: data.referenceNumber,
          batchNumber: data.batchNumber
        })
      })

      if (!response.ok) throw new Error('Failed to adjust stock')

      toast({ title: 'Success', description: 'Stock adjusted successfully' })
      setShowStockDialog(false)
      setAdjustingItem(null)
      fetchInventory(true)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to adjust stock',
        variant: 'destructive'
      })
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return
    if (!confirm(`Delete ${selectedIds.length} selected items?`)) return

    try {
      const promises = selectedIds.map(id =>
        fetch(`/api/inventory/${id}`, { method: 'DELETE' })
      )
      await Promise.all(promises)

      toast({
        title: 'Success',
        description: `Deleted ${selectedIds.length} items`
      })
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

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Package className="w-8 h-8 text-orange-500" />
            Inventory Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Track stock levels, manage supplies, and optimize inventory
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchInventory(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCSV}
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button
            onClick={() => {
              setEditingItem(null)
              setShowItemDialog(true)
            }}
            className="bg-orange-500 hover:bg-orange-600"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </Button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <InventoryStatsCards summary={summary} />

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="inventory" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Inventory
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-4">
          {/* Filters Bar */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search by name, SKU, category, or location..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Category Filter */}
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full lg:w-48">
                    <SelectValue placeholder="All Categories" />
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
                  <SelectTrigger className="w-full lg:w-40">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="in_stock">🟢 In Stock</SelectItem>
                    <SelectItem value="low_stock">🟠 Low Stock</SelectItem>
                    <SelectItem value="out_of_stock">🔴 Out of Stock</SelectItem>
                  </SelectContent>
                </Select>

                {/* View Mode Toggle */}
                <div className="flex items-center border rounded-md">
                  <Button
                    variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('table')}
                    className="rounded-r-none"
                  >
                    <List className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="rounded-l-none"
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Active Filters */}
              {(searchTerm || categoryFilter !== 'all' || statusFilter !== 'all') && (
                <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                  <span className="text-sm text-gray-500">Active filters:</span>
                  {searchTerm && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      Search: {searchTerm}
                      <X
                        className="w-3 h-3 cursor-pointer"
                        onClick={() => setSearchTerm('')}
                      />
                    </Badge>
                  )}
                  {categoryFilter !== 'all' && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      Category: {categoryFilter}
                      <X
                        className="w-3 h-3 cursor-pointer"
                        onClick={() => setCategoryFilter('all')}
                      />
                    </Badge>
                  )}
                  {statusFilter !== 'all' && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      Status: {statusFilter}
                      <X
                        className="w-3 h-3 cursor-pointer"
                        onClick={() => setStatusFilter('all')}
                      />
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchTerm('')
                      setCategoryFilter('all')
                      setStatusFilter('all')
                    }}
                  >
                    Clear all
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results Info & Bulk Actions */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Showing {filteredItems.length} of {items.length} items
            </p>
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{selectedIds.length} selected</Badge>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                >
                  Delete Selected
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds([])}
                >
                  Clear Selection
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
              setEditingItem(item)
              setShowItemDialog(true)
            }}
            onAdjust={(item) => {
              setAdjustingItem(item)
              setShowStockDialog(true)
            }}
            onViewHistory={(item) => {
              setViewingTransactions(item)
              fetchItemTransactions(item.id)
              setShowTransactionHistory(true)
            }}
            onDelete={handleDeleteItem}
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {/* Extended Stats */}
          <InventoryExtendedStats summary={summary} />

          {/* Alerts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
          if (!open) {
            setViewingTransactions(null)
            setTransactions([])
          }
        }}
        item={viewingTransactions}
        transactions={transactions}
      />
    </div>
  )
}
