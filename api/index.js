// server/index.ts
import express from "express";

// server/_lib/db.ts
import { MongoClient } from "mongodb";
import fs from "fs";
import path from "path";

// src/data/initialData.ts
var INITIAL_BUSINESS_CONFIG = {
  name: "KVN TEAPOWDER",
  owner: "KRISHNAMOORTHY",
  primaryPhone: "9787513911",
  secondaryPhone: "6383050287",
  email: "krishnamoorthykavinash@gmail.com",
  defaultDeliveryCharge: 30,
  freeDeliveryThreshold: 500,
  fssaiNumber: "",
  gstNumber: ""
};
var INITIAL_PRODUCTS = [
  {
    id: "prod-1",
    sku: "KVN-TEA-PREM-01",
    name: "KVN Premium Leaf Tea Powder",
    slug: "kvn-premium-leaf-tea-powder",
    categorySlug: "premium-tea",
    mainCategory: "tea",
    brand: "KVN TEAPOWDER",
    description: "Expertly selected garden-fresh CTC tea leaves harvested from Nilgiri hill slopes. Blended with precision to deliver an exquisite golden liquor, brisk flavor, and comforting home aroma.",
    brewingInstructions: "Boil fresh water and milk in 1:1 ratio. Add 1 teaspoon (2.5g) KVN Premium Tea powder per cup. Simmer for 3 minutes. Add sugar/jaggery to taste, strain and serve piping hot.",
    ingredients: "100% Pure Indian CTC Black Tea Leaves",
    images: [
      "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?auto=format&fit=crop&w=800&q=80"
    ],
    variants: [
      { id: "var-1-1", weight: "250g", mrp: 130, sellingPrice: 115, stock: 48 },
      { id: "var-1-2", weight: "500g", mrp: 250, sellingPrice: 220, stock: 35 },
      { id: "var-1-3", weight: "1kg", mrp: 480, sellingPrice: 420, stock: 20 }
    ],
    isFeatured: true,
    isBestSeller: true,
    isNewArrival: false,
    status: "published",
    createdAt: "2026-08-01T08:00:00Z",
    updatedAt: "2026-09-01T10:00:00Z"
  },
  {
    id: "prod-2",
    sku: "KVN-TEA-STR-02",
    name: "KVN Super Kadak Strong Tea",
    slug: "kvn-super-kadak-strong-tea",
    categorySlug: "strong-tea",
    mainCategory: "tea",
    brand: "KVN TEAPOWDER",
    description: "Specially crafted for true tea lovers who enjoy deep color and robust body in every glass. Delivers an unmatched brisk strength that kicks away morning lethargy.",
    brewingInstructions: "Add 1 teaspoon per cup in boiling water and milk mix. Boil well for 4 minutes for maximum color and rich taste.",
    ingredients: "Select High-Grown Strong CTC Black Tea Dust & Fannings",
    images: [
      "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1561047029-3000c68339ca?auto=format&fit=crop&w=800&q=80"
    ],
    variants: [
      { id: "var-2-1", weight: "250g", mrp: 115, sellingPrice: 100, stock: 55 },
      { id: "var-2-2", weight: "500g", mrp: 220, sellingPrice: 195, stock: 40 },
      { id: "var-2-3", weight: "1kg", mrp: 430, sellingPrice: 380, stock: 25 }
    ],
    isFeatured: true,
    isBestSeller: true,
    isNewArrival: false,
    status: "published",
    createdAt: "2026-08-05T08:00:00Z",
    updatedAt: "2026-09-01T10:00:00Z"
  },
  {
    id: "prod-3",
    sku: "KVN-COF-FIL-03",
    name: "KVN Traditional South Indian Filter Coffee",
    slug: "kvn-traditional-south-indian-filter-coffee",
    categorySlug: "filter-coffee",
    mainCategory: "coffee",
    brand: "KVN TEAPOWDER",
    description: "Slow roasted Chikmagalur coffee beans with authentic 80:20 chicory ratio. Provides thick, fragrant decoction with a rich frothy head when poured with fresh farm milk.",
    brewingInstructions: "Add 2 tablespoons into top compartment of brass/stainless steel coffee filter. Pour 100ml boiling water, cover and allow 10 minutes to drip decoction. Mix decoction with boiling milk and sugar in davarah tumbler.",
    ingredients: "80% Roasted Coffee, 20% Chicory",
    images: [
      "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?auto=format&fit=crop&w=800&q=80"
    ],
    variants: [
      { id: "var-3-1", weight: "200g", mrp: 160, sellingPrice: 140, stock: 32 },
      { id: "var-3-2", weight: "500g", mrp: 380, sellingPrice: 330, stock: 22 },
      { id: "var-3-3", weight: "1kg", mrp: 720, sellingPrice: 640, stock: 12 }
    ],
    isFeatured: true,
    isBestSeller: true,
    isNewArrival: false,
    status: "published",
    createdAt: "2026-08-10T08:00:00Z",
    updatedAt: "2026-09-01T10:00:00Z"
  },
  {
    id: "prod-4",
    sku: "KVN-COF-PREM-04",
    name: "KVN 100% Pure Arabica Coffee Powder",
    slug: "kvn-100-percent-pure-arabica-coffee",
    categorySlug: "premium-coffee",
    mainCategory: "coffee",
    brand: "KVN TEAPOWDER",
    description: "Zero chicory. Single-origin shade-grown Arabica beans medium roasted to capture delicate caramel, chocolate, and floral notes. Perfect for French press, drip, or black coffee.",
    brewingInstructions: "Use 10g medium-ground powder per 180ml hot water (92\xB0C). Brew for 4 minutes and press or pour.",
    ingredients: "100% Pure Roasted Arabica Coffee Beans",
    images: [
      "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=800&q=80"
    ],
    variants: [
      { id: "var-4-1", weight: "200g", mrp: 210, sellingPrice: 185, stock: 24 },
      { id: "var-4-2", weight: "500g", mrp: 490, sellingPrice: 440, stock: 15 }
    ],
    isFeatured: false,
    isBestSeller: false,
    isNewArrival: true,
    status: "published",
    createdAt: "2026-08-28T08:00:00Z",
    updatedAt: "2026-09-08T10:00:00Z"
  },
  {
    id: "prod-5",
    sku: "KVN-TEA-MAS-05",
    name: "KVN Shahi Spiced Masala Chai Powder",
    slug: "kvn-shahi-spiced-masala-chai-powder",
    categorySlug: "masala-tea",
    mainCategory: "tea",
    brand: "KVN TEAPOWDER",
    description: "An aromatic blend of Nilgiri CTC tea infused with authentic green cardamom, Ceylon cinnamon, sun-dried dry ginger, black pepper, and clove pods.",
    brewingInstructions: "Boil with equal milk and water for 4 minutes. Allow the spices to release their full natural essential oils.",
    ingredients: "CTC Tea (88%), Cardamom, Dry Ginger, Cinnamon, Clove, Nutmeg",
    images: [
      "https://images.unsplash.com/photo-1571934811356-5cc061b6821f?auto=format&fit=crop&w=800&q=80"
    ],
    variants: [
      { id: "var-5-1", weight: "250g", mrp: 165, sellingPrice: 145, stock: 30 },
      { id: "var-5-2", weight: "500g", mrp: 310, sellingPrice: 275, stock: 18 }
    ],
    isFeatured: true,
    isBestSeller: false,
    isNewArrival: true,
    status: "published",
    createdAt: "2026-09-02T08:00:00Z",
    updatedAt: "2026-09-09T10:00:00Z"
  },
  {
    id: "prod-6",
    sku: "KVN-TEA-DUST-06",
    name: "KVN Hotel Blend Special Red Dust Tea",
    slug: "kvn-hotel-blend-special-red-dust-tea",
    categorySlug: "dust-tea",
    mainCategory: "tea",
    brand: "KVN TEAPOWDER",
    description: "High-cuppage fine dust blend designed for small tea stalls, tea shops, and large families needing instant rich red color and punchy strength in large quantity preparation.",
    brewingInstructions: "Add 1 spoon per 2 cups boiling milk tea. Strains cleanly and brews in half the time.",
    ingredients: "100% Fine Grade CTC Dust Tea",
    images: [
      "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=800&q=80"
    ],
    variants: [
      { id: "var-6-1", weight: "500g", mrp: 210, sellingPrice: 180, stock: 45 },
      { id: "var-6-2", weight: "1kg", mrp: 400, sellingPrice: 350, stock: 40 }
    ],
    isFeatured: false,
    isBestSeller: true,
    isNewArrival: false,
    status: "published",
    createdAt: "2026-08-12T08:00:00Z",
    updatedAt: "2026-08-12T08:00:00Z"
  }
];

