/**
 * Modificadores al tomar un pedido (preferencias, corte, término, etc.).
 *
 * White-label: edita este archivo por cliente. La UI los renderiza sola;
 * no hace falta tocar OrderView ni tickets.
 *
 * - `enabled: false` oculta el grupo (el de corte viene apagado en el demo).
 * - `mode: 'single'` = una sola opción (radio). `'multiple'` = varias a la vez.
 * - `categories` vacío = todas, salvo `excludeCategories`.
 * - Si `categories` tiene valores, solo esas (sigue respetando exclude).
 *
 * Ejemplos por tipo de local:
 * - Hamburguesería: activa `cut` y cambia las opciones de `preferences`
 *   a "Con todo", "Sin pan", "Sin tocineta", etc.
 * - Parrilla: agrega un grupo `doneness` (Término: Jugoso / Medio / Tres cuartos).
 * - Cafetería o menú simple: deja `cut` en false o pon `enabled: false` en todo.
 */

export type OrderModifierMode = 'single' | 'multiple';

export type OrderModifierGroup = {
  id: string;
  enabled: boolean;
  label: string;
  mode: OrderModifierMode;
  required: boolean;
  defaultOption: string;
  options: string[];
  categories: string[];
  excludeCategories: string[];
};

export const orderModifierGroups: OrderModifierGroup[] = [
  {
    id: 'cut',
    enabled: false,
    label: 'Corte',
    mode: 'single',
    required: true,
    defaultOption: 'Enteras',
    options: ['Enteras', 'Picadas'],
    categories: [],
    excludeCategories: ['bebidas', 'adicionales'],
  },
  {
    id: 'preferences',
    enabled: true,
    label: 'Preferencias',
    mode: 'multiple',
    required: true,
    defaultOption: 'Al gusto',
    options: [
      'Al gusto',
      'Sin cebolla',
      'Sin ajo',
      'Sin picante',
      'Poco sal',
      'Sin salsa',
    ],
    categories: [],
    excludeCategories: ['bebidas', 'adicionales'],
  },
];
