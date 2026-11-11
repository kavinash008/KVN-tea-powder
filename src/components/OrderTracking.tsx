import React, { useEffect, useState, useCallback } from 'react';
import { db } from '../lib/db';
import { api } from '../lib/api';
import { Order, OrderStatus } from '../types';
import { Search, CheckCircle2, AlertCircle, ArrowLeft, RefreshCw, Loader2 } from 'lucide-react';
import { UpiPaymentPanel } from './UpiPaymentPanel';

interface OrderTrackingProps {
  initialOrderId?: string;
  onBack: () => void;
}

interface TimelineStep {
  key: string;
  label: string;
  matchStatuses: OrderStatus[];
  requiresPaid?: boolean;
}

const TIMELINE_STEPS: TimelineStep[] = [
  {
    key: 'placed',
    label: 'Order Created',
    matchStatuses: [
      'Pending',
      'Payment Pending',
      'Payment Confirmed',
      'Order Confirmed',
      'CONFIRMED',
      'Processing',
      'Packing',
      'Dispatched',
      'Out for Delivery',
      'Delivered',
    ],
  },
  {
    key: 'payment',
    label: 'Payment Verified ✓',
    matchStatuses: ['Payment Confirmed', 'Order Confirmed', 'CONFIRMED', 'Processing', 'Packing', 'Dispatched', 'Out for Delivery', 'Delivered'],
    requiresPaid: true,
  },
  {
    key: 'confirmed',
    label: 'Order Confirmed ✓',
    matchStatuses: ['Order Confirmed', 'CONFIRMED', 'Processing', 'Packing', 'Dispatched', 'Out for Delivery', 'Delivered'],
  },
  {
    key: 'packing',
    label: 'Fresh Batch Packing',
    matchStatuses: ['Processing', 'Packing', 'Dispatched', 'Out for Delivery', 'Delivered'],
  },
  {
    key: 'dispatch',
    label: 'Out for Delivery',
    matchStatuses: ['Dispatched', 'Out for Delivery', 'Delivered'],
  },
  {
    key: 'delivered',
    label: 'Delivered to Doorstep',
    matchStatuses: ['Delivered'],
  },
];

