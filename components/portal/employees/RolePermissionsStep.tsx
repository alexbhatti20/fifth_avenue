'use client';

import { Shield, CheckCircle, AlertCircle, Info, Plus, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  EmployeeFormData, 
  ROLE_LABELS, 
  ROLE_COLORS, 
  ROLE_DESCRIPTIONS,
} from './employee-form-utils';
import { 
  ROLE_DEFAULT_PERMISSIONS, 
  EXTRA_PERMISSIONS, 
  ALL_PAGES,
  type PageKey 
} from '@/lib/permissions';
import { cn } from '@/lib/utils';
import type { EmployeeRole } from '@/types/portal';

interface RolePermissionsStepProps {
  data: EmployeeFormData;
  onChange: (data: Partial<EmployeeFormData>) => void;
  errors: string[];
}

export function RolePermissionsStep({ data, onChange, errors }: RolePermissionsStepProps) {
  const roles: EmployeeRole[] = [
    'admin', 'manager', 'waiter', 'billing_staff', 
    'kitchen_staff', 'delivery_rider', 'other'
  ];

  const togglePermission = (permission: string) => {
    const current = data.custom_permissions || [];
    const updated = current.includes(permission)
      ? current.filter(p => p !== permission)
      : [...current, permission];
    onChange({ custom_permissions: updated });
  };

  // Group extra permissions by category
  const groupedPermissions = EXTRA_PERMISSIONS.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, typeof EXTRA_PERMISSIONS[number][]>);

  // Get default pages for selected role
  const roleDefaults = ROLE_DEFAULT_PERMISSIONS[data.role];
  const defaultPages = roleDefaults?.pages || [];
  const defaultOrderFilters = roleDefaults?.orderFilters || [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Role & Permissions
        </h2>
        <p className="text-muted-foreground mt-1">
          Assign a role and configure portal access for this employee
        </p>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Portal Access Toggle */}
      <Card className="bg-muted/50">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Portal Access</Label>
              <p className="text-sm text-muted-foreground">
                Allow employee to log in to the management portal
              </p>
            </div>
            <Switch
              checked={data.portal_enabled}
              onCheckedChange={(checked) => onChange({ portal_enabled: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Role Selection */}
      <div className="space-y-4">
        <Label className="text-base">Select Role</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {roles.map((role) => (
            <motion.div
              key={role}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Card
                className={cn(
                  'cursor-pointer transition-all border-2 h-full',
                  data.role === role 
                    ? 'border-primary bg-primary/5 shadow-md' 
                    : 'border-transparent hover:border-primary/50 hover:bg-muted/50'
                )}
                onClick={() => onChange({ role })}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center',
                        ROLE_COLORS[role]
                      )}>
                        <Shield className="h-5 w-5" />
                      </div>
                      {data.role === role && (
                        <CheckCircle className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-medium">{ROLE_LABELS[role]}</h4>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {ROLE_DESCRIPTIONS[role]}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Admin Warning */}
      {data.role === 'admin' && (
        <Alert className="border-red-500/50 bg-red-500/10">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <AlertDescription className="text-red-600 dark:text-red-400">
            <strong>Warning:</strong> Admin role has full access to all system features including 
            employee management, payroll, and system settings. Assign this role carefully.
          </AlertDescription>
        </Alert>
      )}

      {/* Default Permissions Display */}
      {data.role !== 'admin' && (
        <Card className="bg-muted/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Default Access for {ROLE_LABELS[data.role]}
            </CardTitle>
            <CardDescription>
              These pages are automatically accessible based on the selected role
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {defaultPages.map(pageKey => {
                const page = ALL_PAGES[pageKey as PageKey];
                if (!page) return null;
                return (
                  <Badge key={pageKey} variant="secondary" className="text-xs">
                    {page.label}
                  </Badge>
                );
              })}
            </div>
            {defaultOrderFilters.length > 0 && defaultOrderFilters[0] !== 'all' && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs text-muted-foreground mb-2">Order Access:</p>
                <div className="flex flex-wrap gap-2">
                  {defaultOrderFilters.map(filter => (
                    <Badge key={filter} variant="outline" className="text-xs capitalize">
                      {filter} orders only
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Extra Permissions - Available for all roles except admin */}
      {data.role !== 'admin' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Additional Permissions
            </CardTitle>
            <CardDescription>
              Grant extra permissions beyond the default role access
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {Object.entries(groupedPermissions).map(([category, permissions]) => (
              <div key={category}>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">{category}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {permissions.map((perm) => {
                    const isSelected = data.custom_permissions?.includes(perm.key);
                    return (
                      <div
                        key={perm.key}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                          isSelected
                            ? 'bg-primary/5 border-primary'
                            : 'hover:bg-muted/50'
                        )}
                        onClick={() => togglePermission(perm.key)}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => togglePermission(perm.key)}
                        />
                        <Label className="cursor-pointer text-sm">{perm.label}</Label>
                      </div>
                    );
                  })}
                </div>
                <Separator className="mt-4" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Selected Extra Permissions Summary */}
      {data.custom_permissions && data.custom_permissions.length > 0 && (
        <Card className="bg-green-500/5 border-green-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-green-700 dark:text-green-400">
              Extra Permissions Granted ({data.custom_permissions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.custom_permissions.map(permKey => {
                const perm = EXTRA_PERMISSIONS.find(p => p.key === permKey);
                return (
                  <Badge 
                    key={permKey} 
                    variant="secondary" 
                    className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                    onClick={() => togglePermission(permKey)}
                  >
                    {perm?.label || permKey}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
