import { getMenuManagementDataServer, getActiveOffers } from '@/lib/server-queries';
import OfferFormClient from './OfferFormClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Create Offer | Zoiro\'s Admin',
  description: 'Create a new special offer',
};

export default async function CreateOfferPage() {
  // Fetch data in parallel for SSR - Auth handled by portal layout/middleware
  const initialData = await getMenuManagementDataServer();
  
  return (
    <OfferFormClient 
      menuItems={initialData.items || []} 
      deals={initialData.deals || []}
      mode="create"
    />
  );
}
