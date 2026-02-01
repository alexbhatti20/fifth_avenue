import { PortalProvider } from '@/components/portal/PortalProvider';
import { NetworkStatusProvider } from '@/components/ui/network-error-handler';
import { CartProvider } from '@/context/CartContext';

export const metadata = {
  title: 'Portal - ZOIRO Broast',
  description: 'Staff portal for ZOIRO Broast restaurant management',
};

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      <NetworkStatusProvider>
        <PortalProvider>{children}</PortalProvider>
      </NetworkStatusProvider>
    </CartProvider>
  );
}
