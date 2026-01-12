'use client';

import {
  MoreVertical,
  Eye,
  FileText,
  DollarSign,
  Lock,
  Unlock,
  UserCheck,
  Ban,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TableRow, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { ROLE_LABELS, ROLE_COLORS, STATUS_COLORS } from './EmployeeCard';
import type { Employee, EmployeeStatus } from '@/types/portal';

interface EmployeeRowProps {
  employee: Employee;
  onView: (employee: Employee) => void;
  onTogglePortal: (id: string, enabled: boolean) => void;
  onDelete: (employee: Employee) => void;
}

export function EmployeeRow({
  employee,
  onView,
  onTogglePortal,
  onDelete,
}: EmployeeRowProps) {
  return (
    <TableRow className="group hover:bg-muted/50 cursor-pointer" onClick={() => onView(employee)}>
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border">
            <AvatarImage src={employee.avatar_url || undefined} />
            <AvatarFallback className="font-semibold bg-gradient-to-br from-primary to-orange-500 text-white">
              {employee.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{employee.name}</p>
            <p className="text-sm text-muted-foreground">{employee.email}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
          {employee.employee_id}
        </code>
      </TableCell>
      <TableCell>
        <Badge className={cn('font-medium', ROLE_COLORS[employee.role])}>
          {ROLE_LABELS[employee.role]}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge className={cn('font-medium capitalize', STATUS_COLORS[employee.status])}>
          {employee.status}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={employee.portal_enabled ? 'text-green-600 border-green-500/30' : 'text-red-500 border-red-500/30'}>
          {employee.portal_enabled ? <Unlock className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
          {employee.portal_enabled ? 'Enabled' : 'Disabled'}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {employee.hired_date 
          ? new Date(employee.hired_date).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric'
            }) 
          : '-'}
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onView(employee)}>
              <Eye className="h-4 w-4 mr-2" /> View Details
            </DropdownMenuItem>
            <DropdownMenuItem>
              <FileText className="h-4 w-4 mr-2" /> Documents
            </DropdownMenuItem>
            <DropdownMenuItem>
              <DollarSign className="h-4 w-4 mr-2" /> Payroll
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className={employee.portal_enabled ? 'text-orange-600' : 'text-green-600'}
              onClick={() => onTogglePortal(employee.id, !employee.portal_enabled)}
            >
              {employee.portal_enabled ? (
                <><Ban className="h-4 w-4 mr-2" /> Block Employee</>
              ) : (
                <><UserCheck className="h-4 w-4 mr-2" /> Unblock Employee</>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={() => onDelete(employee)}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
