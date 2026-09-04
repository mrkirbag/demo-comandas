import 'dotenv/config';

import { createClient } from '@libsql/client';

import { createId } from '@/lib/utils/id';

const DEFAULT_PRODUCTS = [
  {
    name: 'Perro Clásico',
    price: 12000,
    category: 'perros-calientes',
    requires_inventory: false,
  },
  {
    name: 'Perro con Todo',
    price: 15000,
    category: 'perros-calientes',
    requires_inventory: false,
  },
  {
    name: 'Hamburguesa Clásica',
    price: 18000,
    category: 'hamburguesas',
    requires_inventory: false,
  },
  {
    name: 'Hamburguesa Doble',
    price: 22000,
    category: 'hamburguesas',
    requires_inventory: false,
  },
  {
    name: 'Gaseosa 500ml',
    price: 5000,
    category: 'bebidas',
    requires_inventory: false,
  },
];

async function seedProducts() {
  const url = process.env.TURSO_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error('Missing TURSO_URL or TURSO_AUTH_TOKEN in .env');
  }

  const db = createClient({ url, authToken });

  // Limpiar productos existentes
  await db.execute('DELETE FROM products');
  console.log('Productos existentes eliminados.');

  for (const product of DEFAULT_PRODUCTS) {
    await db.execute({
      sql: `
        INSERT INTO products (id, name, price, category, requires_inventory, inventory_units_per_sale, active)
        VALUES (?, ?, ?, ?, ?, 1, ?)
      `,
      args: [
        createId(),
        product.name,
        product.price,
        product.category,
        product.requires_inventory,
        true,
      ],
    });
  }

  console.log(`${DEFAULT_PRODUCTS.length} productos creados correctamente.`);
}

seedProducts().catch((error) => {
  console.error('Error al ejecutar seed de productos:', error);
  process.exit(1);
});
