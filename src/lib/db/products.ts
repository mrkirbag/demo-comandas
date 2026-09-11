import { isValidMenuCategory } from '@/data/product-categories';
import { createId } from '@/lib/utils/id';

import { db } from './client';
import { getInventoryItemById } from './inventory';
import { deleteImageByUrl } from '@/lib/uploadthing/server';
import type { SqlArgs } from './sql';
import type { Product } from './types';

export type CatalogProduct = {
  id: string;
  name: string;
  price: number;
  category: string;
  image_url: string | null;
  description: string | null;
  active: boolean;
  inventory_product_id: string | null;
  inventory_units_per_sale: number;
  inventory_item_name: string | null;
  stock?: number | null;
  has_inventory?: boolean;
};

const CATALOG_COLUMNS = `
  p.id,
  p.name,
  p.price,
  p.category,
  p.image_url,
  p.description,
  p.active,
  p.inventory_product_id,
  p.inventory_units_per_sale,
  inv.name AS inventory_item_name,
  inv_stock.stock AS inventory_stock
`;

const CATALOG_FROM = `
  FROM products p
  LEFT JOIN products inv ON inv.id = p.inventory_product_id AND inv.requires_inventory = 1
  LEFT JOIN inventory inv_stock ON inv_stock.product_id = p.inventory_product_id
`;

function mapProduct(row: Record<string, unknown>): CatalogProduct {
  const hasInventory = Boolean(row.inventory_product_id);
  let stock: number | null = null;
  if (hasInventory) {
    const rawStock = row.inventory_stock !== null && row.inventory_stock !== undefined
      ? Number(row.inventory_stock)
      : 0;
    const unitsPerSale = Number(row.inventory_units_per_sale ?? 1);
    const ratio = Math.max(1, unitsPerSale);
    stock = Math.max(0, Math.floor(rawStock / ratio));
  }

  return {
    id: String(row.id),
    name: String(row.name),
    price: Number(row.price),
    category: String(row.category),
    image_url: row.image_url ? String(row.image_url) : null,
    description: row.description ? String(row.description) : null,
    active: Boolean(row.active),
    inventory_product_id: row.inventory_product_id ? String(row.inventory_product_id) : null,
    inventory_units_per_sale: Number(row.inventory_units_per_sale ?? 1),
    inventory_item_name: row.inventory_item_name ? String(row.inventory_item_name) : null,
    stock,
    has_inventory: hasInventory,
  };
}

function mapMenuProduct(row: Record<string, unknown>): Product {
  const hasInventory = Boolean(row.inventory_product_id || row.requires_inventory);
  let stock: number | null = null;
  if (hasInventory) {
    const rawStock = row.inventory_stock !== null && row.inventory_stock !== undefined
      ? Number(row.inventory_stock)
      : 0;
    const unitsPerSale = Number(row.inventory_units_per_sale ?? 1);
    const ratio = Math.max(1, unitsPerSale);
    stock = Math.max(0, Math.floor(rawStock / ratio));
  }

  return {
    id: String(row.id),
    name: String(row.name),
    price: Number(row.price),
    category: String(row.category),
    image_url: row.image_url ? String(row.image_url) : null,
    description: row.description ? String(row.description) : null,
    requires_inventory: Boolean(row.requires_inventory),
    active: Boolean(row.active),
    inventory_product_id: row.inventory_product_id ? String(row.inventory_product_id) : null,
    inventory_units_per_sale: Number(row.inventory_units_per_sale ?? 1),
    stock,
    has_inventory: hasInventory,
  };
}

export type MenuInventoryLink = {
  requires_inventory: boolean;
  inventory_product_id: string | null;
  inventory_units_per_sale: number;
};

export { isValidMenuCategory };

