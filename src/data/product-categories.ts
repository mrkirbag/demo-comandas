export type ProductCategory = {
  id: string;
  label: string;
};

export type MenuCategory = ProductCategory;
export type InventoryCategory = ProductCategory;

export type InventoryUnit = {
  id: string;
  label: string;
};

/** Categorías unificadas de productos (catálogo, menú e inventario). */
export const productCategories: ProductCategory[] = [
  { id: 'entradas', label: 'Entradas' },
  { id: 'perros-calientes', label: 'Perros Calientes' },
  { id: 'hamburguesas', label: 'Hamburguesas' },
  { id: 'adicionales', label: 'Adicionales' },
  { id: 'bebidas', label: 'Bebidas' },
];

/** Categorías del menú para comandas y catálogo. */
export const menuCategories: MenuCategory[] = productCategories;

/** Categorías de insumos controlados en inventario (mismas que catálogo). */
export const inventoryCategories: InventoryCategory[] = productCategories;

export const inventoryUnits: InventoryUnit[] = [
  { id: 'cajas', label: 'Cajas' },
  { id: 'unidades', label: 'Unidades' },
  { id: 'bolsas', label: 'Bolsas' },
  { id: 'kg', label: 'Kilogramos' },
  { id: 'litros', label: 'Litros' },
];

const LEGACY_INVENTORY_CATEGORY_LABELS: Record<string, string> = {
  panaderia: 'Panadería',
  insumos: 'Insumos',
  empaques: 'Empaques',
};

export function getMenuCategoryLabel(id: string): string {
  return menuCategories.find((c) => c.id === id)?.label ?? id;
}

export function getInventoryCategoryLabel(id: string): string {
  return (
    inventoryCategories.find((c) => c.id === id)?.label ??
    LEGACY_INVENTORY_CATEGORY_LABELS[id] ??
    id
  );
}

export function getInventoryUnitLabel(id: string): string {
  return inventoryUnits.find((u) => u.id === id)?.label ?? id;
}

export function isValidMenuCategory(id: string): boolean {
  return menuCategories.some((c) => c.id === id);
}

export function isValidInventoryCategory(id: string): boolean {
  return (
    inventoryCategories.some((c) => c.id === id) ||
    id in LEGACY_INVENTORY_CATEGORY_LABELS
  );
}

export function isValidInventoryUnit(id: string): boolean {
  return inventoryUnits.some((u) => u.id === id);
}
