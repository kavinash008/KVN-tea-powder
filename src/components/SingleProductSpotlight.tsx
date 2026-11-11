import React, { useState } from 'react';
import { Product, WeightVariant } from '../types';
import { useShop } from '../context/ShopContext';
import {
  ShoppingBag,
  Check,
  AlertCircle,
  Sparkles,
  Heart,
  Share2,
  MessageSquare,
  ShieldCheck,
  Truck,
  Leaf,
  Coffee,
  RotateCcw,
  Zap,
  ZoomIn,
} from 'lucide-react';

interface SingleProductSpotlightProps {
  product: Product;
  onNavigateToCheckout: () => void;
  onSelectProduct: (product: Product) => void;
}

export const SingleProductSpotlight: React.FC<SingleProductSpotlightProps> = ({
  product,
  onNavigateToCheckout,
  onSelectProduct,
}) => {
  const { addToCart, isInWishlist, toggleWishlist, config, showToast } = useShop();

  const variant: WeightVariant = product.variants?.[0] || {
    id: 'var-briar-500g',
    weight: '500g',
    mrp: 205,
    sellingPrice: 200,
    stock: 30,
  };

  const [activeImgIndex, setActiveImgIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isZoomed, setIsZoomed] = useState(false);

  const images = product.images && product.images.length > 0
    ? product.images
    : [
        '/products/briar-talayar-front.jpg',
        '/products/briar-talayar-angle.jpg',
      ];

  const currentImage = images[activeImgIndex] || images[0];
  const isOutOfStock = variant.stock <= 0;
  const isWishlisted = isInWishlist(product.id);
  const savings = Math.max(0, variant.mrp - variant.sellingPrice);

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    addToCart(product, variant.id, quantity);
    showToast(`Added ${quantity} packet(s) of ${product.name} to your cart!`);
  };

  const handleBuyNow = () => {
    if (isOutOfStock) return;
    addToCart(product, variant.id, quantity);
    onNavigateToCheckout();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${product.name} | KVN TEAPOWDER`,
          text: `Buy authentic ${product.name} directly from KVN TEAPOWDER!`,
          url: window.location.href,
        });
      } catch {
        // cancelled
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      showToast('Product link copied to clipboard!');
    }
  };

  const whatsappMsg = encodeURIComponent(
    `Hello KVN TEAPOWDER, I would like to order ${quantity} packet(s) of ${product.name} (${variant.weight}) for ₹${variant.sellingPrice * quantity}.`
  );
  const whatsappUrl = `https://wa.me/91${config.primaryPhone || '6383050287'}?text=${whatsappMsg}`;

  return (
    <section id="single-product-spotlight" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      {/* Spotlight Header Banner */}
      <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12 space-y-2">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-[#143728]">
          <Sparkles className="w-3.5 h-3.5 text-[#2e5e43]" />
          <span>KVN Exclusive Launch • Single Origin Tea</span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-extrabold text-stone-900 tracking-tight font-serif-brand">
          Introducing Our Flagship Tea
        </h2>
        <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
          Grown in the misty heights of Munnar, Kerala. Pure unblended estate leaves delivered fresh to your doorstep.
        </p>
      </div>

      {/* Main Single Product Card */}
      <div className="bg-white rounded-3xl border border-stone-200/90 shadow-xl overflow-hidden p-6 sm:p-10 lg:p-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
          
          {/* Gallery Column (Left - 6 cols) */}
          <div className="lg:col-span-6 space-y-4">
            {/* Main Image Frame with Zoom */}
            <div
              className="relative aspect-3/4 sm:aspect-square bg-gradient-to-b from-stone-50 via-white to-stone-50 rounded-2xl overflow-hidden border border-stone-200/80 flex items-center justify-center p-4 cursor-pointer group shadow-inner"
              onClick={() => setIsZoomed(!isZoomed)}
            >
              <img
                src={currentImage}
                alt={product.name}
                className={`max-h-full max-w-full object-contain transition-transform duration-500 ${
                  isZoomed ? 'scale-125' : 'group-hover:scale-105'
                }`}
              />

              {/* Zoom hint badge */}
              <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-xs text-stone-700 px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 shadow-xs pointer-events-none">
                <ZoomIn className="w-3 h-3 text-[#2e5e43]" />
                <span>{isZoomed ? 'Tap to Reset' : 'Tap to Zoom'}</span>
              </div>

              {/* Wishlist Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleWishlist(product.id);
                }}
                className={`absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-md ${
                  isWishlisted
                    ? 'bg-rose-50 text-rose-600 border border-rose-200'
                    : 'bg-white/95 text-stone-600 hover:text-stone-900'
                }`}
                aria-label="Wishlist"
              >
                <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-rose-500' : ''}`} />
              </button>

              {/* Out of Stock Overlay */}
              {isOutOfStock && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center">
                  <span className="bg-red-600 text-white font-bold text-sm uppercase tracking-wider px-4 py-2 rounded-xl shadow-lg">
                    Out of Stock
                  </span>
                </div>
              )}
            </div>

            {/* Thumbnail Selectors (Front view + Angled view) */}
            {images.length > 1 && (
              <div className="flex items-center gap-3 justify-center sm:justify-start pt-1">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImgIndex(idx)}
                    className={`relative w-20 h-20 rounded-xl overflow-hidden border-2 transition-all p-1 bg-stone-50 ${
                      activeImgIndex === idx
                        ? 'border-[#2e5e43] ring-3 ring-[#2e5e43]/20 scale-102'
                        : 'border-stone-200 opacity-70 hover:opacity-100 hover:border-stone-300'
                    }`}
                  >
                    <img src={img} alt={`View ${idx + 1}`} className="w-full h-full object-contain" />
                    <span className="absolute bottom-1 right-1 text-[9px] bg-black/70 text-white px-1 rounded">
                      {idx === 0 ? 'Front' : 'Angle'}
                    </span>
                  </button>
                ))}
                <span className="text-xs text-stone-500 pl-2">
                  Click thumbnail to switch angles
                </span>
              </div>
            )}
          </div>

          {/* Product Details & Actions Column (Right - 6 cols) */}
          <div className="lg:col-span-6 space-y-5">
            {/* 3 Prominent Product Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 text-xs font-extrabold bg-[#143728] text-white rounded-full tracking-wide shadow-sm flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-amber-300" />
                New Arrival
              </span>
              <span className="px-3 py-1 text-xs font-extrabold bg-[#c29958] text-[#143728] rounded-full tracking-wide shadow-sm">
                Best Seller / Customer Favourite
              </span>
              <span className="px-3 py-1 text-xs font-extrabold bg-emerald-50 text-emerald-900 border border-emerald-300 rounded-full tracking-wide shadow-sm">
                Featured Product
              </span>
            </div>

            {/* Brand & Title */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-[#2e5e43]">
                  {product.brand || 'Briar'} • Single Origin Tea
                </span>
                <button
                  onClick={handleShare}
                  className="text-stone-500 hover:text-stone-800 p-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 transition-colors flex items-center gap-1 text-xs"
                  title="Share"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share</span>
                </button>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-stone-900 mt-1 leading-tight font-serif-brand">
                {product.name}
              </h1>
              <p className="text-xs sm:text-sm text-stone-600 mt-2 leading-relaxed">
                {product.description}
              </p>
            </div>

            {/* Weight & Packaging specification */}
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-stone-100 rounded-xl text-xs text-stone-800 font-semibold border border-stone-200">
              <span>Pack Size:</span>
              <span className="px-2.5 py-0.5 bg-white rounded-lg shadow-2xs text-[#143728] font-bold">
                {variant.weight || '500g'}
              </span>
              <span className="text-stone-400">|</span>
              <span className="text-stone-600">Fresh Vacuum-Sealed Pouch</span>
            </div>

            {/* Pricing Section (MRP strikethrough, Selling price, Save offer) */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-50/80 to-amber-50/60 rounded-2xl border border-emerald-200/80 space-y-2">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl sm:text-4xl font-extrabold text-[#143728]">
                  ₹{variant.sellingPrice}
                </span>
                {variant.mrp > variant.sellingPrice && (
                  <span className="text-lg sm:text-xl text-stone-400 line-through font-medium">
                    ₹{variant.mrp}
                  </span>
                )}
                {savings > 0 && (
                  <span className="px-3 py-1 bg-amber-500 text-white font-extrabold text-xs rounded-full shadow-xs">
                    Save ₹{savings} Offer
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-500">
                Inclusive of all taxes • Direct from Munnar hill slopes
              </p>
            </div>

            {/* Live Inventory / Stock Information */}
            <div className="flex items-center gap-2">
              {isOutOfStock ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-bold">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span>Currently Out of Stock</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Available Stock: {variant.stock} packets</span>
                  <span className="text-emerald-600 font-normal hidden sm:inline">(Ready for immediate dispatch)</span>
                </div>
              )}
            </div>

            {/* Quantity Selector & Action Buttons */}
            {!isOutOfStock && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-4">
                  <span className="text-xs font-semibold text-stone-700">Quantity:</span>
                  <div className="flex items-center border border-stone-200 bg-stone-50 rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-9 h-9 flex items-center justify-center font-bold text-stone-700 hover:bg-stone-200 transition-colors"
                      disabled={quantity <= 1}
                    >
                      -
                    </button>
                    <span className="w-12 text-center font-bold text-xs text-stone-900 bg-white py-2">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.min(variant.stock, quantity + 1))}
                      className="w-9 h-9 flex items-center justify-center font-bold text-stone-700 hover:bg-stone-200 transition-colors"
                      disabled={quantity >= variant.stock}
                    >
                      +
                    </button>
                  </div>
                  <span className="text-xs text-stone-500">
                    Total: <strong className="text-stone-900 font-bold">₹{variant.sellingPrice * quantity}</strong>
                  </span>
                </div>

                {/* Primary CTA Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleBuyNow}
                    className="w-full py-4 bg-[#c29958] hover:bg-[#d4a867] active:scale-98 text-stone-950 font-bold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Zap className="w-4 h-4 fill-stone-950" />
                    <span>Buy Now (₹{variant.sellingPrice * quantity})</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleAddToCart}
                    className="w-full py-4 bg-[#143728] hover:bg-[#204e37] active:scale-98 text-white font-bold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>Add to Cart</span>
                  </button>
                </div>

                {/* Direct WhatsApp Order CTA */}
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] border border-[#25D366]/30 font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-4 h-4 text-[#25D366]" />
                  <span>Order Directly on WhatsApp</span>
                </a>
              </div>
            )}

            {/* Trust Highlights */}
            <div className="grid grid-cols-3 gap-2 pt-4 border-t border-stone-200/80 text-[11px] text-stone-600">
              <div className="flex items-center gap-1.5">
                <Leaf className="w-4 h-4 text-[#2e5e43] shrink-0" />
                <span>100% Single Origin</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Doorstep Delivery</span>
              </div>
              <div className="flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Freshness Assured</span>
              </div>
            </div>

            {/* Brewing Instructions & Details */}
            {product.brewingInstructions && (
              <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-700 space-y-1">
                <span className="font-bold text-[#143728] block">Brewing Recommendation:</span>
                <p className="leading-relaxed text-[11px] text-stone-600">{product.brewingInstructions}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
