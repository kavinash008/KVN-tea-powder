import { UpiPaymentInfo } from '../../src/types';

/**
 * Validate standard UPI Virtual Payment Address (VPA) format e.g. name@bank
 */
export function isValidUpiId(upiId: string): boolean {
  if (!upiId || typeof upiId !== 'string') return false;
  const trimmed = upiId.trim();
  return /^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z0-9.\-_]{2,}$/.test(trimmed);
}

/**
 * Normalize a customer-submitted UPI Transaction ID / UTR reference
 */
export function normalizeUtr(utr: string): string {
  return (utr || '').trim().replace(/\s+/g, '').toUpperCase();
}

/**
 * Validate UTR / UPI reference format (6 to 40 alphanumeric / dash / underscore chars)
 */
export function isValidUtr(utr: string): boolean {
  const normalized = normalizeUtr(utr);
  return /^[A-Z0-9\-_]{6,40}$/.test(normalized);
}

/**
 * Build a server-authoritative NPCI-compliant UPI payment payload from verified order total.
 * Never constructs a fake QR URI when the store UPI ID is missing or invalid.
 */
export function buildUpiPaymentInfo(params: {
  upiId?: string;
  merchantName?: string;
  orderNumber: string;
  customerName: string;
  amount: number;
}): UpiPaymentInfo {
  const cleanUpiId = (params.upiId || '').trim();
  const merchantName = (params.merchantName || 'KVN Tea Powder').trim() || 'KVN Tea Powder';
  const amount = Number(params.amount || 0);

  // Extract clean short sequence/ref e.g. "001" from "KVN-ORD-20261111-001"
  const orderParts = params.orderNumber.split('-');
  const shortSeq = orderParts[orderParts.length - 1] || params.orderNumber;
  const cleanCustomerName = (params.customerName || 'CUSTOMER')
    .replace(/[^a-zA-Z0-9 ]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()
    .slice(0, 24);

  const transactionRef = params.orderNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const transactionNote = `KVN ORDER ${shortSeq} - CUSTOMER ${cleanCustomerName}`.slice(0, 50);

  if (!isValidUpiId(cleanUpiId)) {
    return {
      configured: false,
      merchantName,
      transactionRef,
      transactionNote,
      amount,
      currency: 'INR',
      warning: 'Merchant UPI ID is not configured in Admin Settings. Please configure a valid UPI ID before accepting UPI QR payments.',
    };
  }

  const queryParams = [
    `pa=${encodeURIComponent(cleanUpiId)}`,
    `pn=${encodeURIComponent(merchantName)}`,
    `tr=${encodeURIComponent(transactionRef)}`,
    `tn=${encodeURIComponent(transactionNote)}`,
    `am=${amount.toFixed(2)}`,
    `cu=INR`,
  ];

  return {
    configured: true,
    upiId: cleanUpiId,
    merchantName,
    transactionRef,
    transactionNote,
    amount,
    currency: 'INR',
    upiUri: `upi://pay?${queryParams.join('&')}`,
  };
}