export async function getMenuProductInventoryLink(
  productId: string,
): Promise<MenuInventoryLink | null> {
  const result = await db.execute({
    sql: `
      SELECT requires_inventory, inventory_product_id, inventory_units_per_sale
      FROM products
      WHERE id = ?
      LIMIT 1
    `,
    args: [productId],
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0] as Record<string, unknown>;
  return {
    requires_inventory: Boolean(row.requires_inventory),
    inventory_product_id: row.inventory_product_id ? String(row.inventory_product_id) : null,
    inventory_units_per_sale: Number(row.inventory_units_per_sale ?? 1),
  };
}

async function validateInventoryLink(
  category: string,
  inventoryProductId: string | null | undefined,
  inventoryUnitsPerSale?: number,
): Promise<{ inventory_product_id: string | null; inventory_units_per_sale: number }> {
  if (!inventoryProductId) {
    return { inventory_product_id: null, inventory_units_per_sale: 1 };
  }

  if (!isValidMenuCategory(category)) {
    throw new Error('Categoría inválida');
  }

  const item = await getInventoryItemById(inventoryProductId);
  if (!item) {
    throw new Error('El ítem de inventario seleccionado no existe');
  }

  const units = inventoryUnitsPerSale ?? 1;
  if (!Number.isInteger(units) || units < 1) {
    throw new Error('Las unidades por venta deben ser al menos 1');
  }

  return {
    inventory_product_id: inventoryProductId,
    inventory_units_per_sale: units,
  };
}

export async function listCatalogProducts(category?: string): Promise<CatalogProduct[]> {
  const sql = category
    ? `SELECT ${CATALOG_COLUMNS} ${CATALOG_FROM}
       WHERE p.requires_inventory = 0 AND p.category = ?
       ORDER BY p.category ASC, p.name ASC`
    : `SELECT ${CATALOG_COLUMNS} ${CATALOG_FROM}
       WHERE p.requires_inventory = 0
       ORDER BY p.category ASC, p.name ASC`;

  const result = await db.execute({
    sql,
    args: category ? [category] : [],
  });

  return result.rows.map((row) => mapProduct(row as Record<string, unknown>));
}

export async function getCatalogProductById(id: string): Promise<CatalogProduct | null> {
  const result = await db.execute({
    sql: `SELECT ${CATALOG_COLUMNS} ${CATALOG_FROM}
          WHERE p.id = ? AND p.requires_inventory = 0 LIMIT 1`,
    args: [id],
  });

  if (result.rows.length === 0) return null;
  return mapProduct(result.rows[0] as Record<string, unknown>);
}

export async function getProductByName(
  name: string,
  requiresInventory: boolean,
): Promise<CatalogProduct | null> {
  const result = await db.execute({
    sql: `SELECT ${CATALOG_COLUMNS} ${CATALOG_FROM}
          WHERE LOWER(p.name) = LOWER(?) AND p.requires_inventory = ? LIMIT 1`,
    args: [name, requiresInventory ? 1 : 0],
  });

  if (result.rows.length === 0) return null;
  return mapProduct(result.rows[0] as Record<string, unknown>);
}

export async function countProductInOrders(productId: string): Promise<number> {
  const result = await db.execute({
    sql: 'SELECT COUNT(*) AS count FROM order_items WHERE product_id = ?',
    args: [productId],
  });

  return Number(result.rows[0].count);
}

type CreateCatalogProductInput = {
  name: string;
  price: number;
  category: string;
  image_url?: string | null;
  description?: string | null;
  inventory_product_id?: string | null;
  inventory_units_per_sale?: number;
};

export async function createCatalogProduct(
  input: CreateCatalogProductInput,
): Promise<CatalogProduct> {
  const inventoryLink = await validateInventoryLink(
    input.category,
    input.inventory_product_id,
    input.inventory_units_per_sale,
  );

  const id = createId();

  await db.execute({
    sql: `
      INSERT INTO products (
        id, name, price, category, image_url, description, requires_inventory, active,
        inventory_product_id, inventory_units_per_sale
      )
      VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, ?)
    `,
    args: [
      id,
      input.name,
      input.price,
      input.category,
      input.image_url ?? null,
      input.description ?? null,
      inventoryLink.inventory_product_id,
      inventoryLink.inventory_units_per_sale,
    ],
  });

  const product = await getCatalogProductById(id);
  if (!product) throw new Error('No se pudo crear el producto');
  return product;
}

type UpdateCatalogProductInput = {
  name?: string;
  price?: number;
  category?: string;
  image_url?: string | null;
  description?: string | null;
  active?: boolean;
  inventory_product_id?: string | null;
  inventory_units_per_sale?: number;
};

export async function updateCatalogProduct(
  id: string,
  input: UpdateCatalogProductInput,
): Promise<CatalogProduct | null> {
  const current = await getCatalogProductById(id);
  if (!current) return null;

  const nextCategory = input.category ?? current.category;
  const fields: string[] = [];
  const args: SqlArgs = [];

  if (input.name !== undefined) {
    fields.push('name = ?');
    args.push(input.name);
  }

  if (input.price !== undefined) {
    fields.push('price = ?');
    args.push(input.price);
  }

  if (input.category !== undefined) {
    fields.push('category = ?');
    args.push(input.category);
  }

  if (input.image_url !== undefined) {
    if (current.image_url && current.image_url !== input.image_url) {
      // Borrar asíncronamente la imagen vieja
      deleteImageByUrl(current.image_url).catch(console.error);
    }
    fields.push('image_url = ?');
    args.push(input.image_url);
  }

  if (input.description !== undefined) {
    fields.push('description = ?');
    args.push(input.description);
  }

  if (input.active !== undefined) {
    fields.push('active = ?');
    args.push(input.active ? 1 : 0);
  }

  const inventoryTouched =
    input.inventory_product_id !== undefined || input.inventory_units_per_sale !== undefined;

  if (inventoryTouched) {
    const inventoryProductId =
      input.inventory_product_id !== undefined
        ? input.inventory_product_id
        : current.inventory_product_id;
    const inventoryUnitsPerSale =
      input.inventory_units_per_sale !== undefined
        ? input.inventory_units_per_sale
        : current.inventory_units_per_sale;

    const inventoryLink = await validateInventoryLink(
      nextCategory,
      inventoryProductId,
      inventoryUnitsPerSale,
    );

    fields.push('inventory_product_id = ?');
    args.push(inventoryLink.inventory_product_id);
    fields.push('inventory_units_per_sale = ?');
    args.push(inventoryLink.inventory_units_per_sale);
  }

  if (fields.length === 0) {
    return current;
  }

  await db.execute({
    sql: `UPDATE products SET ${fields.join(', ')} WHERE id = ? AND requires_inventory = 0`,
    args: [...args, id],
  });

  return getCatalogProductById(id);
}

export async function deleteCatalogProduct(id: string): Promise<boolean> {
  const current = await getCatalogProductById(id);

  const result = await db.execute({
    sql: 'DELETE FROM products WHERE id = ? AND requires_inventory = 0',
    args: [id],
  });

  const success = result.rowsAffected > 0;
  
  if (success && current?.image_url) {
    // Borrar asíncronamente la imagen asociada
    deleteImageByUrl(current.image_url).catch(console.error);
  }

  return success;
}

/** Productos activos del menú por IDs (para adicionales de comanda). */
export async function getActiveMenuProductsByIds(ids: string[]): Promise<Product[]> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return [];

  const placeholders = uniqueIds.map(() => '?').join(', ');
  const result = await db.execute({
    sql: `SELECT p.id, p.name, p.price, p.category, p.image_url, p.description, p.requires_inventory, p.active,
                 p.inventory_product_id, p.inventory_units_per_sale,
                 inv.stock AS inventory_stock
          FROM products p
          LEFT JOIN inventory inv ON inv.product_id = COALESCE(p.inventory_product_id, CASE WHEN p.requires_inventory = 1 THEN p.id ELSE NULL END)
          WHERE p.id IN (${placeholders}) AND p.requires_inventory = 0 AND p.active = 1`,
    args: uniqueIds,
  });

  return result.rows.map((row) => mapMenuProduct(row as Record<string, unknown>));
}

