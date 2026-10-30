import React, { useState, useMemo, useContext, useEffect } from 'react';
import { useShop, ShopContext, ShopProvider } from './context/ShopContext';
import { db } from './lib/db';
import { api } from './lib/api';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ProductCard } from './components/ProductCard';
import { ProductDetailModal } from './components/ProductDetailModal';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutPage } from './components/CheckoutPage';
import { OrderConfirmation } from './components/OrderConfirmation';
import { OrderTracking } from './components/OrderTracking';
import { FeedbackPage } from './components/FeedbackPage';
import { ContactPage } from './components/ContactPage';
import { CustomerAccountModal } from './components/CustomerAccountModal';
import { AdminDashboard } from './components/AdminDashboard';
import { useScrollReveal } from './lib/useScrollReveal';
import { Product, Order } from './types';
import { 
  Sparkles, 
  Coffee, 
  Leaf, 
  CheckCircle2, 
  Search, 
  Phone, 
  MapPin, 
  ShieldCheck, 
  ArrowRight,
  ArrowUp,
  Filter,
  MessageSquare,
  Lock,
  Eye,
  EyeOff,
  Heart,
  Truck,
  RotateCcw,
  Award
} from 'lucide-react';

function AppContent() {
  const { config, toast, showToast, wishlist, products } = useShop();

  // Navigation page views
  const [currentPage, setCurrentPage] = useState<
    'home' | 'products' | 'checkout' | 'confirmation' | 'tracking' | 'feedback' | 'contact' | 'policies' | 'wishlist' | 'admin'
  >('home');

  // Selected filters
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'tea' | 'coffee' | 'combo'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const [trackingOrderId, setTrackingOrderId] = useState<string | undefined>(undefined);
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Admin authentication state
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(() => {
    try {
      return localStorage.getItem('kvn_admin_session') === 'active';
    } catch {
      return false;
    }
  });
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [rememberAdmin, setRememberAdmin] = useState(true);
  const [adminAuthError, setAdminAuthError] = useState('');

  // Live data queries synchronized in real-time with Admin Dashboard
  const [allProducts, setAllProducts] = useState<Product[]>(() =>
    db.getProducts().filter((p) => p.status === 'published')
  );
  const [banners, setBanners] = useState(() => db.getBanners());

  useEffect(() => {
    if (products && products.length > 0) {
      setAllProducts(products.filter((p) => p.status === 'published'));
    }
  }, [products]);

  useEffect(() => {
    const handleStoreUpdate = () => {
      setAllProducts(db.getProducts().filter((p) => p.status === 'published'));
      setBanners(db.getBanners());
    };
    window.addEventListener('kvn_store_updated', handleStoreUpdate);
    window.addEventListener('storage', handleStoreUpdate);
    return () => {
      window.removeEventListener('kvn_store_updated', handleStoreUpdate);
      window.removeEventListener('storage', handleStoreUpdate);
    };
  }, []);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return allProducts.filter((p) => {
      const matchCat = selectedCategory === 'all' || p.mainCategory === selectedCategory;
      const matchSearch =
        !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.categorySlug.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [allProducts, selectedCategory, searchQuery]);

  const newArrivals = allProducts.filter((p) => p.isNewArrival);
  const bestSellers = allProducts.filter((p) => p.isBestSeller);
  const wishlistedProducts = allProducts.filter((p) => wishlist.includes(p.id));

  // Initialize high-performance scroll reveal hook (runs off main thread, zero phone lag)
  useScrollReveal([currentPage, selectedCategory, filteredProducts.length]);

  // Handle URL hash changes (Direct access: #admin or ?admin=true)
  useEffect(() => {
    const handleUrlHash = () => {
      const hash = window.location.hash.toLowerCase();
      const search = window.location.search.toLowerCase();
      if (hash === '#admin' || hash === '#/admin' || search.includes('admin=true') || search.includes('page=admin')) {
        setCurrentPage('admin');
      }
    };

    handleUrlHash();
    window.addEventListener('hashchange', handleUrlHash);
    return () => window.removeEventListener('hashchange', handleUrlHash);
  }, []);

  // Keyboard shortcut for owner: Ctrl+Alt+A or Cmd+Alt+A
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        navigateTo('admin');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Monitor scroll for Back-To-Top button
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setShowBackToTop(window.scrollY > 300);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Switch view helper with smooth scroll to top
  const navigateTo = (page: string) => {
    if (page === 'admin' || page === 'admin-login') {
      setCurrentPage('admin');
      window.location.hash = 'admin';
    } else if (page === 'shop' || page === 'products') {
      setCurrentPage('products');
      setSelectedCategory('all');
    } else if (page === 'tea') {
      setCurrentPage('products');
      setSelectedCategory('tea');
    } else if (page === 'coffee') {
      setCurrentPage('products');
      setSelectedCategory('coffee');
    } else if (page === 'new-arrivals') {
      setCurrentPage('products');
      setSelectedCategory('all');
      setTimeout(() => {
        const el = document.getElementById('catalog-section');
        el?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    } else if (page === 'about') {
      setCurrentPage('home');
      setTimeout(() => {
        const el = document.getElementById('founder-story-section');
        el?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    } else if (page === 'wishlist') {
      setCurrentPage('wishlist');
    } else if (page === 'policies') {
      setCurrentPage('policies');
    } else {
      setCurrentPage(page as any);
      if (window.location.hash === '#admin') {
        history.replaceState(null, '', window.location.pathname);
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Admin login handler
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPassword = adminPasswordInput.trim();
    setAdminAuthError('');

    try {
      // Authenticate with server API
      const res = await api.adminLogin(cleanPassword);
      if (res && res.token) {
        localStorage.setItem('kvn_admin_token', res.token);
      }
      setIsAdminLoggedIn(true);
      if (rememberAdmin) {
        localStorage.setItem('kvn_admin_session', 'active');
      }
      showToast('Welcome Kavinash! Admin access granted.');
      return;
    } catch (err: any) {
      // Fallback check if server endpoint failed or unreachable
      if (cleanPassword === 'kavin008' || cleanPassword === '6383050287' || cleanPassword === '9787513911') {
        localStorage.setItem('kvn_admin_token', cleanPassword);
        setIsAdminLoggedIn(true);
        if (rememberAdmin) {
          localStorage.setItem('kvn_admin_session', 'active');
        }
        showToast('Welcome Kavinash! Admin access granted.');
        return;
      }
      setAdminAuthError(err.message || 'Invalid administrator passcode. Please try again.');
    }
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    try {
      localStorage.removeItem('kvn_admin_session');
      localStorage.removeItem('kvn_admin_token');
    } catch {
      // ignore
    }
    history.replaceState(null, '', window.location.pathname);
    setCurrentPage('home');
    showToast('Admin logged out successfully.');
  };

  // VIEW 1: DEDICATED ADMIN DASHBOARD (When authenticated)
  if (currentPage === 'admin' && isAdminLoggedIn) {
    return (
      <AdminDashboard
        onLogout={handleAdminLogout}
        onViewStore={() => {
          history.replaceState(null, '', window.location.pathname);
          setCurrentPage('home');
        }}
      />
    );
  }

  // VIEW 2: DEDICATED SEPARATE ADMIN LOGIN SCREEN (Private, not shown to customers)
  if (currentPage === 'admin' && !isAdminLoggedIn) {
    return (
      <div className="min-h-screen bg-[#143728] text-white flex flex-col justify-between p-4 sm:p-8 font-sans selection:bg-[#c29958] selection:text-stone-900">
        {/* Top bar with back to store */}
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-[#143728] font-bold flex items-center justify-center font-serif-brand text-lg shadow-sm">
              KVN
            </div>
            <div>
              <div className="font-bold text-sm sm:text-base leading-none text-white tracking-wide">
                KVN TEAPOWDER
              </div>
              <div className="text-[10px] text-amber-200/80 uppercase tracking-widest mt-0.5">
                Internal Console
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              history.replaceState(null, '', window.location.pathname);
              setCurrentPage('home');
            }}
            className="text-xs text-stone-300 hover:text-white px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-all cursor-pointer"
          >
            ← Return to Store
          </button>
        </div>

        {/* Center Login Box */}
        <div className="max-w-md mx-auto w-full my-auto py-8">
          <div className="bg-[#1f4a35] border border-[#2e5e43] rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-[#143728] border border-amber-400/30 text-amber-300 flex items-center justify-center mx-auto mb-3 shadow-inner">
                <Lock className="w-7 h-7" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold font-serif-brand text-stone-100">
                Owner Portal Access
              </h2>
              <p className="text-xs text-stone-300 mt-1.5 leading-relaxed">
                Restricted to business proprietor <strong>Kavinash</strong> & authorized operators.
              </p>
            </div>

            {adminAuthError && (
              <div className="p-3 bg-rose-900/60 border border-rose-500/60 text-rose-200 text-xs rounded-xl mb-4 text-center font-medium animate-in fade-in">
                {adminAuthError}
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-200 mb-1.5">
                  Administrator Passcode
                </label>
                <div className="relative">
                  <input
                    type={showAdminPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    value={adminPasswordInput}
                    onChange={(e) => setAdminPasswordInput(e.target.value)}
                    placeholder="Enter owner passcode"
                    className="w-full px-4 py-3 bg-[#143728] border border-[#2e5e43] rounded-xl text-xs sm:text-sm text-white placeholder-stone-400 focus:bg-[#143728] focus:outline-hidden focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-white"
                  >
                    {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2 text-[11px] text-stone-300">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberAdmin}
                      onChange={(e) => setRememberAdmin(e.target.checked)}
                      className="rounded accent-[#c29958]"
                    />
                    <span>Remember on this device</span>
                  </label>
                  <span className="text-stone-400">Default: <code>kavin008</code></span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-[#c29958] hover:bg-[#d4a867] text-stone-950 font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md active:scale-98 cursor-pointer mt-2"
              >
                Access Store Management Console
              </button>

              <button
                type="button"
                onClick={() => {
                  history.replaceState(null, '', window.location.pathname);
                  setCurrentPage('home');
                }}
                className="w-full text-center text-xs text-stone-300 hover:text-white py-2 transition-colors cursor-pointer"
              >
                ← Back to Customer Website
              </button>
            </form>
          </div>
        </div>

        {/* Bottom subtle note */}
        <div className="max-w-md mx-auto text-center text-[11px] text-stone-400 pb-4">
          KVN TEAPOWDER • Authorized Management Portal • Direct blenders in Tamil Nadu
        </div>
      </div>
    );
  }

  // VIEW 3: STANDARD CUSTOMER STORE FRONT
  return (
    <div className="min-h-screen bg-[#fcfaf7] text-stone-900 flex flex-col font-sans selection:bg-[#2e5e43]/20 selection:text-[#143728] relative">
      {/* Global Responsive Header (Optimized for mobile & laptop) */}
      <Header
        activePage={currentPage}
        onNavigate={navigateTo}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenAccount={() => setIsAccountOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full overflow-x-hidden">
        {/* VIEW: CHECKOUT PAGE */}
        {currentPage === 'checkout' && (
          <CheckoutPage
            onBack={() => navigateTo('home')}
            onOrderSuccess={(order) => {
              setConfirmedOrder(order);
              navigateTo('confirmation');
            }}
          />
        )}

        {/* VIEW: ORDER CONFIRMATION PAGE */}
        {currentPage === 'confirmation' && confirmedOrder && (
          <OrderConfirmation
            order={confirmedOrder}
            onContinueShopping={() => navigateTo('home')}
            onTrackOrder={(orderId) => {
              setTrackingOrderId(orderId);
              navigateTo('tracking');
            }}
          />
        )}

        {/* VIEW: ORDER TRACKING PAGE */}
        {currentPage === 'tracking' && (
          <OrderTracking
            initialOrderId={trackingOrderId}
            onBack={() => navigateTo('home')}
          />
        )}

        {/* VIEW: FEEDBACK PAGE */}
        {currentPage === 'feedback' && <FeedbackPage />}

        {/* VIEW: CONTACT PAGE */}
        {currentPage === 'contact' && <ContactPage />}

        {/* VIEW: POLICIES & GUARANTEE PAGE */}
        {currentPage === 'policies' && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8 animate-in fade-in duration-300">
            <div className="text-center space-y-2">
              <span className="text-xs font-bold uppercase tracking-widest text-[#2e5e43]">
                Customer Confidence
              </span>
              <h1 className="text-2xl sm:text-4xl font-bold font-serif-brand text-stone-900">
                Store Policies & Purity Promise
              </h1>
              <p className="text-xs sm:text-sm text-stone-600 max-w-xl mx-auto">
                Everything you need to know about our local packaging, delivery across Tamil Nadu, and customer satisfaction guarantee.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
              <div className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-2xs space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#143728] flex items-center justify-center">
                  <Award className="w-5 h-5 text-[#2e5e43]" />
                </div>
                <h3 className="font-bold text-sm text-stone-900">Zero Adulteration Guarantee</h3>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Every batch of KVN tea & coffee is prepared with strict adherence to natural estate leaves and roasted beans. No synthetic food coloring, fragrance sprays, or chicory fillers beyond labelled ratios.
                </p>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-2xs space-y-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center">
                  <Truck className="w-5 h-5 text-amber-700" />
                </div>
                <h3 className="font-bold text-sm text-stone-900">Village & Express Delivery</h3>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Orders are dispatched within 24 hours. Local village delivery is serviced personally by our team, while regional orders ship via trusted Tamil Nadu couriers with live tracking.
                </p>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-2xs space-y-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-800 flex items-center justify-center">
                  <RotateCcw className="w-5 h-5 text-rose-700" />
                </div>
                <h3 className="font-bold text-sm text-stone-900">7-Day Taste Guarantee</h3>
                <p className="text-xs text-stone-600 leading-relaxed">
                  If the taste, decoction strength, or aroma does not meet your household expectations, contact Kavinash directly at 6383050287 (or alternate: 9787513911) for an instant replacement or refund.
                </p>
              </div>
            </div>

            <div className="text-center pt-6">
              <button
                onClick={() => navigateTo('home')}
                className="px-6 py-3 bg-[#143728] text-white font-bold text-xs rounded-xl hover:bg-[#204e37] transition-all cursor-pointer"
              >
                Return to Shopping
              </button>
            </div>
          </div>
        )}

        {/* VIEW: WISHLIST PAGE */}
        {currentPage === 'wishlist' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-stone-200">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-[#2e5e43]">
                  Saved Favourites
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 mt-1">
                  My Wishlist ({wishlistedProducts.length})
                </h1>
                <p className="text-xs text-stone-500 mt-1">
                  Keep track of your favourite Nilgiri blends and coffee powders.
                </p>
              </div>

              <button
                onClick={() => navigateTo('products')}
                className="text-xs font-bold text-[#143728] hover:underline flex items-center gap-1.5"
              >
                Browse All Powders <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {wishlistedProducts.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 border border-stone-200 text-center max-w-md mx-auto space-y-4">
                <Heart className="w-12 h-12 text-stone-300 mx-auto" />
                <h3 className="font-bold text-stone-800 text-base">Your Wishlist is Empty</h3>
                <p className="text-xs text-stone-500 leading-relaxed">
                  Explore our authentic Nilgiri leaf teas and filter coffee powders, and tap the heart icon on any card to save your favourites.
                </p>
                <button
                  onClick={() => navigateTo('products')}
                  className="px-6 py-2.5 bg-[#143728] text-white font-bold text-xs rounded-xl hover:bg-[#204e37] transition-all"
                >
                  Explore Blends
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {wishlistedProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onSelectProduct={(p) => setSelectedProduct(p)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW: HOMEPAGE */}
        {currentPage === 'home' && (
          <div className="space-y-14 sm:space-y-20 pb-16">
            {/* HERO BANNER SECTION */}
            <section className="relative bg-gradient-to-b from-[#143728] via-[#1a4432] to-[#143728] text-white overflow-hidden pt-10 sm:pt-16 pb-14 sm:pb-22">
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
                  {/* Hero Left Content */}
                  <div className="lg:col-span-7 space-y-5 sm:space-y-6 text-center lg:text-left scroll-reveal">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs text-amber-300 font-medium backdrop-blur-xs">
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>Direct Estate Blended in Tamil Nadu</span>
                    </div>

                    <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.15] text-stone-100 font-serif-brand">
                      Pure Leaf Tea & Filter Coffee Powder.
                    </h1>

                    <p className="text-xs sm:text-base text-stone-200/90 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                      Small-batch, natural aroma blends crafted by <strong>Kavinash</strong>. Free from synthetic dyes, chemical flavors, or filler stalks.
                    </p>

                    {/* Trust Badges */}
                    <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 sm:gap-4 pt-1 text-xs text-stone-300">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-amber-400" />
                        <span>100% Pure Estate Leaves</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-amber-400" />
                        <span>Fresh Roasted & Ground</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-amber-400" />
                        <span>Doorstep Village Delivery</span>
                      </div>
                    </div>

                    {/* CTAs */}
                    <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 pt-3">
                      <button
                        onClick={() => {
                          const el = document.getElementById('catalog-section');
                          el?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="w-full sm:w-auto px-7 py-3.5 bg-[#c29958] hover:bg-[#d4a867] active:scale-95 text-stone-950 font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                      >
                        Explore Powders <ArrowRight className="w-4 h-4" />
                      </button>

                      <a
                        href={`https://wa.me/91${config.primaryPhone}?text=Hello%20Kavinash,%20I%20would%20like%20to%20order%20KVN%20TEAPOWDER.`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full sm:w-auto px-6 py-3.5 bg-white/10 hover:bg-white/15 active:scale-95 text-white border border-white/20 font-semibold text-xs sm:text-sm rounded-xl transition-all flex items-center justify-center gap-2"
                      >
                        <MessageSquare className="w-4 h-4 text-[#25D366]" />
                        Order on WhatsApp
                      </a>
                    </div>
                  </div>

                  {/* Hero Right Visual Banner */}
                  <div className="lg:col-span-5 relative scroll-reveal delay-100">
                    <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white/10 aspect-4/3 sm:aspect-5/4">
                      <img
                        src="https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=1000&q=85"
                        alt="KVN Tea & Coffee powders"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent flex flex-col justify-end p-5 sm:p-6">
                        <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                          KVN Signature Selection
                        </span>
                        <h3 className="text-base sm:text-xl font-bold text-white mt-1">
                          Strong Decoction & Rich Natural Froth
                        </h3>
                        <p className="text-xs text-stone-200 mt-1">
                          Freshly ground Nilgiri Tea & Coorg Filter Coffee.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* BRAND VALUE HIGHLIGHTS */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <div className="scroll-reveal bg-white p-5 sm:p-6 rounded-3xl border border-stone-200/80 shadow-2xs flex items-start gap-4 hover:shadow-md transition-all">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#2e5e43] flex items-center justify-center shrink-0 border border-emerald-100">
                    <Leaf className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-stone-900 text-sm">Garden Fresh Leaves</h4>
                    <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                      Sourced straight from trusted Nilgiri high-elevation estates with natural fragrance.
                    </p>
                  </div>
                </div>

                <div className="scroll-reveal delay-75 bg-white p-5 sm:p-6 rounded-3xl border border-stone-200/80 shadow-2xs flex items-start gap-4 hover:shadow-md transition-all">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 text-[#6d4c41] flex items-center justify-center shrink-0 border border-amber-100">
                    <Coffee className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-stone-900 text-sm">South Indian Filter Coffee</h4>
                    <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                      Traditional 80:20 & 70:30 blends roasted for dense crema and thick decoction.
                    </p>
                  </div>
                </div>

                <div className="scroll-reveal delay-150 bg-white p-5 sm:p-6 rounded-3xl border border-stone-200/80 shadow-2xs flex items-start gap-4 hover:shadow-md transition-all">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#2e5e43] flex items-center justify-center shrink-0 border border-emerald-100">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-stone-900 text-sm">Zero Adulteration</h4>
                    <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                      Strictly pure powder. Absolutely no synthetic dyes, chemical flavors, or starch fillers.
                    </p>
                  </div>
                </div>

                <div className="scroll-reveal delay-200 bg-white p-5 sm:p-6 rounded-3xl border border-stone-200/80 shadow-2xs flex items-start gap-4 hover:shadow-md transition-all">
                  <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-800 flex items-center justify-center shrink-0 border border-stone-200">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-stone-900 text-sm">Direct Doorstep Delivery</h4>
                    <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                      Local village delivery & express Tamil Nadu courier. Free delivery above ₹499.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* NEW ARRIVALS */}
            {newArrivals.length > 0 && (
              <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between mb-6 scroll-reveal">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-widest text-[#2e5e43]">
                      Freshly Packed Blends
                    </span>
                    <h2 className="text-xl sm:text-3xl font-bold text-stone-900 mt-1">
                      New Arrivals & Season Batches
                    </h2>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedCategory('all');
                      const el = document.getElementById('catalog-section');
                      el?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="text-xs font-bold text-[#2e5e43] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    View All <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                  {newArrivals.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onSelectProduct={(p) => setSelectedProduct(p)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* MAIN CATALOG & CATEGORY FILTERING */}
            <section id="catalog-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 pb-4 border-b border-stone-200 scroll-reveal">
                <div>
                  <span className="text-xs font-bold uppercase tracking-widest text-[#2e5e43]">
                    Genuine FMCG Catalog
                  </span>
                  <h2 className="text-xl sm:text-3xl font-bold text-stone-900 mt-1">
                    Explore KVN Tea & Coffee Powders
                  </h2>
                  <p className="text-xs text-stone-500 mt-1">
                    Choose from pure Nilgiri dust, strong leaf teas, and rich filter coffee blends.
                  </p>
                </div>

                {/* Category Pills */}
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { id: 'all', label: 'All Products' },
                    { id: 'tea', label: 'Tea Powders' },
                    { id: 'coffee', label: 'Filter Coffee' },
                    { id: 'combo', label: 'Family Combos' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id as any)}
                      className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        selectedCategory === cat.id
                          ? 'bg-[#143728] text-white shadow-xs'
                          : 'bg-white text-stone-700 border border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Product Grid */}
              {filteredProducts.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 border border-stone-200 text-center max-w-md mx-auto space-y-3">
                  <Leaf className="w-12 h-12 text-stone-300 mx-auto" />
                  <h3 className="font-bold text-stone-800 text-sm">No products found</h3>
                  <p className="text-xs text-stone-500">
                    Try adjusting your search query or selecting a different category.
                  </p>
                  <button
                    onClick={() => {
                      setSelectedCategory('all');
                      setSearchQuery('');
                    }}
                    className="px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-xl text-xs font-semibold text-stone-800 transition-all"
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                  {filteredProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onSelectProduct={(p) => setSelectedProduct(p)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* FOUNDER & STORY SECTION */}
            <section id="founder-story-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24">
              <div className="scroll-reveal bg-[#143728] text-white rounded-3xl overflow-hidden shadow-lg border border-emerald-900/40">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 sm:p-12 items-center">
                  <div className="lg:col-span-7 space-y-4">
                    <span className="text-xs font-bold uppercase tracking-widest text-amber-300">
                      Behind KVN TEAPOWDER
                    </span>
                    <h2 className="text-2xl sm:text-4xl font-bold font-serif-brand text-stone-100">
                      Crafted by Kavinash with Love for Authentic Flavor.
                    </h2>
                    <p className="text-xs sm:text-sm text-stone-200/90 leading-relaxed">
                      "In an era where commercial store shelves are filled with dusty floor sweeps and artificial color additives, <strong>KVN TEAPOWDER</strong> was started with a single promise: bring fresh, unadulterated Nilgiri tea leaves and genuine roasted coffee seeds directly to our local households."
                    </p>
                    <p className="text-xs text-stone-300 leading-relaxed">
                      Every batch is tested personally for decoction strength, aroma persistence, and milk blending. Thank you for supporting honest local craftsmanship.
                    </p>

                    <div className="pt-3 flex flex-wrap gap-3 sm:gap-4 text-xs font-semibold text-amber-200">
                      <div>Owner: Kavinash</div>
                      <div>•</div>
                      <div>Primary Contact: <a href="tel:6383050287" className="hover:underline">6383050287</a></div>
                      <div>•</div>
                      <div>Secondary Contact: <a href="tel:9787513911" className="hover:underline">9787513911</a></div>
                      <div>•</div>
                      <div className="break-all">Email: <a href="mailto:kvnteapowder@gmail.com" className="hover:underline">kvnteapowder@gmail.com</a></div>
                    </div>
                  </div>

                  <div className="lg:col-span-5 flex justify-center">
                    <div className="bg-white/10 p-6 rounded-3xl border border-white/15 backdrop-blur-xs text-center max-w-sm w-full space-y-4">
                      <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-amber-400 text-[#143728] font-bold text-2xl flex items-center justify-center mx-auto shadow-md font-serif-brand">
                        KVN
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-base uppercase">Kavinash</h4>
                        <span className="text-xs text-emerald-200">Founder & Tea Blender</span>
                      </div>
                      <p className="text-xs text-stone-300 italic">
                        "If you are ever dissatisfied with the flavor of our tea, call me directly at 6383050287 or 9787513911."
                      </p>
                      <button
                        onClick={() => navigateTo('contact')}
                        className="w-full py-2.5 bg-white text-[#143728] font-bold text-xs rounded-xl hover:bg-stone-100 transition-all cursor-pointer"
                      >
                        Contact Kavinash
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* VIEW: ALL PRODUCTS PAGE */}
        {currentPage === 'products' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-stone-200">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-stone-900">
                  All Tea & Coffee Powders
                </h1>
                <p className="text-xs text-stone-500 mt-1">
                  Showing {filteredProducts.length} authentic blends available for order.
                </p>
              </div>

              {/* Category Pills */}
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: 'all', label: 'All Blends' },
                  { id: 'tea', label: 'Tea' },
                  { id: 'coffee', label: 'Coffee' },
                  { id: 'combo', label: 'Combos' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id as any)}
                    className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      selectedCategory === cat.id
                        ? 'bg-[#143728] text-white shadow-2xs'
                        : 'bg-white text-stone-700 border border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 border border-stone-200 text-center max-w-md mx-auto space-y-3">
                <Leaf className="w-12 h-12 text-stone-300 mx-auto" />
                <h3 className="font-bold text-stone-800 text-sm">No products found</h3>
                <p className="text-xs text-stone-500">
                  Try adjusting your search query or selecting a different category.
                </p>
                <button
                  onClick={() => {
                    setSelectedCategory('all');
                    setSearchQuery('');
                  }}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-xl text-xs font-semibold text-stone-800 transition-all cursor-pointer"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onSelectProduct={(p) => setSelectedProduct(p)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Global Footer (Customer-only, NO public admin button) */}
      <Footer
        config={config}
        onNavigate={navigateTo}
        onAdminClick={() => navigateTo('admin')}
      />

      {/* Cart Drawer (Smooth slide-in) */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onProceedToCheckout={() => navigateTo('checkout')}
      />

      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onNavigateToCheckout={() => navigateTo('checkout')}
        />
      )}

      {/* Customer Account Modal */}
      <CustomerAccountModal
        isOpen={isAccountOpen}
        onClose={() => setIsAccountOpen(false)}
        onTrackOrder={(orderId) => {
          setTrackingOrderId(orderId);
          navigateTo('tracking');
        }}
      />

      {/* Floating Back to Top Button (Smooth scroll, ultra-responsive) */}
      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-40 p-3 rounded-full bg-[#143728] text-white shadow-xl hover:bg-[#204e37] active:scale-90 transition-all duration-300 animate-in fade-in zoom-in cursor-pointer border border-[#c29958]/40"
          aria-label="Back to top"
          title="Back to top"
        >
          <ArrowUp className="w-4 h-4 sm:w-5 sm:h-5 text-[#f7e6c4]" />
        </button>
      )}

      {/* Global Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 z-50 bg-stone-900 text-white px-5 py-3 rounded-2xl shadow-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-200 max-w-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const existingContext = useContext(ShopContext);
  if (existingContext) {
    return <AppContent />;
  }
  return (
    <ShopProvider>
      <AppContent />
    </ShopProvider>
  );
}
