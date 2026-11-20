/**
 * Locale-aware number formatting ("99,5 %" in French, "99.5%" in English).
 * Formatters are cached: these run in render paths updated several times per second.
 */
const cache = new Map<string, Intl.NumberFormat>();

function formatter(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, options);
    cache.set(key, f);
  }
  return f;
}

export const formatNumber = (locale: string, value: number, maxDigits = 1) =>
  formatter(locale, { maximumFractionDigits: maxDigits }).format(value);

/** `value` is a percentage (0–100). */
export const formatPercent = (locale: string, value: number, maxDigits = 1) =>
  formatter(locale, { style: "percent", maximumFractionDigits: maxDigits }).format(value / 100);
