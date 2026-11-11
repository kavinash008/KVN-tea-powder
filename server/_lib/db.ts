import { MongoClient, Db } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { Order, OrderStatus, CustomerAddress, Product, Category, BusinessConfig, PaymentAuditEntry } from '../../src/types';
import { INITIAL_PRODUCTS, INITIAL_CATEGORIES, INITIAL_BUSINESS_CONFIG } from '../../src/data/initialData';
import { UserDocument, StoreState, WhatsAppNotificationRecord } from './types';
import { WebhookOutboxRecord } from './webhook';
import { buildUpiPaymentInfo, isValidUpiId, isValidUtr, normalizeUtr } from './upi';
import { whatsappService } from './whatsapp';

export class HttpError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

let cachedMongoClient: MongoClient | null = null;
let cachedDb: Db | null = null;
let mongoConnectPromise: Promise<Db | null> | null = null;
let mongoFailedUntil = 0;

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || '';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'kvn_store';

// Local file-based storage fallback (for local development or offline mode)
const LOCAL_DATA_DIR = path.join(process.cwd(), '.data');
const LOCAL_DATA_FILE = path.join(LOCAL_DATA_DIR, 'store.json');
const TMP_DATA_FILE = path.join('/tmp', 'kvn_store.json');

function getLocalFilePath(): string {
  if (process.env.VERCEL) {
    return TMP_DATA_FILE;
  }
  return LOCAL_DATA_FILE;
}

let localStateCache: StoreState | null = null;

function ensureLocalFile(): StoreState {
  if (localStateCache) {
    return localStateCache;
  }

  const filePath = getLocalFilePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      // ignore
    }
  }

  const initialState: StoreState = {
    orders: [],
    users: [],
    products: INITIAL_PRODUCTS,
    categories: INITIAL_CATEGORIES,
    settings: { ...INITIAL_BUSINESS_CONFIG },
    counters: {},
    webhookEvents: [],
    whatsappOutbox: [],
    paymentAuditLogs: [],
    lastUpdated: new Date().toISOString(),
  };

  if (!fs.existsSync(filePath)) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(initialState, null, 2), 'utf-8');
    } catch {
      // ignore
    }
    localStateCache = initialState;
    return localStateCache;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (!content || !content.trim()) {
      fs.writeFileSync(filePath, JSON.stringify(initialState, null, 2), 'utf-8');
      localStateCache = initialState;
      return localStateCache;
    }
    const parsed = JSON.parse(content);
    parsed.webhookEvents = parsed.webhookEvents || [];
    parsed.whatsappOutbox = parsed.whatsappOutbox || [];
    parsed.paymentAuditLogs = parsed.paymentAuditLogs || [];
    parsed.counters = parsed.counters || {};
    parsed.settings = { ...INITIAL_BUSINESS_CONFIG, ...(parsed.settings || {}) };
    parsed.orders = parsed.orders || [];
    parsed.users = parsed.users || [];
    parsed.products = parsed.products || INITIAL_PRODUCTS;
    parsed.categories = parsed.categories || INITIAL_CATEGORIES;
    localStateCache = parsed;
    return localStateCache;
  } catch {
    localStateCache = initialState;
    return localStateCache;
  }
}

async function saveLocalFile(state: StoreState): Promise<void> {
  localStateCache = state;
  state.lastUpdated = new Date().toISOString();
  const filePath = getLocalFilePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      // ignore
    }
  }
  try {
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8');
  } catch {
    // ignore
  }
  return Promise.resolve();
}

/**
 * Connect to MongoDB Atlas with thread-safe promise caching and optimal timeout.
 */
async function getMongoDb(): Promise<Db | null> {
  if (!MONGODB_URI) {
    return null;
  }

  if (cachedDb) {
    return cachedDb;
  }

  if (Date.now() < mongoFailedUntil) {
    return null;
  }

  // If a connection attempt is already in flight, reuse the promise to prevent dropped concurrent requests
  if (mongoConnectPromise) {
    return await mongoConnectPromise;
  }

  mongoConnectPromise = (async () => {
    try {
      if (!cachedMongoClient) {
        cachedMongoClient = new MongoClient(MONGODB_URI, {
          connectTimeoutMS: 5000,
          serverSelectionTimeoutMS: 5000,
        });
        await cachedMongoClient.connect();
      }
      cachedDb = cachedMongoClient.db(MONGODB_DB_NAME);

      // Ensure indexes in background
      cachedDb.collection('orders').createIndex({ orderNumber: 1 }, { unique: true }).catch(() => {});
      cachedDb.collection('orders').createIndex({ 'customer.phone': 1 }).catch(() => {});
      cachedDb.collection('orders').createIndex({ customerId: 1 }).catch(() => {});
      cachedDb.collection('orders').createIndex({ createdAt: -1 }).catch(() => {});
      cachedDb.collection('orders').createIndex({ 'paymentDetails.utrNormalized': 1 }).catch(() => {});
      cachedDb.collection('orders').createIndex({ paymentStatus: 1 }).catch(() => {});
      cachedDb.collection('users').createIndex({ phone: 1 }).catch(() => {});
      cachedDb.collection('users').createIndex({ email: 1 }).catch(() => {});
      cachedDb.collection('users').createIndex({ firebaseUid: 1 }).catch(() => {});
      cachedDb.collection('products').createIndex({ id: 1 }, { unique: true }).catch(() => {});
      cachedDb.collection('categories').createIndex({ id: 1 }, { unique: true }).catch(() => {});
      cachedDb.collection('settings').createIndex({ id: 1 }, { unique: true }).catch(() => {});
      cachedDb.collection('counters').createIndex({ id: 1 }, { unique: true }).catch(() => {});
      cachedDb.collection('webhook_outbox').createIndex({ eventId: 1 }, { unique: true }).catch(() => {});
      cachedDb.collection('webhook_outbox').createIndex({ status: 1 }).catch(() => {});
      cachedDb.collection('whatsapp_notifications').createIndex({ idempotencyKey: 1 }, { unique: true }).catch(() => {});
      cachedDb.collection('whatsapp_notifications').createIndex({ status: 1 }).catch(() => {});
      cachedDb.collection('payment_audit_logs').createIndex({ timestamp: -1 }).catch(() => {});
      cachedDb.collection('payment_audit_logs').createIndex({ orderId: 1 }).catch(() => {});

      // Auto-seed products collection if empty
      cachedDb.collection('products').countDocuments().then(async (count) => {
        if (count === 0 && cachedDb) {
          try {
            await cachedDb.collection('products').insertMany(INITIAL_PRODUCTS as any);
          } catch {
            // ignore
          }
        }
      }).catch(() => {});

      // Auto-seed categories collection if empty
      cachedDb.collection('categories').countDocuments().then(async (count) => {
        if (count === 0 && cachedDb) {
          try {
            await cachedDb.collection('categories').insertMany(INITIAL_CATEGORIES as any);
          } catch {
            // ignore
          }
        }
      }).catch(() => {});

      return cachedDb;
    } catch (err) {
      console.warn('MongoDB Atlas connection failed:', err);
      mongoFailedUntil = Date.now() + 3000; // 3-second backoff
      cachedMongoClient = null;
      cachedDb = null;
      return null;
    } finally {
      mongoConnectPromise = null;
    }
  })();

  return await mongoConnectPromise;
}

/**
 * Shared Persistent Database Service
 */
