import React, { useState } from 'react';
import { db } from '../lib/db';
import { useShop } from '../context/ShopContext';
import { User, Package, MapPin, Heart, Clock, LogIn } from 'lucide-react';
import { Order } from '../types';

interface CustomerAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTrackOrder: (orderId: string) => void;
}

export const CustomerAccountModal: React.FC<CustomerAccountModalProps> = ({
  isOpen,
  onClose,
  onTrackOrder,
}) => {
  const { wishlist } = useShop();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isIdentified, setIsIdentified] = useState(false);
  const [activeTab, setActiveTab] = useState<'orders' | 'wishlist' | 'info'>('orders');

  if (!isOpen) return null;

  // Retrieve matching orders from database by customer phone
  const allOrders = db.getOrders();
  const customerOrders = isIdentified
    ? allOrders.filter((o) => o.customer.phone.includes(phoneNumber.trim()))
    : [];

  const handlePhoneLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneNumber.trim().length >= 10) {
      setIsIdentified(true);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-stone-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-stone-200 mb-6">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-[#2e5e43]" />
            <h2 className="font-bold text-stone-900 text-lg">Customer Account & Orders</h2>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 text-sm font-semibold"
          >
            ✕
          </button>
        </div>

        {!isIdentified ? (
          <form onSubmit={handlePhoneLookup} className="space-y-4">
            <p className="text-xs text-stone-600">
              Enter your registered mobile number to look up your order history, delivery statuses, and saved preferences without hassle.
            </p>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Mobile Number
              </label>
              <input
                type="tel"
                required
                maxLength={10}
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="10-digit mobile number"
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-hidden focus:border-[#2e5e43]"
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-[#143728] text-white text-xs font-bold rounded-xl hover:bg-[#204e37] transition-all"
            >
              Look up My Orders
            </button>
          </form>
        ) : (
          <div>
            {/* Account header */}
            <div className="flex items-center justify-between bg-stone-50 p-3 rounded-xl mb-4 text-xs">
              <span>Account: <strong>+91 {phoneNumber}</strong></span>
              <button
                onClick={() => setIsIdentified(false)}
                className="text-stone-500 hover:underline text-[11px]"
              >
                Change Number
              </button>
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-2 border-b border-stone-200 pb-2 mb-4">
              <button
                onClick={() => setActiveTab('orders')}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'orders' ? 'bg-[#143728] text-white' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                My Orders ({customerOrders.length})
              </button>
              <button
                onClick={() => setActiveTab('wishlist')}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'wishlist' ? 'bg-[#143728] text-white' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                Wishlist ({wishlist.length})
              </button>
            </div>

            {activeTab === 'orders' && (
              <div className="max-h-72 overflow-y-auto space-y-3">
                {customerOrders.length === 0 ? (
                  <div className="text-center py-8 text-stone-500 text-xs">
                    <Package className="w-10 h-10 text-stone-300 mx-auto mb-2" />
                    No previous orders found for this mobile number.
                  </div>
                ) : (
                  customerOrders.map((ord) => (
                    <div
                      key={ord.id}
                      className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-2 text-xs"
                    >
                      <div className="flex justify-between font-semibold text-stone-900">
                        <span>{ord.orderNumber}</span>
                        <span className="text-[#2e5e43]">₹{ord.totalAmount}</span>
                      </div>
                      <div className="text-stone-500 text-[11px]">
                        {new Date(ord.createdAt).toLocaleDateString('en-IN')} • {ord.paymentMethod} ({ord.paymentStatus})
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-stone-200">
                        <span className="font-medium bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px]">
                          {ord.orderStatus}
                        </span>
                        <button
                          onClick={() => {
                            onClose();
                            onTrackOrder(ord.id);
                          }}
                          className="text-[#143728] font-bold hover:underline flex items-center gap-1 text-[11px]"
                        >
                          <Clock className="w-3 h-3" /> Track Order
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'wishlist' && (
              <div className="py-4 text-xs text-stone-600">
                You have {wishlist.length} item(s) saved in your favorites. You can access your wishlist directly from the top navigation bar.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
