import React, { useState } from 'react';
import { Product, WeightVariant } from '../types';
import { useShop } from '../context/ShopContext';
import { X, Heart, ShoppingBag, Check, AlertCircle, Share2, MessageSquare } from 'lucide-react';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  onNavigateToCheckout?: () => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onNavigateToCheckout,
}) => {
  if (!product) return null;

  const { addToCart, isInWishlist, toggleWishlist, config, showToast } = useShop();

  const [selectedVariant, setSelectedVariant] = useState<WeightVariant>(
    product.variants[0] || { id: 'v0', weight: '250g', mrp: 0, sellingPrice: 0, stock: 0 }
  );
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);

  const discountPercent = selectedVariant.mrp > selectedVariant.sellingPrice
    ? Math.round(((selectedVariant.mrp - selectedVariant.sellingPrice) / selectedVariant.mrp) * 100)
    : 0;

  const isOutOfStock = selectedVariant.stock <= 0;
  const isWishlisted = isInWishlist(product.id);

  const handleAddToCart = () => {
    addToCart(product, selectedVariant.id, quantity);
  };

  const handleBuyNow = () => {
    addToCart(product, selectedVariant.id, quantity);
    onClose();
    if (onNavigateToCheckout) {
      onNavigateToCheckout();
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${product.name} | KVN TEAPOWDER`,
          text: `Check out ${product.name} from KVN TEAPOWDER!`,
          url: window.location.href,
        });
      } catch {
        // Ignored or cancelled
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      showToast('Product link copied to clipboard!');
    }
  };

  // WhatsApp order link
  const whatsappMsg = encodeURIComponent(
    `Hello KVN TEAPOWDER, I would like to order ${quantity} unit(s) of ${product.name} (${selectedVariant.weight}) for ₹${selectedVariant.sellingPrice * quantity}.`
  );
  const whatsappUrl = `https://wa.me/91${config.primaryPhone || '6383050287'}?text=${whatsappMsg}`;

  return (
    <div 
      id="product-detail-modal"
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
    >
      <div 
        className="relative bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-stone-200/80 flex flex-col md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Gallery column */}
        <div className="md:w-1/2 p-6 bg-stone-50 flex flex-col justify-between border-b md:border-b-0 md:border-r border-stone-200">
          <div>
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-white shadow-inner mb-4">
              <img
                src={product.images[selectedImageIndex] || product.images[0]}
                alt={product.name}
                className="w-full h-full object-cover"
              />
              {discountPercent > 0 && (
                <span className="absolute top-3 left-3 bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
                  {discountPercent}% OFF
                </span>
              )}
            </div>

            {/* Thumbnail selector */}
            {product.images.length > 1 && (
              <div className="flex gap-2.5 overflow-x-auto pb-2">
                {product.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                      selectedImageIndex === idx ? 'border-[#2e5e43] ring-2 ring-[#2e5e43]/20' : 'border-stone-200 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-stone-200/60 flex items-center justify-between text-xs text-stone-500">
            <span>SKU: <strong className="text-stone-700">{product.sku}</strong></span>
            <span>Category: <strong className="text-stone-700 capitalize">{product.categorySlug.replace('-', ' ')}</strong></span>
          </div>
        </div>

        {/* Product Details column */}
        <div className="md:w-1/2 p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs uppercase tracking-wider font-bold text-[#2e5e43]">
                {product.brand}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleShare}
                  className="w-8 h-8 rounded-full border border-stone-200 text-stone-600 hover:bg-stone-50 flex items-center justify-center transition-colors"
                  title="Share product"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => toggleWishlist(product.id)}
                  className={`w-8 h-8 rounded-full border border-stone-200 flex items-center justify-center transition-colors ${
                    isWishlisted ? 'text-rose-600 bg-rose-50 border-rose-200' : 'text-stone-600 hover:bg-stone-50'
                  }`}
                  title="Add to Wishlist"
                >
                  <Heart className={`w-3.5 h-3.5 ${isWishlisted ? 'fill-rose-500' : ''}`} />
                </button>
              </div>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-stone-900 leading-snug">
              {product.name}
            </h1>

            {/* Price & Stock */}
            <div className="flex items-baseline gap-3 my-3">
              <span className="text-2xl sm:text-3xl font-bold text-stone-900">
                ₹{selectedVariant.sellingPrice}
              </span>
              {selectedVariant.mrp > selectedVariant.sellingPrice && (
                <span className="text-base text-stone-400 line-through">
                  ₹{selectedVariant.mrp}
                </span>
              )}
              <span className="text-xs font-semibold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md">
                Incl. all taxes
              </span>
            </div>

            {/* Stock indicator */}
            <div className="mb-4">
              {isOutOfStock ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-md">
                  <AlertCircle className="w-3.5 h-3.5" /> Currently Out of Stock
                </span>
              ) : selectedVariant.stock <= 5 ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md">
                  <AlertCircle className="w-3.5 h-3.5" /> Low Stock: Only {selectedVariant.stock} left
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md">
                  <Check className="w-3.5 h-3.5" /> Fresh Batch in Stock
                </span>
              )}
            </div>

            {/* Weight variant options */}
            <div className="mb-5">
              <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider block mb-2">
                Available Weights:
              </label>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => {
                      setSelectedVariant(v);
                      if (quantity > v.stock && v.stock > 0) {
                        setQuantity(v.stock);
                      }
                    }}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                      selectedVariant.id === v.id
                        ? 'border-[#2e5e43] bg-[#2e5e43] text-white shadow-xs'
                        : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'
                    }`}
                  >
                    {v.weight}
                    <span className="text-xs block opacity-80 font-normal">₹{v.sellingPrice}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity selector */}
            {!isOutOfStock && (
              <div className="flex items-center gap-4 mb-6">
                <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
                  Quantity:
                </label>
                <div className="flex items-center border border-stone-200 rounded-xl overflow-hidden bg-white shadow-xs">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    className="w-10 h-10 flex items-center justify-center text-stone-600 hover:bg-stone-100 disabled:opacity-30"
                  >
                    -
                  </button>
                  <span className="w-12 text-center text-sm font-bold text-stone-900">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(selectedVariant.stock, q + 1))}
                    disabled={quantity >= selectedVariant.stock}
                    className="w-10 h-10 flex items-center justify-center text-stone-600 hover:bg-stone-100 disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {/* Description & tabs */}
            <div className="border-t border-stone-200/80 pt-4 mb-6">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                Description & Flavor Notes
              </h4>
              <p className="text-stone-600 text-sm leading-relaxed mb-3">
                {product.description}
              </p>

              {product.ingredients && (
                <div className="text-xs text-stone-600 mb-2">
                  <strong className="text-stone-800">Ingredients:</strong> {product.ingredients}
                </div>
              )}

              {product.brewingInstructions && (
                <div className="text-xs bg-amber-50/70 border border-amber-200/60 p-3 rounded-xl text-stone-700">
                  <strong className="text-amber-900 block mb-1">Traditional Brewing Method:</strong>
                  {product.brewingInstructions}
                </div>
              )}
            </div>
          </div>

          {/* Action CTAs */}
          <div className="pt-4 border-t border-stone-200 flex flex-col sm:flex-row gap-3">
            <button
              disabled={isOutOfStock}
              onClick={handleAddToCart}
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                isOutOfStock
                  ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                  : 'bg-[#143728] text-white hover:bg-[#204e37] shadow-sm'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              Add to Cart
            </button>

            <button
              disabled={isOutOfStock}
              onClick={handleBuyNow}
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                isOutOfStock
                  ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                  : 'bg-[#c29958] text-[#143728] hover:bg-[#b08745] font-bold shadow-sm'
              }`}
            >
              Buy Now
            </button>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-3 px-4 rounded-xl text-sm font-semibold bg-[#25D366] text-white hover:bg-[#20ba59] flex items-center justify-center gap-2 shadow-xs transition-all"
            >
              <MessageSquare className="w-4 h-4" />
              WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
