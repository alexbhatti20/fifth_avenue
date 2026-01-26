'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { 
  User, FileText, Shield, DollarSign, CheckCircle, 
  ChevronLeft, ChevronRight, ArrowLeft, Loader2, Save
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { SectionHeader } from '@/components/portal/PortalProvider';
import { createClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';

// Import modular step components
import { 
  PersonalDetailsStep,
  DocumentsStep,
  RolePermissionsStep,
  PayrollStep,
  EmployeeFormData, 
  WIZARD_STEPS, 
  validateStep,
} from '@/components/portal/employees';
import { getEmployeeComplete } from '@/lib/portal-queries';

const supabase = createClient();

// Default form data
const getDefaultFormData = (): EmployeeFormData => ({
  // Personal Details
  full_name: '',
  email: '',
  phone: '',
  cnic: '',
  address: '',
  emergency_contact: '',
  emergency_contact_name: '',
  date_of_birth: '',
  blood_group: '',
  photo_file: null,
  photo_url: '',
  
  // Documents
  documents: [{ type: 'other', number: '', file: null, file_url: '' }],
  
  // Role & Access
  role: 'waiter',
  custom_permissions: [],
  portal_enabled: true,
  
  // Payroll
  base_salary: 25000,
  payment_frequency: 'monthly',
  bank_name: '',
  account_number: '',
  iban: '',
  tax_id: '',
  
  // Hiring
  hired_date: new Date().toISOString().split('T')[0],
  notes: '',
});

// Helper to get access token
async function getFreshAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session?.access_token) {
    return session.access_token;
  }
  
  const { data: refreshData } = await supabase.auth.refreshSession();
  if (refreshData?.session?.access_token) {
    return refreshData.session.access_token;
  }
  
  const authToken = localStorage.getItem('auth_token');
  if (authToken) {
    return authToken;
  }
  
  return null;
}

