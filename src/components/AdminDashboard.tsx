import React, { useState } from 'react';
import { db } from '../lib/db';
import {
  Product,
  Category,
  Order,
  Feedback,
  ContactMessage,
  Coupon,
  Banner,
  DeliveryArea,
  BusinessConfig,
} from '../types';
import {
  requestGoogleToken,
  getStoredToken,
  clearToken,
} from '../lib/googleWorkspace';
import {
  LayoutDashboard,
  Package,
  FolderTree,
  ShoppingBag,
  Users,
  Warehouse,
  CreditCard,
  MessageSquare,
  Tag,
  Image,
  MapPin,
  Bell,
  BarChart3,
  Settings,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Upload,
  ExternalLink,
  ShieldAlert,
  LogOut,
  Mail,
  Send,
} from 'lucide-react';

interface AdminDashboardProps {
  onLogout: () => void;
  onViewStore: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout, onViewStore }) => {
  // Navigation active tab
  const [activeSection, setActiveSection] = useState<
    | 'overview'
    | 'products'
    | 'categories'
    | 'orders'
    | 'customers'
    | 'inventory'
    | 'payments'
    | 'feedback'
    | 'offers'
    | 'banners'
    | 'delivery'
    | 'messages'
    | 'reports'
    | 'settings'
  >('overview');

  // Database states
  const [products, setProducts] = useState<Product[]>(() => db.getProducts());
  const [categories, setCategories] = useState<Category[]>(() => db.getCategories());
  const [orders, setOrders] = useState<Order[]>(() => db.getOrders());
  const [feedbackList, setFeedbackList] = useState<Feedback[]>(() => db.getFeedback());
  const [contactList, setContactList] = useState<ContactMessage[]>(() => db.getContactMessages());
  const [coupons, setCoupons] = useState<Coupon[]>(() => db.getCoupons());
  const [banners, setBanners] = useState<Banner[]>(() => db.getBanners());
  const [deliveryAreas, setDeliveryAreas] = useState<DeliveryArea[]>(() => db.getDeliveryAreas());
  const [config, setConfig] = useState<BusinessConfig>(() => db.getBusinessConfig());

  // UI modal helpers
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [newCatModalOpen, setNewCatModalOpen] = useState(false);
  const [newBannerModalOpen, setNewBannerModalOpen] = useState(false);
  const [newDeliveryModalOpen, setNewDeliveryModalOpen] = useState(false);
  const [newCouponModalOpen, setNewCouponModalOpen] = useState(false);
  const [orderDetailModal, setOrderDetailModal] = useState<Order | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showAdminToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const refreshData = () => {
    setProducts(db.getProducts());
    setCategories(db.getCategories());
    setOrders(db.getOrders());
    setFeedbackList(db.getFeedback());
    setContactList(db.getContactMessages());
    setCoupons(db.getCoupons());
    setBanners(db.getBanners());
    setDeliveryAreas(db.getDeliveryAreas());
    setConfig(db.getBusinessConfig());
  };

  // Google Workspace Token connect
  const [googleConnected, setGoogleConnected] = useState<boolean>(Boolean(getStoredToken()));

  const handleConnectGoogle = async () => {
    try {
      await requestGoogleToken();
      setGoogleConnected(true);
      showAdminToast('Google Drive, Sheets & Gmail connected!');
    } catch (err: any) {
      showAdminToast(err.message || 'Failed to authenticate Google Workspace');
    }
  };

  const handleDisconnectGoogle = () => {
    clearToken();
    setGoogleConnected(false);
    showAdminToast('Google Workspace disconnected');
  };

  // Metrics computation (NO fake analytics data! Real calculations only)
  const todayStr = new Date().toISOString().split('T')[0];
  const todayOrders = orders.filter((o) => o.createdAt.startsWith(todayStr));
  const todaySales = todayOrders.reduce((sum, o) => sum + (o.paymentStatus === 'Paid' ? o.totalAmount : 0), 0);
  const pendingOrders = orders.filter((o) => o.orderStatus === 'Pending' || o.orderStatus === 'Payment Pending' || o.orderStatus === 'Order Confirmed');
  const paidOrders = orders.filter((o) => o.paymentStatus === 'Paid');
  const totalRevenue = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);

  // Low stock inventory calculation
  const lowStockItems: { product: Product; variant: any }[] = [];
  products.forEach((p) => {
    p.variants.forEach((v) => {
      if (v.stock <= 5) {
        lowStockItems.push({ product: p, variant: v });
      }
    });
  });

  const adminSections = [
    { id: 'overview', label: 'Overview & Stats', shortLabel: 'Overview', icon: LayoutDashboard },
    { id: 'products', label: 'Products Management', shortLabel: 'Products', icon: Package },
    { id: 'categories', label: 'Categories & Subcategories', shortLabel: 'Categories', icon: FolderTree },
    { id: 'orders', label: 'Orders Management', shortLabel: 'Orders', icon: ShoppingBag, badge: pendingOrders.length },
    { id: 'inventory', label: 'Inventory & Stock', shortLabel: 'Inventory', icon: Warehouse, badge: lowStockItems.length },
    { id: 'payments', label: 'Payments & Settlement', shortLabel: 'Payments', icon: CreditCard },
    { id: 'feedback', label: 'Customer Feedback', shortLabel: 'Feedback', icon: MessageSquare, badge: feedbackList.filter(f => f.status === 'Pending').length },
    { id: 'offers', label: 'Coupons & Offers', shortLabel: 'Offers', icon: Tag },
    { id: 'banners', label: 'Homepage Banners', shortLabel: 'Banners', icon: Image },
    { id: 'delivery', label: 'Delivery Areas', shortLabel: 'Delivery', icon: MapPin },
    { id: 'messages', label: 'Customer Enquiries', shortLabel: 'Enquiries', icon: Mail, badge: contactList.filter(c => !c.isRead).length },
    { id: 'reports', label: 'Sales Reports & Analytics', shortLabel: 'Reports', icon: BarChart3 },
    { id: 'settings', label: 'Business Settings & API', shortLabel: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col">
      {/* Top Admin Header */}
      <header className="bg-[#143728] text-white px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between shadow-md sticky top-0 z-30">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="bg-amber-400 text-[#143728] font-bold px-2 py-1 rounded-lg text-xs tracking-wider shrink-0">
            KVN ADMIN
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-xs sm:text-base leading-none text-white truncate">
              Store Management
            </h1>
            <p className="text-[10px] sm:text-[11px] text-emerald-200/80 mt-0.5 truncate hidden xs:block">
              Proprietor: {config?.owner || 'KRISHNAMOORTHY'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsAddingProduct(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-[#c29958] hover:bg-[#d4a867] text-stone-950 rounded-lg text-xs font-bold transition-all shadow-2xs"
            title="Add New Product"
          >
            <Plus className="w-3.5 h-3.5" /> <span className="hidden xs:inline">Add Product</span>
          </button>
          <button
            onClick={onViewStore}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold transition-all"
            title="View Store"
          >
            <ExternalLink className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Store</span>
          </button>
          <button
            onClick={onLogout}
            className="flex items-center gap-1 px-2 sm:px-3 py-1.5 bg-red-700/80 hover:bg-red-800 text-white rounded-lg text-xs font-semibold transition-all"
            title="Log Out"
          >
            <LogOut className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Mobile Horizontal Navigation Tabs (Phone-optimized, zero lag) */}
      <div className="md:hidden bg-white border-b border-stone-200 px-2 py-2 flex items-center gap-1.5 overflow-x-auto shadow-2xs">
        {adminSections.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id as any)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
                isActive
                  ? 'bg-[#143728] text-white shadow-2xs'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.shortLabel}</span>
              {Boolean(item.badge && item.badge > 0) && (
                <span className={`text-[9px] px-1 py-0.2 rounded-full font-bold ml-0.5 ${
                  isActive ? 'bg-amber-400 text-stone-900' : 'bg-red-100 text-red-700'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Admin Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar navigation */}
        <aside className="w-64 bg-white border-r border-stone-200 hidden md:flex flex-col justify-between shrink-0">
          <div className="p-4 space-y-1 overflow-y-auto">
            {adminSections.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id as any)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-[#143728] text-white'
                      : 'text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {Boolean(item.badge && item.badge > 0) && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive ? 'bg-amber-400 text-stone-900' : 'bg-red-100 text-red-700'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="p-4 border-t border-stone-200 text-[11px] text-stone-500">
            <div>Google Workspace OAuth:</div>
            <div className="flex items-center gap-1.5 mt-1 font-semibold">
              <span className={`w-2 h-2 rounded-full ${googleConnected ? 'bg-emerald-500' : 'bg-stone-300'}`} />
              {googleConnected ? 'Drive, Sheets & Gmail Active' : 'Not Connected'}
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* OVERVIEW SECTION */}
          {activeSection === 'overview' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-stone-900">Dashboard Overview</h2>
                  <p className="text-xs text-stone-500">Real-time statistics for KVN TEAPOWDER.</p>
                </div>
                <button
                  onClick={() => setIsAddingProduct(true)}
                  className="px-4 py-2 bg-[#143728] text-white rounded-xl text-xs font-semibold hover:bg-[#204e37] flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Add New Product
                </button>
              </div>

              {/* Metric Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs">
                  <span className="text-xs font-semibold text-stone-500">Today's Sales</span>
                  <div className="text-2xl font-bold text-stone-900 mt-1">₹{todaySales}</div>
                  <span className="text-[11px] text-stone-400">{todayOrders.length} orders today</span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs">
                  <span className="text-xs font-semibold text-stone-500">Pending Orders</span>
                  <div className="text-2xl font-bold text-amber-600 mt-1">{pendingOrders.length}</div>
                  <span className="text-[11px] text-stone-400">Action required</span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs">
                  <span className="text-xs font-semibold text-stone-500">Total Live Products</span>
                  <div className="text-2xl font-bold text-stone-900 mt-1">{products.length}</div>
                  <span className="text-[11px] text-[#2e5e43] font-medium">{categories.length} active categories</span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs">
                  <span className="text-xs font-semibold text-stone-500">Low Stock Alert</span>
                  <div className="text-2xl font-bold text-red-600 mt-1">{lowStockItems.length}</div>
                  <span className="text-[11px] text-stone-400">Items under 5 units</span>
                </div>
              </div>

              {/* Recent Orders Overview */}
              <div className="bg-white rounded-2xl border border-stone-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-stone-900 text-sm">Recent Customer Orders</h3>
                  <button
                    onClick={() => setActiveSection('orders')}
                    className="text-xs font-semibold text-[#2e5e43] hover:underline"
                  >
                    View All Orders →
                  </button>
                </div>

                {orders.length === 0 ? (
                  <div className="text-center py-10 text-stone-500 text-xs">
                    No orders placed yet. Orders will appear here as customers purchase from the website.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-stone-200 text-stone-500 pb-2">
                          <th className="py-2">Order ID</th>
                          <th>Customer</th>
                          <th>Items</th>
                          <th>Amount</th>
                          <th>Payment</th>
                          <th>Order Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {orders.slice(0, 5).map((ord) => (
                          <tr key={ord.id} className="hover:bg-stone-50">
                            <td className="py-3 font-semibold text-stone-900">{ord.orderNumber}</td>
                            <td>
                              <div>{ord.customer.fullName}</div>
                              <div className="text-[11px] text-stone-400">{ord.customer.phone}</div>
                            </td>
                            <td>{ord.items.length} items</td>
                            <td className="font-bold text-stone-900">₹{ord.totalAmount}</td>
                            <td>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                ord.paymentStatus === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {ord.paymentMethod} ({ord.paymentStatus})
                              </span>
                            </td>
                            <td>
                              <span className="font-medium bg-stone-100 text-stone-700 px-2 py-0.5 rounded text-[10px]">
                                {ord.orderStatus}
                              </span>
                            </td>
                            <td>
                              <button
                                onClick={() => setOrderDetailModal(ord)}
                                className="text-[#2e5e43] hover:underline font-semibold"
                              >
                                Manage
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PRODUCTS MANAGEMENT SECTION (Item 17, 18, 19, 20 from prompt) */}
          {activeSection === 'products' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-stone-900">Product Management</h2>
                  <p className="text-xs text-stone-500">
                    Add new tea or coffee arrivals, edit weights, MRP, prices and manage stock without touching code.
                  </p>
                </div>

                <button
                  onClick={() => setIsAddingProduct(true)}
                  className="px-4 py-2.5 bg-[#143728] text-white rounded-xl text-xs font-semibold hover:bg-[#204e37] flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-4 h-4" /> Add Product
                </button>
              </div>

              {/* Product list table */}
              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-stone-50 border-b border-stone-200 text-stone-600">
                      <tr>
                        <th className="p-3.5">Product</th>
                        <th className="p-3.5">Category</th>
                        <th className="p-3.5">Variants & Prices</th>
                        <th className="p-3.5">Total Stock</th>
                        <th className="p-3.5">Badges</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {products.map((prod) => {
                        const totalStock = prod.variants.reduce((s, v) => s + v.stock, 0);
                        return (
                          <tr key={prod.id} className="hover:bg-stone-50/80 transition-colors">
                            <td className="p-3.5 flex items-center gap-3">
                              <img
                                src={prod.images[0] || 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=100&q=80'}
                                alt=""
                                className="w-12 h-12 rounded-xl object-cover bg-stone-100 shrink-0"
                              />
                              <div>
                                <div className="font-semibold text-stone-900">{prod.name}</div>
                                <div className="text-[11px] text-stone-400">SKU: {prod.sku}</div>
                              </div>
                            </td>
                            <td className="p-3.5">
                              <span className="capitalize font-medium text-[#2e5e43]">
                                {prod.mainCategory}
                              </span>
                              <div className="text-[11px] text-stone-400">{prod.categorySlug}</div>
                            </td>
                            <td className="p-3.5">
                              <div className="flex flex-wrap gap-1">
                                {prod.variants.map((v) => (
                                  <span key={v.id} className="bg-stone-100 px-1.5 py-0.5 rounded text-[10px] text-stone-700">
                                    {v.weight}: ₹{v.sellingPrice} ({v.stock} left)
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="p-3.5">
                              <span className={`font-semibold ${totalStock === 0 ? 'text-red-600' : totalStock <= 10 ? 'text-amber-600' : 'text-emerald-700'}`}>
                                {totalStock} units
                              </span>
                            </td>
                            <td className="p-3.5">
                              <div className="flex flex-wrap gap-1">
                                {prod.isNewArrival && <span className="bg-[#143728] text-white px-1.5 py-0.5 rounded text-[9px]">New Arrival</span>}
                                {prod.isBestSeller && <span className="bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded text-[9px]">Best Seller</span>}
                                {prod.isFeatured && <span className="bg-blue-100 text-blue-900 px-1.5 py-0.5 rounded text-[9px]">Featured</span>}
                              </div>
                            </td>
                            <td className="p-3.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                prod.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-700'
                              }`}>
                                {prod.status}
                              </span>
                            </td>
                            <td className="p-3.5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => setEditingProduct(prod)}
                                  className="p-1.5 text-stone-500 hover:text-[#2e5e43] hover:bg-stone-100 rounded-lg transition-colors"
                                  title="Edit Product"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm(`Are you sure you want to delete ${prod.name}?`)) {
                                      db.deleteProduct(prod.id);
                                      refreshData();
                                      showAdminToast('Product deleted');
                                    }
                                  }}
                                  className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete Product"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* CATEGORIES SECTION (Item 21) */}
          {activeSection === 'categories' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-stone-900">Category Management</h2>
                  <p className="text-xs text-stone-500">
                    Add new categories (Spices, Masala, Dry Fruits, etc.) without altering code.
                  </p>
                </div>
                <button
                  onClick={() => setNewCatModalOpen(true)}
                  className="px-4 py-2.5 bg-[#143728] text-white rounded-xl text-xs font-semibold hover:bg-[#204e37] flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-4 h-4" /> Add Category
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((cat) => (
                  <div key={cat.id} className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase font-bold text-[#2e5e43] bg-emerald-50 px-2 py-0.5 rounded">
                        {cat.mainCategory}
                      </span>
                      <button
                        onClick={() => {
                          if (confirm(`Delete category "${cat.name}"?`)) {
                            db.deleteCategory(cat.id);
                            refreshData();
                          }
                        }}
                        className="text-stone-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <h4 className="font-bold text-stone-900 text-sm">{cat.name}</h4>
                    <p className="text-xs text-stone-500">{cat.description || 'No description added.'}</p>
                    <div className="text-[11px] text-stone-400">Slug: {cat.slug}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ORDERS MANAGEMENT (Item 23) */}
          {activeSection === 'orders' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-stone-900">Orders Management</h2>
                  <p className="text-xs text-stone-500">Track and update customer order lifecycle.</p>
                </div>
                <span className="text-xs font-semibold text-stone-500">
                  Total Orders: {orders.length}
                </span>
              </div>

              {orders.length === 0 ? (
                <div className="bg-white p-12 text-center rounded-2xl border border-stone-200 text-stone-500 text-xs">
                  No orders have been received yet.
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-stone-50 border-b border-stone-200 text-stone-600">
                        <tr>
                          <th className="p-3.5">Order ID</th>
                          <th className="p-3.5">Customer & Phone</th>
                          <th className="p-3.5">Address & Village</th>
                          <th className="p-3.5">Amount</th>
                          <th className="p-3.5">Payment</th>
                          <th className="p-3.5">Status</th>
                          <th className="p-3.5">Update Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {orders.map((ord) => (
                          <tr key={ord.id} className="hover:bg-stone-50">
                            <td className="p-3.5 font-bold text-stone-900">{ord.orderNumber}</td>
                            <td className="p-3.5">
                              <div className="font-semibold">{ord.customer.fullName}</div>
                              <div className="text-stone-500 text-[11px]">{ord.customer.phone}</div>
                            </td>
                            <td className="p-3.5 text-stone-600 max-w-xs truncate">
                              {ord.customer.address}, {ord.customer.villageTown}
                            </td>
                            <td className="p-3.5 font-bold text-stone-900">₹{ord.totalAmount}</td>
                            <td className="p-3.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                ord.paymentStatus === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {ord.paymentMethod} ({ord.paymentStatus})
                              </span>
                            </td>
                            <td className="p-3.5">
                              <span className="font-medium bg-stone-100 text-stone-700 px-2 py-0.5 rounded text-[10px]">
                                {ord.orderStatus}
                              </span>
                            </td>
                            <td className="p-3.5">
                              <select
                                value={ord.orderStatus}
                                onChange={(e) => {
                                  db.updateOrderStatus(ord.id, e.target.value as any);
                                  refreshData();
                                  showAdminToast(`Status changed to ${e.target.value}`);
                                }}
                                className="bg-stone-50 border border-stone-200 text-xs rounded-lg px-2 py-1 focus:outline-hidden"
                              >
                                <option value="Pending">Pending</option>
                                <option value="Payment Pending">Payment Pending</option>
                                <option value="Order Confirmed">Order Confirmed</option>
                                <option value="Payment Confirmed">Payment Confirmed</option>
                                <option value="Packing">Packing</option>
                                <option value="Out for Delivery">Out for Delivery</option>
                                <option value="Delivered">Delivered</option>
                                <option value="Cancelled">Cancelled</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* INVENTORY SECTION (Item 22) */}
          {activeSection === 'inventory' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-stone-900">Inventory Management</h2>
                  <p className="text-xs text-stone-500">Live stock counts across weight variants.</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 border-b border-stone-200 text-stone-600">
                    <tr>
                      <th className="p-3.5">Product</th>
                      <th className="p-3.5">Variant Weight</th>
                      <th className="p-3.5">Selling Price</th>
                      <th className="p-3.5">Stock Remaining</th>
                      <th className="p-3.5">Quick Adjust</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {products.flatMap((prod) =>
                      prod.variants.map((v) => (
                        <tr key={`${prod.id}-${v.id}`} className="hover:bg-stone-50">
                          <td className="p-3.5 font-semibold text-stone-900">{prod.name}</td>
                          <td className="p-3.5">{v.weight}</td>
                          <td className="p-3.5">₹{v.sellingPrice}</td>
                          <td className="p-3.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              v.stock === 0 ? 'bg-red-100 text-red-800' : v.stock <= 5 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {v.stock === 0 ? 'Out of Stock' : `${v.stock} units`}
                            </span>
                          </td>
                          <td className="p-3.5 flex items-center gap-2">
                            <button
                              onClick={() => {
                                db.updateStock(prod.id, v.id, Math.max(0, v.stock - 5));
                                refreshData();
                              }}
                              className="px-2 py-1 bg-stone-100 text-stone-700 rounded hover:bg-stone-200 font-bold"
                            >
                              -5
                            </button>
                            <button
                              onClick={() => {
                                db.updateStock(prod.id, v.id, v.stock + 10);
                                refreshData();
                              }}
                              className="px-2 py-1 bg-[#143728] text-white rounded hover:bg-[#204e37] font-semibold"
                            >
                              +10 Units
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PAYMENTS SECTION (Item 24) */}
          {activeSection === 'payments' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-stone-900">Payments & Transactions</h2>
                  <p className="text-xs text-stone-500">
                    Track COD collections and UPI payments. (Orders remain Pending until verified)
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs">
                  <span className="text-xs font-semibold text-stone-500">Verified Paid Orders</span>
                  <div className="text-2xl font-bold text-emerald-700 mt-1">₹{totalRevenue}</div>
                  <span className="text-[11px] text-stone-400">{paidOrders.length} confirmed</span>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs">
                  <span className="text-xs font-semibold text-stone-500">Pending Online UPI</span>
                  <div className="text-2xl font-bold text-amber-600 mt-1">
                    {orders.filter((o) => o.paymentMethod === 'ONLINE_UPI' && o.paymentStatus === 'Pending').length}
                  </div>
                  <span className="text-[11px] text-stone-400">Awaiting bank verification</span>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs">
                  <span className="text-xs font-semibold text-stone-500">Cash on Delivery (COD)</span>
                  <div className="text-2xl font-bold text-stone-800 mt-1">
                    {orders.filter((o) => o.paymentMethod === 'COD').length}
                  </div>
                  <span className="text-[11px] text-stone-400">Collect upon arrival</span>
                </div>
              </div>

              {/* Payment entries */}
              <div className="bg-white rounded-2xl border border-stone-200 p-6">
                <h3 className="font-bold text-stone-900 text-sm mb-4">Payment Verification Console</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-stone-200 text-stone-500 pb-2">
                        <th className="py-2">Order</th>
                        <th>Customer</th>
                        <th>Method</th>
                        <th>Amount</th>
                        <th>Current Payment Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {orders.map((o) => (
                        <tr key={o.id} className="hover:bg-stone-50">
                          <td className="py-3 font-semibold">{o.orderNumber}</td>
                          <td>{o.customer.fullName}</td>
                          <td>{o.paymentMethod}</td>
                          <td className="font-bold">₹{o.totalAmount}</td>
                          <td>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              o.paymentStatus === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {o.paymentStatus}
                            </span>
                          </td>
                          <td>
                            {o.paymentStatus !== 'Paid' ? (
                              <button
                                onClick={() => {
                                  db.updateOrderPayment(o.id, 'Paid');
                                  refreshData();
                                  showAdminToast(`Marked ${o.orderNumber} as Paid`);
                                }}
                                className="px-2.5 py-1 bg-emerald-700 text-white rounded text-[11px] font-semibold hover:bg-emerald-800"
                              >
                                Mark Paid (Confirmed)
                              </button>
                            ) : (
                              <span className="text-emerald-700 font-semibold flex items-center gap-1 text-[11px]">
                                <Check className="w-3.5 h-3.5" /> Verified
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* FEEDBACK MANAGEMENT (Item 27) */}
          {activeSection === 'feedback' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-stone-900">Feedback Management</h2>
                  <p className="text-xs text-stone-500">
                    Moderate reviews before they appear publicly. Only approved reviews appear on the website.
                  </p>
                </div>
              </div>

              {feedbackList.length === 0 ? (
                <div className="bg-white p-12 text-center rounded-2xl border border-stone-200 text-stone-500 text-xs">
                  No feedback submissions yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {feedbackList.map((fb) => (
                    <div key={fb.id} className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-stone-900 text-xs">{fb.customerName} ({fb.phone})</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          fb.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' : fb.status === 'Rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {fb.status}
                        </span>
                      </div>
                      <div className="text-amber-500 font-bold text-xs">
                        {'★'.repeat(fb.rating)}{'☆'.repeat(5 - fb.rating)} ({fb.rating}/5)
                      </div>
                      <p className="text-xs text-stone-700 italic bg-stone-50 p-2.5 rounded-xl border border-stone-100">
                        "{fb.message}"
                      </p>
                      <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-xs">
                        <span className="text-[10px] text-stone-400">
                          {new Date(fb.createdAt).toLocaleDateString('en-IN')}
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              db.updateFeedbackStatus(fb.id, 'Approved');
                              refreshData();
                              showAdminToast('Review approved and published');
                            }}
                            className="px-2.5 py-1 bg-emerald-700 text-white rounded text-[11px] font-semibold hover:bg-emerald-800"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              db.updateFeedbackStatus(fb.id, 'Rejected');
                              refreshData();
                              showAdminToast('Review rejected');
                            }}
                            className="px-2.5 py-1 bg-red-600 text-white rounded text-[11px] font-semibold hover:bg-red-700"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* OFFERS AND COUPONS (Item 32) */}
          {activeSection === 'offers' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-stone-900">Coupons & Special Offers</h2>
                  <p className="text-xs text-stone-500">Create percentage discounts, fixed vouchers, or free shipping offers.</p>
                </div>
                <button
                  onClick={() => setNewCouponModalOpen(true)}
                  className="px-4 py-2.5 bg-[#143728] text-white rounded-xl text-xs font-semibold hover:bg-[#204e37] flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-4 h-4" /> Add Coupon
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {coupons.map((c) => (
                  <div key={c.id} className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs bg-stone-100 text-stone-900 px-2 py-0.5 rounded border">
                        {c.code}
                      </span>
                      <button
                        onClick={() => {
                          db.deleteCoupon(c.id);
                          refreshData();
                        }}
                        className="text-stone-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="font-semibold text-sm text-[#2e5e43]">
                      {c.discountType === 'percentage' ? `${c.discountValue}% OFF` : c.discountType === 'fixed' ? `₹${c.discountValue} FLAT OFF` : 'Free Delivery'}
                    </div>
                    <div className="text-xs text-stone-500">
                      Min Order: ₹{c.minOrderAmount} {c.maxDiscount ? `(Cap: ₹${c.maxDiscount})` : ''}
                    </div>
                    <div className="text-[11px] text-stone-400">
                      Used: {c.usedCount} of {c.usageLimit} limit
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* HOMEPAGE BANNERS (Item 31) */}
          {activeSection === 'banners' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-stone-900">Homepage Banners</h2>
                  <p className="text-xs text-stone-500">Promote festival collections, new tea arrivals, and coffee blends.</p>
                </div>
                <button
                  onClick={() => setNewBannerModalOpen(true)}
                  className="px-4 py-2.5 bg-[#143728] text-white rounded-xl text-xs font-semibold hover:bg-[#204e37] flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-4 h-4" /> Add Banner
                </button>
              </div>

              <div className="space-y-4">
                {banners.map((b) => (
                  <div key={b.id} className="bg-white p-4 rounded-2xl border border-stone-200 flex flex-col sm:flex-row gap-4 items-center">
                    <img src={b.imageUrl} alt="" className="w-full sm:w-48 h-28 object-cover rounded-xl bg-stone-100" />
                    <div className="flex-1 space-y-1">
                      <h4 className="font-bold text-stone-900 text-sm">{b.title}</h4>
                      <p className="text-xs text-stone-500">{b.subtitle}</p>
                      <div className="text-[11px] text-[#2e5e43] font-medium">
                        Button: "{b.buttonText}" → Link: {b.linkUrl}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        db.deleteBanner(b.id);
                        refreshData();
                      }}
                      className="text-stone-400 hover:text-red-600 p-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DELIVERY AREAS (Item 29) */}
          {activeSection === 'delivery' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-stone-900">Delivery Areas & Village Rates</h2>
                  <p className="text-xs text-stone-500">Configure delivery charges and turnaround times for local villages and towns.</p>
                </div>
                <button
                  onClick={() => setNewDeliveryModalOpen(true)}
                  className="px-4 py-2.5 bg-[#143728] text-white rounded-xl text-xs font-semibold hover:bg-[#204e37] flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-4 h-4" /> Add Delivery Area
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {deliveryAreas.map((area) => (
                  <div key={area.id} className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-stone-900 text-sm">{area.villageTown}</h4>
                        <div className="text-xs text-stone-500">{area.district}, {area.state} ({area.pincode})</div>
                      </div>
                      <button
                        onClick={() => {
                          db.deleteDeliveryArea(area.id);
                          refreshData();
                        }}
                        className="text-stone-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-xs">
                      <span className="font-bold text-[#143728]">Delivery Charge: ₹{area.deliveryCharge}</span>
                      <span className="text-stone-500">{area.estimatedTime}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CUSTOMER MESSAGES / ENQUIRIES (Item 28) */}
          {activeSection === 'messages' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-stone-900">Customer Messages & Enquiries</h2>
                  <p className="text-xs text-stone-500">
                    Form submissions sent to {config.email} and stored securely here.
                  </p>
                </div>
              </div>

              {contactList.length === 0 ? (
                <div className="bg-white p-12 text-center rounded-2xl border border-stone-200 text-stone-500 text-xs">
                  No customer messages yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {contactList.map((msg) => (
                    <div key={msg.id} className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-stone-900 text-sm">{msg.name}</span>
                          <span className="text-xs text-stone-500">({msg.phone})</span>
                          {msg.email && <span className="text-xs text-stone-400">&lt;{msg.email}&gt;</span>}
                        </div>
                        <span className="text-[11px] text-stone-400">
                          {new Date(msg.createdAt).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="font-semibold text-xs text-[#2e5e43]">{msg.subject}</div>
                      <p className="text-xs text-stone-700 bg-stone-50 p-3 rounded-xl border border-stone-100 whitespace-pre-wrap">
                        {msg.message}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* REPORTS & ANALYTICS (Item 35 - No Fake Data) */}
          {activeSection === 'reports' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-stone-900">Sales Reports & Analytics</h2>
                <p className="text-xs text-stone-500">Live operational data generated strictly from verified orders.</p>
              </div>

              {orders.length === 0 ? (
                <div className="bg-white p-12 text-center rounded-2xl border border-stone-200 text-stone-500 text-xs">
                  No sales data available yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-2xs">
                    <h3 className="font-bold text-stone-900 text-sm mb-4">Orders by Category</h3>
                    <div className="space-y-3">
                      {['tea', 'coffee', 'combo'].map((cat) => {
                        const count = orders.filter((o) => o.items.some((i) => i.category === cat)).length;
                        return (
                          <div key={cat} className="text-xs flex justify-between items-center py-1 border-b border-stone-100">
                            <span className="capitalize font-medium text-stone-700">{cat} Powders</span>
                            <span className="font-bold text-stone-900">{count} order(s)</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-2xs">
                    <h3 className="font-bold text-stone-900 text-sm mb-4">Payment Methods Breakdown</h3>
                    <div className="space-y-3 text-xs">
                      <div className="flex justify-between py-1 border-b border-stone-100">
                        <span>Cash on Delivery (COD)</span>
                        <span className="font-bold">{orders.filter((o) => o.paymentMethod === 'COD').length}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-stone-100">
                        <span>Online UPI</span>
                        <span className="font-bold">{orders.filter((o) => o.paymentMethod === 'ONLINE_UPI').length}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SETTINGS SECTION (Item 25, 26, 30) */}
          {activeSection === 'settings' && (
            <div className="max-w-2xl bg-white p-6 sm:p-8 rounded-2xl border border-stone-200 shadow-2xs space-y-6">
              <div>
                <h2 className="text-xl font-bold text-stone-900">Business & Integration Settings</h2>
                <p className="text-xs text-stone-500">Configure proprietor details, business email, and automation webhooks.</p>
              </div>

              {/* Google Workspace Connection Card */}
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs text-[#143728]">Google Workspace Integration</div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                    googleConnected ? 'bg-emerald-200 text-emerald-900' : 'bg-stone-200 text-stone-700'
                  }`}>
                    {googleConnected ? 'Connected' : 'Not Connected'}
                  </span>
                </div>
                <p className="text-[11px] text-stone-600">
                  Enables real-time order confirmation emails via Gmail, order logging into Google Sheets, and invoice exports to Google Drive.
                </p>
                <div>
                  {googleConnected ? (
                    <button
                      onClick={handleDisconnectGoogle}
                      className="px-3 py-1.5 bg-stone-700 text-white rounded-lg text-xs font-semibold hover:bg-stone-800"
                    >
                      Disconnect Google
                    </button>
                  ) : (
                    <button
                      onClick={handleConnectGoogle}
                      className="px-3.5 py-1.5 bg-[#143728] text-white rounded-lg text-xs font-semibold hover:bg-[#204e37]"
                    >
                      Authorize Drive, Sheets & Gmail
                    </button>
                  )}
                </div>
              </div>

              {/* Configuration Form */}
              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Business Name</label>
                  <input
                    type="text"
                    value={config.name}
                    onChange={(e) => setConfig({ ...config, name: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Owner Name</label>
                  <input
                    type="text"
                    value={config.owner}
                    onChange={(e) => setConfig({ ...config, owner: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">Primary Mobile</label>
                    <input
                      type="text"
                      value={config.primaryPhone}
                      onChange={(e) => setConfig({ ...config, primaryPhone: e.target.value })}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">Secondary Mobile</label>
                    <input
                      type="text"
                      value={config.secondaryPhone}
                      onChange={(e) => setConfig({ ...config, secondaryPhone: e.target.value })}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Official Notification Email</label>
                  <input
                    type="email"
                    value={config.email}
                    onChange={(e) => setConfig({ ...config, email: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl"
                  />
                  <span className="text-[10px] text-stone-400">All customer notifications reach this address.</span>
                </div>

                {/* n8n Webhook (Item 26) */}
                <div className="pt-3 border-t border-stone-200">
                  <label className="block font-semibold text-stone-700 mb-1">n8n Automation Webhook URL</label>
                  <input
                    type="url"
                    value={config.n8nWebhookUrl || ''}
                    onChange={(e) => setConfig({ ...config, n8nWebhookUrl: e.target.value })}
                    placeholder="https://n8n.your-domain.com/webhook/..."
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl"
                  />
                  <span className="text-[10px] text-stone-400">Optional: Notifies n8n workflows for WhatsApp/Email bots on order events.</span>
                </div>

                {/* Official Certification / Licences (Item 30) */}
                <div className="pt-3 border-t border-stone-200 space-y-3">
                  <h4 className="font-bold text-stone-800">Document & Registration Information</h4>
                  <p className="text-[11px] text-stone-500">
                    Currently no fake licences are displayed. When obtained, enter legitimate registration numbers below:
                  </p>
                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">FSSAI Registration / Licence No.</label>
                    <input
                      type="text"
                      value={config.fssaiNumber || ''}
                      onChange={(e) => setConfig({ ...config, fssaiNumber: e.target.value })}
                      placeholder="e.g. 2242..."
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">GSTIN (Optional)</label>
                    <input
                      type="text"
                      value={config.gstNumber || ''}
                      onChange={(e) => setConfig({ ...config, gstNumber: e.target.value })}
                      placeholder="e.g. 33AAAAA..."
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl"
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    onClick={() => {
                      db.saveBusinessConfig(config);
                      showAdminToast('Business settings saved successfully!');
                    }}
                    className="w-full py-3 bg-[#143728] text-white font-bold rounded-xl hover:bg-[#204e37] transition-all"
                  >
                    Save Business Configuration
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ADD / EDIT PRODUCT MODAL (Items 17, 18, 19, 20) */}
      {(isAddingProduct || editingProduct) && (
        <ProductFormModal
          product={editingProduct}
          categories={categories}
          onClose={() => {
            setIsAddingProduct(false);
            setEditingProduct(null);
          }}
          onSave={(prodData) => {
            db.saveProduct(prodData);
            refreshData();
            setIsAddingProduct(false);
            setEditingProduct(null);
            showAdminToast('Product saved and published to website!');
          }}
        />
      )}

      {/* CREATE CATEGORY MODAL */}
      {newCatModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="font-bold text-stone-900 text-base">Add New Category</h3>
            <form
              onSubmit={(e: any) => {
                e.preventDefault();
                const form = e.target;
                const catName = form.name.value;
                const slug = catName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                db.saveCategory({
                  name: catName,
                  slug: slug || `cat-${Date.now()}`,
                  mainCategory: form.mainCategory.value,
                  description: form.description.value,
                });
                refreshData();
                setNewCatModalOpen(false);
                showAdminToast('Category added!');
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-semibold mb-1">Category Name</label>
                <input name="name" required className="w-full px-3 py-2 border rounded-xl" placeholder="e.g. Spices / Herbal Tea" />
              </div>
              <div>
                <label className="block font-semibold mb-1">Main Group</label>
                <select name="mainCategory" className="w-full px-3 py-2 border rounded-xl">
                  <option value="tea">Tea</option>
                  <option value="coffee">Coffee</option>
                  <option value="combo">Combo</option>
                  <option value="grocery">Grocery / Spices</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Description</label>
                <textarea name="description" rows={2} className="w-full px-3 py-2 border rounded-xl" placeholder="Brief note..." />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setNewCatModalOpen(false)} className="px-4 py-2 border rounded-xl">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-[#143728] text-white rounded-xl font-bold">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GLOBAL ADMIN TOAST */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-stone-900 text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold animate-in fade-in">
          {toastMsg}
        </div>
      )}
    </div>
  );
};

// Subcomponent: Dedicated Product Form Modal with Direct Image Upload & Variants
interface ProductFormModalProps {
  product: Product | null;
  categories: Category[];
  onClose: () => void;
  onSave: (data: any) => void;
}

const ProductFormModal: React.FC<ProductFormModalProps> = ({
  product,
  categories,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(product?.name || '');
  const [mainCategory, setMainCategory] = useState(product?.mainCategory || 'tea');
  const [categorySlug, setCategorySlug] = useState(product?.categorySlug || categories[0]?.slug || '');
  const [brand, setBrand] = useState(product?.brand || 'KVN TEAPOWDER');
  const [description, setDescription] = useState(product?.description || '');
  const [brewingInstructions, setBrewingInstructions] = useState(product?.brewingInstructions || '');
  const [ingredients, setIngredients] = useState(product?.ingredients || '');
  const [images, setImages] = useState<string[]>(product?.images || []);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [isFeatured, setIsFeatured] = useState(product?.isFeatured || false);
  const [isBestSeller, setIsBestSeller] = useState(product?.isBestSeller || false);
  const [isNewArrival, setIsNewArrival] = useState(product?.isNewArrival !== undefined ? product.isNewArrival : true);
  const [status, setStatus] = useState<'published' | 'draft' | 'archived'>(product?.status || 'published');

  // Weight variants
  const [variants, setVariants] = useState<any[]>(
    product?.variants && product.variants.length > 0
      ? product.variants
      : [
          { id: 'v1', weight: '250g', mrp: 140, sellingPrice: 120, stock: 30 },
          { id: 'v2', weight: '500g', mrp: 270, sellingPrice: 230, stock: 20 },
        ]
  );

  // File upload handler (direct from device)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const base64Url = uploadEvent.target?.result as string;
        if (base64Url) {
          setImages((prev) => [base64Url, ...prev]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddImageUrl = () => {
    if (imageUrlInput.trim()) {
      setImages((prev) => [...prev, imageUrlInput.trim()]);
      setImageUrlInput('');
    }
  };

  const handleVariantChange = (idx: number, field: string, value: any) => {
    setVariants((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const handleAddVariant = () => {
    setVariants((prev) => [
      ...prev,
      { id: `v-${Date.now()}`, weight: '1kg', mrp: 500, sellingPrice: 450, stock: 15 },
    ]);
  };

  const handleRemoveVariant = (idx: number) => {
    if (variants.length > 1) {
      setVariants((prev) => prev.filter((_, i) => i !== idx));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...(product ? { id: product.id } : {}),
      name,
      mainCategory,
      categorySlug,
      brand,
      description,
      brewingInstructions,
      ingredients,
      images: images.length > 0 ? images : ['https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=800&q=80'],
      variants,
      isFeatured,
      isBestSeller,
      isNewArrival,
      status,
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 shadow-2xl border border-stone-200">
        <div className="flex items-center justify-between pb-4 border-b border-stone-200 mb-6">
          <h3 className="font-bold text-stone-900 text-lg">
            {product ? 'Edit Product' : 'Add New Product (Arrival)'}
          </h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 text-lg">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          {/* Name & Main Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Product Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. KVN Ooty Gold CTC Tea"
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Category *</label>
              <select
                value={mainCategory}
                onChange={(e) => setMainCategory(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl"
              >
                <option value="tea">Tea Powder</option>
                <option value="coffee">Coffee Powder</option>
                <option value="combo">Combo Pack</option>
                <option value="grocery">Grocery / Spices</option>
              </select>
            </div>
          </div>

          {/* Subcategory */}
          <div>
            <label className="block font-semibold text-stone-700 mb-1">Subcategory</label>
            <select
              value={categorySlug}
              onChange={(e) => setCategorySlug(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>{c.name} ({c.mainCategory})</option>
              ))}
            </select>
          </div>

          {/* Image Upload Workflow (Item 18) */}
          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
            <label className="block font-bold text-stone-800">Product Images</label>
            <div className="flex flex-wrap gap-3">
              {images.map((img, idx) => (
                <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-stone-300">
                  <img src={img} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                    className="absolute top-1 right-1 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center text-[10px]"
                  >
                    ✕
                  </button>
                </div>
              ))}

              {/* Upload button from computer/mobile */}
              <label className="w-20 h-20 border-2 border-dashed border-stone-300 hover:border-[#2e5e43] rounded-xl flex flex-col items-center justify-center cursor-pointer text-stone-500 hover:text-[#2e5e43] transition-colors">
                <Upload className="w-5 h-5 mb-1" />
                <span className="text-[10px] font-semibold">Upload</span>
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>

            {/* URL alternative */}
            <div className="flex gap-2 pt-1">
              <input
                type="url"
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                placeholder="Or paste image URL (Unsplash, etc.)"
                className="flex-1 px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs"
              />
              <button
                type="button"
                onClick={handleAddImageUrl}
                className="px-3 py-1.5 bg-stone-800 text-white rounded-lg font-semibold"
              >
                Add URL
              </button>
            </div>
          </div>

          {/* Weight Variants (Item 9, 17) */}
          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-bold text-stone-800">Weight Variants & Pricing</label>
              <button
                type="button"
                onClick={handleAddVariant}
                className="text-xs font-semibold text-[#2e5e43] hover:underline"
              >
                + Add Weight Variant
              </button>
            </div>

            <div className="space-y-2">
              {variants.map((v, idx) => (
                <div key={v.id || idx} className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-stone-200">
                  <input
                    type="text"
                    value={v.weight}
                    onChange={(e) => handleVariantChange(idx, 'weight', e.target.value)}
                    placeholder="e.g. 250g"
                    className="w-24 px-2 py-1 border rounded text-xs"
                  />
                  <div className="flex items-center gap-1">
                    <span>MRP ₹</span>
                    <input
                      type="number"
                      value={v.mrp}
                      onChange={(e) => handleVariantChange(idx, 'mrp', Number(e.target.value))}
                      className="w-18 px-2 py-1 border rounded text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span>Selling ₹</span>
                    <input
                      type="number"
                      value={v.sellingPrice}
                      onChange={(e) => handleVariantChange(idx, 'sellingPrice', Number(e.target.value))}
                      className="w-18 px-2 py-1 border rounded text-xs font-bold"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span>Stock:</span>
                    <input
                      type="number"
                      value={v.stock}
                      onChange={(e) => handleVariantChange(idx, 'stock', Number(e.target.value))}
                      className="w-16 px-2 py-1 border rounded text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveVariant(idx)}
                    className="text-stone-400 hover:text-red-600 p-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Description & Brew Instructions */}
          <div>
            <label className="block font-semibold text-stone-700 mb-1">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Flavor notes, leaf grade, strength profile..."
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl"
            />
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">Brewing Method / Instructions</label>
            <textarea
              rows={2}
              value={brewingInstructions}
              onChange={(e) => setBrewingInstructions(e.target.value)}
              placeholder="Recommended water:milk ratio, boiling time..."
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl"
            />
          </div>

          {/* Flags */}
          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isNewArrival}
                onChange={(e) => setIsNewArrival(e.target.checked)}
                className="rounded text-[#143728]"
              />
              <span className="font-semibold text-stone-700">Mark as New Arrival (Shown on homepage)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isBestSeller}
                onChange={(e) => setIsBestSeller(e.target.checked)}
                className="rounded text-[#143728]"
              />
              <span className="font-semibold text-stone-700">Best Seller / Customer Favourite</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="rounded text-[#143728]"
              />
              <span className="font-semibold text-stone-700">Featured</span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-stone-200">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-stone-300 rounded-xl text-stone-600 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={() => setStatus('draft')}
              className="px-5 py-2.5 bg-stone-200 text-stone-800 rounded-xl font-semibold hover:bg-stone-300"
            >
              Save as Draft
            </button>
            <button
              type="submit"
              onClick={() => setStatus('published')}
              className="px-6 py-2.5 bg-[#143728] text-white rounded-xl font-bold hover:bg-[#204e37] shadow-xs"
            >
              Save & Publish to Store
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
