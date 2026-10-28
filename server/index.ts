import express, { Request, Response, NextFunction } from 'express';
import { serverDb } from './_lib/db';
import {
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
  verifyAdminPasscode,
  createAdminToken,
  verifyAdminToken,
} from './_lib/auth';
import { validatePhone, validateAddress, validateAndPriceOrder, validatePincode } from './_lib/validation';
import { OrderStatus, CustomerAddress } from '../src/types';
import { webhookService, buildOrderCreatedPayload, buildStatusChangedPayload } from './_lib/webhook';
import { whatsappService } from './_lib/whatsapp';
import { excelSyncService } from './_lib/excelSync';

const app = express();

// Parse JSON bodies (up to 2MB)
app.use(express.json({ limit: '2mb' }));

// Permissive CORS middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-admin-passcode, x-admin-key');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// In-memory sliding rate limiter for sensitive endpoints
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function rateLimiter(limit: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const key = `${ip}:${req.path}`;
    const now = Date.now();
    const entry = rateLimitMap.get(key as string);

    if (!entry || now > entry.resetAt) {
      rateLimitMap.set(key as string, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= limit) {
      return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
    }

    entry.count++;
    next();
  };
}

// Middleware: Customer Authentication
function authenticateCustomer(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload || !payload.userId) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  (req as any).user = payload;
  next();
}

// Middleware: Admin Authentication (Supports signed JWT or configured admin passcode)
function authenticateAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const adminKey = (req.headers['x-admin-passcode'] || req.headers['x-admin-key']) as string;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (verifyAdminToken(token) || verifyAdminPasscode(token)) {
      return next();
    }
  }

  if (adminKey && (verifyAdminPasscode(adminKey) || verifyAdminToken(adminKey))) {
    return next();
  }

  return res.status(403).json({ error: 'Unauthorized: Admin access required' });
}

// Sub-router to allow dual mounting on both '/' and '/api'
const router = express.Router();

