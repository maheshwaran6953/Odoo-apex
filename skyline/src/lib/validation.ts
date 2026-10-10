/** Parse decimal money without floating point rounding or coercing blank input to zero. */
export function moneyCents(value: unknown, allowZero = false): number | null {
  if (typeof value !== "string" || !/^\d{1,6}(\.\d{1,2})?$/.test(value.trim()))
    return null;
  const [whole, fraction = ""] = value.trim().split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return cents <= 10_000_000 && (allowZero ? cents >= 0 : cents > 0)
    ? cents
    : null;
}
export function validEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
export function validName(value: string, minimum = 2, maximum = 100): boolean {
  return (
    value.length >= minimum &&
    value.length <= maximum &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}
