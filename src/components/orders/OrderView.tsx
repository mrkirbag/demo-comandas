import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ChefHat,
  Loader2,
  Minus,
  Plus,
  Printer,
  Receipt,
  MessageCircle,
  Search,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';

import { getMenuCategoryLabel, menuCategories } from '@/data/product-categories';
import MultiCurrencyPrice from '@/components/ui/MultiCurrencyPrice';
import KitchenTicketModal from '@/components/orders/KitchenTicketModal';
import SaleTicketModal from '@/components/tickets/SaleTicketModal';
import { Alert, Spinner } from '@/components/ui/Feedback';
import Modal from '@/components/ui/Modal';
import { isDeliveryReadyForDispatch, openDeliveryReadyWhatsApp } from '@/lib/delivery/whatsapp';
import type { OrderItemWithProduct } from '@/lib/db/orders';
import type { Product } from '@/lib/db/types';
import { useExchangeRates } from '@/lib/hooks/queries/useExchangeRates';
import { useOrderDetail } from '@/lib/hooks/queries/useOrderDetail';
import { formatOrderLabel } from '@/lib/orders/display';
import {
  ADICIONALES_CATEGORY,
  formatExtraLine,
  productUsesAdicionales,
} from '@/lib/orders/item-extras';
import {
  buildItemNotes,
  getApplicableModifierGroups,
  getDefaultSelections,
  getItemPreferenceLabel,
  toggleMultipleModifierOption,
} from '@/lib/orders/item-preferences';
import { formatCop } from '@/lib/utils/currency';
import {
  canMarkOrderDelivered,
  canPayOrder,
  canSendOrderToKitchen,
  DELIVERY_PAYMENT_TIMING_LABELS,
  getDeliveryPaymentTiming,
  getOrderStatusHint,
} from '@/lib/orders/delivery-flow';
import { STATUS_LABELS } from '@/lib/orders/labels';
import { parseError } from '@/lib/api/parseError';
import { queryKeys } from '@/lib/query/keys';
import { panelNavigate } from '@/lib/navigation/panelNavigate';
import { withAppProviders } from '@/lib/providers/withAppProviders';

import './OrderView.css';

type OrderViewProps = {
  orderId: string;
  canDeliver?: boolean;
};

type CategoryFilter = string | 'all';

type AddItemForm = {
  product: Product;
  quantity: string;
  selections: Record<string, string[]>;
  adicionalIds: string[];
};

type ActingAction = 'add-item' | 'send-kitchen' | 'cancel' | 'deliver' | 'mark-ready';

function formatPrice(value: number): string {
  return formatCop(value);
}

function selectedModifierOptions(form: AddItemForm, groupId: string): string[] {
  return form.selections[groupId] ?? [];
}

function selectedAdicionalesTotal(products: Product[], ids: string[]): number {
  const selected = new Set(ids);
  return products.reduce(
    (total, product) => (selected.has(product.id) ? total + product.price : total),
    0,
  );
}

