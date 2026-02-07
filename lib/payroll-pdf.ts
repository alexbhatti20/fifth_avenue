// =============================================
// PAYROLL PDF GENERATION - Client-side
// Uses browser print dialog for PDF download
// Renders branded salary slip in a new window
// =============================================

interface PayslipPDFData {
  // Employee
  employeeName: string;
  employeeId: string;
  employeeRole: string;
  employeeEmail?: string;
  employeePhone?: string;
  employeeAddress?: string;
  employeeHiredDate?: string;
  employeeDateOfBirth?: string;
  employeeBloodGroup?: string;
  employeeAvatarUrl?: string;
  employeeSalary?: number;
  employeeBankDetails?: Record<string, any> | null;
  // Payslip
  payslipId?: string;
  periodStart: string;
  periodEnd: string;
  baseSalary: number;
  overtimeHours: number;
  overtimeRate: number;
  bonuses: number;
  deductions: number;
  taxAmount: number;
  netSalary: number;
  status: string;
  paymentMethod?: string;
  paidAt?: string;
  notes?: string;
  createdAt: string;
  createdByName?: string;
  // Company
  companyName?: string;
  companyTagline?: string;
  companyEmail?: string;
  companyPhone?: string;
  companyAddress?: string;
  companyNtn?: string;
  companyLogoUrl?: string;
}

const formatDate = (d: string | undefined | null) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return d;
  }
};

const formatShortDate = (d: string | undefined | null) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return d;
  }
};

const formatCurrency = (n: number) => `Rs. ${(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 0 })}`;

const formatMonthYear = (start: string, end: string) => {
  try {
    const s = new Date(start);
    const e = new Date(end);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
      return `${monthNames[s.getMonth()]} ${s.getFullYear()}`;
    }
    return `${monthNames[s.getMonth()]} – ${monthNames[e.getMonth()]} ${e.getFullYear()}`;
  } catch {
    return '';
  }
};

/**
 * Convert a logo URL to a base64 data URI for reliable print/PDF embedding.
 * Falls back to original URL if fetch fails.
 */
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

