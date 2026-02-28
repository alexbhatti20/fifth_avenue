// =============================================
// ZOIRO BROAST HUB - BACKUP GENERATE API ROUTE
// Generates full SQL INSERT or JSON backup of selected tables
// Admin / Manager access only
// =============================================

import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedClient } from '@/lib/supabase';

// ── helpers ─────────────────────────────────────────────────────────────────

function escapeSqlVal(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean')          return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number')           return isFinite(val) ? String(val) : 'NULL';
  if (typeof val === 'object')           return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  const str = String(val);
  // Detect timestamps / dates – keep them as string literals
  return `'${str.replace(/'/g, "''")}'`;
}

function tableToSQL(
  tableName: string,
  rows: Record<string, unknown>[],
  opts: { truncate: boolean; onConflict: 'nothing' | 'update'; pkCols: string[] },
): string {
  if (rows.length === 0) {
    return `-- Table "${tableName}" is empty\n`;
  }

  const columns = Object.keys(rows[0]);
  const quotedCols = columns.map(c => `"${c}"`).join(', ');
  const lines: string[] = [];

  lines.push(`-- ── Table: ${tableName} (${rows.length} rows) ──────────────────────`);
  if (opts.truncate) {
    lines.push(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE;`);
  }

  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const valueRows = batch.map(row => {
      const vals = columns.map(col => escapeSqlVal(row[col]));
      return `  (${vals.join(', ')})`;
    });

    let stmt = `INSERT INTO "${tableName}" (${quotedCols})\nVALUES\n${valueRows.join(',\n')}`;

    if (opts.onConflict === 'nothing') {
      stmt += '\nON CONFLICT DO NOTHING';
    } else {
      // Use the real primary key columns from the DB
      const pks = opts.pkCols.filter(p => columns.includes(p));
      if (pks.length > 0) {
        const conflict = pks.map(p => `"${p}"`).join(', ');
        const updates = columns
          .filter(c => !pks.includes(c))
          .map(c => `"${c}" = EXCLUDED."${c}"`)
          .join(', ');
        stmt += updates
          ? `\nON CONFLICT (${conflict}) DO UPDATE SET ${updates}`
          : '\nON CONFLICT DO NOTHING';
      } else {
        stmt += '\nON CONFLICT DO NOTHING';
      }
    }
    lines.push(stmt + ';');
  }

  return lines.join('\n') + '\n\n';
}

// Topological sort — parent tables inserted before child tables.
// Uses a proper DFS with an in-stack set to handle cycles (self-refs, circular FKs).
function topoSort(
  tables: string[],
  fkMap: Map<string, string[]>,   // child -> [parent, ...]
): string[] {
  const set     = new Set(tables);
  const visited = new Set<string>();
  const inStack = new Set<string>();   // cycle guard
  const result: string[] = [];

  function visit(t: string) {
    if (visited.has(t)) return;
    if (inStack.has(t)) return;        // cycle — skip to avoid infinite recursion
    inStack.add(t);
    const parents = (fkMap.get(t) || []).filter(p => set.has(p) && p !== t); // exclude self-ref
    for (const p of parents) visit(p);
    inStack.delete(t);
    visited.add(t);
    result.push(t);
  }

  for (const t of tables) visit(t);
  return result;
}

// ── main route ───────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // 1 · Auth check
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authClient = createAuthenticatedClient(token);

    // Verify employee role via RPC
    let employeeRole: string | null = null;
    try {
      const tokenParts = token.split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
        const authUserId = payload.sub;
        if (authUserId) {
          const { data } = await authClient.rpc('get_employee_by_auth_user', {
            p_auth_user_id: authUserId,
          });
          const emp = (data as { success?: boolean; data?: { role?: string } })?.data;
          employeeRole = emp?.role ?? null;
        }
      }
    } catch {
      /* ignore decode errors */
    }

    if (!employeeRole || !['admin', 'manager'].includes(employeeRole)) {
      return NextResponse.json({ error: 'Forbidden – admin or manager only' }, { status: 403 });
    }

    // 2 · Parse body
    const body = await req.json() as {
      tables: string[];
      format: 'sql' | 'json';
      truncate?: boolean;
      onConflict?: 'nothing' | 'update';
      includeHeader?: boolean;
    };

    const {
      tables = [],
      format = 'sql',
      truncate = false,
      onConflict = 'nothing',
      includeHeader = true,
    } = body;

    if (!tables.length) {
      return NextResponse.json({ error: 'No tables specified' }, { status: 400 });
    }

    // 3 · Use authenticated client (RLS-respecting)
    const dataClient = authClient;

    // 4 · Fetch FK map + primary keys in parallel
    let fkMap  = new Map<string, string[]>();
    let pkMap  = new Map<string, string[]>(); // table -> [pk_col, ...]

    const [fkRes, pkRes] = await Promise.allSettled([
      dataClient.rpc('get_fk_dependency_map'),
      dataClient.rpc('get_table_primary_keys'),
    ]);

    if (fkRes.status === 'fulfilled' && !fkRes.value.error && Array.isArray(fkRes.value.data)) {
      for (const row of fkRes.value.data as Array<{ child_table: string; parent_table: string }>) {
        const parents = fkMap.get(row.child_table) || [];
        parents.push(row.parent_table);
        fkMap.set(row.child_table, parents);
      }
    }

    if (pkRes.status === 'fulfilled' && !pkRes.value.error && Array.isArray(pkRes.value.data)) {
      for (const row of pkRes.value.data as Array<{ table_name: string; pk_columns: string[] }>) {
        pkMap.set(row.table_name, row.pk_columns ?? []);
      }
    }

    // Sort tables respecting FK dependencies (cycle-safe)
    const sortedTables = topoSort(tables, fkMap);

    // 5 · Fetch data from each table
    const timestamp = new Date().toISOString();
    const allData: Record<string, unknown[]> = {};
    const errors: string[] = [];

    for (const tableName of sortedTables) {
      try {
        // Fetch via SECURITY DEFINER RPC — bypasses RLS so all tables are readable
        let allRows: Record<string, unknown>[] = [];
        let from = 0;
        const PAGE = 1000;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { data: rpcData, error } = await dataClient.rpc('backup_read_table', {
            p_table_name: tableName,
            p_limit: PAGE,
            p_offset: from,
          });

          if (error) {
            errors.push(`${tableName}: ${error.message}`);
            break;
          }

          // backup_read_table returns jsonb — supabase-js gives us a parsed JS value.
          // Handle both direct array and PostgREST-wrapped single-element array.
          let page: Record<string, unknown>[] = [];
          if (Array.isArray(rpcData)) {
            // Sometimes PostgREST returns [{f: [...]}] for jsonb columns
            const first = rpcData[0];
            if (
              rpcData.length === 1 &&
              first !== null &&
              typeof first === 'object' &&
              !Array.isArray(first)
            ) {
              const vals = Object.values(first as Record<string, unknown>);
              if (vals.length === 1 && Array.isArray(vals[0])) {
                page = vals[0] as Record<string, unknown>[];
              } else {
                page = rpcData as Record<string, unknown>[];
              }
            } else {
              page = rpcData as Record<string, unknown>[];
            }
          } else if (rpcData !== null && typeof rpcData === 'object') {
            // Scalar object — should not happen, but guard it
            page = [];
          }

          if (page.length === 0) break;
          allRows = allRows.concat(page);
          if (page.length < PAGE) break;
          from += PAGE;
        }
        allData[tableName] = allRows;
      } catch (e) {
        errors.push(`${tableName}: ${String(e)}`);
      }
    }

    // 6 · Generate output
    const filename =
      `zoiro-backup-${timestamp.slice(0, 10)}-${Date.now()}` +
      (format === 'sql' ? '.sql' : '.json');

    if (format === 'json') {
      const output = {
        meta: {
          generated_at: timestamp,
          tables: sortedTables,
          total_records: Object.values(allData).reduce((a, b) => a + b.length, 0),
          errors,
        },
        data: allData,
      };
      return new NextResponse(JSON.stringify(output, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // SQL format
    const parts: string[] = [];

    if (includeHeader) {
      parts.push(
        `-- =============================================`,
        `-- ZOIRO BROAST HUB - DATABASE BACKUP`,
        `-- Generated: ${timestamp}`,
        `-- Tables: ${sortedTables.join(', ')}`,
        `-- Total records: ${Object.values(allData).reduce((a, b) => a + b.length, 0)}`,
        errors.length ? `-- Warnings: ${errors.join('; ')}` : '',
        `-- =============================================`,
        ``,
        `-- Disable FK checks temporarily for safe import`,
        `SET session_replication_role = 'replica';`,
        ``,
      );
    }

    for (const tableName of sortedTables) {
      const rows = allData[tableName] as Record<string, unknown>[];
      if (rows) {
        parts.push(tableToSQL(tableName, rows, {
          truncate,
          onConflict,
          pkCols: pkMap.get(tableName) ?? [],
        }));
      }
    }

    if (includeHeader) {
      parts.push(
        `-- Re-enable FK checks`,
        `SET session_replication_role = 'origin';`,
        ``,
        `-- End of backup`,
      );
    }

    const sqlOutput = parts.filter(Boolean).join('\n');

    return new NextResponse(sqlOutput, {
      status: 200,
      headers: {
        'Content-Type': 'application/sql',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Backup-Tables': sortedTables.join(','),
        'X-Backup-Records': String(
          Object.values(allData).reduce((a, b) => a + b.length, 0),
        ),
        'X-Backup-Errors': errors.length ? errors.join('; ') : '',
      },
    });
  } catch (e) {
    console.error('[backup/generate] Unexpected error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