// ==========================================
// 1. HEALTH & ROOT STATUS
// ==========================================
router.get(['/', '/health'], async (_req: Request, res: Response) => {
  try {
    const cloud = await serverDb.isCloudConnected();
    return res.json({
      status: 'healthy',
      mode: cloud ? 'cloud-mongodb' : 'persistent-store',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.json({
      status: 'healthy',
      mode: 'persistent-store',
      note: 'Fallback active',
      timestamp: new Date().toISOString(),
    });
  }
});

// ==========================================
// 2. CUSTOMER AUTHENTICATION
// ==========================================

// Synchronize Firebase Customer Authentication (Google, Phone OTP, Email/Password)
router.post('/auth/firebase-sync', rateLimiter(20, 60000), async (req: Request, res: Response) => {
  try {
    const { uid, email, phone, fullName, authProvider, emailVerified, phoneVerified, initialAddress } = req.body;

    if (!uid) {
      return res.status(400).json({ error: 'Firebase UID is required' });
    }

    const adminEmails = ['krishnamoorthykavinash@gmail.com', 'admin@kvnteapowder.com'];
    const adminPhones = ['9787513911', '6383050287'];

    const cleanEmail = email ? email.trim().toLowerCase() : '';
    const cleanPhone = phone ? phone.replace(/\D/g, '').slice(-10) : '';

    const isAdmin = adminEmails.includes(cleanEmail) || adminPhones.includes(cleanPhone);
    const role = isAdmin ? 'admin' : 'customer';

    const user = await serverDb.upsertFirebaseUser({
      firebaseUid: uid,
      email: cleanEmail,
      phone: cleanPhone,
      fullName: fullName || 'Valued Customer',
      authProvider: authProvider || 'email',
      emailVerified: Boolean(emailVerified),
      phoneVerified: Boolean(phoneVerified),
      initialAddress,
    });

    const token = createToken({
      userId: user.id,
      phone: user.phone || '0000000000',
      role,
    });

    const { passwordHash: _, ...safeUser } = user;
    return res.json({
      message: 'Authentication synchronized successfully',
      user: { ...safeUser, role },
      token,
      isAdmin,
    });
  } catch (err: any) {
    console.error('Firebase sync error:', err);
    return res.status(500).json({ error: 'Failed to synchronize authentication' });
  }
});

// Register a new customer
router.post('/auth/register', rateLimiter(10, 60000), async (req: Request, res: Response) => {
  try {
    const { fullName, phone, password, email, initialAddress } = req.body;

    if (!fullName || fullName.trim().length < 2) {
      return res.status(400).json({ error: 'Full name is required (at least 2 characters)' });
    }

    const phoneValidation = validatePhone(phone);
    if (!phoneValidation.valid) {
      return res.status(400).json({ error: phoneValidation.error });
    }

    if (!password || password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters long' });
    }

    const existingUser = await serverDb.getUserByPhone(phoneValidation.normalized);
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this mobile number already exists. Please log in.' });
    }

    const passwordHash = hashPassword(password);
    const newUser = await serverDb.createUser({
      fullName: fullName.trim(),
      phone: phoneValidation.normalized,
      email: email?.trim(),
      passwordHash,
      initialAddress,
    });

    const token = createToken({ userId: newUser.id, phone: newUser.phone, role: 'customer' });
    const { passwordHash: _, ...safeUser } = newUser;

    return res.status(201).json({
      message: 'Account created successfully',
      user: safeUser,
      token,
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
});

// Customer Login
router.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { phone, password } = req.body;

    const phoneValidation = validatePhone(phone);
    if (!phoneValidation.valid) {
      return res.status(400).json({ error: phoneValidation.error });
    }

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const user = await serverDb.getUserByPhone(phoneValidation.normalized);
    if (!user) {
      return res.status(401).json({ error: 'No account found with this mobile number. Please register.' });
    }

    const validPassword = verifyPassword(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }

    const token = createToken({ userId: user.id, phone: user.phone, role: 'customer' });
    const { passwordHash: _, ...safeUser } = user;

    return res.json({
      message: 'Login successful',
      user: safeUser,
      token,
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// Customer Current User Profile
router.get('/auth/me', authenticateCustomer, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const user = await serverDb.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const { passwordHash: _, ...safeUser } = user;
    return res.json({ user: safeUser });
  } catch (err: any) {
    console.error('Get profile error:', err);
    return res.status(500).json({ error: 'Failed to retrieve profile' });
  }
});

// Update Profile
router.put('/auth/profile', authenticateCustomer, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { fullName, email } = req.body;
    const updated = await serverDb.updateUserProfile(userId, { fullName, email });
    if (!updated) {
      return res.status(404).json({ error: 'User not found' });
    }
    const { passwordHash: _, ...safeUser } = updated;
    return res.json({ message: 'Profile updated successfully', user: safeUser });
  } catch (err: any) {
    console.error('Update profile error:', err);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Customer Saved Addresses
router.get('/auth/addresses', authenticateCustomer, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const addresses = await serverDb.getUserAddresses(userId);
    return res.json({ addresses });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to load addresses' });
  }
});

// Add New Delivery Address
router.post('/auth/addresses', authenticateCustomer, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const addressData = req.body;

    if (!addressData.recipientName || addressData.recipientName.trim().length < 2) {
      return res.status(400).json({ error: 'Recipient name is required' });
    }
    const phoneVal = validatePhone(addressData.phone);
    if (!phoneVal.valid) {
      return res.status(400).json({ error: phoneVal.error });
    }
    if (!addressData.addressLine || addressData.addressLine.trim().length < 5) {
      return res.status(400).json({ error: 'Full address line is required' });
    }
    const pinVal = validatePincode(addressData.pincode);
    if (!pinVal.valid) {
      return res.status(400).json({ error: pinVal.error });
    }

    const saved = await serverDb.addAddress(userId, {
      label: addressData.label || 'Home',
      recipientName: addressData.recipientName.trim(),
      phone: phoneVal.normalized,
      addressLine: addressData.addressLine.trim(),
      landmark: addressData.landmark?.trim() || '',
      villageTown: addressData.villageTown?.trim() || '',
      district: addressData.district?.trim() || '',
      state: addressData.state?.trim() || 'Tamil Nadu',
      pincode: addressData.pincode.trim(),
      isDefault: Boolean(addressData.isDefault),
      coordinates: addressData.coordinates,
    });

    return res.status(201).json({ address: saved });
  } catch (err: any) {
    console.error('Add address error:', err);
    return res.status(500).json({ error: 'Failed to save address' });
  }
});

// Update Existing Address
router.put('/auth/addresses/:id', authenticateCustomer, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const addressId = req.params.id;
    const updated = await serverDb.updateAddress(userId, addressId, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Address not found' });
    }
    return res.json({ address: updated });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update address' });
  }
});

// Delete Address
router.delete('/auth/addresses/:id', authenticateCustomer, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const addressId = req.params.id;
    const success = await serverDb.deleteAddress(userId, addressId);
    if (!success) {
      return res.status(404).json({ error: 'Address not found' });
    }
    return res.json({ message: 'Address removed successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete address' });
  }
});

