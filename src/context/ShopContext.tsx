import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product, CartItem, BusinessConfig } from '../types';
import { db } from '../lib/db';

interface ShopContextType {
  cart: CartItem[];
  addToCart: (product: Product, variantId?: string, quantity?: number) => void;
  updateCartQuantity: (variantId: string, quantity: number) => void;
  removeFromCart: (variantId: string) => void;
  clearCart: () => void;
  cartCount: number;
  cartSubtotal: number;
  
  wishlist: string[];
  toggleWishlist: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;

  searchQuery: string;
  setSearchQuery: (query: string) => void;

  config: BusinessConfig;
  refreshConfig: () => void;

  toastMessage: string | null;
  toast?: string | null;
  showToast: (msg: string) => void;
}

export const ShopContext = createContext<ShopContextType | undefined>(undefined);

export const ShopProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>(() => db.getCart());
  const [wishlist, setWishlist] = useState<string[]>(() => db.getWishlist());
  const [searchQuery, setSearchQuery] = useState('');
  const [config, setConfig] = useState<BusinessConfig>(() => db.getBusinessConfig());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    db.saveCart(cart);
  }, [cart]);

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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 3000);
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
