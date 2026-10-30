import React, { useState } from 'react';
import { Product, WeightVariant } from '../types';
import { useShop } from '../context/ShopContext';
import { Heart, ShoppingBag, Check, AlertCircle, MessageSquare } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onQuickView?: (product: Product) => void;
  onSelectProduct?: (product: Product) => void;
  className?: string;
}

export const ProductCard: React.FC<ProductCardProps> = ({ 
  product, 
  onQuickView, 
  onSelectProduct,
  className = '' 
}) => {
  const handleSelect = onSelectProduct || onQuickView;
  const { addToCart, isInWishlist, toggleWishlist, config } = useShop();

  // Selected variant state (default to first variant)
  const [selectedVariant, setSelectedVariant] = useState<WeightVariant>(
    product.variants[0] || { id: 'v0', weight: '250g', mrp: 0, sellingPrice: 0, stock: 0 }
  );

  const discountPercent = selectedVariant.mrp > selectedVariant.sellingPrice
    ? Math.round(((selectedVariant.mrp - selectedVariant.sellingPrice) / selectedVariant.mrp) * 100)
    : 0;

  const isOutOfStock = selectedVariant.stock <= 0;
  const isLowStock = selectedVariant.stock > 0 && selectedVariant.stock <= 5;
  const isWishlisted = isInWishlist(product.id);

  // WhatsApp quick inquiry/order link
  const whatsappNumber = config.primaryPhone || '6383050287';
  const whatsappMsg = encodeURIComponent(
    `Hello KVN TEAPOWDER, I would like to order ${product.name} (${selectedVariant.weight}) for ₹${selectedVariant.sellingPrice}.`
  );
  const whatsappUrl = `https://wa.me/91${whatsappNumber}?text=${whatsappMsg}`;

  return (
    <div 
      id={`product-card-${product.id}`}
      className={`scroll-reveal group bg-white rounded-2xl border border-stone-200/80 hover:border-[#2e5e43]/40 shadow-2xs hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden active:scale-[0.99] sm:hover:-translate-y-1 ${className}`}
    >
      {/* Top Media Container */}
      <div 
        className="relative aspect-4/3 sm:aspect-square bg-stone-100 overflow-hidden cursor-pointer" 
        onClick={() => handleSelect?.(product)}
      >
        <img
          src={product.images[0] || 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80'}
          alt={product.name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500 ease-out"
        />

        {/* Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 items-start z-10">
          {product.isNewArrival && (
            <span className="px-2.5 py-0.5 text-[10px] sm:text-[11px] font-semibold bg-[#143728] text-white rounded-full tracking-wide shadow-2xs">
              New Arrival
            </span>
          )}
          {product.isBestSeller && (
            <span className="px-2.5 py-0.5 text-[10px] sm:text-[11px] font-semibold bg-[#c29958] text-[#143728] rounded-full tracking-wide shadow-2xs">
              Customer Favourite
            </span>
          )}
          {discountPercent > 0 && (
            <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 rounded-md">
              {discountPercent}% OFF
            </span>
          )}
        </div>

        {/* Wishlist Button */}
        <button
          id={`wishlist-btn-${product.id}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleWishlist(product.id);
          }}
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          className={`absolute top-2.5 right-2.5 w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
            isWishlisted
              ? 'bg-rose-50 text-rose-600 shadow-xs'
              : 'bg-white/85 backdrop-blur-xs text-stone-600 hover:bg-white hover:text-stone-900'
          }`}
        >
          <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-rose-500' : ''}`} />
        </button>

        {/* Stock Status Badge */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center">
            <span className="bg-red-600 text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-md">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 sm:p-5 flex flex-col flex-1">
        {/* Category & Status */}
        <div className="flex items-center justify-between text-xs text-stone-500 mb-1.5">
          <span className="capitalize font-medium text-[#2e5e43]">
            {product.mainCategory} • {product.categorySlug.replace('-', ' ')}
          </span>
          {isLowStock && !isOutOfStock && (
            <span className="text-amber-700 font-medium flex items-center gap-1 text-[11px]">
              <AlertCircle className="w-3 h-3" /> Only {selectedVariant.stock} left
            </span>
          )}
          {!isLowStock && !isOutOfStock && (
            <span className="text-emerald-700 font-medium flex items-center gap-1 text-[11px]">
              <Check className="w-3 h-3" /> In Stock
            </span>
          )}
        </div>

        {/* Product Title */}
        <h3 
          onClick={() => handleSelect?.(product)}
          className="font-semibold text-stone-900 text-sm sm:text-base leading-snug hover:text-[#2e5e43] cursor-pointer transition-colors line-clamp-1"
        >
          {product.name}
        </h3>

        {/* Short Description */}
        <p className="text-xs text-stone-600 line-clamp-2 mt-1 mb-3 leading-relaxed">
          {product.description}
        </p>

        {/* Weight Variant Selector */}
        {product.variants.length > 1 && (
          <div className="mb-3">
            <label className="text-[10px] sm:text-[11px] font-semibold text-stone-500 uppercase tracking-wider block mb-1">
              Select Weight:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {product.variants.map((v) => {
                const isSelected = v.id === selectedVariant.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariant(v)}
                    className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#2e5e43] bg-[#2e5e43] text-white shadow-2xs'
                        : 'border-stone-200 bg-stone-50 text-stone-700 hover:border-stone-300'
                    }`}
                  >
                    {v.weight}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Pricing */}
        <div className="mt-auto pt-3 border-t border-stone-100 flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-lg sm:text-xl font-bold text-stone-900">
              ₹{selectedVariant.sellingPrice}
            </span>
            {selectedVariant.mrp > selectedVariant.sellingPrice && (
              <span className="text-xs text-stone-400 line-through">
                ₹{selectedVariant.mrp}
              </span>
            )}
            <span className="text-[11px] text-stone-500 font-medium">
              /{selectedVariant.weight}
            </span>
          </div>

          <span className="text-[10px] text-stone-400 hidden sm:inline">
            SKU: {product.sku}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 mt-3.5">
          <button
            id={`add-cart-${product.id}`}
            disabled={isOutOfStock}
            onClick={() => addToCart(product, selectedVariant.id, 1)}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              isOutOfStock
                ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                : 'bg-[#143728] text-white hover:bg-[#204e37] active:scale-95 shadow-2xs'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            Add to Cart
          </button>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold bg-[#25D366]/10 text-[#075e25] border border-[#25D366]/30 hover:bg-[#25D366]/20 active:scale-95 transition-all text-center"
          >
            <MessageSquare className="w-3.5 h-3.5 text-[#25D366]" />
            WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
};
