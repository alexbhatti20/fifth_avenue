'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Mail,
  Phone,
  MoreVertical,
  Eye,
  FileText,
  DollarSign,
  Lock,
  Unlock,
  UserCheck,
  Ban,
  Trash2,
  Calendar,
  Edit,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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
import { cn } from '@/lib/utils';
import type { Employee, EmployeeRole, EmployeeStatus } from '@/types/portal';

const ROLE_LABELS: Record<EmployeeRole, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  waiter: 'Waiter',
  billing_staff: 'Billing Staff',
  kitchen_staff: 'Kitchen Staff',
  delivery_rider: 'Delivery Rider',
  other: 'Other Staff',
};

const ROLE_COLORS: Record<EmployeeRole, string> = {
  admin: 'bg-red-500/10 text-red-500 border-red-500/20',
  manager: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  waiter: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  billing_staff: 'bg-green-500/10 text-green-500 border-green-500/20',
  kitchen_staff: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  delivery_rider: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  other: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
};

const STATUS_COLORS: Record<EmployeeStatus, string> = {
  active: 'bg-green-500/10 text-green-500',
  inactive: 'bg-zinc-500/10 text-zinc-500',
  blocked: 'bg-red-500/10 text-red-500',
  pending: 'bg-yellow-500/10 text-yellow-500',
};

interface EmployeeCardProps {
  employee: Employee;
  onView: (employee: Employee) => void;
  onEdit?: (employee: Employee) => void;
  onTogglePortal: (id: string, enabled: boolean) => void;
  onDelete: (employee: Employee) => void;
}

export function EmployeeCard({
  employee,
  onView,
  onEdit,
  onTogglePortal,
  onDelete,
}: EmployeeCardProps) {
  const router = useRouter();
  
  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on dropdown or its trigger
    const target = e.target as HTMLElement;
    if (target.closest('[role="menu"]') || target.closest('button')) return;
    router.push(`/portal/employees/${employee.id}`);
  };
  
  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) {
      onEdit(employee);
    } else {
      router.push(`/portal/employees/${employee.id}/edit`);
    }
  };
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <Card 
        className="group hover:shadow-lg transition-all duration-300 hover:border-primary/30 cursor-pointer overflow-hidden"
        onClick={handleCardClick}
      >
        <CardContent className="p-0">
          {/* Header with gradient */}
          <div className={cn(
            "h-16 relative",
            employee.status === 'blocked' ? 'bg-gradient-to-r from-red-500/20 to-red-600/10' :
            employee.status === 'active' ? 'bg-gradient-to-r from-primary/20 to-orange-500/10' :
            'bg-gradient-to-r from-zinc-500/20 to-zinc-600/10'
          )}>
            {/* Status indicator */}
            <div className="absolute top-3 right-3">
              <Badge className={cn('text-xs capitalize', STATUS_COLORS[employee.status])}>
                {employee.status}
              </Badge>
            </div>
          </div>
          
          {/* Avatar */}
          <div className="px-4 -mt-8">
            <Avatar className="h-16 w-16 border-4 border-background shadow-lg">
              <AvatarImage src={employee.avatar_url || undefined} />
              <AvatarFallback className="text-xl font-bold bg-gradient-to-br from-primary to-orange-500 text-white">
                {employee.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Content */}
          <div className="p-4 pt-3">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg truncate">{employee.name}</h3>
                <Badge className={cn('mt-1 text-xs', ROLE_COLORS[employee.role])}>
                  {ROLE_LABELS[employee.role]}
                </Badge>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => onView(employee)}>
                    <Eye className="h-4 w-4 mr-2" /> View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleEditClick}>
                    <Edit className="h-4 w-4 mr-2" /> Edit Employee
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
            </div>

            {/* Employee ID */}
            <code className="text-xs bg-muted px-2 py-1 rounded font-mono mt-2 inline-block">
              {employee.employee_id}
            </code>

            {/* Contact info */}
            <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 truncate">
                <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{employee.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{employee.phone}</span>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {employee.hired_date 
                  ? new Date(employee.hired_date).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric'
                    }) 
                  : 'N/A'}
              </div>
              <Badge variant="outline" className={employee.portal_enabled ? 'text-green-600 border-green-500/30' : 'text-red-500 border-red-500/30'}>
                {employee.portal_enabled ? <Unlock className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
                {employee.portal_enabled ? 'Portal' : 'No Access'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export { ROLE_LABELS, ROLE_COLORS, STATUS_COLORS };
