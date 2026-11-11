import React, { useEffect, useState } from 'react';
import { Order } from '../types';
import { CheckCircle2, Package, MapPin, MessageSquare, ArrowRight, Clock, RefreshCw, XCircle } from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { api } from '../lib/api';
import { UpiPaymentPanel } from './UpiPaymentPanel';

interface OrderConfirmationProps {
  order: Order;
  onContinueShopping: () => void;
  onTrackOrder: (orderId: string) => void;
}

export const OrderConfirmation: React.FC<OrderConfirmationProps> = ({
  order,
  onContinueShopping,
  onTrackOrder,
}) => {
  const { config } = useShop();
  const [liveOrder, setLiveOrder] = useState<Order>(order);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>('');

  useEffect(() => {
    setLiveOrder(order);
  }, [order]);

  // Live automatic polling every 5s so admin payment approval updates screen without refresh
  useEffect(() => {
    let active = true;
    const syncOrder = async () => {
      try {
        const fresh = await api.getOrder(liveOrder.id || liveOrder.orderNumber);
        if (active && fresh) {
          setLiveOrder(fresh);
          setLastSyncedAt(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        }
      } catch {
        // ignore transient polling error
      }
    };

    const shouldPoll =
      liveOrder.paymentStatus === 'PAYMENT_PENDING' ||
      liveOrder.paymentStatus === 'Pending' ||
      (liveOrder.orderStatus !== 'Delivered' && liveOrder.orderStatus !== 'Cancelled');

    if (!shouldPoll) return;

    syncOrder();
    const timer = setInterval(syncOrder, 5000);
    window.addEventListener('focus', syncOrder);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('focus', syncOrder);
    };
  }, [liveOrder.id, liveOrder.orderNumber, liveOrder.paymentStatus, liveOrder.orderStatus]);

  const isPaid = liveOrder.paymentStatus === 'PAID' || liveOrder.paymentStatus === 'Paid';
  const isRejected = liveOrder.paymentStatus === 'REJECTED' || liveOrder.paymentStatus === 'Failed';
  const isUpiPending = liveOrder.paymentMethod === 'ONLINE_UPI' && !isPaid && !isRejected;

  const whatsappMsg = encodeURIComponent(
    `Hello KVN TEAPOWDER, my order reference is ${liveOrder.orderNumber} (₹${liveOrder.totalAmount}). Please share an update.`
  );
  const whatsappUrl = `https://wa.me/91${config.primaryPhone || '6383050287'}?text=${whatsappMsg}`;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 sm:py-14 animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl p-6 sm:p-10 border border-stone-200/80 shadow-lg text-center space-y-6">
        {/* Top Status Header */}
        <div>
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border ${
              isRejected
                ? 'bg-rose-50 text-rose-600 border-rose-200'
                : isUpiPending
                ? 'bg-amber-50 text-amber-600 border-amber-200'
                : 'bg-emerald-50 text-emerald-600 border-emerald-200'
            }`}
          >
            {isRejected ? (
              <XCircle className="w-9 h-9" />
            ) : isUpiPending ? (
              <Clock className="w-9 h-9" />
            ) : (
              <CheckCircle2 className="w-9 h-9" />
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 mb-2">
            {isRejected
              ? 'Payment Verification Declined'
              : isUpiPending
              ? liveOrder.paymentDetails?.utr
                ? 'Payment Submitted — Verifying'
                : 'Complete UPI Payment to Confirm'
              : 'Order Confirmed!'}
          </h1>

          <p className="text-sm text-stone-600 max-w-lg mx-auto">
            {isRejected
              ? 'Your submitted transaction reference could not be matched. Please check details below or reach out to support.'
              : isUpiPending
              ? liveOrder.paymentDetails?.utr
                ? 'We have received your UPI transaction ID. This page updates automatically as soon as your payment is verified.'
                : 'Your order reference is reserved. Scan the UPI QR code or open your UPI app below, then submit your Transaction ID / UTR.'
              : 'Thank you for ordering with KVN TEAPOWDER. Your order is confirmed and fresh batch packing will begin shortly.'}
          </p>

          {lastSyncedAt && (
            <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-stone-100 text-[11px] text-stone-500 font-medium">
              <RefreshCw className="w-3 h-3 text-emerald-700" />
              Live synced at {lastSyncedAt}
            </div>
          )}
        </div>

        {/* Dynamic UPI Payment QR & Live Verification Panel */}
        <UpiPaymentPanel order={liveOrder} onOrderUpdated={setLiveOrder} />

        {/* Order Details Summary Card */}
        <div className="bg-stone-50 rounded-2xl p-5 text-left border border-stone-200/70 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-200 text-xs">
            <div>
              <span className="text-stone-500">Order ID:</span>
              <span className="font-bold text-stone-900 ml-1 text-sm">{liveOrder.orderNumber}</span>
            </div>
            <div>
              <span className="text-stone-500">Placed On:</span>
              <span className="font-medium text-stone-800 ml-1">
                {new Date(liveOrder.createdAt).toLocaleString('en-IN', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
            </div>
            <div>
              <span className="text-stone-500">Order Status:</span>
              <span
                className={`font-semibold px-2.5 py-0.5 rounded-full ml-1 ${
                  isPaid
                    ? 'bg-emerald-100 text-[#143728]'
                    : isRejected
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-amber-100 text-amber-900'
                }`}
              >
                {liveOrder.orderStatus}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-stone-600">
            <div>
              <h4 className="font-bold text-stone-800 uppercase tracking-wider mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#2e5e43]" /> Delivery Address
              </h4>
              <p className="font-medium text-stone-900">{liveOrder.customer.fullName}</p>
              <p>{liveOrder.customer.address}</p>
              <p>
                {liveOrder.customer.villageTown}, {liveOrder.customer.district} - {liveOrder.customer.pincode}
              </p>
              <p className="mt-1 font-medium text-stone-800">
                Mobile: {liveOrder.customer.fullPhone || `${liveOrder.customer.countryCode || '+91'} ${liveOrder.customer.phone}`}
              </p>
            </div>

            <div>
              <h4 className="font-bold text-stone-800 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Package className="w-3.5 h-3.5 text-[#2e5e43]" /> Payment & Notifications
              </h4>
              <p>
                Payment Method: <strong className="text-stone-900">{liveOrder.paymentMethod}</strong>
              </p>
              <p>
                Payment Status:{' '}
                <strong
                  className={
                    isPaid ? 'text-emerald-700' : isRejected ? 'text-rose-700' : 'text-amber-700'
                  }
                >
                  {liveOrder.paymentStatus}
                </strong>
              </p>
              <p className="mt-1 text-stone-500">
                WhatsApp Alert: {liveOrder.whatsappConsent === false ? 'Not enabled' : liveOrder.whatsappStatus || 'Pending'}
              </p>
            </div>
          </div>

          {/* Purchased Items */}
          <div className="pt-2 border-t border-stone-200">
            <h4 className="font-bold text-stone-800 text-xs mb-2">Purchased Items:</h4>
            <div className="divide-y divide-stone-200/50">
              {liveOrder.items.map((item) => (
                <div key={item.variantId} className="py-1.5 flex justify-between text-xs">
                  <span>
                    {item.productName} ({item.weight}) × {item.quantity}
                  </span>
                  <span className="font-semibold text-stone-900">₹{item.unitPrice * item.quantity}</span>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-between font-bold text-sm text-stone-900 border-t border-stone-200 mt-2">
              <span>Total Amount</span>
              <span className="text-[#143728]">₹{liveOrder.totalAmount}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => onTrackOrder(liveOrder.orderNumber || liveOrder.id)}
            className="w-full sm:w-auto px-6 py-3 bg-[#143728] text-white text-xs font-semibold rounded-xl hover:bg-[#204e37] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Clock className="w-4 h-4" /> Open Live Order Tracker
          </button>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-6 py-3 bg-[#25D366] text-white text-xs font-semibold rounded-xl hover:bg-[#20ba59] transition-all flex items-center justify-center gap-1.5"
          >
            <MessageSquare className="w-4 h-4" /> Message Support on WhatsApp
          </a>

          <button
            onClick={onContinueShopping}
            className="w-full sm:w-auto px-6 py-3 border border-stone-300 text-stone-700 text-xs font-semibold rounded-xl hover:bg-stone-50 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            Continue Shopping <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
