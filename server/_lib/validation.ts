import { CartItem, OrderCustomer, Product } from '../../src/types';
import { INITIAL_PRODUCTS, INITIAL_BUSINESS_CONFIG } from '../../src/data/initialData';

export function validatePhone(
  phone: string,
  countryCode: string = '+91'
): { valid: boolean; normalized: string; fullPhone: string; countryCode: string; error?: string } {
  if (!phone) {
    return { valid: false, normalized: '', fullPhone: '', countryCode: '+91', error: 'Mobile number is required' };
  }
  const trimmed = phone.trim();
  let effectiveCode = (countryCode || '+91').trim();
  if (trimmed.startsWith('+') && !countryCode) {
    const match = trimmed.match(/^(\+\d{1,4})/);
    if (match) effectiveCode = match[1];
  }
  if (!effectiveCode.startsWith('+')) {
    effectiveCode = `+${effectiveCode.replace(/\D/g, '') || '91'}`;
  }

  const digits = phone.replace(/\D/g, '');
  const codeDigits = effectiveCode.replace(/\D/g, '') || '91';

  if (codeDigits === '91') {
    const normalized = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
    if (!/^[6-9]\d{9}$/.test(normalized)) {
      return {
        valid: false,
        normalized,
        fullPhone: '',
        countryCode: '+91',
        error: 'Please enter a valid 10-digit Indian mobile number',
      };
    }
    return { valid: true, normalized, fullPhone: `+91${normalized}`, countryCode: '+91' };
  }

  const normalized =
    digits.startsWith(codeDigits) && digits.length > codeDigits.length + 5
      ? digits.slice(codeDigits.length)
      : digits;
  if (!/^\d{6,14}$/.test(normalized)) {
    return {
      valid: false,
      normalized,
      fullPhone: '',
      countryCode: effectiveCode,
      error: 'Please enter a valid mobile number with country code',
    };
  }
  return { valid: true, normalized, fullPhone: `+${codeDigits}${normalized}`, countryCode: effectiveCode };
}

export function validatePincode(pincode: string): { valid: boolean; error?: string } {
  if (!pincode || !/^[1-9][0-9]{5}$/.test(pincode.trim())) {
    return { valid: false, error: 'Please enter a valid 6-digit Indian PIN code' };
  }
  return { valid: true };
}

export function validateAddress(customer: Partial<OrderCustomer>): { valid: boolean; error?: string } {
  if (!customer.fullName || customer.fullName.trim().length < 2) {
    return { valid: false, error: 'Full name is required (minimum 2 characters)' };
  }
  const phoneVal = validatePhone(customer.phone || '', customer.countryCode || '+91');
  if (!phoneVal.valid) {
    return { valid: false, error: phoneVal.error };
  }
  if (!customer.address || customer.address.trim().length < 5) {
    return { valid: false, error: 'Door number / street address is required' };
  }
  if (!customer.villageTown || customer.villageTown.trim().length < 2) {
    return { valid: false, error: 'Village or Town name is required' };
  }
  const pinVal = validatePincode(customer.pincode || '');
  if (!pinVal.valid) {
    return { valid: false, error: pinVal.error };
  }
  return { valid: true };
}

/**
 * Validates order items against the authoritative product catalogue.
 * Recomputes all prices and totals strictly on the server to prevent manipulation.
 */
export function validateAndPriceOrder(items: CartItem[], productsList?: Product[]): {
  valid: boolean;
  validatedItems: CartItem[];
  subtotal: number;
  deliveryCharge: number;
  totalAmount: number;
  error?: string;
} {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return { valid: false, validatedItems: [], subtotal: 0, deliveryCharge: 0, totalAmount: 0, error: 'Cart is empty' };
  }

  const catalog = productsList && productsList.length > 0 ? productsList : INITIAL_PRODUCTS;
  const validatedItems: CartItem[] = [];
  let subtotal = 0;

  for (const item of items) {
    const product = catalog.find(
      (p) => p.id === item.productId || p.slug === item.productId || p.name.toLowerCase() === (item.productName || '').toLowerCase()
    );
    if (!product) {
      return { valid: false, validatedItems: [], subtotal: 0, deliveryCharge: 0, totalAmount: 0, error: `Product not found or no longer available: ${item.productName || item.productId}` };
    }

    if (product.status === 'archived' || product.status === 'draft' || (product as any).published === false) {
      return { valid: false, validatedItems: [], subtotal: 0, deliveryCharge: 0, totalAmount: 0, error: `"${product.name}" is currently unavailable for purchase` };
    }

    const variant = product.variants?.find((v) => v.id === item.variantId || v.weight === item.weight) || product.variants?.[0];
    if (!variant) {
      return { valid: false, validatedItems: [], subtotal: 0, deliveryCharge: 0, totalAmount: 0, error: `Invalid weight variant selected for ${product.name}` };
    }

    const quantity = Math.max(1, Math.min(99, Math.floor(Number(item.quantity) || 1)));

    if (Number(variant.stock) <= 0) {
      return { valid: false, validatedItems: [], subtotal: 0, deliveryCharge: 0, totalAmount: 0, error: `"${product.name} (${variant.weight})" is out of stock` };
    }

    if (quantity > Number(variant.stock)) {
      return { valid: false, validatedItems: [], subtotal: 0, deliveryCharge: 0, totalAmount: 0, error: `Only ${variant.stock} unit(s) available for "${product.name} (${variant.weight})"` };
    }

    const trustedUnitPrice = Number(variant.sellingPrice ?? (variant as any).price ?? 0);
    const trustedMrp = Number(variant.mrp ?? (variant as any).originalPrice ?? trustedUnitPrice);

    subtotal += trustedUnitPrice * quantity;

    validatedItems.push({
      productId: product.id,
      productName: product.name,
      productImage: product.images?.[0] || item.productImage || '',
      category: product.mainCategory,
      variantId: variant.id,
      weight: variant.weight,
      unitPrice: trustedUnitPrice,
      mrp: trustedMrp,
      quantity,
    });
  }

  const deliveryCharge = subtotal >= INITIAL_BUSINESS_CONFIG.freeDeliveryThreshold ? 0 : INITIAL_BUSINESS_CONFIG.defaultDeliveryCharge;
  const totalAmount = subtotal + deliveryCharge;

  return {
    valid: true,
    validatedItems,
    subtotal,
    deliveryCharge,
    totalAmount,
  };
}
