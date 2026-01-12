import { 
  User, FileText, Shield, DollarSign, CheckCircle 
} from 'lucide-react';
import type { EmployeeRole } from '@/types/portal';

// =============================================
// TYPES
// =============================================

export interface EmployeeDocument {
  type: string;
  number: string;
  file: File | null;
  file_url: string;
}

export interface EmployeeFormData {
  // Personal Details
  full_name: string;
  email: string;
  phone: string;
  cnic: string; // CNIC number for primary identification
  address: string;
  emergency_contact: string;
  emergency_contact_name: string;
  date_of_birth: string;
  blood_group: string;
  photo_file: File | null;
  photo_url: string;
  
  // Documents
  documents: EmployeeDocument[];
  
  // Role & Access
  role: EmployeeRole;
  custom_permissions: string[];
  portal_enabled: boolean;
  
  // Payroll
  base_salary: number;
  payment_frequency: 'weekly' | 'bi-weekly' | 'monthly';
  bank_name: string;
  account_number: string;
  iban: string;
  tax_id: string;
  
  // Hiring
  hired_date: string;
  notes: string;
}

// =============================================
// CONSTANTS
// =============================================

export const WIZARD_STEPS = [
  { id: 1, title: 'Personal Info', icon: User, description: 'Basic details' },
  { id: 2, title: 'Documents', icon: FileText, description: 'ID & files' },
  { id: 3, title: 'Role & Access', icon: Shield, description: 'Permissions' },
  { id: 4, title: 'Payroll', icon: DollarSign, description: 'Salary setup' },
  { id: 5, title: 'Confirm', icon: CheckCircle, description: 'Review' },
];

export const ROLE_LABELS: Record<EmployeeRole, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  waiter: 'Waiter',
  billing_staff: 'Billing Staff',
  kitchen_staff: 'Kitchen Staff',
  delivery_rider: 'Delivery Rider',
  other: 'Other Staff',
};

export const ROLE_COLORS: Record<EmployeeRole, string> = {
  admin: 'bg-red-500/10 text-red-500 border-red-500/20',
  manager: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  waiter: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  billing_staff: 'bg-green-500/10 text-green-500 border-green-500/20',
  kitchen_staff: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  delivery_rider: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  other: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
};

export const ROLE_DESCRIPTIONS: Record<EmployeeRole, string> = {
  admin: 'Full access to all features including settings, reports, and employee management',
  manager: 'Manage staff, view reports, handle orders and tables, limited settings access',
  waiter: 'Take orders, manage assigned tables, view menu, mark attendance',
  billing_staff: 'Generate invoices, process payments, view sales reports',
  kitchen_staff: 'View and manage kitchen orders, update order status',
  delivery_rider: 'View delivery orders, update delivery status, navigation',
  other: 'Basic access with custom permissions',
};

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const DOCUMENT_TYPES = [
  { value: 'cnic', label: 'CNIC / National ID' },
  { value: 'passport', label: 'Passport' },
  { value: 'driving_license', label: 'Driving License' },
  { value: 'education', label: 'Education Certificate' },
  { value: 'experience', label: 'Experience Letter' },
  { value: 'medical', label: 'Medical Certificate' },
  { value: 'police_clearance', label: 'Police Clearance' },
  { value: 'other', label: 'Other Document' },
];

// Re-export from permissions for backward compatibility
export { EXTRA_PERMISSIONS as AVAILABLE_PERMISSIONS } from '@/lib/permissions';

// =============================================
// VALIDATION
// =============================================

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePhone(phone: string): boolean {
  // Pakistani phone format or general international
  const phoneRegex = /^(\+92|0)?[0-9]{10,11}$/;
  return phoneRegex.test(phone.replace(/[\s-]/g, ''));
}

export function validateCNIC(cnic: string): boolean {
  // Pakistani CNIC format: XXXXX-XXXXXXX-X
  const cnicRegex = /^[0-9]{5}-?[0-9]{7}-?[0-9]$/;
  return cnicRegex.test(cnic.replace(/-/g, ''));
}

