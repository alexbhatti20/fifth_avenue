import { PortalProvider } from '@/components/portal/PortalProvider';
import { NetworkStatusProvider } from '@/components/ui/network-error-handler';
import { CartProvider } from '@/context/CartContext';
import { getSSRCurrentEmployee } from '@/lib/server-queries';
import type { Employee } from '@/types/portal';

export const metadata = {
  title: 'Portal - ZOIRO Injected Broast',
  description: 'Staff portal for ZOIRO Injected Broast restaurant management',
};

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch employee data server-side - eliminates client-side API call
  const employee = await getSSRCurrentEmployee() as Employee | null;

  return (
    <CartProvider>
      <NetworkStatusProvider>
        <PortalProvider initialEmployee={employee}>{children}</PortalProvider>
      </NetworkStatusProvider>
    </CartProvider>
  );
}
