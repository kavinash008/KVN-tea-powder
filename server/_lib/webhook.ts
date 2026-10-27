import http from 'http';
import https from 'https';
import crypto from 'crypto';
import { Order, OrderStatus } from '../../src/types';
import { serverDb } from './db';

export interface WebhookEventPayload {
  eventId: string;
  eventType: 'order.created' | 'order.status_changed';
  timestamp: string;
  orderId: string;
  orderNumber: string;
  customer: {
    fullName: string;
    phone: string;
    email?: string;
    formattedAddress: string;
    street: string;
    villageTown: string;
    district: string;
    state: string;
    pincode: string;
    deliveryInstructions?: string;
  };
  items: Array<{
    productId: string;
    productName: string;
    weight: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  productsSummary: string;
  totalQuantity: number;
  subtotal: number;
  deliveryCharge: number;
  discountAmount: number;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: OrderStatus;
  previousStatus?: OrderStatus;
  notes?: string;
}

export interface WebhookOutboxRecord {
  id: string;
  eventId: string;
  eventType: 'order.created' | 'order.status_changed';
  orderId: string;
  orderNumber: string;
  payload: WebhookEventPayload;
  status: 'pending' | 'delivered' | 'failed';
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: string;
  lastError?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Build flat products summary for spreadsheet row mapping
 * e.g. "KVN Premium Leaf Tea Powder (500g) x 2, Dust Tea (250g) x 1"
 */
export function buildProductsSummary(items: Order['items']): string {
  if (!items || items.length === 0) return 'No items';
  return items
    .map((item) => `${item.productName} (${item.weight || 'Std'}) x ${item.quantity}`)
    .join(', ');
}

/**
 * Format full address for single-column spreadsheet display
 */
export function formatFullAddress(customer: Order['customer']): string {
  if (!customer) return '';
  const parts = [
    customer.address,
    customer.villageTown,
    customer.district,
    customer.state || 'Tamil Nadu',
    customer.pincode ? `PIN: ${customer.pincode}` : '',
  ].filter(Boolean);
  return parts.join(', ');
}

/**
 * Build standard payload for order.created
 */
export function buildOrderCreatedPayload(order: Order): WebhookEventPayload {
  const eventId = `evt_created_${order.id}_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
  const totalQty = (order.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);

  return {
    eventId,
    eventType: 'order.created',
    timestamp: new Date().toISOString(),
    orderId: order.id,
    orderNumber: order.orderNumber,
    customer: {
      fullName: order.customer.fullName,
      phone: order.customer.phone,
      email: order.customer.email || undefined,
      formattedAddress: formatFullAddress(order.customer),
      street: order.customer.address,
      villageTown: order.customer.villageTown,
      district: order.customer.district || '',
      state: order.customer.state || 'Tamil Nadu',
      pincode: order.customer.pincode,
      deliveryInstructions: order.customer.deliveryInstructions || undefined,
    },
    items: (order.items || []).map((i) => ({
      productId: i.productId,
      productName: i.productName,
      weight: i.weight,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      totalPrice: i.unitPrice * i.quantity,
    })),
    productsSummary: buildProductsSummary(order.items),
    totalQuantity: totalQty,
    subtotal: order.subtotal,
    deliveryCharge: order.deliveryCharge,
    discountAmount: order.discountAmount || 0,
    totalAmount: order.totalAmount,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    orderStatus: order.orderStatus,
    notes: order.notes || '',
  };
}

/**
 * Build standard payload for order.status_changed
 */
export function buildStatusChangedPayload(
  order: Order,
  previousStatus: OrderStatus,
  newStatus: OrderStatus
): WebhookEventPayload {
  const eventId = `evt_status_${order.id}_${newStatus.replace(/\s+/g, '_')}_${Date.now()}`;
  const totalQty = (order.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);

  return {
    eventId,
    eventType: 'order.status_changed',
    timestamp: new Date().toISOString(),
    orderId: order.id,
    orderNumber: order.orderNumber,
    previousStatus,
    orderStatus: newStatus,
    customer: {
      fullName: order.customer.fullName,
      phone: order.customer.phone,
      email: order.customer.email || undefined,
      formattedAddress: formatFullAddress(order.customer),
      street: order.customer.address,
      villageTown: order.customer.villageTown,
      district: order.customer.district || '',
      state: order.customer.state || 'Tamil Nadu',
      pincode: order.customer.pincode,
      deliveryInstructions: order.customer.deliveryInstructions || undefined,
    },
    items: (order.items || []).map((i) => ({
      productId: i.productId,
      productName: i.productName,
      weight: i.weight,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      totalPrice: i.unitPrice * i.quantity,
    })),
    productsSummary: buildProductsSummary(order.items),
    totalQuantity: totalQty,
    subtotal: order.subtotal,
    deliveryCharge: order.deliveryCharge,
    discountAmount: order.discountAmount || 0,
    totalAmount: order.totalAmount,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    notes: order.notes || '',
  };
}

/**
 * Send an HTTP/HTTPS POST request with a timeout
 */
function sendHttpRequest(urlStr: string, bodyJson: string, headers: Record<string, string>, timeoutMs = 6000): Promise<{ status: number; data: string }> {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlStr);
      const isHttps = url.protocol === 'https:';
      const transport = isHttps ? https : http;

      const req = transport.request(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(bodyJson),
            'User-Agent': 'KVN-Tea-Powder-Webhook-Agent/1.0',
            ...headers,
          },
          timeout: timeoutMs,
        },
        (res) => {
          let responseData = '';
          res.on('data', (chunk) => {
            responseData += chunk;
          });
          res.on('end', () => {
            resolve({ status: res.statusCode || 200, data: responseData });
          });
        }
      );

      req.on('timeout', () => {
        req.destroy(new Error(`Webhook request timed out after ${timeoutMs}ms`));
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.write(bodyJson);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Webhook Manager: Dispatches events and manages durable retries
 */
export const webhookService = {
  getWebhookUrl(): string {
    return (process.env.N8N_WEBHOOK_URL || process.env.ORDER_BACKUP_WEBHOOK_URL || '').trim();
  },

  getWebhookSecret(): string {
    return (process.env.N8N_WEBHOOK_SECRET || '').trim();
  },

  isConfigured(): boolean {
    return Boolean(this.getWebhookUrl());
  },

  /**
   * Queue and attempt immediate dispatch for an event.
   * NEVER throws or blocks caller execution.
   */
  async queueAndDispatch(payload: WebhookEventPayload): Promise<WebhookOutboxRecord> {
    const now = new Date().toISOString();
    const record: WebhookOutboxRecord = {
      id: `outbox-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      eventId: payload.eventId,
      eventType: payload.eventType,
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
      payload,
      status: 'pending',
      attempts: 0,
      maxAttempts: 5,
      createdAt: now,
      updatedAt: now,
    };

