import { createClient } from '@/lib/supabase';

const supabase = createClient();

// Storage bucket types
export type StorageBucket = 'images' | 'avatars' | 'reviews' | 'documents';

// Folder paths within buckets
export type ImageFolder = 'menu' | 'deals' | 'categories' | 'site';
export type AvatarFolder = 'customers' | 'employees';
export type DocumentType = 'cnic' | 'passport' | 'driving_license' | 'certificate' | 'contract' | 'other';

export interface UploadResult {
  success: boolean;
  url?: string;
  path?: string;
  error?: string;
}

/**
 * Get the public URL for a storage file
 */
export function getPublicUrl(bucket: StorageBucket, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Generate a unique filename with timestamp
 */
export function generateFileName(originalName: string): string {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const extension = originalName.split('.').pop()?.toLowerCase() || 'jpg';
  return `${timestamp}_${randomStr}.${extension}`;
}

/**
 * Upload an image to the images bucket
 * @param file - File to upload
 * @param folder - Folder within images bucket (menu, deals, categories, site)
 * @returns Upload result with public URL
 */
export async function uploadImage(
  file: File,
  folder: ImageFolder
): Promise<UploadResult> {
  try {
    const fileName = generateFileName(file.name);
    const filePath = `${folder}/${fileName}`;

    const { data, error } = await supabase.storage
      .from('images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Upload error:', error);
      return { success: false, error: error.message };
    }

    const url = getPublicUrl('images', data.path);
    return { success: true, url, path: data.path };
  } catch (error: any) {
    console.error('Upload exception:', error);
    return { success: false, error: error.message || 'Upload failed' };
  }
}

/**
 * Upload a menu item image
 */
export async function uploadMenuImage(file: File): Promise<UploadResult> {
  return uploadImage(file, 'menu');
}

/**
 * Upload a deal/promo image
 */
export async function uploadDealImage(file: File): Promise<UploadResult> {
  return uploadImage(file, 'deals');
}

/**
 * Upload a category image
 */
export async function uploadCategoryImage(file: File): Promise<UploadResult> {
  return uploadImage(file, 'categories');
}

/**
 * Upload a site content image
 */
export async function uploadSiteImage(file: File): Promise<UploadResult> {
  return uploadImage(file, 'site');
}

/**
 * Upload an avatar/profile image
 * @param file - File to upload
 * @param folder - Folder within avatars bucket (customers, employees)
 * @param userId - Optional user ID for organizing files
 * @returns Upload result with public URL
 */
export async function uploadAvatar(
  file: File,
  folder: AvatarFolder,
  userId?: string
): Promise<UploadResult> {
  try {
    const fileName = generateFileName(file.name);
    const filePath = userId 
      ? `${folder}/${userId}/${fileName}`
      : `${folder}/${fileName}`;

    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true, // Allow overwriting for profile pics
      });

    if (error) {
      console.error('Avatar upload error:', error);
      return { success: false, error: error.message };
    }

    const url = getPublicUrl('avatars', data.path);
    return { success: true, url, path: data.path };
  } catch (error: any) {
    console.error('Avatar upload exception:', error);
    return { success: false, error: error.message || 'Upload failed' };
  }
}

/**
 * Upload a customer profile image
 */
export async function uploadCustomerAvatar(
  file: File,
  customerId?: string
): Promise<UploadResult> {
  return uploadAvatar(file, 'customers', customerId);
}

/**
 * Upload an employee profile image
 */
export async function uploadEmployeeAvatar(
  file: File,
  employeeId?: string
): Promise<UploadResult> {
  return uploadAvatar(file, 'employees', employeeId);
}

/**
 * Upload a review image
 * @param file - File to upload
 * @param customerId - Customer ID for organizing files
 * @returns Upload result with public URL
 */
export async function uploadReviewImage(
  file: File,
  customerId: string
): Promise<UploadResult> {
  try {
    const fileName = generateFileName(file.name);
    const filePath = `${customerId}/${fileName}`;

    const { data, error } = await supabase.storage
      .from('reviews')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Review image upload error:', error);
      return { success: false, error: error.message };
    }

    const url = getPublicUrl('reviews', data.path);
    return { success: true, url, path: data.path };
  } catch (error: any) {
    console.error('Review image upload exception:', error);
    return { success: false, error: error.message || 'Upload failed' };
  }
}

/**
 * Delete a file from storage
 * @param bucket - Storage bucket
 * @param path - File path within the bucket
 */
export async function deleteFile(
  bucket: StorageBucket,
  path: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.storage.from(bucket).remove([path]);

    if (error) {
      console.error('Delete error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Delete exception:', error);
    return { success: false, error: error.message || 'Delete failed' };
  }
}

/**
 * Delete multiple files from storage
 * @param bucket - Storage bucket
 * @param paths - Array of file paths
 */
export async function deleteFiles(
  bucket: StorageBucket,
  paths: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.storage.from(bucket).remove(paths);

    if (error) {
      console.error('Delete files error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Delete files exception:', error);
    return { success: false, error: error.message || 'Delete failed' };
  }
}

/**
 * Extract the path from a full storage URL
 * @param url - Full public URL
 * @param bucket - Storage bucket name
 */
