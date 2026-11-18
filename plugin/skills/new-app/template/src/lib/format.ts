/**
 * ONE place for numbers/dates so an app never mixes ١٢٣ and 123.
 * Set DIGITS once per app: "arab" (١٢٣) or "latn" (123 — common in Libya/Maghreb).
 */
export const DIGITS: "arab" | "latn" = "arab";
const loc = `ar-u-nu-${DIGITS}`;

export const num = (n: number, opts?: Intl.NumberFormatOptions) => new Intl.NumberFormat(loc, opts).format(n);
export const pct = (n: number) => new Intl.NumberFormat(loc, { style: "percent", maximumFractionDigits: 0 }).format(n / 100);
export const money = (n: number, currency = "LYD") => new Intl.NumberFormat(loc, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
export const date = (d: Date | string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" }) => new Intl.DateTimeFormat(loc, opts).format(new Date(d));
export const relTime = (d: Date | string) => {
  const diff = (new Date(d).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(loc, { numeric: "auto" });
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [[60, "second"], [60, "minute"], [24, "hour"], [7, "day"], [4.35, "week"], [12, "month"], [Infinity, "year"]];
  let v = diff;
  for (const [k, unit] of steps) { if (Math.abs(v) < k) return rtf.format(Math.round(v), unit); v /= k; }
  return "";
};
