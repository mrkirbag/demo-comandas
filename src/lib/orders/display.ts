import type { Order, OrderType } from '@/lib/db/types';

export function formatOrderLabel(
  order: Pick<Order, 'order_type' | 'customer_name'> & {
    table_number?: string | null;
  },
): string {
  if (order.order_type === 'para_llevar') {
    const name = order.customer_name?.trim();
    return name ? `${name} (Para Llevar)` : 'Para Llevar';
  }

  if (order.order_type === 'delivery') {
    const name = order.customer_name?.trim();
    return name ? `${name} (Domicilio)` : 'Domicilio';
  }

  return `Mesa ${order.table_number ?? '—'}`;
}

export function formatOrderShortLabel(
  order: Pick<Order, 'order_type' | 'customer_name'> & {
    table_number?: string | null;
  },
): string {
  if (order.order_type === 'para_llevar') {
    return 'Para Llevar';
  }

  if (order.order_type === 'delivery') {
    return 'Domicilio';
  }

  return `Mesa ${order.table_number ?? '—'}`;
}

export function isDeliveryOrder(order: Pick<Order, 'order_type'>): boolean {
  return order.order_type === 'delivery' || order.order_type === 'para_llevar';
}

export type CreateDeliveryOrderInput = {
  order_type?: 'delivery' | 'para_llevar';
  customer_name: string;
  customer_phone: string;
  delivery_address?: string | null;
  delivery_notes?: string | null;
  delivery_fee?: number;
};

export function validateDeliveryInput(input: CreateDeliveryOrderInput): string | null {
  const name = input.customer_name?.trim();
  const phone = input.customer_phone?.trim();
  const address = input.delivery_address?.trim();
  const isDelivery = input.order_type === 'delivery' || (!input.order_type && Boolean(address));

  if (!name || name.length < 2) {
    return 'El nombre del cliente es requerido';
  }

  if (!phone || phone.length < 7) {
    return 'El teléfono del cliente es requerido';
  }

  if (isDelivery && (!address || address.length < 5)) {
    return 'La dirección de entrega es requerida para domicilios';
  }

  return null;
}

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  mesa: 'Mesa',
  delivery: 'Delivery',
  para_llevar: 'Para Llevar',
};
