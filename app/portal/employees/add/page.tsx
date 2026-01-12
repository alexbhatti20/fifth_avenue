'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { 
  User, FileText, Shield, DollarSign, CheckCircle, 
  ChevronLeft, ChevronRight, ArrowLeft, Loader2, Copy, Mail, RotateCcw
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
  ConfirmationStep,
  SuccessStep,
  EmployeeFormData, 
  WIZARD_STEPS, 
  validateStep,
  generateEmployeeId,
  generateLicenseId 
} from '@/components/portal/employees';

const supabase = createClient();
const FORM_STORAGE_KEY = 'add_employee_form_draft';

// Default form data
const getDefaultFormData = (): EmployeeFormData => ({
  // Personal Details
  full_name: '',
  email: '',
  phone: '',
  cnic: '', // CNIC number
  address: '',
  emergency_contact: '',
  emergency_contact_name: '',
  date_of_birth: '',
  blood_group: '',
  photo_file: null,
  photo_url: '',
  
  // Documents - default to empty, CNIC is captured in personal details
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

// Helper to get access token (Supabase session or custom JWT)
async function getFreshAccessToken(): Promise<string | null> {
  // Try to get Supabase session - this will auto-refresh if needed
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session?.access_token) {
    return session.access_token;
  }
  
  // Try to refresh Supabase session
  const { data: refreshData } = await supabase.auth.refreshSession();
  if (refreshData?.session?.access_token) {
    return refreshData.session.access_token;
  }
  
  // Fallback: Check for custom JWT token (employee/admin login)
  const authToken = localStorage.getItem('auth_token');
  if (authToken) {
    return authToken;
  }
  
  return null;
}

export default function AddEmployeePage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [stepErrors, setStepErrors] = useState<Record<number, string[]>>({});
  const [generatedEmployeeId, setGeneratedEmployeeId] = useState('');
  const [generatedLicenseId, setGeneratedLicenseId] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);
  
  const [formData, setFormData] = useState<EmployeeFormData>(getDefaultFormData());

  // Load saved form data from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem(FORM_STORAGE_KEY);
    const savedStep = localStorage.getItem(FORM_STORAGE_KEY + '_step');
    
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        // Don't restore file objects (they can't be serialized)
        parsed.photo_file = null;
        if (parsed.documents) {
          parsed.documents = parsed.documents.map((doc: any) => ({
            ...doc,
            file: null,
          }));
        }
        setFormData(parsed);
        toast.info('Draft restored. Your previous data has been loaded.');
      } catch (e) {
        console.error('Failed to parse saved form data:', e);
      }
    }
    
    if (savedStep) {
      const step = parseInt(savedStep, 10);
      if (step >= 1 && step <= 5) {
        setCurrentStep(step);
      }
    }
    
    setIsLoaded(true);
  }, []);

  // Save form data to localStorage whenever it changes
  useEffect(() => {
    if (isLoaded && !isComplete) {
      // Create a serializable version (without File objects)
      const dataToSave = {
        ...formData,
        photo_file: null,
        documents: formData.documents.map(doc => ({
          ...doc,
          file: null,
        })),
      };
      localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(dataToSave));
      localStorage.setItem(FORM_STORAGE_KEY + '_step', String(currentStep));
    }
  }, [formData, currentStep, isLoaded, isComplete]);

  // Clear saved form data after successful submission
  const clearSavedDraft = () => {
    localStorage.removeItem(FORM_STORAGE_KEY);
    localStorage.removeItem(FORM_STORAGE_KEY + '_step');
  };

  const updateFormData = useCallback((data: Partial<EmployeeFormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
    // Clear errors when user updates data
    if (stepErrors[currentStep]?.length) {
      setStepErrors((prev) => ({ ...prev, [currentStep]: [] }));
    }
  }, [currentStep, stepErrors]);

  // Clear/Reset form handler
  const handleClearForm = () => {
    if (window.confirm('Are you sure you want to clear all form data? This cannot be undone.')) {
      setFormData(getDefaultFormData());
      setCurrentStep(1);
      setStepErrors({});
      setGeneratedEmployeeId('');
      setGeneratedLicenseId('');
      clearSavedDraft();
      toast.success('Form cleared');
    }
  };

  const handleValidateAndProceed = async () => {
    const errors = validateStep(currentStep, formData);
    
    if (errors.length > 0) {
      setStepErrors((prev) => ({ ...prev, [currentStep]: errors }));
      toast.error(errors[0]);
      return;
    }

    // Check for existing employee when moving from step 1 using optimized RPC
    if (currentStep === 1) {
      try {
        // Use optimized RPC to check all fields at once
        const { data: checkResult, error: checkError } = await supabase.rpc('check_employee_exists', {
          p_email: formData.email,
          p_phone: formData.phone,
          p_cnic: formData.cnic,
        });

        if (!checkError && checkResult?.exists) {
          const field = checkResult.field;
          const emp = checkResult.employee;
          
          if (field === 'email') {
            toast.error(`Employee with email "${formData.email}" already exists: ${emp?.name}`);
            setStepErrors((prev) => ({ ...prev, [currentStep]: [`Employee with this email already exists`] }));
          } else if (field === 'phone') {
            toast.error(`Employee with phone "${formData.phone}" already exists: ${emp?.name}`);
            setStepErrors((prev) => ({ ...prev, [currentStep]: [`Employee with this phone already exists`] }));
          } else if (field === 'cnic') {
            toast.error(`Employee with this CNIC already exists: ${emp?.name}`);
            setStepErrors((prev) => ({ ...prev, [currentStep]: [`Employee with this CNIC already exists`] }));
          }
          return;
        }

        // Similar name check is optional - skip if it fails (permission/RLS issue)
        // This is a nice-to-have feature, not critical for form submission
        try {
          const { data: similarName } = await supabase
            .from('employees')
            .select('id, name, email')
            .ilike('name', `%${formData.full_name.trim()}%`)
            .limit(1);

          if (similarName && similarName.length > 0) {
            const proceed = confirm(
              `An employee with a similar name already exists:\n\n` +
              `Name: ${similarName[0].name}\n` +
              `Email: ${similarName[0].email}\n\n` +
              `Do you want to continue anyway?`
            );
            if (!proceed) {
              return;
            }
          }
        } catch (nameCheckError) {
          // Silently skip name similarity check if it fails
          console.log('Name similarity check skipped:', nameCheckError);
        }
      } catch (error) {
        // If check fails, continue anyway (might be permission issue)
        console.error('Error checking existing employee:', error);
      }
    }

    if (currentStep === 4) {
      // Generate IDs before confirmation step
      setGeneratedEmployeeId(generateEmployeeId(formData.role));
      setGeneratedLicenseId(generateLicenseId());
    }
    
    setCurrentStep((prev) => Math.min(prev + 1, 6));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  // Upload file to Supabase storage
  const uploadFile = async (file: File, folder: string, accessToken: string, bucket: string = 'employee-documents'): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bucket', bucket);
      formData.append('folder', folder);
      
      const response = await fetch('/api/upload/image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('File upload failed:', error);
        return null;
      }
      
      const result = await response.json();
      return result.url || null;
    } catch (error) {
      console.error('File upload error:', error);
      return null;
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Get fresh access token (auto-refreshes if needed)
      const accessToken = await getFreshAccessToken();
      
      if (!accessToken) {
        toast.error('Session expired. Please log in again.');
        router.push('/portal/login');
        return;
      }

      // Upload files to storage first
      let photoUrl = formData.photo_url;
      const uploadedDocuments = [...formData.documents];

      // Upload profile photo if it's a blob URL (local file)
      if (formData.photo_file && formData.photo_url?.startsWith('blob:')) {
        toast.loading('Uploading profile photo...');
        const uploadedPhotoUrl = await uploadFile(formData.photo_file, 'employees', accessToken, 'avatars');
        if (uploadedPhotoUrl) {
          photoUrl = uploadedPhotoUrl;
        } else {
          toast.dismiss();
          toast.warning('Failed to upload profile photo, continuing without it');
        }
      }

      // Upload document files
      for (let i = 0; i < uploadedDocuments.length; i++) {
        const doc = uploadedDocuments[i];
        if (doc.file && doc.file_url?.startsWith('blob:')) {
          toast.loading(`Uploading document ${i + 1}...`);
          const uploadedDocUrl = await uploadFile(doc.file, `documents/${doc.type}`, accessToken, 'employee-documents');
          if (uploadedDocUrl) {
            uploadedDocuments[i] = { ...doc, file_url: uploadedDocUrl, file: null };
          } else {
            toast.dismiss();
            toast.warning(`Failed to upload document ${i + 1}, continuing without it`);
          }
        }
      }

      toast.dismiss();
      toast.loading('Creating employee...');

      // Prepare final payload with uploaded URLs (exclude File objects which can't be serialized)
      const payload = {
        ...formData,
        photo_url: photoUrl,
        photo_file: undefined, // Remove File object
        documents: uploadedDocuments.map(doc => ({
          type: doc.type,
          number: doc.number,
          file_url: doc.file_url,
          // Explicitly exclude file object - can't be JSON serialized
        })),
        employee_id: generatedEmployeeId,
        license_id: generatedLicenseId,
      };
      
      const response = await fetch('/api/admin/employees/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      
      // Handle token expired error - retry once with refreshed token
      if (response.status === 401 && result.code === 'TOKEN_EXPIRED') {
        // Force refresh and retry
        const { data: refreshData } = await supabase.auth.refreshSession();
        if (refreshData?.session?.access_token) {
          const retryResponse = await fetch('/api/admin/employees/create', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${refreshData.session.access_token}`,
            },
            body: JSON.stringify(payload),
          });
          
          const retryResult = await retryResponse.json();
          
          if (!retryResponse.ok || !retryResult.success) {
            throw new Error(retryResult.error || 'Failed to create employee');
          }
          
          // Success on retry
          clearSavedDraft();
          setIsComplete(true);
          setCurrentStep(6);
          toast.success('Employee created successfully!');
          return;
        } else {
          // Refresh failed - need to re-login
          toast.error('Session expired. Please log in again.');
          router.push('/portal/login');
          return;
        }
      }
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to create employee');
      }

      // Clear saved draft after successful creation
      clearSavedDraft();
      
      setIsComplete(true);
      setCurrentStep(6);
      toast.success('Employee created successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create employee');
    } finally {
      setIsSubmitting(false);
    }
  };

  const progress = ((currentStep - 1) / (WIZARD_STEPS.length)) * 100;

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <PersonalDetailsStep 
            data={formData} 
            onChange={updateFormData}
            errors={stepErrors[1] || []}
          />
        );
      case 2:
        return (
          <DocumentsStep 
            data={formData} 
            onChange={updateFormData}
            errors={stepErrors[2] || []}
          />
        );
      case 3:
        return (
          <RolePermissionsStep 
            data={formData} 
            onChange={updateFormData}
            errors={stepErrors[3] || []}
          />
        );
      case 4:
        return (
          <PayrollStep 
            data={formData} 
            onChange={updateFormData}
            errors={stepErrors[4] || []}
          />
        );
      case 5:
        return (
          <ConfirmationStep 
            data={formData}
            employeeId={generatedEmployeeId}
            licenseId={generatedLicenseId}
            onRegenerateEmployeeId={() => setGeneratedEmployeeId(generateEmployeeId(formData.role))}
            onRegenerateLicenseId={() => setGeneratedLicenseId(generateLicenseId())}
          />
        );
      case 6:
        return (
          <SuccessStep
            data={formData}
            employeeId={generatedEmployeeId}
            licenseId={generatedLicenseId}
            onAddAnother={() => {
              setCurrentStep(1);
              setIsComplete(false);
              setFormData(getDefaultFormData());
              setStepErrors({});
              setGeneratedEmployeeId('');
              setGeneratedLicenseId('');
              clearSavedDraft();
            }}
            onViewEmployees={() => router.push('/portal/employees')}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen pb-10">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.push('/portal/employees')}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Add New Employee</h1>
            <p className="text-muted-foreground">Complete all steps to register a new team member</p>
          </div>
        </div>
        
        {/* Clear Button */}
        {currentStep <= 5 && !isComplete && (
          <Button 
            variant="outline" 
            onClick={handleClearForm}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <RotateCcw className="h-4 w-4 mr-2" /> Clear Form
          </Button>
        )}
      </div>

      {/* Progress Bar */}
      {currentStep <= 5 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              Step {currentStep} of {WIZARD_STEPS.length}
            </span>
            <span className="text-sm text-muted-foreground">
              {Math.round(progress)}% Complete
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {/* Step Indicators */}
      {currentStep <= 5 && (
        <div className="grid grid-cols-5 gap-2 mb-8">
          {WIZARD_STEPS.map((step) => (
            <div
              key={step.id}
              className={cn(
                'flex flex-col items-center p-3 rounded-lg border-2 transition-all',
                currentStep === step.id
                  ? 'border-primary bg-primary/5'
                  : currentStep > step.id
                    ? 'border-green-500 bg-green-500/5'
                    : 'border-transparent bg-muted/50'
              )}
            >
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-colors',
                  currentStep === step.id
                    ? 'bg-primary text-primary-foreground'
                    : currentStep > step.id
                      ? 'bg-green-500 text-white'
                      : 'bg-muted text-muted-foreground'
                )}
              >
                {currentStep > step.id ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <step.icon className="h-5 w-5" />
                )}
              </div>
              <span className="text-xs font-medium text-center hidden sm:block">
                {step.title}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Step Content */}
      <Card className="mb-6">
        <CardContent className="p-6 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {renderStepContent()}
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Navigation */}
      {currentStep <= 5 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-2" /> Previous
          </Button>
          
          {currentStep < 5 ? (
            <Button onClick={handleValidateAndProceed}>
              Next Step <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" /> Create Employee
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
