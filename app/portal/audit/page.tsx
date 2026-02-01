import { getAuditLogsServer } from '@/lib/server-queries';
import AuditClient from './AuditClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AuditLogsPage() {
  // Fetch initial data server-side (hidden from browser Network tab)
  const logs = await getAuditLogsServer({ limit: 100 });

  // Pass server data directly since AuditClient now accepts AuditLogServer[]
  return <AuditClient initialLogs={logs} />;
}
