/** Dinheiro sempre em centavos de real (inteiros), formatado só na borda da UI. */
export type Cents = number;

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatBRL(cents: Cents): string {
  return BRL.format(cents / 100);
}

/** "+R$ 12,40" / "−R$ 3,10" para lucro e prejuízo. */
export function formatSigned(cents: Cents): string {
  if (cents === 0) return formatBRL(0);
  return `${cents > 0 ? '+' : '−'}${formatBRL(Math.abs(cents))}`;
}

export function usdToCents(usd: number, usdBrl: number): Cents {
  return Math.round(usd * usdBrl * 100);
}