export default function EditEmployeePage() {
  const router = useRouter();
  const params = useParams();
  const employeeId = params.id as string;
  
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stepErrors, setStepErrors] = useState<Record<number, string[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [originalData, setOriginalData] = useState<any>(null);
  
  const [formData, setFormData] = useState<EmployeeFormData>(getDefaultFormData());

  // Load employee data on mount
  useEffect(() => {
    async function loadEmployee() {
      try {
        setIsLoading(true);
        const employee = await getEmployeeComplete(employeeId);
        
        if (!employee) {
          toast.error('Employee not found');
          router.push('/portal/employees');
          return;
        }
        
        setOriginalData(employee);
        
        // Map employee data to form data
        setFormData({
          full_name: employee.name || '',
          email: employee.email || '',
          phone: employee.phone || '',
          cnic: employee.cnic || '',
          address: employee.address || '',
          emergency_contact: employee.emergency_contact || '',
          emergency_contact_name: employee.emergency_contact_name || '',
          date_of_birth: employee.date_of_birth || '',
          blood_group: employee.blood_group || '',
          photo_file: null,
          photo_url: employee.avatar_url || '',
          
          documents: employee.documents?.length > 0 
            ? employee.documents.map((doc: any) => ({
                type: doc.document_type || 'other',
                number: doc.document_name || '',
                file: null,
                file_url: doc.file_url || '',
              }))
            : [{ type: 'other', number: '', file: null, file_url: '' }],
          
          role: employee.role || 'waiter',
          custom_permissions: Object.keys(employee.permissions || {}).filter(
            k => employee.permissions[k] === true
          ),
          portal_enabled: employee.portal_enabled ?? true,
          
          base_salary: employee.salary || 25000,
          payment_frequency: employee.bank_details?.payment_frequency || 'monthly',
          bank_name: employee.bank_details?.bank_name || '',
          account_number: employee.bank_details?.account_number || '',
          iban: employee.bank_details?.iban || '',
          tax_id: employee.bank_details?.tax_id || '',
          
          hired_date: employee.hired_date || new Date().toISOString().split('T')[0],
          notes: employee.notes || '',
        });
        
      } catch (error) {
        toast.error('Failed to load employee data');
        router.push('/portal/employees');
      } finally {
        setIsLoading(false);
      }
    }
    
    if (employeeId) {
      loadEmployee();
    }
  }, [employeeId, router]);

  const handleDataChange = useCallback((data: Partial<EmployeeFormData>) => {
    setFormData(prev => ({ ...prev, ...data }));
    // Clear errors for current step when data changes
    setStepErrors(prev => ({ ...prev, [currentStep]: [] }));
  }, [currentStep]);

  const validateCurrentStep = useCallback(() => {
    const errors = validateStep(currentStep, formData);
    setStepErrors(prev => ({ ...prev, [currentStep]: errors }));
    return errors.length === 0;
  }, [currentStep, formData]);

  const handleNext = () => {
    if (validateCurrentStep()) {
      if (currentStep < 4) {
        setCurrentStep(prev => prev + 1);
      }
    } else {
      toast.error('Please fix the errors before continuing');
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  // Upload file to Supabase storage
  const uploadFile = async (file: File, folder: string, accessToken: string, bucket: string = 'employee-documents'): Promise<string | null> => {
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('bucket', bucket);
      uploadFormData.append('folder', folder);
      
      const response = await fetch('/api/upload/image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: uploadFormData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        return null;
      }
      
      const result = await response.json();
      return result.url || null;
    } catch (error) {
      return null;
    }
  };

  const handleSave = async () => {
    // Validate all steps
    let hasErrors = false;
    const allErrors: Record<number, string[]> = {};
    
    for (let step = 1; step <= 4; step++) {
      const errors = validateStep(step, formData);
      if (errors.length > 0) {
        allErrors[step] = errors;
        hasErrors = true;
      }
    }
    
    setStepErrors(allErrors);
    
    if (hasErrors) {
      const firstErrorStep = Object.keys(allErrors).map(Number).sort((a, b) => a - b)[0];
      setCurrentStep(firstErrorStep);
      toast.error('Please fix errors in all steps before saving');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const accessToken = await getFreshAccessToken();
      
      if (!accessToken) {
        toast.error('Authentication failed. Please log in again.');
        router.push('/auth');
        return;
      }

      // Upload avatar if it's a blob URL (new file selected)
      let photoUrl = formData.photo_url;
      if (formData.photo_file && formData.photo_url?.startsWith('blob:')) {
        toast.loading('Uploading profile photo...');
        const uploadedPhotoUrl = await uploadFile(formData.photo_file, 'employees', accessToken, 'avatars');
        if (uploadedPhotoUrl) {
          photoUrl = uploadedPhotoUrl;
        } else {
          toast.dismiss();
          toast.warning('Failed to upload profile photo, continuing without it');
        }
        toast.dismiss();
      }

      // Build permissions object from custom permissions
      const permissions: Record<string, boolean> = {};
      formData.custom_permissions.forEach(perm => {
        permissions[perm] = true;
      });

      // Prepare update payload
      const updatePayload = {
        id: employeeId,
        name: formData.full_name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        cnic: formData.cnic.replace(/-/g, ''),
        address: formData.address.trim() || null,
        emergency_contact: formData.emergency_contact.trim() || null,
        emergency_contact_name: formData.emergency_contact_name.trim() || null,
        date_of_birth: formData.date_of_birth || null,
        blood_group: formData.blood_group || null,
        avatar_url: photoUrl || null,
        role: formData.role,
        status: originalData?.status || 'active',
        permissions,
        portal_enabled: formData.portal_enabled,
        salary: formData.base_salary,
        hired_date: formData.hired_date,
        notes: formData.notes.trim() || null,
        bank_details: {
          bank_name: formData.bank_name.trim() || null,
          account_number: formData.account_number.trim() || null,
          iban: formData.iban.trim() || null,
          tax_id: formData.tax_id.trim() || null,
          payment_frequency: formData.payment_frequency,
        },
      };

      const response = await fetch(`/api/admin/employees/${employeeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update employee');
      }

      toast.success('Employee updated successfully!');
      router.push(`/portal/employees/${employeeId}`);
      
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update employee');
    } finally {
      setIsSubmitting(false);
    }
  };

  const progress = (currentStep / 4) * 100;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground mt-2">Loading employee data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/portal/employees/${employeeId}`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <SectionHeader
            title={`Edit Employee: ${formData.full_name || 'Loading...'}`}
            description="Update employee information and permissions"
          />
        </div>
      </div>

      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">
            Step {currentStep} of 4
          </span>
          <span className="text-sm font-medium">{Math.round(progress)}% Complete</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Steps indicator */}
      <div className="flex justify-between mb-8 px-4">
        {WIZARD_STEPS.slice(0, 4).map((step) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;
          const hasError = stepErrors[step.id]?.length > 0;
          
          return (
            <button
              key={step.id}
              onClick={() => setCurrentStep(step.id)}
              className={cn(
                'flex flex-col items-center gap-2 transition-all',
                isActive && 'scale-105',
              )}
            >
              <div
                className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center transition-all',
                  isActive && 'bg-primary text-primary-foreground shadow-lg',
                  isCompleted && !isActive && 'bg-green-500 text-white',
                  hasError && 'bg-destructive text-destructive-foreground',
                  !isActive && !isCompleted && !hasError && 'bg-muted',
                )}
              >
                {isCompleted && !isActive ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>
              <div className="text-center">
                <p className={cn(
                  'text-sm font-medium',
                  isActive && 'text-primary',
                  hasError && 'text-destructive',
                )}>
                  {step.title}
                </p>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  {step.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {currentStep === 1 && (
                <PersonalDetailsStep
                  data={formData}
                  onChange={handleDataChange}
                  errors={stepErrors[1] || []}
                />
              )}
              {currentStep === 2 && (
                <DocumentsStep
                  data={formData}
                  onChange={handleDataChange}
                  errors={stepErrors[2] || []}
                />
              )}
              {currentStep === 3 && (
                <RolePermissionsStep
                  data={formData}
                  onChange={handleDataChange}
                  errors={stepErrors[3] || []}
                />
              )}
              {currentStep === 4 && (
                <PayrollStep
                  data={formData}
                  onChange={handleDataChange}
                  errors={stepErrors[4] || []}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <Button
          variant="outline"
          onClick={handlePrev}
          disabled={currentStep === 1}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/portal/employees/${employeeId}`)}
          >
            Cancel
          </Button>
          
          {currentStep < 4 ? (
            <Button onClick={handleNext}>
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button 
              onClick={handleSave}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
