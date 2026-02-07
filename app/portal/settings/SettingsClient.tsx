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
} from '@/lib/actions';
import { uploadEmployeeAvatar } from '@/lib/storage';

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
        toast.loading('Uploading profile photo...', { id: 'save-profile' });
        try {
          const uploadResult = await uploadEmployeeAvatar(photoFile, employeeId);
          
          if (!uploadResult.success || !uploadResult.url) {
            const errorMsg = uploadResult.error || 'Failed to upload profile photo';
            throw new Error(errorMsg);
          }
          
          avatarUrl = uploadResult.url;
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
      <Card>
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
      <Card>
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
              <div className="h-32 w-32 rounded-xl border-2 border-dashed border-muted-foreground/25 overflow-hidden bg-muted/50 flex items-center justify-center transition-all hover:border-primary/50">
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
                  onClick={() => {
                    setPhotoPreview(null);
                    setPhotoFile(null);
                  }}
                  className="mt-2"
                >
                  <Trash2 className="h-3 w-3 mr-1" /> Remove Photo
                </Button>
              )}
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
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={handleRefresh} disabled={isSubmitting}>
            <RotateCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting}>
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
    siteName: 'ZOIRO Injected Broast',
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
      
      const response = await fetch('/api/portal/security/2fa', {
        credentials: 'include', // Send cookies with request
      });

      if (response.ok) {
        const data = await response.json();
        setIs2FAEnabled(data.is_enabled);
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
      
      const response = await fetch('/api/portal/security/2fa', {
        credentials: 'include', // Send cookies with request
      });

      if (!response.ok) throw new Error('Failed to generate 2FA');

      const data = await response.json();
      setQrCode(data.qr_code);
      setSecret(data.secret);
      setManualKey(data.manual_entry_key);
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
      
      const response = await fetch('/api/portal/security/2fa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Send cookies with request
        body: JSON.stringify({
          secret,
          token: verificationCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to enable 2FA');
      }

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
      
      const response = await fetch('/api/portal/security/2fa', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Send cookies with request
        body: JSON.stringify({
          enabled: false,
          token: disableCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to disable 2FA');
      }

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
      console.log('[Maintenance Emails] Starting request...');
      
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

      console.log('[Maintenance Emails] Response status:', response.status);
      console.log('[Maintenance Emails] Response headers:', Object.fromEntries(response.headers.entries()));

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

      console.log('[Maintenance Emails] Starting to read stream...');

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('[Maintenance Emails] Stream complete');
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        console.log('[Maintenance Emails] Buffer:', buffer);
        
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonData = line.slice(6);
            console.log('[Maintenance Emails] Received data:', jsonData);
            
            try {
              const data = JSON.parse(jsonData);
              
              if (data.error) {
                console.error('[Maintenance Emails] Server error:', data.error);
                toast.error(data.error, { id: toastId });
                setIsSendingEmails(false);
                return;
              }

              if (data.status === 'fetching') {
                console.log('[Maintenance Emails] Fetching users...');
                toast.loading('Fetching user list...', { id: toastId });
              } else if (data.status === 'sending') {
                console.log('[Maintenance Emails] Sending progress:', data);
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
                console.log('[Maintenance Emails] Complete:', data);
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
        "border-2 transition-colors",
        status.is_enabled ? "border-orange-500 bg-orange-500/5" : "border-green-500 bg-green-500/5"
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-3 rounded-full",
                status.is_enabled ? "bg-orange-500/20" : "bg-green-500/20"
              )}>
                {status.is_enabled ? (
                  <Wrench className="h-6 w-6 text-orange-500 animate-pulse" />
                ) : (
                  <Power className="h-6 w-6 text-green-500" />
                )}
              </div>
              <div>
                <CardTitle className="text-lg">
                  {status.is_enabled ? 'Maintenance Mode Active' : 'Website Online'}
                </CardTitle>
                <CardDescription>
                  {status.is_enabled 
                    ? 'Only admins can access the website. All other users see the maintenance page.'
                    : 'Website is accessible to all users.'}
                </CardDescription>
              </div>
            </div>
            <div className={cn(
              "px-3 py-1 rounded-full text-sm font-medium",
              status.is_enabled 
                ? "bg-orange-500/20 text-orange-500" 
                : "bg-green-500/20 text-green-500"
            )}>
              {status.is_enabled ? 'Maintenance' : 'Online'}
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
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Maintenance Configuration
            </CardTitle>
            <CardDescription>
              Configure the maintenance settings before enabling
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Reason Type</Label>
              <Select
                value={formData.reason_type}
                onValueChange={(value: 'update' | 'bug_fix' | 'changes' | 'scheduled' | 'custom') => 
                  setFormData(prev => ({ ...prev, reason_type: value }))
                }
              >
                <SelectTrigger>
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
              />
              <p className="text-xs text-muted-foreground">
                Users will see a countdown timer until this time
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Power className="h-4 w-4" />
            Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant={status.is_enabled ? "default" : "destructive"}
              onClick={() => setShowConfirmDialog(true)}
              disabled={isToggling}
              className="flex-1"
            >
              {isToggling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {status.is_enabled ? 'Disabling...' : 'Enabling...'}
                </>
              ) : (
                <>
                  <Power className="h-4 w-4 mr-2" />
                  {status.is_enabled ? 'Disable Maintenance Mode' : 'Enable Maintenance Mode'}
                </>
              )}
            </Button>

            {status.is_enabled && (
              <Button
                variant="outline"
                onClick={handleSendNotifications}
                disabled={isSendingEmails}
                className="flex-1"
              >
                {isSendingEmails ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending... {emailProgress.total > 0 && `${emailProgress.sent}/${emailProgress.total}`}
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Notify All Users
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

// Props for SSR data
interface SettingsClientProps {
  initialEmployeeProfile?: Employee | null;
  initialWebsiteSettings?: WebsiteSettings | null;
  initialPaymentMethods?: PaymentMethod[];
  initialPaymentStats?: PaymentMethodsStats | null;
  initial2FAStatus?: boolean;
  initialMaintenanceStatus?: MaintenanceStatus | null;
  hasSSRData?: boolean; // Explicitly set from server to indicate SSR data was fetched
}

// Main Settings Client Component
export default function SettingsClient({
  initialEmployeeProfile,
  initialWebsiteSettings,
  initialPaymentMethods = [],
  initialPaymentStats = null,
  initial2FAStatus = false,
  initialMaintenanceStatus = null,
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
              <TabsTrigger value="maintenance" className="gap-1 sm:gap-2 text-xs sm:text-sm flex-1 sm:flex-none">
                <Wrench className="h-3 w-3 sm:h-4 sm:w-4" /> Maintenance
              </TabsTrigger>
            </>
          )}
        </TabsList>

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

        {isAdmin && (
          <>
            <TabsContent value="payment-methods">
              <PaymentMethodsSettings 
                initialMethods={initialPaymentMethods} 
                initialStats={initialPaymentStats}
                hasSSRData={hasSSRData} 
              />
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
