import { LocaleStringArrayMap, LocaleStringMap } from '@/types/course';

export const getPreferredLocale = (
  available: string[],
  requested: string | null = null,
): string => {
  if (!available.length) return requested ?? 'no';
  const normalizedRequested = requested?.slice(0, 2).toLowerCase();
  if (normalizedRequested && available.includes(normalizedRequested)) {
    return normalizedRequested;
  }
  const browserLang =
    typeof window !== 'undefined'
      ? window.navigator.language.slice(0, 2).toLowerCase()
      : null;
  const candidates = [normalizedRequested, browserLang, 'no', 'en'].filter(
    Boolean,
  ) as string[];
  for (const candidate of candidates) {
    if (available.includes(candidate)) {
      return candidate;
    }
  }
  return available[0];
};

export const getLocalizedValue = (
  value: LocaleStringMap | undefined,
  locale: string,
): string => {
  if (!value) return '';
  return (
    value[locale] ??
    value.no ??
    value.en ??
    Object.values(value).find((entry) => entry?.trim()) ??
    ''
  );
};

export const getLocalizedList = (
  value: LocaleStringArrayMap | undefined,
  locale: string,
): string[] => {
  if (!value) return [];
  return (
    value[locale] ??
    value.no ??
    value.en ??
    Object.values(value).find((entry) => entry && entry.length) ??
    []
  );
};

export const getDateLocale = (locale: string): string => {
  switch (locale) {
    case 'en':
      return 'en-GB';
    case 'it':
      return 'it-IT';
    case 'sv':
      return 'sv-SE';
    default:
      return 'nb-NO';
  }
};

