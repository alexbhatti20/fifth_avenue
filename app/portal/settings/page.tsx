'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Settings,
  User,
  Lock,
  Bell,
  Globe,
  Palette,
  Shield,
  Mail,
  Phone,
  Camera,
  Key,
  Smartphone,
  Eye,
  EyeOff,
  Save,
  CheckCircle,
  AlertTriangle,
  Info,
  Upload,
  Image,
  FileText,
  Clock,
  MapPin,
  Facebook,
  Instagram,
  Twitter,
  CreditCard,
  Building2,
  Plus,
  Trash2,
  Pencil,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SectionHeader } from '@/components/portal/PortalProvider';
import { usePortalAuth } from '@/hooks/usePortal';
import { createClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const supabase = createClient();

// Personal Settings
function PersonalSettings() {
  const { employee } = usePortalAuth();
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: '',
    emergency_contact: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (employee) {
      setFormData({
        full_name: employee.name || '',
        email: employee.email || '',
        phone: employee.phone || '',
        address: employee.address || '',
        emergency_contact: employee.emergency_contact || '',
      });
      setPhotoPreview(employee.avatar_url || null);
    }
  }, [employee]);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoPreview(URL.createObjectURL(file));
      // Upload logic here
    }
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      // Get auth token from localStorage
      const authToken = localStorage.getItem('auth_token');
      
      // Use API route instead of direct Supabase query
      const response = await fetch('/api/admin/employees', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          id: employee?.id,
          name: formData.full_name,
          phone: formData.phone,
          avatar_url: photoPreview,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to update profile');
      }
      
      toast.success('Profile updated successfully');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile Photo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Camera className="h-4 w-4" /> Profile Photo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={photoPreview || undefined} />
                <AvatarFallback className="text-2xl">
                  {formData.full_name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <label className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center cursor-pointer hover:bg-primary/90 transition-colors">
                <Camera className="h-4 w-4 text-primary-foreground" />
                <input type="file" accept="image/*" onChange={handlePhotoChange} className="sr-only" />
              </label>
            </div>
            <div>
              <p className="font-medium">{formData.full_name}</p>
              <p className="text-sm text-muted-foreground capitalize">{employee?.role?.replace('_', ' ')}</p>
              <p className="text-xs text-muted-foreground mt-1">Employee since {employee?.hired_date ? new Date(employee.hired_date).toLocaleDateString() : 'N/A'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" /> Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+92 XXX XXXXXXX"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emergency_contact">Emergency Contact</Label>
              <Input
                id="emergency_contact"
                value={formData.emergency_contact}
                onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
                placeholder="Name - Phone"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={2}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSave} disabled={isSubmitting}>
            <Save className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

// Security Settings
function SecuritySettings() {
  const { employee } = usePortalAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [twoFAEnabled, setTwoFAEnabled] = useState(employee?.is_2fa_enabled || false);
  const [showDisable2FA, setShowDisable2FA] = useState(false);

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;
      toast.success('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle2FA = async () => {
    if (twoFAEnabled) {
      setShowDisable2FA(true);
    } else {
      // Enable 2FA flow
      toast.info('2FA setup coming soon');
    }
  };

  return (
    <div className="space-y-6">
      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4" /> Change Password
          </CardTitle>
          <CardDescription>Update your password regularly for security</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current_password">Current Password</Label>
            <div className="relative">
              <Input
                id="current_password"
                type={showPasswords ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0"
                onClick={() => setShowPasswords(!showPasswords)}
              >
                {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="new_password">New Password</Label>
              <Input
                id="new_password"
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirm New Password</Label>
              <Input
                id="confirm_password"
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handlePasswordChange} disabled={isSubmitting || !currentPassword || !newPassword}>
            {isSubmitting ? 'Updating...' : 'Update Password'}
          </Button>
        </CardFooter>
      </Card>

      {/* Two-Factor Authentication */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Smartphone className="h-4 w-4" /> Two-Factor Authentication
          </CardTitle>
          <CardDescription>Add an extra layer of security to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center',
                twoFAEnabled ? 'bg-green-500/10' : 'bg-zinc-200 dark:bg-zinc-700'
              )}>
                {twoFAEnabled ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <Shield className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="font-medium">
                  {twoFAEnabled ? '2FA is Enabled' : '2FA is Disabled'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {twoFAEnabled 
                    ? 'Your account is protected with 2FA' 
                    : 'Enable 2FA for enhanced security'}
                </p>
              </div>
            </div>
            <Switch checked={twoFAEnabled} onCheckedChange={handleToggle2FA} />
          </div>
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" /> Active Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Current Session</p>
                  <p className="text-xs text-muted-foreground">Windows • Chrome • Lahore, PK</p>
                </div>
              </div>
              <Badge className="bg-green-500/10 text-green-500">Active</Badge>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="outline" className="text-destructive">
            Log Out All Other Sessions
          </Button>
        </CardFooter>
      </Card>

      {/* Disable 2FA Dialog */}
      <AlertDialog open={showDisable2FA} onOpenChange={setShowDisable2FA}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Two-Factor Authentication?</AlertDialogTitle>
            <AlertDialogDescription>
              This will make your account less secure. Are you sure you want to disable 2FA?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive">Disable 2FA</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Website Settings (Admin only)
function WebsiteSettings() {
  const [settings, setSettings] = useState({
    siteName: 'ZOIRO',
    tagline: 'Broast & Fast Food',
    phone: '+92 42 1234567',
    email: 'info@zoiro.pk',
    address: 'Lahore, Pakistan',
    openingHours: '11:00 AM - 11:00 PM',
    facebook: '',
    instagram: '',
    twitter: '',
    deliveryRadius: '10',
    minOrderAmount: '500',
    deliveryFee: '100',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('website_content')
        .upsert({ id: 'settings', content: settings });

      if (error) throw error;
      toast.success('Website settings updated');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* General */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">General Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Site Name</Label>
              <Input
                value={settings.siteName}
                onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Tagline</Label>
              <Input
                value={settings.tagline}
                onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={settings.phone}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={settings.email}
                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Address</Label>
              <Input
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Opening Hours</Label>
              <Input
                value={settings.openingHours}
                onChange={(e) => setSettings({ ...settings, openingHours: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Social Media */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Social Media Links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Facebook className="h-4 w-4" /> Facebook
              </Label>
              <Input
                value={settings.facebook}
                onChange={(e) => setSettings({ ...settings, facebook: e.target.value })}
                placeholder="https://facebook.com/..."
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Instagram className="h-4 w-4" /> Instagram
              </Label>
              <Input
                value={settings.instagram}
                onChange={(e) => setSettings({ ...settings, instagram: e.target.value })}
                placeholder="https://instagram.com/..."
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Twitter className="h-4 w-4" /> Twitter
              </Label>
              <Input
                value={settings.twitter}
                onChange={(e) => setSettings({ ...settings, twitter: e.target.value })}
                placeholder="https://twitter.com/..."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delivery Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Delivery Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Delivery Radius (km)</Label>
              <Input
                type="number"
                value={settings.deliveryRadius}
                onChange={(e) => setSettings({ ...settings, deliveryRadius: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Minimum Order (Rs.)</Label>
              <Input
                type="number"
                value={settings.minOrderAmount}
                onChange={(e) => setSettings({ ...settings, minOrderAmount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Delivery Fee (Rs.)</Label>
              <Input
                type="number"
                value={settings.deliveryFee}
                onChange={(e) => setSettings({ ...settings, deliveryFee: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSave} disabled={isSubmitting}>
            <Save className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Saving...' : 'Save All Settings'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

// Payment Methods Types
interface PaymentMethod {
  id: string;
  method_type: 'jazzcash' | 'easypaisa' | 'bank';
  method_name: string;
  account_number: string;
  account_holder_name: string;
  bank_name: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface PaymentMethodsStats {
  total: number;
  active: number;
  inactive: number;
  jazzcash: number;
  easypaisa: number;
  bank: number;
}

// Payment Methods Settings (Admin only)
function PaymentMethodsSettings() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [stats, setStats] = useState<PaymentMethodsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [formData, setFormData] = useState({
    method_type: 'jazzcash' as 'jazzcash' | 'easypaisa' | 'bank',
    method_name: '',
    account_number: '',
    account_holder_name: '',
    bank_name: '',
    is_active: true,
    display_order: 0,
  });

  // Fetch payment methods
  const fetchMethods = async () => {
    setLoading(true);
    try {
      const authToken = localStorage.getItem('auth_token');
      const response = await fetch('/api/admin/payment-methods', {
        headers: {
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
        },
      });
      const data = await response.json();
      if (data.success) {
        setMethods(data.methods || []);
        setStats(data.stats || null);
      } else {
        toast.error(data.error || 'Failed to fetch payment methods');
      }
    } catch (error) {
      toast.error('Failed to fetch payment methods');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMethods();
  }, []);

  // Reset form
  const resetForm = () => {
    setFormData({
      method_type: 'jazzcash',
      method_name: '',
      account_number: '',
      account_holder_name: '',
      bank_name: '',
      is_active: true,
      display_order: methods.length,
    });
    setEditingMethod(null);
    setShowForm(false);
  };

  // Open edit form
  const handleEdit = (method: PaymentMethod) => {
    setEditingMethod(method);
    setFormData({
      method_type: method.method_type,
      method_name: method.method_name,
      account_number: method.account_number,
      account_holder_name: method.account_holder_name,
      bank_name: method.bank_name || '',
      is_active: method.is_active,
      display_order: method.display_order,
    });
    setShowForm(true);
  };

  // Submit form (create or update)
  const handleSubmit = async () => {
    if (!formData.method_name || !formData.account_number || !formData.account_holder_name) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formData.method_type === 'bank' && !formData.bank_name) {
      toast.error('Bank name is required for bank accounts');
      return;
    }

    setIsSubmitting(true);
    try {
      const authToken = localStorage.getItem('auth_token');
      const url = '/api/admin/payment-methods';
      const method = editingMethod ? 'PUT' : 'POST';
      const body = editingMethod 
        ? { id: editingMethod.id, ...formData }
        : formData;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (data.success) {
        toast.success(editingMethod ? 'Payment method updated' : 'Payment method created');
        resetForm();
        fetchMethods();
      } else {
        toast.error(data.error || 'Operation failed');
      }
    } catch (error) {
      toast.error('Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete method
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this payment method?')) return;

    try {
      const authToken = localStorage.getItem('auth_token');
      const response = await fetch(`/api/admin/payment-methods?id=${id}`, {
        method: 'DELETE',
        headers: {
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
        },
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Payment method deleted');
        fetchMethods();
      } else {
        toast.error(data.error || 'Failed to delete');
      }
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  // Toggle active status
  const handleToggleStatus = async (id: string, is_active: boolean) => {
    try {
      const authToken = localStorage.getItem('auth_token');
      const response = await fetch('/api/admin/payment-methods', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ id, is_active }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success(data.message);
        fetchMethods();
      } else {
        toast.error(data.error || 'Failed to update status');
      }
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  // Get icon for method type
  const getMethodIcon = (type: string) => {
    switch (type) {
      case 'jazzcash':
        return <Smartphone className="h-5 w-5 text-red-500" />;
      case 'easypaisa':
        return <Smartphone className="h-5 w-5 text-green-500" />;
      case 'bank':
        return <Building2 className="h-5 w-5 text-blue-500" />;
      default:
        return <CreditCard className="h-5 w-5" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Methods</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-green-500">{stats.active}</div>
            <div className="text-sm text-muted-foreground">Active</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-gray-400">{stats.inactive}</div>
            <div className="text-sm text-muted-foreground">Inactive</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-red-500">{stats.jazzcash}</div>
            <div className="text-sm text-muted-foreground">JazzCash</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-green-500">{stats.easypaisa}</div>
            <div className="text-sm text-muted-foreground">EasyPaisa</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-blue-500">{stats.bank}</div>
            <div className="text-sm text-muted-foreground">Bank Accounts</div>
          </Card>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              {editingMethod ? 'Edit Payment Method' : 'Add Payment Method'}
            </CardTitle>
            <CardDescription>
              Configure online payment method details for customers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Method Type *</Label>
                <Select
                  value={formData.method_type}
                  onValueChange={(v) => setFormData({ ...formData, method_type: v as 'jazzcash' | 'easypaisa' | 'bank' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="jazzcash">JazzCash</SelectItem>
                    <SelectItem value="easypaisa">EasyPaisa</SelectItem>
                    <SelectItem value="bank">Bank Account</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Display Name *</Label>
                <Input
                  value={formData.method_name}
                  onChange={(e) => setFormData({ ...formData, method_name: e.target.value })}
                  placeholder="e.g., JazzCash - Main Account"
                />
              </div>
              <div className="space-y-2">
                <Label>Account Number *</Label>
                <Input
                  value={formData.account_number}
                  onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                  placeholder="e.g., 03001234567"
                />
              </div>
              <div className="space-y-2">
                <Label>Account Holder Name *</Label>
                <Input
                  value={formData.account_holder_name}
                  onChange={(e) => setFormData({ ...formData, account_holder_name: e.target.value })}
                  placeholder="e.g., ZOIRO Restaurant"
                />
              </div>
              {formData.method_type === 'bank' && (
                <div className="space-y-2">
                  <Label>Bank Name *</Label>
                  <Input
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    placeholder="e.g., HBL, MCB, UBL"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Display Order</Label>
                <Input
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
              <div className="flex items-center space-x-2 pt-6">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label>Active (visible to customers)</Label>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              <Save className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Saving...' : (editingMethod ? 'Update Method' : 'Add Method')}
            </Button>
            <Button variant="outline" onClick={resetForm}>
              Cancel
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <Button onClick={() => setShowForm(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Add Payment Method
        </Button>
      )}

      {/* Payment Methods List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configured Payment Methods</CardTitle>
          <CardDescription>
            Customers will see these payment options during checkout
          </CardDescription>
        </CardHeader>
        <CardContent>
          {methods.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No payment methods configured yet</p>
              <p className="text-sm">Add your first payment method above</p>
            </div>
          ) : (
            <div className="space-y-3">
              {methods.map((method) => (
                <div
                  key={method.id}
                  className={cn(
                    'flex items-center justify-between p-4 rounded-lg border transition-colors',
                    method.is_active ? 'bg-background' : 'bg-zinc-50 dark:bg-zinc-800/50 opacity-60'
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center',
                      method.method_type === 'jazzcash' ? 'bg-red-100 dark:bg-red-900/30' :
                      method.method_type === 'easypaisa' ? 'bg-green-100 dark:bg-green-900/30' :
                      'bg-blue-100 dark:bg-blue-900/30'
                    )}>
                      {getMethodIcon(method.method_type)}
                    </div>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {method.method_name}
                        {!method.is_active && (
                          <Badge variant="secondary" className="text-xs">Inactive</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {method.account_number} • {method.account_holder_name}
                        {method.bank_name && ` • ${method.bank_name}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={method.is_active}
                      onCheckedChange={(checked) => handleToggleStatus(method.id, checked)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(method)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(method.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-500 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-700 dark:text-blue-300">How it works</p>
              <p className="text-blue-600 dark:text-blue-400 mt-1">
                When customers select an online payment method, they will see the account details and 
                must enter their transaction ID for verification. You can verify payments in the orders section.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Main Settings Page
export default function SettingsPage() {
  const { role } = usePortalAuth();
  const isAdmin = role === 'admin';

  return (
    <>
      <SectionHeader
        title="Settings"
        description="Manage your profile and application settings"
      />

      <Tabs defaultValue="personal" className="space-y-4 sm:space-y-6">
        <TabsList className="w-full sm:w-auto h-auto flex-wrap">
          <TabsTrigger value="personal" className="gap-1 sm:gap-2 text-xs sm:text-sm flex-1 sm:flex-none">
            <User className="h-3 w-3 sm:h-4 sm:w-4" /> Personal
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-1 sm:gap-2 text-xs sm:text-sm flex-1 sm:flex-none">
            <Shield className="h-3 w-3 sm:h-4 sm:w-4" /> Security
          </TabsTrigger>
          {isAdmin && (
            <>
              <TabsTrigger value="payment-methods" className="gap-1 sm:gap-2 text-xs sm:text-sm flex-1 sm:flex-none">
                <CreditCard className="h-3 w-3 sm:h-4 sm:w-4" /> Payments
              </TabsTrigger>
              <TabsTrigger value="website" className="gap-1 sm:gap-2 text-xs sm:text-sm flex-1 sm:flex-none">
                <Globe className="h-3 w-3 sm:h-4 sm:w-4" /> Website
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="personal">
          <PersonalSettings />
        </TabsContent>

        <TabsContent value="security">
          <SecuritySettings />
        </TabsContent>

        {isAdmin && (
          <>
            <TabsContent value="payment-methods">
              <PaymentMethodsSettings />
            </TabsContent>
            <TabsContent value="website">
              <WebsiteSettings />
            </TabsContent>
          </>
        )}
      </Tabs>
    </>
  );
}
