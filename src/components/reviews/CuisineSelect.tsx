import React from 'react';
import { CUISINES, getCuisineLabel } from '../../utils/taxonomy';

interface CuisineSelectProps {
  value?: string[];
  onChange: (values: string[]) => void;
  options?: string[];
}

const CuisineSelect: React.FC<CuisineSelectProps> = ({ value = [], onChange, options = CUISINES }) => {
  const normalizedValue = React.useMemo(() => new Set(value.map((entry) => entry.toLowerCase())), [value]);

  const handleToggle = (cuisine: string) => {
    const slug = cuisine.toLowerCase();
    const next = new Set(normalizedValue);
    if (next.has(slug)) {
      next.delete(slug);
    } else {
      next.add(slug);
    }
    onChange(Array.from(next));
  };

  return (
    <div className="flex flex-wrap gap-3">
      {options.map((option) => {
        const slug = option.toLowerCase();
        const selected = normalizedValue.has(slug);
        return (
          <button
            key={slug}
            type="button"
            aria-pressed={selected}
            onClick={() => handleToggle(option)}
            className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
              selected ? 'bg-red-500 text-white shadow-md shadow-red-200/60' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            {getCuisineLabel(slug)}
          </button>
        );
      })}
    </div>
  );
};

export default CuisineSelect;
