import React, { useState } from 'react';
import { db } from '../lib/db';
import { Order, OrderStatus } from '../types';
import { Search, CheckCircle2, Clock, Package, Truck, AlertCircle, ArrowLeft } from 'lucide-react';

interface OrderTrackingProps {
  initialOrderId?: string;
  onBack: () => void;
}

const TIMELINE_STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'Order Confirmed', label: 'Order Placed' },
  { status: 'Payment Confirmed', label: 'Payment Confirmed' },
  { status: 'Packing', label: 'Fresh Batch Packing' },
  { status: 'Out for Delivery', label: 'Out for Delivery' },
  { status: 'Delivered', label: 'Delivered to Doorstep' },
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    const found = db.getOrderById(searchInput.trim());
    setCurrentOrder(found);
    setSearched(true);
  };

  const getStepStatus = (stepStatus: OrderStatus, order: Order) => {
    if (order.orderStatus === 'Cancelled') {
      return 'cancelled';
    }

    const orderStatusOrder: OrderStatus[] = [
      'Pending',
      'Payment Pending',
      'Order Confirmed',
      'Payment Confirmed',
      'Packing',
      'Out for Delivery',
      'Delivered',
    ];

    const currentIdx = orderStatusOrder.indexOf(order.orderStatus);
    const stepIdx = orderStatusOrder.indexOf(stepStatus);

    if (currentIdx >= stepIdx) {
      return 'completed';
    }
    return 'pending';
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12 animate-in fade-in duration-200">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-[#143728] mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Store
      </button>

      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-xs mb-8">
        <h2 className="text-xl font-bold text-stone-900 mb-1">Live Order Tracking</h2>
        <p className="text-xs text-stone-500 mb-6">
          Track real-time packaging, dispatch and delivery milestones for your tea or coffee order.
        </p>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Enter Order ID (e.g. KVN-2026-0001)"
              className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-[#143728] text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-[#204e37] transition-all"
          >
            Track
          </button>
        </form>
      </div>

      {searched && !currentOrder && (
        <div className="bg-white rounded-2xl p-8 border border-stone-200 text-center">
          <AlertCircle className="w-10 h-10 text-stone-400 mx-auto mb-2" />
          <h3 className="font-semibold text-stone-800 text-sm">No Order Found</h3>
          <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
            Please check the Order ID or phone number, or reach out to Kavinash on WhatsApp at 6383050287 / 9787513911.
          </p>
        </div>
      )}

      {currentOrder && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-sm space-y-6">
          {/* Top header status */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-200">
            <div>
              <span className="text-xs text-stone-500">Order Reference:</span>
              <h3 className="font-bold text-stone-900 text-lg">{currentOrder.orderNumber}</h3>
            </div>
            <div className="text-right">
              <span className="text-xs text-stone-500 block">Current Status:</span>
              <span className="inline-block font-semibold text-xs px-3 py-1 bg-emerald-100/70 text-[#143728] rounded-full">
                {currentOrder.orderStatus}
              </span>
            </div>
          </div>

          {/* Visual Timeline */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 mb-6">
              Delivery Timeline
            </h4>
            <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-2 sm:before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-stone-200">
              {TIMELINE_STEPS.map((step, idx) => {
                const statusState = getStepStatus(step.status, currentOrder);
                const historyEntry = currentOrder.statusHistory.find((h) => h.status === step.status);

                return (
                  <div key={idx} className="relative">
                    {/* Bullet marker */}
                    <div
                      className={`absolute -left-6 sm:-left-8 top-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 bg-white transition-all ${
                        statusState === 'completed'
                          ? 'border-[#2e5e43] text-white bg-[#2e5e43]'
                          : 'border-stone-300 text-transparent'
                      }`}
                    >
                      {statusState === 'completed' && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </div>

                    <div>
                      <h5 className={`text-xs sm:text-sm font-semibold ${
                        statusState === 'completed' ? 'text-stone-900' : 'text-stone-400'
                      }`}>
                        {step.label}
                      </h5>
                      {historyEntry ? (
                        <p className="text-[11px] text-stone-500 mt-0.5">
                          {new Date(historyEntry.timestamp).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                          {historyEntry.note && ` • ${historyEntry.note}`}
                        </p>
                      ) : (
                        <p className="text-[11px] text-stone-400 mt-0.5">Pending completion</p>
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
              <p>{currentOrder.customer.address}, {currentOrder.customer.villageTown}</p>
              <p>{currentOrder.customer.district} - {currentOrder.customer.pincode}</p>
              <p className="mt-1">Phone: {currentOrder.customer.phone}</p>
            </div>
            <div>
              <span className="font-semibold text-stone-800 block mb-1">Order Items:</span>
              {currentOrder.items.map((it) => (
                <div key={it.variantId} className="flex justify-between py-0.5">
                  <span>{it.productName} ({it.weight}) × {it.quantity}</span>
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
