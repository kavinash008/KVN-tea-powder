import React, { useState, useEffect } from 'react';
import { useShop } from '../context/ShopContext';
import { db } from '../lib/db';
import { api } from '../lib/api';
import { Order, OrderCustomer, CustomerAddress } from '../types';
import { 
  ArrowLeft, 
  MapPin, 
  Truck, 
  ShieldCheck, 
  QrCode, 
  Clock, 
  AlertCircle,
  Navigation,
  BookmarkCheck,
  PlusCircle,
  Loader2,
  User,
  LogIn,
  UserPlus,
  LogOut,
  CheckCircle2,
  Edit2,
  Trash2,
  Check,
  X
} from 'lucide-react';

interface CheckoutPageProps {
  onBack: () => void;
  onOrderSuccess: (order: Order) => void;
}

export const CheckoutPage: React.FC<CheckoutPageProps> = ({ onBack, onOrderSuccess }) => {
  const { 
    cart, 
    cartSubtotal, 
    clearCart, 
    config, 
    showToast, 
    currentUser, 
    authToken, 
    savedAddresses,
    loginCustomer,
    registerCustomer,
    logoutCustomer,
    addSavedAddress,
    updateSavedAddress,
    deleteSavedAddress
  } = useShop();

  // Authentication mode for visitors: 'register' | 'login'
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState('');

  // Sign In form state
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [regFullName, setRegFullName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regAddressLabel, setRegAddressLabel] = useState<'Home' | 'Work' | 'Other'>('Home');
  const [regAddressLine, setRegAddressLine] = useState('');
  const [regVillageTown, setRegVillageTown] = useState('');
  const [regDistrict, setRegDistrict] = useState('');
  const [regPincode, setRegPincode] = useState('');
  const [regCoordinates, setRegCoordinates] = useState<{ latitude: number; longitude: number } | undefined>(undefined);

  // Active delivery address selection for authenticated customer
  const [selectedAddrId, setSelectedAddrId] = useState<string>('');
  const [customer, setCustomer] = useState<OrderCustomer>({
    fullName: currentUser?.fullName || '',
    phone: currentUser?.phone || '',
    email: currentUser?.email || '',
    address: '',
    villageTown: '',
    district: '',
    state: 'Tamil Nadu',
    pincode: '',
    deliveryInstructions: '',
  });

  // Inline address creation / editing state
  const [isAddingNewAddress, setIsAddingNewAddress] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addrForm, setAddrForm] = useState({
    label: 'Home' as 'Home' | 'Work' | 'Other',
    recipientName: '',
    phone: '',
    addressLine: '',
    villageTown: '',
    district: '',
    state: 'Tamil Nadu',
    pincode: '',
  });

  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'ONLINE_UPI'>('COD');
  const [selectedAreaId, setSelectedAreaId] = useState<string>('');
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationSuccessMsg, setLocationSuccessMsg] = useState('');
  const [orderErrorMsg, setOrderErrorMsg] = useState('');

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

  // Initialize selected address whenever savedAddresses or currentUser changes
  useEffect(() => {
    if (savedAddresses && savedAddresses.length > 0) {
      const defaultAddr = savedAddresses.find((a) => a.isDefault) || savedAddresses[0];
      setSelectedAddrId(defaultAddr.id);
      applySavedAddress(defaultAddr);
    } else if (currentUser) {
      setCustomer((prev) => ({
        ...prev,
        fullName: currentUser.fullName,
        phone: currentUser.phone,
        email: currentUser.email || '',
      }));
    }
  }, [savedAddresses, currentUser]);

  const applySavedAddress = (addr: CustomerAddress) => {
    setCustomer((prev) => ({
      ...prev,
      fullName: addr.recipientName || prev.fullName,
      phone: addr.phone || prev.phone,
      address: addr.addressLine,
      villageTown: addr.villageTown,
      district: addr.district || '',
      state: addr.state || 'Tamil Nadu',
      pincode: addr.pincode,
      coordinates: addr.coordinates,
    }));
  };

  const handleSelectAddress = (addr: CustomerAddress) => {
    setSelectedAddrId(addr.id);
    applySavedAddress(addr);
    setIsAddingNewAddress(false);
    setEditingAddressId(null);
  };

  const handleStartEditAddress = (addr: CustomerAddress, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingAddressId(addr.id);
    setIsAddingNewAddress(false);
    setAddrForm({
      label: addr.label,
      recipientName: addr.recipientName,
      phone: addr.phone,
      addressLine: addr.addressLine,
      villageTown: addr.villageTown,
      district: addr.district || '',
      state: addr.state || 'Tamil Nadu',
      pincode: addr.pincode,
    });
  };

  const handleStartAddNewAddress = () => {
    setIsAddingNewAddress(true);
    setEditingAddressId(null);
    setAddrForm({
      label: 'Home',
      recipientName: currentUser?.fullName || '',
      phone: currentUser?.phone || '',
      addressLine: '',
      villageTown: '',
      district: '',
      state: 'Tamil Nadu',
      pincode: '',
    });
  };

  const handleSaveAddressForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addrForm.recipientName.trim() || !addrForm.phone.trim() || !addrForm.addressLine.trim() || !addrForm.villageTown.trim() || !addrForm.pincode.trim()) {
      showToast('Please fill all required address fields');
      return;
    }
    if (!/^[1-9][0-9]{5}$/.test(addrForm.pincode.trim())) {
      showToast('Please enter a valid 6-digit Indian PIN code');
      return;
    }

    if (editingAddressId) {
      const updated = await updateSavedAddress(editingAddressId, {
        label: addrForm.label,
        recipientName: addrForm.recipientName.trim(),
        phone: addrForm.phone.trim(),
        addressLine: addrForm.addressLine.trim(),
        villageTown: addrForm.villageTown.trim(),
        district: addrForm.district.trim(),
        state: addrForm.state || 'Tamil Nadu',
        pincode: addrForm.pincode.trim(),
      });
      if (updated) {
        setEditingAddressId(null);
        applySavedAddress(updated);
      }
    } else {
      const created = await addSavedAddress({
        label: addrForm.label,
        recipientName: addrForm.recipientName.trim(),
        phone: addrForm.phone.trim(),
        addressLine: addrForm.addressLine.trim(),
        villageTown: addrForm.villageTown.trim(),
        district: addrForm.district.trim(),
        state: addrForm.state || 'Tamil Nadu',
        pincode: addrForm.pincode.trim(),
        isDefault: savedAddresses.length === 0,
      });
      if (created) {
        setIsAddingNewAddress(false);
        setSelectedAddrId(created.id);
        applySavedAddress(created);
      }
    }
  };

  // GPS Geolocation with OpenStreetMap Nominatim reverse geocoding
  const handleGpsLocation = (targetForm: 'register' | 'address') => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser');
      return;
    }

    setLocating(true);
    setLocationSuccessMsg('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`,
            { headers: { 'Accept-Language': 'en' } }
          );
          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            const streetParts = [addr.house_number, addr.road, addr.suburb, addr.neighbourhood].filter(Boolean);
            const street = streetParts.join(', ') || addr.display_name?.split(',').slice(0, 2).join(',') || '';
            const villageTown = addr.village || addr.town || addr.city || addr.suburb || addr.county || '';
            const district = addr.state_district || addr.district || '';
            const pincode = (addr.postcode || '').replace(/\D/g, '').slice(0, 6);

            if (targetForm === 'register') {
              if (street) setRegAddressLine(street);
              if (villageTown) setRegVillageTown(villageTown);
              if (district) setRegDistrict(district);
              if (pincode) setRegPincode(pincode);
              setRegCoordinates({ latitude: lat, longitude: lon });
            } else {
              setAddrForm((prev) => ({
                ...prev,
                addressLine: street || prev.addressLine,
                villageTown: villageTown || prev.villageTown,
                district: district || prev.district,
                pincode: pincode || prev.pincode,
              }));
            }
            setLocationSuccessMsg('GPS Location detected! Please check your door number.');
            showToast('GPS Location applied to form');
          } else {
            setLocationSuccessMsg('GPS Coordinates saved. Please type your street name.');
          }
        } catch {
          setLocationSuccessMsg('GPS Coordinates saved. Please verify fields.');
        } finally {
          setLocating(false);
        }
      },
      (error) => {
        setLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          showToast('Location permission denied. Please enter address manually.');
        } else {
          showToast('Unable to detect location. Please enter manually.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleAreaSelect = (areaId: string, targetForm: 'register' | 'address') => {
    setSelectedAreaId(areaId);
    const area = deliveryAreas.find((a) => a.id === areaId);
    if (!area) return;

    if (targetForm === 'register') {
      setRegVillageTown(area.villageTown);
      setRegDistrict(area.district);
      if (area.pincode !== 'All TN') {
        setRegPincode(area.pincode);
      }
    } else {
      setAddrForm((prev) => ({
        ...prev,
        villageTown: area.villageTown,
        district: area.district,
        pincode: area.pincode !== 'All TN' ? area.pincode : prev.pincode,
      }));
    }
  };

  // 1. Handle Registration before checkout
  const handleRegisterBeforeCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (!regFullName.trim() || regFullName.trim().length < 2) {
      setAuthError('Please enter your full name (at least 2 characters).');
      return;
    }
    const cleanPhone = regPhone.replace(/\D/g, '');
    const normPhone = cleanPhone.length === 12 && cleanPhone.startsWith('91') ? cleanPhone.slice(2) : cleanPhone;
    if (!/^[6-9]\d{9}$/.test(normPhone)) {
      setAuthError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (!regPassword || regPassword.length < 4) {
      setAuthError('Please create a password of at least 4 characters.');
      return;
    }
    if (!regAddressLine.trim() || regAddressLine.trim().length < 5) {
      setAuthError('Please enter your delivery street / door address (at least 5 characters).');
      return;
    }
    if (!regVillageTown.trim()) {
      setAuthError('Please specify your village or town.');
      return;
    }
    if (!regPincode.trim() || !/^[1-9][0-9]{5}$/.test(regPincode.trim())) {
      setAuthError('Please enter a valid 6-digit Indian PIN code.');
      return;
    }

    setAuthSubmitting(true);
    try {
      const res = await registerCustomer({
        fullName: regFullName.trim(),
        phone: normPhone,
        password: regPassword,
        email: regEmail.trim() || undefined,
        initialAddress: {
          label: regAddressLabel,
          recipientName: regFullName.trim(),
          phone: normPhone,
          addressLine: regAddressLine.trim(),
          villageTown: regVillageTown.trim(),
          district: regDistrict.trim(),
          state: 'Tamil Nadu',
          pincode: regPincode.trim(),
          isDefault: true,
          coordinates: regCoordinates,
        },
      });

      if (!res.success) {
        setAuthError(res.error || 'Failed to create account.');
      } else {
        showToast('Account created and delivery address saved!');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Registration failed');
    } finally {
      setAuthSubmitting(false);
    }
  };

  // 2. Handle Login before checkout
  const handleLoginBeforeCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    const cleanPhone = loginPhone.replace(/\D/g, '');
    const normPhone = cleanPhone.length === 12 && cleanPhone.startsWith('91') ? cleanPhone.slice(2) : cleanPhone;
    if (!/^[6-9]\d{9}$/.test(normPhone)) {
      setAuthError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (!loginPassword) {
      setAuthError('Please enter your password.');
      return;
    }

    setAuthSubmitting(true);
    try {
      const res = await loginCustomer(normPhone, loginPassword);
      if (!res.success) {
        setAuthError(res.error || 'Invalid mobile number or password.');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Login failed');
    } finally {
      setAuthSubmitting(false);
    }
  };

  // 3. Final Order Submission for authenticated customer
  const handleFinalOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrderErrorMsg('');

    if (!customer.address || customer.address.trim().length < 5) {
      setOrderErrorMsg('Please select or add a valid delivery address with door number.');
      return;
    }
    if (!customer.villageTown || !customer.villageTown.trim()) {
      setOrderErrorMsg('Please specify delivery village or town.');
      return;
    }
    if (!customer.pincode || !/^[1-9][0-9]{5}$/.test(customer.pincode.trim())) {
      setOrderErrorMsg('Please enter a valid 6-digit Indian PIN code.');
      return;
    }

    setSubmittingOrder(true);
    try {
      const createdOrder = await api.createOrder(
        {
          customer: {
            ...customer,
            phone: customer.phone.replace(/\D/g, '').slice(-10),
          },
          items: cart,
          paymentMethod: paymentMethod === 'COD' ? 'COD' : 'ONLINE_UPI',
          notes: customer.deliveryInstructions,
        },
        authToken
      );

      clearCart();
      showToast('Order placed successfully! Saved to shared database.');
      onOrderSuccess(createdOrder);
    } catch (err: any) {
      console.error('Order submission error:', err);
      setOrderErrorMsg(err.message || 'Failed to place order. Please try again.');
    } finally {
      setSubmittingOrder(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center">
        <p className="text-stone-600 mb-4">No items in your cart to checkout.</p>
        <button
          onClick={onBack}
          className="px-6 py-2.5 bg-[#143728] text-white rounded-xl text-sm font-semibold hover:bg-[#204e37] transition-all cursor-pointer"
        >
          Return to Products
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Top back link */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-[#143728] mb-6 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Cart / Shopping
      </button>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left: Customer Auth or Delivery Form */}
        <div className="flex-1">
          {/* SCENARIO A: VISITOR NOT LOGGED IN -> REQUIRE LOGIN OR REGISTRATION */}
          {!currentUser ? (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/90 shadow-sm animate-in fade-in duration-200">
              {/* Header Badge */}
              <div className="mb-6">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-[#143728] border border-[#2e5e43]/30 rounded-full text-xs font-bold mb-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#2e5e43]" /> Step 1: Customer Account Required
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-stone-900">
                  {authMode === 'register' ? 'Create Customer Account & Checkout' : 'Sign In to Your Account'}
                </h2>
                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                  KVN Tea Powder delivers directly from our blending unit in Sivagiri. Please create an account or sign in so your delivery address and order tracking are securely saved.
                </p>
              </div>

              {/* Mode Toggle Tabs */}
              <div className="flex border-b border-stone-200 mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setAuthError('');
                  }}
                  className={`flex-1 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    authMode === 'register'
                      ? 'border-[#143728] text-[#143728]'
                      : 'border-transparent text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <UserPlus className="w-4 h-4" /> New Customer (Register)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setAuthError('');
                  }}
                  className={`flex-1 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    authMode === 'login'
                      ? 'border-[#143728] text-[#143728]'
                      : 'border-transparent text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <LogIn className="w-4 h-4" /> Returning Customer (Sign In)
                </button>
              </div>

              {authError && (
                <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              {/* TAB 1: REGISTRATION & FIRST ADDRESS */}
              {authMode === 'register' ? (
                <form onSubmit={handleRegisterBeforeCheckout} className="space-y-4">
                  {/* Name & Phone */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={regFullName}
                        onChange={(e) => setRegFullName(e.target.value)}
                        placeholder="e.g. Ramesh Kumar"
                        className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        10-Digit Mobile Phone *
                      </label>
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="10-digit mobile number"
                        className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                      />
                    </div>
                  </div>

                  {/* Password & Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Create Password * <span className="text-stone-400 font-normal">(min 4 characters)</span>
                      </label>
                      <input
                        type="password"
                        required
                        minLength={4}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="At least 4 characters"
                        className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Email Address <span className="text-stone-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                      />
                    </div>
                  </div>

                  {/* Address Section */}
                  <div className="pt-4 border-t border-stone-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                        Initial Delivery Address
                      </label>
                      <button
                        type="button"
                        onClick={() => handleGpsLocation('register')}
                        disabled={locating}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-[#143728] border border-[#2e5e43]/30 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                        title="Auto-fill address using device GPS"
                      >
                        {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5 text-[#2e5e43]" />}
                        <span>{locating ? 'Detecting GPS...' : '📍 Use My Location'}</span>
                      </button>
                    </div>

                    {locationSuccessMsg && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                        <BookmarkCheck className="w-4 h-4 shrink-0 text-emerald-600" />
                        <span>{locationSuccessMsg}</span>
                      </div>
                    )}

                    {/* Address Type Pill */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-stone-500 font-medium">Label:</span>
                      {(['Home', 'Work', 'Other'] as const).map((lbl) => (
                        <button
                          key={lbl}
                          type="button"
                          onClick={() => setRegAddressLabel(lbl)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                            regAddressLabel === lbl
                              ? 'bg-[#143728] text-white border-[#143728]'
                              : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                          }`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>

                    {/* Street Address */}
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Door No. / Building / Street Address *
                      </label>
                      <textarea
                        required
                        rows={2}
                        value={regAddressLine}
                        onChange={(e) => setRegAddressLine(e.target.value)}
                        placeholder="Door No, Street name, Near Landmark"
                        className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                      />
                    </div>

                    {/* Locality Quick Selector */}
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                        Quick Select Locality / Town:
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {deliveryAreas.slice(0, 4).map((area) => (
                          <button
                            type="button"
                            key={area.id}
                            onClick={() => handleAreaSelect(area.id, 'register')}
                            className="p-2 bg-stone-50 hover:bg-emerald-50 hover:border-[#2e5e43] border border-stone-200 rounded-lg text-left text-[11px] transition-all cursor-pointer"
                          >
                            <div className="font-semibold text-stone-800 truncate">{area.villageTown}</div>
                            <div className="text-stone-500 text-[10px]">₹{area.deliveryCharge} delivery</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Town, District, State, Pincode */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          Village / Town *
                        </label>
                        <input
                          type="text"
                          required
                          value={regVillageTown}
                          onChange={(e) => setRegVillageTown(e.target.value)}
                          placeholder="e.g. Sivagiri"
                          className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          District
                        </label>
                        <input
                          type="text"
                          value={regDistrict}
                          onChange={(e) => setRegDistrict(e.target.value)}
                          placeholder="Erode"
                          className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          PIN Code *
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={6}
                          value={regPincode}
                          onChange={(e) => setRegPincode(e.target.value)}
                          placeholder="638109"
                          className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={authSubmitting}
                      className="w-full py-3.5 bg-[#143728] text-white font-bold text-xs sm:text-sm rounded-xl hover:bg-[#204e37] transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-md"
                    >
                      {authSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Creating Account & Saving Address...
                        </>
                      ) : (
                        'Create Account & Proceed to Payment'
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                /* TAB 2: SIGN IN FOR RETURNING CUSTOMERS */
                <form onSubmit={handleLoginBeforeCheckout} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Registered 10-Digit Mobile Number *
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={loginPhone}
                      onChange={(e) => setLoginPhone(e.target.value)}
                      placeholder="Enter your 10-digit mobile number"
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Account Password *
                    </label>
                    <input
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={authSubmitting}
                      className="w-full py-3.5 bg-[#143728] text-white font-bold text-xs sm:text-sm rounded-xl hover:bg-[#204e37] transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-md"
                    >
                      {authSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Signing In & Loading Profile...
                        </>
                      ) : (
                        'Sign In & Proceed to Checkout'
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            /* SCENARIO B: AUTHENTICATED CUSTOMER -> FULL ADDRESS & PAYMENT WORKFLOW */
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/90 shadow-sm space-y-6">
              {/* Authenticated Customer Strip */}
              <div className="flex items-center justify-between p-3.5 bg-stone-50 rounded-2xl border border-stone-200">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-[#143728] flex items-center justify-center font-bold text-xs shrink-0">
                    {currentUser.fullName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-stone-900 text-xs truncate">
                      {currentUser.fullName}
                    </div>
                    <div className="text-[11px] text-stone-500">
                      +91 {currentUser.phone} {currentUser.email && `• ${currentUser.email}`}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={logoutCustomer}
                  className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Switch customer account"
                >
                  <LogOut className="w-3.5 h-3.5" /> Logout
                </button>
              </div>

              {/* SECTION 1: SAVED DELIVERY ADDRESSES */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
                      Select Delivery Address
                    </h3>
                    <p className="text-xs text-stone-500">
                      Choose where you want your fresh tea powder delivered.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleStartAddNewAddress}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-[#143728] border border-[#2e5e43]/30 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-[#2e5e43]" /> Add New Address
                  </button>
                </div>

                {/* List of saved addresses as selectable cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {savedAddresses.map((addr) => {
                    const isSelected = selectedAddrId === addr.id;
                    return (
                      <div
                        key={addr.id}
                        onClick={() => handleSelectAddress(addr)}
                        className={`p-4 rounded-2xl border text-xs cursor-pointer transition-all relative ${
                          isSelected
                            ? 'border-[#2e5e43] bg-emerald-50/50 text-[#143728] ring-2 ring-[#2e5e43]'
                            : 'border-stone-200 hover:border-stone-300 bg-stone-50 text-stone-700'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold text-stone-900 mb-1">
                          <span className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-[#2e5e43]" />
                            {addr.label}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {addr.isDefault && (
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                                Default
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => handleStartEditAddress(addr, e)}
                              className="text-stone-400 hover:text-[#2e5e43] p-1 rounded hover:bg-white transition-colors"
                              title="Edit this address"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div className="font-semibold text-stone-800 text-[11px] mb-0.5">
                          {addr.recipientName} ({addr.phone})
                        </div>
                        <div className="text-stone-600 text-[11px] leading-relaxed">
                          {addr.addressLine}, {addr.villageTown} - {addr.pincode}
                        </div>

                        {isSelected && (
                          <div className="mt-2.5 pt-2 border-t border-emerald-200/80 flex items-center gap-1 text-[11px] font-bold text-[#143728]">
                            <Check className="w-3.5 h-3.5 text-emerald-600" /> Selected for this delivery
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* INLINE ADDRESS FORM (ADD OR EDIT) */}
                {(isAddingNewAddress || editingAddressId) && (
                  <form onSubmit={handleSaveAddressForm} className="mt-4 p-4 sm:p-5 bg-stone-50 border border-stone-200 rounded-2xl space-y-3 text-xs animate-in fade-in duration-200">
                    <div className="flex items-center justify-between pb-2 border-b border-stone-200">
                      <span className="font-bold text-stone-900">
                        {editingAddressId ? 'Edit Saved Address' : 'Add New Delivery Address to Profile'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleGpsLocation('address')}
                        disabled={locating}
                        className="text-xs text-[#143728] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Navigation className="w-3 h-3 text-[#2e5e43]" />
                        {locating ? 'Detecting GPS...' : '📍 Use My Location'}
                      </button>
                    </div>

                    <div className="flex gap-2">
                      {(['Home', 'Work', 'Other'] as const).map((lbl) => (
                        <button
                          key={lbl}
                          type="button"
                          onClick={() => setAddrForm((prev) => ({ ...prev, label: lbl }))}
                          className={`flex-1 py-1.5 rounded-lg font-semibold border transition-all cursor-pointer ${
                            addrForm.label === lbl
                              ? 'bg-[#143728] text-white border-[#143728]'
                              : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                          }`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                          Recipient Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={addrForm.recipientName}
                          onChange={(e) => setAddrForm((prev) => ({ ...prev, recipientName: e.target.value }))}
                          className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                          Phone Number *
                        </label>
                        <input
                          type="tel"
                          required
                          maxLength={10}
                          value={addrForm.phone}
                          onChange={(e) => setAddrForm((prev) => ({ ...prev, phone: e.target.value }))}
                          className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                        Door No. / Building / Street Address *
                      </label>
                      <input
                        type="text"
                        required
                        value={addrForm.addressLine}
                        onChange={(e) => setAddrForm((prev) => ({ ...prev, addressLine: e.target.value }))}
                        placeholder="Door no, Street name, Landmark"
                        className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                          Village / Town *
                        </label>
                        <input
                          type="text"
                          required
                          value={addrForm.villageTown}
                          onChange={(e) => setAddrForm((prev) => ({ ...prev, villageTown: e.target.value }))}
                          placeholder="e.g. Sivagiri"
                          className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                          District
                        </label>
                        <input
                          type="text"
                          value={addrForm.district}
                          onChange={(e) => setAddrForm((prev) => ({ ...prev, district: e.target.value }))}
                          placeholder="Erode"
                          className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                          PIN Code *
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={6}
                          value={addrForm.pincode}
                          onChange={(e) => setAddrForm((prev) => ({ ...prev, pincode: e.target.value }))}
                          placeholder="638109"
                          className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="submit"
                        className="flex-1 py-2 bg-[#143728] text-white font-bold rounded-xl hover:bg-[#204e37] transition-all cursor-pointer"
                      >
                        {editingAddressId ? 'Save Address Changes' : 'Save Address to Profile'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingNewAddress(false);
                          setEditingAddressId(null);
                        }}
                        className="px-4 py-2 bg-stone-200 text-stone-700 rounded-xl font-semibold hover:bg-stone-300 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* SECTION 2: CONFIRMED DELIVERY DESTINATION PREVIEW */}
              <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl">
                <div className="flex items-center gap-2 font-bold text-xs text-[#143728] mb-1">
                  <BookmarkCheck className="w-4 h-4 text-emerald-700" />
                  <span>Confirmed Delivery Destination:</span>
                </div>
                <div className="text-xs text-stone-800 font-semibold">
                  {customer.fullName} • +91 {customer.phone}
                </div>
                <div className="text-xs text-stone-600 mt-0.5">
                  {customer.address}, {customer.villageTown}, {customer.district || 'Tamil Nadu'} - {customer.pincode}
                </div>
              </div>

              {/* SECTION 3: DELIVERY INSTRUCTIONS & PAYMENT METHOD */}
              <form onSubmit={handleFinalOrderSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Delivery Instructions / Landmark <span className="text-stone-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={customer.deliveryInstructions}
                    onChange={(e) => setCustomer((prev) => ({ ...prev, deliveryInstructions: e.target.value }))}
                    placeholder="e.g. Near Mariamman temple or call before reaching"
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                  />
                </div>

                {/* Payment Method Selector */}
                <div className="pt-2">
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
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
                          Pay cash or UPI directly when your package is delivered to your doorstep.
                        </p>
                      </div>
                    </label>

                    {/* Online UPI */}
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
                </div>

                {orderErrorMsg && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{orderErrorMsg}</span>
                  </div>
                )}

                {/* Final Order CTA */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submittingOrder}
                    className="w-full py-4 bg-[#143728] text-white font-bold text-sm rounded-xl hover:bg-[#204e37] active:scale-98 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {submittingOrder ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Saving Order to Shared Database...
                      </>
                    ) : (
                      `Confirm & Place Order (₹${finalTotal})`
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
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
