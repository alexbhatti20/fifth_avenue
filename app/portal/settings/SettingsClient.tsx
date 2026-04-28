'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
  QrCode,
  Copy,
  RotateCw,
  Wrench,
  Power,
  Send,
  AlertCircle,
  Calendar,
  Keyboard,
  Calculator,
  ShoppingCart,
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SectionHeader, usePortalAuthContext } from '@/components/portal/PortalProvider';
import { cn } from '@/lib/utils';
import KeyboardShortcutsSettings from '@/components/portal/KeyboardShortcutsSettings';
import PushNotificationSettings from '@/components/portal/settings/PushNotificationSettings';
import { toast } from 'sonner';
import { 
  updateEmployeeProfileServer,
  getPaymentMethodsServerAction,
  createPaymentMethodServer,
  updatePaymentMethodServer,
  deletePaymentMethodServer,
  togglePaymentMethodStatusServer,
  toggleMaintenanceModeServer,
  getWebsiteSettingsServerAction,
  updateWebsiteSettingsServer,
  getEmployeeProfileServerAction,
  generate2FASetupAction,
  enable2FAAction,
  disable2FAAction,
  getTaxSettingsAction,
  updateTaxSettingsAction,
  getOnlineOrderingSettingsAction,
  updateOnlineOrderingSettingsAction,
} from '@/lib/actions';
import { uploadEmployeeAvatar, deleteStorageFile } from '@/lib/storage';

// Types
export interface Employee {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  emergency_contact?: string;
  avatar_url?: string;
  role: string;
  hired_date?: string;
  employee_id?: string; // Employee ID number (e.g., EMP-001)
  is_2fa_enabled?: boolean;
}

