'use client';

import { useState } from 'react';
import { Ban, UserCheck, Loader2, Mail } from 'lucide-react';
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
import { supabase } from '@/lib/supabase';
import { ROLE_LABELS, ROLE_COLORS } from './EmployeeCard';
import type { Employee } from '@/types/portal';

// Block reasons
const BLOCK_REASONS = [
  { id: 'performance', label: 'Performance Issues', description: 'Consistent underperformance or failure to meet job requirements' },
  { id: 'attendance', label: 'Attendance Problems', description: 'Repeated absences or failure to follow attendance policy' },
  { id: 'misconduct', label: 'Workplace Misconduct', description: 'Violation of workplace rules or inappropriate behavior' },
  { id: 'policy_violation', label: 'Policy Violation', description: 'Breach of company policies or procedures' },
  { id: 'investigation', label: 'Under Investigation', description: 'Pending investigation of reported incident' },
  { id: 'leave', label: 'Leave of Absence', description: 'Employee on approved or unapproved leave' },
  { id: 'security', label: 'Security Concern', description: 'Potential security risk or data concerns' },
  { id: 'other', label: 'Other Reason', description: 'Custom reason to be specified' },
];

// Unblock reasons
const UNBLOCK_REASONS = [
  { id: 'resolved', label: 'Issue Resolved', description: 'The issue that led to blocking has been resolved' },
  { id: 'investigation_complete', label: 'Investigation Complete', description: 'Investigation completed with no action required' },
  { id: 'leave_ended', label: 'Leave Ended', description: 'Employee returning from leave of absence' },
  { id: 'appeal_approved', label: 'Appeal Approved', description: 'Employee appeal has been reviewed and approved' },
  { id: 'reinstatement', label: 'Reinstatement', description: 'Employee being reinstated after suspension period' },
  { id: 'error_correction', label: 'Error Correction', description: 'Previous block was made in error' },
  { id: 'other', label: 'Other Reason', description: 'Custom reason to be specified' },
];

interface BlockUnblockDialogProps {
  employee: Employee | null;
  mode: 'block' | 'unblock';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (updatedEmployee: Partial<Employee>) => void;
}

export function BlockUnblockDialog({
  employee,
  mode,
  open,
  onOpenChange,
  onSuccess,
}: BlockUnblockDialogProps) {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [loading, setLoading] = useState(false);

  const isBlocking = mode === 'block';
  const reasons = isBlocking ? BLOCK_REASONS : UNBLOCK_REASONS;

  const handleSubmit = async () => {
    if (!employee) return;

    const reasonObj = reasons.find(r => r.id === selectedReason);
    const reason = selectedReason === 'other' 
      ? customReason 
      : reasonObj?.description || selectedReason;

    if (!reason.trim()) {
      toast.error(`Please provide a reason for ${isBlocking ? 'blocking' : 'unblocking'}`);
      return;
    }

    setLoading(true);
    try {
      // Use the RPC function with SECURITY DEFINER to bypass RLS
      // The function toggles status - if blocked, it unblocks; if active, it blocks
      const { data, error } = await supabase.rpc('toggle_block_employee', {
        p_employee_id: employee.id,
        p_reason: isBlocking ? reason : null,
      });
      
      if (error) {
        throw new Error(error.message || `Failed to ${isBlocking ? 'block' : 'unblock'} employee`);
      }
      
      // Check the response from RPC
      if (!data?.success) {
        throw new Error(data?.error || `Failed to ${isBlocking ? 'block' : 'unblock'} employee`);
      }
      
      // Send email notification if enabled (via API to access server-side env vars)
      if (sendEmail && employee.email) {
        const actionDate = new Date().toLocaleDateString('en-GB', {
          day: 'numeric', month: 'long', year: 'numeric'
        });
        
        try {
          const emailResponse = await fetch('/api/admin/employees/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: isBlocking ? 'blocked' : 'unblocked',
              email: employee.email,
              name: employee.name,
              employeeId: employee.employee_id,
              reason,
              date: actionDate,
            }),
          });
          
          if (!emailResponse.ok) {
            const emailError = await emailResponse.json();
            }
        } catch (emailErr) {
          // Don't fail the whole operation if email fails
        }
      }

      toast.success(data.message || `${employee.name} has been ${isBlocking ? 'blocked' : 'unblocked'}`);
      
      // Call success callback with updated employee data from RPC response
      onSuccess({
        id: employee.id,
        portal_enabled: data.portal_enabled,
      });
      
      onOpenChange(false);
      
      // Reset form
      setSelectedReason('');
      setCustomReason('');
      setSendEmail(true);
    } catch (error: any) {
      toast.error(error.message || `Failed to ${isBlocking ? 'block' : 'unblock'} employee`);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedReason('');
    setCustomReason('');
    setSendEmail(true);
    onOpenChange(false);
  };

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${isBlocking ? 'text-orange-600' : 'text-green-600'}`}>
            {isBlocking ? <Ban className="h-5 w-5" /> : <UserCheck className="h-5 w-5" />}
            {isBlocking ? 'Block Employee' : 'Unblock Employee'}
          </DialogTitle>
          <DialogDescription>
            {isBlocking 
              ? 'This will disable portal access for this employee. They will not be able to login until unblocked.'
              : 'This will restore portal access for this employee. They will be able to login again.'
            }
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
            <Label>Reason for {isBlocking ? 'Blocking' : 'Unblocking'}</Label>
            <Select value={selectedReason} onValueChange={setSelectedReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {reasons.map((reason) => (
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
                {reasons.find(r => r.id === selectedReason)?.description}
              </p>
            )}
          </div>

          {/* Custom Reason */}
          {selectedReason === 'other' && (
            <div className="space-y-2">
              <Label>Custom Reason</Label>
              <Textarea
                placeholder={`Provide detailed reason for ${isBlocking ? 'blocking' : 'unblocking'}...`}
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                rows={3}
              />
            </div>
          )}

          {/* Email Notification */}
          <div className={`flex items-center space-x-2 p-3 rounded-lg ${isBlocking ? 'bg-orange-500/10 border border-orange-500/20' : 'bg-green-500/10 border border-green-500/20'}`}>
            <Checkbox
              id="send-email"
              checked={sendEmail}
              onCheckedChange={(checked) => setSendEmail(!!checked)}
            />
            <label
              htmlFor="send-email"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
            >
              <Mail className={`h-4 w-4 ${isBlocking ? 'text-orange-600' : 'text-green-600'}`} />
              Send notification email to employee
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button 
            variant={isBlocking ? 'destructive' : 'default'}
            onClick={handleSubmit} 
            disabled={loading || !selectedReason || (selectedReason === 'other' && !customReason.trim())}
            className={isBlocking ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isBlocking ? 'Blocking...' : 'Unblocking...'}
              </>
            ) : (
              <>
                {isBlocking ? <Ban className="h-4 w-4 mr-2" /> : <UserCheck className="h-4 w-4 mr-2" />}
                {isBlocking ? 'Block Employee' : 'Unblock Employee'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
