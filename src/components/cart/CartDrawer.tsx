import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShoppingBag,
  X,
  Plus,
  Minus,
  Trash2,
  Bike,
  Store,
  User,
  MapPin,
  Phone,
  CreditCard,
  Banknote,
  Send,
  ArrowRight,
  Sparkles,
  MessageSquare,
  Receipt,
  Check,
  AlertCircle,
  ChevronRight,
  Loader2,
  CheckCircle2,
  Clock,
} from 'lucide-react';

import { isStoreOpen } from '@/lib/utils/schedule';

import {
  CART_EVENT,
  CART_OPEN_EVENT,
  CART_CLOSE_EVENT,
  getCartItems,
  getCartCount,
  getCartTotal,
  updateCartItemQuantity,
  removeCartItem,
  clearCart,
  notifyCartChanged,
  syncCartWithLiveProducts,
  linePrice,
  type CartItem,
} from '@/lib/cart';
import {
  formatCop,
  formatPriceByCurrency,
  PUBLIC_CURRENCY_STORAGE_KEY,
  CURRENCY_CHANGE_EVENT,
  type PublicCurrency,
} from '@/lib/utils/currency';
import type { ExchangeRates } from '@/lib/db/types';
import { useModalBodyLock } from '@/lib/ui/modal-utils';

import './CartDrawer.css';

export interface CartDrawerProps {
  brandName?: string;
  brandPhone?: string;
  showFloatingButton?: boolean;
  exchangeRates?: ExchangeRates | null;
  openingHour?: string;
  closingHour?: string;
}

type OrderType = 'delivery' | 'takeaway';
type PaymentMethod = 'cash' | 'transfer' | 'card';

