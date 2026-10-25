import { CartItem, OrderCustomer } from '../../src/types';
import { INITIAL_PRODUCTS, INITIAL_BUSINESS_CONFIG } from '../../src/data/initialData';

export function validatePhone(phone: string): { valid: boolean; normalized: string; error?: string } {
  if (!phone) {
    return { valid: false, normalized: '', error: 'Mobile number is required' };
  }
  const digits = phone.replace(/\D/g, '');
  const normalized = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  if (!/^[6-9]\d{9}$/.test(normalized)) {
    return { valid: false, normalized, error: 'Please enter a valid 10-digit Indian mobile number' };
  }
  return { valid: true, normalized };
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
  const phoneVal = validatePhone(customer.phone || '');
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
export function validateAndPriceOrder(items: CartItem[]): {
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

  const validatedItems: CartItem[] = [];
  let subtotal = 0;

  for (const item of items) {
    const product = INITIAL_PRODUCTS.find(
      (p) => p.id === item.productId || p.slug === item.productId || p.name.toLowerCase() === (item.productName || '').toLowerCase()
    );
    if (!product) {
      return { valid: false, validatedItems: [], subtotal: 0, deliveryCharge: 0, totalAmount: 0, error: `Product not found: ${item.productId || item.productName}` };
    }

    const variant = product.variants.find((v) => v.id === item.variantId || v.weight === item.weight) || product.variants[0];
    if (!variant) {
      return { valid: false, validatedItems: [], subtotal: 0, deliveryCharge: 0, totalAmount: 0, error: `Invalid variant for ${product.name}` };
    }

    const quantity = Math.max(1, Math.min(99, Math.floor(Number(item.quantity) || 1)));
    const trustedUnitPrice = Number(variant.sellingPrice);
    const trustedMrp = Number(variant.mrp);

    subtotal += trustedUnitPrice * quantity;

    validatedItems.push({
      productId: product.id,
      productName: product.name,
      productImage: product.images[0] || item.productImage || '',
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
