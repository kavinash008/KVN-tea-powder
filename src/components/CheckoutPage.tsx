import React, { useState } from 'react';
import { useShop } from '../context/ShopContext';
import { db } from '../lib/db';
import { Order, OrderCustomer } from '../types';
import { 
  ArrowLeft, 
  CheckCircle2, 
  MapPin, 
  Truck, 
  ShieldCheck, 
  CreditCard, 
  QrCode, 
  Clock, 
  AlertCircle 
} from 'lucide-react';

interface CheckoutPageProps {
  onBack: () => void;
  onOrderSuccess: (order: Order) => void;
}

export const CheckoutPage: React.FC<CheckoutPageProps> = ({ onBack, onOrderSuccess }) => {
  const { cart, cartSubtotal, clearCart, config, showToast } = useShop();

  const [customer, setCustomer] = useState<OrderCustomer>({
    fullName: '',
    phone: '',
    email: '',
    address: '',
    villageTown: '',
    district: '',
    state: 'Tamil Nadu',
    pincode: '',
    deliveryInstructions: '',
  });

  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'ONLINE_UPI'>('COD');
  const [selectedAreaId, setSelectedAreaId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Delivery areas from database
  const deliveryAreas = db.getDeliveryAreas();
  const selectedArea = deliveryAreas.find((a) => a.id === selectedAreaId);

  // Delivery charge computation
  let deliveryCharge = config.defaultDeliveryCharge;
  if (cartSubtotal >= config.freeDeliveryThreshold) {
    deliveryCharge = 0;
  } else if (selectedArea) {
    deliveryCharge = selectedArea.deliveryCharge;
  }

  const finalTotal = cartSubtotal + deliveryCharge;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCustomer((prev) => ({ ...prev, [name]: value }));
  };

  const handleAreaSelect = (areaId: string) => {
    setSelectedAreaId(areaId);
    const area = deliveryAreas.find((a) => a.id === areaId);
    if (area) {
      setCustomer((prev) => ({
        ...prev,
        villageTown: area.villageTown,
        district: area.district,
        state: area.state,
        pincode: area.pincode === 'All TN' ? prev.pincode : area.pincode,
      }));
    }
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Form validation
    if (!customer.fullName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!customer.phone.trim() || customer.phone.replace(/\D/g, '').length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!customer.address.trim()) {
      setErrorMsg('Please enter your house/street delivery address.');
      return;
    }
    if (!customer.villageTown.trim()) {
      setErrorMsg('Please specify your village or town.');
      return;
    }
    if (!customer.pincode.trim()) {
      setErrorMsg('Please specify your area pincode.');
      return;
    }

    setSubmitting(true);

    try {
      // NOTE: Strictly respecting user intent:
      // "Do not fake successful payments. Payment status must only become 'Paid' after confirmation from payment provider/webhook."
      // Online payments start with 'Pending' payment status until confirmed.
      const initialPaymentStatus = paymentMethod === 'COD' ? 'Pending' : 'Pending';
      const initialOrderStatus = paymentMethod === 'COD' ? 'Order Confirmed' : 'Payment Pending';

      const createdOrder = await db.createOrder({
        customer,
        items: cart,
        subtotal: cartSubtotal,
        deliveryCharge,
        discountAmount: 0,
        totalAmount: finalTotal,
        paymentMethod,
        paymentStatus: initialPaymentStatus,
        orderStatus: initialOrderStatus,
      });

      clearCart();
      showToast('Order registered successfully!');
      onOrderSuccess(createdOrder);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to place order. Please try again or order via WhatsApp.');
    } finally {
      setSubmitting(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center">
        <p className="text-stone-600 mb-4">No items in your cart to checkout.</p>
        <button
          onClick={onBack}
          className="px-6 py-2.5 bg-[#143728] text-white rounded-xl text-sm font-semibold"
        >
          Return to Products
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Back link */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-[#143728] mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Cart / Shopping
      </button>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left: Customer Info Form */}
        <div className="flex-1">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-xs">
            <h2 className="text-xl font-bold text-stone-900 mb-1">
              Delivery & Contact Details
            </h2>
            <p className="text-xs text-stone-500 mb-6">
              Enter your address for direct local delivery by KVN TEAPOWDER.
            </p>

            {errorMsg && (
              <div className="mb-6 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmitOrder} className="space-y-4">
              {/* Quick Area Preset */}
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                  Select Delivery Area / Locality:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {deliveryAreas.map((area) => (
                    <button
                      type="button"
                      key={area.id}
                      onClick={() => handleAreaSelect(area.id)}
                      className={`text-left p-3 rounded-xl border text-xs transition-all ${
                        selectedAreaId === area.id
                          ? 'border-[#2e5e43] bg-emerald-50/50 text-[#143728] font-medium ring-1 ring-[#2e5e43]'
                          : 'border-stone-200 hover:border-stone-300 bg-stone-50 text-stone-700'
                      }`}
                    >
                      <div className="font-semibold text-stone-900">{area.villageTown}</div>
                      <div className="text-[11px] text-stone-500 flex justify-between mt-0.5">
                        <span>Charge: ₹{area.deliveryCharge}</span>
                        <span>{area.estimatedTime}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    required
                    value={customer.fullName}
                    onChange={handleInputChange}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Mobile Phone Number *
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    required
                    maxLength={10}
                    value={customer.phone}
                    onChange={handleInputChange}
                    placeholder="10-digit mobile number"
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Email Address <span className="text-stone-400 font-normal">(Optional for order tracking updates)</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={customer.email}
                  onChange={handleInputChange}
                  placeholder="your.email@example.com"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Door No. / Building / Street Address *
                </label>
                <textarea
                  name="address"
                  required
                  rows={2}
                  value={customer.address}
                  onChange={handleInputChange}
                  placeholder="Door No, Street name, Near Landmark"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                />
              </div>

              {/* Village/Town, District, State, Pincode */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="col-span-2 sm:col-span-2">
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Village / Town *
                  </label>
                  <input
                    type="text"
                    name="villageTown"
                    required
                    value={customer.villageTown}
                    onChange={handleInputChange}
                    placeholder="Village or Town"
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    District *
                  </label>
                  <input
                    type="text"
                    name="district"
                    value={customer.district}
                    onChange={handleInputChange}
                    placeholder="District"
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Pincode *
                  </label>
                  <input
                    type="text"
                    name="pincode"
                    required
                    maxLength={6}
                    value={customer.pincode}
                    onChange={handleInputChange}
                    placeholder="638001"
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                  />
                </div>
              </div>

              {/* Delivery instructions */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Delivery Landmark / Instructions <span className="text-stone-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  name="deliveryInstructions"
                  value={customer.deliveryInstructions}
                  onChange={handleInputChange}
                  placeholder="e.g., Near Mariamman temple or call before reaching"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                />
              </div>

              {/* Payment Method Selector */}
              <div className="pt-4 border-t border-stone-200">
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-3">
                  Payment Method:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* COD */}
                  <label 
                    className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                      paymentMethod === 'COD'
                        ? 'border-[#2e5e43] bg-emerald-50/40 ring-1 ring-[#2e5e43]'
                        : 'border-stone-200 bg-stone-50 hover:border-stone-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === 'COD'}
                      onChange={() => setPaymentMethod('COD')}
                      className="mt-0.5 text-[#2e5e43] focus:ring-[#2e5e43]"
                    />
                    <div>
                      <div className="font-semibold text-xs text-stone-900 flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-[#2e5e43]" />
                        Cash on Delivery (COD)
                      </div>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        Pay in cash or UPI directly when your package is delivered to your doorstep.
                      </p>
                    </div>
                  </label>

                  {/* Online UPI / Gateway Integration Structure */}
                  <label 
                    className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                      paymentMethod === 'ONLINE_UPI'
                        ? 'border-[#2e5e43] bg-emerald-50/40 ring-1 ring-[#2e5e43]'
                        : 'border-stone-200 bg-stone-50 hover:border-stone-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === 'ONLINE_UPI'}
                      onChange={() => setPaymentMethod('ONLINE_UPI')}
                      className="mt-0.5 text-[#2e5e43] focus:ring-[#2e5e43]"
                    />
                    <div>
                      <div className="font-semibold text-xs text-stone-900 flex items-center gap-1.5">
                        <QrCode className="w-3.5 h-3.5 text-[#c29958]" />
                        Online UPI / Bank QR
                      </div>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        Scan QR code with GPay/PhonePe. Verified securely before packing.
                      </p>
                    </div>
                  </label>
                </div>

                {/* Clear payment security disclaimer */}
                {paymentMethod === 'ONLINE_UPI' && (
                  <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2">
                    <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <span>
                      <strong>Strict Security Policy:</strong> Payment will remain in <em>Payment Pending</em> status until verified via payment webhook/bank confirmation by Krishnamoorthy.
                    </span>
                  </div>
                )}
              </div>

              {/* Submit CTA */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 bg-[#143728] text-white font-bold text-sm rounded-xl hover:bg-[#204e37] active:scale-98 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? 'Placing Your Order...' : `Confirm & Place Order (₹${finalTotal})`}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right: Order Summary */}
        <div className="lg:w-80">
          <div className="bg-white rounded-3xl p-6 border border-stone-200/80 shadow-xs sticky top-28">
            <h3 className="font-bold text-stone-900 text-sm pb-3 border-b border-stone-200">
              Order Summary ({cart.length} items)
            </h3>

            <div className="divide-y divide-stone-100 max-h-64 overflow-y-auto py-2">
              {cart.map((item) => (
                <div key={item.variantId} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-stone-800 line-clamp-1">{item.productName}</div>
                    <div className="text-stone-500 text-[11px]">{item.weight} × {item.quantity}</div>
                  </div>
                  <div className="font-bold text-stone-900">₹{item.unitPrice * item.quantity}</div>
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-3 border-t border-stone-200 text-xs text-stone-600">
              <div className="flex justify-between">
                <span>Items Subtotal</span>
                <span className="font-semibold text-stone-900">₹{cartSubtotal}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery Charge</span>
                <span>{deliveryCharge === 0 ? <strong className="text-emerald-700">FREE</strong> : `₹${deliveryCharge}`}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-stone-900 pt-2 border-t border-stone-200">
                <span>Amount to Pay</span>
                <span className="text-[#143728] text-base">₹{finalTotal}</span>
              </div>
            </div>

            <div className="mt-4 p-3 bg-stone-50 rounded-xl text-[11px] text-stone-500 space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-stone-700">
                <ShieldCheck className="w-3.5 h-3.5 text-[#2e5e43]" /> Fresh Packed Guarantee
              </div>
              <p>Direct small-batch roasted and blended for pure aroma.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
