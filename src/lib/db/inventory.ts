import {
  isValidInventoryCategory,
  isValidInventoryUnit,
} from '@/data/product-categories';
import { createId } from '@/lib/utils/id';

import { db } from './client';
import { ensureMigrations } from './init';
import type { SqlArgs } from './sql';
import type { InventoryMovement, InventoryMovementType } from './types';

export type InventoryItem = {
  id: string;
  name: string;
  category: string;
  stock: number;
  min_stock: number;
  unit: string;
  low_stock: boolean;
};

export type InventoryMovementRecord = InventoryMovement & {
  username: string;
  order_type?: string | null;
  customer_name?: string | null;
  table_number?: string | null;
};

function mapInventoryItem(row: Record<string, unknown>): InventoryItem {
  const stock = Number(row.stock);
  const minStock = Number(row.min_stock);

  return {
    id: String(row.id),
    name: String(row.name),
    category: String(row.category),
    stock,
    min_stock: minStock,
    unit: String(row.unit),
    low_stock: stock <= minStock,
  };
}

function mapMovement(row: Record<string, unknown>): InventoryMovementRecord {
  return {
    id: String(row.id),
    product_id: String(row.product_id),
    type: row.type as InventoryMovementType,
    quantity: Number(row.quantity),
    reason: row.reason ? String(row.reason) : null,
    user_id: String(row.user_id),
    order_id: row.order_id ? String(row.order_id) : null,
    created_at: String(row.created_at),
    username: String(row.username),
    order_type: row.order_type ? String(row.order_type) : null,
    customer_name: row.customer_name ? String(row.customer_name) : null,
    table_number: row.table_number ? String(row.table_number) : null,
  };
}

export { isValidInventoryCategory, isValidInventoryUnit };

export async function listInventoryItems(category?: string): Promise<InventoryItem[]> {
  const sql = category
    ? `SELECT p.id, p.name, p.category, i.stock, i.min_stock, i.unit
       FROM products p
       INNER JOIN inventory i ON i.product_id = p.id
       WHERE p.requires_inventory = 1 AND p.category = ?
       ORDER BY p.category ASC, p.name ASC`
    : `SELECT p.id, p.name, p.category, i.stock, i.min_stock, i.unit
       FROM products p
       INNER JOIN inventory i ON i.product_id = p.id
       WHERE p.requires_inventory = 1
       ORDER BY p.category ASC, p.name ASC`;

  const result = await db.execute({
    sql,
    args: category ? [category] : [],
  });

  return result.rows.map((row) => mapInventoryItem(row as Record<string, unknown>));
}

export async function getInventoryItemById(id: string): Promise<InventoryItem | null> {
  const result = await db.execute({
    sql: `SELECT p.id, p.name, p.category, i.stock, i.min_stock, i.unit
          FROM products p
          INNER JOIN inventory i ON i.product_id = p.id
          WHERE p.id = ? AND p.requires_inventory = 1
          LIMIT 1`,
    args: [id],
  });

  if (result.rows.length === 0) return null;
  return mapInventoryItem(result.rows[0] as Record<string, unknown>);
}

export async function getInventoryItemByName(name: string): Promise<InventoryItem | null> {
  const result = await db.execute({
    sql: `SELECT p.id, p.name, p.category, i.stock, i.min_stock, i.unit
          FROM products p
          INNER JOIN inventory i ON i.product_id = p.id
          WHERE LOWER(p.name) = LOWER(?) AND p.requires_inventory = 1
          LIMIT 1`,
    args: [name],
  });

  if (result.rows.length === 0) return null;
  return mapInventoryItem(result.rows[0] as Record<string, unknown>);
}

type CreateInventoryItemInput = {
  name: string;
  category: string;
  unit: string;
  stock?: number;
  min_stock?: number;
  userId: string;
};

