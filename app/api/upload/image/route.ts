import { NextRequest, NextResponse } from 'next/server';
import { supabase, createAuthenticatedClient } from '@/lib/supabase';
import { rateLimiters } from '@/lib/redis';
import { verifyToken, isEmployeeOrAdmin } from '@/lib/jwt';
import sharp from 'sharp';

// Sharp WebP conversion settings for avatars/profile images
const AVATAR_WEBP_OPTIONS = {
  maxWidth: 800,
  maxHeight: 800,
  quality: 80, // 0-100
};

// Sharp WebP conversion settings for general images
const GENERAL_WEBP_OPTIONS = {
  maxWidth: 1200,
  maxHeight: 1200,
  quality: 82,
};

/**
 * Generate a meaningful filename for the uploaded image.
 * Derives a human-readable slug from the folder path + timestamp.
 * Examples:
 *   folder = "employees/abc123"  -> "employee-profile-abc123-1709123456789.webp"
 *   folder = "customers/xyz"     -> "customer-avatar-xyz-1709123456789.webp"
 *   folder = "menu"              -> "menu-image-1709123456789.webp"
 */
function buildMeaningfulFileName(folder: string, ext: string): string {
  const timestamp = Date.now();
  const parts = folder.split('/').filter(Boolean);

  if (parts.length >= 2) {
    // e.g. employees/abc123 or customers/xyz789
    const entityType = parts[0].replace(/s$/, ''); // employees -> employee
    const entityId = parts[1].substring(0, 16);    // cap id length
    return `${entityType}-profile-${entityId}-${timestamp}.${ext}`;
  }

  if (parts.length === 1) {
    // e.g. "menu", "deals", "categories"
    const category = parts[0];
    return `${category}-image-${timestamp}.${ext}`;
  }

  return `image-${timestamp}.${ext}`;
}

// Helper to verify employee authentication
async function verifyAuth(request: NextRequest): Promise<{ valid: boolean; error?: string; status?: number; user?: any; token?: string }> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return { valid: false, error: 'Unauthorized', status: 401 };
  }

  const decoded = await verifyToken(token);
  if (!decoded) {
    return { valid: false, error: 'Invalid token', status: 401 };
  }

  return { valid: true, user: decoded, token };
}

// POST /api/upload/image - Upload image to Supabase Storage
export async function POST(request: NextRequest) {
  try {
    // Require authentication for uploads
    const auth = await verifyAuth(request);
    if (!auth.valid) {
      return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
    }

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const { success } = await rateLimiters.api.limit(ip);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const bucket = formData.get('bucket') as string || 'images';
    const folder = formData.get('folder') as string || 'general';

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type - images and documents
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff',
      'application/pdf' // Allow PDFs for documents
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, WebP, GIF, BMP, TIFF, and PDF allowed' },
        { status: 400 }
      );
    }

    // Validate file size (10MB max for documents, 8MB for images before processing)
    const maxSize = file.type === 'application/pdf' ? 10 * 1024 * 1024 : 8 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${file.type === 'application/pdf' ? '10MB' : '8MB'}` },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    let buffer: Buffer = Buffer.from(new Uint8Array(arrayBuffer));

    // ── Sharp processing: convert images to WebP + compress ──────────────────
    let finalExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
    let finalContentType = file.type;

    if (file.type !== 'application/pdf') {
      try {
        // Choose settings based on whether this is an avatar/profile upload
        const isAvatar = folder.includes('employees') || folder.includes('customers') || folder.includes('avatars');
        const opts = isAvatar ? AVATAR_WEBP_OPTIONS : GENERAL_WEBP_OPTIONS;

        const processed = await sharp(buffer)
          .resize({
            width: opts.maxWidth,
            height: opts.maxHeight,
            fit: 'inside',         // maintain aspect ratio, no cropping
            withoutEnlargement: true, // never upscale
          })
          .webp({ quality: opts.quality })
          .toBuffer();
        buffer = processed;

        finalExt = 'webp';
        finalContentType = 'image/webp';
      } catch (sharpError) {
        console.error('Sharp processing failed, uploading original:', sharpError);
        // Fall back to original file/buffer on Sharp error
        finalExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        finalContentType = file.type;
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Generate a meaningful, human-readable filename
    const fileName = `${folder}/${buildMeaningfulFileName(folder, finalExt)}`;

    // Use authenticated client for upload (required for RLS policies)
    const storageClient = auth.token ? createAuthenticatedClient(auth.token) : supabase;
    
    // Upload to Supabase Storage
    const { data, error } = await storageClient.storage
      .from(bucket)
      .upload(fileName, buffer, {
        contentType: finalContentType,
        cacheControl: '3600',
        upsert: true, // Allow overwriting
      });

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Failed to upload image' },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: publicData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return NextResponse.json({
      success: true,
      url: publicData.publicUrl,
      path: data.path,
    });
  } catch (error) {
    console.error('Upload failed:', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}

// DELETE /api/upload/image - Delete image from Supabase Storage
export async function DELETE(request: NextRequest) {
  try {
    // Require authentication for deletes - only employees can delete
    const auth = await verifyAuth(request);
    if (!auth.valid) {
      return NextResponse.json({ error: auth.error }, { status: auth.status || 401 });
    }

    // Only portal staff (employees/admins) can delete files — block customers
    if (!isEmployeeOrAdmin(auth.user)) {
      return NextResponse.json({ error: 'Unauthorized to delete files' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');
    const bucket = searchParams.get('bucket') || 'images';

    if (!path) {
      return NextResponse.json(
        { error: 'No path provided' },
        { status: 400 }
      );
    }

    const storageClient = auth.token ? createAuthenticatedClient(auth.token) : supabase;
    const { error } = await storageClient.storage
      .from(bucket)
      .remove([path]);

    if (error) {
      console.error('Delete error:', error);
      return NextResponse.json(
        { error: 'Failed to delete image' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Image deleted successfully',
    });
  } catch (error) {
    console.error('Delete failed:', error);
    return NextResponse.json(
      { error: 'Delete failed' },
      { status: 500 }
    );
  }
}

