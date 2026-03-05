// =============================================
// ORDER INVOICE PDF GENERATION - Client-side
// Generates a branded A4 PDF invoice for customer orders.
// Opens in a new window → user prints / saves as PDF.
// =============================================

export interface OrderInvoiceItem {
  name: string;
  quantity: number;
  price: number;
  variant?: string;
}

export interface OrderInvoiceData {
  // Order identifiers
  order_number: string;
  order_type: string;
  status: string;
  // Timestamps
  created_at: string;
  delivered_at?: string | null;
  // Customer
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  // Items
  items: OrderInvoiceItem[];
  // Financials
  subtotal: number;
  tax?: number | null;
  delivery_fee?: number | null;
  discount?: number | null;
  total: number;
  // Payment
  payment_method?: string | null;
  payment_status?: string | null;
  transaction_id?: string | null;
  online_payment_details?: {
    method_name?: string;
    account_holder_name?: string;
    account_number?: string;
    bank_name?: string;
    [key: string]: any;
  } | null;
  // Order-specific
  table_number?: number | null;
  notes?: string | null;
  assigned_to_name?: string | null;
  waiter_name?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number | null | undefined) =>
  `Rs. ${(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 0 })}`;

const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-PK', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return d;
  }
};

const fmtDateTime = (d: string | null | undefined) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('en-PK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return d;
  }
};

