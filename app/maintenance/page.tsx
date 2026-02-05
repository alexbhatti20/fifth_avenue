import MaintenancePage from '@/components/custom/MaintenancePage';
import { supabase } from '@/lib/supabase';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Server component - fetches maintenance status (SSR, no client requests)
export default async function MaintenanceRoute() {
  // Get maintenance status directly from database (SSR)
  const { data: maintenanceData, error } = await supabase.rpc('get_maintenance_status');
  
  // If maintenance mode is off, redirect to home
  if (error || !maintenanceData?.is_enabled) {
    redirect('/');
  }

  return (
    <MaintenancePage
      reasonType={maintenanceData.reason_type}
      customReason={maintenanceData.custom_reason}
      title={maintenanceData.title}
      message={maintenanceData.message}
      estimatedRestoreTime={maintenanceData.estimated_restore_time}
      showTimer={maintenanceData.show_timer}
      showProgress={maintenanceData.show_progress}
      enabledAt={maintenanceData.enabled_at}
    />
  );
}
