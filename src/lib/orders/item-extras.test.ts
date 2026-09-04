import { describe, expect, it } from 'vitest';

import {
  formatExtraLine,
  parseOrderItemExtras,
  productUsesAdicionales,
  sumExtrasPrice,
} from '@/lib/orders/item-extras';
import {
  buildItemNotes,
  categoryUsesModifiers,
  getApplicableModifierGroups,
  getItemPreferenceLabel,
  toggleMultipleModifierOption,
} from '@/lib/orders/item-preferences';

describe('item extras', () => {
  it('parsea adicionales guardados en JSON', () => {
    const extras = parseOrderItemExtras(
      JSON.stringify([{ product_id: '1', name: 'Adicional de salchicha', price: 3000 }]),
    );

    expect(extras).toEqual([{ product_id: '1', name: 'Adicional de salchicha', price: 3000 }]);
    expect(sumExtrasPrice(extras)).toBe(3000);
    expect(formatExtraLine(extras[0])).toBe('+ Adicional de salchicha');
  });

  it('no admite adicionales en bebidas ni en la categoría adicionales', () => {
    expect(productUsesAdicionales('clasicas')).toBe(true);
    expect(productUsesAdicionales('bebidas')).toBe(false);
    expect(productUsesAdicionales('adicionales')).toBe(false);
  });
});

describe('item preferences', () => {
  it('no aplica corte ni preferencias a bebidas ni adicionales', () => {
    expect(getApplicableModifierGroups('bebidas')).toEqual([]);
    expect(getApplicableModifierGroups('adicionales')).toEqual([]);
    expect(categoryUsesModifiers('hamburguesas')).toBe(true);
  });

  it('el grupo de corte viene desactivado en el demo', () => {
    expect(getApplicableModifierGroups('hamburguesas').some((group) => group.id === 'cut')).toBe(
      false,
    );
  });

  it('arma notas solo con los grupos activos', () => {
    expect(buildItemNotes('hamburguesas', { preferences: ['Al gusto'] })).toBe('Al gusto');
    expect(
      buildItemNotes('hamburguesas', { preferences: ['Sin cebolla', 'Sin salsa'] }),
    ).toBe('Sin cebolla, Sin salsa');
    expect(buildItemNotes('bebidas', { preferences: ['Sin cebolla'] })).toBeUndefined();
  });

  it('en tickets muestra las notas guardadas, sin inventar valores', () => {
    expect(getItemPreferenceLabel({ notes: null, product_category: 'hamburguesas' })).toBeNull();
    expect(
      getItemPreferenceLabel({ notes: 'Sin cebolla', product_category: 'hamburguesas' }),
    ).toBe('Sin cebolla');
    expect(
      getItemPreferenceLabel({ notes: 'Picadas, Sin pan', product_category: 'bebidas' }),
    ).toBeNull();
  });

  it('en múltiple, la opción por defecto limpia el resto', () => {
    expect(toggleMultipleModifierOption(['Al gusto'], 'Sin cebolla', 'Al gusto')).toEqual([
      'Sin cebolla',
    ]);
    expect(
      toggleMultipleModifierOption(['Sin cebolla', 'Sin salsa'], 'Al gusto', 'Al gusto'),
    ).toEqual(['Al gusto']);
    expect(toggleMultipleModifierOption(['Sin cebolla'], 'Sin cebolla', 'Al gusto')).toEqual([
      'Al gusto',
    ]);
  });
});
