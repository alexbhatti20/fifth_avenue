import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createAuthenticatedClient } from '@/lib/supabase';
import { sendMaintenanceNotification } from '@/lib/brevo';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Helper to get authenticated client and verify admin
async function getAuthenticatedAdminClient() {
  const cookieStore = await cookies();
  const token = cookieStore.get('sb-access-token')?.value || 
                cookieStore.get('auth_token')?.value;
  
  if (!token) {
    return { error: 'Not authenticated' };
  }
  
  let authUserId: string | null = null;
  let isAdminFromCookie = false;
  
  // Check employee_data for admin role (quick check)
  const employeeData = cookieStore.get('employee_data')?.value;
  if (employeeData) {
    try {
      const parsed = JSON.parse(decodeURIComponent(employeeData));
      if (parsed.role === 'admin') {
        isAdminFromCookie = true;
      }
    } catch (e) {
      console.error('Failed to parse employee_data:', e);
    }
  }
  
  // Decode token to get auth user ID
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      const exp = payload.exp * 1000;
      const now = Date.now();
      
      if (exp < now) {
        return { error: 'Token expired' };
      }
      
      // Get auth user ID from token's sub claim
      authUserId = payload.sub;
    }
  } catch (e) {
    console.error('Failed to decode token:', e);
    return { error: 'Invalid token format' };
  }
  
  const client = createAuthenticatedClient(token);
  
  // If admin confirmed from cookie, return client
  if (isAdminFromCookie) {
    return { client };
  }
  
  // Otherwise verify from database using auth_user_id
  if (!authUserId) {
    return { error: 'Invalid token - no user ID' };
  }
  
  try {
    // Query employees table using auth_user_id (not id)
    const { data: employee, error } = await client
      .from('employees')
      .select('id, role')
      .eq('auth_user_id', authUserId)
      .maybeSingle();
    
    if (error) {
      console.error('[Maintenance Auth] DB error:', error);
      return { error: 'Database error checking permissions' };
    }
    
    if (!employee) {
      return { error: 'Unauthorized - employee not found' };
    }
    
    if (employee.role !== 'admin') {
      return { error: `Unauthorized - admin access required (your role: ${employee.role})` };
    }
    
    return { client };
  } catch (e) {
    console.error('[Maintenance Auth] Error:', e);
    return { error: 'Failed to verify admin access' };
  }
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const body = await request.json();
        const { settings } = body;

        if (!settings) {
          console.error('[Maintenance Stream API] Missing settings');
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Missing settings' })}\n\n`));
          controller.close();
          return;
        }

        // Verify authentication and admin access
        const authResult = await getAuthenticatedAdminClient();
        if (authResult.error || !authResult.client) {
          console.error('[Maintenance Stream API] Auth failed:', authResult.error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: authResult.error || 'Authentication failed' })}\n\n`));
          controller.close();
          return;
        }

        const client = authResult.client;
        
        // Send initial status
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'fetching', progress: 0 })}\n\n`));

        // Get all users for email
        const { data: usersData, error: usersError } = await client.rpc('get_all_users_for_maintenance_email');

        if (usersError) {
          console.error('[Maintenance Stream API] RPC error:', usersError);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: usersError.message })}\n\n`));
          controller.close();
          return;
        }

        const result = usersData as any;
        
        if (!result?.success) {
          console.error('[Maintenance Stream API] RPC returned error:', result?.error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: result?.error || 'Failed to get users' })}\n\n`));
          controller.close();
          return;
        }

        const customers: Array<{email: string; name: string}> = Array.isArray(result.customers) ? result.customers : [];
        const employees: Array<{email: string; name: string}> = Array.isArray(result.employees) ? result.employees : [];
        const allRecipients = [...customers, ...employees].filter(r => r && r.email);

        if (allRecipients.length === 0) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            status: 'complete',
            progress: 100,
            sent: 0,
            failed: 0,
            total: 0,
            customerCount: customers.length,
            employeeCount: employees.length,
          })}\n\n`));
          controller.close();
          return;
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
          status: 'sending',
          progress: 5,
          sent: 0,
          failed: 0,
          total: allRecipients.length,
          customerCount: customers.length,
          employeeCount: employees.length,
        })}\n\n`));

        // Send emails one by one with progress updates
        let sent = 0;
        let failed = 0;

        for (let i = 0; i < allRecipients.length; i++) {
          const recipient = allRecipients[i];
          
          try {
            await sendMaintenanceNotification(
              recipient.email,
              recipient.name,
              {
                reasonType: settings.reason_type,
                customReason: settings.custom_reason,
                title: settings.title || 'Scheduled Maintenance',
                message: settings.message,
                estimatedRestoreTime: settings.estimated_restore_time,
              }
            );
            sent++;
          } catch (error) {
            console.error(`[Maintenance Stream API] Failed to send to ${recipient.email}:`, error);
            failed++;
          }

          // Send progress update
          const progress = Math.round(((i + 1) / allRecipients.length) * 100);
          const progressData = { 
            status: 'sending',
            progress,
            sent,
            failed,
            total: allRecipients.length,
            current: i + 1,
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(progressData)}\n\n`));

          // Small delay to prevent rate limiting
          if ((i + 1) % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        // Update database count
        try {
          await client.rpc('update_maintenance_email_sent', { p_count: sent });
        } catch (e) {
          console.error('[Maintenance Stream API] Failed to update email count:', e);
        }

        // Send completion
        const completeData = { 
          status: 'complete',
          progress: 100,
          sent,
          failed,
          total: allRecipients.length,
          customerCount: customers.length,
          employeeCount: employees.length,
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(completeData)}\n\n`));

        controller.close();
      } catch (error: any) {
        console.error('[Maintenance Stream API] Stream error:', error);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: error.message || 'Internal server error' })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// Prevent GET requests (Next.js sometimes tries to prefetch)
export async function GET() {
  return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' },
  });
}
