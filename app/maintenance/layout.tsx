export const metadata = {
  title: 'Maintenance Mode',
  description: 'Our website is currently undergoing maintenance. We will be back soon.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function MaintenanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Don't use <html> and <body> here - they're already in root layout
  // This causes hydration mismatch
  return <>{children}</>;
}