export default function CartDrawer({
  brandName = 'Restaurante',
  brandPhone = '',
  showFloatingButton = true,
  exchangeRates = null,
  openingHour,
  closingHour,
}: CartDrawerProps) {
  const [storeOpen, setStoreOpen] = useState(() => isStoreOpen(openingHour, closingHour));

  useEffect(() => {
    const updateStoreStatus = () => {
      setStoreOpen(isStoreOpen(openingHour, closingHour));
    };
    updateStoreStatus();
    const interval = setInterval(updateStoreStatus, 30000);
    return () => clearInterval(interval);
  }, [openingHour, closingHour]);

  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<CartItem[]>([]);
  const [count, setCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [activeCurrency, setActiveCurrency] = useState<PublicCurrency>('COP');
  const [rates, setRates] = useState<ExchangeRates | { usd_rate: number; bs_rate: number }>(
    exchangeRates || { usd_rate: 4000, bs_rate: 50 }
  );

  // Form states persisted in localStorage
  const [orderType, setOrderType] = useState<OrderType>('delivery');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [orderNotes, setOrderNotes] = useState('');

  // UI state
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [badgePulse, setBadgePulse] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const drawerRef = useRef<HTMLDivElement>(null);
  const backdropPointerDownRef = useRef(false);

  // Lock body scroll when open
  useModalBodyLock(isOpen);

  // Sync cart from storage/lib
  const syncCart = useCallback(() => {
    const currentItems = getCartItems();
    setItems(currentItems);
    setCount(getCartCount());
    setTotal(getCartTotal());
  }, []);

  // Initialize and register event listeners
  useEffect(() => {
    syncCart();

    // Initial currency from storage
    try {
      const stored = localStorage.getItem(PUBLIC_CURRENCY_STORAGE_KEY) as PublicCurrency | null;
      if (stored === 'COP' || stored === 'USD' || stored === 'BS') {
        setActiveCurrency(stored);
      }
    } catch {
      // LocalStorage unavailable
    }

    // Currency changed event listener
    const handleCurrencyChange = (event: Event) => {
      const customEvent = event as CustomEvent<{
        currency: PublicCurrency;
        rates?: { usd_rate: number; bs_rate: number };
      }>;
      if (customEvent.detail?.currency) {
        setActiveCurrency(customEvent.detail.currency);
      }
      if (customEvent.detail?.rates) {
        setRates(customEvent.detail.rates);
      }
    };

    window.addEventListener(CURRENCY_CHANGE_EVENT, handleCurrencyChange);

    // Load saved customer info
    try {
      const savedType = localStorage.getItem('cart:order_type') as OrderType | null;
      if (savedType && (savedType === 'delivery' || savedType === 'takeaway')) setOrderType(savedType);
      const savedName = localStorage.getItem('cart:customer_name');
      if (savedName) setCustomerName(savedName);
      const savedPhone = localStorage.getItem('cart:customer_phone');
      if (savedPhone) setCustomerPhone(savedPhone);
      const savedAddress = localStorage.getItem('cart:customer_address');
      if (savedAddress) setCustomerAddress(savedAddress);
      const savedPayment = localStorage.getItem('cart:payment_method') as PaymentMethod | null;
      if (savedPayment) setPaymentMethod(savedPayment);
      const savedNotes = localStorage.getItem('cart:order_notes');
      if (savedNotes) setOrderNotes(savedNotes);
    } catch {
      // Ignore storage errors in restricted contexts
    }

    // Check URL parameters (e.g. ?openCart=1 or hash #pedido)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.get('openCart') === '1' || window.location.hash === '#pedido') {
        setIsOpen(true);
        // Clean URL parameter without reloading
        url.searchParams.delete('openCart');
        const cleanUrl = url.pathname + (url.search ? url.search : '');
        window.history.replaceState({}, '', cleanUrl);
      }
    }

    const handleCartUpdated = () => {
      syncCart();
      setBadgePulse(true);
      window.setTimeout(() => setBadgePulse(false), 700);
    };

    const handleOpen = () => {
      syncCart();
      setIsOpen(true);
      setShowClearConfirm(false);
      setFormError(null);
    };

    const handleClose = () => {
      setIsOpen(false);
      setShowClearConfirm(false);
      setFormError(null);
    };

    // Global click listener to intercept any link or button to /pedido or [data-cart-trigger]
    const handleGlobalClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const trigger = target.closest<HTMLElement>(
        'a[href="/pedido"], a[href="#pedido"], [data-cart-trigger], .cart-fab, .prod-nav__cart, .prod-feedback-toast__link',
      );

      if (trigger) {
        // Prevent default navigation
        event.preventDefault();
        event.stopPropagation();
        handleOpen();
      }
    };

    window.addEventListener(CART_EVENT, handleCartUpdated);
    window.addEventListener('storage', handleCartUpdated);
    window.addEventListener(CART_OPEN_EVENT, handleOpen);
    window.addEventListener(CART_CLOSE_EVENT, handleClose);
    document.addEventListener('click', handleGlobalClick, { capture: true });

    return () => {
      window.removeEventListener(CART_EVENT, handleCartUpdated);
      window.removeEventListener('storage', handleCartUpdated);
      window.removeEventListener(CART_OPEN_EVENT, handleOpen);
      window.removeEventListener(CART_CLOSE_EVENT, handleClose);
      window.removeEventListener(CURRENCY_CHANGE_EVENT, handleCurrencyChange);
      document.removeEventListener('click', handleGlobalClick, { capture: true });
    };
  }, [syncCart]);

  // Sync rates when prop changes or fetch if absent
  useEffect(() => {
    if (exchangeRates) {
      setRates(exchangeRates);
    } else {
      fetch('/api/exchange-rates')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.rates) setRates(data.rates);
        })
        .catch(() => {});
    }
  }, [exchangeRates]);

  // Persist form values
  useEffect(() => {
    try {
      localStorage.setItem('cart:order_type', orderType);
      localStorage.setItem('cart:customer_name', customerName);
      localStorage.setItem('cart:customer_phone', customerPhone);
      localStorage.setItem('cart:customer_address', customerAddress);
      localStorage.setItem('cart:payment_method', paymentMethod);
      localStorage.setItem('cart:order_notes', orderNotes);
    } catch {
      // Ignore
    }
  }, [orderType, customerName, customerPhone, customerAddress, paymentMethod, orderNotes]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Sync cart items with fresh product/stock info when opened
  useEffect(() => {
    if (!isOpen) return;

    fetch('/api/public/products')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.products && Array.isArray(data.products)) {
          const changed = syncCartWithLiveProducts(data.products);
          if (changed) {
            syncCart();
          }
        }
      })
      .catch(() => {});
  }, [isOpen, syncCart]);

  // Cart operations
  const handleQuantityChange = (key: string, nextQty: number) => {
    if (nextQty < 1) return;
    const targetItem = items.find((i) => i.key === key);
    if (!targetItem) return;

    if (targetItem.hasInventory && targetItem.stock !== null && targetItem.stock !== undefined) {
      const otherLinesQty = items
        .filter((i) => i.productId === targetItem.productId && i.key !== key)
        .reduce((sum, i) => sum + i.quantity, 0);
      const maxForThis = Math.max(0, targetItem.stock - otherLinesQty);

      if (nextQty > maxForThis) {
        setFormError(
          `Solo hay ${targetItem.stock} ${targetItem.stock === 1 ? 'unidad disponible' : 'unidades disponibles'} en inventario para "${targetItem.name}".`,
        );
        return;
      }
    }

    setFormError(null);
    updateCartItemQuantity(key, nextQty);
    notifyCartChanged();
    syncCart();
  };

  const handleRemove = (key: string) => {
    removeCartItem(key);
    notifyCartChanged();
    syncCart();
  };

  const handleClear = () => {
    clearCart();
    notifyCartChanged();
    syncCart();
    setShowClearConfirm(false);
  };

  // Build WhatsApp URL from current cart state
  const buildWhatsAppUrl = (): string | null => {
    const phone = brandPhone || '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 8) return null;

    const trimmedName = customerName.trim();

    // Modalidad label
    const modalidadMap: Record<OrderType, string> = {
      delivery: '🛵 A Domicilio',
      takeaway: '🛍️ Para Llevar (Retiro en local)',
    };

    // Payment label
    const paymentMap: Record<PaymentMethod, string> = {
      cash: '💵 Efectivo',
      transfer: '📱 Transferencia / Pago móvil',
      card: '💳 Tarjeta de débito/crédito',
    };

    // Construct WhatsApp message
    const orderLines = items.map((item, index) => {
      const unit = item.basePrice + item.adicionales.reduce((sum, extra) => sum + extra.price, 0);
      let line = `${index + 1}. *${item.quantity}× ${item.name}* — ${formatCop(unit * item.quantity)}`;
      if (activeCurrency !== 'COP') {
        line += ` (~ ${formatPriceByCurrency(unit * item.quantity, activeCurrency, rates)})`;
      }

      if (item.notes) {
        line += `\n   ↳ 📝 _${item.notes}_`;
      }

      if (item.adicionales.length > 0) {
        const extraNames = item.adicionales
          .map((a) => {
            if (activeCurrency !== 'COP') {
              return `${a.name} (+${formatCop(a.price)} / +${formatPriceByCurrency(a.price, activeCurrency, rates)})`;
            }
            return `${a.name} (+${formatCop(a.price)})`;
          })
          .join(', ');
        line += `\n   ↳ ➕ Extras: ${extraNames}`;
      }

      return line;
    });

    const lines: string[] = [
      `👋 *¡Hola, ${brandName}! Deseo realizar el siguiente pedido:*`,
      '',
      '📋 *DETALLE DEL PEDIDO:*',
      ...orderLines,
      '',
      `💰 *TOTAL A PAGAR: ${formatCop(total)}${
        activeCurrency !== 'COP' ? ` (~ ${formatPriceByCurrency(total, activeCurrency, rates)})` : ''
      }*`,
      '',
      '👤 *DATOS DEL CLIENTE:*',
      `• Nombre: *${trimmedName}*`,
      `• Teléfono: *${customerPhone.trim()}*`,
      `• Modalidad: *${modalidadMap[orderType]}*`,
    ];

    if (orderType === 'delivery') {
      lines.push(`• Dirección de entrega: *${customerAddress.trim()}*`);
    }

    lines.push(`• Método de pago: *${paymentMap[paymentMethod]}*`);

    if (orderNotes.trim()) {
      lines.push(`• Indicaciones: _${orderNotes.trim()}_`);
    }

    lines.push('', '¡Quedo atento a su confirmación! Muchas gracias.');

    const message = lines.join('\n');
    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  };

  // WhatsApp checkout: create order in backend, then open WhatsApp
  const handleCheckoutWhatsApp = async () => {
    setFormError(null);

    if (!storeOpen) {
      setFormError('Estamos fuera del horario laboral. Los pedidos se reciben en el horario de atención.');
      return;
    }

    if (items.length === 0) {
      setFormError('Tu pedido está vacío. Añade productos antes de ordenar.');
      return;
    }

    const trimmedName = customerName.trim();
    if (!trimmedName) {
      setFormError('Por favor ingresa tu nombre para el pedido.');
      return;
    }

    const trimmedPhone = customerPhone.trim();
    if (!trimmedPhone || trimmedPhone.length < 7) {
      setFormError('Por favor ingresa tu número de teléfono.');
      return;
    }

    if (orderType === 'delivery' && !customerAddress.trim()) {
      setFormError('Por favor indica tu dirección de entrega.');
      return;
    }

    const waPhone = brandPhone || '';
    const waDigits = waPhone.replace(/\D/g, '');
    if (waDigits.length < 8) {
      setFormError('No se encontró un número de WhatsApp configurado en el sistema.');
      return;
    }

    for (const item of items) {
      if (item.hasInventory && item.stock !== null && item.stock !== undefined) {
        const totalForProduct = items
          .filter((i) => i.productId === item.productId)
          .reduce((sum, i) => sum + i.quantity, 0);

        if (totalForProduct > item.stock) {
          setFormError(
            `El producto "${item.name}" excede el stock disponible en inventario (${item.stock} disponibles, tienes ${totalForProduct} en el pedido). Por favor ajusta las cantidades.`,
          );
          return;
        }
      }
    }

    setIsSubmitting(true);

    try {
      // Map cart items to API format
      const apiItems = items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        notes: item.notes || undefined,
        adicional_ids: item.adicionales.map((a) => a.id),
      }));

      const response = await fetch('/api/public/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_type: orderType === 'takeaway' ? 'para_llevar' : 'delivery',
          customer_name: trimmedName,
          customer_phone: trimmedPhone,
          delivery_address: orderType === 'delivery' ? customerAddress.trim() : undefined,
          delivery_notes: orderNotes.trim() || undefined,
          payment_method_hint: paymentMethod,
          items: apiItems,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          (errorData as { error?: string }).error ?? 'No se pudo crear el pedido. Intenta de nuevo.',
        );
      }

      // Order created successfully — open WhatsApp
      const waUrl = buildWhatsAppUrl();
      if (waUrl) {
        window.open(waUrl, '_blank', 'noopener,noreferrer');
      }

      // Clear cart and show success
      clearCart();
      notifyCartChanged();
      syncCart();
      setSubmitSuccess(true);

      // Reset success state after a few seconds
      window.setTimeout(() => {
        setSubmitSuccess(false);
        setIsOpen(false);
      }, 4000);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al crear el pedido.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* FLOATING CART BUTTON (Always reachable across public pages) */}
      {showFloatingButton && (
        <button
          type="button"
          className={`cart-drawer-fab ${count > 0 ? 'cart-drawer-fab--has-items' : ''} ${
            badgePulse ? 'cart-drawer-fab--pulse' : ''
          } ${!storeOpen ? 'cart-drawer-fab--disabled' : ''}`}
          onClick={() => {
            if (!storeOpen) return;
            setIsOpen(true);
          }}
          disabled={!storeOpen}
          aria-label={
            !storeOpen
              ? 'Pedidos dentro del horario laboral'
              : `Ver mi pedido (${count} productos)`
          }
          aria-expanded={isOpen}
          title={
            !storeOpen
              ? `Pedidos dentro del horario laboral (${openingHour || ''} - ${closingHour || ''})`
              : undefined
          }
        >
          {storeOpen ? (
            <>
              <div className="cart-drawer-fab__glow" aria-hidden="true" />
              <div className="cart-drawer-fab__icon-wrapper">
                <ShoppingBag className="cart-drawer-fab__icon" size={20} strokeWidth={2.2} />
                {count > 0 && <span className="cart-drawer-fab__badge">{count}</span>}
              </div>
              <div className="cart-drawer-fab__content">
                <div className="cart-drawer-fab__text">
                  <span className="cart-drawer-fab__label">
                    {count > 0 ? 'Ver mi pedido' : 'Mi pedido'}
                  </span>
                  <span className="cart-drawer-fab__sub">
                    {count > 0
                      ? `${count} ${count === 1 ? 'producto' : 'productos'}`
                      : 'Sin productos'}
                  </span>
                </div>
                {count > 0 && (
                  <div className="cart-drawer-fab__total-tag">
                    {formatPriceByCurrency(total, activeCurrency, rates)}
                  </div>
                )}
              </div>
              <div className="cart-drawer-fab__chevron" aria-hidden="true">
                <ChevronRight size={18} strokeWidth={2.5} />
              </div>
            </>
          ) : (
            <>
              <div className="cart-drawer-fab__icon-wrapper cart-drawer-fab__icon-wrapper--closed">
                <Clock className="cart-drawer-fab__icon" size={20} strokeWidth={2.2} />
              </div>
              <div className="cart-drawer-fab__content">
                <div className="cart-drawer-fab__text">
                  <span className="cart-drawer-fab__label">
                    Pedidos dentro del horario laboral
                  </span>
                  <span className="cart-drawer-fab__sub">
                    {openingHour && closingHour ? `Horario: ${openingHour} a ${closingHour}` : 'Cerrado por ahora'}
                  </span>
                </div>
              </div>
            </>
          )}
        </button>
      )}

      {/* DRAWER OVERLAY & PANEL */}
      <div
        className={`cart-drawer-overlay ${isOpen ? 'cart-drawer-overlay--visible' : ''}`}
        role="presentation"
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) {
            backdropPointerDownRef.current = true;
          }
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget && backdropPointerDownRef.current) {
            setIsOpen(false);
          }
          backdropPointerDownRef.current = false;
        }}
      >
        <aside
          ref={drawerRef}
          className={`cart-drawer ${isOpen ? 'cart-drawer--open' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-label="Tu pedido"
        >
          {/* HEADER */}
          <header className="cart-drawer__header">
            <div className="cart-drawer__title-group">
              <div className="cart-drawer__header-icon" aria-hidden="true">
                <ShoppingBag size={20} />
              </div>
              <div>
                <h2 className="cart-drawer__title">Mi pedido</h2>
                <p className="cart-drawer__subtitle">
                  {count === 0 ? 'Sin productos' : `${count} ${count === 1 ? 'producto' : 'productos'}`}
                </p>
              </div>
            </div>

            <button
              type="button"
              className="cart-drawer__close-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Cerrar pedido"
            >
              <X size={20} />
            </button>
          </header>

          {/* BODY */}
          <div className="cart-drawer__body">
            {!storeOpen && (
              <div className="cart-drawer__closed-notice" role="alert">
                <Clock size={16} />
                <span>
                  Fuera de horario laboral. Los pedidos se reciben de {openingHour} a {closingHour} (Hora VZLA).
                </span>
              </div>
            )}
            {items.length === 0 ? (
              <div className="cart-drawer__empty">
                <div className="cart-drawer__empty-illustration" aria-hidden="true">
                  <div className="cart-drawer__empty-circle">
                    <ShoppingBag size={48} strokeWidth={1.5} />
                  </div>
                  <Sparkles className="cart-drawer__empty-sparkle" size={24} />
                </div>
                <h3 className="cart-drawer__empty-title">Tu pedido está vacío</h3>
                <p className="cart-drawer__empty-desc">
                  Explora las opciones del menú y agrega tus platos y bebidas favoritas para armar tu orden.
                </p>
                <button
                  type="button"
                  className="cart-drawer__empty-cta"
                  onClick={() => setIsOpen(false)}
                >
                  Explorar la carta
                  <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              <div className="cart-drawer__content">
                {/* ITEMS LIST */}
                <section className="cart-drawer__items-section">
                  <div className="cart-drawer__section-header">
                    <span className="cart-drawer__section-title">Artículos seleccionados</span>
                    <span className="cart-drawer__section-count">{items.length} líneas</span>
                  </div>

                  <ul className="cart-drawer__items-list">
                    {items.map((item) => {
                      const itemLineTotal = linePrice(item);
                      return (
                        <li key={item.key} className="cart-item">
                          <div className="cart-item__media">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="cart-item__img"
                                loading="lazy"
                              />
                            ) : (
                              <div className="cart-item__placeholder" aria-hidden="true">
                                <span>{item.name.trim().charAt(0).toUpperCase()}</span>
                              </div>
                            )}
                          </div>

                          <div className="cart-item__info">
                            <div className="cart-item__header-row">
                              <h4 className="cart-item__name">{item.name}</h4>
                              <button
                                type="button"
                                className="cart-item__delete-btn"
                                onClick={() => handleRemove(item.key)}
                                title="Eliminar ítem"
                                aria-label={`Eliminar ${item.name}`}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>

                            {item.notes && (
                              <p className="cart-item__notes">
                                <span className="cart-item__notes-tag">Nota:</span> {item.notes}
                              </p>
                            )}

                            {item.adicionales.length > 0 && (
                              <div className="cart-item__extras">
                                {item.adicionales.map((extra) => (
                                  <span key={extra.id} className="cart-item__extra-chip">
                                    +{extra.name} ({formatPriceByCurrency(extra.price, activeCurrency, rates)})
                                  </span>
                                ))}
                              </div>
                            )}

                            {item.hasInventory && item.stock !== null && item.stock !== undefined && (
                              <div className="cart-item__stock-info">
                                {item.quantity >
                                Math.max(
                                  0,
                                  item.stock -
                                    items
                                      .filter((i) => i.productId === item.productId && i.key !== item.key)
                                      .reduce((s, i) => s + i.quantity, 0),
                                ) ? (
                                  <span className="cart-item__stock-tag cart-item__stock-tag--warning">
                                    ⚠️ Excede el stock disponible ({item.stock} en total)
                                  </span>
                                ) : (
                                  <span className="cart-item__stock-tag">
                                    Stock disponible: {item.stock}
                                  </span>
                                )}
                              </div>
                            )}

                            <div className="cart-item__bottom-row">
                              <div className="cart-item__price-box">
                                <span className="cart-item__price-label">Subtotal</span>
                                <span className="cart-item__price-val">
                                  {formatPriceByCurrency(itemLineTotal, activeCurrency, rates)}
                                </span>
                              </div>

                              <div className="cart-item__qty-control">
                                <button
                                  type="button"
                                  className="cart-item__qty-btn"
                                  onClick={() => handleQuantityChange(item.key, item.quantity - 1)}
                                  disabled={item.quantity <= 1}
                                  aria-label="Disminuir cantidad"
                                >
                                  <Minus size={14} />
                                </button>
                                <span className="cart-item__qty-val">{item.quantity}</span>
                                {(() => {
                                  const otherLinesQty = items
                                    .filter((i) => i.productId === item.productId && i.key !== item.key)
                                    .reduce((sum, i) => sum + i.quantity, 0);
                                  const maxForThis =
                                    item.hasInventory && item.stock !== null && item.stock !== undefined
                                      ? Math.max(0, item.stock - otherLinesQty)
                                      : Infinity;
                                  const isAtMax = item.quantity >= maxForThis;

                                  return (
                                    <button
                                      type="button"
                                      className="cart-item__qty-btn"
                                      onClick={() => handleQuantityChange(item.key, item.quantity + 1)}
                                      disabled={isAtMax}
                                      aria-label="Aumentar cantidad"
                                      title={isAtMax ? `Stock máximo alcanzado (${item.stock} disponibles)` : undefined}
                                    >
                                      <Plus size={14} />
                                    </button>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>

                {/* CUSTOMER & DELIVERY DETAILS */}
                <section className="cart-drawer__form-section">
                  <button
                    type="button"
                    className="cart-drawer__form-toggle"
                    onClick={() => setShowDetails((prev) => !prev)}
                    aria-expanded={showDetails}
                  >
                    <div className="cart-drawer__form-toggle-title">
                      <Receipt size={17} />
                      <span>Datos para la entrega / pedido</span>
                    </div>
                    <span className="cart-drawer__form-toggle-indicator">
                      {showDetails ? 'Ocultar' : 'Completar datos'}
                    </span>
                  </button>

                  {showDetails && (
                    <div className="cart-drawer__form-fields">
                      {/* ORDER TYPE SELECTOR */}
                      <div className="cart-drawer__field">
                        <label className="cart-drawer__label">Tipo de servicio</label>
                        <div className="cart-drawer__type-grid">
                          <button
                            type="button"
                            className={`cart-drawer__type-btn ${
                              orderType === 'delivery' ? 'cart-drawer__type-btn--active' : ''
                            }`}
                            onClick={() => setOrderType('delivery')}
                          >
                            <Bike size={16} />
                            <span>Domicilio</span>
                          </button>
                          <button
                            type="button"
                            className={`cart-drawer__type-btn ${
                              orderType === 'takeaway' ? 'cart-drawer__type-btn--active' : ''
                            }`}
                            onClick={() => setOrderType('takeaway')}
                          >
                            <Store size={16} />
                            <span>Para Llevar</span>
                          </button>
                        </div>
                      </div>

                      {/* CUSTOMER NAME */}
                      <div className="cart-drawer__field">
                        <label htmlFor="drawer-name" className="cart-drawer__label">
                          <User size={14} />
                          <span>Nombre *</span>
                        </label>
                        <input
                          id="drawer-name"
                          type="text"
                          className="cart-drawer__input"
                          placeholder="¿A nombre de quién registramos el pedido?"
                          value={customerName}
                          onChange={(e) => {
                            setCustomerName(e.target.value);
                            setFormError(null);
                          }}
                          autoComplete="name"
                        />
                      </div>

                      {/* CUSTOMER PHONE */}
                      <div className="cart-drawer__field">
                        <label htmlFor="drawer-phone" className="cart-drawer__label">
                          <Phone size={14} />
                          <span>Teléfono *</span>
                        </label>
                        <input
                          id="drawer-phone"
                          type="tel"
                          className="cart-drawer__input"
                          placeholder="Ej. 0424-7217176"
                          value={customerPhone}
                          onChange={(e) => {
                            setCustomerPhone(e.target.value);
                            setFormError(null);
                          }}
                          autoComplete="tel"
                        />
                      </div>

                      {/* CONDITIONAL ADDRESS */}
                      {orderType === 'delivery' && (
                        <div className="cart-drawer__field">
                          <label htmlFor="drawer-address" className="cart-drawer__label">
                            <MapPin size={14} />
                            <span>Dirección de entrega *</span>
                          </label>
                          <input
                            id="drawer-address"
                            type="text"
                            className="cart-drawer__input"
                            placeholder="Calle, número, barrio o punto de referencia"
                            value={customerAddress}
                            onChange={(e) => {
                              setCustomerAddress(e.target.value);
                              setFormError(null);
                            }}
                            autoComplete="street-address"
                          />
                        </div>
                      )}

                      {/* PAYMENT METHOD */}
                      <div className="cart-drawer__field">
                        <label className="cart-drawer__label">
                          <CreditCard size={14} />
                          <span>Forma de pago prevista</span>
                        </label>
                        <div className="cart-drawer__payment-grid">
                          <button
                            type="button"
                            className={`cart-drawer__payment-btn ${
                              paymentMethod === 'cash' ? 'cart-drawer__payment-btn--active' : ''
                            }`}
                            onClick={() => setPaymentMethod('cash')}
                          >
                            <Banknote size={15} />
                            <span>Efectivo</span>
                          </button>
                          <button
                            type="button"
                            className={`cart-drawer__payment-btn ${
                              paymentMethod === 'transfer' ? 'cart-drawer__payment-btn--active' : ''
                            }`}
                            onClick={() => setPaymentMethod('transfer')}
                          >
                            <Send size={15} />
                            <span>Transferencia</span>
                          </button>
                          <button
                            type="button"
                            className={`cart-drawer__payment-btn ${
                              paymentMethod === 'card' ? 'cart-drawer__payment-btn--active' : ''
                            }`}
                            onClick={() => setPaymentMethod('card')}
                          >
                            <CreditCard size={15} />
                            <span>Tarjeta</span>
                          </button>
                        </div>
                      </div>

                      {/* ORDER NOTES */}
                      <div className="cart-drawer__field">
                        <label htmlFor="drawer-notes" className="cart-drawer__label">
                          <MessageSquare size={14} />
                          <span>Instrucciones generales (opcional)</span>
                        </label>
                        <textarea
                          id="drawer-notes"
                          className="cart-drawer__textarea"
                          rows={2}
                          placeholder="Ej. Timbre no funciona, traer cambio de $50.000..."
                          value={orderNotes}
                          onChange={(e) => setOrderNotes(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>

          {/* FOOTER */}
          {items.length > 0 && (
            <footer className="cart-drawer__footer">
              {formError && (
                <div className="cart-drawer__error" role="alert">
                  <AlertCircle size={16} />
                  <span>{formError}</span>
                </div>
              )}

              {/* TOTAL ROW */}
              <div className="cart-drawer__summary">
                <div className="cart-drawer__summary-line">
                  <span className="cart-drawer__summary-label">Subtotal estimado</span>
                  <span className="cart-drawer__summary-val">
                    {formatPriceByCurrency(total, activeCurrency, rates)}
                  </span>
                </div>
                <div className="cart-drawer__total-line">
                  <span className="cart-drawer__total-label">Total a pagar</span>
                  <span className="cart-drawer__total-amount">
                    {formatPriceByCurrency(total, activeCurrency, rates)}
                  </span>
                </div>
                {activeCurrency !== 'COP' && (
                  <div className="cart-drawer__total-secondary">
                    <span>Base en COP: <strong>{formatCop(total)}</strong></span>
                  </div>
                )}
              </div>

              {/* SUCCESS MESSAGE */}
              {submitSuccess && (
                <div className="cart-drawer__success" role="status">
                  <CheckCircle2 size={20} />
                  <span>¡Pedido creado exitosamente! Redirigiendo a WhatsApp...</span>
                </div>
              )}

              {/* WHATSAPP SUBMIT BUTTON */}
              <button
                type="button"
                className={`cart-drawer__submit-btn ${!storeOpen ? 'cart-drawer__submit-btn--disabled' : ''}`}
                onClick={handleCheckoutWhatsApp}
                disabled={isSubmitting || submitSuccess || !storeOpen}
              >
                {!storeOpen ? (
                  <>
                    <Clock size={18} />
                    <span>Pedidos dentro del horario laboral</span>
                  </>
                ) : isSubmitting ? (
                  <>
                    <Loader2 className="cart-drawer__spin" size={20} />
                    <span>Creando pedido...</span>
                  </>
                ) : (
                  <>
                    <span className="cart-drawer__submit-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.888 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                    </span>
                    <span>Enviar pedido por WhatsApp</span>
                  </>
                )}
              </button>

              {/* SECONDARY CONTROLS */}
              <div className="cart-drawer__footer-actions">
                <button
                  type="button"
                  className="cart-drawer__continue-btn"
                  onClick={() => setIsOpen(false)}
                >
                  Seguir pidiendo
                </button>

                {!showClearConfirm ? (
                  <button
                    type="button"
                    className="cart-drawer__clear-btn"
                    onClick={() => setShowClearConfirm(true)}
                  >
                    Vaciar pedido
                  </button>
                ) : (
                  <div className="cart-drawer__clear-confirm">
                    <span>¿Vaciar todo?</span>
                    <button
                      type="button"
                      className="cart-drawer__clear-yes"
                      onClick={handleClear}
                    >
                      Sí, vaciar
                    </button>
                    <button
                      type="button"
                      className="cart-drawer__clear-no"
                      onClick={() => setShowClearConfirm(false)}
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            </footer>
          )}
        </aside>
      </div>
    </>
  );
}