export interface PaymentMethod {
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

export interface PaymentMethodsStats {
  total: number;
  active: number;
  inactive: number;
  jazzcash: number;
  easypaisa: number;
  bank: number;
}

export interface WebsiteSettings {
  siteName: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  openingHours: string;
  facebook: string;
  instagram: string;
  twitter: string;
  deliveryRadius: string;
  minOrderAmount: string;
  deliveryFee: string;
}

export interface TaxSettings {
  rate: number;
  enabled: boolean;
  label: string;
}

export interface OnlineOrderingSettings {
  enabled: boolean;
  disabled_message: string;
  updated_at?: string | null;
}

export interface MaintenanceStatus {
  is_enabled: boolean;
  enabled_at: string | null;
  enabled_by: string | null;
  reason_type: 'update' | 'bug_fix' | 'changes' | 'scheduled' | 'custom' | null;
  custom_reason: string | null;
  estimated_end_time: string | null;
  title?: string | null;
  message?: string | null;
  show_timer?: boolean;
  show_progress?: boolean;
}

export interface SettingsData {
  employee: Employee | null;
  paymentMethods: PaymentMethod[];
  paymentStats: PaymentMethodsStats | null;
  websiteSettings: WebsiteSettings | null;
}

// Helper to add cache busting only to regular URLs (not blob URLs)
const getCacheBustedUrl = (url: string | null | undefined): string | null => {
  if (!url || url.trim() === '') return null;
  // Don't add cache busting to blob URLs - they don't support query params
  if (url.startsWith('blob:')) return url;
  // Add cache busting to regular URLs
  return `${url.split('?')[0]}?t=${Date.now()}`;
};


// ONLINE ORDERING SETTINGS FORM
// Admin-only toggle to enable/disable customer online ordering flow
function OnlineOrdersSettingsForm({ initialSettings }: { initialSettings: OnlineOrderingSettings | null }) {
  const defaults: OnlineOrderingSettings = {
    enabled: true,
    disabled_message: 'Online ordering is currently unavailable. Please visit us in-store or try again later.',
    updated_at: null,
  };

  const hasSSRData = useRef(!!initialSettings);
  const hasFetched = useRef(false);

  const [settings, setSettings] = useState<OnlineOrderingSettings>(initialSettings ?? defaults);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(!initialSettings);

  useEffect(() => {
    if (hasSSRData.current || hasFetched.current) {
      setIsLoading(false);
      return;
    }

    hasFetched.current = true;
    getOnlineOrderingSettingsAction()
      .then((result) => {
        if (result.success && result.settings) {
          setSettings(result.settings as OnlineOrderingSettings);
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const result = await updateOnlineOrderingSettingsAction({
        enabled: settings.enabled,
        disabled_message: settings.disabled_message,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to save online ordering settings');
      }

      if (result.settings) {
        setSettings(result.settings as OnlineOrderingSettings);
      }

      toast.success('Online ordering settings saved', {
        description: settings.enabled
          ? 'Customers can now add items to cart and place orders online.'
          : 'Online ordering is now disabled for customers.',
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save online ordering settings');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-none border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" /> Online Orders Management
          </CardTitle>
          <CardDescription>
            Control whether customers can add items to cart and place orders from the website.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4 bg-muted/30">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="font-medium text-sm">
                  {settings.enabled ? 'Online Ordering Enabled' : 'Online Ordering Disabled'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {settings.enabled
                    ? 'Customers can place delivery and pickup orders from the website.'
                    : 'Customers cannot add items to cart or place new online orders.'}
                </p>
              </div>
              <Badge
                variant={settings.enabled ? 'default' : 'destructive'}
                className={settings.enabled ? 'bg-emerald-600 hover:bg-emerald-600' : ''}
              >
                {settings.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-md border bg-background px-3 py-2">
              <div>
                <p className="text-sm font-medium">Allow Customer Online Orders</p>
                <p className="text-xs text-muted-foreground">Turn off during outages, menu updates, or busy windows.</p>
              </div>
              <Switch
                checked={settings.enabled}
                onCheckedChange={(enabled) => setSettings((prev) => ({ ...prev, enabled }))}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {!settings.enabled && (
            <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Customers are currently blocked from cart actions and checkout. They will see your message below.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="ordering-disabled-message">Message Shown To Customers When Ordering Is Disabled</Label>
            <Textarea
              id="ordering-disabled-message"
              value={settings.disabled_message}
              onChange={(e) => setSettings((prev) => ({ ...prev, disabled_message: e.target.value }))}
              placeholder="Online ordering is currently unavailable. Please visit us in-store or try again later."
              rows={3}
              maxLength={240}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>This message appears when customers try to add to cart or place an order.</span>
              <span>{settings.disabled_message.length}/240</span>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSave} disabled={isSubmitting || !settings.disabled_message.trim()}>
            <Save className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Saving...' : 'Save Online Ordering Settings'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
// Personal Settings - Uses SSR data or fetches fresh from DB via RPC
function PersonalSettings({ 
  employeeId, 
  initialProfile 
}: { 
  employeeId: string | null;
  initialProfile?: Employee | null;
}) {
  const { refreshEmployee } = usePortalAuthContext();
  const hasSSRData = useRef(!!initialProfile);
  const hasFetched = useRef(false);
  
  const [formData, setFormData] = useState({
    full_name: initialProfile?.name || '',
    email: initialProfile?.email || '',
    phone: initialProfile?.phone || '',
    address: initialProfile?.address || '',
    emergency_contact: initialProfile?.emergency_contact || '',
  });
  const [employeeData, setEmployeeData] = useState<any>(initialProfile || null);
  const [isLoading, setIsLoading] = useState(!initialProfile);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    getCacheBustedUrl(initialProfile?.avatar_url)
  );
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isRemovingPhoto, setIsRemovingPhoto] = useState(false);

  // Fetch fresh employee data from database via SSR server action
  const fetchFreshData = useCallback(async () => {
    if (!employeeId) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      // Use SSR server action (no client requests visible in devtools)
      const result = await getEmployeeProfileServerAction(employeeId);
      
      if (!result.success) {
        toast.error('Failed to load profile');
        return;
      }
      
      if (result.employee) {
        const emp = result.employee;
        
        setEmployeeData(emp as any);
        setFormData({
          full_name: emp.name || '',
          email: emp.email || '',
          phone: emp.phone || '',
          address: emp.address || '',
          emergency_contact: emp.emergency_contact || '',
        });
        
        // Set avatar with cache busting (helper handles blob URLs)
        setPhotoPreview(getCacheBustedUrl(emp.avatar_url));
      } else {
        toast.error('Failed to load profile');
      }
    } catch (err) {
      toast.error('Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  }, [employeeId]);

  // Fetch on mount only if no SSR data was provided
  useEffect(() => {
    // Always skip if we have SSR data
    if (hasSSRData.current) {
      setIsLoading(false);
      return;
    }
    // Skip if already fetched
    if (hasFetched.current) {
      return;
    }
    hasFetched.current = true;
    fetchFreshData();
  }, [fetchFreshData]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      if (photoPreview && photoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, []);

  // Refresh data from server
  const handleRefresh = async () => {
    await fetchFreshData();
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB');
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        toast.error('Please select a valid image file');
        return;
      }
      
      // Revoke old blob URL if exists to prevent memory leaks
      if (photoPreview && photoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreview);
      }
      
      setPhotoFile(file);
      const previewUrl = URL.createObjectURL(file);
      setPhotoPreview(previewUrl);
    }
  };

  // Remove profile photo: delete from storage + clear DB avatar_url
  const handleRemovePhoto = async () => {
    const oldUrl = employeeData?.avatar_url;
    // Clear preview and staged file immediately for instant UI feedback
    if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    setPhotoFile(null);

    if (!employeeId) return;
    setIsRemovingPhoto(true);
    try {
      // 1. Clear avatar_url in DB
      const result = await updateEmployeeProfileServer(employeeId, {
        name: employeeData?.name || '',
        phone: employeeData?.phone || '',
        address: employeeData?.address || '',
        emergency_contact: employeeData?.emergency_contact || '',
        avatar_url: '',
      });
      if (result.success) {
        setEmployeeData((prev: any) => ({ ...prev, avatar_url: '' }));
        // 2. Delete old file from storage — await so we know if it succeeded
        if (oldUrl) {
          const deleteResult = await deleteStorageFile(oldUrl);
          if (!deleteResult.success) {
            console.warn('Storage delete failed (DB already cleared):', deleteResult.error);
          }
        }
        toast.success('Profile photo removed');
        setTimeout(() => { refreshEmployee().catch(() => {}); }, 100);
      } else {
        toast.error(result.error || 'Failed to remove photo');
      }
    } catch {
      toast.error('Failed to remove photo');
    } finally {
      setIsRemovingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (!employeeId) {
      toast.error('Employee ID not found. Please refresh the page.');
      return;
    }

    setIsSubmitting(true);
    toast.loading('Saving...', { id: 'save-profile' });
    
    // Add overall timeout to prevent infinite loading
    const saveTimeout = setTimeout(() => {
      setIsSubmitting(false);
      toast.dismiss('save-profile');
      toast.error('Save operation timed out. Please try again.');
    }, 45000); // 45 second max timeout
    
    try {
      let avatarUrl = employeeData?.avatar_url || '';
      
      // Upload new avatar if selected
      if (photoFile) {
        const oldAvatarUrl = employeeData?.avatar_url || '';
        toast.loading('Uploading profile photo...', { id: 'save-profile' });
        try {
          const uploadResult = await uploadEmployeeAvatar(photoFile, employeeId);
          
          if (!uploadResult.success || !uploadResult.url) {
            const errorMsg = uploadResult.error || 'Failed to upload profile photo';
            throw new Error(errorMsg);
          }
          
          avatarUrl = uploadResult.url;
          // Delete old image from storage after new one is confirmed uploaded
          if (oldAvatarUrl && oldAvatarUrl !== avatarUrl) {
            deleteStorageFile(oldAvatarUrl).catch(() => {}); // non-blocking, silent fail
          }
        } catch (uploadError: any) {
          throw new Error(uploadError.message || 'Failed to upload profile photo');
        }
      }
      
      toast.loading('Updating profile...', { id: 'save-profile' });
      
      // Update employee data using SSR server action (hidden from browser network tab)
      const result = await updateEmployeeProfileServer(employeeId, {
        name: formData.full_name,
        phone: formData.phone,
        address: formData.address,
        emergency_contact: formData.emergency_contact,
        avatar_url: avatarUrl,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to update profile');
      }
      
      // Update local state directly
      const updatedEmployee = {
        ...employeeData,
        name: formData.full_name,
        phone: formData.phone,
        address: formData.address,
        emergency_contact: formData.emergency_contact,
        avatar_url: avatarUrl,
      };
      setEmployeeData(updatedEmployee);
      
      // Revoke blob URL if exists (memory cleanup)
      if (photoPreview && photoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreview);
      }
      
      // Clear the photo file
      setPhotoFile(null);
      
      // Set the new uploaded URL as preview immediately (with cache busting)
      if (avatarUrl) {
        setPhotoPreview(getCacheBustedUrl(avatarUrl));
      }
      
      clearTimeout(saveTimeout);
      setIsSubmitting(false);
      toast.success('Profile updated successfully');
      
      // Refresh context for sidebar/header AFTER success toast (non-blocking)
      // Use setTimeout to not block the UI
      setTimeout(async () => {
        try {
          await refreshEmployee();
        } catch (e) {
          // Silent fail
        }
      }, 100);
      
    } catch (error: any) {
      clearTimeout(saveTimeout);
      setIsSubmitting(false);
      toast.error(error.message || 'Failed to update profile');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!employeeData) {
    return (
      <Card className="rounded-none border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white overflow-hidden">
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Unable to load profile data</p>
            <Button variant="outline" className="mt-4" onClick={handleRefresh}>
              <RotateCw className="h-4 w-4 mr-2" /> Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Photo - Advanced Preview */}
      <Card className="rounded-none border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Camera className="h-4 w-4" /> Profile Photo
          </CardTitle>
          <CardDescription>
            Upload a profile picture. Supported formats: JPG, PNG, GIF (max 5MB)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Photo Preview Box */}
            <div className="relative group">
              <div className="h-32 w-32 rounded-none border-4 border-black overflow-hidden bg-zinc-100 flex items-center justify-center transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] group-hover:shadow-none group-hover:translate-x-[2px] group-hover:translate-y-[2px]">
                {photoPreview ? (
                  <>
                    <img 
                      key={photoPreview}
                      src={photoPreview} 
                      alt={formData.full_name || 'Profile'}
                      className="h-full w-full object-cover"
                      onError={() => {
                        setPhotoPreview(null);
                      }}
                    />
                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <label className="cursor-pointer p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors">
                        <Camera className="h-6 w-6 text-white" />
                        <input type="file" accept="image/*" onChange={handlePhotoChange} className="sr-only" />
                      </label>
                    </div>
                  </>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center justify-center h-full w-full p-4 text-center">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-2">
                      <User className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <span className="text-xs text-muted-foreground">Click to upload</span>
                    <input type="file" accept="image/*" onChange={handlePhotoChange} className="sr-only" />
                  </label>
                )}
              </div>
              
              {/* Photo file indicator */}
              {photoFile && (
                <Badge variant="secondary" className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-xs">
                  New photo selected
                </Badge>
              )}
            </div>
            
            {/* Employee Info */}
            <div className="flex-1 space-y-2">
              <div>
                <p className="font-semibold text-lg">{formData.full_name || 'Employee'}</p>
                <p className="text-sm text-muted-foreground capitalize">{employeeData.role?.replace('_', ' ')}</p>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Employee since {employeeData.hired_date ? new Date(employeeData.hired_date).toLocaleDateString() : 'N/A'}</p>
                <p>ID: {employeeData.employee_id || 'N/A'}</p>
              </div>
              {photoPreview && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleRemovePhoto}
                  disabled={isRemovingPhoto}
                  className="mt-2 rounded-none border-2 border-black font-bebas tracking-wider hover:bg-[#ED1C24] hover:text-white"
                >
                  {isRemovingPhoto ? (
                    <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Removing...</>
                  ) : (
                    <><Trash2 className="h-3 w-3 mr-1" /> Remove Photo</>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Info */}
      <Card className="rounded-none border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white overflow-hidden">
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
                disabled
                className="bg-muted"
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
                placeholder="Enter your address"
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between border-t-4 border-black pt-6">
          <Button variant="outline" onClick={handleRefresh} disabled={isSubmitting} className="rounded-none border-2 border-black font-bebas tracking-widest uppercase hover:bg-black hover:text-white transition-all">
            <RotateCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting} className="rounded-none border-2 border-black bg-[#FFD200] text-black font-bebas tracking-widest uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] active:scale-95 transition-all">
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" /> Save Changes
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

// Website Settings (Admin only)
function WebsiteSettingsForm({ initialSettings }: { initialSettings: WebsiteSettings | null }) {
  const defaultSettings: WebsiteSettings = {
    siteName: 'FIFTH AVENUE',
    tagline: 'URBAN STREET HUB',
    phone: '+92 321 5550199',
    email: 'hub@fifthavenue.com',
    address: 'Lahore, Pakistan',
    openingHours: '11:00 AM - 11:00 PM',
    facebook: '',
    instagram: '',
    twitter: '',
    deliveryRadius: '10',
    minOrderAmount: '500',
    deliveryFee: '100',
  };

  const hasSSRData = useRef(!!initialSettings);
  const hasFetched = useRef(false);
  
  const [settings, setSettings] = useState<WebsiteSettings>(initialSettings || defaultSettings);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(!initialSettings);

  // Fetch settings on mount only if no SSR data
  useEffect(() => {
    if (hasSSRData.current || hasFetched.current) {
      return;
    }
    hasFetched.current = true;
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      // Use SSR server action (no client requests visible in devtools)
      const result = await getWebsiteSettingsServerAction();

      if (result.success && result.settings) {
        setSettings(result.settings as WebsiteSettings);
      }
      // Silent fail - use defaults
    } catch {
      // Silent fail - use defaults
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      // Use SSR server action (no client requests visible in devtools)
      const result = await updateWebsiteSettingsServer(settings);

      if (!result.success) {
        throw new Error(result.error || 'Failed to save settings');
      }
      toast.success('Website settings updated');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save settings';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* General */}
      <Card className="rounded-none border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white overflow-hidden">
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
      <Card className="rounded-none border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white overflow-hidden">
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
      <Card className="rounded-none border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white overflow-hidden">
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

// Payment Methods Settings (Admin only)
function PaymentMethodsSettings({ 
  initialMethods, 
  initialStats,
  hasSSRData = false 
}: { 
  initialMethods: PaymentMethod[]; 
  initialStats: PaymentMethodsStats | null;
  hasSSRData?: boolean;
}) {
  const hasSSRDataRef = useRef(hasSSRData);
  const hasFetched = useRef(false);
  
  const [methods, setMethods] = useState<PaymentMethod[]>(initialMethods);
  const [stats, setStats] = useState<PaymentMethodsStats | null>(initialStats);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!hasSSRData);
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

  // Fetch data on mount only if no SSR data
  useEffect(() => {
    if (hasSSRDataRef.current || hasFetched.current) {
      setInitialLoading(false);
      return;
    }
    hasFetched.current = true;
    fetchMethods();
  }, []);

  // Refresh payment methods using SSR server action
  const fetchMethods = async () => {
    setLoading(true);
    try {
      const result = await getPaymentMethodsServerAction();
      if (result.success) {
        setMethods(result.methods || []);
        setStats(result.stats || null);
      }
      // Silent fail - no toast for initial load errors
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  };

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

  // Submit form (create or update) using SSR server actions
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
      let result;
      
      if (editingMethod) {
        // Update existing method
        result = await updatePaymentMethodServer(editingMethod.id, formData);
      } else {
        // Create new method
        result = await createPaymentMethodServer(formData as any);
      }

      if (result.success) {
        toast.success(editingMethod ? 'Payment method updated' : 'Payment method created');
        resetForm();
        fetchMethods();
      } else {
        toast.error(result.error || 'Operation failed');
      }
    } catch (error) {
      toast.error('Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete method using SSR server action
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this payment method?')) return;

    try {
      const result = await deletePaymentMethodServer(id);
      if (result.success) {
        toast.success('Payment method deleted');
        fetchMethods();
      } else {
        toast.error(result.error || 'Failed to delete');
      }
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  // Toggle active status using SSR server action
  const handleToggleStatus = async (id: string, is_active: boolean) => {
    try {
      const result = await togglePaymentMethodStatusServer(id, is_active);
      if (result.success) {
        toast.success(is_active ? 'Payment method activated' : 'Payment method deactivated');
        fetchMethods();
      } else {
        toast.error(result.error || 'Failed to update status');
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

  if (initialLoading || loading) {
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

// Security Settings Component
function SecuritySettings({ 
  employeeId,
  initial2FAEnabled
}: { 
  employeeId: string;
  initial2FAEnabled?: boolean;
}) {
  const hasSSRData = useRef(initial2FAEnabled !== undefined);
  const hasFetched = useRef(false);
  
  const [is2FAEnabled, setIs2FAEnabled] = useState(initial2FAEnabled || false);
  const [showSetup, setShowSetup] = useState(false);
  const [qrCode, setQrCode] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [manualKey, setManualKey] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [isLoading, setIsLoading] = useState(initial2FAEnabled === undefined);
  const [isEnabling, setIsEnabling] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);

  // ── Password Reset State ─────────────────────────────────────────────────
  const [pwdStep, setPwdStep] = useState<'idle' | 'sending' | 'otp' | 'verifying' | 'new-password' | 'resetting' | 'done'>('idle');
  const [pwdOTP, setPwdOTP] = useState('');
  const [pwdNewPass, setPwdNewPass] = useState('');
  const [pwdConfirmPass, setPwdConfirmPass] = useState('');
  const [pwdShowNew, setPwdShowNew] = useState(false);
  const [pwdShowConfirm, setPwdShowConfirm] = useState(false);
  const [pwdVerifiedToken, setPwdVerifiedToken] = useState('');
  const [pwdMaskedEmail, setPwdMaskedEmail] = useState('');
  const [pwdResendCountdown, setPwdResendCountdown] = useState(0);
  const [pwdExpiresCountdown, setPwdExpiresCountdown] = useState(0);
  const [pwdAttemptsLeft, setPwdAttemptsLeft] = useState(3);
  const pwdResendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pwdExpiryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load 2FA status only if no SSR data
  useEffect(() => {
    if (hasSSRData.current || hasFetched.current) {
      return;
    }
    hasFetched.current = true;
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      setIsLoading(true);
      // Use server action — no Authorization header needed; reads httpOnly cookies server-side
      const data = await generate2FASetupAction();
      if (data.success) {
        setIs2FAEnabled(data.is_enabled ?? false);
      }
    } catch (error) {
      // Silent fail
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate2FA = async () => {
    try {
      setIsEnabling(true);
      // Server action — reads httpOnly cookies directly, no client-side token needed
      const data = await generate2FASetupAction();
      if (!data.success) throw new Error(data.error || 'Failed to generate 2FA');
      setQrCode(data.qr_code ?? null);
      setSecret(data.secret ?? null);
      setManualKey(data.manual_entry_key ?? null);
      setShowSetup(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate 2FA setup');
    } finally {
      setIsEnabling(false);
    }
  };

  const handleEnable2FA = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }

    try {
      setIsEnabling(true);
      // Server action — no client-side Authorization header needed
      const data = await enable2FAAction(secret ?? '', verificationCode);
      if (!data.success) throw new Error(data.error || 'Failed to enable 2FA');
      toast.success('2FA enabled successfully!');
      setIs2FAEnabled(true);
      setShowSetup(false);
      setVerificationCode('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to enable 2FA');
    } finally {
      setIsEnabling(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!disableCode || disableCode.length !== 6) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }

    try {
      setIsDisabling(true);
      // Server action — no client-side Authorization header needed
      const data = await disable2FAAction(disableCode);
      if (!data.success) throw new Error(data.error || 'Failed to disable 2FA');
      toast.success('2FA disabled successfully');
      setIs2FAEnabled(false);
      setShowDisableDialog(false);
      setDisableCode('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to disable 2FA');
    } finally {
      setIsDisabling(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  // ── Password Reset Helpers ────────────────────────────────────────────────
  const pwdStartResendTimer = (seconds: number) => {
    setPwdResendCountdown(seconds);
    if (pwdResendTimerRef.current) clearInterval(pwdResendTimerRef.current);
    pwdResendTimerRef.current = setInterval(() => {
      setPwdResendCountdown((prev) => {
        if (prev <= 1) { clearInterval(pwdResendTimerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const pwdStartExpiryTimer = (seconds: number) => {
    setPwdExpiresCountdown(seconds);
    if (pwdExpiryTimerRef.current) clearInterval(pwdExpiryTimerRef.current);
    pwdExpiryTimerRef.current = setInterval(() => {
      setPwdExpiresCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(pwdExpiryTimerRef.current!);
          // OTP expired — go back to idle
          setPwdStep('idle');
          toast.error('OTP expired. Please request a new code.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const pwdReset = () => {
    setPwdStep('idle');
    setPwdOTP('');
    setPwdNewPass('');
    setPwdConfirmPass('');
    setPwdVerifiedToken('');
    setPwdMaskedEmail('');
    setPwdAttemptsLeft(3);
    if (pwdResendTimerRef.current) clearInterval(pwdResendTimerRef.current);
    if (pwdExpiryTimerRef.current) clearInterval(pwdExpiryTimerRef.current);
  };

  const handlePwdSendOTP = async () => {
    try {
      setPwdStep('sending');
      const res = await fetch('/api/portal/security/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'send-otp' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send OTP');
      setPwdMaskedEmail(data.maskedEmail || '');
      setPwdStep('otp');
      pwdStartExpiryTimer(data.expiresIn || 120);
      pwdStartResendTimer(data.resendIn || 60);
      toast.success('Verification code sent to your email');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send OTP');
      setPwdStep('idle');
    }
  };

  const handlePwdResendOTP = async () => {
    try {
      setPwdStep('sending');
      const res = await fetch('/api/portal/security/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'send-otp' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resend OTP');
      setPwdOTP('');
      setPwdAttemptsLeft(3);
      setPwdStep('otp');
      pwdStartExpiryTimer(data.expiresIn || 120);
      pwdStartResendTimer(data.resendIn || 60);
      toast.success('New verification code sent');
    } catch (err: any) {
      toast.error(err.message);
      setPwdStep('otp');
    }
  };

  const handlePwdVerifyOTP = async () => {
    if (pwdOTP.length !== 6) { toast.error('Enter the 6-digit code'); return; }
    try {
      setPwdStep('verifying');
      const res = await fetch('/api/portal/security/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'verify-otp', otp: pwdOTP }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.attemptsRemaining !== undefined) setPwdAttemptsLeft(data.attemptsRemaining);
        throw new Error(data.error || 'Invalid code');
      }
      if (pwdExpiryTimerRef.current) clearInterval(pwdExpiryTimerRef.current);
      setPwdVerifiedToken(data.token);
      setPwdStep('new-password');
      toast.success('Code verified! Set your new password.');
    } catch (err: any) {
      toast.error(err.message);
      setPwdStep('otp');
    }
  };

  const handlePwdResetPassword = async () => {
    if (pwdNewPass.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (pwdNewPass !== pwdConfirmPass) { toast.error('Passwords do not match'); return; }
    if (!/[A-Z]/.test(pwdNewPass) || !/[a-z]/.test(pwdNewPass) || !/[0-9]/.test(pwdNewPass)) {
      toast.error('Password needs uppercase, lowercase, and a number');
      return;
    }
    try {
      setPwdStep('resetting');
      const res = await fetch('/api/portal/security/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'reset-password',
          token: pwdVerifiedToken,
          newPassword: pwdNewPass,
          confirmPassword: pwdConfirmPass,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update password');
      setPwdStep('done');
      toast.success('Password updated successfully!');
    } catch (err: any) {
      toast.error(err.message);
      setPwdStep('new-password');
    }
  };

  // Strength scorer for password
  const getPwdStrength = (p: string): { score: number; label: string; color: string } => {
    let score = 0;
    if (p.length >= 8) score++;
    if (p.length >= 12) score++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    if (score <= 1) return { score, label: 'Very Weak', color: 'bg-red-500' };
    if (score === 2) return { score, label: 'Weak', color: 'bg-orange-500' };
    if (score === 3) return { score, label: 'Fair', color: 'bg-yellow-500' };
    if (score === 4) return { score, label: 'Strong', color: 'bg-blue-500' };
    return { score, label: 'Very Strong', color: 'bg-green-500' };
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 2FA Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Two-Factor Authentication (2FA)
              </CardTitle>
              <CardDescription className="mt-2">
                Add an extra layer of security to your account with Google Authenticator or similar TOTP apps
              </CardDescription>
            </div>
            <Badge variant={is2FAEnabled ? "default" : "secondary"} className="ml-4">
              {is2FAEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {!is2FAEnabled && !showSetup && (
            <div className="space-y-4">
              <div className="rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-orange-700 dark:text-orange-300">
                      Enhanced Security Recommended
                    </p>
                    <p className="text-orange-600 dark:text-orange-400 mt-1">
                      Enable 2FA to protect your account from unauthorized access. You'll need a code from your authenticator app each time you log in.
                    </p>
                  </div>
                </div>
              </div>
              <Button onClick={handleGenerate2FA} disabled={isEnabling} className="w-full sm:w-auto">
                <Smartphone className="h-4 w-4 mr-2" />
                {isEnabling ? 'Generating...' : 'Enable 2FA'}
              </Button>
            </div>
          )}

          {/* 2FA Setup */}
          {showSetup && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <span className="font-semibold">Setup Instructions:</span>
                  <ol className="list-decimal ml-4 mt-2 space-y-1">
                    <li>Install Google Authenticator or any TOTP app on your phone</li>
                    <li>Scan the QR code below or manually enter the key</li>
                    <li>Enter the 6-digit code from your app to verify</li>
                  </ol>
                </AlertDescription>
              </Alert>

              <div className="grid md:grid-cols-2 gap-6">
                {/* QR Code */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <QrCode className="h-4 w-4" />
                      Scan QR Code
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center">
                    {qrCode && (
                      <div className="bg-white p-4 rounded-lg">
                        <img src={qrCode} alt="2FA QR Code" className="w-48 h-48" />
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Manual Entry */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Key className="h-4 w-4" />
                      Manual Entry
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Secret Key</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm font-mono break-all">
                          {manualKey}
                        </code>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => copyToClipboard(manualKey)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Use this key if you can't scan the QR code. Enter it in your authenticator app.
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Verification */}
              <Card className="border-primary/50">
                <CardHeader>
                  <CardTitle className="text-base">Verify Setup</CardTitle>
                  <CardDescription>
                    Enter the 6-digit code from your authenticator app
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="verify-code">Verification Code</Label>
                      <Input
                        id="verify-code"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="000000"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                        className="text-center text-2xl tracking-widest font-mono"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleEnable2FA}
                        disabled={isEnabling || verificationCode.length !== 6}
                        className="flex-1"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        {isEnabling ? 'Verifying...' : 'Verify & Enable'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowSetup(false);
                          setVerificationCode('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* 2FA Enabled */}
          {is2FAEnabled && !showSetup && (
            <div className="space-y-4">
              <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-green-700 dark:text-green-300">
                      2FA is Active
                    </p>
                    <p className="text-green-600 dark:text-green-400 mt-1">
                      Your account is protected. You'll be asked for a code from your authenticator app when you log in.
                    </p>
                  </div>
                </div>
              </div>
              <Button 
                variant="destructive" 
                onClick={() => setShowDisableDialog(true)}
                className="w-full sm:w-auto"
              >
                <Shield className="h-4 w-4 mr-2" />
                Disable 2FA
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Password Reset Card ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-primary" />
                Change Password
              </CardTitle>
              <CardDescription className="mt-2">
                Secure your account with a new password. An OTP will be sent to your registered email to verify your identity first.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* ── idle ── */}
          {pwdStep === 'idle' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
                <div className="flex items-start gap-3">
                  <Shield className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                  <p className="text-muted-foreground">
                    For your security, we'll verify your identity with a one-time code sent to your email before allowing a password change.
                  </p>
                </div>
              </div>
              <Button onClick={handlePwdSendOTP} className="w-full sm:w-auto">
                <Send className="h-4 w-4 mr-2" />
                Send Verification Code
              </Button>
            </div>
          )}

          {/* ── sending ── */}
          {pwdStep === 'sending' && (
            <div className="flex items-center gap-3 py-4 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Sending verification code…</span>
            </div>
          )}

          {/* ── otp entry ── */}
          {(pwdStep === 'otp' || pwdStep === 'verifying') && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <Alert>
                <Mail className="h-4 w-4" />
                <AlertDescription>
                  A 6-digit code was sent to{' '}
                  <span className="font-semibold">{pwdMaskedEmail || 'your email'}</span>.
                  It expires in{' '}
                  <span className={cn('font-semibold', pwdExpiresCountdown <= 30 ? 'text-destructive' : '')}>
                    {Math.floor(pwdExpiresCountdown / 60)}:{String(pwdExpiresCountdown % 60).padStart(2, '0')}
                  </span>
                </AlertDescription>
              </Alert>

              {pwdAttemptsLeft < 3 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Incorrect code — {pwdAttemptsLeft} attempt{pwdAttemptsLeft !== 1 ? 's' : ''} remaining.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="pwd-otp">Verification Code</Label>
                <Input
                  id="pwd-otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={pwdOTP}
                  onChange={(e) => setPwdOTP(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-2xl tracking-widest font-mono max-w-[200px]"
                  disabled={pwdStep === 'verifying'}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handlePwdVerifyOTP}
                  disabled={pwdStep === 'verifying' || pwdOTP.length !== 6}
                  className="flex-1 sm:flex-none"
                >
                  {pwdStep === 'verifying' ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verifying…</>
                  ) : (
                    <><CheckCircle className="h-4 w-4 mr-2" /> Verify Code</>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handlePwdResendOTP}
                  disabled={pwdResendCountdown > 0 || pwdStep === 'verifying'}
                >
                  <RotateCw className="h-4 w-4 mr-2" />
                  {pwdResendCountdown > 0 ? `Resend in ${pwdResendCountdown}s` : 'Resend Code'}
                </Button>
                <Button variant="ghost" onClick={pwdReset} disabled={pwdStep === 'verifying'}>
                  Cancel
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── new password form ── */}
          {(pwdStep === 'new-password' || pwdStep === 'resetting') && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              <Alert>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <AlertDescription className="text-green-700 dark:text-green-300">
                  Identity verified! You have 5 minutes to set your new password.
                </AlertDescription>
              </Alert>

              {/* New Password */}
              <div className="space-y-2">
                <Label htmlFor="pwd-new">New Password</Label>
                <div className="relative">
                  <Input
                    id="pwd-new"
                    type={pwdShowNew ? 'text' : 'password'}
                    placeholder="Enter new password"
                    value={pwdNewPass}
                    onChange={(e) => setPwdNewPass(e.target.value)}
                    disabled={pwdStep === 'resetting'}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setPwdShowNew(!pwdShowNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {pwdShowNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Strength bar */}
                {pwdNewPass && (() => {
                  const { score, label, color } = getPwdStrength(pwdNewPass);
                  return (
                    <div className="space-y-1">
                      <div className="flex gap-1 h-1.5">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div
                            key={i}
                            className={cn('flex-1 rounded-full transition-all duration-300', i <= score ? color : 'bg-muted')}
                          />
                        ))}
                      </div>
                      <p className={cn('text-xs font-medium', score <= 2 ? 'text-red-500' : score === 3 ? 'text-yellow-600' : 'text-green-600')}>
                        {label}
                      </p>
                    </div>
                  );
                })()}

                <ul className="text-xs text-muted-foreground space-y-0.5 mt-1">
                  <li className={cn('flex items-center gap-1', pwdNewPass.length >= 8 ? 'text-green-600' : '')}>
                    <CheckCircle className={cn('h-3 w-3', pwdNewPass.length >= 8 ? 'text-green-500' : 'text-muted-foreground/40')} />
                    Minimum 8 characters
                  </li>
                  <li className={cn('flex items-center gap-1', /[A-Z]/.test(pwdNewPass) ? 'text-green-600' : '')}>
                    <CheckCircle className={cn('h-3 w-3', /[A-Z]/.test(pwdNewPass) ? 'text-green-500' : 'text-muted-foreground/40')} />
                    Uppercase letter
                  </li>
                  <li className={cn('flex items-center gap-1', /[a-z]/.test(pwdNewPass) ? 'text-green-600' : '')}>
                    <CheckCircle className={cn('h-3 w-3', /[a-z]/.test(pwdNewPass) ? 'text-green-500' : 'text-muted-foreground/40')} />
                    Lowercase letter
                  </li>
                  <li className={cn('flex items-center gap-1', /[0-9]/.test(pwdNewPass) ? 'text-green-600' : '')}>
                    <CheckCircle className={cn('h-3 w-3', /[0-9]/.test(pwdNewPass) ? 'text-green-500' : 'text-muted-foreground/40')} />
                    At least one number
                  </li>
                </ul>
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="pwd-confirm">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="pwd-confirm"
                    type={pwdShowConfirm ? 'text' : 'password'}
                    placeholder="Confirm new password"
                    value={pwdConfirmPass}
                    onChange={(e) => setPwdConfirmPass(e.target.value)}
                    disabled={pwdStep === 'resetting'}
                    className={cn('pr-10', pwdConfirmPass && pwdNewPass !== pwdConfirmPass ? 'border-destructive focus-visible:ring-destructive' : '')}
                  />
                  <button
                    type="button"
                    onClick={() => setPwdShowConfirm(!pwdShowConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {pwdShowConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {pwdConfirmPass && pwdNewPass !== pwdConfirmPass && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Passwords do not match
                  </p>
                )}
                {pwdConfirmPass && pwdNewPass === pwdConfirmPass && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> Passwords match
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handlePwdResetPassword}
                  disabled={
                    pwdStep === 'resetting' ||
                    pwdNewPass.length < 8 ||
                    pwdNewPass !== pwdConfirmPass ||
                    !/[A-Z]/.test(pwdNewPass) ||
                    !/[a-z]/.test(pwdNewPass) ||
                    !/[0-9]/.test(pwdNewPass)
                  }
                  className="flex-1 sm:flex-none"
                >
                  {pwdStep === 'resetting' ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Updating…</>
                  ) : (
                    <><Lock className="h-4 w-4 mr-2" /> Update Password</>
                  )}
                </Button>
                <Button variant="outline" onClick={pwdReset} disabled={pwdStep === 'resetting'}>
                  Cancel
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── success ── */}
          {pwdStep === 'done' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-5 text-center">
                <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" />
                <p className="font-semibold text-green-700 dark:text-green-300 text-lg">Password Updated!</p>
                <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                  Your password has been changed successfully. Use your new password next time you log in.
                </p>
              </div>
              <Button variant="outline" onClick={pwdReset} className="w-full sm:w-auto">
                <RotateCw className="h-4 w-4 mr-2" />
                Change Password Again
              </Button>
            </motion.div>
          )}

        </CardContent>
      </Card>

      {/* Security Tips */}
      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4 text-blue-500" />
            Security Tips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-blue-700 dark:text-blue-300">
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>Save your backup codes in a secure location</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>Don't share your 2FA codes with anyone</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>Use a password manager for strong, unique passwords</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>Regularly review your account activity</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Push Notifications */}
      <PushNotificationSettings userId={employeeId} userType="employee" />

      {/* Disable 2FA Dialog */}
      <AlertDialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Disable Two-Factor Authentication?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will make your account less secure. You'll need to enter a verification code from your authenticator app to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="disable-code">Verification Code</Label>
            <Input
              id="disable-code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ''))}
              className="text-center text-2xl tracking-widest font-mono mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDisableCode('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisable2FA}
              disabled={isDisabling || disableCode.length !== 6}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDisabling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Disabling...
                </>
              ) : (
                'Disable 2FA'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Maintenance Mode Settings (Admin only)
function MaintenanceModeSettings({ 
  initialStatus 
}: { 
  initialStatus: MaintenanceStatus | null;
}) {
  const [status, setStatus] = useState<MaintenanceStatus>(initialStatus || {
    is_enabled: false,
    enabled_at: null,
    enabled_by: null,
    reason_type: null,
    custom_reason: null,
    estimated_end_time: null,
  });
  const [isToggling, setIsToggling] = useState(false);
  const [isSendingEmails, setIsSendingEmails] = useState(false);
  const [emailProgress, setEmailProgress] = useState({ sent: 0, total: 0, progress: 0, failed: 0 });
  
  // Helper to convert ISO date to datetime-local format
  const formatDateTimeLocal = (isoString: string | null) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '';
      // Convert to local timezone for datetime-local input
      const offset = date.getTimezoneOffset();
      const local = new Date(date.getTime() - offset * 60 * 1000);
      return local.toISOString().slice(0, 16);
    } catch {
      return '';
    }
  };

  const [formData, setFormData] = useState({
    reason_type: (initialStatus?.reason_type || 'update') as 'update' | 'bug_fix' | 'changes' | 'scheduled' | 'custom',
    custom_reason: initialStatus?.custom_reason || '',
    estimated_end_time: formatDateTimeLocal(initialStatus?.estimated_end_time || null),
    title: initialStatus?.title || "We'll Be Right Back",
    message: initialStatus?.message || 'Our website is currently undergoing scheduled maintenance. We apologize for any inconvenience.',
  });
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const reasonLabels: Record<string, string> = {
    update: 'System Update',
    bug_fix: 'Bug Fix',
    changes: 'Improvements',
    scheduled: 'Scheduled Maintenance',
    custom: 'Custom Reason',
  };

  const reasonIcons: Record<string, React.ReactNode> = {
    update: <RotateCw className="h-4 w-4" />,
    bug_fix: <Wrench className="h-4 w-4" />,
    changes: <Settings className="h-4 w-4" />,
    scheduled: <Calendar className="h-4 w-4" />,
    custom: <FileText className="h-4 w-4" />,
  };

  const handleToggleMaintenance = async () => {
    setIsToggling(true);
    try {
      // Convert datetime-local format (2026-02-05T14:30) to ISO timestamp
      let estimatedRestoreTimeISO: string | undefined = undefined;
      if (formData.estimated_end_time) {
        // datetime-local gives local time without timezone, convert to ISO with timezone
        const localDate = new Date(formData.estimated_end_time);
        estimatedRestoreTimeISO = localDate.toISOString();
      }

      const result = await toggleMaintenanceModeServer({
        is_enabled: !status.is_enabled,
        reason_type: status.is_enabled ? 'update' : formData.reason_type,
        custom_reason: formData.reason_type === 'custom' ? formData.custom_reason : undefined,
        title: formData.title,
        message: formData.message,
        estimated_restore_time: estimatedRestoreTimeISO,
        show_timer: true,
        show_progress: true,
      });

      if (result.success) {
        setStatus({
          is_enabled: !status.is_enabled,
          enabled_at: !status.is_enabled ? new Date().toISOString() : null,
          enabled_by: null,
          reason_type: !status.is_enabled ? formData.reason_type : null,
          custom_reason: formData.reason_type === 'custom' ? formData.custom_reason : null,
          estimated_end_time: estimatedRestoreTimeISO || null,
          title: formData.title,
          message: formData.message,
          show_timer: true,
          show_progress: true,
        });
        toast.success(status.is_enabled ? 'Maintenance mode disabled' : 'Maintenance mode enabled');
        setShowConfirmDialog(false);
      } else {
        toast.error(result.error || 'Failed to toggle maintenance mode');
      }
    } catch (error) {
      toast.error('Failed to toggle maintenance mode');
    } finally {
      setIsToggling(false);
    }
  };

  const handleSendNotifications = async () => {
    if (!status.is_enabled) {
      toast.error('Enable maintenance mode first');
      return;
    }

    setIsSendingEmails(true);
    setEmailProgress({ sent: 0, total: 0, progress: 0, failed: 0 });
    
    // Show initial toast
    const toastId = toast.loading('Preparing to send notifications...', {
      duration: Infinity,
    });

    try {
      const response = await fetch('/api/maintenance/send-notifications-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          settings: {
            is_enabled: true,
            reason_type: status.reason_type || 'update',
            custom_reason: status.custom_reason || undefined,
            title: status.title || "We'll Be Right Back",
            message: status.message || undefined,
            estimated_restore_time: status.estimated_end_time || undefined,
            show_timer: status.show_timer ?? true,
            show_progress: status.show_progress ?? true,
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Maintenance Emails] Error response:', errorText);
        throw new Error(`Server returned ${response.status}: ${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonData = line.slice(6);
            
            try {
              const data = JSON.parse(jsonData);
              
              if (data.error) {
                console.error('[Maintenance Emails] Server error:', data.error);
                toast.error(data.error, { id: toastId });
                setIsSendingEmails(false);
                return;
              }

              if (data.status === 'fetching') {
                toast.loading('Fetching user list...', { id: toastId });
              } else if (data.status === 'sending') {
                setEmailProgress({
                  sent: data.sent || 0,
                  total: data.total || 0,
                  progress: data.progress || 0,
                  failed: data.failed || 0,
                });
                toast.loading(
                  `Sending notifications... ${data.sent || 0}/${data.total || 0} sent (${data.progress || 0}%)`,
                  { id: toastId }
                );
              } else if (data.status === 'complete') {
                setEmailProgress({
                  sent: data.sent || 0,
                  total: data.total || 0,
                  progress: 100,
                  failed: data.failed || 0,
                });
                
                if (data.total === 0) {
                  toast.info(`No users to notify. Customers: ${data.customerCount}, Employees: ${data.employeeCount}`, { id: toastId });
                } else if (data.failed > 0) {
                  toast.warning(`Sent ${data.sent}/${data.total} emails (${data.failed} failed)`, { id: toastId });
                } else {
                  toast.success(`Successfully sent ${data.sent} notification emails!`, { id: toastId });
                }
              }
            } catch (parseError) {
              console.error('[Maintenance Emails] Failed to parse JSON:', jsonData, parseError);
            }
          }
        }
      }
    } catch (error: any) {
      console.error('[Maintenance Emails] Error:', error);
      toast.error(error?.message || 'Failed to send notifications', { id: toastId });
    } finally {
      setIsSendingEmails(false);
      setTimeout(() => setEmailProgress({ sent: 0, total: 0, progress: 0, failed: 0 }), 3000);
    }
  };

  // Calculate minimum datetime for estimation (current time)
  const getMinDateTime = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const local = new Date(now.getTime() - offset * 60 * 1000);
    return local.toISOString().slice(0, 16);
  };

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card className={cn(
        "rounded-none border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all",
        status.is_enabled ? "bg-[#ED1C24] text-white" : "bg-[#008A45] text-white"
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-3 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
                status.is_enabled ? "bg-black" : "bg-black"
              )}>
                {status.is_enabled ? (
                  <Wrench className="h-6 w-6 text-[#FFD200] animate-pulse" />
                ) : (
                  <Power className="h-6 w-6 text-[#008A45]" />
                )}
              </div>
              <div>
                <CardTitle className="text-2xl font-bebas tracking-wider uppercase">
                  {status.is_enabled ? 'MAINTENANCE ACTIVE' : 'SYSTEM ONLINE'}
                </CardTitle>
                <CardDescription className={cn(status.is_enabled ? "text-white/80" : "text-white/80", "font-medium")}>
                  {status.is_enabled 
                    ? 'Only admins can access the website. All other users see the maintenance page.'
                    : 'Website is currently accessible to all users globally.'}
                </CardDescription>
              </div>
            </div>
            <div className={cn(
              "px-4 py-1 border-2 border-black font-bebas tracking-widest uppercase",
              status.is_enabled 
                ? "bg-black text-[#FFD200]" 
                : "bg-black text-[#008A45]"
            )}>
              {status.is_enabled ? 'OFFLINE' : 'ONLINE'}
            </div>
          </div>
        </CardHeader>
        {status.is_enabled && (
          <CardContent className="pt-0 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Started:</span>
                <span>{status.enabled_at ? new Date(status.enabled_at).toLocaleString() : 'N/A'}</span>
              </div>
              {status.reason_type && (
                <div className="flex items-center gap-2">
                  {reasonIcons[status.reason_type]}
                  <span className="text-muted-foreground">Reason:</span>
                  <span>{reasonLabels[status.reason_type]}</span>
                </div>
              )}
              {status.reason_type === 'custom' && status.custom_reason && (
                <div className="col-span-2 flex items-start gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <span className="text-muted-foreground">Details:</span>
                  <span className="flex-1">{status.custom_reason}</span>
                </div>
              )}
              {status.estimated_end_time && (
                <div className="col-span-2 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Estimated End:</span>
                  <span>{new Date(status.estimated_end_time).toLocaleString()}</span>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Configuration Card */}
      {!status.is_enabled && (
        <Card className="rounded-none border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white">
          <CardHeader>
            <CardTitle className="text-xl font-bebas flex items-center gap-2">
              <Settings className="h-5 w-5" />
              MAINTENANCE CONFIGURATION
            </CardTitle>
            <CardDescription className="font-medium">
              Configure the maintenance page settings before flipping the switch.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Reason Type</Label>
              <Select
                value={formData.reason_type}
                onValueChange={(value: 'update' | 'bug_fix' | 'changes' | 'scheduled' | 'custom') => 
                  setFormData(prev => ({ ...prev, reason_type: value }))
                }
              >
                <SelectTrigger className="rounded-none border-2 border-black h-12 font-bebas text-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="update">
                    <div className="flex items-center gap-2">
                      <RotateCw className="h-4 w-4" />
                      System Update
                    </div>
                  </SelectItem>
                  <SelectItem value="bug_fix">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4" />
                      Bug Fix
                    </div>
                  </SelectItem>
                  <SelectItem value="changes">
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Improvements
                    </div>
                  </SelectItem>
                  <SelectItem value="scheduled">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Scheduled Maintenance
                    </div>
                  </SelectItem>
                  <SelectItem value="custom">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Custom Reason
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.reason_type === 'custom' && (
              <div className="space-y-2">
                <Label>Custom Reason</Label>
                <Input
                  placeholder="Enter the reason for maintenance..."
                  value={formData.custom_reason}
                  onChange={(e) => setFormData(prev => ({ ...prev, custom_reason: e.target.value }))}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Page Title</Label>
              <Input
                placeholder="We'll Be Right Back"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="rounded-none border-2 border-black h-12 font-bebas text-lg"
              />
            </div>

            <div className="space-y-2">
              <Label>Message</Label>
              <Input
                placeholder="Our website is currently undergoing scheduled maintenance..."
                value={formData.message}
                onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                This message will be displayed on the maintenance page
              </p>
            </div>

            <div className="space-y-2">
              <Label>Estimated End Time (Optional)</Label>
              <Input
                type="datetime-local"
                value={formData.estimated_end_time}
                onChange={(e) => setFormData(prev => ({ ...prev, estimated_end_time: e.target.value }))}
                min={getMinDateTime()}
                className="rounded-none border-2 border-black h-12"
              />
              <p className="text-xs text-muted-foreground">
                Users will see a countdown timer until this time
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions Card */}
      <Card className="rounded-none border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white overflow-hidden">
        <CardHeader>
          <CardTitle className="text-xl font-bebas flex items-center gap-2">
            <Power className="h-5 w-5" />
            ACTIONS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant={status.is_enabled ? "default" : "destructive"}
              onClick={() => setShowConfirmDialog(true)}
              disabled={isToggling}
              className={cn(
                "flex-1 h-16 rounded-none border-4 border-black font-bebas text-2xl tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all",
                status.is_enabled ? "bg-[#FFD200] text-black" : "bg-[#ED1C24] text-white"
              )}
            >
              {isToggling ? (
                <>
                  <Loader2 className="h-6 w-6 mr-3 animate-spin" />
                  {status.is_enabled ? 'TERMINATING...' : 'ENABLING...'}
                </>
              ) : (
                <>
                  <Power className="h-6 w-6 mr-3" />
                  {status.is_enabled ? 'RESTORE SYSTEM ONLINE' : 'ACTIVATE MAINTENANCE'}
                </>
              )}
            </Button>

            {status.is_enabled && (
              <Button
                variant="outline"
                onClick={handleSendNotifications}
                disabled={isSendingEmails}
                className="flex-1 h-16 rounded-none border-4 border-black font-bebas text-2xl tracking-widest hover:bg-black hover:text-[#FFD200] transition-all"
              >
                {isSendingEmails ? (
                  <>
                    <Loader2 className="h-6 w-6 mr-3 animate-spin" />
                    NOTIFYING... {emailProgress.total > 0 && `${emailProgress.sent}/${emailProgress.total}`}
                  </>
                ) : (
                  <>
                    <Send className="h-6 w-6 mr-3" />
                    NOTIFY CUSTOMERS
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Email Sending Progress Bar */}
          {isSendingEmails && emailProgress.total > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Sending notifications...
                </span>
                <span className="font-medium">
                  {emailProgress.sent}/{emailProgress.total} ({emailProgress.progress}%)
                </span>
              </div>
              
              {/* Progress bar */}
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${emailProgress.progress}%` }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                />
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  {emailProgress.sent} sent
                </span>
                {emailProgress.failed > 0 && (
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                    {emailProgress.failed} failed
                  </span>
                )}
              </div>
            </motion.div>
          )}

          {status.is_enabled && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                All users except admins are currently seeing the maintenance page. 
                You can send email notifications to inform them about the downtime.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {status.is_enabled ? 'Disable Maintenance Mode?' : 'Enable Maintenance Mode?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {status.is_enabled 
                ? 'This will make the website accessible to all users again.'
                : 'This will show a maintenance page to all non-admin users. Only admins will be able to access the website.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggleMaintenance}
              disabled={isToggling}
              className={status.is_enabled ? "" : "bg-destructive hover:bg-destructive/90"}
            >
              {isToggling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {status.is_enabled ? 'Disabling...' : 'Enabling...'}
                </>
              ) : (
                status.is_enabled ? 'Disable' : 'Enable'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =============================================
// TAX SETTINGS FORM
// Admin-only — stored in system_settings table
// =============================================
function TaxSettingsForm({ initialSettings }: { initialSettings: TaxSettings | null }) {
  const defaults: TaxSettings = { rate: 0, enabled: false, label: 'GST' };
  const [settings, setSettings] = useState<TaxSettings>(initialSettings ?? defaults);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(!initialSettings);

  useEffect(() => {
    if (initialSettings) return;
    let cancelled = false;
    getTaxSettingsAction().then((r) => {
      if (!cancelled && r.success && r.settings) setSettings(r.settings);
      if (!cancelled) setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [initialSettings]);

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const result = await updateTaxSettingsAction(settings);
      if (!result.success) throw new Error(result.error || 'Failed to save');
      toast.success('Tax settings saved', {
        description: settings.enabled
          ? `${settings.label} set to ${settings.rate}%`
          : 'Tax is disabled — invoices will not include tax.',
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save tax settings');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Tax / GST Settings
          </CardTitle>
          <CardDescription>
            Configure the tax rate applied to all invoices generated by the billing desk.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Enable / Disable toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium text-sm">Enable Tax on Invoices</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                When off, no tax is added and the rate is ignored.
              </p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(v) => setSettings({ ...settings, enabled: v })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tax label */}
            <div className="space-y-2">
              <Label>Tax Label</Label>
              <Input
                placeholder="e.g. GST, VAT"
                value={settings.label}
                disabled={!settings.enabled}
                onChange={(e) => setSettings({ ...settings, label: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Shown on invoices</p>
            </div>

            {/* Tax rate */}
            <div className="space-y-2">
              <Label>Tax Rate (%)</Label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  placeholder="0"
                  value={settings.rate}
                  disabled={!settings.enabled}
                  onChange={(e) =>
                    setSettings({ ...settings, rate: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) })
                  }
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {settings.enabled && settings.rate > 0
                  ? `Rs. 1000 order → Rs. ${(settings.rate * 10).toFixed(0)} tax → Rs. ${(1000 + settings.rate * 10).toFixed(0)} total`
                  : 'No tax applied'}
              </p>
            </div>
          </div>

          {/* Info banner */}
          {!settings.enabled && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Tax is currently <strong>disabled</strong>. All invoices are generated at 0% tax. Enable above to activate.
              </AlertDescription>
            </Alert>
          )}
          {settings.enabled && settings.rate === 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Tax is enabled but the rate is <strong>0%</strong>. Invoices will show the tax label but no tax amount.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="border-t pt-4">
          <Button onClick={handleSave} disabled={isSubmitting} className="ml-auto">
            {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {isSubmitting ? 'Saving...' : 'Save Tax Settings'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

// ============================================================
// ATTENDANCE LOCATION SETTINGS (Admin/Manager — geofence)
// ============================================================
function AttendanceLocationSettings() {
  const [lat, setLat]           = useState('');
  const [lng, setLng]           = useState('');
  const [name, setName]         = useState('Restaurant');
  const [radius, setRadius]     = useState(100);
  const [enabled, setEnabled]   = useState(true);
  const [isLoading, setIsLoading]   = useState(true);
  const [isSaving, setIsSaving]     = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [configured, setConfigured] = useState(false);

  // Fetch current settings
  useEffect(() => {
    fetch('/api/portal/attendance/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_attendance_location' }),
    })
      .then(r => r.json())
      .then(d => {
        if (d?.data?.location) {
          const loc = d.data.location;
          if (loc.latitude  != null) setLat(String(loc.latitude));
          if (loc.longitude != null) setLng(String(loc.longitude));
          if (loc.location_name)     setName(loc.location_name);
          if (loc.radius_meters)     setRadius(loc.radius_meters);
          if (loc.enabled != null)   setEnabled(loc.enabled);
          setConfigured(!!d.data.configured);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const handleAutoDetect = () => {
    if (!navigator.geolocation) {
      alert('Geolocation not supported by your browser');
      return;
    }
    setIsDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(7));
        setLng(pos.coords.longitude.toFixed(7));
        setIsDetecting(false);
      },
      (err) => {
        alert('Could not get location: ' + err.message);
        setIsDetecting(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handleSave = async () => {
    const latN = parseFloat(lat);
    const lngN = parseFloat(lng);
    if (isNaN(latN) || isNaN(lngN)) {
      alert('Please enter valid latitude and longitude');
      return;
    }
    if (radius < 10 || radius > 5000) {
      alert('Radius must be between 10 and 5000 meters');
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/api/portal/attendance/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_attendance_location',
          latitude: latN,
          longitude: lngN,
          locationName: name || 'Restaurant',
          radiusMeters: radius,
          enabled,
        }),
      });
      const d = await res.json();
      if (d?.data?.success) {
        setConfigured(true);
        alert('Location settings saved successfully!');
      } else {
        alert(d?.data?.error || d?.error || 'Failed to save');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <MapPin className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <CardTitle>Attendance Geofence</CardTitle>
                <CardDescription>
                  Employees can only mark attendance when within the allowed radius of this location
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="geo-enabled" className="text-sm">Enable</Label>
              <Switch id="geo-enabled" checked={enabled} onCheckedChange={setEnabled} />
            </div>
          </div>
          {configured && (
            <div className="flex items-center gap-2 mt-3 px-3 py-2 bg-green-500/10 text-green-700 rounded-lg text-sm">
              <CheckCircle className="h-4 w-4 shrink-0" />
              Geofence is configured and {enabled ? 'active' : 'disabled'}
            </div>
          )}
          {!configured && (
            <div className="flex items-center gap-2 mt-3 px-3 py-2 bg-amber-500/10 text-amber-700 rounded-lg text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              No premises location set — attendance marking works without location check
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Auto-detect */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
            <div>
              <p className="text-sm font-medium">Auto-detect from this device</p>
              <p className="text-xs text-muted-foreground">Use your admin device's current GPS position as the premises</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAutoDetect}
              disabled={isDetecting}
            >
              {isDetecting
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Detecting…</>
                : <><MapPin className="h-4 w-4 mr-2" />Detect GPS</>
              }
            </Button>
          </div>

          {/* Manual coordinates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="lat">Latitude</Label>
              <Input
                id="lat"
                value={lat}
                onChange={e => setLat(e.target.value)}
                placeholder="e.g. 31.5204"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lng">Longitude</Label>
              <Input
                id="lng"
                value={lng}
                onChange={e => setLng(e.target.value)}
                placeholder="e.g. 74.3587"
                className="font-mono text-sm"
              />
            </div>
          </div>

          {/* Location name */}
          <div className="space-y-1.5">
            <Label htmlFor="loc-name">Location Name</Label>
            <Input
              id="loc-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Main Branch, Gulberg"
            />
          </div>

          {/* Radius */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="radius">Allowed Radius</Label>
              <span className="text-sm font-mono font-semibold text-primary">{radius} m</span>
            </div>
            <Input
              id="radius"
              type="number"
              min={10}
              max={5000}
              step={10}
              value={radius}
              onChange={e => setRadius(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>10 m (strict)</span>
              <span>100 m (recommended)</span>
              <span>5000 m (loose)</span>
            </div>
          </div>

          {/* Preview map link */}
          {lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng)) && (
            <a
              href={`https://maps.google.com/?q=${lat},${lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-blue-500 hover:text-blue-600 underline"
            >
              <MapPin className="h-4 w-4" />
              Preview on Google Maps ↗
            </a>
          )}

          {/* Info box */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>How it works:</strong> When employees enter the 6-character code, their browser GPS is checked.
              If they are outside the {radius}-meter radius of <em>{name || 'this location'}</em>, the attendance will be rejected.
              Set to 100 m for a typical restaurant or office.
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="border-t pt-4">
          <Button onClick={handleSave} disabled={isSaving || !lat || !lng} className="ml-auto">
            {isSaving
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</>
              : <><Save className="h-4 w-4 mr-2" />Save Location Settings</>
            }
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

// Props for SSR data
interface SettingsClientProps {
  initialEmployeeProfile?: Employee | null;
  initialWebsiteSettings?: WebsiteSettings | null;
  initialPaymentMethods?: PaymentMethod[];
  initialPaymentStats?: PaymentMethodsStats | null;
  initial2FAStatus?: boolean;
  initialMaintenanceStatus?: MaintenanceStatus | null;
  initialTaxSettings?: TaxSettings | null;
  initialOnlineOrderingSettings?: OnlineOrderingSettings | null;
  hasSSRData?: boolean;
}

// Main Settings Client Component
export default function SettingsClient({
  initialEmployeeProfile,
  initialWebsiteSettings,
  initialPaymentMethods = [],
  initialPaymentStats = null,
  initial2FAStatus = false,
  initialMaintenanceStatus = null,
  initialTaxSettings = null,
  initialOnlineOrderingSettings = null,
  hasSSRData = false,
}: SettingsClientProps) {
  // Get context as fallback when SSR data is not available
  const { employee: authEmployee, isLoading: contextLoading } = usePortalAuthContext();
  
  // Use SSR employee data as primary, fallback to context if SSR failed
  const ssrEmployee: Employee | null = initialEmployeeProfile ? {
    id: initialEmployeeProfile.id,
    name: initialEmployeeProfile.name,
    email: initialEmployeeProfile.email,
    phone: initialEmployeeProfile.phone || undefined,
    address: initialEmployeeProfile.address || undefined,
    emergency_contact: initialEmployeeProfile.emergency_contact || undefined,
    avatar_url: initialEmployeeProfile.avatar_url || undefined,
    role: initialEmployeeProfile.role,
    hired_date: initialEmployeeProfile.hired_date || undefined,
    employee_id: (initialEmployeeProfile as any).employee_id || undefined,
    is_2fa_enabled: initialEmployeeProfile.is_2fa_enabled || false,
  } : null;
  
  // Use SSR data first, then fallback to context data
  const employee: Employee | null = ssrEmployee || (authEmployee ? {
    id: authEmployee.id,
    name: authEmployee.name,
    email: authEmployee.email,
    phone: authEmployee.phone || undefined,
    address: authEmployee.address || undefined,
    emergency_contact: authEmployee.emergency_contact || undefined,
    avatar_url: authEmployee.avatar_url || undefined,
    role: authEmployee.role,
    hired_date: authEmployee.hired_date || undefined,
    employee_id: (authEmployee as any).employee_id || undefined,
    is_2fa_enabled: authEmployee.is_2fa_enabled || false,
  } : null);
  
  const isAdmin = employee?.role === 'admin';

  // Show loading if no SSR data and context is still loading
  if (!hasSSRData && !employee && contextLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <SectionHeader
        title="Settings"
        description="Manage your profile and application settings"
      />

      <Tabs defaultValue="personal" className="space-y-4 sm:space-y-6">
        {/* Horizontally scrollable tabs on mobile */}
        <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto scrollbar-hide">
          <TabsList className="inline-flex w-max sm:w-auto h-auto gap-2 bg-black p-1 rounded-none border-2 border-black">
            <TabsTrigger value="personal" className="gap-1.5 sm:gap-2 text-xs sm:text-sm whitespace-nowrap px-4 py-2 rounded-none border-2 border-transparent data-[state=active]:bg-[#FFD200] data-[state=active]:text-black data-[state=active]:border-black font-bebas tracking-widest text-white/60 uppercase transition-all">
              <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Personal
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-1.5 sm:gap-2 text-xs sm:text-sm whitespace-nowrap px-4 py-2 rounded-none border-2 border-transparent data-[state=active]:bg-[#FFD200] data-[state=active]:text-black data-[state=active]:border-black font-bebas tracking-widest text-white/60 uppercase transition-all">
              <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Security
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-1.5 sm:gap-2 text-xs sm:text-sm whitespace-nowrap px-4 py-2 rounded-none border-2 border-transparent data-[state=active]:bg-[#FFD200] data-[state=active]:text-black data-[state=active]:border-black font-bebas tracking-widest text-white/60 uppercase transition-all">
              <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Notifications
            </TabsTrigger>
            <TabsTrigger value="keyboard" className="gap-1.5 sm:gap-2 text-xs sm:text-sm whitespace-nowrap px-4 py-2 rounded-none border-2 border-transparent data-[state=active]:bg-[#FFD200] data-[state=active]:text-black data-[state=active]:border-black font-bebas tracking-widest text-white/60 uppercase transition-all">
              <Keyboard className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Shortcuts
            </TabsTrigger>
            {isAdmin && (
              <>
                <TabsTrigger value="payment-methods" className="gap-1.5 sm:gap-2 text-xs sm:text-sm whitespace-nowrap px-4 py-2 rounded-none border-2 border-transparent data-[state=active]:bg-[#FFD200] data-[state=active]:text-black data-[state=active]:border-black font-bebas tracking-widest text-white/60 uppercase transition-all">
                  <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Payments
                </TabsTrigger>
                <TabsTrigger value="orders-management" className="gap-1.5 sm:gap-2 text-xs sm:text-sm whitespace-nowrap px-4 py-2 rounded-none border-2 border-transparent data-[state=active]:bg-[#FFD200] data-[state=active]:text-black data-[state=active]:border-black font-bebas tracking-widest text-white/60 uppercase transition-all">
                  <ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Orders
                </TabsTrigger>
                <TabsTrigger value="billing-settings" className="gap-1.5 sm:gap-2 text-xs sm:text-sm whitespace-nowrap px-4 py-2 rounded-none border-2 border-transparent data-[state=active]:bg-[#FFD200] data-[state=active]:text-black data-[state=active]:border-black font-bebas tracking-widest text-white/60 uppercase transition-all">
                  <Calculator className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Billing
                </TabsTrigger>
                <TabsTrigger value="website" className="gap-1.5 sm:gap-2 text-xs sm:text-sm whitespace-nowrap px-4 py-2 rounded-none border-2 border-transparent data-[state=active]:bg-[#FFD200] data-[state=active]:text-black data-[state=active]:border-black font-bebas tracking-widest text-white/60 uppercase transition-all">
                  <Globe className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Website
                </TabsTrigger>
                <TabsTrigger value="maintenance" className="gap-1.5 sm:gap-2 text-xs sm:text-sm whitespace-nowrap px-4 py-2 rounded-none border-2 border-transparent data-[state=active]:bg-[#FFD200] data-[state=active]:text-black data-[state=active]:border-black font-bebas tracking-widest text-white/60 uppercase transition-all">
                  <Wrench className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Maintenance
                </TabsTrigger>
              </>
            )}
          </TabsList>
        </div>

        <TabsContent value="personal">
          <PersonalSettings 
            employeeId={employee?.id || null} 
            initialProfile={employee}
          />
        </TabsContent>

        <TabsContent value="security">
          {employee && (
            <SecuritySettings 
              employeeId={employee.id} 
              initial2FAEnabled={initial2FAStatus}
            />
          )}
        </TabsContent>

        <TabsContent value="keyboard">
          <KeyboardShortcutsSettings />
        </TabsContent>

        <TabsContent value="notifications">
          {employee && (
            <div className="space-y-4">
              <PushNotificationSettings 
                userId={employee.id}
                userType="employee"
              />
            </div>
          )}
        </TabsContent>

        {isAdmin && (
          <>
            <TabsContent value="payment-methods">
              <PaymentMethodsSettings 
                initialMethods={initialPaymentMethods} 
                initialStats={initialPaymentStats}
                hasSSRData={hasSSRData} 
              />
            </TabsContent>
            <TabsContent value="orders-management">
              <OnlineOrdersSettingsForm initialSettings={initialOnlineOrderingSettings} />
            </TabsContent>
            <TabsContent value="billing-settings">
              <TaxSettingsForm initialSettings={initialTaxSettings} />
            </TabsContent>
            <TabsContent value="website">
              <WebsiteSettingsForm initialSettings={initialWebsiteSettings || null} />
            </TabsContent>
            <TabsContent value="maintenance">
              <MaintenanceModeSettings initialStatus={initialMaintenanceStatus} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </>
  );
}