export const serverDb = {
  async isCloudConnected(): Promise<boolean> {
    const db = await getMongoDb();
    return db !== null;
  },

  // ===================== ORDERS =====================

  async getAllOrders(statusFilter?: string): Promise<Order[]> {
    const db = await getMongoDb();
    if (db) {
      const query = statusFilter && statusFilter !== 'all' ? { orderStatus: statusFilter } : {};
      const docs = await db.collection('orders').find(query).sort({ createdAt: -1 }).toArray();
      return docs.map((d: any) => {
        const { _id, ...rest } = d;
        return rest as Order;
      });
    }

    const state = ensureLocalFile();
    let orders = state.orders;
    if (statusFilter && statusFilter !== 'all') {
      orders = orders.filter((o) => o.orderStatus === statusFilter);
    }
    return orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async getOrderById(idOrNumber: string): Promise<Order | null> {
    const db = await getMongoDb();
    if (db) {
      const doc = await db.collection('orders').findOne({
        $or: [{ id: idOrNumber }, { orderNumber: idOrNumber }],
      });
      if (!doc) return null;
      const { _id, ...rest } = doc;
      return rest as Order;
    }

    const state = ensureLocalFile();
    const order = state.orders.find((o) => o.id === idOrNumber || o.orderNumber === idOrNumber);
    return order || null;
  },

  async getOrdersByPhone(phone: string): Promise<Order[]> {
    const cleanPhone = phone.replace(/\D/g, '');
    const db = await getMongoDb();
    if (db) {
      const docs = await db.collection('orders').find({
        'customer.phone': { $regex: cleanPhone },
      }).sort({ createdAt: -1 }).toArray();
      return docs.map((d: any) => {
        const { _id, ...rest } = d;
        return rest as Order;
      });
    }

    const state = ensureLocalFile();
    return state.orders
      .filter((o) => o.customer.phone.replace(/\D/g, '').includes(cleanPhone))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async checkDuplicateOrder(phone: string, subtotal: number, timeWindowMs: number = 30000): Promise<boolean> {
    const cleanPhone = phone.replace(/\D/g, '');
    const now = Date.now();
    const orders = await this.getOrdersByPhone(cleanPhone);
    const recent = orders.find((o) => {
      const diff = now - new Date(o.createdAt).getTime();
      return diff >= 0 && diff <= timeWindowMs && o.subtotal === subtotal;
    });
    return Boolean(recent);
  },

  // ===================== SETTINGS & ORDER SEQUENCES =====================

  async getStoreSettings(): Promise<BusinessConfig> {
    let stored: Partial<BusinessConfig> | null = null;
    const db = await getMongoDb();
    if (db) {
      const doc = await db.collection('settings').findOne({ id: 'default' });
      if (doc) {
        const { _id, id: _docId, ...rest } = doc as any;
        stored = rest;
      }
    } else {
      const state = ensureLocalFile();
      stored = state.settings || null;
    }

    const merged: BusinessConfig = {
      ...INITIAL_BUSINESS_CONFIG,
      ...(stored || {}),
    };

    const envUpi = (process.env.MERCHANT_UPI_ID || '').trim();
    const envMerchant = (process.env.MERCHANT_UPI_NAME || '').trim();
    const effectiveUpiId = (stored?.upiId || envUpi || INITIAL_BUSINESS_CONFIG.upiId || '').trim();
    const effectiveMerchantName = (merged.merchantName || envMerchant || 'KVN Tea Powder').trim() || 'KVN Tea Powder';

    return {
      ...merged,
      upiId: effectiveUpiId,
      merchantName: effectiveMerchantName,
      upiConfigured: isValidUpiId(effectiveUpiId),
    };
  },

  async saveStoreSettings(updates: Partial<BusinessConfig>): Promise<BusinessConfig> {
    const current = await this.getStoreSettings();
    const cleanUpi = updates.upiId !== undefined ? updates.upiId.trim() : (current.upiId || '').trim();
    if (cleanUpi && !isValidUpiId(cleanUpi)) {
      throw new HttpError(400, 'Please enter a valid UPI ID (for example: kavinash@okicici or 6383050287@ybl).');
    }

    const nextSettings: BusinessConfig = {
      ...current,
      ...updates,
      upiId: cleanUpi,
      merchantName: (updates.merchantName ?? current.merchantName ?? 'KVN Tea Powder').trim() || 'KVN Tea Powder',
      upiConfigured: isValidUpiId(cleanUpi),
    };

    const db = await getMongoDb();
    if (db) {
      await db.collection('settings').updateOne(
        { id: 'default' },
        { $set: { id: 'default', ...nextSettings, updatedAt: new Date().toISOString() } },
        { upsert: true }
      );
    }

    const state = ensureLocalFile();
    state.settings = nextSettings;
    await saveLocalFile(state);
    return nextSettings;
  },

  async getNextOrderNumber(): Promise<string> {
    const istDate = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, '');
    const counterId = `ord_seq_${istDate}`;
    const db = await getMongoDb();

    if (db) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const res = await db.collection('counters').findOneAndUpdate(
          { id: counterId },
          { $inc: { seq: 1 } },
          { upsert: true, returnDocument: 'after' }
        );
        const seqNum = Number((res as any)?.seq || 1);
        const candidate = `KVN-ORD-${istDate}-${String(seqNum).padStart(3, '0')}`;
        const clash = await db.collection('orders').findOne({ orderNumber: candidate });
        if (!clash) return candidate;
      }
      return `KVN-ORD-${istDate}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const state = ensureLocalFile();
    state.counters = state.counters || {};
    let seq = Number(state.counters[counterId] || 0) + 1;
    let candidate = `KVN-ORD-${istDate}-${String(seq).padStart(3, '0')}`;
    while (state.orders.some((o) => o.orderNumber === candidate)) {
      seq++;
      candidate = `KVN-ORD-${istDate}-${String(seq).padStart(3, '0')}`;
    }
    state.counters[counterId] = seq;
    await saveLocalFile(state);
    return candidate;
  },

  async recordPaymentAudit(entry: PaymentAuditEntry): Promise<void> {
    const db = await getMongoDb();
    if (db) {
      await db.collection('payment_audit_logs').insertOne(entry as any).catch(() => {});
      return;
    }
    const state = ensureLocalFile();
    state.paymentAuditLogs = state.paymentAuditLogs || [];
    state.paymentAuditLogs.unshift(entry);
    if (state.paymentAuditLogs.length > 500) {
      state.paymentAuditLogs = state.paymentAuditLogs.slice(0, 500);
    }
    await saveLocalFile(state);
  },

  async createOrder(
    orderData: Partial<Order> & { customer: any; items: any; totalAmount: number; whatsappConsent?: boolean }
  ): Promise<Order> {
    const now = new Date().toISOString();
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const orderId = `ord-${Date.now()}-${randomSuffix}`;
    const orderNumber = await this.getNextOrderNumber();
    const paymentMethod = orderData.paymentMethod || 'COD';
    const isUpi = paymentMethod === 'ONLINE_UPI';

    const storeSettings = await this.getStoreSettings();
    const upiPaymentInfo = isUpi
      ? buildUpiPaymentInfo({
          upiId: storeSettings.upiId,
          merchantName: storeSettings.merchantName || 'KVN Tea Powder',
          orderNumber,
          customerName: orderData.customer?.fullName || 'Customer',
          amount: Number(orderData.totalAmount || 0),
        })
      : undefined;

    const initialPaymentStatus = isUpi ? 'PAYMENT_PENDING' : orderData.paymentStatus || 'Pending';
    const initialOrderStatus: OrderStatus = isUpi ? 'Payment Pending' : orderData.orderStatus || 'Order Confirmed';

    const initialAudit: PaymentAuditEntry = {
      id: `aud-${Date.now()}-${randomSuffix}`,
      orderId,
      orderNumber,
      action: 'ORDER_CREATED',
      actor: orderData.customer?.fullName || 'Customer',
      newPaymentStatus: initialPaymentStatus,
      amount: Number(orderData.totalAmount || 0),
      note: isUpi ? 'Order created awaiting UPI payment & UTR verification' : 'COD order created',
      timestamp: now,
    };

    const newOrder: Order = {
      id: orderId,
      orderNumber,
      customerId: orderData.customerId,
      customer: orderData.customer,
      addressSnapshot: orderData.addressSnapshot,
      items: orderData.items,
      subtotal: orderData.subtotal || 0,
      deliveryCharge: orderData.deliveryCharge || 0,
      discountAmount: orderData.discountAmount || 0,
      couponCode: orderData.couponCode,
      totalAmount: orderData.totalAmount,
      paymentMethod,
      paymentStatus: initialPaymentStatus,
      orderStatus: initialOrderStatus,
      statusHistory: [
        {
          status: initialOrderStatus,
          timestamp: now,
          note: isUpi
            ? 'Order created. Complete UPI payment and submit your Transaction ID / UTR for verification.'
            : 'Order placed by customer via online store',
        },
      ],
      stockDeducted: !isUpi,
      stockDeductedAt: !isUpi ? now : undefined,
      whatsappConsent: orderData.whatsappConsent !== false,
      whatsappStatus: isUpi
        ? 'Pending'
        : orderData.whatsappStatus || (whatsappService.isConfigured() ? 'Pending' : 'not_configured'),
      upiPaymentInfo,
      paymentDetails: {},
      paymentAuditLog: [initialAudit],
      excelSyncStatus: orderData.excelSyncStatus || 'pending',
      notes: orderData.notes || '',
      createdAt: now,
      updatedAt: now,
    };

    let db = await getMongoDb();
    if (!db && MONGODB_URI) {
      mongoFailedUntil = 0;
      db = await getMongoDb();
    }

    if (db) {
      await db.collection('orders').insertOne(newOrder as any);
      if (!isUpi) {
        await this.decrementProductStock(orderData.items).catch((e) => console.warn('Stock decrement warning:', e));
      }
      await this.recordPaymentAudit(initialAudit);
      return newOrder;
    }

    const state = ensureLocalFile();
    state.orders.unshift(newOrder);
    await saveLocalFile(state);
    if (!isUpi) {
      await this.decrementProductStock(orderData.items).catch((e) => console.warn('Stock decrement warning:', e));
    }
    await this.recordPaymentAudit(initialAudit);
    return newOrder;
  },

  async submitOrderPaymentProof(
    orderIdOrNumber: string,
    proof: { utr: string; submittedPayerName?: string; paymentScreenshotUrl?: string }
  ): Promise<Order> {
    const existing = await this.getOrderById(orderIdOrNumber);
    if (!existing) {
      throw new HttpError(404, 'Order not found');
    }
    if (existing.paymentStatus === 'PAID' || existing.paymentStatus === 'Paid') {
      throw new HttpError(409, 'Payment for this order has already been verified.');
    }
    if (!proof.utr || !isValidUtr(proof.utr)) {
      throw new HttpError(400, 'Please enter a valid UPI Transaction ID / UTR (6 to 40 letters or digits).');
    }

    const utrTrimmed = proof.utr.trim();
    const utrNormalized = normalizeUtr(utrTrimmed);
    const cleanPayerName = (proof.submittedPayerName || '').trim().slice(0, 80);
    const cleanScreenshot = (proof.paymentScreenshotUrl || '').trim();

    if (cleanScreenshot.startsWith('data:image/') && cleanScreenshot.length > 200000) {
      throw new HttpError(413, 'Screenshot image is too large (>150KB). Please choose a smaller image.');
    }

    const now = new Date().toISOString();
    const auditEntry: PaymentAuditEntry = {
      id: `aud-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      orderId: existing.id,
      orderNumber: existing.orderNumber,
      action: 'UTR_SUBMITTED',
      actor: cleanPayerName || existing.customer.fullName,
      previousPaymentStatus: existing.paymentStatus,
      newPaymentStatus: 'PAYMENT_PENDING',
      utr: utrNormalized,
      amount: existing.totalAmount,
      note: cleanPayerName ? `UTR submitted by payer: ${cleanPayerName}` : 'Customer submitted UTR for verification',
      timestamp: now,
    };

    const nextDetails = {
      ...(existing.paymentDetails || {}),
      utr: utrTrimmed,
      utrNormalized,
      submittedPayerName: cleanPayerName || existing.paymentDetails?.submittedPayerName,
      paymentScreenshotUrl: cleanScreenshot || existing.paymentDetails?.paymentScreenshotUrl,
      paymentSubmittedAt: now,
      rejectionReason: undefined,
      rejectedAt: undefined,
      rejectedBy: undefined,
    };

    const db = await getMongoDb();
    if (db) {
      const duplicate = await db.collection('orders').findOne({
        id: { $ne: existing.id },
        'paymentDetails.utrNormalized': utrNormalized,
        paymentStatus: { $in: ['PAYMENT_PENDING', 'Pending', 'PAID', 'Paid'] },
      });
      if (duplicate) {
        throw new HttpError(409, `UPI Transaction ID / UTR "${utrNormalized}" has already been submitted on another order.`);
      }

      await db.collection('orders').updateOne(
        { id: existing.id },
        {
          $set: {
            paymentStatus: 'PAYMENT_PENDING',
            orderStatus: 'Payment Pending',
            paymentDetails: nextDetails,
            updatedAt: now,
          },
          $push: {
            statusHistory: {
              status: 'Payment Pending',
              timestamp: now,
              note: `UTR ${utrNormalized} submitted. Awaiting bank verification.`,
            },
            paymentAuditLog: auditEntry,
          } as any,
        }
      );
      await this.recordPaymentAudit(auditEntry);
      return (await this.getOrderById(existing.id)) as Order;
    }

    const state = ensureLocalFile();
    const duplicate = state.orders.find(
      (o) =>
        o.id !== existing.id &&
        o.paymentDetails?.utrNormalized === utrNormalized &&
        ['PAYMENT_PENDING', 'Pending', 'PAID', 'Paid'].includes(o.paymentStatus)
    );
    if (duplicate) {
      throw new HttpError(409, `UPI Transaction ID / UTR "${utrNormalized}" has already been submitted on another order.`);
    }

    const idx = state.orders.findIndex((o) => o.id === existing.id);
    if (idx === -1) throw new HttpError(404, 'Order not found');

    state.orders[idx] = {
      ...state.orders[idx],
      paymentStatus: 'PAYMENT_PENDING',
      orderStatus: 'Payment Pending',
      paymentDetails: nextDetails,
      updatedAt: now,
      statusHistory: [
        ...state.orders[idx].statusHistory,
        {
          status: 'Payment Pending',
          timestamp: now,
          note: `UTR ${utrNormalized} submitted. Awaiting bank verification.`,
        },
      ],
      paymentAuditLog: [...(state.orders[idx].paymentAuditLog || []), auditEntry],
    };
    await saveLocalFile(state);
    await this.recordPaymentAudit(auditEntry);
    return state.orders[idx];
  },

  async verifyStockAvailableForItems(items: any[]): Promise<void> {
    if (!items || items.length === 0) return;
    const products = await this.getAllProducts(false);
    for (const item of items) {
      const prod = products.find((p) => p.id === item.productId);
      if (!prod) {
        throw new HttpError(409, `Product "${item.productName}" is no longer available in inventory.`);
      }
      const variant = prod.variants?.find((v) => v.id === item.variantId || v.weight === item.weight) || prod.variants?.[0];
      const needed = Math.max(1, Number(item.quantity) || 1);
      const available = Number(variant?.stock || 0);
      if (!variant || available < needed) {
        throw new HttpError(
          409,
          `Insufficient stock for "${prod.name} (${item.weight})": requested ${needed}, only ${available} remaining.`
        );
      }
    }
  },

  async approveOrderPayment(
    orderIdOrNumber: string,
    params: {
      verifiedAmount?: number;
      verifiedPayerName?: string;
      utrOverride?: string;
      adminIdentity?: string;
      adminNote?: string;
    }
  ): Promise<Order> {
    const existing = await this.getOrderById(orderIdOrNumber);
    if (!existing) {
      throw new HttpError(404, 'Order not found');
    }
    if (existing.paymentStatus !== 'PAYMENT_PENDING' && existing.paymentStatus !== 'Pending') {
      throw new HttpError(409, `Cannot approve: Order payment status is already "${existing.paymentStatus}".`);
    }

    const rawUtr = (params.utrOverride || existing.paymentDetails?.utr || '').trim();
    const isUpi = existing.paymentMethod === 'ONLINE_UPI';
    if (isUpi && !isValidUtr(rawUtr)) {
      throw new HttpError(400, 'Cannot approve UPI payment without a valid UPI Transaction ID / UTR.');
    }

    const utrNormalized = rawUtr ? normalizeUtr(rawUtr) : undefined;
    const expectedAmount = Number(existing.totalAmount || 0);
    const verifiedAmount = params.verifiedAmount !== undefined ? Number(params.verifiedAmount) : expectedAmount;
    if (Math.abs(verifiedAmount - expectedAmount) > 0.01) {
      throw new HttpError(
        400,
        `Verified amount ₹${verifiedAmount} does not match authoritative order total ₹${expectedAmount}.`
      );
    }

    if (!existing.stockDeducted) {
      await this.verifyStockAvailableForItems(existing.items);
    }

    const now = new Date().toISOString();
    const adminIdentity = (params.adminIdentity || 'Kavinash (Admin)').trim();
    const verifiedPayerName =
      (params.verifiedPayerName || existing.paymentDetails?.submittedPayerName || '').trim() || undefined;

    const auditEntry: PaymentAuditEntry = {
      id: `aud-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      orderId: existing.id,
      orderNumber: existing.orderNumber,
      action: 'PAYMENT_APPROVED',
      actor: adminIdentity,
      previousPaymentStatus: existing.paymentStatus,
      newPaymentStatus: 'PAID',
      utr: utrNormalized,
      amount: verifiedAmount,
      note:
        params.adminNote?.trim() ||
        `Payment ₹${verifiedAmount} manually verified by ${adminIdentity}${verifiedPayerName ? ` (Payer: ${verifiedPayerName})` : ''}`,
      timestamp: now,
    };

    const nextDetails = {
      ...(existing.paymentDetails || {}),
      utr: rawUtr || existing.paymentDetails?.utr,
      utrNormalized: utrNormalized || existing.paymentDetails?.utrNormalized,
      verifiedAmount,
      verifiedPayerName,
      verifiedAt: now,
      verifiedBy: adminIdentity,
      rejectionReason: undefined,
      rejectedAt: undefined,
      rejectedBy: undefined,
    };

    const db = await getMongoDb();
    if (db) {
      if (utrNormalized) {
        const duplicatePaid = await db.collection('orders').findOne({
          id: { $ne: existing.id },
          'paymentDetails.utrNormalized': utrNormalized,
          paymentStatus: { $in: ['PAID', 'Paid'] },
        });
        if (duplicatePaid) {
          throw new HttpError(
            409,
            `Duplicate UTR blocked: "${utrNormalized}" has already been verified on order ${duplicatePaid.orderNumber}.`
          );
        }
      }

      const atomicRes = await db.collection('orders').findOneAndUpdate(
        {
          id: existing.id,
          paymentStatus: { $in: ['PAYMENT_PENDING', 'Pending'] },
        },
        {
          $set: {
            paymentStatus: 'PAID',
            orderStatus: 'Order Confirmed',
            stockDeducted: true,
            stockDeductedAt: existing.stockDeductedAt || now,
            paymentDetails: nextDetails,
            updatedAt: now,
          },
          $push: {
            statusHistory: {
              $each: [
                {
                  status: 'Payment Confirmed',
                  timestamp: now,
                  note: `Payment ₹${verifiedAmount} verified by ${adminIdentity}${utrNormalized ? ` (UTR: ${utrNormalized})` : ''}`,
                },
                {
                  status: 'Order Confirmed',
                  timestamp: now,
                  note: 'Order confirmed after payment verification',
                },
              ],
            },
            paymentAuditLog: auditEntry,
          } as any,
        },
        { returnDocument: 'after' }
      );

      if (!atomicRes) {
        throw new HttpError(409, 'Order payment was already verified or modified concurrently.');
      }

      if (!existing.stockDeducted) {
        await this.decrementProductStock(existing.items);
      }

      await this.recordPaymentAudit(auditEntry);
      const { _id, ...cleanOrder } = atomicRes as any;
      return cleanOrder as Order;
    }

    const state = ensureLocalFile();
    if (utrNormalized) {
      const duplicatePaid = state.orders.find(
        (o) =>
          o.id !== existing.id &&
          o.paymentDetails?.utrNormalized === utrNormalized &&
          ['PAID', 'Paid'].includes(o.paymentStatus)
      );
      if (duplicatePaid) {
        throw new HttpError(
          409,
          `Duplicate UTR blocked: "${utrNormalized}" has already been verified on order ${duplicatePaid.orderNumber}.`
        );
      }
    }

    const idx = state.orders.findIndex(
      (o) => o.id === existing.id && ['PAYMENT_PENDING', 'Pending'].includes(o.paymentStatus)
    );
    if (idx === -1) {
      throw new HttpError(409, 'Order payment was already verified or modified.');
    }

    const shouldDeduct = !state.orders[idx].stockDeducted;
    state.orders[idx] = {
      ...state.orders[idx],
      paymentStatus: 'PAID',
      orderStatus: 'Order Confirmed',
      stockDeducted: true,
      stockDeductedAt: state.orders[idx].stockDeductedAt || now,
      paymentDetails: nextDetails,
      updatedAt: now,
      statusHistory: [
        ...state.orders[idx].statusHistory,
        {
          status: 'Payment Confirmed',
          timestamp: now,
          note: `Payment ₹${verifiedAmount} verified by ${adminIdentity}${utrNormalized ? ` (UTR: ${utrNormalized})` : ''}`,
        },
        {
          status: 'Order Confirmed',
          timestamp: now,
          note: 'Order confirmed after payment verification',
        },
      ],
      paymentAuditLog: [...(state.orders[idx].paymentAuditLog || []), auditEntry],
    };
    await saveLocalFile(state);

    if (shouldDeduct) {
      await this.decrementProductStock(state.orders[idx].items);
    }
    await this.recordPaymentAudit(auditEntry);
    return state.orders[idx];
  },

  async rejectOrderPayment(
    orderIdOrNumber: string,
    params: { reason: string; adminIdentity?: string }
  ): Promise<Order> {
    const existing = await this.getOrderById(orderIdOrNumber);
    if (!existing) {
      throw new HttpError(404, 'Order not found');
    }
    if (existing.paymentStatus !== 'PAYMENT_PENDING' && existing.paymentStatus !== 'Pending') {
      throw new HttpError(409, `Cannot reject: Order payment status is already "${existing.paymentStatus}".`);
    }

    const reason = (params.reason || 'Transaction could not be verified in bank statement').trim();
    const adminIdentity = (params.adminIdentity || 'Kavinash (Admin)').trim();
    const now = new Date().toISOString();

    const auditEntry: PaymentAuditEntry = {
      id: `aud-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      orderId: existing.id,
      orderNumber: existing.orderNumber,
      action: 'PAYMENT_REJECTED',
      actor: adminIdentity,
      previousPaymentStatus: existing.paymentStatus,
      newPaymentStatus: 'REJECTED',
      utr: existing.paymentDetails?.utrNormalized,
      amount: existing.totalAmount,
      note: reason,
      timestamp: now,
    };

    const nextDetails = {
      ...(existing.paymentDetails || {}),
      rejectedAt: now,
      rejectedBy: adminIdentity,
      rejectionReason: reason,
    };

    const db = await getMongoDb();
    if (db) {
      const res = await db.collection('orders').findOneAndUpdate(
        { id: existing.id, paymentStatus: { $in: ['PAYMENT_PENDING', 'Pending'] } },
        {
          $set: {
            paymentStatus: 'REJECTED',
            orderStatus: 'Cancelled',
            paymentDetails: nextDetails,
            updatedAt: now,
          },
          $push: {
            statusHistory: {
              status: 'Cancelled',
              timestamp: now,
              note: `Payment rejected by ${adminIdentity}: ${reason}`,
            },
            paymentAuditLog: auditEntry,
          } as any,
        },
        { returnDocument: 'after' }
      );
      if (!res) {
        throw new HttpError(409, 'Order payment status was already modified.');
      }
      await this.recordPaymentAudit(auditEntry);
      const { _id, ...cleanOrder } = res as any;
      return cleanOrder as Order;
    }

    const state = ensureLocalFile();
    const idx = state.orders.findIndex(
      (o) => o.id === existing.id && ['PAYMENT_PENDING', 'Pending'].includes(o.paymentStatus)
    );
    if (idx === -1) {
      throw new HttpError(409, 'Order payment status was already modified.');
    }
    state.orders[idx] = {
      ...state.orders[idx],
      paymentStatus: 'REJECTED',
      orderStatus: 'Cancelled',
      paymentDetails: nextDetails,
      updatedAt: now,
      statusHistory: [
        ...state.orders[idx].statusHistory,
        {
          status: 'Cancelled',
          timestamp: now,
          note: `Payment rejected by ${adminIdentity}: ${reason}`,
        },
      ],
      paymentAuditLog: [...(state.orders[idx].paymentAuditLog || []), auditEntry],
    };
    await saveLocalFile(state);
    await this.recordPaymentAudit(auditEntry);
    return state.orders[idx];
  },

  async dispatchIdempotentPaymentWhatsApp(
    orderIdOrNumber: string,
    forceRetry: boolean = false
  ): Promise<{
    alreadySent: boolean;
    outbox: WhatsAppNotificationRecord;
    order: Order;
  }> {
    const order = await this.getOrderById(orderIdOrNumber);
    if (!order) {
      throw new HttpError(404, 'Order not found');
    }
    const isPaymentApproved = order.paymentStatus === 'PAID' || order.paymentStatus === 'Paid';
    const isCodConfirmed = order.paymentMethod === 'COD' && order.orderStatus !== 'Cancelled';
    if (!isPaymentApproved && !isCodConfirmed) {
      throw new HttpError(409, 'WhatsApp confirmation can only be sent after payment verification or COD confirmation.');
    }

    const idempotencyKey = `wa_payment_verified_${order.id}`;
    const now = new Date().toISOString();
    const payloadData = whatsappService.buildPaymentConfirmationPayload(order);
    const recipientPhone = whatsappService.normalizePhone(
      order.customer.fullPhone || order.customer.phone,
      order.customer.countryCode
    );

    const db = await getMongoDb();

    // Check existing outbox record for strict idempotency
    let existingOutbox: WhatsAppNotificationRecord | null = null;
    if (db) {
      const doc = await db.collection('whatsapp_notifications').findOne({ idempotencyKey });
      if (doc) {
        const { _id, ...rest } = doc as any;
        existingOutbox = rest as WhatsAppNotificationRecord;
      }
    } else {
      const state = ensureLocalFile();
      existingOutbox = (state.whatsappOutbox || []).find((w) => w.idempotencyKey === idempotencyKey) || null;
    }

    if (existingOutbox && existingOutbox.status === 'Sent') {
      return { alreadySent: true, outbox: existingOutbox, order };
    }
    if (existingOutbox && !forceRetry && existingOutbox.attempts >= existingOutbox.maxAttempts) {
      return { alreadySent: false, outbox: existingOutbox, order };
    }

    const baseOutbox: WhatsAppNotificationRecord = existingOutbox || {
      id: `wa-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      idempotencyKey,
      orderId: order.id,
      orderNumber: order.orderNumber,
      recipientPhone,
      customerName: order.customer.fullName,
      templateName: (process.env.WHATSAPP_TEMPLATE_NAME || '').trim() || undefined,
      messagePreview: payloadData.messageText,
      status: 'Pending',
      attempts: 0,
      maxAttempts: 5,
      createdAt: now,
      updatedAt: now,
    };

    if (order.whatsappConsent === false && !forceRetry) {
      const optOutRecord: WhatsAppNotificationRecord = {
        ...baseOutbox,
        status: 'Pending',
        reason: 'Customer did not opt in to WhatsApp updates at checkout',
        updatedAt: now,
      };
      if (db) {
        await db.collection('whatsapp_notifications').updateOne(
          { idempotencyKey },
          { $set: optOutRecord },
          { upsert: true }
        );
      } else {
        const state = ensureLocalFile();
        state.whatsappOutbox = (state.whatsappOutbox || []).filter((w) => w.idempotencyKey !== idempotencyKey);
        state.whatsappOutbox.unshift(optOutRecord);
        await saveLocalFile(state);
      }
      const updated = (await this.updateOrderSyncStatuses(order.id, {
        whatsappStatus: 'opted_out',
        whatsappError: optOutRecord.reason,
      })) as Order;
      return { alreadySent: false, outbox: optOutRecord, order: updated };
    }

    const result = await whatsappService.sendPaymentVerifiedNotification(order);
    const completedAt = new Date().toISOString();
    const updatedOutbox: WhatsAppNotificationRecord = {
      ...baseOutbox,
      status: result.status,
      reason: result.success ? undefined : result.error || result.reason,
      attempts: baseOutbox.attempts + Math.max(1, result.attempts || 1),
      whatsappMessageId: result.messageId || baseOutbox.whatsappMessageId,
      lastAttemptAt: completedAt,
      sentAt: result.sentAt || baseOutbox.sentAt,
      messagePreview: result.messagePreview,
      updatedAt: completedAt,
    };

    if (db) {
      await db.collection('whatsapp_notifications').updateOne(
        { idempotencyKey },
        { $set: updatedOutbox },
        { upsert: true }
      );
    } else {
      const state = ensureLocalFile();
      state.whatsappOutbox = (state.whatsappOutbox || []).filter((w) => w.idempotencyKey !== idempotencyKey);
      state.whatsappOutbox.unshift(updatedOutbox);
      await saveLocalFile(state);
    }

    const updatedOrder = (await this.updateOrderSyncStatuses(order.id, {
      whatsappStatus: result.status,
      whatsappMessageId: result.messageId,
      whatsappSentAt: result.sentAt,
      whatsappError: result.success ? undefined : result.error,
    })) as Order;

    await this.recordPaymentAudit({
      id: `aud-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      action: result.success ? 'WHATSAPP_SENT' : 'WHATSAPP_FAILED',
      actor: 'WhatsApp Cloud API Service',
      note: result.success
        ? `Confirmation sent to +${recipientPhone} (Message ID: ${result.messageId || 'accepted'})`
        : result.error || 'Notification queued as Pending/Failed',
      timestamp: completedAt,
    });

    return { alreadySent: false, outbox: updatedOutbox, order: updatedOrder };
  },

  async getWhatsAppOutboxAll(): Promise<WhatsAppNotificationRecord[]> {
    const db = await getMongoDb();
    if (db) {
      const docs = await db.collection('whatsapp_notifications').find({}).sort({ updatedAt: -1 }).limit(100).toArray();
      return docs.map((d: any) => {
        const { _id, ...rest } = d;
        return rest as WhatsAppNotificationRecord;
      });
    }
    const state = ensureLocalFile();
    return [...(state.whatsappOutbox || [])].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  },

  async getPaymentAuditLogs(limit: number = 100): Promise<PaymentAuditEntry[]> {
    const db = await getMongoDb();
    if (db) {
      const docs = await db.collection('payment_audit_logs').find({}).sort({ timestamp: -1 }).limit(limit).toArray();
      return docs.map((d: any) => {
        const { _id, ...rest } = d;
        return rest as PaymentAuditEntry;
      });
    }
    const state = ensureLocalFile();
    return (state.paymentAuditLogs || []).slice(0, limit);
  },

  async updateOrderSyncStatuses(
    orderId: string,
    updates: {
      whatsappStatus?: 'Pending' | 'Sent' | 'Failed' | 'pending' | 'sent' | 'failed' | 'not_configured' | 'opted_out';
      whatsappMessageId?: string;
      whatsappSentAt?: string;
      whatsappError?: string;
      excelSyncStatus?: 'pending' | 'synced' | 'failed' | 'not_configured';
      excelSyncAt?: string;
      excelError?: string;
    }
  ): Promise<Order | null> {
    const now = new Date().toISOString();
    let db = await getMongoDb();
    if (db) {
      await db.collection('orders').updateOne(
        { $or: [{ id: orderId }, { orderNumber: orderId }] },
        { $set: { ...updates, updatedAt: now } }
      );
      const updated = await db.collection('orders').findOne({
        $or: [{ id: orderId }, { orderNumber: orderId }],
      });
      if (!updated) return null;
      const { _id, ...rest } = updated as any;
      return rest as Order;
    }

    const state = ensureLocalFile();
    const index = state.orders.findIndex((o) => o.id === orderId || o.orderNumber === orderId);
    if (index === -1) return null;
    state.orders[index] = { ...state.orders[index], ...updates, updatedAt: now };
    await saveLocalFile(state);
    return state.orders[index];
  },

  async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    note?: string
  ): Promise<{ order: Order; previousStatus: OrderStatus; changed: boolean } | null> {
    const now = new Date().toISOString();
    let db = await getMongoDb();
    if (!db && MONGODB_URI) {
      mongoFailedUntil = 0;
      db = await getMongoDb();
    }

    if (db) {
      const existing = await db.collection('orders').findOne({
        $or: [{ id: orderId }, { orderNumber: orderId }],
      });
      if (!existing) return null;

      const previousStatus = existing.orderStatus as OrderStatus;
      if (previousStatus === status) {
        // Status has not changed; avoid duplicate history or duplicate notifications
        const { _id, ...rest } = existing as any;
        return { order: rest as Order, previousStatus, changed: false };
      }

      const newHistoryItem = {
        status,
        timestamp: now,
        note: note || `Status updated to ${status} by Administrator`,
      };

      await db.collection('orders').updateOne(
        { _id: existing._id },
        {
          $set: {
            orderStatus: status,
            paymentStatus: status === 'Delivered' && existing.paymentMethod === 'COD' ? 'Paid' : existing.paymentStatus,
            updatedAt: now,
          },
          $push: { statusHistory: newHistoryItem } as any,
        } as any
      );

      const updated = await db.collection('orders').findOne({ _id: existing._id });
      const { _id, ...rest } = updated as any;
      return { order: rest as Order, previousStatus, changed: true };
    }

    const state = ensureLocalFile();
    const index = state.orders.findIndex((o) => o.id === orderId || o.orderNumber === orderId);
    if (index === -1) return null;

    const order = state.orders[index];
    const previousStatus = order.orderStatus;
    if (previousStatus === status) {
      return { order, previousStatus, changed: false };
    }

    order.orderStatus = status;
    order.updatedAt = now;
    if (status === 'Delivered' && order.paymentMethod === 'COD') {
      order.paymentStatus = 'Paid';
    }
    order.statusHistory.push({
      status,
      timestamp: now,
      note: note || `Status updated to ${status} by Administrator`,
    });

    await saveLocalFile(state);
    return { order, previousStatus, changed: true };
  },

  // ===================== CUSTOMERS / USERS =====================

  async getUserByPhone(phone: string): Promise<UserDocument | null> {
    const cleanPhone = phone.replace(/\D/g, '');
    const db = await getMongoDb();
    if (db) {
      const doc = await db.collection('users').findOne({ phone: cleanPhone });
      if (!doc) return null;
      const { _id, ...rest } = doc;
      return rest as UserDocument;
    }

    const state = ensureLocalFile();
    const user = state.users.find((u) => u.phone.replace(/\D/g, '') === cleanPhone);
    return user || null;
  },

  async getUserByEmail(email: string): Promise<UserDocument | null> {
    if (!email) return null;
    const cleanEmail = email.trim().toLowerCase();
    const db = await getMongoDb();
    if (db) {
      const doc = await db.collection('users').findOne({ email: cleanEmail });
      if (!doc) return null;
      const { _id, ...rest } = doc;
      return rest as UserDocument;
    }
    const state = ensureLocalFile();
    const user = state.users.find((u) => u.email && u.email.toLowerCase() === cleanEmail);
    return user || null;
  },

  async getUserByFirebaseUid(uid: string): Promise<UserDocument | null> {
    if (!uid) return null;
    const db = await getMongoDb();
    if (db) {
      const doc = await db.collection('users').findOne({ firebaseUid: uid });
      if (!doc) return null;
      const { _id, ...rest } = doc;
      return rest as UserDocument;
    }
    const state = ensureLocalFile();
    const user = state.users.find((u) => u.firebaseUid === uid);
    return user || null;
  },

  async upsertFirebaseUser(data: {
    firebaseUid: string;
    email?: string;
    phone?: string;
    fullName: string;
    authProvider: 'google' | 'phone' | 'email';
    emailVerified?: boolean;
    phoneVerified?: boolean;
    initialAddress?: Partial<CustomerAddress>;
  }): Promise<UserDocument> {
    const now = new Date().toISOString();
    const cleanEmail = data.email ? data.email.trim().toLowerCase() : undefined;
    const cleanPhone = data.phone ? data.phone.replace(/\D/g, '').slice(-10) : '';

    // Check if user already exists by firebaseUid, email, or phone
    let existing: UserDocument | null = await this.getUserByFirebaseUid(data.firebaseUid);
    if (!existing && cleanEmail) {
      existing = await this.getUserByEmail(cleanEmail);
    }
    if (!existing && cleanPhone) {
      existing = await this.getUserByPhone(cleanPhone);
    }

    if (existing) {
      // Update existing user with verified credentials
      const updates: Partial<UserDocument> = {
        firebaseUid: data.firebaseUid,
        authProvider: data.authProvider,
        updatedAt: now,
      };
      if (data.emailVerified !== undefined) updates.emailVerified = data.emailVerified;
      if (data.phoneVerified !== undefined) updates.phoneVerified = data.phoneVerified;
      if (cleanEmail && !existing.email) updates.email = cleanEmail;
      if (cleanPhone && !existing.phone) updates.phone = cleanPhone;
      if (data.fullName && (!existing.fullName || existing.fullName === 'Guest Customer')) {
        updates.fullName = data.fullName.trim();
      }

      const db = await getMongoDb();
      if (db) {
        await db.collection('users').updateOne(
          { id: existing.id },
          { $set: updates }
        );
        const updated = await this.getUserById(existing.id);
        return updated || { ...existing, ...updates };
      }

      const state = ensureLocalFile();
      const idx = state.users.findIndex((u) => u.id === existing!.id);
      if (idx >= 0) {
        state.users[idx] = { ...state.users[idx], ...updates };
        await saveLocalFile(state);
        return state.users[idx];
      }
      return { ...existing, ...updates };
    }

    // Create new customer record
    const userId = `usr-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const addresses: CustomerAddress[] = [];
    if (data.initialAddress && data.initialAddress.addressLine) {
      addresses.push({
        id: `addr-${Date.now()}-1`,
        label: data.initialAddress.label || 'Home',
        recipientName: data.initialAddress.recipientName || data.fullName,
        phone: data.initialAddress.phone || cleanPhone,
        addressLine: data.initialAddress.addressLine,
        landmark: data.initialAddress.landmark || '',
        villageTown: data.initialAddress.villageTown || '',
        district: data.initialAddress.district || '',
        state: data.initialAddress.state || 'Tamil Nadu',
        pincode: data.initialAddress.pincode || '',
        isDefault: true,
        coordinates: data.initialAddress.coordinates,
        createdAt: now,
      });
    }

    const newUser: UserDocument = {
      id: userId,
      fullName: data.fullName.trim() || 'Valued Customer',
      phone: cleanPhone,
      email: cleanEmail || '',
      firebaseUid: data.firebaseUid,
      authProvider: data.authProvider,
      emailVerified: Boolean(data.emailVerified),
      phoneVerified: Boolean(data.phoneVerified),
      addresses,
      createdAt: now,
      updatedAt: now,
    };

    const db = await getMongoDb();
    if (db) {
      await db.collection('users').insertOne(newUser as any);
      return newUser;
    }

    const state = ensureLocalFile();
    state.users.push(newUser);
    await saveLocalFile(state);
    return newUser;
  },

  async getUserById(id: string): Promise<UserDocument | null> {
    const db = await getMongoDb();
    if (db) {
      const doc = await db.collection('users').findOne({ id });
      if (!doc) return null;
      const { _id, ...rest } = doc;
      return rest as UserDocument;
    }

    const state = ensureLocalFile();
    const user = state.users.find((u) => u.id === id);
    return user || null;
  },

  async createUser(userData: {
    fullName: string;
    phone: string;
    email?: string;
    passwordHash: string;
    initialAddress?: Partial<CustomerAddress>;
  }): Promise<UserDocument> {
    const cleanPhone = userData.phone.replace(/\D/g, '');
    const now = new Date().toISOString();
    const userId = `usr-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    const addresses: CustomerAddress[] = [];
    if (userData.initialAddress && userData.initialAddress.addressLine) {
      addresses.push({
        id: `addr-${Date.now()}-1`,
        label: userData.initialAddress.label || 'Home',
        recipientName: userData.initialAddress.recipientName || userData.fullName,
        phone: userData.initialAddress.phone || cleanPhone,
        addressLine: userData.initialAddress.addressLine,
        landmark: userData.initialAddress.landmark || '',
        villageTown: userData.initialAddress.villageTown || '',
        district: userData.initialAddress.district || '',
        state: userData.initialAddress.state || 'Tamil Nadu',
        pincode: userData.initialAddress.pincode || '',
        isDefault: true,
        coordinates: userData.initialAddress.coordinates,
        createdAt: now,
      });
    }

    const newUser: UserDocument = {
      id: userId,
      fullName: userData.fullName.trim(),
      phone: cleanPhone,
      email: userData.email?.trim() || '',
      passwordHash: userData.passwordHash,
      addresses,
      createdAt: now,
      updatedAt: now,
    };

    let db = await getMongoDb();
    if (!db && MONGODB_URI) {
      mongoFailedUntil = 0;
      db = await getMongoDb();
    }

    if (db) {
      await db.collection('users').insertOne(newUser as any);
      return newUser;
    }

    const state = ensureLocalFile();
    state.users.push(newUser);
    await saveLocalFile(state);
    return newUser;
  },

  async updateUserProfile(userId: string, updates: { fullName?: string; email?: string }): Promise<UserDocument | null> {
    const now = new Date().toISOString();
    const db = await getMongoDb();
    if (db) {
      const res = await db.collection('users').findOneAndUpdate(
        { id: userId },
        { $set: { ...updates, updatedAt: now } },
        { returnDocument: 'after' }
      );
      if (!res) return null;
      const { _id, ...rest } = res as any;
      return rest as UserDocument;
    }

    const state = ensureLocalFile();
    const user = state.users.find((u) => u.id === userId);
    if (!user) return null;
    if (updates.fullName) user.fullName = updates.fullName.trim();
    if (updates.email !== undefined) user.email = updates.email.trim();
    user.updatedAt = now;
    await saveLocalFile(state);
    return user;
  },

  // ===================== ADDRESSES =====================

  async getUserAddresses(userId: string): Promise<CustomerAddress[]> {
    const user = await this.getUserById(userId);
    return user ? user.addresses : [];
  },

  async addAddress(userId: string, addressData: Omit<CustomerAddress, 'id'>): Promise<CustomerAddress | null> {
    const now = new Date().toISOString();
    const addrId = `addr-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    const newAddress: CustomerAddress = {
      ...addressData,
      id: addrId,
      createdAt: now,
    };

    const db = await getMongoDb();
    if (db) {
      const user = await db.collection('users').findOne({ id: userId });
      if (!user) return null;

      let addresses: CustomerAddress[] = user.addresses || [];
      if (newAddress.isDefault || addresses.length === 0) {
        newAddress.isDefault = true;
        addresses = addresses.map((a) => ({ ...a, isDefault: false }));
      }
      addresses.push(newAddress);

      await db.collection('users').updateOne(
        { id: userId },
        { $set: { addresses, updatedAt: now } }
      );
      return newAddress;
    }

    const state = ensureLocalFile();
    const user = state.users.find((u) => u.id === userId);
    if (!user) return null;

    if (newAddress.isDefault || user.addresses.length === 0) {
      newAddress.isDefault = true;
      user.addresses.forEach((a) => { a.isDefault = false; });
    }
    user.addresses.push(newAddress);
    user.updatedAt = now;
    await saveLocalFile(state);
    return newAddress;
  },

  async updateAddress(userId: string, addressId: string, updates: Partial<CustomerAddress>): Promise<CustomerAddress | null> {
    const now = new Date().toISOString();
    const db = await getMongoDb();
    if (db) {
      const user = await db.collection('users').findOne({ id: userId });
      if (!user) return null;

      const addresses: CustomerAddress[] = user.addresses || [];
      const idx = addresses.findIndex((a) => a.id === addressId);
      if (idx === -1) return null;

      if (updates.isDefault) {
        addresses.forEach((a) => { a.isDefault = false; });
      }

      addresses[idx] = { ...addresses[idx], ...updates, id: addressId };
      await db.collection('users').updateOne({ id: userId }, { $set: { addresses, updatedAt: now } });
      return addresses[idx];
    }

    const state = ensureLocalFile();
    const user = state.users.find((u) => u.id === userId);
    if (!user) return null;
    const idx = user.addresses.findIndex((a) => a.id === addressId);
    if (idx === -1) return null;

    if (updates.isDefault) {
      user.addresses.forEach((a) => { a.isDefault = false; });
    }
    user.addresses[idx] = { ...user.addresses[idx], ...updates, id: addressId };
    user.updatedAt = now;
    await saveLocalFile(state);
    return user.addresses[idx];
  },

  async deleteAddress(userId: string, addressId: string): Promise<boolean> {
    const db = await getMongoDb();
    if (db) {
      const user = await db.collection('users').findOne({ id: userId });
      if (!user) return false;

      const filtered = (user.addresses || []).filter((a: CustomerAddress) => a.id !== addressId);
      if (filtered.length > 0 && !filtered.some((a: CustomerAddress) => a.isDefault)) {
        filtered[0].isDefault = true;
      }
      await db.collection('users').updateOne({ id: userId }, { $set: { addresses: filtered, updatedAt: new Date().toISOString() } });
      return true;
    }

    const state = ensureLocalFile();
    const user = state.users.find((u) => u.id === userId);
    if (!user) return false;
    user.addresses = user.addresses.filter((a) => a.id !== addressId);
    if (user.addresses.length > 0 && !user.addresses.some((a) => a.isDefault)) {
      user.addresses[0].isDefault = true;
    }
    await saveLocalFile(state);
    return true;
  },

  // ===================== WEBHOOK OUTBOX =====================

  async saveOutboxRecord(record: WebhookOutboxRecord): Promise<void> {
    const db = await getMongoDb();
    if (db) {
      await db.collection('webhook_outbox').insertOne(record as any);
      return;
    }
    const state = ensureLocalFile();
    state.webhookEvents = state.webhookEvents || [];
    state.webhookEvents.push(record);
    await saveLocalFile(state);
  },

  async updateOutboxRecord(id: string, updates: Partial<WebhookOutboxRecord>): Promise<void> {
    const db = await getMongoDb();
    if (db) {
      await db.collection('webhook_outbox').updateOne({ id }, { $set: updates });
      return;
    }
    const state = ensureLocalFile();
    if (!state.webhookEvents) return;
    const idx = state.webhookEvents.findIndex((r) => r.id === id);
    if (idx >= 0) {
      state.webhookEvents[idx] = { ...state.webhookEvents[idx], ...updates };
      await saveLocalFile(state);
    }
  },

  async getPendingOutboxRecords(limit = 25): Promise<WebhookOutboxRecord[]> {
    const db = await getMongoDb();
    if (db) {
      const docs = await db.collection('webhook_outbox')
        .find({ status: { $in: ['pending', 'failed'] } })
        .sort({ createdAt: 1 })
        .limit(limit)
        .toArray();
      return docs.map((d: any) => {
        const { _id, ...rest } = d;
        return rest as WebhookOutboxRecord;
      });
    }
    const state = ensureLocalFile();
    return (state.webhookEvents || [])
      .filter((r) => r.status === 'pending' || r.status === 'failed')
      .slice(0, limit);
  },

  async getOutboxStats(): Promise<{ total: number; delivered: number; pending: number; failed: number; webhookUrlConfigured: boolean }> {
    const webhookUrlConfigured = Boolean(process.env.N8N_WEBHOOK_URL || process.env.ORDER_BACKUP_WEBHOOK_URL);
    const db = await getMongoDb();
    if (db) {
      const total = await db.collection('webhook_outbox').countDocuments();
      const delivered = await db.collection('webhook_outbox').countDocuments({ status: 'delivered' });
      const pending = await db.collection('webhook_outbox').countDocuments({ status: 'pending' });
      const failed = await db.collection('webhook_outbox').countDocuments({ status: 'failed' });
      return { total, delivered, pending, failed, webhookUrlConfigured };
    }
    const state = ensureLocalFile();
    const list = state.webhookEvents || [];
    return {
      total: list.length,
      delivered: list.filter((r) => r.status === 'delivered').length,
      pending: list.filter((r) => r.status === 'pending').length,
      failed: list.filter((r) => r.status === 'failed').length,
      webhookUrlConfigured,
    };
  },

  // ===================== PRODUCTS =====================

  async getAllProducts(onlyActive: boolean = false): Promise<Product[]> {
    const db = await getMongoDb();
    let list: Product[] = [];

    if (db) {
      const docs = await db.collection('products').find({}).toArray();
      const hasBriar = docs.some((d: any) => d.id === 'prod-briar-talayar' || d.sku === 'BRIAR-TALAYAR-500G');
      if (!hasBriar || docs.length === 0) {
        const briar = INITIAL_PRODUCTS.find((p) => p.id === 'prod-briar-talayar') || INITIAL_PRODUCTS[0];
        await db.collection('products').updateOne(
          { id: briar.id },
          { $set: briar },
          { upsert: true }
        ).catch(() => {});
        // Deactivate other existing products without permanently deleting them
        await db.collection('products').updateMany(
          { id: { $ne: briar.id } },
          { $set: { status: 'draft', published: false } }
        ).catch(() => {});

        const updatedDocs = await db.collection('products').find({}).toArray();
        list = updatedDocs.map((d: any) => {
          const { _id, ...rest } = d;
          return rest as Product;
        });
      } else {
        list = docs.map((d: any) => {
          const { _id, ...rest } = d;
          return rest as Product;
        });
      }
    } else {
      const state = ensureLocalFile();
      const hasBriar = state.products && state.products.some((p: any) => p.id === 'prod-briar-talayar');
      if (!hasBriar) {
        state.products = INITIAL_PRODUCTS;
        await saveLocalFile(state);
      }
      list = state.products;
    }

    if (onlyActive) {
      return list.filter((p: any) => (p.status === 'published' || p.status === 'active' || (!p.status && p.inStock !== false)) && p.published !== false);
    }
    return list;
  },

  async getProductById(id: string): Promise<Product | null> {
    const products = await this.getAllProducts(false);
    return products.find((p) => p.id === id || p.slug === id) || null;
  },

  async saveProduct(product: Partial<Product> & { published?: boolean }): Promise<Product> {
    const now = new Date().toISOString();
    const id = product.id || `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const slug = product.slug || product.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || id;
    const sku = product.sku || `KVN-${Date.now().toString().slice(-6)}`;

    const rawVariants = product.variants && product.variants.length > 0 ? product.variants : [
      { id: 'v1', weight: '500g', mrp: 205, sellingPrice: 200, stock: 30 },
    ];
    const variants = rawVariants.map((v: any, idx: number) => {
      const sellingPrice = Number(v.sellingPrice ?? v.price ?? 200);
      const mrp = Number(v.mrp ?? v.originalPrice ?? sellingPrice);
      const stock = Number(v.stock !== undefined ? v.stock : 0);
      return {
        id: v.id || `var-${id}-${idx + 1}`,
        weight: v.weight || '500g',
        mrp,
        sellingPrice,
        stock,
        sku: v.sku || `${sku}-${idx + 1}`,
      };
    });
    const totalStock = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
    const resolvedStatus = product.published === false ? 'draft' : ((product.status as any) || 'published');
    const inStock = totalStock > 0 && resolvedStatus !== 'archived';

    const completeProduct: any = {
      id,
      sku,
      name: product.name || 'KVN Special Tea Powder',
      slug,
      categorySlug: product.categorySlug || 'premium-tea',
      mainCategory: product.mainCategory || 'tea',
      brand: product.brand || 'KVN TEAPOWDER',
      description: product.description || '',
      brewingInstructions: product.brewingInstructions || '',
      ingredients: product.ingredients || '',
      images: product.images && product.images.length > 0 ? product.images : ['https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=800&q=80'],
      variants,
      inStock,
      stockCount: totalStock,
      price: variants[0]?.sellingPrice || 120,
      isFeatured: Boolean(product.isFeatured),
      isBestSeller: Boolean(product.isBestSeller),
      isNewArrival: product.isNewArrival !== undefined ? Boolean(product.isNewArrival) : true,
      status: resolvedStatus,
      published: resolvedStatus === 'published',
      createdAt: product.createdAt || now,
      updatedAt: now,
    };

    const db = await getMongoDb();
    if (db) {
      await db.collection('products').updateOne(
        { id: completeProduct.id },
        { $set: completeProduct },
        { upsert: true }
      );
    }

    const state = ensureLocalFile();
    state.products = state.products || [];
    const idx = state.products.findIndex((p) => p.id === completeProduct.id);
    if (idx >= 0) {
      state.products[idx] = completeProduct;
    } else {
      state.products.push(completeProduct);
    }
    await saveLocalFile(state);

    return completeProduct;
  },

  async updateProduct(id: string, updates: Partial<Product> & { published?: boolean; inStock?: boolean; stockCount?: number; [key: string]: any }): Promise<Product | null> {
    const existing = await this.getProductById(id);
    if (!existing) return null;
    const merged = { ...existing, ...updates, id, updatedAt: new Date().toISOString() };
    if (updates.variants) {
      const totalStock = updates.variants.reduce((sum: number, v: any) => sum + (Number(v.stock) || 0), 0);
      merged.stockCount = totalStock;
      merged.inStock = totalStock > 0 && merged.status !== 'archived';
    }
    return this.saveProduct(merged);
  },

  async deleteProduct(id: string): Promise<boolean> {
    const db = await getMongoDb();
    if (db) {
      const res = await db.collection('products').deleteOne({ id });
      return res.deletedCount > 0;
    }

    const state = ensureLocalFile();
    if (!state.products) return false;
    const initialLen = state.products.length;
    state.products = state.products.filter((p) => p.id !== id);
    if (state.products.length !== initialLen) {
      await saveLocalFile(state);
      return true;
    }
    return false;
  },

  async decrementProductStock(items: any[]): Promise<void> {
    if (!items || !items.length) return;
    const db = await getMongoDb();

    if (db) {
      for (const item of items) {
        if (!item.productId) continue;
        const prodDoc = await db.collection('products').findOne({ id: item.productId });
        if (prodDoc && Array.isArray(prodDoc.variants)) {
          const updatedVariants = prodDoc.variants.map((v: any) => {
            if (v.id === item.variantId || v.weight === item.weight) {
              const current = Number(v.stock) || 0;
              const qty = Math.max(1, Number(item.quantity) || 1);
              return { ...v, stock: Math.max(0, current - qty) };
            }
            return v;
          });
          const totalStock = updatedVariants.reduce((sum: number, v: any) => sum + (Number(v.stock) || 0), 0);
          await db.collection('products').updateOne(
            { id: item.productId },
            {
              $set: {
                variants: updatedVariants,
                stockCount: totalStock,
                inStock: totalStock > 0 && prodDoc.status !== 'archived',
                updatedAt: new Date().toISOString(),
              },
            }
          ).catch(() => {});
        }
      }
      return;
    }

    const state = ensureLocalFile();
    if (!state.products) return;
    for (const item of items) {
      const prod: any = state.products.find((p) => p.id === item.productId);
      if (prod && prod.variants) {
        const variant = prod.variants.find((v: any) => v.id === item.variantId || v.weight === item.weight);
        if (variant) {
          variant.stock = Math.max(0, (Number(variant.stock) || 0) - Math.max(1, Number(item.quantity) || 1));
        }
        const totalStock = prod.variants.reduce((sum: number, v: any) => sum + (Number(v.stock) || 0), 0);
        prod.stockCount = totalStock;
        prod.inStock = totalStock > 0 && prod.status !== 'archived';
        prod.updatedAt = new Date().toISOString();
      }
    }
    await saveLocalFile(state);
  },

  // ===================== CATEGORIES =====================

  async getAllCategories(): Promise<Category[]> {
    const db = await getMongoDb();
    if (db) {
      const docs = await db.collection('categories').find({}).toArray();
      if (docs.length > 0) {
        return docs.map((d: any) => {
          const { _id, ...rest } = d;
          return rest as Category;
        });
      }
      await db.collection('categories').insertMany(INITIAL_CATEGORIES as any).catch(() => {});
      return INITIAL_CATEGORIES;
    }

    const state = ensureLocalFile();
    if (!state.categories || state.categories.length === 0) {
      state.categories = INITIAL_CATEGORIES;
      await saveLocalFile(state);
    }
    return state.categories;
  },

  async saveCategory(category: Category): Promise<Category> {
    const id = category.id || `cat-${Date.now()}`;
    const cleanCat = { ...category, id };

    const db = await getMongoDb();
    if (db) {
      await db.collection('categories').updateOne(
        { id },
        { $set: cleanCat },
        { upsert: true }
      );
    }

    const state = ensureLocalFile();
    state.categories = state.categories || [];
    const idx = state.categories.findIndex((c) => c.id === id);
    if (idx >= 0) {
      state.categories[idx] = cleanCat;
    } else {
      state.categories.push(cleanCat);
    }
    await saveLocalFile(state);

    return cleanCat;
  },

  async deleteCategory(id: string): Promise<boolean> {
    const db = await getMongoDb();
    if (db) {
      const res = await db.collection('categories').deleteOne({ id });
      return res.deletedCount > 0;
    }

    const state = ensureLocalFile();
    if (!state.categories) return false;
    const initialLen = state.categories.length;
    state.categories = state.categories.filter((c) => c.id !== id);
    if (state.categories.length !== initialLen) {
      await saveLocalFile(state);
      return true;
    }
    return false;
  },
};
