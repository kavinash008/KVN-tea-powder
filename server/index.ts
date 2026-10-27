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
import { OrderStatus } from '../src/types';
import { webhookService, buildOrderCreatedPayload, buildStatusChangedPayload } from './_lib/webhook';

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

// Register a new customer
router.post('/auth/register', async (req: Request, res: Response) => {
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
router.post('/orders', async (req: Request, res: Response) => {
  try {
    const { customer, items, paymentMethod, notes } = req.body;

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

    const isOnlinePayment = paymentMethod === 'Online' || paymentMethod === 'ONLINE_UPI';
    const order = await serverDb.createOrder({
      customer: cleanCustomer,
      items: pricing.validatedItems,
      subtotal: pricing.subtotal,
      deliveryCharge: pricing.deliveryCharge,
      discountAmount: 0,
      totalAmount: pricing.totalAmount,
      paymentMethod: isOnlinePayment ? 'ONLINE_UPI' : 'COD',
      paymentStatus: isOnlinePayment ? 'Paid' : 'Pending',
      orderStatus: 'Order Confirmed',
      notes: notes?.trim() || '',
    });

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const payload = verifyToken(authHeader.slice(7));
      if (payload && payload.userId) {
        const addresses = await serverDb.getUserAddresses(payload.userId);
        if (addresses.length === 0) {
          await serverDb.addAddress(payload.userId, {
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
      }
    }

    // Queue and dispatch n8n backup webhook asynchronously (does not block or fail user order)
    try {
      webhookService.queueAndDispatch(buildOrderCreatedPayload(order)).catch((err) => {
        console.warn('Webhook queue notice:', err);
      });
    } catch (err) {
      console.warn('Non-fatal webhook queue error:', err);
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