export function validateStep(step: number, data: EmployeeFormData): string[] {
  const errors: string[] = [];

  switch (step) {
    case 1: // Personal Details
      if (!data.full_name.trim()) {
        errors.push('Full name is required');
      } else if (data.full_name.trim().length < 3) {
        errors.push('Full name must be at least 3 characters');
      }
      
      if (!data.email.trim()) {
        errors.push('Email address is required');
      } else if (!validateEmail(data.email)) {
        errors.push('Please enter a valid email address');
      }
      
      if (!data.phone.trim()) {
        errors.push('Phone number is required');
      } else if (!validatePhone(data.phone)) {
        errors.push('Please enter a valid phone number');
      }
      
      // CNIC validation
      if (!data.cnic.trim()) {
        errors.push('CNIC number is required');
      } else if (!validateCNIC(data.cnic)) {
        errors.push('CNIC format should be XXXXX-XXXXXXX-X');
      }
      
      if (data.date_of_birth) {
        const dob = new Date(data.date_of_birth);
        const age = (Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        if (age < 18) {
          errors.push('Employee must be at least 18 years old');
        }
        if (age > 70) {
          errors.push('Please verify date of birth');
        }
      }
      break;

    case 2: // Documents
      // CNIC is already captured in personal details, so we don't require it again
      // Only check if any documents need validation (passport, other docs)
      const passportDoc = data.documents.find(doc => doc.type === 'passport');
      if (passportDoc && passportDoc.number && !passportDoc.number.trim()) {
        errors.push('Please enter passport number');
      }
      
      // Validate that 'other' type documents have a number
      const otherDocs = data.documents.filter(
        doc => !['cnic', 'passport'].includes(doc.type) && doc.type !== ''
      );
      for (const doc of otherDocs) {
        if (!doc.number.trim()) {
          const docLabel = DOCUMENT_TYPES.find(t => t.value === doc.type)?.label || doc.type;
          errors.push(`Please enter document number for ${docLabel}`);
        }
      }
      break;

    case 3: // Role & Access
      if (!data.role) {
        errors.push('Please select a role for this employee');
      }
      
      if (data.role === 'other' && data.custom_permissions.length === 0) {
        errors.push('Please select at least one permission for custom role');
      }
      break;

    case 4: // Payroll
      if (!data.base_salary || data.base_salary <= 0) {
        errors.push('Base salary must be greater than 0');
      } else if (data.base_salary < 15000) {
        errors.push('Base salary should be at least Rs. 15,000 (minimum wage)');
      }
      
      if (!data.payment_frequency) {
        errors.push('Please select a payment frequency');
      }
      
      if (!data.hired_date) {
        errors.push('Hire date is required');
      }
      
      // Validate IBAN if provided
      if (data.iban && data.iban.length > 0 && data.iban.length < 24) {
        errors.push('IBAN should be 24 characters');
      }
      break;
  }

  return errors;
}

// =============================================
// ID GENERATORS
// =============================================

export function generateEmployeeId(role: EmployeeRole): string {
  const rolePrefix: Record<EmployeeRole, string> = {
    admin: 'ADM',
    manager: 'MGR',
    waiter: 'WTR',
    billing_staff: 'BIL',
    kitchen_staff: 'KIT',
    delivery_rider: 'DLR',
    other: 'STF',
  };
  
  const prefix = rolePrefix[role] || 'EMP';
  const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  
  return `${prefix}-${timestamp}${random}`;
}

export function generateLicenseId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segments = [4, 4, 4].map(() =>
    Array.from({ length: 4 }, () => 
      chars[Math.floor(Math.random() * chars.length)]
    ).join('')
  );
  return `LIC-${segments.join('-')}`;
}

// =============================================
// FORMATTERS
// =============================================

export function formatCNIC(value: string): string {
  const numbers = value.replace(/\D/g, '').slice(0, 13);
  if (numbers.length <= 5) return numbers;
  if (numbers.length <= 12) return `${numbers.slice(0, 5)}-${numbers.slice(5)}`;
  return `${numbers.slice(0, 5)}-${numbers.slice(5, 12)}-${numbers.slice(12)}`;
}

export function formatPhone(value: string): string {
  const numbers = value.replace(/\D/g, '').slice(0, 11);
  if (numbers.length <= 4) return numbers;
  return `${numbers.slice(0, 4)} ${numbers.slice(4)}`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount).replace('PKR', 'Rs.');
}
