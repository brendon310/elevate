import { useTranslation } from 'react-i18next';

/**
 * Returns the translated name + description for a track slug.
 * Falls back to the original English name if no translation found.
 */
export function useTrackName(slug: string, fallbackName: string, fallbackDesc?: string) {
  const { t } = useTranslation();
  const name = t(`tracks.${slug}.name`, { defaultValue: fallbackName });
  const desc = t(`tracks.${slug}.desc`, { defaultValue: fallbackDesc ?? '' });
  return { name, desc };
}

/**
 * Translates a track category string.
 */
export function useCategoryName(category: string) {
  const { t } = useTranslation();
  return t(`categories.${category}`, { defaultValue: category });
}