export function generatePayslipHTML(data: PayslipPDFData, logoBase64?: string): string {
  const brandRed = '#C8102E';
  const brandDark = '#111827';
  const lightGray = '#f8fafc';
  const isPaid = data.status === 'paid';
  const overtimePay = data.baseSalary > 0
    ? (data.baseSalary / 30 / 8) * data.overtimeHours * data.overtimeRate
    : 0;
  const totalEarnings = data.baseSalary + overtimePay + data.bonuses;
  const totalDeductions = data.deductions + data.taxAmount;
  const payMonth = formatMonthYear(data.periodStart, data.periodEnd);

  // Use base64 logo or construct absolute URL
  const logoSrc = logoBase64 || `${typeof window !== 'undefined' ? window.location.origin : ''}${data.companyLogoUrl || '/assets/zoiro-logo.png'}`;

  const companyName = data.companyName || 'ZOIRO Injected Broast';
  const slipNumber = data.payslipId ? data.payslipId.slice(0, 8).toUpperCase() : new Date().getTime().toString(36).toUpperCase();

  // Bank details
  const bank = data.employeeBankDetails;
  const hasBankDetails = bank && (bank.bank_name || bank.account_number || bank.account_title || bank.iban || bank.branch);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payslip – ${data.employeeName} – ${payMonth}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    @page {
      size: A4;
      margin: 0;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #1f2937;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-size: 13px;
      line-height: 1.5;
    }

    .slip {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      background: #fff;
      position: relative;
      display: flex;
      flex-direction: column;
    }

    /* ====== TOP BANNER ====== */
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
      background: linear-gradient(135deg, transparent 0%, ${brandRed}15 100%);
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

    .brand {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .brand-logo {
      width: 56px;
      height: 56px;
      border-radius: 12px;
      background: rgba(255,255,255,0.1);
      padding: 6px;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.15);
    }

    .brand-logo img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .brand-text h1 {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: 1.5px;
      line-height: 1.2;
    }

    .brand-text .tagline {
      font-size: 11px;
      color: rgba(255,255,255,0.6);
      font-weight: 400;
      letter-spacing: 0.5px;
      margin-top: 2px;
    }

    .slip-meta {
      text-align: right;
    }

    .slip-title-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 3px;
      color: rgba(255,255,255,0.5);
      margin-bottom: 4px;
    }

    .slip-title {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: 2px;
      background: linear-gradient(135deg, #fff, ${brandRed});
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .slip-number {
      font-size: 10px;
      color: rgba(255,255,255,0.4);
      margin-top: 4px;
      font-family: 'Courier New', monospace;
      letter-spacing: 1px;
    }

    /* ====== MONTH + STATUS STRIP ====== */
    .month-strip {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 40px;
      background: ${lightGray};
      border-bottom: 1px solid #e2e8f0;
    }

    .month-label {
      font-size: 15px;
      font-weight: 700;
      color: ${brandDark};
    }

    .month-label .period-range {
      font-size: 11px;
      font-weight: 400;
      color: #64748b;
      margin-left: 10px;
    }

    .status-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 16px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    .status-paid {
      background: #dcfce7;
      color: #15803d;
      border: 1px solid #bbf7d0;
    }

    .status-pending {
      background: #fef9c3;
      color: #a16207;
      border: 1px solid #fde68a;
    }

    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: currentColor;
    }

    /* ====== MAIN CONTENT ====== */
    .content {
      padding: 28px 40px;
      flex: 1;
    }

    /* Employee + Company Info */
    .info-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 28px;
    }

    .info-card {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
    }

    .info-card-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      background: ${brandDark};
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
    }

    .info-card-header .icon {
      width: 16px;
      height: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
    }

    .info-card-body {
      padding: 14px 16px;
    }

    .info-card-body .emp-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid #f1f5f9;
    }

    .emp-avatar {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      background: linear-gradient(135deg, ${brandRed}, #ef4444);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 18px;
      font-weight: 800;
      flex-shrink: 0;
      overflow: hidden;
    }

    .emp-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .emp-name {
      font-size: 15px;
      font-weight: 700;
      color: ${brandDark};
      line-height: 1.2;
    }

    .emp-role {
      font-size: 11px;
      color: #64748b;
      text-transform: capitalize;
      margin-top: 1px;
    }

    .emp-id-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      background: ${brandRed}12;
      color: ${brandRed};
      font-size: 10px;
      font-weight: 700;
      font-family: 'Courier New', monospace;
      letter-spacing: 0.5px;
      margin-top: 3px;
    }

    .detail-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 5px 0;
      font-size: 12px;
    }

    .detail-row .dl {
      color: #64748b;
      font-weight: 500;
      min-width: 90px;
    }

    .detail-row .dv {
      color: ${brandDark};
      font-weight: 500;
      text-align: right;
      word-break: break-all;
    }

    .detail-divider {
      border: 0;
      border-top: 1px dashed #e2e8f0;
      margin: 6px 0;
    }

    /* ====== SALARY TABLE ====== */
    .salary-section {
      margin-bottom: 24px;
    }

    .salary-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
    }

    .salary-table thead th {
      background: ${brandDark};
      color: #fff;
      padding: 11px 18px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      text-align: left;
    }

    .salary-table thead th:nth-child(2) {
      text-align: center;
      width: 120px;
    }

    .salary-table thead th:last-child {
      text-align: right;
      width: 140px;
    }

    .salary-table tbody td {
      padding: 10px 18px;
      font-size: 12.5px;
      border-bottom: 1px solid #f1f5f9;
    }

    .salary-table tbody td:nth-child(2) {
      text-align: center;
      color: #64748b;
      font-size: 11px;
    }

    .salary-table tbody td:last-child {
      text-align: right;
      font-weight: 600;
      font-family: 'Courier New', monospace;
      font-size: 12.5px;
    }

    .row-section-header td {
      background: #f8fafc;
      font-weight: 700 !important;
      font-size: 10px !important;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #475569 !important;
      border-bottom: 1px solid #e2e8f0 !important;
      padding: 8px 18px !important;
    }

    .row-section-header td:first-child {
      position: relative;
      padding-left: 26px !important;
    }

    .row-section-header td:first-child::before {
      content: '';
      position: absolute;
      left: 18px;
      top: 50%;
      transform: translateY(-50%);
      width: 4px;
      height: 14px;
      border-radius: 2px;
    }

    .row-section-header.earnings td:first-child::before { background: #22c55e; }
    .row-section-header.deductions td:first-child::before { background: #ef4444; }

    .row-earning td:last-child { color: #16a34a; }
    .row-deduction td:last-child { color: #dc2626; }

    .row-subtotal td {
      background: #f1f5f9 !important;
      font-weight: 700 !important;
      border-top: 1px solid #cbd5e1 !important;
      border-bottom: 1px solid #cbd5e1 !important;
    }

    .row-subtotal.earnings td:last-child { color: #16a34a; }
    .row-subtotal.deductions td:last-child { color: #dc2626; }

    /* ====== NET SALARY BOX ====== */
    .net-box {
      background: linear-gradient(135deg, ${brandDark}, #1e293b);
      border-radius: 12px;
      padding: 22px 28px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      position: relative;
      overflow: hidden;
    }

    .net-box::before {
      content: '';
      position: absolute;
      right: -20px;
      top: -20px;
      width: 120px;
      height: 120px;
      border-radius: 50%;
      background: ${brandRed}15;
    }

    .net-box .net-label {
      position: relative;
      z-index: 1;
    }

    .net-box .net-label .title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: rgba(255,255,255,0.6);
      margin-bottom: 4px;
    }

    .net-box .net-label .subtitle {
      font-size: 12px;
      color: rgba(255,255,255,0.4);
    }

    .net-box .net-amount {
      font-size: 32px;
      font-weight: 900;
      color: #4ade80;
      letter-spacing: 1px;
      position: relative;
      z-index: 1;
      font-family: 'Courier New', monospace;
    }

    /* ====== PAYMENT + BANK INFO ====== */
    .payment-bank-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 24px;
    }

    .mini-card {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
    }

    .mini-card-header {
      padding: 8px 14px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #475569;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .mini-card-body {
      padding: 12px 14px;
    }

    /* ====== NOTES ====== */
    .notes-box {
      margin-bottom: 24px;
      padding: 14px 18px;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      border-left: 4px solid #f59e0b;
    }

    .notes-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #92400e;
      margin-bottom: 6px;
    }

    .notes-text {
      font-size: 12px;
      color: #78350f;
      line-height: 1.6;
    }

    /* ====== SIGNATURES ====== */
    .signatures {
      display: flex;
      justify-content: space-between;
      padding: 0 20px;
      margin-top: 20px;
    }

    .sig-block {
      text-align: center;
      width: 180px;
    }

    .sig-line {
      border-top: 1.5px solid #94a3b8;
      padding-top: 8px;
      margin-top: 55px;
      font-size: 11px;
      color: #64748b;
      font-weight: 600;
    }

    .sig-sublabel {
      font-size: 9px;
      color: #94a3b8;
      margin-top: 2px;
    }

    /* ====== BOTTOM FOOTER ====== */
    .bottom-footer {
      border-top: 2px solid #e2e8f0;
      padding: 16px 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: auto;
    }

    .footer-left {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .footer-company {
      font-size: 11px;
      font-weight: 700;
      color: ${brandDark};
    }

    .footer-details {
      font-size: 9px;
      color: #94a3b8;
      line-height: 1.6;
    }

    .footer-right {
      text-align: right;
    }

    .footer-generated {
      font-size: 9px;
      color: #94a3b8;
    }

    .footer-disclaimer {
      font-size: 8px;
      color: #cbd5e1;
      margin-top: 4px;
      max-width: 260px;
    }

    /* ====== WATERMARK ====== */
    .watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-35deg);
      font-size: 90px;
      font-weight: 900;
      color: rgba(0, 0, 0, 0.02);
      pointer-events: none;
      white-space: nowrap;
      letter-spacing: 15px;
      text-transform: uppercase;
      user-select: none;
    }

    /* ====== PRINT + SCREEN MEDIA ====== */
    @media print {
      body { background: #fff; }
      .slip {
        width: 100%;
        margin: 0;
        box-shadow: none;
        border-radius: 0;
      }
      .no-print { display: none !important; }
    }

    @media screen {
      body { background: #94a3b8; padding: 24px; }
      .slip {
        box-shadow: 0 8px 40px rgba(0,0,0,0.2);
        border-radius: 6px;
        overflow: hidden;
      }
      .toolbar {
        position: fixed;
        top: 20px;
        right: 24px;
        display: flex;
        gap: 10px;
        z-index: 1000;
      }
      .toolbar-btn {
        padding: 12px 22px;
        border: none;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        letter-spacing: 0.5px;
      }
      .toolbar-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(0,0,0,0.2);
      }
      .toolbar-btn.primary {
        background: ${brandRed};
        color: #fff;
      }
      .toolbar-btn.secondary {
        background: #fff;
        color: #334155;
      }
    }
  </style>
</head>
<body>
  <!-- Screen-only toolbar -->
  <div class="toolbar no-print">
    <button class="toolbar-btn primary" onclick="window.print()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
      Print / Save PDF
    </button>
    <button class="toolbar-btn secondary" onclick="window.close()">✕ Close</button>
  </div>

  <div class="slip">
    <div class="watermark">${companyName}</div>

    <!-- ====== TOP BANNER ====== -->
    <div class="top-banner">
      <div class="banner-content">
        <div class="brand">
          <div class="brand-logo">
            <img src="${logoSrc}" alt="${companyName}" onerror="this.parentElement.innerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:22px;font-weight:900;color:#fff\\'>Z</div>'" />
          </div>
          <div class="brand-text">
            <h1>${companyName}</h1>
            <div class="tagline">${data.companyTagline || 'Injected Broast — Saucy. Juicy. Crispy.'}</div>
          </div>
        </div>
        <div class="slip-meta">
          <div class="slip-title-label">Official Document</div>
          <div class="slip-title">PAYSLIP</div>
          <div class="slip-number">REF: ZB-${slipNumber}</div>
        </div>
      </div>
    </div>

    <!-- ====== MONTH + STATUS ====== -->
    <div class="month-strip">
      <div class="month-label">
        ${payMonth}
        <span class="period-range">${formatShortDate(data.periodStart)} — ${formatShortDate(data.periodEnd)}</span>
      </div>
      <div class="status-chip ${isPaid ? 'status-paid' : 'status-pending'}">
        <span class="status-dot"></span>
        ${isPaid ? 'Paid' : 'Pending'}
      </div>
    </div>

    <!-- ====== CONTENT ====== -->
    <div class="content">

      <!-- Employee + Company Info -->
      <div class="info-section">
        <!-- Employee Card -->
        <div class="info-card">
          <div class="info-card-header">
            <span class="icon">&#128100;</span> Employee Information
          </div>
          <div class="info-card-body">
            <div class="emp-header">
              <div class="emp-avatar">
                ${data.employeeAvatarUrl
                  ? `<img src="${data.employeeAvatarUrl}" alt="${data.employeeName}" onerror="this.parentElement.textContent='${data.employeeName?.[0] || 'E'}'" />`
                  : (data.employeeName?.[0] || 'E')
                }
              </div>
              <div>
                <div class="emp-name">${data.employeeName}</div>
                <div class="emp-role">${data.employeeRole?.replace(/_/g, ' ') || '—'}</div>
                <div class="emp-id-badge">ID: ${data.employeeId}</div>
              </div>
            </div>
            ${data.employeeEmail ? `<div class="detail-row"><span class="dl">Email</span><span class="dv">${data.employeeEmail}</span></div>` : ''}
            ${data.employeePhone ? `<div class="detail-row"><span class="dl">Phone</span><span class="dv">${data.employeePhone}</span></div>` : ''}
            ${data.employeeAddress ? `<div class="detail-row"><span class="dl">Address</span><span class="dv">${data.employeeAddress}</span></div>` : ''}
            ${data.employeeHiredDate ? `<div class="detail-row"><span class="dl">Hire Date</span><span class="dv">${formatDate(data.employeeHiredDate)}</span></div>` : ''}
            ${data.employeeDateOfBirth ? `<div class="detail-row"><span class="dl">Date of Birth</span><span class="dv">${formatDate(data.employeeDateOfBirth)}</span></div>` : ''}
            ${data.employeeBloodGroup ? `<div class="detail-row"><span class="dl">Blood Group</span><span class="dv">${data.employeeBloodGroup}</span></div>` : ''}
            ${data.employeeSalary ? `
            <hr class="detail-divider" />
            <div class="detail-row"><span class="dl">Base Salary</span><span class="dv" style="color:${brandRed};font-weight:700">${formatCurrency(data.employeeSalary)}/mo</span></div>` : ''}
          </div>
        </div>

        <!-- Company Card -->
        <div class="info-card">
          <div class="info-card-header">
            <span class="icon">&#127970;</span> Company Details
          </div>
          <div class="info-card-body">
            <div class="detail-row"><span class="dl">Company</span><span class="dv" style="font-weight:700">${companyName}</span></div>
            ${data.companyNtn ? `<div class="detail-row"><span class="dl">NTN</span><span class="dv" style="font-family:'Courier New',monospace">${data.companyNtn}</span></div>` : ''}
            ${data.companyAddress ? `<div class="detail-row"><span class="dl">Address</span><span class="dv">${data.companyAddress}</span></div>` : ''}
            ${data.companyPhone ? `<div class="detail-row"><span class="dl">Phone</span><span class="dv">${data.companyPhone}</span></div>` : ''}
            ${data.companyEmail ? `<div class="detail-row"><span class="dl">Email</span><span class="dv">${data.companyEmail}</span></div>` : ''}
            <hr class="detail-divider" />
            <div class="detail-row"><span class="dl">Issued On</span><span class="dv">${formatDate(data.createdAt)}</span></div>
            ${data.createdByName ? `<div class="detail-row"><span class="dl">Processed By</span><span class="dv">${data.createdByName}</span></div>` : ''}
            ${data.paidAt ? `<div class="detail-row"><span class="dl">Paid On</span><span class="dv" style="color:#16a34a;font-weight:600">${formatDate(data.paidAt)}</span></div>` : ''}
          </div>
        </div>
      </div>

      <!-- ====== SALARY BREAKDOWN TABLE ====== -->
      <div class="salary-section">
        <table class="salary-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Details</th>
              <th>Amount (PKR)</th>
            </tr>
          </thead>
          <tbody>
            <!-- Earnings Section -->
            <tr class="row-section-header earnings">
              <td colspan="3">Earnings</td>
            </tr>
            <tr class="row-earning">
              <td>Basic Salary</td>
              <td>Monthly</td>
              <td>${formatCurrency(data.baseSalary)}</td>
            </tr>
            ${data.overtimeHours > 0 ? `
            <tr class="row-earning">
              <td>Overtime Pay</td>
              <td>${data.overtimeHours} hrs &times; ${data.overtimeRate}x</td>
              <td>+ ${formatCurrency(overtimePay)}</td>
            </tr>` : ''}
            ${data.bonuses > 0 ? `
            <tr class="row-earning">
              <td>Bonuses &amp; Allowances</td>
              <td>Additional</td>
              <td>+ ${formatCurrency(data.bonuses)}</td>
            </tr>` : ''}
            <tr class="row-subtotal earnings">
              <td colspan="2">Gross Earnings</td>
              <td>${formatCurrency(totalEarnings)}</td>
            </tr>

            <!-- Deductions Section -->
            ${totalDeductions > 0 ? `
            <tr class="row-section-header deductions">
              <td colspan="3">Deductions</td>
            </tr>
            ${data.deductions > 0 ? `
            <tr class="row-deduction">
              <td>Deductions</td>
              <td>Statutory</td>
              <td>&minus; ${formatCurrency(data.deductions)}</td>
            </tr>` : ''}
            ${data.taxAmount > 0 ? `
            <tr class="row-deduction">
              <td>Income Tax</td>
              <td>Withholding</td>
              <td>&minus; ${formatCurrency(data.taxAmount)}</td>
            </tr>` : ''}
            <tr class="row-subtotal deductions">
              <td colspan="2">Total Deductions</td>
              <td>&minus; ${formatCurrency(totalDeductions)}</td>
            </tr>
            ` : ''}
          </tbody>
        </table>
      </div>

      <!-- ====== NET SALARY ====== -->
      <div class="net-box">
        <div class="net-label">
          <div class="title">Net Salary Payable</div>
          <div class="subtitle">After all deductions</div>
        </div>
        <div class="net-amount">${formatCurrency(data.netSalary)}</div>
      </div>

      <!-- ====== PAYMENT + BANK ====== -->
      <div class="payment-bank-grid">
        <!-- Payment Info -->
        <div class="mini-card">
          <div class="mini-card-header">&#128179; Payment Information</div>
          <div class="mini-card-body">
            <div class="detail-row"><span class="dl">Method</span><span class="dv" style="text-transform:capitalize">${(data.paymentMethod || 'Bank Transfer').replace(/_/g, ' ')}</span></div>
            <div class="detail-row"><span class="dl">Status</span><span class="dv" style="color:${isPaid ? '#16a34a' : '#d97706'};font-weight:700">${isPaid ? 'Paid' : 'Pending'}</span></div>
            ${data.paidAt ? `<div class="detail-row"><span class="dl">Date</span><span class="dv">${formatDate(data.paidAt)}</span></div>` : ''}
            <div class="detail-row"><span class="dl">Currency</span><span class="dv">PKR</span></div>
          </div>
        </div>

        <!-- Bank Details -->
        <div class="mini-card">
          <div class="mini-card-header">&#127974; Bank Details</div>
          <div class="mini-card-body">
            ${hasBankDetails ? `
              ${bank.bank_name ? `<div class="detail-row"><span class="dl">Bank</span><span class="dv">${bank.bank_name}</span></div>` : ''}
              ${bank.account_title ? `<div class="detail-row"><span class="dl">Title</span><span class="dv">${bank.account_title}</span></div>` : ''}
              ${bank.account_number ? `<div class="detail-row"><span class="dl">Account #</span><span class="dv" style="font-family:'Courier New',monospace">${'••••' + String(bank.account_number).slice(-4)}</span></div>` : ''}
              ${bank.iban ? `<div class="detail-row"><span class="dl">IBAN</span><span class="dv" style="font-family:'Courier New',monospace;font-size:10px">${bank.iban}</span></div>` : ''}
              ${bank.branch ? `<div class="detail-row"><span class="dl">Branch</span><span class="dv">${bank.branch}</span></div>` : ''}
            ` : `<div style="text-align:center;padding:10px 0;color:#94a3b8;font-size:11px">No bank details on file</div>`}
          </div>
        </div>
      </div>

      <!-- ====== NOTES ====== -->
      ${data.notes ? `
      <div class="notes-box">
        <div class="notes-title">&#128221; Remarks / Notes</div>
        <div class="notes-text">${data.notes}</div>
      </div>
      ` : ''}

      <!-- ====== SIGNATURES ====== -->
      <div class="signatures">
        <div class="sig-block">
          <div class="sig-line">Employee Signature</div>
          <div class="sig-sublabel">${data.employeeName}</div>
        </div>
        <div class="sig-block">
          <div class="sig-line">HR / Manager</div>
          <div class="sig-sublabel">${data.createdByName || companyName}</div>
        </div>
        <div class="sig-block">
          <div class="sig-line">Authorized Signatory</div>
          <div class="sig-sublabel">${companyName}</div>
        </div>
      </div>
    </div>

    <!-- ====== BOTTOM FOOTER ====== -->
    <div class="bottom-footer">
      <div class="footer-left">
        <div class="footer-company">${companyName}</div>
        <div class="footer-details">
          ${data.companyAddress || 'Main Branch'}<br/>
          ${data.companyPhone ? `Tel: ${data.companyPhone}` : ''} ${data.companyEmail ? `&bull; ${data.companyEmail}` : ''}<br/>
          ${data.companyNtn ? `NTN: ${data.companyNtn}` : ''}
        </div>
      </div>
      <div class="footer-right">
        <div class="footer-generated">
          Generated on ${new Date().toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
        <div class="footer-disclaimer">
          This is a computer-generated payslip. No signature is required for digital copies.
          For queries, contact HR at ${data.companyEmail || 'hr@zoiro.com'}
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Open payslip as a printable PDF in a new window.
 * First fetches the logo and converts to base64 for reliable rendering in print.
 */
export async function openPayslipPDF(data: PayslipPDFData): Promise<void> {
  // Pre-fetch logo as base64 for reliable PDF/print rendering
  const logoUrl = `${window.location.origin}${data.companyLogoUrl || '/assets/zoiro-logo.png'}`;
  const logoBase64 = await logoToBase64(logoUrl);

  const html = generatePayslipHTML(data, logoBase64);
  const printWindow = window.open('', '_blank', 'width=900,height=1100');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