const slugify = (s: string) => s.replace(/-|_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

async function logoToBase64(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

// ── HTML Generator ────────────────────────────────────────────────────────────

function buildInvoiceHTML(data: OrderInvoiceData, logoBase64: string): string {
  const brandRed = '#C8102E';
  const brandDark = '#111827';
  const lightGray = '#f8fafc';

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const logoSrc = logoBase64 || `${origin}/assets/logo.png`;

  const invoiceRef = `ZB-INV-${data.order_number}`;
  const isPaid = data.payment_status === 'paid' || data.payment_status === 'completed';
  const isOnline = data.payment_method === 'online' || !!data.transaction_id;
  const isDineIn = data.order_type === 'dine-in' || data.order_type === 'dine_in';
  const isDelivery = data.order_type === 'online';
  const orderTypeLabel = slugify(data.order_type || 'walk-in');
  const statusLabel = slugify(data.status || 'completed');

  const itemRows = (data.items || []).map((item, i) => {
    const lineTotal = (item.price || 0) * (item.quantity || 1);
    return `
      <tr class="${i % 2 === 0 ? 'row-even' : 'row-odd'}">
        <td class="td-item">
          <span class="item-name">${item.name || 'Item'}</span>
          ${item.variant ? `<span class="item-variant">${item.variant}</span>` : ''}
        </td>
        <td class="td-center">${item.quantity}</td>
        <td class="td-right">${fmt(item.price)}</td>
        <td class="td-right td-bold">${fmt(lineTotal)}</td>
      </tr>`;
  }).join('');

  const discount = data.discount || 0;
  const tax = data.tax || 0;
  const deliveryFee = data.delivery_fee || 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invoice #${data.order_number} — ZOIRO Injected Broast</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    @page { size: A4; margin: 0; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #1f2937;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-size: 13px;
      line-height: 1.5;
    }

    /* ── SLIP PAGE ── */
    .slip {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      background: #fff;
      position: relative;
      display: flex;
      flex-direction: column;
    }

    /* ── TOP BANNER ── */
    .top-banner {
      background: linear-gradient(135deg, ${brandDark} 0%, #1e293b 50%, ${brandDark} 100%);
      color: #fff;
      padding: 28px 40px 24px;
      position: relative;
      overflow: hidden;
    }
    .top-banner::before {
      content: '';
      position: absolute;
      top: 0; right: 0;
      width: 300px; height: 100%;
      background: linear-gradient(135deg, transparent 0%, ${brandRed}18 100%);
    }
    .top-banner::after {
      content: '';
      position: absolute;
      bottom: 0; left: 0; right: 0;
      height: 4px;
      background: linear-gradient(90deg, ${brandRed}, #ef4444, ${brandRed});
    }
    .banner-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: relative;
      z-index: 1;
    }
    .brand { display: flex; align-items: center; gap: 16px; }
    .brand-logo {
      width: 60px; height: 60px;
      border-radius: 14px;
      background: rgba(255,255,255,0.08);
      padding: 6px;
      border: 1px solid rgba(255,255,255,0.15);
    }
    .brand-logo img { width: 100%; height: 100%; object-fit: contain; }
    .brand-text h1 { font-size: 22px; font-weight: 800; letter-spacing: 1px; line-height: 1.2; }
    .brand-text .tagline { font-size: 11px; color: rgba(255,255,255,0.55); font-weight: 400; letter-spacing: 0.4px; margin-top: 2px; }
    .brand-text .contact { font-size: 10px; color: rgba(255,255,255,0.4); margin-top: 6px; line-height: 1.7; }
    .slip-meta { text-align: right; }
    .slip-title-label {
      font-size: 10px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 3px;
      color: rgba(255,255,255,0.45); margin-bottom: 4px;
    }
    .slip-title {
      font-size: 26px; font-weight: 900; letter-spacing: 3px;
      background: linear-gradient(135deg, #fff, ${brandRed});
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .slip-ref {
      font-size: 10px; color: rgba(255,255,255,0.35);
      margin-top: 4px; font-family: 'Courier New', monospace; letter-spacing: 1px;
    }

    /* ── ORDER TYPE + STATUS STRIP ── */
    .info-strip {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 40px;
      background: ${lightGray};
      border-bottom: 1px solid #e2e8f0;
      gap: 12px;
      flex-wrap: wrap;
    }
    .strip-left { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .chip {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 4px 12px; border-radius: 20px;
      font-size: 11px; font-weight: 700; letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .chip-type { background: #dbeafe; color: #1d4ed8; border: 1px solid #bfdbfe; }
    .chip-type.delivery { background: #ede9fe; color: #6d28d9; border-color: #ddd6fe; }
    .chip-type.dine-in { background: #dcfce7; color: #15803d; border-color: #bbf7d0; }
    .chip-type.takeaway { background: #fef9c3; color: #92400e; border-color: #fde68a; }
    .chip-status-paid { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
    .chip-status-pending { background: #fef9c3; color: #a16207; border: 1px solid #fde68a; }
    .chip-status-cancelled { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
    .dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
    .strip-date { font-size: 12px; color: #64748b; font-weight: 500; }

    /* ── CONTENT ── */
    .content { padding: 28px 40px; flex: 1; }

    /* ── INFO CARDS GRID ── */
    .info-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
      margin-bottom: 26px;
    }
    .info-card { border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
    .info-card-header {
      display: flex; align-items: center; gap: 8px;
      padding: 9px 16px;
      background: ${brandDark};
      color: #fff;
      font-size: 10px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 1.5px;
    }
    .info-card-body { padding: 14px 16px; }
    .detail-row {
      display: flex; justify-content: space-between; align-items: flex-start;
      padding: 5px 0; font-size: 12px;
    }
    .dl { color: #64748b; font-weight: 500; min-width: 95px; flex-shrink: 0; }
    .dv { color: ${brandDark}; font-weight: 500; text-align: right; word-break: break-word; max-width: 180px; }
    .dv-accent { color: ${brandRed}; font-weight: 700; }
    .dv-green { color: #15803d; font-weight: 600; }
    .detail-divider { border: 0; border-top: 1px dashed #e2e8f0; margin: 6px 0; }

    /* ── ITEMS TABLE ── */
    .items-section { margin-bottom: 24px; }
    .items-title {
      font-size: 10px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 1.5px;
      color: #475569;
      display: flex; align-items: center; gap: 8px;
      margin-bottom: 10px;
    }
    .items-title::after {
      content: ''; flex: 1; height: 1px; background: #e2e8f0;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
    }
    .items-table thead th {
      background: ${brandDark};
      color: #fff;
      padding: 11px 16px;
      font-size: 10px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 1px;
      text-align: left;
    }
    .items-table thead th.th-center { text-align: center; width: 60px; }
    .items-table thead th.th-right { text-align: right; width: 110px; }
    .row-even { background: #fff; }
    .row-odd { background: #f8fafc; }
    .td-item { padding: 10px 16px; }
    .item-name { font-size: 12.5px; font-weight: 500; color: ${brandDark}; display: block; }
    .item-variant { font-size: 10px; color: #94a3b8; margin-top: 1px; display: block; }
    .td-center { padding: 10px 8px; text-align: center; font-size: 12px; color: #64748b; border-bottom: 1px solid #f1f5f9; }
    .td-right { padding: 10px 16px; text-align: right; font-size: 12.5px; color: #334155; border-bottom: 1px solid #f1f5f9; }
    .td-bold { font-weight: 700; color: ${brandDark}; }

    /* ── TOTALS ── */
    .totals-section { margin-bottom: 24px; }
    .totals-grid {
      margin-left: auto;
      width: 100%;
      max-width: 320px;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
    }
    .totals-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 9px 18px;
      font-size: 12.5px;
      border-bottom: 1px solid #f1f5f9;
    }
    .totals-row:last-child { border-bottom: none; }
    .totals-label { color: #64748b; }
    .totals-value { font-weight: 600; color: ${brandDark}; }
    .totals-discount .totals-value { color: #16a34a; }
    .totals-grand {
      background: ${brandDark};
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 18px;
      font-size: 15px; font-weight: 800;
    }
    .totals-grand .totals-label { color: rgba(255,255,255,0.7); font-weight: 700; letter-spacing: 0.5px; }
    .totals-grand .totals-value { color: #4ade80; font-family: 'Courier New', monospace; font-size: 17px; }

    /* ── PAYMENT BOX ── */
    .payment-section { margin-bottom: 24px; }
    .payment-box {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
    }
    .payment-box-header {
      display: flex; align-items: center; gap: 8px;
      padding: 9px 16px;
      background: ${brandDark};
      color: #fff;
      font-size: 10px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 1.5px;
    }
    .payment-box-body {
      padding: 16px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .payment-box-body.single-col { grid-template-columns: 1fr; }
    .online-badge {
      grid-column: 1 / -1;
      background: linear-gradient(135deg, #6d28d9, #7c3aed);
      color: #fff;
      border-radius: 8px;
      padding: 12px 16px;
      display: flex; align-items: center; justify-content: space-between; gap: 10px;
    }
    .online-badge-label { font-size: 11px; font-weight: 700; letter-spacing: 0.5px; }
    .online-badge-txn { font-size: 10px; opacity: 0.8; margin-top: 2px; font-family: 'Courier New', monospace; }
    .online-badge-verified {
      background: rgba(255,255,255,0.15);
      border-radius: 6px;
      padding: 4px 10px;
      font-size: 10px; font-weight: 700;
      white-space: nowrap;
    }
    .paid-stamp {
      display: flex; align-items: center; justify-content: center;
      padding: 12px;
      background: #f0fdf4;
      border: 2px dashed #86efac;
      border-radius: 8px;
      font-size: 15px; font-weight: 900;
      color: #15803d;
      letter-spacing: 3px;
      text-transform: uppercase;
      transform: rotate(-2deg);
      grid-column: 1 / -1;
    }

    /* ── NOTES ── */
    .notes-box {
      margin-bottom: 22px;
      padding: 14px 18px;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      border-left: 4px solid #f59e0b;
    }
    .notes-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #92400e; margin-bottom: 5px; }
    .notes-text { font-size: 12px; color: #78350f; line-height: 1.6; }

    /* ── FOOTER ── */
    .bottom-footer {
      border-top: 2px solid #e2e8f0;
      padding: 16px 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: auto;
    }
    .footer-left { display: flex; flex-direction: column; gap: 2px; }
    .footer-company { font-size: 11px; font-weight: 700; color: ${brandDark}; }
    .footer-details { font-size: 9px; color: #94a3b8; line-height: 1.7; }
    .footer-right { text-align: right; }
    .footer-generated { font-size: 9px; color: #94a3b8; }
    .footer-legal { font-size: 8px; color: #cbd5e1; margin-top: 3px; max-width: 220px; }
    .footer-thank { font-size: 11px; font-weight: 600; color: ${brandRed}; margin-bottom: 4px; }

    /* ── WATERMARK ── */
    .watermark {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%) rotate(-35deg);
      font-size: 90px; font-weight: 900;
      color: rgba(0,0,0,0.025);
      pointer-events: none;
      white-space: nowrap;
      letter-spacing: 12px;
      text-transform: uppercase;
      user-select: none;
      z-index: 0;
    }

    /* ── TOOLBAR (screen only) ── */
    @media screen {
      body { background: #94a3b8; padding: 24px; }
      .slip {
        box-shadow: 0 8px 40px rgba(0,0,0,0.2);
        border-radius: 6px;
        overflow: hidden;
      }
      .toolbar {
        position: fixed;
        top: 20px; right: 24px;
        display: flex; gap: 10px;
        z-index: 1000;
      }
      .toolbar-btn {
        padding: 12px 22px;
        border: none; border-radius: 10px;
        font-size: 13px; font-weight: 700;
        cursor: pointer;
        display: flex; align-items: center; gap: 8px;
        transition: all 0.2s;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        letter-spacing: 0.5px;
      }
      .toolbar-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.2); }
      .toolbar-btn.primary { background: ${brandRed}; color: #fff; }
      .toolbar-btn.secondary { background: #fff; color: #334155; }
    }
    @media print {
      body { background: #fff; }
      .slip { width: 100%; margin: 0; box-shadow: none; border-radius: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <button class="toolbar-btn primary" onclick="window.print()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
      </svg>
      Print / Save as PDF
    </button>
    <button class="toolbar-btn secondary" onclick="window.close()">✕ Close</button>
  </div>

  <div class="slip">
    <div class="watermark">ZOIRO</div>

    <!-- TOP BANNER -->
    <div class="top-banner">
      <div class="banner-content">
        <div class="brand">
          <div class="brand-logo">
            <img src="${logoSrc}" alt="ZOIRO Injected Broast"
              onerror="this.parentElement.innerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:26px;font-weight:900;color:#fff\\'>Z</div>'" />
          </div>
          <div class="brand-text">
            <h1>ZOIRO Injected Broast</h1>
            <div class="tagline">Injected Broast — Saucy. Juicy. Crispy.</div>
            <div class="contact">
              Near Baba G Kulfi, Faisal Town, Vehari, Punjab 61100, Pakistan<br/>
              Tel: +92 304 629 2822 &nbsp;|&nbsp; zorobroast@gmail.com
            </div>
          </div>
        </div>
        <div class="slip-meta">
          <div class="slip-title-label">Official Document</div>
          <div class="slip-title">INVOICE</div>
          <div class="slip-ref">${invoiceRef}</div>
        </div>
      </div>
    </div>

    <!-- ORDER TYPE + STATUS STRIP -->
    <div class="info-strip">
      <div class="strip-left">
        <div class="chip chip-type ${isDelivery ? 'delivery' : isDineIn ? 'dine-in' : 'takeaway'}">
          <span class="dot"></span>${orderTypeLabel}
        </div>
        ${isDineIn && data.table_number ? `<div class="chip chip-type dine-in">Table ${data.table_number}</div>` : ''}
        <div class="chip ${isPaid ? 'chip-status-paid' : data.status === 'cancelled' ? 'chip-status-cancelled' : 'chip-status-pending'}">
          <span class="dot"></span>${statusLabel}
        </div>
      </div>
      <div class="strip-date">${fmtDateTime(data.created_at)}</div>
    </div>

    <!-- CONTENT -->
    <div class="content">

      <!-- CUSTOMER + ORDER INFO GRID -->
      <div class="info-section">

        <!-- Customer -->
        <div class="info-card">
          <div class="info-card-header">&#128100;&nbsp; Customer Information</div>
          <div class="info-card-body">
            <div class="detail-row">
              <span class="dl">Name</span>
              <span class="dv" style="font-weight:700">${data.customer_name || 'Walk-in Customer'}</span>
            </div>
            ${data.customer_phone ? `
            <div class="detail-row">
              <span class="dl">Phone</span>
              <span class="dv">${data.customer_phone}</span>
            </div>` : ''}
            ${data.customer_email ? `
            <div class="detail-row">
              <span class="dl">Email</span>
              <span class="dv">${data.customer_email}</span>
            </div>` : ''}
            ${isDelivery && data.customer_address ? `
            <hr class="detail-divider" />
            <div class="detail-row">
              <span class="dl">Delivery To</span>
              <span class="dv">${data.customer_address}</span>
            </div>` : ''}
          </div>
        </div>

        <!-- Order Details -->
        <div class="info-card">
          <div class="info-card-header">&#128221;&nbsp; Order Details</div>
          <div class="info-card-body">
            <div class="detail-row">
              <span class="dl">Order #</span>
              <span class="dv dv-accent">#${data.order_number}</span>
            </div>
            <div class="detail-row">
              <span class="dl">Order Type</span>
              <span class="dv">${orderTypeLabel}</span>
            </div>
            <div class="detail-row">
              <span class="dl">Placed On</span>
              <span class="dv">${fmtDate(data.created_at)}</span>
            </div>
            ${data.delivered_at ? `
            <div class="detail-row">
              <span class="dl">Delivered</span>
              <span class="dv dv-green">${fmtDate(data.delivered_at)}</span>
            </div>` : ''}
            ${data.assigned_to_name ? `
            <hr class="detail-divider" />
            <div class="detail-row">
              <span class="dl">Handled By</span>
              <span class="dv">${data.assigned_to_name}</span>
            </div>` : ''}
            ${data.waiter_name ? `
            <div class="detail-row">
              <span class="dl">Served By</span>
              <span class="dv" style="font-weight:600">${data.waiter_name}</span>
            </div>` : ''}
          </div>
        </div>
      </div>

      <!-- ITEMS TABLE -->
      <div class="items-section">
        <div class="items-title">Order Items</div>
        <table class="items-table">
          <thead>
            <tr>
              <th>Item</th>
              <th class="th-center">Qty</th>
              <th class="th-right">Unit Price</th>
              <th class="th-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows || `<tr><td colspan="4" style="text-align:center;padding:16px;color:#94a3b8;">No items found</td></tr>`}
          </tbody>
        </table>
      </div>

      <!-- TOTALS -->
      <div class="totals-section">
        <div class="totals-grid">
          <div class="totals-row">
            <span class="totals-label">Subtotal</span>
            <span class="totals-value">${fmt(data.subtotal)}</span>
          </div>
          ${discount > 0 ? `
          <div class="totals-row totals-discount">
            <span class="totals-label">Discount</span>
            <span class="totals-value">− ${fmt(discount)}</span>
          </div>` : ''}
          ${tax > 0 ? `
          <div class="totals-row">
            <span class="totals-label">Tax (GST)</span>
            <span class="totals-value">${fmt(tax)}</span>
          </div>` : ''}
          ${deliveryFee > 0 ? `
          <div class="totals-row">
            <span class="totals-label">Delivery Fee</span>
            <span class="totals-value">${fmt(deliveryFee)}</span>
          </div>` : ''}
          <div class="totals-grand">
            <span class="totals-label">TOTAL PAYABLE</span>
            <span class="totals-value">${fmt(data.total)}</span>
          </div>
        </div>
      </div>

      <!-- PAYMENT DETAILS -->
      <div class="payment-section">
        <div class="payment-box">
          <div class="payment-box-header">&#128179;&nbsp; Payment Details</div>
          <div class="payment-box-body${isOnline ? '' : ' single-col'}">
            ${isOnline ? `
            <div class="online-badge">
              <div>
                <div class="online-badge-label">&#127760; Online Payment${isPaid ? ' — Verified ✓' : ''}</div>
                ${data.transaction_id ? `<div class="online-badge-txn">TXN: ${data.transaction_id}</div>` : ''}
                ${data.online_payment_details?.method_name ? `<div class="online-badge-txn">via ${data.online_payment_details.method_name}</div>` : ''}
              </div>
              ${isPaid ? `<div class="online-badge-verified">✓ PAID</div>` : ''}
            </div>
            ${data.online_payment_details?.account_holder_name ? `
            <div class="detail-row" style="padding:6px 0">
              <span class="dl">Account Holder</span>
              <span class="dv">${data.online_payment_details.account_holder_name}</span>
            </div>` : ''}
            ${data.online_payment_details?.account_number ? `
            <div class="detail-row" style="padding:6px 0">
              <span class="dl">Account #</span>
              <span class="dv" style="font-family:'Courier New',monospace">${data.online_payment_details.account_number}</span>
            </div>` : ''}
            ` : `
            <div class="detail-row">
              <span class="dl">Method</span>
              <span class="dv">${slugify(data.payment_method || 'cash')}</span>
            </div>
            <div class="detail-row">
              <span class="dl">Status</span>
              <span class="dv ${isPaid ? 'dv-green' : ''}">${slugify(data.payment_status || 'paid')}</span>
            </div>
            ${isPaid ? `<div class="paid-stamp">✓ Paid</div>` : ''}
            `}
          </div>
        </div>
      </div>

      <!-- NOTES -->
      ${data.notes ? `
      <div class="notes-box">
        <div class="notes-title">&#128221; Order Notes</div>
        <div class="notes-text">${data.notes}</div>
      </div>` : ''}

    </div>

    <!-- BOTTOM FOOTER -->
    <div class="bottom-footer">
      <div class="footer-left">
        <div class="footer-thank">Thank you for choosing ZOIRO!</div>
        <div class="footer-company">ZOIRO Injected Broast</div>
        <div class="footer-details">
          Near Baba G Kulfi, Faisal Town, Vehari, Punjab 61100, Pakistan<br/>
          Tel: +92 304 629 2822 &nbsp;|&nbsp; zorobroast@gmail.com<br/>
          @zoiro_broast
        </div>
      </div>
      <div class="footer-right">
        <div class="footer-generated">Generated on ${fmtDateTime(new Date().toISOString())}</div>
        <div class="footer-legal">This is a computer-generated invoice and is valid without a physical signature. Keep this for your records.</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Opens a new browser window with a fully branded A4 PDF invoice.
 * The user can print it or use the browser's "Save as PDF" option.
 */
export async function generateOrderInvoicePDF(data: OrderInvoiceData): Promise<void> {
  let logoBase64 = '';
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    logoBase64 = await logoToBase64(`${origin}/assets/logo.png`);
  } catch {
    // fall back to empty; HTML has onerror handler
  }

  const html = buildInvoiceHTML(data, logoBase64);

  const win = window.open('', '_blank');
  if (!win) {
    // Fallback: download as .html file
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Invoice-${data.order_number}.html`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
}