    // 1. Persist to outbox store
    try {
      await serverDb.saveOutboxRecord(record);
    } catch (err) {
      console.warn('Failed to save webhook to outbox store:', err);
    }

    // 2. Dispatch asynchronously without blocking caller
    this.dispatchRecord(record).catch((err) => {
      console.warn(`Webhook initial dispatch non-fatal failure for ${payload.eventId}:`, err?.message || err);
    });

    return record;
  },

  /**
   * Execute dispatch for an outbox record
   */
  async dispatchRecord(record: WebhookOutboxRecord): Promise<{ success: boolean; status?: number; error?: string }> {
    const webhookUrl = this.getWebhookUrl();
    if (!webhookUrl) {
      // Mark skipped / pending configuration
      record.lastError = 'N8N_WEBHOOK_URL environment variable is not configured';
      record.updatedAt = new Date().toISOString();
      await serverDb.updateOutboxRecord(record.id, {
        lastError: record.lastError,
        updatedAt: record.updatedAt,
      });
      return { success: false, error: record.lastError };
    }

    const bodyJson = JSON.stringify(record.payload);
    const headers: Record<string, string> = {
      'X-Event-Id': record.eventId,
      'X-Event-Type': record.eventType,
      'X-Order-Id': record.orderId,
      'X-Order-Number': record.orderNumber,
      'X-Delivery-Attempt': String(record.attempts + 1),
    };

    const secret = this.getWebhookSecret();
    if (secret) {
      const hmac = crypto.createHmac('sha256', secret).update(bodyJson).digest('hex');
      headers['X-Webhook-Signature'] = hmac;
    }

    record.attempts += 1;
    record.lastAttemptAt = new Date().toISOString();

    try {
      const res = await sendHttpRequest(webhookUrl, bodyJson, headers, 6000);
      if (res.status >= 200 && res.status < 300) {
        record.status = 'delivered';
        record.deliveredAt = new Date().toISOString();
        record.lastError = undefined;
        record.updatedAt = record.deliveredAt;

        await serverDb.updateOutboxRecord(record.id, {
          status: 'delivered',
          attempts: record.attempts,
          lastAttemptAt: record.lastAttemptAt,
          deliveredAt: record.deliveredAt,
          updatedAt: record.updatedAt,
        });

        return { success: true, status: res.status };
      } else {
        const errorMsg = `Webhook target returned HTTP ${res.status}: ${res.data.slice(0, 100)}`;
        record.status = record.attempts >= record.maxAttempts ? 'failed' : 'pending';
        record.lastError = errorMsg;
        record.updatedAt = new Date().toISOString();

        await serverDb.updateOutboxRecord(record.id, {
          status: record.status,
          attempts: record.attempts,
          lastAttemptAt: record.lastAttemptAt,
          lastError: record.lastError,
          updatedAt: record.updatedAt,
        });

        return { success: false, status: res.status, error: errorMsg };
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Network request failed';
      record.status = record.attempts >= record.maxAttempts ? 'failed' : 'pending';
      record.lastError = errorMsg;
      record.updatedAt = new Date().toISOString();

      await serverDb.updateOutboxRecord(record.id, {
        status: record.status,
        attempts: record.attempts,
        lastAttemptAt: record.lastAttemptAt,
        lastError: record.lastError,
        updatedAt: record.updatedAt,
      });

      return { success: false, error: errorMsg };
    }
  },

  /**
   * Process all pending or failed outbox records
   */
  async retryPendingEvents(): Promise<{ processed: number; succeeded: number; failed: number }> {
    const pendingRecords = await serverDb.getPendingOutboxRecords();
    let succeeded = 0;
    let failed = 0;

    for (const record of pendingRecords) {
      const result = await this.dispatchRecord(record);
      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }
    }

    return {
      processed: pendingRecords.length,
      succeeded,
      failed,
    };
  },
};
