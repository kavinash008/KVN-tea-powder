import React, { useState, useEffect } from 'react';
import { useShop } from '../context/ShopContext';
import { api } from '../lib/api';
import { Order, CustomerAddress } from '../types';
import {
  User,
  Package,
  MapPin,
  Heart,
  Clock,
  LogIn,
  UserPlus,
  LogOut,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Navigation,
  Loader2,
  Edit3,
  Mail,
  KeyRound,
  Smartphone
} from 'lucide-react';

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
  const {
    currentUser,
    authToken,
    savedAddresses,
    loginCustomer,
    registerCustomer,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    sendPasswordReset,
    sendPhoneOtp,
    verifyPhoneOtp,
    isFirebaseAvailable,
    logoutCustomer,
    addSavedAddress,
    deleteSavedAddress,
    updateSavedAddress,
    wishlist,
    showToast,
  } = useShop();

  // Mode when not logged in: 'login' | 'register'
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authMethod, setAuthMethod] = useState<'password' | 'otp' | 'email'>('password');

  // Login form state
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Phone OTP state
  const [otpPhone, setOtpPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [otpSent, setOtpSent] = useState(false);

  // Email form state
  const [emailInput, setEmailInput] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // Register form state
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regAddressLine, setRegAddressLine] = useState('');
  const [regVillageTown, setRegVillageTown] = useState('');
  const [regPincode, setRegPincode] = useState('');

  // Logged-in tabs: 'orders' | 'addresses' | 'profile' | 'wishlist'
  const [activeTab, setActiveTab] = useState<'orders' | 'addresses' | 'profile' | 'wishlist'>('orders');

  // Customer Orders fetched from API
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Address form modal/drawer
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addrLabel, setAddrLabel] = useState<'Home' | 'Work' | 'Other'>('Home');
  const [addrRecipient, setAddrRecipient] = useState('');
  const [addrPhone, setAddrPhone] = useState('');
  const [addrLine, setAddrLine] = useState('');
  const [addrTown, setAddrTown] = useState('');
  const [addrDistrict, setAddrDistrict] = useState('');
  const [addrPin, setAddrPin] = useState('');
  const [locating, setLocating] = useState(false);

  // Profile edit
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [updatingProfile, setUpdatingProfile] = useState(false);

  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load customer orders from server when logged in
  useEffect(() => {
    if (currentUser && isOpen) {
      loadCustomerOrders();
      setEditName(currentUser.fullName);
      setEditEmail(currentUser.email || '');
    }
  }, [currentUser, isOpen]);

  const loadCustomerOrders = async () => {
    if (!currentUser) return;
    setLoadingOrders(true);
    try {
      const serverOrders = await api.getMyOrders(currentUser.phone, authToken);
      setOrders(serverOrders);
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setFormError('');
    setSubmitting(true);
    const res = await loginWithGoogle();
    setSubmitting(false);
    if (!res.success) {
      setFormError(res.error || 'Google Sign-In failed');
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const clean = otpPhone.replace(/\D/g, '').slice(-10);
    if (clean.length < 10) {
      setFormError('Please enter a valid 10-digit mobile number');
      return;
    }
    setSubmitting(true);
    const res = await sendPhoneOtp(clean, 'recaptcha-modal-container');
    setSubmitting(false);
    if (res.success && res.confirmationResult) {
      setConfirmationResult(res.confirmationResult);
      setOtpSent(true);
    } else {
      setFormError(res.error || 'Failed to send OTP. Please check your number.');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!otpCode || otpCode.trim().length < 6) {
      setFormError('Please enter the 6-digit OTP received via SMS');
      return;
    }
    setSubmitting(true);
    const res = await verifyPhoneOtp(confirmationResult, otpCode.trim(), regName || undefined);
    setSubmitting(false);
    if (!res.success) {
      setFormError(res.error || 'Invalid OTP code');
    }
  };

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    let res;
    if (authMode === 'login') {
      res = await loginWithEmail(emailInput, emailPassword);
    } else {
      res = await registerWithEmail(emailInput, emailPassword, regName, regPhone);
    }
    setSubmitting(false);
    if (!res.success) {
      setFormError(res.error || 'Authentication failed');
    }
  };

  const handlePasswordRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!forgotPasswordEmail) {
      setFormError('Please enter your registered email address');
      return;
    }
    setSubmitting(true);
    const res = await sendPasswordReset(forgotPasswordEmail);
    setSubmitting(false);
    if (res.success) {
      setShowForgotPassword(false);
    } else {
      setFormError(res.error || 'Failed to send password recovery email');
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    const res = await loginCustomer(loginPhone, loginPassword);
    setSubmitting(false);
    if (!res.success) {
      setFormError(res.error || 'Login failed');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    const initialAddress = regAddressLine.trim() ? {
      label: 'Home' as const,
      recipientName: regName.trim(),
      phone: regPhone.trim(),
      addressLine: regAddressLine.trim(),
      villageTown: regVillageTown.trim() || '',
      district: '',
      state: 'Tamil Nadu',
      pincode: regPincode.trim() || '',
      isDefault: true,
    } : undefined;

    const res = await registerCustomer({
      fullName: regName,
      phone: regPhone,
      password: regPassword,
      email: regEmail,
      initialAddress,
    });
    setSubmitting(false);
    if (!res.success) {
      setFormError(res.error || 'Registration failed');
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken) return;
    setUpdatingProfile(true);
    try {
      await api.updateProfile(authToken, { fullName: editName, email: editEmail });
      showToast('Profile updated successfully');
    } catch (err: any) {
      showToast(err.message || 'Failed to update profile');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleGpsInAddressForm = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation not supported on this device');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&addressdetails=1`
          );
          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            const streetParts = [addr.house_number, addr.road, addr.suburb].filter(Boolean);
            const street = streetParts.join(', ');
            const town = addr.village || addr.town || addr.city || '';
            const district = addr.state_district || addr.district || '';
            const pin = (addr.postcode || '').replace(/\D/g, '').slice(0, 6);
            if (street) setAddrLine(street);
            if (town) setAddrTown(town);
            if (district) setAddrDistrict(district);
            if (pin) setAddrPin(pin);
            showToast('GPS Location applied to form');
          }
        } catch {
          showToast('GPS detected, please verify fields');
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        showToast('Location permission denied or unavailable');
      }
    );
  };

  const handleStartEditAddress = (addr: CustomerAddress) => {
    setEditingAddressId(addr.id);
    setAddrLabel(addr.label);
    setAddrRecipient(addr.recipientName);
    setAddrPhone(addr.phone);
    setAddrLine(addr.addressLine);
    setAddrTown(addr.villageTown);
    setAddrDistrict(addr.district || '');
    setAddrPin(addr.pincode);
    setIsAddingAddress(true);
  };

  const handleSaveNewAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addrRecipient.trim() || !addrPhone.trim() || !addrLine.trim() || !addrTown.trim() || !addrPin.trim()) {
      showToast('Please fill all required address fields');
      return;
    }
    if (!/^[1-9][0-9]{5}$/.test(addrPin.trim())) {
      showToast('Please enter a valid 6-digit Indian PIN code');
      return;
    }

    if (editingAddressId) {
      const updated = await updateSavedAddress(editingAddressId, {
        label: addrLabel,
        recipientName: addrRecipient.trim(),
        phone: addrPhone.trim(),
        addressLine: addrLine.trim(),
        villageTown: addrTown.trim(),
        district: addrDistrict.trim(),
        state: 'Tamil Nadu',
        pincode: addrPin.trim(),
      });
      if (updated) {
        setIsAddingAddress(false);
        setEditingAddressId(null);
        setAddrLine('');
        setAddrTown('');
        setAddrDistrict('');
        setAddrPin('');
      }
    } else {
      const saved = await addSavedAddress({
        label: addrLabel,
        recipientName: addrRecipient.trim(),
        phone: addrPhone.trim(),
        addressLine: addrLine.trim(),
        villageTown: addrTown.trim(),
        district: addrDistrict.trim(),
        state: 'Tamil Nadu',
        pincode: addrPin.trim(),
        isDefault: savedAddresses.length === 0,
      });

      if (saved) {
        setIsAddingAddress(false);
        setAddrLine('');
        setAddrTown('');
        setAddrDistrict('');
        setAddrPin('');
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-stone-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-200 mb-5">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-[#2e5e43]" />
            <h2 className="font-bold text-stone-900 text-lg">
              {currentUser ? 'My Account' : 'Customer Account'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 text-sm font-semibold p-1"
          >
            ✕
          </button>
        </div>

        {/* NOT LOGGED IN STATE: LOGIN / REGISTER */}
        {!currentUser ? (
          <div>
            <div className="flex border-b border-stone-200 mb-5">
              <button
                onClick={() => {
                  setAuthMode('login');
                  setFormError('');
                }}
                className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                  authMode === 'login'
                    ? 'border-[#143728] text-[#143728]'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" /> Sign In
              </button>
              <button
                onClick={() => {
                  setAuthMode('register');
                  setFormError('');
                }}
                className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                  authMode === 'register'
                    ? 'border-[#143728] text-[#143728]'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" /> Create Account
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Google Sign In (One-click) */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs font-semibold rounded-xl flex items-center justify-center gap-2.5 shadow-2xs transition-all cursor-pointer mb-3"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-3 my-3">
              <div className="h-px bg-stone-200 flex-1"></div>
              <span className="text-[11px] text-stone-400 uppercase font-medium">Or choose method</span>
              <div className="h-px bg-stone-200 flex-1"></div>
            </div>

            {/* Method Toggle */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-stone-100 rounded-xl mb-4 text-[11px] font-semibold text-stone-600">
              <button
                type="button"
                onClick={() => { setAuthMethod('password'); setFormError(''); }}
                className={`py-1.5 rounded-lg transition-all ${authMethod === 'password' ? 'bg-white shadow-2xs text-[#143728] font-bold' : 'hover:text-stone-900'}`}
              >
                Mobile + Pass
              </button>
              <button
                type="button"
                onClick={() => { setAuthMethod('otp'); setFormError(''); }}
                className={`py-1.5 rounded-lg transition-all ${authMethod === 'otp' ? 'bg-white shadow-2xs text-[#143728] font-bold' : 'hover:text-stone-900'}`}
              >
                Phone OTP
              </button>
              <button
                type="button"
                onClick={() => { setAuthMethod('email'); setFormError(''); }}
                className={`py-1.5 rounded-lg transition-all ${authMethod === 'email' ? 'bg-white shadow-2xs text-[#143728] font-bold' : 'hover:text-stone-900'}`}
              >
                Email
              </button>
            </div>

            <div id="recaptcha-modal-container"></div>

            {/* PHONE OTP AUTH FLOW */}
            {authMethod === 'otp' ? (
              <div className="space-y-4">
                {!otpSent ? (
                  <form onSubmit={handleSendOtp} className="space-y-3.5">
                    <p className="text-xs text-stone-500">
                      Sign in or register instantly by receiving a secure OTP via SMS to your mobile phone.
                    </p>
                    {authMode === 'register' && (
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">Full Name</label>
                        <input
                          type="text"
                          required
                          value={regName}
                          onChange={(e) => setRegName(e.target.value)}
                          placeholder="Your Name"
                          className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">Mobile Number (India) *</label>
                      <div className="flex">
                        <span className="inline-flex items-center px-3 text-xs bg-stone-100 border border-r-0 border-stone-200 rounded-l-xl text-stone-600 font-semibold">+91</span>
                        <input
                          type="tel"
                          required
                          maxLength={10}
                          value={otpPhone}
                          onChange={(e) => setOtpPhone(e.target.value)}
                          placeholder="10-digit mobile number"
                          className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-r-xl text-xs focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-2.5 bg-[#143728] text-white text-xs font-bold rounded-xl hover:bg-[#204e37] transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {submitting ? 'Sending OTP via SMS...' : 'Send OTP via SMS'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-3.5">
                    <p className="text-xs text-stone-500">
                      Enter the 6-digit verification code sent to +91 {otpPhone}.
                    </p>
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">6-Digit OTP Code *</label>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        placeholder="e.g. 123456"
                        className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs tracking-widest text-center font-bold text-stone-800 focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setOtpSent(false); setOtpCode(''); }}
                        className="flex-1 py-2.5 border border-stone-300 text-stone-700 text-xs font-semibold rounded-xl hover:bg-stone-50"
                      >
                        Change Number
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="flex-1 py-2.5 bg-[#143728] text-white text-xs font-bold rounded-xl hover:bg-[#204e37] transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {submitting ? 'Verifying...' : 'Verify OTP'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : authMethod === 'email' ? (
              /* EMAIL & PASSWORD AUTH FLOW */
              <div className="space-y-3.5">
                {showForgotPassword ? (
                  <form onSubmit={handlePasswordRecovery} className="space-y-3">
                    <p className="text-xs text-stone-500">
                      Enter your email address to receive a secure password recovery link.
                    </p>
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">Email Address *</label>
                      <input
                        type="email"
                        required
                        value={forgotPasswordEmail}
                        onChange={(e) => setForgotPasswordEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(false)}
                        className="flex-1 py-2.5 border border-stone-300 text-stone-700 text-xs font-semibold rounded-xl hover:bg-stone-50"
                      >
                        Back to Login
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="flex-1 py-2.5 bg-[#143728] text-white text-xs font-bold rounded-xl hover:bg-[#204e37] transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {submitting ? 'Sending...' : 'Send Recovery Link'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleEmailAuthSubmit} className="space-y-3.5">
                    {authMode === 'register' && (
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">Full Name *</label>
                        <input
                          type="text"
                          required
                          value={regName}
                          onChange={(e) => setRegName(e.target.value)}
                          placeholder="Your Name"
                          className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">Email Address *</label>
                      <input
                        type="email"
                        required
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-stone-700">Password *</label>
                        {authMode === 'login' && (
                          <button
                            type="button"
                            onClick={() => { setShowForgotPassword(true); setForgotPasswordEmail(emailInput); }}
                            className="text-[11px] text-[#143728] hover:underline font-semibold"
                          >
                            Forgot Password?
                          </button>
                        )}
                      </div>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={emailPassword}
                        onChange={(e) => setEmailPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-2.5 bg-[#143728] text-white text-xs font-bold rounded-xl hover:bg-[#204e37] transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {submitting ? 'Processing...' : authMode === 'login' ? 'Sign In with Email' : 'Register with Email'}
                    </button>
                  </form>
                )}
              </div>
            ) : authMode === 'login' ? (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <p className="text-xs text-stone-500">
                  Log in to access your orders, track deliveries, and manage saved delivery addresses.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={loginPhone}
                    onChange={(e) => setLoginPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Password *
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
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-[#143728] text-white text-xs font-bold rounded-xl hover:bg-[#204e37] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? 'Signing in...' : 'Sign In to My Account'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                <p className="text-xs text-stone-500">
                  Create an account to save your delivery addresses and track all your fresh tea orders.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Mobile Number *
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
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Create Password *
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

                <div className="pt-2 border-t border-stone-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-stone-700">Delivery Address (Optional)</span>
                    <button
                      type="button"
                      onClick={handleGpsInAddressForm}
                      disabled={locating}
                      className="text-[11px] text-[#143728] font-semibold hover:underline flex items-center gap-1"
                    >
                      <Navigation className="w-3 h-3 text-[#2e5e43]" />
                      {locating ? 'GPS...' : 'Use GPS'}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={regAddressLine}
                    onChange={(e) => setRegAddressLine(e.target.value)}
                    placeholder="Door No, Street Name"
                    className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs mb-2 focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={regVillageTown}
                      onChange={(e) => setRegVillageTown(e.target.value)}
                      placeholder="Village / Town"
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                    />
                    <input
                      type="text"
                      maxLength={6}
                      value={regPincode}
                      onChange={(e) => setRegPincode(e.target.value)}
                      placeholder="PIN (e.g. 638109)"
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-[#143728] text-white text-xs font-bold rounded-xl hover:bg-[#204e37] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? 'Creating account...' : 'Create Account & Continue'}
                </button>
              </form>
            )}
          </div>
        ) : (
          /* LOGGED IN CUSTOMER DASHBOARD */
          <div>
            {/* User profile strip */}
            <div className="flex items-center justify-between bg-stone-50 p-3.5 rounded-2xl mb-4 border border-stone-200">
              <div className="min-w-0">
                <div className="font-bold text-stone-900 text-xs truncate">
                  {currentUser.fullName}
                </div>
                <div className="text-stone-500 text-[11px]">
                  +91 {currentUser.phone} {currentUser.email && `• ${currentUser.email}`}
                </div>
              </div>
              <button
                onClick={logoutCustomer}
                className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800 font-semibold px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors"
                title="Log Out"
              >
                <LogOut className="w-3.5 h-3.5" /> Logout
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-1.5 border-b border-stone-200 pb-2 mb-4 overflow-x-auto">
              <button
                onClick={() => setActiveTab('orders')}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                  activeTab === 'orders' ? 'bg-[#143728] text-white' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                My Orders ({orders.length})
              </button>
              <button
                onClick={() => setActiveTab('addresses')}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                  activeTab === 'addresses' ? 'bg-[#143728] text-white' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                Saved Addresses ({savedAddresses.length})
              </button>
              <button
                onClick={() => setActiveTab('profile')}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                  activeTab === 'profile' ? 'bg-[#143728] text-white' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                Profile Info
              </button>
              <button
                onClick={() => setActiveTab('wishlist')}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                  activeTab === 'wishlist' ? 'bg-[#143728] text-white' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                Wishlist ({wishlist.length})
              </button>
            </div>

            {/* TAB 1: ORDERS */}
            {activeTab === 'orders' && (
              <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
                {loadingOrders ? (
                  <div className="text-center py-8 text-stone-500 text-xs flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#2e5e43]" /> Loading your orders...
                  </div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-8 text-stone-500 text-xs">
                    <Package className="w-10 h-10 text-stone-300 mx-auto mb-2" />
                    No orders placed yet. Fresh tea powder will appear here!
                  </div>
                ) : (
                  orders.map((ord) => (
                    <div
                      key={ord.id}
                      className="p-3.5 bg-stone-50 border border-stone-200 rounded-2xl space-y-2 text-xs"
                    >
                      <div className="flex justify-between font-bold text-stone-900">
                        <span>{ord.orderNumber}</span>
                        <span className="text-[#2e5e43]">₹{ord.totalAmount}</span>
                      </div>
                      <div className="text-stone-500 text-[11px]">
                        {new Date(ord.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })} • {ord.paymentMethod} ({ord.paymentStatus})
                      </div>
                      <div className="text-stone-600 text-[11px] truncate">
                        {ord.items.map((i) => `${i.productName} (${i.weight}) × ${i.quantity}`).join(', ')}
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-stone-200">
                        <span className="font-semibold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded text-[10px]">
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

            {/* TAB 2: SAVED ADDRESSES */}
            {activeTab === 'addresses' && (
              <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
                {!isAddingAddress ? (
                  <>
                    <button
                      onClick={() => {
                        setIsAddingAddress(true);
                        setAddrRecipient(currentUser.fullName);
                        setAddrPhone(currentUser.phone);
                      }}
                      className="w-full py-2.5 border-2 border-dashed border-stone-300 rounded-xl text-xs font-semibold text-stone-600 hover:border-[#2e5e43] hover:text-[#143728] transition-all flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add New Delivery Address
                    </button>

                    {savedAddresses.length === 0 ? (
                      <div className="text-center py-6 text-stone-500 text-xs">
                        <MapPin className="w-8 h-8 text-stone-300 mx-auto mb-1.5" />
                        No saved delivery addresses. Add your home or office address for faster checkout.
                      </div>
                    ) : (
                      savedAddresses.map((addr) => (
                        <div
                          key={addr.id}
                          className="p-3.5 bg-stone-50 border border-stone-200 rounded-2xl relative text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-stone-900 flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-[#2e5e43]" />
                              {addr.label}
                            </span>
                            <div className="flex items-center gap-2">
                              {addr.isDefault ? (
                                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                                  Default
                                </span>
                              ) : (
                                <button
                                  onClick={() => updateSavedAddress(addr.id, { isDefault: true })}
                                  className="text-[11px] text-stone-500 hover:text-[#2e5e43] hover:underline"
                                >
                                  Make Default
                                </button>
                              )}
                              <button
                                onClick={() => handleStartEditAddress(addr)}
                                className="text-stone-400 hover:text-[#2e5e43] p-0.5"
                                title="Edit address"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => deleteSavedAddress(addr.id)}
                                className="text-stone-400 hover:text-rose-600 p-0.5"
                                title="Delete address"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <div className="font-semibold text-stone-800 text-[11px]">
                            {addr.recipientName} • +91 {addr.phone}
                          </div>
                          <div className="text-stone-600 text-[11px]">
                            {addr.addressLine}, {addr.villageTown} - {addr.pincode}
                          </div>
                        </div>
                      ))
                    )}
                  </>
                ) : (
                  /* Form to add or edit address */
                  <form onSubmit={handleSaveNewAddress} className="space-y-3 bg-stone-50 p-4 rounded-2xl border border-stone-200 text-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-stone-200">
                      <span className="font-bold text-stone-900">
                        {editingAddressId ? 'Edit Delivery Address' : 'New Delivery Address'}
                      </span>
                      <button
                        type="button"
                        onClick={handleGpsInAddressForm}
                        disabled={locating}
                        className="text-[11px] text-[#143728] font-semibold hover:underline flex items-center gap-1"
                      >
                        <Navigation className="w-3 h-3 text-[#2e5e43]" />
                        {locating ? 'Detecting...' : 'Use GPS'}
                      </button>
                    </div>

                    <div className="flex gap-2">
                      {(['Home', 'Work', 'Other'] as const).map((lbl) => (
                        <button
                          key={lbl}
                          type="button"
                          onClick={() => setAddrLabel(lbl)}
                          className={`flex-1 py-1.5 rounded-lg font-semibold border transition-all ${
                            addrLabel === lbl
                              ? 'bg-[#143728] text-white border-[#143728]'
                              : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                          }`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-700 mb-0.5">
                          Recipient Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={addrRecipient}
                          onChange={(e) => setAddrRecipient(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-700 mb-0.5">
                          Phone Number *
                        </label>
                        <input
                          type="tel"
                          required
                          maxLength={10}
                          value={addrPhone}
                          onChange={(e) => setAddrPhone(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-stone-700 mb-0.5">
                        Street Address / Door No *
                      </label>
                      <input
                        type="text"
                        required
                        value={addrLine}
                        onChange={(e) => setAddrLine(e.target.value)}
                        placeholder="Door no, Street name"
                        className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-700 mb-0.5">
                          Village / Town *
                        </label>
                        <input
                          type="text"
                          required
                          value={addrTown}
                          onChange={(e) => setAddrTown(e.target.value)}
                          placeholder="e.g. Sivagiri"
                          className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-700 mb-0.5">
                          PIN Code *
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={6}
                          value={addrPin}
                          onChange={(e) => setAddrPin(e.target.value)}
                          placeholder="638109"
                          className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="submit"
                        className="flex-1 py-2 bg-[#143728] text-white font-bold rounded-lg hover:bg-[#204e37] transition-all"
                      >
                        {editingAddressId ? 'Save Changes' : 'Save Address'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingAddress(false);
                          setEditingAddressId(null);
                        }}
                        className="px-3 py-2 bg-stone-200 text-stone-700 rounded-lg font-semibold hover:bg-stone-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* TAB 3: PROFILE */}
            {activeTab === 'profile' && (
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Mobile Phone (Verified)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={`+91 ${currentUser.phone}`}
                    className="w-full px-3.5 py-2 bg-stone-100 text-stone-500 border border-stone-200 rounded-xl text-xs cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-[#2e5e43]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={updatingProfile}
                  className="w-full py-2.5 bg-[#143728] text-white text-xs font-bold rounded-xl hover:bg-[#204e37] transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {updatingProfile ? 'Saving updates...' : 'Save Profile Details'}
                </button>
              </form>
            )}

            {/* TAB 4: WISHLIST */}
            {activeTab === 'wishlist' && (
              <div className="py-6 text-center text-xs text-stone-600">
                <Heart className="w-8 h-8 text-rose-400 mx-auto mb-2" />
                You have {wishlist.length} item(s) saved in your favorites.
                <p className="text-[11px] text-stone-500 mt-1">
                  Access your wishlist directly from the top navigation bar to add them to your cart.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