// server/_lib/db.ts
var cachedMongoClient = null;
var cachedDb = null;
var mongoConnectPromise = null;
var mongoFailedUntil = 0;
var MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || "";
var MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "kvn_store";
var LOCAL_DATA_DIR = path.join(process.cwd(), ".data");
var LOCAL_DATA_FILE = path.join(LOCAL_DATA_DIR, "store.json");
var TMP_DATA_FILE = path.join("/tmp", "kvn_store.json");
function getLocalFilePath() {
  if (process.env.VERCEL) {
    return TMP_DATA_FILE;
  }
  return LOCAL_DATA_FILE;
}
var localStateCache = null;
function ensureLocalFile() {
  if (localStateCache) {
    return localStateCache;
  }
  const filePath = getLocalFilePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
    }
  }
  const initialState = {
    orders: [],
    users: [],
    products: INITIAL_PRODUCTS,
    webhookEvents: [],
    lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (!fs.existsSync(filePath)) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(initialState, null, 2), "utf-8");
    } catch {
    }
    localStateCache = initialState;
    return localStateCache;
  }
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    if (!content || !content.trim()) {
      fs.writeFileSync(filePath, JSON.stringify(initialState, null, 2), "utf-8");
      localStateCache = initialState;
      return localStateCache;
    }
    const parsed = JSON.parse(content);
    parsed.webhookEvents = parsed.webhookEvents || [];
    parsed.orders = parsed.orders || [];
    parsed.users = parsed.users || [];
    parsed.products = parsed.products || INITIAL_PRODUCTS;
    localStateCache = parsed;
    return localStateCache;
  } catch {
    localStateCache = initialState;
    return localStateCache;
  }
}
async function saveLocalFile(state) {
  localStateCache = state;
  state.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
  const filePath = getLocalFilePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
    }
  }
  try {
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), "utf-8");
  } catch {
  }
  return Promise.resolve();
}
async function getMongoDb() {
  if (!MONGODB_URI) {
    return null;
  }
  if (cachedDb) {
    return cachedDb;
  }
  if (Date.now() < mongoFailedUntil) {
    return null;
  }
  if (mongoConnectPromise) {
    return await mongoConnectPromise;
  }
  mongoConnectPromise = (async () => {
    try {
      if (!cachedMongoClient) {
        cachedMongoClient = new MongoClient(MONGODB_URI, {
          connectTimeoutMS: 5e3,
          serverSelectionTimeoutMS: 5e3
        });
        await cachedMongoClient.connect();
      }
      cachedDb = cachedMongoClient.db(MONGODB_DB_NAME);
      cachedDb.collection("orders").createIndex({ orderNumber: 1 }, { unique: true }).catch(() => {
      });
      cachedDb.collection("orders").createIndex({ "customer.phone": 1 }).catch(() => {
      });
      cachedDb.collection("orders").createIndex({ customerId: 1 }).catch(() => {
      });
      cachedDb.collection("orders").createIndex({ createdAt: -1 }).catch(() => {
      });
      cachedDb.collection("users").createIndex({ phone: 1 }).catch(() => {
      });
      cachedDb.collection("users").createIndex({ email: 1 }).catch(() => {
      });
      cachedDb.collection("users").createIndex({ firebaseUid: 1 }).catch(() => {
      });
      cachedDb.collection("products").createIndex({ id: 1 }, { unique: true }).catch(() => {
      });
      cachedDb.collection("webhook_outbox").createIndex({ eventId: 1 }, { unique: true }).catch(() => {
      });
      cachedDb.collection("webhook_outbox").createIndex({ status: 1 }).catch(() => {
      });
      cachedDb.collection("products").countDocuments().then(async (count) => {
        if (count === 0 && cachedDb) {
          try {
            await cachedDb.collection("products").insertMany(INITIAL_PRODUCTS);
          } catch {
          }
        }
      }).catch(() => {
      });
      return cachedDb;
    } catch (err) {
      console.warn("MongoDB Atlas connection failed:", err);
      mongoFailedUntil = Date.now() + 3e3;
      cachedMongoClient = null;
      cachedDb = null;
      return null;
    } finally {
      mongoConnectPromise = null;
    }
  })();
  return await mongoConnectPromise;
}
var serverDb = {
  async isCloudConnected() {
    const db = await getMongoDb();
    return db !== null;
  },
  // ===================== ORDERS =====================
  async getAllOrders(statusFilter) {
    const db = await getMongoDb();
    if (db) {
      const query = statusFilter && statusFilter !== "all" ? { orderStatus: statusFilter } : {};
      const docs = await db.collection("orders").find(query).sort({ createdAt: -1 }).toArray();
      return docs.map((d) => {
        const { _id, ...rest } = d;
        return rest;
      });
    }
    const state = ensureLocalFile();
    let orders = state.orders;
    if (statusFilter && statusFilter !== "all") {
      orders = orders.filter((o) => o.orderStatus === statusFilter);
    }
    return orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },
  async getOrderById(idOrNumber) {
    const db = await getMongoDb();
    if (db) {
      const doc = await db.collection("orders").findOne({
        $or: [{ id: idOrNumber }, { orderNumber: idOrNumber }]
      });
      if (!doc) return null;
      const { _id, ...rest } = doc;
      return rest;
    }
    const state = ensureLocalFile();
    const order = state.orders.find((o) => o.id === idOrNumber || o.orderNumber === idOrNumber);
    return order || null;
  },
  async getOrdersByPhone(phone) {
    const cleanPhone = phone.replace(/\D/g, "");
    const db = await getMongoDb();
    if (db) {
      const docs = await db.collection("orders").find({
        "customer.phone": { $regex: cleanPhone }
      }).sort({ createdAt: -1 }).toArray();
      return docs.map((d) => {
        const { _id, ...rest } = d;
        return rest;
      });
    }
    const state = ensureLocalFile();
    return state.orders.filter((o) => o.customer.phone.replace(/\D/g, "").includes(cleanPhone)).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },
  async checkDuplicateOrder(phone, subtotal, timeWindowMs = 3e4) {
    const cleanPhone = phone.replace(/\D/g, "");
    const now = Date.now();
    const orders = await this.getOrdersByPhone(cleanPhone);
    const recent = orders.find((o) => {
      const diff = now - new Date(o.createdAt).getTime();
      return diff >= 0 && diff <= timeWindowMs && o.subtotal === subtotal;
    });
    return Boolean(recent);
  },
  async createOrder(orderData) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const orderId = `ord-${Date.now()}-${randomSuffix}`;
    const orderNumber = `KVN-${Date.now().toString().slice(-6)}-${randomSuffix}`;
    const newOrder = {
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
      paymentMethod: orderData.paymentMethod || "COD",
      paymentStatus: orderData.paymentStatus || "Pending",
      orderStatus: orderData.orderStatus || "Order Confirmed",
      statusHistory: [
        {
          status: orderData.orderStatus || "Order Confirmed",
          timestamp: now,
          note: "Order placed by customer via online store"
        }
      ],
      whatsappStatus: orderData.whatsappStatus || "pending",
      excelSyncStatus: orderData.excelSyncStatus || "pending",
      notes: orderData.notes || "",
      createdAt: now,
      updatedAt: now
    };
    let db = await getMongoDb();
    if (!db && MONGODB_URI) {
      mongoFailedUntil = 0;
      db = await getMongoDb();
    }
    if (db) {
      await db.collection("orders").insertOne(newOrder);
      this.decrementProductStock(orderData.items).catch(() => {
      });
      return newOrder;
    }
    const state = ensureLocalFile();
    state.orders.unshift(newOrder);
    await saveLocalFile(state);
    this.decrementProductStock(orderData.items).catch(() => {
    });
    return newOrder;
  },
  async updateOrderSyncStatuses(orderId, updates) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    let db = await getMongoDb();
    if (db) {
      await db.collection("orders").updateOne(
        { $or: [{ id: orderId }, { orderNumber: orderId }] },
        { $set: { ...updates, updatedAt: now } }
      );
      const updated = await db.collection("orders").findOne({
        $or: [{ id: orderId }, { orderNumber: orderId }]
      });
      if (!updated) return null;
      const { _id, ...rest } = updated;
      return rest;
    }
    const state = ensureLocalFile();
    const index = state.orders.findIndex((o) => o.id === orderId || o.orderNumber === orderId);
    if (index === -1) return null;
    state.orders[index] = { ...state.orders[index], ...updates, updatedAt: now };
    await saveLocalFile(state);
    return state.orders[index];
  },
  async updateOrderStatus(orderId, status, note) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    let db = await getMongoDb();
    if (!db && MONGODB_URI) {
      mongoFailedUntil = 0;
      db = await getMongoDb();
    }
    if (db) {
      const existing = await db.collection("orders").findOne({
        $or: [{ id: orderId }, { orderNumber: orderId }]
      });
      if (!existing) return null;
      const previousStatus2 = existing.orderStatus;
      if (previousStatus2 === status) {
        const { _id: _id2, ...rest2 } = existing;
        return { order: rest2, previousStatus: previousStatus2, changed: false };
      }
      const newHistoryItem = {
        status,
        timestamp: now,
        note: note || `Status updated to ${status} by Administrator`
      };
      await db.collection("orders").updateOne(
        { _id: existing._id },
        {
          $set: {
            orderStatus: status,
            paymentStatus: status === "Delivered" && existing.paymentMethod === "COD" ? "Paid" : existing.paymentStatus,
            updatedAt: now
          },
          $push: { statusHistory: newHistoryItem }
        }
      );
      const updated = await db.collection("orders").findOne({ _id: existing._id });
      const { _id, ...rest } = updated;
      return { order: rest, previousStatus: previousStatus2, changed: true };
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
    if (status === "Delivered" && order.paymentMethod === "COD") {
      order.paymentStatus = "Paid";
    }
    order.statusHistory.push({
      status,
      timestamp: now,
      note: note || `Status updated to ${status} by Administrator`
    });
    await saveLocalFile(state);
    return { order, previousStatus, changed: true };
  },
  // ===================== CUSTOMERS / USERS =====================
  async getUserByPhone(phone) {
    const cleanPhone = phone.replace(/\D/g, "");
    const db = await getMongoDb();
    if (db) {
      const doc = await db.collection("users").findOne({ phone: cleanPhone });
      if (!doc) return null;
      const { _id, ...rest } = doc;
      return rest;
    }
    const state = ensureLocalFile();
    const user = state.users.find((u) => u.phone.replace(/\D/g, "") === cleanPhone);
    return user || null;
  },
  async getUserByEmail(email) {
    if (!email) return null;
    const cleanEmail = email.trim().toLowerCase();
    const db = await getMongoDb();
    if (db) {
      const doc = await db.collection("users").findOne({ email: cleanEmail });
      if (!doc) return null;
      const { _id, ...rest } = doc;
      return rest;
    }
    const state = ensureLocalFile();
    const user = state.users.find((u) => u.email && u.email.toLowerCase() === cleanEmail);
    return user || null;
  },
  async getUserByFirebaseUid(uid) {
    if (!uid) return null;
    const db = await getMongoDb();
    if (db) {
      const doc = await db.collection("users").findOne({ firebaseUid: uid });
      if (!doc) return null;
      const { _id, ...rest } = doc;
      return rest;
    }
    const state = ensureLocalFile();
    const user = state.users.find((u) => u.firebaseUid === uid);
    return user || null;
  },
  async upsertFirebaseUser(data) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const cleanEmail = data.email ? data.email.trim().toLowerCase() : void 0;
    const cleanPhone = data.phone ? data.phone.replace(/\D/g, "").slice(-10) : "";
    let existing = await this.getUserByFirebaseUid(data.firebaseUid);
    if (!existing && cleanEmail) {
      existing = await this.getUserByEmail(cleanEmail);
    }
    if (!existing && cleanPhone) {
      existing = await this.getUserByPhone(cleanPhone);
    }
    if (existing) {
      const updates = {
        firebaseUid: data.firebaseUid,
        authProvider: data.authProvider,
        updatedAt: now
      };
      if (data.emailVerified !== void 0) updates.emailVerified = data.emailVerified;
      if (data.phoneVerified !== void 0) updates.phoneVerified = data.phoneVerified;
      if (cleanEmail && !existing.email) updates.email = cleanEmail;
      if (cleanPhone && !existing.phone) updates.phone = cleanPhone;
      if (data.fullName && (!existing.fullName || existing.fullName === "Guest Customer")) {
        updates.fullName = data.fullName.trim();
      }
      const db2 = await getMongoDb();
      if (db2) {
        await db2.collection("users").updateOne(
          { id: existing.id },
          { $set: updates }
        );
        const updated = await this.getUserById(existing.id);
        return updated || { ...existing, ...updates };
      }
      const state2 = ensureLocalFile();
      const idx = state2.users.findIndex((u) => u.id === existing.id);
      if (idx >= 0) {
        state2.users[idx] = { ...state2.users[idx], ...updates };
        await saveLocalFile(state2);
        return state2.users[idx];
      }
      return { ...existing, ...updates };
    }
    const userId = `usr-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const addresses = [];
    if (data.initialAddress && data.initialAddress.addressLine) {
      addresses.push({
        id: `addr-${Date.now()}-1`,
        label: data.initialAddress.label || "Home",
        recipientName: data.initialAddress.recipientName || data.fullName,
        phone: data.initialAddress.phone || cleanPhone,
        addressLine: data.initialAddress.addressLine,
        landmark: data.initialAddress.landmark || "",
        villageTown: data.initialAddress.villageTown || "",
        district: data.initialAddress.district || "",
        state: data.initialAddress.state || "Tamil Nadu",
        pincode: data.initialAddress.pincode || "",
        isDefault: true,
        coordinates: data.initialAddress.coordinates,
        createdAt: now
      });
    }
    const newUser = {
      id: userId,
      fullName: data.fullName.trim() || "Valued Customer",
      phone: cleanPhone,
      email: cleanEmail || "",
      firebaseUid: data.firebaseUid,
      authProvider: data.authProvider,
      emailVerified: Boolean(data.emailVerified),
      phoneVerified: Boolean(data.phoneVerified),
      addresses,
      createdAt: now,
      updatedAt: now
    };
    const db = await getMongoDb();
    if (db) {
      await db.collection("users").insertOne(newUser);
      return newUser;
    }
    const state = ensureLocalFile();
    state.users.push(newUser);
    await saveLocalFile(state);
    return newUser;
  },
  async getUserById(id) {
    const db = await getMongoDb();
    if (db) {
      const doc = await db.collection("users").findOne({ id });
      if (!doc) return null;
      const { _id, ...rest } = doc;
      return rest;
    }
    const state = ensureLocalFile();
    const user = state.users.find((u) => u.id === id);
    return user || null;
  },
  async createUser(userData) {
    const cleanPhone = userData.phone.replace(/\D/g, "");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const userId = `usr-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const addresses = [];
    if (userData.initialAddress && userData.initialAddress.addressLine) {
      addresses.push({
        id: `addr-${Date.now()}-1`,
        label: userData.initialAddress.label || "Home",
        recipientName: userData.initialAddress.recipientName || userData.fullName,
        phone: userData.initialAddress.phone || cleanPhone,
        addressLine: userData.initialAddress.addressLine,
        landmark: userData.initialAddress.landmark || "",
        villageTown: userData.initialAddress.villageTown || "",
        district: userData.initialAddress.district || "",
        state: userData.initialAddress.state || "Tamil Nadu",
        pincode: userData.initialAddress.pincode || "",
        isDefault: true,
        coordinates: userData.initialAddress.coordinates,
        createdAt: now
      });
    }
    const newUser = {
      id: userId,
      fullName: userData.fullName.trim(),
      phone: cleanPhone,
      email: userData.email?.trim() || "",
      passwordHash: userData.passwordHash,
      addresses,
      createdAt: now,
      updatedAt: now
    };
    let db = await getMongoDb();
    if (!db && MONGODB_URI) {
      mongoFailedUntil = 0;
      db = await getMongoDb();
    }
    if (db) {
      await db.collection("users").insertOne(newUser);
      return newUser;
    }
    const state = ensureLocalFile();
    state.users.push(newUser);
    await saveLocalFile(state);
    return newUser;
  },
  async updateUserProfile(userId, updates) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const db = await getMongoDb();
    if (db) {
      const res = await db.collection("users").findOneAndUpdate(
        { id: userId },
        { $set: { ...updates, updatedAt: now } },
        { returnDocument: "after" }
      );
      if (!res) return null;
      const { _id, ...rest } = res;
      return rest;
    }
    const state = ensureLocalFile();
    const user = state.users.find((u) => u.id === userId);
    if (!user) return null;
    if (updates.fullName) user.fullName = updates.fullName.trim();
    if (updates.email !== void 0) user.email = updates.email.trim();
    user.updatedAt = now;
    await saveLocalFile(state);
    return user;
  },
  // ===================== ADDRESSES =====================
  async getUserAddresses(userId) {
    const user = await this.getUserById(userId);
    return user ? user.addresses : [];
  },
  async addAddress(userId, addressData) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const addrId = `addr-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const newAddress = {
      ...addressData,
      id: addrId,
      createdAt: now
    };
    const db = await getMongoDb();
    if (db) {
      const user2 = await db.collection("users").findOne({ id: userId });
      if (!user2) return null;
      let addresses = user2.addresses || [];
      if (newAddress.isDefault || addresses.length === 0) {
        newAddress.isDefault = true;
        addresses = addresses.map((a) => ({ ...a, isDefault: false }));
      }
      addresses.push(newAddress);
      await db.collection("users").updateOne(
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
      user.addresses.forEach((a) => {
        a.isDefault = false;
      });
    }
    user.addresses.push(newAddress);
    user.updatedAt = now;
    await saveLocalFile(state);
    return newAddress;
  },
  async updateAddress(userId, addressId, updates) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const db = await getMongoDb();
    if (db) {
      const user2 = await db.collection("users").findOne({ id: userId });
      if (!user2) return null;
      const addresses = user2.addresses || [];
      const idx2 = addresses.findIndex((a) => a.id === addressId);
      if (idx2 === -1) return null;
      if (updates.isDefault) {
        addresses.forEach((a) => {
          a.isDefault = false;
        });
      }
      addresses[idx2] = { ...addresses[idx2], ...updates, id: addressId };
      await db.collection("users").updateOne({ id: userId }, { $set: { addresses, updatedAt: now } });
      return addresses[idx2];
    }
    const state = ensureLocalFile();
    const user = state.users.find((u) => u.id === userId);
    if (!user) return null;
    const idx = user.addresses.findIndex((a) => a.id === addressId);
    if (idx === -1) return null;
    if (updates.isDefault) {
      user.addresses.forEach((a) => {
        a.isDefault = false;
      });
    }
    user.addresses[idx] = { ...user.addresses[idx], ...updates, id: addressId };
    user.updatedAt = now;
    await saveLocalFile(state);
    return user.addresses[idx];
  },
  async deleteAddress(userId, addressId) {
    const db = await getMongoDb();
    if (db) {
      const user2 = await db.collection("users").findOne({ id: userId });
      if (!user2) return false;
      const filtered = (user2.addresses || []).filter((a) => a.id !== addressId);
      if (filtered.length > 0 && !filtered.some((a) => a.isDefault)) {
        filtered[0].isDefault = true;
      }
      await db.collection("users").updateOne({ id: userId }, { $set: { addresses: filtered, updatedAt: (/* @__PURE__ */ new Date()).toISOString() } });
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
  async saveOutboxRecord(record) {
    const db = await getMongoDb();
    if (db) {
      await db.collection("webhook_outbox").insertOne(record);
      return;
    }
    const state = ensureLocalFile();
    state.webhookEvents = state.webhookEvents || [];
    state.webhookEvents.push(record);
    await saveLocalFile(state);
  },
  async updateOutboxRecord(id, updates) {
    const db = await getMongoDb();
    if (db) {
      await db.collection("webhook_outbox").updateOne({ id }, { $set: updates });
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
  async getPendingOutboxRecords(limit = 25) {
    const db = await getMongoDb();
    if (db) {
      const docs = await db.collection("webhook_outbox").find({ status: { $in: ["pending", "failed"] } }).sort({ createdAt: 1 }).limit(limit).toArray();
      return docs.map((d) => {
        const { _id, ...rest } = d;
        return rest;
      });
    }
    const state = ensureLocalFile();
    return (state.webhookEvents || []).filter((r) => r.status === "pending" || r.status === "failed").slice(0, limit);
  },
  async getOutboxStats() {
    const webhookUrlConfigured = Boolean(process.env.N8N_WEBHOOK_URL || process.env.ORDER_BACKUP_WEBHOOK_URL);
    const db = await getMongoDb();
    if (db) {
      const total = await db.collection("webhook_outbox").countDocuments();
      const delivered = await db.collection("webhook_outbox").countDocuments({ status: "delivered" });
      const pending = await db.collection("webhook_outbox").countDocuments({ status: "pending" });
      const failed = await db.collection("webhook_outbox").countDocuments({ status: "failed" });
      return { total, delivered, pending, failed, webhookUrlConfigured };
    }
    const state = ensureLocalFile();
    const list = state.webhookEvents || [];
    return {
      total: list.length,
      delivered: list.filter((r) => r.status === "delivered").length,
      pending: list.filter((r) => r.status === "pending").length,
      failed: list.filter((r) => r.status === "failed").length,
      webhookUrlConfigured
    };
  },
  // ===================== PRODUCTS =====================
  async getAllProducts() {
    const db = await getMongoDb();
    if (db) {
      const docs = await db.collection("products").find({}).toArray();
      if (docs.length > 0) {
        return docs.map((d) => {
          const { _id, ...rest } = d;
          return rest;
        });
      }
      await db.collection("products").insertMany(INITIAL_PRODUCTS).catch(() => {
      });
      return INITIAL_PRODUCTS;
    }
    const state = ensureLocalFile();
    if (!state.products || state.products.length === 0) {
      state.products = INITIAL_PRODUCTS;
      await saveLocalFile(state);
    }
    return state.products;
  },
  async getProductById(id) {
    const products = await this.getAllProducts();
    return products.find((p) => p.id === id || p.slug === id) || null;
  },
  async saveProduct(product) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const updatedProduct = { ...product, updatedAt: now };
    const db = await getMongoDb();
    if (db) {
      await db.collection("products").updateOne(
        { id: product.id },
        { $set: updatedProduct },
        { upsert: true }
      );
      return updatedProduct;
    }
    const state = ensureLocalFile();
    state.products = state.products || [];
    const idx = state.products.findIndex((p) => p.id === product.id);
    if (idx >= 0) {
      state.products[idx] = updatedProduct;
    } else {
      state.products.push(updatedProduct);
    }
    await saveLocalFile(state);
    return updatedProduct;
  },
  async deleteProduct(id) {
    const db = await getMongoDb();
    if (db) {
      const res = await db.collection("products").deleteOne({ id });
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
  async decrementProductStock(items) {
    if (!items || !items.length) return;
    const db = await getMongoDb();
    if (db) {
      for (const item of items) {
        if (!item.productId || !item.variantId) continue;
        await db.collection("products").updateOne(
          { id: item.productId, "variants.id": item.variantId },
          { $inc: { "variants.$.stock": -(item.quantity || 1) } }
        ).catch(() => {
        });
      }
      return;
    }
    const state = ensureLocalFile();
    if (!state.products) return;
    for (const item of items) {
      const prod = state.products.find((p) => p.id === item.productId);
      if (prod && prod.variants) {
        const variant = prod.variants.find((v) => v.id === item.variantId);
        if (variant) {
          variant.stock = Math.max(0, variant.stock - (item.quantity || 1));
        }
      }
    }
    await saveLocalFile(state);
  }
};

// server/_lib/auth.ts
import crypto from "crypto";
var JWT_SECRET = process.env.JWT_SECRET || process.env.ADMIN_JWT_SECRET || "kvn-teapowder-production-secret-key-2026";
var ADMIN_PASSCODES = [
  (process.env.ADMIN_PASSWORD || "kvn2026").trim(),
  "9787513911",
  "6383050287"
];
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}
function verifyPassword(password, storedHash) {
  try {
    const [salt, key] = storedHash.split(":");
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, "hex");
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}
function createToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const exp = Date.now() + 30 * 24 * 60 * 60 * 1e3;
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString("base64url");
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}
function verifyToken(token) {
  try {
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSig = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
    if (signature !== expectedSig) return null;
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (data.exp && Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}
function verifyAdminPasscode(passcode) {
  if (!passcode) return false;
  const clean = passcode.trim();
  return ADMIN_PASSCODES.includes(clean);
}
function createAdminToken() {
  return createToken({ userId: "admin", phone: "9787513911", role: "admin" });
}
function verifyAdminToken(token) {
  const payload = verifyToken(token);
  return Boolean(payload && payload.role === "admin");
}

// server/_lib/validation.ts
function validatePhone(phone) {
  if (!phone) {
    return { valid: false, normalized: "", error: "Mobile number is required" };
  }
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  if (!/^[6-9]\d{9}$/.test(normalized)) {
    return { valid: false, normalized, error: "Please enter a valid 10-digit Indian mobile number" };
  }
  return { valid: true, normalized };
}
function validatePincode(pincode) {
  if (!pincode || !/^[1-9][0-9]{5}$/.test(pincode.trim())) {
    return { valid: false, error: "Please enter a valid 6-digit Indian PIN code" };
  }
  return { valid: true };
}
function validateAddress(customer) {
  if (!customer.fullName || customer.fullName.trim().length < 2) {
    return { valid: false, error: "Full name is required (minimum 2 characters)" };
  }
  const phoneVal = validatePhone(customer.phone || "");
  if (!phoneVal.valid) {
    return { valid: false, error: phoneVal.error };
  }
  if (!customer.address || customer.address.trim().length < 5) {
    return { valid: false, error: "Door number / street address is required" };
  }
  if (!customer.villageTown || customer.villageTown.trim().length < 2) {
    return { valid: false, error: "Village or Town name is required" };
  }
  const pinVal = validatePincode(customer.pincode || "");
  if (!pinVal.valid) {
    return { valid: false, error: pinVal.error };
  }
  return { valid: true };
}
function validateAndPriceOrder(items) {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return { valid: false, validatedItems: [], subtotal: 0, deliveryCharge: 0, totalAmount: 0, error: "Cart is empty" };
  }
  const validatedItems = [];
  let subtotal = 0;
  for (const item of items) {
    const product = INITIAL_PRODUCTS.find(
      (p) => p.id === item.productId || p.slug === item.productId || p.name.toLowerCase() === (item.productName || "").toLowerCase()
    );
    if (!product) {
      return { valid: false, validatedItems: [], subtotal: 0, deliveryCharge: 0, totalAmount: 0, error: `Product not found: ${item.productId || item.productName}` };
    }
    const variant = product.variants.find((v) => v.id === item.variantId || v.weight === item.weight) || product.variants[0];
    if (!variant) {
      return { valid: false, validatedItems: [], subtotal: 0, deliveryCharge: 0, totalAmount: 0, error: `Invalid variant for ${product.name}` };
    }
    const quantity = Math.max(1, Math.min(99, Math.floor(Number(item.quantity) || 1)));
    const trustedUnitPrice = Number(variant.sellingPrice);
    const trustedMrp = Number(variant.mrp);
    subtotal += trustedUnitPrice * quantity;
    validatedItems.push({
      productId: product.id,
      productName: product.name,
      productImage: product.images[0] || item.productImage || "",
      category: product.mainCategory,
      variantId: variant.id,
      weight: variant.weight,
      unitPrice: trustedUnitPrice,
      mrp: trustedMrp,
      quantity
    });
  }
  const deliveryCharge = subtotal >= INITIAL_BUSINESS_CONFIG.freeDeliveryThreshold ? 0 : INITIAL_BUSINESS_CONFIG.defaultDeliveryCharge;
  const totalAmount = subtotal + deliveryCharge;
  return {
    valid: true,
    validatedItems,
    subtotal,
    deliveryCharge,
    totalAmount
  };
}

// server/_lib/webhook.ts
import http from "http";
import https from "https";
import crypto2 from "crypto";
function buildProductsSummary(items) {
  if (!items || items.length === 0) return "No items";
  return items.map((item) => `${item.productName} (${item.weight || "Std"}) x ${item.quantity}`).join(", ");
}
function formatFullAddress(customer) {
  if (!customer) return "";
  const parts = [
    customer.address,
    customer.villageTown,
    customer.district,
    customer.state || "Tamil Nadu",
    customer.pincode ? `PIN: ${customer.pincode}` : ""
  ].filter(Boolean);
  return parts.join(", ");
}
function buildOrderCreatedPayload(order) {
  const eventId = `evt_created_${order.id}_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
  const totalQty = (order.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
  return {
    eventId,
    eventType: "order.created",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    orderId: order.id,
    orderNumber: order.orderNumber,
    customer: {
      fullName: order.customer.fullName,
      phone: order.customer.phone,
      email: order.customer.email || void 0,
      formattedAddress: formatFullAddress(order.customer),
      street: order.customer.address,
      villageTown: order.customer.villageTown,
      district: order.customer.district || "",
      state: order.customer.state || "Tamil Nadu",
      pincode: order.customer.pincode,
      deliveryInstructions: order.customer.deliveryInstructions || void 0
    },
    items: (order.items || []).map((i) => ({
      productId: i.productId,
      productName: i.productName,
      weight: i.weight,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      totalPrice: i.unitPrice * i.quantity
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
    notes: order.notes || ""
  };
}
function buildStatusChangedPayload(order, previousStatus, newStatus) {
  const eventId = `evt_status_${order.id}_${newStatus.replace(/\s+/g, "_")}_${Date.now()}`;
  const totalQty = (order.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
  return {
    eventId,
    eventType: "order.status_changed",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    orderId: order.id,
    orderNumber: order.orderNumber,
    previousStatus,
    orderStatus: newStatus,
    customer: {
      fullName: order.customer.fullName,
      phone: order.customer.phone,
      email: order.customer.email || void 0,
      formattedAddress: formatFullAddress(order.customer),
      street: order.customer.address,
      villageTown: order.customer.villageTown,
      district: order.customer.district || "",
      state: order.customer.state || "Tamil Nadu",
      pincode: order.customer.pincode,
      deliveryInstructions: order.customer.deliveryInstructions || void 0
    },
    items: (order.items || []).map((i) => ({
      productId: i.productId,
      productName: i.productName,
      weight: i.weight,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      totalPrice: i.unitPrice * i.quantity
    })),
    productsSummary: buildProductsSummary(order.items),
    totalQuantity: totalQty,
    subtotal: order.subtotal,
    deliveryCharge: order.deliveryCharge,
    discountAmount: order.discountAmount || 0,
    totalAmount: order.totalAmount,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    notes: order.notes || ""
  };
}
function sendHttpRequest(urlStr, bodyJson, headers, timeoutMs = 6e3) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlStr);
      const isHttps = url.protocol === "https:";
      const transport = isHttps ? https : http;
      const req = transport.request(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(bodyJson),
            "User-Agent": "KVN-Tea-Powder-Webhook-Agent/1.0",
            ...headers
          },
          timeout: timeoutMs
        },
        (res) => {
          let responseData = "";
          res.on("data", (chunk) => {
            responseData += chunk;
          });
          res.on("end", () => {
            resolve({ status: res.statusCode || 200, data: responseData });
          });
        }
      );
      req.on("timeout", () => {
        req.destroy(new Error(`Webhook request timed out after ${timeoutMs}ms`));
      });
      req.on("error", (err) => {
        reject(err);
      });
      req.write(bodyJson);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}
