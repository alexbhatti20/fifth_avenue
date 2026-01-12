'use client';

import { useState, useRef } from 'react';
import { FileText, Plus, Trash2, Upload, AlertCircle, File, Image } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmployeeFormData, EmployeeDocument, DOCUMENT_TYPES, formatCNIC } from './employee-form-utils';
import { cn } from '@/lib/utils';

interface DocumentsStepProps {
  data: EmployeeFormData;
  onChange: (data: Partial<EmployeeFormData>) => void;
  errors: string[];
}

export function DocumentsStep({ data, onChange, errors }: DocumentsStepProps) {
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [fileNames, setFileNames] = useState<Record<number, string>>({});

  const addDocument = () => {
    const newDocs: EmployeeDocument[] = [
      ...data.documents,
      { type: 'other', number: '', file: null, file_url: '' }
    ];
    onChange({ documents: newDocs });
  };

  const updateDocument = (index: number, field: keyof EmployeeDocument, value: any) => {
    const newDocs = data.documents.map((doc, i) => {
      if (i !== index) return doc;
      
      // Format CNIC on input
      if (field === 'number' && doc.type === 'cnic') {
        return { ...doc, [field]: formatCNIC(value) };
      }
      return { ...doc, [field]: value };
    });
    onChange({ documents: newDocs });
  };

  const handleFileChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('File must be less than 10MB');
        return;
      }
      const url = URL.createObjectURL(file);
      // Store filename in local state for visual feedback
      setFileNames(prev => ({ ...prev, [index]: file.name }));
      updateDocument(index, 'file', file);
      updateDocument(index, 'file_url', url);
    }
  };

  const removeDocument = (index: number) => {
    if (data.documents.length <= 1) return;
    const newDocs = data.documents.filter((_, i) => i !== index);
    // Remove filename from local state
    setFileNames(prev => {
      const updated = { ...prev };
      delete updated[index];
      // Reindex remaining files
      const reindexed: Record<number, string> = {};
      Object.entries(updated).forEach(([key, value]) => {
        const oldIndex = parseInt(key);
        if (oldIndex > index) {
          reindexed[oldIndex - 1] = value;
        } else {
          reindexed[oldIndex] = value;
        }
      });
      return reindexed;
    });
    onChange({ documents: newDocs });
  };

  const getFileIcon = (file: File | null, fileName?: string) => {
    if (!file && !fileName) return <Upload className="h-5 w-5" />;
    // Check file type from File object or filename extension
    const isImage = file?.type.startsWith('image/') || 
                    fileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    if (isImage) return <Image className="h-5 w-5 text-green-500" />;
    return <File className="h-5 w-5 text-blue-500" />;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Documents & Identification
        </h2>
        <p className="text-muted-foreground mt-1">
          Upload employee identification and relevant documents
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

      {/* Info */}
      <Alert>
        <FileText className="h-4 w-4" />
        <AlertDescription>
          CNIC is already captured in personal details. You can add additional documents like 
          passport, driving license, education certificates, or experience letters here.
        </AlertDescription>
      </Alert>

      {/* Document Cards */}
      <div className="space-y-4">
        {data.documents.map((doc, index) => (
          <Card key={index} className={cn(
            'transition-all',
            doc.type === 'cnic' || doc.type === 'passport' 
              ? 'border-primary/50 bg-primary/5' 
              : ''
          )}>
            <CardContent className="pt-4">
              <div className="flex items-start gap-4">
                {/* Document Number Badge */}
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <span className="text-sm font-medium">{index + 1}</span>
                </div>
                
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Document Type */}
                  <div className="space-y-2">
                    <Label>Document Type</Label>
                    <Select
                      value={doc.type}
                      onValueChange={(value) => updateDocument(index, 'type', value)}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DOCUMENT_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {(doc.type === 'cnic' || doc.type === 'passport') && (
                      <Badge variant="secondary" className="mt-1">
                        Required
                      </Badge>
                    )}
                  </div>

                  {/* Document Number - only show for non-CNIC documents */}
                  {doc.type !== 'cnic' && (
                    <div className="space-y-2">
                      <Label>Document Number {doc.type !== 'cnic' && doc.type !== '' && <span className="text-destructive">*</span>}</Label>
                      <Input
                        value={doc.number}
                        onChange={(e) => updateDocument(index, 'number', e.target.value)}
                        placeholder={
                          doc.type === 'passport' 
                            ? 'Enter passport number' 
                            : 'Enter document number'
                        }
                        className="h-11"
                      />
                    </div>
                  )}
                  
                  {/* Show message for CNIC type */}
                  {doc.type === 'cnic' && (
                    <div className="space-y-2">
                      <Label>Document Number</Label>
                      <div className="h-11 flex items-center px-3 bg-muted rounded-md text-muted-foreground text-sm">
                        CNIC captured in Personal Details
                      </div>
                    </div>
                  )}

                  {/* File Upload */}
                  <div className="space-y-2">
                    <Label>Upload Scan/Photo</Label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRefs.current[index]?.click()}
                        className={cn(
                          'flex-1 h-11 border-2 border-dashed rounded-md flex items-center gap-2 px-3 transition-colors overflow-hidden',
                          (doc.file || fileNames[index])
                            ? 'border-green-500 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300' 
                            : 'border-muted-foreground/25 hover:border-primary hover:bg-muted/50 justify-center'
                        )}
                      >
                        <div className="shrink-0">
                          {getFileIcon(doc.file, fileNames[index])}
                        </div>
                        <span className={cn(
                          "text-sm truncate min-w-0",
                          (doc.file || fileNames[index]) ? "font-medium" : "text-muted-foreground"
                        )}>
                          {doc.file?.name || fileNames[index] || 'Choose file'}
                        </span>
                        {(doc.file || fileNames[index]) && (
                          <Badge variant="secondary" className="ml-auto shrink-0 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs">
                            ✓
                          </Badge>
                        )}
                      </button>
                      <input
                        ref={(el) => { fileInputRefs.current[index] = el; }}
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => handleFileChange(index, e)}
                        className="sr-only"
                      />
                      {data.documents.length > 1 && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="shrink-0"
                          onClick={() => removeDocument(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Max 10MB (JPG, PNG, PDF)
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Document Button */}
      <Button
        type="button"
        variant="outline"
        onClick={addDocument}
        className="w-full h-12 border-dashed"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Another Document
      </Button>
    </div>
  );
}
