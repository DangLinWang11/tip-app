import React from 'react';
import { useI18n } from '../../lib/i18n/useI18n';

type CategorySlug = 'appetizer' | 'entree' | 'handheld' | 'side' | 'dessert' | 'drink';

type DishCategorySelectProps = {
  value?: CategorySlug | null;
  onSelect: (slug: CategorySlug) => void;
  options?: Array<CategorySlug | string>;
};

const DEFAULT_OPTIONS: CategorySlug[] = ['appetizer', 'entree', 'handheld', 'side', 'dessert', 'drink'];

const CATEGORY_FALLBACK: Record<CategorySlug, string> = {
  appetizer: 'Appetizer',
  entree: 'Entrée',
  handheld: 'Handheld',
  side: 'Side',
  dessert: 'Dessert',
  drink: 'Drink'
};

const missingWarned = new Set<string>();

const toSlug = (opt: string): CategorySlug => {
  const raw = opt.startsWith('categories.') ? opt.slice('categories.'.length) : opt;
  return raw as CategorySlug;
};

const labelFor = (translate: (key: string) => string, slug: CategorySlug): string => {
  const key = `categories.${slug}`;
  const value = translate(key);
  if (!value || value === key) {
    if (!missingWarned.has(key)) {
      // eslint-disable-next-line no-console
      console.warn(`[i18n] Missing key: ${key}. Using fallback label.`);
      missingWarned.add(key);
    }
    return CATEGORY_FALLBACK[slug];
  }
  return value;
};

const DishCategorySelect: React.FC<DishCategorySelectProps> = ({ value = null, onSelect, options }) => {
  const { t } = useI18n();
  const list = options ?? DEFAULT_OPTIONS;

  return (
    <div className="flex flex-wrap gap-3">
      {list.map((opt) => {
        const slug = toSlug(String(opt));
        const selected = value === slug;
        return (
          <button
            key={slug}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(slug)}
            className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
              selected ? 'bg-red-500 text-white shadow-md shadow-red-200/60' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            {labelFor(t, slug)}
          </button>
        );
      })}
    </div>
  );
};

export default DishCategorySelect;
