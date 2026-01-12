import { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata.loyalty();

export default function LoyaltyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
