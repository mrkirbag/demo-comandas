import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

const db = createClient({
  url: process.env.TURSO_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

export const DEMO_PRODUCTS = [
  // --- PERROS CALIENTES (3) ---
  {
    id: 'de6804ad-a8e0-47f9-804c-5124dd48bd34', // existente con órdenes
    name: 'Perro Clásico',
    category: 'perros-calientes',
    price: 12000,
    description: 'Salchicha tipo Frankfurt, pan artesanal tostado, salsas especiales de la casa y lluvia de papas fosforito crocantes.',
    image_url: 'https://images.unsplash.com/photo-1619740455993-9e612b1af08a?auto=format&fit=crop&w=800&q=80',
    requires_inventory: 0,
    inventory_product_id: null,
    inventory_units_per_sale: 1,
    active: 1,
  },
  {
    id: '417bc5e5-6649-4243-ba48-6a65802a5753', // existente con órdenes
    name: 'Perro con Todo',
    category: 'perros-calientes',
    price: 15000,
    description: 'Especial con tocineta ahumada crujiente, queso fundido, cebolla caramelizada y salsa tártara de la casa.',
    image_url: 'https://images.unsplash.com/photo-1541214113241-21578d2d9b62?auto=format&fit=crop&w=800&q=80',
    requires_inventory: 0,
    inventory_product_id: null,
    inventory_units_per_sale: 1,
    active: 1,
  },
  {
    id: 'perro-suizo-premium-01',
    name: 'Perro Especial Suizo',
    category: 'perros-calientes',
    price: 16500,
    description: 'Salchicha suiza premium a la plancha, doble queso gratinado, virutas de jamón y tocineta crocante.',
    image_url: 'https://images.unsplash.com/photo-1496905583330-eb54c7e5915a?auto=format&fit=crop&w=800&q=80',
    requires_inventory: 0,
    inventory_product_id: null,
    inventory_units_per_sale: 1,
    active: 1,
  },

  // --- HAMBURGUESAS (5) ---
  {
    id: '0c05e5b6-9ad3-4166-b84b-72e33501e7b2', // existente con órdenes
    name: 'Hamburguesa Clásica',
    category: 'hamburguesas',
    price: 18000,
    description: '150g de carne de res seleccionada, queso americano, lechuga fresca, tomate de huerto y salsa de la casa.',
    image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80',
    requires_inventory: 0,
    inventory_product_id: null,
    inventory_units_per_sale: 1,
    active: 1,
  },
  {
    id: '0f09c042-18e5-4738-a785-1475d349089a', // existente con órdenes
    name: 'Hamburguesa Doble',
    category: 'hamburguesas',
    price: 22000,
    description: 'Doble porción de carne jugosa (300g), doble capa de queso cheddar fundido, tocineta crujiente y cebolla.',
    image_url: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=800&q=80',
    requires_inventory: 0,
    inventory_product_id: null,
    inventory_units_per_sale: 1,
    active: 1,
  },
  {
    id: 'burger-bbq-bacon-01',
    name: 'Hamburguesa BBQ Bacon',
    category: 'hamburguesas',
    price: 21000,
    description: 'Carne artesanal a la parrilla bañada en salsa BBQ ahumada, tocineta crujiente y suave queso derretido.',
    image_url: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=80',
    requires_inventory: 0,
    inventory_product_id: null,
    inventory_units_per_sale: 1,
    active: 1,
  },
  {
    id: 'burger-crispy-chicken-01',
    name: 'Hamburguesa Crispy Chicken',
    category: 'hamburguesas',
    price: 19500,
    description: 'Pechuga de pollo apanada súper crocante, aderezo honey mustard cremoso, pepinillos dulces y lechuga.',
    image_url: 'https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?auto=format&fit=crop&w=800&q=80',
    requires_inventory: 0,
    inventory_product_id: null,
    inventory_units_per_sale: 1,
    active: 1,
  },
  {
    id: 'burger-monster-cheese-01',
    name: 'Hamburguesa Monster Cheese',
    category: 'hamburguesas',
    price: 24000,
    description: 'Carne artesanal premium bañada con abundante queso cheddar fundido al vapor y cebolla crispy.',
    image_url: 'https://images.unsplash.com/photo-1586816001966-79b736744398?auto=format&fit=crop&w=800&q=80',
    requires_inventory: 0,
    inventory_product_id: null,
    inventory_units_per_sale: 1,
    active: 1,
  },

  // --- ENTRADAS (5) ---
  {
    id: '81980a4e-2aa7-4677-aeda-2e526cbda6c9', // existente con órdenes
    name: 'Tequeños de Chocolate (3 un)',
    category: 'entradas',
    price: 3000,
    description: 'Tres deliciosos tequeños rellenos de chocolate caliente artesanal y masa hojaldrada dorada.',
    image_url: 'https://images.unsplash.com/photo-1585238342024-78d387f4a707?auto=format&fit=crop&w=800&q=80',
    requires_inventory: 0,
    inventory_product_id: '7ef2768e-0022-48ae-af9d-ff9f4b61f6bd',
    inventory_units_per_sale: 1,
    active: 1,
  },
  {
    id: 'entrada-tequenos-queso-01',
    name: 'Tequeños Tradicionales de Queso (5 un)',
    category: 'entradas',
    price: 12000,
    description: 'Deditos crujientes rellenos de auténtico queso blanco semiduro acompañados con salsa tártara y ajo.',
    image_url: 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&w=800&q=80',
    requires_inventory: 0,
    inventory_product_id: null,
    inventory_units_per_sale: 1,
    active: 1,
  },
  {
    id: 'entrada-papas-rusticas-01',
    name: 'Papas Rústicas Crocantes',
    category: 'entradas',
    price: 9000,
    description: 'Papas en cascos con piel, sazonadas con páprika, finas hierbas y acompañadas de mayonesa de ajo casera.',
    image_url: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=800&q=80',
    requires_inventory: 0,
    inventory_product_id: null,
    inventory_units_per_sale: 1,
    active: 1,
  },
  {
    id: 'entrada-alitas-bbq-01',
    name: 'Alitas BBQ Glaseadas (6 un)',
    category: 'entradas',
    price: 17000,
    description: 'Alitas de pollo doradas y crujientes, glaseadas en salsa BBQ dulce con semillas de ajonjolí tostadas.',
    image_url: 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?auto=format&fit=crop&w=800&q=80',
    requires_inventory: 0,
    inventory_product_id: null,
    inventory_units_per_sale: 1,
    active: 1,
  },
  {
    id: 'entrada-aros-cebolla-01',
    name: 'Aros de Cebolla Apanados',
    category: 'entradas',
    price: 8500,
    description: 'Aros de cebolla fresca dulce rebozados con panko extra crujiente y salsa dip de la casa.',
    image_url: 'https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?auto=format&fit=crop&w=800&q=80',
    requires_inventory: 0,
    inventory_product_id: null,
    inventory_units_per_sale: 1,
    active: 1,
  },
  {
    id: 'entrada-nachos-supremos-01',
    name: 'Nachos Supremos con Queso',
    category: 'entradas',
    price: 14000,
    description: 'Totopos de maíz crujientes cubiertos con queso cheddar fundido, pico de gallo fresco y jalapeños.',
    image_url: 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?auto=format&fit=crop&w=800&q=80',
    requires_inventory: 0,
    inventory_product_id: null,
    inventory_units_per_sale: 1,
    active: 1,
  },

  // --- BEBIDAS (4) ---
  {
    id: '37694e2b-241f-4fb0-b4e2-b7b712eea956', // existente con órdenes
    name: 'Coca-Cola 500ml',
    category: 'bebidas',
    price: 5000,
    description: 'Refresco clásico Coca-Cola bien frío en presentación de 500ml.',
    image_url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80',
    requires_inventory: 0,
    inventory_product_id: 'f5982eaa-161b-45b8-a1ea-7cdac26ed9dc',
    inventory_units_per_sale: 1,
    active: 1,
  },
  {
    id: 'bebida-limonada-natural-01',
    name: 'Limonada Natural Fresh',
    category: 'bebidas',
    price: 6500,
    description: 'Zumo recién exprimido de limones naturales seleccionados, toque de hierbabuena y abundante hielo.',
    image_url: 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?auto=format&fit=crop&w=800&q=80',
    requires_inventory: 0,
    inventory_product_id: null,
    inventory_units_per_sale: 1,
    active: 1,
  },
  {
    id: 'bebida-malteada-chocolate-01',
    name: 'Malteada de Chocolate Artesanal',
    category: 'bebidas',
    price: 9500,
    description: 'Cremosa malteada elaborada con helado premium, sirope de chocolate y corona de crema chantilly.',
    image_url: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=800&q=80',
    requires_inventory: 0,
    inventory_product_id: null,
    inventory_units_per_sale: 1,
    active: 1,
  },
  {
    id: 'bebida-te-durazno-01',
    name: 'Té Frío de Durazno',
    category: 'bebidas',
    price: 5500,
    description: 'Infusión refrescante de té negro con notas aromáticas de durazno dulce y rodajas de limón fresco.',
    image_url: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=800&q=80',
    requires_inventory: 0,
    inventory_product_id: null,
    inventory_units_per_sale: 1,
    active: 1,
  },

  // --- ADICIONALES (3) ---
  {
    id: '08aa6364-cc45-4311-8a3e-0e58cb56c700', // existente con órdenes
    name: 'Salsa Cheddar Fundida',
    category: 'adicionales',
    price: 3000,
    description: 'Porción generosa de queso cheddar líquido tibio y cremoso para untar en hamburguesas o papas.',
    image_url: 'https://plus.unsplash.com/premium_photo-1775617410976-b9569c44a081?auto=format&fit=crop&w=800&q=80',
    requires_inventory: 0,
    inventory_product_id: null,
    inventory_units_per_sale: 1,
    active: 1,
  },
  {
    id: 'adic-tocineta-crispy-01',
    name: 'Tocineta Crispy Extra',
    category: 'adicionales',
    price: 3500,
    description: 'Tiras de tocineta ahumada doradas al punto crocante ideal.',
    image_url: 'https://images.unsplash.com/photo-1606851094655-b2593a9af63f?auto=format&fit=crop&w=800&q=80',
    requires_inventory: 0,
    inventory_product_id: null,
    inventory_units_per_sale: 1,
    active: 1,
  },
  {
    id: 'adic-guacamole-01',
    name: 'Guacamole Casero',
    category: 'adicionales',
    price: 3500,
    description: 'Aguacate fresco machacado al momento con tomate, cebolla morada finita y un toque cítrico de lima.',
    image_url: 'https://images.unsplash.com/photo-1680992071073-cb1696ba8d3e?auto=format&fit=crop&w=800&q=80',
    requires_inventory: 0,
    inventory_product_id: null,
    inventory_units_per_sale: 1,
    active: 1,
  },
];

async function seed() {
  console.log(`Actualizando / insertando ${DEMO_PRODUCTS.length} productos...`);

  for (const p of DEMO_PRODUCTS) {
    const existing = await db.execute({
      sql: 'SELECT id FROM products WHERE id = ?',
      args: [p.id],
    });

    if (existing.rows.length > 0) {
      await db.execute({
        sql: `UPDATE products SET 
              name = ?, category = ?, price = ?, description = ?, image_url = ?, 
              requires_inventory = ?, inventory_product_id = ?, inventory_units_per_sale = ?, active = ?
              WHERE id = ?`,
        args: [
          p.name,
          p.category,
          p.price,
          p.description,
          p.image_url,
          p.requires_inventory,
          p.inventory_product_id,
          p.inventory_units_per_sale,
          p.active,
          p.id,
        ],
      });
      console.log(`✓ Actualizado: ${p.name}`);
    } else {
      await db.execute({
        sql: `INSERT INTO products (
                id, name, category, price, description, image_url,
                requires_inventory, inventory_product_id, inventory_units_per_sale, active
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          p.id,
          p.name,
          p.category,
          p.price,
          p.description,
          p.image_url,
          p.requires_inventory,
          p.inventory_product_id,
          p.inventory_units_per_sale,
          p.active,
        ],
      });
      console.log(`+ Insertado: ${p.name}`);
    }
  }

  const res = await db.execute('SELECT COUNT(*) as count FROM products WHERE requires_inventory = 0');
  console.log(`Total productos de venta en catálogo: ${res.rows[0].count}`);
}

seed().catch((err) => {
  console.error('Error seeding demo products:', err);
  process.exit(1);
});
