import { Order, CustomerUser, Product, Category, BusinessConfig, PaymentAuditEntry } from '../../src/types';
import { WebhookOutboxRecord } from './webhook';

export interface UserDocument extends CustomerUser {
  passwordHash?: string;
}

export interface WhatsAppNotificationRecord {
  id: string;
  idempotencyKey: string;
  orderId: string;
  orderNumber: string;
  recipientPhone: string;
  customerName: string;
  templateName?: string;
  messagePreview: string;
  status: 'Pending' | 'Sent' | 'Failed';
  reason?: string;
  attempts: number;
  maxAttempts: number;
  whatsappMessageId?: string;
  lastAttemptAt?: string;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoreState {
  orders: Order[];
  users: UserDocument[];
  products: Product[];
  categories?: Category[];
  settings?: BusinessConfig;
  counters?: Record<string, number>;
  webhookEvents?: WebhookOutboxRecord[];
  whatsappOutbox?: WhatsAppNotificationRecord[];
  paymentAuditLogs?: PaymentAuditEntry[];
  lastUpdated: string;
}
