import React from 'react';

type Option = { id: string; name: string };

export default function RestaurantSwitcher({
  options,
  value,
  onChange,
}: {
  options: Option[];
  value?: string;
  onChange: (id: string) => void;
}) {
  if (!options?.length) return null;
  return (
    <div className="w-full max-w-md">
      <label className="block text-sm font-medium text-slate-700 mb-1">Restaurant</label>
      <select
        className="w-full rounded-xl border border-slate-300 bg-white p-2 text-sm"
        value={value || options[0]?.id}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(r => (
          <option key={r.id} value={r.id}>{r.name}</option>
        ))}
      </select>
    </div>
  );
}

