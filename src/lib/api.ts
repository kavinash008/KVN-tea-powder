import { Order, OrderCustomer, CartItem, CustomerAddress, CustomerUser, OrderStatus, Product } from '../types';

const API_BASE = '/api';

function getHeaders(token?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function getAdminHeaders(token?: string | null): Record<string, string> {
  let cleanToken = token;
  if (!cleanToken && typeof window !== 'undefined') {
    try {
      cleanToken = localStorage.getItem('kvn_admin_token') || 'kavin008';
    } catch {
      cleanToken = 'kavin008';
    }
  }
  const effectiveToken = cleanToken || 'kavin008';
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${effectiveToken}`,
    'x-admin-passcode': effectiveToken,
  };
}

/**
 * Safe fetch helper that reads response text first before attempting JSON parse.
 * Prevents "Unexpected token 'A', 'A server e'... is not valid JSON" crashes.
 */
async function safeRequest<T>(url: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, options);
  } catch (err: any) {
    throw new Error('Network request failed. Please check your internet connection.');
  }

  const rawText = await res.text();
  let json: any = null;

  if (rawText && rawText.trim()) {
    try {
      json = JSON.parse(rawText);
    } catch {
      // The server returned a non-JSON response (e.g. Vercel 500 error page or HTML)
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}: ${rawText.slice(0, 120)}`);
      }
      return rawText as unknown as T;
    }
  }

  if (!res.ok) {
    const errorMsg = json?.error || json?.message || `Server request failed with status ${res.status}`;
    throw new Error(errorMsg);
  }

  return (json ?? {}) as T;
}

