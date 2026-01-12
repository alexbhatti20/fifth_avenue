'use client';

import { DollarSign, Building, CreditCard, Calendar, FileText, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmployeeFormData, formatCurrency } from './employee-form-utils';

interface PayrollStepProps {
  data: EmployeeFormData;
  onChange: (data: Partial<EmployeeFormData>) => void;
  errors: string[];
}

const PAYMENT_FREQUENCIES = [
  { value: 'weekly', label: 'Weekly', multiplier: 4 },
  { value: 'bi-weekly', label: 'Bi-Weekly', multiplier: 2 },
  { value: 'monthly', label: 'Monthly', multiplier: 1 },
];

const BANKS = [
  'HBL', 'UBL', 'MCB', 'Allied Bank', 'Meezan Bank', 
  'Bank Alfalah', 'Faysal Bank', 'JS Bank', 'Askari Bank',
  'National Bank', 'Bank of Punjab', 'Habib Metro', 'Other'
];

export function PayrollStep({ data, onChange, errors }: PayrollStepProps) {
  const getMonthlyEquivalent = () => {
    if (!data.base_salary) return 0;
    const freq = PAYMENT_FREQUENCIES.find(f => f.value === data.payment_frequency);
    return data.base_salary * (freq?.multiplier || 1);
  };

  const getAnnualSalary = () => {
    return getMonthlyEquivalent() * 12;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          Payroll Setup
        </h2>
        <p className="text-muted-foreground mt-1">
          Configure salary and bank details for payroll processing
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

      {/* Salary Section */}
      <div className="space-y-6">
        <h3 className="text-base font-medium flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Salary Details
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Base Salary */}
          <div className="space-y-2">
            <Label htmlFor="base_salary">
              Base Salary (Rs.) <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                Rs.
              </span>
              <Input
                id="base_salary"
                type="number"
                min={0}
                value={data.base_salary || ''}
                onChange={(e) => onChange({ base_salary: Number(e.target.value) })}
                placeholder="25000"
                className="h-11 pl-10"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Minimum wage: Rs. 15,000/month
            </p>
          </div>

          {/* Payment Frequency */}
          <div className="space-y-2">
            <Label>
              Payment Frequency <span className="text-destructive">*</span>
            </Label>
            <Select
              value={data.payment_frequency}
              onValueChange={(value: any) => onChange({ payment_frequency: value })}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_FREQUENCIES.map((freq) => (
                  <SelectItem key={freq.value} value={freq.value}>
                    {freq.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Hire Date */}
          <div className="space-y-2">
            <Label htmlFor="hired_date" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Hire Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="hired_date"
              type="date"
              value={data.hired_date}
              onChange={(e) => onChange({ hired_date: e.target.value })}
              className="h-11"
            />
          </div>

          {/* Tax ID */}
          <div className="space-y-2">
            <Label htmlFor="tax_id">Tax ID / NTN</Label>
            <Input
              id="tax_id"
              value={data.tax_id}
              onChange={(e) => onChange({ tax_id: e.target.value })}
              placeholder="Optional"
              className="h-11"
            />
          </div>
        </div>

        {/* Salary Summary */}
        {data.base_salary > 0 && (
          <div className="p-4 rounded-lg bg-muted/50 border">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-muted-foreground">Per Payment</p>
                <p className="text-lg font-semibold">{formatCurrency(data.base_salary)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Monthly Equivalent</p>
                <p className="text-lg font-semibold">{formatCurrency(getMonthlyEquivalent())}</p>
              </div>
              <div className="col-span-2 md:col-span-1">
                <p className="text-sm text-muted-foreground">Annual Salary</p>
                <p className="text-lg font-semibold text-primary">{formatCurrency(getAnnualSalary())}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* Bank Details Section */}
      <div className="space-y-6">
        <h3 className="text-base font-medium flex items-center gap-2">
          <Building className="h-4 w-4" />
          Bank Details <span className="text-sm font-normal text-muted-foreground">(Optional)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Bank Name */}
          <div className="space-y-2">
            <Label>Bank Name</Label>
            <Select
              value={data.bank_name}
              onValueChange={(value) => onChange({ bank_name: value })}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select bank" />
              </SelectTrigger>
              <SelectContent>
                {BANKS.map((bank) => (
                  <SelectItem key={bank} value={bank}>
                    {bank}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Account Number */}
          <div className="space-y-2">
            <Label htmlFor="account_number" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Account Number
            </Label>
            <Input
              id="account_number"
              value={data.account_number}
              onChange={(e) => onChange({ account_number: e.target.value })}
              placeholder="Enter account number"
              className="h-11"
            />
          </div>

          {/* IBAN */}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="iban">IBAN</Label>
            <Input
              id="iban"
              value={data.iban}
              onChange={(e) => onChange({ iban: e.target.value.toUpperCase() })}
              placeholder="PK00XXXX0000000000000000"
              maxLength={24}
              className="h-11 font-mono"
            />
            <p className="text-xs text-muted-foreground">
              International Bank Account Number (24 characters)
            </p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Notes Section */}
      <div className="space-y-4">
        <h3 className="text-base font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Additional Notes
        </h3>
        <Textarea
          value={data.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="Any additional notes about this employee (optional)"
          rows={3}
          className="resize-none"
        />
      </div>
    </div>
  );
}