function OrderView({ orderId, canDeliver = false }: OrderViewProps) {
  const queryClient = useQueryClient();
  const { rates } = useExchangeRates();
  const { data, products, isLoading, error: loadError } = useOrderDetail(orderId);
  const [actionError, setActionError] = useState('');
  const [actingItemId, setActingItemId] = useState<string | null>(null);
  const [actingAction, setActingAction] = useState<ActingAction | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [addForm, setAddForm] = useState<AddItemForm | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [kitchenTicketOpen, setKitchenTicketOpen] = useState(false);
  const [kitchenTicketSentAt, setKitchenTicketSentAt] = useState<string | null>(null);
  const [saleTicketOpen, setSaleTicketOpen] = useState(false);

  const isEditable = data?.order.status === 'pendiente';

  const adicionalProducts = useMemo(
    () => products.filter((product) => product.category === ADICIONALES_CATEGORY),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return products.filter((product) => {
      if (categoryFilter !== 'all' && product.category !== categoryFilter) return false;
      if (!query) return true;

      const categoryLabel = getMenuCategoryLabel(product.category).toLowerCase();
      return (
        product.name.toLowerCase().includes(query) ||
        categoryLabel.includes(query) ||
        formatPrice(product.price).toLowerCase().includes(query)
      );
    });
  }, [products, categoryFilter, searchQuery]);

  const invalidateOrder = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.order(orderId) });
    void queryClient.invalidateQueries({ queryKey: ['orders'] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.tables });
    void queryClient.invalidateQueries({ queryKey: queryKeys.kitchenOrders });
    void queryClient.invalidateQueries({ queryKey: queryKeys.cashRegister });
  };

  const addItemMutation = useMutation({
    mutationFn: async (payload: {
      product_id: string;
      quantity: number;
      notes?: string;
      adicional_ids?: string[];
    }) => {
      const response = await fetch(`/api/orders/${orderId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await parseError(response));
      return response.json();
    },
    onMutate: () => {
      setActingAction('add-item');
      setActionError('');
    },
    onSuccess: () => {
      invalidateOrder();
      setAddForm(null);
    },
    onError: (err) => setActionError(err instanceof Error ? err.message : 'No se pudo agregar el producto'),
    onSettled: () => setActingAction(null),
  });

  const updateQtyMutation = useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      const response = await fetch(`/api/orders/${orderId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity }),
      });
      if (!response.ok) throw new Error(await parseError(response));
      return response.json();
    },
    onMutate: ({ itemId }) => {
      setActingItemId(itemId);
      setActionError('');
    },
    onSuccess: () => invalidateOrder(),
    onError: (err) => setActionError(err instanceof Error ? err.message : 'No se pudo actualizar la cantidad'),
    onSettled: () => setActingItemId(null),
  });

  const removeItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const response = await fetch(`/api/orders/${orderId}/items/${itemId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await parseError(response));
      return response.json();
    },
    onMutate: (itemId) => {
      setActingItemId(itemId);
      setActionError('');
    },
    onSuccess: () => invalidateOrder(),
    onError: (err) => setActionError(err instanceof Error ? err.message : 'No se pudo eliminar el ítem'),
    onSettled: () => setActingItemId(null),
  });

  const sendKitchenMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cocina' }),
      });
      if (!response.ok) throw new Error(await parseError(response));
      return response.json();
    },
    onMutate: () => {
      setActingAction('send-kitchen');
      setActionError('');
    },
    onSuccess: (json) => {
      invalidateOrder();
      setKitchenTicketSentAt(json.order.updated_at);
      setKitchenTicketOpen(true);
    },
    onError: (err) => setActionError(err instanceof Error ? err.message : 'No se pudo enviar a cocina'),
    onSettled: () => setActingAction(null),
  });

  const deliverMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'entregado' }),
      });
      if (!response.ok) throw new Error(await parseError(response));
      return response.json();
    },
    onMutate: () => {
      setActingAction('deliver');
      setActionError('');
    },
    onSuccess: () => invalidateOrder(),
    onError: (err) => setActionError(err instanceof Error ? err.message : 'No se pudo marcar como entregado'),
    onSettled: () => setActingAction(null),
  });

  const markReadyMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'listo' }),
      });
      if (!response.ok) throw new Error(await parseError(response));
      return response.json();
    },
    onMutate: () => {
      setActingAction('mark-ready');
      setActionError('');
    },
    onSuccess: () => {
      invalidateOrder();
      if (data?.order.order_type === 'delivery') {
        openDeliveryReadyWhatsApp(data.order);
      }
    },
    onError: (err) => setActionError(err instanceof Error ? err.message : 'No se pudo marcar listo'),
    onSettled: () => setActingAction(null),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelado' }),
      });
      if (!response.ok) throw new Error(await parseError(response));
    },
    onMutate: () => {
      setActingAction('cancel');
      setActionError('');
    },
    onSuccess: () => {
      void panelNavigate(
        data?.order.order_type === 'delivery' ? '/panel/domicilios' : '/panel/mesas',
      );
    },
    onError: (err) => setActionError(err instanceof Error ? err.message : 'No se pudo cancelar la comanda'),
    onSettled: () => {
      setActingAction(null);
      setShowCancelConfirm(false);
    },
  });

  function handleAddItem(event: React.FormEvent) {
    event.preventDefault();
    if (!addForm) return;

    const quantity = Number(addForm.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      setActionError('Cantidad inválida');
      return;
    }

    const modifierGroups = getApplicableModifierGroups(addForm.product.category);
    const showAdicionales = productUsesAdicionales(addForm.product.category);

    for (const group of modifierGroups) {
      const selected = addForm.selections[group.id] ?? [];
      if (group.required && selected.length === 0) {
        setActionError(`Selecciona ${group.label.toLowerCase()}`);
        return;
      }
    }

    addItemMutation.mutate({
      product_id: addForm.product.id,
      quantity,
      notes: buildItemNotes(addForm.product.category, addForm.selections),
      adicional_ids: showAdicionales ? addForm.adicionalIds : undefined,
    });
  }

  function updateItemQuantity(item: OrderItemWithProduct, delta: number) {
    const nextQuantity = item.quantity + delta;
    if (nextQuantity < 1) return;
    updateQtyMutation.mutate({ itemId: item.id, quantity: nextQuantity });
  }

  const displayError =
    actionError ||
    (loadError instanceof Error ? loadError.message : loadError ? 'No se pudo cargar la comanda' : '');

  if (isLoading) {
    return <Spinner label="Cargando comanda…" className="order-view__loading" />;
  }

  if (displayError && !data) {
    return <Alert className="order-view__alert">{displayError}</Alert>;
  }

  if (!data) {
    return <Alert className="order-view__alert">Comanda no encontrada</Alert>;
  }

  const { order, items, table, payments = [] } = data;
  const showSendToKitchen = canSendOrderToKitchen(order);
  const showPayLink = canPayOrder(order) && items.length > 0;
  const showDeliverButton = canDeliver && canMarkOrderDelivered(order);
  const statusHint = getOrderStatusHint(order);
  const isSendingKitchen = actingAction === 'send-kitchen';
  const isCancelling = actingAction === 'cancel';
  const isDelivering = actingAction === 'deliver';
  const isMarkingReady = actingAction === 'mark-ready';
  const isAddingItem = actingAction === 'add-item';

  return (
    <div className="order-view">
      <a
        href={order.order_type === 'delivery' ? '/panel/domicilios' : '/panel/mesas'}
        className="order-view__back"
      >
        <ArrowLeft size={16} />
        {order.order_type === 'delivery' ? 'Volver a domicilios' : 'Volver a mesas'}
      </a>

      <div className="order-view__header">
        <div>
          <p className="order-view__eyebrow">
            Comanda · {formatOrderLabel({ ...order, table_number: table?.number ?? null })}
          </p>
          <h2 className="order-view__title">
            {items.length === 0 ? 'Nueva comanda' : `${items.length} producto${items.length === 1 ? '' : 's'}`}
          </h2>
        </div>
        <span className={`order-view__status order-view__status--${order.status}`}>
          {STATUS_LABELS[order.status]}
        </span>
      </div>

      {statusHint && <p className="order-view__hint">{statusHint}</p>}

      {displayError && data && <Alert className="order-view__alert">{displayError}</Alert>}

      {order.order_type === 'delivery' && (
        <div className="order-view__delivery-info">
          <p>
            <strong>{order.customer_name}</strong> · {order.customer_phone}
          </p>
          <p>{order.delivery_address}</p>
          {order.delivery_notes && <p className="order-view__delivery-notes">{order.delivery_notes}</p>}
          <p className="order-view__delivery-timing">
            {DELIVERY_PAYMENT_TIMING_LABELS[getDeliveryPaymentTiming(order)]}
          </p>
        </div>
      )}

      <div className={`order-view__layout ${!isEditable ? 'order-view__layout--readonly' : ''}`}>
        {isEditable && (
          <section className="order-view__catalog" aria-label="Catálogo">
            <div className="order-view__catalog-toolbar">
              <div className="order-view__search">
                <Search size={16} />
                <input
                  type="search"
                  placeholder="Buscar producto…"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </div>

              <div className="order-view__categories">
                <button
                  type="button"
                  className={`order-view__category ${categoryFilter === 'all' ? 'order-view__category--active' : ''}`}
                  onClick={() => setCategoryFilter('all')}
                >
                  Todos
                </button>
                {menuCategories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    className={`order-view__category ${categoryFilter === category.id ? 'order-view__category--active' : ''}`}
                    onClick={() => setCategoryFilter(category.id)}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="order-view__product-grid">
              {filteredProducts.length === 0 ? (
                <p className="order-view__empty-catalog">No hay productos en esta categoría.</p>
              ) : (
                filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    className="order-view__product-card"
                    onClick={() => {
                      setAddForm({
                        product,
                        quantity: '1',
                        selections: getDefaultSelections(product.category),
                        adicionalIds: [],
                      });
                      setActionError('');
                    }}
                  >
                    <span className="order-view__product-name">{product.name}</span>
                    <span className="order-view__product-category">
                      {getMenuCategoryLabel(product.category)}
                    </span>
                    <span className="order-view__product-price">
                      <MultiCurrencyPrice amountCop={product.price} rates={rates} />
                    </span>
                  </button>
                ))
              )}
            </div>
          </section>
        )}

        <section className="order-view__ticket" aria-label="Detalle de comanda">
          <div className="order-view__ticket-header">
            <h3>Detalle</h3>
            <span>{table?.capacity ?? '—'} personas</span>
          </div>

          {items.length === 0 ? (
            <div className="order-view__empty-items">
              <p>Agrega productos desde el catálogo para armar el pedido.</p>
            </div>
          ) : (
            <ul className="order-view__items">
              {items.map((item) => {
                const isItemActing = actingItemId === item.id;
                const preferences = getItemPreferenceLabel(item);
                const extras = item.extras ?? [];

                return (
                  <li key={item.id} className="order-view__item">
                    <div className="order-view__item-main">
                      <div>
                        <p className="order-view__item-name">{item.product_name}</p>
                        {preferences && <p className="order-view__item-notes">{preferences}</p>}
                        {extras.length > 0 && (
                          <ul className="order-view__item-extras">
                            {extras.map((extra) => (
                              <li key={extra.product_id}>{formatExtraLine(extra)}</li>
                            ))}
                          </ul>
                        )}
                        <p className="order-view__item-unit">
                          <MultiCurrencyPrice
                            amountCop={item.price_at_sale}
                            rates={rates}
                            variant="inline"
                          />{' '}
                          c/u
                        </p>
                      </div>
                      <p className="order-view__item-subtotal">
                        <MultiCurrencyPrice
                          amountCop={item.quantity * item.price_at_sale}
                          rates={rates}
                          align="right"
                        />
                      </p>
                    </div>

                    {isEditable && (
                      <div className="order-view__item-actions">
                        <div className="order-view__qty">
                          <button
                            type="button"
                            onClick={() => updateItemQuantity(item, -1)}
                            disabled={isItemActing || item.quantity <= 1}
                            aria-label="Reducir cantidad"
                          >
                            {isItemActing ? (
                              <Loader2 className="order-view__spin" size={14} />
                            ) : (
                              <Minus size={14} />
                            )}
                          </button>
                          <span>{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateItemQuantity(item, 1)}
                            disabled={isItemActing}
                            aria-label="Aumentar cantidad"
                          >
                            {isItemActing ? (
                              <Loader2 className="order-view__spin" size={14} />
                            ) : (
                              <Plus size={14} />
                            )}
                          </button>
                        </div>
                        <button
                          type="button"
                          className="order-view__remove"
                          onClick={() => removeItemMutation.mutate(item.id)}
                          disabled={isItemActing}
                          aria-label="Eliminar ítem"
                        >
                          {isItemActing ? (
                            <Loader2 className="order-view__spin" size={14} />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </button>
                      </div>
                    )}

                    {!isEditable && (
                      <p className="order-view__item-qty-readonly">Cantidad: {item.quantity}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="order-view__footer">
            <div className="order-view__total">
              <span>Total</span>
              <MultiCurrencyPrice amountCop={order.total} rates={rates} variant="total" align="right" />
            </div>

            {isEditable && (
              <>
                {items.length > 0 && (
                  <button
                    type="button"
                    className="order-view__print-ticket-btn"
                    onClick={() => setSaleTicketOpen(true)}
                  >
                    <Printer size={16} />
                    Imprimir ticket
                  </button>
                )}
                {showPayLink && (
                  <a href="/panel/caja" className="order-view__pay-link">
                    <Receipt size={16} />
                    Cobrar y facturar en caja
                  </a>
                )}
                <button
                  type="button"
                  className="order-view__cancel-btn"
                  onClick={() => setShowCancelConfirm(true)}
                  disabled={isCancelling}
                >
                  <XCircle size={16} />
                  Cancelar comanda
                </button>
              </>
            )}

            {!isEditable && showSendToKitchen && (
              <button
                type="button"
                className="order-view__send-btn"
                onClick={() => sendKitchenMutation.mutate()}
                disabled={isSendingKitchen || items.length === 0}
              >
                {isSendingKitchen ? (
                  <Loader2 className="order-view__spin" size={16} />
                ) : (
                  <ChefHat size={16} />
                )}
                Enviar a cocina
              </button>
            )}

            {!isEditable && order.status === 'cocina' && (
              <>
                <button
                  type="button"
                  className="order-view__print-ticket-btn"
                  onClick={() => setKitchenTicketOpen(true)}
                >
                  <Printer size={16} />
                  Ver ticket de cocina
                </button>
                {canDeliver && (
                  <button
                    type="button"
                    className="order-view__deliver-btn"
                    onClick={() => markReadyMutation.mutate()}
                    disabled={isMarkingReady}
                  >
                    {isMarkingReady ? (
                      <Loader2 className="order-view__spin" size={16} />
                    ) : (
                      <CheckCircle2 size={16} />
                    )}
                    Listo y entregar
                  </button>
                )}
              </>
            )}

            {!isEditable && order.status === 'listo' && (
              <>
                <button
                  type="button"
                  className="order-view__print-ticket-btn"
                  onClick={() => setKitchenTicketOpen(true)}
                >
                  <Printer size={16} />
                  Ver ticket de cocina
                </button>
                {isDeliveryReadyForDispatch(order) && (
                  <button
                    type="button"
                    className="order-view__whatsapp-btn"
                    onClick={() => {
                      if (!openDeliveryReadyWhatsApp(order)) {
                        setActionError('No se pudo abrir WhatsApp. Verifica el teléfono del cliente.');
                      }
                    }}
                  >
                    <MessageCircle size={16} />
                    Avisar por WhatsApp
                  </button>
                )}
              </>
            )}

            {showDeliverButton && (
              <button
                type="button"
                className="order-view__deliver-btn"
                onClick={() => deliverMutation.mutate()}
                disabled={isDelivering}
              >
                {isDelivering ? (
                  <Loader2 className="order-view__spin" size={16} />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                Marcar entregado
              </button>
            )}
          </div>
        </section>
      </div>

      <Modal
        open={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        title="¿Cancelar comanda?"
        panelClassName="order-view__modal order-view__modal--confirm"
        className="order-view__modal-backdrop"
      >
        <p>
          {order.order_type === 'delivery'
            ? 'Se cancelará este domicilio'
            : `La mesa ${table?.number ?? '—'} quedará libre`}
          {items.length > 0 ? ' y se devolverá el inventario de los productos.' : '.'}
        </p>

        <div className="order-view__modal-actions">
          <button
            type="button"
            className="order-view__btn order-view__btn--ghost"
            onClick={() => setShowCancelConfirm(false)}
            disabled={isCancelling}
          >
            Volver
          </button>
          <button
            type="button"
            className="order-view__btn order-view__btn--danger"
            onClick={() => cancelMutation.mutate()}
            disabled={isCancelling}
          >
            {isCancelling ? (
              <Loader2 className="order-view__spin" size={16} />
            ) : (
              <XCircle size={16} />
            )}
            Sí, cancelar
          </button>
        </div>
      </Modal>

      <Modal
        open={Boolean(addForm)}
        onClose={() => setAddForm(null)}
        title={
          addForm ? (
            <>
              {addForm.product.name}
              <p>
                <MultiCurrencyPrice
                  amountCop={addForm.product.price + selectedAdicionalesTotal(adicionalProducts, addForm.adicionalIds)}
                  rates={rates}
                />
              </p>
            </>
          ) : undefined
        }
        panelClassName="order-view__modal"
        className="order-view__modal-backdrop"
      >
        {addForm && (
          <form className="order-view__modal-form" onSubmit={handleAddItem}>
            <label className="order-view__field">
              Cantidad
              <input
                type="number"
                min={1}
                max={99}
                value={addForm.quantity}
                onChange={(event) =>
                  setAddForm((prev) => (prev ? { ...prev, quantity: event.target.value } : prev))
                }
                required
                autoFocus
              />
            </label>

            {getApplicableModifierGroups(addForm.product.category).map((group) => {
              const selectedOptions = selectedModifierOptions(addForm, group.id);
              const isSingle = group.mode === 'single';

              return (
                <fieldset key={group.id} className="order-view__field order-view__note-options">
                  <legend>{group.label}</legend>
                  <div
                    className="order-view__note-options-grid"
                    role={isSingle ? 'radiogroup' : 'group'}
                    aria-label={group.label}
                  >
                    {group.options.map((option) => {
                      const selected = selectedOptions.includes(option);
                      return (
                        <button
                          key={option}
                          type="button"
                          role={isSingle ? 'radio' : undefined}
                          className={`order-view__note-option${selected ? ' order-view__note-option--selected' : ''}`}
                          aria-checked={isSingle ? selected : undefined}
                          aria-pressed={isSingle ? undefined : selected}
                          onClick={() =>
                            setAddForm((prev) => {
                              if (!prev) return prev;
                              const current = prev.selections[group.id] ?? [];
                              const next = isSingle
                                ? [option]
                                : toggleMultipleModifierOption(current, option, group.defaultOption);
                              return {
                                ...prev,
                                selections: { ...prev.selections, [group.id]: next },
                              };
                            })
                          }
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              );
            })}

            {productUsesAdicionales(addForm.product.category) && adicionalProducts.length > 0 && (
              <fieldset className="order-view__field order-view__note-options">
                <legend>Adicionales</legend>
                <div className="order-view__note-options-grid" role="group" aria-label="Adicionales del producto">
                  {adicionalProducts.map((extra) => {
                    const selected = addForm.adicionalIds.includes(extra.id);
                    return (
                      <button
                        key={extra.id}
                        type="button"
                        className={`order-view__note-option${selected ? ' order-view__note-option--selected' : ''}`}
                        aria-pressed={selected}
                        onClick={() =>
                          setAddForm((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  adicionalIds: prev.adicionalIds.includes(extra.id)
                                    ? prev.adicionalIds.filter((id) => id !== extra.id)
                                    : [...prev.adicionalIds, extra.id],
                                }
                              : prev,
                          )
                        }
                      >
                        {extra.name} · {formatPrice(extra.price)}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}

            <div className="order-view__modal-actions">
              <button
                type="button"
                className="order-view__btn order-view__btn--ghost"
                onClick={() => setAddForm(null)}
              >
                Cancelar
              </button>
              <button type="submit" className="order-view__btn" disabled={isAddingItem}>
                {isAddingItem ? (
                  <Loader2 className="order-view__spin" size={16} />
                ) : (
                  <Plus size={16} />
                )}
                Agregar
              </button>
            </div>
          </form>
        )}
      </Modal>

      {kitchenTicketOpen && (
        <KitchenTicketModal
          order={order}
          items={items}
          tableNumber={table?.number ?? null}
          sentAt={kitchenTicketSentAt ?? order.updated_at}
          onClose={() => setKitchenTicketOpen(false)}
        />
      )}

      {saleTicketOpen && (
        <SaleTicketModal
          order={order}
          items={items}
          tableNumber={table?.number ?? null}
          payments={payments}
          paymentPreview={order.cash_register_id ? undefined : 'Por cobrar'}
          title={order.cash_register_id ? 'Ticket de venta' : 'Ticket del pedido'}
          onClose={() => setSaleTicketOpen(false)}
        />
      )}
    </div>
  );
}

export default withAppProviders(OrderView);