export async function createInventoryItem(
  input: CreateInventoryItemInput,
): Promise<InventoryItem> {
  const id = createId();
  const stock = input.stock ?? 0;
  const minStock = input.min_stock ?? 5;

  await db.execute({
    sql: `
      INSERT INTO products (id, name, price, category, requires_inventory, active)
      VALUES (?, ?, 0, ?, 1, 1)
    `,
    args: [id, input.name, input.category],
  });

  await db.execute({
    sql: `
      INSERT INTO inventory (product_id, stock, min_stock, unit)
      VALUES (?, ?, ?, ?)
    `,
    args: [id, stock, minStock, input.unit],
  });

  if (stock > 0) {
    await db.execute({
      sql: `
        INSERT INTO inventory_movements (id, product_id, type, quantity, reason, user_id)
        VALUES (?, ?, 'entrada', ?, 'Stock inicial', ?)
      `,
      args: [createId(), id, stock, input.userId],
    });
  }

  const item = await getInventoryItemById(id);
  if (!item) throw new Error('No se pudo crear el ítem de inventario');
  return item;
}

type UpdateInventoryItemInput = {
  name?: string;
  category?: string;
  unit?: string;
  min_stock?: number;
};

export async function updateInventoryItem(
  id: string,
  input: UpdateInventoryItemInput,
): Promise<InventoryItem | null> {
  if (input.name !== undefined || input.category !== undefined) {
    const productFields: string[] = [];
    const productArgs: SqlArgs = [];

    if (input.name !== undefined) {
      productFields.push('name = ?');
      productArgs.push(input.name);
    }

    if (input.category !== undefined) {
      productFields.push('category = ?');
      productArgs.push(input.category);
    }

    await db.execute({
      sql: `UPDATE products SET ${productFields.join(', ')} WHERE id = ? AND requires_inventory = 1`,
      args: [...productArgs, id],
    });
  }

  if (input.unit !== undefined || input.min_stock !== undefined) {
    const inventoryFields: string[] = [];
    const inventoryArgs: SqlArgs = [];

    if (input.unit !== undefined) {
      inventoryFields.push('unit = ?');
      inventoryArgs.push(input.unit);
    }

    if (input.min_stock !== undefined) {
      inventoryFields.push('min_stock = ?');
      inventoryArgs.push(input.min_stock);
    }

    await db.execute({
      sql: `UPDATE inventory SET ${inventoryFields.join(', ')} WHERE product_id = ?`,
      args: [...inventoryArgs, id],
    });
  }

  return getInventoryItemById(id);
}

export async function deleteInventoryItem(id: string): Promise<boolean> {
  await db.execute({
    sql: 'UPDATE products SET inventory_product_id = NULL WHERE inventory_product_id = ?',
    args: [id],
  });

  await db.execute({
    sql: 'DELETE FROM inventory_movements WHERE product_id = ?',
    args: [id],
  });

  await db.execute({
    sql: 'DELETE FROM inventory WHERE product_id = ?',
    args: [id],
  });

  const result = await db.execute({
    sql: 'DELETE FROM products WHERE id = ? AND requires_inventory = 1',
    args: [id],
  });

  return result.rowsAffected > 0;
}

type RegisterMovementInput = {
  productId: string;
  type: InventoryMovementType;
  quantity: number;
  reason?: string;
  userId: string;
};

