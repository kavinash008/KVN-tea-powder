import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Product, CartItem, BusinessConfig, CustomerUser, CustomerAddress } from '../types';
import { db } from '../lib/db';
import { api } from '../lib/api';
import { INITIAL_PRODUCTS } from '../data/initialData';
import {
  auth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  isFirebaseConfigured,
} from '../lib/firebase';

interface ShopContextType {
  // Products
  products: Product[];
  refreshProducts: () => Promise<void>;

  // Cart
  cart: CartItem[];
  addToCart: (product: Product, variantId?: string, quantity?: number) => void;
  updateCartQuantity: (variantId: string, quantity: number) => void;
  removeFromCart: (variantId: string) => void;
  clearCart: () => void;
  cartCount: number;
  cartSubtotal: number;
  
  // Wishlist
  wishlist: string[];
  toggleWishlist: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Config
  config: BusinessConfig;
  refreshConfig: () => void;

  // Customer Auth
  currentUser: CustomerUser | null;
  authToken: string | null;
  savedAddresses: CustomerAddress[];
  isFirebaseAvailable: boolean;
  loginCustomer: (phone: string, password: string) => Promise<{ success: boolean; error?: string }>;
  registerCustomer: (data: {
    fullName: string;
    phone: string;
    password: string;
    email?: string;
    initialAddress?: Partial<CustomerAddress>;
  }) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  loginWithEmail: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  registerWithEmail: (email: string, pass: string, fullName: string, phone?: string) => Promise<{ success: boolean; error?: string }>;
  sendPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
  sendPhoneOtp: (phone: string, containerId: string) => Promise<{ success: boolean; confirmationResult?: any; error?: string }>;
  verifyPhoneOtp: (confirmationResult: any, code: string, fullName?: string) => Promise<{ success: boolean; error?: string }>;
  logoutCustomer: () => void;
  refreshUserProfile: () => Promise<void>;
  addSavedAddress: (address: Omit<CustomerAddress, 'id'>) => Promise<CustomerAddress | null>;
  updateSavedAddress: (id: string, updates: Partial<CustomerAddress>) => Promise<CustomerAddress | null>;
  deleteSavedAddress: (id: string) => Promise<boolean>;

  // Toast
  toastMessage: string | null;
  toast?: string | null;
  showToast: (msg: string) => void;
}

export const ShopContext = createContext<ShopContextType | undefined>(undefined);

