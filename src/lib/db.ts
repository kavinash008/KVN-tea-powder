import {
  Product,
  Category,
  CartItem,
  Order,
  Feedback,
  ContactMessage,
  Coupon,
  Banner,
  DeliveryArea,
  BusinessConfig,
} from '../types';
import {
  INITIAL_BUSINESS_CONFIG,
  INITIAL_CATEGORIES,
  INITIAL_PRODUCTS,
  INITIAL_BANNERS,
  INITIAL_DELIVERY_AREAS,
  INITIAL_COUPONS,
} from '../data/initialData';
import { sendGmailNotification, appendOrderToGoogleSheet } from './googleWorkspace';

// Storage keys
const STORAGE_PREFIX = 'kvn_store_';
const KEYS = {
  PRODUCTS: `${STORAGE_PREFIX}products`,
  CATEGORIES: `${STORAGE_PREFIX}categories`,
  ORDERS: `${STORAGE_PREFIX}orders`,
  FEEDBACK: `${STORAGE_PREFIX}feedback`,
  CONTACT: `${STORAGE_PREFIX}contact`,
  COUPONS: `${STORAGE_PREFIX}coupons`,
  BANNERS: `${STORAGE_PREFIX}banners`,
  DELIVERY_AREAS: `${STORAGE_PREFIX}delivery_areas`,
  CONFIG: `${STORAGE_PREFIX}config`,
  WISHLIST: `${STORAGE_PREFIX}wishlist`,
  CART: `${STORAGE_PREFIX}cart`,
  CUSTOMER_PROFILE: `${STORAGE_PREFIX}customer_profile`,
};

function getFromStorage<T>(key: string, fallback: T): T {
  try {
    const data = localStorage.getItem(key);
    if (!data) return fallback;
    return JSON.parse(data) as T;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kvn_store_updated', { detail: { key, value } }));
    }
  } catch (err) {
    console.error('Storage quota exceeded or error saving:', err);
  }
}

