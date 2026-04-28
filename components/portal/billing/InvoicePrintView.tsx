'use client';

import { forwardRef, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Receipt,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { InvoiceDetails, BrandInfo } from './types';

// ==========================================
// DEFAULT BRAND INFO
// ==========================================

const DEFAULT_BRAND: BrandInfo = {
  name: 'FIFTH AVENUE',
  logo_url: '/assets/fifth_avenue_urban_logo_1777394607150.png',
  address: 'Main Boulevard, Phase 6, DHA, Lahore, Pakistan',
  phone: '+92 321 5550199',
  email: 'hub@fifthavenue.com',
  website: 'www.fifthavenue.com',
  tagline: 'URBAN STREET HUB - BOLD. INDUSTRIAL. TACTILE.',
  ntn: '7654321-0',
  strn: '98-76-5432-109-87',
  gstn: 'PK987654321',
  footer_text: 'THANK YOU FOR VISITING FIFTH AVENUE. STAY BOLD.',
  social: {
    facebook: 'FifthAvenueUrban',
    instagram: 'fifth_avenue_hub',
  },
};

// ==========================================
// INVOICE PRINT VIEW COMPONENT
// ==========================================

interface InvoicePrintViewProps {
  invoice: InvoiceDetails;
  brand?: Partial<BrandInfo>;
  className?: string;
  onPrint?: () => void;
}

export const InvoicePrintView = forwardRef<HTMLDivElement, InvoicePrintViewProps>(
  ({ invoice, brand: customBrand, className, onPrint }, ref) => {
    const printRef = useRef<HTMLDivElement>(null);
    const brand = { ...DEFAULT_BRAND, ...customBrand };

    // Helper to partially hide email
    const maskEmail = (email: string | undefined | null): string => {
      if (!email) return '';
      const [localPart, domain] = email.split('@');
      if (!domain) return email;
      const visible = localPart.slice(0, 3);
      return `${visible}***@${domain}`;
    };

    // Helper to partially hide phone
    const maskPhone = (phone: string | undefined | null): string => {
      if (!phone) return '';
      if (phone.length <= 6) return phone;
      return phone.slice(0, -4) + '****';
    };

    const handlePrint = () => {
      if (onPrint) {
        onPrint();
        return;
      }

      const printContent = printRef.current;
      if (!printContent) return;

      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Invoice #${invoice.invoice_number}</title>
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              body {
                font-family: 'Courier New', monospace;
                font-size: 11px;
                width: 58mm;
                max-width: 58mm;
                margin: 0 auto;
                padding: 2mm;
              }
              .header {
                text-align: center;
                margin-bottom: 8px;
              }
              .logo {
                max-width: 50px;
                margin-bottom: 4px;
              }
              .brand-name {
                font-size: 14px;
                font-weight: bold;
              }
              .tagline {
                font-size: 9px;
                color: #666;
              }
              .contact-info {
                font-size: 9px;
                color: #333;
                margin-top: 4px;
              }
              .divider {
                border-top: 1px dashed #000;
                margin: 6px 0;
              }
              .invoice-info {
                display: flex;
                justify-content: space-between;
                font-size: 10px;
                margin-bottom: 6px;
              }
              .customer-info {
                font-size: 10px;
                margin-bottom: 6px;
                padding: 4px 0;
              }
              .customer-name {
                font-weight: bold;
                font-size: 11px;
              }
              .customer-details {
                font-size: 9px;
              }
              .staff-info {
                font-size: 9px;
                color: #666;
                margin-bottom: 6px;
              }
              .items-header {
                font-weight: bold;
                font-size: 10px;
                padding: 4px 0;
                border-bottom: 1px solid #000;
                display: flex;
              }
              .items-header span:first-child {
                flex: 1;
              }
              .item {
                display: flex;
                align-items: flex-start;
                padding: 3px 0;
                font-size: 10px;
                border-bottom: 1px dotted #999;
              }
              .item-name {
                flex: 1;
              }
              .item-variant {
                font-size: 8px;
                color: #666;
              }
              .item-qty {
                width: 25px;
                text-align: center;
              }
              .item-price {
                width: 50px;
                text-align: right;
                font-weight: bold;
              }
              .totals {
                margin-top: 6px;
              }
              .total-row {
                display: flex;
                justify-content: space-between;
                font-size: 10px;
                padding: 2px 0;
              }
              .total-row.discount {
                color: #000;
              }
              .grand-total {
                font-size: 14px;
                font-weight: bold;
                margin-top: 6px;
                padding-top: 6px;
                border-top: 2px solid #000;
                display: flex;
                justify-content: space-between;
              }
              .payment-info {
                text-align: center;
                margin-top: 6px;
                font-size: 10px;
                padding: 4px;
                border: 1px dashed #000;
              }
              .paid-badge {
                font-weight: bold;
                font-size: 11px;
              }
              .footer {
                text-align: center;
                margin-top: 8px;
                font-size: 9px;
              }
              .hide-print {
                display: none !important;
              }
              @media print {
                @page {
                  size: 58mm auto;
                  margin: 0;
                }
                body {
                  width: 58mm;
                  padding: 2mm;
                }
              }
            </style>
          </head>
          <body>
            ${printContent.innerHTML}
          </body>
        </html>
      `);

      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    };

    const formatDate = (date: string) => {
      return new Date(date).toLocaleDateString('en-PK', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    };

    const formatTime = (date: string) => {
      return new Date(date).toLocaleTimeString('en-PK', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    };

    return (
      <div className={cn('space-y-4', className)}>
        {/* Invoice Content */}
        <div
          ref={printRef}
          className="bg-white p-4 rounded-lg shadow-lg max-w-[58mm] mx-auto text-xs"
          style={{ fontFamily: "'Courier New', monospace" }}
        >
          {/* Header */}
          <div className="header text-center mb-3">
            {brand.logo_url && (
              <img
                src={brand.logo_url}
                alt={brand.name}
                className="logo max-w-[50px] mx-auto mb-2"
              />
            )}
            <h1 className="brand-name text-sm font-bold">
              {brand.name}
            </h1>
            {brand.tagline && (
              <p className="tagline text-[9px] text-gray-500">{brand.tagline}</p>
            )}
            <div className="contact-info text-[9px] text-gray-600 mt-2">
              {brand.address && <p>{brand.address}</p>}
              <p>Tel: {brand.phone}</p>
            </div>
          </div>

          <div className="divider border-t border-dashed border-gray-400 my-2" />

          {/* Invoice Info */}
          <div className="invoice-info flex justify-between text-[10px] mb-2">
            <div>
              <p className="font-bold">{invoice.invoice_number}</p>
            </div>
            <div className="text-right">
              <p>
                {formatDate(invoice.created_at)} {formatTime(invoice.created_at)}
              </p>
            </div>
          </div>

          {/* Order Type & Table */}
          <div className="text-[10px] mb-2 flex gap-2 flex-wrap">
            <span className="font-bold">{invoice.order?.order_type?.replace('_', ' ').toUpperCase()}</span>
            {invoice.order?.table_number && (
              <span>| Table {invoice.order.table_number}</span>
            )}
          </div>

          {/* Online Order Badge */}
          {invoice.payment_method === 'online' && (
            <div className="online-order-badge text-center mb-2 py-1 px-2 bg-purple-100 border border-purple-300 rounded">
              <span className="text-[10px] font-bold text-purple-700">🌐 ONLINE ORDER</span>
              {invoice.order?.transaction_id && (
                <span className="text-[9px] text-purple-600 ml-2">• PAYMENT VERIFIED ✓</span>
              )}
            </div>
          )}

          {/* Staff Info */}
          {(invoice.billed_by?.name || invoice.waiter?.name) && (
            <div className="text-[9px] mb-2 text-gray-600 space-y-0.5">
              {invoice.billed_by?.name && (
                <div>Billed by: <span className="font-semibold">{invoice.billed_by.name}</span></div>
              )}
              {invoice.waiter?.name && (
                <div>Served by: <span className="font-semibold">{invoice.waiter.name}</span></div>
              )}
            </div>
          )}

          {/* Customer Info - Compact but readable */}
          <div className="customer-info text-[10px] mb-2 py-2 px-2 bg-gray-50 border border-gray-200 rounded">
            <div className="font-bold text-[11px] mb-1">
              {invoice.customer?.name || invoice.customer_name || 'Walk-in Customer'}
            </div>
            <div className="space-y-0.5 text-[9px] text-gray-600">
              {(invoice.customer?.phone || invoice.customer_phone) && (
                <div>Phone: {invoice.customer?.phone || invoice.customer_phone}</div>
              )}
              {(invoice.customer?.email || invoice.customer_email) && (
                <div>Email: {maskEmail(invoice.customer?.email || invoice.customer_email)}</div>
              )}
            </div>
          </div>

          {/* Items */}
          <div className="items">
            <div className="items-header flex text-[9px] font-bold pb-1 border-b border-gray-400">
              <span className="flex-1">Item</span>
              <span className="w-8 text-center">Qty</span>
              <span className="w-14 text-right">Amt</span>
            </div>
            {/* Use items from invoice.items first, fallback to invoice.order.items */}
            {(invoice.items || invoice.order?.items || []).map((item: any, index: number) => (
              <div
                key={index}
                className="item flex py-1 text-[10px] border-b border-dotted border-gray-200"
              >
                <div className="item-name flex-1">
                  <span>{item.name}</span>
                </div>
                <span className="item-qty w-8 text-center">
                  x{item.quantity}
                </span>
                <span className="item-price w-14 text-right font-bold">
                  {(item.price * item.quantity).toLocaleString()}
                </span>
              </div>
            ))}
            {/* Show message if no items */}
            {(!invoice.items && !invoice.order?.items) && (
              <div className="py-2 text-center text-gray-400 text-[10px]">
                No items
              </div>
            )}
          </div>

          {/* Totals - Compact */}
          <div className="totals mt-2 text-[10px]">
            <div className="total-row flex justify-between py-1">
              <span>Subtotal</span>
              <span>Rs. {invoice.subtotal.toLocaleString()}</span>
            </div>

            {invoice.discount > 0 && (
              <div className="total-row flex justify-between py-1">
                <span>Discount</span>
                <span>-Rs. {invoice.discount.toLocaleString()}</span>
              </div>
            )}

            <div className="total-row flex justify-between py-1">
              <span>Tax (5%)</span>
              <span>Rs. {(invoice.tax || 0).toLocaleString()}</span>
            </div>

            {(invoice.delivery_fee || 0) > 0 && (
              <div className="total-row flex justify-between py-1">
                <span>Delivery Fee</span>
                <span>Rs. {invoice.delivery_fee?.toLocaleString()}</span>
              </div>
            )}

            <div className="grand-total flex justify-between text-sm font-bold mt-1 pt-1 border-t-2 border-black">
              <span>TOTAL</span>
              <span>Rs. {invoice.total.toLocaleString()}</span>
            </div>
          </div>

          <div className="divider border-t border-dashed border-gray-400 my-2" />

          {/* Payment Info - Compact */}
          <div className="payment-info text-center text-[10px] py-1">
            <span className="font-bold">
              PAID - {(invoice.order?.transaction_id || (invoice as any).transaction_id) ? 'ONLINE' : invoice.payment_method?.toUpperCase()}
            </span>
          </div>

          {/* Online Payment Transaction Details */}
          {(invoice.payment_method === 'online' || invoice.order?.transaction_id || (invoice as any).transaction_id) && (
            <div className="transaction-info text-center text-[9px] py-2 bg-purple-50 border border-purple-200 rounded mt-1">
              <div className="flex items-center justify-center gap-1 mb-1">
                <span className="font-bold text-purple-700">💳 Online Payment</span>
                <span className="text-[8px] bg-green-500 text-white px-1.5 py-0.5 rounded-full font-bold">VERIFIED ✓</span>
              </div>
              {(invoice.order?.transaction_id || (invoice as any).transaction_id) ? (
                <>
                  <p className="font-mono font-bold text-[10px]">TXN: {invoice.order?.transaction_id || (invoice as any).transaction_id}</p>
                  {(invoice.order?.online_payment_details?.method_name || (invoice as any).online_payment_details?.method_name) && (
                    <p className="text-purple-600 mt-0.5">via {invoice.order?.online_payment_details?.method_name || (invoice as any).online_payment_details?.method_name}</p>
                  )}
                </>
              ) : (
                <p className="text-gray-500 italic">Transaction ID pending</p>
              )}
            </div>
          )}

          <div className="divider border-t border-dashed border-gray-400 my-2" />

          {/* Footer - Compact */}
          <div className="footer text-center text-[9px] text-gray-500">
            <p>Thank you for visiting!</p>
            <p className="mt-1">@zoiro_broast</p>
          </div>
        </div>
      </div>
    );
  }
);

InvoicePrintView.displayName = 'InvoicePrintView';

// ==========================================
// COMPACT INVOICE CARD (For list view)
// ==========================================

interface CompactInvoiceCardProps {
  invoice: InvoiceDetails;
  onClick?: () => void;
}

export function CompactInvoiceCard({ invoice, onClick }: CompactInvoiceCardProps) {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-PK', {
      day: '2-digit',
      month: 'short',
    });
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('en-PK', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={cn(
        'p-4 rounded-lg border bg-white dark:bg-zinc-900 cursor-pointer',
        'hover:border-red-300 hover:shadow-md transition-all'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <Receipt className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <p className="font-bold">{invoice.invoice_number}</p>
            <p className="text-xs text-muted-foreground">
              Order #{invoice.order?.order_number}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-bold text-red-600">
            Rs. {invoice.total.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDate(invoice.created_at)} {formatTime(invoice.created_at)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-xs">
          {invoice.order?.order_type?.replace('_', ' ')}
        </Badge>
        <Badge
          variant="secondary"
          className={cn(
            'text-xs',
            invoice.payment_method === 'cash' && 'bg-green-100 text-green-700',
            invoice.payment_method === 'card' && 'bg-blue-100 text-blue-700',
            invoice.payment_method === 'online' && 'bg-purple-100 text-purple-700'
          )}
        >
          {invoice.payment_method?.toUpperCase()}
        </Badge>
        {invoice.customer?.name && (
          <span className="text-xs text-muted-foreground">
            • {invoice.customer.name}
          </span>
        )}
      </div>
    </motion.div>
  );
}
