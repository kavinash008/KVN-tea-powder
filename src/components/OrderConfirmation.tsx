import React from 'react';
import { Order } from '../types';
import { CheckCircle2, Package, MapPin, Phone, MessageSquare, ArrowRight, Clock } from 'lucide-react';
import { useShop } from '../context/ShopContext';

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

  const whatsappMsg = encodeURIComponent(
    `Hello KVN TEAPOWDER, I just placed order ${order.orderNumber} for ₹${order.totalAmount}. Please confirm when packing begins.`
  );
  const whatsappUrl = `https://wa.me/91${config.primaryPhone || '6383050287'}?text=${whatsappMsg}`;

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 sm:py-16 animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl p-6 sm:p-10 border border-stone-200/80 shadow-lg text-center">
        {/* Success Icon Badge */}
        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-200">
          <CheckCircle2 className="w-9 h-9" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 mb-2">
          Order Placed Successfully!
        </h1>
        <p className="text-sm text-stone-600 max-w-md mx-auto mb-6">
          Thank you for ordering with <strong>KVN TEAPOWDER</strong>. Kavinash has received your order and will prepare fresh packaging shortly.
        </p>

        {/* Order Details Card */}
        <div className="bg-stone-50 rounded-2xl p-5 text-left border border-stone-200/70 mb-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-200 text-xs">
            <div>
              <span className="text-stone-500">Order ID:</span>
              <span className="font-bold text-stone-900 ml-1 text-sm">{order.orderNumber}</span>
            </div>
            <div>
              <span className="text-stone-500">Placed On:</span>
              <span className="font-medium text-stone-800 ml-1">
                {new Date(order.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
            <div>
              <span className="text-stone-500">Order Status:</span>
              <span className="font-semibold text-[#143728] bg-emerald-100/60 px-2 py-0.5 rounded ml-1">
                {order.orderStatus}
              </span>
            </div>
          </div>

          {/* Customer & Address */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-stone-600">
            <div>
              <h4 className="font-bold text-stone-800 uppercase tracking-wider mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#2e5e43]" /> Delivery Address
              </h4>
              <p className="font-medium text-stone-900">{order.customer.fullName}</p>
              <p>{order.customer.address}</p>
              <p>{order.customer.villageTown}, {order.customer.district} - {order.customer.pincode}</p>
              <p className="mt-1 font-medium text-stone-800">Mobile: {order.customer.phone}</p>
            </div>

            <div>
              <h4 className="font-bold text-stone-800 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Package className="w-3.5 h-3.5 text-[#2e5e43]" /> Payment & Delivery
              </h4>
              <p>Payment Method: <strong className="text-stone-900">{order.paymentMethod}</strong></p>
              <p>Payment Status: <strong className={order.paymentStatus === 'Paid' ? 'text-emerald-700' : 'text-amber-700'}>{order.paymentStatus}</strong></p>
              <p className="mt-1 text-stone-500">Notice sent to owner: {config.email}</p>
            </div>
          </div>

          {/* Items Summary List */}
          <div className="pt-2 border-t border-stone-200">
            <h4 className="font-bold text-stone-800 text-xs mb-2">Purchased Items:</h4>
            <div className="divide-y divide-stone-200/50">
              {order.items.map((item) => (
                <div key={item.variantId} className="py-1.5 flex justify-between text-xs">
                  <span>{item.productName} ({item.weight}) × {item.quantity}</span>
                  <span className="font-semibold text-stone-900">₹{item.unitPrice * item.quantity}</span>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-between font-bold text-sm text-stone-900 border-t border-stone-200 mt-2">
              <span>Total Amount</span>
              <span className="text-[#143728]">₹{order.totalAmount}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => onTrackOrder(order.id)}
            className="w-full sm:w-auto px-6 py-3 bg-[#143728] text-white text-xs font-semibold rounded-xl hover:bg-[#204e37] transition-all flex items-center justify-center gap-1.5"
          >
            <Clock className="w-4 h-4" /> Track Order Progress
          </button>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-6 py-3 bg-[#25D366] text-white text-xs font-semibold rounded-xl hover:bg-[#20ba59] transition-all flex items-center justify-center gap-1.5"
          >
            <MessageSquare className="w-4 h-4" /> Send Update on WhatsApp
          </a>

          <button
            onClick={onContinueShopping}
            className="w-full sm:w-auto px-6 py-3 border border-stone-300 text-stone-700 text-xs font-semibold rounded-xl hover:bg-stone-50 transition-all flex items-center justify-center gap-1.5"
          >
            Continue Shopping <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