var webhookService = {
  getWebhookUrl() {
    return (process.env.N8N_WEBHOOK_URL || process.env.ORDER_BACKUP_WEBHOOK_URL || "").trim();
  },
  getWebhookSecret() {
    return (process.env.N8N_WEBHOOK_SECRET || "").trim();
  },
  isConfigured() {
    return Boolean(this.getWebhookUrl());
  },
  /**
   * Queue and attempt immediate dispatch for an event.
   * NEVER throws or blocks caller execution.
   */
  async queueAndDispatch(payload) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const record = {
      id: `outbox-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      eventId: payload.eventId,
      eventType: payload.eventType,
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
      payload,
      status: "pending",
      attempts: 0,
      maxAttempts: 5,
      createdAt: now,
      updatedAt: now
    };
    try {
      await serverDb.saveOutboxRecord(record);
    } catch (err) {
      console.warn("Failed to save webhook to outbox store:", err);
    }
    this.dispatchRecord(record).catch((err) => {
      console.warn(`Webhook initial dispatch non-fatal failure for ${payload.eventId}:`, err?.message || err);
    });
    return record;
  },
  /**
   * Execute dispatch for an outbox record
   */
  async dispatchRecord(record) {
    const webhookUrl = this.getWebhookUrl();
    if (!webhookUrl) {
      record.lastError = "N8N_WEBHOOK_URL environment variable is not configured";
      record.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      await serverDb.updateOutboxRecord(record.id, {
        lastError: record.lastError,
        updatedAt: record.updatedAt
      });
      return { success: false, error: record.lastError };
    }
    const bodyJson = JSON.stringify(record.payload);
    const headers = {
      "X-Event-Id": record.eventId,
      "X-Event-Type": record.eventType,
      "X-Order-Id": record.orderId,
      "X-Order-Number": record.orderNumber,
      "X-Delivery-Attempt": String(record.attempts + 1)
    };
    const secret = this.getWebhookSecret();
    if (secret) {
      const hmac = crypto2.createHmac("sha256", secret).update(bodyJson).digest("hex");
      headers["X-Webhook-Signature"] = hmac;
    }
    record.attempts += 1;
    record.lastAttemptAt = (/* @__PURE__ */ new Date()).toISOString();
    try {
      const res = await sendHttpRequest(webhookUrl, bodyJson, headers, 6e3);
      if (res.status >= 200 && res.status < 300) {
        record.status = "delivered";
        record.deliveredAt = (/* @__PURE__ */ new Date()).toISOString();
        record.lastError = void 0;
        record.updatedAt = record.deliveredAt;
        await serverDb.updateOutboxRecord(record.id, {
          status: "delivered",
          attempts: record.attempts,
          lastAttemptAt: record.lastAttemptAt,
          deliveredAt: record.deliveredAt,
          updatedAt: record.updatedAt
        });
        return { success: true, status: res.status };
      } else {
        const errorMsg = `Webhook target returned HTTP ${res.status}: ${res.data.slice(0, 100)}`;
        record.status = record.attempts >= record.maxAttempts ? "failed" : "pending";
        record.lastError = errorMsg;
        record.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        await serverDb.updateOutboxRecord(record.id, {
          status: record.status,
          attempts: record.attempts,
          lastAttemptAt: record.lastAttemptAt,
          lastError: record.lastError,
          updatedAt: record.updatedAt
        });
        return { success: false, status: res.status, error: errorMsg };
      }
    } catch (err) {
      const errorMsg = err.message || "Network request failed";
      record.status = record.attempts >= record.maxAttempts ? "failed" : "pending";
      record.lastError = errorMsg;
      record.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      await serverDb.updateOutboxRecord(record.id, {
        status: record.status,
        attempts: record.attempts,
        lastAttemptAt: record.lastAttemptAt,
        lastError: record.lastError,
        updatedAt: record.updatedAt
      });
      return { success: false, error: errorMsg };
    }
  },
  /**
   * Process all pending or failed outbox records
   */
  async retryPendingEvents() {
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
      failed
    };
  }
};

// server/_lib/whatsapp.ts
var WhatsAppService = class {
  constructor() {
    this.phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
    this.accessToken = (process.env.WHATSAPP_ACCESS_TOKEN || "").trim();
    this.templateName = (process.env.WHATSAPP_TEMPLATE_NAME || "").trim();
  }
  isConfigured() {
    return Boolean(this.phoneNumberId && this.accessToken);
  }
  /**
   * Normalize an Indian phone number to E.164 format without leading '+'
   * (e.g. 9787513911 -> 919787513911)
   */
  normalizePhone(phone) {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) {
      return `91${digits}`;
    }
    if (digits.length === 12 && digits.startsWith("91")) {
      return digits;
    }
    if (digits.length === 11 && digits.startsWith("0")) {
      return `91${digits.slice(1)}`;
    }
    return digits;
  }
  /**
   * Send WhatsApp order confirmation message via Meta WhatsApp Business Cloud API.
   * If credentials are not configured, gracefully logs and records 'not_configured'.
   */
  async sendOrderConfirmation(order) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    if (!this.isConfigured()) {
      return {
        success: false,
        status: "not_configured",
        error: "WhatsApp Business Cloud API credentials not configured (WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN missing)"
      };
    }
    const recipientPhone = this.normalizePhone(order.customer.phone);
    if (!recipientPhone || recipientPhone.length < 10) {
      return {
        success: false,
        status: "failed",
        error: `Invalid customer phone number: ${order.customer.phone}`
      };
    }
    const shortAddress = `${order.customer.address}, ${order.customer.villageTown} - ${order.customer.pincode}`;
    const orderId = order.orderNumber || order.id;
    const total = order.totalAmount;
    const messageText = `Thank you for ordering from KVN Tea Powder! Your order has been placed successfully.

Order ID: ${orderId}
Order Total: \u20B9${total}
Delivery Address: ${shortAddress}

We will update you when your order status changes.`;
    const apiUrl = `https://graph.facebook.com/v21.0/${this.phoneNumberId}/messages`;
    const payload = this.templateName ? {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipientPhone,
      type: "template",
      template: {
        name: this.templateName,
        language: { code: "en" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: orderId },
              { type: "text", text: String(total) },
              { type: "text", text: shortAddress }
            ]
          }
        ]
      }
    } : {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipientPhone,
      type: "text",
      text: {
        preview_url: false,
        body: messageText
      }
    };
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const responseData = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errorDetail = responseData?.error?.message || responseData?.error?.error_data?.details || `HTTP ${response.status}`;
        console.warn(`WhatsApp Cloud API error for order ${orderId}:`, errorDetail);
        return {
          success: false,
          status: "failed",
          error: errorDetail
        };
      }
      const messageId = responseData?.messages?.[0]?.id;
      return {
        success: true,
        status: "sent",
        messageId,
        sentAt: now
      };
    } catch (err) {
      console.error(`WhatsApp dispatch network exception for order ${orderId}:`, err);
      return {
        success: false,
        status: "failed",
        error: err.message || "Network error communicating with WhatsApp Cloud API"
      };
    }
  }
};
var whatsappService = new WhatsAppService();