// ==========================================
// 3. ORDER CREATION & CUSTOMER ORDERS
// ==========================================

// Place Order
router.post('/orders', rateLimiter(15, 60000), async (req: Request, res: Response) => {
  try {
    const { customer, items, paymentMethod, notes, addressId } = req.body;

    if (!customer) {
      return res.status(400).json({ error: 'Customer and delivery details are required' });
    }

    const addrVal = validateAddress(customer);
    if (!addrVal.valid) {
      return res.status(400).json({ error: addrVal.error });
    }

    const pricing = validateAndPriceOrder(items);
    if (!pricing.valid) {
      return res.status(400).json({ error: pricing.error });
    }

    const isDuplicate = await serverDb.checkDuplicateOrder(customer.phone, pricing.subtotal, 30000);
    if (isDuplicate) {
      return res.status(429).json({
        error: 'An identical order was just placed seconds ago. Please check your order history or wait a moment.',
      });
    }

    const phoneVal = validatePhone(customer.phone);
    const cleanCustomer = {
      ...customer,
      fullName: customer.fullName.trim(),
      phone: phoneVal.normalized,
      address: customer.address.trim(),
      villageTown: customer.villageTown.trim(),
      pincode: customer.pincode.trim(),
    };

    let customerId = 'GUEST';
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const payload = verifyToken(authHeader.slice(7));
      if (payload && payload.userId) {
        customerId = payload.userId;
      }
    }

    const addressSnapshot: CustomerAddress = {
      id: addressId || `snap-${Date.now()}`,
      label: (customer.label as any) || 'Home',
      recipientName: cleanCustomer.fullName,
      phone: cleanCustomer.phone,
      addressLine: cleanCustomer.address,
      landmark: cleanCustomer.landmark || '',
      villageTown: cleanCustomer.villageTown,
      district: cleanCustomer.district || '',
      state: cleanCustomer.state || 'Tamil Nadu',
      pincode: cleanCustomer.pincode,
      coordinates: cleanCustomer.coordinates,
      createdAt: new Date().toISOString(),
    };

    const isOnlinePayment = paymentMethod === 'Online' || paymentMethod === 'ONLINE_UPI';
    const order = await serverDb.createOrder({
      customerId,
      customer: cleanCustomer,
      addressSnapshot,
      items: pricing.validatedItems,
      subtotal: pricing.subtotal,
      deliveryCharge: pricing.deliveryCharge,
      discountAmount: 0,
      totalAmount: pricing.totalAmount,
      paymentMethod: isOnlinePayment ? 'ONLINE_UPI' : 'COD',
      paymentStatus: isOnlinePayment ? 'Paid' : 'Pending',
      orderStatus: 'Order Confirmed',
      whatsappStatus: whatsappService.isConfigured() ? 'pending' : 'not_configured',
      excelSyncStatus: excelSyncService.isConfigured() ? 'pending' : 'not_configured',
      notes: notes?.trim() || '',
    });

    // Auto-save address to customer profile if first purchase and authenticated
    if (customerId !== 'GUEST') {
      try {
        const addresses = await serverDb.getUserAddresses(customerId);
        if (addresses.length === 0) {
          await serverDb.addAddress(customerId, {
            label: 'Home',
            recipientName: cleanCustomer.fullName,
            phone: cleanCustomer.phone,
            addressLine: cleanCustomer.address,
            landmark: cleanCustomer.landmark || '',
            villageTown: cleanCustomer.villageTown,
            district: cleanCustomer.district || '',
            state: cleanCustomer.state || 'Tamil Nadu',
            pincode: cleanCustomer.pincode,
            isDefault: true,
            coordinates: cleanCustomer.coordinates,
          });
        }
      } catch {
        // non-fatal
      }
    }

    // 1. Dispatch n8n backup webhook asynchronously
    try {
      webhookService.queueAndDispatch(buildOrderCreatedPayload(order)).catch((err) => {
        console.warn('Webhook queue notice:', err);
      });
    } catch (err) {
      console.warn('Non-fatal webhook queue error:', err);
    }

    // 2. Dispatch official WhatsApp Business Cloud API confirmation asynchronously
    try {
      whatsappService.sendOrderConfirmation(order).then((waRes) => {
        serverDb.updateOrderSyncStatuses(order.id, {
          whatsappStatus: waRes.status,
          whatsappSentAt: waRes.sentAt,
          whatsappError: waRes.error,
        }).catch(() => {});
      }).catch((err) => {
        serverDb.updateOrderSyncStatuses(order.id, {
          whatsappStatus: 'failed',
          whatsappError: err.message,
        }).catch(() => {});
      });
    } catch (err) {
      console.warn('Non-fatal WhatsApp dispatch notice:', err);
    }

    // 3. Dispatch Microsoft Graph Excel sync asynchronously
    try {
      excelSyncService.syncOrderToExcel(order).then((xlRes) => {
        serverDb.updateOrderSyncStatuses(order.id, {
          excelSyncStatus: xlRes.status,
          excelSyncAt: xlRes.syncedAt,
          excelError: xlRes.error,
        }).catch(() => {});
      }).catch((err) => {
        serverDb.updateOrderSyncStatuses(order.id, {
          excelSyncStatus: 'failed',
          excelError: err.message,
        }).catch(() => {});
      });
    } catch (err) {
      console.warn('Non-fatal Excel sync notice:', err);
    }

    return res.status(201).json({
      success: true,
      message: 'Order placed successfully and saved to database',
      order,
    });
  } catch (err: any) {
    console.error('Order creation error:', err);
    return res.status(500).json({ error: 'Failed to process order. Please try again.' });
  }
});

