import { MongoClient, Db } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { Order, OrderStatus, CustomerAddress } from '../../src/types';
import { INITIAL_PRODUCTS } from '../../src/data/initialData';
import { UserDocument, StoreState } from './types';

let cachedMongoClient: MongoClient | null = null;
let cachedDb: Db | null = null;

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

function ensureLocalFile(): StoreState {
  const filePath = getLocalFilePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      // ignore
    }
  }

  if (!fs.existsSync(filePath)) {
    const initialState: StoreState = {
      orders: [],
      users: [],
      products: INITIAL_PRODUCTS,
      lastUpdated: new Date().toISOString(),
    };
    try {
      fs.writeFileSync(filePath, JSON.stringify(initialState, null, 2), 'utf-8');
    } catch {
      // ignore
    }
    return initialState;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {
      orders: [],
      users: [],
      products: INITIAL_PRODUCTS,
      lastUpdated: new Date().toISOString(),
    };
  }
}

let fileWriteLock = Promise.resolve();

async function saveLocalFile(state: StoreState): Promise<void> {
  fileWriteLock = fileWriteLock.then(async () => {
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
    await fs.promises.writeFile(filePath, JSON.stringify(state, null, 2), 'utf-8');
  });
  return fileWriteLock;
}

let isMongoConnecting = false;
let mongoFailedUntil = 0;

/**
 * Connect to MongoDB Atlas if connection string exists.
 */
async function getMongoDb(): Promise<Db | null> {
  if (!MONGODB_URI) {
    return null;
  }

  // If connection failed recently (e.g. IP whitelist issue), back off to prevent Vercel 10s function timeouts
  if (Date.now() < mongoFailedUntil) {
    return null;
  }

  if (cachedDb) {
    return cachedDb;
  }

  if (isMongoConnecting) {
    return null;
  }

  try {
    isMongoConnecting = true;
    if (!cachedMongoClient) {
      cachedMongoClient = new MongoClient(MONGODB_URI, {
        connectTimeoutMS: 2500,
        serverSelectionTimeoutMS: 2500,
      });
      await cachedMongoClient.connect();
    }
    cachedDb = cachedMongoClient.db(MONGODB_DB_NAME);
    isMongoConnecting = false;

    // Ensure indexes once in background
    cachedDb.collection('orders').createIndex({ orderNumber: 1 }, { unique: true }).catch(() => {});
    cachedDb.collection('orders').createIndex({ 'customer.phone': 1 }).catch(() => {});
    cachedDb.collection('orders').createIndex({ createdAt: -1 }).catch(() => {});
    cachedDb.collection('users').createIndex({ phone: 1 }, { unique: true }).catch(() => {});

    return cachedDb;
  } catch (err) {
    isMongoConnecting = false;
    mongoFailedUntil = Date.now() + 60000; // 1-minute backoff
    console.warn('MongoDB Atlas connection timed out or failed. Operating in high-performance persistent fallback store:', err);
    return null;
  }
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

  async createOrder(orderData: Partial<Order> & { customer: any; items: any; totalAmount: number }): Promise<Order> {
    const now = new Date().toISOString();
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const orderId = `ord-${Date.now()}-${randomSuffix}`;
    const orderNumber = `KVN-${Date.now().toString().slice(-6)}-${randomSuffix}`;

    const newOrder: Order = {
      id: orderId,
      orderNumber,
      customer: orderData.customer,
      items: orderData.items,
      subtotal: orderData.subtotal || 0,
      deliveryCharge: orderData.deliveryCharge || 0,
      discountAmount: orderData.discountAmount || 0,
      totalAmount: orderData.totalAmount,
      paymentMethod: orderData.paymentMethod || 'COD',
      paymentStatus: orderData.paymentStatus || 'Pending',
      orderStatus: orderData.orderStatus || 'Order Confirmed',
      statusHistory: [
        {
          status: orderData.orderStatus || 'Order Confirmed',
          timestamp: now,
          note: 'Order placed by customer via online store',
        },
      ],
      notes: orderData.notes || '',
      createdAt: now,
      updatedAt: now,
    };

    const db = await getMongoDb();
    if (db) {
      await db.collection('orders').insertOne(newOrder as any);
      return newOrder;
    }

    const state = ensureLocalFile();
    state.orders.unshift(newOrder);
    await saveLocalFile(state);
    return newOrder;
  },

  async updateOrderStatus(orderId: string, status: OrderStatus, note?: string): Promise<Order | null> {
    const now = new Date().toISOString();
    const db = await getMongoDb();
    if (db) {
      const existing = await db.collection('orders').findOne({
        $or: [{ id: orderId }, { orderNumber: orderId }],
      });
      if (!existing) return null;

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
          $push: { statusHistory: newHistoryItem as any },
        }
      );

      const updated = await db.collection('orders').findOne({ _id: existing._id });
      const { _id, ...rest } = updated as any;
      return rest as Order;
    }

    const state = ensureLocalFile();
    const index = state.orders.findIndex((o) => o.id === orderId || o.orderNumber === orderId);
    if (index === -1) return null;

    const order = state.orders[index];
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
    return order;
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
};
