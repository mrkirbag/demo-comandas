import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestUser, setupTestDatabase, teardownTestDatabase } from '@/test/db';
import { createId } from '@/lib/utils/id';

describe('pedidos para llevar', () => {
  let userId = '';
  let productId = '';

  beforeAll(async () => {
    await setupTestDatabase();

    const { getDb } = await import('@/lib/db/client');
    const db = getDb();

    userId = await createTestUser(db, 'admin-takeaway', 'pass123', 'admin');

    productId = createId();
    await db.execute({
      sql: `
        INSERT INTO products (id, name, price, category, active)
        VALUES (?, 'Perro Caliente Especial', 18000, 'perros', 1)
      `,
      args: [productId],
    });
  });

  afterAll(async () => {
    const { resetDbClient } = await import('@/lib/db/client');
    resetDbClient();
    teardownTestDatabase();
  });

  it('crea exitosamente un pedido para llevar en createDeliveryOrder', async () => {
    const { createDeliveryOrder, getOrderById } = await import('@/lib/db/orders');

    const order = await createDeliveryOrder(userId, {
      order_type: 'para_llevar',
      customer_name: 'Carlos Pérez',
      customer_phone: '3001234567',
    });

    expect(order.order_type).toBe('para_llevar');
    expect(order.customer_name).toBe('Carlos Pérez');
    expect(order.customer_phone).toBe('3001234567');
    expect(order.delivery_address).toBeNull();

    const fetched = await getOrderById(order.id);
    expect(fetched?.order_type).toBe('para_llevar');
  });

  it('crea exitosamente un pedido público para llevar con ítems', async () => {
    const { createPublicOrderWithItems, getOrderById } = await import('@/lib/db/orders');

    const { order, itemCount } = await createPublicOrderWithItems(userId, {
      order_type: 'para_llevar',
      customer_name: 'María Gómez',
      customer_phone: '3109876543',
      items: [
        {
          productId,
          quantity: 2,
        },
      ],
    });

    expect(order.order_type).toBe('para_llevar');
    expect(order.customer_name).toBe('María Gómez');
    expect(itemCount).toBe(1);
    expect(order.total).toBe(36000);

    const fetched = await getOrderById(order.id);
    expect(fetched?.order_type).toBe('para_llevar');
    expect(fetched?.total).toBe(36000);
  });
});
