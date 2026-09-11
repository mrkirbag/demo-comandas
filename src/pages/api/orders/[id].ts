import type { APIRoute } from 'astro';

import { requireRoles } from '@/lib/auth/require-roles';
import {
  cancelOrder,
  getOrderDetail,
  getOrderById,
  markOrderDelivered,
  markOrderReady,
  sendOrderToKitchen,
  updateOrderDeliveryFee,
} from '@/lib/db/orders';
import { getTableById } from '@/lib/db/tables';
import type { OrderStatus, UserRole } from '@/lib/db/types';
import { isValidStatusTransition } from '@/lib/orders/delivery-flow';

const READ_ROLES: UserRole[] = ['admin', 'cajero', 'mesero', 'cocina'];
const MANAGE_ROLES: UserRole[] = ['admin', 'cajero', 'mesero'];

const TRANSITION_ROLES: Record<string, UserRole[]> = {
  'pagado:cocina': ['admin', 'cajero', 'mesero'],
  'pendiente:cancelado': ['admin', 'cajero', 'mesero'],
  'cocina:listo': ['admin', 'cocina', 'cajero', 'mesero'],
  'cocina:entregado': ['admin', 'cocina', 'cajero', 'mesero'],
  'listo:entregado': ['admin', 'cajero', 'mesero'],
};

export const GET: APIRoute = async (context) => {
  const auth = requireRoles(context, READ_ROLES);
  if (auth instanceof Response) return auth;

  const { id } = context.params;
  if (!id) {
    return Response.json({ error: 'ID requerido' }, { status: 400 });
  }

  const detail = await getOrderDetail(id);
  if (!detail) {
    return Response.json({ error: 'Comanda no encontrada' }, { status: 404 });
  }

  const table = detail.order.table_id ? await getTableById(detail.order.table_id) : null;

  return Response.json({
    order: detail.order,
    items: detail.items,
    payments: detail.payments,
    table: table
      ? { id: table.id, number: table.number, capacity: table.capacity, status: table.status }
      : null,
  });
};

export const PATCH: APIRoute = async (context) => {
  const session = requireRoles(context, READ_ROLES);
  if (session instanceof Response) return session;

  const { id } = context.params;
  if (!id) {
    return Response.json({ error: 'ID requerido' }, { status: 400 });
  }

  const order = await getOrderById(id);
  if (!order) {
    return Response.json({ error: 'Comanda no encontrada' }, { status: 404 });
  }

  let body: {
    status?: string;
    delivery_fee?: number | string;
  };

  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const nextStatus = body.status as OrderStatus | undefined;
  const hasDeliveryFee = body.delivery_fee !== undefined;

  if (!nextStatus && !hasDeliveryFee) {
    return Response.json({ error: 'Se requiere status o delivery_fee' }, { status: 400 });
  }

  try {
    let updated = order;

    // Actualizar costo de delivery si viene en la petición
    if (hasDeliveryFee) {
      if (!MANAGE_ROLES.includes(session.role)) {
        return Response.json({ error: 'No tienes permiso para modificar el costo de delivery' }, { status: 403 });
      }
      const fee = Number(body.delivery_fee) || 0;
      updated = await updateOrderDeliveryFee(id, fee);
    }

    // Actualizar estado si viene en la petición
    if (nextStatus) {
      if (!isValidStatusTransition(updated, nextStatus)) {
        return Response.json({ error: 'Transición de estado no permitida' }, { status: 400 });
      }

      const transitionKey = `${updated.status}:${nextStatus}`;
      const allowedRoles = TRANSITION_ROLES[transitionKey] ?? [];
      if (!allowedRoles.includes(session.role)) {
        return Response.json({ error: 'No tienes permiso para este cambio de estado' }, { status: 403 });
      }

      if (nextStatus === 'cocina') {
        updated = await sendOrderToKitchen(id);
      } else if (nextStatus === 'listo' || (nextStatus === 'entregado' && updated.status === 'cocina')) {
        updated = await markOrderReady(id);
      } else if (nextStatus === 'entregado') {
        updated = await markOrderDelivered(id);
      } else if (nextStatus === 'cancelado') {
        updated = await cancelOrder(id, session.userId);
      }
    }

    const detail = await getOrderDetail(id);

    return Response.json({
      order: updated,
      items: detail?.items ?? [],
      payments: detail?.payments ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo actualizar la comanda';
    return Response.json({ error: message }, { status: 400 });
  }
};

