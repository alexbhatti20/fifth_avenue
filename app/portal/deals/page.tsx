'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gift,
  Plus,
  Search,
  Edit,
  Trash2,
  Copy,
  MoreVertical,
  Calendar,
  Percent,
  DollarSign,
  Clock,
  Tag,
  Users,
  CheckCircle,
  XCircle,
  Eye,
  ToggleLeft,
  ToggleRight,
  Zap,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { SectionHeader, StatsCard, DataTableWrapper } from '@/components/portal/PortalProvider';
import { usePortalAuth } from '@/hooks/usePortal';
import {
  getDeals,
  createDeal,
  updateDeal,
  toggleDealStatus,
  deleteDeal,
  type Deal,
} from '@/lib/portal-queries';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const DISCOUNT_TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  percentage: { label: 'Percentage Off', icon: <Percent className="h-4 w-4" />, color: 'bg-blue-500/10 text-blue-500' },
  fixed: { label: 'Fixed Amount', icon: <DollarSign className="h-4 w-4" />, color: 'bg-green-500/10 text-green-500' },
  bogo: { label: 'Buy One Get One', icon: <Gift className="h-4 w-4" />, color: 'bg-purple-500/10 text-purple-500' },
  combo: { label: 'Combo Deal', icon: <Gift className="h-4 w-4" />, color: 'bg-orange-500/10 text-orange-500' },
  discount: { label: 'Discount', icon: <Percent className="h-4 w-4" />, color: 'bg-blue-500/10 text-blue-500' },
};