export function extractPathFromUrl(url: string, bucket: StorageBucket): string | null {
  try {
    const pattern = new RegExp(`/storage/v1/object/public/${bucket}/(.+)$`);
    const match = url.match(pattern);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Check if a file exists in storage
 */
export async function fileExists(
  bucket: StorageBucket,
  path: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(path.split('/').slice(0, -1).join('/'), {
        search: path.split('/').pop(),
      });

    if (error) return false;
    return (data?.length || 0) > 0;
  } catch {
    return false;
  }
}

// =====================================
// EMPLOYEE DOCUMENT STORAGE FUNCTIONS
// =====================================

export interface DocumentUploadResult extends UploadResult {
  documentType?: DocumentType;
  documentNumber?: string;
}

/**
 * Upload an employee document (CNIC, passport, license, certificates, etc.)
 * @param file - File to upload
 * @param employeeId - Employee ID for organizing files
 * @param documentType - Type of document
 * @param documentNumber - Document number for reference
 * @returns Upload result with public URL and document metadata
 */
export async function uploadEmployeeDocument(
  file: File,
  employeeId: string,
  documentType: DocumentType,
  documentNumber?: string
): Promise<DocumentUploadResult> {
  try {
    const fileName = generateFileName(file.name);
    const filePath = `employees/${employeeId}/${documentType}/${fileName}`;

    const { data, error } = await supabase.storage
      .from('documents')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Document upload error:', error);
      return { success: false, error: error.message };
    }

    const url = getPublicUrl('documents', data.path);
    return { 
      success: true, 
      url, 
      path: data.path,
      documentType,
      documentNumber,
    };
  } catch (error: any) {
    console.error('Document upload exception:', error);
    return { success: false, error: error.message || 'Upload failed' };
  }
}

/**
 * Upload multiple employee documents
 * @param files - Array of files with their types and numbers
 * @param employeeId - Employee ID
 * @returns Array of upload results
 */
export async function uploadEmployeeDocuments(
  files: Array<{ file: File; type: DocumentType; number?: string }>,
  employeeId: string
): Promise<DocumentUploadResult[]> {
  const results: DocumentUploadResult[] = [];
  
  for (const { file, type, number } of files) {
    const result = await uploadEmployeeDocument(file, employeeId, type, number);
    results.push(result);
  }
  
  return results;
}

/**
 * Delete all documents for an employee
 * @param employeeId - Employee ID
 */
export async function deleteEmployeeDocuments(
  employeeId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const folderPath = `employees/${employeeId}`;
    
    // List all files in the employee's folder
    const { data: files, error: listError } = await supabase.storage
      .from('documents')
      .list(folderPath, {
        limit: 100,
        offset: 0,
      });

    if (listError) {
      console.error('List documents error:', listError);
      return { success: false, error: listError.message };
    }

    if (!files || files.length === 0) {
      return { success: true }; // No files to delete
    }

    // Get all file paths recursively
    const filePaths = await getNestedFilePaths('documents', folderPath);
    
    if (filePaths.length === 0) {
      return { success: true };
    }

    const { error: deleteError } = await supabase.storage
      .from('documents')
      .remove(filePaths);

    if (deleteError) {
      console.error('Delete documents error:', deleteError);
      return { success: false, error: deleteError.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Delete documents exception:', error);
    return { success: false, error: error.message || 'Delete failed' };
  }
}

/**
 * Get all nested file paths in a folder
 */
async function getNestedFilePaths(
  bucket: StorageBucket,
  folderPath: string
): Promise<string[]> {
  const paths: string[] = [];
  
  const { data: items, error } = await supabase.storage
    .from(bucket)
    .list(folderPath);

  if (error || !items) return paths;

  for (const item of items) {
    const itemPath = `${folderPath}/${item.name}`;
    
    if (item.id === null) {
      // It's a folder, recurse
      const nestedPaths = await getNestedFilePaths(bucket, itemPath);
      paths.push(...nestedPaths);
    } else {
      // It's a file
      paths.push(itemPath);
    }
  }

  return paths;
}

/**
 * Get all documents for an employee
 * @param employeeId - Employee ID
 * @returns Array of document metadata with URLs
 */
export async function getEmployeeDocuments(
  employeeId: string
): Promise<Array<{ type: DocumentType; url: string; path: string; name: string }>> {
  const documents: Array<{ type: DocumentType; url: string; path: string; name: string }> = [];
  const documentTypes: DocumentType[] = ['cnic', 'passport', 'driving_license', 'certificate', 'contract', 'other'];
  
  for (const type of documentTypes) {
    const folderPath = `employees/${employeeId}/${type}`;
    
    try {
      const { data: files, error } = await supabase.storage
        .from('documents')
        .list(folderPath);

      if (error || !files) continue;

      for (const file of files) {
        if (file.id) {
          const filePath = `${folderPath}/${file.name}`;
          const url = getPublicUrl('documents', filePath);
          documents.push({
            type,
            url,
            path: filePath,
            name: file.name,
          });
        }
      }
    } catch {
      continue;
    }
  }

  return documents;
}

/**
 * Upload employee photo (convenience function)
 */
export async function uploadEmployeePhoto(
  file: File,
  employeeId: string
): Promise<UploadResult> {
  return uploadAvatar(file, 'employees', employeeId);
}
