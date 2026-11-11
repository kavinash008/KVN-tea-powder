import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../lib/db';
import { api } from '../lib/api';
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
  PaymentAuditEntry,
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
  RefreshCw,
  Eye,
  Loader2,
  AlertCircle,
  FileSpreadsheet,
  MessageCircle,
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

  // Shared database synchronization state
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [isSyncingOrders, setIsSyncingOrders] = useState<boolean>(false);
  const [ordersSyncError, setOrdersSyncError] = useState<string | null>(null);
  const [lastOrdersSync, setLastOrdersSync] = useState<string>('Live');

  // n8n Webhook backup monitoring state
  const [webhookStats, setWebhookStats] = useState<{
    configured: boolean;
    webhookUrl: string;
    stats?: { total: number; delivered: number; pending: number; failed: number };
  } | null>(null);
  const [retryingWebhooks, setRetryingWebhooks] = useState(false);

  const loadWebhookStatus = useCallback(async () => {
    try {
      const data = await api.adminGetWebhookStatus();
      if (data && typeof data === 'object') {
        setWebhookStats(data);
      }
    } catch (err) {
      // Non-fatal if serverless or network glitch
      console.warn('Webhook status check notice:', err);
    }
  }, []);

  const [syncingExcel, setSyncingExcel] = useState(false);
  const [retryingWaOrderId, setRetryingWaOrderId] = useState<string | null>(null);
  const [retryingAllWa, setRetryingAllWa] = useState(false);

  // Payments Verification & WhatsApp Outbox state
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'pending' | 'paid' | 'rejected'>('all');
  const [paymentSummary, setPaymentSummary] = useState<any>(null);
  const [paymentAuditLogs, setPaymentAuditLogs] = useState<PaymentAuditEntry[]>([]);
  const [whatsappDiag, setWhatsappDiag] = useState<any>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [screenshotModalUrl, setScreenshotModalUrl] = useState<string | null>(null);

  // Approve / Reject Payment Modals
  const [approveModalOrder, setApproveModalOrder] = useState<Order | null>(null);
  const [approvePayerName, setApprovePayerName] = useState('');
  const [approveUtrInput, setApproveUtrInput] = useState('');
  const [approveNoteInput, setApproveNoteInput] = useState('');
  const [processingPaymentAction, setProcessingPaymentAction] = useState(false);

  const [rejectModalOrder, setRejectModalOrder] = useState<Order | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');

  const loadPaymentData = useCallback(async () => {
    try {
      const token = localStorage.getItem('kvn_admin_token') || 'kavin008';
      const [payRes, waRes, settingsRes] = await Promise.all([
        api.adminGetPayments(token).catch(() => null),
        api.adminGetWhatsAppStatus(token).catch(() => null),
        api.adminGetSettings(token).catch(() => null),
      ]);
      if (payRes) {
        setPaymentSummary(payRes.summary);
        setPaymentAuditLogs(payRes.auditLogs || []);
      }
      if (waRes) {
        setWhatsappDiag(waRes);
      }
      if (settingsRes) {
        setConfig(settingsRes);
        db.saveBusinessConfig(settingsRes);
      }
    } catch {
      // ignore transient error
    }
  }, []);

  const handleSyncExcel = async () => {
    try {
      setSyncingExcel(true);
      const token = localStorage.getItem('kvn_admin_token') || 'kavin008';
      const res = await api.adminSyncExcel(token);
      showAdminToast(res?.message || 'Excel sync executed');
      await loadServerOrders();
    } catch (err: any) {
      showAdminToast(err?.message || 'Failed to sync with Microsoft Excel');
    } finally {
      setSyncingExcel(false);
    }
  };

  const handleRetryWhatsApp = async (orderId: string) => {
    try {
      setRetryingWaOrderId(orderId);
      const token = localStorage.getItem('kvn_admin_token') || 'kavin008';
      const res = await api.adminRetryWhatsApp(token, orderId);
      if (res.success) {
        showAdminToast('WhatsApp confirmation message dispatched!');
      } else {
        showAdminToast(res.result?.reason || res.result?.error || 'WhatsApp message queued/pending');
      }
      await Promise.all([loadServerOrders(), loadPaymentData()]);
    } catch (err: any) {
      showAdminToast(err.message || 'WhatsApp retry failed');
    } finally {
      setRetryingWaOrderId(null);
    }
  };

  const handleRetryAllWhatsApp = async () => {
    try {
      setRetryingAllWa(true);
      const token = localStorage.getItem('kvn_admin_token') || 'kavin008';
      const res = await api.adminRetryAllWhatsApp(token);
      showAdminToast(res?.message || 'WhatsApp outbox retry executed');
      await Promise.all([loadServerOrders(), loadPaymentData()]);
    } catch (err: any) {
      showAdminToast(err?.message || 'Failed to retry queued WhatsApp notifications');
    } finally {
      setRetryingAllWa(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSavingSettings(true);
      const token = localStorage.getItem('kvn_admin_token') || 'kavin008';
      const updated = await api.adminUpdateSettings(token, config);
      setConfig(updated);
      db.saveBusinessConfig(updated);
      window.dispatchEvent(new Event('kvn_settings_updated'));
      showAdminToast(
        updated.upiConfigured
          ? `Settings & UPI ID (${updated.upiId}) saved to MongoDB!`
          : 'Business settings saved to database!'
      );
    } catch (err: any) {
      showAdminToast(err?.message || 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleConfirmApprovePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approveModalOrder) return;
    try {
      setProcessingPaymentAction(true);
      const token = localStorage.getItem('kvn_admin_token') || 'kavin008';
      const res = await api.adminApprovePayment(token, approveModalOrder.id, {
        verifiedAmount: approveModalOrder.totalAmount,
        verifiedPayerName: approvePayerName.trim() || undefined,
        utrOverride: approveUtrInput.trim() || undefined,
        adminNote: approveNoteInput.trim() || undefined,
      });
      setApproveModalOrder(null);
      showAdminToast(res.message || 'Payment verified ✓ Order confirmed!');
      window.dispatchEvent(new Event('kvn_products_updated'));
      await Promise.all([loadServerOrders(), loadServerProducts(), loadPaymentData()]);
    } catch (err: any) {
      showAdminToast(err?.message || 'Failed to approve payment');
    } finally {
      setProcessingPaymentAction(false);
    }
  };

  const handleConfirmRejectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModalOrder) return;
    try {
      setProcessingPaymentAction(true);
      const token = localStorage.getItem('kvn_admin_token') || 'kavin008';
      const res = await api.adminRejectPayment(
        token,
        rejectModalOrder.id,
        rejectReasonInput.trim() || 'Transaction not found in GPay / bank record'
      );
      setRejectModalOrder(null);
      setRejectReasonInput('');
      showAdminToast(res.message || 'Payment marked as REJECTED');
      await Promise.all([loadServerOrders(), loadPaymentData()]);
    } catch (err: any) {
      showAdminToast(err?.message || 'Failed to reject payment');
    } finally {
      setProcessingPaymentAction(false);
    }
  };

  const handleRetryWebhooks = async () => {
    try {
      setRetryingWebhooks(true);
      const res = await api.adminRetryWebhooks();
      showAdminToast(res?.message || 'Webhook outbox flushed');
      await loadWebhookStatus();
    } catch (err: any) {
      showAdminToast(err.message || 'Failed to retry webhooks');
    } finally {
      setRetryingWebhooks(false);
    }
  };

  const loadServerOrders = useCallback(async () => {
    try {
      setIsSyncingOrders(true);
      setOrdersSyncError(null);
      const token = localStorage.getItem('kvn_admin_token') || 'kavin008';
      const serverOrders = await api.adminGetOrders(token, orderStatusFilter);
      if (Array.isArray(serverOrders)) {
        setOrders(serverOrders);
        setLastOrdersSync(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    } catch (err: any) {
      console.error('Orders sync notice:', err);
      setOrdersSyncError(err?.message || 'Unable to reach shared database. Check network or server status.');
      // Keep existing memory orders; do not silently replace with stale local browser storage
    } finally {
      setIsSyncingOrders(false);
    }
  }, [orderStatusFilter]);

  const loadServerProducts = useCallback(async () => {
    try {
      const token = localStorage.getItem('kvn_admin_token') || 'kavin008';
      const serverProducts = await api.adminGetProducts(token);
      if (Array.isArray(serverProducts)) {
        setProducts(serverProducts);
        db.saveProductsToCache(serverProducts);
      }
      const serverCategories = await api.getCategories();
      if (Array.isArray(serverCategories) && serverCategories.length > 0) {
        setCategories(serverCategories);
        db.saveCategoriesToCache(serverCategories);
      }
    } catch (err: any) {
      console.warn('Admin products sync notice:', err);
    }
  }, []);

  // Real-time polling every 12 seconds to fetch orders placed on other devices
  useEffect(() => {
    loadServerOrders();
    loadServerProducts();
    loadWebhookStatus();
    loadPaymentData();
    const interval = setInterval(() => {
      loadServerOrders();
      loadServerProducts();
      loadWebhookStatus();
      loadPaymentData();
    }, 12000);
    return () => clearInterval(interval);
  }, [loadServerOrders, loadServerProducts, loadWebhookStatus, loadPaymentData]);

  const handleUpdateOrderStatus = async (orderId: string, newStatus: any) => {
    try {
      const token = localStorage.getItem('kvn_admin_token') || 'kavin008';
      const updated = await api.adminUpdateOrderStatus(token, orderId, newStatus);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      if (orderDetailModal && orderDetailModal.id === orderId) {
        setOrderDetailModal(updated);
      }
      showAdminToast(`Order status updated to ${newStatus} (Saved to shared DB & dispatched)`);
      loadWebhookStatus();
    } catch (err: any) {
      console.error('Update status error:', err);
      showAdminToast(err?.message || `Failed to update status on shared database`);
    }
  };

  const refreshData = () => {
    loadServerProducts();
    loadServerOrders();
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

  // Metrics computation (NO fake analytics data! Revenue strictly from verified payments)
  const todayStr = new Date().toISOString().split('T')[0];
  const todayOrders = orders.filter((o) => o.createdAt.startsWith(todayStr));
  const paidOrders = orders.filter((o) => o.paymentStatus === 'PAID' || o.paymentStatus === 'Paid');
  const pendingUpiOrders = orders.filter(
    (o) => o.paymentStatus === 'PAYMENT_PENDING' || (o.paymentMethod === 'ONLINE_UPI' && o.paymentStatus === 'Pending')
  );
  const rejectedPaymentOrders = orders.filter(
    (o) => o.paymentStatus === 'REJECTED' || o.paymentStatus === 'Failed'
  );
  const todaySales = todayOrders.reduce(
    (sum, o) => sum + (o.paymentStatus === 'PAID' || o.paymentStatus === 'Paid' ? Number(o.paymentDetails?.verifiedAmount ?? o.totalAmount) : 0),
    0
  );
  const pendingOrders = orders.filter((o) => o.orderStatus === 'Pending' || o.orderStatus === 'Payment Pending' || o.orderStatus === 'Order Confirmed');
  const totalRevenue = paidOrders.reduce(
    (sum, o) => sum + Number(o.paymentDetails?.verifiedAmount ?? o.totalAmount ?? 0),
    0
  );

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
    { id: 'payments', label: 'Payments & Verification', shortLabel: 'Payments', icon: CreditCard, badge: pendingUpiOrders.length },
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
              Proprietor: {config?.owner || 'Kavinash'}
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
                              <div className="flex items-center gap-1.5">
                                <span className={`font-semibold ${totalStock === 0 ? 'text-red-600' : totalStock <= 10 ? 'text-amber-600' : 'text-emerald-700'}`}>
                                  {totalStock} units
                                </span>
                                <button
                                  onClick={async () => {
                                    let newStock: number;
                                    if (totalStock === 0) {
                                      const entered = window.prompt(`Enter restock quantity for "${prod.name}":`, '30');
                                      if (entered === null) return;
                                      newStock = Math.max(0, parseInt(entered, 10) || 0);
                                    } else {
                                      if (!window.confirm(`Mark "${prod.name}" as Out of Stock (0 units)?`)) return;
                                      newStock = 0;
                                    }
                                    const updatedVariants = prod.variants.map((v) => ({ ...v, stock: newStock }));
                                    try {
                                      const token = localStorage.getItem('kvn_admin_token') || 'kavin008';
                                      const updated = await api.adminUpdateProduct(token, prod.id, { variants: updatedVariants });
                                      setProducts((prev) => prev.map((p) => p.id === prod.id ? updated : p));
                                      db.saveProduct(updated);
                                      window.dispatchEvent(new Event('kvn_products_updated'));
                                      showAdminToast(newStock > 0 ? `Restocked "${prod.name}" to ${newStock} units` : `Marked "${prod.name}" as Out of Stock`);
                                    } catch (err: any) {
                                      showAdminToast(`Failed to update stock: ${err?.message}`);
                                    }
                                  }}
                                  className="text-[10px] text-stone-500 hover:text-stone-900 underline ml-1 cursor-pointer"
                                  title={totalStock === 0 ? "Enter restock quantity" : "Set Out of Stock (0)"}
                                >
                                  {totalStock === 0 ? "Restock" : "Set 0"}
                                </button>
                              </div>
                            </td>
                            <td className="p-3.5">
                              <div className="flex flex-wrap gap-1">
                                {prod.isNewArrival && <span className="bg-[#143728] text-white px-1.5 py-0.5 rounded text-[9px]">New Arrival</span>}
                                {prod.isBestSeller && <span className="bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded text-[9px]">Best Seller</span>}
                                {prod.isFeatured && <span className="bg-blue-100 text-blue-900 px-1.5 py-0.5 rounded text-[9px]">Featured</span>}
                              </div>
                            </td>
                            <td className="p-3.5">
                              <button
                                onClick={async () => {
                                  const nextStatus = prod.status === 'published' ? 'draft' : 'published';
                                  try {
                                    const token = localStorage.getItem('kvn_admin_token') || 'kavin008';
                                    const updated = await api.adminUpdateProduct(token, prod.id, { status: nextStatus });
                                    setProducts((prev) => prev.map((p) => p.id === prod.id ? updated : p));
                                    db.saveProduct(updated);
                                    window.dispatchEvent(new Event('kvn_products_updated'));
                                    showAdminToast(`Product "${prod.name}" set to ${nextStatus}`);
                                  } catch (err: any) {
                                    showAdminToast(`Failed to update status: ${err?.message}`);
                                  }
                                }}
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer transition-all active:scale-95 ${
                                  prod.status === 'published' ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
                                }`}
                                title={prod.status === 'published' ? 'Click to deactivate (hide from store)' : 'Click to publish (show in store)'}
                              >
                                {prod.status === 'published' ? '● Published' : '○ Draft'}
                              </button>
                            </td>
                            <td className="p-3.5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => setEditingProduct(prod)}
                                  className="p-1.5 text-stone-500 hover:text-[#2e5e43] hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                                  title="Edit Product"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={async () => {
                                    if (confirm(`Are you sure you want to delete "${prod.name}" from MongoDB database?`)) {
                                      try {
                                        const token = localStorage.getItem('kvn_admin_token') || 'kavin008';
                                        await api.adminDeleteProduct(token, prod.id);
                                        setProducts((prev) => prev.filter((p) => p.id !== prod.id));
                                        db.deleteProduct(prod.id);
                                        window.dispatchEvent(new Event('kvn_products_updated'));
                                        showAdminToast(`Product "${prod.name}" deleted from database`);
                                      } catch (err: any) {
                                        showAdminToast(`Failed to delete product: ${err?.message}`);
                                      }
                                    }
                                  }}
                                  className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
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
                        onClick={async () => {
                          if (confirm(`Delete category "${cat.name}" from MongoDB database?`)) {
                            try {
                              const token = localStorage.getItem('kvn_admin_token') || 'kavin008';
                              await api.adminDeleteCategory(token, cat.id);
                              setCategories((prev) => prev.filter((c) => c.id !== cat.id));
                              db.deleteCategory(cat.id);
                              showAdminToast(`Category "${cat.name}" deleted from database`);
                            } catch (err: any) {
                              showAdminToast(`Error deleting category: ${err?.message}`);
                            }
                          }
                        }}
                        className="text-stone-400 hover:text-rose-600 cursor-pointer"
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
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-stone-900">Orders Management</h2>
                  <p className="text-xs text-stone-500">Live order stream connected to shared persistent database.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* n8n Webhook backup indicator */}
                  <div
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 shadow-2xs"
                    title={webhookStats?.configured ? 'n8n Webhook active & receiving order events' : 'Set N8N_WEBHOOK_URL in server environment variables'}
                  >
                    <span className={`w-2 h-2 rounded-full ${webhookStats?.configured ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                    <span>n8n: {webhookStats?.configured ? 'Connected' : 'Not Set'}</span>
                    {webhookStats?.stats && webhookStats.stats.total > 0 && (
                      <span className="text-[10px] text-stone-500">({webhookStats.stats.delivered} sent)</span>
                    )}
                  </div>

                  {webhookStats?.stats && (webhookStats.stats.pending > 0 || webhookStats.stats.failed > 0) && (
                    <button
                      onClick={handleRetryWebhooks}
                      disabled={retryingWebhooks}
                      className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                      title="Flush pending or failed webhook events"
                    >
                      {retryingWebhooks ? 'Flushing...' : `Retry Webhooks (${webhookStats.stats.pending + webhookStats.stats.failed})`}
                    </button>
                  )}

                  <button
                    onClick={handleSyncExcel}
                    disabled={syncingExcel}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 rounded-xl text-xs font-semibold transition-all shadow-2xs cursor-pointer"
                    title="Sync all orders to Microsoft Excel workbook via Microsoft Graph API"
                  >
                    <FileSpreadsheet className={`w-3.5 h-3.5 text-teal-700 ${syncingExcel ? 'animate-spin' : ''}`} />
                    <span>{syncingExcel ? 'Syncing Excel...' : 'Sync to Excel'}</span>
                  </button>

                  <button
                    onClick={() => loadServerOrders()}
                    disabled={isSyncingOrders}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-xl text-xs font-semibold text-stone-700 transition-all shadow-2xs cursor-pointer"
                    title="Fetch latest orders from server"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-[#2e5e43] ${isSyncingOrders ? 'animate-spin' : ''}`} />
                    <span>{isSyncingOrders ? 'Syncing...' : `Sync (${lastOrdersSync})`}</span>
                  </button>
                  <span className="text-xs font-semibold text-stone-600 bg-stone-100 px-3 py-1.5 rounded-xl border border-stone-200 shadow-2xs">
                    Total: {orders.length}
                  </span>
                </div>
              </div>

              {/* Error notice if shared DB unreachable */}
              {ordersSyncError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{ordersSyncError}</span>
                  </div>
                  <button
                    onClick={() => loadServerOrders()}
                    className="px-3 py-1 bg-rose-600 text-white font-semibold rounded-lg hover:bg-rose-700 transition-colors text-xs cursor-pointer"
                  >
                    Retry Sync
                  </button>
                </div>
              )}

              {/* Status Filter Tabs (Phase 7) */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
                {[
                  { id: 'all', label: 'All Orders' },
                  { id: 'Order Confirmed', label: 'New / Confirmed' },
                  { id: 'Processing', label: 'Processing' },
                  { id: 'Dispatched', label: 'Dispatched' },
                  { id: 'Out for Delivery', label: 'Out for Delivery' },
                  { id: 'Delivered', label: 'Delivered' },
                  { id: 'Cancelled', label: 'Cancelled' },
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setOrderStatusFilter(st.id)}
                    className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all ${
                      orderStatusFilter === st.id
                        ? 'bg-[#143728] text-white shadow-2xs'
                        : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {orders.length === 0 ? (
                <div className="bg-white p-12 text-center rounded-2xl border border-stone-200 text-stone-500 text-xs">
                  No orders match this filter or have been placed yet.
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold">
                        <tr>
                          <th className="p-3.5">Order ID</th>
                          <th className="p-3.5">Customer & Phone</th>
                          <th className="p-3.5">Delivery Address</th>
                          <th className="p-3.5">Items</th>
                          <th className="p-3.5">Amount</th>
                          <th className="p-3.5">Payment</th>
                          <th className="p-3.5">Status</th>
                          <th className="p-3.5">Update Status</th>
                          <th className="p-3.5">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {orders.map((ord) => (
                          <tr key={ord.id} className="hover:bg-stone-50 transition-colors">
                            <td className="p-3.5 font-bold text-stone-900 whitespace-nowrap">
                              {ord.orderNumber}
                              <div className="text-[10px] text-stone-400 font-normal">
                                {new Date(ord.createdAt).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            </td>
                            <td className="p-3.5">
                              <div className="font-semibold text-stone-900">{ord.customer.fullName}</div>
                              <div className="text-stone-500 text-[11px] font-mono">{ord.customer.phone}</div>
                            </td>
                            <td className="p-3.5 text-stone-600 max-w-xs truncate">
                              <div>{ord.customer.address}</div>
                              <div className="text-[11px] text-stone-400">{ord.customer.villageTown} - {ord.customer.pincode}</div>
                            </td>
                            <td className="p-3.5 text-stone-700">
                              <span className="font-semibold">{ord.items.length} items</span>
                              <div className="text-[10px] text-stone-500 truncate max-w-[140px]">
                                {ord.items.map((i) => `${i.productName} (${i.weight})`).join(', ')}
                              </div>
                            </td>
                            <td className="p-3.5 font-bold text-stone-900 whitespace-nowrap">₹{ord.totalAmount}</td>
                            <td className="p-3.5 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                ord.paymentStatus === 'PAID' || ord.paymentStatus === 'Paid'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : ord.paymentStatus === 'REJECTED' || ord.paymentStatus === 'Failed'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}>
                                {ord.paymentMethod} ({ord.paymentStatus})
                              </span>
                              {ord.paymentDetails?.utrNormalized && (
                                <div className="text-[10px] font-mono text-stone-500 mt-0.5">
                                  UTR: {ord.paymentDetails.utrNormalized}
                                </div>
                              )}
                            </td>
                            <td className="p-3.5 whitespace-nowrap">
                              <span className="font-medium bg-stone-100 text-stone-800 px-2 py-0.5 rounded text-[10px] border border-stone-200 block w-max">
                                {ord.orderStatus}
                              </span>
                              <div className="flex flex-col gap-1 mt-1.5 text-[9px]">
                                <div className="flex items-center gap-1">
                                  <span
                                    className={`px-1.5 py-0.5 rounded font-semibold ${
                                      (ord.whatsappStatus || '').toLowerCase() === 'sent'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : (ord.whatsappStatus || '').toLowerCase() === 'failed'
                                        ? 'bg-rose-100 text-rose-800'
                                        : 'bg-stone-100 text-stone-600'
                                    }`}
                                  >
                                    WA: {ord.whatsappStatus || 'Pending'}
                                  </span>
                                  {((ord.whatsappStatus || '').toLowerCase() === 'failed' ||
                                    ((ord.paymentStatus === 'PAID' || ord.paymentStatus === 'Paid') &&
                                      (ord.whatsappStatus || '').toLowerCase() !== 'sent')) && (
                                    <button
                                      onClick={() => handleRetryWhatsApp(ord.id)}
                                      disabled={retryingWaOrderId === ord.id}
                                      className="text-[9px] text-[#143728] hover:underline font-bold cursor-pointer"
                                      title="Retry sending WhatsApp confirmation"
                                    >
                                      {retryingWaOrderId === ord.id ? '...' : 'Retry'}
                                    </button>
                                  )}
                                </div>
                                <span
                                  className={`px-1.5 py-0.5 rounded font-semibold w-max ${
                                    ord.excelSyncStatus === 'synced'
                                      ? 'bg-teal-100 text-teal-800'
                                      : ord.excelSyncStatus === 'failed'
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-stone-100 text-stone-600'
                                  }`}
                                >
                                  Excel: {ord.excelSyncStatus || 'pending'}
                                </span>
                              </div>
                            </td>
                            <td className="p-3.5 whitespace-nowrap">
                              <select
                                value={ord.orderStatus}
                                onChange={(e) => handleUpdateOrderStatus(ord.id, e.target.value)}
                                className="bg-stone-50 border border-stone-200 text-xs rounded-lg px-2 py-1 focus:outline-hidden font-medium text-stone-800"
                              >
                                <option value="Pending">Pending</option>
                                <option value="Payment Pending">Payment Pending</option>
                                <option value="Order Confirmed">Order Confirmed</option>
                                <option value="Processing">Processing</option>
                                <option value="Dispatched">Dispatched</option>
                                <option value="Out for Delivery">Out for Delivery</option>
                                <option value="Delivered">Delivered</option>
                                <option value="Cancelled">Cancelled</option>
                              </select>
                            </td>
                            <td className="p-3.5 whitespace-nowrap">
                              <button
                                onClick={() => setOrderDetailModal(ord)}
                                className="flex items-center gap-1 text-[#143728] font-bold hover:underline text-xs bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/60"
                              >
                                <Eye className="w-3.5 h-3.5 text-[#2e5e43]" /> View
                              </button>
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

          {/* PAYMENTS VERIFICATION SECTION */}
          {activeSection === 'payments' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-stone-900">UPI Payments Verification & Audit</h2>
                  <p className="text-xs text-stone-500">
                    Manually verify customer UTR numbers against your Google Pay / Bank statement before approving.
                  </p>
                </div>
                <button
                  onClick={() => Promise.all([loadServerOrders(), loadPaymentData()])}
                  className="px-3.5 py-2 bg-white border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 hover:bg-stone-50 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingOrders ? 'animate-spin' : ''}`} /> Refresh
                </button>
              </div>

              {/* 6 Payment & WhatsApp Metrics Strictly Computed from DB */}
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs">
                  <span className="text-[11px] font-semibold text-stone-500">Verified Payments</span>
                  <div className="text-2xl font-bold text-emerald-700 mt-1">
                    {paymentSummary?.totalVerifiedPayments ?? paidOrders.length}
                  </div>
                  <span className="text-[10px] text-stone-400">Confirmed PAID</span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs">
                  <span className="text-[11px] font-semibold text-stone-500">Verified Amount Received</span>
                  <div className="text-2xl font-bold text-[#143728] mt-1">
                    ₹{paymentSummary?.totalVerifiedAmount ?? totalRevenue}
                  </div>
                  <span className="text-[10px] text-stone-400">Paid orders only</span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs">
                  <span className="text-[11px] font-semibold text-stone-500">Pending Verification</span>
                  <div className="text-2xl font-bold text-amber-600 mt-1">
                    {paymentSummary?.pendingPayments ?? pendingUpiOrders.length}
                  </div>
                  <span className="text-[10px] text-stone-400">Awaiting review</span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs">
                  <span className="text-[11px] font-semibold text-stone-500">Rejected Payments</span>
                  <div className="text-2xl font-bold text-rose-600 mt-1">
                    {paymentSummary?.rejectedPayments ?? rejectedPaymentOrders.length}
                  </div>
                  <span className="text-[10px] text-stone-400">Declined / unmatched</span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs">
                  <span className="text-[11px] font-semibold text-stone-500">WhatsApp Sent</span>
                  <div className="text-2xl font-bold text-emerald-700 mt-1">
                    {paymentSummary?.whatsappSent ?? orders.filter((o) => (o.whatsappStatus || '').toLowerCase() === 'sent').length}
                  </div>
                  <span className="text-[10px] text-stone-400">API confirmed</span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs">
                  <span className="text-[11px] font-semibold text-stone-500">WA Failed / Queued</span>
                  <div className="text-2xl font-bold text-stone-800 mt-1">
                    {(paymentSummary?.whatsappFailed ?? 0) + (paymentSummary?.whatsappPending ?? 0)}
                  </div>
                  <button
                    type="button"
                    onClick={handleRetryAllWhatsApp}
                    disabled={retryingAllWa}
                    className="text-[10px] font-bold text-[#143728] hover:underline cursor-pointer"
                  >
                    {retryingAllWa ? 'Retrying...' : 'Retry Queued →'}
                  </button>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex flex-wrap gap-2">
                {(['all', 'pending', 'paid', 'rejected'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setPaymentFilter(tab)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      paymentFilter === tab
                        ? 'bg-[#143728] text-white border-[#143728]'
                        : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    {tab === 'all'
                      ? `All (${orders.length})`
                      : tab === 'pending'
                      ? `Pending (${pendingUpiOrders.length})`
                      : tab === 'paid'
                      ? `Verified Paid (${paidOrders.length})`
                      : `Rejected (${rejectedPaymentOrders.length})`}
                  </button>
                ))}
              </div>

              {/* Payment Verification Table */}
              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-stone-50 border-b border-stone-200 text-stone-600">
                      <tr>
                        <th className="p-3.5">Order ID & Time</th>
                        <th className="p-3.5">Customer & Phone</th>
                        <th className="p-3.5">Product & Qty</th>
                        <th className="p-3.5">Amount</th>
                        <th className="p-3.5">UTR & Payer Names</th>
                        <th className="p-3.5">Screenshot</th>
                        <th className="p-3.5">Payment & WA Status</th>
                        <th className="p-3.5">Verification Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {orders
                        .filter((o) => {
                          if (paymentFilter === 'pending') {
                            return o.paymentStatus === 'PAYMENT_PENDING' || o.paymentStatus === 'Pending';
                          }
                          if (paymentFilter === 'paid') {
                            return o.paymentStatus === 'PAID' || o.paymentStatus === 'Paid';
                          }
                          if (paymentFilter === 'rejected') {
                            return o.paymentStatus === 'REJECTED' || o.paymentStatus === 'Failed';
                          }
                          return true;
                        })
                        .map((o) => {
                          const isPaid = o.paymentStatus === 'PAID' || o.paymentStatus === 'Paid';
                          const isRejected = o.paymentStatus === 'REJECTED' || o.paymentStatus === 'Failed';
                          const isPending = !isPaid && !isRejected;
                          const waLower = (o.whatsappStatus || '').toLowerCase();

                          return (
                            <tr key={o.id} className="hover:bg-stone-50/70 align-top">
                              <td className="p-3.5 whitespace-nowrap">
                                <div className="font-bold text-stone-900">{o.orderNumber}</div>
                                <div className="text-[10px] text-stone-500 mt-0.5">
                                  {new Date(o.createdAt).toLocaleString('en-IN', {
                                    dateStyle: 'short',
                                    timeStyle: 'short',
                                  })}
                                </div>
                                <div className="text-[10px] text-stone-400 mt-0.5">{o.paymentMethod}</div>
                              </td>

                              <td className="p-3.5">
                                <div className="font-semibold text-stone-900">{o.customer.fullName}</div>
                                <div className="text-[11px] text-stone-600">
                                  {o.customer.fullPhone || `${o.customer.countryCode || '+91'} ${o.customer.phone}`}
                                </div>
                              </td>

                              <td className="p-3.5 max-w-[180px]">
                                {o.items.map((it, idx) => (
                                  <div key={idx} className="text-[11px] text-stone-700">
                                    {it.productName} ({it.weight}) × <strong>{it.quantity}</strong>
                                  </div>
                                ))}
                              </td>

                              <td className="p-3.5 whitespace-nowrap">
                                <div className="font-bold text-stone-900">₹{o.totalAmount}</div>
                                {isPaid && o.paymentDetails?.verifiedAmount !== undefined && (
                                  <div className="text-[10px] text-emerald-700 font-semibold">
                                    Verified: ₹{o.paymentDetails.verifiedAmount}
                                  </div>
                                )}
                              </td>

                              <td className="p-3.5">
                                <div className="font-mono text-[11px] font-bold text-stone-900">
                                  {o.paymentDetails?.utrNormalized || (
                                    <span className="font-sans font-normal text-stone-400 italic">No UTR submitted</span>
                                  )}
                                </div>
                                {o.paymentDetails?.submittedPayerName && (
                                  <div className="text-[10px] text-stone-600 mt-0.5">
                                    Cust. Payer: <strong>{o.paymentDetails.submittedPayerName}</strong>
                                  </div>
                                )}
                                {o.paymentDetails?.verifiedPayerName && (
                                  <div className="text-[10px] text-emerald-700 mt-0.5">
                                    Verified Payer: <strong>{o.paymentDetails.verifiedPayerName}</strong>
                                  </div>
                                )}
                              </td>

                              <td className="p-3.5">
                                {o.paymentDetails?.paymentScreenshotUrl ? (
                                  <button
                                    type="button"
                                    onClick={() => setScreenshotModalUrl(o.paymentDetails!.paymentScreenshotUrl!)}
                                    className="px-2 py-1 bg-stone-100 border border-stone-300 rounded-lg text-[10px] font-semibold text-stone-800 hover:bg-stone-200 cursor-pointer"
                                  >
                                    View Proof
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-stone-400">None</span>
                                )}
                              </td>

                              <td className="p-3.5 whitespace-nowrap space-y-1">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                    isPaid
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : isRejected
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {o.paymentStatus}
                                </span>
                                <div className="text-[10px] text-stone-500">Order: {o.orderStatus}</div>
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                      waLower === 'sent'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : waLower === 'failed'
                                        ? 'bg-rose-100 text-rose-800'
                                        : 'bg-stone-100 text-stone-600'
                                    }`}
                                  >
                                    WA: {o.whatsappStatus || 'Pending'}
                                  </span>
                                  {isPaid && waLower !== 'sent' && (
                                    <button
                                      type="button"
                                      onClick={() => handleRetryWhatsApp(o.id)}
                                      disabled={retryingWaOrderId === o.id}
                                      className="text-[10px] font-bold text-[#143728] underline cursor-pointer"
                                    >
                                      {retryingWaOrderId === o.id ? '...' : 'Retry WA'}
                                    </button>
                                  )}
                                </div>
                              </td>

                              <td className="p-3.5 whitespace-nowrap">
                                {isPending ? (
                                  <div className="flex flex-col gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setApproveModalOrder(o);
                                        setApproveUtrInput(o.paymentDetails?.utr || '');
                                        setApprovePayerName(o.paymentDetails?.submittedPayerName || '');
                                        setApproveNoteInput('');
                                      }}
                                      className="px-3 py-1.5 bg-emerald-700 text-white rounded-lg text-[11px] font-bold hover:bg-emerald-800 cursor-pointer"
                                    >
                                      APPROVE PAYMENT
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRejectModalOrder(o);
                                        setRejectReasonInput('');
                                      }}
                                      className="px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-[10px] font-bold hover:bg-rose-100 cursor-pointer"
                                    >
                                      REJECT PAYMENT
                                    </button>
                                  </div>
                                ) : isPaid ? (
                                  <div className="text-[10px] text-emerald-800 font-semibold">
                                    ✓ Verified by {o.paymentDetails?.verifiedBy || 'Admin'}
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-rose-700 max-w-[140px] whitespace-normal">
                                    ✕ {o.paymentDetails?.rejectionReason || 'Rejected'}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payment Decisions Audit Log */}
              <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-3">
                <h3 className="font-bold text-stone-900 text-sm">Payment Verification Audit Log</h3>
                {paymentAuditLogs.length === 0 ? (
                  <p className="text-xs text-stone-400">No verification audit entries recorded yet.</p>
                ) : (
                  <div className="divide-y divide-stone-100 max-h-64 overflow-y-auto text-xs">
                    {paymentAuditLogs.slice(0, 30).map((log) => (
                      <div key={log.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-bold text-stone-900">{log.orderNumber}</span>{' '}
                          <span className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-700 text-[10px] font-mono">
                            {log.action}
                          </span>
                          {log.utr && (
                            <span className="ml-2 text-[10px] font-mono text-stone-600">UTR: {log.utr}</span>
                          )}
                          <div className="text-[11px] text-stone-500 mt-0.5">
                            {log.note} • Actor: <strong>{log.actor}</strong>
                          </div>
                        </div>
                        <div className="text-[10px] text-stone-400 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString('en-IN')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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

                {/* n8n Production Webhook & Backup Outbox */}
                <div className="pt-3 border-t border-stone-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-xs text-stone-900">n8n Automated Production Backup</h4>
                      <p className="text-[11px] text-stone-500">
                        Dispatches durable, idempotent order events (`order.created`, `order.status_changed`) to your n8n workflow.
                      </p>
                    </div>
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${
                      webhookStats?.configured ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}>
                      {webhookStats?.configured ? '✓ Server Webhook Active' : '⚠ N8N_WEBHOOK_URL Not Set'}
                    </span>
                  </div>

                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-stone-600 font-medium">Server Environment:</span>
                      <span className="font-mono text-stone-800">{webhookStats?.webhookUrl || 'Checking...'}</span>
                    </div>

                    {webhookStats?.stats && (
                      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-stone-200 text-center text-[11px]">
                        <div className="bg-white p-2 rounded-lg border border-stone-200">
                          <div className="font-bold text-emerald-700">{webhookStats.stats.delivered}</div>
                          <div className="text-[10px] text-stone-400">Delivered</div>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-stone-200">
                          <div className="font-bold text-amber-700">{webhookStats.stats.pending}</div>
                          <div className="text-[10px] text-stone-400">Pending Retry</div>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-stone-200">
                          <div className="font-bold text-stone-700">{webhookStats.stats.total}</div>
                          <div className="text-[10px] text-stone-400">Total Events</div>
                        </div>
                      </div>
                    )}

                    <div className="pt-1 flex items-center justify-between">
                      <span className="text-[10px] text-stone-400">
                        Set <code>N8N_WEBHOOK_URL</code> in Vercel to activate automated backup.
                      </span>
                      <button
                        type="button"
                        onClick={handleRetryWebhooks}
                        disabled={retryingWebhooks}
                        className="px-3 py-1 bg-[#143728] text-white rounded-lg text-xs font-semibold hover:bg-[#204e37] transition-all cursor-pointer"
                      >
                        {retryingWebhooks ? 'Flushing...' : 'Flush Outbox'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Dynamic UPI Direct Payment Settings */}
                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-xs text-stone-900">UPI Direct Payment Configuration</h4>
                      <p className="text-[11px] text-stone-600">
                        Generates dynamic payment QR codes directly to your Google Pay / Bank UPI ID with zero payment gateway fees.
                      </p>
                    </div>
                    <span
                      className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${
                        config.upiId && config.upiId.includes('@')
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-300'
                      }`}
                    >
                      {config.upiId && config.upiId.includes('@')
                        ? '✓ UPI QR Active'
                        : '⚠ UPI ID Not Configured'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-stone-700 mb-1">
                        Merchant UPI ID (GPay / Bank VPA) *
                      </label>
                      <input
                        type="text"
                        value={config.upiId || ''}
                        onChange={(e) => setConfig({ ...config, upiId: e.target.value })}
                        placeholder="e.g. kavinashk008-1@oksbi"
                        className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-stone-700 mb-1">Merchant Display Name</label>
                      <input
                        type="text"
                        value={config.merchantName || 'KVN Tea Powder'}
                        onChange={(e) => setConfig({ ...config, merchantName: e.target.value })}
                        placeholder="KVN Tea Powder"
                        className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs"
                      />
                    </div>
                  </div>

                  {(!config.upiId || config.upiId.trim().toLowerCase() === 'kavinashk008-1@oksbi') && (
                    <div className="flex items-center gap-3 p-2.5 bg-white border border-amber-200 rounded-xl text-[11px]">
                      <img
                        src="/payments/kvn-gpay-qr.png"
                        alt="Kavinash K GPay QR"
                        className="w-14 h-16 object-contain rounded-lg border border-stone-200 shrink-0"
                      />
                      <div className="text-stone-700 space-y-0.5">
                        <div className="font-bold text-stone-900">Linked Official Google Pay QR Card</div>
                        <div>
                          Display Name: <strong>Kavinash K</strong> • VPA:{' '}
                          <span className="font-mono font-semibold">kavinashk008-1@oksbi</span>
                        </div>
                        <div className="text-stone-500">
                          Customers automatically receive both dynamic exact-amount UPI QR codes and this official GPay QR option.
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Official WhatsApp Business Cloud API Status & Outbox */}
                <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-xs text-stone-900">
                        WhatsApp Business Cloud API (Meta Graph)
                      </h4>
                      <p className="text-[11px] text-stone-500">
                        Sends automated order confirmations strictly after admin verifies a payment. Configure env variables in Vercel.
                      </p>
                    </div>
                    <span
                      className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${
                        whatsappDiag?.configured
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}
                    >
                      {whatsappDiag?.configured ? '✓ Cloud API Active' : '⚠ Pending Env Setup'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                    <div className="bg-white p-2 rounded-lg border border-stone-200">
                      <span className="text-stone-500 block">PHONE_NUMBER_ID</span>
                      <strong className={whatsappDiag?.hasPhoneNumberId ? 'text-emerald-700' : 'text-amber-700'}>
                        {whatsappDiag?.hasPhoneNumberId ? `Set (${whatsappDiag.phoneNumberIdMasked})` : 'Missing'}
                      </strong>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-stone-200">
                      <span className="text-stone-500 block">ACCESS_TOKEN</span>
                      <strong className={whatsappDiag?.hasAccessToken ? 'text-emerald-700' : 'text-amber-700'}>
                        {whatsappDiag?.hasAccessToken ? 'Configured ✓' : 'Missing'}
                      </strong>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-stone-200">
                      <span className="text-stone-500 block">WABA & TEMPLATE</span>
                      <strong className="text-stone-800 truncate block">
                        {whatsappDiag?.hasTemplateName ? whatsappDiag.templateName : 'Text Mode / Unset'}
                      </strong>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="text-stone-600">
                      Queue: <strong>{whatsappDiag?.outboxStats?.sent ?? 0} Sent</strong> •{' '}
                      <strong>{whatsappDiag?.outboxStats?.pending ?? 0} Pending</strong> •{' '}
                      <strong>{whatsappDiag?.outboxStats?.failed ?? 0} Failed</strong>
                    </span>
                    <button
                      type="button"
                      onClick={handleRetryAllWhatsApp}
                      disabled={retryingAllWa}
                      className="px-3 py-1 bg-[#143728] text-white rounded-lg text-xs font-semibold hover:bg-[#204e37] cursor-pointer"
                    >
                      {retryingAllWa ? 'Retrying...' : 'Retry Queued'}
                    </button>
                  </div>
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
                    type="button"
                    disabled={savingSettings}
                    onClick={handleSaveSettings}
                    className="w-full py-3 bg-[#143728] text-white font-bold rounded-xl hover:bg-[#204e37] transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {savingSettings ? 'Saving Settings to MongoDB...' : 'Save Business & UPI Configuration'}
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
          onSave={async (prodData) => {
            try {
              const token = localStorage.getItem('kvn_admin_token') || 'kavin008';
              let saved: Product;
              if (editingProduct && editingProduct.id) {
                saved = await api.adminUpdateProduct(token, editingProduct.id, prodData);
              } else {
                saved = await api.adminSaveProduct(token, prodData);
              }
              setProducts((prev) => {
                const idx = prev.findIndex((p) => p.id === saved.id);
                if (idx >= 0) {
                  const copy = [...prev];
                  copy[idx] = saved;
                  return copy;
                }
                return [saved, ...prev];
              });
              db.saveProduct(saved);
              window.dispatchEvent(new Event('kvn_products_updated'));
              setIsAddingProduct(false);
              setEditingProduct(null);
              showAdminToast(`Product "${saved.name}" successfully saved to MongoDB database!`);
            } catch (err: any) {
              console.error('Failed to save product:', err);
              showAdminToast(`Error saving product: ${err?.message || 'Database error'}`);
            }
          }}
        />
      )}

      {/* CREATE CATEGORY MODAL */}
      {newCatModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="font-bold text-stone-900 text-base">Add New Category</h3>
            <form
              onSubmit={async (e: any) => {
                e.preventDefault();
                const form = e.target;
                const catName = form.name.value;
                const slug = catName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                const newCat: any = {
                  id: `cat-${Date.now()}`,
                  name: catName,
                  slug: slug || `cat-${Date.now()}`,
                  mainCategory: form.mainCategory.value,
                  description: form.description.value,
                  createdAt: new Date().toISOString()
                };
                try {
                  const token = localStorage.getItem('kvn_admin_token') || 'kavin008';
                  await api.adminSaveCategory(token, newCat);
                  db.saveCategory(newCat);
                  setCategories((prev) => {
                    const filtered = prev.filter(c => c.id !== newCat.id);
                    return [...filtered, newCat];
                  });
                  setNewCatModalOpen(false);
                  showAdminToast('Category successfully saved to database!');
                } catch (err: any) {
                  console.error('Failed to save category:', err);
                  db.saveCategory(newCat);
                  setCategories((prev) => [...prev, newCat]);
                  setNewCatModalOpen(false);
                  showAdminToast('Category saved locally (backend sync pending)');
                }
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

      {/* ORDER DETAILS MODAL (Phase 7) */}
      {orderDetailModal && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setOrderDetailModal(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-stone-200 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div>
                <h3 className="font-bold text-stone-900 text-lg">
                  Order Details: {orderDetailModal.orderNumber}
                </h3>
                <p className="text-xs text-stone-500">
                  Placed on {new Date(orderDetailModal.createdAt).toLocaleString('en-IN')}
                </p>
              </div>
              <button
                onClick={() => setOrderDetailModal(null)}
                className="text-stone-400 hover:text-stone-700 font-bold text-sm p-1"
              >
                ✕
              </button>
            </div>

            {/* Customer & Address Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-stone-50 p-4 rounded-2xl border border-stone-200">
              <div>
                <div className="font-bold text-stone-700 uppercase tracking-wider text-[10px] mb-1">
                  Customer Information
                </div>
                <div className="font-semibold text-stone-900 text-sm">{orderDetailModal.customer.fullName}</div>
                <div className="text-stone-600 mt-0.5">📞 +91 {orderDetailModal.customer.phone}</div>
                {orderDetailModal.customer.email && (
                  <div className="text-stone-500">✉️ {orderDetailModal.customer.email}</div>
                )}
              </div>

              <div>
                <div className="font-bold text-stone-700 uppercase tracking-wider text-[10px] mb-1">
                  Delivery Destination
                </div>
                <div className="text-stone-800 leading-relaxed">
                  {orderDetailModal.customer.address}
                </div>
                <div className="text-stone-600 font-medium mt-0.5">
                  {orderDetailModal.customer.villageTown}, {orderDetailModal.customer.district || ''} - {orderDetailModal.customer.pincode}
                </div>
                {orderDetailModal.customer.landmark && (
                  <div className="text-stone-500 text-[11px] mt-0.5">
                    Landmark: {orderDetailModal.customer.landmark}
                  </div>
                )}
                {orderDetailModal.customer.coordinates && (
                  <a
                    href={`https://www.google.com/maps?q=${orderDetailModal.customer.coordinates.latitude},${orderDetailModal.customer.coordinates.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-[#143728] font-bold hover:underline mt-1 bg-white px-2 py-0.5 rounded border border-stone-200"
                  >
                    📍 View GPS on Google Maps
                  </a>
                )}
              </div>
            </div>

            {/* Ordered Products Table */}
            <div>
              <div className="font-bold text-stone-700 uppercase tracking-wider text-[10px] mb-2">
                Order Items ({orderDetailModal.items.length})
              </div>
              <div className="divide-y divide-stone-100 border border-stone-200 rounded-xl overflow-hidden text-xs">
                {orderDetailModal.items.map((item, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between bg-white">
                    <div>
                      <div className="font-semibold text-stone-900">{item.productName}</div>
                      <div className="text-stone-500 text-[11px]">Weight: {item.weight} • Qty: {item.quantity}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-stone-900">₹{item.unitPrice * item.quantity}</div>
                      <div className="text-stone-400 text-[10px]">₹{item.unitPrice} each</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200 text-xs space-y-1.5">
              <div className="flex justify-between text-stone-600">
                <span>Subtotal</span>
                <span>₹{orderDetailModal.subtotal}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Delivery Charge</span>
                <span>{orderDetailModal.deliveryCharge === 0 ? 'FREE' : `₹${orderDetailModal.deliveryCharge}`}</span>
              </div>
              <div className="flex justify-between font-bold text-stone-900 text-sm pt-1.5 border-t border-stone-200">
                <span>Total Amount</span>
                <span className="text-[#143728] text-base">₹{orderDetailModal.totalAmount}</span>
              </div>
              <div className="text-[11px] text-stone-500 pt-1">
                Payment: <strong>{orderDetailModal.paymentMethod}</strong> ({orderDetailModal.paymentStatus})
              </div>
            </div>

            {/* Change Status Control */}
            <div className="pt-2 border-t border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-stone-700">Update Status:</span>
                <select
                  value={orderDetailModal.orderStatus}
                  onChange={(e) => handleUpdateOrderStatus(orderDetailModal.id, e.target.value)}
                  className="bg-white border border-stone-300 text-xs rounded-xl px-3 py-1.5 font-bold text-stone-900 focus:outline-hidden"
                >
                  <option value="Pending">Pending</option>
                  <option value="Payment Pending">Payment Pending</option>
                  <option value="Order Confirmed">Order Confirmed</option>
                  <option value="Processing">Processing</option>
                  <option value="Dispatched">Dispatched</option>
                  <option value="Out for Delivery">Out for Delivery</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => setOrderDetailModal(null)}
                className="px-5 py-2 bg-[#143728] text-white rounded-xl text-xs font-bold hover:bg-[#204e37]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* APPROVE PAYMENT VERIFICATION MODAL */}
      {approveModalOrder && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !processingPaymentAction && setApproveModalOrder(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-stone-900">Verify & Approve Payment</h3>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950">
              Confirm you checked your actual <strong>Google Pay / Bank statement</strong> and received{' '}
              <strong>₹{approveModalOrder.totalAmount}</strong> for Order{' '}
              <strong>{approveModalOrder.orderNumber}</strong> before approving.
            </div>
            <form onSubmit={handleConfirmApprovePayment} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Verified Amount (Locked)</label>
                <input
                  type="text"
                  readOnly
                  value={`₹${approveModalOrder.totalAmount}`}
                  className="w-full px-3 py-2 bg-stone-100 border border-stone-200 rounded-xl font-bold text-stone-900"
                />
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  UPI Transaction ID / UTR *
                </label>
                <input
                  type="text"
                  required
                  value={approveUtrInput}
                  onChange={(e) => setApproveUtrInput(e.target.value)}
                  placeholder="Enter bank / GPay UTR reference"
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl font-mono uppercase"
                />
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Actual Payer Name (from your Google Pay / Bank record)
                </label>
                <input
                  type="text"
                  value={approvePayerName}
                  onChange={(e) => setApprovePayerName(e.target.value)}
                  placeholder="e.g. Payer name shown in GPay credit alert"
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Admin Verification Note (Optional)</label>
                <input
                  type="text"
                  value={approveNoteInput}
                  onChange={(e) => setApproveNoteInput(e.target.value)}
                  placeholder="e.g. Verified in KVB GPay statement"
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={processingPaymentAction}
                  onClick={() => setApproveModalOrder(null)}
                  className="px-4 py-2 border border-stone-300 rounded-xl text-stone-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingPaymentAction}
                  className="px-5 py-2 bg-emerald-700 text-white rounded-xl font-bold hover:bg-emerald-800 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {processingPaymentAction ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Approving & Sending WhatsApp...
                    </>
                  ) : (
                    'APPROVE PAYMENT ✓'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REJECT PAYMENT MODAL */}
      {rejectModalOrder && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !processingPaymentAction && setRejectModalOrder(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-rose-900">Reject Payment ({rejectModalOrder.orderNumber})</h3>
            <form onSubmit={handleConfirmRejectPayment} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Rejection Reason *</label>
                <textarea
                  rows={3}
                  required
                  value={rejectReasonInput}
                  onChange={(e) => setRejectReasonInput(e.target.value)}
                  placeholder="e.g. Transaction ID not found in Google Pay history / Amount mismatch"
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={processingPaymentAction}
                  onClick={() => setRejectModalOrder(null)}
                  className="px-4 py-2 border border-stone-300 rounded-xl text-stone-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingPaymentAction}
                  className="px-5 py-2 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 cursor-pointer"
                >
                  {processingPaymentAction ? 'Processing...' : 'CONFIRM REJECT'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PAYMENT SCREENSHOT LIGHTBOX MODAL */}
      {screenshotModalUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setScreenshotModalUrl(null)}
        >
          <div className="bg-white rounded-2xl p-3 max-w-lg w-full space-y-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center text-xs font-bold text-stone-800 px-1">
              <span>Customer Submitted Payment Screenshot</span>
              <button
                type="button"
                onClick={() => setScreenshotModalUrl(null)}
                className="text-stone-500 hover:text-stone-900 px-2 py-0.5 cursor-pointer"
              >
                ✕ Close
              </button>
            </div>
            <img src={screenshotModalUrl} alt="Payment proof" className="w-full max-h-[75vh] object-contain rounded-xl" />
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

// Helper to compress local images if Cloudinary credentials are not configured yet (<30KB)
function compressImageFile(file: File, maxDimension = 500, quality = 0.6): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.createElement('img');
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

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

  // Image Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Weight variants
  const [variants, setVariants] = useState<any[]>(
    product?.variants && product.variants.length > 0
      ? product.variants
      : [
          { id: 'v1', weight: '250g', mrp: 140, sellingPrice: 120, stock: 30 },
          { id: 'v2', weight: '500g', mrp: 270, sellingPrice: 230, stock: 20 },
        ]
  );

  // Direct Cloudinary Upload handler (with client-side optimization fallback)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadStatus('Checking Cloudinary storage...');
    setUploadError(null);

    try {
      const token = localStorage.getItem('kvn_admin_token') || 'kavin008';
      const signData = await api.getCloudinarySignature(token);

      if (signData.configured && signData.cloudName && signData.apiKey && signData.signature && signData.timestamp && signData.folder) {
        const uploadedUrls: string[] = [];

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setUploadStatus(`Uploading image ${i + 1} of ${files.length} to Cloudinary...`);
          const cloudRes = await api.uploadToCloudinary(file, {
            cloudName: signData.cloudName,
            apiKey: signData.apiKey,
            timestamp: signData.timestamp,
            folder: signData.folder,
            signature: signData.signature,
          });
          if (cloudRes.secure_url) {
            uploadedUrls.push(cloudRes.secure_url);
          }
        }

        setImages((prev) => [...uploadedUrls, ...prev]);
        setUploadStatus('');
      } else {
        setUploadStatus(`Optimizing ${files.length} image(s)...`);
        const localCompressed: string[] = [];
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const compressed = await compressImageFile(file, 500, 0.6);
          localCompressed.push(compressed);
        }
        setImages((prev) => [...localCompressed, ...prev]);
        setUploadStatus('');
        setUploadError(
          'Cloudinary is not configured in Vercel. Image was compressed (<30KB) to prevent payload limits. For full-resolution CDN hosting, set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in Vercel.'
        );
      }
    } catch (err: any) {
      console.error('Image upload failed:', err);
      setUploadError(err.message || 'Image upload failed. You can paste an image URL directly instead.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
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
              <label className={`w-20 h-20 border-2 border-dashed border-stone-300 hover:border-[#2e5e43] rounded-xl flex flex-col items-center justify-center cursor-pointer text-stone-500 hover:text-[#2e5e43] transition-colors ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                {isUploading ? (
                  <Loader2 className="w-5 h-5 mb-1 animate-spin text-[#2e5e43]" />
                ) : (
                  <Upload className="w-5 h-5 mb-1" />
                )}
                <span className="text-[10px] font-semibold">{isUploading ? 'Uploading...' : 'Upload'}</span>
                <input type="file" accept="image/*" multiple onChange={handleFileUpload} className="hidden" disabled={isUploading} />
              </label>
            </div>

            {/* Upload progress indicator */}
            {isUploading && (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600 shrink-0" />
                <span>{uploadStatus || 'Uploading image(s)...'}</span>
              </div>
            )}

            {/* Storage configuration / Notice banner */}
            {uploadError && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Image Storage Notice</span>
                </div>
                <div className="leading-relaxed">{uploadError}</div>
              </div>
            )}

            {/* URL alternative */}
            <div className="flex gap-2 pt-1">
              <input
                type="url"
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                placeholder="Or paste image URL (Cloudinary, Unsplash, etc.)"
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