/** Producto activo del menú por ID (para comandas). */
export async function getActiveMenuProductById(id: string): Promise<Product | null> {
  const result = await db.execute({
    sql: `SELECT p.id, p.name, p.price, p.category, p.image_url, p.description, p.requires_inventory, p.active,
                 p.inventory_product_id, p.inventory_units_per_sale,
                 inv.stock AS inventory_stock
          FROM products p
          LEFT JOIN inventory inv ON inv.product_id = COALESCE(p.inventory_product_id, CASE WHEN p.requires_inventory = 1 THEN p.id ELSE NULL END)
          WHERE p.id = ? AND p.requires_inventory = 0 AND p.active = 1
          LIMIT 1`,
    args: [id],
  });

  if (result.rows.length === 0) return null;
  return mapMenuProduct(result.rows[0] as Record<string, unknown>);
}

/** Productos activos del menú para comandas. */
export async function listActiveMenuProducts(): Promise<Product[]> {
  const result = await db.execute({
    sql: `SELECT p.id, p.name, p.price, p.category, p.image_url, p.description, p.requires_inventory, p.active,
                 p.inventory_product_id, p.inventory_units_per_sale,
                 inv.stock AS inventory_stock
          FROM products p
          LEFT JOIN inventory inv ON inv.product_id = COALESCE(p.inventory_product_id, CASE WHEN p.requires_inventory = 1 THEN p.id ELSE NULL END)
          WHERE p.requires_inventory = 0 AND p.active = 1
          ORDER BY p.category ASC, p.name ASC`,
    args: [],
  });

  return result.rows.map((row) => mapMenuProduct(row as Record<string, unknown>));
}
