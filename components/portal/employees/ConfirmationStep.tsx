'use client';

import { 
  CheckCircle, User, Shield, DollarSign, FileText, 
  Key, Copy, Mail, Phone, Calendar, MapPin, Building, RefreshCw 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { EmployeeFormData, ROLE_LABELS, ROLE_COLORS, formatCurrency } from './employee-form-utils';

interface ConfirmationStepProps {
  data: EmployeeFormData;
  employeeId: string;
  licenseId: string;
  onRegenerateEmployeeId?: () => void;
  onRegenerateLicenseId?: () => void;
}

export function ConfirmationStep({ 
  data, 
  employeeId, 
  licenseId,
  onRegenerateEmployeeId,
  onRegenerateLicenseId 
}: ConfirmationStepProps) {
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center py-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <CheckCircle className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">Review Employee Details</h2>
        <p className="text-muted-foreground mt-1">
          Please verify all information before creating the employee account
        </p>
      </div>

      {/* Employee Preview Card */}
      <Card className="border-primary/50 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-primary">
              <AvatarImage src={data.photo_url || undefined} />
              <AvatarFallback className="text-xl bg-primary text-primary-foreground">
                {data.full_name?.charAt(0)?.toUpperCase() || 'E'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="text-lg font-semibold">{data.full_name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={ROLE_COLORS[data.role]}>{ROLE_LABELS[data.role]}</Badge>
                <Badge variant="outline">{employeeId}</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" /> Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Email:</span>
              <span className="font-medium ml-auto">{data.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Phone:</span>
              <span className="font-medium ml-auto">{data.phone || 'Not provided'}</span>
            </div>
            {data.date_of_birth && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">DOB:</span>
                <span className="font-medium ml-auto">
                  {new Date(data.date_of_birth).toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'short', year: 'numeric'
                  })}
                </span>
              </div>
            )}
            {data.address && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <span className="text-muted-foreground">Address:</span>
                <span className="font-medium ml-auto text-right max-w-[150px] truncate">
                  {data.address}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Role & Access */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" /> Role & Access
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Role:</span>
              <Badge className={ROLE_COLORS[data.role]}>{ROLE_LABELS[data.role]}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Portal Access:</span>
              <Badge variant={data.portal_enabled ? 'default' : 'secondary'}>
                {data.portal_enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Documents:</span>
              <span className="font-medium">
                {data.documents.filter(d => d.number).length} uploaded
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Payroll */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Payroll Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Base Salary:</span>
              <span className="font-medium text-primary">
                {formatCurrency(data.base_salary)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Payment:</span>
              <span className="font-medium capitalize">{data.payment_frequency}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Hire Date:</span>
              <span className="font-medium">
                {data.hired_date 
                  ? new Date(data.hired_date).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric'
                    })
                  : 'Not set'
                }
              </span>
            </div>
            {data.bank_name && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Bank:</span>
                <span className="font-medium">{data.bank_name}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* License ID Card */}
        <Card className="border-2 border-primary bg-gradient-to-br from-primary/10 to-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Key className="h-4 w-4" /> Activation Credentials
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Employee ID</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-base font-bold p-2 bg-background rounded">
                  {employeeId}
                </code>
                {onRegenerateEmployeeId && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      onRegenerateEmployeeId();
                      toast.success('Employee ID regenerated');
                    }}
                    title="Regenerate Employee ID"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(employeeId, 'Employee ID')}
                  title="Copy Employee ID"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Separator />
            <div>
              <p className="text-xs text-muted-foreground mb-1">License Key (for activation)</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-sm font-bold p-2 bg-background rounded text-primary">
                  {licenseId}
                </code>
                {onRegenerateLicenseId && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      onRegenerateLicenseId();
                      toast.success('License ID regenerated');
                    }}
                    title="Regenerate License ID"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(licenseId, 'License ID')}
                  title="Copy License ID"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Employee will receive this via email to activate their account
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Info Alert */}
      <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30 text-sm">
        <div className="flex gap-3">
          <Mail className="h-5 w-5 text-blue-500 shrink-0" />
          <div>
            <p className="font-medium text-blue-700 dark:text-blue-400">
              Email Notification
            </p>
            <p className="text-muted-foreground mt-1">
              An email will be sent to <strong>{data.email}</strong> with the license key and 
              instructions to activate their portal account.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
