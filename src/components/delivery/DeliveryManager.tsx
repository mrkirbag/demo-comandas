import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bike,
  CheckCircle2,
  ClipboardList,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Printer,
  Store,
  User,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import MultiCurrencyPrice from '@/components/ui/MultiCurrencyPrice';
import { Alert, EmptyState, SkeletonGrid } from '@/components/ui/Feedback';
import Modal from '@/components/ui/Modal';
import SaleTicketModal from '@/components/tickets/SaleTicketModal';
import { parseError } from '@/lib/api/parseError';
import type { OrderListItem } from '@/lib/db/orders';
import type { OrderStatus } from '@/lib/db/types';
import { isDeliveryReadyForDispatch, openDeliveryReadyWhatsApp } from '@/lib/delivery/whatsapp';
import { useDeliveryOrders } from '@/lib/hooks/queries/useDeliveryOrders';
import { useOrderDetail } from '@/lib/hooks/queries/useOrderDetail';
import { useExchangeRates } from '@/lib/hooks/queries/useExchangeRates';
import { formatOrderLabel } from '@/lib/orders/display';
import {
  canMarkOrderDelivered,
  canPayOrder,
  DELIVERY_PAYMENT_TIMING_DESCRIPTIONS,
  DELIVERY_PAYMENT_TIMING_LABELS,
  getDeliveryPaymentTiming,
  type DeliveryPaymentTiming,
} from '@/lib/orders/delivery-flow';
import { DELIVERY_FILTER_OPTIONS, STATUS_LABELS } from '@/lib/orders/labels';
import { panelNavigate } from '@/lib/navigation/panelNavigate';
import { withAppProviders } from '@/lib/providers/withAppProviders';
import { formatShortDateTime } from '@/lib/utils/datetime';
import { formatCop } from '@/lib/utils/currency';

import '@/components/delivery/DeliveryManager.css';


type StatusFilter = OrderStatus | 'all';

type DeliveryForm = {
  order_type: 'delivery' | 'para_llevar';
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  delivery_notes: string;
  delivery_fee: string;
  delivery_payment_timing: DeliveryPaymentTiming;
};

type DeliveryManagerProps = {
  variant?: 'full' | 'dashboard';
};

const EMPTY_FORM: DeliveryForm = {
  order_type: 'delivery',
  customer_name: '',
  customer_phone: '',
  delivery_address: '',
  delivery_notes: '',
  delivery_fee: '',
  delivery_payment_timing: 'on_delivery',
};

const STATUS_PRIORITY: Record<OrderStatus, number> = {
  listo: 0,
  pagado: 1,
  cocina: 2,
  pendiente: 3,
  entregado: 4,
  cancelado: 5,
};

