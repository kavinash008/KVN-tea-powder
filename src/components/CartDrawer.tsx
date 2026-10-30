import React, { useState } from 'react';
import { useShop } from '../context/ShopContext';
import { db } from '../lib/db';
import { X, Trash2, ShoppingBag, ArrowRight, Tag, ShieldCheck, MessageSquare } from 'lucide-react';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onProceedToCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  onProceedToCheckout,
}) => {
  const { cart, updateCartQuantity, removeFromCart, cartSubtotal, config, showToast } = useShop();
  const [couponCode, setCouponCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;

    const result = db.validateCoupon(couponCode, cartSubtotal);
    if (result.valid) {
      setAppliedDiscount(result.discount);
      setAppliedCoupon(couponCode.toUpperCase());
      showToast(result.message);
    } else {
      showToast(result.message);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedDiscount(0);
    setAppliedCoupon(null);
    setCouponCode('');
    showToast('Coupon removed');
  };

  // Delivery charge calculation
  const deliveryCharge = cartSubtotal >= config.freeDeliveryThreshold ? 0 : config.defaultDeliveryCharge;
  const finalTotal = Math.max(0, cartSubtotal + deliveryCharge - appliedDiscount);

  // WhatsApp cart checkout pre-filled format
  const whatsappItemList = cart
    .map((item) => `• ${item.productName} (${item.weight}) x ${item.quantity} = ₹${item.unitPrice * item.quantity}`)
    .join('%0A');
  const whatsappMsg = `Hello KVN TEAPOWDER, I would like to place an order:%0A%0A${whatsappItemList}%0A%0A*Subtotal:* ₹${cartSubtotal}%0A*Delivery:* ₹${deliveryCharge}%0A*Total:* ₹${finalTotal}%0A%0APlease confirm availability and delivery details.`;
  const whatsappUrl = `https://wa.me/91${config.primaryPhone || '6383050287'}?text=${whatsappMsg}`;

  return (
    <div 
      id="cart-drawer"
      className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-xs flex justify-end animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-[#faf7f2] h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300 border-l border-stone-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 bg-white border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#2e5e43]" />
            <h2 className="font-bold text-stone-900 text-lg">Your Cart</h2>
            <span className="bg-stone-100 text-stone-600 text-xs px-2 py-0.5 rounded-full font-semibold">
              {cart.reduce((s, i) => s + i.quantity, 0)} items
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-500">
              <ShoppingBag className="w-16 h-16 text-stone-300 stroke-1 mb-3" />
              <p className="font-semibold text-stone-800 text-base mb-1">Your cart is empty</p>
              <p className="text-xs text-stone-500 max-w-xs mb-6">
                Explore our garden-fresh Nilgiri tea powders and rich traditional South Indian filter coffees.
              </p>
              <button
                onClick={onClose}
                className="px-5 py-2.5 bg-[#143728] text-white text-xs font-semibold rounded-xl hover:bg-[#204e37] transition-all"
              >
                Start Shopping
              </button>
            </div>
          ) : (
            cart.map((item) => (
              <div 
                key={item.variantId} 
                className="bg-white p-3.5 rounded-2xl border border-stone-200/80 shadow-2xs flex gap-3 items-center"
              >
                <img
                  src={item.productImage || 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=200&q=80'}
                  alt={item.productName}
                  className="w-16 h-16 rounded-xl object-cover bg-stone-100 shrink-0"
                />

                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-semibold text-stone-900 truncate">
                    {item.productName}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-stone-500 mt-0.5">
                    <span className="font-medium text-[#2e5e43] bg-emerald-50 px-1.5 py-0.2 rounded">
                      {item.weight}
                    </span>
                    <span>₹{item.unitPrice} each</span>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center border border-stone-200 rounded-lg overflow-hidden bg-stone-50">
                      <button
                        onClick={() => updateCartQuantity(item.variantId, item.quantity - 1)}
                        className="w-6 h-6 flex items-center justify-center text-stone-600 hover:bg-stone-200 text-xs font-bold"
                      >
                        -
                      </button>
                      <span className="w-8 text-center text-xs font-bold text-stone-900">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateCartQuantity(item.variantId, item.quantity + 1)}
                        className="w-6 h-6 flex items-center justify-center text-stone-600 hover:bg-stone-200 text-xs font-bold"
                      >
                        +
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-stone-900">
                        ₹{item.unitPrice * item.quantity}
                      </span>
                      <button
                        onClick={() => removeFromCart(item.variantId)}
                        className="text-stone-400 hover:text-rose-600 transition-colors"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer / Checkout section */}
        {cart.length > 0 && (
          <div className="p-4 bg-white border-t border-stone-200 space-y-3">
            {/* Free shipping bar */}
            {cartSubtotal < config.freeDeliveryThreshold ? (
              <div className="bg-amber-50 text-amber-900 text-xs p-2.5 rounded-xl border border-amber-200/60 flex items-center justify-between">
                <span>Add <strong>₹{config.freeDeliveryThreshold - cartSubtotal}</strong> more for <strong>Free Delivery</strong></span>
              </div>
            ) : (
              <div className="bg-emerald-50 text-emerald-900 text-xs p-2 rounded-xl border border-emerald-200/60 flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Congratulations! You qualify for Free Delivery.
              </div>
            )}

            {/* Coupon Code Box */}
            <form onSubmit={handleApplyCoupon} className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="Coupon (e.g. KVN10)"
                  className="w-full pl-8 pr-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-hidden focus:border-[#2e5e43] uppercase"
                />
              </div>
              {appliedCoupon ? (
                <button
                  type="button"
                  onClick={handleRemoveCoupon}
                  className="px-3 py-2 bg-rose-50 text-rose-700 text-xs font-semibold rounded-xl hover:bg-rose-100"
                >
                  Remove
                </button>
              ) : (
                <button
                  type="submit"
                  className="px-3.5 py-2 bg-stone-800 text-white text-xs font-semibold rounded-xl hover:bg-stone-900"
                >
                  Apply
                </button>
              )}
            </form>

            {/* Price breakdown */}
            <div className="space-y-1.5 text-xs text-stone-600 pt-1 border-t border-stone-100">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-semibold text-stone-900">₹{cartSubtotal}</span>
              </div>
              <div className="flex justify-between">
                <span>Estimated Delivery</span>
                <span>{deliveryCharge === 0 ? <strong className="text-emerald-700">FREE</strong> : `₹${deliveryCharge}`}</span>
              </div>
              {appliedDiscount > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Coupon Discount ({appliedCoupon})</span>
                  <span>-₹{appliedDiscount}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-stone-900 pt-2 border-t border-stone-200">
                <span>Final Total</span>
                <span className="text-base text-[#143728]">₹{finalTotal}</span>
              </div>
            </div>

            {/* CTAs */}
            <div className="space-y-2 pt-1">
              <button
                id="checkout-proceed-btn"
                onClick={() => {
                  onClose();
                  onProceedToCheckout();
                }}
                className="w-full py-3 bg-[#143728] text-white text-sm font-semibold rounded-xl hover:bg-[#204e37] active:scale-98 transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                Proceed to Checkout
                <ArrowRight className="w-4 h-4" />
              </button>

              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 bg-[#25D366]/15 text-[#0a5223] border border-[#25D366]/40 text-xs font-semibold rounded-xl hover:bg-[#25D366]/25 transition-all flex items-center justify-center gap-1.5"
              >
                <MessageSquare className="w-4 h-4 text-[#25D366]" />
                Direct Order on WhatsApp
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
