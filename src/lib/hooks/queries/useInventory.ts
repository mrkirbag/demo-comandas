import { useQuery } from '@tanstack/react-query';

import { fetchJson } from '@/lib/api/parseError';
import type { InventoryItem } from '@/lib/db/inventory';
import { queryKeys } from '@/lib/query/keys';

async function fetchInventory(): Promise<InventoryItem[]> {
  const data = await fetchJson<{ items: InventoryItem[] }>('/api/inventory');
  return data.items ?? [];
}

export function useInventory() {
  const query = useQuery({
    queryKey: queryKeys.inventory,
    queryFn: fetchInventory,
  });

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}

export type InventoryMovementRecord = {
  id: string;
  type: 'entrada' | 'salida';
  quantity: number;
  reason: string | null;
  username: string;
  created_at: string;
  order_id?: string | null;
  order_type?: string | null;
  customer_name?: string | null;
  table_number?: string | null;
};

export type InventoryMovementsFilter = {
  dateFrom?: string;
  dateTo?: string;
};

export function useInventoryMovements(
  itemId: string | null,
  filters?: InventoryMovementsFilter,
) {
  const dateFrom = filters?.dateFrom?.trim() || '';
  const dateTo = filters?.dateTo?.trim() || '';

  const query = useQuery({
    queryKey: [...queryKeys.inventory, 'movements', itemId, dateFrom, dateTo] as const,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      const qs = params.toString();
      const url = `/api/inventory/${itemId}/movements${qs ? `?${qs}` : ''}`;
      const data = await fetchJson<{ movements: InventoryMovementRecord[] }>(url);
      return data.movements ?? [];
    },
    enabled: Boolean(itemId),
  });

  return {
    movements: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}