export const api = {
  // 1. Health
  async checkHealth(): Promise<{ status: string; mode: string }> {
    return safeRequest<{ status: string; mode: string }>(`${API_BASE}/health`);
  },

  // 2. Customer Auth
  async syncFirebaseAuth(data: {
    uid: string;
    email?: string;
    phone?: string;
    fullName: string;
    authProvider: 'google' | 'phone' | 'email';
    emailVerified?: boolean;
    phoneVerified?: boolean;
    initialAddress?: Partial<CustomerAddress>;
  }): Promise<{ user: CustomerUser; token: string; isAdmin?: boolean }> {
    return safeRequest<{ user: CustomerUser; token: string; isAdmin?: boolean }>(`${API_BASE}/auth/firebase-sync`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
  },

  async register(data: {
    fullName: string;
    phone: string;
    password: string;
    email?: string;
    initialAddress?: Partial<CustomerAddress>;
  }): Promise<{ user: CustomerUser; token: string }> {
    return safeRequest<{ user: CustomerUser; token: string }>(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
  },

  async login(phone: string, password: string): Promise<{ user: CustomerUser; token: string }> {
    return safeRequest<{ user: CustomerUser; token: string }>(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ phone, password }),
    });
  },

  async getMe(token: string): Promise<{ user: CustomerUser }> {
    return safeRequest<{ user: CustomerUser }>(`${API_BASE}/auth/me`, {
      headers: getHeaders(token),
    });
  },

  async updateProfile(token: string, updates: { fullName?: string; email?: string }): Promise<{ user: CustomerUser }> {
    return safeRequest<{ user: CustomerUser }>(`${API_BASE}/auth/profile`, {
      method: 'PUT',
      headers: getHeaders(token),
      body: JSON.stringify(updates),
    });
  },

  async getAddresses(token: string): Promise<CustomerAddress[]> {
    const json = await safeRequest<{ addresses: CustomerAddress[] }>(`${API_BASE}/auth/addresses`, {
      headers: getHeaders(token),
    });
    return json.addresses || [];
  },

  async addAddress(token: string, address: Omit<CustomerAddress, 'id'>): Promise<CustomerAddress> {
    const json = await safeRequest<{ address: CustomerAddress }>(`${API_BASE}/auth/addresses`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(address),
    });
    return json.address;
  },

  async updateAddress(token: string, id: string, updates: Partial<CustomerAddress>): Promise<CustomerAddress> {
    const json = await safeRequest<{ address: CustomerAddress }>(`${API_BASE}/auth/addresses/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: getHeaders(token),
      body: JSON.stringify(updates),
    });
    return json.address;
  },

  async deleteAddress(token: string, id: string): Promise<boolean> {
    await safeRequest(`${API_BASE}/auth/addresses/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getHeaders(token),
    });
    return true;
  },

  // 3. Orders
  async createOrder(
    orderData: {
      customer: OrderCustomer;
      items: CartItem[];
      paymentMethod: 'COD' | 'Online' | 'ONLINE_UPI';
      notes?: string;
    },
    token?: string | null
  ): Promise<Order> {
    const json = await safeRequest<{ order: Order }>(`${API_BASE}/orders`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(orderData),
    });
    return json.order;
  },

  async getOrder(id: string): Promise<Order> {
    const json = await safeRequest<{ order: Order }>(`${API_BASE}/orders/${encodeURIComponent(id)}`);
    return json.order;
  },

  async getMyOrders(phone?: string, token?: string | null): Promise<Order[]> {
    const url = phone ? `${API_BASE}/orders/customer/my-orders?phone=${encodeURIComponent(phone)}` : `${API_BASE}/orders/customer/my-orders`;
    const json = await safeRequest<{ orders: Order[] }>(url, {
      headers: getHeaders(token),
    });
    return json.orders || [];
  },

  // 4. Admin
  async adminLogin(passcode: string): Promise<{ token: string }> {
    return safeRequest<{ token: string }>(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ passcode }),
    });
  },

  async adminGetOrders(token?: string, status?: string): Promise<Order[]> {
    const url = status && status !== 'all' ? `${API_BASE}/admin/orders?status=${encodeURIComponent(status)}` : `${API_BASE}/admin/orders`;
    const json = await safeRequest<{ orders: Order[] }>(url, {
      headers: getAdminHeaders(token),
    });
    return json.orders || [];
  },

  async adminUpdateOrderStatus(token: string | undefined, id: string, status: OrderStatus, note?: string): Promise<Order> {
    const json = await safeRequest<{ order: Order }>(`${API_BASE}/admin/orders/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: getAdminHeaders(token),
      body: JSON.stringify({ status, note }),
    });
    return json.order;
  },

  async adminGetStats(token?: string): Promise<any> {
    const json = await safeRequest<{ stats: any }>(`${API_BASE}/admin/stats`, {
      headers: getAdminHeaders(token),
    });
    return json.stats;
  },

  async adminGetWebhookStatus(token?: string): Promise<any> {
    return safeRequest<any>(`${API_BASE}/admin/webhooks/status`, {
      headers: getAdminHeaders(token),
    });
  },

  async adminRetryWebhooks(token?: string): Promise<any> {
    return safeRequest<any>(`${API_BASE}/admin/webhooks/retry`, {
      method: 'POST',
      headers: getAdminHeaders(token),
    });
  },

  // 5. Products
  async getProducts(): Promise<Product[]> {
    const json = await safeRequest<{ products: Product[] }>(`${API_BASE}/products`);
    return json.products || [];
  },

  async getProduct(id: string): Promise<Product> {
    const json = await safeRequest<{ product: Product }>(`${API_BASE}/products/${encodeURIComponent(id)}`);
    return json.product;
  },

  async adminSaveProduct(token: string | undefined, product: Product): Promise<Product> {
    const json = await safeRequest<{ product: Product }>(`${API_BASE}/admin/products`, {
      method: 'POST',
      headers: getAdminHeaders(token),
      body: JSON.stringify(product),
    });
    return json.product;
  },

  async adminDeleteProduct(token: string | undefined, id: string): Promise<boolean> {
    await safeRequest(`${API_BASE}/admin/products/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAdminHeaders(token),
    });
    return true;
  },

  // 6. WhatsApp & Microsoft Excel Sync
  async adminGetWhatsAppStatus(token?: string): Promise<any> {
    return safeRequest<any>(`${API_BASE}/admin/whatsapp/status`, {
      headers: getAdminHeaders(token),
    });
  },

  async adminRetryWhatsApp(token: string | undefined, orderId: string): Promise<any> {
    return safeRequest<any>(`${API_BASE}/admin/whatsapp/retry/${encodeURIComponent(orderId)}`, {
      method: 'POST',
      headers: getAdminHeaders(token),
    });
  },

  async adminGetExcelStatus(token?: string): Promise<any> {
    return safeRequest<any>(`${API_BASE}/admin/excel/status`, {
      headers: getAdminHeaders(token),
    });
  },

  async adminSyncExcel(token?: string): Promise<any> {
    return safeRequest<any>(`${API_BASE}/admin/excel/sync`, {
      method: 'POST',
      headers: getAdminHeaders(token),
    });
  },
};
