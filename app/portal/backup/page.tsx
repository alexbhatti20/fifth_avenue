import { getSSRCurrentEmployee } from '@/lib/server-queries';
import { redirect } from 'next/navigation';
import BackupClient from './BackupClient';
import type { Employee } from '@/types/portal';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Database Backup – ZOIRO Portal',
  description: 'Create and download database backups with full foreign-key linkage',
};

export default async function BackupPage() {
  const employee = (await getSSRCurrentEmployee()) as Employee | null;

  // SSR auth guard – admin and manager only
  if (!employee) {
    redirect('/portal/login');
  }
  if (!['admin', 'manager'].includes(employee.role)) {
    redirect('/portal');
  }

  return <BackupClient employee={employee} />;
}