export async function registerInventoryMovement(
  input: RegisterMovementInput,
): Promise<InventoryItem | null> {
  const item = await getInventoryItemById(input.productId);
  if (!item) return null;

  if (input.type === 'salida' && item.stock < input.quantity) {
    throw new Error('Stock insuficiente');
  }

  const newStock =
    input.type === 'entrada' ? item.stock + input.quantity : item.stock - input.quantity;

  await db.execute({
    sql: 'UPDATE inventory SET stock = ? WHERE product_id = ?',
    args: [newStock, input.productId],
  });

  await db.execute({
    sql: `
      INSERT INTO inventory_movements (id, product_id, type, quantity, reason, user_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    args: [
      createId(),
      input.productId,
      input.type,
      input.quantity,
      input.reason?.trim() || null,
      input.userId,
    ],
  });

  return getInventoryItemById(input.productId);
}

export type ListInventoryMovementsOptions = {
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
};

export async function listInventoryMovements(
  productId: string,
  optionsOrLimit: number | ListInventoryMovementsOptions = 50,
): Promise<InventoryMovementRecord[]> {
  await ensureMigrations();

  const options: ListInventoryMovementsOptions =
    typeof optionsOrLimit === 'number' ? { limit: optionsOrLimit } : optionsOrLimit;
  const limit = options.limit ?? 50;

  const conditions = ['m.product_id = ?'];
  const args: SqlArgs = [productId];

  if (options.dateFrom) {
    conditions.push('date(m.created_at) >= date(?)');
    args.push(options.dateFrom);
  }

  if (options.dateTo) {
    conditions.push('date(m.created_at) <= date(?)');
    args.push(options.dateTo);
  }

  args.push(limit);

  let result;
  try {
    result = await db.execute({
      sql: `
        SELECT m.id, m.product_id, m.type, m.quantity, m.reason, m.user_id, m.order_id, m.created_at,
               COALESCE(u.username, 'sistema') AS username,
               o.order_type,
               o.customer_name,
               t.number AS table_number
        FROM inventory_movements m
        LEFT JOIN users u ON u.id = m.user_id
        LEFT JOIN orders o ON (
          (m.order_id IS NOT NULL AND o.id = m.order_id)
          OR
          (m.order_id IS NULL AND (
            m.reason LIKE 'Comanda ' || substr(o.id, 1, 8) || '%'
            OR m.reason LIKE 'Devolución comanda ' || substr(o.id, 1, 8) || '%'
          ))
        )
        LEFT JOIN tables t ON t.id = o.table_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY m.created_at DESC
        LIMIT ?
      `,
      args,
    });
  } catch (error) {
    // If order_id column does not exist yet, fallback to query without m.order_id
    if (error instanceof Error && error.message.includes('no such column: m.order_id')) {
      result = await db.execute({
        sql: `
          SELECT m.id, m.product_id, m.type, m.quantity, m.reason, m.user_id, NULL as order_id, m.created_at,
                 COALESCE(u.username, 'sistema') AS username,
                 o.order_type,
                 o.customer_name,
                 t.number AS table_number
          FROM inventory_movements m
          LEFT JOIN users u ON u.id = m.user_id
          LEFT JOIN orders o ON (
            m.reason LIKE 'Comanda ' || substr(o.id, 1, 8) || '%'
            OR m.reason LIKE 'Devolución comanda ' || substr(o.id, 1, 8) || '%'
          )
          LEFT JOIN tables t ON t.id = o.table_id
          WHERE ${conditions.join(' AND ')}
          ORDER BY m.created_at DESC
          LIMIT ?
        `,
        args,
      });
    } else {
      throw error;
    }
  }

  return result.rows.map((row) => mapMovement(row as Record<string, unknown>));
}

export async function deductInventoryForOrder(
  productId: string,
  quantity: number,
  userId: string,
  orderId: string,
): Promise<void> {
  await ensureMigrations();

  const item = await getInventoryItemById(productId);
  if (!item) {
    throw new Error('Producto sin registro de inventario');
  }

  if (item.stock < quantity) {
    throw new Error(`Stock insuficiente de ${item.name}`);
  }

  await db.execute({
    sql: 'UPDATE inventory SET stock = stock - ? WHERE product_id = ?',
    args: [quantity, productId],
  });

  let reason = `Comanda ${orderId.slice(0, 8)}`;
  try {
    const orderRes = await db.execute({
      sql: `
        SELECT o.order_type, o.customer_name, t.number AS table_number
        FROM orders o
        LEFT JOIN tables t ON t.id = o.table_id
        WHERE o.id = ?
        LIMIT 1
      `,
      args: [orderId],
    });
    const orderRow = orderRes.rows[0];
    if (orderRow) {
      if (orderRow.order_type === 'delivery') {
        const client = orderRow.customer_name ? String(orderRow.customer_name).trim() : '';
        reason = client ? `Delivery ${orderId.slice(0, 8)} — ${client}` : `Delivery ${orderId.slice(0, 8)}`;
      } else if (orderRow.order_type === 'para_llevar') {
        const client = orderRow.customer_name ? String(orderRow.customer_name).trim() : '';
        reason = client ? `Para llevar ${orderId.slice(0, 8)} — ${client}` : `Para llevar ${orderId.slice(0, 8)}`;
      } else if (orderRow.table_number) {
        const tbl = String(orderRow.table_number).toLowerCase().startsWith('mesa')
          ? String(orderRow.table_number)
          : `Mesa ${orderRow.table_number}`;
        reason = `Comanda ${orderId.slice(0, 8)} — ${tbl}`;
      }
    }
  } catch {
    // Keep fallback reason if order lookup fails
  }

  try {
    await db.execute({
      sql: `
        INSERT INTO inventory_movements (id, product_id, type, quantity, reason, user_id, order_id)
        VALUES (?, ?, 'salida', ?, ?, ?, ?)
      `,
      args: [createId(), productId, quantity, reason, userId, orderId],
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('no such column: order_id')) {
      await db.execute({
        sql: `
          INSERT INTO inventory_movements (id, product_id, type, quantity, reason, user_id)
          VALUES (?, ?, 'salida', ?, ?, ?)
        `,
        args: [createId(), productId, quantity, reason, userId],
      });
    } else {
      throw error;
    }
  }
}

export async function restoreInventoryForOrder(
  productId: string,
  quantity: number,
  userId: string,
  orderId: string,
): Promise<void> {
  await ensureMigrations();

  const item = await getInventoryItemById(productId);
  if (!item) return;

  await db.execute({
    sql: 'UPDATE inventory SET stock = stock + ? WHERE product_id = ?',
    args: [quantity, productId],
  });

  let reason = `Devolución comanda ${orderId.slice(0, 8)}`;
  try {
    const orderRes = await db.execute({
      sql: `
        SELECT o.order_type, o.customer_name, t.number AS table_number
        FROM orders o
        LEFT JOIN tables t ON t.id = o.table_id
        WHERE o.id = ?
        LIMIT 1
      `,
      args: [orderId],
    });
    const orderRow = orderRes.rows[0];
    if (orderRow) {
      if (orderRow.order_type === 'delivery') {
        const client = orderRow.customer_name ? String(orderRow.customer_name).trim() : '';
        reason = client ? `Devolución delivery ${orderId.slice(0, 8)} — ${client}` : `Devolución delivery ${orderId.slice(0, 8)}`;
      } else if (orderRow.order_type === 'para_llevar') {
        const client = orderRow.customer_name ? String(orderRow.customer_name).trim() : '';
        reason = client ? `Devolución para llevar ${orderId.slice(0, 8)} — ${client}` : `Devolución para llevar ${orderId.slice(0, 8)}`;
      } else if (orderRow.table_number) {
        const tbl = String(orderRow.table_number).toLowerCase().startsWith('mesa')
          ? String(orderRow.table_number)
          : `Mesa ${orderRow.table_number}`;
        reason = `Devolución comanda ${orderId.slice(0, 8)} — ${tbl}`;
      }
    }
  } catch {
    // Keep fallback reason if order lookup fails
  }

  try {
    await db.execute({
      sql: `
        INSERT INTO inventory_movements (id, product_id, type, quantity, reason, user_id, order_id)
        VALUES (?, ?, 'entrada', ?, ?, ?, ?)
      `,
      args: [createId(), productId, quantity, reason, userId, orderId],
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('no such column: order_id')) {
      await db.execute({
        sql: `
          INSERT INTO inventory_movements (id, product_id, type, quantity, reason, user_id)
          VALUES (?, ?, 'entrada', ?, ?, ?)
        `,
        args: [createId(), productId, quantity, reason, userId],
      });
    } else {
      throw error;
    }
  }
}