function DeliveryTicketModalWrapper({
  orderId,
  onClose,
}: {
  orderId: string;
  onClose: () => void;
}) {
  const { data, isLoading, error } = useOrderDetail(orderId);

  if (isLoading) {
    return (
      <Modal open onClose={onClose} title="Cargando ticket…" className="delivery-manager__overlay">
        <div style={{ padding: '2.5rem', textAlign: 'center' }}>
          <Loader2 className="delivery-manager__spin" size={28} />
          <p style={{ marginTop: '0.75rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            Cargando datos para el ticket…
          </p>
        </div>
      </Modal>
    );
  }

  if (error || !data) {
    return (
      <Modal open onClose={onClose} title="Error" className="delivery-manager__overlay">
        <div style={{ padding: '1.5rem' }}>
          <Alert>No se pudo cargar la comanda.</Alert>
          <button
            type="button"
            className="delivery-manager__btn delivery-manager__btn--ghost"
            style={{ marginTop: '1rem', width: '100%' }}
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <SaleTicketModal
      order={data.order}
      items={data.items}
      tableNumber={data.table?.number}
      payments={data.payments}
      paymentPreview={data.order.cash_register_id ? undefined : 'Por cobrar'}
      title={data.order.cash_register_id ? 'Ticket de venta' : 'Ticket del pedido'}
      onClose={onClose}
    />
  );
}

function DeliveryManager({ variant = 'full' }: DeliveryManagerProps) {
  const queryClient = useQueryClient();
  const { rates } = useExchangeRates();
  const { orders, isPending, error } = useDeliveryOrders();
  const [actingId, setActingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<DeliveryForm>(EMPTY_FORM);

  const [feeModalOrder, setFeeModalOrder] = useState<OrderListItem | null>(null);
  const [feeInput, setFeeInput] = useState('');
  const [ticketOrderId, setTicketOrderId] = useState<string | null>(null);

  const kitchenCount = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.status === 'cocina' || order.status === 'listo' || order.status === 'pagado',
      ).length,
    [orders],
  );

  const filteredOrders = useMemo(() => {
    const list =
      statusFilter === 'all'
        ? orders
        : statusFilter === 'cocina'
        ? orders.filter(
            (order) =>
              order.status === 'cocina' || order.status === 'listo' || order.status === 'pagado',
          )
        : orders.filter((order) => order.status === statusFilter);

    return [...list].sort((a, b) => {
      const byStatus = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
      if (byStatus !== 0) return byStatus;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [orders, statusFilter]);

  const updateFeeMutation = useMutation({
    mutationFn: async ({ orderId, fee }: { orderId: string; fee: number }) => {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delivery_fee: fee }),
      });
      if (!response.ok) throw new Error(await parseError(response));
      return response.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      setFeeModalOrder(null);
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : 'No se pudo actualizar el costo de delivery');
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: DeliveryForm) => {
      const feeNumber =
        payload.order_type === 'delivery' && payload.delivery_fee.trim()
          ? Number(payload.delivery_fee)
          : 0;

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_type: payload.order_type,
          customer_name: payload.customer_name,
          customer_phone: payload.customer_phone,
          delivery_address: payload.order_type === 'delivery' ? payload.delivery_address : undefined,
          delivery_notes: payload.delivery_notes,
          delivery_fee: feeNumber,
          delivery_payment_timing: payload.delivery_payment_timing,
        }),
      });
      if (!response.ok) throw new Error(await parseError(response));
      return response.json() as Promise<{ order: { id: string } }>;
    },
    onSuccess: (data) => {
      void panelNavigate(`/panel/comandas/${data.order.id}`);
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : 'No se pudo crear el pedido');
    },
  });

  const markDeliveredMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'entregado' }),
      });
      if (!response.ok) throw new Error(await parseError(response));
      return orderId;
    },
    onMutate: (orderId) => {
      setActingId(orderId);
      setActionError('');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : 'No se pudo marcar como entregado');
    },
    onSettled: () => setActingId(null),
  });

  function notifyCustomer(order: OrderListItem, event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!openDeliveryReadyWhatsApp(order)) {
      setActionError('No se pudo abrir WhatsApp. Verifica el teléfono del cliente.');
    }
  }

  const displayError =
    actionError ||
    (error instanceof Error ? error.message : error ? 'No se pudieron cargar los pedidos' : '');

  return (
    <div className="delivery-manager">
      <div className="delivery-manager__toolbar">
        <div className="delivery-manager__filters" aria-label="Filtrar por estado">
          {DELIVERY_FILTER_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`delivery-manager__filter ${statusFilter === option.id ? 'delivery-manager__filter--active' : ''}`}
              onClick={() => setStatusFilter(option.id)}
            >
              {option.label}
              {option.id === 'cocina' && kitchenCount > 0 && (
                <span className="delivery-manager__filter-badge">{kitchenCount}</span>
              )}
            </button>
          ))}
        </div>

        <div className="delivery-manager__actions">
          <div className="delivery-manager__summary">
            <span className="delivery-manager__summary-value">{filteredOrders.length}</span>
            <span className="delivery-manager__summary-label">pedidos</span>
          </div>

          <button
            type="button"
            className="delivery-manager__btn delivery-manager__btn--primary"
            onClick={() => {
              setForm(EMPTY_FORM);
              setShowForm(true);
            }}
          >
            <Plus size={16} />
            Nuevo pedido
          </button>

          {variant === 'dashboard' && (
            <a href="/panel/domicilios" className="delivery-manager__btn delivery-manager__btn--ghost">
              Ver todos
            </a>
          )}
        </div>
      </div>

      {displayError && <Alert>{displayError}</Alert>}

      {isPending ? (
        <SkeletonGrid count={6} />
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          icon={<Bike size={28} />}
          title={
            statusFilter === 'all'
              ? 'No hay domicilios hoy. Crea uno para empezar a tomar el pedido.'
              : statusFilter === 'entregado'
              ? 'No hay domicilios completados hoy.'
              : statusFilter === 'cocina'
              ? 'No hay domicilios en cocina.'
              : statusFilter === 'pendiente'
              ? 'No hay domicilios pendientes.'
              : `No hay pedidos en estado "${STATUS_LABELS[statusFilter as OrderStatus] ?? statusFilter}".`
          }
          actions={
            <button
              type="button"
              className="delivery-manager__btn delivery-manager__btn--primary"
              onClick={() => setShowForm(true)}
            >
              <Plus size={16} />
              Nuevo pedido
            </button>
          }
        />
      ) : (
        <div className="delivery-manager__grid">
          {filteredOrders.map((order) => {
            const isUnpaid =
              order.status !== 'pagado' &&
              order.status !== 'entregado' &&
              order.status !== 'cancelado';

            return (
              <a
                key={order.id}
                href={`/panel/comandas/${order.id}`}
                className={`delivery-manager__card ${order.status === 'cocina' ? 'delivery-manager__card--ready' : ''}`}
              >
                <div className="delivery-manager__card-header">
                  <div>
                    <h2 className="delivery-manager__card-title">{formatOrderLabel(order)}</h2>
                    {order.order_type === 'para_llevar' ? (
                      <span className="delivery-manager__type-badge delivery-manager__type-badge--takeaway">
                        <Store size={12} /> Para Llevar
                      </span>
                    ) : (
                      <span className="delivery-manager__type-badge delivery-manager__type-badge--delivery">
                        <Bike size={12} /> Delivery
                      </span>
                    )}
                  </div>

                  <span className={`delivery-manager__status delivery-manager__status--${order.status}`}>
                    {STATUS_LABELS[order.status]}
                  </span>
                </div>

                <div className="delivery-manager__card-meta">
                  {order.customer_phone && (
                    <span>
                      <Phone size={14} />
                      {order.customer_phone}
                    </span>
                  )}
                  {order.order_type === 'delivery' && order.delivery_address && (
                    <span>
                      <MapPin size={14} />
                      {order.delivery_address}
                    </span>
                  )}
                  <span>
                    <User size={14} />
                    {order.username}
                  </span>
                  <span>
                    <ClipboardList size={14} />
                    {order.item_count} producto{order.item_count === 1 ? '' : 's'}
                  </span>

                  {order.order_type === 'delivery' && (
                    <div className="delivery-manager__card-fee-row">
                      {order.delivery_fee > 0 ? (
                        <span className="delivery-manager__card-fee">
                          Domicilio: {formatCop(order.delivery_fee)}
                        </span>
                      ) : (
                        <span className="delivery-manager__card-fee delivery-manager__card-fee--missing">
                          Domicilio: Sin costo asignado
                        </span>
                      )}
                      {isUnpaid && (
                        <button
                          type="button"
                          className="delivery-manager__fee-tag-btn"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setFeeModalOrder(order);
                            setFeeInput(order.delivery_fee > 0 ? String(order.delivery_fee) : '');
                          }}
                          title="Establecer costo de delivery"
                        >
                          {order.delivery_fee > 0 ? 'Editar' : '+ Asignar'}
                        </button>
                      )}
                    </div>
                  )}

                  <span>Actualizado {formatShortDateTime(order.updated_at)}</span>
                </div>

                <div className="delivery-manager__card-footer">
                  <MultiCurrencyPrice
                    amountCop={order.total}
                    rates={rates}
                    align="right"
                    className="delivery-manager__card-total"
                  />
                  <div className="delivery-manager__card-actions">
                    {/* Botón directo para ingresar monto de delivery si no está definido */}
                    {order.order_type === 'delivery' && order.delivery_fee === 0 && isUnpaid && (
                      <button
                        type="button"
                        className="delivery-manager__btn-assign-fee"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setFeeModalOrder(order);
                          setFeeInput('');
                        }}
                      >
                        <Bike size={14} />
                        Asignar delivery
                      </button>
                    )}

                    {/* Botón para ver e imprimir ticket */}
                    <button
                      type="button"
                      className="delivery-manager__ticket-btn"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setTicketOrderId(order.id);
                      }}
                      title="Ver e imprimir ticket de venta"
                    >
                      <Printer size={14} />
                      Ticket
                    </button>

                    {isDeliveryReadyForDispatch(order) && (
                      <button
                        type="button"
                        className="delivery-manager__whatsapp-btn"
                        onClick={(event) => notifyCustomer(order, event)}
                      >
                        <MessageCircle size={14} />
                        Avisar por WhatsApp
                      </button>
                    )}
                    {canMarkOrderDelivered(order) ? (
                      <button
                        type="button"
                        className="delivery-manager__deliver-btn"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          markDeliveredMutation.mutate(order.id);
                        }}
                        disabled={actingId === order.id}
                      >
                        {actingId === order.id ? (
                          <Loader2 className="delivery-manager__spin" size={14} />
                        ) : (
                          <CheckCircle2 size={14} />
                        )}
                        Entregar
                      </button>
                    ) : canPayOrder(order) ? (
                      <span className="delivery-manager__card-action delivery-manager__card-action--pay">
                        Cobrar en caja →
                      </span>
                    ) : (
                      <span className="delivery-manager__card-action">Ver pedido →</span>
                    )}
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}


      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Nuevo pedido"
        panelClassName="delivery-manager__modal"
        className="delivery-manager__overlay"
      >
        <form
          className="delivery-manager__form"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(form);
          }}
        >
          <div className="delivery-manager__form-body">
            <div className="delivery-manager__field">
              <label className="delivery-manager__label">Tipo de servicio</label>
              <div className="delivery-manager__type-grid">
                <button
                  type="button"
                  className={`delivery-manager__type-btn ${
                    form.order_type === 'delivery' ? 'delivery-manager__type-btn--active' : ''
                  }`}
                  onClick={() => setForm((prev) => ({ ...prev, order_type: 'delivery' }))}
                >
                  <Bike size={16} />
                  <span>Delivery</span>
                </button>
                <button
                  type="button"
                  className={`delivery-manager__type-btn ${
                    form.order_type === 'para_llevar' ? 'delivery-manager__type-btn--active' : ''
                  }`}
                  onClick={() => setForm((prev) => ({ ...prev, order_type: 'para_llevar' }))}
                >
                  <Store size={16} />
                  <span>Para Llevar</span>
                </button>
              </div>
            </div>

            <label className="delivery-manager__label">
              Nombre del cliente
              <input
                type="text"
                value={form.customer_name}
                onChange={(e) => setForm((prev) => ({ ...prev, customer_name: e.target.value }))}
                className="delivery-manager__input"
                required
                autoFocus
              />
            </label>

            <label className="delivery-manager__label">
              Teléfono
              <input
                type="tel"
                value={form.customer_phone}
                onChange={(e) => setForm((prev) => ({ ...prev, customer_phone: e.target.value }))}
                className="delivery-manager__input"
                required
              />
            </label>

            {form.order_type === 'delivery' && (
              <>
                <label className="delivery-manager__label">
                  Dirección de entrega
                  <textarea
                    value={form.delivery_address}
                    onChange={(e) => setForm((prev) => ({ ...prev, delivery_address: e.target.value }))}
                    className="delivery-manager__textarea"
                    rows={3}
                    required
                  />
                </label>

                <label className="delivery-manager__label">
                  Monto del delivery (COP)
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Ej. 5000"
                    value={form.delivery_fee}
                    onChange={(e) => setForm((prev) => ({ ...prev, delivery_fee: e.target.value }))}
                    className="delivery-manager__input"
                  />
                </label>
              </>
            )}

            <label className="delivery-manager__label">
              Notas (opcional)
              <textarea
                value={form.delivery_notes}
                onChange={(e) => setForm((prev) => ({ ...prev, delivery_notes: e.target.value }))}
                className="delivery-manager__textarea"
                rows={2}
                placeholder="Torre, apartamento, referencias…"
              />
            </label>

            <fieldset className="delivery-manager__timing-fieldset">
              <legend className="delivery-manager__label">Forma de pago</legend>
              {(['on_delivery', 'prepaid'] as const).map((timing) => (
                <label key={timing} className="delivery-manager__timing-option">
                  <input
                    type="radio"
                    name="delivery_payment_timing"
                    value={timing}
                    checked={form.delivery_payment_timing === timing}
                    onChange={() =>
                      setForm((prev) => ({ ...prev, delivery_payment_timing: timing }))
                    }
                  />
                  <span>
                    <strong>{DELIVERY_PAYMENT_TIMING_LABELS[timing]}</strong>
                    <br />
                    <small>{DELIVERY_PAYMENT_TIMING_DESCRIPTIONS[timing]}</small>
                  </span>
                </label>
              ))}
            </fieldset>
          </div>

          <footer className="delivery-manager__modal-footer">
            <button
              type="button"
              className="delivery-manager__btn delivery-manager__btn--ghost"
              onClick={() => setShowForm(false)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="delivery-manager__btn delivery-manager__btn--primary"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <Loader2 className="delivery-manager__spin" size={16} />
              ) : (
                <Plus size={16} />
              )}
              Crear y tomar pedido
            </button>
          </footer>
        </form>
      </Modal>

      {/* Modal para asignar/modificar costo de delivery */}
      <Modal
        open={Boolean(feeModalOrder)}
        onClose={() => setFeeModalOrder(null)}
        title="Asignar costo de delivery"
        panelClassName="delivery-manager__modal"
        className="delivery-manager__overlay"
      >
        {feeModalOrder && (
          <form
            className="delivery-manager__form"
            onSubmit={(e) => {
              e.preventDefault();
              const num = Math.max(0, Number(feeInput) || 0);
              updateFeeMutation.mutate({ orderId: feeModalOrder.id, fee: num });
            }}
          >
            <div className="delivery-manager__form-body">
              <div className="delivery-manager__fee-info-box">
                <div className="delivery-manager__fee-info-item">
                  <span className="delivery-manager__fee-info-label">Cliente:</span>
                  <strong className="delivery-manager__fee-info-val">{feeModalOrder.customer_name || '—'}</strong>
                </div>
                {feeModalOrder.customer_phone && (
                  <div className="delivery-manager__fee-info-item">
                    <span className="delivery-manager__fee-info-label">Teléfono:</span>
                    <span className="delivery-manager__fee-info-val">{feeModalOrder.customer_phone}</span>
                  </div>
                )}
                {feeModalOrder.delivery_address && (
                  <div className="delivery-manager__fee-info-item">
                    <span className="delivery-manager__fee-info-label">Dirección:</span>
                    <span className="delivery-manager__fee-info-val">{feeModalOrder.delivery_address}</span>
                  </div>
                )}
                <div className="delivery-manager__fee-info-item">
                  <span className="delivery-manager__fee-info-label">Subtotal productos:</span>
                  <span className="delivery-manager__fee-info-val">
                    {formatCop(Math.max(0, feeModalOrder.total - (feeModalOrder.delivery_fee || 0)))}
                  </span>
                </div>
              </div>

              <label className="delivery-manager__label">
                Monto del domicilio (COP)
                <input
                  type="number"
                  min="0"
                  step="500"
                  placeholder="Ej. 5000"
                  value={feeInput}
                  onChange={(e) => setFeeInput(e.target.value)}
                  className="delivery-manager__input"
                  autoFocus
                  required
                />
              </label>

              <div className="delivery-manager__quick-chips">
                {[3000, 4000, 5000, 6000, 8000, 10000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    className={`delivery-manager__quick-chip ${feeInput === String(amt) ? 'delivery-manager__quick-chip--active' : ''}`}
                    onClick={() => setFeeInput(String(amt))}
                  >
                    +{formatCop(amt)}
                  </button>
                ))}
              </div>

              <div className="delivery-manager__fee-preview-box">
                <span>Total final con delivery:</span>
                <strong>
                  {formatCop(
                    Math.max(0, feeModalOrder.total - (feeModalOrder.delivery_fee || 0)) + (Number(feeInput) || 0)
                  )}
                </strong>
              </div>
            </div>

            <footer className="delivery-manager__modal-footer">
              <button
                type="button"
                className="delivery-manager__btn delivery-manager__btn--ghost"
                onClick={() => setFeeModalOrder(null)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="delivery-manager__btn delivery-manager__btn--primary"
                disabled={updateFeeMutation.isPending}
              >
                {updateFeeMutation.isPending ? (
                  <Loader2 className="delivery-manager__spin" size={16} />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                Guardar monto
              </button>
            </footer>
          </form>
        )}
      </Modal>

      {/* Modal para ver e imprimir ticket */}
      {ticketOrderId && (
        <DeliveryTicketModalWrapper
          orderId={ticketOrderId}
          onClose={() => setTicketOrderId(null)}
        />
      )}
    </div>

  );
}

export default withAppProviders(DeliveryManager);
