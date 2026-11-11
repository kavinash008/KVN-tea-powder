export interface WeightVariant {
  id: string;
  weight: string; // e.g. '100g', '250g', '500g', '1kg'
  mrp: number;
  sellingPrice: number;
  stock: number;
}

export type MainCategory = 'tea' | 'coffee' | 'combo' | 'grocery';

export interface Category {
  id: string;
  name: string;
  slug: string;
  mainCategory: MainCategory;
  description?: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  slug: string;
  categorySlug: string;
  mainCategory: MainCategory;
  brand: string;
  description: string;
  brewingInstructions?: string;
  ingredients?: string;
  images: string[];
  variants: WeightVariant[];
  isFeatured: boolean;
  isBestSeller: boolean;
  isNewArrival: boolean;
  status: 'published' | 'draft' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  productId: string;
  productName: string;
  productImage: string;
  category: string;
  variantId: string;
  weight: string;
  unitPrice: number;
  mrp: number;
  quantity: number;
}

export interface DeliveryArea {
  id: string;
  villageTown: string;
  district: string;
  state: string;
  pincode: string;
  deliveryCharge: number;
  estimatedTime: string;
  isAvailable: boolean;
}

export interface Coupon {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed' | 'free_shipping';
  discountValue: number;
  minOrderAmount: number;
  maxDiscount?: number;
  validFrom: string;
  validUntil: string;
  usageLimit: number;
  usedCount: number;
  isActive: boolean;
}

export type OrderStatus = 
  | 'Pending'
  | 'Payment Pending'
  | 'Payment Confirmed'
  | 'CONFIRMED'
  | 'Order Confirmed'
  | 'Processing'
  | 'Packing'
  | 'Dispatched'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Cancelled';

export type PaymentStatus =
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'REJECTED'
  | 'Pending'
  | 'Paid'
  | 'Failed'
  | 'Refunded';

export interface UpiPaymentInfo {
  configured: boolean;
  upiId?: string;
  merchantName: string;
  transactionRef: string;
  transactionNote: string;
  amount: number;
  currency: 'INR';
  upiUri?: string;
  warning?: string;
}

export interface PaymentDetails {
  utr?: string;
  utrNormalized?: string;
  submittedPayerName?: string;
  verifiedPayerName?: string;
  paymentScreenshotUrl?: string;
  paymentSubmittedAt?: string;
  verifiedAmount?: number;
  verifiedAt?: string;
  verifiedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
}

export interface PaymentAuditEntry {
  id: string;
  orderId: string;
  orderNumber: string;
  action:
    | 'ORDER_CREATED'
    | 'UTR_SUBMITTED'
    | 'PAYMENT_APPROVED'
    | 'PAYMENT_REJECTED'
    | 'WHATSAPP_SENT'
    | 'WHATSAPP_FAILED';
  actor: string;
  previousPaymentStatus?: string;
  newPaymentStatus?: string;
  utr?: string;
  amount?: number;
  note?: string;
  timestamp: string;
}

export interface OrderStatusHistory {
  status: OrderStatus;
  timestamp: string;
  note?: string;
}

export interface CustomerAddress {
  id: string;
  label: 'Home' | 'Work' | 'Other';
  recipientName: string;
  phone: string;
  addressLine: string;
  landmark?: string;
  villageTown: string;
  district: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  createdAt?: string;
}

export interface CustomerUser {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  authProvider?: 'password' | 'google' | 'phone' | 'email';
  firebaseUid?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  role?: 'customer' | 'admin';
  addresses: CustomerAddress[];
  createdAt: string;
  updatedAt?: string;
}

export interface OrderCustomer {
  fullName: string;
  countryCode?: string;
  phone: string;
  fullPhone?: string;
  email: string;
  address: string;
  villageTown: string;
  district: string;
  state: string;
  pincode: string;
  deliveryInstructions?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId?: string;
  customer: OrderCustomer;
  addressSnapshot?: CustomerAddress;
  items: CartItem[];
  subtotal: number;
  deliveryCharge: number;
  discountAmount: number;
  couponCode?: string;
  totalAmount: number;
  paymentMethod: 'COD' | 'ONLINE_UPI';
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  statusHistory: OrderStatusHistory[];
  stockDeducted?: boolean;
  stockDeductedAt?: string;
  whatsappConsent?: boolean;
  whatsappStatus?: 'Pending' | 'Sent' | 'Failed' | 'pending' | 'sent' | 'failed' | 'not_configured' | 'opted_out';
  whatsappMessageId?: string;
  whatsappSentAt?: string;
  whatsappError?: string;
  upiPaymentInfo?: UpiPaymentInfo;
  paymentDetails?: PaymentDetails;
  paymentAuditLog?: PaymentAuditEntry[];
  excelSyncStatus?: 'pending' | 'synced' | 'failed' | 'not_configured';
  excelSyncAt?: string;
  excelError?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Feedback {
  id: string;
  customerName: string;
  email?: string;
  phone: string;
  orderId?: string;
  productId?: string;
  productName?: string;
  rating: number; // 1 to 5
  message: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  createdAt: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  createdAt: string;
  isRead: boolean;
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  buttonText: string;
  linkUrl: string;
  isActive: boolean;
  order: number;
}

export interface BusinessConfig {
  name: string;
  owner: string;
  primaryPhone: string;
  secondaryPhone: string;
  email: string;
  defaultDeliveryCharge: number;
  freeDeliveryThreshold: number;
  fssaiNumber?: string;
  gstNumber?: string;
  upiId?: string;
  merchantName?: string;
  upiConfigured?: boolean;
  googleOAuthConnected?: boolean;
  sheetsSpreadsheetId?: string;
  driveFolderId?: string;
  n8nWebhookUrl?: string;
}
