import type { APIRoute } from 'astro';

import { listActiveMenuProducts } from '@/lib/db/products';

export const GET: APIRoute = async () => {
  try {
    const products = await listActiveMenuProducts();
    return Response.json({ products });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al obtener productos';
    return Response.json({ error: message }, { status: 500 });
  }
};
