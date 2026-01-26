import { PortalProvider } from '@/components/portal/PortalProvider';

export const metadata = {
  title: 'Portal - ZOIRO Broast',
  description: 'Staff portal for ZOIRO Broast restaurant management',
};

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PortalProvider>{children}</PortalProvider>;
}
