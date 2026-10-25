import { Order, OrderCustomer, CartItem, CustomerAddress, CustomerUser, OrderStatus } from '../types';

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

export const api = {
  // 1. Health
  async checkHealth(): Promise<{ status: string; mode: string }> {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error('Health check failed');
    return res.json();
  },

  // 2. Customer Auth
  async register(data: {
    fullName: string;
    phone: string;
    password: string;
    email?: string;
    initialAddress?: Partial<CustomerAddress>;
  }): Promise<{ user: CustomerUser; token: string }> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Registration failed');
    }
    return json;
  },

  async login(phone: string, password: string): Promise<{ user: CustomerUser; token: string }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ phone, password }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Login failed');
    }
    return json;
  },

  async getMe(token: string): Promise<{ user: CustomerUser }> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getHeaders(token),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Failed to fetch user profile');
    }
    return json;
  },

  async updateProfile(token: string, updates: { fullName?: string; email?: string }): Promise<{ user: CustomerUser }> {
    const res = await fetch(`${API_BASE}/auth/profile`, {
      method: 'PUT',
      headers: getHeaders(token),
      body: JSON.stringify(updates),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Failed to update profile');
    }
    return json;
  },

  async getAddresses(token: string): Promise<CustomerAddress[]> {
    const res = await fetch(`${API_BASE}/auth/addresses`, {
      headers: getHeaders(token),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Failed to load addresses');
    }
    return json.addresses || [];
  },

  async addAddress(token: string, address: Omit<CustomerAddress, 'id'>): Promise<CustomerAddress> {
    const res = await fetch(`${API_BASE}/auth/addresses`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(address),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Failed to add address');
    }
    return json.address;
  },

  async updateAddress(token: string, id: string, updates: Partial<CustomerAddress>): Promise<CustomerAddress> {
    const res = await fetch(`${API_BASE}/auth/addresses/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: getHeaders(token),
      body: JSON.stringify(updates),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Failed to update address');
    }
    return json.address;
  },

  async deleteAddress(token: string, id: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/auth/addresses/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getHeaders(token),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Failed to delete address');
    }
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
    const res = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(orderData),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Failed to place order');
    }
    return json.order;
  },

  async getOrder(id: string): Promise<Order> {
    const res = await fetch(`${API_BASE}/orders/${encodeURIComponent(id)}`);
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Order not found');
    }
    return json.order;
  },

  async getMyOrders(phone?: string, token?: string | null): Promise<Order[]> {
    const url = phone ? `${API_BASE}/orders/customer/my-orders?phone=${encodeURIComponent(phone)}` : `${API_BASE}/orders/customer/my-orders`;
    const res = await fetch(url, {
      headers: getHeaders(token),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Failed to fetch orders');
    }
    return json.orders || [];
  },

  // 4. Admin
  async adminLogin(passcode: string): Promise<{ token: string }> {
    const res = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ passcode }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Admin login failed');
    }
    return json;
  },

  async adminGetOrders(token: string, status?: string): Promise<Order[]> {
    const url = status && status !== 'all' ? `${API_BASE}/admin/orders?status=${encodeURIComponent(status)}` : `${API_BASE}/admin/orders`;
    const res = await fetch(url, {
      headers: getHeaders(token),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Failed to load orders');
    }
    return json.orders || [];
  },

  async adminUpdateOrderStatus(token: string, id: string, status: OrderStatus, note?: string): Promise<Order> {
    const res = await fetch(`${API_BASE}/admin/orders/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: getHeaders(token),
      body: JSON.stringify({ status, note }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Failed to update order status');
    }
    return json.order;
  },

  async adminGetStats(token: string): Promise<any> {
    const res = await fetch(`${API_BASE}/admin/stats`, {
      headers: getHeaders(token),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Failed to fetch admin stats');
    }
    return json.stats;
  },
};