export const OrderTracking: React.FC<OrderTrackingProps> = ({ initialOrderId, onBack }) => {
  const [searchInput, setSearchInput] = useState(initialOrderId || '');
  const [currentOrder, setCurrentOrder] = useState<Order | undefined>(() => {
    if (initialOrderId) {
      return db.getOrderById(initialOrderId);
    }
    return undefined;
  });
  const [searched, setSearched] = useState(Boolean(initialOrderId));
  const [loading, setLoading] = useState(Boolean(initialOrderId));
  const [lastSyncedAt, setLastSyncedAt] = useState<string>('');

  const fetchOrderLive = useCallback(async (orderIdOrNumber: string) => {
    const target = orderIdOrNumber.trim();
    if (!target) return;
    try {
      const serverOrder = await api.getOrder(target);
      setCurrentOrder(serverOrder);
      setLastSyncedAt(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch {
      const localOrder = db.getOrderById(target);
      if (localOrder) {
        setCurrentOrder(localOrder);
      } else {
        setCurrentOrder(undefined);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialOrderId) {
      setSearchInput(initialOrderId);
      setSearched(true);
      setLoading(true);
      fetchOrderLive(initialOrderId);
    }
  }, [initialOrderId, fetchOrderLive]);

  // Automatic 5s live polling when tracking an active / pending-verification order
  useEffect(() => {
    if (!currentOrder) return;
    const isTerminal =
      currentOrder.orderStatus === 'Delivered' ||
      (currentOrder.orderStatus === 'Cancelled' && currentOrder.paymentStatus !== 'PAYMENT_PENDING');

    if (isTerminal) return;

    const timer = setInterval(() => {
      fetchOrderLive(currentOrder.id || currentOrder.orderNumber);
    }, 5000);
    const onFocus = () => fetchOrderLive(currentOrder.id || currentOrder.orderNumber);
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [currentOrder?.id, currentOrder?.orderNumber, currentOrder?.orderStatus, currentOrder?.paymentStatus, fetchOrderLive]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    setSearched(true);
    setLoading(true);
    window.location.hash = `track=${encodeURIComponent(searchInput.trim())}`;
    await fetchOrderLive(searchInput.trim());
  };

  const getStepState = (step: TimelineStep, order: Order): 'completed' | 'pending' | 'cancelled' => {
    if (order.orderStatus === 'Cancelled' || order.paymentStatus === 'REJECTED') {
      if (step.key === 'placed') return 'completed';
      return 'cancelled';
    }
    const isPaid = order.paymentStatus === 'PAID' || order.paymentStatus === 'Paid';
    if (step.requiresPaid) {
      if (order.paymentMethod === 'COD') {
        return isPaid ? 'completed' : 'pending';
      }
      return isPaid ? 'completed' : 'pending';
    }
    if (step.matchStatuses.includes(order.orderStatus)) {
      return 'completed';
    }
    return 'pending';
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12 animate-in fade-in duration-200 space-y-6">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-[#143728] cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Store
      </button>

      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-xs">
        <h2 className="text-xl font-bold text-stone-900 mb-1">Live Order & Payment Tracking</h2>
        <p className="text-xs text-stone-500 mb-6">
          Track payment verification, order confirmation, packaging, and dispatch updates in real time.
        </p>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Enter Order ID (e.g. KVN-ORD-20261111-001)"
              className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 bg-[#143728] text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-[#204e37] transition-all cursor-pointer"
          >
            {loading ? 'Checking...' : 'Track'}
          </button>
        </form>
      </div>

      {loading && (
        <div className="bg-white rounded-2xl p-8 border border-stone-200 text-center text-xs text-stone-500 flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-[#143728]" /> Fetching live order details...
        </div>
      )}

      {!loading && searched && !currentOrder && (
        <div className="bg-white rounded-2xl p-8 border border-stone-200 text-center">
          <AlertCircle className="w-10 h-10 text-stone-400 mx-auto mb-2" />
          <h3 className="font-semibold text-stone-800 text-sm">No Order Found</h3>
          <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
            Please verify your Order ID (e.g. KVN-ORD-...), or reach out to Kavinash on WhatsApp at 6383050287 / 9787513911.
          </p>
        </div>
      )}

      {!loading && currentOrder && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-sm space-y-6">
          {/* Top header status */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-200">
            <div>
              <span className="text-xs text-stone-500">Order Reference:</span>
              <h3 className="font-bold text-stone-900 text-lg">{currentOrder.orderNumber}</h3>
              {lastSyncedAt && (
                <div className="text-[10px] text-stone-400 flex items-center gap-1 mt-0.5">
                  <RefreshCw className="w-3 h-3 text-emerald-700" />
                  Auto-sync active • Updated {lastSyncedAt}
                </div>
              )}
            </div>
            <div className="text-right space-y-1">
              <span className="text-xs text-stone-500 block">Order Status:</span>
              <span
                className={`inline-block font-semibold text-xs px-3 py-1 rounded-full ${
                  currentOrder.paymentStatus === 'PAID' || currentOrder.paymentStatus === 'Paid'
                    ? 'bg-emerald-100 text-[#143728]'
                    : currentOrder.paymentStatus === 'REJECTED' || currentOrder.orderStatus === 'Cancelled'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-amber-100 text-amber-900'
                }`}
              >
                {currentOrder.orderStatus}
              </span>
            </div>
          </div>

          {/* Live Payment Status / UPI QR / UTR Submission */}
          <UpiPaymentPanel order={currentOrder} onOrderUpdated={setCurrentOrder} />

          {/* Visual Timeline */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 mb-6">
              Order & Verification Timeline
            </h4>
            <div className="relative pl-6 sm:pl-8 space-y-7 before:absolute before:left-2 sm:before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-stone-200">
              {TIMELINE_STEPS.map((step) => {
                const statusState = getStepState(step, currentOrder);
                const historyEntry = currentOrder.statusHistory.find((h) =>
                  step.matchStatuses.includes(h.status)
                );

                return (
                  <div key={step.key} className="relative">
                    <div
                      className={`absolute -left-6 sm:-left-8 top-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 transition-all ${
                        statusState === 'completed'
                          ? 'border-[#2e5e43] text-white bg-[#2e5e43]'
                          : statusState === 'cancelled'
                          ? 'border-rose-300 bg-rose-50 text-transparent'
                          : 'border-stone-300 bg-white text-transparent'
                      }`}
                    >
                      {statusState === 'completed' && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </div>

                    <div>
                      <h5
                        className={`text-xs sm:text-sm font-semibold ${
                          statusState === 'completed' ? 'text-stone-900' : 'text-stone-400'
                        }`}
                      >
                        {step.label}
                      </h5>
                      {statusState === 'completed' && historyEntry ? (
                        <p className="text-[11px] text-stone-500 mt-0.5">
                          {new Date(historyEntry.timestamp).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                          {historyEntry.note && ` • ${historyEntry.note}`}
                        </p>
                      ) : (
                        <p className="text-[11px] text-stone-400 mt-0.5">
                          {statusState === 'cancelled' ? 'Stopped / Rejected' : 'Pending completion'}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Order Details */}
          <div className="pt-4 border-t border-stone-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-stone-600">
            <div>
              <span className="font-semibold text-stone-800 block mb-1">Destination Address:</span>
              <p>{currentOrder.customer.fullName}</p>
              <p>
                {currentOrder.customer.address}, {currentOrder.customer.villageTown}
              </p>
              <p>
                {currentOrder.customer.district} - {currentOrder.customer.pincode}
              </p>
              <p className="mt-1">
                Phone: {currentOrder.customer.fullPhone || `${currentOrder.customer.countryCode || '+91'} ${currentOrder.customer.phone}`}
              </p>
            </div>
            <div>
              <span className="font-semibold text-stone-800 block mb-1">Order Items:</span>
              {currentOrder.items.map((it) => (
                <div key={it.variantId} className="flex justify-between py-0.5">
                  <span>
                    {it.productName} ({it.weight}) × {it.quantity}
                  </span>
                  <span className="font-medium text-stone-900">₹{it.unitPrice * it.quantity}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-stone-200 mt-2 flex justify-between font-bold text-stone-900">
                <span>Total Amount ({currentOrder.paymentMethod})</span>
                <span>₹{currentOrder.totalAmount}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
