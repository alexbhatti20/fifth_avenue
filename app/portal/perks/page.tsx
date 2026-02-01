import { getPerksSettingsServer, getCustomersLoyaltyServer, getCustomerPromoCodesServer } from '@/lib/server-queries';
import PerksClient from './PerksClient';

// Server Component - Fetches data on the server (hidden from Network tab)
export default async function PerksPage() {
  // Fetch all perks data on the server
  const [settings, customers, promos] = await Promise.all([
    getPerksSettingsServer(),
    getCustomersLoyaltyServer(100),
    getCustomerPromoCodesServer(100, 0),
  ]);

  // Transform the data to match the expected format in the client
  const formattedCustomers = Array.isArray(customers) ? customers.map((c: any) => ({
    customer_id: c.customer_id || c.id,
    customer_name: c.customer_name || c.name || '',
    customer_email: c.customer_email || c.email || '',
    customer_phone: c.customer_phone || c.phone || '',
    total_points_earned: c.total_points_earned || 0,
    total_points_redeemed: c.total_points_redeemed || 0,
    current_balance: c.current_balance || c.points || 0,
    total_transactions: c.total_transactions || c.total_orders || 0,
    first_transaction: c.first_transaction || null,
    last_transaction: c.last_transaction || null,
    active_promos: c.active_promos || 0,
    total_points: c.total_points || c.points || 0,
    tier: c.tier || 'bronze',
    member_since: c.member_since || null,
  })) : [];

  const formattedPromos = Array.isArray(promos) ? promos.map((p: any) => ({
    id: p.id,
    customer_id: p.customer_id,
    customer_name: p.customer_name || 'Unknown',
    customer_email: p.customer_email || '',
    code: p.code,
    promo_type: p.promo_type || p.discount_type || 'percentage',
    value: p.value || p.discount_value || 0,
    max_discount: p.max_discount || null,
    awarded_reason: p.awarded_reason || p.name || 'Loyalty Reward',
    is_active: p.is_active || false,
    is_used: p.is_used || p.used_count > 0,
    used_at: p.used_at || null,
    expires_at: p.expires_at || '',
    created_at: p.created_at || '',
  })) : [];

  return (
    <PerksClient
      initialSettings={settings}
      initialCustomers={formattedCustomers}
      initialPromos={formattedPromos}
    />
  );
}
