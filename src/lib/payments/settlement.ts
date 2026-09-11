import type { ExchangeRates, ForeignCurrency, OrderPaymentInput, PaymentMethod } from '@/lib/db/types';
import { isBsPaymentMethod, isUsdPaymentMethod } from '@/lib/payments/methods';
import { brand } from '@/data/brand';
import { convertBsToCop, convertCopToBs, convertCopToUsd, convertUsdToCop, roundCop, roundToCents } from '@/lib/utils/currency';

export type TenderLine = {
  method: PaymentMethod;
  amount: number;
};

export type SettledTender = {
  method: PaymentMethod;
  amount: number;
  amountCop: number;
  foreignAmount: number | null;
  foreignCurrency: ForeignCurrency | null;
  snappedToRemaining: boolean;
};

/**
 * Half a cent of foreign currency, in base currency.
 * That is the maximum error from rounding a periodic conversion to payable cents.
 */
export function foreignRoundingToleranceCop(currency: ForeignCurrency, rates: ExchangeRates): number {
  if (!rates || rates.usd_rate <= 0 || rates.bs_rate <= 0) return (brand.currency.code as string) === 'USD' ? 0.01 : 1;
  
  let rawBase = 0;
  if (currency === 'usd') {
    rawBase = (brand.currency.code as string) === 'USD' ? 0.005 : 0.005 * rates.usd_rate;
  } else {
    rawBase = (brand.currency.code as string) === 'USD' 
      ? (0.005 * rates.bs_rate) / rates.usd_rate 
      : 0.005 * rates.bs_rate;
  }
  
  const minTolerance = (brand.currency.code as string) === 'USD' ? 0.01 : 1;
  return Math.max(minTolerance, (brand.currency.code as string) === 'USD' ? rawBase : Math.ceil(rawBase));
}

export function copFromForeignAmount(foreignAmount: number, currency: ForeignCurrency, rates: ExchangeRates): number {
  if (currency === 'usd') {
    return convertUsdToCop(foreignAmount, rates);
  }
  return convertBsToCop(foreignAmount, rates);
}

export function payableForeignAmount(remainingCop: number, currency: ForeignCurrency, rates: ExchangeRates): number {
  if (!Number.isFinite(remainingCop) || remainingCop <= 0 || !rates) return 0;
  
  if (currency === 'usd') {
    return roundToCents(convertCopToUsd(remainingCop, rates));
  }
  return roundToCents(convertCopToBs(remainingCop, rates));
}

export function copCreditedForForeignAmount(
  foreignAmount: number,
  currency: ForeignCurrency,
  rates: ExchangeRates,
  remainingCop: number,
): { amountCop: number; snappedToRemaining: boolean } {
  const converted = copFromForeignAmount(foreignAmount, currency, rates);
  const tolerance = foreignRoundingToleranceCop(currency, rates);

  if (Math.abs(converted - remainingCop) <= tolerance) {
    return { amountCop: remainingCop, snappedToRemaining: converted !== remainingCop };
  }

  return { amountCop: converted, snappedToRemaining: false };
}

export function isForeignAmountWithinRate(
  foreignAmount: number,
  amountCop: number,
  currency: ForeignCurrency,
  rates: ExchangeRates,
): boolean {
  const expectedCop = copFromForeignAmount(foreignAmount, currency, rates);
  return Math.abs(expectedCop - amountCop) <= foreignRoundingToleranceCop(currency, rates);
}

export function settlePaymentLines(
  lines: TenderLine[],
  orderTotalCop: number,
  rates: ExchangeRates | null,
): {
  tenders: SettledTender[];
  payments: OrderPaymentInput[];
  paidCop: number;
  remainingCop: number;
} {
  const tenders: SettledTender[] = [];
  let remainingCop = orderTotalCop;

  for (const line of lines) {
    const amount = Number(line.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      tenders.push({
        method: line.method,
        amount: 0,
        amountCop: 0,
        foreignAmount: null,
        foreignCurrency: null,
        snappedToRemaining: false,
      });
      continue;
    }

    if (isUsdPaymentMethod(line.method)) {
      if (!rates || rates.usd_rate <= 0) {
        tenders.push({
          method: line.method,
          amount,
          amountCop: 0,
          foreignAmount: null,
          foreignCurrency: 'usd',
          snappedToRemaining: false,
        });
        continue;
      }

      const foreignAmount = roundToCents(amount);
      const credited = copCreditedForForeignAmount(foreignAmount, 'usd', rates, remainingCop);
      tenders.push({
        method: line.method,
        amount: foreignAmount,
        amountCop: credited.amountCop,
        foreignAmount,
        foreignCurrency: 'usd',
        snappedToRemaining: credited.snappedToRemaining,
      });
      remainingCop -= credited.amountCop;
      continue;
    }

    if (isBsPaymentMethod(line.method)) {
      if (!rates || rates.bs_rate <= 0) {
        tenders.push({
          method: line.method,
          amount,
          amountCop: 0,
          foreignAmount: null,
          foreignCurrency: 'bs',
          snappedToRemaining: false,
        });
        continue;
      }

      const foreignAmount = roundToCents(amount);
      const credited = copCreditedForForeignAmount(foreignAmount, 'bs', rates, remainingCop);
      tenders.push({
        method: line.method,
        amount: foreignAmount,
        amountCop: credited.amountCop,
        foreignAmount,
        foreignCurrency: 'bs',
        snappedToRemaining: credited.snappedToRemaining,
      });
      remainingCop -= credited.amountCop;
      continue;
    }

    tenders.push({
      method: line.method,
      amount,
      amountCop: amount,
      foreignAmount: null,
      foreignCurrency: null,
      snappedToRemaining: false,
    });
    remainingCop -= amount;
  }

  const payments: OrderPaymentInput[] = tenders
    .filter((tender) => tender.amountCop > 0)
    .map((tender) => ({
      payment_method: tender.method,
      amount_cop: tender.amountCop,
      foreign_currency: tender.foreignCurrency,
      foreign_amount: tender.foreignAmount,
    }));

  return {
    tenders,
    payments,
    paidCop: orderTotalCop - remainingCop,
    remainingCop,
  };
}

export function payableAmountForMethod(
  method: PaymentMethod,
  remainingCop: number,
  rates: ExchangeRates | null,
): string {
  if (remainingCop <= 0) return '';

  if (isUsdPaymentMethod(method)) {
    if (!rates || rates.usd_rate <= 0) return '';
    return payableForeignAmount(remainingCop, 'usd', rates).toFixed(2);
  }

  if (isBsPaymentMethod(method)) {
    if (!rates || rates.bs_rate <= 0) return '';
    return payableForeignAmount(remainingCop, 'bs', rates).toFixed(2);
  }

  return String(Math.max(0, roundCop(remainingCop)));
}
