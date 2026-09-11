import type { APIRoute } from 'astro';

import { createPublicOrderWithItems } from '@/lib/db/orders';
import { ensurePublicUser, PUBLIC_USER_ID } from '@/lib/db/init-public-user';
import { validateDeliveryInput } from '@/lib/orders/display';

export const POST: APIRoute = async (context) => {
  let body: {
    order_type?: string;
    customer_name?: string;
    customer_phone?: string;
    delivery_address?: string;
    delivery_notes?: string;
    payment_method_hint?: string;
    items?: Array<{
      product_id?: string;
      quantity?: number;
      notes?: string;
      adicional_ids?: string[];
    }>;
  };

  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const rawOrderType = body.order_type?.trim();
  if (rawOrderType !== 'delivery' && rawOrderType !== 'para_llevar') {
    return Response.json(
      { error: 'Tipo de pedido inválido. Debe ser "delivery" o "para_llevar".' },
      { status: 400 },
    );
  }

  const orderType: 'delivery' | 'para_llevar' = rawOrderType;

  // Validate customer data
  const validationError = validateDeliveryInput({
    order_type: orderType,
    customer_name: body.customer_name ?? '',
    customer_phone: body.customer_phone ?? '',
    delivery_address: body.delivery_address ?? '',
    delivery_notes: body.delivery_notes,
  });

  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 });
  }

  // Validate items
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return Response.json(
      { error: 'El pedido debe contener al menos un producto.' },
      { status: 400 },
    );
  }

  // Build item inputs
  const items = body.items.map((raw) => ({
    productId: raw.product_id?.trim() ?? '',
    quantity: Number(raw.quantity ?? 1),
    notes: raw.notes,
    adicionalIds: Array.isArray(raw.adicional_ids)
      ? raw.adicional_ids.filter((id): id is string => typeof id === 'string')
      : [],
  })).filter((item) => item.productId.length > 0);

  if (items.length === 0) {
    return Response.json(
      { error: 'No se encontraron productos válidos en el pedido.' },
      { status: 400 },
    );
  }

  try {
    // Ensure the system user exists
    await ensurePublicUser();

    const { order, itemCount } = await createPublicOrderWithItems(PUBLIC_USER_ID, {
      order_type: orderType,
      customer_name: body.customer_name!.trim(),
      customer_phone: body.customer_phone!.trim(),
      delivery_address: orderType === 'delivery' ? body.delivery_address?.trim() : null,
      delivery_notes: body.delivery_notes?.trim(),
      items,
    });

    return Response.json(
      {
        order: {
          id: order.id,
          total: order.total,
          item_count: itemCount,
          status: order.status,
        },
        message: 'Pedido creado exitosamente',
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo crear el pedido';
    return Response.json({ error: message }, { status: 400 });
  }
};