// Get Order Details by ID
router.get('/orders/:id', async (req: Request, res: Response) => {
  try {
    const order = await serverDb.getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    return res.json({ order });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Customer: Get My Orders (Strictly protected by customer authentication)
router.get('/orders/customer/my-orders', authenticateCustomer, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !user.phone) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const orders = await serverDb.getOrdersByPhone(user.phone);
    return res.json({ orders });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch customer orders' });
  }
});

// ==========================================
// 4. ADMIN PANEL ENDPOINTS
// ==========================================

// Admin Login
router.post('/admin/login', (req: Request, res: Response) => {
  const { passcode } = req.body;
  if (!passcode || !verifyAdminPasscode(passcode)) {
    return res.status(401).json({ error: 'Invalid admin passcode. Access denied.' });
  }

  const token = createAdminToken();
  return res.json({
    success: true,
    message: 'Admin authentication successful',
    token,
  });
});

// Admin: Fetch All Orders
router.get('/admin/orders', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string;
    const orders = await serverDb.getAllOrders(status);
    return res.json({
      orders,
      count: orders.length,
      lastSync: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Admin fetch orders error:', err);
    return res.status(500).json({ error: 'Failed to load orders from shared database' });
  }
});

// Admin: Update Order Status
router.patch('/admin/orders/:id/status', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { status, note } = req.body;
    const validStatuses: OrderStatus[] = [
      'Order Confirmed',
      'Processing',
      'Dispatched',
      'Out for Delivery',
      'Delivered',
      'Cancelled',
    ];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const result = await serverDb.updateOrderStatus(req.params.id, status, note);
    if (!result) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Only emit status_changed event when an actual transition occurred
    if (result.changed) {
      try {
        webhookService.queueAndDispatch(
          buildStatusChangedPayload(result.order, result.previousStatus, status)
        ).catch((err) => console.warn('Status webhook notice:', err));
      } catch (err) {
        console.warn('Non-fatal webhook queue notice:', err);
      }
    }

    return res.json({
      success: true,
      message: `Order status updated to ${status}`,
      order: result.order,
      changed: result.changed,
    });
  } catch (err: any) {
    console.error('Update status error:', err);
    return res.status(500).json({ error: 'Failed to update order status' });
  }
});

