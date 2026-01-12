'use client';

import { useState } from 'react';
import { UserCheck, Loader2, Mail, Key } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { activateEmployee } from '@/lib/portal-queries';
import { sendEmployeeActivatedNotification, EMPLOYEE_ACTIVATION_REASONS } from '@/lib/brevo';
import { ROLE_LABELS, ROLE_COLORS, STATUS_COLORS } from './EmployeeCard';
import type { Employee } from '@/types/portal';

interface ActivateEmployeeDialogProps {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  adminId?: string;
}

export function ActivateEmployeeDialog({
  employee,
  open,
  onOpenChange,
  onSuccess,
  adminId,
}: ActivateEmployeeDialogProps) {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState('');
  const [enablePortal, setEnablePortal] = useState(true);
  const [sendEmail, setSendEmail] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleActivate = async () => {
    if (!employee) return;

    const reason = selectedReason === 'other' 
      ? customReason 
      : EMPLOYEE_ACTIVATION_REASONS.find(r => r.id === selectedReason)?.description || selectedReason;

    if (!reason.trim()) {
      toast.error('Please provide a reason for activation');
      return;
    }

    setLoading(true);
    try {
      // Activate employee in database
      const result = await activateEmployee(employee.id, enablePortal, adminId);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to activate employee');
      }

      // Send email notification if enabled
      if (sendEmail && employee.email) {
        const activatedDate = new Date().toLocaleDateString('en-GB', {
          day: 'numeric', month: 'long', year: 'numeric'
        });
        await sendEmployeeActivatedNotification(
          employee.email,
          employee.name,
          employee.employee_id,
          reason,
          result.new_license_id || null,
          activatedDate
        );
      }

      toast.success(`${employee.name} has been activated`);
      onSuccess();
      onOpenChange(false);
      
      // Reset form
      setSelectedReason('');
      setCustomReason('');
      setEnablePortal(true);
      setSendEmail(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to activate employee');
    } finally {
      setLoading(false);
    }
  };

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-600">
            <UserCheck className="h-5 w-5" />
            Activate Employee
          </DialogTitle>
          <DialogDescription>
            This will restore the employee's account and optionally enable portal access.
          </DialogDescription>
        </DialogHeader>

        {/* Employee Info */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <Avatar className="h-12 w-12">
            <AvatarImage src={employee.avatar_url || undefined} />
            <AvatarFallback className="bg-gradient-to-br from-primary to-orange-500 text-white">
              {employee.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{employee.name}</p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{employee.employee_id}</code>
              <Badge className={STATUS_COLORS[employee.status]} variant="outline">
                {employee.status}
              </Badge>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Reason Selection */}
          <div className="space-y-2">
            <Label>Reason for Activation</Label>
            <Select value={selectedReason} onValueChange={setSelectedReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {EMPLOYEE_ACTIVATION_REASONS.map((reason) => (
                  <SelectItem key={reason.id} value={reason.id}>
                    <div>
                      <p className="font-medium">{reason.label}</p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedReason && selectedReason !== 'other' && (
              <p className="text-xs text-muted-foreground">
                {EMPLOYEE_ACTIVATION_REASONS.find(r => r.id === selectedReason)?.description}
              </p>
            )}
          </div>

          {/* Custom Reason */}
          {selectedReason === 'other' && (
            <div className="space-y-2">
              <Label>Custom Reason</Label>
              <Textarea
                placeholder="Provide detailed reason for activation..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                rows={3}
              />
            </div>
          )}

          {/* Portal Access */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm font-medium">Enable Portal Access</p>
                <p className="text-xs text-muted-foreground">Generate new license key</p>
              </div>
            </div>
            <Switch
              checked={enablePortal}
              onCheckedChange={setEnablePortal}
            />
          </div>

          {/* Email Notification */}
          <div className="flex items-center space-x-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Checkbox
              id="send-email"
              checked={sendEmail}
              onCheckedChange={(checked) => setSendEmail(!!checked)}
            />
            <label
              htmlFor="send-email"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
            >
              <Mail className="h-4 w-4 text-blue-600" />
              Send welcome back email to employee
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleActivate} 
            disabled={loading || !selectedReason}
            className="bg-green-600 hover:bg-green-700"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Activating...
              </>
            ) : (
              <>
                <UserCheck className="h-4 w-4 mr-2" />
                Activate Employee
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
