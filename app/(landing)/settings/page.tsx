import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/jwt';
import { createAuthenticatedClient } from '@/lib/supabase';
import SettingsClient from './SettingsClient';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token) {
    redirect('/auth?redirect=/settings');
  }

  const decoded = await verifyToken(token);
  if (!decoded || decoded.userType !== 'customer') {
    redirect('/auth?redirect=/settings');
  }

  const supabase = createAuthenticatedClient(token);
  
  // Use RPC to get customer (bypasses RLS issues)
  const { data: customers } = await supabase.rpc('get_customer_by_auth_id', {
    p_auth_user_id: decoded.authUserId
  });
  
  const customer = customers && customers.length > 0 ? customers[0] : null;

  if (!customer) {
    redirect('/auth?redirect=/settings');
  }

  const defaultPrefs = {
    order_updates: true,
    promotional_offers: true,
    loyalty_rewards: true,
    new_menu_items: false,
    push_notifications: false,
    email_notifications: true,
    sms_notifications: false,
  };

  const notificationPreferences = {
    ...defaultPrefs,
    ...(customer.notification_preferences || {}),
  };

  return (
    <SettingsClient
      customer={{
        id: customer.id,
        name: customer.name || '',
        email: customer.email,
        phone: customer.phone || '',
        address: customer.address || '',
        is_2fa_enabled: customer.is_2fa_enabled || false,
        created_at: customer.created_at,
      }}
      notificationPreferences={notificationPreferences}
    />
  );
}
