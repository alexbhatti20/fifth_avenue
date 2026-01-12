'use client';

import { useState, useRef } from 'react';
import { Upload, User, Phone, Mail, MapPin, Heart, Calendar, Droplet, AlertCircle, CreditCard } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmployeeFormData, BLOOD_GROUPS, formatPhone, formatCNIC } from './employee-form-utils';

interface PersonalDetailsStepProps {
  data: EmployeeFormData;
  onChange: (data: Partial<EmployeeFormData>) => void;
  errors: string[];
}

export function PersonalDetailsStep({ data, onChange, errors }: PersonalDetailsStepProps) {
  const [photoPreview, setPhotoPreview] = useState<string | null>(data.photo_url || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Photo must be less than 5MB');
        return;
      }
      const url = URL.createObjectURL(file);
      setPhotoPreview(url);
      onChange({ photo_file: file, photo_url: url });
    }
  };

  const handlePhoneChange = (value: string) => {
    onChange({ phone: formatPhone(value) });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          Personal Information
        </h2>
        <p className="text-muted-foreground mt-1">
          Enter the employee's basic contact and personal details
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

      {/* Photo Upload */}
      <div className="flex items-center gap-6 p-4 rounded-lg bg-muted/50">
        <div className="relative">
          <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
            <AvatarImage src={photoPreview || undefined} />
            <AvatarFallback className="text-2xl bg-primary/10 text-primary">
              {data.full_name?.charAt(0)?.toUpperCase() || 'E'}
            </AvatarFallback>
          </Avatar>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center cursor-pointer hover:bg-primary/90 transition-colors shadow-md"
          >
            <Upload className="h-4 w-4 text-primary-foreground" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            className="sr-only"
          />
        </div>
        <div>
          <h3 className="font-medium">Profile Photo</h3>
          <p className="text-sm text-muted-foreground">
            Upload a professional photo (Max 5MB)
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            JPG, PNG or WebP format
          </p>
        </div>
      </div>

      {/* Form Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Full Name */}
        <div className="space-y-2">
          <Label htmlFor="full_name" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Full Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="full_name"
            value={data.full_name}
            onChange={(e) => onChange({ full_name: e.target.value })}
            placeholder="Enter full name"
            className="h-11"
          />
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email Address <span className="text-destructive">*</span>
          </Label>
          <Input
            id="email"
            type="email"
            value={data.email}
            onChange={(e) => onChange({ email: e.target.value.toLowerCase() })}
            placeholder="email@example.com"
            className="h-11"
          />
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <Label htmlFor="phone" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Phone Number <span className="text-destructive">*</span>
          </Label>
          <Input
            id="phone"
            value={data.phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            placeholder="0300 1234567"
            className="h-11"
          />
        </div>

        {/* CNIC */}
        <div className="space-y-2">
          <Label htmlFor="cnic" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            CNIC Number <span className="text-destructive">*</span>
          </Label>
          <Input
            id="cnic"
            value={data.cnic}
            onChange={(e) => onChange({ cnic: formatCNIC(e.target.value) })}
            placeholder="35201-1234567-8"
            className="h-11"
            maxLength={15}
          />
          <p className="text-xs text-muted-foreground">
            Format: XXXXX-XXXXXXX-X
          </p>
        </div>

        {/* Date of Birth */}
        <div className="space-y-2">
          <Label htmlFor="date_of_birth" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Date of Birth
          </Label>
          <Input
            id="date_of_birth"
            type="date"
            value={data.date_of_birth}
            onChange={(e) => onChange({ date_of_birth: e.target.value })}
            max={new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
            className="h-11"
          />
        </div>

        {/* Blood Group */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Droplet className="h-4 w-4" />
            Blood Group
          </Label>
          <Select
            value={data.blood_group}
            onValueChange={(value) => onChange({ blood_group: value })}
          >
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Select blood group" />
            </SelectTrigger>
            <SelectContent>
              {BLOOD_GROUPS.map((group) => (
                <SelectItem key={group} value={group}>
                  {group}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Address */}
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="address" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Residential Address
          </Label>
          <Textarea
            id="address"
            value={data.address}
            onChange={(e) => onChange({ address: e.target.value })}
            placeholder="Enter complete address"
            rows={2}
            className="resize-none"
          />
        </div>

        {/* Emergency Contact Name */}
        <div className="space-y-2">
          <Label htmlFor="emergency_contact_name" className="flex items-center gap-2">
            <Heart className="h-4 w-4" />
            Emergency Contact Name
          </Label>
          <Input
            id="emergency_contact_name"
            value={data.emergency_contact_name}
            onChange={(e) => onChange({ emergency_contact_name: e.target.value })}
            placeholder="Contact person name"
            className="h-11"
          />
        </div>

        {/* Emergency Contact Phone */}
        <div className="space-y-2">
          <Label htmlFor="emergency_contact" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Emergency Contact Phone
          </Label>
          <Input
            id="emergency_contact"
            value={data.emergency_contact}
            onChange={(e) => onChange({ emergency_contact: formatPhone(e.target.value) })}
            placeholder="0300 1234567"
            className="h-11"
          />
        </div>
      </div>
    </div>
  );
}
