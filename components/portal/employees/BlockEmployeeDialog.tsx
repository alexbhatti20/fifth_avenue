'use client';

import { useState } from 'react';
import { Ban, Loader2, Mail } from 'lucide-react';
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
import { blockEmployee } from '@/lib/portal-queries';
import { sendEmployeeBlockedNotification, EMPLOYEE_BLOCK_REASONS } from '@/lib/brevo';
import { ROLE_LABELS, ROLE_COLORS } from './EmployeeCard';
import type { Employee } from '@/types/portal';

interface BlockEmployeeDialogProps {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  adminId?: string;
}

export function BlockEmployeeDialog({
  employee,
  open,
  onOpenChange,
  onSuccess,
  adminId,
}: BlockEmployeeDialogProps) {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleBlock = async () => {
    if (!employee) return;

    const reason = selectedReason === 'other' 
      ? customReason 
      : EMPLOYEE_BLOCK_REASONS.find(r => r.id === selectedReason)?.description || selectedReason;

    if (!reason.trim()) {
      toast.error('Please provide a reason for blocking');
      return;
    }

    setLoading(true);
    try {
      // Block employee in database
      const result = await blockEmployee(employee.id, reason);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to block employee');
      }

      // Send email notification if enabled
      if (sendEmail && employee.email) {
        const blockedDate = new Date().toLocaleDateString('en-GB', {
          day: 'numeric', month: 'long', year: 'numeric'
        });
        await sendEmployeeBlockedNotification(
          employee.email,
          employee.name,
          employee.employee_id,
          reason,
          blockedDate
        );
      }

      toast.success(`${employee.name} has been blocked`);
      onSuccess();
      onOpenChange(false);
      
      // Reset form
      setSelectedReason('');
      setCustomReason('');
      setSendEmail(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to block employee');
    } finally {
      setLoading(false);
    }
  };

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <Ban className="h-5 w-5" />
            Block Employee
          </DialogTitle>
          <DialogDescription>
            This will disable portal access and deactivate the employee's account.
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
              <Badge className={ROLE_COLORS[employee.role]} variant="outline">
                {ROLE_LABELS[employee.role]}
              </Badge>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Reason Selection */}
          <div className="space-y-2">
            <Label>Reason for Blocking</Label>
            <Select value={selectedReason} onValueChange={setSelectedReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {EMPLOYEE_BLOCK_REASONS.map((reason) => (
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
                {EMPLOYEE_BLOCK_REASONS.find(r => r.id === selectedReason)?.description}
              </p>
            )}
          </div>

          {/* Custom Reason */}
          {selectedReason === 'other' && (
            <div className="space-y-2">
              <Label>Custom Reason</Label>
              <Textarea
                placeholder="Provide detailed reason for blocking..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                rows={3}
              />
            </div>
          )}

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
              Send notification email to employee
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleBlock} 
            disabled={loading || !selectedReason}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Blocking...
              </>
            ) : (
              <>
                <Ban className="h-4 w-4 mr-2" />
                Block Employee
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
