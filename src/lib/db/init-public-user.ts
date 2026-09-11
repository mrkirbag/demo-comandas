import { db } from './client';

/**
 * ID fijo del usuario sistema que se asigna a los pedidos creados
 * desde el formulario público (clientes sin login).
 */
export const PUBLIC_USER_ID = 'SYSTEM_PUBLIC';
const PUBLIC_USERNAME = 'cliente_web';

/**
 * Asegura que el usuario sistema `SYSTEM_PUBLIC` exista en la tabla `users`.
 * Se invoca de forma idempotente cada vez que el endpoint público recibe un pedido.
 */
export async function ensurePublicUser(): Promise<void> {
  const result = await db.execute({
    sql: 'SELECT id FROM users WHERE id = ? LIMIT 1',
    args: [PUBLIC_USER_ID],
  });

  if (result.rows.length > 0) return;

  await db.execute({
    sql: `
      INSERT OR IGNORE INTO users (id, username, password_hash, role, active)
      VALUES (?, ?, '', 'mesero', 1)
    `,
    args: [PUBLIC_USER_ID, PUBLIC_USERNAME],
  });
}