// Database store object with CRUD operations
export const db = {
  // PRODUCTS
  getProducts(): Product[] {
    return getFromStorage<Product[]>(KEYS.PRODUCTS, INITIAL_PRODUCTS);
  },

  getProductById(id: string): Product | undefined {
    return this.getProducts().find((p) => p.id === id);
  },

  getProductBySlug(slug: string): Product | undefined {
    return this.getProducts().find((p) => p.slug === slug);
  },

  saveProduct(productData: Partial<Product> & { name: string; mainCategory: any }): Product {
    const products = this.getProducts();
    const existingIndex = products.findIndex((p) => p.id === productData.id);

    const slug = (productData.name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const now = new Date().toISOString();

    if (existingIndex >= 0) {
      const updated: Product = {
        ...products[existingIndex],
        ...productData,
        slug: productData.slug || slug,
        updatedAt: now,
      } as Product;
      products[existingIndex] = updated;
      saveToStorage(KEYS.PRODUCTS, products);
      return updated;
    } else {
      const newProduct: Product = {
        id: `prod-${Date.now()}`,
        sku: productData.sku || `KVN-${Math.floor(1000 + Math.random() * 9000)}`,
        name: productData.name,
        slug: slug,
        categorySlug: productData.categorySlug || 'general',
        mainCategory: productData.mainCategory || 'tea',
        brand: productData.brand || 'KVN TEAPOWDER',
        description: productData.description || '',
        brewingInstructions: productData.brewingInstructions || '',
        ingredients: productData.ingredients || '',
        images: productData.images && productData.images.length > 0
          ? productData.images
          : ['https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=800&q=80'],
        variants: productData.variants && productData.variants.length > 0
          ? productData.variants
          : [{ id: `var-${Date.now()}`, weight: '250g', mrp: 150, sellingPrice: 130, stock: 20 }],
        isFeatured: productData.isFeatured || false,
        isBestSeller: productData.isBestSeller || false,
        isNewArrival: productData.isNewArrival !== undefined ? productData.isNewArrival : true,
        status: productData.status || 'published',
        createdAt: now,
        updatedAt: now,
      };
      products.unshift(newProduct);
      saveToStorage(KEYS.PRODUCTS, products);
      return newProduct;
    }
  },

  deleteProduct(id: string): void {
    const products = this.getProducts().filter((p) => p.id !== id);
    saveToStorage(KEYS.PRODUCTS, products);
  },

  updateStock(productId: string, variantId: string, newStock: number): void {
    const products = this.getProducts();
    const product = products.find((p) => p.id === productId);
    if (product) {
      const variant = product.variants.find((v) => v.id === variantId);
      if (variant) {
        variant.stock = Math.max(0, newStock);
        product.updatedAt = new Date().toISOString();
        saveToStorage(KEYS.PRODUCTS, products);
      }
    }
  },

  // CATEGORIES
  getCategories(): Category[] {
    return getFromStorage<Category[]>(KEYS.CATEGORIES, INITIAL_CATEGORIES);
  },

  saveCategory(cat: Omit<Category, 'id'> & { id?: string }): Category {
    const categories = this.getCategories();
    const slug = cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    
    if (cat.id) {
      const index = categories.findIndex((c) => c.id === cat.id);
      if (index >= 0) {
        categories[index] = { ...categories[index], ...cat, slug };
        saveToStorage(KEYS.CATEGORIES, categories);
        return categories[index];
      }
    }
    const newCat: Category = {
      id: `cat-${Date.now()}`,
      name: cat.name,
      slug,
      mainCategory: cat.mainCategory,
      description: cat.description || '',
    };
    categories.push(newCat);
    saveToStorage(KEYS.CATEGORIES, categories);
    return newCat;
  },

  deleteCategory(id: string): void {
    const categories = this.getCategories().filter((c) => c.id !== id);
    saveToStorage(KEYS.CATEGORIES, categories);
  },

  // ORDERS
  getOrders(): Order[] {
    return getFromStorage<Order[]>(KEYS.ORDERS, []);
  },

  getOrderById(id: string): Order | undefined {
    return this.getOrders().find((o) => o.id === id || o.orderNumber === id);
  },

  async createOrder(orderData: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt' | 'statusHistory'>): Promise<Order> {
    const orders = this.getOrders();
    const now = new Date().toISOString();
    const count = orders.length + 1;
    const orderNumber = `KVN-${new Date().getFullYear()}-${count.toString().padStart(4, '0')}`;

    const newOrder: Order = {
      ...orderData,
      id: `ord-${Date.now()}`,
      orderNumber,
      createdAt: now,
      updatedAt: now,
      statusHistory: [
        {
          status: orderData.orderStatus,
          timestamp: now,
          note: 'Order placed by customer via website',
        },
      ],
    };

    orders.unshift(newOrder);
    saveToStorage(KEYS.ORDERS, orders);

    // Auto reduce stock for ordered items
    const products = this.getProducts();
    for (const item of newOrder.items) {
      const prod = products.find((p) => p.id === item.productId);
      if (prod) {
        const v = prod.variants.find((vr) => vr.id === item.variantId);
        if (v) {
          v.stock = Math.max(0, v.stock - item.quantity);
        }
      }
    }
    saveToStorage(KEYS.PRODUCTS, products);

    // Send notifications asynchronously
    const config = this.getBusinessConfig();
    
    // 1. Email business notification
    const orderItemsHtml = newOrder.items
      .map(
        (i) =>
          `<tr><td style="padding:8px;border-bottom:1px solid #eee;">${i.productName} (${i.weight})</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${i.quantity}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">₹${i.unitPrice * i.quantity}</td></tr>`
      )
      .join('');

    const emailBody = `
      <div style="font-family: sans-serif; color: #232724; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #143728; border-bottom: 2px solid #2e5e43; padding-bottom: 8px;">New Order Received - ${newOrder.orderNumber}</h2>
        <p><strong>Customer:</strong> ${newOrder.customer.fullName} (${newOrder.customer.phone})</p>
        <p><strong>Email:</strong> ${newOrder.customer.email || 'N/A'}</p>
        <p><strong>Delivery Address:</strong><br/>
          ${newOrder.customer.address}, ${newOrder.customer.villageTown}, ${newOrder.customer.district} - ${newOrder.customer.pincode}
        </p>
        <p><strong>Payment Method:</strong> ${newOrder.paymentMethod} (Status: ${newOrder.paymentStatus})</p>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
          <thead>
            <tr style="background: #f4eee3; color: #143728;">
              <th style="padding: 8px; text-align: left;">Item</th>
              <th style="padding: 8px; text-align: center;">Qty</th>
              <th style="padding: 8px; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${orderItemsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2" style="padding: 8px; text-align: right; font-weight: bold;">Subtotal:</td>
              <td style="padding: 8px; text-align: right;">₹${newOrder.subtotal}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding: 8px; text-align: right;">Delivery:</td>
              <td style="padding: 8px; text-align: right;">₹${newOrder.deliveryCharge}</td>
            </tr>
            ${newOrder.discountAmount > 0 ? `<tr><td colspan="2" style="padding: 8px; text-align: right; color: #2e5e43;">Discount:</td><td style="padding: 8px; text-align: right; color: #2e5e43;">-₹${newOrder.discountAmount}</td></tr>` : ''}
            <tr style="font-size: 16px; font-weight: bold; background: #eaf2eb;">
              <td colspan="2" style="padding: 8px; text-align: right;">Total Amount:</td>
              <td style="padding: 8px; text-align: right; color: #143728;">₹${newOrder.totalAmount}</td>
            </tr>
          </tfoot>
        </table>
        <p style="margin-top: 24px; font-size: 12px; color: #666;">
          KVN TEAPOWDER Store System | Owner: Kavinash (6383050287 / 9787513911)
        </p>
      </div>
    `;

    sendGmailNotification({
      to: config.email,
      subject: `[New Order] ${newOrder.orderNumber} from ${newOrder.customer.fullName} - ₹${newOrder.totalAmount}`,
      bodyHtml: emailBody,
    }).catch((e) => console.log('Gmail notification note:', e));

    // Optional Sheets export
    if (config.sheetsSpreadsheetId) {
      appendOrderToGoogleSheet(config.sheetsSpreadsheetId, [
        newOrder.orderNumber,
        new Date().toLocaleDateString('en-IN'),
        newOrder.customer.fullName,
        newOrder.customer.phone,
        `${newOrder.customer.address}, ${newOrder.customer.villageTown}, ${newOrder.customer.pincode}`,
        newOrder.items.map((i) => `${i.productName} (${i.weight}) x ${i.quantity}`).join('; '),
        newOrder.totalAmount,
        newOrder.paymentMethod,
        newOrder.paymentStatus,
        newOrder.orderStatus,
      ]).catch((e) => console.log('Sheet append note:', e));
    }

    // Optional n8n Webhook trigger
    if (config.n8nWebhookUrl) {
      fetch(config.n8nWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'order.created', order: newOrder }),
      }).catch((e) => console.log('n8n webhook note:', e));
    }

    return newOrder;
  },

  updateOrderStatus(orderId: string, newStatus: Order['orderStatus'], note?: string): Order | undefined {
    const orders = this.getOrders();
    const order = orders.find((o) => o.id === orderId || o.orderNumber === orderId);
    if (order) {
      order.orderStatus = newStatus;
      order.updatedAt = new Date().toISOString();
      order.statusHistory.push({
        status: newStatus,
        timestamp: new Date().toISOString(),
        note: note || `Status changed to ${newStatus}`,
      });

      // Update payment status if delivered or payment confirmed
      if (newStatus === 'Delivered' && order.paymentMethod === 'COD') {
        order.paymentStatus = 'Paid';
      } else if (newStatus === 'Payment Confirmed') {
        order.paymentStatus = 'Paid';
      }

      saveToStorage(KEYS.ORDERS, orders);

      // Notify customer if email exists
      if (order.customer.email) {
        sendGmailNotification({
          to: order.customer.email,
          subject: `Update on your KVN TEAPOWDER Order ${order.orderNumber}: ${newStatus}`,
          bodyHtml: `<p>Dear ${order.customer.fullName},</p><p>Your order <strong>${order.orderNumber}</strong> status is now: <strong>${newStatus}</strong>.</p><p>Thank you for choosing KVN TEAPOWDER!</p>`,
        }).catch(() => {});
      }

      return order;
    }
    return undefined;
  },

  updateOrderPayment(orderId: string, status: Order['paymentStatus']): Order | undefined {
    const orders = this.getOrders();
    const order = orders.find((o) => o.id === orderId || o.orderNumber === orderId);
    if (order) {
      order.paymentStatus = status;
      order.updatedAt = new Date().toISOString();
      if (status === 'Paid' && order.orderStatus === 'Payment Pending') {
        order.orderStatus = 'Payment Confirmed';
        order.statusHistory.push({
          status: 'Payment Confirmed',
          timestamp: new Date().toISOString(),
          note: 'Payment confirmation received',
        });
      }
      saveToStorage(KEYS.ORDERS, orders);
      return order;
    }
    return undefined;
  },

  // FEEDBACK
  getFeedback(): Feedback[] {
    return getFromStorage<Feedback[]>(KEYS.FEEDBACK, []);
  },

  submitFeedback(data: Omit<Feedback, 'id' | 'createdAt' | 'status'>): Feedback {
    const all = this.getFeedback();
    const newFeedback: Feedback = {
      ...data,
      id: `fb-${Date.now()}`,
      status: 'Pending', // Moderation by default
      createdAt: new Date().toISOString(),
    };
    all.unshift(newFeedback);
    saveToStorage(KEYS.FEEDBACK, all);

    // Business email notification
    const config = this.getBusinessConfig();
    sendGmailNotification({
      to: config.email,
      subject: `New Customer Feedback (${data.rating} Stars) from ${data.customerName}`,
      bodyHtml: `<p><strong>Name:</strong> ${data.customerName} (${data.phone})</p><p><strong>Rating:</strong> ${data.rating}/5</p><p><strong>Message:</strong> ${data.message}</p><p>Review in Admin Dashboard to approve or reject.</p>`,
    }).catch(() => {});

    return newFeedback;
  },

  updateFeedbackStatus(id: string, status: Feedback['status']): void {
    const list = this.getFeedback();
    const item = list.find((f) => f.id === id);
    if (item) {
      item.status = status;
      saveToStorage(KEYS.FEEDBACK, list);
    }
  },

  deleteFeedback(id: string): void {
    const list = this.getFeedback().filter((f) => f.id !== id);
    saveToStorage(KEYS.FEEDBACK, list);
  },

  // CONTACT MESSAGES
  getContactMessages(): ContactMessage[] {
    return getFromStorage<ContactMessage[]>(KEYS.CONTACT, []);
  },

  submitContactMessage(data: Omit<ContactMessage, 'id' | 'createdAt' | 'isRead'>): ContactMessage {
    const messages = this.getContactMessages();
    const newMsg: ContactMessage = {
      ...data,
      id: `msg-${Date.now()}`,
      createdAt: new Date().toISOString(),
      isRead: false,
    };
    messages.unshift(newMsg);
    saveToStorage(KEYS.CONTACT, messages);

    // Send email to business
    const config = this.getBusinessConfig();
    sendGmailNotification({
      to: config.email,
      subject: `[Customer Enquiry] ${data.subject || 'Website Message'} from ${data.name}`,
      bodyHtml: `<p><strong>From:</strong> ${data.name} &lt;${data.email}&gt;</p><p><strong>Phone:</strong> ${data.phone}</p><p><strong>Subject:</strong> ${data.subject}</p><p><strong>Message:</strong><br/>${data.message}</p>`,
    }).catch(() => {});

    return newMsg;
  },

  markContactAsRead(id: string): void {
    const messages = this.getContactMessages();
    const msg = messages.find((m) => m.id === id);
    if (msg) {
      msg.isRead = true;
      saveToStorage(KEYS.CONTACT, messages);
    }
  },

  // COUPONS
  getCoupons(): Coupon[] {
    return getFromStorage<Coupon[]>(KEYS.COUPONS, INITIAL_COUPONS);
  },

  saveCoupon(coupon: Omit<Coupon, 'id' | 'usedCount'> & { id?: string }): Coupon {
    const coupons = this.getCoupons();
    if (coupon.id) {
      const idx = coupons.findIndex((c) => c.id === coupon.id);
      if (idx >= 0) {
        coupons[idx] = { ...coupons[idx], ...coupon, code: coupon.code.toUpperCase() };
        saveToStorage(KEYS.COUPONS, coupons);
        return coupons[idx];
      }
    }
    const newC: Coupon = {
      ...coupon,
      id: `coup-${Date.now()}`,
      code: coupon.code.toUpperCase(),
      usedCount: 0,
    };
    coupons.push(newC);
    saveToStorage(KEYS.COUPONS, coupons);
    return newC;
  },

  deleteCoupon(id: string): void {
    const coupons = this.getCoupons().filter((c) => c.id !== id);
    saveToStorage(KEYS.COUPONS, coupons);
  },

  validateCoupon(code: string, subtotal: number): { valid: boolean; message: string; discount: number; coupon?: Coupon } {
    const coupons = this.getCoupons();
    const coupon = coupons.find((c) => c.code.toUpperCase() === code.trim().toUpperCase() && c.isActive);

    if (!coupon) {
      return { valid: false, message: 'Invalid or expired coupon code.', discount: 0 };
    }

    if (subtotal < coupon.minOrderAmount) {
      return { valid: false, message: `Minimum order of ₹${coupon.minOrderAmount} required for this coupon.`, discount: 0 };
    }

    let discount = 0;
    if (coupon.discountType === 'percentage') {
      discount = Math.round((subtotal * coupon.discountValue) / 100);
      if (coupon.maxDiscount && discount > coupon.maxDiscount) {
        discount = coupon.maxDiscount;
      }
    } else if (coupon.discountType === 'fixed') {
      discount = coupon.discountValue;
    } else if (coupon.discountType === 'free_shipping') {
      discount = 0; // Handled in shipping calculation
    }

    return { valid: true, message: `Coupon applied successfully!`, discount, coupon };
  },

  // BANNERS
  getBanners(): Banner[] {
    return getFromStorage<Banner[]>(KEYS.BANNERS, INITIAL_BANNERS);
  },

  saveBanner(banner: Omit<Banner, 'id'> & { id?: string }): Banner {
    const banners = this.getBanners();
    if (banner.id) {
      const idx = banners.findIndex((b) => b.id === banner.id);
      if (idx >= 0) {
        banners[idx] = { ...banners[idx], ...banner };
        saveToStorage(KEYS.BANNERS, banners);
        return banners[idx];
      }
    }
    const newB: Banner = { ...banner, id: `banner-${Date.now()}` };
    banners.push(newB);
    saveToStorage(KEYS.BANNERS, banners);
    return newB;
  },

  deleteBanner(id: string): void {
    const banners = this.getBanners().filter((b) => b.id !== id);
    saveToStorage(KEYS.BANNERS, banners);
  },

  // DELIVERY AREAS
  getDeliveryAreas(): DeliveryArea[] {
    return getFromStorage<DeliveryArea[]>(KEYS.DELIVERY_AREAS, INITIAL_DELIVERY_AREAS);
  },

  saveDeliveryArea(area: Omit<DeliveryArea, 'id'> & { id?: string }): DeliveryArea {
    const areas = this.getDeliveryAreas();
    if (area.id) {
      const idx = areas.findIndex((a) => a.id === area.id);
      if (idx >= 0) {
        areas[idx] = { ...areas[idx], ...area };
        saveToStorage(KEYS.DELIVERY_AREAS, areas);
        return areas[idx];
      }
    }
    const newArea: DeliveryArea = { ...area, id: `del-${Date.now()}` };
    areas.push(newArea);
    saveToStorage(KEYS.DELIVERY_AREAS, areas);
    return newArea;
  },

  deleteDeliveryArea(id: string): void {
    const areas = this.getDeliveryAreas().filter((a) => a.id !== id);
    saveToStorage(KEYS.DELIVERY_AREAS, areas);
  },

  // CONFIG / BUSINESS DETAILS
  getBusinessConfig(): BusinessConfig {
    const stored = getFromStorage<BusinessConfig | null>(KEYS.CONFIG, null);
    return {
      ...INITIAL_BUSINESS_CONFIG,
      ...(stored && typeof stored === 'object' ? stored : {}),
    };
  },

  saveBusinessConfig(config: Partial<BusinessConfig>): BusinessConfig {
    const current = this.getBusinessConfig();
    const updated = { ...current, ...config };
    saveToStorage(KEYS.CONFIG, updated);
    return updated;
  },

  // WISHLIST
  getWishlist(): string[] {
    return getFromStorage<string[]>(KEYS.WISHLIST, []);
  },

  toggleWishlist(productId: string): string[] {
    const current = this.getWishlist();
    const exists = current.includes(productId);
    const updated = exists ? current.filter((id) => id !== productId) : [...current, productId];
    saveToStorage(KEYS.WISHLIST, updated);
    return updated;
  },

  // CART
  getCart(): CartItem[] {
    return getFromStorage<CartItem[]>(KEYS.CART, []);
  },

  saveCart(cart: CartItem[]): void {
    saveToStorage(KEYS.CART, cart);
  },

  clearCart(): void {
    saveToStorage(KEYS.CART, []);
  },
};