// Admin: Get Webhook Outbox Status
router.get('/admin/webhooks/status', authenticateAdmin, async (_req: Request, res: Response) => {
  try {
    const stats = await serverDb.getOutboxStats();
    return res.json({
      configured: webhookService.isConfigured(),
      webhookUrl: webhookService.getWebhookUrl() ? 'Configured (Active)' : 'Not Set',
      stats,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch webhook status' });
  }
});

// Admin: Retry Pending / Failed Webhook Events
router.post('/admin/webhooks/retry', authenticateAdmin, async (_req: Request, res: Response) => {
  try {
    const result = await webhookService.retryPendingEvents();
    return res.json({
      success: true,
      message: `Processed ${result.processed} events (${result.succeeded} delivered, ${result.failed} failed)`,
      result,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retry webhook events' });
  }
});

// Admin: Statistics & Overview
router.get('/admin/stats', authenticateAdmin, async (_req: Request, res: Response) => {
  try {
    const orders = await serverDb.getAllOrders();
    const totalOrders = orders.length;
    const confirmed = orders.filter((o) => o.orderStatus === 'Order Confirmed').length;
    const processing = orders.filter((o) => o.orderStatus === 'Processing').length;
    const dispatched = orders.filter((o) => o.orderStatus === 'Dispatched' || o.orderStatus === 'Out for Delivery').length;
    const delivered = orders.filter((o) => o.orderStatus === 'Delivered').length;
    const cancelled = orders.filter((o) => o.orderStatus === 'Cancelled').length;

    const totalRevenue = orders
      .filter((o) => o.orderStatus !== 'Cancelled')
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    return res.json({
      stats: {
        totalOrders,
        confirmed,
        processing,
        dispatched,
        delivered,
        cancelled,
        totalRevenue,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to compute admin stats' });
  }
});

// ==========================================
// 5. PRODUCT CATALOG ENDPOINTS
// ==========================================

// Get All Products (Public)
router.get('/products', async (_req: Request, res: Response) => {
  try {
    const products = await serverDb.getAllProducts();
    return res.json({ products });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to load products' });
  }
});

// Get Single Product
router.get('/products/:id', async (req: Request, res: Response) => {
  try {
    const product = await serverDb.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    return res.json({ product });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to load product' });
  }
});

// Admin: Save or Update Product
router.post('/admin/products', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const productData = req.body;
    if (!productData.name || !productData.id) {
      return res.status(400).json({ error: 'Product ID and Name are required' });
    }
    const saved = await serverDb.saveProduct(productData);
    return res.status(201).json({ success: true, product: saved });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to save product' });
  }
});

// Admin: Delete Product
router.delete('/admin/products/:id', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const success = await serverDb.deleteProduct(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Product not found' });
    }
    return res.json({ success: true, message: 'Product deleted' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete product' });
  }
});

// ==========================================
// 6. WHATSAPP & MICROSOFT EXCEL SYNC ENDPOINTS
// ==========================================

// Admin: WhatsApp Cloud API Status
router.get('/admin/whatsapp/status', authenticateAdmin, async (_req: Request, res: Response) => {
  return res.json({
    configured: whatsappService.isConfigured(),
    phoneNumberIdConfigured: Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID),
    accessTokenConfigured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN),
    templateConfigured: Boolean(process.env.WHATSAPP_TEMPLATE_NAME),
  });
});

// Admin: Microsoft Graph Excel Sync Status
router.get('/admin/excel/status', authenticateAdmin, async (_req: Request, res: Response) => {
  const status = excelSyncService.getConfigurationStatus();
  return res.json(status);
});

// Admin: Trigger Manual Excel Sync for Orders
router.post('/admin/excel/sync', authenticateAdmin, async (_req: Request, res: Response) => {
  try {
    if (!excelSyncService.isConfigured()) {
      return res.status(400).json({
        error: 'Microsoft Graph Excel credentials not configured. Please set MS_GRAPH_CLIENT_ID, MS_GRAPH_CLIENT_SECRET, MS_GRAPH_TENANT_ID, MS_EXCEL_DRIVE_ID, and MS_EXCEL_FILE_ID.',
      });
    }

    const orders = await serverDb.getAllOrders();
    const unsynced = orders.filter((o) => o.excelSyncStatus !== 'synced');
    let syncedCount = 0;
    let failedCount = 0;

    for (const order of unsynced) {
      const result = await excelSyncService.syncOrderToExcel(order);
      await serverDb.updateOrderSyncStatuses(order.id, {
        excelSyncStatus: result.status,
        excelSyncAt: result.syncedAt,
        excelError: result.error,
      });
      if (result.success) syncedCount++;
      else failedCount++;
    }

    return res.json({
      success: true,
      message: `Excel sync completed: ${syncedCount} synced, ${failedCount} failed`,
      syncedCount,
      failedCount,
      totalProcessed: unsynced.length,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to execute Excel sync: ' + err.message });
  }
});

// Admin: Retry WhatsApp Confirmation for an Order
router.post('/admin/whatsapp/retry/:orderId', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const order = await serverDb.getOrderById(req.params.orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    const result = await whatsappService.sendOrderConfirmation(order);
    await serverDb.updateOrderSyncStatuses(order.id, {
      whatsappStatus: result.status,
      whatsappSentAt: result.sentAt,
      whatsappError: result.error,
    });
    return res.json({ success: result.success, result });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to send WhatsApp message: ' + err.message });
  }
});

// Mount on BOTH '/api' AND '/' to guarantee route matches regardless of Vercel path rewrite
app.use('/api', router);
app.use('/', router);

// Explicit 404 handler so res.end() is ALWAYS sent as valid JSON
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'API route not found', path: req.url });
});

// Global Express error handler to prevent unhandled 500 HTML crashes
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled API error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Export default function for Vercel Serverless Function runtime
export default function handler(req: any, res: any) {
  return app(req, res);
}