// Deal Dialog
function DealDialog({
  deal,
  open,
  onOpenChange,
  onSave,
}: {
  deal?: Deal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Partial<Deal>) => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    deal_type: 'combo' as 'combo' | 'discount' | 'bogo',
    original_price: 0,
    discounted_price: 0,
    code: '',
    valid_from: '',
    valid_until: '',
    usage_limit: 0,
    is_active: true,
  });

  useEffect(() => {
    if (deal) {
      setFormData({
        name: deal.name,
        description: deal.description || '',
        deal_type: deal.deal_type || 'combo',
        original_price: deal.original_price || 0,
        discounted_price: deal.discounted_price || 0,
        code: deal.code || '',
        valid_from: (deal.valid_from || deal.start_date || '').split('T')[0],
        valid_until: (deal.valid_until || deal.end_date || '').split('T')[0],
        usage_limit: deal.usage_limit || 0,
        is_active: deal.is_active,
      });
    } else {
      const today = new Date().toISOString().split('T')[0];
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      setFormData({
        name: '',
        description: '',
        deal_type: 'combo',
        original_price: 0,
        discounted_price: 0,
        code: '',
        valid_from: today,
        valid_until: nextWeek,
        usage_limit: 0,
        is_active: true,
      });
    }
  }, [deal, open]);

  const generateCode = () => {
    const code = `ZOIRO${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    setFormData({ ...formData, code });
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.valid_from || !formData.valid_until) {
      toast.error('Please fill in all required fields');
      return;
    }
    onSave(formData as any);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{deal ? 'Edit Deal' : 'Create New Deal'}</DialogTitle>
          <DialogDescription>
            {deal ? 'Update deal details' : 'Create a promotional deal or discount'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="grid gap-4 py-4 pr-4">
            {/* Basic Info */}
            <div className="space-y-2">
              <Label>Deal Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Weekend Special"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the deal..."
              />
            </div>

            {/* Deal Type */}
            <div className="space-y-2">
              <Label>Deal Type</Label>
              <Select
                value={formData.deal_type}
                onValueChange={(v) => setFormData({ ...formData, deal_type: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="combo">Combo Deal</SelectItem>
                  <SelectItem value="discount">Discount</SelectItem>
                  <SelectItem value="bogo">Buy One Get One</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Original Price (Rs.)</Label>
                <Input
                  type="number"
                  value={formData.original_price}
                  onChange={(e) => setFormData({ ...formData, original_price: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Deal Price (Rs.)</Label>
                <Input
                  type="number"
                  value={formData.discounted_price}
                  onChange={(e) => setFormData({ ...formData, discounted_price: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            {/* Promo Code */}
            <div className="space-y-2">
              <Label>Promo Code (Optional)</Label>
              <div className="flex gap-2">
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="e.g., SAVE20"
                />
                <Button type="button" variant="outline" onClick={generateCode}>
                  <Zap className="h-4 w-4 mr-1" />
                  Generate
                </Button>
              </div>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <Input
                  type="date"
                  value={formData.valid_from}
                  onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date *</Label>
                <Input
                  type="date"
                  value={formData.valid_until}
                  onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                />
              </div>
            </div>

            {/* Usage Limit */}
            <div className="space-y-2">
              <Label>Usage Limit</Label>
              <Input
                type="number"
                value={formData.usage_limit}
                onChange={(e) => setFormData({ ...formData, usage_limit: parseInt(e.target.value) })}
                placeholder="0 = Unlimited"
              />
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
              <div>
                <Label>Active Status</Label>
                <p className="text-xs text-muted-foreground">Enable or disable this deal</p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            {deal ? 'Update Deal' : 'Create Deal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Deal Card
function DealCard({
  deal,
  onEdit,
  onDelete,
  onToggle,
}: {
  deal: Deal;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  // Support both old and new field names
  const dealType = deal.deal_type || deal.discount_type || 'combo';
  const config = DISCOUNT_TYPE_CONFIG[dealType] || DISCOUNT_TYPE_CONFIG.combo;
  const discountValue = deal.discount_percentage || deal.discount_value || 0;
  const startDate = deal.valid_from || deal.start_date || '';
  const endDate = deal.valid_until || deal.end_date || '';
  const usedCount = deal.usage_count ?? deal.used_count ?? 0;
  
  const now = new Date();
  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);
  const isExpired = endDateObj < now;
  const isUpcoming = startDateObj > now;
  const usagePercentage = deal.usage_limit ? (usedCount / deal.usage_limit) * 100 : 0;

  const getStatus = () => {
    if (isExpired) return { label: 'Expired', color: 'bg-red-500/10 text-red-500' };
    if (!deal.is_active) return { label: 'Inactive', color: 'bg-zinc-500/10 text-zinc-500' };
    if (isUpcoming) return { label: 'Upcoming', color: 'bg-blue-500/10 text-blue-500' };
    return { label: 'Active', color: 'bg-green-500/10 text-green-500' };
  };

  const status = getStatus();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="cursor-pointer"
      onClick={onEdit}
    >
      <Card className={cn('relative overflow-hidden hover:border-primary transition-colors', isExpired && 'opacity-60')}>
        {/* Status Badge */}
        <div className="absolute top-3 right-3">
          <Badge className={status.color}>{status.label}</Badge>
        </div>

        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className={cn('p-2 rounded-lg', config.color)}>
              {config.icon}
            </div>
            <div>
              <CardTitle className="text-base">{deal.name}</CardTitle>
              <CardDescription className="text-xs">{config.label}</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pb-3 space-y-3">
          {/* Discount Display */}
          <div className="text-2xl font-bold text-primary">
            {dealType === 'combo' && deal.discounted_price != null
              ? `Rs. ${deal.discounted_price}`
              : dealType === 'percentage' || dealType === 'discount'
              ? `${discountValue}% OFF`
              : dealType === 'fixed'
              ? `Rs. ${discountValue} OFF`
              : dealType === 'bogo'
              ? 'Buy 1 Get 1 FREE'
              : `${discountValue}% OFF`}
          </div>
          
          {/* Original Price for Combos */}
          {dealType === 'combo' && deal.original_price != null && deal.original_price > 0 && (
            <div className="text-sm text-muted-foreground">
              <span className="line-through">Rs. {deal.original_price}</span>
              {deal.discount_percentage > 0 && (
                <span className="ml-2 text-green-500">({deal.discount_percentage}% off)</span>
              )}
            </div>
          )}

          {/* Description */}
          {deal.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{deal.description}</p>
          )}
          
          {/* Deal Items */}
          {deal.items && deal.items.length > 0 && (
            <div className="text-xs text-muted-foreground">
              {deal.items.length} item{deal.items.length > 1 ? 's' : ''} included
            </div>
          )}

          {/* Promo Code */}
          {deal.code && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono">
                {deal.code}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(deal.code!);
                  toast.success('Code copied!');
                }}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Date Range */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}
          </div>

          {/* Usage */}
          {deal.usage_limit && deal.usage_limit > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Usage</span>
                <span>{usedCount}/{deal.usage_limit}</span>
              </div>
              <Progress value={usagePercentage} className="h-1.5" />
            </div>
          )}
        </CardContent>

        <CardFooter className="pt-0 flex justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            disabled={isExpired}
          >
            {deal.is_active ? (
              <>
                <ToggleRight className="h-4 w-4 mr-1 text-green-500" />
                Active
              </>
            ) : (
              <>
                <ToggleLeft className="h-4 w-4 mr-1" />
                Inactive
              </>
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-red-500">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardFooter>
      </Card>
    </motion.div>
  );
}

// Main Deals Page
export default function DealsPage() {
  const { employee } = usePortalAuth();
  const router = useRouter();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  const [isDealDialogOpen, setIsDealDialogOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);

  // Fetch deals from API
  const fetchDeals = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getDeals();
      setDeals(data);
    } catch (error) {
      
      toast.error('Failed to load deals');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  const filteredDeals = deals.filter((deal) => {
    const matchesSearch = deal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deal.code?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const endDate = deal.valid_until || deal.end_date || '';
    
    if (statusFilter === 'all') return matchesSearch;
    if (statusFilter === 'active') return matchesSearch && deal.is_active && new Date(endDate) >= new Date();
    if (statusFilter === 'inactive') return matchesSearch && !deal.is_active;
    if (statusFilter === 'expired') return matchesSearch && new Date(endDate) < new Date();
    return matchesSearch;
  });

  const handleSaveDeal = async (data: any) => {
    try {
      if (selectedDeal) {
        // Update existing deal
        const result = await updateDeal(selectedDeal.id, {
          name: data.name,
          description: data.description,
          original_price: data.original_price,
          discounted_price: data.discounted_price,
          valid_until: data.valid_until,
          is_active: data.is_active,
        });
        
        if (result.success) {
          toast.success('Deal updated successfully');
          fetchDeals();
        } else {
          toast.error(result.error || 'Failed to update deal');
        }
      } else {
        // Create new deal
        const result = await createDeal({
          name: data.name,
          description: data.description,
          code: data.code || undefined,
          deal_type: data.deal_type || 'combo',
          original_price: data.original_price || 0,
          discounted_price: data.discounted_price || 0,
          valid_from: data.valid_from,
          valid_until: data.valid_until,
          usage_limit: data.usage_limit || undefined,
          is_active: data.is_active,
        });
        
        if (result.success) {
          toast.success(`Deal created! Code: ${result.code}`);
          fetchDeals();
        } else {
          toast.error(result.error || 'Failed to create deal');
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'An error occurred');
    }
    
    setIsDealDialogOpen(false);
    setSelectedDeal(null);
  };

  const handleDeleteDeal = async (id: string) => {
    if (!confirm('Are you sure you want to delete this deal?')) return;
    
    try {
      const result = await deleteDeal(id);
      
      if (result.success) {
        toast.success('Deal deleted');
        fetchDeals();
      } else {
        toast.error(result.error || 'Failed to delete deal');
      }
    } catch (error: any) {
      toast.error(error.message || 'An error occurred');
    }
  };

  const handleToggleDeal = async (id: string) => {
    try {
      const result = await toggleDealStatus(id);
      
      if (result.success) {
        toast.success('Deal status updated');
        fetchDeals();
      } else {
        toast.error(result.error || 'Failed to toggle deal status');
      }
    } catch (error: any) {
      toast.error(error.message || 'An error occurred');
    }
  };

  const stats = {
    total: deals.length,
    active: deals.filter((d) => {
      const endDate = d.valid_until || d.end_date || '';
      return d.is_active && new Date(endDate) >= new Date();
    }).length,
    totalUsage: deals.reduce((sum, d) => sum + (d.usage_count ?? d.used_count ?? 0), 0),
    expiringSoon: deals.filter((d) => {
      const endDate = d.valid_until || d.end_date || '';
      const daysLeft = (new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return daysLeft > 0 && daysLeft <= 7;
    }).length,
  };

  return (
    <>
      <SectionHeader
        title="Deals & Promotions"
        description="Create and manage promotional deals"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchDeals}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={() => router.push('/portal/deals/add')}>
              <Plus className="h-4 w-4 mr-2" />
              Create Deal
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatsCard
          title="Total Deals"
          value={stats.total}
          icon={<Gift className="h-5 w-5" />}
        />
        <StatsCard
          title="Active Deals"
          value={stats.active}
          icon={<Sparkles className="h-5 w-5 text-green-500" />}
        />
        <StatsCard
          title="Total Redemptions"
          value={stats.totalUsage}
          icon={<Users className="h-5 w-5 text-blue-500" />}
        />
        <StatsCard
          title="Expiring Soon"
          value={stats.expiringSoon}
          icon={<Clock className="h-5 w-5 text-orange-500" />}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search deals or codes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Deals</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Deals Grid */}
      <DataTableWrapper isLoading={isLoading} isEmpty={filteredDeals.length === 0} emptyMessage="No deals found">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filteredDeals.map((deal) => (
              <DealCard
                key={deal.id}
                deal={deal}
                onEdit={() => router.push(`/portal/deals/${deal.id}`)}
                onDelete={() => handleDeleteDeal(deal.id)}
                onToggle={() => handleToggleDeal(deal.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      </DataTableWrapper>

      {/* Deal Dialog */}
      <DealDialog
        deal={selectedDeal}
        open={isDealDialogOpen}
        onOpenChange={setIsDealDialogOpen}
        onSave={handleSaveDeal}
      />
    </>
  );
}
