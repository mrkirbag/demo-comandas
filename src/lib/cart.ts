export type CartAdicional = {
  id: string;
  name: string;
  price: number;
};

export type CartItem = {
  key: string;
  productId: string;
  name: string;
  imageUrl: string | null;
  basePrice: number;
  quantity: number;
  notes: string;
  adicionales: CartAdicional[];
  hasInventory?: boolean;
  stock?: number | null;
};

export const CART_EVENT = 'cart:updated';
export const CART_OPEN_EVENT = 'cart:open';
export const CART_CLOSE_EVENT = 'cart:close';
export const CART_STORAGE_KEY = 'cart:v1';

export function openCartDrawer(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CART_OPEN_EVENT));
}

export function closeCartDrawer(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CART_CLOSE_EVENT));
}

function isValidCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== 'object') return false;

  const item = value as Record<string, unknown>;
  return (
    typeof item.key === 'string' &&
    typeof item.productId === 'string' &&
    typeof item.name === 'string' &&
    typeof item.basePrice === 'number' &&
    Number.isFinite(item.basePrice) &&
    typeof item.quantity === 'number' &&
    Number.isInteger(item.quantity) &&
    item.quantity > 0 &&
    typeof item.notes === 'string' &&
    Array.isArray(item.adicionales) &&
    (item.hasInventory === undefined || typeof item.hasInventory === 'boolean') &&
    (item.stock === undefined || item.stock === null || typeof item.stock === 'number')
  );
}

function readCart(): CartItem[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isValidCartItem);
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
}

function buildKey(productId: string, notes: string, adicionales: CartAdicional[]): string {
  const adicionalKey = adicionales
    .map((adicional) => adicional.id)
    .sort()
    .join(',');
  return `${productId}|${notes.trim()}|${adicionalKey}`;
}

export function linePrice(item: CartItem): number {
  const extrasTotal = item.adicionales.reduce((sum, extra) => sum + extra.price, 0);
  return (item.basePrice + extrasTotal) * item.quantity;
}

export function getCartItems(): CartItem[] {
  return readCart();
}

export function getCartCount(): number {
  return readCart().reduce((sum, item) => sum + item.quantity, 0);
}

export function getCartTotal(): number {
  return readCart().reduce((sum, item) => sum + linePrice(item), 0);
}

export function addToCart(item: Omit<CartItem, 'key'>): CartItem {
  const items = readCart();
  const key = buildKey(item.productId, item.notes, item.adicionales);

  // If item tracks inventory, cap added quantity so total in cart for this productId does not exceed stock
  if (item.hasInventory && item.stock !== null && item.stock !== undefined) {
    const currentTotalInCart = items
      .filter((candidate) => candidate.productId === item.productId)
      .reduce((sum, candidate) => sum + candidate.quantity, 0);

    const availableToAdd = Math.max(0, item.stock - currentTotalInCart);
    item.quantity = Math.min(item.quantity, availableToAdd);

    if (item.quantity <= 0) {
      const existing = items.find((candidate) => candidate.key === key);
      if (existing) return existing;
      throw new Error(`No hay más stock disponible en inventario para "${item.name}"`);
    }
  }

  const existing = items.find((candidate) => candidate.key === key);
  if (existing) {
    existing.quantity += item.quantity;
    if (item.hasInventory !== undefined) existing.hasInventory = item.hasInventory;
    if (item.stock !== undefined) existing.stock = item.stock;
    writeCart(items);
    return existing;
  }

  const next: CartItem = { ...item, key };
  writeCart([...items, next]);
  return next;
}

export function updateCartItemQuantity(key: string, quantity: number): void {
  const items = readCart();
  const target = items.find((i) => i.key === key);
  if (!target) return;

  let nextQty = Math.max(1, quantity);
  if (target.hasInventory && target.stock !== null && target.stock !== undefined) {
    const otherQty = items
      .filter((i) => i.productId === target.productId && i.key !== key)
      .reduce((sum, i) => sum + i.quantity, 0);
    const maxForThis = Math.max(1, target.stock - otherQty);
    nextQty = Math.min(maxForThis, nextQty);
  }

  const updated = items.map((item) => (item.key === key ? { ...item, quantity: nextQty } : item));
  writeCart(updated);
}

export function syncCartWithLiveProducts(
  products: Array<{ id: string; has_inventory?: boolean; stock?: number | null }>,
): boolean {
  const items = readCart();
  if (items.length === 0) return false;

  const productMap = new Map(products.map((p) => [p.id, p]));
  let changed = false;

  const updated = items.map((item) => {
    const live = productMap.get(item.productId);
    if (!live) return item;

    const hasInventory = live.has_inventory ?? false;
    const stock = live.stock ?? null;

    if (item.hasInventory !== hasInventory || item.stock !== stock) {
      changed = true;
      return { ...item, hasInventory, stock };
    }
    return item;
  });

  if (changed) {
    writeCart(updated);
    notifyCartChanged();
  }
  return changed;
}

export function removeCartItem(key: string): void {
  writeCart(readCart().filter((item) => item.key !== key));
}

export function clearCart(): void {
  writeCart([]);
}

export function notifyCartChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CART_EVENT));
}