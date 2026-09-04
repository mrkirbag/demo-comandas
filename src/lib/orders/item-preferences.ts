import {
  orderModifierGroups,
  type OrderModifierGroup,
} from '@/data/order-modifiers';

export type { OrderModifierGroup, OrderModifierMode } from '@/data/order-modifiers';
export { orderModifierGroups } from '@/data/order-modifiers';

export function modifierGroupAppliesToCategory(
  group: OrderModifierGroup,
  category: string,
): boolean {
  if (!group.enabled || group.options.length === 0) {
    return false;
  }

  if (group.excludeCategories.includes(category)) {
    return false;
  }

  if (group.categories.length > 0) {
    return group.categories.includes(category);
  }

  return true;
}

export function getApplicableModifierGroups(category: string): OrderModifierGroup[] {
  return orderModifierGroups.filter((group) => modifierGroupAppliesToCategory(group, category));
}

export function categoryUsesModifiers(category: string): boolean {
  return getApplicableModifierGroups(category).length > 0;
}

export function getDefaultSelections(category: string): Record<string, string[]> {
  const selections: Record<string, string[]> = {};

  for (const group of getApplicableModifierGroups(category)) {
    selections[group.id] = [group.defaultOption];
  }

  return selections;
}

export function toggleMultipleModifierOption(
  current: string[],
  option: string,
  defaultOption: string,
): string[] {
  if (option === defaultOption) {
    return [defaultOption];
  }

  const withoutDefault = current.filter((value) => value !== defaultOption);
  const isSelected = withoutDefault.includes(option);
  const next = isSelected
    ? withoutDefault.filter((value) => value !== option)
    : [...withoutDefault, option];

  return next.length === 0 ? [defaultOption] : next;
}

export function buildItemNotes(
  category: string,
  selections: Record<string, string[]>,
): string | undefined {
  const groups = getApplicableModifierGroups(category);
  if (groups.length === 0) {
    return undefined;
  }

  const parts = groups.flatMap((group) =>
    (selections[group.id] ?? []).map((option) => option.trim()).filter(Boolean),
  );

  return parts.length > 0 ? parts.join(', ') : undefined;
}

/** Texto de modificadores para tickets y cocina. Sin notas o categoría sin grupos → no se muestra. */
export function getItemPreferenceLabel(item: {
  notes?: string | null;
  product_category?: string | null;
}): string | null {
  if (item.product_category && !categoryUsesModifiers(item.product_category)) {
    return null;
  }

  const notes = item.notes?.trim();
  return notes ? notes : null;
}
