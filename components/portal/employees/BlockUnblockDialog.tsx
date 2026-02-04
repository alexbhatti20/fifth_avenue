'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { toggleBlockEmployeeServer } from '@/lib/actions';
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
  const [isProcessing, setIsProcessing] = useState(false);

  const isBlocking = mode === 'block';
  const reasons = isBlocking ? BLOCK_REASONS : UNBLOCK_REASONS;

  // Reset form when dialog opens with new employee
  useEffect(() => {
    if (open && employee) {
      setSelectedReason('');
      setCustomReason('');
      setSendEmail(true);
      setIsProcessing(false);
    }
  }, [open, employee]);

  const resetForm = useCallback(() => {
    setSelectedReason('');
    setCustomReason('');
    setSendEmail(true);
    setIsProcessing(false);
  }, []);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen && !isProcessing) {
      resetForm();
      onOpenChange(false);
    }
  }, [isProcessing, onOpenChange, resetForm]);

  const handleSubmit = useCallback(() => {
    if (!employee || isProcessing) return;

    const reasonObj = reasons.find(r => r.id === selectedReason);
    const reason = selectedReason === 'other' 
      ? customReason 
      : reasonObj?.description || selectedReason;

    if (!reason.trim()) {
      toast.error(`Please provide a reason for ${isBlocking ? 'blocking' : 'unblocking'}`);
      return;
    }

    // Prevent multiple clicks
    setIsProcessing(true);

    // Store values before closing
    const empId = employee.id;
    const empName = employee.name;
    const empEmail = employee.email;
    const empIdNumber = employee.employee_id;
    const shouldSendEmail = sendEmail;
    const blockReason = isBlocking ? reason : null;
    const newPortalEnabled = !isBlocking;
    
    // Close dialog IMMEDIATELY - no waiting
    onOpenChange(false);
    
    // Reset form IMMEDIATELY
    requestAnimationFrame(() => {
      setSelectedReason('');
      setCustomReason('');
      setSendEmail(true);
      setIsProcessing(false);
    });
    
    // Update parent state IMMEDIATELY (optimistic)
    requestAnimationFrame(() => {
      onSuccess({
        id: empId,
        portal_enabled: newPortalEnabled,
      });
    });
    
    // Show loading toast
    const loadingToast = toast.loading(`${isBlocking ? 'Blocking' : 'Unblocking'} ${empName}...`);

    // Run server action completely async (fire and forget)
    Promise.resolve().then(async () => {
      try {
        const result = await toggleBlockEmployeeServer(
          empId,
          blockReason,
          {
            sendEmail: shouldSendEmail,
            employeeEmail: empEmail,
            employeeName: empName,
            employeeIdNumber: empIdNumber,
          }
        );
        
        // Dismiss loading toast
        toast.dismiss(loadingToast);
        
        if (!result.success) {
          // Revert optimistic update on error
          onSuccess({
            id: empId,
            portal_enabled: !newPortalEnabled,
          });
          toast.error(result.error || `Failed to ${isBlocking ? 'block' : 'unblock'} employee`);
        } else {
          // Success!
          toast.success(result.message || `${empName} has been ${isBlocking ? 'blocked' : 'unblocked'}`);
        }
      } catch (error: any) {
        toast.dismiss(loadingToast);
        // Revert optimistic update on error
        onSuccess({
          id: empId,
          portal_enabled: !newPortalEnabled,
        });
        toast.error(error.message || `Failed to ${isBlocking ? 'block' : 'unblock'} employee`);
      }
    });
  }, [employee, isProcessing, selectedReason, customReason, reasons, isBlocking, sendEmail, onOpenChange, onSuccess]);

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent 
        className="max-w-md" 
        onPointerDownOutside={(e) => isProcessing && e.preventDefault()} 
        onEscapeKeyDown={(e) => isProcessing && e.preventDefault()}
        onInteractOutside={(e) => isProcessing && e.preventDefault()}
      >
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
            <AvatarImage src={employee.avatar_url || undefined} alt={employee.name || 'Employee'} />
            <AvatarFallback className="bg-gradient-to-br from-primary to-orange-500 text-white">
              {employee.name?.charAt(0)?.toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{employee.name || 'Unknown'}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{employee.employee_id || 'N/A'}</code>
              <Badge className={ROLE_COLORS[employee.role]} variant="outline">
                {ROLE_LABELS[employee.role] || employee.role}
              </Badge>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Reason Selection */}
          <div className="space-y-2">
            <Label htmlFor="reason-select">Reason for {isBlocking ? 'Blocking' : 'Unblocking'}</Label>
            <Select value={selectedReason} onValueChange={setSelectedReason} disabled={isProcessing}>
              <SelectTrigger id="reason-select">
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {reasons.map((reason) => (
                  <SelectItem key={reason.id} value={reason.id}>
                    {reason.label}
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
              <Label htmlFor="custom-reason">Custom Reason</Label>
              <Textarea
                id="custom-reason"
                placeholder={`Provide detailed reason for ${isBlocking ? 'blocking' : 'unblocking'}...`}
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                rows={3}
                disabled={isProcessing}
              />
            </div>
          )}

          {/* Email Notification */}
          <div className={`flex items-center space-x-2 p-3 rounded-lg ${isBlocking ? 'bg-orange-500/10 border border-orange-500/20' : 'bg-green-500/10 border border-green-500/20'}`}>
            <Checkbox
              id="send-email"
              checked={sendEmail}
              onCheckedChange={(checked) => setSendEmail(!!checked)}
              disabled={isProcessing}
            />
            <label
              htmlFor="send-email"
              className="text-sm font-medium leading-none cursor-pointer select-none flex items-center gap-2"
            >
              <Mail className={`h-4 w-4 ${isBlocking ? 'text-orange-600' : 'text-green-600'}`} />
              Send notification email to employee
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => handleOpenChange(false)} 
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button 
            variant={isBlocking ? 'destructive' : 'default'}
            onClick={handleSubmit} 
            disabled={isProcessing || !selectedReason || (selectedReason === 'other' && !customReason.trim())}
            className={isBlocking ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
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