export const ShopProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const local = db.getProducts();
      return local && local.length > 0 ? local : INITIAL_PRODUCTS;
    } catch {
      return INITIAL_PRODUCTS;
    }
  });

  const [cart, setCart] = useState<CartItem[]>(() => db.getCart());
  const [wishlist, setWishlist] = useState<string[]>(() => db.getWishlist());
  const [searchQuery, setSearchQuery] = useState('');
  const [config, setConfig] = useState<BusinessConfig>(() => db.getBusinessConfig());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Customer Auth State
  const [authToken, setAuthToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('kvn_customer_token');
    } catch {
      return null;
    }
  });

  const [currentUser, setCurrentUser] = useState<CustomerUser | null>(() => {
    try {
      const stored = localStorage.getItem('kvn_customer_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>(() => {
    return currentUser?.addresses || [];
  });

  const isFirebaseAvailable = isFirebaseConfigured();

  // Load live products from backend
  const refreshProducts = useCallback(async () => {
    try {
      const serverProducts = await api.getProducts();
      if (serverProducts && serverProducts.length > 0) {
        setProducts(serverProducts);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refreshProducts();
  }, [refreshProducts]);

  // Sync cart to local storage
  useEffect(() => {
    db.saveCart(cart);
  }, [cart]);

  // Sync config updates
  useEffect(() => {
    const handleUpdate = () => {
      setConfig(db.getBusinessConfig());
    };
    window.addEventListener('kvn_store_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('kvn_store_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 3000);
  }, []);

  // Fetch verified user profile on load if token exists
  const refreshUserProfile = useCallback(async () => {
    if (!authToken) return;
    try {
      const { user } = await api.getMe(authToken);
      setCurrentUser(user);
      setSavedAddresses(user.addresses || []);
      try {
        localStorage.setItem('kvn_customer_user', JSON.stringify(user));
      } catch {
        // ignore
      }
    } catch (err) {
      console.warn('Session expired or invalid, logging out customer');
      setAuthToken(null);
      setCurrentUser(null);
      setSavedAddresses([]);
      try {
        localStorage.removeItem('kvn_customer_token');
        localStorage.removeItem('kvn_customer_user');
      } catch {
        // ignore
      }
    }
  }, [authToken]);

  useEffect(() => {
    if (authToken) {
      refreshUserProfile();
    }
  }, [authToken, refreshUserProfile]);

  const loginCustomer = async (phone: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { user, token } = await api.login(phone, password);
      setAuthToken(token);
      setCurrentUser(user);
      setSavedAddresses(user.addresses || []);
      try {
        localStorage.setItem('kvn_customer_token', token);
        localStorage.setItem('kvn_customer_user', JSON.stringify(user));
      } catch {
        // ignore
      }
      showToast(`Welcome back, ${user.fullName}!`);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login failed' };
    }
  };

  const registerCustomer = async (data: {
    fullName: string;
    phone: string;
    password: string;
    email?: string;
    initialAddress?: Partial<CustomerAddress>;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const { user, token } = await api.register(data);
      setAuthToken(token);
      setCurrentUser(user);
      setSavedAddresses(user.addresses || []);
      try {
        localStorage.setItem('kvn_customer_token', token);
        localStorage.setItem('kvn_customer_user', JSON.stringify(user));
      } catch {
        // ignore
      }
      showToast(`Account created! Welcome, ${user.fullName}`);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Registration failed' };
    }
  };

  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!auth) throw new Error('Firebase Auth is not initialized');
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const fbUser = result.user;

      const { user, token } = await api.syncFirebaseAuth({
        uid: fbUser.uid,
        email: fbUser.email || undefined,
        phone: fbUser.phoneNumber || undefined,
        fullName: fbUser.displayName || 'Valued Customer',
        authProvider: 'google',
        emailVerified: fbUser.emailVerified,
        phoneVerified: Boolean(fbUser.phoneNumber),
      });

      setAuthToken(token);
      setCurrentUser(user);
      setSavedAddresses(user.addresses || []);
      try {
        localStorage.setItem('kvn_customer_token', token);
        localStorage.setItem('kvn_customer_user', JSON.stringify(user));
      } catch {}
      showToast(`Welcome, ${user.fullName}!`);
      return { success: true };
    } catch (err: any) {
      console.error('Google Sign-In error:', err);
      return { success: false, error: err.message || 'Google Sign-In failed' };
    }
  };

  const loginWithEmail = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!auth) throw new Error('Firebase Auth is not initialized');
      const result = await signInWithEmailAndPassword(auth, email.trim(), pass);
      const fbUser = result.user;

      const { user, token } = await api.syncFirebaseAuth({
        uid: fbUser.uid,
        email: fbUser.email || email.trim(),
        fullName: fbUser.displayName || 'Valued Customer',
        authProvider: 'email',
        emailVerified: fbUser.emailVerified,
      });

      setAuthToken(token);
      setCurrentUser(user);
      setSavedAddresses(user.addresses || []);
      try {
        localStorage.setItem('kvn_customer_token', token);
        localStorage.setItem('kvn_customer_user', JSON.stringify(user));
      } catch {}
      showToast(`Welcome back, ${user.fullName}!`);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Email sign-in failed' };
    }
  };

  const registerWithEmail = async (
    email: string,
    pass: string,
    fullName: string,
    phone?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!auth) throw new Error('Firebase Auth is not initialized');
      const result = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      const fbUser = result.user;

      try {
        await sendEmailVerification(fbUser);
      } catch (e) {
        console.warn('Could not send verification email:', e);
      }

      const { user, token } = await api.syncFirebaseAuth({
        uid: fbUser.uid,
        email: email.trim(),
        phone: phone ? phone.replace(/\D/g, '').slice(-10) : undefined,
        fullName: fullName.trim(),
        authProvider: 'email',
        emailVerified: false,
      });

      setAuthToken(token);
      setCurrentUser(user);
      setSavedAddresses(user.addresses || []);
      try {
        localStorage.setItem('kvn_customer_token', token);
        localStorage.setItem('kvn_customer_user', JSON.stringify(user));
      } catch {}
      showToast(`Account created! A verification email was sent to ${email}`);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Registration failed' };
    }
  };

  const sendPasswordReset = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!auth) throw new Error('Firebase Auth is not initialized');
      await sendPasswordResetEmail(auth, email.trim());
      showToast(`Password recovery link sent to ${email}`);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to send password reset email' };
    }
  };

  const sendPhoneOtp = async (phone: string, containerId: string): Promise<{ success: boolean; confirmationResult?: any; error?: string }> => {
    try {
      if (!auth) throw new Error('Firebase Auth is not initialized');
      const cleanPhone = phone.replace(/\D/g, '').slice(-10);
      const formattedPhone = `+91${cleanPhone}`;

      if ((window as any).recaptchaVerifier) {
        try {
          (window as any).recaptchaVerifier.clear();
        } catch {}
      }

      const appVerifier = new RecaptchaVerifier(auth, containerId, {
        size: 'invisible',
      });
      (window as any).recaptchaVerifier = appVerifier;

      const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      showToast(`OTP sent to ${formattedPhone}`);
      return { success: true, confirmationResult };
    } catch (err: any) {
      console.error('Phone OTP error:', err);
      return { success: false, error: err.message || 'Failed to send OTP' };
    }
  };

  const verifyPhoneOtp = async (confirmationResult: any, code: string, fullName?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!confirmationResult) throw new Error('No active OTP request found');
      const result = await confirmationResult.confirm(code);
      const fbUser = result.user;

      const { user, token } = await api.syncFirebaseAuth({
        uid: fbUser.uid,
        phone: fbUser.phoneNumber || undefined,
        fullName: fullName || fbUser.displayName || 'Valued Customer',
        authProvider: 'phone',
        phoneVerified: true,
      });

      setAuthToken(token);
      setCurrentUser(user);
      setSavedAddresses(user.addresses || []);
      try {
        localStorage.setItem('kvn_customer_token', token);
        localStorage.setItem('kvn_customer_user', JSON.stringify(user));
      } catch {}
      showToast(`Phone verified! Welcome, ${user.fullName}`);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Invalid OTP code' };
    }
  };

  const logoutCustomer = () => {
    if (auth) {
      signOut(auth).catch(() => {});
    }
    setAuthToken(null);
    setCurrentUser(null);
    setSavedAddresses([]);
    try {
      localStorage.removeItem('kvn_customer_token');
      localStorage.removeItem('kvn_customer_user');
    } catch {
      // ignore
    }
    showToast('Logged out of your customer account');
  };

  const addSavedAddress = async (address: Omit<CustomerAddress, 'id'>): Promise<CustomerAddress | null> => {
    if (!authToken) return null;
    try {
      const newAddr = await api.addAddress(authToken, address);
      await refreshUserProfile();
      showToast('New address saved to your account');
      return newAddr;
    } catch (err: any) {
      showToast(err.message || 'Failed to save address');
      return null;
    }
  };

  const updateSavedAddress = async (id: string, updates: Partial<CustomerAddress>): Promise<CustomerAddress | null> => {
    if (!authToken) return null;
    try {
      const updated = await api.updateAddress(authToken, id, updates);
      await refreshUserProfile();
      showToast('Address updated');
      return updated;
    } catch (err: any) {
      showToast(err.message || 'Failed to update address');
      return null;
    }
  };

  const deleteSavedAddress = async (id: string): Promise<boolean> => {
    if (!authToken) return false;
    try {
      await api.deleteAddress(authToken, id);
      await refreshUserProfile();
      showToast('Address removed');
      return true;
    } catch (err: any) {
      showToast(err.message || 'Failed to delete address');
      return false;
    }
  };

  const addToCart = (product: Product, variantId?: string, quantity: number = 1) => {
    const selectedVariant = variantId 
      ? product.variants.find((v) => v.id === variantId) || product.variants[0]
      : product.variants[0];

    if (!selectedVariant) {
      showToast('Variant not available');
      return;
    }

    if (selectedVariant.stock <= 0) {
      showToast('Selected weight is currently out of stock');
      return;
    }

    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.variantId === selectedVariant.id);
      if (existingIndex > -1) {
        const updated = [...prev];
        const newQty = updated[existingIndex].quantity + quantity;
        if (newQty > selectedVariant.stock) {
          showToast(`Only ${selectedVariant.stock} units available in stock`);
          updated[existingIndex].quantity = selectedVariant.stock;
        } else {
          updated[existingIndex].quantity = newQty;
          showToast(`Updated ${product.name} (${selectedVariant.weight}) quantity`);
        }
        return updated;
      } else {
        const newItem: CartItem = {
          productId: product.id,
          productName: product.name,
          productImage: product.images[0] || '',
          category: product.mainCategory,
          variantId: selectedVariant.id,
          weight: selectedVariant.weight,
          unitPrice: selectedVariant.sellingPrice,
          mrp: selectedVariant.mrp,
          quantity: Math.min(quantity, selectedVariant.stock),
        };
        showToast(`Added ${product.name} (${selectedVariant.weight}) to cart`);
        return [...prev, newItem];
      }
    });
  };

  const updateCartQuantity = (variantId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(variantId);
      return;
    }

    // Verify stock limit
    const products = db.getProducts();
    let maxStock = 999;
    for (const p of products) {
      const v = p.variants.find((vr) => vr.id === variantId);
      if (v) {
        maxStock = v.stock;
        break;
      }
    }

    const safeQty = Math.min(quantity, maxStock);
    if (quantity > maxStock) {
      showToast(`Maximum stock limit is ${maxStock}`);
    }

    setCart((prev) =>
      prev.map((item) =>
        item.variantId === variantId ? { ...item, quantity: safeQty } : item
      )
    );
  };

  const removeFromCart = (variantId: string) => {
    setCart((prev) => prev.filter((item) => item.variantId !== variantId));
    showToast('Item removed from cart');
  };

  const clearCart = () => {
    setCart([]);
    db.clearCart();
  };

  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const cartSubtotal = cart.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);

  const toggleWishlist = (productId: string) => {
    const updated = db.toggleWishlist(productId);
    setWishlist(updated);
    if (updated.includes(productId)) {
      showToast('Saved to wishlist');
    } else {
      showToast('Removed from wishlist');
    }
  };

  const isInWishlist = (productId: string) => wishlist.includes(productId);

  const refreshConfig = () => {
    setConfig(db.getBusinessConfig());
  };

  return (
    <ShopContext.Provider
      value={{
        products,
        refreshProducts,
        cart,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        cartCount,
        cartSubtotal,
        wishlist,
        toggleWishlist,
        isInWishlist,
        searchQuery,
        setSearchQuery,
        config,
        refreshConfig,
        currentUser,
        authToken,
        savedAddresses,
        isFirebaseAvailable,
        loginCustomer,
        registerCustomer,
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        sendPasswordReset,
        sendPhoneOtp,
        verifyPhoneOtp,
        logoutCustomer,
        refreshUserProfile,
        addSavedAddress,
        updateSavedAddress,
        deleteSavedAddress,
        toastMessage,
        toast: toastMessage,
        showToast,
      }}
    >
      {children}
      {/* Global Toast Notification */}
      {toastMessage && (
        <div 
          id="toast-notification"
          className="fixed bottom-6 right-6 z-50 bg-[#143728] text-[#faf7f2] px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-[#2e5e43] animate-bounce-short text-sm font-medium"
        >
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          {toastMessage}
        </div>
      )}
    </ShopContext.Provider>
  );
};

export const useShop = () => {
  const context = useContext(ShopContext);
  if (!context) {
    throw new Error('useShop must be used within a ShopProvider');
  }
  return context;
};
