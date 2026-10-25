import React, { useState, useEffect } from 'react';
import { useShop } from '../context/ShopContext';
import { KVNLogo } from './KVNLogo';
import {
  ShoppingBag,
  Heart,
  Search,
  User,
  Menu,
  X,
  Phone,
  MessageSquare,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';

interface HeaderProps {
  activeTab?: string;
  activePage?: string;
  onNavigate: (tab: string) => void;
  onOpenCart: () => void;
  onOpenAccount?: () => void;
  onOpenAuthModal?: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  activePage,
  onNavigate,
  onOpenCart,
  onOpenAccount,
  onOpenAuthModal,
  searchQuery: propSearchQuery,
  onSearchChange,
}) => {
  const currentTab = activePage || activeTab || 'home';
  const { cartCount, wishlist, searchQuery: contextSearchQuery, setSearchQuery: setContextSearchQuery, config, currentUser } = useShop();

  const searchQuery = propSearchQuery !== undefined ? propSearchQuery : contextSearchQuery;
  const updateSearchQuery = (val: string) => {
    if (onSearchChange) onSearchChange(val);
    setContextSearchQuery(val);
  };

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  // Monitor scroll for smooth sticky transition and progress bar without lag
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollY = window.scrollY;
          setIsScrolled(scrollY > 15);

          const docHeight = document.documentElement.scrollHeight - window.innerHeight;
          if (docHeight > 0) {
            setScrollProgress(Math.min(100, Math.max(0, (scrollY / docHeight) * 100)));
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleAccountClick = () => {
    if (onOpenAccount) {
      onOpenAccount();
    } else if (onOpenAuthModal) {
      onOpenAuthModal();
    }
    setMobileMenuOpen(false);
  };

  const navLinks = [
    { id: 'home', label: 'Home' },
    { id: 'products', label: 'All Powders' },
    { id: 'tea', label: 'Tea Blends' },
    { id: 'coffee', label: 'Filter Coffee' },
    { id: 'new-arrivals', label: 'New Arrivals' },
    { id: 'about', label: 'About' },
    { id: 'feedback', label: 'Reviews' },
    { id: 'contact', label: 'Contact' },
  ];

  const handleNavClick = (tabId: string) => {
    onNavigate(tabId);
    setMobileMenuOpen(false);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onNavigate('products');
      setSearchOpen(false);
      setMobileMenuOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full transition-all duration-300">
      {/* Top subtle scroll progress line */}
      <div 
        className="h-[2px] bg-gradient-to-r from-[#2e5e43] via-[#c29958] to-[#143728] transition-all duration-150 ease-out"
        style={{ width: `${scrollProgress}%` }}
      />

      {/* Top micro-bar: Pure customer contact & trust badge */}
      <div className="bg-[#143728] text-[#f7e6c4] px-3 sm:px-6 py-1 text-[11px] sm:text-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Left badge */}
          <div className="flex items-center gap-2 sm:gap-4 truncate">
            <span className="hidden sm:inline-flex items-center gap-1.5 font-medium text-amber-200/90 truncate">
              <ShieldCheck className="w-3.5 h-3.5 text-[#c29958] shrink-0" />
              <span>Authentic Nilgiri Blends & South Indian Coffee</span>
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] truncate">
              <Phone className="w-3 h-3 text-[#c29958] shrink-0" />
              <span className="text-stone-300 hidden xs:inline">Orders:</span>
              <a
                href={`tel:${config?.primaryPhone || '9787513911'}`}
                className="hover:underline font-semibold text-[#f7e6c4]"
              >
                {config?.primaryPhone || '9787513911'}
              </a>
            </span>
          </div>

          {/* Right WhatsApp fast link */}
          <div className="flex items-center shrink-0">
            <a
              href={`https://wa.me/91${config?.primaryPhone || '9787513911'}?text=Hello%20KVN%20TEAPOWDER`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 bg-[#25D366]/20 text-[#c7f4d4] px-2 py-0.5 rounded text-[10px] sm:text-[11px] hover:bg-[#25D366]/30 transition-all font-medium"
            >
              <MessageSquare className="w-3 h-3 text-[#25D366]" />
              <span>WhatsApp</span>
            </a>
          </div>
        </div>
      </div>

      {/* Main navigation row */}
      <div 
        className={`w-full transition-all duration-300 border-b ${
          isScrolled 
            ? 'bg-[#faf7f2]/95 backdrop-blur-md shadow-xs border-stone-200/90' 
            : 'bg-[#faf7f2]/90 backdrop-blur-sm border-stone-200/60'
        }`}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className={`flex items-center justify-between transition-all duration-300 ${
            isScrolled ? 'h-14 sm:h-18' : 'h-16 sm:h-20'
          }`}>
            {/* Brand Logo (Left) */}
            <div 
              onClick={() => handleNavClick('home')} 
              className="cursor-pointer transition-transform duration-200 active:scale-95 shrink-0"
              title="KVN TEAPOWDER - Home"
            >
              <KVNLogo size="md" hideTaglineOnMobile={true} />
            </div>

            {/* Desktop Navigation links */}
            <nav className="hidden lg:flex items-center gap-1 xl:gap-2">
              {navLinks.map((link) => {
                const isActive = currentTab === link.id;
                return (
                  <button
                    key={link.id}
                    onClick={() => handleNavClick(link.id)}
                    className={`px-3 py-1.5 text-xs xl:text-sm font-semibold rounded-xl transition-all duration-200 cursor-pointer ${
                      isActive
                        ? 'text-[#143728] bg-stone-200/80 shadow-2xs font-bold'
                        : 'text-stone-700 hover:text-[#143728] hover:bg-stone-100/80'
                    }`}
                  >
                    {link.label}
                  </button>
                );
              })}
            </nav>

            {/* Action Icons (Right) */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              {/* Search Toggle Button */}
              <button
                id="search-header-btn"
                onClick={() => setSearchOpen(!searchOpen)}
                className={`p-2 rounded-xl text-stone-700 hover:text-[#143728] hover:bg-stone-100 transition-colors ${
                  searchOpen ? 'bg-stone-200/70 text-[#143728]' : ''
                }`}
                aria-label="Search Powders"
                title="Search Powders"
              >
                <Search className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Wishlist Button */}
              <button
                id="wishlist-header-btn"
                onClick={() => handleNavClick('wishlist')}
                className="relative p-2 rounded-xl text-stone-700 hover:text-[#143728] hover:bg-stone-100 transition-colors"
                aria-label="Wishlist"
                title="Wishlist"
              >
                <Heart className="w-4 h-4 sm:w-5 sm:h-5" />
                {wishlist.length > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-rose-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-bounce-badge shadow-xs">
                    {wishlist.length}
                  </span>
                )}
              </button>

              {/* Cart Button */}
              <button
                id="cart-header-btn"
                onClick={onOpenCart}
                className="relative p-2 rounded-xl text-stone-700 hover:text-[#143728] hover:bg-stone-100 transition-colors"
                aria-label="Shopping Cart"
                title="Shopping Cart"
              >
                <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
                {cartCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-[#2e5e43] text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-bounce-badge shadow-xs">
                    {cartCount}
                  </span>
                )}
              </button>

              {/* Customer Account Button */}
              <button
                id="account-header-btn"
                onClick={handleAccountClick}
                className="p-1.5 sm:p-2 rounded-xl text-stone-700 hover:text-[#143728] hover:bg-stone-100 transition-colors flex items-center gap-1.5"
                aria-label="Customer Account"
                title="Customer Account & Orders"
              >
                <User className="w-4 h-4 sm:w-5 sm:h-5 text-[#2e5e43]" />
                {currentUser && (
                  <span className="hidden md:inline text-xs font-bold text-[#143728]">
                    {currentUser.fullName.split(' ')[0]}
                  </span>
                )}
              </button>

              {/* Mobile Menu Hamburger */}
              <button
                id="mobile-menu-toggle-btn"
                onClick={() => {
                  setMobileMenuOpen(!mobileMenuOpen);
                  if (searchOpen) setSearchOpen(false);
                }}
                className="lg:hidden p-2 rounded-xl text-stone-800 hover:bg-stone-100 active:scale-95 transition-all"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Dropdown Search Bar (Smoothly animates below header without breaking layout) */}
        {searchOpen && (
          <div className="border-t border-stone-200/80 bg-white/95 px-4 py-3 backdrop-blur-md shadow-inner animate-in slide-in-from-top-2 duration-200">
            <form onSubmit={handleSearchSubmit} className="max-w-2xl mx-auto flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => updateSearchQuery(e.target.value)}
                  placeholder="Search pure tea leaves, filter coffee, combos..."
                  autoFocus
                  className="w-full pl-10 pr-9 py-2 text-xs sm:text-sm bg-stone-50 border border-stone-300 rounded-xl focus:outline-hidden focus:bg-white focus:border-[#2e5e43] focus:ring-1 focus:ring-[#2e5e43] transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => updateSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-[#143728] text-white text-xs font-semibold rounded-xl hover:bg-[#204e37] transition-all shrink-0 cursor-pointer"
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="p-2 text-stone-500 hover:text-stone-800 rounded-xl text-xs"
              >
                Close
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-b border-stone-200 bg-[#faf7f2]/98 backdrop-blur-xl px-4 pt-4 pb-6 space-y-4 shadow-xl animate-in slide-in-from-top-3 duration-200 max-h-[85vh] overflow-y-auto">
          {/* Account Profile Quick Card on Mobile */}
          <div 
            onClick={handleAccountClick}
            className="flex items-center justify-between p-3 rounded-2xl bg-white border border-stone-200/80 shadow-2xs cursor-pointer active:scale-98 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#143728] flex items-center justify-center font-bold">
                <User className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-stone-900">Customer Account</div>
                <div className="text-[11px] text-stone-500">Track orders & view history</div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-stone-400" />
          </div>

          {/* Search bar inside drawer */}
          <div>
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => updateSearchQuery(e.target.value)}
                placeholder="Search tea powders, coffee..."
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-white border border-stone-200 rounded-xl focus:outline-hidden focus:border-[#2e5e43]"
              />
            </form>
          </div>

          {/* Account Button in Mobile Menu */}
          <button
            onClick={handleAccountClick}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-emerald-50 text-[#143728] font-bold text-xs border border-emerald-200/60"
          >
            <span className="flex items-center gap-2">
              <User className="w-4 h-4 text-[#2e5e43]" />
              {currentUser ? `Account: ${currentUser.fullName}` : 'Login / Register Account'}
            </span>
            <span className="text-[10px] bg-[#143728] text-white px-2 py-0.5 rounded-full">
              {currentUser ? 'My Orders' : 'Sign In'}
            </span>
          </button>

          {/* Nav links grid */}
          <div className="grid grid-cols-2 gap-2">
            {navLinks.map((link) => {
              const isActive = currentTab === link.id;
              return (
                <button
                  key={link.id}
                  onClick={() => handleNavClick(link.id)}
                  className={`text-left px-3.5 py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#143728] text-white shadow-2xs font-bold'
                      : 'bg-white text-stone-800 border border-stone-100 hover:bg-stone-100'
                  }`}
                >
                  {link.label}
                </button>
              );
            })}
          </div>

          {/* Quick Contact & WhatsApp banner */}
          <div className="pt-2 border-t border-stone-200/80 flex items-center justify-between text-xs text-stone-600">
            <span className="text-[11px]">Direct Support: <strong>{config?.primaryPhone || '9787513911'}</strong></span>
            <a
              href={`https://wa.me/91${config?.primaryPhone || '9787513911'}?text=Hello%20KVN%20TEAPOWDER`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[#2e5e43] font-bold text-[11px] hover:underline"
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#25D366]" /> Chat Support
            </a>
          </div>
        </div>
      )}
    </header>
  );
};
