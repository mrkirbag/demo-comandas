/**
 * Utilidades para el control de horario de atención comercial (Zona horaria: Venezuela, UTC-4).
 */

export const VENEZUELA_TIMEZONE = 'America/Caracas';

export interface VenezuelaTime {
  hours: number;
  minutes: number;
  totalMinutes: number;
  timeString: string;
}

export interface StoreScheduleStatus {
  isOpen: boolean;
  openingHour?: string;
  closingHour?: string;
  currentVenezuelaTime: string;
  statusLabel: string;
  actionMessage: string;
}

/**
 * Obtiene la hora actual en la zona horaria de Venezuela (America/Caracas, UTC-4).
 */
export function getVenezuelaTime(date: Date = new Date()): VenezuelaTime {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: VENEZUELA_TIMEZONE,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(date);

  const hourPart = parts.find((p) => p.type === 'hour')?.value ?? '0';
  const minutePart = parts.find((p) => p.type === 'minute')?.value ?? '0';

  const rawHours = parseInt(hourPart, 10);
  const hours = rawHours % 24;
  const minutes = parseInt(minutePart, 10);
  const totalMinutes = hours * 60 + minutes;
  const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  return { hours, minutes, totalMinutes, timeString };
}

/**
 * Determina si el negocio está abierto según las horas configuradas en formato 'HH:mm' (24 horas).
 * Soporta horarios del mismo día (ej: 11:00 a 23:00) y horarios nocturnos que cruzan la medianoche (ej: 18:00 a 02:00).
 */
export function isStoreOpen(
  openingHour?: string,
  closingHour?: string,
  date: Date = new Date(),
): boolean {
  if (!openingHour || !closingHour) {
    return true; // Si no está configurado horario, se asume abierto
  }

  const parseMinutes = (timeStr: string): number => {
    const [h, m] = timeStr.trim().split(':').map((val) => parseInt(val, 10));
    return (Number.isNaN(h) ? 0 : h) * 60 + (Number.isNaN(m) ? 0 : m);
  };

  const openMinutes = parseMinutes(openingHour);
  const closeMinutes = parseMinutes(closingHour);
  const { totalMinutes } = getVenezuelaTime(date);

  if (openMinutes === closeMinutes) {
    return true; // 24 horas
  }

  if (openMinutes < closeMinutes) {
    // Mismo día (ej: 11:00 a 23:00)
    return totalMinutes >= openMinutes && totalMinutes < closeMinutes;
  }

  // Cruce de medianoche (ej: 18:00 a 02:00)
  return totalMinutes >= openMinutes || totalMinutes < closeMinutes;
}

/**
 * Obtiene el estado completo y los textos correspondientes para el hero y botones.
 */
export function getStoreScheduleStatus(
  openingHour?: string,
  closingHour?: string,
  date: Date = new Date(),
): StoreScheduleStatus {
  const { timeString } = getVenezuelaTime(date);
  const open = isStoreOpen(openingHour, closingHour, date);

  return {
    isOpen: open,
    openingHour,
    closingHour,
    currentVenezuelaTime: timeString,
    statusLabel: open ? 'Abierto para pedidos' : 'Cerrado para pedidos',
    actionMessage: open ? 'Ver mi pedido' : 'Pedidos dentro del horario laboral',
  };
}