// server/_lib/excelSync.ts
var ExcelSyncService = class {
  constructor() {
    this.cachedToken = null;
    this.tokenExpiresAt = 0;
    this.tenantId = (process.env.MS_GRAPH_TENANT_ID || "").trim();
    this.clientId = (process.env.MS_GRAPH_CLIENT_ID || "").trim();
    this.clientSecret = (process.env.MS_GRAPH_CLIENT_SECRET || "").trim();
    this.driveId = (process.env.MS_EXCEL_DRIVE_ID || "").trim();
    this.fileId = (process.env.MS_EXCEL_FILE_ID || "").trim();
    this.tableName = (process.env.MS_EXCEL_TABLE_NAME || "OrdersTable").trim();
  }
  isConfigured() {
    return Boolean(
      this.tenantId && this.clientId && this.clientSecret && this.driveId && this.fileId
    );
  }
  getConfigurationStatus() {
    return {
      configured: this.isConfigured(),
      tenantConfigured: Boolean(this.tenantId),
      clientConfigured: Boolean(this.clientId),
      secretConfigured: Boolean(this.clientSecret),
      driveConfigured: Boolean(this.driveId),
      fileConfigured: Boolean(this.fileId),
      tableName: this.tableName
    };
  }
  /**
   * Acquire a valid Microsoft Graph OAuth 2.0 app-only access token.
   */
  async getAccessToken() {
    if (this.cachedToken && Date.now() < this.tokenExpiresAt - 6e4) {
      return this.cachedToken;
    }
    const tokenUrl = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
    const params = new URLSearchParams();
    params.append("client_id", this.clientId);
    params.append("client_secret", this.clientSecret);
    params.append("grant_type", "client_credentials");
    params.append("scope", "https://graph.microsoft.com/.default");
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed to acquire Microsoft Graph token: ${response.status} ${errText}`);
    }
    const data = await response.json();
    this.cachedToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1e3;
    return this.cachedToken;
  }
  /**
   * Format order into the recommended columns:
   * Order ID, Order Date, Customer ID, Customer Name, Email, Phone, Product Summary, Quantities,
   * Subtotal, Delivery Charge, Total, Payment Method, Payment Status, Order Status,
   * Recipient Name, Delivery Phone, Address, City, State, PIN Code, WhatsApp Status, Excel Sync Status
   */
  buildOrderRowValues(order) {
    const productSummary = (order.items || []).map((item) => `${item.productName} (${item.weight})`).join("; ");
    const quantitiesSummary = (order.items || []).map((item) => `${item.productName}: ${item.quantity}`).join("; ");
    const orderId = order.orderNumber || order.id;
    const recipientName = order.customer.fullName || "Valued Customer";
    const deliveryPhone = order.customer.phone || "";
    const email = order.customer.email || "N/A";
    const address = order.customer.address || "";
    const city = order.customer.villageTown || "";
    const state = order.customer.state || "Tamil Nadu";
    const pincode = order.customer.pincode || "";
    return [
      orderId,
      order.createdAt,
      order.customerId || "GUEST",
      recipientName,
      email,
      deliveryPhone,
      productSummary,
      quantitiesSummary,
      order.subtotal,
      order.deliveryCharge,
      order.totalAmount,
      order.paymentMethod,
      order.paymentStatus,
      order.orderStatus,
      recipientName,
      deliveryPhone,
      address,
      city,
      state,
      pincode,
      order.whatsappStatus || "pending",
      "synced"
    ];
  }
  /**
   * Append the order row to the configured Excel table in OneDrive/SharePoint.
   * Performs idempotency check using Microsoft Graph API to prevent duplicate rows.
   */
  async syncOrderToExcel(order) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const orderId = order.orderNumber || order.id;
    if (!this.isConfigured()) {
      return {
        success: false,
        status: "not_configured",
        error: "Microsoft Graph Excel credentials not configured (tenant, client ID, client secret, drive ID or file ID missing)"
      };
    }
    try {
      const accessToken = await this.getAccessToken();
      const tableRowsUrl = `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${this.fileId}/workbook/tables/${encodeURIComponent(this.tableName)}/rows`;
      try {
        const existingRowsRes = await fetch(tableRowsUrl, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (existingRowsRes.ok) {
          const existingData = await existingRowsRes.json();
          const rows = existingData?.value || [];
          const exists = rows.some((row) => {
            const rowValues2 = row.values?.[0] || [];
            return rowValues2[0] === orderId;
          });
          if (exists) {
            return {
              success: true,
              status: "synced",
              syncedAt: now
            };
          }
        }
      } catch (checkErr) {
        console.warn(`Excel idempotency check warning for order ${orderId}:`, checkErr);
      }
      const rowValues = this.buildOrderRowValues(order);
      const appendResponse = await fetch(`${tableRowsUrl}/add`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          values: [rowValues]
        })
      });
      if (!appendResponse.ok) {
        const errText = await appendResponse.text();
        console.warn(`Microsoft Graph Excel row append error for order ${orderId}:`, errText);
        return {
          success: false,
          status: "failed",
          error: `Graph API Error ${appendResponse.status}: ${errText.slice(0, 200)}`
        };
      }
      return {
        success: true,
        status: "synced",
        syncedAt: now
      };
    } catch (err) {
      console.error(`Excel synchronization exception for order ${orderId}:`, err);
      return {
        success: false,
        status: "failed",
        error: err.message || "Network error syncing with Microsoft Graph API"
      };
    }
  }
};
var excelSyncService = new ExcelSyncService();

// server/index.ts
var app = express();
app.use(express.json({ limit: "2mb" }));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, x-admin-passcode, x-admin-key");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});
var rateLimitMap = /* @__PURE__ */ new Map();
function rateLimiter(limit, windowMs) {
  return (req, res, next) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
    const key = `${ip}:${req.path}`;
    const now = Date.now();
    const entry = rateLimitMap.get(key);
    if (!entry || now > entry.resetAt) {
      rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (entry.count >= limit) {
      return res.status(429).json({ error: "Too many requests. Please wait a moment and try again." });
    }
    entry.count++;
    next();
  };
}
function authenticateCustomer(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload || !payload.userId) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
  req.user = payload;
  next();
}
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  const adminKey = req.headers["x-admin-passcode"] || req.headers["x-admin-key"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (verifyAdminToken(token) || verifyAdminPasscode(token)) {
      return next();
    }
  }
  if (adminKey && (verifyAdminPasscode(adminKey) || verifyAdminToken(adminKey))) {
    return next();
  }
  return res.status(403).json({ error: "Unauthorized: Admin access required" });
}
var router = express.Router();
router.get(["/", "/health"], async (_req, res) => {
  try {
    const cloud = await serverDb.isCloudConnected();
    return res.json({
      status: "healthy",
      mode: cloud ? "cloud-mongodb" : "persistent-store",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (err) {
    return res.json({
      status: "healthy",
      mode: "persistent-store",
      note: "Fallback active",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
});
router.post("/auth/firebase-sync", rateLimiter(20, 6e4), async (req, res) => {
  try {
    const { uid, email, phone, fullName, authProvider, emailVerified, phoneVerified, initialAddress } = req.body;
    if (!uid) {
      return res.status(400).json({ error: "Firebase UID is required" });
    }
    const adminEmails = ["krishnamoorthykavinash@gmail.com", "admin@kvnteapowder.com"];
    const adminPhones = ["9787513911", "6383050287"];
    const cleanEmail = email ? email.trim().toLowerCase() : "";
    const cleanPhone = phone ? phone.replace(/\D/g, "").slice(-10) : "";
    const isAdmin = adminEmails.includes(cleanEmail) || adminPhones.includes(cleanPhone);
    const role = isAdmin ? "admin" : "customer";
    const user = await serverDb.upsertFirebaseUser({
      firebaseUid: uid,
      email: cleanEmail,
      phone: cleanPhone,
      fullName: fullName || "Valued Customer",
      authProvider: authProvider || "email",
      emailVerified: Boolean(emailVerified),
      phoneVerified: Boolean(phoneVerified),
      initialAddress
    });
    const token = createToken({
      userId: user.id,
      phone: user.phone || "0000000000",
      role
    });
    const { passwordHash: _, ...safeUser } = user;
    return res.json({
      message: "Authentication synchronized successfully",
      user: { ...safeUser, role },
      token,
      isAdmin
    });
  } catch (err) {
    console.error("Firebase sync error:", err);
    return res.status(500).json({ error: "Failed to synchronize authentication" });
  }
});
router.post("/auth/register", rateLimiter(10, 6e4), async (req, res) => {
  try {
    const { fullName, phone, password, email, initialAddress } = req.body;
    if (!fullName || fullName.trim().length < 2) {
      return res.status(400).json({ error: "Full name is required (at least 2 characters)" });
    }
    const phoneValidation = validatePhone(phone);
    if (!phoneValidation.valid) {
      return res.status(400).json({ error: phoneValidation.error });
    }
    if (!password || password.length < 4) {
      return res.status(400).json({ error: "Password must be at least 4 characters long" });
    }
    const existingUser = await serverDb.getUserByPhone(phoneValidation.normalized);
    if (existingUser) {
      return res.status(409).json({ error: "An account with this mobile number already exists. Please log in." });
    }
    const passwordHash = hashPassword(password);
    const newUser = await serverDb.createUser({
      fullName: fullName.trim(),
      phone: phoneValidation.normalized,
      email: email?.trim(),
      passwordHash,
      initialAddress
    });
    const token = createToken({ userId: newUser.id, phone: newUser.phone, role: "customer" });
    const { passwordHash: _, ...safeUser } = newUser;
    return res.status(201).json({
      message: "Account created successfully",
      user: safeUser,
      token
    });
  } catch (err) {
    console.error("Registration error:", err);
    return res.status(500).json({ error: "Failed to create account. Please try again." });
  }
});
router.post("/auth/login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    const phoneValidation = validatePhone(phone);
    if (!phoneValidation.valid) {
      return res.status(400).json({ error: phoneValidation.error });
    }
    if (!password) {
      return res.status(400).json({ error: "Password is required" });
    }
    const user = await serverDb.getUserByPhone(phoneValidation.normalized);
    if (!user) {
      return res.status(401).json({ error: "No account found with this mobile number. Please register." });
    }
    const validPassword = verifyPassword(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: "Incorrect password. Please try again." });
    }
    const token = createToken({ userId: user.id, phone: user.phone, role: "customer" });
    const { passwordHash: _, ...safeUser } = user;
    return res.json({
      message: "Login successful",
      user: safeUser,
      token
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Login failed. Please try again." });
  }
});
router.get("/auth/me", authenticateCustomer, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await serverDb.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const { passwordHash: _, ...safeUser } = user;
    return res.json({ user: safeUser });
  } catch (err) {
    console.error("Get profile error:", err);
    return res.status(500).json({ error: "Failed to retrieve profile" });
  }
});
router.put("/auth/profile", authenticateCustomer, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { fullName, email } = req.body;
    const updated = await serverDb.updateUserProfile(userId, { fullName, email });
    if (!updated) {
      return res.status(404).json({ error: "User not found" });
    }
    const { passwordHash: _, ...safeUser } = updated;
    return res.json({ message: "Profile updated successfully", user: safeUser });
  } catch (err) {
    console.error("Update profile error:", err);
    return res.status(500).json({ error: "Failed to update profile" });
  }
});
router.get("/auth/addresses", authenticateCustomer, async (req, res) => {
  try {
    const userId = req.user.userId;
    const addresses = await serverDb.getUserAddresses(userId);
    return res.json({ addresses });
  } catch (err) {
    return res.status(500).json({ error: "Failed to load addresses" });
  }
});
router.post("/auth/addresses", authenticateCustomer, async (req, res) => {
  try {
    const userId = req.user.userId;
    const addressData = req.body;
    if (!addressData.recipientName || addressData.recipientName.trim().length < 2) {
      return res.status(400).json({ error: "Recipient name is required" });
    }
    const phoneVal = validatePhone(addressData.phone);
    if (!phoneVal.valid) {
      return res.status(400).json({ error: phoneVal.error });
    }
    if (!addressData.addressLine || addressData.addressLine.trim().length < 5) {
      return res.status(400).json({ error: "Full address line is required" });
    }
    const pinVal = validatePincode(addressData.pincode);
    if (!pinVal.valid) {
      return res.status(400).json({ error: pinVal.error });
    }
    const saved = await serverDb.addAddress(userId, {
      label: addressData.label || "Home",
      recipientName: addressData.recipientName.trim(),
      phone: phoneVal.normalized,
      addressLine: addressData.addressLine.trim(),
      landmark: addressData.landmark?.trim() || "",
      villageTown: addressData.villageTown?.trim() || "",
      district: addressData.district?.trim() || "",
      state: addressData.state?.trim() || "Tamil Nadu",
      pincode: addressData.pincode.trim(),
      isDefault: Boolean(addressData.isDefault),
      coordinates: addressData.coordinates
    });
    return res.status(201).json({ address: saved });
  } catch (err) {
    console.error("Add address error:", err);
    return res.status(500).json({ error: "Failed to save address" });
  }
});
router.put("/auth/addresses/:id", authenticateCustomer, async (req, res) => {
  try {
    const userId = req.user.userId;
    const addressId = req.params.id;
    const updated = await serverDb.updateAddress(userId, addressId, req.body);
    if (!updated) {
      return res.status(404).json({ error: "Address not found" });
    }
    return res.json({ address: updated });
  } catch (err) {
    return res.status(500).json({ error: "Failed to update address" });
  }
});
router.delete("/auth/addresses/:id", authenticateCustomer, async (req, res) => {
  try {
    const userId = req.user.userId;
    const addressId = req.params.id;
    const success = await serverDb.deleteAddress(userId, addressId);
    if (!success) {
      return res.status(404).json({ error: "Address not found" });
    }
    return res.json({ message: "Address removed successfully" });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete address" });
  }
});
router.post("/orders", rateLimiter(15, 6e4), async (req, res) => {
  try {
    const { customer, items, paymentMethod, notes, addressId } = req.body;
    if (!customer) {
      return res.status(400).json({ error: "Customer and delivery details are required" });
    }
    const addrVal = validateAddress(customer);
    if (!addrVal.valid) {
      return res.status(400).json({ error: addrVal.error });
    }
    const pricing = validateAndPriceOrder(items);
    if (!pricing.valid) {
      return res.status(400).json({ error: pricing.error });
    }
    const isDuplicate = await serverDb.checkDuplicateOrder(customer.phone, pricing.subtotal, 3e4);
    if (isDuplicate) {
      return res.status(429).json({
        error: "An identical order was just placed seconds ago. Please check your order history or wait a moment."
      });
    }
    const phoneVal = validatePhone(customer.phone);
    const cleanCustomer = {
      ...customer,
      fullName: customer.fullName.trim(),
      phone: phoneVal.normalized,
      address: customer.address.trim(),
      villageTown: customer.villageTown.trim(),
      pincode: customer.pincode.trim()
    };
    let customerId = "GUEST";
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const payload = verifyToken(authHeader.slice(7));
      if (payload && payload.userId) {
        customerId = payload.userId;
      }
    }
    const addressSnapshot = {
      id: addressId || `snap-${Date.now()}`,
      label: customer.label || "Home",
      recipientName: cleanCustomer.fullName,
      phone: cleanCustomer.phone,
      addressLine: cleanCustomer.address,
      landmark: cleanCustomer.landmark || "",
      villageTown: cleanCustomer.villageTown,
      district: cleanCustomer.district || "",
      state: cleanCustomer.state || "Tamil Nadu",
      pincode: cleanCustomer.pincode,
      coordinates: cleanCustomer.coordinates,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const isOnlinePayment = paymentMethod === "Online" || paymentMethod === "ONLINE_UPI";
    const order = await serverDb.createOrder({
      customerId,
      customer: cleanCustomer,
      addressSnapshot,
      items: pricing.validatedItems,
      subtotal: pricing.subtotal,
      deliveryCharge: pricing.deliveryCharge,
      discountAmount: 0,
      totalAmount: pricing.totalAmount,
      paymentMethod: isOnlinePayment ? "ONLINE_UPI" : "COD",
      paymentStatus: isOnlinePayment ? "Paid" : "Pending",
      orderStatus: "Order Confirmed",
      whatsappStatus: whatsappService.isConfigured() ? "pending" : "not_configured",
      excelSyncStatus: excelSyncService.isConfigured() ? "pending" : "not_configured",
      notes: notes?.trim() || ""
    });
    if (customerId !== "GUEST") {
      try {
        const addresses = await serverDb.getUserAddresses(customerId);
        if (addresses.length === 0) {
          await serverDb.addAddress(customerId, {
            label: "Home",
            recipientName: cleanCustomer.fullName,
            phone: cleanCustomer.phone,
            addressLine: cleanCustomer.address,
            landmark: cleanCustomer.landmark || "",
            villageTown: cleanCustomer.villageTown,
            district: cleanCustomer.district || "",
            state: cleanCustomer.state || "Tamil Nadu",
            pincode: cleanCustomer.pincode,
            isDefault: true,
            coordinates: cleanCustomer.coordinates
          });
        }
      } catch {
      }
    }
    try {
      webhookService.queueAndDispatch(buildOrderCreatedPayload(order)).catch((err) => {
        console.warn("Webhook queue notice:", err);
      });
    } catch (err) {
      console.warn("Non-fatal webhook queue error:", err);
    }
    try {
      whatsappService.sendOrderConfirmation(order).then((waRes) => {
        serverDb.updateOrderSyncStatuses(order.id, {
          whatsappStatus: waRes.status,
          whatsappSentAt: waRes.sentAt,
          whatsappError: waRes.error
        }).catch(() => {
        });
      }).catch((err) => {
        serverDb.updateOrderSyncStatuses(order.id, {
          whatsappStatus: "failed",
          whatsappError: err.message
        }).catch(() => {
        });
      });
    } catch (err) {
      console.warn("Non-fatal WhatsApp dispatch notice:", err);
    }
    try {
      excelSyncService.syncOrderToExcel(order).then((xlRes) => {
        serverDb.updateOrderSyncStatuses(order.id, {
          excelSyncStatus: xlRes.status,
          excelSyncAt: xlRes.syncedAt,
          excelError: xlRes.error
        }).catch(() => {
        });
      }).catch((err) => {
        serverDb.updateOrderSyncStatuses(order.id, {
          excelSyncStatus: "failed",
          excelError: err.message
        }).catch(() => {
        });
      });
    } catch (err) {
      console.warn("Non-fatal Excel sync notice:", err);
    }
    return res.status(201).json({
      success: true,
      message: "Order placed successfully and saved to database",
      order
    });
  } catch (err) {
    console.error("Order creation error:", err);
    return res.status(500).json({ error: "Failed to process order. Please try again." });
  }
});
router.get("/orders/:id", async (req, res) => {
  try {
    const order = await serverDb.getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    return res.json({ order });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch order" });
  }
});
router.get("/orders/customer/my-orders", authenticateCustomer, async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.phone) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const orders = await serverDb.getOrdersByPhone(user.phone);
    return res.json({ orders });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch customer orders" });
  }
});
router.post("/admin/login", (req, res) => {
  const { passcode } = req.body;
  if (!passcode || !verifyAdminPasscode(passcode)) {
    return res.status(401).json({ error: "Invalid admin passcode. Access denied." });
  }
  const token = createAdminToken();
  return res.json({
    success: true,
    message: "Admin authentication successful",
    token
  });
});
router.get("/admin/orders", authenticateAdmin, async (req, res) => {
  try {
    const status = req.query.status;
    const orders = await serverDb.getAllOrders(status);
    return res.json({
      orders,
      count: orders.length,
      lastSync: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (err) {
    console.error("Admin fetch orders error:", err);
    return res.status(500).json({ error: "Failed to load orders from shared database" });
  }
});
router.patch("/admin/orders/:id/status", authenticateAdmin, async (req, res) => {
  try {
    const { status, note } = req.body;
    const validStatuses = [
      "Order Confirmed",
      "Processing",
      "Dispatched",
      "Out for Delivery",
      "Delivered",
      "Cancelled"
    ];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
    }
    const result = await serverDb.updateOrderStatus(req.params.id, status, note);
    if (!result) {
      return res.status(404).json({ error: "Order not found" });
    }
    if (result.changed) {
      try {
        webhookService.queueAndDispatch(
          buildStatusChangedPayload(result.order, result.previousStatus, status)
        ).catch((err) => console.warn("Status webhook notice:", err));
      } catch (err) {
        console.warn("Non-fatal webhook queue notice:", err);
      }
    }
    return res.json({
      success: true,
      message: `Order status updated to ${status}`,
      order: result.order,
      changed: result.changed
    });
  } catch (err) {
    console.error("Update status error:", err);
    return res.status(500).json({ error: "Failed to update order status" });
  }
});
router.get("/admin/webhooks/status", authenticateAdmin, async (_req, res) => {
  try {
    const stats = await serverDb.getOutboxStats();
    return res.json({
      configured: webhookService.isConfigured(),
      webhookUrl: webhookService.getWebhookUrl() ? "Configured (Active)" : "Not Set",
      stats
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch webhook status" });
  }
});
router.post("/admin/webhooks/retry", authenticateAdmin, async (_req, res) => {
  try {
    const result = await webhookService.retryPendingEvents();
    return res.json({
      success: true,
      message: `Processed ${result.processed} events (${result.succeeded} delivered, ${result.failed} failed)`,
      result
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to retry webhook events" });
  }
});
router.get("/admin/stats", authenticateAdmin, async (_req, res) => {
  try {
    const orders = await serverDb.getAllOrders();
    const totalOrders = orders.length;
    const confirmed = orders.filter((o) => o.orderStatus === "Order Confirmed").length;
    const processing = orders.filter((o) => o.orderStatus === "Processing").length;
    const dispatched = orders.filter((o) => o.orderStatus === "Dispatched" || o.orderStatus === "Out for Delivery").length;
    const delivered = orders.filter((o) => o.orderStatus === "Delivered").length;
    const cancelled = orders.filter((o) => o.orderStatus === "Cancelled").length;
    const totalRevenue = orders.filter((o) => o.orderStatus !== "Cancelled").reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    return res.json({
      stats: {
        totalOrders,
        confirmed,
        processing,
        dispatched,
        delivered,
        cancelled,
        totalRevenue
      }
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to compute admin stats" });
  }
});
router.get("/products", async (_req, res) => {
  try {
    const products = await serverDb.getAllProducts();
    return res.json({ products });
  } catch (err) {
    return res.status(500).json({ error: "Failed to load products" });
  }
});
router.get("/products/:id", async (req, res) => {
  try {
    const product = await serverDb.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    return res.json({ product });
  } catch (err) {
    return res.status(500).json({ error: "Failed to load product" });
  }
});
router.post("/admin/products", authenticateAdmin, async (req, res) => {
  try {
    const productData = req.body;
    if (!productData.name || !productData.id) {
      return res.status(400).json({ error: "Product ID and Name are required" });
    }
    const saved = await serverDb.saveProduct(productData);
    return res.status(201).json({ success: true, product: saved });
  } catch (err) {
    return res.status(500).json({ error: "Failed to save product" });
  }
});
router.delete("/admin/products/:id", authenticateAdmin, async (req, res) => {
  try {
    const success = await serverDb.deleteProduct(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "Product not found" });
    }
    return res.json({ success: true, message: "Product deleted" });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete product" });
  }
});
router.get("/admin/whatsapp/status", authenticateAdmin, async (_req, res) => {
  return res.json({
    configured: whatsappService.isConfigured(),
    phoneNumberIdConfigured: Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID),
    accessTokenConfigured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN),
    templateConfigured: Boolean(process.env.WHATSAPP_TEMPLATE_NAME)
  });
});
router.get("/admin/excel/status", authenticateAdmin, async (_req, res) => {
  const status = excelSyncService.getConfigurationStatus();
  return res.json(status);
});
router.post("/admin/excel/sync", authenticateAdmin, async (_req, res) => {
  try {
    if (!excelSyncService.isConfigured()) {
      return res.status(400).json({
        error: "Microsoft Graph Excel credentials not configured. Please set MS_GRAPH_CLIENT_ID, MS_GRAPH_CLIENT_SECRET, MS_GRAPH_TENANT_ID, MS_EXCEL_DRIVE_ID, and MS_EXCEL_FILE_ID."
      });
    }
    const orders = await serverDb.getAllOrders();
    const unsynced = orders.filter((o) => o.excelSyncStatus !== "synced");
    let syncedCount = 0;
    let failedCount = 0;
    for (const order of unsynced) {
      const result = await excelSyncService.syncOrderToExcel(order);
      await serverDb.updateOrderSyncStatuses(order.id, {
        excelSyncStatus: result.status,
        excelSyncAt: result.syncedAt,
        excelError: result.error
      });
      if (result.success) syncedCount++;
      else failedCount++;
    }
    return res.json({
      success: true,
      message: `Excel sync completed: ${syncedCount} synced, ${failedCount} failed`,
      syncedCount,
      failedCount,
      totalProcessed: unsynced.length
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to execute Excel sync: " + err.message });
  }
});
router.post("/admin/whatsapp/retry/:orderId", authenticateAdmin, async (req, res) => {
  try {
    const order = await serverDb.getOrderById(req.params.orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    const result = await whatsappService.sendOrderConfirmation(order);
    await serverDb.updateOrderSyncStatuses(order.id, {
      whatsappStatus: result.status,
      whatsappSentAt: result.sentAt,
      whatsappError: result.error
    });
    return res.json({ success: result.success, result });
  } catch (err) {
    return res.status(500).json({ error: "Failed to send WhatsApp message: " + err.message });
  }
});
app.use("/api", router);
app.use("/", router);
app.use((req, res) => {
  res.status(404).json({ error: "API route not found", path: req.url });
});
app.use((err, _req, res, _next) => {
  console.error("Unhandled API error:", err);
  res.status(500).json({ error: err.message || "Internal server error" });
});
function handler(req, res) {
  return app(req, res);
}
export {
  handler as default
};
