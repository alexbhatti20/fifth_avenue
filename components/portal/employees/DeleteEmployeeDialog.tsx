'use client';

import { useState } from 'react';
import { Trash2, Loader2, Mail, AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { deleteEmployeeCascade, deleteStorageFile } from '@/lib/portal-queries';
import { sendEmployeeDeletedNotification } from '@/lib/brevo';
import { ROLE_LABELS, ROLE_COLORS } from './EmployeeCard';
import type { Employee } from '@/types/portal';

interface DeleteEmployeeDialogProps {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  adminId?: string;
}

export function DeleteEmployeeDialog({
  employee,
  open,
  onOpenChange,
  onSuccess,
  adminId,
}: DeleteEmployeeDialogProps) {
  const [reason, setReason] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!employee || !confirmDelete) return;

    setLoading(true);
    try {
      // Delete employee cascade
      const result = await deleteEmployeeCascade(employee.id, adminId);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete employee');
      }

      // Clean up storage files (avatar, documents)
      if (employee.avatar_url && employee.avatar_url.includes('supabase')) {
        // Extract path from URL and delete
        const avatarPath = employee.avatar_url.split('/').slice(-2).join('/');
        await deleteStorageFile('avatars', avatarPath);
      }

      // Send email notification if enabled
      if (sendEmail && employee.email) {
        const deletionDate = new Date().toLocaleDateString('en-GB', {
          day: 'numeric', month: 'long', year: 'numeric'
        });
        await sendEmployeeDeletedNotification(
          employee.email,
          employee.name,
          employee.employee_id,
          reason || 'Account termination',
          deletionDate
        );
      }

      toast.success(`${employee.name} has been deleted`, {
        description: result.deleted 
          ? `Deleted ${result.deleted.documents || 0} documents, ${result.deleted.payroll_records || 0} payroll records`
          : undefined
      });
      
      onSuccess();
      onOpenChange(false);
      
      // Reset form
      setReason('');
      setSendEmail(true);
      setConfirmDelete(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete employee');
    } finally {
      setLoading(false);
    }
  };

  if (!employee) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Employee Permanently
          </AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the employee account
            and all associated data including documents, payroll records, and attendance.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Employee Info */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <Avatar className="h-12 w-12">
            <AvatarImage src={employee.avatar_url || undefined} />
            <AvatarFallback className="bg-gradient-to-br from-red-500 to-red-600 text-white">
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
          {/* Warning */}
          <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-sm">
            <p className="font-medium text-orange-700 mb-2">⚠️ The following will be deleted:</p>
            <ul className="text-muted-foreground space-y-1 text-xs">
              <li>• Employee profile and personal information</li>
              <li>• All uploaded documents</li>
              <li>• Payroll history and records</li>
              <li>• Attendance records</li>
              <li>• License and activation keys</li>
            </ul>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label>Reason for Deletion (Optional)</Label>
            <Textarea
              placeholder="Provide reason for termination..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
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
              Send termination notice email
            </label>
          </div>

          {/* Confirmation */}
          <div className="flex items-center space-x-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <Checkbox
              id="confirm-delete"
              checked={confirmDelete}
              onCheckedChange={(checked) => setConfirmDelete(!!checked)}
            />
            <label
              htmlFor="confirm-delete"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-red-600"
            >
              I understand this action is irreversible
            </label>
          </div>
        </div>

        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleDelete} 
            disabled={loading || !confirmDelete}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Permanently
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
