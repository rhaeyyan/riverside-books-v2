export function formatMoney(cents: number | undefined): string {
  if (cents === undefined) return "$0.00";
  return `$${(cents / 100).toFixed(2)}`;
}
